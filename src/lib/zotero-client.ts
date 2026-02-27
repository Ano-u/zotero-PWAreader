/**
 * Zotero Web API v3 客户端封装
 *
 * 所有 Zotero API 调用通过此模块，后端代理模式。
 * 处理认证、分页、错误重试、限流等。
 */

import { getSetting, decrypt } from "@/lib/db";
import type { ZoteroCollection, ZoteroItem, ZoteroFulltext } from "@/types/zotero";

const ZOTERO_API_BASE = "https://api.zotero.org";
const API_VERSION = "3";

/** 获取 Zotero 配置（从 SQLite 读取） */
function getZoteroConfig(): { userId: string; apiKey: string } {
  const userId = getSetting("zotero_user_id") || "";
  const encryptedKey = getSetting("zotero_api_key");
  const apiKey = encryptedKey ? decrypt(encryptedKey) : "";
  return { userId, apiKey };
}

/** 构建请求 headers */
function buildHeaders(apiKey: string): HeadersInit {
  return {
    "Zotero-API-Key": apiKey,
    "Zotero-API-Version": API_VERSION,
    "Content-Type": "application/json",
  };
}

/** 带重试的 fetch，处理 429 限流 */
async function zoteroFetch(
  url: string,
  apiKey: string,
  options: RequestInit = {},
  retries: number = 3
): Promise<Response> {
  const headers = { ...buildHeaders(apiKey), ...((options.headers as Record<string, string>) || {}) };

  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 429) {
      // 限流：读取 Retry-After header，等待后重试
      const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (response.status === 304) {
      // 数据未变更
      return response;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Zotero API error ${response.status}: ${text}`);
    }

    return response;
  }

  throw new Error("Zotero API: 重试次数用尽");
}

// ======= 公开 API =======

/** 获取所有顶级集合 */
export async function getCollections(parentKey?: string): Promise<ZoteroCollection[]> {
  const { userId, apiKey } = getZoteroConfig();
  if (!userId || !apiKey) throw new Error("Zotero 未配置");

  const path = parentKey
    ? `/users/${userId}/collections/${parentKey}/collections`
    : `/users/${userId}/collections/top`;

  const response = await zoteroFetch(`${ZOTERO_API_BASE}${path}?limit=100`, apiKey);
  return response.json();
}

/** 获取文献条目列表 */
export async function getItems(params: {
  collectionKey?: string;
  limit?: number;
  start?: number;
  q?: string;
  sort?: string;
  direction?: string;
}): Promise<{ items: ZoteroItem[]; totalResults: number }> {
  const { userId, apiKey } = getZoteroConfig();
  if (!userId || !apiKey) throw new Error("Zotero 未配置");

  const { collectionKey, limit = 25, start = 0, q, sort = "dateModified", direction = "desc" } = params;

  const basePath = collectionKey
    ? `/users/${userId}/collections/${collectionKey}/items/top`
    : `/users/${userId}/items/top`;

  const searchParams = new URLSearchParams({
    limit: String(limit),
    start: String(start),
    sort,
    direction,
  });
  if (q) searchParams.set("q", q);

  const response = await zoteroFetch(`${ZOTERO_API_BASE}${basePath}?${searchParams}`, apiKey);
  const totalResults = parseInt(response.headers.get("Total-Results") || "0", 10);
  const items = await response.json();

  return { items, totalResults };
}

/** 获取单个条目详情 */
export async function getItem(itemKey: string): Promise<ZoteroItem> {
  const { userId, apiKey } = getZoteroConfig();
  if (!userId || !apiKey) throw new Error("Zotero 未配置");

  const response = await zoteroFetch(`${ZOTERO_API_BASE}/users/${userId}/items/${itemKey}`, apiKey);
  return response.json();
}

/** 获取条目的子项（附件等） */
export async function getItemChildren(itemKey: string): Promise<ZoteroItem[]> {
  const { userId, apiKey } = getZoteroConfig();
  if (!userId || !apiKey) throw new Error("Zotero 未配置");

  const response = await zoteroFetch(
    `${ZOTERO_API_BASE}/users/${userId}/items/${itemKey}/children`,
    apiKey
  );
  return response.json();
}

/** 下载 PDF 附件文件（返回 Response，可流式传输） */
export async function downloadFile(attachmentKey: string): Promise<Response> {
  const { userId, apiKey } = getZoteroConfig();
  if (!userId || !apiKey) throw new Error("Zotero 未配置");

  return zoteroFetch(
    `${ZOTERO_API_BASE}/users/${userId}/items/${attachmentKey}/file`,
    apiKey
  );
}

/** 获取论文全文索引内容 */
export async function getFulltext(itemKey: string): Promise<ZoteroFulltext | null> {
  const { userId, apiKey } = getZoteroConfig();
  if (!userId || !apiKey) throw new Error("Zotero 未配置");

  try {
    const response = await zoteroFetch(
      `${ZOTERO_API_BASE}/users/${userId}/items/${itemKey}/fulltext`,
      apiKey
    );
    return response.json();
  } catch {
    // 部分条目没有全文索引，返回 null
    return null;
  }
}

/** 测试 Zotero API 连接 */
export async function testConnection(userId: string, apiKey: string): Promise<{ success: boolean; error?: string; username?: string }> {
  try {
    const response = await zoteroFetch(
      `${ZOTERO_API_BASE}/users/${userId}/collections?limit=1`,
      apiKey,
      {},
      1 // 只重试一次
    );
    if (response.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP ${response.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "连接失败" };
  }
}
