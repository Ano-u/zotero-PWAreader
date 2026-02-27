/**
 * 单条文献卡片
 *
 * 显示文献标题、作者、期刊、日期等信息。
 * 点击后跳转到阅读器页面。
 */

"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FileText, BookOpen, Globe } from "lucide-react";
import type { ZoteroItem } from "@/types/zotero";
import { formatCreators } from "@/types/zotero";

interface ItemCardProps {
  item: ZoteroItem;
}

/** 条目类型图标映射 */
function ItemTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "journalArticle":
      return <FileText className="h-4 w-4 shrink-0 text-blue-500" />;
    case "book":
    case "bookSection":
      return <BookOpen className="h-4 w-4 shrink-0 text-amber-600" />;
    case "webpage":
      return <Globe className="h-4 w-4 shrink-0 text-green-500" />;
    default:
      return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

/** 格式化日期显示 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  // Zotero 的日期格式不固定，尝试解析
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // 可能是 "2024" 或 "2024-01" 这种不完整格式
    return dateStr;
  }
  return date.getFullYear().toString();
}

export function ItemCard({ item }: ItemCardProps) {
  const { data, meta } = item;
  const authors = formatCreators(data.creators);
  const year = formatDate(meta.parsedDate || data.date);
  const hasPdf = (meta.numChildren ?? 0) > 0;

  return (
    <Link
      href={`/reader/${item.key}`}
      className="flex gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent"
    >
      <div className="mt-0.5">
        <ItemTypeIcon type={data.itemType} />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        {/* 标题 */}
        <h3 className="text-sm font-medium leading-snug line-clamp-2">
          {data.title || "无标题"}
        </h3>

        {/* 作者 */}
        {authors && (
          <p className="text-xs text-muted-foreground truncate">{authors}</p>
        )}

        {/* 底部元信息行 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {data.publicationTitle && (
            <span className="truncate max-w-[200px]">{data.publicationTitle}</span>
          )}
          {year && <span>{year}</span>}
          {hasPdf && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              PDF
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
