/**
 * Service Worker utility helpers — testable registration and cache config.
 *
 * @module sw-utils
 * @version 1.0.0
 */

const CACHE_VERSION = 'lm-v0.5.0';

/**
 * Static assets to pre-cache during SW install.
 * Includes all CSS, JS, and index.html.
 * @returns {string[]}
 */
function getStaticAssetList() {
  return [
    '/static/index.html',
    // CSS
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
    '/static/app-components.css',
    '/static/recorder.css',
    // JS
    '/static/app.js',
    '/static/dom-utils.js',
    '/static/flashcards.js',
    '/static/library.js',
    '/static/analytics.js',
    '/static/recorder.js',
    '/static/sw-utils.js',
    '/static/storage/index.js',
    '/static/storage/db.js',
    '/static/storage/models.js',
    '/static/storage/repositories.js',
    '/static/storage/migrations.js',
    '/static/storage/sync.js'
  ];
}

/**
 * Return the current cache version string.
 * @returns {string}
 */
function getCacheVersion() {
  return CACHE_VERSION;
}

/**
 * Check if a URL path is a static asset (should use cache-first).
 * @param {string} url - URL path to check
 * @returns {boolean}
 */
function isStaticAsset(url) {
  return url.startsWith('/static/');
}

/**
 * Register the service worker if supported.
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
async function registerServiceWorker() {
  if (!navigator.serviceWorker) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/static/sw.js');
    return registration;
  } catch (_err) {
    return null;
  }
}

export {
  registerServiceWorker,
  getCacheVersion,
  getStaticAssetList,
  isStaticAsset
};
