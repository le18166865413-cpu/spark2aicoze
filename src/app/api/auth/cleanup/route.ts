import { NextResponse } from 'next/server';
import { cleanupExpiredSessions } from '@/lib/admin-auth';

// 清理过期 session（可被 cron 调用）
export async function POST() {
  try {
    await cleanupExpiredSessions();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    return NextResponse.json({ error: '清理失败' }, { status: 500 });
  }
}
