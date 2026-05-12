"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Download, Sparkles, Image as ImageIcon, Wand2, Zap, Palette, ImagePlus, Upload, X, Plus, Minus, LogIn, AlertTriangle, Layers, Check, Trash2, Pencil, Square } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import BatchGeneratePanel, { PageData } from "@/components/BatchGeneratePanel";
import { useAutoResize } from "@/hooks/use-auto-resize";


// Default fallback values (used before config loads)
const defaultTemplates = [
  { label: "图书主编招募", prompt: "图书主编招募海报，书香气息，书架与书籍元素，优雅排版，暖色调，专业感，招募信息突出" },
  { label: "教培代理招募", prompt: "教培代理招募海报，教育行业风格，知识图标与成长箭头，蓝绿色调，专业可信，招募信息醒目" },
  { label: "餐饮节日宣传", prompt: "餐饮节日宣传海报，美食特写，节日装饰元素，暖色灯光，诱人菜品，促销信息突出" },
  { label: "电商促销", prompt: "电商促销海报，鲜艳配色，折扣标签，商品展示布局，动感活力，促销信息醒目" },
  { label: "课程成果展示", prompt: "课程成果展示海报，学员作品墙效果，成就徽章与数据亮点，简洁大气，专业教育风格" },
  { label: "小红书封面", prompt: "小红书封面图，清新排版，吸睛标题，美感构图，柔和渐变背景，社交媒体风格" },
  { label: "视频封面", prompt: "视频封面图，视觉冲击力强，大字标题，人物或场景特写，电影质感，高对比度色彩" },
  { label: "图片重构", prompt: "图片重构，保留原始构图与主体，提升画质细节，优化色彩与光影，增强视觉表现力" },
  { label: "电商主图", prompt: "电商主图，商品居中展示，纯净背景，光影立体感，卖点标签，高端产品摄影风格" },
  { label: "公众号配图", prompt: "公众号配图，简约扁平风格，与文章主题呼应，留白充足，色彩柔和，信息图表元素" },
];

const defaultModels = [
  { value: "image2-vip", label: "Spark2 VIP", desc: "最高画质，支持2K/4K" },
  { value: "image2", label: "Spark2", desc: "高画质，性价比之选" },
  { value: "nano-banana-fast", label: "Spark Lite", desc: "适合纯图，无文字" },
  { value: "nano-banana-2", label: "Spark2 Nano", desc: "新一代模型，支持超长比例" },
  { value: "nano-banana-pro-vip", label: "Spark Pro VIP", desc: "专业画质，支持2K/4K" },
];

const defaultRatios = [
  { value: "auto", label: "Auto", desc: "自动" },
  { value: "1:1", label: "1:1", desc: "方形" },
  { value: "3:4", label: "3:4", desc: "竖版" },
  { value: "4:3", label: "4:3", desc: "横版" },
  { value: "9:16", label: "9:16", desc: "手机" },
  { value: "16:9", label: "16:9", desc: "宽屏" },
  { value: "2:3", label: "2:3", desc: "人像" },
  { value: "3:2", label: "3:2", desc: "风景" },
  { value: "4:5", label: "4:5", desc: "社交" },
  { value: "5:4", label: "5:4", desc: "摄影" },
  { value: "21:9", label: "21:9", desc: "全景" },
  { value: "9:21", label: "9:21", desc: "长图" },
];

const defaultTips = [
  "描述越具体，生成效果越好",
  "可以指定风格、颜色、布局等",
  "使用参考图可以保持一致的视觉风格",
];

// Scene options (使用平台/载体)
const sceneOptions = [
  "电商", "社交媒体", "微信营销", "公众号",
  "行政办公/教育", "生活娱乐", "PPT",
];

// Usage options (用途/模板功能)
const usageOptions = [
  "营销带货", "交流分享", "祝福问候", "宣传推广", "干货科普",
  "通知公告", "招聘招募", "个人娱乐", "日月签", "公益宣传",
  "晒照分享", "简介介绍", "邀请函", "直播宣传", "喜报表彰",
  "计划总结", "员工关怀", "社交互动", "价目表", "学习素材",
  "资讯要闻", "生日祝福", "晒单反馈",
];

// Style options (风格)
const styleOptions = [
  "简约", "时尚", "实景", "插画", "卡通", "文艺",
  "喜庆", "手绘", "可爱", "拼贴风", "潮酷", "商务",
  "中国风", "通用", "扁平", "清新", "3D", "复古",
  "奢华", "酸性风", "科技", "膨胀风",
];

// Color options (颜色)
const colorOptions = [
  "蓝", "黄", "绿", "红", "粉", "橙", "白",
  "棕", "紫", "黑", "灰", "米色",
];

type GenerationMode = "text2img" | "img2img" | "batch";

interface RefImage {
  url: string; // S3 key or HTTP URL
  preview: string; // Object URL for preview
}

interface GenerationResult {
  url: string;
  error?: string;
  [key: string]: unknown;
}

