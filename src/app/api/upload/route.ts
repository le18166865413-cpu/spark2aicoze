import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName: `uploads/${Date.now()}_${file.name}`,
      contentType: file.type,
    });

    // Generate presigned URL for access
    const url = await storage.generatePresignedUrl({
      key,
      expireTime: 3600, // 1 hour for reference image upload
    });

    return NextResponse.json({
      key,
      url,
      contentType: file.type,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    console.error("POST /api/upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
