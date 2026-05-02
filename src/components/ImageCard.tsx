'use client';

import { useState } from 'react';
import { Download, Eye, X, ZoomIn, Share2, Trash2, ImageIcon } from 'lucide-react';

interface GalleryImage {
  id: string;
  imageKey: string;
  prompt: string;
  url: string;
  width: number;
  height: number;
  views: number;
  downloads: number;
  model: string;
  ratio: string;
  taskId: string;
  createdAt: string;
}

interface ImageCardProps {
  image: GalleryImage;
  onDelete?: (id: string) => void;
}

export default function ImageCard({ image, onDelete }: ImageCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `sparkai-${image.id.slice(0, 8)}.png`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleDelete = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('确定要删除这张海报吗？')) return;
    try {
      const res = await fetch(`/api/images/${image.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete?.(image.id);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleShare = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({
          title: image.prompt,
          url: image.url,
        });
      } else {
        await navigator.clipboard.writeText(image.url);
        alert('链接已复制到剪贴板');
      }
    } catch (err) {
      // User cancelled share, ignore
    }
  };

  const aspectRatio = image.width && image.height ? image.width / image.height : 1;

  const modelNames: Record<string, string> = {
    'gpt-image-2-vip': 'GPT Image 2 VIP',
    'gpt-image-2': 'GPT Image 2',
    'nano-banana-fast': 'Nano Banana',
    image2: 'GPT Image 2',
  };

  return (
    <>
      {/* Card */}
      <div
        className="break-inside-avoid group cursor-pointer rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5"
        onClick={() => setShowDetail(true)}
      >
        <div
          className="relative w-full bg-muted/30"
          style={{ aspectRatio: Math.max(0.5, Math.min(aspectRatio, 2)) }}
        >
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground/30 animate-pulse" />
            </div>
          )}
          <img
            src={image.url}
            alt={image.prompt}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          {/* Hover action buttons */}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
            <button
              onClick={handleDownload}
              className="p-2 bg-black/50 backdrop-blur-sm rounded-lg text-white hover:bg-black/70 transition-colors"
              title="下载"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleShare}
              className="p-2 bg-black/50 backdrop-blur-sm rounded-lg text-white hover:bg-black/70 transition-colors"
              title="分享"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {onDelete && (
              <button
                onClick={handleDelete}
                className="p-2 bg-black/50 backdrop-blur-sm rounded-lg text-white hover:bg-red-500/80 transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Hover prompt */}
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <p className="text-white text-sm line-clamp-2 leading-snug">{image.prompt}</p>
          </div>
        </div>
        {/* Bottom info bar */}
        <div className="px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{modelNames[image.model] || image.model}</span>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1 text-xs">
              <Eye className="w-3.5 h-3.5" />{image.views}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <Download className="w-3.5 h-3.5" />{image.downloads}
            </span>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="bg-card w-full max-w-2xl rounded-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h3 className="text-base font-semibold text-foreground truncate pr-2">海报详情</h3>
              <button
                onClick={() => setShowDetail(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image */}
            <div className="overflow-auto flex-1 p-4">
              <div className="relative rounded-xl overflow-hidden bg-muted/30">
                <img
                  src={image.url}
                  alt={image.prompt}
                  className="w-full h-auto max-h-[55vh] object-contain"
                />
              </div>
            </div>

            {/* Info & Actions */}
            <div className="border-t border-border px-5 py-4 space-y-3 shrink-0">
              <p className="text-sm text-foreground leading-relaxed">{image.prompt}</p>

              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-xs rounded-md font-medium">
                  {modelNames[image.model] || image.model}
                </span>
                <span className="px-2.5 py-0.5 bg-muted text-muted-foreground text-xs rounded-md">
                  {image.ratio}
                </span>
                <span className="px-2.5 py-0.5 bg-muted text-muted-foreground text-xs rounded-md">
                  {image.width}×{image.height}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{image.views}</span>
                  <span className="flex items-center gap-1"><Download className="w-3.5 h-3.5" />{image.downloads}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(image.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleShare(); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  分享
                </button>
                {onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                )}
                <a
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                  查看原图
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
