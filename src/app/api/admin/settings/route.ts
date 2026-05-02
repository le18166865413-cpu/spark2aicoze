import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET - 获取所有设置
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const authenticated = await verifyAdminSession(token);
  if (!authenticated) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .order('category');

    if (error) {
      console.error('Fetch settings error:', error);
      return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
  }
}

// PUT - 保存设置
export async function PUT(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const authenticated = await verifyAdminSession(token);
  if (!authenticated) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const settings = body.settings || body;

    if (!Array.isArray(settings)) {
      return NextResponse.json({ error: '无效的设置数据' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    for (const setting of settings) {
      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          { key: setting.key, value: setting.value, category: setting.category || 'general', updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) {
        console.error('Save setting error:', error, setting);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save settings error:', error);
    return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
  }
}
