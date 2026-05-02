import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .order('key');

    if (error) {
      console.error('Get settings error:', error);
      return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const settings = await request.json();
    const supabase = getSupabaseClient();

    for (const { key, value } of settings) {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key, value }, { onConflict: 'key' });

      if (error) {
        console.error('Update setting error:', error);
        return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
  }
}
