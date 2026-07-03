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
    const { data: user } = await sb
      .from('users')
      .select('id, username, nickname, role, status, email, phone, wechat, avatar, can_generate')
      .eq('id', userId)
      .single();

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
    if (phone !== undefined) updates.phone = phone.trim() || null;
    if (wechat !== undefined) updates.wechat = wechat.trim() || null;
    if (avatar !== undefined) updates.avatar = avatar.trim() || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    // Check if user exists in users table
    const { data: existingUser } = await sb
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingUser) {
      // New Supabase Auth user - get email/phone from auth
      const supabase = getSupabaseServer();
      const { data: { user: authUser } } = await supabase.auth.getUser(
        request.headers.get('x-session') || undefined
      );

      const email = authUser?.email ?? null;
      const phone = authUser?.phone ?? null;

      // Migrate: try to match existing user by email or phone
      let migratedRole = 'user';
      let migratedStatus = 'pending';
      let migratedUsername = email?.split('@')[0] || phone || userId.slice(0, 8);

      if (email) {
        const { data: oldUser } = await sb
          .from('users')
          .select('id, username, nickname, role, status')
          .eq('email', email)
          .single();
        if (oldUser && oldUser.id !== userId) {
          // Migrate old record to new id
          await sb.from('users').update({ id: userId, updated_at: new Date().toISOString() }).eq('id', oldUser.id);
          await sb.from('gallery_images').update({ user_id: userId }).eq('user_id', oldUser.id);
          migratedRole = oldUser.role;
          migratedStatus = oldUser.status;
          migratedUsername = oldUser.username;
        }
      }

      // Create user record (or re-insert if id was just migrated)
      const { data: checkAgain } = await sb.from('users').select('id').eq('id', userId).single();
      if (!checkAgain) {
        const { error: insertError } = await sb.from('users').insert({
          id: userId,
          username: migratedUsername || email || phone || userId.slice(0, 8),
          email,
          phone,
          nickname: updates.nickname ?? null,
          wechat: updates.wechat ?? null,
          avatar: updates.avatar ?? null,
          role: migratedRole,
          status: migratedStatus,
          can_generate: migratedStatus === 'approved',
        });

        if (insertError) {
          console.error('Profile create error:', insertError);
          return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
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
    const { data: user } = await sb
      .from('users')
      .select('id, username, nickname, role, status, email, phone, wechat, avatar, can_generate')
      .eq('id', userId)
      .single();

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
