/**
 * 翻译引擎管理器
 *
 * 统一接口，根据引擎名称路由到对应实现。
 * 管理引擎配置、翻译缓存。
 */

import { getDb, decrypt, getTranslationCache, setTranslationCache } from "@/lib/db";
import { translateWithDeepLX } from "./deeplx";
import { translateWithOpenAI } from "./openai";
import type { TranslateRequest, TranslateResponse, TranslationEngineConfig } from "@/types/translate";

/** 获取所有翻译引擎配置 */
export function getEngines(): TranslationEngineConfig[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM translation_engines WHERE enabled = 1 ORDER BY priority ASC")
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    type: row.type as "deeplx" | "openai",
    enabled: (row.enabled as number) === 1,
    priority: row.priority as number,
    deeplxToken: row.deeplx_token ? decrypt(row.deeplx_token as string) : undefined,
    apiBaseUrl: row.api_base_url as string | undefined,
    apiKey: row.api_key ? decrypt(row.api_key as string) : undefined,
    model: row.model as string | undefined,
    systemPrompt: row.system_prompt as string | undefined,
    userPrompt: row.user_prompt as string | undefined,
  }));
}

/** 根据 ID 获取单个引擎配置 */
export function getEngine(engineId: string): TranslationEngineConfig | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM translation_engines WHERE id = ?")
    .get(engineId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as "deeplx" | "openai",
    enabled: (row.enabled as number) === 1,
    priority: row.priority as number,
    deeplxToken: row.deeplx_token ? decrypt(row.deeplx_token as string) : undefined,
    apiBaseUrl: row.api_base_url as string | undefined,
    apiKey: row.api_key ? decrypt(row.api_key as string) : undefined,
    model: row.model as string | undefined,
    systemPrompt: row.system_prompt as string | undefined,
    userPrompt: row.user_prompt as string | undefined,
  };
}

/** 执行翻译（带缓存） */
export async function translate(request: TranslateRequest): Promise<TranslateResponse> {
  const engine = getEngine(request.engine);
  if (!engine) {
    throw new Error(`翻译引擎 "${request.engine}" 不存在`);
  }

  // DeepLX 翻译查缓存
  if (engine.type === "deeplx") {
    const cached = getTranslationCache(request.text, request.targetLang, request.engine);
    if (cached) {
      return { ...cached, engine: request.engine, cached: true };
    }
  }

  // 执行翻译
  let result: TranslateResponse;

  if (engine.type === "deeplx") {
    if (!engine.deeplxToken) throw new Error("DeepLX Token 未配置");
    result = await translateWithDeepLX({ token: engine.deeplxToken }, request);
  } else if (engine.type === "openai") {
    if (!engine.apiBaseUrl || !engine.apiKey || !engine.model) {
      throw new Error("OpenAI 兼容引擎配置不完整");
    }
    result = await translateWithOpenAI(
      {
        apiBaseUrl: engine.apiBaseUrl,
        apiKey: engine.apiKey,
        model: engine.model,
        systemPrompt: engine.systemPrompt,
        userPrompt: engine.userPrompt,
      },
      request
    );
  } else {
    throw new Error(`不支持的引擎类型: ${engine.type}`);
  }

  // DeepLX 结果写入缓存（LLM 结果不缓存，保持多样性）
  if (engine.type === "deeplx") {
    setTranslationCache(request.text, request.targetLang, request.engine, result.translation, result.alternatives);
  }

  return { ...result, engine: request.engine };
}
