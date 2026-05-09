import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/utils/storage";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getStorageErrorMessage } from "@/utils/storage-error";
import { verifyUser } from "@/lib/admin-auth";

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
const MODEL_CONFIG: Record<string, { apiModel: string; supportsImageSize: boolean }> = {
  "image2-vip": { apiModel: "gpt-image-2-vip", supportsImageSize: true },
  "image2": { apiModel: "gpt-image-2", supportsImageSize: false },
  "nano-banana-fast": { apiModel: "nano-banana-fast", supportsImageSize: false },
  "nano-banana-2": { apiModel: "nano-banana-2", supportsImageSize: true },
  "nano-banana-pro-vip": { apiModel: "nano-banana-pro-vip", supportsImageSize: true },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, ratio = "auto", model = "image2", count = 1, imageSize = "1K", refImgs, refImageKeys, refImageUrl, refImageKey, refImageContentType } = body;

    const imageCount = Math.min(Math.max(Number(count) || 1, 1), 4);

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

    // Get user info from session - LOGIN REQUIRED
    const userInfo = await verifyUser();
    const userId = userInfo?.id || null;
    const creatorName = userInfo?.nickname || null;

    if (!userId) {
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

    // Build request body using unified /v1/api/generate endpoint
    const requestBody: Record<string, unknown> = {
      model: modelConfig.apiModel,
      prompt: prompt,
      aspectRatio: ratio,
      replyType: "stream",
      shutProgress: false,
    };

    // Add imageSize for models that support it
    if (modelConfig.supportsImageSize && imageSize && imageSize !== "1K") {
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
      if (refImageUrl.startsWith("data:")) {
        // Base64 - need to upload first
        const uploadedKey = await uploadBase64ToStorage(refImageUrl);
        const publicUrl = await getSignedUrl(uploadedKey);
        urls = [publicUrl];
      } else {
        // HTTP URL - use directly
        urls = [refImageUrl];
      }
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

    // Use SSE streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function sendSSE(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          sendSSE({ type: "progress", progress: 0, status: "submitted", total: imageCount, current: 0 });

          for (let imgIndex = 0; imgIndex < imageCount; imgIndex++) {
            sendSSE({ type: "progress", progress: 0, status: imageCount > 1 ? `正在生成第 ${imgIndex + 1}/${imageCount} 张...` : "submitted", total: imageCount, current: imgIndex });

            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${await getGrsaiApiKey()}`,
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
              sendSSE({ type: "error", error: errorMessage });
              controller.close();
              return;
            }

            // Parse SSE stream
            const reader = response.body?.getReader();
            if (!reader) {
              sendSSE({ type: "error", error: "服务响应异常" });
              controller.close();
              return;
            }

            const decoder = new TextDecoder();
            let buffer = "";
            let imageUrl = "";
            let taskId = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;

                const jsonStr = trimmed.slice(6);
                if (jsonStr === "[DONE]") continue;

                try {
                  const data = JSON.parse(jsonStr);
                  console.log("GrsAI SSE data:", JSON.stringify(data).substring(0, 200));

                  // Capture task ID
                  if (data.id && !taskId) {
                    taskId = data.id;
                  }

                  // Forward progress
                  if (data.progress !== undefined) {
                    const baseProgress = imageCount > 1 ? Math.round((imgIndex / imageCount) * 100) : 0;
                    const stepProgress = imageCount > 1
                      ? Math.round((data.progress / 100) * (100 / imageCount))
                      : data.progress;
                    const statusText = imageCount > 1
                      ? `第 ${imgIndex + 1}/${imageCount} 张 - ${data.status === "submitted" ? "等待处理" : data.status === "running" ? "正在生成" : data.status === "uploading" ? "上传中" : data.status || "处理中"}`
                      : (data.status === "submitted" ? "等待处理" : data.status === "running" ? "正在生成" : data.status === "uploading" ? "上传中" : data.status || "处理中");
                    sendSSE({ type: "progress", progress: Math.min(baseProgress + stepProgress, 99), status: statusText, total: imageCount, current: imgIndex });
                  }

                  // Capture final result
                  if (data.status === "succeeded" && data.results) {
                    imageUrl = data.results[0]?.url || data.url || "";
                  }

                  if (data.status === "failed" || data.status === "violation" || data.status === "error" || data.error) {
                    let reason: string;
                    if (data.error && typeof data.error === "string") {
                      reason = translateGrsaiError(data.error);
                    } else if (data.failure_reason && typeof data.failure_reason === "string") {
                      reason = translateGrsaiError(data.failure_reason);
                    } else if (data.status === "violation") {
                      reason = "生成内容违规，请修改提示词后重试";
                    } else {
                      reason = "生成失败，请重试";
                    }
                    sendSSE({ type: "error", error: reason });
                    controller.close();
                    return;
                  }
                } catch {
                  // Skip malformed JSON lines
                }
              }
            }

            if (!imageUrl) {
              sendSSE({ type: "error", error: `第 ${imgIndex + 1} 张生成失败，未获取到图片结果，请重试` });
              controller.close();
              return;
            }

            sendSSE({ type: "progress", progress: imageCount > 1 ? Math.round(((imgIndex + 0.95) / imageCount) * 100) : 95, status: imageCount > 1 ? `第 ${imgIndex + 1} 张上传中...` : "uploading", total: imageCount, current: imgIndex });

            // Upload to S3
            let key: string;
            try {
              key = await storage.uploadFromUrl({
                url: imageUrl,
                timeout: 120000,
              });
            } catch (uploadError) {
              console.error("S3 upload failed:", uploadError);
              sendSSE({ type: "error", error: getStorageErrorMessage(uploadError) });
              controller.close();
              return;
            }

            const { width, height } = estimateDimensions(ratio, imageSize);
            const imageId = generateId();
            const now = new Date().toISOString();

            // Create new image entry
            const newImage: GalleryImage = {
              id: imageId,
              imageKey: key,
              prompt: prompt,
              url: "",
              width: width,
              height: height,
              views: 0,
              downloads: 0,
              model: model,
              ratio: ratio,
              taskId: taskId,
              createdAt: now,
            };

            // Save to Supabase
            try {
              const supabase = getSupabaseClient();
              const { error: dbError } = await supabase.from("gallery_images").insert({
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
              });

              if (dbError) {
                console.error("Failed to save to Supabase:", dbError);
              } else {
                console.log("Saved to Supabase, id:", imageId);
              }
            } catch (dbErr) {
              console.error("Supabase save error:", dbErr);
            }

            // Get permanent signed URL for the uploaded image
            let signedUrl = "";
            try {
              signedUrl = await getSignedUrl(key);
            } catch (err) {
              console.error("Failed to get signed URL:", err);
              // Fallback to presigned URL
              try {
                signedUrl = await storage.generatePresignedUrl({ key, expireTime: 2592000 });
              } catch {
                signedUrl = key;
              }
            }

            // Return complete with URL for preview
            sendSSE({ type: "complete", data: { ...newImage, url: signedUrl, taskId }, index: imgIndex, total: imageCount });
          }

          // All images done
          sendSSE({ type: "all_complete", total: imageCount });
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
