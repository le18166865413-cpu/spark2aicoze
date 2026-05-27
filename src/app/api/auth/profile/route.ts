import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get('user_session');
    if (!cookie?.value) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const sb = getSupabaseClient();

    // Verify session
    const { data: session } = await sb
      .from('user_sessions')
      .select('user_id')
      .eq('id', cookie.value)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!session) {
      return NextResponse.json({ error: '会话已过期' }, { status: 401 });
    }

    const { data: user } = await sb
      .from('users')
      .select('id, username, nickname, role, status, email, phone, wechat, avatar, can_generate')
      .eq('id', session.user_id)
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
    const cookie = request.cookies.get('user_session');
    if (!cookie?.value) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const sb = getSupabaseClient();

    // Verify session
    const { data: session } = await sb
      .from('user_sessions')
      .select('user_id')
      .eq('id', cookie.value)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!session) {
      return NextResponse.json({ error: '会话已过期' }, { status: 401 });
    }

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

    const { error } = await sb
      .from('users')
      .update(updates)
      .eq('id', session.user_id);

    if (error) {
      console.error('Profile update error:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    // Return updated user
    const { data: user } = await sb
      .from('users')
      .select('id, username, nickname, role, status, email, phone, wechat, avatar, can_generate')
      .eq('id', session.user_id)
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
