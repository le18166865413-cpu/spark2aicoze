'use client';

import { useState, useEffect } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, Palette, Check, RefreshCcw } from 'lucide-react';

const THEMES = [
  { id: 'green', name: '翡翠绿', color: 'bg-emerald-500', hex: '#22C55E' },
  { id: 'blue', name: '天际蓝', color: 'bg-blue-500', hex: '#3B82F6' },
  { id: 'purple', name: '星空紫', color: 'bg-purple-500', hex: '#A855F7' },
  { id: 'orange', name: '落日橙', color: 'bg-orange-500', hex: '#F97316' },
  { id: 'red', name: '烈焰红', color: 'bg-red-500', hex: '#EF4444' },
  { id: 'neutral', name: '极简灰', color: 'bg-neutral-500', hex: '#71717A' },
];

const MODES = [
  { id: 'dark', name: '暗色模式' },
  { id: 'light', name: '亮色模式' },
];

const isLightColor = (color: string): boolean => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
};

const applyThemeColor = (themeColor: string) => {
  const theme = THEMES.find((t) => t.id === themeColor) || THEMES[0];
  document.documentElement.style.setProperty('--primary', theme.hex);
  document.documentElement.style.setProperty('--ring', theme.hex);
  document.documentElement.style.setProperty('--sidebar-primary', theme.hex);
  document.documentElement.style.setProperty('--sidebar-ring', theme.hex);
  
  const primaryForeground = isLightColor(theme.hex) ? '#09090b' : '#fafafa';
  document.documentElement.style.setProperty('--primary-foreground', primaryForeground);
  document.documentElement.style.setProperty('--sidebar-primary-foreground', primaryForeground);
};

const applyThemeMode = (themeMode: string) => {
  if (themeMode === 'light') {
    document.documentElement.classList.remove('dark');
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
  } else {
    document.documentElement.classList.add('dark');
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
};

export default function ThemePage() {
  const { loading, getSetting, saveSettings } = useAdminSettings();
  const [theme, setTheme] = useState('green');
  const [mode, setMode] = useState('dark');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && !initialized) {
      const savedTheme = getSetting('theme_color') || 'green';
      const savedMode = getSetting('theme_mode') || 'dark';
      setTheme(savedTheme);
      setMode(savedMode);
      setInitialized(true);
    }
  }, [loading, initialized, getSetting]);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    applyThemeColor(newTheme);
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    applyThemeMode(newMode);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings([
        { key: 'theme_color', value: theme },
        { key: 'theme_mode', value: mode },
      ]);
      setMessage({ type: 'success', text: '主题设置已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground"><Palette className="w-5 h-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {message && <div className={`p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm ${message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{message.text}</div>}

      <div className="bg-card border border-border rounded-lg sm:rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 mb-1 sm:mb-2">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="text-xs sm:text-sm font-semibold text-foreground">主色调</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => handleThemeChange(t.id)} className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-colors ${theme === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full ${t.color} flex items-center justify-center shrink-0`}>
                {theme === t.id && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-xs sm:text-sm text-foreground">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg sm:rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-4">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground">显示模式</h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => handleModeChange(m.id)} className={`p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-colors text-center ${mode === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
              <span className="text-xs sm:text-sm font-medium text-foreground">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 sm:gap-3">
        <button onClick={handleSave} disabled={saving} className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />{saving ? '保存中...' : '保存主题'}
        </button>
        <button onClick={() => {
          setTheme('green');
          setMode('dark');
          applyThemeColor('green');
          applyThemeMode('dark');
        }} className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-xs sm:text-sm font-medium hover:bg-secondary/80 transition-colors">
          <RefreshCcw className="w-4 h-4" />重置
        </button>
      </div>

      <p className="text-xs sm:text-sm text-muted-foreground">选择主题后立即预览效果，点击保存按钮永久保存。</p>
    </div>
  );
}
