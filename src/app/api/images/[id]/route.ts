import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { storage } from "@/utils/storage";
import { verifyUserFromRequest } from "@/lib/admin-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { isHidden } = await request.json();

    const user = await verifyUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const supabase = getSupabaseClient();

    // Check ownership
    const { data: image } = await supabase
      .from("gallery_images")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!image) {
      return NextResponse.json({ error: "作品不存在" }, { status: 404 });
    }

    // Only owner or admin can hide/unhide
    if (image.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const { error } = await supabase
      .from("gallery_images")
      .update({ is_hidden: isHidden })
      .eq("id", id);

    if (error) {
      console.error("Supabase hide error:", error);
      return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
    }

    return NextResponse.json({ success: true, isHidden });
  } catch (error) {
    console.error("Hide error:", error);
    return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await verifyUserFromRequest(_request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const supabase = getSupabaseClient();

    // Check ownership or admin
    const { data: image, error: fetchError } = await supabase
      .from("gallery_images")
      .select("image_key, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Only owner or admin can delete
    if (image.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    // Soft delete - set deleted_at timestamp
    const { error: updateError } = await supabase
      .from("gallery_images")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("Supabase soft delete error:", updateError);
      return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
