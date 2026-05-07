import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function DELETE(request: Request) {
  try {
    const token = request.headers.get('cookie')?.split('user_session=')[1]?.split(';')[0];

    if (token) {
      await getSupabaseClient().from('user_sessions').delete().eq('id', token);
    }

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
