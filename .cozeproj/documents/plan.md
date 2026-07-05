# Brand Kit 功能实现计划

## 概述
在 `/my-works` 页面新增 Brand Kit 管理模块，支持用户上传图片素材（LOGO、图标等）和自定义添加文字素材（手机号、地址、品牌名、公司名等任意文字信息）。创作中心提供两种引用入口：参考图区域按钮 + 提示词输入框 @ 唤起，实现素材快速复用。平台为 Web，使用 Supabase 存储数据、S3 存储图片。**设计风格：保持项目现有的黑绿风格（黑色背景 + 绿色主色调），不引入新的配色。**

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 数据存储 | Supabase (PostgreSQL) | 项目已有 Supabase，统一数据架构 |
| 图片存储 | S3 (coze-coding-dev-sdk) | 项目已有 S3Storage，统一存储方案 |
| @mention 实现 | 自定义 MentionsInput 组件 | 轻量实现，无需额外依赖 |
| 状态管理 | React useState/useContext | 功能简单，无需引入新状态库 |

## 功能模块

### 1. Brand Kit 数据表
```sql
-- brand_kit 表结构
CREATE TABLE brand_kit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL, -- 'image' | 'text'
  name VARCHAR(100) NOT NULL, -- 显示名称，如 "公司LOGO"、"联系电话"
  value TEXT NOT NULL, -- 文字内容或 S3 key
  preview_url TEXT, -- 图片预览 URL（仅 type=image）
  sort_order INT DEFAULT 0, -- 排序权重
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_brand_kit_user ON brand_kit(user_id);
```

### 2. Brand Kit 管理页
**位置**：`/my-works` 新增第四个 Tab「Brand Kit」

**功能**：
- 素材列表展示（图片以缩略图展示，文字以卡片展示）
- 新增素材：上传图片 / 添加文字
- 编辑素材：修改名称、内容
- 删除素材：二次确认后删除
- 排序功能：拖拽调整顺序

**素材分类**：
- 图片素材：LOGO、图标、品牌图形等
- 文字素材：品牌名、公司名、手机号、地址、邮箱等

### 3. Brand Kit API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/brand-kit` | GET | 获取当前用户所有素材 |
| `/api/brand-kit` | POST | 新增素材（图片上传或文字保存） |
| `/api/brand-kit/[id]` | PUT | 编辑素材 |
| `/api/brand-kit/[id]` | DELETE | 删除素材 |
| `/api/brand-kit/upload` | POST | 上传图片素材到 S3 |

### 4. 创作中心引用功能

**入口一：参考图区域按钮**
- 在现有参考图上传按钮旁新增「从 Brand Kit 添加」按钮
- 点击弹出 Brand Kit 选择面板（仅显示图片素材）
- 选择后自动添加到 refImages 数组

**入口二：提示词输入框 @ 唤起**
- 输入 `@` 时自动弹出 Brand Kit 选择列表
- 显示所有素材（图片+文字），带图标区分类型
- 选择图片素材 → 自动添加到参考图区域
- 选择文字素材 → 插入到提示词光标位置

**MentionsInput 组件设计**：
- 基于 Textarea 扩展，监听 `@` 输入
- 弹出悬浮选择面板，支持搜索过滤
- 选择后根据素材类型执行不同动作
- 视觉提示：已引用的素材在输入框下方显示标签

## 是否有原型设计
是（设计引导工具已开启）

## 实施步骤

1. **阶段一：原型设计** — 加载 `design-canvas` 技能，完成 Brand Kit 页面原型设计，包括 my-works 的 Brand Kit Tab 界面、素材管理弹窗、创作中心的 @mention 选择面板。原型完成后调用 done 提交，等待用户确认后进入开发阶段。

2. **阶段二：数据库与 API 开发** — 创建 brand_kit 数据表，实现 `/api/brand-kit` CRUD 接口（GET/POST/PUT/DELETE）及图片上传接口。关键文件：`src/storage/database/shared/schema.ts`、`src/app/api/brand-kit/route.ts`、`src/app/api/brand-kit/[id]/route.ts`。

3. **阶段三：Brand Kit 管理页** — 在 `/my-works` 新增 Brand Kit Tab，实现素材列表展示、新增/编辑/删除弹窗、图片上传、文字添加功能。关键文件：`src/app/(main)/my-works/page.tsx`、新增 `src/components/BrandKitManager.tsx`。

