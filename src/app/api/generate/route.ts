import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/utils/storage";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getStorageErrorMessage } from "@/utils/storage-error";
import { verifyUser } from "@/lib/admin-auth";
import { buildSiteInsertData } from "@/lib/multi-site";

// Save task_id to auto_sync_tasks immediately so results can be recovered if user disconnects
async function saveTaskToSyncQueue(
  taskId: string,
  model: string,
  prompt: string,
  ratio: string,
  imageSize: string,
  userId?: string,
  creatorName?: string,
  referenceImageKey?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("auto_sync_tasks").upsert(
      {
        task_id: taskId,
        status: "pending",
        model,
        prompt,
        ratio,
        source: "generate",
        extra: JSON.stringify({ imageSize, userId, creatorName, referenceImageKey }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "task_id" }
    );
    console.log(`[Generate] Task ${taskId} saved to sync queue`);
  } catch (err) {
    console.error("[Generate] Failed to save task to sync queue:", err);
  }
}

const GRSAI_BASE_URL = process.env.GRSAI_BASE_URL || "https://grsai.dakka.com.cn";

async function getGrsaiApiKey(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("admin_settings").select("value").eq("key", "grsai_api_key").single();
    if (data?.value) return data.value;
  } catch { /* fallback */ }
  return process.env.GRSAI_API_KEY || "sk-013abb01b9f44e1ca4f72b81e6d91f60";
}

interface GalleryImage {
  id: string;
  prompt: string;
  url: string;
  imageKey: string;
  width: number;
  height: number;
  views: number;
  downloads: number;
  model: string;
  ratio: string;
  taskId: string;
  createdAt: string;
}

// Generate UUID
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Upload base64 image to storage and return key
async function uploadBase64ToStorage(base64Data: string): Promise<string> {
  try {
    const base64Parts = base64Data.split(",");
    const mimeMatch = base64Data.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    const base64Content = base64Parts[base64Parts.length - 1];
    const buffer = Buffer.from(base64Content, "base64");

    const fileName = `image.${mimeType.split("/")[1]}`;
    const result = await storage.uploadFile({
      fileContent: buffer,
      fileName: fileName,
      contentType: mimeType,
    });

    console.log("Uploaded to storage, key:", result);
    return result;
  } catch (error) {
    console.error("Failed to upload base64 to storage:", error);
    throw new Error(getStorageErrorMessage(error));
  }
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
        expire_time: 0, // Permanent URL
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
    console.error("Failed to get signed URL:", error);
    throw error;
  }
}

interface GrsaiStreamData {
  id?: string;
  status?: string;
  progress?: number;
  results?: Array<{ url?: string }>;
  url?: string;
  error?: string;
  failure_reason?: string;
  [key: string]: unknown;
}

// Parse a single line from GrsAI stream (supports both SSE data: prefix and plain JSON)
function parseStreamLine(line: string): GrsaiStreamData | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let jsonStr = trimmed;
  if (trimmed.startsWith("data: ")) {
    jsonStr = trimmed.slice(6);
    if (jsonStr === "[DONE]") return null;
  }

  try {
    return JSON.parse(jsonStr) as GrsaiStreamData;
  } catch {
    return null;
  }
}

// Translate GrsAI English error messages to Chinese
function translateGrsaiError(message: string): string {
  if (!message) return "生成失败，请重试";
  const lower = message.toLowerCase();
  if (lower.includes("violated our relevant policies") || lower.includes("violation")) {
    return "生成内容违规，请修改提示词后重试";
  }
  if (lower.includes("input_moderation") || lower.includes("input moderation")) {
    return "输入内容违规，请修改提示词后重试";
  }
  if (lower.includes("output_moderation") || lower.includes("output moderation")) {
    return "生成内容违规，请修改提示词后重试";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "请求过于频繁，请稍后再试";
  }
  if (lower.includes("invalid api key") || lower.includes("unauthorized")) {
    return "API 密钥无效，请联系管理员";
  }
  if (lower.includes("timeout")) {
    return "生成超时，请重试";
  }
  if (lower.includes("busy") || lower.includes("overload")) {
    return "服务繁忙，请稍后再试";
  }
  return message;
}

