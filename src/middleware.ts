import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 只保护 /admin 路由（排除 /admin/login 和 /admin/api）
  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !pathname.startsWith('/admin/api')) {
    const sessionCookie = request.cookies.get('admin_session');
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
