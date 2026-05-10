import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/utils/storage";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, startDate, endDate } = body;

    if (!action) {
      return NextResponse.json({ error: "缺少 action 参数" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Action 1: 一键修复匿名创作者
    if (action === "fixAnonymousCreators") {
      const { data, error } = await supabase
        .from("gallery_images")
        .update({ creator_name: "系统导入" })
        .is("creator_name", null);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { count } = await supabase
        .from("gallery_images")
        .select("*", { count: "exact", head: true })
        .eq("creator_name", "系统导入");

      return NextResponse.json({
        success: true,
        message: `已将 ${count || 0} 条匿名创作者记录修复为「系统导入」`,
        fixedCount: count || 0,
      });
    }

    // Action 2: 一键清除指定时间段的作品和存储，并顺手清理 S3 孤儿文件
    if (action === "clearStorage") {
      const start = startDate ? new Date(startDate).toISOString() : "1970-01-01T00:00:00Z";
      const end = endDate ? new Date(endDate).toISOString() : new Date().toISOString();

      // 查询需要删除的作品列表
      const { data: images, error: queryError } = await supabase
        .from("gallery_images")
        .select("id, image_key")
        .gte("created_at", start)
        .lte("created_at", end);

      if (queryError) {
        return NextResponse.json({ error: queryError.message }, { status: 500 });
      }

      const total = images?.length || 0;
      let deletedStorage = 0;
      let failedStorage = 0;

      // 删除 S3 存储中的图片文件
      if (images && images.length > 0) {
        for (const img of images) {
          const imageKey = img.image_key as string;
          if (imageKey) {
            try {
              await storage.deleteFile({ fileKey: imageKey });
              deletedStorage++;
            } catch {
              failedStorage++;
            }
          }
        }

        // 删除数据库记录
        const { error: deleteError } = await supabase
          .from("gallery_images")
          .delete()
          .gte("created_at", start)
          .lte("created_at", end);

        if (deleteError) {
          return NextResponse.json(
            { error: deleteError.message, deletedStorage, total },
            { status: 500 }
          );
        }
      }

      // 顺手清理 S3 中不在数据库里的孤儿文件
      let orphanDeleted = 0;
      let orphanFailed = 0;

      try {
        // 1. 列出 S3 中所有文件
        const s3Keys: string[] = [];
        let continuationToken: string | undefined;
        do {
          const result = await (storage as unknown as { listFiles(opts: { maxKeys: number; continuationToken?: string }): Promise<{ keys: string[]; isTruncated?: boolean; nextContinuationToken?: string }> }).listFiles({
            maxKeys: 1000,
            continuationToken,
          });
          s3Keys.push(...result.keys);
          continuationToken = result.isTruncated && result.nextContinuationToken ? result.nextContinuationToken : undefined;
        } while (continuationToken);

        // 2. 获取数据库中所有仍存在的 image_key
        const { data: dbImages } = await supabase
          .from("gallery_images")
          .select("image_key");

        const dbKeys = new Set((dbImages || []).map((img) => img.image_key).filter(Boolean));

        // 3. 找出孤儿文件并删除
        for (const key of s3Keys) {
          if (!dbKeys.has(key)) {
            try {
              await storage.deleteFile({ fileKey: key });
              orphanDeleted++;
            } catch {
              orphanFailed++;
            }
          }
        }
      } catch {
        // 孤儿文件清理失败不影响主流程
      }

      return NextResponse.json({
        success: true,
        message:
          `已清除 ${total} 条作品记录，其中 ${deletedStorage} 个存储文件已删除${failedStorage > 0 ? `，${failedStorage} 个文件删除失败` : ""}` +
          `${orphanDeleted > 0 ? `；另外顺手清理了 ${orphanDeleted} 个孤儿文件` : ""}${orphanFailed > 0 ? `，${orphanFailed} 个孤儿文件清理失败` : ""}`,
        total,
        deletedStorage,
        failedStorage,
        orphanDeleted,
        orphanFailed,
      });
    }

    // Action 3: 一键导出 S3 存储内所有图片
    if (action === "exportS3Images") {
      const allKeys: { key: string; url: string }[] = [];
      let continuationToken: string | undefined;

      do {
        const result = await (storage as unknown as { listFiles(opts: { maxKeys: number; continuationToken?: string }): Promise<{ keys: string[]; isTruncated?: boolean; nextContinuationToken?: string }> }).listFiles({
          maxKeys: 1000,
          continuationToken,
        });

        for (const key of result.keys) {
          try {
            const url = await storage.generatePresignedUrl({ key, expireTime: 0 });
            allKeys.push({ key, url });
          } catch {
            // skip files that cannot be signed
          }
        }

        if (result.isTruncated && result.nextContinuationToken) {
          continuationToken = result.nextContinuationToken;
        } else {
          continuationToken = undefined;
        }
      } while (continuationToken);

      return NextResponse.json({
        success: true,
        message: `成功导出 ${allKeys.length} 个 S3 文件`,
        files: allKeys,
        count: allKeys.length,
      });
    }

    return NextResponse.json({ error: "未知的 action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
