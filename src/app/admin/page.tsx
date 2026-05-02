'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Eye, Download, Zap, Clock } from 'lucide-react';
import Link from 'next/link';

interface Stats {
  totalImages: number;
  totalViews: number;
  totalDownloads: number;
  recentCount: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ totalImages: 0, totalViews: 0, totalDownloads: 0, recentCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/images?limit=1000');
        const data = await res.json();
        const images = Array.isArray(data) ? data : [];

        const totalViews = images.reduce((sum: number, img: Record<string, unknown>) => sum + ((img.views as number) || 0), 0);
        const totalDownloads = images.reduce((sum: number, img: Record<string, unknown>) => sum + ((img.downloads as number) || 0), 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentCount = images.filter((img: Record<string, unknown>) => new Date(img.createdAt as string) > weekAgo).length;

        setStats({ totalImages: images.length, totalViews, totalDownloads, recentCount });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: '海报总数', value: stats.totalImages, icon: ImageIcon, color: 'text-primary' },
    { label: '总浏览量', value: stats.totalViews, icon: Eye, color: 'text-blue-400' },
    { label: '总下载量', value: stats.totalDownloads, icon: Download, color: 'text-amber-400' },
    { label: '本周新增', value: stats.recentCount, icon: Clock, color: 'text-emerald-400' },
  ];

  const quickLinks = [
    { href: '/admin/settings', label: '网站设置', desc: '管理站点名称、描述和功能开关' },
    { href: '/admin/api-tokens', label: 'API 令牌', desc: '配置 GrsAI API Key 和模型参数' },
    { href: '/admin/theme', label: '主题配色', desc: '自定义网站颜色和主题风格' },
    { href: '/admin/storage', label: '图片存储', desc: '管理 S3 存储和文件配置' },
    { href: '/admin/import', label: '任务导入', desc: '手动导入 GrsAI 任务到广场' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats - 2列网格适配手机 */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/50 ${stat.color}`}>
                <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-base sm:text-xl font-bold text-foreground">
                  {loading ? '...' : stat.value.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2 sm:mb-3">快捷操作</h2>
        <div className="grid grid-cols-1 gap-2 sm:gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-card border border-border rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-primary/50 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                <Zap className="w-3 h-3 text-primary" />
                <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {link.label}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground ml-5">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* System Info */}
      <div className="bg-card border border-border rounded-lg sm:rounded-xl p-4 sm:p-5">
        <h2 className="text-xs sm:text-sm font-semibold text-foreground mb-2 sm:mb-3">系统信息</h2>
        <div className="grid grid-cols-2 gap-y-1.5 sm:gap-y-2 text-xs sm:text-sm">
          <span className="text-muted-foreground">平台版本</span>
          <span className="text-foreground">SparkAI v1.0.0</span>
          <span className="text-muted-foreground">框架</span>
          <span className="text-foreground">Next.js 16 + React 19</span>
          <span className="text-muted-foreground">数据存储</span>
          <span className="text-foreground">Supabase + S3</span>
          <span className="text-muted-foreground">AI 引擎</span>
          <span className="text-foreground">GrsAI (gpt-image-2)</span>
        </div>
      </div>
    </div>
  );
}
