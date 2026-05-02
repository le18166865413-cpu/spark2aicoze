import { getSupabaseClient } from '@/storage/database/supabase-client';

const SESSION_EXPIRY_HOURS = 24;
const supabase = getSupabaseClient();

export async function createSession(username: string): Promise<string | null> {
  const id = crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).substring(2, 8);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from('admin_sessions')
      .insert({ id, username, expires_at: expiresAt })
      .select('id')
      .single();

    if (error) {
      console.error('Create session DB error:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('Create session error:', err);
    return null;
  }
}

export async function isAdminAuthenticated(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;

  try {
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('id, expires_at')
      .eq('id', token)
      .single();

    if (error || !data) return false;

    const expiresAt = new Date(data.expires_at);
    if (expiresAt <= new Date()) {
      // 过期了，删除
      await supabase.from('admin_sessions').delete().eq('id', token);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function deleteSession(token: string): Promise<void> {
  try {
    await supabase.from('admin_sessions').delete().eq('id', token);
  } catch {
    // ignore
  }
}

// 从请求中获取 session token（cookie 或 header）
export function getSessionToken(request: Request): string | null {
  // 优先从 cookie 读取
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMatch = cookieHeader.match(/admin_session=([^;]+)/);
  if (cookieMatch) return cookieMatch[1];

  // 备用：从自定义 header 读取
  const headerToken = request.headers.get('x-admin-session');
  if (headerToken) return headerToken;

  return null;
}
