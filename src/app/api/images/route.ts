import { NextRequest, NextResponse } from "next/server";
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

// Load gallery data from JSON file
async function loadGallery(): Promise<GalleryImage[]> {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sortBy") as "views" | "downloads" | "created_at" | null;
  const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" | null;
  const period = searchParams.get("period") as string | null;
  const search = searchParams.get("search") || undefined;

  // Load images from JSON file
  let images = await loadGallery();

  // Filter by search
  if (search) {
    images = images.filter((img) => img.prompt.toLowerCase().includes(search.toLowerCase()));
  }

  // Filter by period
  if (period && period !== "all" && ["day", "week", "month"].includes(period)) {
    const now = new Date();
    let cutoff: Date;
    if (period === "day") {
      cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === "week") {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    images = images.filter((img) => new Date(img.createdAt) >= cutoff);
  }

  // Sort
  if (sortBy === "views") {
    images.sort((a, b) => (sortOrder === "asc" ? a.views - b.views : b.views - a.views));
  } else if (sortBy === "downloads") {
    images.sort((a, b) => (sortOrder === "asc" ? a.downloads - b.downloads : b.downloads - a.downloads));
  } else {
    images.sort((a, b) =>
      sortOrder === "asc"
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Limit
  images = images.slice(0, 50);

  // Generate permanent public URLs
  const imagesWithUrls = await Promise.all(
    images.map(async (img) => {
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
            path: img.imageKey,
            expire_time: 0, // Permanent URL
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate URL");
        }

        const data = await response.json();
        return { ...img, url: data.data?.url || img.imageKey };
      } catch {
        return { ...img, url: img.imageKey };
      }
    })
  );

  return NextResponse.json(imagesWithUrls);
}
