/** Zotero Web API v3 类型定义 */

export interface ZoteroCollection {
  key: string;
  version: number;
  data: {
    key: string;
    name: string;
    parentCollection: string | false;
    version: number;
  };
  meta: {
    numCollections: number;
    numItems: number;
  };
}

export interface ZoteroCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface ZoteroItem {
  key: string;
  version: number;
  data: {
    key: string;
    itemType: string;
    title: string;
    creators: ZoteroCreator[];
    abstractNote?: string;
    date?: string;
    DOI?: string;
    url?: string;
    publicationTitle?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    tags: { tag: string; type?: number }[];
    collections: string[];
    dateAdded: string;
    dateModified: string;
    // 附件专属字段
    contentType?: string;
    filename?: string;
    linkMode?: string;
    parentItem?: string;
  };
  meta: {
    creatorSummary?: string;
    parsedDate?: string;
    numChildren?: number;
  };
}

/** 文库列表 API 响应 */
export interface ZoteroItemsResponse {
  items: ZoteroItem[];
  totalResults: number;
  startIndex: number;
}

/** Zotero 全文内容 */
export interface ZoteroFulltext {
  content: string;
  indexedPages: number;
  totalPages: number;
}

/** 格式化后的作者列表 */
export function formatCreators(creators: ZoteroCreator[]): string {
  return creators
    .map((c) => {
      if (c.name) return c.name;
      return [c.lastName, c.firstName].filter(Boolean).join(", ");
    })
    .join("; ");
}
