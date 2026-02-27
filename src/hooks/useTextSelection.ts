/**
 * 文本选择监听 Hook
 *
 * 监听 PDF textLayer 中的文本选择事件。
 * 返回选中的文本和选区位置（用于定位翻译弹窗）。
 */

"use client";

import { useEffect, useState, useRef, type RefObject } from "react";

export interface SelectionInfo {
  /** 选中的文本 */
  text: string;
  /** 选区在视口中的位置 */
  rect: DOMRect;
}

/**
 * 监听文本选择
 * @param containerRef 包含 textLayer 的容器引用
 */
export function useTextSelection(containerRef: RefObject<HTMLElement | null>): {
  selection: SelectionInfo | null;
  clearSelection: () => void;
} {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function handleSelectionChange() {
      // 防抖：避免选择过程中频繁触发
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const sel = document.getSelection();

        // 无选择或选择已折叠
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setSelection(null);
          return;
        }

        const range = sel.getRangeAt(0);
        const container = containerRef.current;

        // 确保选择发生在 PDF 容器内
        if (!container || !container.contains(range.commonAncestorContainer)) {
          setSelection(null);
          return;
        }

        const text = sel.toString().trim();
        if (!text || text.length < 2) {
          setSelection(null);
          return;
        }

        // 获取选区的屏幕位置
        const rect = range.getBoundingClientRect();
        setSelection({ text, rect });
      }, 300);
    }

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      clearTimeout(debounceRef.current);
    };
  }, [containerRef]);

  function clearSelection() {
    setSelection(null);
    document.getSelection()?.removeAllRanges();
  }

  return { selection, clearSelection };
}

/**
 * 从 PDF textLayer 中提取选中文本所在的段落
 * 用于上下文感知翻译
 */
export function extractParagraphContext(
  containerElement: HTMLElement,
  selectedText: string
): string {
  // 获取 textLayer 中所有文本 span
  const textSpans = containerElement.querySelectorAll(".textLayer span");
  const allText = Array.from(textSpans)
    .map((span) => span.textContent || "")
    .join(" ");

  // 在全文中定位选中文本的位置
  const selectionIndex = allText.indexOf(selectedText);
  if (selectionIndex === -1) return "";

  // 提取前后各 500 字符作为段落上下文
  const contextStart = Math.max(0, selectionIndex - 500);
  const contextEnd = Math.min(allText.length, selectionIndex + selectedText.length + 500);

  return allText.slice(contextStart, contextEnd).trim();
}
