import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { storage } from '@/utils/storage';

interface GrsAIResultResponse {
  code: number;
  msg: string;
  data: {
    status: 'processing' | 'success' | 'failed';
    images: Array<{ url: string; seed: number }>;
    prompt: string;
  };
}

async function getSignedUrl(key: string): Promise<string> {
  try {
    const token = process.env.COZE_WORKLOAD_IDENTITY_API_KEY || "";
    const endpoint = process.env.COZE_BUCKET_ENDPOINT_URL || "";
    const bucketName = process.env.COZE_BUCKET_NAME || "";

    const signUrlEndpoint = endpoint.replace(/\/$/, "") + "/sign-url";

    const response = await fetch(signUrlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-storage-token": token,
      },
      body: JSON.stringify({
        bucket_name: bucketName,
        path: key,
        expire_time: 0,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate signed URL');
    }

    const data = await response.json();
    if (data.code !== 0 || !data.data?.url) {
      throw new Error('Sign URL error');
    }

    return data.data.url;
  } catch (error) {
    console.error('Failed to get signed URL for key:', key, error);
    return key;
  }
}

export async function POST(request: Request) {
  console.log('Import request received');
  try {
    const body = await request.json();
    console.log('Request body:', body);
    
    let taskId: string;
    if (body.import) {
      taskId = body.import.taskId;
    } else {
      taskId = body.taskId;
    }

    if (!taskId) {
      return NextResponse.json(
        { error: '请提供 GrsAI 任务 ID' },
        { status: 400 }
      );
    }
    console.log('Processing taskId:', taskId);

    const supabase = getSupabaseClient();

    const { data: settings, error: settingsError } = await supabase
      .from('admin_settings')
      .select('*')
      .in('key', ['grsai_api_key', 'grsai_base_url']);

    if (settingsError) {
      console.error('Get settings error:', settingsError);
      return NextResponse.json(
        { error: '获取 API 配置失败' },
        { status: 500 }
      );
    }

    const apiKey = settings?.find((s: any) => s.key === 'grsai_api_key')?.value || '';
    const baseUrl = settings?.find((s: any) => s.key === 'grsai_base_url')?.value || 'https://grsai.dakka.com.cn';

    if (!apiKey) {
      return NextResponse.json(
        { error: '请先在 API 令牌页面配置 GrsAI API Key' },
        { status: 400 }
      );
    }

    console.log('Querying GrsAI task result');
    const resultRes = await fetch(`${baseUrl}/v1/draw/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ task_id: taskId })
    });

    const resultData = await resultRes.json() as GrsAIResultResponse;
    console.log('GrsAI response:', resultData);

    if (resultData.code !== 0 || !resultData.data) {
      return NextResponse.json(
        { error: resultData.msg || '获取任务结果失败' },
        { status: 400 }
      );
    }

    if (resultData.data.status === 'processing') {
      return NextResponse.json(
        { error: '任务正在处理中，请稍后再试' },
        { status: 202 }
      );
    }

    if (resultData.data.status === 'failed') {
      return NextResponse.json(
        { error: '任务生成失败' },
        { status: 400 }
      );
    }

    const imageUrls = resultData.data.images.map(img => img.url);
    const prompt = resultData.data.prompt;
    console.log('Found', imageUrls.length, 'images to import');

    for (const imageUrl of imageUrls) {
      try {
        console.log('Processing image:', imageUrl);
        const key = await storage.uploadFromUrl({
          url: imageUrl,
          timeout: 120000,
        });

        const signedUrl = await getSignedUrl(key);
        console.log('Uploaded to S3:', signedUrl);

        const { error } = await supabase.from('gallery_images').insert({
          prompt: prompt || '从 GrsAI 导入',
          url: signedUrl,
          image_key: key,
          width: 1024,
          height: 1024,
          views: 0,
          downloads: 0,
          model: 'grsai',
          ratio: '1:1',
          task_id: taskId
        });

        if (error) {
          console.error('Save to database error:', error);
        } else {
          console.log('Saved to database');
        }
      } catch (e) {
        console.error('Process image error:', e);
      }
    }

    console.log('Success, imported', imageUrls.length, 'images');
    return NextResponse.json({ success: true, count: imageUrls.length });
  } catch (error) {
    console.error('Import task error:', error);
    return NextResponse.json(
      { error: '导入任务失败' },
      { status: 500 }
    );
  }
}