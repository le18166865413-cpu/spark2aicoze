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

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_HOURS * 60 * 60,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}

export async function DELETE() {
  const { destroySession, getAdminSession } = await import('@/lib/admin-auth');
  const sessionId = await getAdminSession();
  if (sessionId) {
    await destroySession(sessionId);
  }

  const { SESSION_COOKIE, SESSION_DURATION_HOURS } = await import('@/lib/admin-auth');
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}

export async function GET() {
  const { isAdminAuthenticated } = await import('@/lib/admin-auth');
  const authenticated = await isAdminAuthenticated();
  return NextResponse.json({ authenticated });
}
