/**
 * Secure Chat Service Worker V3.0
 * 
 * SECURITY CRITICAL:
 * - NO caching of worker.js (Crypto Engine)
 * - NO caching of API or WebSocket traffic
 * - NO caching of JS application chunks (Ensures fresh auditing)
 * - ONLY caches static UI assets (Fonts, Images, CSS)
 * 
 * Any modification to this file requires a security review.
 */

const CACHE_NAME = 'secure-chat-v3-ui-stable';
const ALLOWED_DESTINATIONS = ['image', 'font', 'style'];

// Install: Force immediate activation to replace any insecure SW
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

// Fetch: Strict Network-First / Block-List Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // [SECURITY] EXPLICIT BLOCK: Crypto Worker
  // Must NEVER be cached to ensure the latest crypto primitives are loaded.
  if (url.pathname.includes('worker.js')) {
    return; // Network Only
  }

  // [SECURITY] EXPLICIT BLOCK: Dynamic Next.js Chunks & JSON
  // Prevents stale application logic.
  if (url.pathname.includes('_next/static/chunks') || url.pathname.endsWith('.json')) {
    return; // Network Only
  }

  // [SECURITY] EXPLICIT BLOCK: WebSocket & API
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || url.pathname.startsWith('/api')) {
    return; // Network Only
  }

  // [UX] Navigations (HTML) -> Network Only
  // ensuring we always get the latest Content-Security-Policy nonce
  if (event.request.mode === 'navigate') {
    // Fallback to offline.html if we had one?
    // For secure chat, failing offline is safer than serving stale shell.
    return;
  }

  // [PERFORMANCE] Cache Only Approved Static UI Assets
  if (ALLOWED_DESTINATIONS.includes(event.request.destination)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);

        // Stale-While-Revalidate Logic
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Network failed
        });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: Network Only
  return;
});
