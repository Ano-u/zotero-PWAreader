/**
 * GET /api/zotero/file/[key] — PDF 文件代理 + 缓存
 *
 * 从 Zotero API 下载 PDF 附件，服务端缓存后流式返回。
 */

import { NextRequest, NextResponse } from "next/server";
import { downloadFile } from "@/lib/zotero-client";
import { getPdfCache, setPdfCache, getTotalPdfCacheSize, getOldestPdfCaches, deletePdfCache } from "@/lib/db";
import { existsSync, mkdirSync, createReadStream, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

const PDF_CACHE_DIR = join(process.cwd(), "data", "pdf-cache");
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

/** 确保缓存目录存在 */
function ensureCacheDir() {
  if (!existsSync(PDF_CACHE_DIR)) {
    mkdirSync(PDF_CACHE_DIR, { recursive: true });
  }
}

/** LRU 淘汰过期缓存 */
function evictIfNeeded() {
  const totalSize = getTotalPdfCacheSize();
  if (totalSize <= MAX_CACHE_SIZE) return;

  const oldEntries = getOldestPdfCaches(20);
  for (const entry of oldEntries) {
    try {
      if (existsSync(entry.filePath)) {
        unlinkSync(entry.filePath);
      }
      deletePdfCache(entry.attachmentKey);
    } catch {
      // 忽略清理错误
    }
    if (getTotalPdfCacheSize() <= MAX_CACHE_SIZE * 0.8) break;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key: attachmentKey } = await params;
    ensureCacheDir();

    // 检查本地缓存
    const cached = getPdfCache(attachmentKey);
    if (cached && existsSync(cached.filePath)) {
      const stream = createReadStream(cached.filePath);
      // Node ReadStream -> Web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) => controller.enqueue(new Uint8Array(Buffer.from(chunk))));
          stream.on("end", () => controller.close());
          stream.on("error", (err) => controller.error(err));
        },
      });
      return new NextResponse(webStream, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, max-age=86400",
        },
      });
    }

    // 从 Zotero API 下载
    const response = await downloadFile(attachmentKey);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 写入磁盘缓存
    const filePath = join(PDF_CACHE_DIR, `${attachmentKey}.pdf`);
    writeFileSync(filePath, buffer);

    // 记录缓存元数据
    const etag = response.headers.get("etag");
    setPdfCache(attachmentKey, filePath, buffer.length, etag);

    // 异步清理过期缓存
    try { evictIfNeeded(); } catch { /* 忽略 */ }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF 下载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
