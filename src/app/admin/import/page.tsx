'use client';

import { useState } from 'react';
import { Download, Plus, CheckCircle2, XCircle, Loader2, ExternalLink, Trash2 } from 'lucide-react';

interface ImportResult {
  success: boolean;
  count?: number;
  imported?: Array<{ id: string; prompt: string }>;
  error?: string;
  existing?: string;
}

interface ImportEntry {
  taskId: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  result?: ImportResult;
  timestamp: string;
}

export default function AdminImportPage() {
  const [taskId, setTaskId] = useState('');
  const [imports, setImports] = useState<ImportEntry[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [batchIds, setBatchIds] = useState('');

  const handleImport = async (id: string) => {
    const entry: ImportEntry = {
      taskId: id,
      status: 'loading',
      timestamp: new Date().toLocaleString(),
    };
    setImports((prev) => [entry, ...prev]);

    try {
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch(`/api/admin/import?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: id }),
      });
      const data: ImportResult = await res.json();

      setImports((prev) =>
        prev.map((item) =>
          item.taskId === id ? { ...item, status: res.ok && data.success ? 'success' : 'error', result: data } : item
        )
      );
    } catch (err) {
      setImports((prev) =>
        prev.map((item) =>
          item.taskId === id
            ? { ...item, status: 'error', result: { success: false, error: err instanceof Error ? err.message : '导入失败' } }
            : item
        )
      );
    }

    setTaskId('');
  };

  const handleBatchImport = async () => {
    const ids = batchIds
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) return;

    for (const id of ids) {
      await handleImport(id);
    }
    setBatchIds('');
  };

  const handleRemoveEntry = (taskId: string) => {
    setImports((prev) => prev.filter((item) => item.taskId !== taskId));
  };

  return (
    <div className="space-y-6">
      {/* Import Form */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Download className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">手动导入任务</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          输入 GrsAI 的任务 ID，系统将自动查询结果并将图片导入到海报广场。导入的图片会自动上传到 S3 存储并生成永久访问链接。
        </p>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setBatchMode(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !batchMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            单个导入
          </button>
          <button
            onClick={() => setBatchMode(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              batchMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            批量导入
          </button>
        </div>

        {!batchMode ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="输入 GrsAI 任务 ID，如：12-243d7f75-b4e7-4570-b5f4-3417fff6ee30"
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              onKeyDown={(e) => e.key === 'Enter' && taskId.trim() && handleImport(taskId.trim())}
            />
            <button
              onClick={() => taskId.trim() && handleImport(taskId.trim())}
              disabled={!taskId.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              导入
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={batchIds}
              onChange={(e) => setBatchIds(e.target.value)}
              placeholder="每行一个任务 ID&#10;12-243d7f75-b4e7-4570-b5f4-3417fff6ee30&#10;12-abc12345-xxxx-yyyy-zzzz-wwww1234abcd"
              rows={5}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <button
              onClick={handleBatchImport}
              disabled={!batchIds.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              批量导入 ({batchIds.split('\n').filter((s) => s.trim()).length} 个)
            </button>
          </div>
        )}
      </div>

      {/* Import History */}
      {imports.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">导入记录</h3>
          <div className="space-y-2">
            {imports.map((entry) => (
              <div
                key={`${entry.taskId}-${entry.timestamp}`}
                className="flex items-start gap-3 p-3 bg-background border border-border rounded-lg"
              >
                {/* Status Icon */}
                <div className="mt-0.5 shrink-0">
                  {entry.status === 'loading' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                  {entry.status === 'success' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  {entry.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-foreground truncate">{entry.taskId}</code>
                    {entry.status === 'success' && entry.result?.imported && (
                      <a
                        href="/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {entry.status === 'success' && entry.result && (
                    <p className="text-xs text-primary mt-0.5">
                      成功导入 {entry.result.count} 张图片
                      {entry.result.imported?.map((i) => i.prompt).join(', ')}
                    </p>
                  )}
                  {entry.status === 'error' && entry.result?.error && (
                    <p className="text-xs text-destructive mt-0.5">{entry.result.error}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.timestamp}</p>
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemoveEntry(entry.taskId)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guide */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">使用说明</h3>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>在创作中心生成海报时，浏览器控制台会显示 GrsAI 返回的任务 ID</li>
          <li>将任务 ID 复制到上方的输入框中，点击「导入」</li>
          <li>系统会自动查询 GrsAI 获取图片结果，上传到 S3 并保存到数据库</li>
          <li>导入成功后，图片会立即出现在海报广场中</li>
          <li>支持批量导入：切换到批量模式，每行输入一个任务 ID</li>
        </ol>
      </div>
    </div>
  );
}
