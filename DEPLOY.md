# Zotero Reader 部署指南

## 前置要求

- Ubuntu 22.04 VPS（2H2G，公网 IPv4）
- 域名已注册
- Cloudflare 账户
- 本地安装 Git

---

## 一、服务器初始化

### 1.1 安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER

# 重新登录使生效
exit
# 重新 SSH 登录

# 验证
docker --version
docker compose version
```

### 1.2 安装 Git

```bash
sudo apt update && sudo apt install -y git
```

---

## 二、Cloudflare 配置（重要！先于部署）

### 2.1 DNS 配置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 添加你的域名（如果还没添加）
3. 在 DNS 设置中添加 A 记录：
   - **类型**: A
   - **名称**: `@`（或你想用的子域名如 `reader`）
   - **IPv4 地址**: 你的 VPS 公网 IP
   - **代理状态**: **开启（橙色云朵）** ← 这是关键，隐藏真实 IP

### 2.2 SSL/TLS 配置

在 Cloudflare Dashboard → SSL/TLS：

1. **加密模式**: 选择 **Full (Strict)**
   - Caddy 会自动签发证书，CF ↔ Caddy 之间全程加密
2. **Edge Certificates**:
   - **Always Use HTTPS**: 开启
   - **Minimum TLS Version**: TLS 1.2
   - **Automatic HTTPS Rewrites**: 开启

### 2.3 安全规则

在 Cloudflare Dashboard → Security：

#### WAF 规则
1. **Bot Fight Mode**: 开启
2. **Security Level**: High
3. **Challenge Passage**: 30 minutes

#### 速率限制规则（Security → WAF → Rate limiting rules）

创建规则 1 — API 限制：
- **规则名**: API Rate Limit
- **匹配条件**: URI Path starts with `/api/`
- **速率**: 同一 IP，每分钟 30 次请求
- **操作**: Block（持续 60 秒）

创建规则 2 — 全局限制：
- **规则名**: Global Rate Limit
- **匹配条件**: 所有请求
- **速率**: 同一 IP，每分钟 120 次请求
- **操作**: Challenge（持续 60 秒）

#### IP 访问规则（可选，如果只在国内使用）
- Security → WAF → Tools → IP Access Rules
- 添加规则：Country = CN → Allow
- 默认操作：Block（阻止非中国 IP）

### 2.4 缓存规则（可选优化）

在 Cloudflare Dashboard → Caching → Cache Rules：

规则 1 — 静态资源长期缓存：
- **匹配**: URI Path starts with `/_next/static/`
- **Edge TTL**: 30 天
- **Browser TTL**: 30 天

规则 2 — API 不缓存：
- **匹配**: URI Path starts with `/api/`
- **缓存级别**: Bypass

---

## 三、VPS 防火墙配置

### 3.1 只允许 Cloudflare IP 访问 Web 端口

```bash
# 安装 ufw
sudo apt install -y ufw

# 默认拒绝所有入站
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许 SSH（改成你实际的 SSH 端口）
sudo ufw allow 22/tcp

# 允许 Cloudflare IPv4 IP 段访问 80/443
# 最新 IP 列表: https://www.cloudflare.com/ips-v4/
for ip in \
  173.245.48.0/20 \
  103.21.244.0/22 \
  103.22.200.0/22 \
  103.31.4.0/22 \
  141.101.64.0/18 \
  108.162.192.0/18 \
  190.93.240.0/20 \
  188.114.96.0/20 \
  197.234.240.0/22 \
  198.41.128.0/17 \
  162.158.0.0/15 \
  104.16.0.0/13 \
  104.24.0.0/14 \
  172.64.0.0/13 \
  131.0.72.0/22; do
  sudo ufw allow from $ip to any port 80,443 proto tcp
done

# 启用防火墙
sudo ufw enable

# 验证规则
sudo ufw status
```

> **效果**：即使有人探测到你的真实 IP，也无法直接访问 Web 服务。所有 HTTP(S) 流量必须经过 Cloudflare。

---

## 四、部署应用

### 4.1 克隆代码

```bash
cd ~
git clone https://github.com/你的用户名/zotero-reader.git
cd zotero-reader
```

### 4.2 配置环境变量

```bash
# 复制生产环境模板
cp .env.production .env

# 编辑环境变量
nano .env
```

修改以下值：
```env
# 设置一个强密码
APP_PASSWORD=your-secure-password

# 生成随机密钥
APP_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

# 你的域名
DOMAIN=your-domain.com
```

生成随机密钥的快捷方式：
```bash
echo "APP_SECRET=$(openssl rand -hex 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
```

### 4.3 修改 Caddyfile 域名

```bash
# 将 Caddyfile 中的 {$DOMAIN:your-domain.com} 改为你的域名
# 或者通过环境变量 DOMAIN 传入（已在 docker-compose 中配置）
```

### 4.4 启动服务

```bash
# 构建并启动（首次可能需要几分钟下载基础镜像和编译）
docker compose up -d --build

# 查看日志
docker compose logs -f

# 确认服务正常
docker compose ps
```

### 4.5 验证部署

```bash
# 本地测试（应返回 HTML）
curl -I http://localhost:80

# 通过域名访问（需等 DNS 生效）
curl -I https://your-domain.com
```

然后在手机浏览器访问 `https://your-domain.com`：
1. 登录（输入 APP_PASSWORD 中配置的密码）
2. 进入设置页，配置 Zotero User ID 和 API Key
3. 添加翻译引擎（DeepLX / OpenAI 兼容）
4. 返回文库页，浏览文献
5. 打开 PDF，选中文本，测试翻译

---

## 五、日常维护

### 更新代码

```bash
cd ~/zotero-reader
git pull
docker compose up -d --build
```

### 查看日志

```bash
# 应用日志
docker compose logs -f app

# Caddy 日志
docker compose logs -f caddy
```

### 备份数据

```bash
# SQLite 数据库在 Docker volume 中
# 备份到本地
docker cp zotero-reader:/app/data/app.db ~/backup-$(date +%Y%m%d).db
```

### 重启服务

```bash
docker compose restart
```

---

## 六、安全检查清单

- [ ] Cloudflare 代理已开启（橙色云朵），真实 IP 被隐藏
- [ ] SSL 模式为 Full (Strict)
- [ ] Always Use HTTPS 已开启
- [ ] Bot Fight Mode 已开启
- [ ] API 速率限制已配置
- [ ] VPS 防火墙仅允许 Cloudflare IP 访问 80/443
- [ ] SSH 端口已限制访问来源
- [ ] APP_PASSWORD 使用了强密码
- [ ] APP_SECRET 和 JWT_SECRET 使用了随机生成的密钥
- [ ] .env 文件不在 Git 仓库中

---

## 七、架构总览

```
用户手机浏览器
    │
    ▼
Cloudflare (DNS 代理 + SSL + WAF + 速率限制)
    │
    ▼ (仅 Cloudflare IP 可访问)
VPS 防火墙 (ufw)
    │
    ▼
Caddy (:80/:443 → 自动 HTTPS)
    │
    ▼
Next.js App (:3000)
    ├── → Zotero API (api.zotero.org)
    ├── → DeepLX API (api.deeplx.org)
    ├── → OpenAI 兼容 API (your-one-api.com)
    └── → SQLite + PDF Cache (/app/data/)
```

所有 API Key 仅存储在服务器端 SQLite 中（AES-256-GCM 加密），前端不可见。
