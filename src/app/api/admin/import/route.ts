import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest } from '@/lib/admin-token-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { storage } from '@/utils/storage';

// POST - 手动导入 GrsAI 任务
export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const isAuth = await verifyToken(token);
  if (!isAuth) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json({ error: '请提供有效的任务 ID' }, { status: 400 });
    }

    // 从 admin_settings 获取 API 配置
    const supabase = getSupabaseClient();
    const { data: settings } = await supabase.from('admin_settings').select('*');
    const settingsMap: Record<string, string> = {};
    for (const s of (settings || [])) {
      settingsMap[s.key] = s.value;
    }

    const apiKey = settingsMap.grsai_api_key || process.env.GRSAI_API_KEY || '';
    const baseUrl = settingsMap.grsai_base_url || 'https://grsai.dakka.com.cn';

    // 查询 GrsAI 任务结果
    const resultResp = await fetch(`${baseUrl}/v1/draw/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ task_id: taskId }),
    });

    const resultData = await resultResp.json();

    if (resultData.code !== 0 && resultData.code !== -22) {
      return NextResponse.json({ error: resultData.msg || '查询任务失败' }, { status: 400 });
    }

    if (!resultData.data?.results || resultData.data.results.length === 0) {
      return NextResponse.json({ error: '任务暂无结果，可能仍在处理中' }, { status: 400 });
    }

    const imported: Array<{ id: string; prompt: string }> = [];

    for (const img of resultData.data.results) {
      if (!img.url) continue;

      // 上传到 S3
      let imageKey = '';
      try {
        imageKey = await storage.uploadFromUrl({
          url: img.url,
        });
      } catch {
        imageKey = img.url;
      }

      // 生成签名 URL
      let signedUrl = img.url;
      if (imageKey && !imageKey.startsWith('http')) {
        try {
          signedUrl = await storage.generatePresignedUrl({ key: imageKey, expireTime: 0 });
        } catch {
          signedUrl = img.url;
        }
      }

      const prompt = img.prompt || resultData.data.prompt || 'GrsAI imported image';
      const width = img.width || 0;
      const height = img.height || 0;
      const model = resultData.data.model || 'unknown';
      const ratio = width && height ? `${width}:${height}` : '1:1';

      const { data: inserted, error } = await supabase
        .from('gallery_images')
        .insert({
          image_key: imageKey,
          prompt,
          url: signedUrl,
          width,
          height,
          model,
          ratio,
          task_id: taskId,
          views: 0,
          downloads: 0,
        })
        .select('id, prompt')
        .single();

      if (!error && inserted) {
        imported.push(inserted);
      }
    }

    return NextResponse.json({
      success: true,
      count: imported.length,
      imported,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}
