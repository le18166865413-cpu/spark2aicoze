import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('user_session')?.value;

    if (token) {
      await getSupabaseClient().from('user_sessions').delete().eq('id', token);
    }

    // Clear cookie via both APIs for reliability
    cookieStore.set('user_session', '', {
      httpOnly: true,
      secure: process.env.COZE_PROJECT_ENV === 'PROD',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set('user_session', '', {
      httpOnly: true,
      secure: process.env.COZE_PROJECT_ENV === 'PROD',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: '登出失败' }, { status: 500 });
  }
}
