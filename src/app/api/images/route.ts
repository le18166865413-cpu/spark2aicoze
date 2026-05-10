import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { cookies } from "next/headers";

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_session')?.value;
  if (!token) return null;

  const { data: session } = await getSupabaseClient()
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('id', token)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) return null;
  return session.user_id;
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
  const userId = searchParams.get("userId") || undefined;
  const favorites = searchParams.get("favorites") === "1";

  try {
    const supabase = getSupabaseClient();
    const currentUserId = await getCurrentUserId();

    let imageIds: string[] | null = null;

    // If favorites mode, get favorited image IDs first
    if (favorites && currentUserId) {
      const { data: favs } = await supabase
        .from('user_favorites')
        .select('image_id')
        .eq('user_id', currentUserId);
      imageIds = (favs || []).map((f: Record<string, unknown>) => f.image_id as string);
      if (imageIds.length === 0) {
        return NextResponse.json([]);
      }
    }

    // Build query (exclude soft-deleted)
    let query = supabase
      .from("gallery_images")
      .select("*, users!gallery_images_user_id_fkey(nickname, username)")
      .is("deleted_at", null);

    // Filter by favorites
    if (imageIds) {
      query = query.in("id", imageIds);
    }

    // Filter by user
    if (userId) {
      query = query.eq("user_id", userId);
    } else if (!favorites) {
      // Public gallery: exclude hidden images
      query = query.eq("is_hidden", false);
    }

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

    // Sort: pinned first, then by selected column
    query = query.order("is_pinned", { ascending: false });
    const sortColumn = sortBy === "views" ? "views" : sortBy === "downloads" ? "downloads" : sortBy === "likes" ? "likes" : "created_at";
    const ascending = sortOrder === "asc";
    query = query.order(sortColumn, { ascending });

    // Limit
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 10), 200);
    query = query.limit(limit);

    const { data: images, error } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: "Failed to load images" }, { status: 500 });
    }

    if (!images || images.length === 0) {
      return NextResponse.json([]);
    }

    // Check if current user has favorited each image
    let userFavorites: Set<string> = new Set();
    if (currentUserId) {
      const { data: favs } = await supabase
        .from('user_favorites')
        .select('image_id')
        .eq('user_id', currentUserId)
        .in('image_id', images.map((img: Record<string, unknown>) => img.id as string));
      userFavorites = new Set((favs || []).map((f: Record<string, unknown>) => f.image_id as string));
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

        const userInfo = img.users as Record<string, unknown> | null;
        const creatorName = (img.creator_name as string) || (userInfo?.nickname as string) || (userInfo?.username as string) || '系统导入';

        return {
          id: img.id,
          imageKey: imageKey,
          prompt: img.prompt,
          url: url,
          width: img.width,
          height: img.height,
          views: img.views || 0,
          downloads: img.downloads || 0,
          likes: img.likes || 0,
          referenceCount: img.reference_count || 0,
          liked: userFavorites.has(img.id as string),
          model: img.model,
          ratio: img.ratio,
          taskId: img.task_id,
          creatorName: creatorName,
          userId: img.user_id || null,
          createdAt: img.created_at,
          isHidden: img.is_hidden || false,
          isPinned: img.is_pinned || false,
        };
      })
    );

    return NextResponse.json(imagesWithUrls);
  } catch (error) {
    console.error("Images API error:", error);
    return NextResponse.json({ error: "Failed to load images" }, { status: 500 });
  }
}
