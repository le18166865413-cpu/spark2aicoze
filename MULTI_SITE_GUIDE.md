# Spark2AI 多站点部署指南

本文档说明如何以当前网站为主站，复制多个子站，并实现代码自动同步。

## 方案概述

```
GitHub 仓库 (代码中心)
    │
    ├── 主站 (main) ──────── 开发 + 管理
    │
    ├── 子站 1 (site-01) ─── 自动同步
    │
    ├── 子站 2 (site-02) ─── 自动同步
    │
    └── 子站 N ...
```

**数据方案（二选一）：**

| 方案 | 说明 | 适用场景 |
|------|------|----------|
| **共享数据库** | 所有站点共用同一个 Supabase 数据库 | 数据共享、统一管理 |
| **隔离数据库** | 每个站点使用独立的数据库 | 数据独立、多租户 |

## 第一步：推送主站代码到 GitHub

在主站执行：

```bash
cd /workspace/projects

# 初始化 Git（如果尚未初始化）
git init

# 添加远程仓库
git remote add origin https://github.com/你的用户名/spark2ai.git

# 提交代码
git add .
git commit -m "init main site"

# 推送到 GitHub
git push -u origin main
```

## 第二步：创建子站

### 方式 A：通过 Coze 平台新建项目

1. 在 Coze 平台创建一个新的「编程」项目
2. 进入项目后，在终端执行：

```bash
bash scripts/setup-sub-site.sh https://github.com/你的用户名/spark2ai.git site-01
```

### 方式 B：手动克隆

```bash
cd /workspace/projects
git clone https://github.com/你的用户名/spark2ai.git .
pnpm install
```

## 第三步：配置子站环境变量

在子站的 Coze 控制台中，配置以下环境变量：

```
SITE_ID=site-01
SITE_TYPE=sub
MAIN_SITE_URL=https://你的主站域名
```

其他必要的环境变量（与主站相同）：

```
COZE_SUPABASE_URL=
COZE_SUPABASE_ANON_KEY=
GRSAI_API_KEY=
```

## 第四步：（可选）数据库隔离

如果希望各站点数据独立，在 Supabase 中为 `gallery_images` 表添加 `site_id` 字段：

```sql
-- 添加 site_id 字段
ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS site_id TEXT DEFAULT 'main';

-- 为现有数据设置默认值
UPDATE gallery_images SET site_id = 'main' WHERE site_id IS NULL;

-- 创建索引（推荐）
CREATE INDEX IF NOT EXISTS idx_gallery_images_site_id ON gallery_images(site_id);
```

添加后，代码会自动根据 `SITE_ID` 过滤数据。

## 第五步：同步更新

### 手动同步

在子站执行：

```bash
bash scripts/sync-sub-site.sh
```

### 自动同步（推荐）

在子站添加定时任务（Coze 平台支持 cron）：

```bash
# 每 30 分钟检查一次更新
*/30 * * * * cd /workspace/projects && bash scripts/sync-sub-site.sh >> /app/work/logs/bypass/sync.log 2>&1
```

或使用 GitHub Actions 触发 Webhook（需要子站提供 API 端点）。

## 主站管理后台

主站后台「站点管理」页面可以：

1. 查看当前站点的 Git 版本信息
2. 注册和管理子站列表
3. 查看同步指南

访问路径：`/admin/sites`

## 多站点配置项

### 环境变量

| 变量名 | 主站 | 子站 | 说明 |
|--------|------|------|------|
| `SITE_ID` | `main` | `site-01` | 站点唯一标识 |
| `SITE_TYPE` | `main` | `sub` | 站点类型 |
| `MAIN_SITE_URL` | 空 | 主站地址 | 子站关联的主站 |
| `SYNC_TOKEN` | 可选 | 可选 | 同步接口的鉴权令牌 |

### 数据库表

| 表名 | 字段 | 说明 |
|------|------|------|
| `admin_settings` | `sub_site_*` | 子站注册信息 |
| `gallery_images` | `site_id` | 数据隔离字段（可选） |

## 注意事项

1. **S3 存储**：所有站点共用同一个 S3 bucket，图片文件天然共享
2. **Supabase**：可以共用或独立，根据业务需求选择
3. **用户系统**：共用数据库时用户也是共享的
4. **管理员**：每个站点的管理员账号独立（admin / 666666）
5. **API 密钥**：GrsAI API 密钥可以共用或各站点独立配置

## 故障排查

### 同步失败

```bash
# 检查 Git 远程仓库
git remote -v

# 检查是否有未提交的更改
git status

# 手动强制同步
git fetch origin main
git reset --hard origin/main
pnpm install
pnpm build
```

### 数据库字段缺失

如果添加 `site_id` 后报错，执行：

```sql
ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS site_id TEXT DEFAULT 'main';
```
