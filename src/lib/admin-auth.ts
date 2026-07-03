import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createServerClient } from '@supabase/ssr';
import bcrypt from 'bcryptjs';

// 返回当前登录的用户信息（如果已登录）
// 支持两种认证方式：
// 1. Cookie session（旧方式，user_sessions 表）
// 2. x-session Header（Supabase Auth JWT）
export async function verifyUser(): Promise<{
  id: string;
  username: string;
  nickname: string | null;
  role: string;
  status: string;
  can_generate: boolean | null;
  email?: string;
} | null> {
  // 先尝试 x-session Header（Supabase Auth JWT）
  // 注意：在 Server Action 中无法直接读取 request headers
  // 这个函数主要用于 Cookie 认证，x-session 认证请使用 verifyUserFromRequest
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

  // 更新 last_active_at
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

// 从 Request 对象验证用户（支持 x-session Header）
export async function verifyUserFromRequest(request: Request): Promise<{
  id: string;
  username: string;
  nickname: string | null;
  role: string;
  status: string;
  can_generate: boolean | null;
  email?: string;
} | null> {
  // 1. 先尝试 x-session Header（Supabase Auth JWT）
  const xSession = request.headers.get('x-session');
  if (xSession) {
    try {
      const supabaseUrl = process.env.COZE_SUPABASE_URL;
      const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) return null;

      const supabase = getSupabaseClient();
      const { data: { user: authUser }, error } = await supabase.auth.getUser(xSession);

      if (error || !authUser) return null;

      // 用 Supabase Auth 的 email 查找或创建本地用户
      const email = authUser.email;
      if (!email) return null;

      const { data: localUser } = await supabase
        .from('users')
        .select('id, username, nickname, role, status, can_generate')
        .eq('email', email)
        .single();

      if (localUser) {
        return { ...localUser, email };
      }

      // 用户在 Supabase Auth 中存在但本地 users 表没有记录
      // 自动创建本地用户（默认 role=user, status=approved）
      const username = email.split('@')[0];
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          username,
          email,
          nickname: username,
          role: 'user',
          status: 'approved',
          can_generate: true,
        })
        .select('id, username, nickname, role, status, can_generate')
        .single();

      if (newUser) {
        return { ...newUser, email };
      }

      return null;
    } catch {
      // x-session 验证失败，继续尝试 Cookie 方式
    }
  }

  // 2. 尝试 Cookie session（旧方式）
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

  const { data: user } = await supabase
    .from('users')
    .select('id, username, nickname, role, status, can_generate')
    .eq('id', session.user_id)
    .single();

  if (!user) return null;

  return user;
}

// 清理过期 session
export async function cleanupExpiredSessions() {
  const supabase = getSupabaseClient();

  await supabase
    .from('user_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString());

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('user_sessions')
    .delete()
    .lt('last_active_at', thirtyDaysAgo);
}

// 验证管理员身份（Cookie 方式，用于 Server Actions）
export async function verifyAdmin() {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

// 从 Request 验证管理员身份（支持 x-session Header）
export async function verifyAdminFromRequest(request: Request) {
  const user = await verifyUserFromRequest(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

// 通过 API Token 验证
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

// 从环境变量初始化管理员账号
let adminInitialized = false;

export async function ensureAdminFromEnv() {
  if (adminInitialized) return;

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) return;

  const supabase = getSupabaseClient();

  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('username', adminUsername)
      .single();

    if (existing) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await supabase
        .from('users')
        .update({
          password: hashedPassword,
          role: 'admin',
          status: 'approved',
          can_generate: true,
        })
        .eq('id', existing.id);
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await supabase
        .from('users')
        .insert({
          username: adminUsername,
          password: hashedPassword,
          nickname: '管理员',
          role: 'admin',
          status: 'approved',
          can_generate: true,
        });
    }

    adminInitialized = true;
  } catch (error) {
    console.error('[Admin Init] Failed to ensure admin from env:', error);
  }
}
