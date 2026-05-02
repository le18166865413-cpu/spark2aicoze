import { NextResponse } from 'next/server';

// POST - 登录 (已禁用，直接返回成功
export async function POST(request: Request) {
  return NextResponse.json({ success: true, token: 'bypassed' });
}

// GET - 检查认证状态 (已禁用，直接返回已认证)
export async function GET(request: Request) {
  return NextResponse.json({ authenticated: true });
}

// DELETE - 登出 (已禁用，直接返回成功)
export async function DELETE(request: Request) {
  return NextResponse.json({ success: true });
}
