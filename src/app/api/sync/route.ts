import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/utils/storage";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getStorageErrorMessage } from "@/utils/storage-error";
import { getSiteFilter, buildSiteInsertData } from "@/lib/multi-site";

async function getGrsaiApiKey(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("admin_settings").select("value").eq("key", "grsai_api_key").single();
    if (data?.value) return data.value;
  } catch { /* fallback */ }
  return process.env.GRSAI_API_KEY || "";
}
async function getGrsaiBaseUrl(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("admin_settings").select("value").eq("key", "grsai_base_url").single();
    if (data?.value) return data.value;
  } catch { /* fallback */ }
  return process.env.GRSAI_BASE_URL || "https://grsai.dakka.com.cn";
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

// Add task to auto-sync monitoring queue
async function addToAutoSyncQueue(
  taskId: string,
  model: string,
  prompt: string,
  ratio: string
): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from("auto_sync_tasks").upsert(
    {
      task_id: taskId,
      status: "pending",
      model,
      prompt,
      ratio,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "task_id" }
  );
}

// Query task result from GrsAI (new unified endpoint)
async function queryTaskResult(taskId: string) {
  const baseUrl = await getGrsaiBaseUrl();
  const apiKey = await getGrsaiApiKey();
  const response = await fetch(`${baseUrl}/v1/api/result?id=${taskId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`GrsAI API error: ${response.status}`);
  }

  return response.json();
}

// Extract image URL from result (compatible with old and new formats)
function extractImageUrl(data: Record<string, unknown>): string | null {
  // New format: data.results[0].url
  const results = data.results as Array<Record<string, unknown>> | undefined;
  if (results && results.length > 0 && results[0]?.url) {
    return results[0].url as string;
  }
  // Old format: data.url
  if (data.url) {
    return data.url as string;
  }
  // Alternative: data.image
  if (data.image) {
    return data.image as string;
  }
  return null;
}

function extractTaskStatus(data: Record<string, unknown>): string {
  return (data.status as string) || "unknown";
}

function extractFailureReason(data: Record<string, unknown>): string | undefined {
  return data.failure_reason as string | undefined;
}

function extractPrompt(data: Record<string, unknown>): string {
  return (data.prompt as string) || "GrsAI synced image";
}

// POST: Sync a GrsAI task to gallery
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const taskId = body.taskId as string;
    const model = (body.model as string) || "image2";
    const ratio = (body.ratio as string) || "3:4";

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Query task result from GrsAI
    const result = await queryTaskResult(taskId);

    // Handle API error
    if (result.code !== 0) {
      return NextResponse.json(
        { error: result.msg || "Task not found", code: result.code },
        { status: 400 }
      );
    }

    const data = result.data as Record<string, unknown>;
    const status = extractTaskStatus(data);
    const prompt = extractPrompt(data);

    // If task is not completed, add to auto-sync queue
    if (status !== "succeeded") {
      await addToAutoSyncQueue(taskId, model, prompt, ratio);
      return NextResponse.json({
        status,
        message: result.msg || "Task not completed, added to auto-sync queue",
        queued: true,
        taskId,
      });
    }

    // Get image URL from result
    const imageUrl = extractImageUrl(data);
    if (!imageUrl) {
      return NextResponse.json({ error: "No image in result" }, { status: 400 });
    }

    // Upload to S3
    let key: string;
    try {
      key = await storage.uploadFromUrl({
        url: imageUrl,
        timeout: 120000,
      });
    } catch (uploadError) {
      console.error("S3 upload failed:", uploadError);
      return NextResponse.json({ error: getStorageErrorMessage(uploadError) }, { status: 500 });
    }

    const imageId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Get signed URL
    let signedUrl = "";
    try {
      signedUrl = await getSignedUrl(key);
    } catch {
      signedUrl = key;
    }

    // Save to Supabase
    const supabase = getSupabaseClient();
    const insertData = buildSiteInsertData({
      id: imageId,
      prompt: prompt,
      url: signedUrl,
      image_key: key,
      width: 1024,
      height: 1365,
      views: 0,
      downloads: 0,
      model: model || "synced",
      ratio: ratio || "3:4",
      task_id: taskId,
      created_at: now,
    });
    const { error: dbError } = await supabase.from("gallery_images").insert(insertData);

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
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
    let query = supabase
      .from("gallery_images")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    const siteFilter = getSiteFilter();
    if (siteFilter) {
      query = query.eq("site_id", siteFilter);
    }

    const { data: images, error } = await query;

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
          prompt: img.prompt,
          url: url || imageKey,
          image_key: imageKey,
          created_at: img.created_at,
          width: img.width,
          height: img.height,
          views: img.views,
          downloads: img.downloads,
          model: img.model,
          ratio: img.ratio,
          task_id: img.task_id,
        };
      })
    );

    return NextResponse.json(imagesWithUrls);
  } catch (error) {
    console.error("Get synced images error:", error);
    return NextResponse.json([]);
  }
}
