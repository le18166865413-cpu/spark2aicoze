'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowUpDown, Clock, Eye, Download, X } from 'lucide-react';
import ImageCard from '@/components/ImageCard';

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

export default function HomePage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'views' | 'downloads'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchImages();
  }, [sortBy, sortOrder, timeRange]);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        ...(timeRange !== 'all' ? { timeRange } : {}),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/images?${params}`);
      const data = await res.json();
      setImages(data);
    } catch (err) {
      console.error('Failed to fetch images:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    fetchImages();
  }, [search, sortBy, sortOrder, timeRange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const timeRangeLabels: Record<string, string> = { all: '全部', today: '今天', week: '本周', month: '本月' };

  return (
    <div className="min-h-screen">
      {/* Hero Section - Compact on mobile */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground tracking-tight">
            海报广场
          </h1>
          <p className="mt-1.5 sm:mt-2 text-sm sm:text-base text-muted-foreground">
            AI 驱动的海报生成与展示平台
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-14 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search - icon button on mobile, expanded on click */}
            <div className="flex items-center flex-1 min-w-0">
              {searchOpen ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="搜索海报..."
                    className="flex-1 min-w-0 h-9 px-3 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                  <button
                    onClick={() => { handleSearch(); }}
                    className="h-9 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium shrink-0"
                  >
                    搜索
                  </button>
                  <button
                    onClick={() => { setSearchOpen(false); setSearch(''); }}
                    className="p-2 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort Toggle */}
            <button
              onClick={toggleSort}
              className="flex items-center gap-1 px-2.5 sm:px-3 h-9 text-xs sm:text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{sortOrder === 'desc' ? '最新优先' : '最早优先'}</span>
            </button>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'created_at' | 'views' | 'downloads')}
              className="h-9 px-2 sm:px-3 text-xs sm:text-sm bg-muted/50 hover:bg-muted border-0 rounded-lg text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shrink-0"
            >
              <option value="created_at">时间</option>
              <option value="views">浏览</option>
              <option value="downloads">下载</option>
            </select>

            {/* Time Range */}
            <div className="hidden sm:flex items-center gap-1">
              {(['all', 'today', 'week', 'month'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    timeRange === range
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {timeRangeLabels[range]}
                </button>
              ))}
            </div>

            {/* Mobile Time Range Dropdown */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as 'all' | 'today' | 'week' | 'month')}
              className="sm:hidden h-9 px-2 text-xs bg-muted/50 hover:bg-muted border-0 rounded-lg text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shrink-0"
            >
              <option value="all">全部</option>
              <option value="today">今天</option>
              <option value="week">本周</option>
              <option value="month">本月</option>
            </select>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-sm">暂无海报</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
            {images.map((image) => (
              <ImageCard key={image.id} image={image} onDelete={(id) => setImages((prev) => prev.filter((img) => img.id !== id))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
