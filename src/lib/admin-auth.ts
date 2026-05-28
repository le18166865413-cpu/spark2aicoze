import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import bcrypt from 'bcryptjs';

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

// 验证管理员身份
export async function verifyAdmin() {
  const user = await verifyUser();
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
// 环境变量：ADMIN_USERNAME, ADMIN_PASSWORD
let adminInitialized = false;

export async function ensureAdminFromEnv() {
  if (adminInitialized) return;

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) return;

  const supabase = getSupabaseClient();

  try {
    // 检查是否已存在该管理员
    const { data: existing } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('username', adminUsername)
      .single();

    if (existing) {
      // 管理员已存在，更新密码（确保与环境变量一致）
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
      // 创建管理员
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
