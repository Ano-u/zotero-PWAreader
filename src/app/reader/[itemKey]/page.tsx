/**
 * PDF 阅读器页面
 *
 * 从 Zotero 获取文献信息和 PDF 附件，展示阅读器。
 */

"use client";

import { useEffect, useState, use } from "react";
import { PdfViewer } from "@/components/reader/PdfViewer";
import { ReaderToolbar } from "@/components/reader/ReaderToolbar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ZoteroItem } from "@/types/zotero";

interface ReaderPageProps {
  params: Promise<{ itemKey: string }>;
}

export default function ReaderPage({ params }: ReaderPageProps) {
  const { itemKey } = use(params);
  const [item, setItem] = useState<ZoteroItem | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPdf() {
      try {
        // 获取条目详情
        const itemRes = await fetch(`/api/zotero/items?itemKey=${itemKey}`);
        if (!itemRes.ok) throw new Error("获取文献信息失败");
        const children: ZoteroItem[] = await itemRes.json();

        // 查找 PDF 附件
        const pdfAttachment = children.find(
          (child) =>
            child.data.itemType === "attachment" &&
            child.data.contentType === "application/pdf"
        );

        if (!pdfAttachment) {
          throw new Error("该文献没有 PDF 附件");
        }

        // 设置 PDF 代理 URL
        setPdfUrl(`/api/zotero/file/${pdfAttachment.key}`);

        // 获取父条目信息（如果当前 itemKey 是父条目）
        const parentRes = await fetch(`/api/zotero/items?itemKey=${itemKey}`);
        if (parentRes.ok) {
          // 尝试获取父条目的元数据
          const parentItemRes = await fetch(`/api/zotero/items?limit=1&q=${itemKey}`);
          if (parentItemRes.ok) {
            const result = await parentItemRes.json();
            if (result.items?.length > 0) {
              setItem(result.items[0]);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载 PDF 失败");
      } finally {
        setLoading(false);
      }
    }

    loadPdf();
  }, [itemKey]);

  if (loading) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <div className="h-12 border-b flex items-center px-4">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Skeleton className="h-[60vh] w-[80vw] mx-auto" />
            <p className="text-sm text-muted-foreground">加载 PDF 中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <ReaderToolbar title="错误" itemKey={itemKey} />
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ReaderToolbar
        title={item?.data.title || "阅读中"}
        itemKey={itemKey}
      />
      {pdfUrl && (
        <PdfViewer
          url={pdfUrl}
          itemKey={itemKey}
          itemMeta={item || undefined}
        />
      )}
    </div>
  );
}
