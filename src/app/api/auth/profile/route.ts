import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Create server-side Supabase client for token verification
function getSupabaseServer() {
  return createClient(
    process.env.COZE_SUPABASE_URL!,
    process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Verify user from x-session header or cookie, return userId
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  // Try x-session header first (Supabase Auth JWT)
  const sessionToken = request.headers.get('x-session');
  if (sessionToken) {
    try {
      const supabase = getSupabaseServer();
      const { data: { user } } = await supabase.auth.getUser(sessionToken);
      if (user) return user.id;
    } catch {
      // Token invalid, continue
    }
  }

  // Fallback: try cookie session (legacy)
  const cookie = request.cookies.get('user_session');
  if (cookie) {
    try {
      const sb = getSupabaseClient();
      const { data: session } = await sb
        .from('user_sessions')
        .select('user_id')
        .eq('id', cookie.value)
        .gt('expires_at', new Date().toISOString())
        .single();
      if (session) return session.user_id;
    } catch {
      // Cookie session invalid
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const sb = getSupabaseClient();
    const { data: user, error: getErr } = await sb
      .from('users')
      .select('id, username, nickname, role, status, email, phone, wechat, avatar, can_generate')
      .eq('id', userId)
      .maybeSingle();

    if (getErr) console.error('[profile GET] error:', getErr);

    return NextResponse.json({
      user: user ? {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        status: user.status,
        email: user.email,
        phone: user.phone,
        wechat: user.wechat,
        avatar: user.avatar,
        canGenerate: user.can_generate,
      } : null,
    });
  } catch (error) {
    console.error('Profile get error:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const sb = getSupabaseClient();

    const body = await request.json();
    const { nickname, phone, wechat, avatar } = body as {
      nickname?: string;
      phone?: string;
      wechat?: string;
      avatar?: string;
    };

    // Build update object - only include provided fields
    const updates: Record<string, string | null> = {};
    if (nickname !== undefined) updates.nickname = nickname.trim() || null;
    if (phone !== undefined) {
      // Normalize phone: strip +86/86 prefix, keep 11 digits
      const norm = phone.trim().replace(/^\+?86/, '').replace(/\D/g, '');
      updates.phone = norm || null;
    }
    if (wechat !== undefined) updates.wechat = wechat.trim() || null;
    if (avatar !== undefined) updates.avatar = avatar.trim() || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    // Check if user exists in users table
    const { data: existingUser, error: lookupError } = await sb
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (lookupError) {
      console.error('[profile] lookup error:', lookupError);
    }

    if (!existingUser) {
      // New Supabase Auth user - get email/phone from auth
      let email: string | null = null;
      let phone: string | null = null;

      const sessionToken = request.headers.get('x-session');
      if (sessionToken) {
        try {
          const supabase = getSupabaseServer();
          const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(sessionToken);
          if (authErr) {
            console.error('[profile] getUser error:', authErr);
          }
          if (authUser) {
            email = authUser.email ?? null;
            phone = authUser.phone ?? null;
          }
        } catch (e) {
          console.error('[profile] getUser exception:', e);
        }
      }

      // Migrate: try to match existing user by email or phone
      let migratedRole = 'user';
      let migratedStatus = 'pending';
      let migratedUsername = (email?.split('@')[0]) || phone || `user_${userId.slice(0, 8)}`;

      // Normalize phone: strip +86/86 prefix
      const normalizedPhone = phone ? phone.replace(/^\+?86/, '').replace(/\D/g, '') : null;

      if (email) {
        const { data: oldUser } = await sb
          .from('users')
          .select('id, username, nickname, role, status')
          .eq('email', email)
          .maybeSingle();
        if (oldUser && oldUser.id !== userId) {
          // Migrate old record to new id
          const { error: migrateErr } = await sb.from('users').update({ id: userId, updated_at: new Date().toISOString() }).eq('id', oldUser.id);
          if (migrateErr) console.error('[profile] migrate user error:', migrateErr);
          const { error: imgErr } = await sb.from('gallery_images').update({ user_id: userId }).eq('user_id', oldUser.id);
          if (imgErr) console.error('[profile] migrate images error:', imgErr);
          migratedRole = oldUser.role;
          migratedStatus = oldUser.status;
          migratedUsername = oldUser.username || migratedUsername;
        }
      }

      // Also try to match by normalized phone
      if (normalizedPhone && !migratedUsername.startsWith('user_')) {
        // already matched by email
      } else if (normalizedPhone) {
        const { data: phoneUser } = await sb
          .from('users')
          .select('id, username, nickname, role, status, email')
          .eq('phone', normalizedPhone)
          .maybeSingle();
        if (phoneUser && phoneUser.id !== userId) {
          const { error: migrateErr } = await sb.from('users').update({ id: userId, updated_at: new Date().toISOString() }).eq('id', phoneUser.id);
          if (migrateErr) console.error('[profile] phone migrate user error:', migrateErr);
          const { error: imgErr } = await sb.from('gallery_images').update({ user_id: userId }).eq('user_id', phoneUser.id);
          if (imgErr) console.error('[profile] phone migrate images error:', imgErr);
          migratedRole = phoneUser.role;
          migratedStatus = phoneUser.status;
          migratedUsername = phoneUser.username || migratedUsername;
        }
      }

      // Create user record (or re-insert if id was just migrated)
      const { data: checkAgain } = await sb.from('users').select('id').eq('id', userId).maybeSingle();
      if (!checkAgain) {
        const insertData: Record<string, unknown> = {
          id: userId,
          username: migratedUsername,
          password: '',
          role: migratedRole,
          status: migratedStatus,
          can_generate: migratedStatus === 'approved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (email) insertData.email = email;
        if (phone) insertData.phone = phone;
        if (updates.nickname !== undefined) insertData.nickname = updates.nickname;
        if (updates.wechat !== undefined) insertData.wechat = updates.wechat;
        if (updates.avatar !== undefined) insertData.avatar = updates.avatar;

        const { error: insertError } = await sb.from('users').insert(insertData);

        if (insertError) {
          console.error('[profile] create error:', JSON.stringify(insertError));
          return NextResponse.json({ error: '创建用户失败: ' + insertError.message }, { status: 500 });
        }
      }
    } else {
      // Update existing user
      const { error } = await sb
        .from('users')
        .update(updates)
        .eq('id', userId);

      if (error) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
      }
    }

    // Return updated user
    const { data: user, error: fetchErr } = await sb
      .from('users')
      .select('id, username, nickname, role, status, email, phone, wechat, avatar, can_generate')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[profile] fetch after update error:', fetchErr);
    }

    return NextResponse.json({
      user: user ? {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        status: user.status,
        email: user.email,
        phone: user.phone,
        wechat: user.wechat,
        avatar: user.avatar,
        canGenerate: user.can_generate,
      } : null,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}
