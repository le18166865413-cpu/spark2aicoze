import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';

// 通用 User 类型
export type AuthUser = {
  id: string;
  username: string;
  nickname: string | null;
  role: string;
  status: string;
  can_generate: boolean | null;
  email?: string | null;
  phone?: string | null;
};

// 返回当前登录的用户信息（Server Component / Action 用，仅读 Cookie）
export async function verifyUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('user_session')?.value;
    if (!token) return null;

    const supabase = getSupabaseClient();

    const { data: session } = await supabase
      .from('user_sessions')
      .select('user_id, expires_at')
      .eq('id', token)
      .maybeSingle();

    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      await supabase.from('user_sessions').delete().eq('id', token);
      return null;
    }

    void supabase
      .from('user_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', token);

    const { data: user } = await supabase
      .from('users')
      .select('id, username, nickname, role, status, can_generate, email, phone')
      .eq('id', session.user_id)
      .maybeSingle();

    return user || null;
  } catch {
    return null;
  }
}

// 从 Request 对象验证用户（支持 x-session JWT + Cookie 双认证）
export async function verifyUserFromRequest(request: Request): Promise<AuthUser | null> {
  const supabase = getSupabaseClient();

  // 1. 先尝试 x-session Header（Supabase Auth JWT）
  const xSession = request.headers.get('x-session');
  if (xSession) {
    try {
      const supabaseUrl = process.env.COZE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const authClient = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: { user: authUser }, error } = await authClient.auth.getUser(xSession);
        if (!error && authUser) {
          // 按 Supabase user id 查询本地 users 表
          const { data: localUser } = await supabase
            .from('users')
            .select('id, username, nickname, role, status, can_generate, email, phone')
            .eq('id', authUser.id)
            .maybeSingle();

          if (localUser) return localUser;
        }
      }
    } catch {
      // x-session 验证失败，继续尝试 Cookie
    }
  }

  // 2. Cookie session（管理员用户名密码登录）
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)user_session=([^;]+)/);
    const token = match ? decodeURIComponent(match[1]) : null;
    if (token) {
      const { data: session } = await supabase
        .from('user_sessions')
        .select('user_id, expires_at')
        .eq('id', token)
        .maybeSingle();

      if (session && new Date(session.expires_at) >= new Date()) {
        void supabase
          .from('user_sessions')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', token);

        const { data: user } = await supabase
          .from('users')
          .select('id, username, nickname, role, status, can_generate, email, phone')
          .eq('id', session.user_id)
          .maybeSingle();
        if (user) return user;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

// 清理过期 session
export async function cleanupExpiredSessions() {
  const supabase = getSupabaseClient();
  await supabase.from('user_sessions').delete().lt('expires_at', new Date().toISOString());
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('user_sessions').delete().lt('last_active_at', thirtyDaysAgo);
}

export async function verifyAdmin() {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function verifyAdminFromRequest(request: Request) {
  const user = await verifyUserFromRequest(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

// 确保初始管理员账号存在
export async function ensureAdminFromEnv() {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', 'admin')
    .maybeSingle();

  if (existing) return;

  const bcrypt = (await import('bcryptjs')).default;
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || '666666', 10);

  await supabase.from('users').insert({
    id: crypto.randomUUID(),
    username: 'admin',
    nickname: '管理员',
    password: hashedPassword,
    role: 'admin',
    status: 'approved',
    can_generate: true,
  });
}

// API Token 认证（/api/v1/* 对外开放接口）
export async function verifyApiToken(request: Request): Promise<{ id: string; name: string; permissions: string[] } | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);

    const supabase = getSupabaseClient();
    const { data: tokenRow } = await supabase
      .from('api_tokens')
      .select('id, name, token, permissions, enabled, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (!tokenRow || !tokenRow.enabled) return null;
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) return null;

    await supabase
      .from('api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenRow.id);

    return {
      id: tokenRow.id,
      name: tokenRow.name,
      permissions: (tokenRow.permissions as string[]) || [],
    };
  } catch {
    return null;
  }
}
