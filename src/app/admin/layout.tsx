'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  Key,
  Palette,
  HardDrive,
  Download,
  LogOut,
  Sparkles,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: '仪表盘', icon: LayoutDashboard, category: '概览' },
  { href: '/admin/settings', label: '网站设置', icon: Settings, category: '配置' },
  { href: '/admin/api-tokens', label: 'API 令牌', icon: Key, category: '配置' },
  { href: '/admin/theme', label: '主题配色', icon: Palette, category: '外观' },
  { href: '/admin/storage', label: '图片存储', icon: HardDrive, category: '存储' },
  { href: '/admin/import', label: '任务导入', icon: Download, category: '工具' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Login page doesn't need auth check
      if (pathname === '/admin/login') {
        setChecking(false);
        return;
      }
      try {
        const res = await fetch('/api/admin/auth');
        const data = await res.json();
        if (!data.authenticated) {
          router.replace('/admin/login');
          return;
        }
        setAuthenticated(true);
      } catch {
        router.replace('/admin/login');
      } finally {
        setChecking(false);
      }
    };
    checkAuth();
  }, [pathname, router]);

  const handleLogout = useCallback(async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.replace('/admin/login');
  }, [router]);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Sparkles className="w-5 h-5 animate-spin" />
          <span>验证中...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) return null;

  const currentNav = navItems.find((item) => item.href === pathname);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 h-16 border-b border-border shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">SparkAI</h2>
              <p className="text-xs text-muted-foreground">管理后台</p>
            </div>
            <button
              className="ml-auto lg:hidden text-muted-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            {['概览', '配置', '外观', '存储', '工具'].map((category) => {
              const items = navItems.filter((i) => i.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category} className="mb-4">
                  <p className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {category}
                  </p>
                  {items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <button
                        key={item.href}
                        onClick={() => {
                          router.push(item.href);
                          setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                        {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="px-3 py-4 border-t border-border shrink-0">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center px-6 gap-4">
          <button
            className="lg:hidden text-muted-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {currentNav && (
              <>
                <currentNav.icon className="w-4 h-4 text-primary" />
                <h1 className="text-lg font-semibold text-foreground">{currentNav.label}</h1>
              </>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 max-w-5xl">{children}</main>
      </div>
    </div>
  );
}
