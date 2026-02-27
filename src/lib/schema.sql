-- Zotero Reader 数据库 Schema
-- SQLite 3

-- 应用设置 (KV 存储)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 翻译引擎配置
CREATE TABLE IF NOT EXISTS translation_engines (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('deeplx', 'openai')),
  enabled       INTEGER NOT NULL DEFAULT 1,
  priority      INTEGER NOT NULL DEFAULT 0,
  deeplx_token  TEXT,           -- DeepLX token（加密存储）
  api_base_url  TEXT,           -- OpenAI 兼容 API 地址
  api_key       TEXT,           -- API Key（加密存储）
  model         TEXT,           -- 模型名称
  system_prompt TEXT,           -- 自定义翻译 system prompt
  user_prompt   TEXT,           -- 自定义翻译 user prompt
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- PDF 文件缓存元数据
CREATE TABLE IF NOT EXISTS pdf_cache (
  attachment_key  TEXT PRIMARY KEY,
  file_path       TEXT NOT NULL,
  file_size       INTEGER NOT NULL,
  etag            TEXT,
  last_accessed   INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 翻译缓存
CREATE TABLE IF NOT EXISTS translation_cache (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  text_hash   TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  engine      TEXT NOT NULL,
  translation TEXT NOT NULL,
  alternatives TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_hash
  ON translation_cache(text_hash);

-- Zotero API 响应缓存
CREATE TABLE IF NOT EXISTS zotero_cache (
  cache_key   TEXT PRIMARY KEY,
  data        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER NOT NULL
);

-- 阅读进度
CREATE TABLE IF NOT EXISTS reading_progress (
  item_key    TEXT PRIMARY KEY,
  page        INTEGER NOT NULL DEFAULT 1,
  scroll_top  REAL NOT NULL DEFAULT 0,
  scale       REAL NOT NULL DEFAULT 1.0,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 对话历史
CREATE TABLE IF NOT EXISTS chat_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key    TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chat_item_key
  ON chat_history(item_key, created_at);
