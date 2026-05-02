'use client';

import { useState } from 'react';
import { Download, Plus, CheckCircle2, XCircle, Loader2, ExternalLink, Trash2, Wand2 } from 'lucide-react';

// 任务 ID 提取正则：匹配类似 "13-9c2513b3-cae5-47a7-a92c-f8d91011db95" 的格式
const TASK_ID_REGEX = /\b\d{1,2}-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;

const extractTaskIds = (text: string): string[] => {
  const matches = text.match(TASK_ID_REGEX);
  return matches ? [...new Set(matches)] : [];
};

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
  const [extractedCount, setExtractedCount] = useState(0);

  const handleBatchIdsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBatchIds(text);
    const extracted = extractTaskIds(text);
    setExtractedCount(extracted.length);
    if (extracted.length > 0) {
      setBatchIds(extracted.join('\n'));
    }
  };

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
    setExtractedCount(0);
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
          输入 GrsAI 的任务 ID，或直接粘贴任意包含任务 ID 的文字，系统将自动提取并导入。导入的图片会自动上传到 S3 存储并生成永久访问链接。
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
              placeholder="输入 GrsAI 任务 ID，或粘贴任意包含任务 ID 的文字"
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              onKeyDown={(e) => e.key === 'Enter' && taskId.trim() && handleImport(taskId.trim())}
            />
            <button
              onClick={() => {
                const extracted = extractTaskIds(taskId);
                if (extracted.length > 0) {
                  handleImport(extracted[0]);
                } else if (taskId.trim()) {
                  handleImport(taskId.trim());
                }
              }}
              disabled={!taskId.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              导入
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={batchIds}
                onChange={handleBatchIdsChange}
                placeholder="粘贴任意包含任务 ID 的文字，支持自动提取&#10;例如：13-9c2513b3-cae5-47a7-a92c-f8d91011db95	gpt-image-2-600 55s 成功..."
                rows={6}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
              {extractedCount > 0 && (
                <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-medium">
                  <Wand2 className="w-3 h-3" />
                  已提取 {extractedCount} 个任务 ID
                </div>
              )}
            </div>
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
          <li>支持从任意文字中自动提取任务 ID（格式：13-9c2513b3-cae5-47a7-a92c-f8d91011db95）</li>
          <li>直接粘贴包含任务 ID 的表格、日志或任意文字即可</li>
          <li>系统会自动查询 GrsAI 获取图片结果，上传到 S3 并保存到数据库</li>
          <li>导入成功后，图片会立即出现在海报广场中</li>
          <li>批量模式：粘贴多段文字，自动提取所有任务 ID 依次导入</li>
        </ol>
      </div>
    </div>
  );
}