/**
 * Service Worker 注册组件
 *
 * 在客户端挂载后注册 SW，实现 PWA 离线支持。
 */

"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => {
          // 开发环境下 SW 注册可能失败，忽略
        });
    }
  }, []);

  return null;
}
