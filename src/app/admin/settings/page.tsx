'use client';

import { useState, useEffect } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, Globe, ToggleLeft, ToggleRight } from 'lucide-react';

export default function AdminSettingsPage() {
  const { loading, getSetting, saveSettings } = useAdminSettings();
  const [siteName, setSiteName] = useState('');
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [siteEnabled, setSiteEnabled] = useState(true);
  const [registerEnabled, setRegisterEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && !initialized) {
      setSiteName(getSetting('site_name') || 'SparkAI');
      setSiteTitle(getSetting('site_title') || 'SparkAI - 智能海报生成器');
      setSiteDescription(getSetting('site_description') || 'AI 驱动的海报生成与展示平台');
      setSiteEnabled(getSetting('site_enabled') !== 'false');
      setRegisterEnabled(getSetting('register_enabled') !== 'false');
      setInitialized(true);
    }
  }, [loading, initialized, getSetting]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings([
        { key: 'site_name', value: siteName },
        { key: 'site_title', value: siteTitle },
        { key: 'site_description', value: siteDescription },
        { key: 'site_enabled', value: siteEnabled ? 'true' : 'false' },
        { key: 'register_enabled', value: registerEnabled ? 'true' : 'false' },
      ]);
      setMessage({ type: 'success', text: '设置已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Save className="w-5 h-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">站点信息</h3>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">站点名称</label>
          <input type="text" value={siteName} onChange={(e) => setSiteName(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="SparkAI" />
          <p className="text-xs text-muted-foreground">显示在导航栏和侧边栏</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">网站标题</label>
          <input type="text" value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="SparkAI - 智能海报生成器" />
          <p className="text-xs text-muted-foreground">显示在浏览器标签页上</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">站点描述</label>
          <textarea value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} rows={3} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" placeholder="AI 驱动的海报生成与展示平台" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">功能开关</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">站点开放</p>
            <p className="text-xs text-muted-foreground">关闭后用户将无法访问前台页面</p>
          </div>
          <button onClick={() => setSiteEnabled(!siteEnabled)} className="text-primary">
            {siteEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">允许注册</p>
            <p className="text-xs text-muted-foreground">控制新用户是否可以注册账号</p>
          </div>
          <button onClick={() => setRegisterEnabled(!registerEnabled)} className="text-primary">
            {registerEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
          </button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
        <Save className="w-4 h-4" />
        {saving ? '保存中...' : '保存设置'}
      </button>
    </div>
  );
}