// Unified endpoint: both gpt-image-2 and nano-banana use /v1/api/generate
const MODEL_CONFIG: Record<string, { apiModel: string; supportsImageSize: boolean; usePixelSize: boolean }> = {
  "image2-vip": { apiModel: "gpt-image-2-vip", supportsImageSize: true, usePixelSize: true },
  "image2": { apiModel: "gpt-image-2", supportsImageSize: false, usePixelSize: false },
  "nano-banana-fast": { apiModel: "nano-banana-fast", supportsImageSize: false, usePixelSize: false },
  "nano-banana-2": { apiModel: "nano-banana-2", supportsImageSize: true, usePixelSize: false },
  "nano-banana-pro-vip": { apiModel: "nano-banana-pro-vip", supportsImageSize: true, usePixelSize: false },
};

// Precise pixel dimensions from official API docs
function estimateDimensions(ratio: string, imageSize: string = "1K"): { width: number; height: number } {
  const is2K = imageSize === "2K";
  const is4K = imageSize === "4K";
  const dimMap: Record<string, { width1K: number; height1K: number; width2K?: number; height2K?: number; width4K?: number; height4K?: number }> = {
    "auto": { width1K: 1024, height1K: 1024 },
    "1:1": { width1K: 1024, height1K: 1024, width2K: 2048, height2K: 2048, width4K: 2880, height4K: 2880 },
    "16:9": { width1K: 1280, height1K: 720, width2K: 2048, height2K: 1152, width4K: 3840, height4K: 2160 },
    "9:16": { width1K: 720, height1K: 1280, width2K: 1152, height2K: 2048, width4K: 2160, height4K: 3840 },
    "4:3": { width1K: 1024, height1K: 768, width2K: 2048, height2K: 1536, width4K: 3264, height4K: 2448 },
    "3:4": { width1K: 768, height1K: 1024, width2K: 1536, height2K: 2048, width4K: 2448, height4K: 3264 },
    "3:2": { width1K: 1536, height1K: 1024, width2K: 2048, height2K: 1360, width4K: 3504, height4K: 2336 },
    "2:3": { width1K: 1024, height1K: 1536, width2K: 1360, height2K: 2048, width4K: 2336, height4K: 3504 },
    "5:4": { width1K: 1280, height1K: 1024, width2K: 2048, height2K: 1632, width4K: 3200, height4K: 2560 },
    "4:5": { width1K: 1024, height1K: 1280, width2K: 1632, height2K: 2048, width4K: 2560, height4K: 3200 },
    "21:9": { width1K: 2048, height1K: 880, width2K: 3840, height2K: 1648 },
    "9:21": { width1K: 880, height1K: 2048, width2K: 1648, height2K: 3840 },
    "1:3": { width1K: 688, height1K: 2048, width2K: 1280, height2K: 3840 },
    "3:1": { width1K: 2048, height1K: 688, width2K: 3840, height2K: 1280 },
    "2:1": { width1K: 2048, height1K: 1024, width2K: 3840, height2K: 1920 },
    "1:2": { width1K: 1024, height1K: 2048, width2K: 1920, height2K: 3840 },
    "1:4": { width1K: 512, height1K: 2048, width2K: 960, height2K: 3840 },
    "4:1": { width1K: 2048, height1K: 512, width2K: 3840, height2K: 960 },
    "1:8": { width1K: 256, height1K: 2048, width2K: 480, height2K: 3840 },
    "8:1": { width1K: 2048, height1K: 256, width2K: 3840, height2K: 480 },
  };
  const entry = dimMap[ratio] || dimMap["auto"];
  if (is4K && entry.width4K) return { width: entry.width4K, height: entry.height4K! };
  if (is2K && entry.width2K) return { width: entry.width2K, height: entry.height2K! };
  return { width: entry.width1K, height: entry.height1K };
}

