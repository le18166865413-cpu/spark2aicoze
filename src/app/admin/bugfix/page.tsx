"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bug, UserX, Trash2, AlertTriangle, Loader2, Download, Upload } from "lucide-react";
import { toast } from "sonner";

export default function BugfixPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; message: string } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFixAnonymous = async () => {
    setLoading("fix");
    setResult(null);
    try {
      const res = await fetch("/api/admin/bugfix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "fixAnonymousCreators" }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: "success", message: data.message });
        toast.success(data.message);
      } else {
        setResult({ type: "error", message: data.error || "操作失败" });
        toast.error(data.error || "操作失败");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ type: "error", message: msg });
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const handleClearStorage = async () => {
    const confirmed = window.confirm(
      `确定要清除${startDate || endDate ? "指定时间段内" : "所有"}的作品和存储吗？此操作不可恢复！`
    );
    if (!confirmed) return;

    setLoading("clear");
    setResult(null);
    try {
      const res = await fetch("/api/admin/bugfix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "clearStorage",
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: "success", message: data.message });
        toast.success(data.message);
      } else {
        setResult({ type: "error", message: data.error || "操作失败" });
        toast.error(data.error || "操作失败");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ type: "error", message: msg });
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const handleExportS3Images = async () => {
    console.log("[Export] 开始导出...");
    setLoading("export");
    setResult(null);
    try {
      console.log("[Export] 发送请求...");
      const res = await fetch("/api/admin/bugfix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "exportS3Images" }),
      });
      console.log("[Export] 收到响应:", res.status);
      if (!res.ok) {
        const text = await res.text();
        console.error("[Export] 响应错误:", res.status, text);
        throw new Error(`请求失败: ${res.status} - ${text.slice(0, 100)}`);
      }
      const data = await res.json();
      console.log("[Export] 解析数据:", data);
      if (data.success) {
        setResult({ type: "success", message: data.message });
        toast.success(data.message);

        // Export as JSON
        if (data.records && data.records.length > 0) {
          console.log("[Export] 开始下载文件，记录数:", data.records.length);
          const jsonContent = JSON.stringify(data.records, null, 2);
          const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `sparkai-images-export-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log("[Export] 下载完成");
        } else {
          console.log("[Export] 没有记录需要导出");
          toast.info("数据库中没有图片记录");
        }
      } else {
        setResult({ type: "error", message: data.error || "导出失败" });
        toast.error(data.error || "导出失败");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ type: "error", message: msg });
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const handleImportImages = async () => {
    if (!importFile) {
      toast.error("请先选择要导入的 JSON 文件");
      return;
    }

    const confirmed = window.confirm(
      `确定要导入 "${importFile.name}" 中的图片记录吗？已存在的记录会被跳过。`
    );
    if (!confirmed) return;

    setLoading("import");
    setResult(null);
    try {
      const text = await importFile.text();
      let records: unknown[];
      try {
        records = JSON.parse(text);
      } catch {
        toast.error("JSON 文件格式不正确");
        setLoading(null);
        return;
      }

      if (!Array.isArray(records) || records.length === 0) {
        toast.error("文件中没有有效的图片记录");
        setLoading(null);
        return;
      }

      const res = await fetch("/api/admin/bugfix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "importImages", records }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: "success", message: data.message });
        toast.success(data.message);
        setImportFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        setResult({ type: "error", message: data.error || "导入失败" });
        toast.error(data.error || "导入失败");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ type: "error", message: msg });
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bug className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Bug 修复</h1>
      </div>

      {result && (
        <Alert variant={result.type === "success" ? "default" : "destructive"}>
          <AlertDescription className="whitespace-pre-wrap">{result.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5" />
            修复匿名创作者
          </CardTitle>
          <CardDescription>
            一键将所有创作者名称为空或&ldquo;匿名创作者&rdquo;的作品，修改为&ldquo;系统导入&rdquo;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleFixAnonymous}
            disabled={loading === "fix"}
            className="w-full sm:w-auto"
          >
            {loading === "fix" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <UserX className="w-4 h-4 mr-2" />
            )}
            一键修复匿名创作者
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            清除存储和作品
          </CardTitle>
          <CardDescription>
            清除数据库作品记录和对应的 S3 存储文件。可选择时间段，不选则清除全部。操作完成后会自动扫描并清理 S3 中的孤儿文件，确保存储完全干净。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">开始时间</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">结束时间</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background"
              />
            </div>
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              警告：此操作会永久删除作品记录和 S3 存储文件，不可恢复！
            </AlertDescription>
          </Alert>

          <Button
            variant="destructive"
            onClick={handleClearStorage}
            disabled={loading === "clear"}
            className="w-full sm:w-auto"
          >
            {loading === "clear" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            一键清除所有存储和作品
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            导出图片数据
          </CardTitle>
          <CardDescription>
            导出所有图片记录，包含提示词、作者、模型、比例、参考图、签名下载链接等完整信息，生成 JSON 文件。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExportS3Images}
            disabled={loading === "export"}
            className="w-full sm:w-auto"
          >
            {loading === "export" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            一键导出图片数据
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            导入图片数据
          </CardTitle>
          <CardDescription>
            从 JSON 文件导入图片记录到数据库。已存在的记录（按 image_key 或 id 去重）会被自动跳过，不会重复导入。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </div>
            {importFile && (
              <p className="text-sm text-muted-foreground">
                已选择：{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            <Button
              onClick={handleImportImages}
              disabled={loading === "import" || !importFile}
              className="w-full sm:w-auto"
            >
              {loading === "import" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              导入图片记录
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
