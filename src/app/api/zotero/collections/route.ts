/**
 * GET /api/zotero/collections — 获取 Zotero 集合列表
 */

import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/zotero-client";

export async function GET(request: NextRequest) {
  try {
    const parentKey = request.nextUrl.searchParams.get("parentKey") || undefined;
    const collections = await getCollections(parentKey);
    return NextResponse.json(collections);
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取集合失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
