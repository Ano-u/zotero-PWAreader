/**
 * OpenAI 兼容翻译引擎
 *
 * 支持所有 OpenAI 兼容 API（one-api、new-api、各种中转站）。
 * 使用上下文感知翻译：system prompt 含论文元数据，user prompt 含段落上下文。
 */

import type { TranslateRequest, TranslateResponse, TranslationContext } from "@/types/translate";
import { DEFAULT_TRANSLATE_SYSTEM_PROMPT, DEFAULT_TRANSLATE_USER_PROMPT } from "@/types/settings";

interface OpenAIConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  /** 自定义翻译 system prompt 模板 */
  systemPrompt?: string;
  /** 自定义翻译 user prompt 模板 */
  userPrompt?: string;
}

/** 语言代码 → 中文名称 */
const LANG_NAMES: Record<string, string> = {
  zh: "中文",
  en: "英文",
  ja: "日文",
  ko: "韩文",
  fr: "法文",
  de: "德文",
  es: "西班牙文",
  auto: "自动检测",
};

function langName(code: string): string {
  return LANG_NAMES[code.toLowerCase()] || code;
}

/** 替换模板中的变量占位符 */
function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value || "未知");
  }
  return result;
}

export async function translateWithOpenAI(
  config: OpenAIConfig,
  request: TranslateRequest
): Promise<TranslateResponse> {
  const context = request.context || {};
  const systemTemplate = config.systemPrompt || DEFAULT_TRANSLATE_SYSTEM_PROMPT;
  const userTemplate = config.userPrompt || DEFAULT_TRANSLATE_USER_PROMPT;

  // 填充 system prompt 模板（论文元数据，同篇文章可复用）
  const systemContent = fillTemplate(systemTemplate, {
    title: context.title || "未知",
    authors: context.authors || "未知",
    journal: context.journal || "未知",
    abstract: context.abstract || "未提供",
    targetLang: langName(request.targetLang),
  });

  // 填充 user prompt 模板（段落上下文 + 选中文本）
  const userContent = fillTemplate(userTemplate, {
    paragraphContext: context.paragraphContext || "（无上下文）",
    selectedText: request.text,
    targetLang: langName(request.targetLang),
  });

  // 确保 API base URL 格式正确
  const baseUrl = config.apiBaseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/v1/chat/completions`;

  const body = {
    model: config.model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    temperature: 0.2, // 翻译任务低温度，保持稳定
    stream: false,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000), // 30 秒超时（LLM 较慢）
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenAI API 错误 ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const translation = data.choices?.[0]?.message?.content?.trim();

  if (!translation) {
    throw new Error("OpenAI API 返回空翻译结果");
  }

  return {
    translation,
    engine: "openai",
    detectedLang: request.sourceLang === "auto" ? undefined : request.sourceLang,
  };
}

/** 流式翻译（用于对话模式和长文翻译） */
export async function translateWithOpenAIStream(
  config: OpenAIConfig,
  request: TranslateRequest
): Promise<ReadableStream<string>> {
  const context = request.context || {};
  const systemTemplate = config.systemPrompt || DEFAULT_TRANSLATE_SYSTEM_PROMPT;
  const userTemplate = config.userPrompt || DEFAULT_TRANSLATE_USER_PROMPT;

  const systemContent = fillTemplate(systemTemplate, {
    title: context.title || "未知",
    authors: context.authors || "未知",
    journal: context.journal || "未知",
    abstract: context.abstract || "未提供",
    targetLang: langName(request.targetLang),
  });

  const userContent = fillTemplate(userTemplate, {
    paragraphContext: context.paragraphContext || "（无上下文）",
    selectedText: request.text,
    targetLang: langName(request.targetLang),
  });

  const baseUrl = config.apiBaseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/v1/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      stream: true,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`OpenAI Stream 错误: ${response.status}`);
  }

  // 将 SSE 流转换为纯文本流
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      const text = decoder.decode(value, { stream: true });
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(content);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    },
  });
}
