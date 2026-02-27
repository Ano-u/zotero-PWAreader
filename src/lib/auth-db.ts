/**
 * 认证模块 — 数据库相关（Node.js Runtime）
 *
 * 包含密码注册、验证等需要访问 SQLite 的函数。
 * 仅可在 API 路由中使用（不可在 Edge middleware 中导入）。
 */

import { hashSync, compareSync } from "bcryptjs";
import { getSetting, setSetting } from "@/lib/db";

/** settings 表中存储密码 hash 的 key */
const PASSWORD_KEY = "password_hash";

/** 检查是否已注册（数据库中已有密码记录） */
export function isRegistered(): boolean {
  const hash = getSetting(PASSWORD_KEY);
  return !!hash;
}

/** 注册 — 首次设置密码，仅允许调用一次 */
export function registerPassword(password: string): boolean {
  if (isRegistered()) {
    return false; // 已注册，拒绝重复注册
  }
  const hash = hashSync(password, 10);
  setSetting(PASSWORD_KEY, hash);
  return true;
}

/** 验证密码是否正确 */
export function verifyPassword(password: string): boolean {
  const storedHash = getSetting(PASSWORD_KEY);
  if (!storedHash) return false; // 未注册
  return compareSync(password, storedHash);
}

/** 生成密码的 bcrypt hash */
export function hashPassword(password: string): string {
  return hashSync(password, 10);
}
