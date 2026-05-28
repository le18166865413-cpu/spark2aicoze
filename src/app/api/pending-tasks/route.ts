import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { storage } from "@/utils/storage";
import { buildSiteInsertData } from "@/lib/multi-site";

interface PendingTask {
  taskId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  prompt?: string;
  model?: string;
  ratio?: string;
  imageUrl?: string;
  imageId?: string;
  width?: number;
  height?: number;
  message?: string;
}

async function getSetting(key: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", key)
      .single();
    return data?.value || null;
  } catch {
    return null;
  }
}

async function getGrsaiApiKey(): Promise<string> {
  return (await getSetting("grsai_api_key")) || process.env.GRSAI_API_KEY || "";
}

async function getGrsaiBaseUrl(): Promise<string> {
  return (await getSetting("grsai_base_url")) || "https://grsai.dakka.com.cn";
}

// Get permanent signed URL via sign-url endpoint
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

    const result = await response.json();
    if (result.code !== 0 || !result.data?.url) {
      throw new Error(`Sign URL error: ${result.msg || "unknown error"}`);
    }

    return result.data.url;
  } catch (error) {
    console.error("[PendingTasks] Failed to get signed URL:", error);
    return key;
  }
}

// Estimate dimensions from ratio string
function estimateDimensions(ratio: string): { width: number; height: number } {
  const dimMap: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 },
    "4:3": { width: 1024, height: 768 },
    "3:4": { width: 768, height: 1024 },
    "3:2": { width: 1536, height: 1024 },
    "2:3": { width: 1024, height: 1536 },
    "5:4": { width: 1280, height: 1024 },
    "4:5": { width: 1024, height: 1280 },
    "21:9": { width: 2048, height: 880 },
    "9:21": { width: 880, height: 2048 },
    "1:3": { width: 688, height: 2048 },
    "3:1": { width: 2048, height: 688 },
    "2:1": { width: 2048, height: 1024 },
    "1:2": { width: 1024, height: 2048 },
    auto: { width: 1024, height: 1024 },
  };
  return dimMap[ratio] || { width: 1024, height: 1024 };
}

