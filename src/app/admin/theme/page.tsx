'use client';

import { useState } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, Palette, Check } from 'lucide-react';

const colorOptions = [
  { label: '翠绿', value: '#22C55E', bg: 'bg-green-500' },
  { label: '天蓝', value: '#0EA5E9', bg: 'bg-sky-500' },
  { label: '紫罗兰', value: '#8B5CF6', bg: 'bg-violet-500' },
  { label: '玫红', value: '#E11D48', bg: 'bg-rose-600' },
  { label: '琥珀', value: '#F59E0B', bg: 'bg-amber-500' },
  { label: '青色', value: '#06B6D4', bg: 'bg-cyan-500' },
  { label: '靛蓝', value: '#6366F1', bg: 'bg-indigo-500' },
  { label: '橙色', value: '#F97316', bg: 'bg-orange-500' },
];

const themeModes = [
  { label: '深色模式', value: 'dark', desc: '深色背景，适合夜间使用' },
  { label: '浅色模式', value: 'light', desc: '浅色背景，适合日间使用' },
];

const radiusOptions = [
  { label: '无圆角', value: 'none' },
  { label: '小圆角', value: 'sm' },
  { label: '中圆角', value: 'md' },
  { label: '大圆角', value: 'lg' },
  { label: '超大圆角', value: 'xl' },
];

export default function AdminThemePage() {
  const { loading, saving, message, saveSettings, get } = useAdminSettings();
  const [primaryColor, setPrimaryColor] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [themeMode, setThemeMode] = useState('dark');
  const [borderRadius, setBorderRadius] = useState('lg');
  const [initialized, setInitialized] = useState(false);

  if (!loading && !initialized) {
    const savedColor = get('theme', 'primary_color', '#22C55E');
    setPrimaryColor(savedColor);
    setCustomColor(colorOptions.find((c) => c.value === savedColor) ? '' : savedColor);
    setThemeMode(get('theme', 'theme_mode', 'dark'));
    setBorderRadius(get('theme', 'border_radius', 'lg'));
    setInitialized(true);
  }

  const handleSave = () => {
    saveSettings({
      primary_color: primaryColor,
      theme_mode: themeMode,
      border_radius: borderRadius,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Palette className="w-5 h-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-primary/10 text-primary'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Primary Color */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">主色调</h3>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {colorOptions.map((color) => (
            <button
              key={color.value}
              onClick={() => {
                setPrimaryColor(color.value);
                setCustomColor('');
              }}
              className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                primaryColor === color.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <div className={`w-6 h-6 rounded-full ${color.bg} flex items-center justify-center`}>
                {primaryColor === color.value && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-[10px] text-muted-foreground">{color.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">自定义颜色值</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value);
                setCustomColor(e.target.value);
              }}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={customColor || primaryColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                  setPrimaryColor(e.target.value);
                }
              }}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="#22C55E"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">预览</label>
          <div className="flex gap-2 flex-wrap">
            <div
              className="px-4 py-2 rounded-lg text-sm text-white font-medium"
              style={{ backgroundColor: primaryColor }}
            >
              主要按钮
            </div>
            <div
              className="px-4 py-2 rounded-lg text-sm font-medium border-2"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              次要按钮
            </div>
            <div
              className="px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
            >
              文字按钮
            </div>
          </div>
        </div>
      </div>

      {/* Theme Mode */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">主题模式</h3>
        <div className="grid grid-cols-2 gap-3">
          {themeModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setThemeMode(mode.value)}
              className={`p-4 rounded-xl border text-left transition-colors ${
                themeMode === mode.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    themeMode === mode.value ? 'border-primary' : 'border-border'
                  }`}
                >
                  {themeMode === mode.value && (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-sm font-medium text-foreground">{mode.label}</span>
              </div>
              <p className="text-xs text-muted-foreground ml-8">{mode.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Border Radius */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">圆角大小</h3>
        <div className="flex gap-2">
          {radiusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setBorderRadius(option.value)}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                borderRadius === option.value
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        <Save className="w-4 h-4" />
        {saving ? '保存中...' : '保存主题设置'}
      </button>
    </div>
  );
}
