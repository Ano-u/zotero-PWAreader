/**
 * GET/PUT /api/settings — 应用设置管理
 *
 * 敏感字段（zotero_api_key）保存时加密，读取时返回掩码版本。
 * zotero-client.ts 直接从 DB 读取加密值并 decrypt，此处保证存入的就是加密格式。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, encrypt, decrypt } from "@/lib/db";

/** 需要加密存储的 key 列表 */
const ENCRYPTED_KEYS = ["zotero_api_key"];

/** 脱敏处理 */
function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "请指定 key 参数" }, { status: 400 });
    }

    // 加密字段：解密后返回掩码版本（前端不拿到明文）
    if (ENCRYPTED_KEYS.includes(key)) {
      const encrypted = getSetting(key);
      if (!encrypted) return NextResponse.json(null);
      try {
        const plain = decrypt(encrypted);
        return NextResponse.json(maskSecret(plain));
      } catch {
        return NextResponse.json(null);
      }
    }

    const value = getSetting(key);
    if (value === null) return NextResponse.json(null);

    try {
      return NextResponse.json(JSON.parse(value));
    } catch {
      return NextResponse.json(value);
    }
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

    // 敏感字段：掩码值跳过，明文值加密存储
    if (ENCRYPTED_KEYS.includes(key)) {
      const strValue = String(value);
      if (strValue.includes("****")) {
        return NextResponse.json({ success: true });
      }
      setSetting(key, encrypt(strValue));
      return NextResponse.json({ success: true });
    }

    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    setSetting(key, serialized);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存设置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
