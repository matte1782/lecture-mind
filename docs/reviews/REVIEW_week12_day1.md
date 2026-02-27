# HOSTILE_REVIEWER: Week 12 Day 1 -- Library Module

**Artifact:** library.js, library.test.js, index.html changes, playground-components.css additions, flashcards.test.js fix
**Type:** Code
**Author:** Implementation agent
**Date:** 2026-02-27
**Plan Reference:** docs/PLAN_week12_revised.md lines 210-382

---

## Summary
- Issues: 0 critical, 4 major, 5 minor
- Recommendation: CAUTION

---

## Critical Issues (80%+ confidence)

None found.

Verified clean on all critical vectors:
- **No innerHTML anywhere** in library.js (confirmed via grep -- only occurrence is in the JSDoc comment on line 10).
- **No circular dependency**: flashcards.js does NOT import library.js. library.js imports from flashcards.js (one-way). Confirmed via grep.
- **Imports resolve**: dom-utils.js exports createElement, clearElement, formatDuration. storage/index.js exports createCourse, CourseRepository, LectureRepository, SettingsRepository. flashcards.js exports setLibraryRenderer, setLectureDetailRenderer, navigateTo, createMasteryBadge, showToast, VIEWS. All verified.
- **All 18 planned tests implemented**: Count confirmed (18 test cases across 4 describe blocks matching the plan exactly).
- **Script tag present** in index.html at line 1022.

---

## Major Issues

### M1. deleteCourseWithConfirmation has no actual confirmation UI
**Location:** library.js:367-380
**Confidence:** 90%
**Issue:** The function name says WithConfirmation but takes a mode parameter directly. The plan specifies two options in confirmation dialog and window.confirm fallback. The implementation delegates the choice to the caller with zero confirmation prompt. This is a naming lie and a deviation from the plan.
**Suggested Fix:** Either (a) rename to deleteCourse(courseId, mode), or (b) add a confirmation dialog/window.confirm inside the function as the plan specifies.

### M2. Orphan mode uses sequential awaits (N+1 pattern)
**Location:** library.js:373-376
**Confidence:** 85%
**Issue:** The orphan branch loops with for...of + await LectureRepository.update() sequentially. For 50 lectures this is 51 sequential async ops. While loadCourses correctly avoids N+1, this function reintroduces it.
**Suggested Fix:** Use Promise.all(lectures.map(...)) for parallel updates.

### M3. editCourseDialog color swatch broken for non-preset colors
**Location:** library.js:310-333
**Confidence:** 80%
**Issue:** Lines 327-331 match against PRESET_COLORS by strict equality. If a course has a non-preset color, no swatch is active. The user sees no visual selection.
**Suggested Fix:** Constrain colors to presets, or add custom color indicator.

### M4. Missing CSS rule for aria-current styling
**Location:** playground-components.css (missing)
**Confidence:** 85%
**Issue:** Plan line 257 specifies .sp-library-sidebar__item[aria-current=true] rule. Absent from CSS. Styling works via --active class but plan called for [aria-current] rule.
**Suggested Fix:** Add the aria-current CSS rule per plan.
---

## Minor Issues

### m1. formatDuration is imported but never used
**Location:** library.js:19
**Confidence:** 95%
**Issue:** formatDuration is imported from dom-utils.js but never used in library.js. Dead import.
**Suggested Fix:** Remove the import or document it as reserved for later Days.

### m2. PRESET_COLORS duplicated across two functions
**Location:** library.js:106-108 and library.js:229-231
**Confidence:** 95%
**Issue:** Same 6-color array defined in both createCourseDialog and editCourseDialog. DRY violation.
**Suggested Fix:** Extract to module-level constant.

### m3. Plan specifies additional dom-utils imports that are absent
**Location:** library.js:16-20 vs plan line 285
**Confidence:** 75%
**Issue:** Plan includes showElement, hideElement, sanitizeId, registerListener. Implementation omits them. Fine for Day 1 but deviates from plan.
**Suggested Fix:** No action needed now, but note the deviation.

### m4. FLASHCARD_STATUS missing from storage import
**Location:** library.js:22-27 vs plan line 286
**Confidence:** 70%
**Issue:** Plan imports FLASHCARD_STATUS. Implementation does not. Not currently used.
**Suggested Fix:** No action needed unless later Days depend on it.

### m5. No test for sortLectures with progress sort mode
**Location:** library.test.js -- Sorting describe block
**Confidence:** 90%
**Issue:** sortLectures supports 3 modes but only 2 are tested (recent, title). Progress path at library.js:541 is untested.
**Suggested Fix:** Add a progress sort test.

---

## Verification Checklist

| Acceptance Criterion | Status |
|---|---|
| 1. Sidebar renders All/Favorites/Uncategorized/Courses | PASS |
| 2. Clicking course filters library grid | PARTIAL -- updates state only |
| 3. Sort dropdown changes lecture order | PASS |
| 4. Course CRUD via modals with validation | PASS |
| 5. All new CSS classes added | PASS (except M4) |
| 6. All new HTML containers in index.html | PASS |
| 7. No innerHTML -- safe DOM only | PASS |
| 8. aria-current on selected sidebar item | PASS in JS, missing CSS rule (M4) |
| 9. Responsive sidebar collapse | PASS |
| 10. Forced-colors support | PASS |

## Architecture Decisions Verified

| Decision | Status |
|---|---|
| AD-1: setLibraryRenderer callback | PASS -- line 598 registers, flashcards.js line 90 accepts |
| sortLectures returns new array | PASS -- [...lectures] spread at line 532 |
| No N+1 in loadCourses | PASS -- single reduce at line 82 |
| Course CRUD uses repository methods | PASS |
| Delete supports orphan and cascade | PASS (functional), ISSUE (no UI -- M1) |

---

## VERDICT

```
+-------------------------------------------------+
|   HOSTILE_REVIEWER: NEEDS_REVISION              |
|                                                 |
|   Critical Issues: 0                            |
|   Major Issues: 4                               |
|   Minor Issues: 5                               |
|                                                 |
|   Score: 72/100                                 |
|                                                 |
|   Disposition: Fix M1 (rename or add confirm),  |
|   M2 (N+1 in orphan delete), and M4 (missing    |
|   CSS rule). M3 can be deferred if courses are  |
|   constrained to presets. Then re-review.        |
+-------------------------------------------------+
```

**Blocking for merge:** M1 (misleading function contract) and M2 (N+1 sequential awaits in delete path). M3 and M4 are strongly recommended but not blocking if documented as known issues.

---

*HOSTILE_REVIEWER -- Trust nothing. Verify everything.*