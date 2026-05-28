'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, Palette, Check, RefreshCcw, Pipette, Sparkles, Layers, Zap, Square, Monitor, Navigation } from 'lucide-react';

const THEMES = [
  // 高饱和色
  { id: 'green', name: '翡翠绿', hex: '#22C55E' },
  { id: 'teal', name: '湖水青', hex: '#14B8A6' },
  { id: 'cyan', name: '天穹青', hex: '#06B6D4' },
  { id: 'sky', name: '晴空蓝', hex: '#0EA5E9' },
  { id: 'blue', name: '天际蓝', hex: '#3B82F6' },
  { id: 'indigo', name: '靛青蓝', hex: '#6366F1' },
  { id: 'violet', name: '紫罗兰', hex: '#8B5CF6' },
  { id: 'purple', name: '星空紫', hex: '#A855F7' },
  { id: 'fuchsia', name: '洋红紫', hex: '#D946EF' },
  { id: 'pink', name: '樱花粉', hex: '#EC4899' },
  { id: 'rose', name: '玫瑰红', hex: '#F43F5E' },
  { id: 'red', name: '烈焰红', hex: '#EF4444' },
  { id: 'orange', name: '落日橙', hex: '#F97316' },
  { id: 'amber', name: '琥珀黄', hex: '#F59E0B' },
  { id: 'yellow', name: '柠檬黄', hex: '#EAB308' },
  { id: 'lime', name: '青柠绿', hex: '#84CC16' },
  // 低饱和色
  { id: 'sage', name: '鼠尾草', hex: '#6B8F71' },
  { id: 'dusty-blue', name: '雾蓝', hex: '#6B8CA6' },
  { id: 'dusty-rose', name: '豆沙粉', hex: '#C08081' },
  { id: 'dusty-purple', name: '灰紫', hex: '#8E7CC3' },
  { id: 'muted-teal', name: '灰青', hex: '#5F9EA0' },
  { id: 'muted-olive', name: '橄榄绿', hex: '#808000' },
  { id: 'muted-coral', name: '珊瑚橘', hex: '#CD8032' },
  { id: 'muted-mauve', name: '淡紫藤', hex: '#9B7E8F' },
  // 深色
  { id: 'deep-navy', name: '深海蓝', hex: '#1E3A5F' },
  { id: 'deep-emerald', name: '墨绿', hex: '#064E3B' },
  { id: 'deep-wine', name: '酒红', hex: '#722F37' },
  { id: 'deep-plum', name: '深梅紫', hex: '#4A2040' },
  { id: 'deep-teal', name: '深松绿', hex: '#0D4F4F' },
  { id: 'deep-brown', name: '深棕', hex: '#5C3317' },
  { id: 'deep-slate', name: '深岩灰', hex: '#334155' },
  { id: 'deep-oxblood', name: '牛血红', hex: '#4A0000' },
  // 浅色
  { id: 'light-mint', name: '薄荷绿', hex: '#A7F3D0' },
  { id: 'light-sky', name: '婴儿蓝', hex: '#BAE6FD' },
  { id: 'light-lavender', name: '薰衣草', hex: '#C4B5FD' },
  { id: 'light-peach', name: '蜜桃', hex: '#FED7AA' },
  { id: 'light-pink', name: '浅粉', hex: '#FBCFE8' },
  { id: 'light-cream', name: '奶油', hex: '#FEF3C7' },
  { id: 'light-lilac', name: '丁香', hex: '#DDD6FE' },
  { id: 'light-coral', name: '浅珊瑚', hex: '#FCA5A5' },
  // 中性色
  { id: 'neutral', name: '极简灰', hex: '#71717A' },
  { id: 'stone', name: '暖石灰', hex: '#78716C' },
  { id: 'slate', name: '岩石灰', hex: '#64748B' },
];

const MODES = [
  { id: 'dark', name: '暗色模式' },
  { id: 'light', name: '亮色模式' },
];

