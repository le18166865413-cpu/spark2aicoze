'use client';

import { useEffect, useState } from 'react';

const THEME_COLORS: Record<string, string> = {
  green: '#22C55E',
  teal: '#14B8A6',
  cyan: '#06B6D4',
  sky: '#0EA5E9',
  blue: '#3B82F6',
  indigo: '#6366F1',
  violet: '#8B5CF6',
  purple: '#A855F7',
  fuchsia: '#D946EF',
  pink: '#EC4899',
  rose: '#F43F5E',
  red: '#EF4444',
  orange: '#F97316',
  amber: '#F59E0B',
  yellow: '#EAB308',
  lime: '#84CC16',
  neutral: '#71717A',
  stone: '#78716C',
  slate: '#64748B',
};

function isLightColor(color: string): boolean {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

function applyDarkMode() {
  document.documentElement.style.setProperty('--background', '#09090b');
  document.documentElement.style.setProperty('--foreground', '#fafafa');
  document.documentElement.style.setProperty('--card', '#111113');
  document.documentElement.style.setProperty('--card-foreground', '#fafafa');
  document.documentElement.style.setProperty('--popover', '#111113');
  document.documentElement.style.setProperty('--popover-foreground', '#fafafa');
  document.documentElement.style.setProperty('--secondary', '#1c1c1f');
  document.documentElement.style.setProperty('--secondary-foreground', '#fafafa');
  document.documentElement.style.setProperty('--muted', '#1c1c1f');
  document.documentElement.style.setProperty('--muted-foreground', '#a1a1aa');
  document.documentElement.style.setProperty('--accent', '#1c1c1f');
  document.documentElement.style.setProperty('--accent-foreground', '#fafafa');
  document.documentElement.style.setProperty('--destructive', '#7f1d1d');
  document.documentElement.style.setProperty('--destructive-foreground', '#fafafa');
  document.documentElement.style.setProperty('--border', '#27272a');
  document.documentElement.style.setProperty('--input', '#27272a');
  document.documentElement.style.setProperty('--sidebar', '#111113');
  document.documentElement.style.setProperty('--sidebar-foreground', '#fafafa');
  document.documentElement.style.setProperty('--sidebar-accent', '#1c1c1f');
  document.documentElement.style.setProperty('--sidebar-accent-foreground', '#fafafa');
  document.documentElement.style.setProperty('--sidebar-border', '#27272a');
}

function applyLightMode() {
  document.documentElement.style.setProperty('--background', '#ffffff');
  document.documentElement.style.setProperty('--foreground', '#09090b');
  document.documentElement.style.setProperty('--card', '#ffffff');
  document.documentElement.style.setProperty('--card-foreground', '#09090b');
  document.documentElement.style.setProperty('--popover', '#ffffff');
  document.documentElement.style.setProperty('--popover-foreground', '#09090b');
  document.documentElement.style.setProperty('--secondary', '#f4f4f5');
  document.documentElement.style.setProperty('--secondary-foreground', '#09090b');
  document.documentElement.style.setProperty('--muted', '#f4f4f5');
  document.documentElement.style.setProperty('--muted-foreground', '#71717a');
  document.documentElement.style.setProperty('--accent', '#f4f4f5');
  document.documentElement.style.setProperty('--accent-foreground', '#09090b');
  document.documentElement.style.setProperty('--destructive', '#fef2f2');
  document.documentElement.style.setProperty('--destructive-foreground', '#7f1d1d');
  document.documentElement.style.setProperty('--border', '#e4e4e7');
  document.documentElement.style.setProperty('--input', '#e4e4e7');
  document.documentElement.style.setProperty('--sidebar', '#ffffff');
  document.documentElement.style.setProperty('--sidebar-foreground', '#09090b');
  document.documentElement.style.setProperty('--sidebar-accent', '#f4f4f5');
  document.documentElement.style.setProperty('--sidebar-accent-foreground', '#09090b');
  document.documentElement.style.setProperty('--sidebar-border', '#e4e4e7');
}

async function applyTheme() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();

    // 获取主题颜色和模式
    const themeColor = config.themeColor || config.theme_color || 'green';
    const themeCustomHex = config.themeCustomHex || config.theme_custom_hex;
    const themeMode = config.themeMode || config.theme_mode || 'dark';

    // 应用主题颜色（支持自定义颜色）
    const primaryColor = themeColor === 'custom' && themeCustomHex
      ? themeCustomHex
      : (THEME_COLORS[themeColor] || THEME_COLORS.green);
    document.documentElement.style.setProperty('--primary', primaryColor);
    document.documentElement.style.setProperty('--ring', primaryColor);
    document.documentElement.style.setProperty('--sidebar-primary', primaryColor);
    document.documentElement.style.setProperty('--sidebar-ring', primaryColor);

    // 调整 primary-foreground，确保对比度
    const primaryForeground = isLightColor(primaryColor) ? '#09090b' : '#fafafa';
    document.documentElement.style.setProperty('--primary-foreground', primaryForeground);
    document.documentElement.style.setProperty('--sidebar-primary-foreground', primaryForeground);

    // 应用暗色/亮色模式
    if (themeMode === 'light') {
      document.documentElement.classList.remove('dark');
      applyLightMode();
    } else {
      document.documentElement.classList.add('dark');
      applyDarkMode();
    }
  } catch (error) {
    console.error('[ThemeProvider] Failed to apply theme:', error);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    applyTheme().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  return <>{children}</>;
}
