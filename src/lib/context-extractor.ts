/**
 * 论文上下文提取与分块
 *
 * 从 Zotero 获取论文全文，根据 token 预算进行截断。
 * 用于 AI 对话模式的上下文注入。
 */

import { getFulltext, getItem } from "@/lib/zotero-client";
import { formatCreators } from "@/types/zotero";
import type { ZoteroItem } from "@/types/zotero";

/** 粗略估算 token 数（中英文混合，约 1.5 字符/token） */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 1.5);
}

/** 截断文本到指定 token 预算 */
function truncateToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * 1.5);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[...全文过长，已截断...]";
}

export interface PaperContext {
  /** 论文元数据（标题、作者、摘要等） */
  title: string;
  authors: string;
  journal: string;
  abstract: string;
  /** 论文全文（或截断后的部分） */
  fulltext: string;
  /** 全文是否被截断 */
  truncated: boolean;
}

/**
 * 提取论文完整上下文
 *
 * 策略：
 * 1. 从 Zotero API 获取元数据（标题、作者、摘要）
 * 2. 获取全文索引（fulltext API）
 * 3. 如果全文 > maxTokens，截断到预算范围内
 *
 * @param itemKey Zotero item key
 * @param maxFulltextTokens 全文部分的 token 上限，默认 6000
 */
export async function extractPaperContext(
  itemKey: string,
  maxFulltextTokens: number = 6000
): Promise<PaperContext> {
  // 并行获取元数据和全文
  const [item, fulltext] = await Promise.all([
    getItem(itemKey),
    getFulltext(itemKey),
  ]);

  const meta = item?.data;
  const title = meta?.title || "未知标题";
  const authors = meta?.creators ? formatCreators(meta.creators) : "未知作者";
  const journal = meta?.publicationTitle || "";
  const abstract = meta?.abstractNote || "";

  // 全文处理
  let fulltextContent = fulltext?.content || "";
  let truncated = false;

  if (fulltextContent && estimateTokens(fulltextContent) > maxFulltextTokens) {
    fulltextContent = truncateToTokenBudget(fulltextContent, maxFulltextTokens);
    truncated = true;
  }

  return {
    title,
    authors,
    journal,
    abstract,
    fulltext: fulltextContent,
    truncated,
  };
}

/**
 * 使用缓存的元数据构建上下文（避免重复请求 API）
 */
export function buildContextFromMeta(
  itemMeta: ZoteroItem,
  fulltext: string = "",
  maxFulltextTokens: number = 6000
): PaperContext {
  let truncated = false;
  let processedFulltext = fulltext;

  if (processedFulltext && estimateTokens(processedFulltext) > maxFulltextTokens) {
    processedFulltext = truncateToTokenBudget(processedFulltext, maxFulltextTokens);
    truncated = true;
  }

  return {
    title: itemMeta.data.title || "未知标题",
    authors: itemMeta.data.creators ? formatCreators(itemMeta.data.creators) : "未知作者",
    journal: itemMeta.data.publicationTitle || "",
    abstract: itemMeta.data.abstractNote || "",
    fulltext: processedFulltext,
    truncated,
  };
}

/**
 * 填充对话 system prompt 模板
 */
export function fillChatSystemPrompt(
  template: string,
  context: PaperContext,
  targetLang: string = "中文"
): string {
  return template
    .replaceAll("{title}", context.title)
    .replaceAll("{authors}", context.authors)
    .replaceAll("{abstract}", context.abstract || "未提供")
    .replaceAll("{fulltext}", context.fulltext || "未能获取全文")
    .replaceAll("{targetLang}", targetLang);
}