// Download image from GrsAI, upload to S3, insert into gallery_images
// Returns the result to push to frontend, or null if failed
async function downloadAndSaveImage(
  supabase: ReturnType<typeof getSupabaseClient>,
  taskId: string,
  grsaiImageUrl: string,
  prompt: string,
  model: string,
  ratio: string,
  taskUserId?: string,
  taskCreatorName?: string,
  referenceImageKey?: string,
): Promise<PendingTask | null> {
  // Final idempotency check: make sure no other concurrent request already inserted
  const { count: dupCheck } = await supabase
    .from("gallery_images")
    .select("*", { count: "exact", head: true })
    .eq("task_id", taskId)
    .is("deleted_at", null);

  if ((dupCheck ?? 0) > 0) {
    console.log(`[PendingTasks] Task ${taskId} already in gallery (race condition prevented), marking done`);
    await supabase.from("auto_sync_tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("task_id", taskId);
    // Fetch the existing image to return it
    const { data: img } = await supabase
      .from("gallery_images")
      .select("id, url, image_key")
      .eq("task_id", taskId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    let imageUrl = img?.url || "";
    if (img?.image_key) {
      try { imageUrl = await getSignedUrl(img.image_key as string); } catch { /* keep existing */ }
    }

    return {
      taskId,
      status: "completed",
      prompt,
      model,
      ratio,
      imageUrl,
      imageId: (img?.id as string) || undefined,
      width: estimateDimensions(ratio).width,
      height: estimateDimensions(ratio).height,
      message: "已完成",
    };
  }

  // Upload to S3
  let key: string;
  try {
    key = await storage.uploadFromUrl({ url: grsaiImageUrl, timeout: 120000 });
  } catch (uploadError) {
    console.error("[PendingTasks] S3 upload failed:", uploadError);
    // Release lock so it can be retried
    await supabase.from("auto_sync_tasks").update({ status: "pending", updated_at: new Date().toISOString() }).eq("task_id", taskId);
    return {
      taskId,
      status: "failed",
      prompt,
      model,
      ratio,
      message: "S3上传失败，稍后重试",
    };
  }

  const { width, height } = estimateDimensions(ratio);
  const imageId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let signedUrl = "";

  try {
    signedUrl = await getSignedUrl(key);
  } catch {
    signedUrl = key;
  }

  // Save to gallery_images — with one more idempotency check right before insert
  const { count: finalCheck } = await supabase
    .from("gallery_images")
    .select("*", { count: "exact", head: true })
    .eq("task_id", taskId)
    .is("deleted_at", null);

  if ((finalCheck ?? 0) > 0) {
    console.log(`[PendingTasks] Task ${taskId} inserted by another request during our download, discarding our copy`);
    await supabase.from("auto_sync_tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("task_id", taskId);
    // Return the existing image
    const { data: img } = await supabase
      .from("gallery_images")
      .select("id, url, image_key")
      .eq("task_id", taskId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    let imageUrl = img?.url || "";
    if (img?.image_key) {
      try { imageUrl = await getSignedUrl(img.image_key as string); } catch { /* keep existing */ }
    }

    return {
      taskId,
      status: "completed",
      prompt,
      model,
      ratio,
      imageUrl,
      imageId: (img?.id as string) || undefined,
      width,
      height,
      message: "已完成",
    };
  }

  const insertData = await buildSiteInsertData({
    id: imageId,
    prompt,
    url: signedUrl,
    image_key: key,
    width,
    height,
    views: 0,
    downloads: 0,
    model,
    ratio,
    task_id: taskId,
    user_id: taskUserId,
    creator_name: taskCreatorName,
    created_at: new Date().toISOString(),
    reference_image_key: referenceImageKey || null,
  });

  const { error: dbError } = await supabase.from("gallery_images").insert(insertData);

  if (dbError) {
    // Check if it's a unique constraint violation (another request inserted first)
    if (dbError.code === "23505") {
      console.log(`[PendingTasks] Task ${taskId} unique constraint hit, another request won`);
      await supabase.from("auto_sync_tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("task_id", taskId);
      const { data: img } = await supabase
        .from("gallery_images")
        .select("id, url, image_key")
        .eq("task_id", taskId)
        .is("deleted_at", null)
        .limit(1)
        .single();

      let imageUrl = img?.url || "";
      if (img?.image_key) {
        try { imageUrl = await getSignedUrl(img.image_key as string); } catch { /* keep existing */ }
      }

      return {
        taskId,
        status: "completed",
        prompt,
        model,
        ratio,
        imageUrl,
        imageId: (img?.id as string) || undefined,
        width,
        height,
        message: "已完成",
      };
    }

    console.error("[PendingTasks] DB insert error:", dbError);
    // Release lock so it can be retried
    await supabase.from("auto_sync_tasks").update({ status: "pending", updated_at: new Date().toISOString() }).eq("task_id", taskId);
    return {
      taskId,
      status: "failed",
      prompt,
      model,
      ratio,
      message: "保存失败，稍后重试",
    };
  }

  // Mark as done
  await supabase.from("auto_sync_tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("task_id", taskId);

  return {
    taskId,
    status: "completed",
    prompt,
    model,
    ratio,
    imageUrl: signedUrl,
    imageId,
    width,
    height,
    message: "已完成",
  };
}

// GET: Check pending tasks for the current user (or all if no userId)
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const apiKey = await getGrsaiApiKey();
    const baseUrl = await getGrsaiBaseUrl();

    if (!apiKey) {
      return NextResponse.json({ tasks: [] });
    }

    // Get userId from query params (optional)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // Find pending AND processing tasks from auto_sync_tasks
    let query = supabase
      .from("auto_sync_tasks")
      .select("*")
      .in("status", ["pending", "processing"])
      .eq("source", "generate")
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: syncTasks, error: syncError } = await query;

    if (syncError || !syncTasks || syncTasks.length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    // Filter by userId if provided
    let tasks = syncTasks;
    if (userId) {
      tasks = syncTasks.filter((t: Record<string, unknown>) => {
        try {
          const extra = typeof t.extra === "string" ? JSON.parse(t.extra) : (t.extra as Record<string, unknown>) || {};
          return extra.userId === userId;
        } catch {
          return false;
        }
      });
    }

    const results: PendingTask[] = [];

    for (const task of tasks) {
      const taskId = task.task_id as string;
      const taskStatus = task.status as string;
      const prompt = task.prompt as string || "";
      const model = task.model as string || "";
      const ratio = task.ratio as string || "auto";
      const extra = (() => {
        try {
          return typeof task.extra === "string" ? JSON.parse(task.extra) : (task.extra as Record<string, unknown>) || {};
        } catch {
          return {} as Record<string, unknown>;
        }
      })();
      const taskUserId = extra.userId as string | undefined;
      const taskCreatorName = extra.creatorName as string | undefined;
      const taskReferenceImageKey = extra.referenceImageKey as string | undefined;

      // Helper: check if already completed in gallery_images and push result
      const checkGalleryAndPush = async (): Promise<boolean> => {
        const { count: existingCount } = await supabase
          .from("gallery_images")
          .select("*", { count: "exact", head: true })
          .eq("task_id", taskId)
          .is("deleted_at", null);

        if ((existingCount ?? 0) > 0) {
          const { data: img } = await supabase
            .from("gallery_images")
            .select("id, url, image_key")
            .eq("task_id", taskId)
            .is("deleted_at", null)
            .limit(1)
            .single();

          let imageUrl = img?.url || "";
          if (img?.image_key) {
            try { imageUrl = await getSignedUrl(img.image_key as string); } catch { /* keep existing */ }
          }

          results.push({
            taskId,
            status: "completed",
            prompt,
            model,
            ratio,
            imageUrl,
            imageId: (img?.id as string) || undefined,
            width: extra?.width || estimateDimensions(ratio).width,
            height: extra?.height || estimateDimensions(ratio).height,
            message: "已完成",
          });
          return true;
        }
        return false;
      };

      // If already "processing" — another request holds the lock
      if (taskStatus === "processing") {
        // First check if it's already in gallery (the lock-holder may have just finished)
        const alreadyDone = await checkGalleryAndPush();
        if (alreadyDone) continue;

        // Check if the lock is stale (processing for > 3 minutes = crashed request)
        const updatedAt = task.updated_at ? new Date(task.updated_at as string) : null;
        const lockAgeMs = updatedAt ? Date.now() - updatedAt.getTime() : Infinity;
        const STALE_LOCK_MS = 3 * 60 * 1000; // 3 minutes

        if (lockAgeMs > STALE_LOCK_MS) {
          // Stale lock — reset to pending and fall through to acquire lock below
          console.log(`[pending-tasks] Stale lock for ${taskId} (${Math.round(lockAgeMs / 1000)}s old), resetting to pending`);
          await supabase
            .from("auto_sync_tasks")
            .update({ status: "pending", updated_at: new Date().toISOString() })
            .eq("task_id", taskId)
            .eq("status", "processing");
          // Fall through to the pending logic below
        } else {
          // Active lock held by another request — just query GrsAI for progress info
          // Do NOT reset the lock or download the image (the lock-holder is responsible for that)
          try {
            const resultUrl = baseUrl + "/v1/api/result?id=" + encodeURIComponent(taskId);
            const resultRes = await fetch(resultUrl, {
              headers: { Authorization: "Bearer " + apiKey },
            });
            const resultData = await resultRes.json();

            if (resultData.status === "succeeded" && resultData.results?.length > 0) {
              // Image is ready but the lock-holder hasn't saved it yet
              // Wait a bit — the lock-holder should save it soon
              const progress = resultData.progress ?? 99;
              results.push({ taskId, status: "running", progress, prompt, model, ratio, message: `图片已生成，正在保存...` });
              continue;
            } else if (resultData.status === "running") {
              const progress = resultData.progress ?? 50;
              results.push({ taskId, status: "running", progress, prompt, model, ratio, message: `正在生成... ${progress}%` });
              continue;
            } else if (resultData.status === "failed" || resultData.status === "violation") {
              // GrsAI says failed — the lock-holder should handle this, but report it too
              const reason = resultData.status === "violation" ? "内容违规" : "生成失败";
              results.push({ taskId, status: "running", progress: 0, prompt, model, ratio, message: reason });
              continue;
            } else {
              results.push({ taskId, status: "running", progress: 50, prompt, model, ratio, message: "正在处理中..." });
              continue;
            }
          } catch {
            results.push({ taskId, status: "running", progress: 50, prompt, model, ratio, message: "正在处理中..." });
            continue;
          }
        }
      }

      // status === "pending": try to acquire lock
      const { data: lockResult } = await supabase
        .from("auto_sync_tasks")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("task_id", taskId)
        .eq("status", "pending")
        .select("task_id");

      if (!lockResult || lockResult.length === 0) {
        // Another request just grabbed the lock
        const alreadyDone = await checkGalleryAndPush();
        if (!alreadyDone) {
          results.push({ taskId, status: "running", progress: 50, prompt, model, ratio, message: "正在处理中..." });
        }
        continue;
      }

      // We got the lock. Check if already imported in gallery_images (safety check)
      const alreadyDone = await checkGalleryAndPush();
      if (alreadyDone) continue;

      // Query GrsAI for result
      try {
        const response = await fetch(`${baseUrl}/v1/api/result?id=${encodeURIComponent(taskId)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            // Task result expired (>2 hours) or not found
            const createdAt = task.created_at as string;
            const taskAge = Date.now() - new Date(createdAt).getTime();
            if (taskAge > 2 * 60 * 60 * 1000) {
              await supabase.from("auto_sync_tasks").update({ status: "failed", updated_at: new Date().toISOString() }).eq("task_id", taskId);
              results.push({ taskId, status: "failed", prompt, model, ratio, message: "任务结果已过期" });
            } else {
              // Not ready yet — release lock so next poll can try
              await supabase.from("auto_sync_tasks").update({ status: "pending", updated_at: new Date().toISOString() }).eq("task_id", taskId).eq("status", "processing");
              results.push({ taskId, status: "running", progress: 0, prompt, model, ratio, message: "正在生成中..." });
            }
          } else {
            // Server error — release lock
            await supabase.from("auto_sync_tasks").update({ status: "pending", updated_at: new Date().toISOString() }).eq("task_id", taskId).eq("status", "processing");
            results.push({ taskId, status: "running", progress: 0, prompt, model, ratio, message: "查询失败" });
          }
          continue;
        }

        const data = await response.json();
        const status = (data.status as string) || "unknown";

        if (status === "succeeded") {
          const results_arr = data.results as Array<Record<string, unknown>> | undefined;
          const imageUrl = results_arr?.[0]?.url as string || "";

          if (!imageUrl) {
            await supabase.from("auto_sync_tasks").update({ status: "failed", updated_at: new Date().toISOString() }).eq("task_id", taskId);
            results.push({ taskId, status: "failed", prompt, model, ratio, message: "无图片结果" });
            continue;
          }

          // Download and save (with built-in idempotency check)
          const result = await downloadAndSaveImage(supabase, taskId, imageUrl, prompt, model, ratio, taskUserId, taskCreatorName, taskReferenceImageKey);
          if (result) {
            results.push(result);
          }
        } else if (status === "failed" || status === "violation") {
          await supabase.from("auto_sync_tasks").update({ status: "failed", updated_at: new Date().toISOString() }).eq("task_id", taskId);
          const reason = status === "violation" ? "内容违规" : "生成失败";
          results.push({ taskId, status: "failed", prompt, model, ratio, message: reason });
        } else {
          // Still running — release lock so next poll can try
          await supabase.from("auto_sync_tasks").update({ status: "pending", updated_at: new Date().toISOString() }).eq("task_id", taskId).eq("status", "processing");

          const progress = (data.progress as number) || 0;
          const statusText = status === "running" ? "正在生成" : status === "submitted" ? "等待处理" : "处理中";
          results.push({ taskId, status: "running", progress, prompt, model, ratio, message: `${statusText} ${progress}%` });
        }
      } catch (err) {
        console.error("[PendingTasks] Query error:", err);
        // Release lock so it can be retried
        await supabase.from("auto_sync_tasks").update({ status: "pending", updated_at: new Date().toISOString() }).eq("task_id", taskId).eq("status", "processing");
        results.push({ taskId, status: "running", progress: 0, prompt, model, ratio, message: "查询异常，稍后重试" });
      }
    }

    return NextResponse.json({ tasks: results });
  } catch (error) {
    console.error("[PendingTasks] Error:", error);
    return NextResponse.json({ tasks: [] });
  }
}
