"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";

interface RecycledImage {
  id: string;
  url: string;
  prompt: string;
  creatorName?: string;
  deletedAt: string;
}

export default function RecycleBinPage() {
  const [images, setImages] = useState<RecycledImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/recycle", { credentials: "include" });
      if (!res.ok) throw new Error("获取回收站数据失败");
      const data = await res.json();
      setImages(data.images || []);
    } catch (err) {
      toast.error("获取回收站数据失败: " + (err instanceof Error ? err.message : "请稍后重试"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === images.length && images.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map((img) => img.id)));
    }
  };

  const handleRestore = async () => {
    if (selectedIds.size === 0) {
      toast.info("请先选择要恢复的作品");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/recycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("恢复失败");
      toast.success(`成功恢复 ${selectedIds.size} 个作品`);
      setSelectedIds(new Set());
      await fetchImages();
    } catch (err) {
      toast.error("恢复失败: " + String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) {
      toast.info("请先选择要彻底删除的作品");
      return;
    }
    if (
      !confirm(
        `确定要彻底删除选中的 ${selectedIds.size} 个作品吗？此操作不可恢复！`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/recycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "permanent_delete" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "删除失败" }));
        throw new Error(errData.detail || errData.error || "删除失败");
      }
      toast.success(`成功彻底删除 ${selectedIds.size} 个作品`);
      setSelectedIds(new Set());
      await fetchImages();
    } catch (err) {
      toast.error("删除失败: " + String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const allSelected =
    images.length > 0 && selectedIds.size === images.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">回收站</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestore}
            disabled={actionLoading || selectedIds.size === 0}
          >
            {actionLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            恢复选中
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={actionLoading || selectedIds.size === 0}
          >
            {actionLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            彻底删除
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Trash2 className="h-12 w-12 mb-4 opacity-50" />
          <p>回收站为空</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="全选"
            />
            <span>
              已选择 {selectedIds.size} / {images.length} 个作品
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className="group relative rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={selectedIds.has(image.id)}
                    onCheckedChange={() => toggleSelect(image.id)}
                    aria-label={`选择 ${image.prompt}`}
                  />
                </div>
                <div className="aspect-square relative">
                  <img
                    src={image.url}
                    alt={image.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {image.prompt}
                  </p>
                  {image.creatorName && (
                    <p className="text-xs text-muted-foreground">
                      创作者: {image.creatorName}
                    </p>
                  )}
                  <p className="text-xs text-destructive">
                    删除于: {new Date(image.deletedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
