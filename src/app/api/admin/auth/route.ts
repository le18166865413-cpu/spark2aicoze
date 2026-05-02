import { NextRequest, NextResponse } from 'next/server';
import { createSession, isAdminAuthenticated, deleteSession } from '@/lib/admin-auth';

const ADMIN_USERNAME = 'wuhe';
const ADMIN_PASSWORD = '666666';

// GET - 检查认证状态
export async function GET(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('admin_session')?.value;
    const headerToken = request.headers.get('x-admin-session');
    const token = cookieToken || headerToken || null;

    const authenticated = await isAdminAuthenticated(token);
    return NextResponse.json({ authenticated });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authenticated: false });
  }
}

// POST - 登录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const sessionToken = await createSession(username);

    if (!sessionToken) {
      console.error('Failed to create session - token is null');
      return NextResponse.json({ error: '会话创建失败' }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      sessionToken,
    });

    // 设置 cookie（双重保障）
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    response.cookies.set('admin_session', sessionToken, {
      path: '/',
      expires,
      httpOnly: true,
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}

// DELETE - 登出
export async function DELETE(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('admin_session')?.value;
    const headerToken = request.headers.get('x-admin-session');
    const token = cookieToken || headerToken || null;

    if (token) {
      await deleteSession(token);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_session', '', { path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: true });
  }
}
