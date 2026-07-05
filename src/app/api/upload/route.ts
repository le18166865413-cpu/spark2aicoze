import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/utils/storage";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getStorageErrorMessage } from "@/utils/storage-error";

// Generate UUID
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Get permanent signed URL via sign-url endpoint
async function getSignedUrl(key: string): Promise<string> {
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

  const result = await response.json();
  if (result.code !== 0 || !result.data?.url) {
    throw new Error(`Sign URL error: ${result.msg || "unknown error"}`);
  }

  return result.data.url;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const prompt = (formData.get("prompt") as string) || "Uploaded Image";
    const widthStr = formData.get("width") as string | null;
    const heightStr = formData.get("height") as string | null;
    const forGrsai = formData.get("forGrsai") === "true";
    const uploadType = formData.get("type") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let key: string;
    try {
      key = await storage.uploadFile({
        fileContent: buffer,
        fileName: file.name,
        contentType: file.type,
      });
    } catch (uploadError) {
      console.error("S3 upload failed:", uploadError);
      return NextResponse.json({ error: getStorageErrorMessage(uploadError) }, { status: 500 });
    }

    // Get signed URL
    let signedUrl = "";
    try {
      signedUrl = await getSignedUrl(key);
    } catch {
      try {
        signedUrl = await storage.generatePresignedUrl({ key, expireTime: 86400 });
      } catch {
        // Fallback: no signed URL available
      }
    }

    // If this is for GrsAI or BrandKit, return the key and a signed URL only
    if (forGrsai || uploadType === "brandkit") {
      return NextResponse.json({
        key: key,
        imageKey: key,  // 兼容两种字段名
        url: signedUrl,
        type: file.type,
      });
    }

    // Regular upload - save to Supabase
    const imageId = generateId();
    const now = new Date().toISOString();

    const supabase = getSupabaseClient();
    const { error: dbError } = await supabase.from("gallery_images").insert({
      id: imageId,
      prompt: prompt,
      url: "",
      image_key: key,
      width: parseInt(widthStr || "0"),
      height: parseInt(heightStr || "0"),
      views: 0,
      downloads: 0,
      model: "uploaded",
      ratio: "",
      task_id: "",
      created_at: now,
    });

    if (dbError) {
      console.error("Supabase insert error:", dbError);
    }

    // Reuse signedUrl from earlier (already computed)

    return NextResponse.json({
      id: imageId,
      imageKey: key,
      prompt: prompt,
      url: signedUrl,
      width: parseInt(widthStr || "0"),
      height: parseInt(heightStr || "0"),
      views: 0,
      downloads: 0,
      model: "uploaded",
      ratio: "",
      taskId: "",
      createdAt: now,
    });
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
