import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getCurrentSite, isSubSite } from "@/lib/multi-site";

// Default configs (used when DB has no saved values)
const DEFAULTS: Record<string, string> = {
  site_name: "SparkAI",
  site_title: "SparkAI - 智能海报生成器",
  site_description: "AI 驱动的海报生成与展示平台",
  prompt_templates: JSON.stringify([
    { label: "图书主编招募", scenes: ["公众推文", "行政办公"], usages: ["招聘招募", "简介介绍"], styles: ["商务", "文艺"], colors: ["蓝", "白"], ratio: "4:3" },
    { label: "教培代理招募", scenes: ["教育开会", "公众推文"], usages: ["招聘招募", "宣传推广"], styles: ["商务", "清新"], colors: ["蓝", "绿"], ratio: "3:4" },
    { label: "餐饮节日宣传", scenes: ["社交媒体", "电商平台"], usages: ["营销带货", "宣传推广"], styles: ["喜庆", "实景"], colors: ["红", "橙"], ratio: "1:1" },
    { label: "电商促销", scenes: ["电商平台", "社交媒体"], usages: ["营销带货", "价目表单"], styles: ["潮酷", "时尚"], colors: ["红", "橙"], ratio: "1:1" },
    { label: "小红书封面", scenes: ["社交媒体", "生活娱乐"], usages: ["干货科普", "宣传推广"], styles: ["简约", "清新"], colors: ["粉", "低饱和"], ratio: "3:4" },
    { label: "视频封面", scenes: ["社交媒体", "影视制作"], usages: ["宣传推广", "直播宣传"], styles: ["潮酷", "简约"], colors: ["黑", "高饱和"], ratio: "16:9" },
    { label: "图片重构", scenes: [], usages: ["修复重绘"], styles: [], colors: [], ratio: "auto" },
    { label: "电商主图", scenes: ["电商平台"], usages: ["电商主图", "简介介绍"], styles: ["实景", "简约"], colors: ["白"], ratio: "1:1" },
    { label: "公众号配图", scenes: ["公众推文", "行政办公"], usages: ["推文配图", "干货科普"], styles: ["简约", "扁平"], colors: ["蓝", "低饱和"], ratio: "2:3" },
    { label: "倒计时海报", scenes: ["教育开会", "社交媒体"], usages: ["倒计时海报", "通知公告"], styles: ["简约", "科技"], colors: ["蓝", "橙"], ratio: "3:4" },
    { label: "图书封面设计", scenes: ["书籍出版"], usages: ["简介介绍", "宣传推广"], styles: ["文艺", "国风"], colors: ["黑", "白"], ratio: "2:3" },
    { label: "题目排版", scenes: ["教育开会", "行政办公"], usages: ["题目排版", "学习素材"], styles: ["简约", "扁平"], colors: ["白", "黑"], ratio: "4:3" },
    { label: "剧本分镜", scenes: ["影视制作"], usages: ["分镜脚本"], styles: ["手绘", "插画"], colors: ["黑", "白"], ratio: "16:9" },
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
  theme_color: "green",
  theme_mode: "dark",
  theme_custom_hex: "#22C55E",
  // Visual effect settings
  theme_gradient_enabled: "true",
  theme_gradient_from: "",
  theme_gradient_to: "",
  theme_noise_enabled: "true",
  theme_noise_opacity: "0.03",
  theme_metallic_text_enabled: "true",
  theme_metallic_from: "",
  theme_metallic_via: "",
  theme_metallic_to: "",
  theme_btn_glow_enabled: "true",
  theme_card_glow_enabled: "true",
  theme_page_bg_gradient_enabled: "true",
  theme_nav_gradient_enabled: "true",
  gallery_title: "海报生成记录",
  gallery_subtitle: "查看通过 SparkAI 生成的所有海报作品",
  create_options_scene: JSON.stringify([
    { label: "电商", value: "电商" },
    { label: "社交媒体", value: "社交媒体" },
    { label: "微信营销", value: "微信营销" },
    { label: "公众号", value: "公众号" },
    { label: "行政办公/教育", value: "行政办公/教育" },
    { label: "生活娱乐", value: "生活娱乐" },
    { label: "PPT", value: "PPT" },
  ]),
  create_options_usage: JSON.stringify([
    { label: "营销带货", value: "营销带货" },
    { label: "交流分享", value: "交流分享" },
    { label: "祝福问候", value: "祝福问候" },
    { label: "宣传推广", value: "宣传推广" },
    { label: "干货科普", value: "干货科普" },
    { label: "通知公告", value: "通知公告" },
    { label: "招聘招募", value: "招聘招募" },
    { label: "个人娱乐", value: "个人娱乐" },
    { label: "日月签", value: "日月签" },
    { label: "公益宣传", value: "公益宣传" },
    { label: "晒照分享", value: "晒照分享" },
    { label: "简介介绍", value: "简介介绍" },
    { label: "邀请函", value: "邀请函" },
    { label: "直播宣传", value: "直播宣传" },
    { label: "喜报表彰", value: "喜报表彰" },
    { label: "计划总结", value: "计划总结" },
    { label: "员工关怀", value: "员工关怀" },
    { label: "社交互动", value: "社交互动" },
    { label: "价目表", value: "价目表" },
    { label: "学习素材", value: "学习素材" },
    { label: "资讯要闻", value: "资讯要闻" },
    { label: "生日祝福", value: "生日祝福" },
    { label: "晒单反馈", value: "晒单反馈" },
  ]),
  create_options_style: JSON.stringify([
    { label: "简约", value: "简约" },
    { label: "时尚", value: "时尚" },
    { label: "实景", value: "实景" },
    { label: "插画", value: "插画" },
    { label: "卡通", value: "卡通" },
    { label: "文艺", value: "文艺" },
    { label: "喜庆", value: "喜庆" },
    { label: "手绘", value: "手绘" },
    { label: "可爱", value: "可爱" },
    { label: "拼贴风", value: "拼贴风" },
    { label: "潮酷", value: "潮酷" },
    { label: "商务", value: "商务" },
    { label: "中国风", value: "中国风" },
    { label: "通用", value: "通用" },
    { label: "扁平", value: "扁平" },
    { label: "清新", value: "清新" },
    { label: "3D", value: "3D" },
    { label: "复古", value: "复古" },
    { label: "奢华", value: "奢华" },
    { label: "酸性风", value: "酸性风" },
    { label: "科技", value: "科技" },
    { label: "膨胀风", value: "膨胀风" },
  ]),
  create_options_color: JSON.stringify([
    { label: "蓝", value: "蓝" },
    { label: "黄", value: "黄" },
    { label: "绿", value: "绿" },
    { label: "红", value: "红" },
    { label: "粉", value: "粉" },
    { label: "橙", value: "橙" },
    { label: "白", value: "白" },
    { label: "棕", value: "棕" },
    { label: "紫", value: "紫" },
    { label: "黑", value: "黑" },
    { label: "灰", value: "灰" },
    { label: "米色", value: "米色" },
  ]),
  batch_generate_access: "admin",
  anonymous_generate: "false",
  group_qr_image: "",
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

    // Merge DB values over defaults (treat empty string as unset)
    const config: Record<string, unknown> = {};
    for (const key of Object.keys(DEFAULTS)) {
      const dbVal = dbMap[key];
      config[key] = (dbVal === undefined || dbVal === null || dbVal === '') ? DEFAULTS[key] : dbVal;
    }

    // Parse JSON fields
    const jsonFields = ["prompt_templates", "available_models", "available_ratios", "tips_content", "available_image_sizes", "hd_models", "violation_messages", "create_options_scene", "create_options_usage", "create_options_style", "create_options_color"];
    for (const field of jsonFields) {
      try {
        config[field] = JSON.parse(config[field] as string);
      } catch {
        config[field] = JSON.parse(DEFAULTS[field]);
      }
    }

    // Convert string arrays to { label, value } objects for create options
    for (const key of ['create_options_scene', 'create_options_usage', 'create_options_style', 'create_options_color']) {
      const arr = config[key] as unknown[] | null;
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') {
        config[key] = arr.map((item: unknown) => ({ label: String(item), value: String(item) }));
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
    config.siteTitle = config.site_title;
    config.defaultModel = config.default_model;
    config.defaultRatio = config.default_ratio;
    config.waitMessage = config.wait_message;
    config.waitDuration = config.wait_duration;
    config.galleryPageSize = config.gallery_page_size;
    config.galleryTitle = config.gallery_title;
    config.gallerySubtitle = config.gallery_subtitle;
    config.imageCountEnabled = config.image_count_enabled;
    config.imageCountMax = config.image_count_max;
    config.imageSizes = config.available_image_sizes;
    config.defaultImageSize = config.default_image_size;
    config.hdModels = config.hd_models;
    config.violationMessages = config.violation_messages;
    config.dailyGenerateLimit = config.daily_generate_limit;
    config.promptMaxLength = config.prompt_max_length;
    config.templates = config.prompt_templates;
    config.models = Array.isArray(config.available_models) ? config.available_models.filter((m: Record<string, unknown>) => m.enabled !== false) : [];
    config.ratios = config.available_ratios;
    config.tips = config.tips_content;
    config.themeColor = config.theme_color;
    config.themeMode = config.theme_mode;
    config.themeCustomHex = config.theme_custom_hex;
    // Visual effect aliases
    config.themeGradientEnabled = config.theme_gradient_enabled === 'true';
    config.themeGradientFrom = config.theme_gradient_from || '';
    config.themeGradientTo = config.theme_gradient_to || '';
    config.themeNoiseEnabled = config.theme_noise_enabled === 'true';
    config.themeNoiseOpacity = Number(config.theme_noise_opacity) || 0.03;
    config.themeMetallicTextEnabled = config.theme_metallic_text_enabled === 'true';
    config.themeMetallicFrom = config.theme_metallic_from || '';
    config.themeMetallicVia = config.theme_metallic_via || '';
    config.themeMetallicTo = config.theme_metallic_to || '';
    config.themeBtnGlowEnabled = config.theme_btn_glow_enabled === 'true';
    config.themeCardGlowEnabled = config.theme_card_glow_enabled === 'true';
    config.themePageBgGradientEnabled = config.theme_page_bg_gradient_enabled === 'true';
    config.themeNavGradientEnabled = config.theme_nav_gradient_enabled === 'true';
    config.createOptions = {
      scene: Array.isArray(config.create_options_scene) ? config.create_options_scene : [],
      usage: Array.isArray(config.create_options_usage) ? config.create_options_usage : [],
      style: Array.isArray(config.create_options_style) ? config.create_options_style : [],
      color: Array.isArray(config.create_options_color) ? config.create_options_color : [],
    };

    config.batchGenerateAccess = config.batch_generate_access || "admin";
    config.anonymousGenerate = config.anonymous_generate === "true";
    config.groupQrImage = config.group_qr_image || "";

    // Multi-site info
    const site = getCurrentSite();
    config.siteId = site.siteId;
    config.isSubSite = site.isSubSite;
    config.siteLabel = site.siteLabel;

    return NextResponse.json(config);
  } catch (error) {
    console.error("Config API error:", error);
    // Fallback to defaults
    const config: Record<string, unknown> = {};
    for (const key of Object.keys(DEFAULTS)) {
      config[key] = DEFAULTS[key];
    }
    const jsonFields = ["prompt_templates", "available_models", "available_ratios", "tips_content", "create_options_scene", "create_options_usage", "create_options_style", "create_options_color", "batch_generate_access"];
    for (const field of jsonFields) {
      try {
        config[field] = JSON.parse(config[field] as string);
      } catch { /* keep string */ }
    }
    config.wait_duration = Number(config.wait_duration) || 5000;
    config.gallery_page_size = Number(config.gallery_page_size) || 50;
    config.image_count_enabled = config.image_count_enabled === 'true';
    config.image_count_max = Number(config.image_count_max) || 4;
    config.createOptions = {
      scene: Array.isArray(config.create_options_scene) ? config.create_options_scene : [],
      usage: Array.isArray(config.create_options_usage) ? config.create_options_usage : [],
      style: Array.isArray(config.create_options_style) ? config.create_options_style : [],
      color: Array.isArray(config.create_options_color) ? config.create_options_color : [],
    };
    config.batchGenerateAccess = config.batch_generate_access || "admin";
    config.anonymousGenerate = config.anonymous_generate === "true";
    config.groupQrImage = config.group_qr_image || "";
    return NextResponse.json(config);
  }
}
