import { NextResponse } from "next/server";
import { verifyUser } from "@/lib/admin-auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await verifyUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("gallery_images")
      .select("id, prompt, url, image_key, width, height, views, downloads, model, ratio, task_id, user_id, creator_name, created_at, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) throw error;

    const images = (data || []).map((img: Record<string, unknown>) => ({
      id: img.id,
      prompt: img.prompt,
      url: img.url,
      imageKey: img.image_key,
      width: img.width,
      height: img.height,
      views: img.views,
      downloads: img.downloads,
      model: img.model,
      ratio: img.ratio,
      taskId: img.task_id,
      userId: img.user_id,
      creatorName: img.creator_name,
      createdAt: img.created_at,
      deletedAt: img.deleted_at,
    }));

    return NextResponse.json({ images });
  } catch (err) {
    console.error("Recycle bin GET error:", err);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await verifyUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  }

  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "缺少作品ID" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("gallery_images")
      .update({ deleted_at: null })
      .in("id", ids);

    if (error) throw error;

    return NextResponse.json({ success: true, restored: ids.length });
  } catch (err) {
    console.error("Restore error:", err);
    return NextResponse.json({ error: "恢复失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await verifyUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  }

  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "缺少作品ID" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 获取图片信息（用于后续删除S3文件）
    const { data: images, error: fetchError } = await supabase
      .from("gallery_images")
      .select("image_key")
      .in("id", ids);

    if (fetchError) throw fetchError;

    // 从数据库删除
    const { error } = await supabase
      .from("gallery_images")
      .delete()
      .in("id", ids);

    if (error) throw error;

    // 异步删除 S3 文件（忽略错误）
    if (images && images.length > 0) {
      try {
        const { S3Storage } = await import("coze-coding-dev-sdk");
        const storage = new S3Storage();
        for (const img of images) {
          if (img.image_key) {
            // @ts-expect-error S3Storage delete method may not be in types
            await storage.delete?.(img.image_key).catch(() => {});
          }
        }
      } catch {
        // 忽略 S3 删除错误
      }
    }

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (err) {
    console.error("Permanent delete error:", err);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
