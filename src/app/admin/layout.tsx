'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  Key,
  Palette,
  HardDrive,
  Import,
  LogOut,
  Shield,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: '仪表盘', icon: LayoutDashboard },
  { href: '/admin/settings', label: '网站设置', icon: Settings },
  { href: '/admin/api-tokens', label: 'API 令牌', icon: Key },
  { href: '/admin/theme', label: '主题配色', icon: Palette },
  { href: '/admin/storage', label: '图片存储', icon: HardDrive },
  { href: '/admin/import', label: '任务导入', icon: Import },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(!isLoginPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isLoginPage) return;

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/admin/auth', { credentials: 'same-origin' });
        const data = await res.json();
        if (cancelled) return;

        if (data.authenticated) {
          setAuthed(true);
          setChecking(false);
        } else {
          window.location.replace('/admin/login');
        }
      } catch {
        if (!cancelled) {
          window.location.replace('/admin/login');
        }
      }
    };

    check();
    return () => { cancelled = true; };
  }, [isLoginPage]);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
    } catch {
      // ignore
    }
    window.location.replace('/admin/login');
  };

  // 登录页直接渲染
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 检查认证中
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Shield className="w-6 h-6 animate-pulse" />
          <span>验证身份中...</span>
        </div>
      </div>
    );
  }

  // 未认证（不应到达这里，但作为保护）
  if (!authed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-border">
            <Link href="/admin" className="flex items-center gap-2 text-foreground">
              <Shield className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">SparkAI</span>
            </Link>
          </div>

          {/* 导航 */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* 底部 */}
          <div className="p-3 border-t border-border space-y-1">
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <LayoutDashboard className="w-4 h-4" />
              返回前台
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h2 className="text-sm font-medium text-foreground">
            {navItems.find((i) => i.href === pathname)?.label || '管理后台'}
          </h2>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
