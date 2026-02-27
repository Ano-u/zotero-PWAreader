/**
 * SQLite 数据库初始化与查询封装
 *
 * 使用 better-sqlite3 同步 API，零配置单文件数据库。
 * 所有 API Key 使用 AES-256-GCM 加密存储。
 */

import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// 数据库文件路径
const DB_PATH = join(process.cwd(), "data", "app.db");

// 加密密钥派生
const APP_SECRET = process.env.APP_SECRET || "default-dev-secret-change-in-production";
const ENCRYPTION_KEY = scryptSync(APP_SECRET, "zotero-reader-salt", 32);

let _db: Database.Database | null = null;

/** 获取数据库实例（单例） */
export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    // 启用 WAL 模式，提升并发读取性能
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");

    // 执行 schema 初始化
    const schema = readFileSync(join(process.cwd(), "src", "lib", "schema.sql"), "utf-8");
    _db.exec(schema);
  }
  return _db;
}

// ======= 加密工具 =======

/** AES-256-GCM 加密 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // 格式: iv:authTag:encrypted (均为 hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** AES-256-GCM 解密 */
export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted data format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ======= 设置 CRUD =======

/** 获取设置值 */
export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

/** 设置值 */
export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

// ======= 翻译缓存 =======

/** 生成翻译缓存 hash */
function translationHash(text: string, targetLang: string, engine: string): string {
  const { createHash } = require("crypto");
  return createHash("sha256").update(`${text}|${targetLang}|${engine}`).digest("hex");
}

/** 查询翻译缓存 */
export function getTranslationCache(
  text: string,
  targetLang: string,
  engine: string
): { translation: string; alternatives?: string[] } | null {
  const db = getDb();
  const hash = translationHash(text, targetLang, engine);
  const row = db.prepare("SELECT translation, alternatives FROM translation_cache WHERE text_hash = ?").get(hash) as
    | { translation: string; alternatives: string | null }
    | undefined;
  if (!row) return null;
  return {
    translation: row.translation,
    alternatives: row.alternatives ? JSON.parse(row.alternatives) : undefined,
  };
}

/** 写入翻译缓存 */
export function setTranslationCache(
  text: string,
  targetLang: string,
  engine: string,
  translation: string,
  alternatives?: string[]
): void {
  const db = getDb();
  const hash = translationHash(text, targetLang, engine);
  db.prepare(
    `INSERT INTO translation_cache (text_hash, source_text, target_lang, engine, translation, alternatives)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(text_hash) DO UPDATE SET translation = excluded.translation, alternatives = excluded.alternatives`
  ).run(hash, text, targetLang, engine, translation, alternatives ? JSON.stringify(alternatives) : null);
}

