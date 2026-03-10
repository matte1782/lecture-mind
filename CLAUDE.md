# VL-JEPA Lecture Summarizer

> **Framework**: FORTRESS 4.1.1 — Minimal Viable Framework
> **Principle**: AI prepares, Human decides

---

## Current State (2026-03-10)

**Version**: v0.5.0 IN PROGRESS — Week 15 complete, Week 16 Day 2 complete
**Tests**: 11 suites, 693 tests, 0 failures
**Reviews**: v0.4.0 final 91/100 | W15 Days 0-5: all GO | W16 Day 0: 91/100 GO | W16 Day 1: 90/100 GO | W16 Day 2: 90/100 GO
**Branch**: master (pushed to origin)
**Release**: https://github.com/matte1782/lecture-mind/releases/tag/v0.4.0

### NEXT SESSION: v0.5.0 "Live Capture" — Week 16 Day 5

Week 16 progress:
- **Day 0**: 6 UX bug fixes + dark mode + backend guard (658 tests)
- **Day 1**: Confusion heatmap — aggregation + bar chart + tab integration + summary stats (684 tests)
- **Day 2**: Privacy banner + Web Speech toggle + Storage quota UI + Photo disclaimer (693 tests)

Next:
1. **W16 Day 5**: Accessibility audit (~2h, +2 tests → 695)
2. **iOS Spike**: Test harness ready (`ios-spike.html`), needs real iPhone test via HTTPS

### Deferred to W19 polish (from hostile reviews)
- M1: URL.createObjectURL blobs never revoked in photo gallery (Day 4)
- M2: Save button click handler integration test (Day 4)
- m1: getUserMedia rejection test (Day 2)
- m1: Redundant countBySegment call in handleToggle (Day 5)
- m2: aria-label on confusion button (Day 5)
- m3: _toggleLocks as module-level const (Day 5)
- m1: getConfusionHeatmapData with zero-segment lecture test (W16 Day 1)
- m2: Heatmap segment labels duplicate when same type (W16 Day 1)
- m3: Heatmap CSS uses literal rem instead of design tokens (W16 Day 1)
- M1: Delete oldest recording has no confirm() dialog (W16 Day 2)
- m1: Photo disclaimer test doesn't verify toast content (W16 Day 2)
- m2: Speech toggle label lacks explicit for/id pairing (W16 Day 2)
- m3: Dark mode missing for .record-privacy-dismiss button (W16 Day 2)
- m4: No test for delete button click handler (W16 Day 2)
- m5: Delete handler error catch swallows error details (W16 Day 2)
- m6: Photo disclaimer ack set before capturePhoto succeeds (W16 Day 2)

### v0.5.0 Plan: "Live Capture" (~68h, 4-5 weeks)

**Scope** (approved, expanded to include Auto-Notes):

| Feature | Hours | Priority | Week |
|---------|-------|----------|------|
| Live Audio Capture (MediaRecorder + Web Speech API) | 16h | P0 | W15 |
| Photo Capture (timestamped, no OCR) | 11h | P0 | W15 |
| SP4-lite: Personal confusion markers + heatmap | 8h | P1 | W15-16 |
| DB Migration v1→v2 + storage quota UI | 7h | P0 | W15-16 |
| Privacy info-toast + Web Speech toggle | 2h | P0 | W16 |
| Auto-Notes Framework (extractive + LLM API) | 12h | P1 | W18 |
| Polish + hostile review + release | 10h | P0 | W19 |
| Tech debt + tests | 5h | P2 | W15 Day 0 |
| Dependabot cleanup | 2h | P2 | W15 Day 0 |

**Cut from v0.5.0** (deferred):
- Professor Dashboard → v0.7.0 "Community" (needs multi-user backend)
- Aggregate confusion analytics → v0.7.0 (needs multi-user)
- Real Whisper transcription → stub in v0.5.0, local in v0.8.0 "Desktop Full"
- OpenAI API notes support → v0.7.0 (no browser CORS; Claude-only for v0.5.0)

**v0.6.0 "Vision" scope** (OCR + thin Electron shell):
- Tesseract.js OCR on captured photos (P0, 12h)
- OCR text search integration (P0, 4h)
- Auto-Notes v2: multi-source transcript+slides (P0, 6h)
- Claude Vision for handwriting/diagrams (P1, 6h)
- Manual notes import (P1, 4h)
- Photo-segment correlation (P1, 4h)
- **Thin Electron wrapper**: exe/dmg/AppImage, loads existing web app (~10h)
- See: `docs/planning/ROADMAP_V060.md`

