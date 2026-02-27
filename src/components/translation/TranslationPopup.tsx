/**
 * 翻译弹窗 / 底部面板
 *
 * 移动端：底部 Drawer
 * 桌面端：Popover 在选区附近
 */

"use client";

import { useState, useEffect } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Check, Languages, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectionInfo } from "@/hooks/useTextSelection";
import type { TranslateResponse, TranslationContext } from "@/types/translate";

interface TranslationPopupProps {
  selection: SelectionInfo | null;
  context?: TranslationContext;
  engines: Array<{ id: string; name: string; type: string }>;
  defaultEngine: string;
  onClose: () => void;
}

export function TranslationPopup({
  selection,
  context,
  engines,
  defaultEngine,
  onClose,
}: TranslationPopupProps) {
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState(defaultEngine);
  const [targetLang, setTargetLang] = useState("zh");

  // 选中文本变化时自动翻译
  useEffect(() => {
    if (!selection?.text) {
      setResult(null);
      setError("");
      return;
    }

    async function doTranslate() {
      setLoading(true);
      setError("");
      setResult(null);

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: selection!.text,
            sourceLang: "auto",
            targetLang,
            engine: selectedEngine,
            context,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "翻译失败");
        }

        const data: TranslateResponse = await res.json();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "翻译失败");
      } finally {
        setLoading(false);
      }
    }

    doTranslate();
  }, [selection?.text, selectedEngine, targetLang, context]);

  // 复制翻译结果
  async function handleCopy() {
    if (!result?.translation) return;
    await navigator.clipboard.writeText(result.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // 重新翻译（切换引擎）
  function handleEngineChange(engineId: string) {
    setSelectedEngine(engineId);
  }

  const isOpen = !!selection;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[60vh]">
        <div className="px-4 pt-2 pb-4 safe-bottom">
          {/* 顶部栏：引擎选择 + 语言 */}
          <div className="flex items-center gap-2 mb-3">
            <Languages className="h-4 w-4 text-muted-foreground shrink-0" />

            {engines.length > 0 && (
              <Select value={selectedEngine} onValueChange={handleEngineChange}>
                <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
                  <SelectValue placeholder="选择引擎" />
                </SelectTrigger>
                <SelectContent>
                  {engines.map((engine) => (
                    <SelectItem key={engine.id} value={engine.id}>
                      {engine.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <ChevronDown className="h-3 w-3 text-muted-foreground" />

            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger className="h-7 text-xs w-auto min-w-[60px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">英文</SelectItem>
                <SelectItem value="ja">日文</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 原文（可折叠） */}
          {selection?.text && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">原文</p>
              <p className="text-sm leading-relaxed line-clamp-3 text-foreground/80">
                {selection.text}
              </p>
            </div>
          )}

          {/* 翻译结果 */}
          <div className="min-h-[60px]">
            {loading && (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">翻译中...</span>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive py-2">{error}</p>
            )}

            {result && !loading && (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm leading-relaxed flex-1">{result.translation}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-7 w-7"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                {/* 备选翻译（DeepLX） */}
                {result.alternatives && result.alternatives.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">备选</p>
                    {result.alternatives.map((alt, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                        {alt}
                      </p>
                    ))}
                  </div>
                )}

                {/* 引擎标识 */}
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {result.engine}
                  </Badge>
                  {result.cached && (
                    <Badge variant="outline" className="text-[10px]">
                      缓存
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {!loading && !error && !result && !selection && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                选中 PDF 中的文本即可翻译
              </p>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
