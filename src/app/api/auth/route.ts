/**
 * POST /api/auth — 登录 / 注册
 *
 * body.action === "register": 首次注册（仅允许一次）
 * body.action === "login" 或无 action: 密码登录
 */

import { NextRequest, NextResponse } from "next/server";
import { signToken, getSessionCookieOptions } from "@/lib/auth";
import { isRegistered, registerPassword, verifyPassword } from "@/lib/auth-db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, action } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "请输入密码" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少需要 6 个字符" }, { status: 400 });
    }

    // —— 注册流程 ——
    if (action === "register") {
      if (isRegistered()) {
        return NextResponse.json({ error: "已注册，请直接登录" }, { status: 409 });
      }

      const ok = registerPassword(password);
      if (!ok) {
        return NextResponse.json({ error: "注册失败" }, { status: 500 });
      }

      // 注册成功后自动签发 token
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
    }

    // —— 登录流程 ——
    if (!isRegistered()) {
      return NextResponse.json({ error: "尚未注册，请先注册" }, { status: 403 });
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
