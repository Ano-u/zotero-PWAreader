/**
 * 文献列表
 *
 * 展示选中集合的文献条目，支持分页加载和搜索。
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemCard } from "@/components/library/ItemCard";
import { Loader2 } from "lucide-react";
import type { ZoteroItem } from "@/types/zotero";

interface ItemListProps {
  collectionKey: string | null;
  searchQuery: string;
}

const PAGE_SIZE = 25;

export function ItemList({ collectionKey, searchQuery }: ItemListProps) {
  const [items, setItems] = useState<ZoteroItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载文献列表
  const fetchItems = useCallback(
    async (start: number = 0, append: boolean = false) => {
      if (start === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          start: String(start),
        });
        if (collectionKey) params.set("collectionKey", collectionKey);
        if (searchQuery) params.set("q", searchQuery);

        const res = await fetch(`/api/zotero/items?${params}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "加载失败");
        }
        const data = await res.json();

        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setTotalResults(data.totalResults);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载文献失败");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [collectionKey, searchQuery]
  );

  // 当集合或搜索变化时重新加载
  useEffect(() => {
    setItems([]);
    fetchItems(0);
  }, [fetchItems]);

  // 滚动到底部时加载更多
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const target = e.currentTarget;
    const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;
    if (nearBottom && !loadingMore && items.length < totalResults) {
      fetchItems(items.length, true);
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-sm text-muted-foreground">
          <p className="text-destructive mb-2">{error}</p>
          <p>请检查 Zotero 连接设置</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          {searchQuery ? "未找到匹配的文献" : "暂无文献"}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef} onScrollCapture={handleScroll}>
      <div className="divide-y">
        {items.map((item) => (
          <ItemCard key={item.key} item={item} />
        ))}
      </div>

      {/* 加载更多指示器 */}
      {loadingMore && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 底部统计 */}
      {items.length > 0 && (
        <div className="py-3 text-center text-xs text-muted-foreground">
          已加载 {items.length} / {totalResults} 篇
        </div>
      )}
    </ScrollArea>
  );
}
