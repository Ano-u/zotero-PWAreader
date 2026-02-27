/** 应用设置类型定义 */

/** 完整的应用设置 */
export interface AppSettings {
  /** Zotero 连接配置 */
  zotero: {
    userId: string;
    apiKey: string; // 加密存储
  };
  /** 翻译偏好 */
  translation: {
    defaultEngine: string; // 默认翻译引擎 ID
    defaultSourceLang: string;
    defaultTargetLang: string;
  };
  /** 对话偏好 */
  chat: {
    defaultEngine: string; // 默认对话引擎 ID
    systemPrompt: string; // 对话 system prompt 模板
  };
  /** 界面偏好 */
  ui: {
    theme: "light" | "dark" | "system";
    fontSize: number; // PDF 阅读器基础字号
  };
}

/** 默认设置值 */
export const DEFAULT_SETTINGS: AppSettings = {
  zotero: {
    userId: "",
    apiKey: "",
  },
  translation: {
    defaultEngine: "",
    defaultSourceLang: "auto",
    defaultTargetLang: "zh",
  },
  chat: {
    defaultEngine: "",
    systemPrompt: `你是一位学术论文阅读助手。用户正在阅读以下论文：

标题: {title}
作者: {authors}
摘要: {abstract}

论文全文（部分）:
{fulltext}

请基于论文内容回答用户的问题。如果问题超出论文范围，可以结合你的知识回答，但需注明。
回答使用{targetLang}。`,
  },
  ui: {
    theme: "light",
    fontSize: 16,
  },
};

/** 默认翻译 System Prompt */
export const DEFAULT_TRANSLATE_SYSTEM_PROMPT = `你是一位专业的学术论文翻译专家。

## 论文信息
- 标题: {title}
- 作者: {authors}
- 期刊: {journal}
- 摘要: {abstract}

翻译要求：
1. 根据论文领域和上下文准确翻译专业术语
2. 保持学术文体的严谨性
3. 仅输出翻译结果，不要解释`;

/** 默认翻译 User Prompt */
export const DEFAULT_TRANSLATE_USER_PROMPT = `## 上下文段落
{paragraphContext}

## 请翻译以下文本为{targetLang}
{selectedText}`;