**v0.7.0 "Community" scope** (multi-user backend):
- Multi-user backend (auth, JWT, user accounts) (~20h)
- Professor Dashboard (class-wide confusion heatmap) (~12h)
- Aggregate confusion analytics (anonymous) (~8h)
- OpenAI API server-side proxy (~6h)
- Polish + hostile review + release (~10h)

**v0.8.0 "Desktop Full" scope** (native desktop features):
- SQLite migration (better-sqlite3, replace IndexedDB) (~12h)
- Native file storage (recordings on disk) (~4h)
- Local Whisper integration (whisper.cpp, real transcription) (~16h)
- Auto-updater + code signing (~6h)
- Cross-platform testing (Windows/macOS/Linux) (~8h)
- See: `docs/ROADMAP.md` for full breakdown

**Architecture decisions**:
- `recorder.js` at L2 (parallel to analytics.js) — preserves AD-1
- `notes-engine.js` at L2 (parallel to recorder.js) — TextRank/TF-IDF extractive
- `llm-client.js` pure utility — Claude API direct from browser (user key)
- Audio: Web Speech API (live text, Android Chrome) + MediaRecorder (always)
- Photos: `<input type="file" accept="image/*">` + canvas resize to 1920px + 80% JPEG
- Stub transcription service → real Whisper in v1.0.0
- 4 new IDB stores: recordingSessions, audioData, photoCaptures, autoNotes (confusionVotes pre-exists in v1, all in v1→v2 migration)
- Privacy: info-toast at first recording, Web Speech API toggle (default OFF)
- Photo gallery: "Photos" tab in lecture detail, thumbnail grid with timestamps
- Post-recording flow: stop → transcribe stub → create Lecture + Segments → navigate to detail

**Key docs**:
- Architecture: `docs/architecture/ARCHITECTURE_v050.md`
- Plan: `docs/planning/ROADMAP_V050.md` + WEEK15/16/17/18/19 plans
- v0.6.0 Plan: `docs/planning/ROADMAP_V060.md` (OCR + Vision, DRAFT)
- Gamification Design: `docs/planning/GAMIFICATION_DESIGN.md` (XP/levels/badges/streaks, DRAFT)
- Research: `docs/research/TECHNICAL_VALIDATION.md`
- Competitors: `docs/research/COMPETITORS.md`
- Reviews: `docs/reviews/REVIEW_v050_plan.md` (34/100 → revised)
- Expanded review: `docs/reviews/REVIEW_v050_expanded.md` (62/100 CAUTION)

---

## Mission

Build an event-aware lecture summarizer using VL-JEPA that provides students with real-time, context-aware summaries and retrieval of lecture segments.

**Users**: Students, teaching staff, and professionals (conferences/fairs)
**Deployment**: Local-first (laptop CPU/GPU), GitHub Pages for playground, mobile browser for live capture

---

## Build Commands

```bash
# Python backend
pip install -e ".[dev]"
pytest tests/ -v
ruff check src/ && ruff format src/
mypy src/ --strict

# Frontend tests (Student Playground)
cd src/vl_jepa/api/static
node --experimental-vm-modules node_modules/jest/bin/jest.js

# Local dev server
python -c "
import http.server, os
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        base = os.path.join(os.getcwd(), 'src', 'vl_jepa', 'api', 'static')
        if path.startswith('/static/'): return os.path.join(base, path[8:])
        return os.path.join(base, path.lstrip('/'))
    def log_message(self, *a): pass
http.server.HTTPServer(('127.0.0.1', 8903), H).serve_forever()
"
# Then open: http://127.0.0.1:8903/static/index.html#/playground
```

---

## Code Style

- Python 3.10+, type hints required on all functions
- **TDD**: Write tests before implementation
- Formatting: `ruff format`
- Linting: `ruff check` (no warnings)
- Coverage target: >90%
- Frontend: ES modules, safe DOM (createElement + textContent, zero innerHTML)

---

## Architecture

### Dependency Chain (AD-1 — NEVER reverse)
```
v0.4.0: dom-utils.js ← flashcards.js ← analytics.js ← library.js

v0.5.0: dom-utils.js ← flashcards.js ← analytics.js  ← library.js
                                      ← recorder.js
                         L0               L1               L2            L3
```
- `recorder.js` at L2, parallel to analytics.js (imports flashcards.js for router, never library/analytics)

