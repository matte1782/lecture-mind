# Week 12 Rev 2 Plan Re-Review -- Days 0-3

**Reviewer:** HOSTILE_REVIEWER
**Date:** 2026-02-27
**Artifact:** docs/PLAN_week12_revised.md (Architectural Decisions + Days 0-3, Rev 2 Addendum)
**Previous Scores:** 38/100 (BLOCKED) -> 72/100 (NEEDS_REVISION)

---

## Rev 1 Issue Resolution Verification

### CRITICAL Issues

#### [N-C1] Dedup now uses SettingsRepository (not Lecture metadata)
**Status: RESOLVED**
**Confidence: 95%**

The rev 1 review identified that the Lecture model (`models.js:117-126`) has NO metadata field, making the `lecture.metadata.sourceJobId` dedup strategy broken. The rev 2 fix changes dedup to use `SettingsRepository.get("imported_jobs")` -- a key-value map of `{jobId: lectureId}`.

Verification against codebase:
- `SettingsRepository` exists at `repositories.js:193-235` with `.get(key, defaultValue)` and `.set(key, value)` methods. Confirmed.
- `SettingsRepository` is exported from `storage/index.js:74`. Confirmed.
- The plan at line 411-415 shows correct dedup logic. Confirmed.
- Consistent with AD-2 (favorites also use SettingsRepository). Good architectural consistency.
- No Lecture model modification needed. Correct.

**Verdict: Clean fix. No remaining concerns.**

#### [N-C2] showToast now uses 3-arg signature
**Status: RESOLVED**
**Confidence: 100%**

Verification against codebase:
- `showToast` at `flashcards.js:114` takes three arguments: `function showToast(variant, title, message)`. Confirmed.
- All existing call sites use the 3-arg form (lines 317, 663, 1092, 1097, 1142, 1144, 1324, 1422, 1438, 1441). Confirmed.
- The plan at line 446 now shows the correct 3-arg signature. Confirmed.
- `showToast` is exported at `flashcards.js:1530`. Confirmed.

**Verdict: Clean fix. Signature matches codebase.**

---

### MAJOR Issues

#### [N-M1] Day 0 time estimate increased
**Status: RESOLVED** | **Confidence: 90%**

Rev 2 adds "3-4h" to Day 0 header (line 94) with scope note. Reasonable for the listed changes.

**Verdict: Adequately addressed.**

#### [N-M2] deleteWithCascade documented as non-atomic
**Status: RESOLVED** | **Confidence: 85%**

Rev 2 documents at plan lines 468-471 that deleteWithCascade is NOT atomic. Verified: `repositories.js:420-462` performs sequential batch deletes across stores.

**Verdict: Risk documented and accepted. Adequate for scope.**

#### [N-M3] Course assignment via dialog (not nested submenu)
**Status: RESOLVED** | **Confidence: 90%**

Rev 2 changes "Assign to Course" from submenu to dialog with radio buttons (plan line 481-483). Correct architectural choice.

**Verdict: Good design change. Simplifies ARIA considerably.**

#### [N-M4] setLibraryRenderer fallback guard
**Status: RESOLVED** | **Confidence: 85%**

Rev 2 adds guard at plan lines 150-159 with fallback to existing `renderLibraryView()` (confirmed at flashcards.js:1499). Module load order documented.

**Verdict: Adequate guard with correct fallback.**

---

### MINOR Issues

#### [N-m1] package.json location clarified
**Status: RESOLVED** | **Confidence: 100%**

Rev 2 specifies `src/vl_jepa/api/static/package.json`. Confirmed via filesystem check.

**Verdict: Confirmed correct.**

#### [N-m2] extractSearchableText called during cache build
**Status: RESOLVED** | **Confidence: 90%**

Rev 2 adds explicit cache documentation at plan lines 556-563 specifying ONCE per segment during cache build, NOT per-search.

**Verdict: Adequately specified.**

#### [N-m3] lectureCount naming standardized
**Status: PARTIALLY RESOLVED** | **Confidence: 70%**

State at line 294 uses `courseLectureCount: {}`. Line 302 uses `lectureCount` as return property. Different contexts (state map vs per-item). Cosmetic.

**Verdict: Trivially incomplete but non-blocking.**

---

## Codebase Cross-Reference Summary

| Claim in Plan | Codebase Evidence | Status |
|---------------|-------------------|--------|
| showToast takes 3 args | `flashcards.js:114` | CONFIRMED |
| showToast is exported | `flashcards.js:1530` in export block | CONFIRMED |
| SettingsRepository has get/set | `repositories.js:200-213` | CONFIRMED |
| SettingsRepository exported | `index.js:74` | CONFIRMED |
| Lecture model has NO metadata | `models.js:117-126` | CONFIRMED |
| createLecture no metadata param | `models.js:260` | CONFIRMED |
| package.json exists at static/ | Filesystem check | CONFIRMED |
| setLibraryRenderer not yet | grep: 0 matches | CONFIRMED |
| renderLibraryView exists | `flashcards.js:1499` | CONFIRMED |
| Segment has metadata field | `models.js:135` | CONFIRMED |
| SegmentRepository no getAll() | `repositories.js:472-525` | CONFIRMED |
| FlashcardRepository no getAll() | Object literal | CONFIRMED |
| BookmarkRepository no getAll() | `repositories.js:764-802` | CONFIRMED |

