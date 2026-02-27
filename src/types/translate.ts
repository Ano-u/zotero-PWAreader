/** 翻译系统类型定义 */

/** 翻译请求 */
export interface TranslateRequest {
  text: string;
  sourceLang: string; // ISO 639-1，"auto" = 自动检测
  targetLang: string;
  engine: string; // 引擎名称
  /** LLM 翻译的上下文信息 */
  context?: TranslationContext;
}

/** 论文上下文（用于 LLM 上下文感知翻译） */
export interface TranslationContext {
  /** 论文标题 */
  title?: string;
  /** 作者 */
  authors?: string;
  /** 期刊名 */
  journal?: string;
  /** 摘要 */
  abstract?: string;
  /** 选中文本所在的段落 */
  paragraphContext?: string;
}

/** 翻译响应 */
export interface TranslateResponse {
  translation: string;
  alternatives?: string[];
  engine: string;
  cached?: boolean;
  detectedLang?: string;
}

/** 翻译引擎配置（存储在 SQLite 中） */
export interface TranslationEngineConfig {
  id: string; // UUID
  name: string; // 显示名称
  type: "deeplx" | "openai"; // 引擎类型
  enabled: boolean;
  priority: number; // 排序优先级，数字越小越靠前
  /** DeepLX 专属：token */
  deeplxToken?: string;
  /** OpenAI 兼容专属 */
  apiBaseUrl?: string;
  apiKey?: string;
  model?: string;
  /** 自定义翻译 system prompt */
  systemPrompt?: string;
  /** 自定义翻译 user prompt */
  userPrompt?: string;
}

/** 对话消息 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number; // Unix timestamp
}

/** 对话请求 */
export interface ChatRequest {
  message: string;
  itemKey: string; // 当前论文 key
  engine: string; // 使用的引擎
  /** 可选：选中的文本片段，作为问题上下文 */
  selectedText?: string;
}
