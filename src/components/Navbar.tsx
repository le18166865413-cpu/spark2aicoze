'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, LayoutGrid, PenTool } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-base font-bold text-foreground">SparkAI</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-6">
            <Link
              href="/"
              className={`text-sm transition-colors ${isActive('/') ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              海报广场
            </Link>
            <Link
              href="/create"
              className={`text-sm transition-colors ${isActive('/create') ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              创作中心
            </Link>
            <Link
              href="/admin"
              className="text-sm px-4 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              管理后台
            </Link>
          </div>

          {/* Mobile Nav - 两个按钮平铺 */}
          <div className="flex sm:hidden items-center gap-2">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isActive('/')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              广场
            </Link>
            <Link
              href="/create"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isActive('/create')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              创作
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
