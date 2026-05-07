import { getSupabaseClient } from '@/storage/database/supabase-client';

interface AdminUser {
  id: string;
  role: string;
}

// 验证管理员身份 - 从 user_session cookie 中验证
export async function verifyAdmin(request: Request): Promise<AdminUser | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/user_session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) return null;

  try {
    // Find session
    const { data: session } = await getSupabaseClient()
      .from('user_sessions')
      .select('user_id, expires_at')
      .eq('id', token)
      .single();

    if (!session || new Date(session.expires_at) < new Date()) {
      return null;
    }

    // Get user and check role
    const { data: user } = await getSupabaseClient()
      .from('users')
      .select('id, role')
      .eq('id', session.user_id)
      .single();

    if (!user || user.role !== 'admin') return null;

    return user;
  } catch (error) {
    console.error('Verify admin error:', error);
    return null;
  }
}
