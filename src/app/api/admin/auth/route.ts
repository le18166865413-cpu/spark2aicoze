import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/admin-auth';

// GET - 检查当前管理员认证状态
export async function GET() {
  try {
    const user = await verifyUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role } });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
