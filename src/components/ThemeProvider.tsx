'use client';

import { useEffect, useState } from 'react';

interface Setting {
  key: string;
  value: string;
}

const THEME_COLORS: Record<string, string> = {
  green: '#22C55E', // emerald-500
  blue: '#3B82F6', // blue-500
  purple: '#A855F7', // purple-500
  orange: '#F97316', // orange-500
  red: '#EF4444', // red-500
  neutral: '#71717A', // zinc-500
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applyTheme();
  }, []);

  const applyTheme = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const settings: Setting[] = await res.json();
      
      // 获取主题颜色
      const themeColor = settings.find((s) => s.key === 'theme_color')?.value || 'green';
      // 获取主题模式
      const themeMode = settings.find((s) => s.key === 'theme_mode')?.value || 'dark';

      // 应用主题颜色
      const primaryColor = THEME_COLORS[themeColor] || THEME_COLORS.green;
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
    } finally {
      setLoading(false);
    }
  };

  const isLightColor = (color: string): boolean => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  };

  const applyDarkMode = () => {
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
  };

  const applyLightMode = () => {
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
  };

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  return <>{children}</>;
}