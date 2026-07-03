import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Supabase Auth server client (for JWT verification only, uses service role key)
function getSupabaseAuth() {
  return createClient(
    process.env.COZE_SUPABASE_URL!,
    process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Verify user from x-session header or cookie
export async function verifyUserFromRequest(request: NextRequest): Promise<{
  id: string;
  email: string | null;
  phone?: string | null;
  role: string;
  username?: string;
  nickname?: string;
  avatar?: string;
  wechat?: string;
  status?: string;
  canGenerate?: boolean;
} | null> {
  const db = getSupabaseClient();

  // Try x-session header first (Supabase Auth JWT)
  const sessionToken = request.headers.get('x-session');
  if (sessionToken) {
    try {
      const authClient = getSupabaseAuth();
      const { data: { user }, error: authErr } = await authClient.auth.getUser(sessionToken);
      if (authErr) {
        console.error('[auth/me] JWT verify error:', authErr.message);
      }
      if (user) {
        // Look up user profile in users table via DB client
        const { data: profile, error: profileErr } = await db
          .from('users')
          .select('id, username, nickname, role, status, avatar, wechat')
          .eq('id', user.id)
          .maybeSingle();

        if (profileErr) {
          console.error('[auth/me] profile lookup error:', profileErr);
        }

        if (profile) {
          return {
            id: user.id,
            email: user.email ?? null,
            phone: user.phone ?? null,
            role: profile.role,
            username: profile.username,
            nickname: profile.nickname,
            avatar: profile.avatar,
            wechat: profile.wechat,
            status: profile.status,
            canGenerate: profile.status === 'approved',
          };
        }

        const email = user.email ?? '';
        const phone = user.phone ?? '';

        // Migrate: try to match existing user by email or phone
        let matchField: 'email' | 'phone' | null = null;
        let matchValue = '';
        if (email) { matchField = 'email'; matchValue = email; }
        else if (phone) { matchField = 'phone'; matchValue = phone; }

        if (matchField && matchValue) {
          const { data: existingUser, error: matchErr } = await db
            .from('users')
            .select('id, username, nickname, role, status')
            .eq(matchField, matchValue)
            .maybeSingle();

          if (matchErr) console.error('[auth/me] match lookup error:', matchErr);

          if (existingUser && existingUser.id !== user.id) {
            const { error: migrateUserErr } = await db
              .from('users')
              .update({ id: user.id, updated_at: new Date().toISOString() })
              .eq('id', existingUser.id);
            if (migrateUserErr) console.error('[auth/me] migrate user error:', migrateUserErr);

            const { error: migrateImgErr } = await db
              .from('gallery_images')
              .update({ user_id: user.id })
              .eq('user_id', existingUser.id);
            if (migrateImgErr) console.error('[auth/me] migrate images error:', migrateImgErr);

            return {
              id: user.id,
              email: user.email ?? null,
              phone: user.phone ?? null,
              role: existingUser.role,
              username: existingUser.username,
              nickname: existingUser.nickname,
              status: existingUser.status,
              canGenerate: existingUser.status === 'approved',
            };
          }
        }

        // No existing user found — auto-create new record
        const username = email.split('@')[0] || phone || `user_${user.id.slice(0, 8)}`;
        const newUser: Record<string, unknown> = {
          id: user.id,
          username,
          password: '',
          nickname: username || '新用户',
          role: 'user',
          status: 'pending',
          can_generate: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (email) newUser.email = email;
        if (phone) newUser.phone = phone;

        const { error: insertErr } = await db.from('users').insert(newUser);
        if (insertErr) {
          console.error('[auth/me] create user error:', JSON.stringify(insertErr));
        }

        return {
          id: user.id,
          email: user.email ?? null,
          phone: user.phone ?? null,
          role: 'user',
          username,
          nickname: username || '新用户',
          status: 'pending',
          canGenerate: false,
        };
      }
    } catch (e) {
      console.error('[auth/me] JWT path exception:', e);
    }
  }

  // Fallback: try cookie session (legacy admin login)
  const cookie = request.cookies.get('user_session');
  if (cookie) {
    try {
      const db = getSupabaseClient();
      const { data: sessionData, error: sessErr } = await db
        .from('user_sessions')
        .select('user_id, expires_at')
        .eq('id', cookie.value)
        .maybeSingle();

      if (sessErr) console.error('[auth/me] cookie session lookup error:', sessErr);

      if (sessionData && new Date(sessionData.expires_at) > new Date()) {
        const { data: profile, error: profileErr } = await db
          .from('users')
          .select('id, username, nickname, email, phone, role, status, avatar, wechat')
          .eq('id', sessionData.user_id)
          .maybeSingle();

        if (profileErr) console.error('[auth/me] cookie profile lookup error:', profileErr);

        if (profile) {
          return {
            id: profile.id,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            username: profile.username,
            nickname: profile.nickname,
            avatar: profile.avatar,
            wechat: profile.wechat,
            status: profile.status,
            canGenerate: profile.status === 'approved',
          };
        }
      }
    } catch (e) {
      console.error('[auth/me] cookie path exception:', e);
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
