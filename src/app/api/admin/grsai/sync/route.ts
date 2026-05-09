import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/admin-auth";
import { runGrsaiSync } from "@/lib/grsai-cron";

export async function POST(request: NextRequest) {
  // Verify admin
  const user = await verifyUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const maxPages = Math.min(body.maxPages || 5, 20); // Default 5 pages, max 20
  const pageSize = body.pageSize || 20;

  const result = await runGrsaiSync(maxPages, pageSize);

  return NextResponse.json({
    success: true,
    ...result,
    lastSyncAt: new Date().toISOString(),
  });
}
