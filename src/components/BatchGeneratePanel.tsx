"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Type } from "lucide-react";

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
  onPagesChange,
  onSelectedIndicesChange,
}: BatchGeneratePanelProps) {
  const [batchPrompt, setBatchPrompt] = useState("");
  const [pageCount, setPageCount] = useState(4);

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
    </div>
  );
}
