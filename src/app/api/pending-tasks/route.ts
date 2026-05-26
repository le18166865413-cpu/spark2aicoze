import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { storage } from "@/utils/storage";
import { getStorageErrorMessage } from "@/utils/storage-error";
import { buildSiteInsertData } from "@/lib/multi-site";

interface PendingTask {
  taskId: string;
  status: "pending" | "completed" | "failed";
  prompt?: string;
  model?: string;
  ratio?: string;
  imageUrl?: string;
  imageId?: string;
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

    // Find pending tasks from auto_sync_tasks
    let query = supabase
      .from("auto_sync_tasks")
      .select("*")
      .eq("status", "pending")
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
      const imageSize = extra.imageSize as string || "1K";

      // Check if already imported in gallery_images
      const { count: existingCount } = await supabase
        .from("gallery_images")
        .select("*", { count: "exact", head: true })
        .eq("task_id", taskId)
        .is("deleted_at", null);

      if ((existingCount ?? 0) > 0) {
        // Already imported, mark as done
        await supabase.from("auto_sync_tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("task_id", taskId);
        const { data: img } = await supabase
          .from("gallery_images")
          .select("id, url, image_key")
          .eq("task_id", taskId)
          .is("deleted_at", null)
          .limit(1)
          .single();

        let imageUrl = img?.url || "";
        if (img?.image_key && imageUrl) {
          try {
            imageUrl = await getSignedUrl(img.image_key as string);
          } catch { /* keep existing URL */ }
        }

        results.push({
          taskId,
          status: "completed",
          prompt,
          model,
          ratio,
          imageUrl,
          imageId: (img?.id as string) || undefined,
          message: "已完成",
        });
        continue;
      }

      // Query GrsAI for result
      try {
        const response = await fetch(`${baseUrl}/v1/api/result?id=${encodeURIComponent(taskId)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          results.push({ taskId, status: "pending", prompt, model, ratio, message: "查询失败" });
          continue;
        }

        const result = await response.json();
        const data = result.data as Record<string, unknown> | undefined;

        if (!data) {
          results.push({ taskId, status: "pending", prompt, model, ratio, message: "查询无数据" });
          continue;
        }

        const status = (data.status as string) || "unknown";

        if (status === "succeeded") {
          const results_arr = data.results as Array<Record<string, unknown>> | undefined;
          const imageUrl = results_arr?.[0]?.url as string || (data.url as string) || "";

          if (!imageUrl) {
            await supabase.from("auto_sync_tasks").update({ status: "failed", updated_at: new Date().toISOString() }).eq("task_id", taskId);
            results.push({ taskId, status: "failed", prompt, model, ratio, message: "无图片结果" });
            continue;
          }

          // Upload to S3
          let key: string;
          try {
            key = await storage.uploadFromUrl({ url: imageUrl, timeout: 120000 });
          } catch (uploadError) {
            console.error("[PendingTasks] S3 upload failed:", uploadError);
            results.push({ taskId, status: "pending", prompt, model, ratio, message: "S3上传失败，稍后重试" });
            continue;
          }

          const { width, height } = estimateDimensions(ratio);
          const imageId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          let signedUrl = "";

          try {
            signedUrl = await getSignedUrl(key);
          } catch {
            signedUrl = key;
          }

          // Save to gallery_images
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
          });

          const { error: dbError } = await supabase.from("gallery_images").insert(insertData);

          if (dbError) {
            console.error("[PendingTasks] DB insert error:", dbError);
            results.push({ taskId, status: "pending", prompt, model, ratio, message: "保存失败，稍后重试" });
            continue;
          }

          // Mark as done
          await supabase.from("auto_sync_tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("task_id", taskId);

          results.push({
            taskId,
            status: "completed",
            prompt,
            model,
            ratio,
            imageUrl: signedUrl,
            imageId,
            message: "已完成",
          });
        } else if (status === "failed" || status === "violation") {
          await supabase.from("auto_sync_tasks").update({ status: "failed", updated_at: new Date().toISOString() }).eq("task_id", taskId);
          const reason = status === "violation" ? "内容违规" : "生成失败";
          results.push({ taskId, status: "failed", prompt, model, ratio, message: reason });
        } else {
          // Still running / processing
          const progress = (data.progress as number) || 0;
          results.push({ taskId, status: "pending", prompt, model, ratio, message: `生成中 ${progress}%` });
        }
      } catch (err) {
        console.error("[PendingTasks] Query error:", err);
        results.push({ taskId, status: "pending", prompt, model, ratio, message: "查询异常" });
      }
    }

    return NextResponse.json({ tasks: results });
  } catch (error) {
    console.error("[PendingTasks] Error:", error);
    return NextResponse.json({ tasks: [] });
  }
}
