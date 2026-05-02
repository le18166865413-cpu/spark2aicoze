import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const ADMIN_USERNAME = 'wuhe';
const ADMIN_PASSWORD = '666666';
const SESSION_COOKIE = 'admin_session';
const SESSION_DURATION_HOURS = 24;

export function validateCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export async function createSession(): Promise<string | null> {
  try {
    const sessionId = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('admin_sessions').insert({
      id: sessionId,
      username: ADMIN_USERNAME,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error('Failed to create session:', error);
      return null;
    }

    return sessionId;
  } catch (error) {
    console.error('Session creation error:', error);
    return null;
  }
}

export async function validateSession(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('expires_at')
      .eq('id', sessionId)
      .single();

    if (error || !data) return false;
    return new Date(data.expires_at) > new Date();
  } catch {
    return false;
  }
}

export async function destroySession(sessionId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('admin_sessions').delete().eq('id', sessionId);
  } catch (error) {
    console.error('Failed to destroy session:', error);
  }
}

export async function getAdminSession(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const sessionId = await getAdminSession();
  if (!sessionId) return false;
  return validateSession(sessionId);
}

export { SESSION_COOKIE, SESSION_DURATION_HOURS };
