/**
 * POST /api/auth — 登录认证
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, signToken, getSessionCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "请输入密码" }, { status: 400 });
    }

    if (!verifyPassword(password)) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    const token = await signToken();
    const cookieOptions = getSessionCookieOptions();

    const response = NextResponse.json({ success: true });
    response.cookies.set(cookieOptions.name, token, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
