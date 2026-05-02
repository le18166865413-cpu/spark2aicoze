import { NextRequest, NextResponse } from 'next/server';
import {
  validateCredentials,
  createSession,
  isAdminAuthenticated,
  destroySession,
  getAdminSession,
  SESSION_COOKIE,
  SESSION_DURATION_HOURS,
} from '@/lib/admin-auth';

// POST - Login
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }

    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    if (!validateCredentials(username, password)) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const sessionId = await createSession();
    if (!sessionId) {
      console.error('Session creation returned null');
      return NextResponse.json({ error: '会话创建失败，请重试' }, { status: 500 });
    }

    console.log('Login success, session created:', sessionId.substring(0, 8) + '...');

    const response = NextResponse.json({ success: true });

    // Set cookie - 不使用 Secure 标志，确保在所有环境下都能工作
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_HOURS * 60 * 60,
      secure: false,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// GET - Check auth status
export async function GET() {
  try {
    const authenticated = await isAdminAuthenticated();
    return NextResponse.json({ authenticated });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authenticated: false });
  }
}

// DELETE - Logout
export async function DELETE() {
  try {
    const sessionId = await getAdminSession();
    if (sessionId) {
      await destroySession(sessionId);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      secure: false,
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: '退出失败' }, { status: 500 });
  }
}
