/**
 * POST /api/engines/test — 测试翻译引擎连接
 *
 * 发送一个简短测试请求，返回延迟和状态。
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, deeplxToken, apiBaseUrl, apiKey, model } = body;

    const startTime = Date.now();

    if (type === "deeplx") {
      if (!deeplxToken) {
        return NextResponse.json({ error: "DeepLX Token 未填写" }, { status: 400 });
      }

      const url = `https://api.deeplx.org/${deeplxToken}/translate`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Hello",
          source_lang: "EN",
          target_lang: "ZH",
        }),
        signal: AbortSignal.timeout(10000),
      });

      const latency = Date.now() - startTime;

      if (!res.ok) {
        return NextResponse.json({
          success: false,
          error: `HTTP ${res.status}`,
          latency,
        });
      }

      const data = await res.json();
      return NextResponse.json({
        success: data.code === 200,
        translation: data.data || "",
        latency,
      });
    }

    if (type === "openai") {
      if (!apiBaseUrl || !apiKey || !model) {
        return NextResponse.json({ error: "API 地址、Key 和模型必填" }, { status: 400 });
      }

      const baseUrl = apiBaseUrl.replace(/\/+$/, "");
      const url = `${baseUrl}/v1/chat/completions`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Say hello in one word." }],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const latency = Date.now() - startTime;

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        return NextResponse.json({
          success: false,
          error: `HTTP ${res.status}: ${errorText.slice(0, 100)}`,
          latency,
        });
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return NextResponse.json({
        success: !!content,
        translation: content || "",
        latency,
      });
    }

    return NextResponse.json({ error: "不支持的引擎类型" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "连接测试失败",
        latency: 0,
      },
      { status: 500 }
    );
  }
}
