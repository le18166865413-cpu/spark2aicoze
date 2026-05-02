import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: Request) {
  try {
    console.log('[Settings API] GET request received');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .order('key');

    if (error) {
      console.error('[Settings API] Get settings error:', error);
      return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
    }

    console.log('[Settings API] GET successful, returning', data?.length, 'settings');
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Settings API] Get settings error:', error);
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const settings = await request.json();
    console.log('[Settings API] PUT request received, body:', JSON.stringify(settings));

    if (!Array.isArray(settings)) {
      console.error('[Settings API] Invalid request: body is not an array');
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    for (const { key, value } of settings) {
      if (!key) {
        console.error('[Settings API] Invalid setting: missing key');
        continue;
      }

      console.log('[Settings API] Upserting setting:', key, '=', value);
      const { data, error } = await supabase
        .from('admin_settings')
        .upsert({ key, value }, { onConflict: 'key' })
        .select();

      if (error) {
        console.error('[Settings API] Update setting error:', error);
        return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
      }

      console.log('[Settings API] Upserted successfully:', data);
    }

    console.log('[Settings API] PUT successful');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Settings API] Update settings error:', error);
    return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
  }
}