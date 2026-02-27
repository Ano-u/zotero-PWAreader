/**
 * 页码导航组件
 */

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageNavigatorProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PageNavigator({ currentPage, totalPages, onPageChange }: PageNavigatorProps) {
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const page = parseInt(inputValue, 10);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
    setIsEditing(false);
    setInputValue("");
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="flex items-center">
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className="w-14 h-7 text-xs text-center px-1"
          />
        </form>
      ) : (
        <button
          onClick={() => { setIsEditing(true); setInputValue(String(currentPage)); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
        >
          {currentPage} / {totalPages}
        </button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
