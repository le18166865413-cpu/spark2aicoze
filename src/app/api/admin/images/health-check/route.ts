import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { verifyAdmin } from "@/lib/admin-auth";

const BATCH_SIZE = 20;

interface GalleryImage {
  id: string;
  url: string;
  image_key: string | null;
  prompt: string | null;
  task_id: string | null;
  created_at: string;
}

interface HealthResult {
  id: string;
  prompt: string | null;
  taskId: string | null;
  exists: boolean;
  status: number;
  reason: string;
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth) {
    return NextResponse.json({ error: "无管理员权限" }, { status: 401 });
  }

  const { page = 1, pageSize = BATCH_SIZE, ids } = await req.json().catch(() => ({}));

  const supabase = getSupabaseClient();

  let query = supabase
    .from("gallery_images")
    .select("id, url, image_key, prompt, task_id, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (Array.isArray(ids) && ids.length > 0) {
    query = query.in("id", ids);
  } else {
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);
  }

  const { data: images, error } = await query;

  if (error) {
    return NextResponse.json({ error: "查询失败: " + error.message }, { status: 500 });
  }

  if (!images || images.length === 0) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const results: HealthResult[] = await Promise.all(
    (images as GalleryImage[]).map(async (img) => {
      if (!img.image_key) {
        return {
          id: img.id,
          prompt: img.prompt,
          taskId: img.task_id,
          exists: false,
          status: 0,
          reason: "无 image_key",
        };
      }

      try {
        const response = await fetch(img.url, { method: "HEAD", redirect: "follow" });
        const exists = response.status === 200;
        return {
          id: img.id,
          prompt: img.prompt,
          taskId: img.task_id,
          exists,
          status: response.status,
          reason: exists ? "正常" : `HTTP ${response.status}`,
        };
      } catch (err) {
        return {
          id: img.id,
          prompt: img.prompt,
          taskId: img.task_id,
          exists: false,
          status: 0,
          reason: err instanceof Error ? err.message : "请求失败",
        };
      }
    })
  );

  return NextResponse.json({
    results,
    total: results.length,
    brokenCount: results.filter((r: HealthResult) => !r.exists).length,
  });
}
