"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ImageCard } from "@/components/ImageCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Clock, Eye, Download, Search, Sparkles, ImagePlus, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";

type SortBy = "views" | "downloads" | "created_at";
type SortOrder = "asc" | "desc";
type Period = "day" | "week" | "month" | "all";

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
  imageKey?: string;
  taskId?: string;
  creatorName?: string;
  userId?: string | null;
}

export default function Home() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [period, setPeriod] = useState<Period>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [columnCount, setColumnCount] = useState(2);
  const [pageSize, setPageSize] = useState(50);
  const [galleryTitle, setGalleryTitle] = useState("海报生成记录");
  const [gallerySubtitle, setGallerySubtitle] = useState("查看通过 SparkAI 生成的所有海报作品");
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: string; nickname?: string } | null>(null);

  // Load current user
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  // Load config
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.galleryPageSize) setPageSize(Number(data.galleryPageSize));
        if (data.galleryTitle) setGalleryTitle(data.galleryTitle);
        if (data.gallerySubtitle) setGallerySubtitle(data.gallerySubtitle);
      })
      .catch(() => {});
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (sortBy) queryParams.set("sortBy", sortBy);
      if (sortOrder) queryParams.set("sortOrder", sortOrder);
      if (period && period !== "all") queryParams.set("period", period);
      if (debouncedSearch) queryParams.set("search", debouncedSearch);
      queryParams.set("limit", String(pageSize));

      const res = await fetch(`/api/images?${queryParams.toString()}`);
      const data = await res.json();
      setImages(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder, period, debouncedSearch, pageSize]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Refresh when page becomes visible (user navigates back from create page)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchImages();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchImages]);

  // Responsive column count
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) setColumnCount(2);
      else if (w < 1024) setColumnCount(3);
      else if (w < 1280) setColumnCount(4);
      else if (w < 1536) setColumnCount(5);
      else setColumnCount(6);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Distribute images into columns
  const columns = useMemo(() => {
    if (!images.length) return [];

    const cols = Array.from({ length: columnCount }, () => [] as GalleryImage[]);

    images.forEach((img, i) => {
      cols[i % columnCount].push(img);
    });

    return cols.filter(col => col.length > 0);
  }, [images, columnCount]);

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === "desc" ? "asc" : "desc");
  };

  // Handle image deletion
  const handleDeleteImage = (deletedId: string) => {
    setImages(prev => prev.filter(img => img.id !== deletedId));
  };

  return (
    <div className="pt-6 px-4 pb-8 max-w-[1800px] mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
          {galleryTitle}
        </h1>
        <p className="text-muted-foreground text-lg">
          {gallerySubtitle}
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-card border rounded-2xl shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search Bar */}
        <div className="relative flex-1 w-full max-w-2xl group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <Input
            className="w-full h-11 pl-11 pr-10 rounded-xl border-input bg-background focus:ring-2 focus:ring-primary/20 text-sm transition-all"
            placeholder="搜索海报关键词..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <div className="absolute inset-y-0 right-2 flex items-center">
              <button
                onClick={() => setSearch("")}
                className="w-7 h-7 hover:bg-muted rounded-full flex items-center justify-center text-muted-foreground transition-colors"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto md:gap-2">
          {/* Sort Dropdown */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-auto min-w-0 flex-[1.4] md:w-[130px] md:flex-none h-10 rounded-xl border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary/20 gap-2">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border shadow-lg">
              <SelectItem value="created_at" className="cursor-pointer rounded-lg">
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> 生成时间</div>
              </SelectItem>
              <SelectItem value="views" className="cursor-pointer rounded-lg">
                <div className="flex items-center gap-2"><Eye className="w-4 h-4" /> 浏览热度</div>
              </SelectItem>
              <SelectItem value="downloads" className="cursor-pointer rounded-lg">
                <div className="flex items-center gap-2"><Download className="w-4 h-4" /> 下载数量</div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Order Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSortOrder}
            className="w-10 h-10 flex-shrink-0 rounded-xl border-input"
            title={sortOrder === "desc" ? "当前：降序 (从高到低)" : "当前：升序 (从低到高)"}
          >
            {sortOrder === "desc" ? <ArrowDownWideNarrow className="w-4 h-4" /> : <ArrowUpNarrowWide className="w-4 h-4" />}
          </Button>

          {/* Time Period Dropdown */}
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-auto min-w-0 flex-[0.8] md:w-[120px] md:flex-none h-10 rounded-xl border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border shadow-lg">
              <SelectItem value="all" className="cursor-pointer rounded-lg">全部时间</SelectItem>
              <SelectItem value="day" className="cursor-pointer rounded-lg">24小时内</SelectItem>
              <SelectItem value="week" className="cursor-pointer rounded-lg">一周内</SelectItem>
              <SelectItem value="month" className="cursor-pointer rounded-lg">一个月内</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
            </div>
            <p className="text-muted-foreground text-sm">加载中...</p>
          </div>
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
          <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-2">
            <ImagePlus className="w-10 h-10 opacity-30" />
          </div>
          <p className="text-xl font-semibold">还没有生成记录</p>
          <p className="text-sm text-muted-foreground/70 max-w-md text-center">
            前往创作中心，使用 AI 生成你的第一张海报吧
          </p>
          <Button asChild className="mt-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all px-6">
            <Link href="/create">
              <Palette className="w-4 h-4 mr-2" />
              开始创作
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex justify-center gap-4">
          {columns.map((colImages, colIndex) => (
            <div key={colIndex} className="flex flex-col gap-4 flex-1 min-w-0 max-w-[360px]">
              {colImages.map((img, imgIndex) => {
                const globalIndex = colIndex * Math.ceil(images.length / columns.length) + imgIndex;
                return (
                  <ImageCard
                    key={img.id}
                    image={img}
                    isAdmin={currentUser?.role === "admin"}
                    onDelete={currentUser?.role === "admin" ? handleDeleteImage : undefined}
                    onHide={currentUser?.id && currentUser.id === img.userId ? handleDeleteImage : undefined}
                    priority={globalIndex < 4}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
