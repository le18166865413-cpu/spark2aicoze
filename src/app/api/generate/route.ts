import { NextRequest, NextResponse } from "next/server";
import { ImageGenerationClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { S3Storage } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// Size mapping from ratio to pixel dimensions
function ratioToSize(ratio: string): string {
  const base = 2048;
  const ratioMap: Record<string, [number, number]> = {
    "1:1": [base, base],
    "3:4": [Math.round(base * 0.75), base],
    "4:3": [base, Math.round(base * 0.75)],
    "9:16": [Math.round(base * 9 / 16), base],
    "16:9": [base, Math.round(base * 9 / 16)],
    "2:3": [Math.round(base * 2 / 3), base],
    "21:9": [base, Math.round(base * 9 / 21)],
    "A4": [Math.round(base * 210 / 297), base],
  };

  const [w, h] = ratioMap[ratio] || ratioMap["9:16"];
  return `${w}x${h}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { prompt, ratio = "9:16", model: selectedModel, refImageUrl, refImageKey, refImageContentType } = body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "请输入海报描述" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Step 1: Submit generation task
        sendEvent({ type: "progress", progress: 10, status: "submitted" });

        const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
        const config = new Config();
        const client = new ImageGenerationClient(config, customHeaders);

        // Build generation request
        const generateRequest: Record<string, unknown> = {
          prompt: prompt.trim(),
          size: ratioToSize(ratio),
          watermark: false,
          responseFormat: "url",
        };

        // Set model
        if (selectedModel === "image2-vip") {
          generateRequest.model = "doubao-seedream-5-0-260128";
        } else if (selectedModel === "nano-banana-fast") {
          generateRequest.model = "doubao-seedream-4-5-251128";
        }

        // Handle reference image for img2img
        if (refImageKey) {
          // It's an S3 key, need to generate a presigned URL first
          const storage = new S3Storage({
            endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
            accessKey: "",
            secretKey: "",
            bucketName: process.env.COZE_BUCKET_NAME,
            region: "cn-beijing",
          });
          const presignedUrl = await storage.generatePresignedUrl({
            key: refImageKey,
            expireTime: 3600,
          });
          generateRequest.image = presignedUrl;
        } else if (refImageUrl) {
          generateRequest.image = refImageUrl;
        }

        sendEvent({ type: "progress", progress: 30, status: "running" });

        // Generate image
        const response = await client.generate(generateRequest as unknown as Parameters<typeof client.generate>[0]);
        const helper = client.getResponseHelper(response);

        if (!helper.success) {
          throw new Error(helper.errorMessages.join(", ") || "Image generation failed");
        }

        const imageUrl = helper.imageUrls[0];
        if (!imageUrl) {
          throw new Error("No image URL returned");
        }

        sendEvent({ type: "progress", progress: 70, status: "uploading" });

        // Upload to S3 for persistent storage
        const storage = new S3Storage({
          endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
          accessKey: "",
          secretKey: "",
          bucketName: process.env.COZE_BUCKET_NAME,
          region: "cn-beijing",
        });

        const imageKey = await storage.uploadFromUrl({
          url: imageUrl,
          timeout: 60000,
        });

        // Generate presigned URL for access
        const presignedUrl = await storage.generatePresignedUrl({
          key: imageKey,
          expireTime: 86400 * 30, // 30 days
        });

        sendEvent({ type: "progress", progress: 85, status: "saving" });

        // Parse ratio for width/height
        let width = 9;
        let height = 16;
        if (ratio === "1:1") { width = 1; height = 1; }
        else if (ratio === "3:4") { width = 3; height = 4; }
        else if (ratio === "4:3") { width = 4; height = 3; }
        else if (ratio === "9:16") { width = 9; height = 16; }
        else if (ratio === "16:9") { width = 16; height = 9; }
        else if (ratio === "2:3") { width = 2; height = 3; }
        else if (ratio === "21:9") { width = 21; height = 9; }
        else if (ratio === "A4") { width = 210; height = 297; }

        // Save to database
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("gallery_images")
          .insert({
            prompt: prompt.trim(),
            url: presignedUrl,
            image_key: imageKey,
            width,
            height,
            views: 0,
            downloads: 0,
            model: selectedModel || "image2",
            ratio,
          })
          .select()
          .single();

        if (error) {
          console.error("Database insert error:", error);
        }

        sendEvent({
          type: "complete",
          data: {
            id: data?.id || "unknown",
            url: presignedUrl,
            imageKey,
            prompt: prompt.trim(),
            width,
            height,
          },
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Generation failed";
        console.error("Generate error:", msg);
        sendEvent({ type: "error", error: msg });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
}
