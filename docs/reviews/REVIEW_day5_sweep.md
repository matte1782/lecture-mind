# HOSTILE_REVIEWER: Week 15 Day 5 — SP4-lite Confusion Voting

## Review Intake

- **Artifact:** Week 15 Day 5 changes (toggle(), confusion button UI, tests, CSS)
- **Type:** Code
- **Author:** Human + AI
- **Date:** 2026-03-08
- **Files reviewed:**
  - `src/vl_jepa/api/static/storage/repositories.js` (lines 919-945)
  - `src/vl_jepa/api/static/storage/repositories.test.js` (lines 749-785)
  - `src/vl_jepa/api/static/library.js` (lines 1721-1800)
  - `src/vl_jepa/api/static/library.test.js` (lines 1181-1297)
  - `src/vl_jepa/api/static/playground-components.css` (lines 828-849)

---

## Findings

### Critical (BLOCKING)

None.

### Major (MUST FIX)

**[M1] `_toggleLocks` Map entries never cleaned up — unbounded memory growth (85% confidence)**
- **Location:** `repositories.js:920,943`
- **Issue:** `_toggleLocks` entries are set on every `toggle()` call but never deleted. Over a long session with many segments, this Map grows without bound.
- **Status:** FIXED — added `finally()` cleanup that deletes key when no longer active.

**[M2] `handleToggle` has zero error handling — unhandled rejection on IDB failure (90% confidence)**
- **Location:** `library.js:1771-1783`
- **Issue:** `handleToggle` is an async function called from click/keydown handlers. If IDB throws, the rejection is unhandled and button UI may be inconsistent.
- **Status:** FIXED — wrapped in try/catch with console.warn.

### Minor (SHOULD FIX)

**[m1] Redundant `countBySegment` call in both branches of `handleToggle` (75% confidence)**
- Deferred to W19. Minor perf hit, no correctness issue.

**[m2] No `aria-label` on the confusion button (70% confidence)**
- textContent provides adequate accessible name per WCAG. Minor improvement deferred.

**[m3] `_toggleLocks` is a mutable property on object literal (60% confidence)**
- Style concern, no bug. Deferred.

---

## VERDICT

```
+---------------------------------------------------+
|   HOSTILE_REVIEWER: APPROVE                       |
|                                                   |
|   Score: 87/100 → 91/100 (after M1+M2 fix)       |
|                                                   |
|   Critical Issues: 0                              |
|   Major Issues: 2 (both FIXED)                    |
|   Minor Issues: 3 (deferred to W19)              |
|                                                   |
|   Disposition: GO                                 |
+---------------------------------------------------+
```

### Deferred to W19 Polish
- Day 5 m1: Redundant countBySegment call in handleToggle
- Day 5 m2: aria-label on confusion button
- Day 5 m3: _toggleLocks as module-level const instead of object property
