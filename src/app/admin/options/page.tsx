"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OptionItem {
  id: number;
  category: string;
  label: string;
  value: string | null;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  scene: "场景（使用平台/载体）",
  usage: "用途（模板功能）",
  style: "风格",
  color: "颜色",
  ratio: "图片比例",
  model: "生成模型",
};

const categoryColors: Record<string, string> = {
  scene: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  usage: "bg-green-500/10 text-green-500 border-green-500/20",
  style: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  ratio: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  model: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

export default function OptionsPage() {
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OptionItem | null>(null);

  const [formCategory, setFormCategory] = useState("scene");
  const [formLabel, setFormLabel] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSort, setFormSort] = useState("0");
  const [formVisible, setFormVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/options", { credentials: "include" });
      const result = await res.json();
      if (res.ok && result.data) {
        setOptions(result.data);
      } else {
        toast.error(result.error || "加载失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const openCreate = () => {
    setEditingItem(null);
    setFormCategory("scene");
    setFormLabel("");
    setFormValue("");
    setFormDesc("");
    setFormSort("0");
    setFormVisible(true);
    setDialogOpen(true);
  };

  const openEdit = (item: OptionItem) => {
    setEditingItem(item);
    setFormCategory(item.category);
    setFormLabel(item.label);
    setFormValue(item.value || "");
    setFormDesc(item.description || "");
    setFormSort(String(item.sort_order));
    setFormVisible(item.is_visible);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formLabel.trim()) {
      toast.error("标签名称不能为空");
      return;
    }

    setSaving(true);
    try {
      const body = {
        category: formCategory,
        label: formLabel.trim(),
        value: formValue.trim() || null,
        description: formDesc.trim() || null,
        sort_order: parseInt(formSort, 10) || 0,
        is_visible: formVisible,
      };

      if (editingItem) {
        const res = await fetch("/api/admin/options", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...body }),
        });
        const result = await res.json();
        if (res.ok) {
          toast.success("更新成功");
          setDialogOpen(false);
          fetchOptions();
        } else {
          toast.error(result.error || "更新失败");
        }
      } else {
        const res = await fetch("/api/admin/options", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await res.json();
        if (res.ok) {
          toast.success("创建成功");
          setDialogOpen(false);
          fetchOptions();
        } else {
          toast.error(result.error || "创建失败");
        }
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: OptionItem) => {
    if (!confirm(`确定删除「${item.label}」吗？`)) return;
    try {
      const res = await fetch(`/api/admin/options?id=${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("删除成功");
        fetchOptions();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const toggleVisible = async (item: OptionItem) => {
    try {
      const res = await fetch("/api/admin/options", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          is_visible: !item.is_visible,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(!item.is_visible ? "已显示" : "已隐藏");
        fetchOptions();
      } else {
        toast.error(result.error || "操作失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const moveItem = async (item: OptionItem, direction: "up" | "down") => {
    const sameCategory = options.filter((o) => o.category === item.category);
    const idx = sameCategory.findIndex((o) => o.id === item.id);
    if (idx === -1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sameCategory.length) return;

    const target = sameCategory[targetIdx];
    const newOrder = target.sort_order;

    try {
      const res = await fetch("/api/admin/options", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [
            { id: item.id, sort_order: newOrder },
            { id: target.id, sort_order: item.sort_order },
          ],
        }),
      });
      const result = await res.json();
      if (res.ok) {
        fetchOptions();
      } else {
        toast.error(result.error || "排序失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const grouped = options.reduce<Record<string, OptionItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const categoryOrder = ["scene", "usage", "style", "color", "ratio", "model"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">选项管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理创作中心的场景、用途、风格、颜色、比例、模型选项
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          新增选项
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {categoryOrder.map(
            (cat) =>
              grouped[cat] && (
                <div key={cat} className="bg-card border rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          categoryColors[cat] || "bg-muted text-muted-foreground"
                        )}
                      >
                        {cat}
                      </span>
                      <span className="font-semibold text-sm">
                        {categoryLabels[cat]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        共 {grouped[cat].length} 项
                      </span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {grouped[cat].map((item, idx) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between px-5 py-3 transition-colors",
                          !item.is_visible && "bg-muted/20"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "font-medium text-sm",
                                  !item.is_visible && "text-muted-foreground line-through"
                                )}
                              >
                                {item.label}
                              </span>
                              {item.value && (
                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {item.value}
                                </span>
                              )}
                              {!item.is_visible && (
                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveItem(item, "up")}
                            disabled={idx === 0}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveItem(item, "down")}
                            disabled={idx === grouped[cat].length - 1}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleVisible(item)}
                            title={item.is_visible ? "隐藏" : "显示"}
                          >
                            {item.is_visible ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "编辑选项" : "新增选项"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>分类</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scene">场景</SelectItem>
                  <SelectItem value="usage">用途</SelectItem>
                  <SelectItem value="style">风格</SelectItem>
                  <SelectItem value="color">颜色</SelectItem>
                  <SelectItem value="ratio">图片比例</SelectItem>
                  <SelectItem value="model">生成模型</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>标签名称</Label>
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="如：简约"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>值（比例/模型必填）</Label>
              <Input
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="比例如 1:1，模型如 image2"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                场景、用途、风格、颜色不需要填值
              </p>
            </div>
            <div>
              <Label>描述</Label>
              <Input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="选项描述（可选）"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>排序</Label>
              <Input
                type="number"
                value={formSort}
                onChange={(e) => setFormSort(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Label className="cursor-pointer">显示</Label>
              <Switch checked={formVisible} onCheckedChange={setFormVisible} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingItem ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
