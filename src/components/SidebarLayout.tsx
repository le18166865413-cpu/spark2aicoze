'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, Key, Palette, HardDrive, Upload, Sparkles, X, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const menuItems = [
  { href: '/admin', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/admin/settings', icon: Settings, label: '网站设置' },
  { href: '/admin/api-tokens', icon: Key, label: 'API 令牌' },
  { href: '/admin/theme', icon: Palette, label: '主题配色' },
  { href: '/admin/storage', icon: HardDrive, label: '图片存储' },
  { href: '/admin/import', icon: Upload, label: '任务导入' },
];

export default function SidebarLayout({
  children,
  mobileMenuOpen,
  onMobileMenuChange,
}: {
  children: ReactNode;
  onCollapse?: (collapsed: boolean) => void;
  mobileMenuOpen?: boolean;
  onMobileMenuChange?: (open: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary/15 rounded-lg p-1.5 ring-1 ring-primary/40">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-lg">SparkAI</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← 返回首页
          </Link>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => onMobileMenuChange?.(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={cn(
          'md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border transition-transform duration-200',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary/15 rounded-lg p-1.5 ring-1 ring-primary/40">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold">SparkAI</span>
          </Link>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMobileMenuChange?.(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="space-y-1 p-3">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                onClick={() => onMobileMenuChange?.(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 px-3 py-2">
            ← 返回首页
          </Link>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex h-14 items-center border-b border-border px-3 gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onMobileMenuChange?.(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary/15 rounded-md p-1 ring-1 ring-primary/40">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-bold text-sm">SparkAI</span>
          </Link>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
