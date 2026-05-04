import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

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

    const data = await response.json();
    if (data.code !== 0 || !data.data?.url) {
      throw new Error(`Sign URL error: ${data.msg || "unknown error"}`);
    }

    return data.data.url;
  } catch (error) {
    console.error("Failed to get signed URL for key:", key, error);
    return key; // Fallback to raw key
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sortBy") || "created_at";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const period = searchParams.get("period") as string | null;
  const search = searchParams.get("search") || undefined;

  try {
    const supabase = getSupabaseClient();

    // Build query
    let query = supabase.from("gallery_images").select("*");

    // Filter by search
    if (search) {
      query = query.ilike("prompt", `%${search}%`);
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
      query = query.gte("created_at", cutoff.toISOString());
    }

    // Sort: liked items first, then by the selected sort column
    const sortColumn = sortBy === "views" ? "views" : sortBy === "downloads" ? "downloads" : "created_at";
    const ascending = sortOrder === "asc";
    query = query.order("liked", { ascending: false, nullsFirst: false });
    query = query.order(sortColumn, { ascending });

    // Limit
    query = query.limit(50);

    const { data: images, error } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: "Failed to load images" }, { status: 500 });
    }

    if (!images || images.length === 0) {
      return NextResponse.json([]);
    }

    // Generate signed URLs for all images
    const imagesWithUrls = await Promise.all(
      images.map(async (img: Record<string, unknown>) => {
        const imageKey = img.image_key as string;
        let url = img.url as string;

        // If we have an S3 key, get a signed URL
        if (imageKey) {
          try {
            url = await getSignedUrl(imageKey);
          } catch {
            url = imageKey;
          }
        }

        return {
          id: img.id,
          imageKey: imageKey,
          prompt: img.prompt,
          url: url,
          width: img.width,
          height: img.height,
          views: img.views || 0,
          downloads: img.downloads || 0,
          liked: img.liked || false,
          model: img.model,
          ratio: img.ratio,
          taskId: img.task_id,
          createdAt: img.created_at,
        };
      })
    );

    return NextResponse.json(imagesWithUrls);
  } catch (error) {
    console.error("Images API error:", error);
    return NextResponse.json({ error: "Failed to load images" }, { status: 500 });
  }
}
