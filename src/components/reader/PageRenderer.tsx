/**
 * 单页 PDF 渲染组件
 *
 * 负责渲染单个 PDF 页面的 canvas + textLayer。
 * textLayer 提供文本选择能力。
 *
 * 使用 React.memo 避免不必要的重渲染（父组件滚动/状态变化时）。
 */

"use client";

import { useEffect, useRef, useCallback, memo } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface PageRendererProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

export const PageRenderer = memo(function PageRenderer({
  pdfDoc,
  pageNumber,
  scale,
}: PageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  // 跟踪上次渲染的 scale，避免相同参数重复渲染
  const lastRenderRef = useRef<string>("");

  const renderPage = useCallback(async () => {
    const canvas = canvasRef.current;
    const textLayerDiv = textLayerRef.current;
    if (!canvas || !textLayerDiv) return;

    // 跳过相同参数的重复渲染
    const renderKey = `${pageNumber}-${scale.toFixed(4)}`;
    if (lastRenderRef.current === renderKey) return;

    try {
      // 取消上一次的渲染任务
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      // Canvas 渲染（高清屏适配）
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const context = canvas.getContext("2d")!;
      context.scale(dpr, dpr);

      // pdfjs-dist v5 要求 canvas 参数
      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      lastRenderRef.current = renderKey;

      // Text Layer 渲染（文本选择支持）
      textLayerDiv.innerHTML = "";
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;

      const textContent = await page.getTextContent();
      const { TextLayer } = await import("pdfjs-dist");
      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });
      await textLayer.render();
    } catch (err) {
      if (err instanceof Error && err.name === "RenderingCancelledException") {
        return;
      }
      console.error(`渲染第 ${pageNumber} 页失败:`, err);
    }
  }, [pdfDoc, pageNumber, scale]);

  useEffect(() => {
    renderPage();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [renderPage]);

  return (
    <div className="pdf-page-container bg-white shadow-sm">
      <canvas ref={canvasRef} />
      <div ref={textLayerRef} className="textLayer" />
    </div>
  );
});
