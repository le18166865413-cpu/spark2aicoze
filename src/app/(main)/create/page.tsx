"use client";

import { useState, useRef, useCallback, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Sparkles, Image as ImageIcon, Wand2, Zap, Palette, ImagePlus, Undo2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const promptTemplates = [
  { label: "科技峰会", prompt: "Tech conference poster, futuristic gradient background, holographic elements, bold typography" },
  { label: "电商促销", prompt: "E-commerce sale poster, vibrant colors, discount badges, product showcase layout, energetic vibe" },
  { label: "音乐节", prompt: "Music festival poster, psychedelic colors, sound wave graphics, bold headline, creative typography" },
  { label: "美食推广", prompt: "Food promotion poster, appetizing close-up, warm lighting, elegant plating, modern minimalist layout" },
];

const modelOptions = [
  { value: "image2-vip", label: "Image2 VIP", desc: "最高画质，细节极致" },
  { value: "image2", label: "Image2", desc: "高画质，性价比之选" },
  { value: "nano-banana-fast", label: "Nano Banana Fast", desc: "极速生成，快速预览" },
];

type GenerationMode = "text2img" | "img2img";

function CreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialPrompt = searchParams.get("prompt") || "";
  
  const [mode, setMode] = useState<GenerationMode>("text2img");
  const [prompt, setPrompt] = useState(initialPrompt);
  const promptRef = useRef(initialPrompt);
  const [ratio, setRatio] = useState("9:16");
  const [model, setModel] = useState("image2");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [result, setResult] = useState<{ url?: string; [key: string]: unknown } | null>(null);

  const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTemplateSelect = useCallback((templatePrompt: string) => {
    setPrompt(templatePrompt);
    promptRef.current = templatePrompt;
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("图片大小不能超过 10MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setRefImagePreview(previewUrl);
    setUploading(true);

    try {
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
        setRefImageUrl(data.key);
        (window as unknown as Record<string, unknown>).__refImageContentType = file.type;
        toast.success("参考图已上传");
      } else if (data.url) {
        setRefImageUrl(data.url);
        toast.success("参考图已上传");
      } else {
        throw new Error("No key or URL returned");
      }
    } catch (error) {
      console.error("Error preparing reference image:", error);
      toast.error("图片上传失败，请重试");
      setRefImagePreview(null);
      setRefImageUrl(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("请输入海报描述");
      return;
    }
    
    if (mode === "img2img" && !refImageUrl) {
      toast.error("请先上传参考图片");
      return;
    }

    setLoading(true);
    setProgress(0);
    setProgressStatus("正在提交任务...");
    setResult(null);

    try {
      const body: Record<string, unknown> = {
        prompt: prompt,
        ratio,
        model,
      };
      if (mode === "img2img" && refImageUrl) {
        if (!refImageUrl.startsWith("http") && !refImageUrl.startsWith("data:")) {
          body.refImageKey = refImageUrl;
          body.refImageContentType = (window as unknown as Record<string, unknown>).__refImageContentType || "image/jpeg";
        } else {
          body.refImageUrl = refImageUrl;
        }
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error((error as Record<string, string>).error || "Generation failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

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

            if (data.type === "progress") {
              setProgress(data.progress || 0);
              setProgressStatus(data.status === "submitted" ? "等待处理..." : 
                               data.status === "running" ? "正在生成..." : 
                               data.status === "uploading" ? "上传中..." : 
                               data.status || "处理中...");
            }

            if (data.type === "error") {
              throw new Error(data.error);
            }

            if (data.type === "complete") {
              setResult(data.data);
              setProgress(100);
              setProgressStatus("完成！");
              toast.success("海报生成成功！");
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message !== "Unexpected end of JSON input") {
              if (!(parseError instanceof SyntaxError)) throw parseError;
            }
          }
        }
      }
    } catch (error: unknown) {
      console.error("Generation error:", error);
      const msg = error instanceof Error ? error.message : "生成失败，请重试";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [prompt, mode, refImageUrl, ratio, model]);

  const handleDownload = useCallback(async () => {
    if (!result?.url) return;
    
    try {
      window.open(result.url as string, "_blank");
      toast.success("正在下载...");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("下载失败");
    }
  }, [result]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 dark:from-background dark:to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/60">
        <div className="mx-auto max-w-5xl px-3 sm:px-4 h-12 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Undo2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline text-sm">返回广场</span>
            </button>
            <div className="h-4 sm:h-6 w-px bg-border" />
            <h1 className="text-base sm:text-xl font-bold text-primary">创作中心</h1>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">SparkAI Studio</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Left: Input Panel */}
          <div className="space-y-3 sm:space-y-6 order-2 lg:order-1">
            {/* Mode Switcher */}
            <div className="bg-card rounded-xl sm:rounded-2xl p-1.5 sm:p-2 flex gap-1 shadow-sm border border-border">
              <button
                onClick={() => setMode("text2img")}
                className={cn(
                  "flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 sm:gap-2",
                  mode === "text2img"
                    ? "bg-primary text-white shadow-md"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                文字生图
              </button>
              <button
                onClick={() => setMode("img2img")}
                className={cn(
                  "flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 sm:gap-2",
                  mode === "img2img"
                    ? "bg-primary text-white shadow-md"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <ImagePlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                参考图生图
              </button>
            </div>

            {/* Reference Image Upload */}
            {mode === "img2img" && (
              <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-border">
                <Label className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 block">上传参考图片</Label>
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg sm:rounded-xl p-4 sm:p-8 text-center transition-colors cursor-pointer",
                    refImagePreview
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-xs sm:text-sm text-muted-foreground">上传中...</p>
                    </div>
                  ) : refImagePreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={refImagePreview} alt="Preview" className="max-h-32 sm:max-h-48 rounded-lg object-contain" />
                      <p className="text-primary text-xs sm:text-sm">点击更换图片</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-muted flex items-center justify-center">
                        <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">点击上传参考图片</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">支持 JPG、PNG，最大 10MB</p>
                    </div>
                  )}
                </div>
                {refImagePreview && (
                  <Button variant="ghost" size="sm" className="mt-2 sm:mt-3 w-full text-muted-foreground text-xs" onClick={() => { setRefImageUrl(null); setRefImagePreview(null); }}>
                    <X className="w-3.5 h-3.5 mr-1.5" />移除参考图
                  </Button>
                )}
              </div>
            )}

            {/* Prompt Input */}
            <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <Label className="text-sm sm:text-base font-semibold" htmlFor="prompt">
                  {mode === "text2img" ? "海报描述" : "图片描述"}
                </Label>
                <button onClick={() => { setPrompt(""); promptRef.current = ""; }} className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground">清空</button>
              </div>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); promptRef.current = e.target.value; }}
                placeholder={mode === "text2img" 
                  ? "描述你想要的海报内容..." 
                  : "描述你想要生成的图片内容..."}
                className="min-h-[100px] sm:min-h-[120px] resize-none text-sm border-input focus:ring-2 focus:ring-ring"
              />
              <div className="mt-3 sm:mt-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2">快捷模板</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {promptTemplates.map((template) => (
                    <button
                      key={template.label}
                      onClick={() => handleTemplateSelect(template.prompt)}
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs bg-secondary rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-border">
              <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">生成选项</h3>
              
              {/* Ratio */}
              <div className="mb-4 sm:mb-6">
                <Label className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 block">图片比例</Label>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {[
                    { value: "1:1", label: "1:1", desc: "方形" },
                    { value: "3:4", label: "3:4", desc: "竖版" },
                    { value: "4:3", label: "4:3", desc: "横版" },
                    { value: "9:16", label: "9:16", desc: "手机" },
                    { value: "16:9", label: "16:9", desc: "宽屏" },
                    { value: "2:3", label: "2:3", desc: "人像" },
                    { value: "21:9", label: "21:9", desc: "全景" },
                    { value: "A4", label: "A4", desc: "海报" },
                  ].map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRatio(r.value)}
                      className={cn(
                        "py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all flex flex-col items-center justify-center",
                        ratio === r.value
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-secondary text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <span className="text-xs sm:text-base font-bold">{r.label}</span>
                      <span className="text-[8px] sm:text-[10px] mt-0.5 opacity-70">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model */}
              <div>
                <Label className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 block">生成模型</Label>
                <div className="space-y-1.5 sm:space-y-2">
                  {modelOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setModel(opt.value)}
                      className={cn(
                        "w-full p-3 sm:p-4 rounded-lg sm:rounded-xl text-left transition-all flex items-center justify-between",
                        model === opt.value
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-secondary border-2 border-transparent hover:border-border"
                      )}
                    >
                      <div>
                        <p className={cn("text-xs sm:text-sm font-medium", model === opt.value ? "text-primary" : "")}>{opt.label}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                      {model === opt.value && (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-primary-foreground text-[10px] sm:text-xs">&#10003;</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || (mode === "img2img" && !refImageUrl)}
              className={cn(
                "w-full py-4 sm:py-6 text-base sm:text-lg font-bold rounded-xl sm:rounded-2xl transition-all shadow-lg",
                loading ? "bg-muted cursor-not-allowed" : "bg-primary hover:bg-primary/90 shadow-lg"
              )}
            >
              {loading ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  <span className="text-sm sm:text-base">{progressStatus}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Wand2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-sm sm:text-base">{mode === "img2img" ? "基于参考图生成" : "立即生成"}</span>
                </div>
              )}
            </Button>

            {/* Progress */}
            {loading && (
              <div className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm border border-border">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">{progressStatus}</span>
                  <span className="text-xs sm:text-sm font-medium text-primary">{progress}%</span>
                </div>
                <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Right: Preview Panel */}
          <div className="lg:sticky lg:top-24 lg:h-fit space-y-3 sm:space-y-6 order-1 lg:order-2">
            <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-base font-semibold">生成预览</h3>
                {result && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setResult(null)}>清空</Button>
                )}
              </div>
              
              <div className="aspect-[9/16] max-h-[360px] sm:max-h-[500px] mx-auto bg-muted rounded-lg sm:rounded-xl overflow-hidden flex items-center justify-center">
                {result?.url ? (
                  <img src={result.url as string} alt="Generated" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-muted-foreground p-4 sm:p-8">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <p className="text-xs sm:text-sm">生成的海报将在这里显示</p>
                  </div>
                )}
              </div>

              {result && (
                <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
                  <Button variant="outline" className="flex-1 text-xs sm:text-sm h-9 sm:h-10" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />下载
                  </Button>
                  <Button variant="outline" className="flex-1 text-xs sm:text-sm h-9 sm:h-10" onClick={() => { navigator.clipboard.writeText(result.url as string); toast.success("链接已复制"); }}>
                    复制链接
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-primary/5 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-primary/10">
              <h4 className="text-sm sm:text-base font-semibold text-primary mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />创作小贴士
              </h4>
              <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-start gap-1.5 sm:gap-2">
                  <span className="text-primary mt-0.5">&#8226;</span>描述越具体，生成效果越好
                </li>
                <li className="flex items-start gap-1.5 sm:gap-2">
                  <span className="text-primary mt-0.5">&#8226;</span>可以指定风格、颜色、布局等
                </li>
                <li className="flex items-start gap-1.5 sm:gap-2">
                  <span className="text-primary mt-0.5">&#8226;</span>使用参考图可以保持一致的视觉风格
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Page() {
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
