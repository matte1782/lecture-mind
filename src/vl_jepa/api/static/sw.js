/**
 * Service Worker for Lecture Mind Student Playground.
 *
 * Strategy:
 *   - install: pre-cache all static assets (CSS, JS, HTML)
 *   - activate: delete old caches
 *   - fetch: cache-first for /static/*, network-first for /api/*
 *
 * @version 0.4.0
 */

const CACHE_NAME = 'lm-v0.4.0';

const STATIC_ASSETS = [
  '/static/index.html',
  '/static/tokens.css',
  '/static/tokens-v2.css',
  '/static/components.css',
  '/static/layout.css',
  '/static/utilities.css',
  '/static/landing.css',
  '/static/animations.css',
  '/static/animations-v2.css',
  '/static/accessibility.css',
  '/static/playground-components.css',
  '/static/analytics.css',
  '/static/app.js',
  '/static/dom-utils.js',
  '/static/flashcards.js',
  '/static/library.js',
  '/static/analytics.js',
  '/static/sw-utils.js',
  '/static/storage/index.js',
  '/static/storage/db.js',
  '/static/storage/models.js',
  '/static/storage/repositories.js',
  '/static/storage/migrations.js',
  '/static/storage/sync.js'
];

// ---------------------------------------------------------------------------
// INSTALL — pre-cache static assets
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// ACTIVATE — remove old caches
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// FETCH — cache-first for static, network-first for API
// ---------------------------------------------------------------------------

const STATIC_ASSET_SET = new Set(STATIC_ASSETS);

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Cache-first for static assets
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(event.request)
        .then((cached) => cached || fetch(event.request).then((response) => {
          // Only cache known static assets (prevents unbounded cache growth)
          if (response.ok && STATIC_ASSET_SET.has(url.pathname)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }))
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/static/index.html');
          }
        })
    );
    return;
  }

  // Network-first for API routes
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Default: network only
  event.respondWith(fetch(event.request));
});
