import { NextRequest } from 'next/server';

// 共享内存存储
const activeSessions = new Map<string, { username: string; expiresAt: number }>();

// 验证 token
export async function verifyToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// 创建 session
export function createSession(username: string): string {
  const token = Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 8);
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  activeSessions.set(token, { username, expiresAt });
  return token;
}

// 删除 session
export function deleteSession(token: string): void {
  activeSessions.delete(token);
}

// 从 request 中提取 token
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get('token');
}
