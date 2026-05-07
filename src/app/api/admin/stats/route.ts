import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyAdmin } from '@/lib/admin-auth';

export async function GET() {
  try {
    const adminCheck = await verifyAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
    }

    const supabase = getSupabaseClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Core counts
    const [
      totalImages,
      todayImages,
      weekImages,
      monthImages,
      totalUsers,
      pendingUsers,
      todayNewUsers,
      totalViews,
      totalDownloads,
      totalLiked,
    ] = await Promise.all([
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).gte('created_at', weekStart),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('gallery_images').select('views'),
      supabase.from('gallery_images').select('downloads'),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).eq('liked', true),
    ]);

    // Calculate totals from arrays
    const viewsTotal = totalViews.data?.reduce((sum: number, row: { views: number }) => sum + (row.views || 0), 0) || 0;
    const downloadsTotal = totalDownloads.data?.reduce((sum: number, row: { downloads: number }) => sum + (row.downloads || 0), 0) || 0;

    // Daily trend (last 30 days)
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).toISOString();
    const { data: dailyData } = await supabase
      .from('gallery_images')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo);

    const dailyTrend: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyTrend.push({ date: key, count: 0 });
    }
    if (dailyData) {
      for (const row of dailyData) {
        const day = row.created_at.split('T')[0];
        const entry = dailyTrend.find(d => d.date === day);
        if (entry) entry.count++;
      }
    }

    // Top creators (by image count)
    const { data: topCreatorsData } = await supabase
      .from('gallery_images')
      .select('creator_name, user_id')
      .not('user_id', 'is', null);

    const creatorCounts: Record<string, { name: string; count: number }> = {};
    if (topCreatorsData) {
      for (const row of topCreatorsData) {
        const uid = row.user_id || 'unknown';
        if (!creatorCounts[uid]) {
          creatorCounts[uid] = { name: row.creator_name || '未知', count: 0 };
        }
        creatorCounts[uid].count++;
      }
    }
    const topCreators = Object.entries(creatorCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Model distribution (global)
    const { data: modelData } = await supabase
      .from('gallery_images')
      .select('model');

    const modelDistribution: Record<string, number> = {};
    if (modelData) {
      for (const row of modelData) {
        const m = row.model || 'unknown';
        modelDistribution[m] = (modelDistribution[m] || 0) + 1;
      }
    }

    return NextResponse.json({
      overview: {
        totalImages: totalImages.count || 0,
        todayImages: todayImages.count || 0,
        weekImages: weekImages.count || 0,
        monthImages: monthImages.count || 0,
        totalUsers: totalUsers.count || 0,
        pendingUsers: pendingUsers.count || 0,
        todayNewUsers: todayNewUsers.count || 0,
        totalViews: viewsTotal,
        totalDownloads: downloadsTotal,
        totalLiked: totalLiked.count || 0,
      },
      dailyTrend,
      topCreators,
      modelDistribution,
    });
  } catch (error) {
    console.error('Admin stats API error:', error);
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 });
  }
}
