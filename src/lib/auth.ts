/**
 * 认证模块
 *
 * 简单密码登录 + JWT，个人使用场景。
 * 密码通过环境变量配置，bcrypt 散列验证。
 * JWT 存于 HttpOnly + Secure + SameSite=Strict Cookie。
 */

import { SignJWT, jwtVerify } from "jose";
import { hashSync, compareSync } from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-jwt-secret-change-in-production"
);
const APP_PASSWORD = process.env.APP_PASSWORD || "admin";
const COOKIE_NAME = "zr_session";
const JWT_EXPIRY = "7d"; // 7 天有效期

/** 验证密码是否正确 */
export function verifyPassword(password: string): boolean {
  // 如果环境变量以 $2 开头，说明已经是 bcrypt hash
  if (APP_PASSWORD.startsWith("$2")) {
    return compareSync(password, APP_PASSWORD);
  }
  // 否则直接比较明文（开发环境便捷用法）
  return password === APP_PASSWORD;
}

/** 生成密码的 bcrypt hash（用于生产环境配置） */
export function hashPassword(password: string): string {
  return hashSync(password, 10);
}

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
