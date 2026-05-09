import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function verifyUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_session')?.value;

  if (!token) {
    return { user: null, session: null };
  }

  const supabase = getSupabaseClient();

  // Find session
  const { data: session } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('id', token)
    .single();

  if (!session) {
    return { user: null, session: null };
  }

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('user_sessions').delete().eq('id', token);
    return { user: null, session: null };
  }

  // Get user
  const { data: user } = await supabase
    .from('users')
    .select('id, username, nickname, role, status')
    .eq('id', session.user_id)
    .single();

  if (!user) {
    return { user: null, session: null };
  }

  return { user, session };
}

export async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_session')?.value;

  if (!token) {
    return null;
  }

  const supabase = getSupabaseClient();

  // Find session
  const { data: session } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('id', token)
    .single();

  if (!session) {
    return null;
  }

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('user_sessions').delete().eq('id', token);
    return null;
  }

  // Get user
  const { data: user } = await supabase
    .from('users')
    .select('id, username, nickname, role, status')
    .eq('id', session.user_id)
    .single();

  if (!user) {
    return null;
  }

  if (user.role !== 'admin') {
    return null;
  }

  return user;
}
