import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // Get current reference_count
    const { data: current } = await supabase
      .from('gallery_images')
      .select('reference_count')
      .eq('id', id)
      .single();

    if (!current) {
      return NextResponse.json({ error: '作品不存在' }, { status: 404 });
    }

    const newCount = (current.reference_count || 0) + 1;

    const { error } = await supabase
      .from('gallery_images')
      .update({ reference_count: newCount })
      .eq('id', id);

    if (error) {
      console.error('[Reference] Update error:', error);
      return NextResponse.json({ error: '操作失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, referenceCount: newCount });
  } catch (error) {
    console.error('[Reference] Error:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
