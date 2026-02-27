/**
 * 单条对话消息气泡组件
 */

"use client";

import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types/translate";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2.5 px-3 py-1.5", isUser && "flex-row-reverse")}>
      {/* 头像 */}
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* 消息体 */}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {/* 用户消息中的引用块 */}
        {message.content.split("\n").map((line, i) => {
          if (line.startsWith("> ")) {
            return (
              <blockquote
                key={i}
                className="border-l-2 border-primary/30 pl-2 text-xs opacity-80 italic mb-1"
              >
                {line.slice(2)}
              </blockquote>
            );
          }
          return (
            <span key={i}>
              {line}
              {i < message.content.split("\n").length - 1 && <br />}
            </span>
          );
        })}

        {/* 流式光标 */}
        {isStreaming && !isUser && (
          <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
    </div>
  );
}
