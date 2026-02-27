/**
 * 认证模块 — Edge Runtime 兼容
 *
 * 此文件仅包含 JWT 相关函数，可在 middleware（Edge Runtime）中使用。
 * 数据库相关的认证函数（注册、密码验证）在 auth-db.ts 中，仅供 API 路由使用。
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-jwt-secret-change-in-production"
);
const COOKIE_NAME = "zr_session";
const JWT_EXPIRY = "7d"; // 7 天有效期

/** 签发 JWT Token */
export async function signToken(): Promise<string> {
  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

/** 验证 JWT Token */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

/** 从请求 Cookie 中获取并验证会话 */
export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

/** Cookie 配置选项 */
export function getSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 天
  };
}
