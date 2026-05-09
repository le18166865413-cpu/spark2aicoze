'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, Palette, Check, RefreshCcw, Pipette } from 'lucide-react';

const THEMES = [
  { id: 'green', name: '翡翠绿', color: 'bg-emerald-500', hex: '#22C55E' },
  { id: 'teal', name: '湖水青', color: 'bg-teal-500', hex: '#14B8A6' },
  { id: 'cyan', name: '天穹青', color: 'bg-cyan-500', hex: '#06B6D4' },
  { id: 'sky', name: '晴空蓝', color: 'bg-sky-500', hex: '#0EA5E9' },
  { id: 'blue', name: '天际蓝', color: 'bg-blue-500', hex: '#3B82F6' },
  { id: 'indigo', name: '靛青蓝', color: 'bg-indigo-500', hex: '#6366F1' },
  { id: 'violet', name: '紫罗兰', color: 'bg-violet-500', hex: '#8B5CF6' },
  { id: 'purple', name: '星空紫', color: 'bg-purple-500', hex: '#A855F7' },
  { id: 'fuchsia', name: '洋红紫', color: 'bg-fuchsia-500', hex: '#D946EF' },
  { id: 'pink', name: '樱花粉', color: 'bg-pink-500', hex: '#EC4899' },
  { id: 'rose', name: '玫瑰红', color: 'bg-rose-500', hex: '#F43F5E' },
  { id: 'red', name: '烈焰红', color: 'bg-red-500', hex: '#EF4444' },
  { id: 'orange', name: '落日橙', color: 'bg-orange-500', hex: '#F97316' },
  { id: 'amber', name: '琥珀黄', color: 'bg-amber-500', hex: '#F59E0B' },
  { id: 'yellow', name: '柠檬黄', color: 'bg-yellow-500', hex: '#EAB308' },
  { id: 'lime', name: '青柠绿', color: 'bg-lime-500', hex: '#84CC16' },
  { id: 'neutral', name: '极简灰', color: 'bg-neutral-500', hex: '#71717A' },
  { id: 'stone', name: '暖石灰', color: 'bg-stone-500', hex: '#78716C' },
  { id: 'slate', name: '岩石灰', color: 'bg-slate-500', hex: '#64748B' },
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

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const v = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function ColorWheel({ size, onSelect }: { size: number; onSelect: (hex: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);

    for (let angle = 0; angle < 360; angle++) {
      const start = ((angle - 1) * Math.PI) / 180;
      const end = ((angle + 1) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }

    // Inner white circle for ring look
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--card, #111113)';
    ctx.fill();
  }, [size]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = size / 2;
    const cy = size / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = size / 2 - 4;

    if (dist < radius * 0.55 || dist > radius) return;

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    const hex = hslToHex(angle, 100, 50);
    setCursor({ x, y });
    onSelect(hex);
  };

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        onPointerDown={handlePointer}
        onPointerMove={(e) => { if (e.buttons === 1) handlePointer(e); }}
        className="cursor-crosshair rounded-full"
        style={{ width: size, height: size, touchAction: 'none' }}
      />
      {cursor && (
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
          style={{
            left: cursor.x - 6,
            top: cursor.y - 6,
            backgroundColor: 'transparent',
          }}
        />
      )}
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
      setInitialized(true);
    }
  }, [loading, initialized, getSetting]);

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

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const settings = [
        { key: 'theme_color', value: theme },
        { key: 'theme_mode', value: mode },
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

  const currentHex = isCustom ? customHex : (THEMES.find((t) => t.id === theme)?.hex || '#22C55E');

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground"><Palette className="w-5 h-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {message && <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{message.text}</div>}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">主色调</h3>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => handleThemeChange(t.id)} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${theme === t.id && !isCustom ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
              <div className={`w-5 h-5 rounded-full ${t.color} flex items-center justify-center shrink-0`}>
                {theme === t.id && !isCustom && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-xs text-foreground truncate">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Pipette className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">自定义颜色</h3>
        </div>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <ColorWheel size={180} onSelect={handleCustomHex} />
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-lg border border-border shadow-inner"
                style={{ backgroundColor: currentHex }}
              />
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">当前颜色</div>
                <div className="text-sm font-mono font-medium text-foreground">{currentHex.toUpperCase()}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={customHex}
                onChange={(e) => handleCustomHex(e.target.value)}
                className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
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
            </div>
            {isCustom && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs">
                <Check className="w-3 h-3" /> 已启用自定义
              </div>
            )}
          </div>
        </div>
      </div>

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

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />{saving ? '保存中...' : '保存主题'}
        </button>
        <button onClick={() => {
          setTheme('green');
          setMode('dark');
          setIsCustom(false);
          setCustomHex('#22C55E');
          applyThemeColor('#22C55E');
          applyThemeMode('dark');
        }} className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
          <RefreshCcw className="w-4 h-4" />重置
        </button>
      </div>

      <p className="text-sm text-muted-foreground">选择主题后立即预览效果，点击保存按钮永久保存。</p>
    </div>
  );
}
