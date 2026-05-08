import { getSupabaseClient } from "@/storage/database/supabase-client";

const DEFAULTS: Record<string, string> = {
  site_name: "SparkAI",
  site_title: "SparkAI - 智能海报生成器",
  site_description: "AI 驱动的海报生成与展示平台",
};

let cachedConfig: { siteName: string; siteTitle: string; siteDescription: string } | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute cache

export async function getSiteConfig() {
  const now = Date.now();
  if (cachedConfig && now - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", ["site_name", "site_title", "site_description"]);

    const settings: Record<string, string> = {};
    if (data) {
      for (const item of data) {
        settings[item.key] = item.value;
      }
    }

    cachedConfig = {
      siteName: settings.site_name || DEFAULTS.site_name,
      siteTitle: settings.site_title || DEFAULTS.site_title,
      siteDescription: settings.site_description || DEFAULTS.site_description,
    };
    cacheTime = now;
    return cachedConfig;
  } catch {
    return {
      siteName: DEFAULTS.site_name,
      siteTitle: DEFAULTS.site_title,
      siteDescription: DEFAULTS.site_description,
    };
  }
}
