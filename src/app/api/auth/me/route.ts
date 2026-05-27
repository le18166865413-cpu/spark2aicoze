import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('user_session')?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    // Find session
    const { data: session, error: sessionError } = await getSupabaseClient()
      .from('user_sessions')
      .select('user_id, expires_at')
      .eq('id', token)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ user: null });
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      await getSupabaseClient().from('user_sessions').delete().eq('id', token);
      return NextResponse.json({ user: null });
    }

    // Get user
    const { data: user, error: userError } = await getSupabaseClient()
      .from('users')
      .select('id, username, nickname, role, status, email')
      .eq('id', session.user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ user: null });
  }
}
