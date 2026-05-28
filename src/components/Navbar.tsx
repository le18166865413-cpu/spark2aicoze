'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { Sparkles, House, Palette, User as UserIcon, LogOut, BarChart3 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [siteName, setSiteName] = useState('SparkAI');
  const [siteLabel, setSiteLabel] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(d => {
      setSiteName(d.siteName || 'SparkAI');
      setSiteLabel(d.siteLabel || '');
    }).catch(() => {});
  }, []);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
  };

  const displayName = siteName || 'SparkAI';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-gradient-nav backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-[72px] items-center px-1 md:px-6 mx-auto">
        {/* Logo */}
        <Link href="/" className="mr-4 sm:mr-8 flex items-center space-x-2 shrink-0">
          <div className="bg-primary/15 rounded-lg p-1.5 ring-1 ring-primary/40">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-metallic">{displayName}</span>
            {siteLabel && (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                {siteLabel}
              </span>
            )}
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center space-x-2 text-sm font-medium flex-1">
          <Link
            href="/"
            className={`flex items-center gap-2 rounded-full transition-all px-4 py-2 ${
              pathname === '/'
                ? 'bg-primary/15 text-primary font-semibold ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <House className="h-4 w-4" />
            <span>海报广场</span>
          </Link>
          <Link
            href="/create"
            className={`flex items-center gap-2 rounded-full transition-all px-4 py-2 ${
              pathname === '/create'
                ? 'bg-primary/15 text-primary font-semibold ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <Palette className="h-4 w-4" />
            <span>创作中心</span>
          </Link>
          {user && (
            <Link
              href="/my-works"
              className={`flex items-center gap-2 rounded-full transition-all px-4 py-2 ${
                pathname === '/my-works'
                  ? 'bg-primary/15 text-primary font-semibold ring-1 ring-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <Palette className="h-4 w-4" />
              <span>我的作品</span>
            </Link>
          )}
          {user && (
            <Link
              href="/stats"
              className={`flex items-center gap-2 rounded-full transition-all px-4 py-2 ${
                pathname === '/stats'
                  ? 'bg-primary/15 text-primary font-semibold ring-1 ring-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>使用统计</span>
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
          {/* Mobile: 广场 */}
          <Link
            href="/"
            className={`sm:hidden inline-flex items-center justify-center rounded-md text-xs font-semibold h-8 px-3 transition-all ${
              pathname === '/'
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary/15 text-primary ring-1 ring-primary/30'
            }`}
          >
            <House className="h-3.5 w-3.5 mr-1" />广场
          </Link>
          {/* Mobile: 创作中心 */}
          <Link
            href="/create"
            className={`sm:hidden inline-flex items-center justify-center rounded-md text-xs font-semibold h-8 px-3 transition-all ${
              pathname === '/create'
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary/15 text-primary ring-1 ring-primary/30'
            }`}
          >
            <Palette className="h-3.5 w-3.5 mr-1" />创作
          </Link>

          {/* User menu */}
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-secondary/60 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm ring-1 ring-primary/30">
                  {(user.nickname || user.email || user.username).charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:inline text-sm font-medium">{user.nickname || user.email || user.username}</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold">{user.nickname || user.email || user.username}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/my-works"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary/60 transition-colors sm:hidden"
                    >
                      <Palette className="w-4 h-4" />我的作品
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary/60 transition-colors"
                    >
                      <UserIcon className="w-4 h-4" />个人资料
                    </Link>
                    <Link
                      href="/stats"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary/60 transition-colors"
                    >
                      <BarChart3 className="w-4 h-4" />使用统计
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold h-8 px-4 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">登录</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
