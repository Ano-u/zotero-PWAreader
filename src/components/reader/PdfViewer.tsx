/**
 * PDF 阅读器核心组件
 *
 * 使用 pdfjs-dist 渲染 PDF，支持：
 * - 虚拟化渲染（仅渲染可见页 ±2 页）
 * - 文本选择层（textLayer）
 * - 移动端双指缩放
 * - 阅读进度保存/恢复
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PageRenderer } from "@/components/reader/PageRenderer";
import { PageNavigator } from "@/components/reader/PageNavigator";
import { TranslationPopup } from "@/components/translation/TranslationPopup";
import { ChatPanel } from "@/components/reader/ChatPanel";
import { ModeSwitch, type ReaderMode } from "@/components/reader/ModeSwitch";
import { useTextSelection, extractParagraphContext } from "@/hooks/useTextSelection";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCreators } from "@/types/zotero";
import type { ZoteroItem } from "@/types/zotero";
import type { TranslationContext } from "@/types/translate";

// pdfjs-dist 动态导入（仅在客户端执行）
let pdfjsLib: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjsLib;
}

/** 虚拟化窗口大小：当前页 ± RENDER_BUFFER 页 */
const RENDER_BUFFER = 2;

/** 缩放范围 */
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;

interface PdfViewerProps {
  url: string;
  itemKey: string;
  itemMeta?: ZoteroItem;
}

