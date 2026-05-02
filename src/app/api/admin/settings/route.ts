import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  console.log('[Admin Settings API] GET: Fetching all settings');
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .order('key', { ascending: true });

    if (error) {
      console.error('[Admin Settings API] GET Error:', error);
      return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
    }

    console.log('[Admin Settings API] GET Success, found', data?.length || 0, 'settings');
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Admin Settings API] GET Exception:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  console.log('[Admin Settings API] PUT: Starting');
  try {
    const body = await request.json();
    console.log('[Admin Settings API] PUT Received body:', body);
    
    // 支持两种格式：直接数组或 { settings: [...] }
    const settingsToSave = Array.isArray(body) ? body : body.settings;
    
    if (!Array.isArray(settingsToSave)) {
      console.error('[Admin Settings API] PUT: Body is not an array');
      return NextResponse.json({ error: '无效的请求格式' }, { status: 400 });
    }
    
    console.log('[Admin Settings API] PUT: Settings to save:', settingsToSave);

    const supabase = getSupabaseClient();
    const results = [];

    for (const setting of settingsToSave) {
      console.log('[Admin Settings API] PUT: Upserting setting:', setting);
      const { data, error } = await supabase
        .from('admin_settings')
        .upsert(
          { 
            key: setting.key, 
            value: setting.value, 
            category: setting.category || 'general',
            updated_at: new Date().toISOString() 
          },
          { onConflict: 'key' }
        )
        .select();

      if (error) {
        console.error('[Admin Settings API] PUT: Upsert error for', setting.key, ':', error);
        return NextResponse.json({ error: `保存 ${setting.key} 失败` }, { status: 500 });
      }
      
      console.log('[Admin Settings API] PUT: Upsert result for', setting.key, ':', data);
      results.push(data);
    }

    console.log('[Admin Settings API] PUT: All saved successfully');
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[Admin Settings API] PUT Exception:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}