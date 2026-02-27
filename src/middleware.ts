/**
 * Next.js 中间件 — 认证守卫
 *
 * 公开路径（/login、/register、/api/auth）不需要认证。
 * 未认证用户：页面请求重定向到 /login，API 请求返回 401。
 * /login 和 /register 页面会自行通过 /api/auth/check 判断跳转方向。
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

/** 不需要认证的路径前缀 */
const PUBLIC_PATHS = ["/login", "/register", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静态资源和公开路径跳过认证
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/pdf.worker") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // 检查 JWT Cookie
  const token = request.cookies.get("zr_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isValid = await verifyToken(token);
  if (!isValid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "会话已过期" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 匹配所有路由，排除静态资源
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
