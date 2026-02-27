/**
 * DeepLX 翻译引擎
 *
 * 调用 DeepLX 托管 API (api.deeplx.org/{token}/translate)。
 * 不使用 LLM 上下文，仅发送原文。
 */

import type { TranslateRequest, TranslateResponse } from "@/types/translate";

interface DeepLXConfig {
  token: string; // DeepLX 访问 token
}

/** 语言代码映射：ISO 639-1 → DeepL 格式 */
const LANG_MAP: Record<string, string> = {
  zh: "ZH",
  en: "EN",
  ja: "JA",
  ko: "KO",
  fr: "FR",
  de: "DE",
  es: "ES",
  pt: "PT",
  ru: "RU",
  it: "IT",
  auto: "auto",
};

function mapLang(lang: string): string {
  return LANG_MAP[lang.toLowerCase()] || lang.toUpperCase();
}

export async function translateWithDeepLX(
  config: DeepLXConfig,
  request: TranslateRequest
): Promise<TranslateResponse> {
  const url = `https://api.deeplx.org/${config.token}/translate`;

  const body = {
    text: request.text,
    source_lang: mapLang(request.sourceLang),
    target_lang: mapLang(request.targetLang),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000), // 10 秒超时
  });

  if (response.status === 429) {
    throw new Error("DeepLX 请求过于频繁，请稍后重试");
  }

  if (!response.ok) {
    throw new Error(`DeepLX 翻译失败: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`DeepLX 翻译失败: ${data.message || "未知错误"}`);
  }

  return {
    translation: data.data,
    alternatives: data.alternatives || [],
    engine: "deeplx",
  };
}
