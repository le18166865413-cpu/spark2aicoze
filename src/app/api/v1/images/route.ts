import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { verifyApiToken } from "@/lib/admin-auth";

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
        expire_time: 0,
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
    return key;
  }
}

/**
 * Open API: Get gallery images list
 * Auth: Bearer Token (API Token) or Cookie Session
 */
export async function GET(request: NextRequest) {
  // Verify API Token first, fallback to session
  const apiToken = await verifyApiToken(request);

  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sortBy") || "created_at";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const period = searchParams.get("period") as string | null;
  const search = searchParams.get("search") || undefined;
  const userId = searchParams.get("userId") || undefined;
  const page = Math.max(Number(searchParams.get("page")) || 1, 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize")) || 50, 1), 100);

  try {
    const supabase = getSupabaseClient();

    // Build query (exclude soft-deleted and hidden)
    let query = supabase
      .from("gallery_images")
      .select("*, users!gallery_images_user_id_fkey(nickname, username)", { count: "exact" })
      .is("deleted_at", null)
      .eq("is_hidden", false);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (search) {
      query = query.ilike("prompt", `%${search}%`);
    }

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

    // Sort: pinned first, then by selected column
    query = query.order("is_pinned", { ascending: false });
    const sortColumn = sortBy === "views" ? "views" : sortBy === "downloads" ? "downloads" : sortBy === "likes" ? "likes" : "created_at";
    query = query.order(sortColumn, { ascending: sortOrder === "asc" });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: images, error, count } = await query;

    if (error) {
      console.error("Open API images query error:", error);
      return NextResponse.json({ error: "Failed to load images" }, { status: 500 });
    }

    if (!images || images.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, pageSize, total: count || 0, totalPages: 0 },
      });
    }

    const imagesWithUrls = await Promise.all(
      images.map(async (img: Record<string, unknown>) => {
        const imageKey = img.image_key as string;
        let url = img.url as string;

        if (imageKey) {
          try {
            url = await getSignedUrl(imageKey);
          } catch {
            url = imageKey;
          }
        }

        const userInfo = img.users as Record<string, unknown> | null;
        const creatorName = (img.creator_name as string) || (userInfo?.nickname as string) || (userInfo?.username as string) || "系统导入";

        return {
          id: img.id,
          prompt: img.prompt,
          url: url,
          width: img.width,
          height: img.height,
          views: img.views || 0,
          downloads: img.downloads || 0,
          likes: img.likes || 0,
          referenceCount: img.reference_count || 0,
          model: img.model,
          ratio: img.ratio,
          creatorName: creatorName,
          createdAt: img.created_at,
          isPinned: img.is_pinned || false,
        };
      })
    );

    return NextResponse.json({
      data: imagesWithUrls,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Open API images error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
