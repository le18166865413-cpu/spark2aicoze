'use client';

import { useState } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, Key, Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function AdminApiTokensPage() {
  const { loading, saving, message, saveSettings, get } = useAdminSettings();
  const [grsaiApiKey, setGrsaiApiKey] = useState('');
  const [grsaiBaseUrl, setGrsaiBaseUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [availableModels, setAvailableModels] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (!loading && !initialized) {
    setGrsaiApiKey(get('api', 'grsai_api_key', ''));
    setGrsaiBaseUrl(get('api', 'grsai_base_url', 'https://grsai.dakka.com.cn'));
    setDefaultModel(get('api', 'default_model', 'gpt-image-2'));
    setAvailableModels(get('api', 'available_models', 'gpt-image-2-vip,gpt-image-2,nano-banana-fast'));
    setInitialized(true);
  }

  const handleSave = () => {
    saveSettings({
      grsai_api_key: grsaiApiKey,
      grsai_base_url: grsaiBaseUrl,
      default_model: defaultModel,
      available_models: availableModels,
    });
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return key;
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  const testConnection = async () => {
    if (!grsaiApiKey) {
      alert('请先填写 API Key');
      return;
    }
    try {
      const res = await fetch(`${grsaiBaseUrl}/v1/draw/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grsaiApiKey}`,
        },
        body: JSON.stringify({ model: defaultModel, prompt: 'test', n: 1, size: '1024x1024' }),
      });
      if (res.ok || res.status === 400) {
        alert('连接成功！API Key 有效');
      } else {
        alert(`连接失败：HTTP ${res.status}`);
      }
    } catch (err) {
      alert(`连接失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Key className="w-5 h-5 animate-spin mr-2" /> 加载中...
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

      {/* GrsAI API Key */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">GrsAI 令牌配置</h3>
        </div>

        {!grsaiApiKey && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-200">尚未配置 API Key，图片生成功能将无法使用</p>
          </div>
        )}

        {grsaiApiKey && (
          <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-primary">API Key 已配置</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={showKey ? grsaiApiKey : maskKey(grsaiApiKey)}
              onChange={(e) => {
                if (showKey) setGrsaiApiKey(e.target.value);
                else { setShowKey(true); setGrsaiApiKey(e.target.value); }
              }}
              onFocus={() => setShowKey(true)}
              className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="sk-xxxxxxxxxxxxxxxx"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">API Base URL</label>
          <input
            type="text"
            value={grsaiBaseUrl}
            onChange={(e) => setGrsaiBaseUrl(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="https://grsai.dakka.com.cn"
          />
        </div>

        <button
          onClick={testConnection}
          className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted/50 transition-colors"
        >
          测试连接
        </button>
      </div>

      {/* Model Configuration */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">模型配置</h3>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">默认生成模型</label>
          <select
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="gpt-image-2-vip">Image2 VIP - 最高画质</option>
            <option value="gpt-image-2">Image2 - 高画质性价比之选</option>
            <option value="nano-banana-fast">Nano Banana Fast - 极速生成</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">可用模型列表（逗号分隔）</label>
          <input
            type="text"
            value={availableModels}
            onChange={(e) => setAvailableModels(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="gpt-image-2-vip,gpt-image-2,nano-banana-fast"
          />
          <p className="text-xs text-muted-foreground">
            前端将根据此列表展示可选模型，修改后需重启服务生效
          </p>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        <Save className="w-4 h-4" />
        {saving ? '保存中...' : '保存设置'}
      </button>
    </div>
  );
}
