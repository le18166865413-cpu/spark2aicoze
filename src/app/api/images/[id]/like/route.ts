import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // Get current liked status
    const { data: image, error: fetchError } = await supabase
      .from('gallery_images')
      .select('liked')
      .eq('id', id)
      .single();

    if (fetchError || !image) {
      return NextResponse.json({ error: '图片不存在' }, { status: 404 });
    }

    const newLiked = !image.liked;

    // Toggle liked status
    const { error: updateError } = await supabase
      .from('gallery_images')
      .update({ liked: newLiked })
      .eq('id', id);

    if (updateError) {
      console.error('[Like] Update error:', updateError);
      return NextResponse.json({ error: '操作失败' }, { status: 500 });
    }

    return NextResponse.json({ liked: newLiked });
  } catch (error) {
    console.error('[Like] Error:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
