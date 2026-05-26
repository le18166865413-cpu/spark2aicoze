import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/admin-auth";

// Precise pixel dimensions for image2-vip (which requires pixel values)
function estimateDimensions(ratio: string): { width: number; height: number } {
  const dimMap: Record<string, { width: number; height: number }> = {
    "auto": { width: 1024, height: 1024 },
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
    "1:4": { width: 512, height: 2048 },
    "4:1": { width: 2048, height: 512 },
    "1:8": { width: 256, height: 2048 },
    "8:1": { width: 2048, height: 256 },
  };
  return dimMap[ratio] || dimMap["auto"];
}

/**
 * POST /api/v1/generate
 *
 * Enterprise WeChat Bot / external API for image generation.
 * Uses Bearer Token (API Token from admin_settings) for authentication.
 * Synchronously returns the generated image URL.
 *
 * Request:
 *   Headers: Authorization: Bearer <api_token>
 *   Body: {
 *     prompt: string,          // Required. The text prompt
 *     ratio?: string,          // Optional. Default "auto". e.g. "1:1", "3:4", "16:9"
 *     model?: string,          // Optional. Default "image2". e.g. "image2-vip", "image2", "nano-banana-fast"
 *     count?: number,          // Optional. Default 1, max 4
 *     refImageUrl?: string,    // Optional. Reference image URL for img2img
 *   }
 *
 * Response:
 *   { success: boolean, results: [{ success, data?, error? }] }
 */

const MODEL_CONFIG: Record<string, { apiModel: string; supportsImageSize: boolean; usePixelSize: boolean }> = {
  "image2-vip": { apiModel: "image2-vip", supportsImageSize: true, usePixelSize: true },
  "image2": { apiModel: "image2", supportsImageSize: true, usePixelSize: false },
  "nano-banana-fast": { apiModel: "nano-banana-fast", supportsImageSize: false, usePixelSize: false },
  "nano-banana-2": { apiModel: "nano-banana-2", supportsImageSize: false, usePixelSize: false },
  "nano-banana-pro-vip": { apiModel: "nano-banana-pro-vip", supportsImageSize: true, usePixelSize: false },
};

const GRSAI_BASE_URL = "https://grsai.dakka.com.cn";

async function getGrsaiApiKey(): Promise<string> {
  const { getSupabaseClient } = await import("@/storage/database/supabase-client");
  const supabase = getSupabaseClient();
  const { data } = await supabase.from("admin_settings").select("value").eq("key", "grsai_api_key").single();
  return data?.value || process.env.GRSAI_API_KEY || "";
}

function parseStreamLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":")) return null;
  if (trimmed.startsWith("data:")) {
    const jsonStr = trimmed.slice(5).trim();
    if (jsonStr === "[DONE]") return null;
    try { return JSON.parse(jsonStr); } catch { return null; }
  }
  try { return JSON.parse(trimmed); } catch { return null; }
}

function translateGrsaiError(error: string): string {
  const errorMap: Record<string, string> = {
    content_violation: "内容违规",
    rate_limit_exceeded: "请求频率超限，请稍后重试",
    model_overloaded: "模型繁忙，请稍后重试",
    invalid_api_key: "API 密钥无效",
    insufficient_quota: "配额不足",
    timeout: "生成超时，请重试",
  };
  return errorMap[error] || error;
}

async function callGrsaiAndGetResult(
  apiUrl: string,
  requestBody: Record<string, unknown>,
  apiKey: string
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
    } catch { /* ignore */ }
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("服务响应异常");

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

      if (result.id && !taskId) taskId = result.id as string;

      if (result.status === "succeeded" && result.results) {
        const results = result.results as Array<{ url?: string }>;
        imageUrl = results[0]?.url || (result.url as string) || "";
      }

      if (["failed", "violation", "error"].includes(result.status as string) || result.error) {
        if (result.error && typeof result.error === "string") {
          lastError = translateGrsaiError(result.error);
        } else if (result.failure_reason && typeof result.failure_reason === "string") {
          lastError = translateGrsaiError(result.failure_reason as string);
        } else if (result.status === "violation") {
          lastError = "生成内容违规，请修改提示词后重试";
        } else {
          lastError = "生成失败，请重试";
        }
      }
    }
  }

  if (buffer.trim()) {
    const result = parseStreamLine(buffer);
    if (result) {
      if (result.id && !taskId) taskId = result.id as string;
      if (result.status === "succeeded" && result.results) {
        const results = result.results as Array<{ url?: string }>;
        imageUrl = results[0]?.url || (result.url as string) || "";
      }
    }
  }

  if (!imageUrl) throw new Error(lastError || "生成失败，未获取到图片结果");

  return { imageUrl, taskId };
}

