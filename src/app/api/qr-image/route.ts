import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/utils/storage";

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    // Try sign-url endpoint first
    const token = process.env.COZE_WORKLOAD_IDENTITY_API_KEY || "";
    const endpoint = process.env.COZE_BUCKET_ENDPOINT_URL || "";
    const bucketName = process.env.COZE_BUCKET_NAME || "";

    try {
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

      if (response.ok) {
        const result = await response.json();
        if (result.code === 0 && result.data?.url) {
          return NextResponse.redirect(result.data.url);
        }
      }
    } catch {
      // Fallback to presigned URL
    }

    // Fallback: generate presigned URL
    const presignedUrl = await storage.generatePresignedUrl({ key, expireTime: 86400 });
    return NextResponse.redirect(presignedUrl);
  } catch (error: unknown) {
    console.error("QR image URL error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
