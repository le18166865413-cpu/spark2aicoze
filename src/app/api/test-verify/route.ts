import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyAdmin } from '@/lib/admin-auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const result: Record<string, any> = {};
  
  // Test 1: Direct code
  try {
    const cookieStore = await cookies();
    const token1 = cookieStore.get('user_session')?.value;
    result.direct_token = token1 ? 'exists' : 'null';
    
    if (token1) {
      const supabase = getSupabaseClient();
      const { data: session } = await supabase
        .from('user_sessions')
        .select('user_id, expires_at')
        .eq('id', token1)
        .single();
      result.direct_session = session ? 'found' : 'null';
      
      if (session) {
        const { data: user } = await supabase
          .from('users')
          .select('id, username, role')
          .eq('id', session.user_id)
          .single();
        result.direct_user = user;
      }
    }
  } catch (e: any) {
    result.direct_error = e.message;
  }
  
  // Test 2: Imported verifyAdmin
  try {
    const imported = await verifyAdmin();
    result.imported_verifyAdmin = imported ? 'found_admin' : 'null';
    result.imported_user = imported;
  } catch (e: any) {
    result.imported_error = e.message;
  }
  
  return NextResponse.json(result);
}
