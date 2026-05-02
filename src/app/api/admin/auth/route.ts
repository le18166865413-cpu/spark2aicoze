import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, createSession, SESSION_COOKIE, SESSION_DURATION_HOURS } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    if (!validateCredentials(username, password)) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const sessionId = await createSession();

    if (!sessionId) {
      return NextResponse.json({ error: '会话创建失败' }, { status: 500 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SESSION_DURATION_HOURS * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { destroySession, getAdminSession } = await import('@/lib/admin-auth');
    const sessionId = await getAdminSession();
    if (sessionId) {
      await destroySession(sessionId);
    }

    const { SESSION_COOKIE } = await import('@/lib/admin-auth');
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: '登出失败' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { isAdminAuthenticated } = await import('@/lib/admin-auth');
    const authenticated = await isAdminAuthenticated();
    return NextResponse.json({ authenticated });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
