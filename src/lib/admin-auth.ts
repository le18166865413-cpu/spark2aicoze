import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const ADMIN_USERNAME = 'wuhe';
const ADMIN_PASSWORD = '666666';
const SESSION_COOKIE = 'admin_session';
const SESSION_DURATION_HOURS = 24;

export function validateCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export async function createSession(): Promise<string> {
  const sessionId = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  const supabase = getSupabaseClient();
  await supabase.from('admin_sessions').insert({
    id: sessionId,
    username: ADMIN_USERNAME,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  return sessionId;
}

export async function validateSession(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('admin_sessions')
    .select('expires_at')
    .eq('id', sessionId)
    .single();

  if (!data) return false;
  return new Date(data.expires_at) > new Date();
}

export async function destroySession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('admin_sessions').delete().eq('id', sessionId);
}

export async function getAdminSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const sessionId = await getAdminSession();
  if (!sessionId) return false;
  return validateSession(sessionId);
}

export { SESSION_COOKIE, SESSION_DURATION_HOURS };
