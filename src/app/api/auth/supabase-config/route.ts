import { NextResponse } from "next/server";

/**
 * Supabase Auth 配置注入 API
 * 前端登录页通过此接口获取 Supabase URL 和 Anon Key
 */
export async function GET() {
  const supabaseUrl = process.env.COZE_SUPABASE_URL;
  const supabaseAnonKey = process.env.COZE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    supabaseUrl,
    supabaseAnonKey,
  });
}
