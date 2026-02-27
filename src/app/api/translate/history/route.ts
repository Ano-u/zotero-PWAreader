/**
 * /api/translate/history — 翻译历史 CRUD
 *
 * GET:    获取翻译历史（分页 + 搜索）
 * DELETE: 删除单条或清空全部
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getTranslationHistory,
  deleteTranslationRecord,
  clearTranslationHistory,
} from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const offset = parseInt(params.get("offset") || "0", 10);
    const limit = parseInt(params.get("limit") || "30", 10);
    const search = params.get("search") || undefined;

    const result = getTranslationHistory(offset, Math.min(limit, 100), search);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "获取历史失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.clearAll) {
      clearTranslationHistory();
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      deleteTranslationRecord(body.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "删除失败" },
      { status: 500 }
    );
  }
}
