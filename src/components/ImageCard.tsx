import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Download, ImageOff, Heart, Copy, Share2, Sparkles, ImageIcon, EyeOff, RotateCcw, Trash2, ThumbsUp, Pin } from "lucide-react";
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
  likes: number;
  referenceCount: number;
  liked?: boolean;
  imageKey?: string;
  taskId?: string;
  createdAt?: string;
  creatorName?: string;
  isHidden?: boolean;
  isPinned?: boolean;
}

interface ImageCardProps {
  image: GalleryImage;
  onDelete?: (id: string) => void;
  onHide?: (id: string) => void;
  onUnhide?: (id: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
  isAdmin?: boolean;
  priority?: boolean;
}

export function ImageCard({ image, onDelete, onHide, onUnhide, onPin, isAdmin = false, priority = false }: ImageCardProps) {
  const [imgError, setImgError] = useState(false);
  const [detailImgError, setDetailImgError] = useState(false);
  const [liked, setLiked] = useState(image.liked || false);
  const [likes, setLikes] = useState(image.likes || 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [pinned, setPinned] = useState(image.isPinned || false);
  const [pinLoading, setPinLoading] = useState(false);
  const [showMakeSameDialog, setShowMakeSameDialog] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const router = useRouter();

  const handleLike = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      const res = await fetch(`/api/images/${image.id}/like`, { method: "POST", credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikes(data.likes || 0);
        toast.success(data.liked ? "已加入灵感库" : "已取消收藏");
      } else if (res.status === 401) {
        toast.error("请先登录");
      } else {
        toast.error("操作失败");
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setLikeLoading(false);
    }
  };

  const handlePin = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (pinLoading || !isAdmin) return;
    setPinLoading(true);
    try {
      const action = pinned ? "unpin" : "pin";
      const res = await fetch(`/api/images/${image.id}/pin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setPinned(data.pinned);
        toast.success(data.pinned ? "已置顶" : "已取消置顶");
        onPin?.(image.id, data.pinned);
      } else {
        toast.error("操作失败");
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setPinLoading(false);
    }
  };

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
    setShowMakeSameDialog(true);
  };

  const recordReference = async () => {
    try {
      await fetch(`/api/images/${image.id}/reference`, { method: "POST" });
    } catch {
      // silently fail
    }
  };

  const goCreateWithRef = () => {
    setShowMakeSameDialog(false);
    recordReference();
    const encodedPrompt = encodeURIComponent(image.prompt);
    const encodedRefUrl = encodeURIComponent(image.url);
    router.push(`/create?prompt=${encodedPrompt}&mode=img2img&refImageUrl=${encodedRefUrl}`);
  };

  const goCreateTextOnly = () => {
    setShowMakeSameDialog(false);
    recordReference();
    const encodedPrompt = encodeURIComponent(image.prompt);
    router.push(`/create?prompt=${encodedPrompt}&mode=text2img`);
  };

  const handleDelete = async (e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (!confirm("确定要删除这张海报吗？删除后可在后台回收站恢复。")) {
      return;
    }

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: "DELETE",
        credentials: "include",
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

  const handleHideClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("确定要隐藏这张海报吗？隐藏后不会在广场中显示，但可以在「已隐藏作品」中恢复。")) {
      return;
    }
    onHide?.(image.id);
  };

  const handleUnhideClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUnhide?.(image.id);
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
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
                unoptimized={true}
                onError={() => setImgError(true)}
              />
            </div>
          )}

          {/* Overlay Gradient & Controls - desktop only */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none hidden md:block" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex-col justify-between pointer-events-none hidden md:flex">
            {/* Top Section - desktop */}
            <div className="flex justify-between gap-2 pointer-events-auto">
              {isAdmin && (
                <Button
                  size="sm"
                  className={cn(
                    "rounded-full text-xs font-medium px-3 h-8 transition-all",
                    pinned
                      ? "bg-yellow-600 hover:bg-yellow-600/90 text-white"
                      : "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/20"
                  )}
                  onClick={handlePin}
                >
                  <Pin className={cn("w-3 h-3 mr-1 transition-all", pinned && "fill-current")} />
                  {pinned ? "已置顶" : "置顶"}
                </Button>
              )}
              <div className="ml-auto">
                <Button
                  size="sm"
                  className={cn(
                    "rounded-full text-xs font-medium px-3 h-8 transition-all",
                    liked
                      ? "bg-red-500 hover:bg-red-500/90 text-white"
                      : "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/20"
                  )}
                  onClick={handleLike}
                >
                  <Heart className={cn("w-3 h-3 mr-1 transition-all", liked && "fill-current")} />
                  {liked ? "已收藏" : "收藏"}
                </Button>
              </div>
            </div>
            {/* Bottom Section - desktop */}
            <div className="flex flex-col gap-3 pointer-events-auto">
              <p className="text-white text-sm line-clamp-2 font-medium drop-shadow-lg">{image.prompt}</p>
              <div className="flex justify-end gap-2">
                <Button size="sm" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 h-8" onClick={handleMakeSame}>
                  <Copy className="w-3 h-3 mr-1" />制作同款
                </Button>
                {onDelete && (
                  <Button size="sm" className="rounded-full bg-red-500 hover:bg-red-500/90 text-white text-xs font-medium px-3 h-8" onClick={handleDelete}>
                    <Trash2 className="w-3 h-3 mr-1" />删除
                  </Button>
                )}
                {onHide && (
                  <Button size="sm" className="rounded-full bg-amber-500 hover:bg-amber-500/90 text-white text-xs font-medium px-3 h-8" onClick={handleHideClick}>
                    <EyeOff className="w-3 h-3 mr-1" />隐藏
                  </Button>
                )}
                {onUnhide && (
                  <Button size="sm" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 h-8" onClick={handleUnhideClick}>
                    <RotateCcw className="w-3 h-3 mr-1" />恢复
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile: buttons below image */}
          <div className="flex md:hidden items-center justify-between px-2 py-1.5">
            <p className="text-xs text-muted-foreground line-clamp-1 flex-1 mr-2">{image.prompt}</p>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Button size="icon" variant="ghost" className={cn("w-8 h-8 rounded-full", pinned && "text-yellow-600")} onClick={handlePin}>
                  <Pin className={cn("w-4 h-4 transition-all", pinned && "fill-current scale-110", pinLoading && "opacity-50")} />
                </Button>
              )}
              <Button size="icon" variant="ghost" className={cn("w-8 h-8 rounded-full", liked && "text-red-500")} onClick={handleLike}>
                <Heart className={cn("w-4 h-4 transition-all", liked && "fill-current scale-110", likeLoading && "opacity-50")} />
              </Button>
              <Button size="icon" variant="ghost" className="w-8 h-8 rounded-full text-primary" onClick={handleMakeSame}>
                <Copy className="w-4 h-4" />
              </Button>
              {onHide && (
                <Button size="icon" variant="ghost" className="w-8 h-8 rounded-full text-amber-500" onClick={handleHideClick}>
                  <EyeOff className="w-4 h-4" />
                </Button>
              )}
              {onUnhide && (
                <Button size="icon" variant="ghost" className="w-8 h-8 rounded-full text-primary" onClick={handleUnhideClick}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
              {onDelete && (
                <Button size="icon" variant="ghost" className="w-8 h-8 rounded-full text-destructive" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

        </div>
      </DialogTrigger>

      {/* Detail Modal - Modern SaaS Style */}
      <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-[1400px] h-[90vh] md:h-[85vh] overflow-hidden bg-background rounded-2xl p-0 flex flex-col md:flex-row focus:outline-none border border-border shadow-2xl">
        <DialogTitle className="sr-only">海报详情</DialogTitle>

        {/* Left Image Side */}
        <div className="flex-shrink-0 md:flex-1 md:flex-[1.5] lg:flex-[2] bg-muted/20 flex items-center justify-center relative overflow-hidden h-[35vh] md:h-full min-w-0 md:min-w-[50%]">
          <div className="relative w-full h-full p-2 md:p-6 flex items-center justify-center">
            {detailImgError ? (
              <div className="flex flex-col items-center text-muted-foreground">
                <ImageOff className="w-16 h-16 mb-4 opacity-30" />
                <p>图片加载失败</p>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={image.url}
                alt={image.prompt}
                className="max-w-full max-h-full object-contain rounded-lg shadow-xl cursor-zoom-in"
                onError={() => setDetailImgError(true)}
                onClick={() => setPreviewOpen(true)}
              />
            )}
          </div>
        </div>

        {/* Right Info Side */}
        <div className="w-full md:w-[400px] flex-shrink-0 p-4 md:p-6 md:p-8 flex flex-col gap-4 md:gap-6 bg-background md:h-full overflow-y-auto flex-1 md:flex-none">
          <div className="flex items-center justify-between sticky top-0 bg-background z-10 pb-4 border-b">
            <div className="flex gap-2">
              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn("rounded-full hover:bg-secondary", pinned && "text-yellow-600")}
                  onClick={handlePin}
                >
                  <Pin className={cn("w-4 h-4", pinned && "fill-current")} />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="rounded-full hover:bg-secondary">
                <Share2 className="w-4 h-4" />
              </Button>
              {onDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full hover:bg-secondary"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
              {onHide && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full hover:bg-secondary"
                  onClick={handleHideClick}
                  title="隐藏"
                >
                  <EyeOff className="w-4 h-4 text-amber-500" />
                </Button>
              )}
              {onUnhide && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full hover:bg-secondary"
                  onClick={handleUnhideClick}
                  title="恢复显示"
                >
                  <RotateCcw className="w-4 h-4 text-primary" />
                </Button>
              )}
            </div>
            <Button onClick={handleLike} disabled={likeLoading} className={cn("rounded-full font-bold px-6 transition-all", liked ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 shadow-none" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]")}>
              <Heart className={cn("w-4 h-4 mr-1.5", liked && "fill-current")} />
              {liked ? "已收藏" : "收藏"}
            </Button>
          </div>

          <div className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
              {(image.creatorName || 'AI')[0]}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{image.creatorName || '匿名创作者'}</p>
              <p className="text-xs text-muted-foreground">海报创作者</p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 flex items-center justify-center gap-1.5 text-sm rounded-lg border border-border bg-card px-4 py-2">
              <ThumbsUp className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">点赞量</span>
              <span className="font-bold">{likes}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 text-sm rounded-lg border border-border bg-card px-4 py-2">
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">参考量</span>
              <span className="font-bold">{image.referenceCount || 0}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-5 text-sm shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all"
              onClick={handleMakeSame}
            >
              <Copy className="w-4 h-4 mr-1.5" />
              制作同款
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-xl font-semibold py-5 text-sm border-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-1.5" />
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

      {/* Image Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none" onInteractOutside={() => setPreviewOpen(false)}>
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          <img
            src={image.url}
            alt={image.prompt}
            className="w-full h-full object-contain max-h-[85vh] rounded-lg"
            onClick={() => setPreviewOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Make Same Choice Dialog */}
      <Dialog open={showMakeSameDialog} onOpenChange={setShowMakeSameDialog}>
        <DialogContent className="w-[90vw] max-w-[400px] bg-background rounded-2xl p-6 border border-border shadow-2xl">
          <DialogTitle className="text-lg font-bold text-center">制作同款</DialogTitle>
          <p className="text-sm text-muted-foreground text-center -mt-2">选择生成方式</p>
          <div className="flex flex-col gap-3 mt-2">
            <button
              onClick={goCreateWithRef}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <ImageIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">参考图生图</p>
                <p className="text-xs text-muted-foreground mt-0.5">使用该图作为参考图生成</p>
              </div>
            </button>
            <button
              onClick={goCreateTextOnly}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">文生图</p>
                <p className="text-xs text-muted-foreground mt-0.5">仅使用提示词生成</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
