/**
 * 阅读器顶部工具栏
 */

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, History } from "lucide-react";
import Link from "next/link";

interface ReaderToolbarProps {
  title: string;
  itemKey: string;
}

export function ReaderToolbar({ title }: ReaderToolbarProps) {
  const router = useRouter();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8"
        onClick={() => router.push("/library")}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <h1 className="flex-1 text-sm font-medium truncate">
        {title}
      </h1>

      <Link href="/history">
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
          <History className="h-4 w-4" />
        </Button>
      </Link>

      <Link href="/settings">
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </Link>
    </header>
  );
}
