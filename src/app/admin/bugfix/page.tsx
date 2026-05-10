"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bug, UserX, Trash2, AlertTriangle, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

export default function BugfixPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; message: string } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
    setLoading("export");
    setResult(null);
    try {
      const res = await fetch("/api/admin/bugfix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "exportS3Images" }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: "success", message: data.message });
        toast.success(data.message);

        // Export as CSV
        if (data.files && data.files.length > 0) {
          const csvHeader = "文件名,下载链接\n";
          const csvRows = data.files
            .map((f: { key: string; url: string }) => `"${f.key}","${f.url}"`)
            .join("\n");
          const csvContent = csvHeader + csvRows;
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `s3-images-export-${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bug className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Bug 修复</h1>
      </div>

      {result && (
        <Alert variant={result.type === "success" ? "default" : "destructive"}>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5" />
            修复匿名创作者
          </CardTitle>
          <CardDescription>
            一键将所有创作者名称为空或"匿名创作者"的作品，修改为"系统导入"
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
            一键清除数据库作品记录和对应的 S3 存储文件。可选择时间段，不选则清除全部。
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
            导出 S3 存储图片
          </CardTitle>
          <CardDescription>
            一键导出 S3 存储桶内所有文件的列表和签名下载链接，生成 CSV 文件。
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
            一键导出 S3 图片
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
