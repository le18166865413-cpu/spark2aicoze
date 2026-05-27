import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 返回当前登录的用户信息（如果已登录）
export async function verifyUser(): Promise<{
  id: string;
  username: string;
  nickname: string | null;
  role: string;
  status: string;
  can_generate: boolean | null;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_session')?.value;

  if (!token) return null;

  const supabase = getSupabaseClient();

  const { data: session } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('id', token)
    .single();

  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('user_sessions').delete().eq('id', token);
    return null;
  }

  // 更新 last_active_at（节流：每次请求都更新太频繁，但 Supabase 没有 upsert 条件更新，直接更新即可）
  // 注意：这里不做节流，因为 Supabase update 很轻量
  void supabase
    .from('user_sessions')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', token);

  const { data: user } = await supabase
    .from('users')
    .select('id, username, nickname, role, status, can_generate')
    .eq('id', session.user_id)
    .single();

  if (!user) return null;

  return user;
}

// 清理过期 session（超过 7 天的过期 session + 超过 30 天未活跃的 session）
export async function cleanupExpiredSessions() {
  const supabase = getSupabaseClient();

  // 删除已过期的 session
  await supabase
    .from('user_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString());

  // 删除 30 天未活跃的 session（即使未过期）
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('user_sessions')
    .delete()
    .lt('last_active_at', thirtyDaysAgo);
}

// 验证管理员身份
export async function verifyAdmin() {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

// 通过 API Token 验证（用于第三方系统对接）
export async function verifyApiToken(request: Request): Promise<{
  id: string;
  name: string;
  permissions: string[];
} | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const supabase = getSupabaseClient();

  const { data: record } = await supabase
    .from('api_tokens')
    .select('id, name, permissions, expires_at')
    .eq('token', token)
    .single();

  if (!record) return null;

  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return null;
  }

  // Update last_used_at
  await supabase
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', record.id);

  return {
    id: record.id as string,
    name: record.name as string,
    permissions: (record.permissions as string[]) || ['read'],
  };
}
