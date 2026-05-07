import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

// GET - 检查当前管理员认证状态
export async function GET() {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true, user: admin });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
