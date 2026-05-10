'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { ImageCard } from '@/components/ImageCard';
import { Loader2, ImageOff, FolderHeart, EyeOff, Images } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TabKey = 'works' | 'favorites' | 'hidden';

interface GalleryImage {
  id: string;
  prompt: string;
  url: string;
  imageKey: string;
  width: number;
  height: number;
  views: number;
  downloads: number;
  likes: number;
  referenceCount: number;
  model: string;
  ratio: string;
  liked: boolean;
  creatorName: string;
  userId: string | null;
  createdAt: string;
  isHidden?: boolean;
  isPinned?: boolean;
}

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'works', label: '我的作品', icon: Images },
  { key: 'favorites', label: '灵感库收藏', icon: FolderHeart },
  { key: 'hidden', label: '已隐藏作品', icon: EyeOff },
];

export default function MyWorksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('works');
  const [counts, setCounts] = useState({ works: 0, favorites: 0, hidden: 0 });

  const fetchCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/images?sortBy=created_at&sortOrder=desc&limit=1000&userId=${user.id}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data.images || []);
      const allImages: GalleryImage[] = rawList.map((item: Record<string, unknown>) => ({
        id: item.id as string,
        url: item.url as string,
        prompt: item.prompt as string,
        width: item.width as number,
        height: item.height as number,
        views: item.views as number,
        downloads: item.downloads as number,
        likes: item.likes as number,
        referenceCount: item.referenceCount as number,
        model: item.model as string,
        ratio: item.ratio as string,
        liked: item.liked as boolean,
        creatorName: item.creatorName as string,
        userId: item.userId as string | null,
        createdAt: item.createdAt as string,
        isHidden: item.isHidden as boolean,
        isPinned: item.isPinned as boolean,
      }));
      setCounts({
        works: allImages.filter((img) => !img.isHidden).length,
        favorites: allImages.filter((img) => img.liked && !img.isHidden).length,
        hidden: allImages.filter((img) => img.isHidden).length,
      });
    } catch (e) {
      console.error('Failed to fetch counts:', e);
    }
  }, [user]);

  const fetchImages = useCallback(async () => {
    if (!user?.id) return;
    try {
      let url: string;
      if (activeTab === 'favorites') {
        url = '/api/images?sortBy=created_at&sortOrder=desc&limit=200&favorites=1';
      } else if (activeTab === 'hidden') {
        url = `/api/images?sortBy=created_at&sortOrder=desc&limit=200&userId=${user.id}`;
      } else {
        url = `/api/images?sortBy=created_at&sortOrder=desc&limit=200&userId=${user.id}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data.images || []);
      const imageList: GalleryImage[] = rawList.map((item: Record<string, unknown>) => ({
        id: item.id as string,
        url: item.url as string,
        prompt: item.prompt as string,
        width: item.width as number,
        height: item.height as number,
        views: item.views as number,
        downloads: item.downloads as number,
        likes: item.likes as number,
        referenceCount: item.referenceCount as number,
        model: item.model as string,
        ratio: item.ratio as string,
        liked: item.liked as boolean,
        creatorName: item.creatorName as string,
        userId: item.userId as string | null,
        createdAt: item.createdAt as string,
        isHidden: item.isHidden as boolean,
        isPinned: item.isPinned as boolean,
      }));

      if (activeTab === 'works') {
        setImages(imageList.filter((img) => !img.isHidden));
      } else if (activeTab === 'hidden') {
        setImages(imageList.filter((img) => img.isHidden));
      } else {
        setImages(imageList);
      }
    } catch (e) {
      console.error('Failed to fetch images:', e);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/my-works');
      return;
    }
    if (user) {
      fetchCounts();
      fetchImages();
    }
  }, [user, authLoading, router, fetchImages, fetchCounts]);

  const handleDelete = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleHide = async (id: string) => {
    try {
      const res = await fetch(`/api/images/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || '隐藏失败');
        return;
      }
      setImages((prev) => prev.map((img) => img.id === id ? { ...img, isHidden: true } : img));
      toast.success('作品已隐藏');
    } catch {
      toast.error('隐藏失败');
    }
  };

  const handleUnhide = async (id: string) => {
    try {
      const res = await fetch(`/api/images/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden: false }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || '取消隐藏失败');
        return;
      }
      setImages((prev) => prev.map((img) => img.id === id ? { ...img, isHidden: false } : img));
      toast.success('作品已恢复显示');
    } catch {
      toast.error('取消隐藏失败');
    }
  };

  const filteredImages = images;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">我的作品</h1>
        <p className="text-muted-foreground mt-2">
          {user.nickname} 的创作集
        </p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className="ml-1 text-xs opacity-80">
                ({counts[tab.key as keyof typeof counts]})
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <ImageOff className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">
            {activeTab === 'works' && '还没有作品'}
            {activeTab === 'favorites' && '还没有收藏'}
            {activeTab === 'hidden' && '没有隐藏的作品'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {activeTab === 'works' && '去创作中心生成你的第一张海报吧'}
            {activeTab === 'favorites' && '点击海报上的爱心按钮收藏作品'}
            {activeTab === 'hidden' && '隐藏的作品会出现在这里'}
          </p>
          {activeTab === 'works' && (
            <a
              href="/create"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(34,197,94,0.15)]"
            >
              开始创作
            </a>
          )}
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {filteredImages.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              onHide={activeTab !== 'hidden' ? handleHide : undefined}
              onUnhide={activeTab === 'hidden' ? handleUnhide : undefined}
              onDelete={activeTab === 'hidden' ? handleDelete : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
