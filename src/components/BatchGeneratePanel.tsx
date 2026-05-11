"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Wand2, Loader2, Square, Type } from "lucide-react";

export interface PageData {
  index: number;
  title: string;
  content: string;
  status: "pending" | "generating" | "done" | "failed";
  url: string | null;
  imageUrl: string | null;
  taskId: string | null;
}

interface BatchGeneratePanelProps {
  model: string | null;
  ratio: string;
  selectedScene: string[];
  selectedUsage: string[];
  selectedStyle: string[];
  selectedColor: string[];
  refImageUrl?: string | null;

  pages: PageData[];
  selectedIndices: Set<number>;
  onPagesChange: (updater: PageData[] | ((prev: PageData[]) => PageData[])) => void;
  onSelectedIndicesChange: (indices: Set<number>) => void;
}

export function splitStoryToScenes(text: string, pageCount: number): { title: string; content: string }[] {
  const targetCount = Math.max(1, Math.min(pageCount, 20));

  // 第一层：按段落拆分
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  if (paragraphs.length >= targetCount) {
    return paragraphs.slice(0, targetCount).map((p, i) => ({
      title: `第 ${i + 1} 页`,
      content: p.trim(),
    }));
  }

  // 第二层：按句子拆分
  const sentences = text.split(/[。！？.!?]+/).filter((s) => s.trim());
  if (sentences.length >= targetCount) {
    const perPage = Math.ceil(sentences.length / targetCount);
    const result: { title: string; content: string }[] = [];
    for (let i = 0; i < targetCount; i++) {
      const start = i * perPage;
      const end = Math.min(start + perPage, sentences.length);
      const content = sentences.slice(start, end).join("。") + "。";
      result.push({ title: `第 ${i + 1} 页`, content });
    }
    return result;
  }

  // 第三层：兜底处理 — 按字数均分
  const cleanText = text.replace(/\n/g, "").trim();
  const charsPerPage = Math.max(1, Math.ceil(cleanText.length / targetCount));
  const result: { title: string; content: string }[] = [];
  for (let i = 0; i < targetCount; i++) {
    const start = i * charsPerPage;
    const end = Math.min(start + charsPerPage, cleanText.length);
    const content = cleanText.slice(start, end);
    result.push({ title: `第 ${i + 1} 页`, content });
  }
  return result;
}