### Key Files
| File | Lines | Tests | Role |
|------|-------|-------|------|
| `app.js` | ~3200 | 0 | Legacy main app (classic script, NOT module) |
| `dom-utils.js` | ~280 | shared | Safe DOM utils, skeletons, formatting |
| `flashcards.js` | ~1545 | 137 | Router, SM-2 flashcards, study sessions, view cleanup registry |
| `library.js` | ~2570 | 147 | Library grid, courses, search, detail view, playlist nav, photo gallery, confusion voting UI, confusion heatmap + tab |
| `analytics.js` | ~1250 | 22 | Study analytics, charts, dashboard, getCSSVar helper |
| `recorder.js` | ~610 | 32 | **v0.5.0** — Live capture: MediaRecorder, Web Speech API, photo capture, transcript stub, post-recording flow |
| `recorder.css` | ~210 | — | Recording UI styles, photo gallery, save button |
| `sw.js` | ~100 | 0 | Service Worker (cache-first static) |
| `sw-utils.js` | ~80 | 10 | Testable SW registration helpers |
| `storage/` | ~8250 | 332 | IndexedDB repos, models, migrations, sync |

### Key Patterns
- **registerViewCleanup(viewName, fn)**: flashcards.js registry for downstream modules to register cleanup callbacks per view (prevents memory leaks)
- **setLibraryRenderer(fn)**: Callback pattern for library.js to register its enhanced renderer without circular imports
- **setRecordRenderer(fn)**: v0.5.0 — recorder.js registers its renderer with flashcards.js router
- **getCSSVar(name, fallback)**: analytics.js helper to read CSS custom properties for chart colors

### Router (flashcards.js)
- `#/playground` → Library view
- `#/lecture/:id` → Lecture detail (tabs: segments, flashcards, bookmarks, photos, confusion, info, analytics)
- `#/study/:id` → Flashcard study session
- `#/dashboard` → Aggregate analytics dashboard
- `#/record` → **v0.5.0** — Live capture (audio + photos)

### HTML Sections Required
Each route needs a matching `<section id="*-view">` in index.html:
- `playground-view`, `study-view`, `lecture-detail-view`, `dashboard-view`
- `record-view` — **v0.5.0**

---

## Anti-Patterns (Learned)

- Don't skip TDD — write failing tests first
- Don't use `unwrap()` equivalents — handle errors explicitly
- Don't over-engineer — simplest solution that works
- Don't commit without tests passing
- Don't use regex-escaped strings with `.includes()` — escape is for `new RegExp()` only
- Don't export functions with zero callers and zero tests — dead API surface is a liability
- Don't forget `tabindex` roving on ARIA `role="tab"` elements (`0` for active, `-1` for inactive)
- Don't create clickable `div` elements without `role`, `tabindex`, and keyboard handlers
- In jsdom tests: `element.focus()` only works if the element is in `document.body`
- In ESM tests: `jest` global is undefined — use `import { jest } from '@jest/globals'`
- Run hostile-reviewer agents in background to avoid session timeout crashes
- Don't use `Math.random()` for IDs — use `crypto.randomUUID()`
- Any read-modify-write on shared IndexedDB keys needs a per-key mutex
- SW must check `url.origin === self.location.origin` and restrict cache to known assets
- Always add new HTML sections when adding new routes — router silently fails without them
- Don't re-render sidebar in click handler AND in the async function it calls — causes cascade
- SW caches stale JS during dev — close browser or unregister SW when testing changes
- Check both analytics.css AND playground-components.css before adding duplicate styles
- jsdom `style.cssText` adds spaces — use `el.style.pointerEvents` not `cssText.includes('pointer-events:none')`
- `renderLibraryView` fallback in router is NOT dead code — tests rely on it without library.js loaded
- Dependabot PR conflicts: merge sequentially, resolve lockfile conflicts locally before `gh pr merge`
- Architecture spec (`ARCHITECTURE_v050.md`) is the source of truth for data models — code must match spec, not the other way around
- Key-sharing pattern for 1:1 IDB relationships: child.id = parent.id (no separate FK + index needed)
- Cascade delete must cover ALL related stores — when adding new stores, update `deleteWithCascade` immediately
- Always set `updatedAt: Date.now()` in repository update() methods — easy to forget, hard to debug later
- DB migration: new stores are created by IDB `onupgradeneeded` — no manual migration code needed for additive schema changes
- Mutex Map cleanup: Promise-based mutex Maps (`_toggleLocks`) must clean up entries via `finally()` with identity check, otherwise unbounded memory growth
- Async event handlers (click/keydown calling async functions) need try/catch — unhandled rejections in event listeners are silent and leave UI in inconsistent state
- Batch-fetch pattern: `getByLecture()` + `Map` grouping is better than N individual `getBySegment()` calls when rendering lists
- Confusion voting: `ConfusionVoteRepository.toggle()` uses Promise chaining (not async/await lock) for per-key mutex — chains via `.then()` off previous promise for same key
- File size limits must be aligned across ALL layers (HTML text, frontend JS config, backend API default, processing pipeline) — mismatch destroys credibility when users hit a limit the UI said was fine
- Cross-module XP emission: use callback registration pattern (`setXPCallback`/`emitXP` in L1) so L2+ modules emit events without importing the handler — same proven pattern as `setLibraryRenderer`/`setRecordRenderer`
- Adding a tab to `renderDetailTabs` requires updating tab count assertions in ALL test files (analytics.test.js had hardcoded `toBe(6)`)
- Exported functions must be defensively coded — `renderConfusionStats([])` crashed because `data[0]` is undefined in `.reduce()` initial value; always guard public API with early return
- Use design system tokens (`--color-confusion-low/medium/critical` from `tokens-v2.css`) not generic names (`--success/--warning/--error`) — ensures dark mode overrides apply and visual consistency with existing components
- Every new CSS component needs `.dark` overrides if the file already has them — check existing `.dark` selectors count before committing
- Every new CSS `transition` must be added to `@media (prefers-reduced-motion: reduce)` block
- Promise-based UI banners (privacy, consent) need reject callback in module state + rejected in view cleanup — otherwise dangling async context leaks on navigation
- Guard against double-render overwriting reject handles: reject existing pending Promise before creating new one in `_showPrivacyBanner`-style patterns
- Threshold comparisons: use `>=` not `>` for boundary values (90% should be critical, not medium) — off-by-one at exact threshold
- Module-level Sets/Maps used for dedup (like `_shownWarnings`) must be `.clear()`-ed in view cleanup — otherwise stale state persists across navigations
- `DataTransfer` not available in jsdom — use `Object.defineProperty` to mock `input.files` in tests
- Run hostile-reviewer AND code-reviewer in parallel for broader coverage — different agents catch different issues
- Cascade delete for recording sessions must check `oldest.lectureId` and call `deleteWithCascade` — orphaned Lectures are invisible storage waste

