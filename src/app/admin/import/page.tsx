"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, ImagePlus, Upload, Wand2, ArrowUpFromLine, CheckCircle2, XCircle, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";

const TASK_ID_REGEX = /\d+-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;

function extractTaskIds(text: string): string[] {
  const matches = text.match(TASK_ID_REGEX);
  if (!matches) return [];
  return [...new Set(matches)];
}

interface ImportResult {
  taskId: string;
  status: "success" | "skipped" | "error";
  message: string;
  source?: string;
}

export default function AdminImportPage() {
  const [singleInput, setSingleInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [extractedIds, setExtractedIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);

  // Auto-extract task IDs from batch input
  useEffect(() => {
    if (batchInput.trim()) {
      const ids = extractTaskIds(batchInput);
      setExtractedIds(ids);
    } else {
      setExtractedIds([]);
    }
  }, [batchInput]);

  const handleImport = async (taskId: string): Promise<ImportResult> => {
    try {
      console.log("[Import] Starting import for:", taskId);
      
      const context = batchInput || singleInput;
      
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import: { taskId, context } }),
      });

      const data = await res.json();
      console.log("[Import] Response:", data);

      if (data.success) {
        return { taskId, status: "success", message: "导入成功", source: data.source || "GrsAI API" };
      } else if (data.skipped) {
        return { taskId, status: "skipped", message: data.message || "已存在", source: data.source };
      } else {
        return { taskId, status: "error", message: data.error || "导入失败" };
      }
    } catch (error) {
      return { taskId, status: "error", message: "网络错误" };
    }
  };

  const handleSingleImport = async () => {
    const text = singleInput.trim();
    if (!text) {
      toast.error("请输入任务ID或包含任务ID的文字");
      return;
    }

    const ids = extractTaskIds(text);
    const taskId = ids.length > 0 ? ids[0] : text.split(/[\s,，\n]+/)[0];

    if (!taskId) {
      toast.error("未找到有效的任务ID");
      return;
    }

    setImporting(true);
    setResults([]);
    const result = await handleImport(taskId);
    setResults([result]);
    
    if (result.status === "success") {
      toast.success("导入成功！");
    } else if (result.status === "skipped") {
      toast.info(result.message);
    } else {
      toast.error(result.message);
    }
    setImporting(false);
  };

  const handleBatchImport = async () => {
    if (extractedIds.length === 0) {
      toast.error("未找到有效的任务ID，请粘贴包含任务ID的文字");
      return;
    }

    setImporting(true);
    setResults([]);
    const batchResults: ImportResult[] = [];

    for (const taskId of extractedIds) {
      const result = await handleImport(taskId);
      batchResults.push(result);
      setResults([...batchResults]);
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 500));
    }

    const successCount = batchResults.filter((r) => r.status === "success").length;
    const skippedCount = batchResults.filter((r) => r.status === "skipped").length;
    const errorCount = batchResults.filter((r) => r.status === "error").length;

    if (successCount > 0) toast.success(`成功导入 ${successCount} 个任务`);
    if (skippedCount > 0) toast.info(`${skippedCount} 个任务已存在`);
    if (errorCount > 0) toast.error(`${errorCount} 个任务导入失败`);

    setImporting(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">任务导入</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">通过 GrsAI 任务 ID 导入已生成的图片到海报广场</p>
      </div>

      {/* Tips */}
      <div className="bg-primary/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-primary/10">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
            <p><strong className="text-foreground">支持自动提取</strong>：直接粘贴任务列表、日志或任意文字，系统会自动提取任务 ID</p>
            <p>任务 ID 格式：<code className="text-primary bg-primary/10 px-1 rounded text-[10px] sm:text-xs">13-9c2513b3-cae5-47a7-a92c-f8d91011db95</code></p>
            <p className="text-muted-foreground/80">注意：GrsAI 平台仅保留任务结果约2小时</p>
          </div>
        </div>
      </div>

      {/* Single Import */}
      <div className="bg-card rounded-lg sm:rounded-xl p-4 sm:p-6 border border-border">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />单个导入
        </h2>
        <Textarea
          value={singleInput}
          onChange={(e) => setSingleInput(e.target.value)}
          placeholder="粘贴任务 ID 或包含任务 ID 的文字...&#10;例如：13-9c2513b3-cae5-47a7-a92c-f8d91011db95"
          className="min-h-[80px] sm:min-h-[100px] text-sm resize-none"
        />
        <Button
          onClick={handleSingleImport}
          disabled={importing || !singleInput.trim()}
          className="mt-3 w-full sm:w-auto text-sm"
        >
          {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4 mr-2" />}
          导入
        </Button>
      </div>

      {/* Batch Import */}
      <div className="bg-card rounded-lg sm:rounded-xl p-4 sm:p-6 border border-border">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />批量导入
          {extractedIds.length > 0 && (
            <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              <Wand2 className="w-3 h-3" />提取到 {extractedIds.length} 个 ID
            </span>
          )}
        </h2>
        <Textarea
          value={batchInput}
          onChange={(e) => setBatchInput(e.target.value)}
          placeholder={"粘贴包含多个任务 ID 的文字，例如：\n13-9c2513b3-cae5-47a7-a92c-f8d91011db95  gpt-image-2  成功\n15-f34f1e4b-9f01-4410-9f10-2f20f70a9977  gpt-image-2  成功"}
          className="min-h-[120px] sm:min-h-[160px] text-xs sm:text-sm resize-none font-mono"
        />
        {extractedIds.length > 0 && (
          <div className="mt-2 p-2 sm:p-3 bg-muted/50 rounded-lg">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5">已提取的任务 ID：</p>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {extractedIds.map((id) => (
                <code key={id} className="text-[10px] sm:text-xs bg-background px-1.5 py-0.5 rounded border border-border">{id.slice(0, 8)}...</code>
              ))}
            </div>
          </div>
        )}
        <Button
          onClick={handleBatchImport}
          disabled={importing || extractedIds.length === 0}
          className="mt-3 w-full text-sm"
        >
          {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4 mr-2" />}
          {importing ? "导入中..." : `批量导入 (${extractedIds.length})`}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-card rounded-lg sm:rounded-xl p-4 sm:p-6 border border-border">
          <h2 className="text-base sm:text-lg font-semibold mb-3">导入结果</h2>
          <div className="space-y-2">
            {results.map((r) => (
              <div
                key={r.taskId}
                className={`flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm ${
                  r.status === "success" ? "bg-green-500/10 text-green-700 dark:text-green-400" :
                  r.status === "skipped" ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" :
                  "bg-red-500/10 text-red-700 dark:text-red-400"
                }`}
              >
                {r.status === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> :
                 r.status === "skipped" ? <Info className="w-4 h-4 mt-0.5 shrink-0" /> :
                 <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] sm:text-xs break-all">{r.taskId}</p>
                  <p>{r.message}{r.source ? ` (${r.source})` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
