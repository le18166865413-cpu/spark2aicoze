"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Wand2,
  Loader2,
  Check,
  Trash2,
  Square,
  LayoutTemplate,
  Palette,
  Type,
  Pencil,
  X,
} from "lucide-react";

interface PageData {
  index: number;
  title: string;
  content: string;
  status: "idle" | "generating" | "done" | "error";
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
  sceneOpts: string[];
  usageOpts: string[];
  styleOpts: string[];
  colorOpts: string[];
  templates: { label: string; prompt: string }[];
  refImageUrl?: string | null;
  onResultClick?: (imageUrl: string) => void;
}

function splitStoryToScenes(text: string, pageCount: number): { title: string; content: string }[] {
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
  templates,
  refImageUrl,
  onResultClick,
}: BatchGeneratePanelProps) {
  const [batchPrompt, setBatchPrompt] = useState("");
  const [pages, setPages] = useState<PageData[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [pageCount, setPageCount] = useState(4);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<{ label: string; prompt: string } | null>(null);

  const stopRef = useRef(false);

  const handleSplit = useCallback(() => {
    const text = batchPrompt.trim();
    if (!text) {
      toast.error("请输入内容");
      return;
    }
    const newPages = splitStoryToScenes(text, pageCount);
    setPages(
      newPages.map((p, i) => ({
        ...p,
        index: i,
        status: "idle",
        imageUrl: null,
        taskId: null,
      }))
    );
    setSelectedIndices(new Set(newPages.map((_, i) => i)));
    setEditingIndex(null);
    toast.success(`已拆分为 ${newPages.length} 页，可手动编辑调整`);
  }, [batchPrompt, pageCount]);

  const toggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIndices((prev) => {
      if (prev.size === pages.length) {
        return new Set();
      }
      return new Set(pages.map((p) => p.index));
    });
  }, [pages]);

  const removePage = useCallback((index: number) => {
    setPages((prev) => prev.filter((p) => p.index !== index).map((p, i) => ({ ...p, index: i })));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      });
      return next;
    });
    setEditingIndex(null);
  }, []);

  const startEdit = useCallback((index: number) => {
    const page = pages.find((p) => p.index === index);
    if (!page) return;
    setEditingIndex(index);
    setEditTitle(page.title);
    setEditContent(page.content);
  }, [pages]);

  const saveEdit = useCallback(() => {
    if (editingIndex === null) return;
    setPages((prev) =>
      prev.map((p) =>
        p.index === editingIndex
          ? { ...p, title: editTitle.trim() || p.title, content: editContent.trim() || p.content }
          : p
      )
    );
    setEditingIndex(null);
    toast.success("已保存修改");
  }, [editingIndex, editTitle, editContent]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const buildEnhancedPrompt = useCallback(
    (page: PageData, totalPages: number) => {
      const styleLabel = [selectedScene.join("、"), selectedUsage.join("、"), selectedStyle.join("、"), selectedColor.join("、")]
        .filter(Boolean)
        .join("、") || "海报";

      return `【${page.title}】第${page.index + 1}页，共${totalPages}页

页面标题：${page.title}
页面内容：${page.content}

设计要求：${styleLabel}风格

重要：这是系列海报中的第${page.index + 1}页，必须与整套${totalPages}页保持统一的视觉风格、配色方案、排版布局和字体风格。确保与前后页形成连贯的系列感。`;
    },
    [selectedScene, selectedUsage, selectedStyle, selectedColor]
  );

  const handleBatchGenerate = useCallback(async () => {
    const toGen = pages.filter((p) => selectedIndices.has(p.index));
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
      setPages((prev) =>
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
          } else if (selectedTemplate) {
            body.prompt = `${enhancedPrompt}\n\n请严格遵循以下模板样式进行排版：\n${selectedTemplate.prompt}`;
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
              setPages((prev) =>
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
          setPages((prev) =>
            prev.map((p) => (p.index === page.index ? { ...p, status: "error" } : p))
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
  }, [pages, selectedIndices, model, ratio, selectedTemplate, buildEnhancedPrompt, refImageUrl]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
    setProgressStatus("正在停止...");
  }, []);

  const doneCount = useMemo(() => pages.filter((p) => p.status === "done").length, [pages]);

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
          placeholder="输入完整的内容文案，系统将自动分页...&#10;例如：产品介绍、演讲稿、故事脚本、数据报告等"
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

      {/* Pages Preview */}
      {pages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">
              页面内容
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
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
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
                  {editingIndex === page.index ? (
                    <div className="space-y-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-2 py-1 text-sm font-medium rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                        placeholder="页面标题"
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded border border-border bg-background resize-y min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
                        placeholder="页面内容"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-primary">第 {page.index + 1} 页</span>
                        <span className="text-xs font-medium text-foreground truncate">{page.title}</span>
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
                    </>
                  )}
                </div>
                {editingIndex !== page.index && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(page.index)}
                      className="p-1 text-muted-foreground hover:text-primary transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePage(page.index)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template Selector */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-semibold">辅助模板（可选）</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTemplate(null)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg border-2 transition-all",
                !selectedTemplate
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-secondary border-transparent hover:border-border"
              )}
            >
              不使用模板
            </button>
            {templates.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setSelectedTemplate(t)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-lg border-2 transition-all",
                  selectedTemplate?.label === t.label
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-secondary border-transparent hover:border-border"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
                    src={page.imageUrl!}
                    alt={`第${page.index + 1}页 ${page.title}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                    第 {page.index + 1} 页
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
                    {page.title}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
