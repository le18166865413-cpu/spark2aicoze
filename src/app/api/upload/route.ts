import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/utils/storage";
import fs from "fs/promises";
import path from "path";

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
}

// Generate UUID
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Load gallery data
async function loadGallery(): Promise<GalleryImage[]> {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Save gallery data
async function saveGallery(images: GalleryImage[]): Promise<void> {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(images, null, 2), "utf-8");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const prompt = (formData.get("prompt") as string) || "Uploaded Image";
    const widthStr = formData.get("width") as string | null;
    const heightStr = formData.get("height") as string | null;
    const forGrsai = formData.get("forGrsai") === "true"; // Flag for GrsAI reference image

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName: file.name,
      contentType: file.type,
    });

    // If this is for GrsAI, return the key directly (not signed URL)
    // The generate API will handle fetching the image content
    if (forGrsai) {
      return NextResponse.json({
        key: key,
        type: file.type,
      });
    }

    // Regular upload - save to gallery
    const newImage: GalleryImage = {
      id: generateId(),
      imageKey: key,
      prompt: prompt,
      width: parseInt(widthStr || "0"),
      height: parseInt(heightStr || "0"),
      views: 0,
      downloads: 0,
      type: "uploaded",
      taskId: "",
      createdAt: new Date().toISOString(),
    };

    const gallery = await loadGallery();
    gallery.unshift(newImage);
    await saveGallery(gallery);

    const signedUrl = await storage.generatePresignedUrl({ key, expireTime: 2592000 });

    return NextResponse.json({ ...newImage, url: signedUrl });
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
