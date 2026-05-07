'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Eye, Download, Zap, Clock, Users, Heart, TrendingUp, BarChart3, UserPlus, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface OverviewStats {
  totalImages: number;
  todayImages: number;
  weekImages: number;
  monthImages: number;
  totalUsers: number;
  pendingUsers: number;
  todayNewUsers: number;
  totalViews: number;
  totalDownloads: number;
  totalLiked: number;
}

interface DailyTrendItem {
  date: string;
  count: number;
}

interface TopCreator {
  id: string;
  name: string;
  count: number;
}

const MODEL_LABELS: Record<string, string> = {
  'image2-vip': 'Spark2 VIP',
  'image2': 'Spark2',
  'nano-banana-fast': 'Spark Lite',
  'nano-banana-2': 'Banana 2',
  'nano-banana-pro-vip': 'Banana Pro',
  'gpt-image-2': 'GPT Image',
};

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendItem[]>([]);
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);
  const [modelDistribution, setModelDistribution] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setOverview(data.overview);
        setDailyTrend(data.dailyTrend || []);
        setTopCreators(data.topCreators || []);
        setModelDistribution(data.modelDistribution || {});
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = overview ? [
    { label: '海报总数', value: overview.totalImages, icon: ImageIcon, color: 'text-primary' },
    { label: '今日生成', value: overview.todayImages, icon: Zap, color: 'text-emerald-400' },
    { label: '本周生成', value: overview.weekImages, icon: TrendingUp, color: 'text-blue-400' },
    { label: '本月生成', value: overview.monthImages, icon: BarChart3, color: 'text-violet-400' },
    { label: '总浏览量', value: overview.totalViews, icon: Eye, color: 'text-blue-400' },
    { label: '总下载量', value: overview.totalDownloads, icon: Download, color: 'text-amber-400' },
    { label: '收藏总数', value: overview.totalLiked, icon: Heart, color: 'text-rose-400' },
    { label: '注册用户', value: overview.totalUsers, icon: Users, color: 'text-cyan-400' },
  ] : [];

  const trendMax = Math.max(...dailyTrend.map(d => d.count), 1);
  const modelEntries = Object.entries(modelDistribution).sort((a, b) => b[1] - a[1]);
  const modelMax = modelEntries.length > 0 ? modelEntries[0][1] : 1;

  const quickLinks = [
    { href: '/admin/settings', label: '网站设置', desc: '管理站点名称、描述和功能开关' },
    { href: '/admin/creation', label: '创作配置', desc: '模板、模型、比例、限制等配置' },
    { href: '/admin/users', label: '用户管理', desc: '审批用户、管理权限' },
    { href: '/admin/storage', label: '图片存储', desc: '管理 S3 存储和文件配置' },
    { href: '/admin/import', label: '任务导入', desc: '手动导入和自动监控' },
    { href: '/admin/theme', label: '主题配色', desc: '自定义网站颜色和主题风格' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted/50 ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold text-foreground">
                  {loading ? '...' : stat.value.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending users alert */}
      {overview && overview.pendingUsers > 0 && (
        <Link href="/admin/users" className="block">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 hover:bg-amber-500/15 transition-colors">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-600">
                {overview.pendingUsers} 位用户待审批
              </p>
              <p className="text-xs text-amber-500/70">点击前往用户管理审批</p>
            </div>
            <UserPlus className="w-4 h-4 text-amber-500 ml-auto" />
          </div>
        </Link>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Trend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            近 30 天生成趋势
          </h2>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {dailyTrend.map((item) => {
              const pct = trendMax > 0 ? (item.count / trendMax) * 100 : 0;
              const dayLabel = item.date.slice(5);
              return (
                <div key={item.date} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{dayLabel}</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.max(pct, item.count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-6 text-right shrink-0">{item.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Creators */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            创作者排行
          </h2>
          {topCreators.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
          ) : (
            <div className="space-y-3">
              {topCreators.map((creator, idx) => {
                const maxCount = topCreators[0]?.count || 1;
                const pct = (creator.count / maxCount) * 100;
                return (
                  <div key={creator.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-amber-500/20 text-amber-500' :
                          idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                          idx === 2 ? 'bg-orange-500/20 text-orange-500' :
                          'bg-muted text-muted-foreground'
                        }`}>{idx + 1}</span>
                        <span className="text-sm">{creator.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{creator.count} 张</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          idx === 0 ? 'bg-amber-500' :
                          idx === 1 ? 'bg-gray-400' :
                          idx === 2 ? 'bg-orange-500' :
                          'bg-primary/50'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Model Distribution */}
      {modelEntries.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            模型使用分布
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {modelEntries.map(([model, count]) => {
              const total = overview?.totalImages || 1;
              const pct = ((count / total) * 100).toFixed(1);
              return (
                <div key={model} className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-sm font-medium">{MODEL_LABELS[model] || model}</p>
                  <p className="text-lg font-bold text-primary">{count}</p>
                  <p className="text-xs text-muted-foreground">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">快捷操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3 h-3 text-primary" />
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {link.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
