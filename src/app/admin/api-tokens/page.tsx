'use client';

import { useState, useEffect } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, Key, Eye, EyeOff, Zap, CheckCircle, XCircle } from 'lucide-react';
// Note: Eye/EyeOff still used for API Key toggle

export default function ApiTokensPage() {
  const { loading, getSetting, saveSettings } = useAdminSettings();
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('image2');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && !initialized) {
      setApiKey(getSetting('grsai_api_key') || '');
      setBaseUrl(getSetting('grsai_base_url') || 'https://grsai.dakka.com.cn');
      setDefaultModel(getSetting('default_model') || 'image2');
      setInitialized(true);
    }
  }, [loading, initialized, getSetting]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings([
        { key: 'grsai_api_key', value: apiKey },
        { key: 'grsai_base_url', value: baseUrl },
        { key: 'default_model', value: defaultModel },
      ]);
      setMessage({ type: 'success', text: 'API 配置已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const key = apiKey || getSetting('grsai_api_key');
      const url = baseUrl || getSetting('grsai_base_url') || 'https://grsai.dakka.com.cn';
      const resp = await fetch(`${url}/v1/draw/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'nano-banana-fast', prompt: 'test', n: 1, size: '1024x1024' }),
      });
      if (resp.ok || resp.status === 200) {
        setTestResult({ ok: true, msg: '连接成功！API Key 有效' });
      } else {
        const data = await resp.json().catch(() => ({}));
        setTestResult({ ok: false, msg: `连接失败: ${data.error?.message || resp.statusText}` });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: `网络错误: ${err instanceof Error ? err.message : 'Unknown'}` });
    }
    setTesting(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground"><Key className="w-5 h-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {message && <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{message.text}</div>}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">API 配置</h3>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="sk-xxxx" />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Base URL</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type="password" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="https://grsai.dakka.com.cn" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">默认模型</h3>
        {[
          { id: 'image2-vip', label: 'Spark2 VIP', desc: '最高画质，支持2K/4K' },
          { id: 'image2', label: 'Spark2', desc: '高画质性价比之选' },
          { id: 'nano-banana-fast', label: 'Spark Lite', desc: '适合纯图，无文字' },
          { id: 'nano-banana-2', label: 'Spark2 Nano', desc: '新一代模型，支持超长比例' },
          { id: 'nano-banana-pro-vip', label: 'Spark Pro VIP', desc: '专业画质，支持2K/4K' },
        ].map((model) => (
          <label key={model.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${defaultModel === model.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
            <input type="radio" name="model" value={model.id} checked={defaultModel === model.id} onChange={() => setDefaultModel(model.id)} className="accent-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">{model.label}</p>
              <p className="text-xs text-muted-foreground">{model.desc}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />{saving ? '保存中...' : '保存配置'}
        </button>
        <button onClick={handleTest} disabled={testing} className="flex items-center gap-2 px-5 py-2.5 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
          <Zap className="w-4 h-4" />{testing ? '测试中...' : '测试连接'}
        </button>
      </div>

      {testResult && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.ok ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
          {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{testResult.msg}
        </div>
      )}
    </div>
  );
}