// Inner component that uses useSearchParams
function CreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  
  // Login dialog state
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  
  // Get params from URL (for "做同款")
  const initialPrompt = searchParams.get("prompt") || "";
  const initialMode = searchParams.get("mode") || "text2img";
  const initialRefImageUrl = searchParams.get("refImageUrl") || "";

  // Dynamic config from API
  const [templates, setTemplates] = useState(defaultTemplates);
  const [modelOptions, setModelOptions] = useState(defaultModels);
  const [ratioOptions, setRatioOptions] = useState(defaultRatios);
  const [tips, setTips] = useState(defaultTips);
  // Dynamic options from database (/api/options)
  const [sceneOpts, setSceneOpts] = useState<string[]>(sceneOptions);
  const [usageOpts, setUsageOpts] = useState<string[]>(usageOptions);
  const [styleOpts, setStyleOpts] = useState<string[]>(styleOptions);
  const [colorOpts, setColorOpts] = useState<string[]>(colorOptions);
  const [waitMessage, setWaitMessage] = useState("请等待30-120秒，不要切换页面");
  const [waitDuration, setWaitDuration] = useState(5000);
  const [defaultRatio, setDefaultRatio] = useState("auto");
  const [batchGenerateAccess, setBatchGenerateAccess] = useState("admin");
  const canAccessBatch = batchGenerateAccess === "all" || isAdmin;
  
  const [mode, setMode] = useState<GenerationMode>(
    (initialMode === "batch" && !canAccessBatch ? "text2img" : initialMode) as GenerationMode
  );
  const [prompt, setPrompt] = useState(initialPrompt);
  const promptRef = useRef(initialPrompt);
  const [ratio, setRatio] = useState("auto");

  const [model, setModel] = useState("image2");

  // Scene / usage / style / color selectors
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [selectedUsages, setSelectedUsages] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [customScene, setCustomScene] = useState("");
  const [customUsage, setCustomUsage] = useState("");
  const [customStyle, setCustomStyle] = useState("");
  const [customColor, setCustomColor] = useState("");

  // Redirect unauthorized users away from batch mode
  useEffect(() => {
    if (!authLoading && mode === "batch" && !canAccessBatch) {
      setMode("text2img");
    }
  }, [authLoading, canAccessBatch, mode]);

  const [imageSize, setImageSize] = useState("1K");
  const [imageCount, setImageCount] = useState(1);
  const [imageCountMax, setImageCountMax] = useState(4);
  const [imageCountEnabled, setImageCountEnabled] = useState(true);
  const [imageSizeOptions, setImageSizeOptions] = useState<{value:string;label:string;desc:string}[]>([
    { value: "1K", label: "1K", desc: "标准" },
    { value: "2K", label: "2K", desc: "高清" },
    { value: "4K", label: "4K", desc: "超清" },
  ]);
  const [defaultImageSize, setDefaultImageSize] = useState("1K");
  const [hdModels, setHdModels] = useState(["image2-vip", "nano-banana-2", "nano-banana-pro-vip"]);
  const [violationMessages, setViolationMessages] = useState<Record<string,string>>({
    output_moderation: "生成内容违规，请修改提示词后重试",
    input_moderation: "输入内容违规，请修改提示词后重试",
    violation: "生成内容违规，请修改提示词后重试",
    error: "生成失败，请稍后重试",
  });
  const [dailyGenerateLimit, setDailyGenerateLimit] = useState(0);
  const [promptMaxLength, setPromptMaxLength] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Batch mode state
  const [batchPages, setBatchPages] = useState<PageData[]>([]);
  const [batchSelectedIndices, setBatchSelectedIndices] = useState<Set<number>>(new Set());
  const [batchEditingIndex, setBatchEditingIndex] = useState<number | null>(null);
  const [batchEditTitle, setBatchEditTitle] = useState("");
  const [batchEditContent, setBatchEditContent] = useState("");
  const promptTextareaRef = useAutoResize<HTMLTextAreaElement>(prompt);
  const batchEditTextareaRef = useAutoResize<HTMLTextAreaElement>(batchEditContent);

  // Image-to-image state - support multiple images
  const [refImages, setRefImages] = useState<RefImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle initial refImageUrl from URL params
  useEffect(() => {
    if (initialRefImageUrl && initialMode === "img2img") {
      setRefImages([{ url: initialRefImageUrl, preview: initialRefImageUrl }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load config from API
  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.templates?.length) setTemplates(data.templates);
        if (data.models?.length) setModelOptions(data.models);
        if (data.ratios?.length) setRatioOptions(data.ratios);
        if (data.tips?.length) setTips(data.tips);
        if (data.waitMessage) setWaitMessage(data.waitMessage);
        if (data.waitDuration) setWaitDuration(Number(data.waitDuration));
        if (data.defaultRatio) {
          setDefaultRatio(data.defaultRatio);
          setRatio(data.defaultRatio);
        }
        if (data.defaultModel) setModel(data.defaultModel);
        if (data.imageCountEnabled !== undefined) setImageCountEnabled(data.imageCountEnabled);
        if (data.imageCountMax) setImageCountMax(Number(data.imageCountMax));
        if (data.imageSizes?.length) setImageSizeOptions(data.imageSizes);
        if (data.defaultImageSize) { setDefaultImageSize(data.defaultImageSize); setImageSize(data.defaultImageSize); }
        if (data.hdModels?.length) setHdModels(data.hdModels);
        if (data.violationMessages) setViolationMessages(data.violationMessages);
        if (data.dailyGenerateLimit !== undefined) setDailyGenerateLimit(Number(data.dailyGenerateLimit));
        if (data.promptMaxLength) setPromptMaxLength(Number(data.promptMaxLength));
        // Load create options from config
        if (data.createOptions?.scene?.length) setSceneOpts(data.createOptions.scene.map((item: { label: string }) => item.label));
        if (data.createOptions?.usage?.length) setUsageOpts(data.createOptions.usage.map((item: { label: string }) => item.label));
        if (data.createOptions?.style?.length) setStyleOpts(data.createOptions.style.map((item: { label: string }) => item.label));
        if (data.createOptions?.color?.length) setColorOpts(data.createOptions.color.map((item: { label: string }) => item.label));
        if (data.batchGenerateAccess) setBatchGenerateAccess(data.batchGenerateAccess);
      })
      .catch(() => {
        // Use defaults on error
      });
  }, []);

  // Template selection
  const handleTemplateSelect = useCallback((templatePrompt: string) => {
    setPrompt(templatePrompt);
    promptRef.current = templatePrompt;
  }, []);

  // Toggle multi-select tag
  const toggleTag = useCallback((list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }, []);

  // Build enhanced prompt with scene/usage/style/color
  const buildEnhancedPrompt = useCallback((basePrompt: string) => {
    const parts: string[] = [];
    if (selectedScenes.length > 0) parts.push(`场景：${selectedScenes.join("、")}`);
    if (selectedUsages.length > 0) parts.push(`用途：${selectedUsages.join("、")}`);
    if (selectedStyles.length > 0) parts.push(`风格：${selectedStyles.join("、")}`);
    if (selectedColors.length > 0) parts.push(`颜色：${selectedColors.join("、")}`);
    if (parts.length === 0) return basePrompt;
    return `${parts.join("，")}\n${basePrompt}`; // 设计要求在前，用户 prompt 在后
  }, [selectedScenes, selectedUsages, selectedStyles, selectedColors]);

  // File upload handler - supports multiple files
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImages: RefImage[] = [];

    for (const file of files) {
      // Validate file
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} 不是图片文件，已跳过`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} 超过 10MB，已跳过`);
        continue;
      }

      // Show preview immediately
      const previewUrl = URL.createObjectURL(file);
      setUploading(true);

      try {
        // Upload to server first to get a temporary URL
        const formData = new FormData();
        formData.append("file", file);
        formData.append("forGrsai", "true");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");
        
        const data = await res.json();
        
        if (data.key) {
          newImages.push({ url: data.key, preview: previewUrl });
        } else if (data.url) {
          newImages.push({ url: data.url, preview: previewUrl });
        } else {
          URL.revokeObjectURL(previewUrl);
          throw new Error("No key or URL returned");
        }
      } catch (error) {
        console.error("Error preparing reference image:", error);
        toast.error(`${file.name} 上传失败`);
        URL.revokeObjectURL(previewUrl);
      }
    }

    setRefImages((prev) => [...prev, ...newImages]);
    setUploading(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Remove a reference image
  const removeRefImage = useCallback((index: number) => {
    setRefImages((prev) => {
      const img = prev[index];
      if (img && img.preview.startsWith("blob:")) {
        URL.revokeObjectURL(img.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Parse batch pages from prompt text
  // Login submit handler (in-dialog login)
  const handleLoginSubmit = useCallback(async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("请输入账号和密码");
      return;
    }
    setLoginLoading(true);
    setLoginError("");
    try {
      await login(loginUsername, loginPassword);
      setShowLoginDialog(false);
      setLoginUsername("");
      setLoginPassword("");
      toast.success("登录成功");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoginLoading(false);
    }
  }, [loginUsername, loginPassword, login]);

  // Batch page editing handlers
  const toggleBatchSelect = useCallback((index: number) => {
    setBatchSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleBatchSelectAll = useCallback(() => {
    setBatchSelectedIndices((prev) => {
      if (prev.size === batchPages.length) return new Set();
      return new Set(batchPages.map((p) => p.index));
    });
  }, [batchPages]);

  const removeBatchPage = useCallback((index: number) => {
    setBatchPages((prev) => prev.filter((p) => p.index !== index).map((p, i) => ({ ...p, index: i })));
    setBatchSelectedIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      });
      return next;
    });
    setBatchEditingIndex(null);
  }, []);

  const startBatchEdit = useCallback((index: number) => {
    const page = batchPages.find((p) => p.index === index);
    if (!page) return;
    setBatchEditingIndex(index);
    setBatchEditTitle(page.title);
    setBatchEditContent(page.content);
  }, [batchPages]);

  const saveBatchEdit = useCallback(() => {
    if (batchEditingIndex === null) return;
    setBatchPages((prev) =>
      prev.map((p) =>
        p.index === batchEditingIndex
          ? { ...p, title: batchEditTitle.trim() || p.title, content: batchEditContent.trim() || p.content }
          : p
      )
    );
    setBatchEditingIndex(null);
    toast.success("已保存修改");
  }, [batchEditingIndex, batchEditTitle, batchEditContent]);

  const cancelBatchEdit = useCallback(() => {
    setBatchEditingIndex(null);
  }, []);

  // Batch generate handlers
  const batchStopRef = useRef(false);

  const buildBatchPrompt = useCallback(
    (page: PageData) => {
      const parts: string[] = [];
      if (selectedScenes.length > 0) parts.push(`场景：${selectedScenes.join("、")}`);
      if (selectedUsages.length > 0) parts.push(`用途：${selectedUsages.join("、")}`);
      if (selectedStyles.length > 0) parts.push(`风格：${selectedStyles.join("、")}`);
      if (selectedColors.length > 0) parts.push(`颜色：${selectedColors.join("、")}`);

      if (parts.length === 0) return page.content;

      return `设计要求：${parts.join("，")}\n\n${page.content}`;
    },
    [selectedScenes, selectedUsages, selectedStyles, selectedColors]
  );

  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchProgressStatus, setBatchProgressStatus] = useState("");

  const handleBatchGenerate = useCallback(async () => {
    const toGen = batchPages.filter((p) => batchSelectedIndices.has(p.index));
    if (!toGen.length) {
      toast.error("请至少选择一页");
      return;
    }

    batchStopRef.current = false;
    setIsBatchGenerating(true);
    setBatchProgress(0);
    setBatchProgressStatus("准备生成...");

    const totalPages = toGen.length;
    let succeeded = 0;

    for (let i = 0; i < toGen.length; i++) {
      if (batchStopRef.current) break;

      const page = toGen[i];
      setBatchPages((prev) =>
        prev.map((p) => (p.index === page.index ? { ...p, status: "generating" } : p))
      );
      setBatchProgressStatus(`正在生成第 ${i + 1}/${totalPages} 页：${page.title}`);
      setBatchProgress(Math.round((i / totalPages) * 100));

      let pageSuccess = false;
      let attempt = 0;

      while (attempt < 3 && !pageSuccess && !batchStopRef.current) {
        attempt++;
        try {
          const enhancedPrompt = buildBatchPrompt(page);

          const body: Record<string, unknown> = {
            model,
            ratio,
            count: 1,
            replyType: "json",
            siteId: process.env.NEXT_PUBLIC_SITE_ID || "main",
          };

          const refImageUrl = refImages.length > 0 ? refImages[0].url : null;
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
              setBatchPages((prev) =>
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
          setBatchPages((prev) =>
            prev.map((p) => (p.index === page.index ? { ...p, status: "failed" } : p))
          );
        }
      }
    }

    setBatchProgress(100);
    setBatchProgressStatus(batchStopRef.current ? "已停止" : "生成完成");
    setIsBatchGenerating(false);
    if (!batchStopRef.current) {
      toast.success(`批量生成完成，成功 ${succeeded}/${totalPages} 页`);
    }
  }, [batchPages, batchSelectedIndices, model, ratio, buildBatchPrompt, refImages]);

  const handleBatchStop = useCallback(() => {
    batchStopRef.current = true;
    setBatchProgressStatus("正在停止...");
  }, []);

  // Generate handler - supports multiple images
  const handleGenerate = useCallback(async () => {
    // Check login status first
    if (!user) {
      setShowLoginDialog(true);
      return;
    }

    if (!prompt.trim()) {
      toast.error("请输入海报描述");
      return;
    }

    if (promptMaxLength > 0 && prompt.trim().length > promptMaxLength) {
      toast.error(`提示词超过最大长度限制 (${promptMaxLength} 字)`);
      return;
    }
    
    if (mode === "img2img" && refImages.length === 0) {
      toast.error("请先上传参考图片");
      return;
    }

    const effectiveCount = imageCountEnabled ? imageCount : 1;
    setLoading(true);
    setProgress(0);
    setProgressStatus("正在提交任务...");
    setResults([]);
    toast(waitMessage, { duration: waitDuration });

    try {
      const allResults: GenerationResult[] = [];

      for (let i = 0; i < effectiveCount; i++) {
        if (effectiveCount > 1) {
          setProgressStatus(`正在生成第 ${i + 1}/${effectiveCount} 张...`);
          setProgress(Math.round((i / effectiveCount) * 100));
        }

        const enhancedPrompt = buildEnhancedPrompt(prompt);

        const body: Record<string, unknown> = {
          prompt: enhancedPrompt,
          ratio,
          model,
          imageSize,
        };

        if (mode === "img2img" && refImages.length > 0) {
          const refImgs = refImages
            .map((img) => {
              if (!img.url.startsWith("http") && !img.url.startsWith("data:")) {
                return img.url; // S3 key - backend will handle
              }
              return img.url;
            })
            .filter((url) => url.length > 0);
          
          if (refImgs.length === 1) {
            // Single ref image - use legacy field for backward compat
            if (!refImgs[0].startsWith("http") && !refImgs[0].startsWith("data:")) {
              body.refImageKey = refImgs[0];
              body.refImageContentType = "image/jpeg";
            } else {
              body.refImageUrl = refImgs[0];
            }
          } else {
            // Multiple ref images - use refImgs array
            // For S3 keys, backend needs to convert them to URLs
            body.refImgs = refImgs;
            body.refImageKeys = refImages
              .filter((img) => !img.url.startsWith("http") && !img.url.startsWith("data:"))
              .map((img) => img.url);
          }
        }

        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        });

        if (!response.ok) {
          const error = await response.json();
          if (response.status === 401) {
            setShowLoginDialog(true);
          }
          allResults.push({ url: "", error: (error as Record<string, string>).error || "Generation failed" });
          setResults([...allResults]);
          continue;
        }

        // Handle SSE stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let streamError = false;

        readStream: while (true) {
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

              if (data.type === "progress") {
                if (effectiveCount <= 1) {
                  setProgress(data.progress || 0);
                  setProgressStatus(
                    data.status === "submitted" ? "等待处理..." :
                    data.status === "running" ? "正在生成..." :
                    data.status === "uploading" ? "上传中..." :
                    data.status || "处理中..."
                  );
                } else {
                  // Multi-image: show combined progress
                  const baseProgress = Math.round((i / effectiveCount) * 100);
                  const stepProgress = Math.round(((data.progress || 0) / 100) * (100 / effectiveCount));
                  setProgress(Math.min(baseProgress + stepProgress, 99));
                  setProgressStatus(`第 ${i + 1}/${effectiveCount} 张 - ${
                    data.status === "submitted" ? "等待处理..." :
                    data.status === "running" ? "正在生成..." :
                    data.status === "uploading" ? "上传中..." :
                    data.status || "处理中..."
                  }`);
                }
              }

              if (data.type === "error") {
                allResults.push({ url: "", error: data.error });
                setResults([...allResults]);
                streamError = true;
                break readStream;
              }

              if (data.type === "complete") {
                allResults.push(data.data as GenerationResult);
                setResults([...allResults]);
              }
            } catch (parseError) {
              // Skip malformed JSON
              if (parseError instanceof Error && parseError.message !== "Unexpected end of JSON input") {
                if (!(parseError instanceof SyntaxError)) throw parseError;
              }
            }
          }
        }

        if (streamError) {
          setProgressStatus(`第 ${i + 1} 张生成失败`);
          // Continue to next image if multi-image, otherwise loop ends naturally
          continue;
        }
      }

      const successCount = allResults.filter((r) => r.url && !r.error).length;
      const errorCount = allResults.filter((r) => r.error).length;
      setProgress(100);
      if (successCount > 0 && errorCount === 0) {
        setProgressStatus(`完成！共生成 ${successCount} 张`);
        toast.success(`海报生成成功！共 ${successCount} 张`);
      } else if (successCount > 0 && errorCount > 0) {
        setProgressStatus(`完成！成功 ${successCount} 张，失败 ${errorCount} 张`);
        toast.success(`生成完成！成功 ${successCount} 张，失败 ${errorCount} 张`);
      } else if (errorCount > 0) {
        setProgressStatus(`生成失败，共 ${errorCount} 张`);
      } else {
        setProgressStatus("未获取到结果");
      }
    } catch (error: unknown) {
      console.error("Generation error:", error);
      const msg = error instanceof Error ? error.message : "生成失败，请重试";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [prompt, mode, refImages, ratio, model, imageCount, imageCountEnabled, waitMessage, waitDuration, user, buildEnhancedPrompt]);

  // Download handler
  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `sparkai-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("下载中...");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("下载失败");
    }
  }, []);

  // Download all
  const handleDownloadAll = useCallback(async () => {
    for (const result of results) {
      if (result.url) {
        await handleDownload(result.url as string);
        // Small delay between downloads
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }, [results, handleDownload]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 dark:from-background dark:to-background">
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[2fr_3fr] gap-8">
          {/* Left: Input Panel */}
          <div className="space-y-6">
            {/* Mode Switcher */}
            <div className="bg-card rounded-2xl p-2 flex gap-1 shadow-sm border border-border">
              <button
                onClick={() => setMode("text2img")}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
                  mode === "text2img"
                    ? "bg-primary text-white shadow-md"
                    : "text-muted-foreground hover:bg-accent dark:hover:bg-accent"
                )}
              >
                <Sparkles className="w-4 h-4" />
                文字生图
              </button>
              <button
                onClick={() => setMode("img2img")}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
                  mode === "img2img"
                    ? "bg-primary text-white shadow-md"
                    : "text-muted-foreground hover:bg-accent dark:hover:bg-accent"
                )}
              >
                <ImagePlus className="w-4 h-4" />
                参考图生图
              </button>
              {canAccessBatch && (
                <button
                  onClick={() => setMode("batch")}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
                    mode === "batch"
                      ? "bg-primary text-white shadow-md"
                      : "text-muted-foreground hover:bg-accent dark:hover:bg-accent"
                  )}
                >
                  <Layers className="w-4 h-4" />
                  批量生图
                </button>
              )}
            </div>

            {/* Reference Image Upload (for img2img) - Multiple images */}
            {mode === "img2img" && (
              <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
                <Label className="text-base font-semibold mb-4 block">
                  上传参考图片
                  <span className="text-sm font-normal text-muted-foreground ml-2">最多 4 张</span>
                </Label>
                
                {/* Image grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {refImages.map((img, index) => (
                    <div key={index} className="relative group rounded-xl overflow-hidden border border-border aspect-square">
                      <img
                        src={img.preview}
                        alt={`参考图 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeRefImage(index)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                        <span className="text-white text-xs">参考图 {index + 1}</span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add more button */}
                  {refImages.length < 4 && (
                    <div
                      className="rounded-xl overflow-hidden border-2 border-dashed border-border/60 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors aspect-square"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-8 h-8 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">添加图片</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />

                {refImages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => {
                      refImages.forEach((img) => {
                        if (img.preview.startsWith("blob:")) URL.revokeObjectURL(img.preview);
                      });
                      setRefImages([]);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    清空所有参考图
                  </Button>
                )}
              </div>
            )}

            {/* Tips - mobile only */}
            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 lg:hidden">
              <h4 className="font-semibold text-primary mb-2 flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4" />
                创作小贴士
              </h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">&#8226;</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Prompt Input */}
            {mode === "batch" ? (
              <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
                <BatchGeneratePanel
                  model={model}
                  ratio={ratio}
                  selectedScene={selectedScenes}
                  selectedUsage={selectedUsages}
                  selectedStyle={selectedStyles}
                  selectedColor={selectedColors}
                  refImageUrl={refImages.length > 0 ? refImages[0].url : null}
                  pages={batchPages}
                  selectedIndices={batchSelectedIndices}
                  onPagesChange={setBatchPages}
                  onSelectedIndicesChange={setBatchSelectedIndices}
                />
              </div>
            ) : (
              <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base font-semibold" htmlFor="prompt">
                    {mode === "text2img" ? "海报描述" : "图片描述"}
                  </Label>
                  <button
                    onClick={() => {
                      setPrompt("");
                      promptRef.current = "";
                    }}
                    className="text-xs text-green-500 transition-colors"
                    style={{ textShadow: "0 0 3px rgba(34,197,94,0.5), 0 0 6px rgba(34,197,94,0.3)" }}
                  >
                    清空
                  </button>
                </div>
                <Textarea
                  id="prompt"
                  ref={promptTextareaRef}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    promptRef.current = e.target.value;
                  }}
                  placeholder={mode === "text2img"
                    ? "输入你想要的文案/内容/联系方式/地址等主体内容..."
                    : "描述你想要生成的图片内容..."}
                  className="min-h-[120px] resize-none border-input focus:ring-2 focus:ring-ring"
                />

                {/* Templates */}
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">快捷模板</p>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.label}
                        onClick={() => handleTemplateSelect(template.prompt)}
                        className="px-3 py-1.5 text-xs bg-secondary rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Options */}
            <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">生成选项</h3>
                {(selectedScenes.length > 0 || selectedUsages.length > 0 || selectedStyles.length > 0 || selectedColors.length > 0) && (
                  <button
                    onClick={() => {
                      setSelectedScenes([]);
                      setSelectedUsages([]);
                      setSelectedStyles([]);
                      setSelectedColors([]);
                      setCustomScene("");
                      setCustomUsage("");
                      setCustomStyle("");
                      setCustomColor("");
                    }}
                    className="text-xs text-green-500 transition-colors"
                    style={{ textShadow: "0 0 3px rgba(34,197,94,0.5), 0 0 6px rgba(34,197,94,0.3)" }}
                  >
                    清空
                  </button>
                )}
              </div>
              
              {/* Image Count */}
              {imageCountEnabled && (
              <div className="mb-6">
                <Label className="text-sm text-muted-foreground mb-3 block">生成数量</Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-secondary rounded-xl overflow-hidden">
                    <button
                      onClick={() => setImageCount(Math.max(1, imageCount - 1))}
                      disabled={imageCount <= 1 || loading}
                      className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center font-bold text-lg">{imageCount}</span>
                    <button
                      onClick={() => setImageCount(Math.min(imageCountMax, imageCount + 1))}
                      disabled={imageCount >= imageCountMax || loading}
                      className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-sm text-muted-foreground">张图片</span>
                  {imageCount > 1 && (
                    <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
                      逐张生成
                    </span>
                  )}
                </div>
              </div>
              )}

              {/* Scene */}
              <div className="mb-5">
                <Label className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
                  <span>场景（使用平台/载体）</span>
                  <span className="text-xs text-muted-foreground/60">可多选</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={customScene}
                    onChange={(e) => setCustomScene(e.target.value)}
                    onBlur={(e) => {
                      const val = e.currentTarget.value;
                      if (val.trim()) {
                        const values = val.split(/[,，]/).map((v) => v.trim()).filter(Boolean);
                        setSelectedScenes((prev) => [...new Set([...prev, ...values])]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value;
                        if (val.trim()) {
                          const values = val.split(/[,，]/).map((v) => v.trim()).filter(Boolean);
                          setSelectedScenes((prev) => [...new Set([...prev, ...values])]);
                        }
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="自定义"
                    className={cn(
                      "px-2 py-1 text-xs rounded-lg transition-all border-2 outline-none bg-secondary border-transparent hover:border-border text-foreground placeholder:text-muted-foreground w-24",
                      customScene.trim() && "bg-primary/10 border-primary text-primary"
                    )}
                  />
                  {sceneOpts.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => toggleTag(selectedScenes, setSelectedScenes, opt)}
                      className={cn(
                        "px-2 py-1 text-xs rounded-lg transition-all border-2",
                        selectedScenes.includes(opt)
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-secondary border-transparent hover:border-border"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Usage */}
              <div className="mb-5">
                <Label className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
                  <span>用途（模板功能）</span>
                  <span className="text-xs text-muted-foreground/60">可多选</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={customUsage}
                    onChange={(e) => setCustomUsage(e.target.value)}
                    onBlur={(e) => {
                      const val = e.currentTarget.value;
                      if (val.trim()) {
                        const values = val.split(/[,，]/).map((v) => v.trim()).filter(Boolean);
                        setSelectedUsages((prev) => [...new Set([...prev, ...values])]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value;
                        if (val.trim()) {
                          const values = val.split(/[,，]/).map((v) => v.trim()).filter(Boolean);
                          setSelectedUsages((prev) => [...new Set([...prev, ...values])]);
                        }
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="自定义"
                    className={cn(
                      "px-2 py-1 text-xs rounded-lg transition-all border-2 outline-none bg-secondary border-transparent hover:border-border text-foreground placeholder:text-muted-foreground w-24",
                      customUsage.trim() && "bg-primary/10 border-primary text-primary"
                    )}
                  />
                  {usageOpts.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => toggleTag(selectedUsages, setSelectedUsages, opt)}
                      className={cn(
                        "px-2 py-1 text-xs rounded-lg transition-all border-2",
                        selectedUsages.includes(opt)
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-secondary border-transparent hover:border-border"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div className="mb-5">
                <Label className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
                  <span>风格</span>
                  <span className="text-xs text-muted-foreground/60">可多选</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    onBlur={(e) => {
                      const val = e.currentTarget.value;
                      if (val.trim()) {
                        const values = val.split(/[,，]/).map((v) => v.trim()).filter(Boolean);
                        setSelectedStyles((prev) => [...new Set([...prev, ...values])]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value;
                        if (val.trim()) {
                          const values = val.split(/[,，]/).map((v) => v.trim()).filter(Boolean);
                          setSelectedStyles((prev) => [...new Set([...prev, ...values])]);
                        }
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="自定义"
                    className={cn(
                      "px-2 py-1 text-xs rounded-lg transition-all border-2 outline-none bg-secondary border-transparent hover:border-border text-foreground placeholder:text-muted-foreground w-24",
                      customStyle.trim() && "bg-primary/10 border-primary text-primary"
                    )}
                  />
                  {styleOpts.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => toggleTag(selectedStyles, setSelectedStyles, opt)}
                      className={cn(
                        "px-2 py-1 text-xs rounded-lg transition-all border-2",
                        selectedStyles.includes(opt)
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-secondary border-transparent hover:border-border"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div className="mb-5">
                <Label className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
                  <span>颜色</span>
                  <span className="text-xs text-muted-foreground/60">可多选</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    onBlur={(e) => {
                      const val = e.currentTarget.value;
                      if (val.trim()) {
                        const values = val.split(/[,，]/).map((v) => v.trim()).filter(Boolean);
                        setSelectedColors((prev) => [...new Set([...prev, ...values])]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value;
                        if (val.trim()) {
                          const values = val.split(/[,，]/).map((v) => v.trim()).filter(Boolean);
                          setSelectedColors((prev) => [...new Set([...prev, ...values])]);
                        }
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="自定义"
                    className={cn(
                      "px-2 py-1 text-xs rounded-lg transition-all border-2 outline-none bg-secondary border-transparent hover:border-border text-foreground placeholder:text-muted-foreground w-24",
                      customColor.trim() && "bg-primary/10 border-primary text-primary"
                    )}
                  />
                  {colorOpts.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => toggleTag(selectedColors, setSelectedColors, opt)}
                      className={cn(
                        "px-2 py-1 text-xs rounded-lg transition-all border-2",
                        selectedColors.includes(opt)
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-secondary border-transparent hover:border-border"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ratio */}
              <div className="mb-6">
                <Label className="text-sm text-muted-foreground mb-3 block">图片比例</Label>
                <div className="flex flex-wrap gap-2">
                  {ratioOptions.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRatio(r.value)}
                      className={cn(
                        "px-2 py-1 text-xs rounded-lg transition-all border-2",
                        ratio === r.value
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-secondary border-transparent hover:border-border"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}

                </div>
              </div>

              {/* Model */}
              <div>
                <Label className="text-sm text-muted-foreground mb-3 block">生成模型</Label>
                <div className="grid grid-cols-2 gap-2">
                  {modelOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setModel(opt.value)}
                      className={cn(
                        "w-full p-3 rounded-xl text-left transition-all flex items-center justify-between",
                        model === opt.value
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-secondary border-2 border-transparent hover:border-border"
                      )}
                    >
                      <div className="min-w-0">
                        <p className={cn("font-medium text-sm truncate", model === opt.value ? "text-primary" : "")}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{opt.desc}</p>
                      </div>
                      {model === opt.value && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-primary-foreground text-xs">&#10003;</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Size - only for VIP/Pro models */}
              {hdModels.includes(model) && (
                <div className="mt-6">
                  <Label className="text-sm text-muted-foreground mb-3 block">输出分辨率</Label>
                  <div className="flex gap-2">
                    {imageSizeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setImageSize(opt.value)}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-center transition-all",
                          imageSize === opt.value
                            ? "bg-primary/10 border-2 border-primary"
                            : "bg-secondary border-2 border-transparent hover:border-border"
                        )}
                      >
                        <p className={cn("font-medium text-sm", imageSize === opt.value ? "text-primary" : "")}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            {mode !== "batch" && (
            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || (mode === "img2img" && refImages.length === 0)}
              className={cn(
                "w-full py-6 text-lg font-bold rounded-2xl transition-all shadow-lg",
                loading
                  ? "bg-muted cursor-not-allowed"
                  : "bg-primary hover:bg-primary/90 shadow-lg"
              )}
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>{progressStatus}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Wand2 className="w-6 h-6" />
                  {mode === "img2img" ? "基于参考图生成" : "立即生成"}
                  {imageCountEnabled && imageCount > 1 && ` (${imageCount}张)`}
                </div>
              )}
            </Button>
            )}
          </div>

          {/* Right: Preview Panel */}
          <div className="lg:sticky lg:top-24 lg:h-fit space-y-6">
            {/* Tips - desktop only */}
            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 hidden lg:block">
              <h4 className="font-semibold text-primary mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                创作小贴士
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">&#8226;</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Progress */}
            {loading && (
              <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{progressStatus}</span>
                  <span className="text-sm font-medium text-primary">{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Batch Progress */}
            {isBatchGenerating && (
              <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{batchProgressStatus}</span>
                  <span className="text-sm font-medium text-primary">{batchProgress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${batchProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Batch Mode: Page Editor */}
            {mode === "batch" && batchPages.length > 0 && (
              <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold">
                    页面内容
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      已选 {batchSelectedIndices.size}/{batchPages.length}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={toggleBatchSelectAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {batchSelectedIndices.size === batchPages.length ? "取消全选" : "全选"}
                  </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                  {batchPages.map((page) => (
                    <div
                      key={page.index}
                      className={cn(
                        "flex items-start gap-2 p-3 rounded-xl border-2 transition-all",
                        batchSelectedIndices.has(page.index)
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background",
                        page.status === "done" && "border-green-500/30 bg-green-500/5",
                        page.status === "failed" && "border-red-500/30 bg-red-500/5"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleBatchSelect(page.index)}
                        className={cn(
                          "mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          batchSelectedIndices.has(page.index)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-background"
                        )}
                      >
                        {batchSelectedIndices.has(page.index) && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        {batchEditingIndex === page.index ? (
                          <div className="space-y-2">
                            <input
                              value={batchEditTitle}
                              onChange={(e) => setBatchEditTitle(e.target.value)}
                              className="w-full px-2 py-1 text-sm font-medium rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                              placeholder="页面标题"
                            />
                            <textarea
                              ref={batchEditTextareaRef}
                              value={batchEditContent}
                              onChange={(e) => setBatchEditContent(e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-border bg-background resize-none min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground w-24"
                              placeholder="页面内容"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={saveBatchEdit}
                                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={cancelBatchEdit}
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
                              {page.status === "failed" && (
                                <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">失败</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{page.content}</p>
                          </>
                        )}
                      </div>
                      {batchEditingIndex !== page.index && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startBatchEdit(page.index)}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBatchPage(page.index)}
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

                {/* Batch Generate / Stop Buttons */}
                <div className="flex gap-3 mt-4 pt-3 border-t border-border">
                  <Button
                    onClick={handleBatchGenerate}
                    disabled={isBatchGenerating || batchSelectedIndices.size === 0}
                    className={cn(
                      "flex-1 py-5 text-base font-bold rounded-2xl transition-all shadow-lg",
                      isBatchGenerating
                        ? "bg-muted cursor-not-allowed"
                        : "bg-primary hover:bg-primary/90"
                    )}
                  >
                    {isBatchGenerating ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{batchProgressStatus} ({batchProgress}%)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Wand2 className="w-5 h-5" />
                        批量生成 {batchSelectedIndices.size > 0 ? `(${batchSelectedIndices.size}页)` : ""}
                      </div>
                    )}
                  </Button>
                  {isBatchGenerating && (
                    <Button
                      onClick={handleBatchStop}
                      variant="destructive"
                      className="px-6 py-5 text-base font-bold rounded-2xl transition-all shadow-lg hover:bg-destructive/90"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      停止
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Preview Card */}
            <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">
                  生成预览
                  {mode === "batch" ? (
                    batchPages.filter((p) => p.status === "done" && p.imageUrl).length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        {batchPages.filter((p) => p.status === "done" && p.imageUrl).length} 张
                      </span>
                    )
                  ) : (
                    results.length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        {results.length} 张
                      </span>
                    )
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  {mode === "batch" ? (
                    batchPages.filter((p) => p.status === "done" && p.imageUrl).length > 1 && (
                      <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                        <Download className="w-4 h-4 mr-1" />
                        全部下载
                      </Button>
                    )
                  ) : (
                    results.length > 1 && (
                      <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                        <Download className="w-4 h-4 mr-1" />
                        全部下载
                      </Button>
                    )
                  )}
                  {mode === "batch" ? (
                    batchPages.filter((p) => p.status === "done" && p.imageUrl).length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setBatchPages((prev) => prev.map((p) => ({ ...p, status: "pending", imageUrl: null, taskId: null, url: null })))} className="text-green-500" style={{ textShadow: "0 0 3px rgba(34,197,94,0.5), 0 0 6px rgba(34,197,94,0.3)" }}>
                        清空
                      </Button>
                    )
                  ) : (
                    results.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setResults([])} className="text-green-500" style={{ textShadow: "0 0 3px rgba(34,197,94,0.5), 0 0 6px rgba(34,197,94,0.3)" }}>
                        清空
                      </Button>
                    )
                  )}
                </div>
              </div>
              
              {mode === "batch" ? (
                /* Batch Mode */
                batchPages.filter((p) => p.status === "done" && p.imageUrl).length === 0 ? (
                  <div className="aspect-[9/16] max-h-[500px] mx-auto bg-muted rounded-xl overflow-hidden flex items-center justify-center">
                    <div className="text-center text-muted-foreground p-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                      <p>批量生成的海报将在这里显示</p>
                    </div>
                  </div>
                ) : batchPages.filter((p) => p.status === "done" && p.imageUrl).length === 1 ? (
                  <div className="aspect-[9/16] max-h-[500px] mx-auto bg-muted rounded-xl overflow-hidden flex items-center justify-center">
                    <img
                      src={batchPages.find((p) => p.status === "done" && p.imageUrl)?.imageUrl as string}
                      alt="Generated"
                      className="w-full h-full object-contain cursor-zoom-in"
                      onClick={() => setPreviewImage(batchPages.find((p) => p.status === "done" && p.imageUrl)?.imageUrl as string)}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {batchPages
                      .filter((p) => p.status === "done" && p.imageUrl)
                      .map((page) => (
                        <div
                          key={page.index}
                          onClick={() => setPreviewImage(page.imageUrl!)}
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
                )
              ) : (
                /* Normal / Image Mode */
                results.length === 0 ? (
                  <div className="aspect-[9/16] max-h-[500px] mx-auto bg-muted rounded-xl overflow-hidden flex items-center justify-center">
                    <div className="text-center text-muted-foreground p-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                      <p>生成的海报将在这里显示</p>
                    </div>
                  </div>
                ) : results.length === 1 ? (
                  <div className="aspect-[9/16] max-h-[500px] mx-auto bg-muted rounded-xl overflow-hidden flex items-center justify-center">
                    {results[0].error ? (
                      <div className="text-center text-destructive p-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
                          <AlertTriangle className="w-8 h-8" />
                        </div>
                        <p className="font-semibold mb-1">生成失败</p>
                        <p className="text-sm text-destructive/80">{results[0].error}</p>
                      </div>
                    ) : (
                      <img
                        src={results[0].url as string}
                        alt="Generated"
                        className="w-full h-full object-contain cursor-zoom-in"
                        onClick={() => setPreviewImage(results[0].url as string)}
                      />
                    )}
                  </div>
                ) : (
                  <div className={cn(
                    "grid gap-3",
                    results.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
                    results.length === 3 ? "grid-cols-1 sm:grid-cols-3" :
                    "grid-cols-1 sm:grid-cols-2"
                  )}>
                    {results.map((result, index) => (
                      <div key={index} className="relative group bg-muted rounded-xl overflow-hidden aspect-square flex items-center justify-center">
                        {result.error ? (
                          <div className="text-center text-destructive p-4">
                            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-destructive/20 flex items-center justify-center">
                              <AlertTriangle className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-semibold mb-0.5">生成失败</p>
                            <p className="text-xs text-destructive/80 line-clamp-2">{result.error}</p>
                          </div>
                        ) : (
                          <>
                            <img
                              src={result.url as string}
                              alt={`Generated ${index + 1}`}
                              className="w-full h-full object-cover cursor-zoom-in"
                              onClick={() => setPreviewImage(result.url as string)}
                            />
                            {/* Desktop hover actions */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors hidden sm:flex flex-col items-center justify-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDownload(result.url as string)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                下载
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  setMode("img2img");
                                  setRefImages((prev) => {
                                    const alreadyAdded = prev.some((img) => img.url === result.url);
                                    if (alreadyAdded) {
                                      toast.success("该图片已在参考图中");
                                      return prev;
                                    }
                                    toast.success(`已将第 ${index + 1} 张图添加为参考图`);
                                    return [...prev, { url: result.url as string, preview: result.url as string }];
                                  });
                                }}
                              >
                                <ImagePlus className="w-4 h-4 mr-1" />
                                基于本图修改
                              </Button>
                            </div>
                            {/* Mobile always-visible actions */}
                            <div className="absolute bottom-0 inset-x-0 flex sm:hidden gap-1 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 h-8 text-white bg-white/20 hover:bg-white/30 text-xs"
                                onClick={() => handleDownload(result.url as string)}
                              >
                                <Download className="w-3.5 h-3.5 mr-1" />
                                下载
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 h-8 text-white bg-white/20 hover:bg-white/30 text-xs"
                                onClick={() => {
                                  setMode("img2img");
                                  setRefImages((prev) => {
                                    const alreadyAdded = prev.some((img) => img.url === result.url);
                                    if (alreadyAdded) {
                                      toast.success("该图片已在参考图中");
                                      return prev;
                                    }
                                    toast.success(`已将第 ${index + 1} 张图添加为参考图`);
                                    return [...prev, { url: result.url as string, preview: result.url as string }];
                                  });
                                }}
                              >
                                <ImagePlus className="w-3.5 h-3.5 mr-1" />
                                修改
                              </Button>
                            </div>
                          </>
                        )}
                        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Actions for single result (batch mode) */}
              {mode === "batch" && batchPages.filter((p) => p.status === "done" && p.imageUrl).length === 1 && (
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDownload(batchPages.find((p) => p.status === "done" && p.imageUrl)?.imageUrl as string)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigator.clipboard.writeText(batchPages.find((p) => p.status === "done" && p.imageUrl)?.imageUrl as string);
                      toast.success("链接已复制");
                    }}
                  >
                    复制链接
                  </Button>
                </div>
              )}

              {/* Actions for single result (normal mode) */}
              {mode !== "batch" && results.length === 1 && !results[0].error && (
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDownload(results[0].url as string)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigator.clipboard.writeText(results[0].url as string);
                      toast.success("链接已复制");
                    }}
                  >
                    复制链接
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setMode("img2img");
                      setRefImages([{ url: results[0].url as string, preview: results[0].url as string }]);
                      toast.success("已切换为参考图生图模式，当前图片已设为参考图");
                    }}
                  >
                    <ImagePlus className="w-4 h-4 mr-2" />
                    基于本图修改
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Image Preview Dialog */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none">
            <DialogTitle className="sr-only">图片预览</DialogTitle>
            {previewImage && (
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-full object-contain max-h-[85vh] rounded-lg"
                onClick={() => setPreviewImage(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Login Dialog */}
        <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LogIn className="w-5 h-5" />
                登录后即可创作
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {loginError && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{loginError}</div>
              )}
              <div>
                <Label className="text-sm mb-1.5 block">账号</Label>
                <Input
                  placeholder="请输入账号"
                  value={loginUsername}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginUsername(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && document.getElementById("login-pwd-input")?.focus()}
                />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">密码</Label>
                <Input
                  id="login-pwd-input"
                  type="password"
                  placeholder="请输入密码"
                  value={loginPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginPassword(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleLoginSubmit()}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleLoginSubmit}
                disabled={loginLoading}
              >
                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                登录
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                还没有账号？
                <a href="/login" className="text-primary hover:underline ml-1">去注册</a>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <CreatePageInner />
    </Suspense>
  );
}
