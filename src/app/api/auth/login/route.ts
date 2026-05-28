import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ensureAdminFromEnv } from '@/lib/admin-auth';

export async function POST(request: Request) {
  // 确保环境变量中的管理员账号存在
  await ensureAdminFromEnv();

  try {
    const body = await request.json();
    const { username, password, email, code } = body;

    const sb = getSupabaseClient();

    // ===== 邮箱验证码登录 =====
    if (email && code) {
      if (!email || !code) {
        return NextResponse.json({ error: '请输入邮箱和验证码' }, { status: 400 });
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
      }

      // 查找5分钟内所有未使用的验证码（允许多个验证码同时有效）
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: codeRecords, error: codeError } = await sb
        .from('email_verification_codes')
        .select('id, code, used, attempts, expires_at, created_at')
        .eq('email', email)
        .eq('used', false)
        .gte('created_at', fiveMinAgo)
        .order('created_at', { ascending: false });

      if (codeError || !codeRecords || codeRecords.length === 0) {
        return NextResponse.json({ error: '验证码已失效，请重新获取' }, { status: 401 });
      }

      // 找到匹配且未过期的验证码
      const matchedRecord = codeRecords.find(r => {
        return new Date(r.expires_at) >= new Date() && r.code === code && r.attempts < 5;
      });

      if (!matchedRecord) {
        // 检查是否有过期的或尝试次数过多的
        const hasExpired = codeRecords.some(r => new Date(r.expires_at) < new Date());
        const hasMaxAttempts = codeRecords.some(r => r.attempts >= 5);
        
        if (hasExpired) {
          return NextResponse.json({ error: '验证码已过期，请重新获取' }, { status: 401 });
        }
        if (hasMaxAttempts) {
          // 标记尝试次数过多的验证码为已使用
          const exhausted = codeRecords.filter(r => r.attempts >= 5);
          for (const r of exhausted) {
            await sb.from('email_verification_codes').update({ used: true }).eq('id', r.id);
          }
          return NextResponse.json({ error: '验证码错误次数过多，请重新获取' }, { status: 401 });
        }

        // 验证码不匹配，增加所有未过期验证码的尝试次数
        for (const r of codeRecords) {
          if (new Date(r.expires_at) >= new Date() && r.attempts < 5) {
            await sb
              .from('email_verification_codes')
              .update({ attempts: r.attempts + 1 })
              .eq('id', r.id);
          }
        }
        return NextResponse.json({ error: '验证码错误' }, { status: 401 });
      }

      // 查找用户（通过 email）
      let { data: user } = await sb
        .from('users')
        .select('id, username, nickname, role, status, email, wechat, avatar, can_generate')
        .eq('email', email)
        .single();

      // 如果用户不存在，自动注册
      if (!user) {
        const autoUsername = 'user_' + crypto.randomUUID().substring(0, 8);

        const { data: newUser, error: createError } = await sb
          .from('users')
          .insert({
            username: autoUsername,
            email,
            nickname: null,
            role: 'user',
            status: 'pending',
          })
          .select('id, username, nickname, role, status, email, wechat, avatar, can_generate')
          .single();

        if (createError || !newUser) {
          console.error('[Login] Auto-register error:', createError);
          return NextResponse.json({ error: '登录失败，请重试' }, { status: 500 });
        }

        user = newUser;
      }

      if (user.status === 'rejected') {
        return NextResponse.json({ error: '账号已被拒绝，请联系管理员' }, { status: 403 });
      }

      // pending 用户允许登录但功能受限（不能生图），前端根据 status 判断

      // 限制同账号最多 2 个活跃 session，超出踢最旧的
      const MAX_SESSIONS = 2;
      const { data: activeSessions } = await sb
        .from('user_sessions')
        .select('id, created_at')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (activeSessions && activeSessions.length >= MAX_SESSIONS) {
        // 踢掉最旧的 sessions，只保留 (MAX_SESSIONS - 1) 个
        const toDelete = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
        if (toDelete.length > 0) {
          await sb
            .from('user_sessions')
            .delete()
            .in('id', toDelete.map(s => s.id));
          console.log(`[Login] Kicked ${toDelete.length} oldest session(s) for user=${user.username}`);
        }
      }

      // 创建 session
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const { error: sessionError } = await sb
        .from('user_sessions')
        .insert({
          id: token,
          user_id: user.id,
          expires_at: expiresAt.toISOString(),
          last_active_at: new Date().toISOString(),
        });

      if (sessionError) {
        console.error('[Login] Create session error:', sessionError);
        return NextResponse.json({ error: '登录失败，请重试' }, { status: 500 });
      }

      // 登录全部成功后，才标记验证码为已使用
      for (const r of codeRecords) {
        if (r.id === matchedRecord.id || (new Date(r.expires_at) >= new Date() && r.code === matchedRecord.code)) {
          await sb.from('email_verification_codes').update({ used: true }).eq('id', r.id);
        }
      }

      const response = NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          role: user.role,
          status: user.status,
          email: user.email,
          wechat: user.wechat,
          avatar: user.avatar,
          canGenerate: user.can_generate,
        },
      });

      response.cookies.set('user_session', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      console.log(`[Login] Email login: ${email} user=${user.username} role=${user.role}`);
      return response;
    }

    // ===== 用户名密码登录（保留兼容） =====
    if (!username || !password) {
      return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
    }

    // Find user
    const { data: user, error } = await sb
      .from('users')
      .select('id, username, password, nickname, role, status, email, wechat, avatar, can_generate')
      .eq('username', username)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });
    }

    // Verify password
    if (!user.password) {
      return NextResponse.json({ error: '该账号未设置密码，请使用邮箱验证码登录' }, { status: 401 });
    }
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

    // 限制同账号最多 2 个活跃 session，超出踢最旧的
    const MAX_SESSIONS = 2;
    const { data: activeSessions } = await sb
      .from('user_sessions')
      .select('id, created_at')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (activeSessions && activeSessions.length >= MAX_SESSIONS) {
      const toDelete = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
      if (toDelete.length > 0) {
        await sb
          .from('user_sessions')
          .delete()
          .in('id', toDelete.map(s => s.id));
        console.log(`[Login] Kicked ${toDelete.length} oldest session(s) for user=${user.username}`);
      }
    }

    // Create session token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { error: sessionError } = await sb
      .from('user_sessions')
      .insert({
        id: token,
        user_id: user.id,
        expires_at: expiresAt.toISOString(),
        last_active_at: new Date().toISOString(),
      });

    if (sessionError) {
      console.error('[Login] Create session error:', sessionError);
      return NextResponse.json({ error: '登录失败，请重试' }, { status: 500 });
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        status: user.status,
        email: user.email,
        wechat: user.wechat,
        avatar: user.avatar,
        canGenerate: user.can_generate,
      },
    });

    response.cookies.set('user_session', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    console.log(`[Login] Password login: user=${user.username} role=${user.role}`);
    return response;
  } catch (error) {
    console.error('[Login] Error:', error);
    return NextResponse.json({ error: '登录失败，请重试' }, { status: 500 });
  }
}
