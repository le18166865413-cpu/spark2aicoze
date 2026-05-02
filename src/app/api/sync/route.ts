import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/utils/storage";
import { getSupabaseClient } from "@/storage/database/supabase-client";

const GRSAI_API_KEY = process.env.GRSAI_API_KEY || "sk-013abb01b9f44e1ca4f72b81e6d91f60";
const GRSAI_BASE_URL = process.env.GRSAI_BASE_URL || "https://grsai.dakka.com.cn";

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

// Generate UUID
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// POST: Sync a GrsAI task result to gallery
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    console.log("Syncing task", taskId, "from GrsAI...");

    // Query GrsAI for task result
    const response = await fetch(`${GRSAI_BASE_URL}/v1/draw/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GRSAI_API_KEY}`,
      },
      body: JSON.stringify({ task_id: taskId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GrsAI result error:", errorText);
      return NextResponse.json({ error: "Failed to query GrsAI" }, { status: 500 });
    }

    const result = await response.json();

    if (result.code !== 0) {
      return NextResponse.json(
        { error: result.msg || "Task not found", code: result.code },
        { status: 400 }
      );
    }

    // Check task status
    if (result.data?.status !== "succeeded") {
      return NextResponse.json({
        status: result.data?.status || "unknown",
        message: result.data?.failure_reason || "Task not completed",
      });
    }

    // Get image URL from result
    const imageUrl = result.data?.results?.[0]?.url || result.data?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: "No image in result" }, { status: 400 });
    }

    // Upload to S3
    const key = await storage.uploadFromUrl({
      url: imageUrl,
      timeout: 120000,
    });

    const prompt = (result.data?.prompt as string) || "GrsAI synced image";
    const imageId = generateId();
    const now = new Date().toISOString();

    // Save to Supabase
    const supabase = getSupabaseClient();
    const { error: dbError } = await supabase.from("gallery_images").insert({
      id: imageId,
      prompt: prompt,
      url: "",
      image_key: key,
      width: 1024,
      height: 1365,
      views: 0,
      downloads: 0,
      model: "synced",
      ratio: "3:4",
      task_id: taskId,
      created_at: now,
    });

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
    }

    // Get signed URL
    let signedUrl = "";
    try {
      signedUrl = await getSignedUrl(key);
    } catch {
      signedUrl = key;
    }

    return NextResponse.json({
      id: imageId,
      imageKey: key,
      prompt: prompt,
      url: signedUrl,
      taskId: taskId,
      createdAt: now,
    });
  } catch (error) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: List synced images from Supabase
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data: images, error } = await supabase
      .from("gallery_images")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json([]);
    }

    if (!images || images.length === 0) {
      return NextResponse.json([]);
    }

    // Generate signed URLs
    const imagesWithUrls = await Promise.all(
      images.map(async (img: Record<string, unknown>) => {
        const imageKey = img.image_key as string;
        let url = img.url as string;

        if (imageKey) {
          try {
            url = await getSignedUrl(imageKey);
          } catch {
            url = imageKey;
          }
        }

        return {
          id: img.id,
          imageKey: imageKey,
          prompt: img.prompt,
          url: url,
          width: img.width,
          height: img.height,
          views: img.views || 0,
          downloads: img.downloads || 0,
          model: img.model,
          ratio: img.ratio,
          taskId: img.task_id,
          createdAt: img.created_at,
        };
      })
    );

    return NextResponse.json(imagesWithUrls);
  } catch (error) {
    console.error("Sync GET error:", error);
    return NextResponse.json([]);
  }
}
