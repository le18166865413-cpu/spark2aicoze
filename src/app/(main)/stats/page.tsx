'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, TrendingUp, Calendar, BarChart3, PieChart, Heart, Image, Users, Clock, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/utils/auth-fetch';

interface UserStats {
  today: number;
  yesterday: number;
  week: number;
  month: number;
  year: number;
  total: number;
  liked: number;
  dailyTrend: Record<string, number>;
  modelDistribution: Record<string, number>;
  ratioDistribution: Record<string, number>;
  accountAge: number;
}

interface GlobalStats {
  today: number;
  total: number;
  users: number;
}

const MODEL_LABELS: Record<string, string> = {
  'image2-vip': 'Spark2 VIP',
  'image2': 'Spark2',
  'nano-banana-fast': 'Spark Lite',
  'nano-banana-2': 'Banana 2',
  'nano-banana-pro-vip': 'Banana Pro',
  'gpt-image-2': 'GPT Image',
};

const BAR_COLORS = [
  'bg-primary',
  'bg-primary/70',
  'bg-primary/50',
  'bg-primary/35',
  'bg-primary/25',
  'bg-muted-foreground/30',
];

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/stats');
      if (res.status === 401) {
        router.replace('/login?redirect=/stats');
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setUserStats(data.user);
      setGlobalStats(data.global);
    } catch {
      // Silently fail - stats are non-critical
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/stats');
      return;
    }
    fetchStats();
  }, [user, authLoading, router, fetchStats]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !userStats) return null;

  const todayVsYesterday = userStats.yesterday > 0
    ? ((userStats.today - userStats.yesterday) / userStats.yesterday * 100).toFixed(0)
    : userStats.today > 0 ? '100' : '0';

  const avgPerDay = userStats.accountAge > 0
    ? (userStats.total / userStats.accountAge).toFixed(1)
    : '0';

  // Sort model distribution
  const modelEntries = Object.entries(userStats.modelDistribution).sort((a, b) => b[1] - a[1]);
  const modelMax = modelEntries.length > 0 ? modelEntries[0][1] : 1;

  // Sort ratio distribution
  const ratioEntries = Object.entries(userStats.ratioDistribution).sort((a, b) => b[1] - a[1]);
  const ratioMax = ratioEntries.length > 0 ? ratioEntries[0][1] : 1;

  // Daily trend data (sorted by date ascending)
  const trendEntries = Object.entries(userStats.dailyTrend).sort((a, b) => a[0].localeCompare(b[0]));
  const trendMax = Math.max(...trendEntries.map(([, v]) => v), 1);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">使用统计</h1>
        <p className="text-muted-foreground mt-2">
          {user.nickname} 的创作数据 · 注册 {userStats.accountAge} 天 · 日均 {avgPerDay} 张
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Image className="w-5 h-5" />}
          label="今日生成"
          value={userStats.today}
          trend={Number(todayVsYesterday)}
          color="primary"
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label="本周生成"
          value={userStats.week}
          color="blue"
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="本月生成"
          value={userStats.month}
          color="emerald"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="累计作品"
          value={userStats.total}
          color="amber"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<Heart className="w-5 h-5" />}
          label="被收藏数"
          value={userStats.liked}
          color="rose"
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label="年度生成"
          value={userStats.year}
          color="violet"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="日均创作"
          value={Number(avgPerDay)}
          decimal
          color="cyan"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Daily Trend Chart */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            近 14 天生成趋势
          </h3>
          <div className="space-y-2">
            {trendEntries.map(([date, count]) => {
              const pct = trendMax > 0 ? (count / trendMax) * 100 : 0;
              const dayLabel = date.slice(5); // MM-DD
              return (
                <div key={date} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-12 text-right shrink-0">{dayLabel}</span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", count > 0 ? "bg-primary" : "bg-muted")}
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-8 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Model Distribution */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            模型使用分布
          </h3>
          {modelEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
          ) : (
            <div className="space-y-3">
              {modelEntries.map(([model, count], idx) => {
                const pct = modelMax > 0 ? (count / modelMax) * 100 : 0;
                const totalPct = userStats.total > 0 ? ((count / userStats.total) * 100).toFixed(1) : '0';
                return (
                  <div key={model}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{MODEL_LABELS[model] || model}</span>
                      <span className="text-xs text-muted-foreground">{count} 张 ({totalPct}%)</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", BAR_COLORS[idx % BAR_COLORS.length])}
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

      {/* Ratio Distribution */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border mb-8">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          比例使用分布
        </h3>
        {ratioEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ratioEntries.map(([ratio, count], idx) => {
              const totalPct = userStats.total > 0 ? ((count / userStats.total) * 100).toFixed(1) : '0';
              return (
                <div key={ratio} className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white", BAR_COLORS[idx % BAR_COLORS.length])}>
                    {ratio}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{count} 张</p>
                    <p className="text-xs text-muted-foreground">{totalPct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Stats */}
      {globalStats && (
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            平台概况
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <p className="text-2xl font-bold text-primary">{globalStats.today}</p>
              <p className="text-xs text-muted-foreground mt-1">今日全站生成</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <p className="text-2xl font-bold text-primary">{globalStats.total}</p>
              <p className="text-xs text-muted-foreground mt-1">全站累计作品</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <p className="text-2xl font-bold text-primary">{globalStats.users}</p>
              <p className="text-xs text-muted-foreground mt-1">注册用户数</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  trend,
  decimal,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: number;
  decimal?: boolean;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    blue: 'bg-blue-500/10 text-blue-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    rose: 'bg-rose-500/10 text-rose-500',
    violet: 'bg-violet-500/10 text-violet-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
  };

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorMap[color] || colorMap.primary)}>
          {icon}
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold">{decimal ? value.toFixed(1) : value}</span>
        {trend !== undefined && (
          <span className={cn(
            "text-xs font-medium flex items-center gap-0.5 mb-1",
            trend > 0 ? "text-emerald-500" : trend < 0 ? "text-rose-500" : "text-muted-foreground"
          )}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : trend < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
            {trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : '-'}
          </span>
        )}
      </div>
    </div>
  );
}
