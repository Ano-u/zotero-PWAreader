/**
 * GET /api/translate/engines — 获取可用翻译引擎列表
 *
 * 返回前端需要的引擎元信息（不含敏感配置如 API Key）
 */

import { NextResponse } from "next/server";
import { getEngines } from "@/lib/translate";

export async function GET() {
  try {
    const engines = getEngines();

    // 仅返回前端展示所需的字段，不暴露 token/key
    const safeEngines = engines.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
    }));

    // 返回引擎列表 + 默认引擎（优先级最高的）
    return NextResponse.json({
      engines: safeEngines,
      defaultEngine: safeEngines[0]?.id || "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取引擎列表失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
