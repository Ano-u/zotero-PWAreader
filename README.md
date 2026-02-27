# Zotero Reader

自部署的移动端 Zotero 文献阅读与翻译 PWA。连接 Zotero 云端文库，在手机上浏览文献、阅读 PDF、划词翻译、AI 论文问答。

## 功能特性

- **文库浏览** — 同步 Zotero 收藏夹与条目，支持搜索和分页
- **PDF 阅读** — 虚拟渲染、文本选择、手势缩放、阅读进度记忆
- **划词翻译** — 选中文本即时翻译，支持 DeepLX 和 OpenAI 兼容引擎
- **AI 问答** — 基于论文上下文的多轮对话，SSE 流式响应
- **翻译历史** — 搜索、分页、一键清理
- **PWA 离线** — Service Worker 缓存，添加到主屏幕后如原生应用
- **安全认证** — 密码注册/登录、JWT 会话、API Key AES-256-GCM 加密存储

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · better-sqlite3 · pdfjs-dist · Docker + Caddy

---

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Ano-u/zotero-reader.git
cd zotero-reader
```

### 2. 安装依赖

```bash
npm install
```

> `better-sqlite3` 是原生模块，需要 Node.js 20+、Python 3、Make 和 C++ 编译器。Windows 用户需安装 [windows-build-tools](https://github.com/nicedoc/windows-build-tools) 或 Visual Studio Build Tools。

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 【必填】加密密钥 — 用于加密存储翻译引擎的 API Key
# 生成方式: openssl rand -hex 32
APP_SECRET=change-this-to-a-random-string

# 【必填】JWT 签名密钥 — 用于会话认证
# 生成方式: openssl rand -hex 32
JWT_SECRET=change-this-to-another-random-string

# 【可选】域名 — Docker + Caddy 部署时用于自动 HTTPS
# DOMAIN=your-domain.com
```

> 本地开发可直接使用 `.env.local` 中的默认值，无需修改。

### 4. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000，首次访问会进入注册页面设置登录密码。

---

## 可自定义配置

### 环境变量（.env 文件）

| 变量 | 必填 | 说明 |
|------|------|------|
| `APP_SECRET` | 是 | AES-256-GCM 加密密钥，用于安全存储翻译引擎 API Key |
| `JWT_SECRET` | 是 | JWT 签名密钥，用于会话认证 |
| `DOMAIN` | 否 | 生产环境域名，供 Caddy 自动获取 HTTPS 证书 |

### Web 设置页（登录后访问 `/settings`）

以下配置均通过 Web 界面管理，存储在服务端 SQLite 数据库中：

**Zotero 连接**
- **User ID** — Zotero 用户 ID（在 [zotero.org/settings/keys](https://www.zotero.org/settings/keys) 查看）
- **API Key** — Zotero API 密钥（需开启库的读取权限）

**翻译引擎**（支持添加多个，可切换默认引擎）
- **DeepLX** — 免费 DeepL 翻译代理
  - API URL：DeepLX 服务地址
- **OpenAI 兼容** — 任何 OpenAI API 格式的翻译服务（one-api、new-api、直连 OpenAI 等）
  - API URL、API Key、模型名称
  - 目标语言

**翻译提示词模板**（仅 OpenAI 兼容引擎）
- 系统提示词（System Prompt）
- 用户提示词（User Prompt）
- 支持变量替换：`{title}`、`{authors}`、`{journal}`、`{abstract}`、`{paragraphContext}`、`{selectedText}`、`{targetLang}`

**AI 问答引擎**
- 独立配置 OpenAI 兼容 API 用于论文问答
- API URL、API Key、模型名称

**外观**
- 亮色 / 暗色 / 跟随系统主题

---

## 生产部署（Docker）

### 1. 配置环境变量

```bash
cp .env.production .env
nano .env
```

生成随机密钥：

```bash
# 写入随机生成的密钥
echo "APP_SECRET=$(openssl rand -hex 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
```

在 `.env` 中设置域名：

```env
DOMAIN=your-domain.com
```

### 2. 修改 Caddyfile（可选）

`Caddyfile` 默认通过环境变量 `DOMAIN` 读取域名，一般无需修改。如需自定义反向代理规则，编辑项目根目录的 `Caddyfile`。

### 3. 构建并启动

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f
```

### 4. 验证

```bash
# 本地验证
curl -I http://localhost:80

# 域名验证（需 DNS 已生效）
curl -I https://your-domain.com
```

> 完整的 VPS + Cloudflare + 防火墙部署指南见 [DEPLOY.md](DEPLOY.md)。

---

## 项目结构

```
zotero-reader/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 根路由 → 重定向到 /library
│   │   ├── layout.tsx          # 根布局（PWA、主题、Toast）
│   │   ├── login/              # 登录页
│   │   ├── register/           # 首次注册页
│   │   ├── library/            # 文库浏览页
│   │   ├── reader/[itemKey]/   # PDF 阅读器
│   │   ├── settings/           # 设置页
│   │   ├── history/            # 翻译历史页
│   │   └── api/                # API 路由
│   │       ├── auth/           # 认证（登录/注册/检查）
│   │       ├── settings/       # 设置读写
│   │       ├── engines/        # 翻译引擎 CRUD + 测试
│   │       ├── translate/      # 翻译执行 + 历史
│   │       ├── chat/           # AI 问答
│   │       └── zotero/         # Zotero API 代理
│   ├── components/             # React 组件
│   ├── hooks/                  # 自定义 Hooks
│   ├── lib/                    # 服务端逻辑（数据库、认证、翻译引擎）
│   └── types/                  # TypeScript 类型定义
├── public/                     # 静态资源（PWA manifest、Service Worker、图标）
├── data/                       # 运行时数据（SQLite 数据库 + PDF 缓存）
├── Dockerfile                  # 多阶段 Docker 构建
├── docker-compose.yml          # Docker Compose（Next.js + Caddy）
├── Caddyfile                   # Caddy 反向代理配置
└── DEPLOY.md                   # 完整部署指南
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（端口 3000） |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint 检查 |
| `docker compose up -d --build` | Docker 构建并启动 |
| `docker compose logs -f` | 查看 Docker 日志 |
| `docker compose restart` | 重启服务 |

## 数据备份

SQLite 数据库存储在 Docker volume `app-data` 中：

```bash
# 备份数据库
docker cp zotero-reader:/app/data/app.db ~/backup-$(date +%Y%m%d).db
```

## 架构总览

```
用户浏览器
    │
    ▼
Cloudflare (DNS 代理 + SSL + WAF + 速率限制)
    │
    ▼
Caddy (自动 HTTPS + 反向代理 + 安全头)
    │
    ▼
Next.js App (:3000)
    ├── → Zotero API (api.zotero.org)
    ├── → DeepLX API
    ├── → OpenAI 兼容 API
    └── → SQLite + PDF Cache (/app/data/)
```

所有 API Key 仅存储在服务器端 SQLite 中（AES-256-GCM 加密），前端不可见。
