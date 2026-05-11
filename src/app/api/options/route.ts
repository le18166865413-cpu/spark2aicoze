import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("generate_options")
      .select("id, category, label, value, description, sort_order")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("[options] query error:", error);
      // Return empty data so frontend falls back to defaults gracefully
      return NextResponse.json({ data: {} });
    }

    // Group by category
    const grouped: Record<string, Array<{ id: number; label: string; value?: string; description?: string; sort_order: number }>> = {};
    for (const row of data || []) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push({
        id: row.id,
        label: row.label,
        value: row.value || undefined,
        description: row.description || undefined,
        sort_order: row.sort_order,
      });
    }

    return NextResponse.json({ data: grouped });
  } catch (err) {
    console.error("[options] error:", err);
    return NextResponse.json({ data: {} });
  }
}
