import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyUser } from '@/lib/admin-auth';

export async function GET() {
  try {
    // Get current user from session
    const userInfo = await verifyUser();
    if (!userInfo) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    const userId = userInfo.id;
    const now = new Date();

    // Time boundaries
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

    // --- User's own stats ---
    const [todayData, weekData, monthData, yearData, totalData, yesterdayData] = await Promise.all([
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', todayStart),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', weekStart),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthStart),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', yearStart),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', yesterdayStart).lt('created_at', todayStart),
    ]);

    // --- Global stats ---
    const [globalTodayData, globalTotalData, globalUsersData, globalLikedData] = await Promise.all([
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true }).eq('liked', true).eq('user_id', userId),
    ]);

    // --- Daily trend (last 14 days) ---
    const fourteenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13).toISOString();
    const { data: dailyData } = await supabase
      .from('gallery_images')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', fourteenDaysAgo);

    // Aggregate daily counts
    const dailyTrend: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyTrend[key] = 0;
    }
    if (dailyData) {
      for (const row of dailyData) {
        const day = row.created_at.split('T')[0];
        if (day in dailyTrend) {
          dailyTrend[day]++;
        }
      }
    }

    // --- Model usage distribution ---
    const { data: modelData } = await supabase
      .from('gallery_images')
      .select('model')
      .eq('user_id', userId);

    const modelDistribution: Record<string, number> = {};
    if (modelData) {
      for (const row of modelData) {
        const m = row.model || 'unknown';
        modelDistribution[m] = (modelDistribution[m] || 0) + 1;
      }
    }

    // --- Ratio usage distribution ---
    const { data: ratioData } = await supabase
      .from('gallery_images')
      .select('ratio')
      .eq('user_id', userId);

    const ratioDistribution: Record<string, number> = {};
    if (ratioData) {
      for (const row of ratioData) {
        const r = row.ratio || 'unknown';
        ratioDistribution[r] = (ratioDistribution[r] || 0) + 1;
      }
    }

    // Account age
    const { data: userInfoData } = await supabase
      .from('users')
      .select('created_at')
      .eq('id', userId)
      .single();

    const accountAge = userInfoData ? Math.max(1, Math.ceil((now.getTime() - new Date(userInfoData.created_at).getTime()) / (1000 * 60 * 60 * 24))) : 1;

    return NextResponse.json({
      user: {
        today: todayData.count || 0,
        yesterday: yesterdayData.count || 0,
        week: weekData.count || 0,
        month: monthData.count || 0,
        year: yearData.count || 0,
        total: totalData.count || 0,
        liked: globalLikedData.count || 0,
        dailyTrend,
        modelDistribution,
        ratioDistribution,
        accountAge,
      },
      global: {
        today: globalTodayData.count || 0,
        total: globalTotalData.count || 0,
        users: globalUsersData.count || 0,
      },
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 });
  }
}
