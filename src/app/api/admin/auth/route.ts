import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET - 检查当前管理员认证状态
export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const sessionMatch = cookieHeader.match(/user_session=([^;]+)/);
    if (!sessionMatch) {
      return NextResponse.json({ authenticated: false });
    }

    const sessionId = sessionMatch[1];
    const supabase = getSupabaseClient();

    // Check session
    const { data: session } = await supabase
      .from('user_sessions')
      .select('user_id, expires_at')
      .eq('id', sessionId)
      .single();

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ authenticated: false });
    }

    // Check user role
    const { data: user } = await supabase
      .from('users')
      .select('id, username, nickname, role')
      .eq('id', session.user_id)
      .single();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
