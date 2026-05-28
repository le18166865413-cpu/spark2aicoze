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
      // 先查询本次需要修复的数量
      const { count: needFixCount, error: countError } = await supabase
        .from("gallery_images")
        .select("*", { count: "exact", head: true })
        .is("creator_name", null);

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 });
      }

      if (!needFixCount || needFixCount === 0) {
        return NextResponse.json({
          success: true,
          message: "没有需要修复的匿名创作者记录",
          fixedCount: 0,
        });
      }

      const { error } = await supabase
        .from("gallery_images")
        .update({ creator_name: "系统导入" })
        .is("creator_name", null);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `已将 ${needFixCount} 条匿名创作者记录修复为「系统导入」`,
        fixedCount: needFixCount,
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

    // Action 3: 一键导出 S3 存储内所有图片（含完整数据库字段）
    if (action === "exportS3Images") {
      // 查询数据库所有图片记录
      const { data: dbImages, error: queryError } = await supabase
        .from("gallery_images")
        .select("id, prompt, url, image_key, width, height, views, downloads, model, ratio, task_id, created_at, liked, user_id, creator_name, deleted_at, is_hidden, likes, reference_count, is_pinned, reference_image_key")
        .order("created_at", { ascending: true });

      if (queryError) {
        return NextResponse.json({ error: queryError.message }, { status: 500 });
      }

      const records: Record<string, unknown>[] = [];

      for (const img of dbImages || []) {
        const record: Record<string, unknown> = { ...img };

        // 生成主图签名链接
        if (img.image_key) {
          try {
            record.signed_url = await storage.generatePresignedUrl({ key: img.image_key, expireTime: 0 });
          } catch {
            record.signed_url = "";
          }
        }

        // 生成参考图签名链接
        if (img.reference_image_key) {
          try {
            const refKeys = img.reference_image_key.split(",").filter(Boolean);
            const refUrls: string[] = [];
            for (const refKey of refKeys) {
              try {
                const refUrl = await storage.generatePresignedUrl({ key: refKey.trim(), expireTime: 0 });
                refUrls.push(refUrl);
              } catch {
                // skip
              }
            }
            record.reference_image_urls = refUrls;
          } catch {
            record.reference_image_urls = [];
          }
        }

        records.push(record);
      }

      return NextResponse.json({
        success: true,
        message: `成功导出 ${records.length} 条图片记录`,
        records,
        count: records.length,
      });
    }

    // Action 4: 导入图片记录
    if (action === "importImages") {
      const { records: importRecords } = body;
      if (!importRecords || !Array.isArray(importRecords) || importRecords.length === 0) {
        return NextResponse.json({ error: "缺少 records 数据或格式不正确" }, { status: 400 });
      }

      let inserted = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const record of importRecords) {
        try {
          // 检查是否已存在（按 image_key 或 id 去重）
          const checkField = record.image_key ? "image_key" : "id";
          const checkValue = record.image_key || record.id;
          if (!checkValue) {
            skipped++;
            continue;
          }

          const { data: existing } = await supabase
            .from("gallery_images")
            .select("id")
            .eq(checkField, checkValue)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          // 构建插入数据
          const insertData: Record<string, unknown> = {
            id: record.id || crypto.randomUUID(),
            prompt: record.prompt || "",
            url: record.url || "",
            image_key: record.image_key || null,
            width: record.width || null,
            height: record.height || null,
            views: record.views || 0,
            downloads: record.downloads || 0,
            model: record.model || null,
            ratio: record.ratio || null,
            task_id: record.task_id || null,
            creator_name: record.creator_name || "系统导入",
            user_id: record.user_id || null,
            reference_image_key: record.reference_image_key || null,
            liked: record.liked ?? false,
            is_hidden: record.is_hidden ?? false,
            likes: record.likes || 0,
            reference_count: record.reference_count || 0,
            is_pinned: record.is_pinned ?? false,
            created_at: record.created_at || new Date().toISOString(),
          };

          const { error: insertError } = await supabase
            .from("gallery_images")
            .insert(insertData);

          if (insertError) {
            failed++;
            errors.push(`[${record.image_key || record.id}]: ${insertError.message}`);
          } else {
            inserted++;
          }
        } catch (err: unknown) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`[${record.image_key || record.id}]: ${msg}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: `导入完成：新增 ${inserted} 条，跳过 ${skipped} 条（已存在），失败 ${failed} 条`,
        inserted,
        skipped,
        failed,
        errors: errors.slice(0, 20),
      });
    }

    return NextResponse.json({ error: "未知的 action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