/** 获取翻译历史记录（分页 + 搜索） */
export function getTranslationHistory(
  offset: number = 0,
  limit: number = 30,
  search?: string
): {
  records: Array<{
    id: number;
    sourceText: string;
    targetLang: string;
    engine: string;
    translation: string;
    createdAt: number;
  }>;
  total: number;
} {
  const db = getDb();

  if (search?.trim()) {
    const pattern = `%${search.trim()}%`;
    const total = (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM translation_cache WHERE source_text LIKE ? OR translation LIKE ?"
        )
        .get(pattern, pattern) as { count: number }
    ).count;

    const records = db
      .prepare(
        `SELECT id, source_text as sourceText, target_lang as targetLang, engine, translation, created_at as createdAt
         FROM translation_cache WHERE source_text LIKE ? OR translation LIKE ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(pattern, pattern, limit, offset) as Array<{
      id: number;
      sourceText: string;
      targetLang: string;
      engine: string;
      translation: string;
      createdAt: number;
    }>;

    return { records, total };
  }

  const total = (
    db.prepare("SELECT COUNT(*) as count FROM translation_cache").get() as { count: number }
  ).count;

  const records = db
    .prepare(
      `SELECT id, source_text as sourceText, target_lang as targetLang, engine, translation, created_at as createdAt
       FROM translation_cache ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as Array<{
    id: number;
    sourceText: string;
    targetLang: string;
    engine: string;
    translation: string;
    createdAt: number;
  }>;

  return { records, total };
}

/** 删除单条翻译历史 */
export function deleteTranslationRecord(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM translation_cache WHERE id = ?").run(id);
}

/** 清空全部翻译历史 */
export function clearTranslationHistory(): void {
  const db = getDb();
  db.prepare("DELETE FROM translation_cache").run();
}

// ======= PDF 缓存 =======

/** 获取 PDF 缓存信息 */
export function getPdfCache(attachmentKey: string): { filePath: string; etag: string | null } | null {
  const db = getDb();
  const row = db
    .prepare("SELECT file_path, etag FROM pdf_cache WHERE attachment_key = ?")
    .get(attachmentKey) as { file_path: string; etag: string | null } | undefined;
  if (!row) return null;
  // 更新最后访问时间
  db.prepare("UPDATE pdf_cache SET last_accessed = unixepoch() WHERE attachment_key = ?").run(attachmentKey);
  return { filePath: row.file_path, etag: row.etag };
}

/** 写入 PDF 缓存记录 */
export function setPdfCache(
  attachmentKey: string,
  filePath: string,
  fileSize: number,
  etag: string | null
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO pdf_cache (attachment_key, file_path, file_size, etag)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(attachment_key) DO UPDATE SET
       file_path = excluded.file_path,
       file_size = excluded.file_size,
       etag = excluded.etag,
       last_accessed = unixepoch()`
  ).run(attachmentKey, filePath, fileSize, etag);
}

/** 获取 PDF 缓存总大小（字节） */
export function getTotalPdfCacheSize(): number {
  const db = getDb();
  const row = db.prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM pdf_cache").get() as { total: number };
  return row.total;
}

/** 获取最旧的 PDF 缓存条目（LRU 淘汰用） */
export function getOldestPdfCaches(limit: number = 10): Array<{ attachmentKey: string; filePath: string; fileSize: number }> {
  const db = getDb();
  return db
    .prepare("SELECT attachment_key as attachmentKey, file_path as filePath, file_size as fileSize FROM pdf_cache ORDER BY last_accessed ASC LIMIT ?")
    .all(limit) as Array<{ attachmentKey: string; filePath: string; fileSize: number }>;
}

/** 删除 PDF 缓存记录 */
export function deletePdfCache(attachmentKey: string): void {
  const db = getDb();
  db.prepare("DELETE FROM pdf_cache WHERE attachment_key = ?").run(attachmentKey);
}

// ======= 阅读进度 =======

/** 获取阅读进度 */
export function getReadingProgress(itemKey: string): { page: number; scrollTop: number; scale: number } | null {
  const db = getDb();
  const row = db.prepare("SELECT page, scroll_top, scale FROM reading_progress WHERE item_key = ?").get(itemKey) as
    | { page: number; scroll_top: number; scale: number }
    | undefined;
  if (!row) return null;
  return { page: row.page, scrollTop: row.scroll_top, scale: row.scale };
}

/** 保存阅读进度 */
export function saveReadingProgress(itemKey: string, page: number, scrollTop: number, scale: number): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO reading_progress (item_key, page, scroll_top, scale, updated_at)
     VALUES (?, ?, ?, ?, unixepoch())
     ON CONFLICT(item_key) DO UPDATE SET
       page = excluded.page,
       scroll_top = excluded.scroll_top,
       scale = excluded.scale,
       updated_at = unixepoch()`
  ).run(itemKey, page, scrollTop, scale);
}

// ======= 对话历史 =======

/** 获取论文对话历史 */
export function getChatHistory(itemKey: string, limit: number = 50): Array<{ role: string; content: string; createdAt: number }> {
  const db = getDb();
  return db
    .prepare(
      "SELECT role, content, created_at as createdAt FROM chat_history WHERE item_key = ? ORDER BY created_at ASC LIMIT ?"
    )
    .all(itemKey, limit) as Array<{ role: string; content: string; createdAt: number }>;
}

/** 添加对话消息 */
export function addChatMessage(itemKey: string, role: string, content: string): void {
  const db = getDb();
  db.prepare("INSERT INTO chat_history (item_key, role, content) VALUES (?, ?, ?)").run(itemKey, role, content);
}

/** 清空论文对话历史 */
export function clearChatHistory(itemKey: string): void {
  const db = getDb();
  db.prepare("DELETE FROM chat_history WHERE item_key = ?").run(itemKey);
}
