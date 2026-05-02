import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

async function getGrsaiConfig(): Promise<{ apiKey: string; baseUrl: string }> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('admin_settings')
    .select('key, value')
    .in('key', ['grsai_api_key', 'grsai_base_url']);

  const settings = Object.fromEntries((data || []).map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    apiKey: settings.grsai_api_key || process.env.GRSAI_API_KEY || '',
    baseUrl: settings.grsai_base_url || 'https://grsai.dakka.com.cn',
  };
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { taskId } = body as { taskId?: string };

    if (!taskId) {
      return NextResponse.json({ error: '请输入任务ID' }, { status: 400 });
    }

    const { apiKey, baseUrl } = await getGrsaiConfig();
    if (!apiKey) {
      return NextResponse.json({ error: '未配置 GrsAI API Key，请先在 API 令牌设置中配置' }, { status: 400 });
    }

    console.log(`[Admin Import] Importing task ${taskId} from GrsAI...`);

    // Query GrsAI for task result
    const resultResponse = await fetch(`${baseUrl}/v1/draw/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ task_id: taskId }),
    });

    if (!resultResponse.ok) {
      const errText = await resultResponse.text();
      return NextResponse.json({ error: `GrsAI 查询失败: ${errText}` }, { status: 400 });
    }

    const resultData = await resultResponse.json();

    if (resultData.code !== 0 && resultData.code !== 22) {
      return NextResponse.json({ error: `GrsAI 返回错误: ${resultData.msg || resultData.message || '未知错误'}` }, { status: 400 });
    }

    if (!resultData.data?.results || resultData.data.results.length === 0) {
      return NextResponse.json({ error: '该任务暂无结果，可能仍在生成中' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const imported: Array<{ id: string; prompt: string }> = [];

    for (const result of resultData.data.results) {
      const imageUrl = result.url;
      if (!imageUrl) continue;

      // Check if already imported
      const { data: existing } = await supabase
        .from('gallery_images')
        .select('id')
        .eq('task_id', taskId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          error: '该任务已导入过',
          existing: existing.id,
        }, { status: 400 });
      }

      // Upload to S3
      let imageKey = '';
      try {
        const { S3Storage } = await import('coze-coding-dev-sdk');
        const storage = new S3Storage();
        imageKey = await storage.uploadFromUrl({ url: imageUrl });
      } catch (uploadErr) {
        console.error('[Admin Import] S3 upload failed, using original URL:', uploadErr);
      }

      // Generate permanent URL
      let permanentUrl = imageUrl;
      if (imageKey) {
        try {
          const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
          const proto = domain.startsWith('http') ? '' : 'https://';
          const signUrl = `${proto}${domain}/sign-url?key=${encodeURIComponent(imageKey)}&expire_time=0`;
          const signResponse = await fetch(signUrl);
          if (signResponse.ok) {
            const signData = await signResponse.json();
            permanentUrl = signData.url || imageUrl;
          }
        } catch {
          permanentUrl = imageUrl;
        }
      }

      // Determine dimensions from ratio or default
      const width = result.width || 9;
      const height = result.height || 16;

      const { data: inserted, error: insertError } = await supabase
        .from('gallery_images')
        .insert({
          prompt: resultData.data.prompt || `导入任务 ${taskId}`,
          url: permanentUrl,
          image_key: imageKey || null,
          width,
          height,
          views: 0,
          downloads: 0,
          model: 'imported',
          ratio: `${width}:${height}`,
          task_id: taskId,
        })
        .select('id, prompt')
        .single();

      if (insertError) {
        console.error('[Admin Import] DB insert error:', insertError);
        continue;
      }

      if (inserted) {
        imported.push({ id: inserted.id, prompt: inserted.prompt });
      }
    }

    return NextResponse.json({
      success: true,
      count: imported.length,
      imported,
    });
  } catch (err) {
    console.error('[Admin Import] Error:', err);
    return NextResponse.json({ error: '导入失败，请检查任务ID是否正确' }, { status: 500 });
  }
}
