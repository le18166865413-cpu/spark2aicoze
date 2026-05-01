import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "gallery.json");

// Load gallery data
async function loadGallery(): Promise<GalleryImage[]> {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

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

// Save gallery data
async function saveGallery(images: GalleryImage[]): Promise<void> {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(images, null, 2), "utf-8");
}

/**
 * DELETE /api/images/[id]
 * Delete an image by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Image ID is required" }, { status: 400 });
    }

    const gallery = await loadGallery();
    const imageIndex = gallery.findIndex((img) => img.id === id);

    if (imageIndex === -1) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Remove the image
    gallery.splice(imageIndex, 1);
    await saveGallery(gallery);

    return NextResponse.json({ message: "Image deleted successfully" });
  } catch (error: unknown) {
    console.error("Delete error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
