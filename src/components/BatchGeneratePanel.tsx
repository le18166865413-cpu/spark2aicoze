"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2, Check, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface BatchPage {
  index: number;
  content: string;
  status: "pending" | "generating" | "done" | "error";
  imageUrl?: string;
  taskId?: string;
}

interface BatchGeneratePanelProps {
  model: string;
  ratio: string;
  selectedScene: string[];
  selectedUsage: string[];
  selectedStyle: string[];
  selectedColor: string[];
  sceneOpts: string[];
  usageOpts: string[];
  styleOpts: string[];
  colorOpts: string[];
  templates: { label: string; prompt: string }[];
  onResultClick?: (imageUrl: string) => void;
}

export default function BatchGeneratePanel({
  model,
  ratio,
  selectedScene,
  selectedUsage,
  selectedStyle,
  selectedColor,
  sceneOpts,
  usageOpts,
  styleOpts,
  colorOpts,
  templates,
  onResultClick,
}: BatchGeneratePanelProps) {
  const [batchPrompt, setBatchPrompt] = useState("");
  const [batchMode, setBatchMode] = useState<"auto" | "line" | "separator">("auto");
  const [pages, setPages] = useState<BatchPage[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");

  const parsePages = useCallback((text: string, mode: string) => {
    if (!text.trim()) return [];
    let raw: string[] = [];
    if (mode === "line") {
      raw = text.split("\n").map((s) => s.trim()).filter(Boolean);
    } else if (mode === "separator") {
      raw = text.split(/---+/).map((s) => s.trim()).filter(Boolean);
    } else {
      raw = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    }
    return raw.map((content, i) => ({
      index: i,
      content,
      status: "pending" as const,
    }));
  }, []);

  const handleParse = useCallback(() => {
    const parsed = parsePages(batchPrompt, batchMode);
    setPages(parsed);
    setSelectedIndices(new Set(parsed.map((p) => p.index)));
    toast.success(`已解析 ${parsed.length} 页`);
  }, [batchPrompt, batchMode, parsePages]);

  const toggleSelect = useCallback((idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIndices.size === pages.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(pages.map((p) => p.index)));
    }
  }, [selectedIndices.size, pages]);

  const removePage = useCallback((idx: number) => {
    setPages((prev) => prev.filter((p) => p.index !== idx));
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  }, []);

  const buildEnhancedPrompt = useCallback((pageContent: string) => {
    let enhanced = pageContent;
    const sc = selectedScene.length ? `，场景：${selectedScene.join("、")}` : "";
    const us = selectedUsage.length ? `，用途：${selectedUsage.join("、")}` : "";
    const st = selectedStyle.length ? `，风格：${selectedStyle.join("、")}` : "";
    const co = selectedColor.length ? `，颜色：${selectedColor.join("、")}` : "";
    enhanced += `${sc}${us}${st}${co}`;
    return enhanced;
  }, [selectedScene, selectedUsage, selectedStyle, selectedColor]);

  const handleBatchGenerate = useCallback(async () => {
    const toGen = pages.filter((p) => selectedIndices.has(p.index));
    if (!toGen.length) {
      toast.error("请至少选择一页");
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setProgressStatus("准备生成...");

    const updatedPages = [...pages];

    for (let i = 0; i < toGen.length; i++) {
      const page = toGen[i];
      const pageIdx = updatedPages.findIndex((p) => p.index === page.index);
      if (pageIdx === -1) continue;

      updatedPages[pageIdx] = { ...updatedPages[pageIdx], status: "generating" };
      setPages([...updatedPages]);
      setProgressStatus(`正在生成第 ${i + 1}/${toGen.length} 页...`);
      setProgress(Math.round((i / toGen.length) * 100));

      try {
        const enhancedPrompt = buildEnhancedPrompt(page.content);
        const body: Record<string, unknown> = {
          model,
          ratio,
          count: 1,
          siteId: process.env.NEXT_PUBLIC_SITE_ID || "main",
        };

        const selectedTemplate = templates.length > 0 ? templates[0] : null;
        if (selectedTemplate) {
          body.templates = [selectedTemplate.label];
          body.prompt = `${enhancedPrompt}\n\n请严格遵循以下模板样式进行排版：\n${selectedTemplate.prompt}`;
        } else {
          body.prompt = enhancedPrompt;
        }

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `第 ${i + 1} 页生成失败`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("无法读取响应");

        const decoder = new TextDecoder();
        let buffer = "";
        let resultUrl = "";
        let taskId = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]") continue;
            try {
              const data = JSON.parse(jsonStr);
              if (data.type === "image" && data.url) {
                resultUrl = data.url;
              }
              if (data.taskId) {
                taskId = data.taskId;
              }
            } catch { /* ignore */ }
          }
        }

        if (resultUrl) {
          updatedPages[pageIdx] = {
            ...updatedPages[pageIdx],
            status: "done",
            imageUrl: resultUrl,
            taskId,
          };
        } else {
          updatedPages[pageIdx] = { ...updatedPages[pageIdx], status: "error" };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "生成失败";
        updatedPages[pageIdx] = { ...updatedPages[pageIdx], status: "error" };
        toast.error(msg);
      }

      setPages([...updatedPages]);
    }

    setProgress(100);
    setProgressStatus("生成完成");
    setIsGenerating(false);
    toast.success(`批量生成完成，成功 ${updatedPages.filter((p) => p.status === "done").length}/${toGen.length} 页`);
  }, [pages, selectedIndices, model, ratio, templates, buildEnhancedPrompt]);

  const doneCount = useMemo(() => pages.filter((p) => p.status === "done").length, [pages]);

  return (
    <div className="space-y-4">
      {/* Batch Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold">批量文案</label>
          <span className="text-xs text-muted-foreground">{pages.length} 页</span>
        </div>
        <textarea
          value={batchPrompt}
          onChange={(e) => setBatchPrompt(e.target.value)}
          placeholder="输入多页文案，每段或每行为一页内容...&#10;使用 --- 作为手动分页分隔符"
          className="w-full min-h-[160px] px-4 py-3 rounded-xl border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
        />
      </div>

      {/* Parse Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">分页方式：</span>
        {[
          { key: "auto", label: "自动分段" },
          { key: "line", label: "按行分页" },
          { key: "separator", label: "手动分隔" },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setBatchMode(opt.key as "auto" | "line" | "separator")}
            className={cn(
              "px-2 py-1 text-xs rounded-lg transition-all border-2",
              batchMode === opt.key
                ? "bg-primary/10 border-primary text-primary"
                : "bg-secondary border-transparent hover:border-border"
            )}
          >
            {opt.label}
          </button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={handleParse}
          disabled={!batchPrompt.trim() || isGenerating}
          className="ml-auto text-xs h-8"
        >
          解析分页
        </Button>
      </div>

      {/* Pages Preview */}
      {pages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">
              页码预览
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                已选 {selectedIndices.size}/{pages.length}
              </span>
            </label>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs text-primary hover:underline"
            >
              {selectedIndices.size === pages.length ? "取消全选" : "全选"}
            </button>
          </div>
          <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
            {pages.map((page) => (
              <div
                key={page.index}
                className={cn(
                  "flex items-start gap-2 p-3 rounded-xl border-2 transition-all",
                  selectedIndices.has(page.index)
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background",
                  page.status === "done" && "border-green-500/30 bg-green-500/5",
                  page.status === "error" && "border-red-500/30 bg-red-500/5"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleSelect(page.index)}
                  className={cn(
                    "mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                    selectedIndices.has(page.index)
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border bg-background"
                  )}
                >
                  {selectedIndices.has(page.index) && <Check className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-primary">第 {page.index + 1} 页</span>
                    {page.status === "generating" && (
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    )}
                    {page.status === "done" && (
                      <span className="text-[10px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">完成</span>
                    )}
                    {page.status === "error" && (
                      <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">失败</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{page.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removePage(page.index)}
                  className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch Generate Button */}
      <Button
        onClick={handleBatchGenerate}
        disabled={isGenerating || selectedIndices.size === 0}
        className={cn(
          "w-full py-5 text-base font-bold rounded-2xl transition-all shadow-lg",
          isGenerating
            ? "bg-muted cursor-not-allowed"
            : "bg-primary hover:bg-primary/90"
        )}
      >
        {isGenerating ? (
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{progressStatus} ({progress}%)</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Wand2 className="w-5 h-5" />
            批量生成 {selectedIndices.size > 0 ? `(${selectedIndices.size}页)` : ""}
          </div>
        )}
      </Button>

      {/* Results Gallery */}
      {doneCount > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">生成结果</label>
            <span className="text-xs text-muted-foreground">{doneCount} 张</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {pages
              .filter((p) => p.status === "done" && p.imageUrl)
              .map((page) => (
                <div
                  key={page.index}
                  onClick={() => onResultClick?.(page.imageUrl!)}
                  className="group cursor-pointer relative rounded-xl overflow-hidden border border-border bg-muted aspect-[3/4]"
                >
                  <img
                    src={page.imageUrl}
                    alt={`第${page.index + 1}页`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                    第 {page.index + 1} 页
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
