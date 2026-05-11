"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2, Check, Trash2, BrainCircuit, FileText, LayoutTemplate, BookOpen, Network, Square } from "lucide-react";
import { toast } from "sonner";

interface BatchPage {
  index: number;
  title: string;
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

type BatchType = "ppt" | "comic" | "infographic" | "architecture";

const batchTypeOptions: { key: BatchType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "ppt", label: "PPT海报", icon: <LayoutTemplate className="w-4 h-4" />, desc: "演示文稿风格" },
  { key: "comic", label: "漫画故事", icon: <BookOpen className="w-4 h-4" />, desc: "故事板分镜" },
  { key: "infographic", label: "信息图", icon: <FileText className="w-4 h-4" />, desc: "数据可视化" },
  { key: "architecture", label: "架构图", icon: <Network className="w-4 h-4" />, desc: "系统/流程图" },
];

export default function BatchGeneratePanel({
  model,
  ratio,
  selectedScene,
  selectedUsage,
  selectedStyle,
  selectedColor,
  templates,
  onResultClick,
}: BatchGeneratePanelProps) {
  const [batchPrompt, setBatchPrompt] = useState("");
  const [batchType, setBatchType] = useState<BatchType>("ppt");
  const [pages, setPages] = useState<BatchPage[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [outlineTitle, setOutlineTitle] = useState("");
  const stopRef = useRef(false);

  const handleStop = useCallback(() => {
    stopRef.current = true;
    setIsGenerating(false);
    setProgressStatus("已停止");
    toast.info("批量生成已停止");
  }, []);

  // Smart analyze using LLM
  const handleAnalyze = useCallback(async () => {
    if (!batchPrompt.trim()) {
      toast.error("请先输入内容");
      return;
    }
    setIsAnalyzing(true);
    setProgressStatus("正在智能分析内容结构...");

    try {
      const res = await fetch("/api/batch-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: batchPrompt, mode: batchType }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "分析失败");
      }

      const { title, pages: analyzedPages } = data.data;
      setOutlineTitle(title);

      const newPages: BatchPage[] = analyzedPages.map((p: { title: string; content: string }, i: number) => ({
        index: i,
        title: p.title,
        content: p.content,
        status: "pending",
      }));

      setPages(newPages);
      setSelectedIndices(new Set(newPages.map((p) => p.index)));
      toast.success(`智能分析完成：「${title}」共 ${newPages.length} 页`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "分析失败";
      toast.error(msg);
    } finally {
      setIsAnalyzing(false);
      setProgressStatus("");
    }
  }, [batchPrompt, batchType]);

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

  const buildEnhancedPrompt = useCallback((
    page: BatchPage,
    totalPages: number,
    outlineTitleParam: string,
  ) => {
    // Core content with page context for consistency
    let enhanced = `【${outlineTitleParam}】第${page.index + 1}页，共${totalPages}页\n\n`;
    enhanced += `页面标题：${page.title}\n`;
    enhanced += `页面内容：${page.content}\n\n`;

    // Style consistency instructions
    enhanced += "设计要求：";
    const sc = selectedScene.length ? `场景：${selectedScene.join("、")}，` : "";
    const us = selectedUsage.length ? `用途：${selectedUsage.join("、")}，` : "";
    const st = selectedStyle.length ? `风格：${selectedStyle.join("、")}，` : "";
    const co = selectedColor.length ? `主色调：${selectedColor.join("、")}，` : "";
    enhanced += `${sc}${us}${st}${co}`;

    // Consistency instruction
    enhanced += "\n\n重要：这是系列海报中的第${page.index + 1}页，必须与整套${totalPages}页保持统一的视觉风格、配色方案、排版布局和字体风格。确保与前后页形成连贯的系列感。";

    return enhanced;
  }, [selectedScene, selectedUsage, selectedStyle, selectedColor]);

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
    const title = outlineTitle || "批量生成";
    const selectedTemplate = templates.length > 0 ? templates[0] : null;
    let lastSuccessUrl = "";
    let succeeded = 0;

    // Sanitize prompt for retry when moderation violation occurs
    const sanitizePrompt = (original: string, attempt: number): string => {
      let sanitized = original;
      // Remove sensitive marketing keywords on first retry
      if (attempt === 1) {
        const sensitiveWords = ["免费", "免费领取", "限时免费", "0元", "免费送", "无偿", "赠品", "赠送", "福利", "薅羊毛", "钜惠", "跳楼价", "清仓"];
        sensitiveWords.forEach((w) => {
          sanitized = sanitized.replace(new RegExp(w, "g"), "");
        });
        sanitized += "\n\n（注意：请确保画面内容积极健康，符合平台规范，避免出现夸大宣传或敏感营销信息）";
      }
      // Further simplify on second retry
      if (attempt === 2) {
        sanitized = sanitized
          .replace(/促销|优惠|折扣|特价|秒杀|抢购|大促|狂欢节/g, "活动")
          .replace(/微信|QQ|电话|联系方式|二维码/g, "")
          .replace(/\n\n（注意：.*）/g, "")
          + "\n\n（请生成一张风格统一、内容健康向上的设计海报，画面简洁大方）";
      }
      return sanitized;
    };

    for (let i = 0; i < toGen.length; i++) {
      if (stopRef.current) break;

      const page = toGen[i];
      setPages((prev) =>
        prev.map((p) =>
          p.index === page.index ? { ...p, status: "generating" } : p
        )
      );
      setProgressStatus(`正在生成第 ${i + 1}/${totalPages} 页：${page.title}`);
      setProgress(Math.round((i / totalPages) * 100));

      let pageSuccess = false;
      let attempt = 0;
      let finalError = "";

      while (attempt < 3 && !pageSuccess && !stopRef.current) {
        attempt++;
        try {
          let enhancedPrompt = buildEnhancedPrompt(page, totalPages, title);
          if (attempt > 1) {
            enhancedPrompt = sanitizePrompt(enhancedPrompt, attempt - 1);
          }

          const body: Record<string, unknown> = {
            model,
            ratio,
            count: 1,
            siteId: process.env.NEXT_PUBLIC_SITE_ID || "main",
          };

          // Use previous successful image as style reference
          if (lastSuccessUrl) {
            body.refImageUrl = lastSuccessUrl;
            body.prompt = `${enhancedPrompt}\n\n（重要风格约束：请严格参考上一张图片的视觉风格、配色方案、排版布局和字体风格，确保与整套系列保持高度统一的视觉语言。）`;
          } else if (selectedTemplate) {
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
            const errMsg = err.error || `第 ${page.index + 1} 页生成失败`;
            // Detect moderation violation
            const isViolation = /moderation|violation|违规|敏感|不合规|内容审核|审核不通过/i.test(errMsg);
            if (isViolation && attempt < 3) {
              toast.warning(`第 ${page.index + 1} 页检测到内容违规，自动调整后重试（${attempt}/3）...`);
              continue;
            }
            throw new Error(errMsg);
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
            pageSuccess = true;
            lastSuccessUrl = resultUrl;
            succeeded++;
            setPages((prev) =>
              prev.map((p) =>
                p.index === page.index
                  ? { ...p, status: "done", imageUrl: resultUrl, taskId }
                  : p
              )
            );
          } else {
            throw new Error("未获取到图片地址");
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "生成失败";
          finalError = msg;
          const isViolation = /moderation|violation|违规|敏感|不合规|内容审核|审核不通过/i.test(msg);
          if (isViolation && attempt < 3) {
            toast.warning(`第 ${page.index + 1} 页内容违规，自动调整后重试（${attempt}/3）...`);
            continue;
          }
          toast.error(`第 ${page.index + 1} 页生成失败：${msg}`);
          setPages((prev) =>
            prev.map((p) =>
              p.index === page.index ? { ...p, status: "error" } : p
            )
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
  }, [pages, selectedIndices, model, ratio, templates, buildEnhancedPrompt, outlineTitle]);

  const doneCount = useMemo(() => pages.filter((p) => p.status === "done").length, [pages]);

  return (
    <div className="space-y-4">
      {/* Batch Type Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">生成类型：</span>
        {batchTypeOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setBatchType(opt.key)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg transition-all border-2",
              batchType === opt.key
                ? "bg-primary/10 border-primary text-primary"
                : "bg-secondary border-transparent hover:border-border"
            )}
          >
            {opt.icon}
            {opt.label}
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
          placeholder="输入完整的内容文案，AI将智能分析结构并自动分页...&#10;例如：产品介绍、演讲稿、故事脚本、数据报告等"
          className="w-full min-h-[160px] px-4 py-3 rounded-xl border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
        />
      </div>

      {/* Smart Analyze Button */}
      <Button
        onClick={handleAnalyze}
        disabled={isAnalyzing || !batchPrompt.trim()}
        variant="outline"
        className="w-full py-5 text-base font-bold rounded-2xl transition-all border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5"
      >
        {isAnalyzing ? (
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>正在智能分析内容结构...</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <BrainCircuit className="w-5 h-5" />
            <span>AI 智能分析并分页</span>
          </div>
        )}
      </Button>

      {/* Outline Title */}
      {outlineTitle && (
        <div className="px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-sm font-semibold text-primary">{outlineTitle}</p>
          <p className="text-xs text-muted-foreground mt-0.5">共 {pages.length} 页 · 已智能分页</p>
        </div>
      )}

      {/* Pages Preview */}
      {pages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">
              页面大纲
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
          <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
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
                    src={page.imageUrl}
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
