# Security Review -- v0.4.0 Student Playground Frontend

**Date:** 2026-03-04
**Reviewer:** SECURITY_LEAD
**Scope:** All JS, CSS, HTML in `src/vl_jepa/api/static/` and `src/vl_jepa/api/static/storage/`

---

## Summary

- **Critical: 0**
- **Major: 3**
- **Minor: 5**
- **Informational: 4**
- **Score: 91/100**
- **Recommendation: READY (with noted improvements)**

The codebase demonstrates strong security posture overall. The "safe DOM" discipline (createElement + textContent, zero innerHTML) is consistently enforced across all modules.

---

## Findings

### [MAJOR-1] Service Worker caches cross-origin responses without origin check
**Location:** `sw.js:67-84`
**Confidence:** 90%
**Issue:** The fetch handler checks `url.pathname.startsWith('/static/')` but does not verify that `url.origin` matches `self.location.origin`. The dynamic caching caches any successful `/static/*` response without checking the pre-cache list.
**Fix:** Add origin check and restrict dynamic caching to STATIC_ASSETS list.

### [MAJOR-2] UUID generation uses Math.random
**Location:** `storage/models.js:80-86`
**Confidence:** 92%
**Issue:** `generateUUID()` uses `Math.random()` which is not cryptographically secure.
**Fix:** Use `crypto.randomUUID()` with fallback to `crypto.getRandomValues()`.

### [MAJOR-3] Service Worker has no cache size bounds
**Location:** `sw.js:74-78`
**Confidence:** 85%
**Issue:** Dynamic caching will cache every new `/static/` response indefinitely.
**Fix:** Restrict dynamic caching to only the known STATIC_ASSETS list.

### [MINOR-1] JSON.parse of localStorage data without schema validation
**Location:** `app.js:2034, 2054, 2200, 3458`
**Confidence:** 80%

### [MINOR-2] No Content-Security-Policy header or meta tag
**Location:** `index.html:1-30`
**Confidence:** 88%

### [MINOR-3] Share URL feature uses btoa without input size limit
**Location:** `app.js:3245-3246`
**Confidence:** 75%

### [MINOR-4] SyncManager sends data to configurable endpoint without validation
**Location:** `storage/sync.js:76, 274`
**Confidence:** 78%

### [MINOR-5] Confetti particle styles use cssText with template literals
**Location:** `flashcards.js:1080-1090`
**Confidence:** 60%

---

## Positive Findings

- [INFO-1] Prototype pollution guard is thorough in IndexedDB layer
- [INFO-2] Safe DOM discipline is consistently enforced (zero innerHTML)
- [INFO-3] Route parameters are sanitized via sanitizeId
- [INFO-4] Dependencies are dev-only and minimal (zero production deps)

**Score: 91/100 -- READY**
