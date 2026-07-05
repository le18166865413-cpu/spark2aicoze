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

// GET: 获取用户的 Brand Kit 素材列表
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") as "image" | "text" | null;
    const search = searchParams.get("search");

    const supabase = getSupabaseClient();
    
    let query = supabase
      .from("brand_kit")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // 按类型筛选
    if (type) {
      query = query.eq("type", type);
    }

    // 搜索筛选
    if (search) {
      query = query.or(`name.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch brand kit:", error);
      return NextResponse.json({ error: "获取素材列表失败" }, { status: 500 });
    }

    // 为图片素材生成签名URL
    const processedData = await Promise.all(
      (data || []).map(async (item: Record<string, unknown>) => {
        if (item.type === "image" && item.image_key) {
          const signedUrl = await getSignedUrl(item.image_key as string);
          return { ...item, image_url: signedUrl };
        }
        return item;
      })
    );

    return NextResponse.json(processedData);
  } catch (error) {
    console.error("Brand kit GET error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST: 创建新的 Brand Kit 素材
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, content, imageKey, imageUrl } = body;

    // 验证必填字段
    if (!name || !type) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    if (type !== "image" && type !== "text") {
      return NextResponse.json({ error: "素材类型无效" }, { status: 400 });
    }

    // 图片素材需要 imageKey
    if (type === "image" && !imageKey) {
      return NextResponse.json({ error: "图片素材需要上传图片" }, { status: 400 });
    }

    // 文字素材需要 content
    if (type === "text" && !content) {
      return NextResponse.json({ error: "文字素材需要填写内容" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const insertData = {
      user_id: userId,
      name,
      type,
      content: type === "text" ? content : null,
      image_key: type === "image" ? imageKey : null,
      image_url: type === "image" ? imageUrl : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("brand_kit")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Failed to create brand kit:", error);
      return NextResponse.json({ error: "创建素材失败" }, { status: 500 });
    }

    // 为图片素材生成签名URL
    if (data.type === "image" && data.image_key) {
      data.image_url = await getSignedUrl(data.image_key);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Brand kit POST error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}