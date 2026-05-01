import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function POST() {
  try {
    const client = getSupabaseClient();

    // Simple sync endpoint - just return current images count
    const { count, error } = await client
      .from("gallery_images")
      .select("*", { count: "exact", head: true });

    if (error) {
      throw new Error(`Sync failed: ${error.message}`);
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
