import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { S3Storage } from "coze-coding-dev-sdk";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();

    // First get the image to find the S3 key
    const { data: image, error: fetchError } = await client
      .from("gallery_images")
      .select("id, image_key")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Fetch failed: ${fetchError.message}`);
    }

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Delete from S3 if we have a key
    if (image.image_key) {
      try {
        const storage = new S3Storage({
          endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
          accessKey: "",
          secretKey: "",
          bucketName: process.env.COZE_BUCKET_NAME,
          region: "cn-beijing",
        });
        await storage.deleteFile({ fileKey: image.image_key as string });
      } catch (s3Error) {
        console.error("S3 delete error:", s3Error);
        // Continue with DB deletion even if S3 delete fails
      }
    }

    // Delete from database
    const { error: deleteError } = await client
      .from("gallery_images")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw new Error(`Delete failed: ${deleteError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Delete failed";
    console.error("DELETE /api/images/[id] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