4. **阶段四：创作中心引用功能** — 在 `/create` 页面参考图区域添加「从 Brand Kit 添加」按钮，实现 MentionsInput 组件支持 @ 唤起选择，根据素材类型自动添加参考图或插入文字。关键文件：`src/app/(main)/create/page.tsx`、新增 `src/components/MentionsInput.tsx`。

5. **阶段五：验证与测试** — 执行代码检查与接口冒烟测试，验证 Brand Kit CRUD、创作中心引用功能、图片上传流程。

## 页面规格

### 全局导航

##### @nav(web-topbar)
> type: topbar
> platform: web

- @page(/) 首页
- @page(/create) 创作中心
- @page(/my-works) 我的作品
- @page(/stats) 数据统计
- @page(/profile) 个人中心

### 页面详情

##### @page(/my-works) 我的作品

**核心职责**：管理用户作品、收藏、隐藏内容和 Brand Kit 素材。
**访问路径**：导航栏直达，需登录（未登录跳转登录页）。
**布局**：顶部标题+用户信息，Tab 切换区（4 个 Tab），内容区瀑布流/列表。

**Tab 构成**：
1. 作品：瀑布流图片卡片
2. 收藏：瀑布流图片卡片
3. 隐藏：瀑布流图片卡片
4. Brand Kit：素材管理列表

**Brand Kit Tab 内容**：
- 素材列表：图片素材（缩略图+名称）、文字素材（名称+内容预览）
- 新增按钮：弹出新增面板（上传图片 / 添加文字）
- 编辑按钮：修改素材名称和内容
- 删除按钮：二次确认后删除

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| Brand Kit Tab | 点击 | 切换到素材管理视图 | — | 第四个 Tab |
| 新增素材按钮 | 点击 | 弹出 @modal(add-asset) | — | — |
| 图片素材卡片 | 点击 | 预览大图 | — | — |
| 编辑按钮 | 点击 | 弹出 @modal(edit-asset) | asset_id | — |
| 删除按钮 | 点击 | 弹出 @modal(confirm-delete) | asset_id | — |
| 拖拽排序 | 拖动 | 调整素材顺序并保存 | — | — |

**弹窗 add-asset**：
- 标题：「添加素材」
- 类型切换：图片 / 文字
- 图片上传：拖拽或点击上传，预览后填写名称保存
- 文字添加：选择分类（品牌名/公司名/手机号/地址/邮箱/其他），填写名称和内容
- 操作：保存（添加到列表）、取消（关闭弹窗）

**弹窗 edit-asset**：
- 标题：「编辑素材」
- 可编辑字段：名称、内容（文字素材）/ 名称、图片（图片素材）
- 操作：保存、取消

**弹窗 confirm-delete**：
- 标题：「确认删除」
- 内容：显示素材名称
- 操作：确认删除、取消

---

##### @page(/create) 创作中心

**核心职责**：AI 海报生成，支持 Brand Kit 素材快速引用。
**访问路径**：导航栏直达，支持未登录用户（匿名生成模式）。
**布局**：左侧提示词+选项配置区，右侧参考图+生成结果预览区。

**Brand Kit 引用功能**：
- 参考图区域：新增「从 Brand Kit 添加」按钮
- 提示词输入框：支持 @ 唤起 Brand Kit 选择

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 从 Brand Kit 添加按钮 | 点击 | 弹出 @sheet(brand-kit-picker) | — | 仅显示图片素材 |
| 提示词输入框 | 输入 @ | 弹出 @sheet(brand-kit-mentions) | — | 显示所有素材 |
| brand-kit-picker 选择 | 点击 | 添加到参考图区域 | asset_id, asset_type | 仅图片素材 |
| brand-kit-mentions 选择 | 点击 | 图片→添加参考图；文字→插入提示词 | asset_id, asset_type | — |

**底部面板 brand-kit-picker**：
- 标题：「选择 Brand Kit 图片」
- 内容：网格展示用户图片素材，支持搜索
- 操作：选择后自动关闭并添加

**底部面板 brand-kit-mentions**：
- 标题：「选择素材」
- 内容：列表展示所有素材，带图标区分类型（图片/文字）
- 操作：选择后自动关闭并执行对应动作