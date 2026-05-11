-- Migration: add generate_options table for dynamic option management
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS generate_options (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('scene', 'usage', 'style', 'color', 'ratio', 'model')),
  label TEXT NOT NULL,
  value TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast category queries
CREATE INDEX IF NOT EXISTS idx_generate_options_category ON generate_options(category);
CREATE INDEX IF NOT EXISTS idx_generate_options_visible ON generate_options(is_visible);

-- Row Level Security: allow public read for visible options
ALTER TABLE generate_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read visible options" ON generate_options;
CREATE POLICY "Allow public read visible options"
  ON generate_options FOR SELECT
  USING (is_visible = true);

-- Enable service role full access
DROP POLICY IF EXISTS "Allow service role full access" ON generate_options;
CREATE POLICY "Allow service role full access"
  ON generate_options FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed default data
INSERT INTO generate_options (category, label, value, description, sort_order, is_visible) VALUES
  -- Scene
  ('scene', '电商', NULL, NULL, 0, true),
  ('scene', '社交媒体', NULL, NULL, 1, true),
  ('scene', '微信营销', NULL, NULL, 2, true),
  ('scene', '公众号', NULL, NULL, 3, true),
  ('scene', '行政办公/教育', NULL, NULL, 4, true),
  ('scene', '生活娱乐', NULL, NULL, 5, true),
  ('scene', 'PPT', NULL, NULL, 6, true),
  -- Usage
  ('usage', '营销带货', NULL, NULL, 0, true),
  ('usage', '交流分享', NULL, NULL, 1, true),
  ('usage', '祝福问候', NULL, NULL, 2, true),
  ('usage', '宣传推广', NULL, NULL, 3, true),
  ('usage', '干货科普', NULL, NULL, 4, true),
  ('usage', '通知公告', NULL, NULL, 5, true),
  ('usage', '招聘招募', NULL, NULL, 6, true),
  ('usage', '个人娱乐', NULL, NULL, 7, true),
  ('usage', '日月签', NULL, NULL, 8, true),
  ('usage', '公益宣传', NULL, NULL, 9, true),
  ('usage', '晒照分享', NULL, NULL, 10, true),
  ('usage', '简介介绍', NULL, NULL, 11, true),
  ('usage', '邀请函', NULL, NULL, 12, true),
  ('usage', '直播宣传', NULL, NULL, 13, true),
  ('usage', '喜报表彰', NULL, NULL, 14, true),
  ('usage', '计划总结', NULL, NULL, 15, true),
  ('usage', '员工关怀', NULL, NULL, 16, true),
  ('usage', '社交互动', NULL, NULL, 17, true),
  ('usage', '价目表', NULL, NULL, 18, true),
  ('usage', '学习素材', NULL, NULL, 19, true),
  ('usage', '资讯要闻', NULL, NULL, 20, true),
  ('usage', '生日祝福', NULL, NULL, 21, true),
  ('usage', '晒单反馈', NULL, NULL, 22, true),
  -- Style
  ('style', '简约', NULL, NULL, 0, true),
  ('style', '时尚', NULL, NULL, 1, true),
  ('style', '实景', NULL, NULL, 2, true),
  ('style', '插画', NULL, NULL, 3, true),
  ('style', '卡通', NULL, NULL, 4, true),
  ('style', '文艺', NULL, NULL, 5, true),
  ('style', '喜庆', NULL, NULL, 6, true),
  ('style', '手绘', NULL, NULL, 7, true),
  ('style', '可爱', NULL, NULL, 8, true),
  ('style', '拼贴风', NULL, NULL, 9, true),
  ('style', '潮酷', NULL, NULL, 10, true),
  ('style', '商务', NULL, NULL, 11, true),
  ('style', '中国风', NULL, NULL, 12, true),
  ('style', '通用', NULL, NULL, 13, true),
  ('style', '扁平', NULL, NULL, 14, true),
  ('style', '清新', NULL, NULL, 15, true),
  ('style', '3D', NULL, NULL, 16, true),
  ('style', '复古', NULL, NULL, 17, true),
  ('style', '奢华', NULL, NULL, 18, true),
  ('style', '酸性风', NULL, NULL, 19, true),
  ('style', '科技', NULL, NULL, 20, true),
  ('style', '膨胀风', NULL, NULL, 21, true),
  -- Color
  ('color', '蓝', NULL, NULL, 0, true),
  ('color', '黄', NULL, NULL, 1, true),
  ('color', '绿', NULL, NULL, 2, true),
  ('color', '红', NULL, NULL, 3, true),
  ('color', '粉', NULL, NULL, 4, true),
  ('color', '橙', NULL, NULL, 5, true),
  ('color', '白', NULL, NULL, 6, true),
  ('color', '棕', NULL, NULL, 7, true),
  ('color', '紫', NULL, NULL, 8, true),
  ('color', '黑', NULL, NULL, 9, true),
  ('color', '灰', NULL, NULL, 10, true),
  ('color', '米色', NULL, NULL, 11, true),
  -- Ratio
  ('ratio', 'Auto', 'auto', NULL, 0, true),
  ('ratio', '1:1', '1:1', NULL, 1, true),
  ('ratio', '3:4', '3:4', NULL, 2, true),
  ('ratio', '4:3', '4:3', NULL, 3, true),
  ('ratio', '9:16', '9:16', NULL, 4, true),
  ('ratio', '16:9', '16:9', NULL, 5, true),
  ('ratio', '2:3', '2:3', NULL, 6, true),
  ('ratio', '3:2', '3:2', NULL, 7, true),
  ('ratio', '4:5', '4:5', NULL, 8, true),
  ('ratio', '5:4', '5:4', NULL, 9, true),
  ('ratio', '21:9', '21:9', NULL, 10, true),
  ('ratio', '9:21', '9:21', NULL, 11, true),
  -- Model
  ('model', 'Spark2 VIP', 'image2-vip', '最高画质，支持2K/4K', 0, true),
  ('model', 'Spark2', 'image2', '高画质，性价比之选', 1, true),
  ('model', 'Spark Lite', 'nano-banana-fast', '适合纯图，无文字', 2, true),
  ('model', 'Spark2 Nano', 'nano-banana-2', '新一代模型，支持超长比例', 3, true),
  ('model', 'Spark Pro VIP', 'nano-banana-pro-vip', '专业画质，支持2K/4K', 4, true)
ON CONFLICT DO NOTHING;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
