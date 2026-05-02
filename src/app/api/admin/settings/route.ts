import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { isAdminAuthenticated } from '@/lib/admin-auth';

export async function GET() {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('admin_settings')
      .select('key, value, category')
      .order('category');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by category
    const settings: Record<string, Record<string, string>> = {};
    for (const row of data || []) {
      if (!settings[row.category]) settings[row.category] = {};
      settings[row.category][row.key] = row.value;
    }

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: '无效的设置数据' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Upsert each setting
    for (const [key, value] of Object.entries(settings)) {
      // Determine category from key prefix
      let category = 'general';
      if (key.includes('api') || key.includes('key') || key.includes('model') || key.includes('url')) {
        category = 'api';
      } else if (key.includes('color') || key.includes('theme') || key.includes('radius')) {
        category = 'theme';
      } else if (key.includes('storage') || key.includes('file') || key.includes('max')) {
        category = 'storage';
      }

      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key, value, category, updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (error) {
        console.error(`Failed to save setting ${key}:`, error);
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
  }
}