function isLightColor(color: string): boolean {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

function applyThemeColor(hex: string) {
  document.documentElement.style.setProperty('--primary', hex);
  document.documentElement.style.setProperty('--ring', hex);
  document.documentElement.style.setProperty('--sidebar-primary', hex);
  document.documentElement.style.setProperty('--sidebar-ring', hex);

  const primaryForeground = isLightColor(hex) ? '#09090b' : '#fafafa';
  document.documentElement.style.setProperty('--primary-foreground', primaryForeground);
  document.documentElement.style.setProperty('--sidebar-primary-foreground', primaryForeground);
}

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

function deriveSecondaryColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const r2 = Math.max(0, r - 40);
  const g2 = Math.max(0, g - 20);
  const b2 = Math.min(255, b + 60);
  return `#${r2.toString(16).padStart(2, '0')}${g2.toString(16).padStart(2, '0')}${b2.toString(16).padStart(2, '0')}`;
}

function applyVisualEffectsLocal(effects: VisualEffectsState, primaryHex: string) {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');

  root.style.setProperty('--theme-gradient-from', effects.gradientEnabled ? (effects.gradientFrom || primaryHex) : 'transparent');
  root.style.setProperty('--theme-gradient-to', effects.gradientEnabled ? (effects.gradientTo || deriveSecondaryColor(primaryHex)) : 'transparent');

  root.style.setProperty('--theme-noise-enabled', effects.noiseEnabled ? '1' : '0');
  root.style.setProperty('--theme-noise-opacity', String(effects.noiseOpacity));
  root.style.setProperty('--theme-noise-opacity-dark', String(Math.min(effects.noiseOpacity * 2, 0.06)));

  root.style.setProperty('--theme-metallic-enabled', effects.metallicTextEnabled ? '1' : '0');
  root.style.setProperty('--theme-metallic-from', effects.metallicFrom || primaryHex);
  root.style.setProperty('--theme-metallic-via', effects.metallicVia || (isLightColor(primaryHex) ? '#ffffff' : '#f0e6ff'));
  root.style.setProperty('--theme-metallic-to', effects.metallicTo || deriveSecondaryColor(primaryHex));

  root.style.setProperty('--theme-btn-glow-enabled', effects.btnGlowEnabled ? '1' : '0');
  root.style.setProperty('--theme-glow-color', primaryHex);
  root.style.setProperty('--theme-card-glow-enabled', effects.cardGlowEnabled ? '1' : '0');
  root.style.setProperty('--theme-page-gradient-enabled', effects.pageBgGradientEnabled ? '1' : '0');
  root.style.setProperty('--theme-nav-gradient-enabled', effects.navGradientEnabled ? '1' : '0');

  // Toggle noise overlay visibility
  if (effects.noiseEnabled) {
    root.removeAttribute('data-noise-disabled');
  } else {
    root.setAttribute('data-noise-disabled', '');
  }
}

interface VisualEffectsState {
  gradientEnabled: boolean;
  gradientFrom: string;
  gradientTo: string;
  noiseEnabled: boolean;
  noiseOpacity: number;
  metallicTextEnabled: boolean;
  metallicFrom: string;
  metallicVia: string;
  metallicTo: string;
  btnGlowEnabled: boolean;
  cardGlowEnabled: boolean;
  pageBgGradientEnabled: boolean;
  navGradientEnabled: boolean;
}

const DEFAULT_EFFECTS: VisualEffectsState = {
  gradientEnabled: true,
  gradientFrom: '',
  gradientTo: '',
  noiseEnabled: true,
  noiseOpacity: 0.03,
  metallicTextEnabled: true,
  metallicFrom: '',
  metallicVia: '',
  metallicTo: '',
  btnGlowEnabled: true,
  cardGlowEnabled: true,
  pageBgGradientEnabled: true,
  navGradientEnabled: true,
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function ColorPicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || '#8b5cf6'}
        onChange={(e) => onChange(e.target.value)}
        className="w-3 h-3 p-0 border-0 rounded-[2px] cursor-pointer shrink-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (/^#[0-9A-Fa-f]{0,6}$/.test(v) || v === '') {
            onChange(v);
          }
        }}
        className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground w-24 font-mono"
        placeholder={placeholder || '#000000'}
        maxLength={7}
      />
    </div>
  );
}

