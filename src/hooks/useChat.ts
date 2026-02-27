/**
 * 对话状态管理 Hook
 *
 * 管理 AI 对话历史、流式请求、消息发送。
 * 对话历史通过 API 持久化到 SQLite。
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChatMessage } from "@/types/translate";

interface UseChatOptions {
  /** 当前论文 key */
  itemKey: string;
  /** 翻译引擎 ID（用于 OpenAI 兼容 API） */
  engine: string;
}

interface UseChatReturn {
  /** 对话消息列表 */
  messages: ChatMessage[];
  /** 是否正在生成回复 */
  isStreaming: boolean;
  /** 错误信息 */
  error: string;
  /** 发送消息 */
  sendMessage: (content: string, selectedText?: string) => Promise<void>;
  /** 清空对话历史 */
  clearHistory: () => Promise<void>;
  /** 停止生成 */
  stopGeneration: () => void;
}

export function useChat({ itemKey, engine }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // 加载历史对话
  useEffect(() => {
    if (!itemKey) return;

    fetch(`/api/chat?itemKey=${encodeURIComponent(itemKey)}`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data) => {
        if (data.messages?.length > 0) {
          setMessages(
            data.messages.map((m: { role: string; content: string; createdAt: number }, i: number) => ({
              id: `history-${i}`,
              role: m.role as "user" | "assistant",
              content: m.content,
              createdAt: m.createdAt,
            }))
          );
        }
      })
      .catch(() => {});
  }, [itemKey]);

  const sendMessage = useCallback(
    async (content: string, selectedText?: string) => {
      if (!content.trim() || !engine) return;

      setError("");

      // 添加用户消息
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        createdAt: Date.now(),
      };

      // 如果有选中文本，在用户消息前加上引用
      const displayContent = selectedText
        ? `> ${selectedText.slice(0, 200)}${selectedText.length > 200 ? "..." : ""}\n\n${content.trim()}`
        : content.trim();
      userMessage.content = displayContent;

      setMessages((prev) => [...prev, userMessage]);

      // 添加 assistant 占位消息（流式填充）
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsStreaming(true);

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content.trim(),
            itemKey,
            engine,
            selectedText,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `请求失败 (${response.status})`);
        }

        if (!response.body) {
          throw new Error("服务器未返回流式响应");
        }

        // 读取 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") break;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  accumulated += content;
                  // 更新 assistant 消息内容
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: accumulated }
                        : m
                    )
                  );
                }
              } catch {
                // 忽略 JSON 解析错误（不完整的 SSE 行）
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // 用户主动停止，不设置错误
        } else {
          const message = err instanceof Error ? err.message : "对话请求失败";
          setError(message);
          // 移除空的 assistant 消息
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantMessage.id || m.content !== "")
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [itemKey, engine]
  );

  const clearHistory = useCallback(async () => {
    try {
      await fetch(`/api/chat?itemKey=${encodeURIComponent(itemKey)}`, {
        method: "DELETE",
      });
      setMessages([]);
    } catch {
      setError("清空历史失败");
    }
  }, [itemKey]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearHistory,
    stopGeneration,
  };
}
