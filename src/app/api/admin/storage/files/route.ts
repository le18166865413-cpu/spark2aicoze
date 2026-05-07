import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { verifyAdmin } from '@/lib/admin-auth';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { key } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: '缺少文件 key' }, { status: 400 });
    }

    const exists = await storage.fileExists({ fileKey: key });
    if (!exists) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    const ok = await storage.deleteFile({ fileKey: key });
    if (ok) {
      return NextResponse.json({ success: true, message: '文件已删除' });
    } else {
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }
  } catch (error) {
    console.error('Storage delete error:', error);
    return NextResponse.json({ error: '删除文件失败' }, { status: 500 });
  }
}
