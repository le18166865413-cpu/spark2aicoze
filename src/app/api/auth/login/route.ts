import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
    }

    // Find user
    const { data: user, error } = await getSupabaseClient()
      .from('users')
      .select('id, username, password, nickname, role, status')
      .eq('username', username)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });
    }

    // Check approval status
    if (user.status === 'pending') {
      return NextResponse.json({ error: '账号待审批，请等待管理员审核' }, { status: 403 });
    }

    if (user.status === 'rejected') {
      return NextResponse.json({ error: '账号已被拒绝，请联系管理员' }, { status: 403 });
    }

    // Create session token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { error: sessionError } = await getSupabaseClient()
      .from('user_sessions')
      .insert({
        id: token,
        user_id: user.id,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Create session error:', sessionError);
      return NextResponse.json({ error: '登录失败，请重试' }, { status: 500 });
    }

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role },
    });

    // Set cookie via both response header and next/headers for reliability
    const cookieStore = await cookies();
    cookieStore.set('user_session', token, {
      httpOnly: true,
      secure: process.env.COZE_PROJECT_ENV === 'PROD',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    // Also set on response for client-side reading
    response.cookies.set('user_session', token, {
      httpOnly: true,
      secure: process.env.COZE_PROJECT_ENV === 'PROD',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '登录失败，请重试' }, { status: 500 });
  }
}
