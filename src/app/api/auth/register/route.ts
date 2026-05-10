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

    // Create user with pending status (requires admin approval)
    const { data: user, error } = await getSupabaseClient()
      .from('users')
      .insert({
        username,
        password: hashedPassword,
        plain_password: password,
        nickname,
        role: 'user',
        status: 'pending',
      })
      .select('id, username, nickname, role, status, created_at')
      .single();

    if (error) {
      console.error('Create user error:', error);
      return NextResponse.json({ error: '注册失败，请重试' }, { status: 500 });
    }

    // Return success with pending status message - no auto-login
    return NextResponse.json({
      message: '注册成功，请等待管理员审批后即可登录',
      status: 'pending',
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: '注册失败，请重试' }, { status: 500 });
  }
}
