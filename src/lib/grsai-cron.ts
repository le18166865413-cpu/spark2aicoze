import { getSupabaseClient } from "@/storage/database/supabase-client";
import { storage } from "@/utils/storage";
import { getStorageErrorMessage } from "@/utils/storage-error";

const GRSAI_DASHBOARD_API = "https://grsaiapi.com/client/grsai/getCreditsLogList";

interface GrsaiLogItem {
  id?: string;
  taskId?: string;
  taskData?: {
    prompt?: string;
    param?: {
      aspectRatio?: string;
      model?: string;
      imageSize?: string;
      [key: string]: unknown;
    };
    result?: {
      id?: string;
      status?: string;
      progress?: number;
      results?: Array<{
        url?: string;
        content?: string;
      }>;
    };
  };
  credits?: number;
  modelName?: string;
  createTime?: string;
  finishTime?: string;
  status?: string;
}

let cronInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function getSetting(key: string): Promise<string | null> {
  try {
    const { data } = await getSupabaseClient().from("admin_settings").select("value").eq("key", key).single();
    return data?.value || null;
  } catch {
    return null;
  }
}

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

async function fetchGrsaiLogs(token: string, xtx: string, page: number, size: number): Promise<{ list: GrsaiLogItem[]; totalPage: number } | null> {
  try {
    const response = await fetch(GRSAI_DASHBOARD_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: token,
        xtx: xtx,
      },
      body: JSON.stringify({ page, size }),
    });

    if (!response.ok) {
      console.error(`[GrsAI Cron] Dashboard API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.code !== 0 || !data.data) {
      console.error(`[GrsAI Cron] Dashboard API business error:`, data.msg || "unknown");
      return null;
    }

    return {
      list: data.data.list || [],
      totalPage: data.data.totalPage || 1,
    };
  } catch (error) {
    console.error("[GrsAI Cron] Fetch logs error:", error);
    return null;
  }
}

export interface GrsaiSyncResult {
  imported: number;
  queued: number;
  skipped: number;
  failed: number;
  results: Array<{
    taskId: string;
    status: "imported" | "queued" | "skipped" | "failed";
    message: string;
  }>;
}

export async function runGrsaiSync(maxPages = 3, pageSize = 20): Promise<GrsaiSyncResult> {
  const token = await getSetting("grsai_dashboard_token");
  const xtx = await getSetting("grsai_dashboard_xtx");

  if (!token || !xtx) {
    console.log("[GrsAI Cron] No token or xtx configured, skipping sync");
    return { imported: 0, queued: 0, skipped: 0, failed: 0, results: [] };
  }

  const supabase = getSupabaseClient();
  const results: GrsaiSyncResult["results"] = [];
  let imported = 0;
  let queued = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (let page = 1; page <= maxPages; page++) {
      const logs = await fetchGrsaiLogs(token, xtx, page, pageSize);
      if (!logs || !logs.list.length) {
        break;
      }

      for (const item of logs.list) {
        // Parse JSON strings in taskData
        let taskData = item.taskData || {};
        if (typeof taskData.result === "string") {
          try { taskData = { ...taskData, result: JSON.parse(taskData.result) }; } catch { /* ignore */ }
        }
        if (typeof taskData.param === "string") {
          try { taskData = { ...taskData, param: JSON.parse(taskData.param) }; } catch { /* ignore */ }
        }

        const taskId = item.taskId || taskData.result?.id;
        if (!taskId) continue;

        // Check if already imported
        const { count: existingCount } = await supabase
          .from("gallery_images")
          .select("*", { count: "exact", head: true })
          .eq("task_id", taskId);

        if ((existingCount ?? 0) > 0) {
          skipped++;
          results.push({ taskId, status: "skipped", message: "已存在" });
          continue;
        }

        const prompt = taskData.prompt || "GrsAI 导入";
        const model = taskData.param?.model || item.modelName || "nano-banana";
        const ratio = taskData.param?.aspectRatio || "1:1";
        const taskStatus = taskData.result?.status;
        const imageUrl = taskData.result?.results?.[0]?.url;

        if (taskStatus === "succeeded" && imageUrl) {
          // Download and import
          try {
            const key = await storage.uploadFromUrl({ url: imageUrl, timeout: 120000 });
            if (key) {
              const signedUrl = await getSignedUrl(key);
              const imageId = `grsai_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

              await supabase.from("gallery_images").insert({
                id: imageId,
                prompt,
                url: signedUrl,
                image_key: key,
                width: 1024,
                height: 1024,
                views: 0,
                downloads: 0,
                model,
                ratio,
                task_id: taskId,
                liked: false,
                created_at: item.createTime || new Date().toISOString(),
              });

              imported++;
              results.push({ taskId, status: "imported", message: "导入成功" });
            } else {
              failed++;
              results.push({ taskId, status: "failed", message: "S3上传失败" });
            }
          } catch (e) {
            console.error(`[GrsAI Cron] Import failed for ${taskId}:`, e);
            failed++;
            results.push({ taskId, status: "failed", message: getStorageErrorMessage(e) });
          }
        } else if (taskStatus === "running" || taskStatus === "submitted" || taskStatus === "processing") {
          // Add to auto sync queue
          await supabase.from("auto_sync_tasks").upsert(
            {
              task_id: taskId,
              status: "pending",
              model,
              prompt,
              ratio,
              source: "grsai_dashboard",
            },
            { onConflict: "task_id" }
          );
          queued++;
          results.push({ taskId, status: "queued", message: "已加入监控队列" });
        } else {
          skipped++;
          results.push({ taskId, status: "skipped", message: `状态: ${taskStatus}` });
        }
      }

      if (page >= logs.totalPage) {
        break;
      }
    }

    // Save last sync info
    await supabase.from("admin_settings").upsert(
      [
        { key: "grsai_last_sync_at", value: new Date().toISOString() },
        { key: "grsai_last_sync_count", value: String(imported + queued) },
      ],
      { onConflict: "key" }
    );

    console.log(`[GrsAI Cron] Sync complete: imported=${imported}, queued=${queued}, skipped=${skipped}, failed=${failed}`);
  } catch (error) {
    console.error("[GrsAI Cron] Sync error:", error);
  }

  return { imported, queued, skipped, failed, results };
}

async function tick() {
  if (isRunning) {
    console.log("[GrsAI Cron] Previous sync still running, skipping this tick");
    return;
  }

  try {
    const enabled = await getSetting("grsai_auto_sync_enabled");
    if (enabled !== "true") {
      console.log("[GrsAI Cron] Auto sync disabled, skipping");
      return;
    }

    isRunning = true;
    console.log("[GrsAI Cron] Starting scheduled sync...");
    await runGrsaiSync(3, 20);
  } catch (error) {
    console.error("[GrsAI Cron] Tick error:", error);
  } finally {
    isRunning = false;
  }
}

export function startGrsaiCron() {
  if (cronInterval) {
    console.log("[GrsAI Cron] Already started");
    return;
  }

  console.log("[GrsAI Cron] Starting cron job (every 1 hour)");
  // Run immediately on startup
  tick();
  // Then every 1 hour
  cronInterval = setInterval(tick, 60 * 60 * 1000);
}

export function stopGrsaiCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log("[GrsAI Cron] Stopped");
  }
}
