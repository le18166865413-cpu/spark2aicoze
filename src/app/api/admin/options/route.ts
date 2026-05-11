import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { verifyAdmin } from "@/lib/admin-auth";

// GET /api/admin/options - list all options (admin only)
export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("generate_options")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("[admin/options] query error:", error);
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[admin/options] error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST /api/admin/options - create new option
export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { category, label, value, description, sort_order, is_visible } = body;

    if (!category || !label) {
      return NextResponse.json(
        { error: "分类和标签名称不能为空" },
        { status: 400 }
      );
    }

    const validCategories = ["scene", "usage", "style", "color", "ratio", "model"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "无效的分类" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("generate_options")
      .insert({
        category,
        label,
        value: value || null,
        description: description || null,
        sort_order: sort_order ?? 0,
        is_visible: is_visible !== false,
      })
      .select()
      .single();

    if (error) {
      console.error("[admin/options] insert error:", error);
      return NextResponse.json({ error: "创建失败" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[admin/options] error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// PUT /api/admin/options - batch update (sort_order / is_visible)
export async function PUT(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();

    // Batch update sort orders
    if (body.updates && Array.isArray(body.updates)) {
      const supabase = getSupabaseClient();
      const results = [];
      for (const item of body.updates) {
        const { id, ...fields } = item;
        const { data, error } = await supabase
          .from("generate_options")
          .update(fields)
          .eq("id", id)
          .select()
          .single();
        if (error) {
          console.error("[admin/options] batch update error:", error);
          continue;
        }
        results.push(data);
      }
      return NextResponse.json({ data: results });
    }

    // Single item update
    const { id, category, label, value, description, sort_order, is_visible } = body;
    if (!id) {
      return NextResponse.json({ error: "缺少 ID" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (category !== undefined) updateData.category = category;
    if (label !== undefined) updateData.label = label;
    if (value !== undefined) updateData.value = value;
    if (description !== undefined) updateData.description = description;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (is_visible !== undefined) updateData.is_visible = is_visible;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("generate_options")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[admin/options] update error:", error);
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[admin/options] error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// DELETE /api/admin/options/:id
export async function DELETE(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少 ID" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("generate_options")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[admin/options] delete error:", error);
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/options] error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
