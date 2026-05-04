import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { storage } from '@/utils/storage';
import { getStorageErrorMessage } from '@/utils/storage-error';

interface GrsAIResultData {
  id: string;
  status: string;
  progress: number;
  error: string;
  failure_reason: string;
  results: Array<{ url: string }>;
  prompt?: string;
  aspectRatio?: string;
  model?: string;
}

interface GrsAIResultResponse {
  code: number;
  msg: string;
  data: GrsAIResultData | null;
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

function estimateDimensions(ratio: string): { width: number; height: number } {
  const dimMap: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "9:16": { width: 1024, height: 1792 },
    "3:4": { width: 1024, height: 1365 },
    "16:9": { width: 1792, height: 1024 },
    "4:3": { width: 1365, height: 1024 },
    "2:3": { width: 1024, height: 1536 },
    "3:2": { width: 1536, height: 1024 },
  };
  return dimMap[ratio] || { width: 1024, height: 1024 };
}

async function importImage(
  imageUrl: string,
  prompt: string,
  ratio: string,
  model: string,
  taskId: string,
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existing } = await supabase
      .from('gallery_images')
      .select('id')
      .eq('task_id', taskId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('Task already imported:', taskId);
      return { success: true };
    }

    console.log('Uploading image from URL:', imageUrl.substring(0, 100));
    let key: string;
    try {
      key = await storage.uploadFromUrl({
        url: imageUrl,
        timeout: 120000,
      });
    } catch (uploadError) {
      console.error('S3 upload failed:', uploadError);
      return { success: false, error: getStorageErrorMessage(uploadError) };
    }

    const signedUrl = await getSignedUrl(key);
    console.log('Uploaded to S3, signed URL obtained');

    const { width, height } = estimateDimensions(ratio);

    const { error } = await supabase.from('gallery_images').insert({
      prompt: prompt || '从 GrsAI 导入',
      url: signedUrl,
      image_key: key,
      width,
      height,
      views: 0,
      downloads: 0,
      model: model || 'grsai',
      ratio: ratio || '1:1',
      task_id: taskId
    });

    if (error) {
      console.error('Save to database error:', error);
      return { success: false, error: error.message };
    }

    console.log('Saved to database, task:', taskId);
    return { success: true };
  } catch (e) {
    console.error('Import image error:', e);
    return { success: false, error: String(e) };
  }
}

export async function POST(request: Request) {
  console.log('Import request received');
  try {
    const body = await request.json();
    console.log('Request body keys:', Object.keys(body));

    let taskId = '';
    let rawText = '';

    const payload = body.import || body;
    taskId = payload.taskId || '';
    rawText = payload.rawText || '';

    if (!taskId) {
      return NextResponse.json(
        { error: '请提供 GrsAI 任务 ID' },
        { status: 400 }
      );
    }

    console.log('Processing taskId:', taskId);

    const supabase = getSupabaseClient();

    // Check if already imported
    const { data: existing } = await supabase
      .from('gallery_images')
      .select('id')
      .eq('task_id', taskId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('Task already imported, skipping:', taskId);
      return NextResponse.json({ success: true, count: 0, skipped: true });
    }

    // Try to extract data from raw text first
    let extractedFromText = false;
    if (rawText) {
      const jsonPattern = /\{[^{}]*"url"\s*:\s*"([^"]+)"[^{}]*\}/g;
      const urls: string[] = [];
      let match;
      while ((match = jsonPattern.exec(rawText)) !== null) {
        if (match[1] && match[1].startsWith('http')) {
          urls.push(match[1]);
        }
      }

      let prompt = '';
      const promptMatch = rawText.match(/"prompt"\s*:\s*"([^"]+)"/);
      if (promptMatch) {
        prompt = promptMatch[1];
      }

      let ratio = '1:1';
      const ratioMatch = rawText.match(/"aspectRatio"\s*:\s*"([^"]+)"/);
      if (ratioMatch) {
        ratio = ratioMatch[1];
      }

      let model = 'grsai';
      const nearbyModel = rawText.match(/(gpt-image-2-vip|gpt-image-2|nano-banana-fast)/);
      if (nearbyModel) {
        model = nearbyModel[1];
      }

      // Try to find direct image URLs
      const directUrlPattern = /https?:\/\/[^\s"<>]+(?:\.png|\.jpg|\.jpeg|\.webp)[^\s"<>]*/g;
      while ((match = directUrlPattern.exec(rawText)) !== null) {
        const url = match[0];
        if (!urls.includes(url)) {
          urls.push(url);
        }
      }

      if (urls.length > 0) {
        console.log('Extracted', urls.length, 'image URLs from raw text');

        let imported = 0;
        for (const imageUrl of urls) {
          const result = await importImage(imageUrl, prompt, ratio, model, taskId, supabase);
          if (result.success) imported++;
        }

        if (imported > 0) {
          extractedFromText = true;
          return NextResponse.json({
            success: true,
            count: imported,
            source: 'text_extraction'
          });
        }
      }
    }

    // Fallback: Query GrsAI API for the result
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

    const apiKey = settings?.find((s: { key: string }) => s.key === 'grsai_api_key')?.value || '';
    const baseUrl = settings?.find((s: { key: string }) => s.key === 'grsai_base_url')?.value || 'https://grsai.dakka.com.cn';

    if (!apiKey) {
      return NextResponse.json(
        { error: '请先在 API 令牌页面配置 GrsAI API Key' },
        { status: 400 }
      );
    }

    // CRITICAL: GrsAI result API uses "id" not "task_id" as the parameter name!
    console.log('Querying GrsAI task result with id:', taskId);
    const resultRes = await fetch(`${baseUrl}/v1/draw/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ id: taskId })
    });

    const resultData = await resultRes.json() as GrsAIResultResponse;
    console.log('GrsAI response code:', resultData.code, 'msg:', resultData.msg);

    if (resultData.code === -22) {
      return NextResponse.json(
        { error: '任务不存在或已过期（GrsAI 仅保留2小时），请粘贴包含图片URL的完整任务信息进行导入' },
        { status: 400 }
      );
    }

    if (resultData.code !== 0 || !resultData.data) {
      return NextResponse.json(
        { error: resultData.msg || '获取任务结果失败' },
        { status: 400 }
      );
    }

    if (resultData.data.status === 'processing' || resultData.data.progress < 100) {
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

    // Extract metadata from GrsAI response
    const grsaiPrompt = resultData.data.prompt || '';
    const grsaiRatio = resultData.data.aspectRatio || '1:1';
    const grsaiModel = resultData.data.model || 'grsai';

    // GrsAI returns results array with url field
    const imageUrls = (resultData.data.results || []).map(img => img.url).filter(Boolean);
    console.log('Found', imageUrls.length, 'images from GrsAI API, prompt:', grsaiPrompt, 'ratio:', grsaiRatio);

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: '任务结果中没有图片' },
        { status: 400 }
      );
    }

    let imported = 0;
    for (const imageUrl of imageUrls) {
      const result = await importImage(imageUrl, grsaiPrompt || '从 GrsAI 导入', grsaiRatio, grsaiModel, taskId, supabase);
      if (result.success) imported++;
    }

    console.log('Imported', imported, 'images via GrsAI API');
    return NextResponse.json({
      success: true,
      count: imported,
      source: 'grsai_api'
    });
  } catch (error) {
    console.error('Import task error:', error);
    return NextResponse.json(
      { error: '导入任务失败' },
      { status: 500 }
    );
  }
}
