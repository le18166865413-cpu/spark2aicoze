import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { cookies } from 'next/headers';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_session')?.value;
  if (!token) return null;

  const { data: session } = await getSupabaseClient()
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('id', token)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) return null;

  const { data: user } = await getSupabaseClient()
    .from('users')
    .select('id, username, nickname, role, status')
    .eq('id', session.user_id)
    .single();

  return user;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();

    // Check if already favorited
    const { data: existing } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('image_id', id)
      .single();

    if (existing) {
      // Unfavorite: remove from user_favorites and decrement likes
      const { error: deleteError } = await supabase
        .from('user_favorites')
        .delete()
        .eq('id', existing.id);

      if (deleteError) {
        console.error('[Like] Delete error:', deleteError);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
      }

      // Decrement likes
      const { data: current } = await supabase
        .from('gallery_images')
        .select('likes')
        .eq('id', id)
        .single();

      const newLikes = Math.max(0, (current?.likes || 1) - 1);
      await supabase
        .from('gallery_images')
        .update({ likes: newLikes })
        .eq('id', id);

      return NextResponse.json({ liked: false, likes: newLikes });
    } else {
      // Favorite: add to user_favorites and increment likes
      const { error: insertError } = await supabase
        .from('user_favorites')
        .insert({ user_id: user.id, image_id: id });

      if (insertError) {
        console.error('[Like] Insert error:', insertError);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
      }

      // Increment likes
      const { data: current } = await supabase
        .from('gallery_images')
        .select('likes')
        .eq('id', id)
        .single();

      const newLikes = (current?.likes || 0) + 1;
      await supabase
        .from('gallery_images')
        .update({ likes: newLikes })
        .eq('id', id);

      return NextResponse.json({ liked: true, likes: newLikes });
    }
  } catch (error) {
    console.error('[Like] Error:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
