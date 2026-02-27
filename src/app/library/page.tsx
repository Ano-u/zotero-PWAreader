/**
 * 文库浏览页
 *
 * 左侧集合树 + 右侧文献列表（移动端为切换模式）。
 */

"use client";

import { useState } from "react";
import { CollectionTree } from "@/components/library/CollectionTree";
import { ItemList } from "@/components/library/ItemList";
import { SearchBar } from "@/components/library/SearchBar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FolderOpen, Settings, BookOpen } from "lucide-react";
import Link from "next/link";

export default function LibraryPage() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedCollectionName, setSelectedCollectionName] = useState("全部文献");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleSelectCollection(key: string | null, name: string) {
    setSelectedCollection(key);
    setSelectedCollectionName(name);
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* 顶部导航栏 */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        {/* 移动端：侧边栏触发按钮 */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <FolderOpen className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex h-full flex-col">
              <div className="flex h-14 items-center gap-2 border-b px-4">
                <BookOpen className="h-5 w-5 text-primary" />
                <span className="font-semibold">Zotero Reader</span>
              </div>
              <CollectionTree
                selectedKey={selectedCollection}
                onSelect={handleSelectCollection}
              />
            </div>
          </SheetContent>
        </Sheet>

        <h1 className="text-lg font-semibold truncate flex-1">{selectedCollectionName}</h1>

        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 桌面端左侧栏 */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r">
          <div className="flex h-10 items-center gap-2 border-b px-4">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Zotero Reader</span>
          </div>
          <CollectionTree
            selectedKey={selectedCollection}
            onSelect={handleSelectCollection}
          />
        </aside>

        {/* 右侧内容区 */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="p-3 border-b">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <ItemList
            collectionKey={selectedCollection}
            searchQuery={searchQuery}
          />
        </main>
      </div>
    </div>
  );
}
