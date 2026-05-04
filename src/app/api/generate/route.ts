import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/utils/storage";
import { getSupabaseClient } from "@/storage/database/supabase-client";

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
    throw error;
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

// Model config - nano-banana series uses a different endpoint
const MODEL_CONFIG: Record<string, { apiModel: string; endpoint: string }> = {
  "image2-vip": { apiModel: "gpt-image-2-vip", endpoint: "/v1/draw/completions" },
  "image2": { apiModel: "gpt-image-2", endpoint: "/v1/draw/completions" },
  "nano-banana-fast": { apiModel: "nano-banana-fast", endpoint: "/v1/draw/nano-banana" },
};

// Estimate pixel dimensions from ratio
function estimateDimensions(ratio: string): { width: number; height: number } {
  const dimMap: Record<string, { width: number; height: number }> = {
    "9:16": { width: 1024, height: 1792 },
    "3:4": { width: 1024, height: 1365 },
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1792, height: 1024 },
    "4:3": { width: 1365, height: 1024 },
    "2:3": { width: 1024, height: 1536 },
    "3:2": { width: 1536, height: 1024 },
  };
  return dimMap[ratio] || { width: 1024, height: 1365 };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, ratio = "9:16", model = "image2", refImgs, refImageUrl, refImageKey, refImageContentType } = body;

    console.log("Generate API received:", {
      hasPrompt: !!prompt,
      ratio,
      model,
      hasRefImgs: !!(refImgs && Array.isArray(refImgs) && refImgs.length > 0),
      hasRefImageUrl: !!refImageUrl,
      hasRefImageKey: !!refImageKey,
      hasRefImageContentType: !!refImageContentType,
    });

    if (!prompt) {
      return new Response(JSON.stringify({ error: "请输入提示词" }), { status: 400 });
    }

    const modelConfig = MODEL_CONFIG[model];
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: `Unknown model: ${model}` }), { status: 400 });
    }

    // Build request body according to GrsAI API docs
    const requestBody: Record<string, unknown> = {
      model: modelConfig.apiModel,
      prompt: prompt,
      aspectRatio: ratio,
      shutProgress: false,
    };

    // Handle reference images (urls)
    let urls: string[] | undefined;

    if (refImgs && Array.isArray(refImgs) && refImgs.length > 0) {
      urls = refImgs.filter((url: string) => url && url.length > 0);
    } else if (refImageKey) {
      // S3 key - get permanent signed URL
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
      requestBody.urls = urls;
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

    const url = `${GRSAI_BASE_URL}${modelConfig.endpoint}`;

    // Use SSE streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function sendSSE(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          sendSSE({ type: "progress", progress: 0, status: "submitted" });

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
                  sendSSE({ type: "progress", progress: data.progress, status: data.status || "running" });
                }

                // Capture final result
                if (data.status === "succeeded" && data.results) {
                  imageUrl = data.results[0]?.url || data.url || "";
                }

                if (data.status === "failed") {
                  const rawReason = data.failure_reason || data.error || "";
                  const friendlyErrors: Record<string, string> = {
                    output_moderation: "生成内容违规，请修改提示词后重试",
                    input_moderation: "输入内容违规，请修改提示词后重试",
                    error: "生成失败，请重试",
                  };
                  const reason = friendlyErrors[rawReason] || rawReason || "生成失败，请重试";
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
            sendSSE({ type: "error", error: "未获取到图片，请重试" });
            controller.close();
            return;
          }

          sendSSE({ type: "progress", progress: 95, status: "uploading" });

          // Upload to S3
          const key = await storage.uploadFromUrl({
            url: imageUrl,
            timeout: 120000,
          });

          const { width, height } = estimateDimensions(ratio);
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
          sendSSE({ type: "complete", data: { ...newImage, url: signedUrl, taskId } });
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
