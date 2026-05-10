import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyUser } from '@/lib/admin-auth';
import bcrypt from 'bcryptjs';

// GET: List all users
export async function GET() {
  try {
    const user = await verifyUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
    }

    const { data, error } = await getSupabaseClient()
      .from('users')
      .select('id, username, password, plain_password, nickname, role, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data });
  } catch {
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}

// POST: Create a new user (admin creates, auto-approved)
export async function POST(request: Request) {
  try {
    const user = await verifyUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
    }

    const body = await request.json();
    const { username, password, nickname, role } = body;

    if (!username || !password || !nickname) {
      return NextResponse.json({ error: '用户名、密码和昵称不能为空' }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: '用户名至少3个字符' }, { status: 400 });
    }

    // Detect bcrypt hash: starts with $2a$ / $2b$ / $2y$ and has 60 chars
    const isBcryptHash = /^\$2[aby]\$\d+\$/.test(password) && password.length >= 59;

    if (!isBcryptHash && password.length < 6) {
      return NextResponse.json({ error: '密码至少6个字符' }, { status: 400 });
    }

    const { data: existing } = await getSupabaseClient()
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
    }

    const finalPassword = isBcryptHash ? password : await bcrypt.hash(password, 10);

    const { data, error } = await getSupabaseClient()
      .from('users')
      .insert({
        username,
        password: finalPassword,
        plain_password: isBcryptHash ? undefined : password,
        nickname,
        role: role || 'user',
        status: 'approved',
      })
      .select('id, username, nickname, role, status, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch {
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
  }
}

// PUT: Update a user (approve/reject/edit/reset password)
export async function PUT(request: Request) {
  try {
    const user = await verifyUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
    }

    const body = await request.json();
    const { id, nickname, role, password, status } = body;

    if (!id) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    const updates: Record<string, string> = { updated_at: new Date().toISOString() };

    if (nickname) updates.nickname = nickname;
    if (role) updates.role = role;
    if (status && ['approved', 'rejected', 'pending'].includes(status)) {
      updates.status = status;
      // If rejected, delete all sessions to force logout
      if (status === 'rejected') {
        await getSupabaseClient().from('user_sessions').delete().eq('user_id', id);
      }
    }
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: '密码至少6个字符' }, { status: 400 });
      }
      updates.password = await bcrypt.hash(password, 10);
      updates.plain_password = password;
      // Delete sessions to force re-login with new password
      await getSupabaseClient().from('user_sessions').delete().eq('user_id', id);
    }

    const { data, error } = await getSupabaseClient()
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, username, nickname, role, status, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch {
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 });
  }
}

// DELETE: Delete a user
export async function DELETE(request: Request) {
  try {
    const user = await verifyUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    // Update user's gallery images to system import before deleting
    await getSupabaseClient()
      .from('gallery_images')
      .update({ user_id: null, creator_name: '系统导入' })
      .eq('user_id', id);

    // Delete user sessions first
    await getSupabaseClient().from('user_sessions').delete().eq('user_id', id);

    const { error } = await getSupabaseClient().from('users').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 });
  }
}
