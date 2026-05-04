import { NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

export const dynamic = 'force-dynamic';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

export async function GET() {
  try {
    // Collect all files with pagination
    const allKeys: { key: string; size: number; lastModified?: Date }[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await storage.listFiles({
        maxKeys: 1000,
        continuationToken,
      });

      for (const key of result.keys) {
        allKeys.push({ key, size: 0 });
      }

      if (result.isTruncated && result.nextContinuationToken) {
        continuationToken = result.nextContinuationToken;
      } else {
        continuationToken = undefined;
      }
    } while (continuationToken);

    const totalFiles = allKeys.length;

    // Estimate storage size by checking database records
    // S3 listFiles doesn't return size, so we estimate based on typical poster sizes
    // Average poster image size ~500KB
    const estimatedSizeKB = totalFiles * 500;
    const estimatedSizeMB = Math.round(estimatedSizeKB / 1024 * 100) / 100;

    // Get file type distribution
    const extensions: Record<string, number> = {};
    for (const item of allKeys) {
      const ext = item.key.split('.').pop()?.toLowerCase() || 'unknown';
      extensions[ext] = (extensions[ext] || 0) + 1;
    }

    return NextResponse.json({
      totalFiles,
      estimatedSizeMB,
      extensions,
      files: allKeys.map((f) => f.key),
    });
  } catch (error) {
    console.error('Storage stats error:', error);
    return NextResponse.json(
      { error: '获取存储统计失败' },
      { status: 500 }
    );
  }
}
