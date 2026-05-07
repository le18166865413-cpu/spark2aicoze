import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyAdmin } from '@/lib/admin-auth';

export async function GET() {
  // Verify admin
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
  }

  try {
    const { data, error } = await getSupabaseClient()
      .from('admin_settings')
      .select('*')
      .order('key', { ascending: true });

    if (error) {
      return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Admin Settings API] GET Exception:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Verify admin
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
  }

  try {
    const body = await request.json();
    
    // 支持两种格式：直接数组或 { settings: [...] }
    const settingsToSave = Array.isArray(body) ? body : body.settings;
    
    if (!Array.isArray(settingsToSave)) {
      return NextResponse.json({ error: '无效的请求格式' }, { status: 400 });
    }

    const results = [];

    for (const setting of settingsToSave) {
      const { data, error } = await getSupabaseClient()
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
        return NextResponse.json({ error: `保存 ${setting.key} 失败` }, { status: 500 });
      }
      
      results.push(data);
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[Admin Settings API] PUT Exception:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
