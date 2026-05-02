'use client';

import { useState } from 'react';
import { Download, Plus, CheckCircle2, XCircle, Loader2, ExternalLink, Trash2, Wand2 } from 'lucide-react';

// 任务 ID 提取正则：匹配类似 "13-9c2513b3-cae5-47a7-a92c-f8d91011db95" 的格式
const TASK_ID_REGEX = /\b\d{1,2}-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;

const extractTaskIds = (text: string): string[] => {
  const matches = text.match(TASK_ID_REGEX);
  return matches ? [...new Set(matches)] : [];
};

// Extract a single "chunk" of text around each task ID for context
const extractTextChunks = (text: string): Map<string, string> => {
  const chunks = new Map<string, string>();
  const ids = extractTaskIds(text);
  
  for (const id of ids) {
    const idx = text.indexOf(id);
    if (idx === -1) continue;
    // Extract ±500 chars around the task ID for context
    const start = Math.max(0, idx - 200);
    const end = Math.min(text.length, idx + id.length + 500);
    chunks.set(id, text.substring(start, end));
  }
  
  return chunks;
};

interface ImportResult {
  success: boolean;
  count?: number;
  skipped?: boolean;
  source?: string;
  error?: string;
}

interface ImportEntry {
  taskId: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  result?: ImportResult;
  timestamp: string;
}

export default function AdminImportPage() {
  const [taskId, setTaskId] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [imports, setImports] = useState<ImportEntry[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [batchIds, setBatchIds] = useState('');
  const [extractedCount, setExtractedCount] = useState(0);

  const handleBatchIdsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBatchIds(text);
    const extracted = extractTaskIds(text);
    setExtractedCount(extracted.length);
  };

  const handleImport = async (id: string, rawText?: string) => {
    console.log('[Import] Starting import for:', id, rawText ? 'with raw text context' : 'without raw text');
    const entry: ImportEntry = {
      taskId: id,
      status: 'loading',
      timestamp: new Date().toLocaleString(),
    };
    setImports((prev) => [entry, ...prev]);

    try {
      console.log('[Import] Sending request to API');
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ import: { taskId: id, rawText: rawText || '' } }),
      });
      console.log('[Import] Response status:', res.status);
      const data: ImportResult = await res.json();
      console.log('[Import] Response data:', data);

      setImports((prev) =>
        prev.map((item) =>
          item.taskId === id ? { ...item, status: res.ok && data.success ? 'success' : 'error', result: data } : item
        )
      );
    } catch (err) {
      console.error('[Import] Error:', err);
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

  const handleSingleImport = () => {
    const extracted = extractTaskIds(rawInput || taskId);
    const contextText = rawInput || taskId;
    if (extracted.length > 0) {
      // Use the first extracted ID with the full text as context
      const chunks = extractTextChunks(contextText);
      handleImport(extracted[0], chunks.get(extracted[0]) || contextText);
    } else if (taskId.trim()) {
      handleImport(taskId.trim(), contextText);
    }
  };

  const handleBatchImport = async () => {
    const ids = extractTaskIds(batchIds);
    
    if (ids.length === 0) {
      // Try splitting by newlines as fallback
      const fallbackIds = batchIds
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      
      for (const id of fallbackIds) {
        await handleImport(id);
      }
    } else {
      // Use extracted IDs with context
      const chunks = extractTextChunks(batchIds);
      for (const id of ids) {
        await handleImport(id, chunks.get(id) || '');
      }
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
          直接粘贴 GrsAI 任务列表的任意文字（表格、日志等），系统将自动提取任务 ID、图片 URL 和描述信息进行导入。即使 GrsAI API 查询不到结果，也能从粘贴内容中提取图片数据。
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
          <div className="space-y-3">
            <textarea
              value={rawInput || taskId}
              onChange={(e) => {
                setRawInput(e.target.value);
                setTaskId(e.target.value);
              }}
              placeholder={'粘贴包含任务 ID 的文字，例如：\n13-9c2513b3-cae5-47a7-a92c-f8d91011db95  gpt-image-2  成功  制作图文小店价格表\n{"aspectRatio":"1:1","prompt":"制作图文小店价格表",...}'}
              rows={4}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <button
              onClick={handleSingleImport}
              disabled={!rawInput.trim() && !taskId.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
                placeholder={'粘贴 GrsAI 任务列表的任意文字，系统自动提取任务 ID：\n13-9c2513b3-cae5-47a7-a92c-f8d91011db95  gpt-image-2  成功  制作图文小店价格表\n15-f34f1e4b-9f01-4410-9f10-2f20f70a9977  gpt-image-2  成功  生成长春动物园...'}
                rows={8}
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
              批量导入 ({extractedCount || batchIds.split('\n').filter((s) => s.trim()).length} 个)
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
                    {entry.status === 'success' && (
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
                      {entry.result.skipped ? '已存在，跳过' : `成功导入 ${entry.result.count || 0} 张图片`}
                      {entry.result.source === 'text_extraction' && ' (从文字提取)'}
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
          <li>直接粘贴 GrsAI 任务列表的完整文字即可，系统会自动提取图片 URL 和描述</li>
          <li>即使 GrsAI API 查询不到结果，也能从粘贴的文字中提取图片数据导入</li>
          <li>导入成功后，图片会自动上传到 S3 并出现在海报广场中</li>
          <li>已导入过的任务会自动跳过，不会重复导入</li>
        </ol>
      </div>
    </div>
  );
}
