/**
 * /api/engines — 翻译引擎 CRUD
 *
 * GET:  获取所有引擎列表（脱敏）
 * POST: 添加新引擎
 * PUT:  更新引擎配置
 * DELETE: 删除引擎
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb, encrypt, decrypt } from "@/lib/db";
import { randomUUID } from "crypto";

/** 脱敏处理：API Key 只显示前4位和后4位 */
function maskSecret(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

/** GET: 列出所有引擎（脱敏版本，前端展示用） */
export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM translation_engines ORDER BY priority ASC")
      .all() as Array<Record<string, unknown>>;

    const engines = rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      type: row.type as string,
      enabled: (row.enabled as number) === 1,
      priority: row.priority as number,
      // 脱敏字段
      deeplxToken: row.deeplx_token ? maskSecret(decrypt(row.deeplx_token as string)) : "",
      apiBaseUrl: (row.api_base_url as string) || "",
      apiKey: row.api_key ? maskSecret(decrypt(row.api_key as string)) : "",
      model: (row.model as string) || "",
      systemPrompt: (row.system_prompt as string) || "",
      userPrompt: (row.user_prompt as string) || "",
    }));

    return NextResponse.json({ engines });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "获取引擎列表失败" },
      { status: 500 }
    );
  }
}

/** POST: 添加新引擎 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, deeplxToken, apiBaseUrl, apiKey, model, systemPrompt, userPrompt } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "名称和类型必填" }, { status: 400 });
    }
    if (!["deeplx", "openai"].includes(type)) {
      return NextResponse.json({ error: "不支持的引擎类型" }, { status: 400 });
    }

    const db = getDb();
    const id = randomUUID();

    // 获取当前最大 priority
    const maxRow = db.prepare("SELECT MAX(priority) as max FROM translation_engines").get() as { max: number | null };
    const priority = (maxRow?.max ?? -1) + 1;

    db.prepare(
      `INSERT INTO translation_engines (id, name, type, enabled, priority, deeplx_token, api_base_url, api_key, model, system_prompt, user_prompt)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      name,
      type,
      priority,
      deeplxToken ? encrypt(deeplxToken) : null,
      apiBaseUrl || null,
      apiKey ? encrypt(apiKey) : null,
      model || null,
      systemPrompt || null,
      userPrompt || null
    );

    return NextResponse.json({ id, success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "添加引擎失败" },
      { status: 500 }
    );
  }
}

/** PUT: 更新引擎配置 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, enabled, priority, deeplxToken, apiBaseUrl, apiKey, model, systemPrompt, userPrompt } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少引擎 ID" }, { status: 400 });
    }

    const db = getDb();

    // 检查引擎是否存在
    const existing = db.prepare("SELECT id FROM translation_engines WHERE id = ?").get(id);
    if (!existing) {
      return NextResponse.json({ error: "引擎不存在" }, { status: 404 });
    }

    // 逐字段更新（仅更新提供的字段）
    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (enabled !== undefined) { updates.push("enabled = ?"); values.push(enabled ? 1 : 0); }
    if (priority !== undefined) { updates.push("priority = ?"); values.push(priority); }
    if (apiBaseUrl !== undefined) { updates.push("api_base_url = ?"); values.push(apiBaseUrl || null); }
    if (model !== undefined) { updates.push("model = ?"); values.push(model || null); }
    if (systemPrompt !== undefined) { updates.push("system_prompt = ?"); values.push(systemPrompt || null); }
    if (userPrompt !== undefined) { updates.push("user_prompt = ?"); values.push(userPrompt || null); }

    // 敏感字段：只有非空值且不是掩码时才更新
    if (deeplxToken !== undefined && deeplxToken && !deeplxToken.includes("****")) {
      updates.push("deeplx_token = ?");
      values.push(encrypt(deeplxToken));
    }
    if (apiKey !== undefined && apiKey && !apiKey.includes("****")) {
      updates.push("api_key = ?");
      values.push(encrypt(apiKey));
    }

    if (updates.length > 0) {
      updates.push("updated_at = unixepoch()");
      values.push(id);
      db.prepare(`UPDATE translation_engines SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "更新引擎失败" },
      { status: 500 }
    );
  }
}

/** DELETE: 删除引擎 */
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "缺少引擎 ID" }, { status: 400 });
    }

    const db = getDb();
    db.prepare("DELETE FROM translation_engines WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "删除引擎失败" },
      { status: 500 }
    );
  }
}
