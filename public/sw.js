/**
 * Service Worker — PWA 离线支持
 *
 * 策略：
 * - App Shell (HTML/CSS/JS): Network First → Cache Fallback
 * - 静态资源 (_next/static): Cache First（长期缓存）
 * - PDF 文件: Cache First（已下载的 PDF 离线可用）
 * - API 请求: Network Only（不缓存 API 响应）
 */

const CACHE_NAME = "zotero-reader-v1";

// App Shell 预缓存列表
const PRECACHE_URLS = [
  "/library",
  "/login",
  "/manifest.json",
  "/icons/icon.svg",
];

// 安装：预缓存 App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 请求拦截
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 仅处理同源请求
  if (url.origin !== self.location.origin) return;

  // API 请求：不缓存
  if (url.pathname.startsWith("/api/")) return;

  // 静态资源（_next/static）：Cache First
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // PDF Worker：Cache First
  if (url.pathname.endsWith(".mjs") || url.pathname.endsWith(".worker.js")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 页面请求：Network First → Cache Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/library")))
    );
    return;
  }
});
