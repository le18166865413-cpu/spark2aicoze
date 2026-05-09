import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 返回当前登录的用户信息（如果已登录）
export async function verifyUser(): Promise<{
  id: string;
  username: string;
  nickname: string | null;
  role: string;
  status: string;
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

  const { data: user } = await supabase
    .from('users')
    .select('id, username, nickname, role, status')
    .eq('id', session.user_id)
    .single();

  if (!user) return null;

  return user;
}

// 验证管理员身份
export async function verifyAdmin() {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}
