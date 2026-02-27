/**
 * POST /api/translate — 统一翻译接口
 */

import { NextRequest, NextResponse } from "next/server";
import { translate } from "@/lib/translate";
import type { TranslateRequest } from "@/types/translate";

export async function POST(request: NextRequest) {
  try {
    const body: TranslateRequest = await request.json();

    if (!body.text?.trim()) {
      return NextResponse.json({ error: "翻译文本不能为空" }, { status: 400 });
    }

    if (!body.engine) {
      return NextResponse.json({ error: "请选择翻译引擎" }, { status: 400 });
    }

    if (!body.targetLang) {
      return NextResponse.json({ error: "请选择目标语言" }, { status: 400 });
    }

    const result = await translate({
      text: body.text.trim(),
      sourceLang: body.sourceLang || "auto",
      targetLang: body.targetLang,
      engine: body.engine,
      context: body.context,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "翻译失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
