# Week 12 REVISED Plan Re-Review -- Days 4-6

**Reviewer:** HOSTILE_REVIEWER
**Date:** 2026-02-27
**Artifact:** docs/PLAN_week12_revised.md (Architectural Decisions + Days 4-6)
**Previous Score:** 38/100 (BLOCKED)

---

## Original Issue Resolution Verification

### CRITICAL Issues

**C1 -- flashcards.js missing imports for ProgressRepository/BookmarkRepository**
**Status: RESOLVED**
The revised plan (Day 0, line 96) explicitly states: update imports to include ProgressRepository, BookmarkRepository. Verified that both are already exported from storage/index.js (lines 79, 81). The import will work.

**C2 -- Route #/lecture/:id needs 5 changes**
**Status: RESOLVED**
Day 0 specifies all 5 changes with code snippets: (1) VIEWS.LECTURE_DETAIL constant, (2) parseHash() regex, (3) mountView() case, (4) section id=lecture-detail-view in index.html, (5) getViewSections() mapping. The regex correctly matches after parseHash strips #/. sanitizeId() is applied.

**C3 -- No DOM container for detail view in index.html**
**Status: RESOLVED**
Day 0 lines 157-168 specify the exact HTML section to add after study-view. Includes child containers for header, stats, tabs, content. getViewSections() mapping updated.

**C4 -- Favorites via BookmarkRepository lacks query capability**
**Status: RESOLVED**
AD-2 pivots favorites to SettingsRepository.set(favorite_lectures, [...]). Verified: SettingsRepository exists in repositories.js lines 193-234 with get/set methods. Already exported from storage/index.js line 74. Sound approach.

**C5 -- IntersectionObserver not in jsdom**
**Status: RESOLVED**
AD-5 specifies exact mock code for jest.setup.js with constructor, observe, unobserve, disconnect, _trigger. Current jest.setup.js only polyfills structuredClone. Clean addition.

**C6 -- Hookable renderLibraryView undefined**
**Status: RESOLVED**
AD-1 defines setLibraryRenderer(fn) callback pattern. Module-scoped _libraryRenderer with setter functions. PLAYGROUND case has fallback. library.js calls setLibraryRenderer during init. Avoids ES module immutability and circular dependency.

**X1 -- library.js import/export strategy undefined (circular dependency risk)**
**Status: RESOLVED**
AD-1 establishes: dom-utils.js is leaf; both flashcards.js and library.js import from it; library.js imports from flashcards.js (one-directional); flashcards.js does NOT import from library.js; callback registration for reverse communication. No circular dependency.

**X2 -- Day 4 depends on Day 1-3 with no fallback**
**Status: RESOLVED**
Dependency graph shows Day 4 depends on Day 0 + Day 1 only. All repository methods used by Day 4 exist in current codebase. Note: matrix text says Day 1+2 but graph says Day 0+1 -- minor inconsistency, not blocking.

---

### MAJOR Issues

**M1 -- updateLectureProgress conflates two operations** -- **RESOLVED** (Day 4 documents it as wrapper calling both repo methods separately)

**M2 -- getLectureStats missing imports** -- **PARTIALLY RESOLVED** (repository methods listed but Day 4 does not specify adding SegmentRepository, FlashcardRepository, BookmarkRepository, ProgressRepository to library.js imports -- see N3)

**M3 -- getPlaylistForLecture sort order undefined** -- **RESOLVED** (Day 5: createdAt ascending within course; uncategorized = all with courseId null)

**M4 -- toggleFavorite misuses bookmark timestamp** -- **RESOLVED** (AD-2: SettingsRepository, no BookmarkRepository)

**M5 -- No unfavorite mechanism** -- **RESOLVED** (Day 5: array add/remove via SettingsRepository)

**M6 -- renderLibraryView not a mutable export** -- **RESOLVED** (callback pattern, internal variable)

**M7 -- index.html no library.js script tag** -- **RESOLVED** (Day 0 line 99 adds script tags)

**M8 -- Empty state DOM containers missing** -- **RESOLVED** (Day 6: created dynamically via createElement)

**X3 -- ProgressRepository has no getByLecture()** -- **RESOLVED** (uses getOrCreate instead, verified at repositories.js line 599)

**X4 -- Test coverage config excludes library.js** -- **RESOLVED with caveat** (AD-6 specifies update but config file location incorrect -- see N1)

---

### MINOR Issues

**m1 -- timeAgo duplication** -- **RESOLVED** (note: timeAgo does not exist in flashcards.js -- must be written fresh in dom-utils.js)

**m2 -- Division by zero** -- **RESOLVED** (Day 4 line 653: guard for 0 segments)

**m3 -- Keyboard arrow conflict** -- **RESOLVED** (Day 5: skip if activeElement is input/textarea/select)

**m4 -- N+1 queries** -- **RESOLVED** (Day 6: batch-load courses with single getAll)

**m5 -- CSS budget undefined** -- **RESOLVED** (Line 1020: playground-components.css < 15KB)

**m6 -- / shortcut conflict** -- **RESOLVED** (Day 6: only when activeElement is not input)

**X5 -- formatDuration duplicated** -- **RESOLVED** (note: formatDuration does not exist in flashcards.js -- must be written fresh in dom-utils.js)

---

## New Issues Found

### CRITICAL

None.

### MAJOR

**[N1] package.json location mismatch -- Day 0 references nonexistent file (Confidence: 90%)**

