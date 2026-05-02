'use client';

import { useState, useEffect, ReactNode } from 'react';
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
  Sparkles,
  Menu,
  X,
  ChevronRight,
  Loader2,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: '仪表盘', icon: LayoutDashboard },
  { href: '/admin/settings', label: '网站设置', icon: Settings },
  { href: '/admin/api-tokens', label: 'API 令牌', icon: Key },
  { href: '/admin/theme', label: '主题配色', icon: Palette },
  { href: '/admin/storage', label: '图片存储', icon: HardDrive },
  { href: '/admin/import', label: '任务导入', icon: Import },
];

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // 登录页不显示后台布局
  const isLoginPage = pathname === '/admin/login';

  // 非登录页验证 token
  useEffect(() => {
    if (isLoginPage) {
      setAuthChecked(true);
      return;
    }
    const token = getAdminToken();
    if (!token) {
      window.location.replace('/admin/login');
      return;
    }
    // 验证 token 是否有效
    fetch(`/api/admin/auth?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          localStorage.removeItem('admin_token');
          window.location.replace('/admin/login');
        } else {
          setAuthChecked(true);
        }
      })
      .catch(() => {
        // 网络错误时仍然允许访问（可能只是暂时的）
        setAuthChecked(true);
      });
  }, [isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    const token = getAdminToken();
    try {
      await fetch(`/api/admin/auth?token=${token || ''}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    localStorage.removeItem('admin_token');
    window.location.replace('/admin/login');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-border bg-card transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className={`flex items-center gap-2 p-4 border-b border-border ${collapsed ? 'justify-center' : ''}`}>
          <Sparkles className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && <span className="font-bold text-lg">SparkAI</span>}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground text-sm w-full"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
            {!collapsed && <span>收起侧栏</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive text-sm w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>退出登录</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 className="text-sm font-medium">
            {navItems.find((i) => i.href === pathname)?.label || '管理后台'}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              返回前台
            </Link>
          </div>
        </header>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-border bg-card p-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive text-sm w-full"
            >
              <LogOut className="h-4 w-4" />
              <span>退出登录</span>
            </button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
