import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { normalizePhoneForStorage } from '@/lib/phone-utils';

export const dynamic = 'force-dynamic';

function formatUser(dbUser: Record<string, unknown>) {
  return {
    id: dbUser.id as string,
    username: (dbUser.username as string) || null,
    email: (dbUser.email as string) || null,
    phone: (dbUser.phone as string) || null,
    nickname: (dbUser.nickname as string) || null,
    avatar: (dbUser.avatar as string) || null,
    wechat: (dbUser.wechat as string) || null,
    role: (dbUser.role as string) || 'user',
    status: (dbUser.status as string) || 'pending',
    canGenerate: dbUser.can_generate !== false,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-session');
    const cookieToken = request.cookies.get('user_session')?.value;

    const db = getSupabaseClient();

    // 1. 先尝试 Supabase JWT 认证（x-session header）
    let supabaseUserId: string | null = null;
    let supabaseEmail: string | null | undefined;
    let supabasePhone: string | null | undefined;
    let supabaseName: string | null | undefined;

    if (authHeader) {
      try {
        const supabaseUrl = process.env.COZE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseServiceKey) {
          const authClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data, error } = await authClient.auth.getUser(authHeader);
          if (!error && data.user) {
            supabaseUserId = data.user.id;
            supabaseEmail = data.user.email || undefined;
            const rawPhone = data.user.phone;
            if (rawPhone) {
              supabasePhone = normalizePhoneForStorage(rawPhone);
            }
            const meta = data.user.user_metadata || {};
            supabaseName =
              (meta as Record<string, unknown>).nickname as string | undefined ||
              (meta as Record<string, unknown>).full_name as string | undefined ||
              data.user.email?.split('@')[0] ||
              (supabasePhone ? '用户' + supabasePhone.slice(-4) : undefined);
          }
        }
      } catch {
        // token 不是有效的 Supabase JWT，继续走 cookie 认证
      }
    }

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
          updates.updated_at = new Date().toISOString();
          const { error: updateErr } = await db.from('users').update(updates).eq('id', supabaseUserId);
          if (updateErr) {
            console.error('[auth/me] update user error:', updateErr);
          } else {
            Object.assign(dbUser, updates);
          }
        }

        return NextResponse.json({ user: formatUser(dbUser) });
      }

      // 旧用户迁移：按邮箱匹配
      if (supabaseEmail) {
        const { data: oldUser } = await db
          .from('users')
          .select('*')
          .eq('email', supabaseEmail)
          .maybeSingle();

        if (oldUser && oldUser.id !== supabaseUserId) {
          // 迁移作品归属
          await db.from('gallery_images').update({ user_id: supabaseUserId }).eq('user_id', oldUser.id);
          // 删除旧记录，重新插入新记录
          await db.from('users').delete().eq('id', oldUser.id);
          const { data: migratedUser, error: insertErr } = await db
            .from('users')
            .insert({
              id: supabaseUserId,
              username: oldUser.username || supabaseEmail.split('@')[0],
              email: supabaseEmail,
              phone: oldUser.phone || supabasePhone || null,
              nickname: oldUser.nickname || supabaseName || null,
              avatar: oldUser.avatar || null,
              wechat: oldUser.wechat || null,
              password: oldUser.password || '',
              role: oldUser.role || 'user',
              status: oldUser.status || 'pending',
              can_generate: oldUser.can_generate ?? true,
              created_at: oldUser.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .maybeSingle();

          if (!insertErr && migratedUser) {
            return NextResponse.json({ user: formatUser(migratedUser) });
          }
        }
      }

      // 旧用户迁移：按手机号匹配
      if (supabasePhone && !supabaseEmail) {
        const { data: phoneUser } = await db
          .from('users')
          .select('*')
          .eq('phone', supabasePhone)
          .maybeSingle();

        if (phoneUser && phoneUser.id !== supabaseUserId) {
          await db.from('gallery_images').update({ user_id: supabaseUserId }).eq('user_id', phoneUser.id);
          await db.from('users').delete().eq('id', phoneUser.id);
          const { data: migratedUser, error: insertErr } = await db
            .from('users')
            .insert({
              id: supabaseUserId,
              username: phoneUser.username || 'm_' + supabasePhone.slice(-8),
              email: phoneUser.email || null,
              phone: supabasePhone,
              nickname: phoneUser.nickname || supabaseName || null,
              avatar: phoneUser.avatar || null,
              wechat: phoneUser.wechat || null,
              password: phoneUser.password || '',
              role: phoneUser.role || 'user',
              status: phoneUser.status || 'pending',
              can_generate: phoneUser.can_generate ?? true,
              created_at: phoneUser.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .maybeSingle();

          if (!insertErr && migratedUser) {
            return NextResponse.json({ user: formatUser(migratedUser) });
          }
        }
      }

      // 新用户：自动创建记录（status=pending，需管理员审批）
      const username = supabaseEmail
        ? supabaseEmail.split('@')[0]
        : (supabasePhone ? 'm_' + supabasePhone.slice(-8) : 'u_' + supabaseUserId.slice(0, 8));

      // 自动生成昵称：手机号后4位或邮箱前4位
      const autoNickname = supabasePhone 
        ? supabasePhone.slice(-4)
        : supabaseEmail 
          ? supabaseEmail.split('@')[0].slice(0, 4)
          : null;

      const { data: newUser, error: createErr } = await db
        .from('users')
        .insert({
          id: supabaseUserId,
          username,
          email: supabaseEmail || null,
          phone: supabasePhone || null,
          nickname: autoNickname,
          avatar: null,
          wechat: null,
          password: '',
          role: 'user',
          status: 'pending',
          can_generate: false, // 待审核用户不能生图
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (createErr || !newUser) {
        console.error('[auth/me] 创建用户失败:', createErr);
        return NextResponse.json({
          user: {
            id: supabaseUserId,
            username,
            email: supabaseEmail || null,
            phone: supabasePhone || null,
            nickname: autoNickname,
            avatar: null,
            wechat: null,
            role: 'user',
            status: 'pending',
            canGenerate: false,
          },
        });
      }

      return NextResponse.json({ user: formatUser(newUser) });
    }

    // 2. Cookie 认证（旧管理员登录）：先查 user_sessions 表
    let cookieUserId: string | null = null;
    if (cookieToken) {
      try {
        const { data: sessionRow } = await db
          .from('user_sessions')
          .select('user_id, expires_at')
          .eq('id', cookieToken)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (sessionRow) {
          cookieUserId = sessionRow.user_id;
          void db.from('user_sessions').update({ last_active_at: new Date().toISOString() }).eq('id', cookieToken);
        }
      } catch {
        // ignore
      }
    }

    if (!cookieUserId) {
      return NextResponse.json({ user: null });
    }

    const { data: cookieUser } = await db
      .from('users')
      .select('*')
      .eq('id', cookieUserId)
      .maybeSingle();

    if (!cookieUser) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user: formatUser(cookieUser) });
  } catch (error) {
    console.error('[auth/me] 错误:', error);
    return NextResponse.json({ user: null });
  }
}
