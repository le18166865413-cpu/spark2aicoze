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
      console.log('[verifyAdmin] cookie user_session NOT FOUND');
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
