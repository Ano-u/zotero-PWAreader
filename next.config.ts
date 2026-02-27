import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 部署使用 standalone 模式，最小化镜像体积
  output: "standalone",

  // 服务端使用 better-sqlite3 原生模块
  serverExternalPackages: ["better-sqlite3"],

  // 实验性功能
  experimental: {
    // 优化服务端组件打包
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
