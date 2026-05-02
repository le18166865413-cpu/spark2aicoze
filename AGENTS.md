# SparkAI 海报生成平台

## 项目概述

SparkAI 是一个 AI 驱动的海报生成与展示平台，用户可以通过文字描述或参考图片生成高质量海报，并在广场中浏览和管理所有作品。

## 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Storage**: S3 兼容对象存储 (coze-coding-dev-sdk)
- **AI 图片生成**: GrsAI API (grsai.dakka.com.cn)
- **AI Prompt 优化**: LLM (coze-coding-dev-sdk, doubao-seed-2-0-mini)
- **数据存储**: Supabase (PostgreSQL)

## 目录结构

```
├── public/                          # 静态资源
├── scripts/                         # 构建与启动脚本
│   ├── build.sh                     # 构建脚本
│   ├── dev.sh                       # 开发环境启动脚本
│   ├── prepare.sh                   # 预处理脚本
│   └── start.sh                     # 生产环境启动脚本
├── src/
│   ├── app/                         # 页面路由与布局
│   │   ├── layout.tsx               # 根布局 (仅 html/body/globals.css)
│   │   ├── globals.css              # 全局样式
│   │   ├── (main)/                  # 前台路由组 (含 Navbar)
│   │   │   ├── layout.tsx           # 前台布局 (Navbar)
│   │   │   ├── page.tsx            # 海报广场首页
│   │   │   └── create/page.tsx     # 创作中心页面
│   │   ├── admin/                   # 管理后台页面 (独立布局)
│   │   │   ├── layout.tsx           # 后台布局 (侧边栏+顶栏)
│   │   │   ├── page.tsx             # 仪表盘
│   │   │   ├── login/page.tsx       # 登录页
│   │   │   ├── settings/page.tsx    # 网站设置
│   │   │   ├── api-tokens/page.tsx  # API 令牌管理
│   │   │   ├── theme/page.tsx       # 主题配色
│   │   │   ├── storage/page.tsx     # 图片存储管理
│   │   │   └── import/page.tsx      # 任务导入
│   │   └── api/                     # API 路由
│   │       ├── generate/route.ts    # AI 海报生成 (SSE)
│   │       ├── images/route.ts      # 图片列表查询
│   │       ├── images/[id]/route.ts # 图片删除
│   │       ├── upload/route.ts      # 参考图上传
│   │       ├── optimize-prompt/route.ts # Prompt 优化
│   │       ├── sync/route.ts        # 数据同步
│   │       └── admin/               # 管理后台 API
│   ├── components/                  # 组件
│   │   ├── Navbar.tsx               # 导航栏
│   │   ├── ImageCard.tsx            # 图片卡片（含详情弹窗）
│   │   └── ui/                      # Shadcn UI 组件库
│   ├── utils/                       # 工具函数
│   │   └── storage.ts              # S3 存储客户端
│   ├── storage/database/            # 数据库
│   │   ├── supabase-client.ts       # Supabase 客户端
│   │   └── shared/schema.ts         # Drizzle 表结构定义
│   ├── hooks/                       # 自定义 Hooks
│   │   └── use-admin-settings.ts    # 管理设置 Hook
│   └── lib/
│       ├── utils.ts                 # 通用工具函数 (cn)
│       └── admin-auth.ts            # 管理员认证工具
├── .cozeproj/prototype/             # 原型设计文件
├── next.config.ts                   # Next.js 配置
├── package.json                     # 项目依赖管理
└── tsconfig.json                    # TypeScript 配置
```

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

## 常用命令

- 安装依赖：`pnpm install`
- 开发：`pnpm dev` (端口 5000)
- 构建：`pnpm build`
- 启动生产：`pnpm start`
- 类型检查：`pnpm ts-check`
- Lint：`pnpm lint:build`

## 数据存储

- 使用 Supabase (PostgreSQL) 存储图片记录 (表名: gallery_images)
- 图片文件存储在 S3 兼容对象存储中 (coze-coding-dev-sdk S3Storage)
- 图片 URL 通过 sign-url 接口生成永久签名链接 (expire_time: 0)
- gallery_images 表结构：id, prompt, url, image_key, width, height, views, downloads, model, ratio, task_id, created_at
- Supabase 客户端：`src/storage/database/supabase-client.ts`

## GrsAI API

- 图片生成：`POST https://grsai.dakka.com.cn/v1/draw/completions` (SSE 流式)
- 任务结果查询：`POST https://grsai.dakka.com.cn/v1/draw/result`
- 模型：gpt-image-2-vip / gpt-image-2 / nano-banana-fast
- 认证：Bearer Token (GRSAI_API_KEY)

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/generate` | POST | AI 海报生成（SSE 流式） |
| `/api/images` | GET | 获取海报列表（支持排序、搜索、时间筛选） |
| `/api/images/[id]` | DELETE | 删除指定海报 |
| `/api/upload` | POST | 上传参考图片 |
| `/api/optimize-prompt` | POST | Prompt 优化 |
| `/api/sync` | POST | 通过 GrsAI 任务 ID 同步图片到广场 |
| `/api/sync` | GET | 获取已同步的图片列表 |
| `/api/admin/auth` | POST | 管理员登录 |
| `/api/admin/auth` | DELETE | 管理员登出 |
| `/api/admin/auth` | GET | 验证登录状态 |
| `/api/admin/settings` | GET | 获取所有设置（需认证） |
| `/api/admin/settings` | PUT | 保存设置（需认证） |
| `/api/admin/import` | POST | 手动导入 GrsAI 任务（需认证） |

## 管理后台

- 访问路径：`/admin`
- 登录页面：`/admin/login`
- 管理员用户名：`wuhe`，密码：`666666`
- 认证方式：Cookie (admin_session)，有效期 24 小时
- 数据库表：admin_settings (设置)、admin_sessions (会话)
- 所有管理 API 需通过 Cookie 认证，未认证返回 401

## 编码规范

- TypeScript strict 模式
- 字段名 snake_case（数据库）/ camelCase（前端组件）
- 禁止隐式 any
- 所有 S3 操作必须使用 `storage` 实例 (src/utils/storage.ts)
- 严禁自行拼接 S3 URL，必须使用 `generatePresignedUrl` 或 `/sign-url` 接口
