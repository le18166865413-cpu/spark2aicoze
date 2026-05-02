import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { storage } from "@/utils/storage";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = getSupabaseClient();

    // First get the image to find its S3 key
    const { data: image, error: fetchError } = await supabase
      .from("gallery_images")
      .select("image_key")
      .eq("id", id)
      .single();

    if (fetchError || !image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from("gallery_images")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
      return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
    }

    // Try to delete from S3 (non-blocking)
    const imageKey = image.image_key as string;
    if (imageKey) {
      try {
        await storage.deleteFile({ fileKey: imageKey });
      } catch (s3Error) {
        console.error("Failed to delete from S3 (non-critical):", s3Error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