**Note on getAll():** `BaseRepository` (class, line 97) has `getAll()` at line 155. However, the three repos above are **object literals** (not extending BaseRepository), so they do NOT inherit it. Day 0 addition is correctly scoped.

---

## NEW Issues Found in Rev 2

### Minor (SHOULD FIX)

#### [R2-m1] loadCourses return type inconsistency
**Location:** PLAN_week12_revised.md line 294 vs 302
**Confidence:** 50%

Line 294 defines `courseLectureCount: {}` as a Map in state. Line 302 says `Returns: Array<{course, lectureCount}>`. Different naming for state map vs per-item property. Cosmetic, non-blocking.

#### [R2-m2] Day 0 flashcards.js changes are extensive
**Location:** PLAN_week12_revised.md lines 104, 111-169
**Confidence:** 55%

Day 0 specifies 8 distinct changes to flashcards.js. While each is small, 8 modifications to a single 1532-line file is worth noting. Process concern, not a plan defect. Non-blocking.

---

## Structural Assessment

### Architectural Decisions (AD-1 through AD-6)

All 6 ADs are sound and verified against the codebase:

- **AD-1 (Module Boundary):** Callback pattern correct. Guard/fallback specified. Export block at `flashcards.js:1479` is correct.
- **AD-2 (Favorites via SettingsRepository):** API confirmed at `repositories.js:193-235`.
- **AD-3 (Segment metadata.text):** `metadata: Object` at `models.js:135`. `createSegment` accepts `metadata = {}` at `models.js:289`. No model change needed.
- **AD-4 (Repository getAll additions):** 3 repos confirmed lacking `getAll()`. Underlying `getAll` already imported at `repositories.js:9`.
- **AD-5 (IntersectionObserver mock):** Standard mock pattern. Adequate.
- **AD-6 (Jest config):** `package.json` confirmed to exist.

### Day 0 (Prerequisite Refactoring)

Well-scoped. Time estimate (3-4h) is realistic. dom-utils extraction targets confirmed-existing functions. New functions (`formatDuration`, `timeAgo`) correctly labeled as NEW.

### Day 1 (Course Organization)

Solid. N+1 resolved via single-pass reduce. CSS marked as ADD NEW. ARIA included. 18 tests cover major paths.

### Day 2 (Import Pipeline + Organization)

Both previous CRITICAL issues resolved. Dedup uses SettingsRepository. showToast correct. deleteWithCascade documented. Context menu flattened to dialog.

### Day 3 (Cross-Lecture Search)

Well-specified. Cache strategy documented. Safe DOM highlighting. ARIA tablist. 300ms debounce. Performance achievable.

---

## Rev 2 Addendum Verification

| ID | Claimed Fix | Verified | Notes |
|----|-------------|----------|-------|
| N-C1 | SettingsRepository dedup | YES | Lines 411-435. API confirmed at repositories.js:200-213 |
| N-C2 | showToast 3-arg | YES | Line 446. Matches flashcards.js:114 signature |
| N-M1 | Day 0 = 3-4h | YES | Line 94 |
| N-M2 | Non-atomic documented | YES | Lines 468-471 |
| N-M3 | Dialog not submenu | YES | Lines 481-483 |
| N-M4 | Fallback guard | YES | Lines 150-159 with load order comment |
| N-m1 | package.json path | YES | Lines 84, 109. File confirmed to exist |
| N-m2 | Cache build timing | YES | Lines 556-563 |
| N-m3 | Naming standardized | PARTIAL | State uses courseLectureCount, return uses lectureCount. Cosmetic. |

**8 of 9 issues fully resolved. 1 cosmetically incomplete but non-blocking.**

---

## Issue Summary

| Severity | Count | IDs |
|----------|-------|-----|
| CRITICAL | 0 | -- |
| MAJOR | 0 | -- |
| MINOR | 2 | R2-m1 (naming cosmetic), R2-m2 (Day 0 change density) |

---

## VERDICT

```
+---------------------------------------------------+
|   HOSTILE_REVIEWER: APPROVED                      |
|                                                   |
|   Critical Issues: 0                              |
|   Major Issues:    0                              |
|   Minor Issues:    2                              |
|                                                   |
|   Score: 91/100                                   |
|                                                   |
|   Progression: 38 -> 72 -> 91                     |
|                                                   |
|   Disposition: Proceed to implementation.         |
|   Both rev 1 CRITICAL issues cleanly resolved.    |
|   All MAJOR issues adequately addressed.          |
|   Remaining minors are cosmetic.                  |
+---------------------------------------------------+
```

### Scoring Breakdown

| Category | Score | Notes |
|----------|-------|-------|
| Completeness | 19/20 | All components defined. Minor naming inconsistency. |
| Codebase Accuracy | 20/20 | Every API reference verified against actual source. |
| Feasibility | 18/20 | Day 0 has 8 changes to flashcards.js; regression risk acknowledged. |
| Error Handling | 17/20 | deleteWithCascade non-atomic documented. Dedup handles missing data. |
| Test Coverage | 17/20 | 52 tests across Days 0-3. Good edge case coverage. |

**Total: 91/100 -- APPROVED**

### Recommendations (non-blocking)

1. **[R2-m1]** Consider standardizing the return property name in `loadCourses` or clarify that `lectureCount` is the per-item property while `courseLectureCount` is the state map.
2. **[R2-m2]** When implementing Day 0, run the flashcard test suite after each flashcards.js change rather than once at the end, to isolate regressions early.

---

*HOSTILE_REVIEWER -- Trust nothing. Verify everything.*