export async function POST(request: NextRequest) {
  try {
    // Verify API token using the same method as /api/v1/images
    const apiTokenInfo = await verifyApiToken(request);
    if (!apiTokenInfo) {
      return NextResponse.json({ error: "认证失败，请检查 API Token" }, { status: 401 });
    }

    const body = await request.json();
    const {
      prompt,
      ratio = "auto",
      model = "image2",
      count = 1,
      refImageUrl,
    } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "请输入提示词 (prompt)" }, { status: 400 });
    }

    const imageCount = Math.min(Math.max(Number(count) || 1, 1), 4);
    const modelConfig = MODEL_CONFIG[model];

    if (!modelConfig) {
      return NextResponse.json({
        error: `不支持的模型: ${model}，可选: ${Object.keys(MODEL_CONFIG).join(", ")}`,
      }, { status: 400 });
    }

    // Build GrsAI request
    const dims = estimateDimensions(ratio);
    const requestBody: Record<string, unknown> = {
      model: modelConfig.apiModel,
      prompt,
      replyType: "stream",
      shutProgress: false,
    };

    // image2-vip requires pixel value in aspectRatio field (e.g. "1024x768") instead of ratio string
    if (modelConfig.usePixelSize) {
      // Validate: gpt-image-2 has max aspect ratio 3:1
      const maxRatio = Math.max(dims.width / dims.height, dims.height / dims.width);
      if (maxRatio > 3) {
        return NextResponse.json({ error: `image2-vip 模型不支持 ${ratio} 比例（长宽比不能超过3:1），请选择其他比例` }, { status: 400 });
      }
      requestBody.aspectRatio = `${dims.width}x${dims.height}`;
    } else {
      requestBody.aspectRatio = ratio;
    }

    if (refImageUrl && typeof refImageUrl === "string") {
      requestBody.images = [refImageUrl];
    }

    const grsaiApiKey = await getGrsaiApiKey();
    if (!grsaiApiKey) {
      return NextResponse.json({ error: "服务端未配置 GrsAI API Key" }, { status: 500 });
    }

    const url = `${GRSAI_BASE_URL}/v1/api/generate`;
    const results: Array<{
      success: boolean;
      data?: { id: string; url: string; taskId: string; prompt: string; model: string; ratio: string };
      error?: string;
    }> = [];

    for (let i = 0; i < imageCount; i++) {
      try {
        const { imageUrl, taskId } = await callGrsaiAndGetResult(url, requestBody, grsaiApiKey);
        results.push({
          success: true,
          data: {
            id: taskId,
            url: imageUrl,
            taskId,
            prompt,
            model,
            ratio,
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "生成失败";
        results.push({ success: false, error: msg });
      }
    }

    const allSuccess = results.every((r) => r.success);
    return NextResponse.json(
      { success: allSuccess, results },
      { status: allSuccess ? 200 : 207 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "服务器内部错误";
    console.error("V1 generate error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: Return API usage documentation
export async function GET() {
  return NextResponse.json({
    name: "SparkAI Image Generation API",
    version: "v1",
    endpoint: "POST /api/v1/generate",
    auth: "Bearer Token（在后台「API 令牌」页面创建获取）",
    request: {
      prompt: "string (必填) - 提示词",
      ratio: "string (可选) - 图片比例，默认 auto。可选: auto, 1:1, 3:4, 4:3, 16:9, 9:16, 2:3, 3:2, 1:2, 2:1",
      model: "string (可选) - 模型，默认 image2。可选: image2-vip, image2, nano-banana-fast, nano-banana-2, nano-banana-pro-vip",
      count: "number (可选) - 生成数量，默认 1，最大 4",
      refImageUrl: "string (可选) - 参考图 URL（图生图模式）",
    },
    response: {
      success: "boolean - 是否全部成功",
      results: [
        {
          success: "boolean",
          data: {
            id: "string - 图片 ID",
            url: "string - 图片 URL",
            taskId: "string - GrsAI 任务 ID",
            prompt: "string - 提示词",
            model: "string - 使用的模型",
            ratio: "string - 图片比例",
          },
          error: "string (失败时) - 错误信息",
        },
      ],
    },
    wechatBotExample: {
      description: "企业微信机器人调用示例",
      curl: 'curl -X POST https://your-domain/api/v1/generate -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d \'{"prompt":"一只可爱的猫咪","ratio":"1:1","model":"image2"}\'',
    },
  });
}
