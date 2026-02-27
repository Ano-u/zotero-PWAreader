/**
 * /api/chat — 论文 AI 对话接口
 *
 * POST: 发送对话消息，返回 SSE 流式响应
 * GET:  获取对话历史
 * DELETE: 清空对话历史
 */

import { NextRequest, NextResponse } from "next/server";
import { getEngine } from "@/lib/translate";
import { getChatHistory, addChatMessage, clearChatHistory, getSetting } from "@/lib/db";
import { extractPaperContext, fillChatSystemPrompt } from "@/lib/context-extractor";
import { DEFAULT_SETTINGS } from "@/types/settings";
import type { ChatRequest } from "@/types/translate";

/** GET /api/chat?itemKey=xxx — 获取对话历史 */
export async function GET(request: NextRequest) {
  const itemKey = request.nextUrl.searchParams.get("itemKey");
  if (!itemKey) {
    return NextResponse.json({ error: "缺少 itemKey" }, { status: 400 });
  }

  const messages = getChatHistory(itemKey);
  return NextResponse.json({ messages });
}

/** DELETE /api/chat?itemKey=xxx — 清空对话历史 */
export async function DELETE(request: NextRequest) {
  const itemKey = request.nextUrl.searchParams.get("itemKey");
  if (!itemKey) {
    return NextResponse.json({ error: "缺少 itemKey" }, { status: 400 });
  }

  clearChatHistory(itemKey);
  return NextResponse.json({ success: true });
}

/** POST /api/chat — 发送对话消息（SSE 流式响应） */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();

    if (!body.message?.trim()) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }
    if (!body.engine) {
      return NextResponse.json({ error: "请选择对话引擎" }, { status: 400 });
    }
    if (!body.itemKey) {
      return NextResponse.json({ error: "缺少论文标识" }, { status: 400 });
    }

    // 获取引擎配置
    const engine = getEngine(body.engine);
    if (!engine || engine.type !== "openai") {
      return NextResponse.json({ error: "对话功能仅支持 OpenAI 兼容引擎" }, { status: 400 });
    }
    if (!engine.apiBaseUrl || !engine.apiKey || !engine.model) {
      return NextResponse.json({ error: "引擎配置不完整" }, { status: 400 });
    }

    // 提取论文上下文
    const paperContext = await extractPaperContext(body.itemKey);

    // 构建 system prompt
    const chatPromptTemplate = getSetting("chat_system_prompt") || DEFAULT_SETTINGS.chat.systemPrompt;
    const systemContent = fillChatSystemPrompt(chatPromptTemplate, paperContext);

    // 获取历史消息（最近 20 条，控制 token）
    const history = getChatHistory(body.itemKey, 20);

    // 构建消息列表
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemContent },
    ];

    // 加入历史对话
    for (const msg of history) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // 加入当前用户消息
    let userContent = body.message.trim();
    if (body.selectedText) {
      userContent = `[用户选中了以下论文片段]\n"${body.selectedText.slice(0, 500)}"\n\n${userContent}`;
    }
    messages.push({ role: "user", content: userContent });

    // 保存用户消息到历史
    addChatMessage(body.itemKey, "user", userContent);

    // 调用 OpenAI 兼容 API（流式）
    const baseUrl = engine.apiBaseUrl.replace(/\/+$/, "");
    const apiUrl = `${baseUrl}/v1/chat/completions`;

    const apiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${engine.apiKey}`,
      },
      body: JSON.stringify({
        model: engine.model,
        messages,
        temperature: 0.7,
        stream: true,
      }),
      signal: AbortSignal.timeout(120000), // 对话允许更长超时
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text().catch(() => "");
      throw new Error(`AI API 错误 ${apiResponse.status}: ${errorText.slice(0, 200)}`);
    }

    if (!apiResponse.body) {
      throw new Error("AI API 未返回响应体");
    }

    // 将上游 SSE 流转发给客户端，同时收集完整回复用于保存历史
    const upstreamReader = apiResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await upstreamReader.read();
          if (done) {
            // 流结束，保存 assistant 回复到历史
            if (fullResponse.trim()) {
              addChatMessage(body.itemKey, "assistant", fullResponse.trim());
            }
            controller.close();
            return;
          }

          // 直接转发原始 SSE 数据给客户端
          controller.enqueue(value);

          // 同时解析内容用于保存历史
          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullResponse += content;
              } catch {
                // 忽略不完整的 JSON
              }
            }
          }
        } catch (err) {
          // 保存已收集的部分回复
          if (fullResponse.trim()) {
            addChatMessage(body.itemKey, "assistant", fullResponse.trim());
          }
          controller.error(err);
        }
      },
      cancel() {
        upstreamReader.cancel();
        // 保存已收集的部分回复
        if (fullResponse.trim()) {
          addChatMessage(body.itemKey, "assistant", fullResponse.trim());
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "对话失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
