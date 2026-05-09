'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, Plus, CheckCircle2, XCircle, Loader2, ExternalLink, Trash2, Wand2, RefreshCw, Clock, ToggleLeft, ToggleRight, CloudDownload, ImageIcon, AlertTriangle, ShieldCheck } from 'lucide-react';

// 任务 ID 提取正则
const TASK_ID_REGEX = /\b\d{1,2}-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;

const extractTaskIds = (text: string): string[] => {
  const matches = text.match(TASK_ID_REGEX);
  return matches ? [...new Set(matches)] : [];
};

const extractTextChunks = (text: string): Map<string, string> => {
  const chunks = new Map<string, string>();
  const ids = extractTaskIds(text);
  for (const id of ids) {
    const idx = text.indexOf(id);
    if (idx === -1) continue;
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
  auto?: boolean;
}

interface AutoSyncStatus {
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncCount: number;
  nextSyncAt: string | null;
}

export default function AdminImportPage() {
  const [taskId, setTaskId] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [imports, setImports] = useState<ImportEntry[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [batchIds, setBatchIds] = useState('');
  const [extractedCount, setExtractedCount] = useState(0);
  const [autoSyncStatus, setAutoSyncStatus] = useState<AutoSyncStatus>({
    enabled: false,
    lastSyncAt: null,
    lastSyncCount: 0,
    nextSyncAt: null,
  });
  const [syncingNow, setSyncingNow] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // GrsAI Dashboard 配置
  const [grsaiToken, setGrsaiToken] = useState('');
  const [grsaiXtx, setGrsaiXtx] = useState('');
  const [grsaiSyncing, setGrsaiSyncing] = useState(false);
  const [grsaiSyncResult, setGrsaiSyncResult] = useState<{total: number; imported: number; skipped: number; failed: number} | null>(null);
  const [grsaiTasks, setGrsaiTasks] = useState<{taskId: string; prompt: string; status: string; model: string; url?: string; createdAt: string}[]>([]);
  const [grsaiAutoSync, setGrsaiAutoSync] = useState(false);

  // 图片健康检测
  interface HealthItem {
    id: string;
    prompt: string;
    taskId: string | null;
    exists: boolean;
    reason: string;
  }
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResults, setHealthResults] = useState<HealthItem[]>([]);
  const [healthPage, setHealthPage] = useState(1);
  const [healthTotal, setHealthTotal] = useState(0);
  const [healthBrokenCount, setHealthBrokenCount] = useState(0);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // 加载 GrsAI 配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/admin/settings', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const settings = data.settings || [];
          const tokenSetting = settings.find((s: {key: string; value: string}) => s.key === 'grsai_dashboard_token');
          const xtxSetting = settings.find((s: {key: string; value: string}) => s.key === 'grsai_dashboard_xtx');
          const autoSyncSetting = settings.find((s: {key: string; value: string}) => s.key === 'grsai_auto_sync_enabled');
          if (tokenSetting) setGrsaiToken(tokenSetting.value);
          if (xtxSetting) setGrsaiXtx(xtxSetting.value);
          if (autoSyncSetting) setGrsaiAutoSync(autoSyncSetting.value === 'true');
        }
      } catch {
        // ignore
      }
    };
    loadConfig();
  }, []);

  const handleSaveGrsaiConfig = async () => {
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings: [
            { key: 'grsai_dashboard_token', value: grsaiToken },
            { key: 'grsai_dashboard_xtx', value: grsaiXtx },
          ],
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleGrsaiSync = async () => {
    setGrsaiSyncing(true);
    setGrsaiSyncResult(null);
    try {
      const res = await fetch('/api/admin/grsai/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: grsaiToken, xtx: grsaiXtx }),
      });
      const data = await res.json();
      if (data.success) {
        setGrsaiSyncResult({
          total: data.total ?? 0,
          imported: data.imported ?? 0,
          skipped: data.skipped ?? 0,
          failed: data.failed ?? 0,
        });
        if (data.tasks && data.tasks.length > 0) {
          setGrsaiTasks(data.tasks);
        }
        // 刷新导入记录
        if (data.imported && data.imported > 0) {
          setImports((prev) => [
            {
              taskId: `GrsAI抓取 - ${data.imported} 张`,
              status: 'success',
              result: { success: true, count: data.imported },
              timestamp: new Date().toLocaleString(),
              auto: true,
            },
            ...prev,
          ]);
        }
      }
    } catch {
      // ignore
    }
    setGrsaiSyncing(false);
  };

  const handleToggleAutoSync = async (checked: boolean) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings: [{ key: 'grsai_auto_sync_enabled', value: String(checked), category: 'grsai' }],
        }),
      });
      if (res.ok) {
        setGrsaiAutoSync(checked);
      }
    } catch {
      // ignore
    }
  };

  // 加载自动同步状态
  useEffect(() => {
    const loadAutoSyncStatus = async () => {
      try {
        const res = await fetch('/api/admin/sync-auto', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setAutoSyncStatus({
            enabled: data.enabled ?? false,
            lastSyncAt: data.lastSync ?? null,
            lastSyncCount: 0,
            nextSyncAt: data.nextSync ?? null,
          });
        }
      } catch {
        // ignore
      }
    };
    loadAutoSyncStatus();
  }, []);

  // 自动同步定时器
  useEffect(() => {
    if (autoSyncStatus.enabled) {
      syncIntervalRef.current = setInterval(async () => {
        await triggerAutoSync();
      }, 60 * 60 * 1000); // 1小时
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [autoSyncStatus.enabled]);

  const triggerAutoSync = async () => {
    setSyncingNow(true);
    try {
      const res = await fetch('/api/admin/sync-auto', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      const syncedCount = data.synced ?? data.imported ?? 0;
      if (syncedCount > 0) {
        setImports((prev) => [
          {
            taskId: `自动同步 - ${syncedCount} 张`,
            status: 'success',
            result: { success: true, count: syncedCount },
            timestamp: new Date().toLocaleString(),
            auto: true,
          },
          ...prev,
        ]);
      }
      setAutoSyncStatus((prev) => ({
        ...prev,
        lastSyncAt: new Date().toISOString(),
        lastSyncCount: syncedCount,
      }));
    } catch {
      // ignore
    }
    setSyncingNow(false);
  };

  const toggleAutoSync = async () => {
    const newEnabled = !autoSyncStatus.enabled;
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings: [{ key: 'auto_sync_enabled', value: String(newEnabled) }],
        }),
      });
      setAutoSyncStatus((prev) => ({ ...prev, enabled: newEnabled }));
    } catch {
      // ignore
    }
  };

  const handleBatchIdsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBatchIds(text);
    const extracted = extractTaskIds(text);
    setExtractedCount(extracted.length);
  };

  const handleImport = async (id: string, rawText?: string) => {
    const entry: ImportEntry = {
      taskId: id,
      status: 'loading',
      timestamp: new Date().toLocaleString(),
    };
    setImports((prev) => [entry, ...prev]);

    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ import: { taskId: id, rawText: rawText || '' } }),
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

  const handleSingleImport = () => {
    const extracted = extractTaskIds(rawInput || taskId);
    const contextText = rawInput || taskId;
    if (extracted.length > 0) {
      const chunks = extractTextChunks(contextText);
      handleImport(extracted[0], chunks.get(extracted[0]) || contextText);
    } else if (taskId.trim()) {
      handleImport(taskId.trim(), contextText);
    }
  };

  const handleBatchImport = async () => {
    const ids = extractTaskIds(batchIds);
    if (ids.length === 0) {
      const fallbackIds = batchIds.split('\n').map((s) => s.trim()).filter(Boolean);
      for (const id of fallbackIds) {
        await handleImport(id);
      }
    } else {
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

  // 图片健康检测
  const handleHealthCheck = async (pageNum = 1) => {
    setHealthChecking(true);
    try {
      const res = await fetch('/api/admin/images/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ page: pageNum, pageSize: 20 }),
      });
      const data = await res.json();
      if (res.ok) {
        setHealthResults(data.results || []);
        setHealthTotal(data.total || 0);
        setHealthBrokenCount(data.brokenCount || 0);
        setHealthPage(pageNum);
      }
    } catch {
      // ignore
    }
    setHealthChecking(false);
  };

  const handleDeleteBroken = async (ids: string[]) => {
    setDeletingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/images/${id}`, { method: 'DELETE', credentials: 'include' })
        )
      );
      setHealthResults((prev) => prev.filter((r) => !ids.includes(r.id)));
      setHealthBrokenCount((prev) => Math.max(0, prev - ids.length));
    } catch {
      // ignore
    }
    setDeletingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* 自动监控导入 */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">自动监控导入</h3>
          </div>
          <button onClick={toggleAutoSync} className="flex items-center gap-2 text-sm">
            {autoSyncStatus.enabled ? (
              <>
                <ToggleRight className="w-8 h-8 text-primary" />
                <span className="text-primary font-medium">已开启</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                <span className="text-muted-foreground">已关闭</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          开启后，系统将每小时自动检查并同步所有生成任务的结果，无需手动导入。
        </p>

        {autoSyncStatus.enabled && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {autoSyncStatus.lastSyncAt && (
              <span>上次同步：{new Date(autoSyncStatus.lastSyncAt).toLocaleString()}（{autoSyncStatus.lastSyncCount} 张）</span>
            )}
            <button
              onClick={triggerAutoSync}
              disabled={syncingNow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${syncingNow ? 'animate-spin' : ''}`} />
              {syncingNow ? '同步中...' : '立即同步'}
            </button>
          </div>
        )}
      </div>

      {/* GrsAI Dashboard 任务抓取 */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudDownload className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">GrsAI Dashboard 任务抓取</h3>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          从你的 GrsAI 网站控制台自动抓取历史生成任务并导入到海报广场。配置 Dashboard Token 后，点击抓取即可自动导入所有未入库的任务。
        </p>

        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${grsaiAutoSync ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
            <span className="text-xs font-medium">自动同步（每小时）</span>
          </div>
          <button
            onClick={() => handleToggleAutoSync(!grsaiAutoSync)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${grsaiAutoSync ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${grsaiAutoSync ? 'translate-x-4.5' : 'translate-x-1'}`}
            />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">一键粘贴请求代码（自动识别）</label>
            <textarea
              value=""
              onChange={(e) => {
                const text = e.target.value;
                if (!text.trim()) return;
                // Auto extract authorization and xtx
                const authMatch = text.match(/authorization[:\s]+(eyJ[\w-]*\.eyJ[\w-]*\.[\w-]*)/i);
                const xtxMatch = text.match(/xtx[:\s]+([a-f0-9]+)/i);
                let extracted = false;
                if (authMatch) {
                  setGrsaiToken(authMatch[1]);
                  extracted = true;
                }
                if (xtxMatch) {
                  setGrsaiXtx(xtxMatch[1]);
                  extracted = true;
                }
                if (extracted) {
                  setTimeout(() => handleSaveGrsaiConfig(), 0);
                }
                // Clear the textarea after extraction
                e.target.value = "";
              }}
              placeholder="直接把浏览器开发者工具里复制的整个请求代码（或 curl 命令）粘贴到这里，系统会自动识别并填写 Token 和 xtx"
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Dashboard Token (authorization)</label>
            <textarea
              value={grsaiToken}
              onChange={(e) => {
                setGrsaiToken(e.target.value);
                handleSaveGrsaiConfig();
              }}
              placeholder="登录 grsai.ai 后，在浏览器开发者工具 Network 面板中找到 getCreditsLogList 请求，复制 authorization header 的 JWT token"
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">xtx Header</label>
            <input
              type="text"
              value={grsaiXtx}
              onChange={(e) => {
                setGrsaiXtx(e.target.value);
                handleSaveGrsaiConfig();
              }}
              placeholder="复制同一请求中的 xtx header 值"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGrsaiSync}
              disabled={grsaiSyncing || !grsaiToken.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {grsaiSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
              抓取并导入
            </button>
            {grsaiSyncResult && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">共 {grsaiSyncResult.total} 条</span>
                <span className="text-primary">导入 {grsaiSyncResult.imported}</span>
                <span className="text-yellow-500">跳过 {grsaiSyncResult.skipped}</span>
                <span className="text-red-500">失败 {grsaiSyncResult.failed}</span>
              </div>
            )}
          </div>
        </div>

        {grsaiTasks.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-lg">
            {grsaiTasks.map((task) => (
              <div key={task.taskId} className="flex items-center gap-3 p-3 bg-background border-b border-border last:border-b-0">
                {task.url ? (
                  <img src={task.url} alt="" className="w-12 h-12 object-cover rounded shrink-0" loading="lazy" />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded shrink-0 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">无图</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{task.prompt}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <code className="text-[10px] font-mono text-muted-foreground">{task.taskId}</code>
                    <span className="text-[10px] text-muted-foreground">{task.model}</span>
                    <span className={`text-[10px] px-1 rounded ${task.status === 'succeeded' ? 'bg-primary/10 text-primary' : 'bg-yellow-500/10 text-yellow-500'}`}>{task.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 手动导入 */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Download className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">手动导入任务</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          直接粘贴任务列表的任意文字（表格、日志等），系统将自动提取任务 ID、图片 URL 和描述信息进行导入。即使 API 查询不到结果，也能从粘贴内容中提取图片数据。
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
              placeholder={'粘贴包含任务 ID 的文字，例如：\n13-9c2513b3-cae5-47a7-a92c-f8d91011db95  gpt-image-2  成功  制作图文小店价格表'}
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
                placeholder={'粘贴任务列表的任意文字，系统自动提取任务 ID：\n13-9c2513b3-cae5-47a7-a92c-f8d91011db95  gpt-image-2  成功  制作图文小店价格表\n15-f34f1e4b-9f01-4410-9f10-2f20f70a9977  gpt-image-2  成功  生成长春动物园...'}
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
                <div className="mt-0.5 shrink-0">
                  {entry.status === 'loading' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                  {entry.status === 'success' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  {entry.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-foreground truncate">{entry.taskId}</code>
                    {entry.auto && (
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded">
                        自动
                      </span>
                    )}
                    {entry.status === 'success' && !entry.auto && (
                      <a href="/" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0">
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

                <button onClick={() => handleRemoveEntry(entry.taskId)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 图片健康检测 */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">图片健康检测</h3>
          </div>
          <button
            onClick={() => handleHealthCheck(1)}
            disabled={healthChecking}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            {healthChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {healthChecking ? '检测中...' : '开始检测'}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          检测海报广场中的图片是否在当前 S3 存储中真实可访问。部署到新环境后，之前环境上传的图片可能因存储桶不同而失效，可在此批量检测并清理失效记录。
        </p>

        {healthResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">共检测 {healthTotal} 张</span>
              {healthBrokenCount > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertTriangle className="w-3 h-3" />
                  失效 {healthBrokenCount} 张
                </span>
              )}
              {healthBrokenCount === 0 && (
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle2 className="w-3 h-3" />
                  全部正常
                </span>
              )}
            </div>

            {healthBrokenCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const brokenIds = healthResults.filter((r) => !r.exists).map((r) => r.id);
                    if (brokenIds.length > 0 && confirm(`确定删除 ${brokenIds.length} 张失效图片记录吗？`)) {
                      handleDeleteBroken(brokenIds);
                    }
                  }}
                  disabled={deletingIds.size > 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  批量删除失效图片
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto border border-border rounded-lg">
              {healthResults.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-background border-b border-border last:border-b-0">
                  <div className="shrink-0">
                    {item.exists ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.prompt || '无描述'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-[10px] font-mono text-muted-foreground">{item.taskId || item.id}</code>
                      <span className={`text-[10px] px-1 rounded ${item.exists ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {item.exists ? '正常' : item.reason}
                      </span>
                    </div>
                  </div>
                  {!item.exists && (
                    <button
                      onClick={() => {
                        if (confirm('确定删除这张失效图片记录吗？')) {
                          handleDeleteBroken([item.id]);
                        }
                      }}
                      disabled={deletingIds.has(item.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {healthTotal >= 20 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">第 {healthPage} 页</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleHealthCheck(healthPage - 1)}
                    disabled={healthPage <= 1 || healthChecking}
                    className="px-2 py-1 bg-muted rounded text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => handleHealthCheck(healthPage + 1)}
                    disabled={healthResults.length < 20 || healthChecking}
                    className="px-2 py-1 bg-muted rounded text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guide */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">使用说明</h3>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>开启自动监控后，系统每小时自动同步所有生成任务的结果</li>
          <li>支持从任意文字中自动提取任务 ID（格式：13-9c2513b3-cae5-47a7-a92c-f8d91011db95）</li>
          <li>直接粘贴任务列表的完整文字即可，系统会自动提取图片 URL 和描述</li>
          <li>即使 API 查询不到结果，也能从粘贴的文字中提取图片数据导入</li>
          <li>导入成功后，图片会自动上传到存储并出现在海报广场中</li>
          <li>已导入过的任务会自动跳过，不会重复导入</li>
        </ol>
      </div>
    </div>
  );
}
