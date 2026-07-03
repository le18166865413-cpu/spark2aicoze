import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create server-side Supabase client for token verification
function getSupabaseServer() {
  return createClient(
    process.env.COZE_SUPABASE_URL!,
    process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Verify user from x-session header or cookie
export async function verifyUserFromRequest(request: NextRequest): Promise<{
  id: string;
  email: string | null;
  role: string;
  username?: string;
  nickname?: string;
  status?: string;
  canGenerate?: boolean;
} | null> {
  // Try x-session header first (Supabase Auth JWT)
  const sessionToken = request.headers.get('x-session');
  if (sessionToken) {
    try {
      const supabase = getSupabaseServer();
      const { data: { user } } = await supabase.auth.getUser(sessionToken);
      if (user) {
        // Look up user profile in users table
        const { data: profile } = await supabase
          .from('users')
          .select('id, username, nickname, role, status')
          .eq('id', user.id)
          .single();

        if (profile) {
          return {
            id: user.id,
            email: user.email ?? null,
            role: profile.role,
            username: profile.username,
            nickname: profile.nickname,
            status: profile.status,
            canGenerate: profile.status === 'approved',
          };
        }

        const email = user.email ?? '';
        const phone = user.phone ?? '';

        // Migrate: try to match existing user by email or phone
        let matchField = '';
        let matchValue = '';
        if (email) {
          matchField = 'email';
          matchValue = email;
        } else if (phone) {
          matchField = 'phone';
          matchValue = phone;
        }

        if (matchField && matchValue) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, username, nickname, role, status')
            .eq(matchField, matchValue)
            .single();

          if (existingUser && existingUser.id !== user.id) {
            // Found old record with different id — migrate it
            await supabase
              .from('users')
              .update({ id: user.id, updated_at: new Date().toISOString() })
              .eq('id', existingUser.id);

            // Update foreign keys in gallery_images
            await supabase
              .from('gallery_images')
              .update({ user_id: user.id })
              .eq('user_id', existingUser.id);

            return {
              id: user.id,
              email: user.email ?? null,
              role: existingUser.role,
              username: existingUser.username,
              nickname: existingUser.nickname,
              status: existingUser.status,
              canGenerate: existingUser.status === 'approved',
            };
          }
        }

        // No existing user found — auto-create new record
        const newUser = {
          id: user.id,
          email,
          phone,
          username: email.split('@')[0] || phone || `user_${user.id.slice(0, 8)}`,
          nickname: email.split('@')[0] || '新用户',
          role: 'user',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase.from('users').insert(newUser);

        return {
          id: user.id,
          email: user.email ?? null,
          role: 'user',
          username: newUser.username,
          nickname: newUser.nickname,
          status: 'pending',
          canGenerate: false,
        };
      }
    } catch {
      // Token invalid, continue
    }
  }

  // Fallback: try cookie session (legacy admin login)
  const cookie = request.cookies.get('user_session');
  if (cookie) {
    try {
      const supabase = getSupabaseServer();
      const { data: sessionData } = await supabase
        .from('user_sessions')
        .select('user_id, expires_at')
        .eq('id', cookie.value)
        .single();

      if (sessionData && new Date(sessionData.expires_at) > new Date()) {
        const { data: profile } = await supabase
          .from('users')
          .select('id, username, nickname, email, role, status')
          .eq('id', sessionData.user_id)
          .single();

        if (profile) {
          return {
            id: profile.id,
            email: profile.email,
            role: profile.role,
            username: profile.username,
            nickname: profile.nickname,
            status: profile.status,
            canGenerate: profile.status === 'approved',
          };
        }
      }
    } catch {
      // Cookie session invalid
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const user = await verifyUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user });
}
