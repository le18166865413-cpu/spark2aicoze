import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Download, Eye, ImageOff, Heart, Copy, Trash2, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GalleryImage {
  id: string;
  url: string;
  prompt: string;
  width: number;
  height: number;
  views: number;
  downloads: number;
  imageKey?: string;
  taskId?: string;
  createdAt?: string;
}

export function ImageCard({ image, onDelete }: { image: GalleryImage; onDelete?: (id: string) => void }) {
  const [imgError, setImgError] = useState(false);
  const [liked, setLiked] = useState(false);
  const router = useRouter();

  const handleDownload = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      window.open(image.url, "_blank");
      toast.success("正在下载...");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("下载失败，请重试");
    }
  };

  const handleMakeSame = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const encodedPrompt = encodeURIComponent(image.prompt);
    router.push(`/create?prompt=${encodedPrompt}`);
  };

  const handleDelete = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    if (!confirm("确定要删除这张海报吗？")) {
      return;
    }

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("已删除");
        onDelete?.(image.id);
      } else {
        toast.error("删除失败");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("删除失败，请重试");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="group relative break-inside-avoid overflow-hidden rounded-xl bg-card border border-border/50 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer">
          {/* Image */}
          {imgError ? (
            <div
              className="w-full bg-muted/30 flex flex-col items-center justify-center p-8 text-muted-foreground"
              style={{ aspectRatio: `${image.width || 3} / ${image.height || 4}` }}
            >
              <ImageOff className="w-10 h-10 mb-2 opacity-30" />
            </div>
          ) : (
            <div className="relative overflow-hidden">
              <Image
                src={image.url}
                alt={image.prompt}
                width={image.width || 300}
                height={image.height || 400}
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                unoptimized={true}
                onError={() => setImgError(true)}
              />
            </div>
          )}

          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Hover Overlay Controls */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-2 md:p-4 flex flex-col justify-between pointer-events-none">
            {/* Top Section */}
            <div className="flex justify-end gap-1 md:gap-2 pointer-events-auto">
              <Button
                size="icon"
                className={cn(
                  "rounded-full w-7 h-7 md:w-10 md:h-10 transition-all",
                  liked
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/20"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setLiked(!liked);
                  toast.success(liked ? "已取消收藏" : "已收藏到灵感库");
                }}
              >
                <Heart className={cn("w-3.5 h-3.5 md:w-5 md:h-5", liked && "fill-current")} />
              </Button>
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col gap-1 md:gap-3 pointer-events-auto">
              <p className="text-white text-xs md:text-sm line-clamp-1 md:line-clamp-2 font-medium drop-shadow-lg">
                {image.prompt}
              </p>
              <div className="flex justify-end gap-1 md:gap-2">
                {/* 制作同款 */}
                <Button
                  size="sm"
                  className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] md:text-xs font-medium px-2 md:px-3 h-6 md:h-8"
                  onClick={handleMakeSame}
                >
                  <Copy className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1" />
                  制作同款
                </Button>
                {/* 删除 */}
                <Button
                  size="icon"
                  className="rounded-full bg-red-500/80 hover:bg-red-500 text-white w-6 h-6 md:w-9 md:h-9"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                </Button>
                {/* 下载 */}
                <Button
                  size="icon"
                  className="rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/20 w-6 h-6 md:w-9 md:h-9"
                  onClick={handleDownload}
                >
                  <Download className="w-3 h-3 md:w-4 md:h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogTrigger>

      {/* Detail Modal - Modern SaaS Style */}
      <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-[1400px] h-[90vh] md:h-[85vh] overflow-hidden bg-background rounded-2xl p-0 flex flex-col md:flex-row focus:outline-none border border-border shadow-2xl">
        <DialogTitle className="sr-only">海报详情</DialogTitle>

        {/* Left Image Side */}
        <div className="flex-1 md:flex-[1.5] lg:flex-[2] bg-muted/20 flex items-center justify-center relative overflow-hidden h-[40vh] md:h-full min-w-0 md:min-w-[50%]">
          <div className="relative w-full h-full p-6 flex items-center justify-center">
            {imgError ? (
              <div className="flex flex-col items-center text-muted-foreground">
                <ImageOff className="w-16 h-16 mb-4 opacity-30" />
                <p>图片加载失败</p>
              </div>
            ) : (
              <img
                src={image.url}
                alt={image.prompt}
                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                onError={() => setImgError(true)}
              />
            )}
          </div>
        </div>

        {/* Right Info Side */}
        <div className="w-full md:w-[400px] flex-shrink-0 p-6 md:p-8 flex flex-col gap-6 bg-background h-full overflow-y-auto">
          <div className="flex items-center justify-between sticky top-0 bg-background z-10 pb-4 border-b">
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" className="rounded-full hover:bg-secondary">
                <Share2 className="w-4 h-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-full hover:bg-secondary"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6 shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all">
              收藏
            </Button>
          </div>

          <div className="space-y-4">
            <h1 className="text-xl md:text-2xl font-semibold leading-tight line-clamp-3 md:line-clamp-none">
              {image.prompt}
            </h1>
          </div>

          <div className="flex items-center gap-4 py-4 border-t border-dashed">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
              AI
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">SparkAI Studio</p>
              <p className="text-xs text-muted-foreground">智能海报设计师</p>
            </div>
            <Button variant="secondary" className="rounded-full font-semibold text-sm">
              关注
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 py-1">
            <div className="flex flex-col gap-0.5 p-2 rounded-xl bg-muted/50">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Eye className="w-3 h-3" />
                浏览量
              </span>
              <span className="text-base font-bold">{image.views}</span>
            </div>
            <div className="flex flex-col gap-0.5 p-2 rounded-xl bg-muted/50">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Download className="w-3 h-3" />
                下载量
              </span>
              <span className="text-base font-bold">{image.downloads}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button 
              className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-6 text-base shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all"
              onClick={handleMakeSame}
            >
              <Copy className="w-5 h-5 mr-2" />
              制作同款
            </Button>
            <Button 
              variant="outline" 
              className="w-full rounded-xl font-semibold py-6 text-base border-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all"
              onClick={handleDownload}
            >
              <Download className="w-5 h-5 mr-2" />
              下载图片
            </Button>
          </div>

          {/* Prompt Details */}
          <div className="flex flex-col gap-2 pt-4 border-t">
            <h3 className="text-sm font-semibold text-muted-foreground">提示词</h3>
            <div className="p-3 rounded-xl bg-muted/50 text-sm leading-relaxed">
              {image.prompt}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
