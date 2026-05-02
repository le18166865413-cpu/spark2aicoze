import { getSupabaseClient } from '@/storage/database/supabase-client';

// 验证管理员 session token
export async function verifyAdminSession(token: string | null): Promise<boolean> {
  if (!token) return false;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('id, expires_at')
      .eq('id', token)
      .single();

    if (error || !data) return false;
    if (new Date(data.expires_at) < new Date()) {
      // 过期 session，删除
      await supabase.from('admin_sessions').delete().eq('id', token);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Verify session error:', error);
    return false;
  }
}

// 创建 session
export async function createSession(username: string): Promise<string | null> {
  try {
    const sessionId = Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 8);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('admin_sessions')
      .insert({ id: sessionId, username, expires_at: expiresAt });

    if (error) {
      console.error('Create session error:', error);
      return null;
    }
    return sessionId;
  } catch (error) {
    console.error('Create session error:', error);
    return null;
  }
}

// 删除 session
export async function deleteSession(token: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('admin_sessions').delete().eq('id', token);
  } catch (error) {
    console.error('Delete session error:', error);
  }
}

// 从请求中提取 token（优先从 header，其次从 cookie）
export function extractToken(request: Request): string | null {
  const headerToken = request.headers.get('x-admin-session');
  if (headerToken) return headerToken;

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  return match ? match[1] : null;
}
