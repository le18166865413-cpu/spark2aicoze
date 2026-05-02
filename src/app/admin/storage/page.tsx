'use client';

import { useState } from 'react';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { Save, HardDrive, Database, Trash2, RefreshCw } from 'lucide-react';

export default function AdminStoragePage() {
  const { loading, saving, message, saveSettings, get } = useAdminSettings();
  const [storageType, setStorageType] = useState('s3');
  const [maxFileSize, setMaxFileSize] = useState('10');
  const [initialized, setInitialized] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  if (!loading && !initialized) {
    setStorageType(get('storage', 'storage_type', 's3'));
    setMaxFileSize((parseInt(get('storage', 'max_file_size', '10485760')) / 1024 / 1024).toString());
    setInitialized(true);
  }

  const handleSave = () => {
    saveSettings({
      storage_type: storageType,
      max_file_size: (parseInt(maxFileSize) * 1024 * 1024).toString(),
    });
  };

  const handleCleanup = async () => {
    if (!confirm('确定清理孤立记录？此操作将删除没有有效图片 URL 的记录。')) return;
    setCleaning(true);
    try {
      // Simple cleanup: remove records with empty URLs
      const res = await fetch('/api/images?limit=1000');
      const data = await res.json();
      const images = Array.isArray(data) ? data : [];
      let cleaned = 0;
      for (const img of images) {
        if (!img.url || img.url === '' || img.url === 'undefined') {
          await fetch(`/api/images/${img.id}`, { method: 'DELETE' });
          cleaned++;
        }
      }
      alert(`清理完成，移除了 ${cleaned} 条无效记录`);
    } catch {
      alert('清理失败');
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <HardDrive className="w-5 h-5 animate-spin mr-2" /> 加载中...
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

      {/* Storage Config */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">存储配置</h3>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">存储类型</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setStorageType('s3')}
              className={`p-4 rounded-xl border text-left transition-colors ${
                storageType === 's3'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">S3 对象存储</span>
              </div>
              <p className="text-xs text-muted-foreground">使用 S3 兼容对象存储服务</p>
            </button>
            <button
              onClick={() => setStorageType('local')}
              className={`p-4 rounded-xl border text-left transition-colors ${
                storageType === 'local'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-foreground">本地存储</span>
              </div>
              <p className="text-xs text-muted-foreground">存储在服务器本地（不推荐生产环境）</p>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">最大文件大小 (MB)</label>
          <input
            type="number"
            value={maxFileSize}
            onChange={(e) => setMaxFileSize(e.target.value)}
            min="1"
            max="100"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="text-xs text-muted-foreground">
            上传参考图和生成图片的大小限制，建议不超过 50MB
          </p>
        </div>
      </div>

      {/* S3 Info */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">S3 存储信息</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-muted-foreground">存储桶</span>
          <span className="text-foreground font-mono">coze-coding-project</span>
          <span className="text-muted-foreground">区域</span>
          <span className="text-foreground font-mono">自动配置</span>
          <span className="text-muted-foreground">访问方式</span>
          <span className="text-foreground font-mono">签名 URL (永久)</span>
          <span className="text-muted-foreground">签名有效期</span>
          <span className="text-foreground font-mono">永久 (expire_time=0)</span>
        </div>
      </div>

      {/* Maintenance */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">维护工具</h3>
        <div className="flex gap-3">
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            {cleaning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {cleaning ? '清理中...' : '清理孤立记录'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          清理孤立记录将删除没有有效图片 URL 的数据记录，不会影响正常的图片
        </p>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        <Save className="w-4 h-4" />
        {saving ? '保存中...' : '保存存储设置'}
      </button>
    </div>
  );
}
