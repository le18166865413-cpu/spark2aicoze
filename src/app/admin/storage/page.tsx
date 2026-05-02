'use client';

import { useState, useEffect } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, HardDrive, Info } from 'lucide-react';

export default function StoragePage() {
  const { loading, getSetting, saveSettings } = useAdminSettings();
  const [bucket, setBucket] = useState('');
  const [region, setRegion] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && !initialized) {
      setBucket(getSetting('s3_bucket') || '');
      setRegion(getSetting('s3_region') || '');
      setEndpoint(getSetting('s3_endpoint') || '');
      setInitialized(true);
    }
  }, [loading, initialized, getSetting]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings([
        { key: 's3_bucket', value: bucket },
        { key: 's3_region', value: region },
        { key: 's3_endpoint', value: endpoint },
      ]);
      setMessage({ type: 'success', text: '存储配置已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground"><HardDrive className="w-5 h-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {message && <div className={`p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm ${message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{message.text}</div>}

      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs sm:text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>当前使用 coze-coding-dev-sdk 内置 S3Storage，以下配置为可选项。留空则使用默认存储。</span>
      </div>

      <div className="bg-card border border-border rounded-lg sm:rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 mb-1 sm:mb-2">
          <HardDrive className="w-4 h-4 text-primary" />
          <h3 className="text-xs sm:text-sm font-semibold text-foreground">S3 存储配置</h3>
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-xs sm:text-sm text-muted-foreground">Bucket 名称</label>
          <input type="text" value={bucket} onChange={(e) => setBucket(e.target.value)} className="w-full px-3 py-2 sm:py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="my-poster-bucket" />
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-xs sm:text-sm text-muted-foreground">Region</label>
          <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} className="w-full px-3 py-2 sm:py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="us-east-1" />
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-xs sm:text-sm text-muted-foreground">自定义 Endpoint</label>
          <input type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="w-full px-3 py-2 sm:py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="https://s3.example.com" />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
        <Save className="w-4 h-4" />{saving ? '保存中...' : '保存配置'}
      </button>
    </div>
  );
}
