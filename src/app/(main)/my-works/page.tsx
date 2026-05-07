'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { ImageCard } from '@/components/ImageCard';
import { Loader2, ImageOff } from 'lucide-react';

interface GalleryImage {
  id: string;
  prompt: string;
  url: string;
  imageKey: string;
  width: number;
  height: number;
  views: number;
  downloads: number;
  model: string;
  ratio: string;
  liked: boolean;
  creatorName: string;
  userId: string | null;
  createdAt: string;
}

export default function MyWorksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyImages = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/images?sortBy=created_at&sortOrder=desc&limit=200&userId=${user.id}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const imageList = Array.isArray(data) ? data : (data.images || []);
      setImages(imageList);
    } catch (e) {
      console.error('Failed to fetch images:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchMyImages();
    }
  }, [user, authLoading, router, fetchMyImages]);

  const handleDelete = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

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
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">我的作品</h1>
        <p className="text-muted-foreground mt-2">
          {user.nickname} 的创作集 · 共 {images.length} 件作品
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <ImageOff className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">还没有作品</h2>
          <p className="text-muted-foreground mb-6">去创作中心生成你的第一张海报吧</p>
          <a
            href="/create"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(34,197,94,0.15)]"
          >
            开始创作
          </a>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
