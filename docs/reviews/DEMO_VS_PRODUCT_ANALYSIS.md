# Demo vs. Product Analysis — Lecture Mind Frontend

**Date**: 2026-03-10
**Analyst**: Claude (multi-agent structural codebase audit)
**Scope**: All files under `src/vl_jepa/api/static/`
**Trigger**: Developer suspects demo and product are tangled with no clear separation.

---

## Executive Summary

Both systems live in the same `index.html` at the same URL, load all the same CSS simultaneously, share the Service Worker cache, and are deployed together to GitHub Pages where the demo half cannot function (no backend). There is one intentional, explicit bridge between them via a CustomEvent. The product (ES modules, IndexedDB, hash router) can operate completely independently; the demo (app.js, localStorage, /api calls) cannot.

---

## 1. What Is "Demo" vs. "Product"

### The Demo — app.js + #app-section

`app.js` (~3500 lines, classic `<script>`, not a module) implements:

- Video file drag-and-drop upload to `/api/upload` (POST multipart, 500MB limit)
- Job polling at `/api/job/:id` every 500ms
- Results rendering: transcript, event timeline, video player, semantic search, export
- Bookmarks: `localStorage` key `lectureMind_bookmarks`
- Confusion markers: `localStorage` key `lectureMind_confusionVotes`
- Notes: `localStorage` key `lectureMind_notes`
- Theme toggle: `localStorage` key `theme` (dark/light)
- Demo mode banner from `/api/config`
- Inline study quiz and flashcard preview generated from processed transcript

**Backend-dependent**. Calls FastAPI endpoints. Cannot function without a running Python server.

### The Product — ES Modules + Hash Router

`flashcards.js`, `library.js`, `analytics.js`, `recorder.js` (all `type="module"`) implement:

- Hash-based SPA router (`#/playground`, `#/lecture/:id`, `#/study/:id`, `#/dashboard`, `#/record`)
- IndexedDB as the only persistent store (LectureMindDB v2, 12 object stores)
- SM-2 spaced-repetition flashcard engine
- Course organization, sidebar filters, library grid
- Study analytics with SVG charts
- Live audio capture (MediaRecorder + Web Speech API) and photo capture
- Confusion voting per segment with per-key mutex

**Requires zero backend.** Fully offline-capable. Works on GitHub Pages.

---

## 2. Current State Diagram

```
index.html (one file, one URL)
│
├── <head>: ALL CSS loaded for BOTH systems
│     landing.css            — marketing/landing page
│     app-components.css     — DEMO: upload, video, progress, events
│     playground-components.css — PRODUCT: library, flashcards, study
│     analytics.css          — PRODUCT: dashboard charts
│     recorder.css           — PRODUCT: recording UI
│
├── <body>
│   ├── <header> — shared nav with demo anchors + product routes
│   │     #features, #how-it-works, #tech-stack → scroll anchors (demo)
│   │     #/playground, #/record → hash routes (product)
│   │     #theme-toggle → owned solely by app.js
│   │
│   ├── Hero, Features, How It Works, Tech Stack — marketing sections
│   │     CTA "Start Analyzing" scrolls to #app-section (demo)
│   │
│   ├── #app-section  ←───── DEMO (backend-dependent)
│   │     Upload, video player, progress, results, transcript
│   │     All state: localStorage + in-memory globals
│   │
│   │   [Bridge: CustomEvent 'lecturemind:processed']
│   │           ↓ app.js:1044 dispatches → library.js:809 handles
│   │
│   ├── #playground-view (hidden) ──── PRODUCT
│   ├── #study-view (hidden)      ──── PRODUCT
│   ├── #lecture-detail-view       ──── PRODUCT
│   ├── #dashboard-view            ──── PRODUCT
│   └── #record-view               ──── PRODUCT (v0.5.0)
│
├── <script src="app.js">              ← classic script
├── <script type="module" src="flashcards.js">
├── <script type="module" src="library.js">
├── <script type="module" src="analytics.js">
└── <script type="module" src="recorder.js">
```

---

## 3. The One Intentional Bridge

`app.js:1044` dispatches:
```javascript
window.dispatchEvent(new CustomEvent('lecturemind:processed', {
  detail: { result: data.result, jobId: currentJobId }
}));
```

