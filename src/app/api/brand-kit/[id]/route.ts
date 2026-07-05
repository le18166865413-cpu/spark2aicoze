import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { cookies } from "next/headers";

// 获取当前用户ID
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
  return session.user_id as string;
}

// 获取签名URL
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

// PUT: 更新 Brand Kit 素材
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, content, imageKey, imageUrl } = body;

    const supabase = getSupabaseClient();

    // 先验证素材属于当前用户
    const { data: existing } = await supabase
      .from("brand_kit")
      .select("id, user_id, type")
      .eq("id", parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json({ error: "素材不存在" }, { status: 404 });
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: "无权限修改" }, { status: 403 });
    }

    // 构建更新数据
    const updateData: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };

    if (name) updateData.name = name;
    
    if (existing.type === "text") {
      if (content) updateData.content = content;
    } else if (existing.type === "image") {
      if (imageKey) updateData.image_key = imageKey;
      if (imageUrl) updateData.image_url = imageUrl;
    }

    const { data, error } = await supabase
      .from("brand_kit")
      .update(updateData)
      .eq("id", parseInt(id))
      .select()
      .single();

    if (error) {
      console.error("Failed to update brand kit:", error);
      return NextResponse.json({ error: "更新素材失败" }, { status: 500 });
    }

    // 为图片素材生成签名URL
    if (data.type === "image" && data.image_key) {
      data.image_url = await getSignedUrl(data.image_key);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Brand kit PUT error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// DELETE: 删除 Brand Kit 素材
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;

    const supabase = getSupabaseClient();

    // 先验证素材属于当前用户
    const { data: existing } = await supabase
      .from("brand_kit")
      .select("id, user_id, type, image_key")
      .eq("id", parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json({ error: "素材不存在" }, { status: 404 });
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: "无权限删除" }, { status: 403 });
    }

    // 删除数据库记录
    const { error } = await supabase
      .from("brand_kit")
      .delete()
      .eq("id", parseInt(id));

    if (error) {
      console.error("Failed to delete brand kit:", error);
      return NextResponse.json({ error: "删除素材失败" }, { status: 500 });
    }

    // 如果是图片素材，尝试删除存储文件
    if (existing.type === "image" && existing.image_key) {
      try {
        const token = process.env.COZE_WORKLOAD_IDENTITY_API_KEY || "";
        const endpoint = process.env.COZE_BUCKET_ENDPOINT_URL || "";
        const bucketName = process.env.COZE_BUCKET_NAME || "";

        const deleteEndpoint = endpoint.replace(/\/$/, "") + "/delete";

        await fetch(deleteEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-storage-token": token,
          },
          body: JSON.stringify({
            bucket_name: bucketName,
            paths: [existing.image_key],
          }),
        });
      } catch (deleteError) {
        console.error("Failed to delete image file:", deleteError);
        // 不影响删除结果，仅记录错误
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Brand kit DELETE error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}