export default function BatchGeneratePanel({
  model,
  ratio,
  selectedScene,
  selectedUsage,
  selectedStyle,
  selectedColor,
  refImageUrl,
  pages,
  selectedIndices,
  onPagesChange,
  onSelectedIndicesChange,
}: BatchGeneratePanelProps) {
  const [batchPrompt, setBatchPrompt] = useState("");
  const [pageCount, setPageCount] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");

  const stopRef = useRef(false);
  const pagesRef = useRef(pages);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const handleSplit = useCallback(() => {
    const text = batchPrompt.trim();
    if (!text) {
      toast.error("请输入内容");
      return;
    }
    const newPages = splitStoryToScenes(text, pageCount);
    const pageData: PageData[] = newPages.map((p, i) => ({
      ...p,
      index: i,
      status: "pending",
      imageUrl: null,
      taskId: null,
      url: null,
    }));
    onPagesChange(pageData);
    onSelectedIndicesChange(new Set(newPages.map((_, i) => i)));
    toast.success(`已拆分为 ${newPages.length} 页，可手动编辑调整`);
  }, [batchPrompt, pageCount, onPagesChange, onSelectedIndicesChange]);

  const buildEnhancedPrompt = useCallback(
    (page: PageData, totalPages: number) => {
      const styleLabel = [selectedScene.join("。"), selectedUsage.join("。"), selectedStyle.join("。"), selectedColor.join("。")]
        .filter(Boolean)
        .join("。") || "海报";

      return `【${page.title}】第${page.index + 1}页，共${totalPages}页

页面标题：${page.title}
页面内容：${page.content}

设计要求：${styleLabel}风格`;
    },
    [selectedScene, selectedUsage, selectedStyle, selectedColor]
  );

  const handleBatchGenerate = useCallback(async () => {
    const currentPages = pagesRef.current;
    const toGen = currentPages.filter((p) => selectedIndices.has(p.index));
    if (!toGen.length) {
      toast.error("请至少选择一页");
      return;
    }

    stopRef.current = false;
    setIsGenerating(true);
    setProgress(0);
    setProgressStatus("准备生成...");

    const totalPages = toGen.length;
    let succeeded = 0;

    for (let i = 0; i < toGen.length; i++) {
      if (stopRef.current) break;

      const page = toGen[i];
      onPagesChange((prev) =>
        prev.map((p) => (p.index === page.index ? { ...p, status: "generating" } : p))
      );
      setProgressStatus(`正在生成第 ${i + 1}/${totalPages} 页：${page.title}`);
      setProgress(Math.round((i / totalPages) * 100));

      let pageSuccess = false;
      let attempt = 0;

      while (attempt < 3 && !pageSuccess && !stopRef.current) {
        attempt++;
        try {
          const enhancedPrompt = buildEnhancedPrompt(page, totalPages);

          const body: Record<string, unknown> = {
            model,
            ratio,
            count: 1,
            replyType: "json",
            siteId: process.env.NEXT_PUBLIC_SITE_ID || "main",
          };

          if (refImageUrl) {
            body.refImageUrl = refImageUrl;
            body.prompt = `${enhancedPrompt}\n\n（重要风格约束：请严格参考参考图的视觉风格、配色方案、排版布局和字体风格进行生成，确保与参考图保持高度统一的视觉语言。）`;
          } else {
            body.prompt = enhancedPrompt;
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

          try {
            const res = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const result = await res.json().catch(() => ({}));

            if (!res.ok || !result.success) {
              const errMsg = result.error || result.results?.[0]?.error || `第 ${page.index + 1} 页生成失败`;
              const isViolation = /moderation|violation|违规|敏感|不合规|内容审核|审核不通过/i.test(errMsg);
              if (isViolation && attempt < 3) {
                toast.warning(`第 ${page.index + 1} 页检测到内容违规，自动调整后重试（${attempt}/3）...`);
                continue;
              }
              throw new Error(errMsg);
            }

            const firstResult = result.results?.[0];
            if (firstResult?.success && firstResult.data?.url) {
              const resultUrl = firstResult.data.url as string;
              const taskId = (firstResult.data.taskId as string) || "";
              pageSuccess = true;
              succeeded++;
              onPagesChange((prev) =>
                prev.map((p) =>
                  p.index === page.index
                    ? { ...p, status: "done", imageUrl: resultUrl, taskId }
                    : p
                )
              );
            } else {
              throw new Error(firstResult?.error || "未获取到图片地址");
            }
          } catch (err: unknown) {
            clearTimeout(timeoutId);
            throw err;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "生成失败";
          const isViolation = /moderation|violation|违规|敏感|不合规|内容审核|审核不通过/i.test(msg);
          if (isViolation && attempt < 3) {
            toast.warning(`第 ${page.index + 1} 页内容违规，自动调整后重试（${attempt}/3）...`);
            continue;
          }
          toast.error(`第 ${page.index + 1} 页生成失败：${msg}`);
          onPagesChange((prev) =>
            prev.map((p) => (p.index === page.index ? { ...p, status: "failed" } : p))
          );
        }
      }
    }

    setProgress(100);
    setProgressStatus(stopRef.current ? "已停止" : "生成完成");
    setIsGenerating(false);
    if (!stopRef.current) {
      toast.success(`批量生成完成，成功 ${succeeded}/${totalPages} 页`);
    }
  }, [selectedIndices, model, ratio, buildEnhancedPrompt, refImageUrl, onPagesChange]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
    setProgressStatus("正在停止...");
  }, []);

  const pageCountOptions = [2, 3, 4, 5, 6, 8, 10];

  return (
    <div className="space-y-4">
      {/* Page Count Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">拆分页数：</span>
        {pageCountOptions.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPageCount(n)}
            className={cn(
              "px-2 py-1 text-xs rounded-lg transition-all border-2",
              pageCount === n
                ? "bg-primary/10 border-primary text-primary"
                : "bg-secondary border-transparent hover:border-border"
            )}
          >
            {n} 页
          </button>
        ))}
      </div>

      {/* Batch Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold">内容输入</label>
          <span className="text-xs text-muted-foreground">支持长文本、Markdown</span>
        </div>
        <textarea
          value={batchPrompt}
          onChange={(e) => setBatchPrompt(e.target.value)}
          placeholder="输入完整的内容文案，系统将自动分页...\n例如：产品介绍、演讲稿、故事脚本、数据报告等"
          className="w-full min-h-[160px] px-4 py-3 rounded-xl border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
        />
      </div>

      {/* Split Button */}
      <Button
        onClick={handleSplit}
        disabled={!batchPrompt.trim()}
        variant="outline"
        className="w-full py-5 text-base font-bold rounded-2xl transition-all border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5"
      >
        <div className="flex items-center gap-3">
          <Type className="w-5 h-5" />
          <span>自动拆分为 {pageCount} 页</span>
        </div>
      </Button>

      {/* Batch Generate / Stop Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleBatchGenerate}
          disabled={isGenerating || selectedIndices.size === 0}
          className={cn(
            "flex-1 py-5 text-base font-bold rounded-2xl transition-all shadow-lg",
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
        {isGenerating && (
          <Button
            onClick={handleStop}
            variant="destructive"
            className="px-6 py-5 text-base font-bold rounded-2xl transition-all shadow-lg hover:bg-destructive/90"
          >
            <Square className="w-4 h-4 mr-2" />
            停止
          </Button>
        )}
      </div>
    </div>
  );
}
