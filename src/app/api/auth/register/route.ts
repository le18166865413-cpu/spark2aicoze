import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: Request) {
  try {
    const { username, password, nickname } = await request.json();

    if (!username || !password || !nickname) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ error: '账号长度需3-20个字符' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少6个字符' }, { status: 400 });
    }

    // Check if username exists
    const { data: existing } = await getSupabaseClient()
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '该账号已被注册' }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data: user, error } = await getSupabaseClient()
      .from('users')
      .insert({
        username,
        password: hashedPassword,
        nickname,
        role: 'user',
      })
      .select('id, username, nickname, role, created_at')
      .single();

    if (error) {
      console.error('Create user error:', error);
      return NextResponse.json({ error: '注册失败，请重试' }, { status: 500 });
    }

    // Create session token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { error: sessionError } = await getSupabaseClient()
      .from('user_sessions')
      .insert({
        id: token,
        user_id: user.id,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Create session error:', sessionError);
      return NextResponse.json({ error: '注册失败，请重试' }, { status: 500 });
    }

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role },
    });

    response.cookies.set('user_session', token, {
      httpOnly: true,
      secure: process.env.COZE_PROJECT_ENV === 'PROD',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: '注册失败，请重试' }, { status: 500 });
  }
}
