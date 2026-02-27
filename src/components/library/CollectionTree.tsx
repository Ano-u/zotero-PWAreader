/**
 * 集合树形导航
 *
 * 展示 Zotero 文献集合的层级结构。
 */

"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Folder, Library } from "lucide-react";
import { cn } from "@/lib/utils";

interface Collection {
  key: string;
  data: {
    key: string;
    name: string;
    parentCollection: string | false;
  };
  meta: {
    numItems: number;
  };
}

interface CollectionTreeProps {
  selectedKey: string | null;
  onSelect: (key: string | null, name: string) => void;
}

export function CollectionTree({ selectedKey, onSelect }: CollectionTreeProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCollections() {
      try {
        const res = await fetch("/api/zotero/collections");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "加载失败");
        }
        const data = await res.json();
        setCollections(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载集合失败");
      } finally {
        setLoading(false);
      }
    }
    fetchCollections();
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <p className="text-destructive">{error}</p>
        <p className="mt-2">请在设置页配置 Zotero 连接</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-0.5">
        {/* "全部文献" 固定项 */}
        <button
          onClick={() => onSelect(null, "全部文献")}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
            selectedKey === null && "bg-accent font-medium"
          )}
        >
          <Library className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">全部文献</span>
        </button>

        {/* 集合列表 */}
        {collections.map((col) => (
          <button
            key={col.key}
            onClick={() => onSelect(col.data.key, col.data.name)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
              selectedKey === col.data.key && "bg-accent font-medium"
            )}
          >
            {selectedKey === col.data.key ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate flex-1 text-left">{col.data.name}</span>
            {col.meta.numItems > 0 && (
              <span className="text-xs text-muted-foreground">{col.meta.numItems}</span>
            )}
          </button>
        ))}

        {collections.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
            暂无集合
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