// Call GrsAI and parse the response stream to get the final result
async function callGrsaiAndGetResult(
  apiUrl: string,
  requestBody: Record<string, unknown>,
  apiKey: string,
  meta?: { model: string; prompt: string; ratio: string; imageSize: string; userId?: string; creatorName?: string; referenceImageKey?: string }
): Promise<{ imageUrl: string; taskId: string }> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `GrsAI API error: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
    } catch {
      // ignore parse error
    }
    console.error("GrsAI error:", errorText);
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("服务响应异常");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let imageUrl = "";
  let taskId = "";
  let lastError = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const result = parseStreamLine(line);
      if (!result) continue;

      if (result.id && !taskId) {
        taskId = result.id;
        // Save immediately for recovery if connection drops
        if (meta) {
          saveTaskToSyncQueue(taskId, meta.model, meta.prompt, meta.ratio, meta.imageSize, meta.userId, meta.creatorName, meta.referenceImageKey).catch(() => {});
        }
      }

      if (result.status === "succeeded" && result.results) {
        imageUrl = result.results[0]?.url || result.url || "";
      }

      if (result.status === "failed" || result.status === "violation" || result.status === "error" || result.error) {
        let reason: string;
        if (result.error && typeof result.error === "string") {
          reason = translateGrsaiError(result.error);
        } else if (result.failure_reason && typeof result.failure_reason === "string") {
          reason = translateGrsaiError(result.failure_reason);
        } else if (result.status === "violation") {
          reason = "生成内容违规，请修改提示词后重试";
        } else {
          reason = "生成失败，请重试";
        }
        lastError = reason;
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    const result = parseStreamLine(buffer);
    if (result) {
      if (result.id && !taskId) {
        taskId = result.id;
        if (meta) {
          saveTaskToSyncQueue(taskId, meta.model, meta.prompt, meta.ratio, meta.imageSize, meta.userId, meta.creatorName, meta.referenceImageKey).catch(() => {});
        }
      }
      if (result.status === "succeeded" && result.results) {
        imageUrl = result.results[0]?.url || result.url || "";
      }
      if (result.status === "failed" || result.status === "violation" || result.status === "error" || result.error) {
        let reason: string;
        if (result.error && typeof result.error === "string") {
          reason = translateGrsaiError(result.error);
        } else if (result.failure_reason && typeof result.failure_reason === "string") {
          reason = translateGrsaiError(result.failure_reason);
        } else if (result.status === "violation") {
          reason = "生成内容违规，请修改提示词后重试";
        } else {
          reason = "生成失败，请重试";
        }
        lastError = reason;
      }
    }
  }

  if (!imageUrl) {
    throw new Error(lastError || "生成失败，未获取到图片结果");
  }

  return { imageUrl, taskId };
}

// Download image from URL, upload to S3, save to database, return signed URL
async function saveGeneratedImage(
  imageUrl: string,
  taskId: string,
  prompt: string,
  ratio: string,
  model: string,
  imageSize: string,
  userId: string | null,
  creatorName: string | null,
  referenceImageKey?: string
): Promise<{ imageKey: string; signedUrl: string; id: string; width: number; height: number }> {
  // Upload to S3
  let key: string;
  try {
    key = await storage.uploadFromUrl({
      url: imageUrl,
      timeout: 120000,
    });
  } catch (uploadError) {
    throw new Error(getStorageErrorMessage(uploadError));
  }

  const { width, height } = estimateDimensions(ratio, imageSize);
  const imageId = generateId();
  const now = new Date().toISOString();

  // Save to Supabase
  try {
    const supabase = getSupabaseClient();
    const insertData = await buildSiteInsertData({
      id: imageId,
      prompt: prompt,
      url: "",
      image_key: key,
      width: width,
      height: height,
      views: 0,
      downloads: 0,
      model: model,
      ratio: ratio,
      task_id: taskId,
      user_id: userId,
      creator_name: creatorName,
      created_at: now,
      reference_image_key: referenceImageKey || null,
    });
    const { error: dbError } = await supabase.from("gallery_images").insert(insertData);
    if (dbError) {
      console.error("Failed to save to Supabase:", dbError);
    } else {
      console.log("Saved to Supabase, id:", imageId);
    }
  } catch (dbErr) {
    console.error("Supabase save error:", dbErr);
  }

  // Get permanent signed URL
  let signedUrl = "";
  try {
    signedUrl = await getSignedUrl(key);
  } catch (err) {
    console.error("Failed to get signed URL:", err);
    try {
      signedUrl = await storage.generatePresignedUrl({ key, expireTime: 2592000 });
    } catch {
      signedUrl = key;
    }
  }

  return { imageKey: key, signedUrl, id: imageId, width, height };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, ratio = "auto", model = "image2", count = 1, imageSize = "1K", refImgs, refImageKeys, refImageUrl, refImageKey, refImageContentType, replyType = "stream" } = body;

    const imageCount = Math.min(Math.max(Number(count) || 1, 1), 4);

    // Determine the reference image key to save (first one for display in gallery)
    let referenceImageKeyToSave: string | undefined;
    if (refImageKeys && Array.isArray(refImageKeys) && refImageKeys.length > 0) {
      referenceImageKeyToSave = refImageKeys[0];
    } else if (refImageKey) {
      referenceImageKeyToSave = refImageKey;
    } else if (refImgs && Array.isArray(refImgs) && refImgs.length > 0) {
      // refImgs can be mix of URLs and keys - save the first non-URL one
      const firstKey = refImgs.find((img: string) => !img.startsWith("http"));
      if (firstKey) referenceImageKeyToSave = firstKey;
    }

    console.log("Generate API received:", {
      hasPrompt: !!prompt,
      ratio,
      model,
      count: imageCount,
      hasRefImgs: !!(refImgs && Array.isArray(refImgs) && refImgs.length > 0),
      hasRefImageKeys: !!(refImageKeys && Array.isArray(refImageKeys) && refImageKeys.length > 0),
      hasRefImageUrl: !!refImageUrl,
      hasRefImageKey: !!refImageKey,
    });

    if (!prompt) {
      return new Response(JSON.stringify({ error: "请输入提示词" }), { status: 400 });
    }

    // Get user info from session
    const userInfo = await verifyUser();
    const userId = userInfo?.id || null;
    const creatorName = userInfo?.nickname || null;

    // Check if user is pending (not approved yet)
    if (userInfo && userInfo.status === 'pending') {
      return new Response(JSON.stringify({ error: "账号尚未通过审核，请等待管理员审批后再使用生图功能" }), { status: 403 });
    }

    // Check if user's generate permission is disabled
    if (userInfo && userInfo.can_generate === false) {
      return new Response(JSON.stringify({ error: "生图权限已被禁用，请联系管理员" }), { status: 403 });
    }

    // Check if anonymous generate is allowed
    let anonymousGenerate = false;
    try {
      const supabase = getSupabaseClient();
      const { data: anonData } = await supabase.from("admin_settings").select("value").eq("key", "anonymous_generate").single();
      anonymousGenerate = anonData?.value === "true";
    } catch { /* fallback to false */ }

    if (!userId && !anonymousGenerate) {
      return new Response(JSON.stringify({ error: '请先登录后再生图' }), { status: 401 });
    }

    // Check prompt max length from settings
    try {
      const supabase = getSupabaseClient();
      const { data: maxLenData } = await supabase.from("admin_settings").select("value").eq("key", "prompt_max_length").single();
      const maxLen = maxLenData?.value ? Number(maxLenData.value) : 0;
      if (maxLen > 0 && prompt.length > maxLen) {
        return new Response(JSON.stringify({ error: `提示词超过最大长度限制 (${maxLen} 字)` }), { status: 400 });
      }
    } catch { /* skip check on error */ }

    // Check daily generate limit from settings
    try {
      const supabase = getSupabaseClient();
      const { data: limitData } = await supabase.from("admin_settings").select("value").eq("key", "daily_generate_limit").single();
      const dailyLimit = limitData?.value ? Number(limitData.value) : 0;
      if (dailyLimit > 0) {
        const today = new Date().toISOString().split("T")[0];
        const { count: todayCount } = await supabase
          .from("gallery_images")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today);
        if (todayCount && todayCount >= dailyLimit) {
          return new Response(JSON.stringify({ error: `今日生成次数已达上限 (${dailyLimit} 次)，请明天再试` }), { status: 429 });
        }
      }
    } catch { /* skip check on error */ }

    const modelConfig = MODEL_CONFIG[model];
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: `Unknown model: ${model}` }), { status: 400 });
    }

    const isJsonMode = replyType === "json";

    // Build request body using unified /v1/api/generate endpoint
    const dims = estimateDimensions(ratio, imageSize);
    const requestBody: Record<string, unknown> = {
      model: modelConfig.apiModel,
      prompt: prompt,
      replyType: "async", // Always use async mode so Result API can recover tasks
      shutProgress: false,
    };

    // image2-vip requires pixel value in aspectRatio field (e.g. "1024x768") instead of ratio string
    if (modelConfig.usePixelSize) {
      // Validate: gpt-image-2 has max aspect ratio 3:1
      const maxRatio = Math.max(dims.width / dims.height, dims.height / dims.width);
      if (maxRatio > 3) {
        return new Response(JSON.stringify({ error: `image2-vip 模型不支持 ${ratio} 比例（长宽比不能超过3:1），请选择其他比例` }), { status: 400 });
      }
      requestBody.aspectRatio = `${dims.width}x${dims.height}`;
    } else {
      requestBody.aspectRatio = ratio;
    }

    // Add imageSize for models that support it (but NOT for image2-vip which uses pixel values)
    if (modelConfig.supportsImageSize && !modelConfig.usePixelSize && imageSize && imageSize !== "1K") {
      requestBody.imageSize = imageSize;
    }

    // Handle reference images (urls)
    let urls: string[] | undefined;

    if (refImageKeys && Array.isArray(refImageKeys) && refImageKeys.length > 0) {
      // Multiple S3 keys - convert each to public URL
      console.log("Getting public URLs for refImageKeys:", refImageKeys);
      const publicUrls: string[] = [];
      for (const key of refImageKeys) {
        try {
          const publicUrl = await getSignedUrl(key);
          publicUrls.push(publicUrl);
        } catch (err) {
          console.error("Failed to get public URL for key:", key, err);
          throw err;
        }
      }
      urls = publicUrls;
      console.log("Got public URLs for", publicUrls.length, "images");
    } else if (refImgs && Array.isArray(refImgs) && refImgs.length > 0) {
      // Multiple ref images (mix of URLs and S3 keys)
      const resolvedUrls: string[] = [];
      for (const refImg of refImgs) {
        if (refImg.startsWith("http")) {
          resolvedUrls.push(refImg);
        } else {
          // S3 key
          try {
            const publicUrl = await getSignedUrl(refImg);
            resolvedUrls.push(publicUrl);
          } catch (err) {
            console.error("Failed to get URL for key:", refImg, err);
          }
        }
      }
      urls = resolvedUrls.filter((u) => u.length > 0);
    } else if (refImageKey) {
      // Single S3 key - get permanent signed URL
      console.log("Getting public URL for refImageKey:", refImageKey);
      try {
        const publicUrl = await getSignedUrl(refImageKey);
        urls = [publicUrl];
        console.log("Got public URL:", publicUrl.substring(0, 100) + "...");
      } catch (err) {
        console.error("Failed to get public URL:", err);
        throw err;
      }
    } else if (refImageUrl) {
      // Single reference image - check if it's base64 or URL
      console.log("[Generate] Using refImageUrl:", refImageUrl.substring(0, 120) + "...");
      if (refImageUrl.startsWith("data:")) {
        // Base64 - need to upload first
        const uploadedKey = await uploadBase64ToStorage(refImageUrl);
        const publicUrl = await getSignedUrl(uploadedKey);
        urls = [publicUrl];
      } else {
        // HTTP URL - use directly
        urls = [refImageUrl];
      }
    } else {
      console.log("[Generate] No refImageUrl provided");
    }

    if (urls && urls.length > 0) {
      requestBody.images = urls;
    }

    console.log(
      "GrsAI request:",
      JSON.stringify(
        {
          ...requestBody,
          urls: urls?.map((u) => u.substring(0, 100) + "..."),
        },
        null,
        2
      )
    );

    const url = `${GRSAI_BASE_URL}/v1/api/generate`;

    // JSON mode: synchronous processing, wait for all images then return JSON
    if (isJsonMode) {
      const results: Array<{
        success: boolean;
        data?: GalleryImage & { url: string; taskId: string };
        error?: string;
        index: number;
      }> = [];

      for (let imgIndex = 0; imgIndex < imageCount; imgIndex++) {
        try {
          const { imageUrl, taskId } = await callGrsaiAndGetResult(url, requestBody, await getGrsaiApiKey(), { model, prompt, ratio, imageSize, userId: userId ?? undefined, creatorName: creatorName ?? undefined, referenceImageKey: referenceImageKeyToSave });
          const saved = await saveGeneratedImage(imageUrl, taskId, prompt, ratio, model, imageSize, userId, creatorName, referenceImageKeyToSave);

          // Mark task as done in sync queue
          if (taskId) {
            try {
              const supabase = getSupabaseClient();
              await supabase.from("auto_sync_tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("task_id", taskId);
            } catch { /* ignore */ }
          }

          results.push({
            success: true,
            data: {
              id: saved.id,
              prompt: prompt,
              url: saved.signedUrl,
              imageKey: saved.imageKey,
              width: saved.width,
              height: saved.height,
              views: 0,
              downloads: 0,
              model: model,
              ratio: ratio,
              taskId: taskId,
              createdAt: new Date().toISOString(),
            },
            index: imgIndex,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "生成失败";
          console.error(`JSON mode image ${imgIndex + 1} failed:`, msg);
          results.push({ success: false, error: msg, index: imgIndex });
        }
      }

      const allSuccess = results.every((r) => r.success);
      return NextResponse.json(
        { success: allSuccess, results },
        { status: allSuccess ? 200 : 207 }
      );
    }

    // Stream/Async mode: Submit tasks to GrsAI with async mode, return task IDs for polling
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function sendSSE(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          sendSSE({ type: "progress", progress: 0, status: "正在提交任务...", total: imageCount, current: 0 });

          const taskIds: string[] = [];

          for (let imgIndex = 0; imgIndex < imageCount; imgIndex++) {
            try {
              const response = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${await getGrsaiApiKey()}`,
                },
                body: JSON.stringify(requestBody),
              });

              const responseText = await response.text();

              if (!response.ok) {
                let errorMessage = `GrsAI API error: ${response.status}`;
                try {
                  const errorJson = JSON.parse(responseText);
                  errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
                } catch {
                  // ignore parse error
                }
                console.error("GrsAI error:", responseText);
                sendSSE({ type: "error", error: errorMessage, index: imgIndex });
                continue;
              }

              let taskId = "";
              try {
                const data = JSON.parse(responseText);
                taskId = data.id || data.task_id || data.taskId || "";
                if (!taskId) {
                  console.error("GrsAI response missing task ID:", responseText.substring(0, 200));
                }
              } catch (e) {
                console.error("GrsAI response parse error:", responseText.substring(0, 200), e);
              }

              if (!taskId) {
                sendSSE({ type: "error", error: "未获取到任务ID，请重试", index: imgIndex });
                continue;
              }

              taskIds.push(taskId);

              // Save task to sync queue immediately for recovery
              await saveTaskToSyncQueue(taskId, model, prompt, ratio, imageSize, userId ?? undefined, creatorName ?? undefined, referenceImageKeyToSave);

              sendSSE({
                type: "task_submitted",
                taskId: taskId,
                index: imgIndex,
                total: imageCount,
                progress: Math.round(((imgIndex + 1) / imageCount) * 10), // 0-10% for submission
                status: imageCount > 1 ? `第 ${imgIndex + 1}/${imageCount} 张任务已提交` : "任务已提交，正在生成中...",
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "提交任务失败";
              console.error(`Task ${imgIndex + 1} submit failed:`, msg);
              sendSSE({ type: "error", error: msg, index: imgIndex });
            }
          }

          // Return all task IDs so frontend can poll for results
          sendSSE({
            type: "tasks_submitted",
            taskIds: taskIds,
            total: imageCount,
            progress: 10,
            status: "任务已提交，请等待生成完成...",
          });

          controller.close();
        } catch (error: unknown) {
          console.error("Generate error:", error);
          const message = error instanceof Error ? error.message : "服务器内部错误";
          sendSSE({ type: "error", error: message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