`library.js:809` listens and calls `importFromProcessingResult()`, creating a `Lecture` + `Segment`s + `Event`s in IndexedDB. Clean, one-directional, fire-and-forget.

---

## 4. Problem Areas

### P1 — Single URL, No Separation (HIGH)

No distinct URL for demo vs product. Both are visibility states of the same DOM. Users who visit `/static/index.html` see the demo landing page first. The Student Playground is reachable only via a small "Playground" nav link.

### P2 — GitHub Pages Deploys Broken Demo (HIGH)

`.github/workflows/docs.yml` copies `app.js` to GitHub Pages. No backend exists there. Upload attempts call `fetch('/api/upload')` and fail silently — no error, no message. The `checkDemoMode()` guard only skips when URL has a hash route; on first load (no hash), the API call fires and silently fails.

### P3 — Empty State Points Back to Demo (MEDIUM)

The `playground-view` empty state links to `href="#/app-section"` ("Upload a Lecture"), which scrolls to the broken demo upload box. There is **no "Record a Lecture" CTA** pointing to `#/record`.

### P4 — Duplicate Implementations (MEDIUM)

| Concern | Demo (app.js) | Product (ES modules) |
|---------|--------------|----------------------|
| Toasts | Private `showToast()` | Separate `showToast()` in flashcards.js |
| Bookmarks | localStorage | IndexedDB BookmarkRepository |
| Confusion | localStorage | IndexedDB ConfusionVoteRepository |
| Notes | localStorage | Planned W18 Auto-Notes (IDB) |
| createElement | Private copy | Exported from dom-utils.js |

Data created in the demo is completely invisible in the product.

### P5 — Theme Toggle Owned by app.js (LOW-MEDIUM)

The `#theme-toggle` click handler is in `app.js` only. Removing `app.js` breaks theme for the product.

### P6 — All CSS Loads Unconditionally (LOW)

Both `app-components.css` and `playground-components.css` load on every visit.

### P7 — Stale SW Cache (LOW)

`sw.js:12`: `CACHE_NAME = 'lm-v0.4.0'` — not updated for v0.5.0.

---

## 5. User Journey Analysis

### Journey A — GitHub Pages visitor (BAD)

1. Lands on page. Sees "Transform Lectures" marketing.
2. Clicks CTA → scrolls to upload box.
3. Drags video → **nothing happens**. No error shown.
4. Finds "Playground" → empty library → "Upload a Lecture" → scrolls to broken upload.
5. Leaves. Never discovers Recording, Flashcards, or Study features.

### Journey B — Local developer with backend (GOOD)

1. Uploads video → processes → results appear.
2. `lecturemind:processed` fires → lecture imported to library.
3. Navigates to Playground → sees lecture. Full workflow works.

### Journey C — Student using #/record directly (GOOD)

1. Opens `#/record`. Records lecture with audio + photos.
2. Post-recording creates Lecture + Segments automatically.
3. Opens Playground → sees lecture. No demo interaction needed.

Journey C is the intended v0.5.0 flow — but it's not discoverable from the landing page.

---

## 6. Recommendations

### Immediate (v0.5.0 Week 16, ~2h)

**R1 — Backend availability guard in app.js** (1h)
```javascript
async function isBackendAvailable() {
  try {
    const r = await fetch('/api/config', { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}
```
If false: hide demo sections, show banner directing to Playground.

**R2 — Update empty state CTA** (30min)
Add "Record a Lecture" (`href="#/record"`) as primary CTA. Demote "Upload" to secondary with "(requires local server)" label.

**R3 — Update SW cache name** (5min)
Change `'lm-v0.4.0'` to `'lm-v0.5.0'`.

### Medium term (v0.6.0)

**R4 — Move theme to shared module** (2h)
Extract `initTheme()`/`toggleTheme()` from app.js into `theme.js`.

**R5 — Split into two HTML files** (4h)
- `index.html` → pure product (ES modules only)
- `demo.html` → full landing page + backend demo
- GitHub Pages deploys only `index.html`

---

*FORTRESS 4.1.1 — Structural briefing only. Decisions belong to the human.*
