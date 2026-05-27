import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { cleanupExpiredSessions } from '@/lib/admin-auth';

// 上次清理时间，用于节流（每小时最多清理一次）
let lastCleanupTime = 0;

export async function GET() {
  try {
    // 每小时最多执行一次清理
    const now = Date.now();
    if (now - lastCleanupTime > 60 * 60 * 1000) {
      lastCleanupTime = now;
      cleanupExpiredSessions().catch(() => {}); // fire-and-forget
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('user_session')?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    // Find session
    const { data: session, error: sessionError } = await getSupabaseClient()
      .from('user_sessions')
      .select('user_id, expires_at')
      .eq('id', token)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ user: null, kicked: true });
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      await getSupabaseClient().from('user_sessions').delete().eq('id', token);
      return NextResponse.json({ user: null, kicked: true });
    }

    // Get user
    const { data: user, error: userError } = await getSupabaseClient()
      .from('users')
      .select('id, username, nickname, role, status, email, wechat, avatar, can_generate')
      .eq('id', session.user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ user: null, kicked: true });
    }

    // 更新 last_active_at（fire-and-forget）
    void getSupabaseClient()
      .from('user_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', token);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        status: user.status,
        email: user.email,
        wechat: user.wechat,
        avatar: user.avatar,
        canGenerate: user.can_generate,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ user: null });
  }
}
