import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { verifyAdmin } from "@/lib/admin-auth";
import { randomBytes } from "crypto";

function generateToken(): string {
  return "sk_" + randomBytes(32).toString("hex");
}

// GET: List all API tokens
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("api_tokens")
      .select("id, name, permissions, created_by, created_at, last_used_at, expires_at, users!api_tokens_created_by_fkey(nickname)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tokens: data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: Create a new API token
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, permissions, expiresDays } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const token = generateToken();
    const perms = Array.isArray(permissions) && permissions.length > 0
      ? permissions
      : ["read"];

    const expiresAt = expiresDays && expiresDays > 0
      ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("api_tokens")
      .insert({
        name: name.trim(),
        token,
        permissions: perms,
        created_by: admin.id,
        expires_at: expiresAt,
      })
      .select("id, name, token, permissions, created_at, expires_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, token: data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "创建失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: Delete an API token
export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID 不能为空" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("api_tokens")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
