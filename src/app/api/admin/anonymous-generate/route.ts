import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyUser } from '@/lib/admin-auth';

export async function GET() {
  try {
    const { data, error } = await getSupabaseClient()
      .from('admin_settings')
      .select('value')
      .eq('key', 'anonymous_generate')
      .single();

    if (error || !data) {
      return NextResponse.json({ enabled: false });
    }

    return NextResponse.json({ enabled: data.value === 'true' });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}

export async function PUT(request: NextRequest) {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const enabled = body.enabled === true;

    const { error } = await getSupabaseClient()
      .from('admin_settings')
      .upsert(
        {
          key: 'anonymous_generate',
          value: enabled ? 'true' : 'false',
          category: 'general',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    if (error) {
      return NextResponse.json({ error: '保存失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, enabled });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
