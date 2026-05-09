import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { verifyUser } from "@/lib/admin-auth";
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
      console.error(`[GrsAI Sync] Dashboard API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.code !== 0 || !data.data) {
      console.error(`[GrsAI Sync] Dashboard API business error:`, data.msg || "unknown");
      return null;
    }

    return {
      list: data.data.list || [],
      totalPage: data.data.totalPage || 1,
    };
  } catch (error) {
    console.error("[GrsAI Sync] Fetch logs error:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Verify admin
  const user = await verifyUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const maxPages = Math.min(body.maxPages || 5, 20); // Default 5 pages, max 20
  const pageSize = body.pageSize || 20;

  const token = await getSetting("grsai_dashboard_token");
  const xtx = await getSetting("grsai_dashboard_xtx");

  if (!token || !xtx) {
    return NextResponse.json({ error: "未配置 GrsAI Dashboard 认证信息，请先保存 Token 和 xtx" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const results: Array<{
    taskId: string;
    status: "imported" | "queued" | "skipped" | "failed";
    message: string;
  }> = [];

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
            console.error(`[GrsAI Sync] Import failed for ${taskId}:`, e);
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

      // Stop if we reached the last page
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

    return NextResponse.json({
      success: true,
      imported,
      queued,
      skipped,
      failed,
      total: results.length,
      results: results.slice(0, 50),
    });
  } catch (error) {
    console.error("[GrsAI Sync] Exception:", error);
    return NextResponse.json({ error: "同步失败", details: error instanceof Error ? error.message : "unknown" }, { status: 500 });
  }
}

export async function GET() {
  // Verify admin
  const user = await verifyUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  }

  const token = await getSetting("grsai_dashboard_token");
  const xtx = await getSetting("grsai_dashboard_xtx");
  const lastSyncAt = await getSetting("grsai_last_sync_at");
  const lastSyncCount = await getSetting("grsai_last_sync_count");

  return NextResponse.json({
    configured: !!(token && xtx),
    lastSyncAt,
    lastSyncCount: lastSyncCount ? parseInt(lastSyncCount, 10) : 0,
  });
}