export default function ThemePage() {
  const { loading, getSetting, saveSettings } = useAdminSettings();
  const [theme, setTheme] = useState('green');
  const [mode, setMode] = useState('dark');
  const [customHex, setCustomHex] = useState('#22C55E');
  const [isCustom, setIsCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [effects, setEffects] = useState<VisualEffectsState>(DEFAULT_EFFECTS);

  useEffect(() => {
    if (!loading && !initialized) {
      const savedTheme = getSetting('theme_color') || 'green';
      const savedMode = getSetting('theme_mode') || 'dark';
      const savedCustomHex = getSetting('theme_custom_hex') || '#22C55E';

      const preset = THEMES.find((t) => t.id === savedTheme);
      if (preset) {
        setTheme(savedTheme);
        setIsCustom(false);
        setCustomHex(savedCustomHex);
      } else if (savedTheme === 'custom') {
        setTheme('custom');
        setIsCustom(true);
        setCustomHex(savedCustomHex);
      } else {
        setTheme('green');
        setIsCustom(false);
        setCustomHex(savedCustomHex);
      }
      setMode(savedMode);

      // Load visual effects settings
      setEffects({
        gradientEnabled: getSetting('theme_gradient_enabled') !== 'false',
        gradientFrom: getSetting('theme_gradient_from') || '',
        gradientTo: getSetting('theme_gradient_to') || '',
        noiseEnabled: getSetting('theme_noise_enabled') !== 'false',
        noiseOpacity: Number(getSetting('theme_noise_opacity')) || 0.03,
        metallicTextEnabled: getSetting('theme_metallic_text_enabled') !== 'false',
        metallicFrom: getSetting('theme_metallic_from') || '',
        metallicVia: getSetting('theme_metallic_via') || '',
        metallicTo: getSetting('theme_metallic_to') || '',
        btnGlowEnabled: getSetting('theme_btn_glow_enabled') !== 'false',
        cardGlowEnabled: getSetting('theme_card_glow_enabled') !== 'false',
        pageBgGradientEnabled: getSetting('theme_page_bg_gradient_enabled') !== 'false',
        navGradientEnabled: getSetting('theme_nav_gradient_enabled') !== 'false',
      });

      setInitialized(true);
    }
  }, [loading, initialized, getSetting]);

  // Apply visual effects preview whenever they change
  useEffect(() => {
    if (!initialized) return;
    const primaryHex = isCustom ? customHex : (THEMES.find((t) => t.id === theme)?.hex || '#22C55E');
    applyVisualEffectsLocal(effects, primaryHex);
  }, [effects, theme, customHex, isCustom, initialized]);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    setIsCustom(false);
    const t = THEMES.find((x) => x.id === newTheme);
    if (t) {
      applyThemeColor(t.hex);
      setCustomHex(t.hex);
    }
  };

  const handleCustomHex = (hex: string) => {
    setTheme('custom');
    setIsCustom(true);
    setCustomHex(hex);
    applyThemeColor(hex);
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    applyThemeMode(newMode);
  };

  const updateEffect = <K extends keyof VisualEffectsState>(key: K, value: VisualEffectsState[K]) => {
    setEffects(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const settings = [
        { key: 'theme_color', value: theme },
        { key: 'theme_mode', value: mode },
        // Visual effects
        { key: 'theme_gradient_enabled', value: effects.gradientEnabled ? 'true' : 'false' },
        { key: 'theme_gradient_from', value: effects.gradientFrom },
        { key: 'theme_gradient_to', value: effects.gradientTo },
        { key: 'theme_noise_enabled', value: effects.noiseEnabled ? 'true' : 'false' },
        { key: 'theme_noise_opacity', value: String(effects.noiseOpacity) },
        { key: 'theme_metallic_text_enabled', value: effects.metallicTextEnabled ? 'true' : 'false' },
        { key: 'theme_metallic_from', value: effects.metallicFrom },
        { key: 'theme_metallic_via', value: effects.metallicVia },
        { key: 'theme_metallic_to', value: effects.metallicTo },
        { key: 'theme_btn_glow_enabled', value: effects.btnGlowEnabled ? 'true' : 'false' },
        { key: 'theme_card_glow_enabled', value: effects.cardGlowEnabled ? 'true' : 'false' },
        { key: 'theme_page_bg_gradient_enabled', value: effects.pageBgGradientEnabled ? 'true' : 'false' },
        { key: 'theme_nav_gradient_enabled', value: effects.navGradientEnabled ? 'true' : 'false' },
      ];
      if (theme === 'custom') {
        settings.push({ key: 'theme_custom_hex', value: customHex });
      }
      await saveSettings(settings);
      setMessage({ type: 'success', text: '主题设置已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTheme('green');
    setMode('dark');
    setIsCustom(false);
    setCustomHex('#22C55E');
    setEffects(DEFAULT_EFFECTS);
    applyThemeColor('#22C55E');
    applyThemeMode('dark');
    applyVisualEffectsLocal(DEFAULT_EFFECTS, '#22C55E');
  };

  const currentHex = isCustom ? customHex : (THEMES.find((t) => t.id === theme)?.hex || '#22C55E');

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground"><Palette className="w-5 h-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {message && <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{message.text}</div>}

      {/* === 主色调 === */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">主色调</h3>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-11 lg:grid-cols-13 gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border cursor-pointer transition-colors ${theme === t.id && !isCustom ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                style={{ backgroundColor: t.hex }}
              >
                {theme === t.id && !isCustom && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
              </div>
              <span className="text-[10px] text-muted-foreground truncate w-full text-center leading-tight">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* === 自定义颜色 === */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Pipette className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">自定义颜色</h3>
          {isCustom && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">
              <Check className="w-2.5 h-2.5" /> 已启用
            </span>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">点击色块选择自定义颜色，或使用下方取色器精确选色</p>
          {/* Color grid - Red hue variations */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">红色系</span>
            <div className="flex flex-wrap gap-[2px]">
              {['#FFF0F0','#FFE0E0','#FFCCCC','#FFB3B3','#FF9999','#FF8080','#FF6666','#FF4D4D','#FF3333','#FF1A1A','#E60000','#CC0000','#B30000','#990000','#800000','#660000'].map(hex => (
                <button key={hex} onClick={() => handleCustomHex(hex)} className={`w-[25px] h-[25px] rounded cursor-pointer border-0 transition-transform hover:scale-110 ${isCustom && customHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary scale-110' : ''}`} style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>
          {/* Orange hue variations */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">橙色系</span>
            <div className="flex flex-wrap gap-[2px]">
              {['#FFF5EB','#FFE8D0','#FFD6A8','#FFC280','#FFB366','#FF9E3D','#FF8C1A','#FF7700','#E66B00','#CC5F00','#B35300','#994700','#803B00','#662F00','#4D2400','#331A00'].map(hex => (
                <button key={hex} onClick={() => handleCustomHex(hex)} className={`w-[25px] h-[25px] rounded cursor-pointer border-0 transition-transform hover:scale-110 ${isCustom && customHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary scale-110' : ''}`} style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>
          {/* Yellow hue variations */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">黄色系</span>
            <div className="flex flex-wrap gap-[2px]">
              {['#FFFFF0','#FFFFE0','#FFFDE5','#FFF9B3','#FFF580','#FFF14D','#FFED1A','#FFE600','#E6D000','#CCBA00','#B3A400','#998E00','#807800','#666200','#4D4C00','#333600'].map(hex => (
                <button key={hex} onClick={() => handleCustomHex(hex)} className={`w-[25px] h-[25px] rounded cursor-pointer border-0 transition-transform hover:scale-110 ${isCustom && customHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary scale-110' : ''}`} style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>
          {/* Green hue variations */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">绿色系</span>
            <div className="flex flex-wrap gap-[2px]">
              {['#F0FFF0','#DFFFDF','#CCFFCC','#B3FFB3','#99FF99','#80FF80','#66FF66','#4DFF4D','#33FF33','#1AFF1A','#00E600','#00CC00','#00B300','#009900','#008000','#006600'].map(hex => (
                <button key={hex} onClick={() => handleCustomHex(hex)} className={`w-[25px] h-[25px] rounded cursor-pointer border-0 transition-transform hover:scale-110 ${isCustom && customHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary scale-110' : ''}`} style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>
          {/* Cyan/Teal hue variations */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">青色系</span>
            <div className="flex flex-wrap gap-[2px]">
              {['#F0FFFF','#DFFFFF','#CCFFFF','#B3FFFF','#99FFFF','#80FFFF','#66FFFF','#4DFFFF','#33FFFF','#1AFFFF','#00E6E6','#00CCCC','#00B3B3','#009999','#008080','#006666'].map(hex => (
                <button key={hex} onClick={() => handleCustomHex(hex)} className={`w-[25px] h-[25px] rounded cursor-pointer border-0 transition-transform hover:scale-110 ${isCustom && customHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary scale-110' : ''}`} style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>
          {/* Blue hue variations */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">蓝色系</span>
            <div className="flex flex-wrap gap-[2px]">
              {['#F0F5FF','#D9E8FF','#B3D4FF','#8CBCFF','#66A3FF','#4D8FFF','#3379FF','#1A63FF','#004DE6','#003ACC','#002DB3','#002199','#001A80','#001266','#000D4D','#000833'].map(hex => (
                <button key={hex} onClick={() => handleCustomHex(hex)} className={`w-[25px] h-[25px] rounded cursor-pointer border-0 transition-transform hover:scale-110 ${isCustom && customHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary scale-110' : ''}`} style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>
          {/* Purple hue variations */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">紫色系</span>
            <div className="flex flex-wrap gap-[2px]">
              {['#F5F0FF','#E6D9FF','#D4B3FF','#C299FF','#B080FF','#9C66FF','#884DFF','#7433FF','#601AFF','#5200E6','#4700CC','#3C00B3','#310099','#260080','#1C0066','#11004D'].map(hex => (
                <button key={hex} onClick={() => handleCustomHex(hex)} className={`w-[25px] h-[25px] rounded cursor-pointer border-0 transition-transform hover:scale-110 ${isCustom && customHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary scale-110' : ''}`} style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>
          {/* Pink hue variations */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">粉色系</span>
            <div className="flex flex-wrap gap-[2px]">
              {['#FFF0F5','#FFD9E8','#FFB3D4','#FF99C4','#FF80B4','#FF66A3','#FF4D93','#FF3383','#FF1A73','#E60066','#CC0059','#B3004D','#990040','#800033','#660026','#4D001A'].map(hex => (
                <button key={hex} onClick={() => handleCustomHex(hex)} className={`w-[25px] h-[25px] rounded cursor-pointer border-0 transition-transform hover:scale-110 ${isCustom && customHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary scale-110' : ''}`} style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>
          {/* Neutral variations */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">中性色</span>
            <div className="flex flex-wrap gap-[2px]">
              {['#FFFFFF','#FAFAFA','#F5F5F5','#EEEEEE','#E5E5E5','#D4D4D4','#BFBFBF','#A3A3A3','#8C8C8C','#737373','#595959','#404040','#2E2E2E','#262626','#171717','#0A0A0A'].map(hex => (
                <button key={hex} onClick={() => handleCustomHex(hex)} className={`w-[25px] h-[25px] rounded cursor-pointer border-0 transition-transform hover:scale-110 ${isCustom && customHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-primary scale-110' : ''} ${['#FFFFFF','#FAFAFA','#F5F5F5','#EEEEEE'].includes(hex) ? 'border border-border/30' : ''}`} style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>
          {/* Custom hex input with color picker */}
          <div className="flex items-center gap-3 pt-2 border-t border-border/50">
            <input
              type="color"
              value={customHex}
              onChange={(e) => handleCustomHex(e.target.value)}
              className="w-10 h-10 p-0 border-0 rounded cursor-pointer shrink-0"
            />
            <input
              type="text"
              value={customHex}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                  handleCustomHex(v);
                }
              }}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground w-28 font-mono"
              placeholder="#22C55E"
              maxLength={7}
            />
            <div
              className="w-10 h-10 rounded-lg border border-border shadow-inner shrink-0"
              style={{ backgroundColor: currentHex }}
            />
            <span className="text-sm font-mono text-foreground">{currentHex.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* === 显示模式 === */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">显示模式</h3>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => handleModeChange(m.id)} className={`p-3 rounded-lg border cursor-pointer transition-colors text-center ${mode === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
              <span className="text-sm font-medium text-foreground">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* === 渐变配色 === */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">渐变配色</h3>
          </div>
          <Toggle checked={effects.gradientEnabled} onChange={(v) => updateEffect('gradientEnabled', v)} label="渐变配色" />
        </div>
        {effects.gradientEnabled && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">控制页面渐变效果的起始色和结束色，留空则根据主色自动推导</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">渐变起始色</label>
                <ColorPicker value={effects.gradientFrom} onChange={(v) => updateEffect('gradientFrom', v)} placeholder="自动" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">渐变结束色</label>
                <ColorPicker value={effects.gradientTo} onChange={(v) => updateEffect('gradientTo', v)} placeholder="自动" />
              </div>
            </div>
            {/* Gradient preview */}
            <div
              className="h-8 rounded-lg border border-border"
              style={{
                background: `linear-gradient(135deg, ${effects.gradientFrom || currentHex}, ${effects.gradientTo || deriveSecondaryColor(currentHex)})`,
              }}
            />
          </div>
        )}
      </div>

      {/* === 噪点纹理 === */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">噪点纹理</h3>
          </div>
          <Toggle checked={effects.noiseEnabled} onChange={(v) => updateEffect('noiseEnabled', v)} label="噪点纹理" />
        </div>
        {effects.noiseEnabled && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">为页面添加微妙的噪点纹理，增加质感深度</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">纹理强度</label>
                <span className="text-xs font-mono text-foreground">{(effects.noiseOpacity * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.005"
                max="0.08"
                step="0.005"
                value={effects.noiseOpacity}
                onChange={(e) => updateEffect('noiseOpacity', Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>微弱</span>
                <span>强烈</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === 金属文字 === */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">金属文字效果</h3>
          </div>
          <Toggle checked={effects.metallicTextEnabled} onChange={(v) => updateEffect('metallicTextEnabled', v)} label="金属文字效果" />
        </div>
        {effects.metallicTextEnabled && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Logo 和标题的金属渐变文字效果，留空则根据主色自动推导</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">起始色</label>
                <ColorPicker value={effects.metallicFrom} onChange={(v) => updateEffect('metallicFrom', v)} placeholder="自动" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">中间高光色</label>
                <ColorPicker value={effects.metallicVia} onChange={(v) => updateEffect('metallicVia', v)} placeholder="自动" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">结束色</label>
                <ColorPicker value={effects.metallicTo} onChange={(v) => updateEffect('metallicTo', v)} placeholder="自动" />
              </div>
            </div>
            {/* Metallic preview */}
            <div
              className="h-10 rounded-lg flex items-center justify-center text-lg font-bold border border-border"
              style={{
                background: `linear-gradient(135deg, ${effects.metallicFrom || currentHex} 0%, ${effects.metallicVia || (isLightColor(currentHex) ? '#ffffff' : '#f0e6ff')} 50%, ${effects.metallicTo || deriveSecondaryColor(currentHex)} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              SparkAI
            </div>
          </div>
        )}
      </div>

      {/* === 光效开关 === */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">光效与发光</h3>
        </div>
        <p className="text-xs text-muted-foreground">控制按钮、卡片等元素的发光效果</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div>
              <div className="text-sm text-foreground">按钮光效</div>
              <div className="text-xs text-muted-foreground">主色按钮的柔和发光效果</div>
            </div>
            <Toggle checked={effects.btnGlowEnabled} onChange={(v) => updateEffect('btnGlowEnabled', v)} label="按钮光效" />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div>
              <div className="text-sm text-foreground">卡片发光</div>
              <div className="text-xs text-muted-foreground">卡片边框的渐变发光效果</div>
            </div>
            <Toggle checked={effects.cardGlowEnabled} onChange={(v) => updateEffect('cardGlowEnabled', v)} label="卡片发光" />
          </div>
        </div>
      </div>

      {/* === 页面与导航效果 === */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">页面与导航效果</h3>
        </div>
        <p className="text-xs text-muted-foreground">控制页面背景渐变和导航栏的特殊效果</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div>
              <div className="flex items-center gap-2">
                <Square className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="text-sm text-foreground">页面背景渐变</div>
              </div>
              <div className="text-xs text-muted-foreground">页面顶部的主题色渐变过渡</div>
            </div>
            <Toggle checked={effects.pageBgGradientEnabled} onChange={(v) => updateEffect('pageBgGradientEnabled', v)} label="页面背景渐变" />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="text-sm text-foreground">导航栏渐变</div>
              </div>
              <div className="text-xs text-muted-foreground">导航栏的主题色渐变背景</div>
            </div>
            <Toggle checked={effects.navGradientEnabled} onChange={(v) => updateEffect('navGradientEnabled', v)} label="导航栏渐变" />
          </div>
        </div>
      </div>

      {/* === 保存按钮 === */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />{saving ? '保存中...' : '保存主题'}
        </button>
        <button onClick={handleReset} className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
          <RefreshCcw className="w-4 h-4" />重置
        </button>
      </div>

      <p className="text-sm text-muted-foreground">选择主题后立即预览效果，点击保存按钮永久保存。</p>
    </div>
  );
}