Day 0 line 101 says: src/vl_jepa/api/static/package.json -- update collectCoverageFrom. This file does not exist in the repository. The project has NO package.json at the static directory level or the project root (verified via glob). Jest config and coverage config would typically live in a root-level package.json or a jest.config.js file. The plan needs to clarify WHERE the Jest configuration actually lives.

Evidence: Glob for package.json returned no results. jest.setup.js exists at src/vl_jepa/api/static/jest.setup.js, confirming Jest is configured somewhere -- but the configuration file itself is missing from the repo.

Impact: Without knowing the correct config file location, AD-6 (coverage config update) cannot be implemented as written.

**[N2] Lecture model lacks metadata field -- Day 2 dedup uses undocumented schema extension (Confidence: 85%)**

Day 2 line 415 says: LectureRepository.update(lecture.id, { metadata: { sourceJobId: jobId } }). The createLecture factory (models.js line 260-275) does NOT define a metadata property. The lecture model fields are: id, courseId, title, duration, status, watchProgress, createdAt, updatedAt. The update method uses spread { ...existing, ...updates }, so the metadata field will be silently added at runtime, but:
1. validateLecture (models.js lines 548-562) does not validate or expect metadata
2. The Lecture JSDoc typedef (models.js lines 117-126) does not document metadata
3. The field is not part of the formal schema

The dedup check works at runtime because IndexedDB is schema-flexible, but this is an undocumented schema extension. The plan should either (a) add metadata to the Lecture model factory, typedef, and validation, or (b) use a different dedup strategy (e.g., SettingsRepository for imported_jobs, mirroring the favorites pattern).

**[N3] Day 4 library.js imports not explicitly listed (Confidence: 80%)**

Day 4 getLectureStats (line 657-658) uses SegmentRepository, FlashcardRepository, BookmarkRepository, ProgressRepository. Day 1 library.js import block (line 272) only imports CourseRepository, LectureRepository, FLASHCARD_STATUS. The plan does not specify updating library.js imports for Day 4. The original review C1 was specifically about missing import declarations. The same class of omission recurs here in library.js. Fix: add one line to Day 4 specifying these four repository imports.

### MINOR

**[n1] dom-utils.js lists timeAgo and formatDuration as extractions but neither exists in flashcards.js (Confidence: 70%)**

AD-1 lines 21-23 list formatDuration and timeAgo as dom-utils.js exports, described as extracted from flashcards.js. Neither function exists in flashcards.js (verified via grep). They must be written from scratch. The plan should acknowledge these are NEW functions and provide the function signature and expected behavior.

**[n2] setLibraryRenderer/setLectureDetailRenderer export style ambiguity (Confidence: 75%)**

Day 0 lines 136-137 show: export function setLibraryRenderer(fn). Current flashcards.js uses a SINGLE named export block at lines 1479-1531. The plan introduces export function at the definition site, mixing two export styles in one file. Either approach works, but mixing styles is a consistency concern. The plan should specify the chosen approach.

**[n3] IntersectionObserver mock _trigger helper not referenced in test descriptions (Confidence: 65%)**

AD-5 mock includes _trigger(entries) as a test helper. Day 6 test line 935 implies triggering the observer but does not reference the mock helper explicitly. Low risk.

**[n4] Day 0 time estimate is optimistic -- 2h for 11 changes across 7 files (Confidence: 60%)**

Day 0 includes 11 changes across 7 files. Given that the dom-utils.js extraction alone must pass 91 existing tests for regression, 2h is optimistic. A more realistic estimate is 3-4h.

---

## Verdict

```
+---------------------------------------------------+
|   HOSTILE_REVIEWER: NEEDS_REVISION                |
|                                                   |
|   Original Critical Issues: 8/8 RESOLVED          |
|   Original Major Issues: 10/10 RESOLVED           |
|     (1 partially: M2 recurs as N3)                |
|   Original Minor Issues: 7/7 RESOLVED             |
|                                                   |
|   New Issues: 0 Critical, 3 Major, 4 Minor        |
|                                                   |
|   Score: 82/100                                   |
|                                                   |
|   Disposition: NEEDS_REVISION (82 < 85 threshold) |
|   All original CRITICAL/MAJOR issues are resolved.|
|   New issues N1-N3 should be addressed before     |
|   implementation but are not structural blockers.  |
|   The plan improved dramatically from 38 to 82.   |
|                                                   |
|   Required before coding:                         |
|   1. Clarify package.json location (N1)           |
|   2. Document lecture metadata extension (N2)     |
|   3. List Day 4 library.js imports (N3)           |
+---------------------------------------------------+
```

### Summary

The revised plan resolves all 8 original CRITICAL issues, all 10 original MAJOR issues (with one partially resolved -- M2 recurs as N3), and all 7 original MINOR issues. The architectural decisions (AD-1 through AD-6) are sound, well-evidenced, and correctly mapped to codebase realities. The setLibraryRenderer callback pattern is the correct solution for avoiding ES module export immutability. The SettingsRepository pivot for favorites is clean and avoids all BookmarkRepository misuse concerns.

Three new MAJOR issues were introduced, none of which are structural. N1 (package.json location) is a configuration oversight. N2 (lecture metadata) is a schema hygiene concern. N3 (missing import list) is an omission that repeats the pattern of the original C1 but at a lower severity since it only affects library.js (a new file, not an existing one).

The plan is ready for implementation after these three targeted fixes.

---

*HOSTILE_REVIEWER -- Trust nothing. Verify everything.*
