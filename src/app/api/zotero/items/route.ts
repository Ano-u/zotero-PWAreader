/**
 * GET /api/zotero/items — 获取 Zotero 文献列表
 */

import { NextRequest, NextResponse } from "next/server";
import { getItems, getItemChildren } from "@/lib/zotero-client";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const collectionKey = params.get("collectionKey") || undefined;
    const limit = parseInt(params.get("limit") || "25", 10);
    const start = parseInt(params.get("start") || "0", 10);
    const q = params.get("q") || undefined;
    const sort = params.get("sort") || "dateModified";
    const direction = params.get("direction") || "desc";

    // 如果请求单个条目的子项（附件）
    const itemKey = params.get("itemKey");
    if (itemKey) {
      const children = await getItemChildren(itemKey);
      return NextResponse.json(children);
    }

    const result = await getItems({ collectionKey, limit, start, q, sort, direction });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取文献失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
