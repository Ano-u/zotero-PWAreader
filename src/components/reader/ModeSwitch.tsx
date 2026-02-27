/**
 * 翻译 / 对话模式切换按钮
 */

"use client";

import { Languages, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReaderMode = "translate" | "chat";

interface ModeSwitchProps {
  mode: ReaderMode;
  onChange: (mode: ReaderMode) => void;
}

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div className="flex items-center bg-muted rounded-md p-0.5">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 px-2.5 text-xs gap-1 rounded-sm",
          mode === "translate" && "bg-background shadow-sm"
        )}
        onClick={() => onChange("translate")}
      >
        <Languages className="h-3.5 w-3.5" />
        翻译
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 px-2.5 text-xs gap-1 rounded-sm",
          mode === "chat" && "bg-background shadow-sm"
        )}
        onClick={() => onChange("chat")}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        对话
      </Button>
    </div>
  );
}
