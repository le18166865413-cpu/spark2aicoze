import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/admin-auth';
import { testSmtpConnection } from '@/utils/email';

export async function GET() {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
  }

  const result = await testSmtpConnection();
  return NextResponse.json(result);
}
