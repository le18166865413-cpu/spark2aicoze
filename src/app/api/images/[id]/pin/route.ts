import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { cookies } from 'next/headers';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_session')?.value;
  if (!token) return null;

  const { data: session } = await getSupabaseClient()
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('id', token)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) return null;

  const { data: user } = await getSupabaseClient()
    .from('users')
    .select('id, username, nickname, role, status')
    .eq('id', session.user_id)
    .single();

  return user;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const { action } = await request.json().catch(() => ({ action: 'pin' }));

    const isPinned = action === 'pin';

    const { error } = await getSupabaseClient()
      .from('gallery_images')
      .update({ is_pinned: isPinned })
      .eq('id', id);

    if (error) {
      console.error('[Pin] Update error:', error);
      return NextResponse.json({ error: '操作失败' }, { status: 500 });
    }

    return NextResponse.json({ pinned: isPinned });
  } catch (error) {
    console.error('[Pin] Error:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