export function PdfViewer({ url, itemKey, itemMeta }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 翻译引擎列表
  const [engines, setEngines] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [defaultEngine, setDefaultEngine] = useState("");

  // 阅读模式：翻译 or 对话
  const [mode, setMode] = useState<ReaderMode>("translate");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSelectedText, setChatSelectedText] = useState<string | undefined>();

  // 获取可用于对话的引擎（仅 OpenAI 兼容类型）
  const chatEngine = engines.find((e) => e.type === "openai")?.id || "";

  // 文本选择 → 翻译
  const { selection, clearSelection } = useTextSelection(containerRef);

  // 加载可用翻译引擎
  useEffect(() => {
    fetch("/api/translate/engines")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.engines) {
          setEngines(data.engines);
          setDefaultEngine(data.defaultEngine || "");
        }
      })
      .catch(() => {});
  }, []);

  // 构建翻译上下文（从论文元数据 + 段落提取）
  const buildTranslationContext = useCallback((): TranslationContext | undefined => {
    if (!itemMeta) return undefined;

    const ctx: TranslationContext = {};

    // 论文元数据
    if (itemMeta.data.title) ctx.title = itemMeta.data.title;
    if (itemMeta.data.creators?.length > 0) {
      ctx.authors = formatCreators(itemMeta.data.creators);
    }
    if (itemMeta.data.publicationTitle) ctx.journal = itemMeta.data.publicationTitle;
    if (itemMeta.data.abstractNote) ctx.abstract = itemMeta.data.abstractNote;

    // 段落上下文：从 textLayer 中提取选中文本所在段落
    if (selection?.text && containerRef.current) {
      const paragraphCtx = extractParagraphContext(containerRef.current, selection.text);
      if (paragraphCtx) ctx.paragraphContext = paragraphCtx;
    }

    return ctx;
  }, [itemMeta, selection?.text]);

  // 存储每页的尺寸信息（用于虚拟化占位符高度）
  const [pageViewports, setPageViewports] = useState<Array<{ width: number; height: number }>>([]);

  // 加载 PDF 文档
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        const pdfjs = await getPdfjs();
        const loadingTask = pdfjs.getDocument({
          url,
          // 禁用自动获取，按需加载页面
          disableAutoFetch: true,
        });

        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);

        // 预加载所有页面的 viewport 信息（轻量，只读取页面尺寸）
        const viewports: Array<{ width: number; height: number }> = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1.0 });
          viewports.push({ width: vp.width, height: vp.height });
        }
        setPageViewports(viewports);

        // 恢复阅读进度
        try {
          const progressRes = await fetch(`/api/settings?key=reading_progress_${itemKey}`);
          if (progressRes.ok) {
            const progress = await progressRes.json();
            if (progress?.page) {
              setCurrentPage(progress.page);
              setScale(progress.scale || 1.0);
            }
          }
        } catch {
          // 忽略进度恢复错误
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "PDF 加载失败");
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [url, itemKey]);

  // 计算容器宽度以适配缩放
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 计算实际缩放值：使 PDF 页面适应容器宽度
  const effectiveScale = useCallback(() => {
    if (!containerWidth || pageViewports.length === 0) return scale;
    const pageWidth = pageViewports[0].width;
    const fitScale = (containerWidth - 16) / pageWidth; // 16px padding
    return fitScale * scale;
  }, [containerWidth, pageViewports, scale]);

  // 滚动监听：更新当前页码
  function handleScroll() {
    const container = containerRef.current;
    if (!container || pageViewports.length === 0) return;

    const scrollTop = container.scrollTop;
    const s = effectiveScale();
    let cumulativeHeight = 0;

    for (let i = 0; i < pageViewports.length; i++) {
      const pageHeight = pageViewports[i].height * s + 8; // 8px 间距
      cumulativeHeight += pageHeight;
      if (cumulativeHeight > scrollTop + container.clientHeight / 2) {
        setCurrentPage(i + 1);
        break;
      }
    }
  }

  // 保存阅读进度（防抖）
  useEffect(() => {
    if (!pdfDoc) return;
    const timer = setTimeout(() => {
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: `reading_progress_${itemKey}`,
          value: JSON.stringify({ page: currentPage, scale }),
        }),
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentPage, scale, itemKey, pdfDoc]);

  // 跳转到指定页
  function goToPage(page: number) {
    const container = containerRef.current;
    if (!container || pageViewports.length === 0) return;

    const s = effectiveScale();
    let scrollTop = 0;
    for (let i = 0; i < page - 1; i++) {
      scrollTop += pageViewports[i].height * s + 8;
    }
    container.scrollTo({ top: scrollTop, behavior: "smooth" });
    setCurrentPage(page);
  }

  // 缩放控制
  function zoomIn() {
    setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
  }
  function zoomOut() {
    setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));
  }

  // 计算需要渲染的页面范围
  const renderStart = Math.max(1, currentPage - RENDER_BUFFER);
  const renderEnd = Math.min(numPages, currentPage + RENDER_BUFFER);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">加载 PDF 中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden relative">
      {/* PDF 页面容器 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-neutral-100"
        onScroll={handleScroll}
      >
        <div className="flex flex-col items-center py-2 gap-2">
          {pageViewports.map((vp, index) => {
            const pageNum = index + 1;
            const s = effectiveScale();
            const shouldRender = pageNum >= renderStart && pageNum <= renderEnd;

            if (!shouldRender) {
              // 虚拟化占位符
              return (
                <div
                  key={pageNum}
                  style={{
                    width: vp.width * s,
                    height: vp.height * s,
                  }}
                  className="bg-white shadow-sm"
                />
              );
            }

            return (
              <PageRenderer
                key={pageNum}
                pdfDoc={pdfDoc!}
                pageNumber={pageNum}
                scale={s}
              />
            );
          })}
        </div>
      </div>

      {/* 底部控制栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-t bg-background safe-bottom">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>

        <span className="text-xs text-muted-foreground w-12 text-center">
          {Math.round(scale * 100)}%
        </span>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {/* 翻译 / 对话模式切换 */}
        <ModeSwitch
          mode={mode}
          onChange={(m) => {
            setMode(m);
            if (m === "chat") {
              // 切到对话模式时，如果有选中文本，带入对话
              if (selection?.text) {
                setChatSelectedText(selection.text);
                clearSelection();
              }
              setChatOpen(true);
            }
          }}
        />

        <PageNavigator
          currentPage={currentPage}
          totalPages={numPages}
          onPageChange={goToPage}
        />
      </div>

      {/* 翻译弹窗：仅翻译模式下，选中文本时自动弹出 */}
      {mode === "translate" && (
        <TranslationPopup
          selection={selection}
          context={buildTranslationContext()}
          engines={engines}
          defaultEngine={defaultEngine}
          onClose={clearSelection}
        />
      )}

      {/* 对话面板 */}
      <ChatPanel
        open={chatOpen}
        onOpenChange={(open) => {
          setChatOpen(open);
          if (!open) setMode("translate");
        }}
        itemKey={itemKey}
        engine={chatEngine}
        selectedText={chatSelectedText}
        onSelectedTextConsumed={() => setChatSelectedText(undefined)}
      />
    </div>
  );
}
