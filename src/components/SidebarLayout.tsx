'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, Key, Palette, HardDrive, Upload, Sparkles, Wand2, Users, LogOut, Trash2, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

const menuItems = [
  { href: '/admin', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/admin/settings', icon: Settings, label: '网站设置' },
  { href: '/admin/api-tokens', icon: Key, label: 'API 令牌' },
  { href: '/admin/theme', icon: Palette, label: '主题配色' },
  { href: '/admin/creation', icon: Wand2, label: '创作配置' },
  { href: '/admin/storage', icon: HardDrive, label: '图片存储' },
  { href: '/admin/import', icon: Upload, label: '任务导入' },
  { href: '/admin/users', icon: Users, label: '用户管理' },
  { href: '/admin/recycle', icon: Trash2, label: '回收站' },
  { href: '/admin/bugfix', icon: Bug, label: 'Bug 修复' },
];

export default function SidebarLayout({
  children,
  onCollapse,
  mobileMenuOpen,
  onMobileMenuChange,
}: {
  children: ReactNode;
  onCollapse?: (collapsed: boolean) => void;
  mobileMenuOpen?: boolean;
  onMobileMenuChange?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [siteName, setSiteName] = useState('SparkAI');
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/admin/login';
  };

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.siteName) setSiteName(data.siteName);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary/15 rounded-lg p-1.5 ring-1 ring-primary/40">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-lg">{siteName}</span>
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
        <div className="border-t border-border p-4 space-y-2">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground block">
            ← 返回首页
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />退出登录
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col">
        <header className="md:hidden flex h-16 items-center border-b border-border px-4">
          {mobileMenuOpen && onMobileMenuChange && (
            <Button variant="ghost" size="icon" onClick={() => onMobileMenuChange(false)}>
              <span className="sr-only">Close menu</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          )}
          {(!mobileMenuOpen && onMobileMenuChange) && (
            <Button variant="ghost" size="icon" onClick={() => onMobileMenuChange(true)}>
              <span className="sr-only">Open menu</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </Button>
          )}
          <Link href="/" className="ml-4 flex items-center gap-2">
            <div className="bg-primary/15 rounded-lg p-1.5 ring-1 ring-primary/40">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold">SparkAI</span>
          </Link>
        </header>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border">
            <div className="flex h-16 items-center border-b border-border px-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="bg-primary/15 rounded-lg p-1.5 ring-1 ring-primary/40">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <span className="font-bold text-lg">SparkAI</span>
              </Link>
            </div>
            <nav className="space-y-1 p-4">
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
                    onClick={() => onMobileMenuChange?.(false)}
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
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
