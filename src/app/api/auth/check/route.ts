/**
 * GET /api/auth/check — 检查注册状态
 *
 * 返回 { registered: boolean }，前端据此决定跳登录还是注册。
 * 此接口不需要认证（中间件已放行）。
 */

import { NextResponse } from "next/server";
import { isRegistered } from "@/lib/auth-db";

export async function GET() {
  return NextResponse.json({ registered: isRegistered() });
}
