# SparkAI 海报生成平台

## 项目概述

SparkAI 是一个 AI 驱动的海报生成与展示平台，用户可以通过文字描述或参考图片生成高质量海报，并在广场中浏览和管理所有作品。

## 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Storage**: S3 兼容对象存储 (coze-coding-dev-sdk)
- **AI**: Image Generation (coze-coding-dev-sdk)

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
│   │   ├── page.tsx                 # 海报广场首页
│   │   ├── create/page.tsx          # 创作中心页面
│   │   ├── layout.tsx               # 根布局
│   │   ├── globals.css              # 全局样式
│   │   └── api/                     # API 路由
│   │       ├── generate/route.ts    # AI 海报生成 (SSE)
│   │       ├── images/route.ts      # 图片列表查询
│   │       ├── images/[id]/route.ts # 图片删除
│   │       ├── upload/route.ts      # 参考图上传
│   │       ├── optimize-prompt/route.ts # Prompt 优化
│   │       └── sync/route.ts        # 数据同步
│   ├── components/                  # 组件
│   │   ├── Navbar.tsx               # 导航栏
│   │   ├── ImageCard.tsx            # 图片卡片（含详情弹窗）
│   │   └── ui/                      # Shadcn UI 组件库
│   ├── storage/database/            # 数据库
│   │   ├── supabase-client.ts       # Supabase 客户端
│   │   └── shared/schema.ts         # Drizzle 表结构定义
│   ├── hooks/                       # 自定义 Hooks
│   └── lib/
│       └── utils.ts                 # 通用工具函数 (cn)
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

## 数据库

- 使用 Supabase SDK 进行 CRUD 操作
- 使用 Drizzle 定义表结构，`coze-coding-ai db upgrade` 同步
- 表：`gallery_images` (id, prompt, url, image_key, width, height, views, downloads, model, ratio, task_id, created_at)
- RLS 场景 A（公开读写），后端使用 service_role_key

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/generate` | POST | AI 海报生成（SSE 流式） |
| `/api/images` | GET | 获取海报列表（支持排序、搜索、时间筛选） |
| `/api/images/[id]` | DELETE | 删除指定海报 |
| `/api/upload` | POST | 上传参考图片 |
| `/api/optimize-prompt` | POST | Prompt 优化 |
| `/api/sync` | POST | 数据同步 |

## 编码规范

- TypeScript strict 模式
- 字段名 snake_case（数据库）/ camelCase（前端组件）
- 禁止隐式 any
- 所有 Supabase 操作必须检查 error
- 严禁自行拼接 S3 URL，必须使用 generatePresignedUrl
