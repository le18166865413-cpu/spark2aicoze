import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { S3Storage } from "coze-coding-dev-sdk";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const period = searchParams.get("period") || "all";
    const search = searchParams.get("search") || "";

    const client = getSupabaseClient();

    let query = client
      .from("gallery_images")
      .select("id, prompt, url, image_key, width, height, views, downloads, model, ratio, task_id, created_at")
      .order(sortBy, { ascending: sortOrder === "asc" });

    // Time period filter
    if (period && period !== "all") {
      const now = new Date();
      let since: Date;
      switch (period) {
        case "day":
          since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "week":
          since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          since = new Date(0);
      }
      query = query.gte("created_at", since.toISOString());
    }

    // Search filter
    if (search) {
      query = query.ilike("prompt", `%${search}%`);
    }

    const { data, error } = await query.limit(500);

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    // For images with S3 keys, generate presigned URLs
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });

    const imagesWithUrls = await Promise.all(
      (data || []).map(async (img: Record<string, unknown>) => {
        let url = img.url as string;
        if (img.image_key && !img.url?.toString().includes("x-oss-process")) {
          try {
            url = await storage.generatePresignedUrl({
              key: img.image_key as string,
              expireTime: 86400,
            });
          } catch {
            // Keep original URL if presign fails
          }
        }
        return { ...img, url };
      })
    );

    return NextResponse.json(imagesWithUrls);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch images";
    console.error("GET /api/images error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
