import { NextRequest, NextResponse } from 'next/server';
import { createSession, verifyAdminSession, deleteSession } from '@/lib/admin-auth';

const ADMIN_USERNAME = 'wuhe';
const ADMIN_PASSWORD = '666666';

// GET - 检查认证状态 (通过 query param token)
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const authenticated = await verifyAdminSession(token);
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

    const token = await createSession(username);

    if (!token) {
      console.error('Failed to create session - token is null');
      return NextResponse.json({ error: '会话创建失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}

// DELETE - 登出 (通过 query param token)
export async function DELETE(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (token) {
      await deleteSession(token);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: true });
  }
}
