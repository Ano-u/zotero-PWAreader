/**
 * GET/PUT /api/settings — 应用设置管理
 */

import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get("key");
    if (key) {
      const value = getSetting(key);
      if (value === null) {
        return NextResponse.json(null);
      }
      try {
        return NextResponse.json(JSON.parse(value));
      } catch {
        return NextResponse.json(value);
      }
    }

    // 返回所有设置（简化实现）
    return NextResponse.json({ error: "请指定 key 参数" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取设置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "缺少 key 或 value" }, { status: 400 });
    }

    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    setSetting(key, serialized);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存设置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
