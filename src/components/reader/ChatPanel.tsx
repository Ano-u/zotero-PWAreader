/**
 * 聊天面板（底部抽屉）
 *
 * 支持论文 AI 问答，流式响应。
 * 可从翻译模式切换过来，选中文本自动填入引用。
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/components/reader/ChatMessage";
import { useChat } from "@/hooks/useChat";
import { Send, Square, Trash2, Loader2 } from "lucide-react";

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemKey: string;
  engine: string;
  /** 从翻译模式传入的选中文本 */
  selectedText?: string;
  onSelectedTextConsumed?: () => void;
}

export function ChatPanel({
  open,
  onOpenChange,
  itemKey,
  engine,
  selectedText,
  onSelectedTextConsumed,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearHistory,
    stopGeneration,
  } = useChat({ itemKey, engine });

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 打开面板时聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // 选中文本自动填入提示
  useEffect(() => {
    if (selectedText && open) {
      setInput(`这段话是什么意思？`);
      onSelectedTextConsumed?.();
    }
  }, [selectedText, open, onSelectedTextConsumed]);

  async function handleSend() {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput("");
    await sendMessage(text, selectedText);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[75vh] max-h-[75vh]">
        <div className="flex flex-col h-full">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
            <h3 className="text-sm font-medium">论文助手</h3>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearHistory}
                  title="清空对话"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* 消息列表 */}
          <div ref={scrollRef} className="flex-1 overflow-auto py-3 space-y-1">
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <p className="text-sm text-muted-foreground mb-2">
                  向 AI 提问关于这篇论文的问题
                </p>
                <div className="space-y-1.5 text-xs text-muted-foreground/70">
                  <p>&ldquo;这篇论文的主要贡献是什么？&rdquo;</p>
                  <p>&ldquo;解释一下公式 (3) 的含义&rdquo;</p>
                  <p>&ldquo;总结这篇论文的方法论&rdquo;</p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
              />
            ))}

            {error && (
              <div className="px-4 py-2">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
          </div>

          {/* 输入区域 */}
          <div className="shrink-0 px-3 pb-3 pt-2 border-t safe-bottom">
            {/* 选中文本预览 */}
            {selectedText && (
              <div className="mb-2 px-2 py-1.5 bg-muted rounded text-xs text-muted-foreground line-clamp-2">
                引用: &ldquo;{selectedText.slice(0, 120)}{selectedText.length > 120 ? "..." : ""}&rdquo;
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={engine ? "输入问题..." : "请先在设置中配置 AI 引擎"}
                disabled={!engine || isStreaming}
                className="h-9 text-sm"
              />
              {isStreaming ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={stopGeneration}
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleSend}
                  disabled={!input.trim() || !engine}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
