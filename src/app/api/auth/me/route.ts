import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-session');
    const cookieToken = request.cookies.get('user_session')?.value;
    const token = authHeader || cookieToken;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    // 先尝试 Supabase JWT 认证
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let supabaseUserId: string | null = null;
    let supabaseEmail: string | undefined;
    let supabasePhone: string | undefined;
    let supabaseName: string | undefined;

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await authClient.auth.getUser(token);
        if (!error && data.user) {
          supabaseUserId = data.user.id;
          supabaseEmail = data.user.email || undefined;
          // 统一手机号格式：去掉 +86 / 86 前缀，存 11 位
          const rawPhone = data.user.phone;
          if (rawPhone) {
            supabasePhone = rawPhone.replace(/^\+?86/, '').replace(/\D/g, '');
          }
          const supabaseMeta = data.user.user_metadata || {};
          supabaseName =
            (supabaseMeta as Record<string, unknown>).nickname as string | undefined ||
            (supabaseMeta as Record<string, unknown>).full_name as string | undefined ||
            data.user.email?.split('@')[0] ||
            (supabasePhone ? '用户' + supabasePhone.slice(-4) : undefined);
        }
      } catch {
        // token 不是有效的 Supabase JWT，继续走 cookie 认证
      }
    }

    const db = getSupabaseClient();

    // Supabase Auth 用户
    if (supabaseUserId) {
      // 查询数据库中是否有对应用户记录
      const { data: dbUser } = await db
        .from('users')
        .select('*')
        .eq('id', supabaseUserId)
        .maybeSingle();

      if (dbUser) {
        // 更新邮箱和手机号（如果 Supabase 有且本地没有）
        const updates: Record<string, unknown> = {};
        if (supabaseEmail && !dbUser.email) updates.email = supabaseEmail;
        if (supabasePhone && !dbUser.phone) updates.phone = supabasePhone;
        if (supabaseName && !dbUser.nickname) updates.nickname = supabaseName;
        if (Object.keys(updates).length > 0) {
          const { error: updateErr } = await db.from('users').update(updates).eq('id', supabaseUserId);
          if (updateErr) {
            console.error('[auth/me] update user error:', updateErr);
          } else {
            // merge updates into dbUser for response
            Object.assign(dbUser, updates);
          }
        }

        console.log('[auth/me] returning dbUser:', { id: dbUser.id, nickname: dbUser.nickname, username: dbUser.username });
        return NextResponse.json({
          user: {
            id: dbUser.id,
            username: dbUser.username,
            email: dbUser.email || null,
            phone: dbUser.phone || null,
            nickname: dbUser.nickname || null,
            avatar: dbUser.avatar || null,
            bio: dbUser.bio || null,
            role: dbUser.role || 'user',
            status: dbUser.status || 'pending',
            can_generate: dbUser.can_generate ?? true,
            credits: dbUser.credits ?? 0,
          },
        });
      }

      // 旧用户迁移：按邮箱匹配，把旧账号 id 更新为 Supabase UUID
      if (supabaseEmail) {
        const { data: oldUser } = await db
          .from('users')
          .select('*')
          .eq('email', supabaseEmail)
          .maybeSingle();

        if (oldUser) {
          // 先把 gallery_images 中旧 ID 更新为新 UUID
          await db
            .from('gallery_images')
            .update({ user_id: supabaseUserId })
            .eq('user_id', oldUser.id);

          // 再更新 users 表 id
          await db.from('users').delete().eq('id', oldUser.id);
          const { data: migratedUser, error: insertErr } = await db
            .from('users')
            .insert({
              id: supabaseUserId,
              username: oldUser.username || supabaseEmail.split('@')[0],
              email: supabaseEmail,
              phone: oldUser.phone || supabasePhone || null,
              nickname: oldUser.nickname || supabaseName || '新用户',
              avatar: oldUser.avatar || null,
              bio: oldUser.bio || null,
              password: oldUser.password || '',
              role: oldUser.role || 'user',
              status: oldUser.status || 'pending',
              can_generate: oldUser.can_generate ?? true,
              credits: oldUser.credits ?? 50,
              created_at: oldUser.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!insertErr && migratedUser) {
            return NextResponse.json({
              user: {
                id: migratedUser.id,
                username: migratedUser.username,
                email: migratedUser.email,
                phone: migratedUser.phone,
                nickname: migratedUser.nickname,
                avatar: migratedUser.avatar,
                bio: migratedUser.bio,
                role: migratedUser.role,
                status: migratedUser.status,
                can_generate: migratedUser.can_generate,
                credits: migratedUser.credits,
              },
            });
          }
        }
      }

      // 新用户：自动创建记录（status=pending，需管理员审批）
      const username = supabaseEmail
        ? supabaseEmail.split('@')[0]
        : (supabasePhone ? 'm_' + supabasePhone.replace(/\D/g, '').slice(-8) : crypto.randomUUID().slice(0, 8));
      const { data: newUser, error: createErr } = await db
        .from('users')
        .insert({
          id: supabaseUserId,
          username,
          email: supabaseEmail || null,
          phone: supabasePhone || null,
          nickname: supabaseName || (supabasePhone ? '手机用户' : '新用户'),
          avatar: null,
          bio: null,
          password: '',
          role: 'user',
          status: 'pending',
          can_generate: true,
          credits: 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createErr) {
        console.error('[auth/me] 创建用户失败:', createErr);
        // 即使创建 DB 记录失败，也返回 Supabase 用户信息（避免登录循环）
        return NextResponse.json({
          user: {
            id: supabaseUserId,
            username,
            email: supabaseEmail || null,
            phone: supabasePhone || null,
            nickname: supabaseName || (supabasePhone ? '手机用户' : '新用户'),
            avatar: null,
            bio: null,
            role: 'user',
            status: 'pending',
            can_generate: true,
            credits: 50,
          },
        });
      }

      return NextResponse.json({
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          phone: newUser.phone,
          nickname: newUser.nickname,
          avatar: newUser.avatar,
          bio: newUser.bio,
          role: newUser.role,
          status: newUser.status,
          can_generate: newUser.can_generate,
          credits: newUser.credits,
        },
      });
    }

    // Cookie 认证（旧管理员登录）
    const { data: cookieUser } = await db
      .from('users')
      .select('*')
      .eq('id', token)
      .maybeSingle();

    if (!cookieUser) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: cookieUser.id,
        username: cookieUser.username,
        email: cookieUser.email,
        phone: cookieUser.phone,
        nickname: cookieUser.nickname,
        avatar: cookieUser.avatar,
        bio: cookieUser.bio,
        role: cookieUser.role,
        status: cookieUser.status,
        can_generate: cookieUser.can_generate,
        credits: cookieUser.credits,
      },
    });
  } catch (error) {
    console.error('[auth/me] 错误:', error);
    return NextResponse.json({ user: null });
  }
}
