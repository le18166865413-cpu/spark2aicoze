import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/utils/storage";
import fs from "fs/promises";
import path from "path";

const GRSAI_API_KEY = process.env.GRSAI_API_KEY || "sk-013abb01b9f44e1ca4f72b81e6d91f60";
const GRSAI_BASE_URL = process.env.GRSAI_BASE_URL || "https://grsai.dakka.com.cn";
const DATA_FILE = path.join(process.cwd(), "data", "gallery.json");

interface GalleryImage {
  id: string;
  imageKey: string;
  prompt: string;
  width: number;
  height: number;
  views: number;
  downloads: number;
  type: string;
  taskId: string;
  createdAt: string;
  url?: string;
}

// Ensure data directory exists
async function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
}

// Load gallery data from JSON file
async function loadGallery(): Promise<GalleryImage[]> {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Save gallery data to JSON file
async function saveGallery(images: GalleryImage[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(images, null, 2), "utf-8");
}

// Generate UUID
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * POST /api/sync
 * 通过 GrsAI 任务 ID 同步图片到海报广场
 *
 * Body: { taskId: string, prompt?: string, width?: number, height?: number }
 */
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }
    const taskId = body.taskId as string;
    const prompt = body.prompt as string | undefined;
    const width = (body.width as number) || 1024;
    const height = (body.height as number) || 1365;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    // Load existing gallery
    const gallery = await loadGallery();

    // Check if already synced
    const existing = gallery.find((img) => img.taskId === taskId && taskId !== "");
    if (existing) {
      // Generate signed URL for existing image
      const signedUrl = await storage
        .generatePresignedUrl({ key: existing.imageKey, expireTime: 2592000 })
        .catch(() => existing.imageKey);
      return NextResponse.json({
        message: "Already synced",
        image: { ...existing, url: signedUrl },
      });
    }

    console.log(`Syncing task ${taskId} from GrsAI...`);

    // Query GrsAI for task result
    const response = await fetch(`${GRSAI_BASE_URL}/v1/draw/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GRSAI_API_KEY}`,
      },
      body: JSON.stringify({ id: taskId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `GrsAI API error: ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (result.code !== 0) {
      return NextResponse.json(
        {
          error: result.msg || "Failed to get task result",
          code: result.code,
        },
        { status: 400 }
      );
    }

    const data = result.data;

    if (data.status !== "succeeded") {
      return NextResponse.json(
        {
          error: `Task not succeeded: ${data.status}`,
          failureReason: data.failure_reason || data.error,
        },
        { status: 400 }
      );
    }

    const imageUrl = data.results?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: "No image URL in result" }, { status: 400 });
    }

    // Get actual dimensions from GrsAI response
    const actualWidth = data.results?.[0]?.width || width;
    const actualHeight = data.results?.[0]?.height || height;

    // Upload to S3 storage
    console.log(`Uploading image to S3: ${imageUrl}`);
    const key = await storage.uploadFromUrl({
      url: imageUrl,
      timeout: 120000,
    });

    // Create new image entry
    const newImage: GalleryImage = {
      id: generateId(),
      imageKey: key,
      prompt: prompt || "GrsAI synced image",
      width: actualWidth,
      height: actualHeight,
      views: 0,
      downloads: 0,
      type: "generated",
      taskId: taskId,
      createdAt: new Date().toISOString(),
    };

    // Save to gallery
    gallery.unshift(newImage); // Add to beginning (newest first)
    await saveGallery(gallery);

    const signedUrl = await storage.generatePresignedUrl({ key, expireTime: 2592000 });

    return NextResponse.json({
      message: "Synced successfully",
      image: { ...newImage, url: signedUrl },
    });
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/sync
 * 获取已同步的图片列表
 */
export async function GET() {
  try {
    const gallery = await loadGallery();

    // Generate signed URLs for all images
    const imagesWithUrls = await Promise.all(
      gallery.map(async (img) => {
        try {
          const signedUrl = await storage.generatePresignedUrl({ key: img.imageKey, expireTime: 3600 });
          return { ...img, url: signedUrl };
        } catch {
          return { ...img, url: img.imageKey };
        }
      })
    );

    return NextResponse.json(imagesWithUrls);
  } catch (error: unknown) {
    console.error("Get gallery error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
