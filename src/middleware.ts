/**
 * Next.js 中间件 — 认证守卫
 *
 * 所有非公开路由（/login、/api/auth、静态资源）需要登录。
 * 未认证用户重定向到登录页。
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

/** 不需要认证的路径 */
const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静态资源和公开路径跳过认证
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/pdf.worker") ||
    pathname === "/favicon.ico" ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // 检查 JWT Cookie
  const token = request.cookies.get("zr_session")?.value;
  if (!token) {
    // API 请求返回 401，页面请求重定向到登录
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
