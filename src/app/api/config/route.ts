import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// Default configs (used when DB has no saved values)
const DEFAULTS: Record<string, string> = {
  site_name: "SparkAI",
  site_description: "AI 驱动的海报生成与展示平台",
  prompt_templates: JSON.stringify([
    { label: "图书主编招募", prompt: "图书主编招募海报，书香气息，书架与书籍元素，优雅排版，暖色调，专业感，招募信息突出" },
    { label: "教培代理招募", prompt: "教培代理招募海报，教育行业风格，知识图标与成长箭头，蓝绿色调，专业可信，招募信息醒目" },
    { label: "餐饮节日宣传", prompt: "餐饮节日宣传海报，美食特写，节日装饰元素，暖色灯光，诱人菜品，促销信息突出" },
    { label: "电商促销", prompt: "电商促销海报，鲜艳配色，折扣标签，商品展示布局，动感活力，促销信息醒目" },
    { label: "课程成果展示", prompt: "课程成果展示海报，学员作品墙效果，成就徽章与数据亮点，简洁大气，专业教育风格" },
    { label: "小红书封面", prompt: "小红书封面图，清新排版，吸睛标题，美感构图，柔和渐变背景，社交媒体风格" },
    { label: "视频封面", prompt: "视频封面图，视觉冲击力强，大字标题，人物或场景特写，电影质感，高对比度色彩" },
    { label: "图片重构", prompt: "图片重构，保留原始构图与主体，提升画质细节，优化色彩与光影，增强视觉表现力" },
    { label: "电商主图", prompt: "电商主图，商品居中展示，纯净背景，光影立体感，卖点标签，高端产品摄影风格" },
    { label: "公众号配图", prompt: "公众号配图，简约扁平风格，与文章主题呼应，留白充足，色彩柔和，信息图表元素" },
    { label: "高考倒计时", prompt: "高考倒计时海报，励志标语，书本与钢笔元素，拼搏向上氛围，红金配色，倒计时数字醒目" },
    { label: "图书封面设计", prompt: "图书封面设计，精美装帧，书名与作者排版考究，艺术插画风格，质感纸张纹理，文学气息" },
  ]),
  available_models: JSON.stringify([
    { value: "image2-vip", label: "Spark2 VIP", desc: "最高画质，支持2K/4K" },
    { value: "image2", label: "Spark2", desc: "高画质，性价比之选" },
    { value: "nano-banana-fast", label: "Spark Lite", desc: "适合纯图，无文字" },
    { value: "nano-banana-2", label: "Spark2 Nano", desc: "新一代模型，支持超长比例" },
    { value: "nano-banana-pro-vip", label: "Spark Pro VIP", desc: "专业画质，支持2K/4K" },
  ]),
  available_ratios: JSON.stringify([
    { value: "auto", label: "Auto", desc: "自动" },
    { value: "1:1", label: "1:1", desc: "方形" },
    { value: "3:4", label: "3:4", desc: "竖版" },
    { value: "4:3", label: "4:3", desc: "横版" },
    { value: "9:16", label: "9:16", desc: "手机" },
    { value: "16:9", label: "16:9", desc: "宽屏" },
    { value: "2:3", label: "2:3", desc: "人像" },
    { value: "3:2", label: "3:2", desc: "风景" },
    { value: "4:5", label: "4:5", desc: "社交" },
    { value: "5:4", label: "5:4", desc: "摄影" },
    { value: "21:9", label: "21:9", desc: "全景" },
    { value: "9:21", label: "9:21", desc: "长图" },
    { value: "1:3", label: "1:3", desc: "超长竖版" },
    { value: "3:1", label: "3:1", desc: "超长横版" },
    { value: "2:1", label: "2:1", desc: "宽横版" },
    { value: "1:2", label: "1:2", desc: "宽竖版" },
    { value: "1:4", label: "1:4", desc: "极长竖版" },
    { value: "4:1", label: "4:1", desc: "极长横版" },
    { value: "1:8", label: "1:8", desc: "条幅竖版" },
    { value: "8:1", label: "8:1", desc: "条幅横版" },
  ]),
  default_ratio: "auto",
  default_model: "image2",
  tips_content: JSON.stringify([
    "描述越具体，生成效果越好",
    "可以指定风格、颜色、布局等",
    "使用参考图可以保持一致的视觉风格",
  ]),
  wait_message: "请等待30-120秒，不要切换页面",
  wait_duration: "5000",
  gallery_page_size: "50",
  image_count_enabled: "true",
  image_count_max: "4",
  available_image_sizes: JSON.stringify([
    { value: "1K", label: "1K", desc: "标准" },
    { value: "2K", label: "2K", desc: "高清" },
    { value: "4K", label: "4K", desc: "超清" },
  ]),
  default_image_size: "1K",
  hd_models: JSON.stringify(["image2-vip", "nano-banana-2", "nano-banana-pro-vip"]),
  violation_messages: JSON.stringify({
    output_moderation: "生成内容违规，请修改提示词后重试",
    input_moderation: "输入内容违规，请修改提示词后重试",
    violation: "生成内容违规，请修改提示词后重试",
    error: "生成失败，请稍后重试",
  }),
  daily_generate_limit: "0",
  prompt_max_length: "2000",
};

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("admin_settings").select("key,value");

    const dbMap: Record<string, string> = {};
    if (data) {
      for (const row of data) {
        dbMap[row.key] = row.value;
      }
    }

    // Merge DB values over defaults
    const config: Record<string, unknown> = {};
    for (const key of Object.keys(DEFAULTS)) {
      config[key] = dbMap[key] ?? DEFAULTS[key];
    }

    // Parse JSON fields
    const jsonFields = ["prompt_templates", "available_models", "available_ratios", "tips_content", "available_image_sizes", "hd_models", "violation_messages"];
    for (const field of jsonFields) {
      try {
        config[field] = JSON.parse(config[field] as string);
      } catch {
        config[field] = JSON.parse(DEFAULTS[field]);
      }
    }

    // Numeric fields
    config.wait_duration = Number(config.wait_duration) || 5000;
    config.gallery_page_size = Number(config.gallery_page_size) || 50;
    config.image_count_enabled = config.image_count_enabled === 'true';
    config.image_count_max = Number(config.image_count_max) || 4;
    config.daily_generate_limit = Number(config.daily_generate_limit) || 0;
    config.prompt_max_length = Number(config.prompt_max_length) || 2000;
    config.auto_sync_enabled = config.auto_sync_enabled === 'true';

    // Friendly aliases for frontend
    config.siteName = config.site_name;
    config.defaultModel = config.default_model;
    config.defaultRatio = config.default_ratio;
    config.waitMessage = config.wait_message;
    config.waitDuration = config.wait_duration;
    config.galleryPageSize = config.gallery_page_size;
    config.imageCountEnabled = config.image_count_enabled;
    config.imageCountMax = config.image_count_max;
    config.imageSizes = config.available_image_sizes;
    config.defaultImageSize = config.default_image_size;
    config.hdModels = config.hd_models;
    config.violationMessages = config.violation_messages;
    config.dailyGenerateLimit = config.daily_generate_limit;
    config.promptMaxLength = config.prompt_max_length;
    config.templates = config.prompt_templates;
    config.models = config.available_models;
    config.ratios = config.available_ratios;
    config.tips = config.tips_content;

    return NextResponse.json(config);
  } catch (error) {
    console.error("Config API error:", error);
    // Fallback to defaults
    const config: Record<string, unknown> = {};
    for (const key of Object.keys(DEFAULTS)) {
      config[key] = DEFAULTS[key];
    }
    const jsonFields = ["prompt_templates", "available_models", "available_ratios", "tips_content"];
    for (const field of jsonFields) {
      try {
        config[field] = JSON.parse(config[field] as string);
      } catch { /* keep string */ }
    }
    config.wait_duration = Number(config.wait_duration) || 5000;
    config.gallery_page_size = Number(config.gallery_page_size) || 50;
    config.image_count_enabled = config.image_count_enabled === 'true';
    config.image_count_max = Number(config.image_count_max) || 4;
  }
}
