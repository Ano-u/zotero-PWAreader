# ===== 构建阶段 =====
FROM node:20-alpine AS builder

WORKDIR /app

# 国内镜像加速
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安装构建依赖（better-sqlite3 需要编译）
RUN apk add --no-cache python3 make g++

# 先复制依赖文件，利用 Docker 缓存层
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci

# 复制源代码
COPY . .

# 构建 Next.js standalone
RUN npm run build

# ===== 运行阶段 =====
FROM node:20-alpine AS runner

WORKDIR /app

# 安全：使用非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 从构建阶段复制 standalone 产物
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 复制 schema.sql（运行时数据库初始化需要）
COPY --from=builder /app/src/lib/schema.sql ./src/lib/schema.sql

# 创建数据目录（SQLite + PDF 缓存）
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# 设置环境变量
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# 切换到非 root 用户
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
