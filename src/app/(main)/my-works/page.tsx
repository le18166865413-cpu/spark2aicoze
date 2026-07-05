'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { ImageCard } from '@/components/ImageCard';
import { Loader2, ImageOff, FolderHeart, EyeOff, Images, Package, Plus, Pencil, Trash2, Upload, X, Check, Image as ImageIcon, Type } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { authFetch } from '@/utils/auth-fetch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type TabKey = 'works' | 'favorites' | 'hidden' | 'brandkit';

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

interface BrandKitItem {
  id: number;
  userId: string;
  name: string;
  type: 'image' | 'text';
  content?: string;
  imageKey?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

const tabs: { key: TabKey; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { key: 'works', label: '我的作品', shortLabel: '作品', icon: Images },
  { key: 'favorites', label: '灵感库收藏', shortLabel: '收藏', icon: FolderHeart },
  { key: 'hidden', label: '已隐藏作品', shortLabel: '隐藏', icon: EyeOff },
  { key: 'brandkit', label: 'Brand Kit', shortLabel: 'Kit', icon: Package },
];

export default function MyWorksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('works');
  const [counts, setCounts] = useState({ works: 0, favorites: 0, hidden: 0, brandkit: 0 });

  // Brand Kit 状态
  const [brandKitItems, setBrandKitItems] = useState<BrandKitItem[]>([]);
  const [brandKitLoading, setBrandKitLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editItem, setEditItem] = useState<BrandKitItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  
  // 表单状态
  const [addType, setAddType] = useState<'image' | 'text'>('text');
  const [addName, setAddName] = useState('');
  const [addContent, setAddContent] = useState('');
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [addImagePreview, setAddImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Fetch user's own works
      const worksRes = await authFetch(`/api/images?sortBy=created_at&sortOrder=desc&limit=1000&userId=${user.id}`);
      let worksCount = 0;
      let hiddenCount = 0;
      if (worksRes.ok) {
        const data = await worksRes.json();
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
        worksCount = allImages.filter((img) => !img.isHidden).length;
        hiddenCount = allImages.filter((img) => img.isHidden).length;
      }

      // Fetch favorites count separately
      const favRes = await authFetch('/api/images?sortBy=created_at&sortOrder=desc&limit=1000&favorites=1');
      let favoritesCount = 0;
      if (favRes.ok) {
        const favData = await favRes.json();
        const favList = Array.isArray(favData) ? favData : (favData.images || []);
        favoritesCount = favList.length;
      }

      // Fetch brand kit count
      const kitRes = await authFetch('/api/brand-kit');
      let brandKitCount = 0;
      if (kitRes.ok) {
        const kitData = await kitRes.json();
        brandKitCount = Array.isArray(kitData) ? kitData.length : 0;
      }

      setCounts({
        works: worksCount,
        favorites: favoritesCount,
        hidden: hiddenCount,
        brandkit: brandKitCount,
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

      const res = await authFetch(url);
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

  const fetchBrandKit = useCallback(async () => {
    if (!user?.id) return;
    setBrandKitLoading(true);
    try {
      const res = await authFetch('/api/brand-kit');
      if (res.ok) {
        const data = await res.json();
        setBrandKitItems(Array.isArray(data) ? data : []);
        setCounts((prev) => ({ ...prev, brandkit: Array.isArray(data) ? data.length : 0 }));
      }
    } catch (e) {
      console.error('Failed to fetch brand kit:', e);
    } finally {
      setBrandKitLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/my-works');
      return;
    }
    if (user) {
      fetchCounts();
      if (activeTab === 'brandkit') {
        fetchBrandKit();
      } else {
        fetchImages();
      }
    }
  }, [user, authLoading, router, activeTab, fetchImages, fetchCounts, fetchBrandKit]);

  const handleDelete = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleHide = async (id: string) => {
    try {
      const res = await authFetch(`/api/images/${id}`, {
        method: 'PATCH',
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
      const res = await authFetch(`/api/images/${id}`, {
        method: 'PATCH',
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

  // Brand Kit 操作
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAddImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAddImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddBrandKit = async () => {
    if (!addName.trim()) {
      toast.error('请输入素材名称');
      return;
    }
    
    if (addType === 'text' && !addContent.trim()) {
      toast.error('请输入素材内容');
      return;
    }

    if (addType === 'image' && !addImageFile) {
      toast.error('请选择图片');
      return;
    }

    setUploading(true);
    try {
      let imageKey = '';
      let imageUrl = '';

      // 如果是图片类型，先上传图片
      if (addType === 'image' && addImageFile) {
        const formData = new FormData();
        formData.append('file', addImageFile);
        formData.append('type', 'brandkit');
        
        const uploadRes = await authFetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          toast.error(err.error || '图片上传失败');
          setUploading(false);
          return;
        }

        const uploadData = await uploadRes.json();
        imageKey = uploadData.imageKey || uploadData.key;
        imageUrl = uploadData.url;
      }

      // 创建 Brand Kit 记录
      const res = await authFetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName.trim(),
          type: addType,
          content: addType === 'text' ? addContent.trim() : null,
          imageKey,
          imageUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || '创建素材失败');
        return;
      }

      toast.success('素材已添加');
      setShowAddModal(false);
      resetAddForm();
      fetchBrandKit();
      fetchCounts();
    } catch (e) {
      console.error('Add brand kit error:', e);
      toast.error('添加素材失败');
    } finally {
      setUploading(false);
    }
  };

  const handleEditBrandKit = async () => {
    if (!editItem) return;
    
    if (!addName.trim()) {
      toast.error('请输入素材名称');
      return;
    }
    
    if (editItem.type === 'text' && !addContent.trim()) {
      toast.error('请输入素材内容');
      return;
    }

    setUploading(true);
    try {
      let imageKey = editItem.imageKey;
      let imageUrl = editItem.imageUrl;

      // 如果选择了新图片，先上传
      if (editItem.type === 'image' && addImageFile) {
        const formData = new FormData();
        formData.append('file', addImageFile);
        formData.append('type', 'brandkit');
        
        const uploadRes = await authFetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          toast.error(err.error || '图片上传失败');
          setUploading(false);
          return;
        }

        const uploadData = await uploadRes.json();
        imageKey = uploadData.imageKey || uploadData.key;
        imageUrl = uploadData.url;
      }

      const res = await authFetch(`/api/brand-kit/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName.trim(),
          content: editItem.type === 'text' ? addContent.trim() : null,
          imageKey,
          imageUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || '更新素材失败');
        return;
      }

      toast.success('素材已更新');
      setShowEditModal(false);
      resetAddForm();
      fetchBrandKit();
    } catch (e) {
      console.error('Edit brand kit error:', e);
      toast.error('更新素材失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBrandKit = async () => {
    if (!deleteItemId) return;

    try {
      const res = await authFetch(`/api/brand-kit/${deleteItemId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || '删除素材失败');
        return;
      }

      toast.success('素材已删除');
      setShowDeleteConfirm(false);
      setDeleteItemId(null);
      fetchBrandKit();
      fetchCounts();
    } catch (e) {
      console.error('Delete brand kit error:', e);
      toast.error('删除素材失败');
    }
  };

  const openEditModal = (item: BrandKitItem) => {
    setEditItem(item);
    setAddName(item.name);
    setAddContent(item.content || '');
    setAddType(item.type);
    setAddImagePreview(item.imageUrl || '');
    setShowEditModal(true);
  };

  const resetAddForm = () => {
    setAddName('');
    setAddContent('');
    setAddType('text');
    setAddImageFile(null);
    setAddImagePreview('');
    setEditItem(null);
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
                'flex items-center gap-1.5 px-3 py-1.5 md:gap-2 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all border shrink-0',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.shortLabel}</span>
              <span className="ml-0.5 text-[10px] md:text-xs opacity-80">
                ({counts[tab.key as keyof typeof counts]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Brand Kit Tab 内容 */}
      {activeTab === 'brandkit' && (
        <div className="space-y-6">
          {/* 新增按钮 */}
          <div className="flex justify-end">
            <Button
              onClick={() => {
                resetAddForm();
                setShowAddModal(true);
              }}
              className="gap-2 shadow-[0_0_15px_rgba(34,197,94,0.15)]"
            >
              <Plus className="w-4 h-4" />
              新增素材
            </Button>
          </div>

          {brandKitLoading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : brandKitItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground mb-2">
                还没有品牌素材
              </h2>
              <p className="text-muted-foreground mb-6">
                添加 LOGO、联系方式、品牌信息等，在创作时可快速引用
              </p>
              <Button
                onClick={() => {
                  resetAddForm();
                  setShowAddModal(true);
                }}
                className="gap-2 shadow-[0_0_15px_rgba(34,197,94,0.15)]"
              >
                <Plus className="w-4 h-4" />
                开始添加
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 图片素材 */}
              {brandKitItems.filter((item) => item.type === 'image').length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    图片素材
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {brandKitItems
                      .filter((item) => item.type === 'image')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="group relative bg-card rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-all"
                        >
                          <div className="aspect-square">
                            <img
                              src={item.imageUrl || ''}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-2">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                          </div>
                          {/* 操作按钮 */}
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 bg-background/80 rounded-lg hover:bg-background"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteItemId(item.id);
                                setShowDeleteConfirm(true);
                              }}
                              className="p-1.5 bg-background/80 rounded-lg hover:bg-background hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 文字素材 */}
              {brandKitItems.filter((item) => item.type === 'text').length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    文字素材
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {brandKitItems
                      .filter((item) => item.type === 'text')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="group relative bg-card rounded-xl p-4 border border-border hover:border-primary/30 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Type className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {item.content}
                              </p>
                            </div>
                          </div>
                          {/* 操作按钮 */}
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 bg-background/80 rounded-lg hover:bg-background"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteItemId(item.id);
                                setShowDeleteConfirm(true);
                              }}
                              className="p-1.5 bg-background/80 rounded-lg hover:bg-background hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 其他 Tab 内容 */}
      {activeTab !== 'brandkit' && (
        loading ? (
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
        )
      )}

      {/* 新增素材弹窗 */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        setShowAddModal(open);
        if (!open) resetAddForm();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              新增品牌素材
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 类型选择 */}
            <div className="flex gap-2">
              <Button
                variant={addType === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAddType('text')}
                className="gap-1.5"
              >
                <Type className="w-4 h-4" />
                文字
              </Button>
              <Button
                variant={addType === 'image' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAddType('image')}
                className="gap-1.5"
              >
                <ImageIcon className="w-4 h-4" />
                图片
              </Button>
            </div>

            {/* 名称 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">名称</label>
              <Input
                placeholder="如：公司名称、联系电话、LOGO..."
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>

            {/* 文字内容 */}
            {addType === 'text' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">内容</label>
                <Textarea
                  placeholder="输入素材内容..."
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* 图片上传 */}
            {addType === 'image' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">图片</label>
                <div className="relative">
                  {addImagePreview ? (
                    <div className="relative aspect-square rounded-xl overflow-hidden border border-border">
                      <img
                        src={addImagePreview}
                        alt="预览"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => {
                          setAddImageFile(null);
                          setAddImagePreview('');
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-lg hover:bg-background"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="border border-border rounded-xl p-8 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">点击上传图片</p>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              取消
            </Button>
            <Button onClick={handleAddBrandKit} disabled={uploading}>
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {uploading ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑素材弹窗 */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        setShowEditModal(open);
        if (!open) resetAddForm();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              编辑素材
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 名称 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">名称</label>
              <Input
                placeholder="如：公司名称、联系电话、LOGO..."
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>

            {/* 文字内容 */}
            {editItem?.type === 'text' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">内容</label>
                <Textarea
                  placeholder="输入素材内容..."
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* 图片 */}
            {editItem?.type === 'image' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">图片</label>
                <div className="relative">
                  <div className="relative aspect-square rounded-xl overflow-hidden border border-border">
                    <img
                      src={addImagePreview || editItem?.imageUrl || ''}
                      alt="预览"
                      className="w-full h-full object-cover"
                    />
                    {addImagePreview && (
                      <button
                        onClick={() => {
                          setAddImageFile(null);
                          setAddImagePreview(editItem?.imageUrl || '');
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-lg hover:bg-background"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      id="image-edit-upload"
                    />
                    <label
                      htmlFor="image-edit-upload"
                      className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/30 text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      更换图片
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              取消
            </Button>
            <Button onClick={handleEditBrandKit} disabled={uploading}>
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {uploading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">
            删除后无法恢复，确定要删除这个素材吗？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteBrandKit}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}