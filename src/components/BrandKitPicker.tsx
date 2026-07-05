'use client';

import { useState, useEffect } from 'react';
import { Loader2, Package, Search, Image as ImageIcon, Type, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { authFetch } from '@/utils/auth-fetch';

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

interface BrandKitPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (items: BrandKitItem[]) => void;
  mode: 'image' | 'all'; // 'image' 只显示图片素材，'all' 显示所有素材
  maxSelect?: number; // 最大选择数量
}

export function BrandKitPicker({
  open,
  onOpenChange,
  onSelect,
  mode,
  maxSelect = 4,
}: BrandKitPickerProps) {
  const [items, setItems] = useState<BrandKitItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      fetchItems();
      setSelectedIds(new Set());
      setSearch('');
    }
  }, [open]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/brand-kit${mode === 'image' ? '?type=image' : ''}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch brand kit:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(searchLower) ||
      (item.content && item.content.toLowerCase().includes(searchLower))
    );
  });

  const handleSelect = (item: BrandKitItem) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else if (newSelected.size < maxSelect) {
      newSelected.add(item.id);
    }
    setSelectedIds(newSelected);
  };

  const handleConfirm = () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    onSelect(selectedItems);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {mode === 'image' ? '从 Brand Kit 选择图片' : '从 Brand Kit 选择素材'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 搜索框 */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索素材..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent border-none outline-none"
            />
          </div>

          {/* 素材列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {items.length === 0 ? '还没有品牌素材' : '没有匹配的素材'}
              </p>
              {items.length === 0 && (
                <a
                  href="/my-works"
                  className="text-sm text-primary hover:underline mt-2"
                >
                  前往添加 →
                </a>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    'relative group cursor-pointer rounded-xl overflow-hidden transition-all',
                    item.type === 'image'
                      ? 'aspect-square border-2'
                      : 'p-3 border-2 flex flex-col items-center justify-center min-h-[100px]',
                    selectedIds.has(item.id)
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  {item.type === 'image' ? (
                    <>
                      <img
                        src={item.imageUrl || ''}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {selectedIds.has(item.id) && (
                          <Check className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      {selectedIds.has(item.id) && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5">
                        <p className="text-xs text-white truncate">{item.name}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                        <Type className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-center truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground text-center truncate mt-1">
                        {item.content}
                      </p>
                      {selectedIds.has(item.id) && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 底部操作 */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              已选择 {selectedIds.size} / {maxSelect}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selectedIds.size === 0}
                className="shadow-[0_0_15px_rgba(34,197,94,0.15)]"
              >
                <Check className="w-4 h-4 mr-1" />
                添加
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}