---

## Review Workflow

When I request a review with subagent:
1. Write findings directly to `docs/reviews/REVIEW_[type].md`
2. Include confidence scores (0-100) for each issue
3. I will read the file and decide GO/NO_GO

**Format:**
```markdown
## Summary
- Issues: X critical, Y major, Z minor
- Recommendation: READY / CAUTION / BLOCK

## Critical Issues (80%+ confidence)
### 1. [Title]
**Location:** `file.py:42`
**Issue:** [Description]
**Suggested Fix:** [How to fix]
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Python 3.10+ |
| ML Framework | PyTorch |
| Video | OpenCV, decord |
| Embeddings | DINOv2 ViT-L/16 |
| Text Encoder | all-MiniLM-L6 |
| Search | FAISS |
| Frontend | Vanilla JS (ES modules), IndexedDB |
| Frontend Tests | Jest + jsdom + fake-indexeddb |
| Linting | ruff, mypy |
| Deployment | GitHub Pages (playground), Render (API) |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Frame embedding | <50ms (GPU), <200ms (CPU) |
| Event detection | <10ms |
| Query latency | <100ms (100k embeddings) |
| Memory | <4GB for 2hr lecture |

---

## Natural Language Patterns

Just describe what you want. No commands needed.

**Planning:**
- "Plan version X.Y.Z" → Updates ROADMAP.md
- "What should I work on next?" → Reads ROADMAP.md

**Implementation:**
- "Implement [feature]" → Explore → Plan → TDD → Implement
- "Fix [bug]" → Diagnose → Fix → Test

**Review:**
- "Review this change" → Single-pass review
- "Deep security review, use subagent, write to REVIEW_security.md"

**Status:**
- "Where are we?" → Shows progress from ROADMAP.md

---

## Links

- **V-JEPA Paper**: https://arxiv.org/abs/2312.15213
- **V-JEPA Code**: https://github.com/facebookresearch/jepa
- **Project Brief**: `./project_brief.md`
- **Roadmap**: `docs/ROADMAP.md`
- **v0.5.0 Plan**: `docs/planning/ROADMAP_V050.md`
- **v0.6.0 Plan**: `docs/planning/ROADMAP_V060.md`
- **Slides/Notes Gap Review**: `docs/reviews/REVIEW_slides_notes_gap.md`
- **v0.5.0 Architecture**: `docs/architecture/ARCHITECTURE_v050.md`
- **v0.5.0 Research**: `docs/research/TECHNICAL_VALIDATION.md`
- **Changelog**: `CHANGELOG.md`
- **User Guide**: `docs/guide/student-playground.md`
- **Playground**: https://matte1782.github.io/lecture-mind/playground/
- **Final Gate Review**: `docs/reviews/REVIEW_v040_final_gate.md`
- **Security Review**: `docs/reviews/REVIEW_v040_security.md`
- **v0.5.0 Plan Review**: `docs/reviews/REVIEW_v050_expanded.md`

---

*FORTRESS 4.1.1 — Simplest solution that works. AI prepares, Human decides.*
