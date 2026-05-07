import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface AdminUser {
  id: string;
  role: string;
}

// 验证管理员身份 - 从 user_session cookie 中验证
export async function verifyAdmin(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('user_session')?.value;

    if (!token) {
      console.log('[verifyAdmin] cookie user_session NOT FOUND, available cookies:', cookieStore.getAll().map(c => c.name));
      return null;
    }

    // Find session
    const { data: session, error: sError } = await getSupabaseClient()
      .from('user_sessions')
      .select('user_id, expires_at')
      .eq('id', token)
      .single();

    if (!session || new Date(session.expires_at) < new Date()) {
      console.log('[verifyAdmin] session not found or expired:', sError?.message || 'expired');
      return null;
    }

    // Get user and check role
    const { data: user, error: uError } = await getSupabaseClient()
      .from('users')
      .select('id, role')
      .eq('id', session.user_id)
      .single();

    if (!user || user.role !== 'admin') {
      console.log('[verifyAdmin] user not found or not admin:', uError?.message || `role=${user?.role}`);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Verify admin error:', error);
    return null;
  }
}

// 验证普通用户身份 - 从 user_session cookie 中验证
export async function verifyUser(): Promise<{ id: string; role: string; nickname: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('user_session')?.value;

    if (!token) {
      return null;
    }

    // Find session
    const { data: session } = await getSupabaseClient()
      .from('user_sessions')
      .select('user_id, expires_at')
      .eq('id', token)
      .single();

    if (!session || new Date(session.expires_at) < new Date()) {
      return null;
    }

    // Get user
    const { data: user } = await getSupabaseClient()
      .from('users')
      .select('id, role, nickname, status')
      .eq('id', session.user_id)
      .single();

    if (!user || user.status !== 'approved') {
      return null;
    }

    return { id: user.id, role: user.role, nickname: user.nickname };
  } catch (error) {
    console.error('Verify user error:', error);
    return null;
  }
}
