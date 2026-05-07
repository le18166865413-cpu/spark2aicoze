import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { storage } from "@/utils/storage";
import { getStorageErrorMessage } from "@/utils/storage-error";

interface GalleryImage {
  id: string;
  prompt: string;
  url: string;
  image_key: string;
  width: number;
  height: number;
  views: number;
  downloads: number;
  model: string;
  ratio: string;
  task_id: string | null;
  liked: boolean;
  created_at: string;
}

interface GrsAIResult {
  id: string;
  status: string;
  results?: { url: string; content?: string }[];
  progress?: number;
  failure_reason?: string;
  error?: string;
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

async function getApiKey(): Promise<string | null> {
  return getSetting("grsai_api_key");
}

async function getBaseUrl(): Promise<string> {
  return (await getSetting("grsai_base_url")) || "https://grsai.dakka.com.cn";
}

async function queryTaskResult(taskId: string, apiKey: string, baseUrl: string): Promise<GrsAIResult | null> {
  try {
    const response = await fetch(`${baseUrl}/v1/api/result?id=${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (data.code === 0 && data.data) return data.data;
    if (data.id) return data; // Direct format
    return null;
  } catch (e) {
    console.error(`[AutoSync] Failed to query task ${taskId}:`, e);
    return null;
  }
}

async function checkImageExists(imageKey: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { count } = await supabase
      .from("gallery_images")
      .select("*", { count: "exact", head: true })
      .eq("image_key", imageKey);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

// POST /api/admin/sync-auto
// Automatically checks pending tasks and imports new ones from task IDs
export async function POST() {
  console.log("[AutoSync] Starting auto sync...");

  const apiKey = await getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "未配置 API Key" }, { status: 400 });
  }

  const autoEnabled = await getSetting("auto_sync_enabled");
  if (autoEnabled !== "true") {
    return NextResponse.json({ message: "自动同步未启用", synced: 0 });
  }

  const baseUrl = await getBaseUrl();
  const supabase = getSupabaseClient();

  // 1. Find images that have task_id but no URL (failed/incomplete generation)
  const { data: incompleteImages } = await supabase
    .from("gallery_images")
    .select("*")
    .not("task_id", "is", null)
    .or("url.eq.,url.is.null")
    .limit(50);

  // 2. Find pending task IDs from auto_sync_tasks table
  let pendingTaskIds: string[] = [];
  try {
    const { data: syncTasks } = await supabase
      .from("auto_sync_tasks")
      .select("task_id")
      .eq("status", "pending")
      .limit(100);
    pendingTaskIds = (syncTasks || []).map((t: { task_id: string }) => t.task_id);
  } catch {
    // Table might not exist yet, that's fine
    pendingTaskIds = [];
  }

  let synced = 0;
  let failed = 0;
  const results: { taskId: string; status: string; message: string }[] = [];

  // Process incomplete images (re-check their task results)
  for (const img of (incompleteImages || []) as GalleryImage[]) {
    if (!img.task_id) continue;

    const result = await queryTaskResult(img.task_id, apiKey, baseUrl);
    if (!result) {
      results.push({ taskId: img.task_id, status: "skipped", message: "查询无结果" });
      continue;
    }

    if (result.status === "succeeded" && result.results?.[0]?.url) {
      const imageUrl = result.results[0].url;
      try {
        const key = await storage.uploadFromUrl({ url: imageUrl, timeout: 120000 });
        if (key && !(await checkImageExists(key))) {
          await supabase
            .from("gallery_images")
            .update({ url: "", image_key: key })
            .eq("id", img.id);
          synced++;
          results.push({ taskId: img.task_id, status: "synced", message: "补全成功" });
        } else if (key) {
          // Already exists, just update
          await supabase
            .from("gallery_images")
            .update({ image_key: key })
            .eq("id", img.id);
          synced++;
          results.push({ taskId: img.task_id, status: "updated", message: "更新成功" });
        }
      } catch (e) {
        failed++;
        results.push({ taskId: img.task_id, status: "failed", message: getStorageErrorMessage(e) });
      }
    } else if (result.status === "failed" || result.status === "violation") {
      // Remove failed entries
      await supabase.from("gallery_images").delete().eq("id", img.id);
      failed++;
      results.push({ taskId: img.task_id, status: "removed", message: "任务已失败，已清理" });
    } else {
      results.push({ taskId: img.task_id, status: "pending", message: `状态: ${result.status}, 进度: ${result.progress || 0}%` });
    }
  }

  // Process pending task IDs from auto_sync_tasks
  for (const taskId of pendingTaskIds) {
    // Check if already imported
    const { count: existingCount } = await supabase
      .from("gallery_images")
      .select("*", { count: "exact", head: true })
      .eq("task_id", taskId);

    if ((existingCount ?? 0) > 0) {
      // Already imported, mark as done
      await supabase.from("auto_sync_tasks").update({ status: "done" }).eq("task_id", taskId);
      results.push({ taskId, status: "skipped", message: "已存在" });
      continue;
    }

    const result = await queryTaskResult(taskId, apiKey, baseUrl);
    if (!result) {
      results.push({ taskId, status: "skipped", message: "查询无结果" });
      continue;
    }

    if (result.status === "succeeded" && result.results?.[0]?.url) {
      const imageUrl = result.results[0].url;
      try {
        const key = await storage.uploadFromUrl({ url: imageUrl, timeout: 120000 });
        if (key) {
          const imageId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          await supabase.from("gallery_images").insert({
            id: imageId,
            prompt: result.results[0].content || "自动导入",
            url: "",
            image_key: key,
            width: 1024,
            height: 1024,
            views: 0,
            downloads: 0,
            model: "auto-import",
            ratio: "auto",
            task_id: taskId,
            liked: false,
            created_at: new Date().toISOString(),
          });
          await supabase.from("auto_sync_tasks").update({ status: "done" }).eq("task_id", taskId);
          synced++;
          results.push({ taskId, status: "synced", message: "导入成功" });
        }
      } catch (e) {
        failed++;
        results.push({ taskId, status: "failed", message: getStorageErrorMessage(e) });
      }
    } else if (result.status === "failed" || result.status === "violation") {
      await supabase.from("auto_sync_tasks").update({ status: "failed" }).eq("task_id", taskId);
      results.push({ taskId, status: "failed", message: "原任务已失败" });
    } else {
      results.push({ taskId, status: "pending", message: `状态: ${result.status}` });
    }
  }

  console.log(`[AutoSync] Complete: synced=${synced}, failed=${failed}`);

  return NextResponse.json({
    synced,
    failed,
    total: results.length,
    results: results.slice(0, 20), // Limit response size
    nextSync: new Date(Date.now() + 3600000).toISOString(),
  });
}

// GET - check auto sync status
export async function GET() {
  const autoEnabled = await getSetting("auto_sync_enabled");
  const lastSync = await getSetting("auto_sync_last_sync");

  const supabase = getSupabaseClient();
  let pendingCount = 0;
  let incompleteCount = 0;

  try {
    const { count } = await supabase
      .from("auto_sync_tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    pendingCount = count ?? 0;
  } catch {
    // Table might not exist
  }

  try {
    const { count } = await supabase
      .from("gallery_images")
      .select("*", { count: "exact", head: true })
      .not("task_id", "is", null)
      .or("url.eq.,url.is.null");
    incompleteCount = count ?? 0;
  } catch {
    // ignore
  }

  return NextResponse.json({
    enabled: autoEnabled === "true",
    lastSync: lastSync || null,
    pendingTasks: pendingCount,
    incompleteImages: incompleteCount,
  });
}
