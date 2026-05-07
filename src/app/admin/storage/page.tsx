'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, HardDrive, Info, Trash2, RefreshCw, FileImage, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface StorageStats {
  totalFiles: number;
  estimatedSizeMB: number;
  extensions: Record<string, number>;
  files: string[];
}

export default function StoragePage() {
  const { loading, getSetting, saveSettings } = useAdminSettings();
  const [bucket, setBucket] = useState('');
  const [region, setRegion] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Storage stats
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !initialized) {
      setBucket(getSetting('s3_bucket') || '');
      setRegion(getSetting('s3_region') || '');
      setEndpoint(getSetting('s3_endpoint') || '');
      setInitialized(true);
    }
  }, [loading, initialized, getSetting]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/storage/stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch storage stats:', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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

  const handleDelete = async (key: string) => {
    if (!confirm(`确定删除文件 "${key}" 吗？此操作不可恢复。`)) return;
    setDeleting(key);
    try {
      const res = await fetch('/api/admin/storage/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: '文件已删除' });
        fetchStats();
      } else {
        setMessage({ type: 'error', text: data.error || '删除失败' });
      }
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '删除请求失败' });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground"><HardDrive className="w-5 h-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Storage Usage Stats */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileImage className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">存储用量</h3>
          </div>
          <button
            onClick={fetchStats}
            disabled={statsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {statsLoading && !stats ? (
          <div className="text-sm text-muted-foreground py-4 text-center">加载统计数据...</div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-foreground">{stats.totalFiles}</div>
                <div className="text-xs text-muted-foreground mt-1">文件总数</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-foreground">~{stats.estimatedSizeMB}</div>
                <div className="text-xs text-muted-foreground mt-1">预估容量 (MB)</div>
              </div>
            </div>

            {Object.keys(stats.extensions).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">文件类型分布</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.extensions).map(([ext, count]) => (
                    <span key={ext} className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-md text-xs">
                      <span className="font-medium text-foreground">.{ext}</span>
                      <span className="text-muted-foreground">{count}个</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* File List */}
            {stats.files.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">文件列表 ({stats.files.length})</div>
                <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {stats.files.map((key) => (
                    <div key={key} className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 rounded-lg group hover:bg-muted/60 transition-colors">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileImage className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-foreground truncate font-mono">{key}</span>
                      </div>
                      <button
                        onClick={() => handleDelete(key)}
                        disabled={deleting === key}
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0 disabled:opacity-50"
                        title="删除文件"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">无法加载统计数据</div>
        )}
      </div>

      {/* S3 Config */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>当前使用 coze-coding-dev-sdk 内置 S3Storage，以下配置为可选项。留空则使用默认存储。</span>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">S3 存储配置</h3>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Bucket 名称</label>
          <input type="text" value={bucket} onChange={(e) => setBucket(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="my-poster-bucket" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Region</label>
          <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="us-east-1" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">自定义 Endpoint</label>
          <input type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="https://s3.example.com" />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
        <Save className="w-4 h-4" />{saving ? '保存中...' : '保存配置'}
      </button>
    </div>
  );
}
