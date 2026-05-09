const DEFAULTS = {
  siteName: "SparkAI",
  siteTitle: "SparkAI - 智能海报生成器",
  siteDescription: "AI 驱动的海报生成与展示平台",
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
    const port = process.env.DEPLOY_RUN_PORT || "5000";
    const res = await fetch(`http://localhost:${port}/api/config`);
    const data = await res.json();

    cachedConfig = {
      siteName: data.siteName || DEFAULTS.siteName,
      siteTitle: data.siteTitle || DEFAULTS.siteTitle,
      siteDescription: data.siteDescription || DEFAULTS.siteDescription,
    };
    cacheTime = now;
    return cachedConfig;
  } catch {
    return { ...DEFAULTS };
  }
}
