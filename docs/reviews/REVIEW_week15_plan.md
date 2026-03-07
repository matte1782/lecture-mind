# Week 15 Plan Review (Polish + Release)

**Reviewer:** HOSTILE_REVIEWER
**Date:** 2026-02-27
**Score: 52/100 — BLOCKED**

---

## Critical Issues (6)

### C1. Test count (18+10=28) exceeds ~30 budget, leaves 2 tests for Days 3-6
Day 1 claims 18 tests, Day 2 claims 10. That's 28/30. No budget for Day 5 fixes (TDD violation).

### C2. Service Worker caching references `/static/*` but no manifest or asset list exists
No cache versioning or busting mechanism. Week 12-14 files (`library.js`, `analytics.js`, `dashboard.js`, `dom-utils.js`) not enumerated.

### C3. `offline.js` references `.sp-sync-indicator` but no DOM container exists in index.html
Plan says "Modify: index.html" but doesn't specify WHERE the indicator goes.

### C4. Day 2 modifies `dashboard.js` and `dashboard-components.css` which don't exist yet (Week 14)
Zero fallback if Weeks 12-14 slip.

### C5. `sw.js` outside ES module system — no integration spec
`package.json` uses `"type": "module"`. Service workers can't use ES module imports in most browsers. How `offline.js` connects to `flashcards.js` initialization is unspecified.

### C6. Day 6 claims "~730+ tests, 0 failures" with no failure-handling protocol
No time budget for failures on the last day.

---

## Major Issues (8)

- M1: Animation names may collide with existing `animations-v2.css` keyframes
- M2: `getCacheStatus()` return shape underspecified, no consumer defined
- M3: "60fps" acceptance criteria — Jest/jsdom cannot verify frame rates
- M4: Hostile review scoring has no per-category minimums (0/30 security could still pass)
- M5: Documentation references features that may not exist if Weeks 12-14 incomplete
- M6: Service Worker scope not specified — potential conflict with backend API routes
- M7: Day 5 fix work has no time budget or scope limit
- M8: Release checklist lacks rollback procedure

---

## Minor Issues (7)

- m1: `sw.js` (~200 lines) has zero dedicated test file
- m2: `transitions.test.js` falls outside jest coverage config
- m3: 350 lines with 18 tests is low density
- m4: `docs/student-playground/` directory doesn't exist
- m5: `heatmapReveal` "left-to-right bar fill" likely uses `width` (layout-triggering) — need `scaleX`
- m6: Review filename inconsistent with existing pattern
- m7: Day 6 verification duplicates Day 3 hostile review

---

## Critical Unstated Dependency: Offline + DB Migration Interaction

Week 13 Day 1 upgrades DB_VERSION 1→2. Week 15 Day 1 adds cache-first SW. If cached SW serves old JS expecting DB_VERSION 1 while DB has migrated to 2 — data corruption risk. Completely unspecified.

---

## Verdict

HOSTILE_REVIEWER: **BLOCKED** — Score 52/100

Required revisions:
1. SW cache versioning + DB migration interplay
2. Test budget redistribution
3. SW scope and ES module integration strategy
4. Contingency for incomplete Weeks 12-14
5. Per-category minimums on hostile review gate
6. Offline indicator DOM placement specification

---

*HOSTILE_REVIEWER — Trust nothing. Verify everything.*
