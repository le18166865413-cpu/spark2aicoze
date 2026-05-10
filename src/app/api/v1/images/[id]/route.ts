import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { verifyApiToken } from "@/lib/admin-auth";

async function getSignedUrl(key: string): Promise<string> {
  try {
    const token = process.env.COZE_WORKLOAD_IDENTITY_API_KEY || "";
    const endpoint = process.env.COZE_BUCKET_ENDPOINT_URL || "";
    const bucketName = process.env.COZE_BUCKET_NAME || "";

    const signUrlEndpoint = endpoint.replace(/\/$/, "") + "/sign-url";

    const response = await fetch(signUrlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-storage-token": token,
      },
      body: JSON.stringify({
        bucket_name: bucketName,
        path: key,
        expire_time: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate signed URL: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 0 || !data.data?.url) {
      throw new Error(`Sign URL error: ${data.msg || "unknown error"}`);
    }

    return data.data.url;
  } catch (error) {
    console.error("Failed to get signed URL for key:", key, error);
    return key;
  }
}

/**
 * Open API: Get single image detail
 * Auth: Bearer Token (API Token)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiToken = await verifyApiToken(request);
  if (!apiToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    const { data: img, error } = await supabase
      .from("gallery_images")
      .select("*, users!gallery_images_user_id_fkey(nickname, username)")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !img) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const imageKey = img.image_key as string;
    let url = img.url as string;

    if (imageKey) {
      try {
        url = await getSignedUrl(imageKey);
      } catch {
        url = imageKey;
      }
    }

    const userInfo = img.users as Record<string, unknown> | null;
    const creatorName = (img.creator_name as string) || (userInfo?.nickname as string) || (userInfo?.username as string) || "系统导入";

    return NextResponse.json({
      data: {
        id: img.id,
        prompt: img.prompt,
        url: url,
        width: img.width,
        height: img.height,
        views: img.views || 0,
        downloads: img.downloads || 0,
        likes: img.likes || 0,
        referenceCount: img.reference_count || 0,
        model: img.model,
        ratio: img.ratio,
        creatorName: creatorName,
        createdAt: img.created_at,
        isPinned: img.is_pinned || false,
      },
    });
  } catch (error) {
    console.error("Open API image detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
