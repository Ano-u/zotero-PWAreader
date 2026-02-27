/**
 * 翻译历史页面
 *
 * 展示所有翻译记录，支持搜索、复制、删除。
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Search,
  Copy,
  Check,
  Trash2,
  Loader2,
  History,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface HistoryRecord {
  id: number;
  sourceText: string;
  targetLang: string;
  engine: string;
  translation: string;
  createdAt: number;
}

const LANG_LABELS: Record<string, string> = {
  zh: "中文",
  en: "英文",
  ja: "日文",
  ko: "韩文",
};

const PAGE_SIZE = 30;

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);

  const loadHistory = useCallback(async (newOffset: number, searchTerm: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(newOffset),
        limit: String(PAGE_SIZE),
      });
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/translate/history?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setTotal(data.total || 0);
        setOffset(newOffset);
      }
    } catch {
      toast.error("加载历史失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(0, "");
  }, [loadHistory]);

  function handleSearch() {
    setSearch(searchInput);
    loadHistory(0, searchInput);
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    loadHistory(0, "");
  }

  async function handleCopy(record: HistoryRecord) {
    await navigator.clipboard.writeText(record.translation);
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleDelete(id: number) {
    try {
      await fetch("/api/translate/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotal((prev) => prev - 1);
    } catch {
      toast.error("删除失败");
    }
  }

  async function handleClearAll() {
    if (!confirm("确定要清空全部翻译历史吗？此操作不可撤销。")) return;
    try {
      await fetch("/api/translate/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });
      setRecords([]);
      setTotal(0);
      toast.success("翻译历史已清空");
    } catch {
      toast.error("清空失败");
    }
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }

  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          翻译历史
        </h1>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{total} 条记录</span>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* 搜索 + 清空 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="搜索原文或翻译..."
              className="pr-8"
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
          {total > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive shrink-0"
              onClick={handleClearAll}
            >
              清空
            </Button>
          )}
        </div>

        {search && (
          <p className="text-xs text-muted-foreground">
            搜索 &ldquo;{search}&rdquo; — 找到 {total} 条结果
          </p>
        )}

        {/* 记录列表 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {search ? "没有匹配的记录" : "暂无翻译历史"}
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className="rounded-lg border p-3 space-y-2 hover:bg-muted/30 transition-colors"
              >
                {/* 原文 */}
                <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                  {record.sourceText}
                </p>

                <Separator />

                {/* 翻译 */}
                <p className="text-sm leading-relaxed">{record.translation}</p>

                {/* 底部：元信息 + 操作 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {record.engine}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {LANG_LABELS[record.targetLang] || record.targetLang}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatTime(record.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopy(record)}
                    >
                      {copiedId === record.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(record.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* 分页 */}
            {(hasPrev || hasMore) && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPrev}
                  onClick={() => loadHistory(offset - PAGE_SIZE, search)}
                >
                  上一页
                </Button>
                <span className="text-xs text-muted-foreground">
                  {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} / {total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => loadHistory(offset + PAGE_SIZE, search)}
                >
                  下一页
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
