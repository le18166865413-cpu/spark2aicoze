'use client';

import { useState, useEffect } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, Palette, Check } from 'lucide-react';

const THEMES = [
  { id: 'green', name: '翡翠绿', color: 'bg-emerald-500' },
  { id: 'blue', name: '天际蓝', color: 'bg-blue-500' },
  { id: 'purple', name: '星空紫', color: 'bg-purple-500' },
  { id: 'orange', name: '落日橙', color: 'bg-orange-500' },
  { id: 'red', name: '烈焰红', color: 'bg-red-500' },
  { id: 'neutral', name: '极简灰', color: 'bg-neutral-500' },
];

const MODES = [
  { id: 'dark', name: '暗色模式' },
  { id: 'light', name: '亮色模式' },
];

export default function ThemePage() {
  const { loading, getSetting, saveSettings } = useAdminSettings();
  const [theme, setTheme] = useState('green');
  const [mode, setMode] = useState('dark');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && !initialized) {
      setTheme(getSetting('theme_color') || 'green');
      setMode(getSetting('theme_mode') || 'dark');
      setInitialized(true);
    }
  }, [loading, initialized, getSetting]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings([
        { key: 'theme_color', value: theme },
        { key: 'theme_mode', value: mode },
      ]);
      setMessage({ type: 'success', text: '主题设置已保存，刷新页面生效' });
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
    <div className="space-y-6">
      {message && <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{message.text}</div>}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">主色调</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => setTheme(t.id)} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${theme === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
              <div className={`w-6 h-6 rounded-full ${t.color} flex items-center justify-center`}>
                {theme === t.id && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm text-foreground">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">显示模式</h3>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} className={`p-3 rounded-lg border cursor-pointer transition-colors text-center ${mode === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
              <span className="text-sm font-medium text-foreground">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
        <Save className="w-4 h-4" />{saving ? '保存中...' : '保存主题'}
      </button>
    </div>
  );
}
