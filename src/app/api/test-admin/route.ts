import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    // Step 1: 直接读取 cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('user_session')?.value;
    const allCookies = cookieStore.getAll().map(c => c.name);
    
    console.log('[test-admin] token exists:', !!token);
    console.log('[test-admin] all cookies:', allCookies);
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'NO_COOKIE', 
        token: null,
        allCookies 
      });
    }

    // Step 2: 查询 session
    const { data: session } = await getSupabaseClient()
      .from('user_sessions')
      .select('user_id, expires_at')
      .eq('id', token)
      .single();

    if (!session) {
      return NextResponse.json({ 
        success: false, 
        error: 'NO_SESSION',
        token,
        allCookies 
      });
    }

    // Step 3: 查询 user
    const { data: user } = await getSupabaseClient()
      .from('users')
      .select('id, username, role')
      .eq('id', session.user_id)
      .single();

    return NextResponse.json({ 
      success: true, 
      token,
      session,
      user,
      isAdmin: user?.role === 'admin',
      allCookies
    });
  } catch (error) {
    console.error('[test-admin] error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
