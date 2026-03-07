# Week 12 Plan Review -- Days 4-6

**Reviewer:** HOSTILE_REVIEWER
**Date:** 2026-02-27
**Artifact:** docs/PLAN_weeks12-15.md, Week 12 Days 4-6
**Type:** Plan Review (pre-implementation verification)

---

## Day 4: Progress Persistence + Lecture Detail View (16 tests)

### Feasible: PARTIAL

### Issues Found:

- **[CRITICAL] C1 -- flashcards.js imports do not include ProgressRepository or BookmarkRepository.**
  flashcards.js (line 14-20) currently imports ONLY FlashcardRepository, LectureRepository, SegmentRepository, FLASHCARD_STATUS, and createFlashcard from ./storage/index.js. It does NOT import ProgressRepository or BookmarkRepository. The plan says Day 4 modifies flashcards.js to add the #/lecture/:id route, which will call ProgressRepository.updatePosition() and ProgressRepository.markSegmentCompleted(). The plan fails to mention that flashcards.js imports must be extended.
  **Verified:** ProgressRepository.updatePosition(lectureId, position, userId) EXISTS at repositories.js:626. Method signature matches plan intent.
  **Verified:** ProgressRepository.markSegmentCompleted(lectureId, segmentId, userId) EXISTS at repositories.js:640. Method signature matches plan intent.
  **Action:** Plan must explicitly list the new imports needed in flashcards.js.

- **[CRITICAL] C2 -- Route #/lecture/:lectureId conflicts with existing router architecture.**
  The current parseHash() function in flashcards.js (line 162-183) uses hardcoded pattern matching. The VIEWS object (line 156-160) only contains LANDING, PLAYGROUND, and STUDY. There is NO VIEWS.LECTURE constant defined. Adding #/lecture/:id requires: (1) Adding VIEWS.LECTURE constant, (2) Adding regex match in parseHash(), (3) Adding case in mountView(), (4) Creating DOM section in index.html, (5) Adding unmount logic. The plan says just "add route" but does not specify any of these five required changes.

- **[CRITICAL] C3 -- No DOM container for the lecture detail view exists in index.html.**
  index.html has three view sections: playground-view (line 918), study-view (line 941), and app-section. There is NO lecture-view or detail-view section. The plan lists index.html under Modify but does not specify that a NEW section element must be added. The getViewSections() function (line 224-230) maps view names to DOM IDs and would need updating.

- **[MAJOR] M1 -- updateLectureProgress(lectureId, segmentId, position) conflates two operations.**
  In the actual codebase these are two separate methods: ProgressRepository.updatePosition(lectureId, position) for lastPosition, and ProgressRepository.markSegmentCompleted(lectureId, segmentId) for completedSegments[]. Plan should clarify if this is a wrapper calling both.

- **[MAJOR] M2 -- getLectureStats(lectureId) depends on repositories not imported.**
  Needs SegmentRepository.getByLecture(), FlashcardRepository.getByLecture(), BookmarkRepository.getByLecture(), ProgressRepository.getOrCreate(). Plan places this in library.js but does not specify its imports.

- **[MINOR] m1 -- timeAgo() should be in a shared module.** Both library.js and flashcards.js could use it. Duplication risk.

- **[MINOR] m2 -- Division by zero in progress ring.** Plan notes this risk but acceptance criteria should explicitly require 0% display for 0-segment lectures.

### Missing from plan:
- Explicit list of new imports for flashcards.js
- New VIEWS.LECTURE constant definition
- New section id in index.html for detail view
- Updated getViewSections() mapping
- New case in mountView() switch statement
- Unmount cleanup logic for detail view
---

## Day 5: Playlist Navigation + Favorites (14 tests)

### Feasible: PARTIAL

### Issues Found:

- **[CRITICAL] C4 -- Favorites pattern via BookmarkRepository lacks query capability.**
  BookmarkRepository has NO getAll() method (only create, getById, delete, getByLecture at repositories.js:764-803). getFavoriteLectures() needs to scan ALL bookmarks across ALL lectures. The bookmarks store has only lectureId and timestamp indexes (db.js:69-72) -- NO label index. Full table scan required, bypassing repository pattern. Plan must specify: add getAll() to BookmarkRepository, or add label index, or use SettingsRepository instead.

- **[MAJOR] M3 -- getPlaylistForLecture(lectureId) has undefined sort order.**
  Plan does not specify: sort key (createdAt? title?), scope (course or global?), or behavior for uncategorized lectures. All ordering would be in-memory sort since LectureRepository has no ordering index.

- **[MAJOR] M4 -- toggleFavorite(lectureId) misuses bookmark timestamp field.**
  createBookmark() factory (models.js:424) REQUIRES a timestamp field (video position). Favorites have no meaningful video position. Using timestamp: 0 conflates meaning. Plan should decide: sentinel value, separate store, or SettingsRepository approach.

- **[MAJOR] M5 -- No unfavorite mechanism specified.**
  BookmarkRepository.delete(id) requires UUID, not lectureId. Unfavoriting requires: getByLecture then filter by label then delete by id. This multi-step process is not acknowledged.

- **[MINOR] m3 -- Keyboard Arrow conflict mentioned but not resolved.** Needs activeElement check before intercepting arrows.

### Missing from plan:
- How to query all favorites across lectures
- Whether to add label index to bookmarks store
- Playlist sort order and scope definition
- What timestamp value to use for favorite bookmarks
- Unfavorite deletion flow
- Alternative: SettingsRepository for favorites
---

## Day 6: Integration + Performance (12 tests)

### Feasible: PARTIAL

### Issues Found:

- **[CRITICAL] C5 -- IntersectionObserver is NOT available in jsdom.**
  Plan uses IntersectionObserver for lazy loading. Test environment is jest-environment-jsdom (verified in package.json). jsdom does NOT implement IntersectionObserver. Existing uses in app.js (lines 259, 562, 639) are browser-only, not tested in Jest. jest.setup.js only polyfills structuredClone. Tests will throw ReferenceError. Plan must add mock to jest.setup.js or specify per-test mocking.

- **[CRITICAL] C6 -- enhancedRenderLibraryView() replacement mechanism is undefined.**
  renderLibraryView() is called directly in mountView() at line 264. Day 1 says "hookable renderLibraryView" but never specifies the hook pattern. Day 6 says "wire enhancedRenderLibraryView" but the mechanism is ambiguous.

- **[MAJOR] M6 -- renderLibraryView is NOT exported as a mutable binding.**
  Exported as named export at flashcards.js:1499. ES module named exports cannot be reassigned from outside. Hookable pattern needs registered callback, not direct replacement.

- **[MAJOR] M7 -- index.html does not include library.js as a script.**
  No script tag for library.js. Plan says it is the main file but never specifies adding it to index.html.

- **[MAJOR] M8 -- Empty state DOM containers do not exist.**
  Plan mentions empty states for course/search/favorites but index.html only has div id="library-empty". No containers for course-empty, search-empty, favorites-empty.

- **[MINOR] m4 -- N+1 queries not mitigated.** renderEnhancedLibraryCard fetches course per-card. Should batch-load courses.

- **[MINOR] m5 -- CSS budget not defined.** Unverifiable criterion.

- **[MINOR] m6 -- initLibraryKeyboardShortcuts() conflicts with existing search bar.** Both may respond to "/" keypress.

### Missing from plan:
- IntersectionObserver mock strategy for jsdom tests
- Hook mechanism design for renderLibraryView replacement
- script tag for library.js in index.html
- DOM container IDs for new empty states
- Course batch-loading strategy
- CSS budget number
---

## Cross-Day Issues

- **[CRITICAL] X1 -- library.js import/export strategy never defined.**
  Plan never specifies: Does library.js import from flashcards.js? (circular dependency risk) Does flashcards.js import from library.js? (load order) Is there a shared utility module? Currently flashcards.js defines createElement (line 75), clearElement (line 90), registerListener (line 39) internally. library.js either duplicates them (DRY violation) or imports them (tight coupling).

- **[CRITICAL] X2 -- Day 4 depends on Day 1-3 outputs but has no fallback.**
  Dependency graph shows Day 4 depends on Day 1 only, but acceptance criteria require data from Day 2 import system.

- **[MAJOR] X3 -- ProgressRepository has no getByLecture() method.**
  Has getOrCreate(lectureId, userId) instead. Queries by index and filters by userId. Correct for single-user but plan should acknowledge constraint.

- **[MAJOR] X4 -- Test file organization unclear.**
  Jest collectCoverageFrom only covers **/storage/**/*.js. If library.js lives alongside flashcards.js, coverage reports exclude it. package.json needs updating.

- **[MINOR] X5 -- formatDuration(seconds) duplicated between Week 12 Day 1 and Week 13 Day 5.**

---

## Verdict

```
+---------------------------------------------------+
|   HOSTILE_REVIEWER: PLAN_NEEDS_REVISION            |
|                                                    |
|   Critical Issues: 6 (C1-C6) + 2 cross-day (X1-X2)|
|   Major Issues: 8 (M1-M8) + 2 cross-day (X3-X4)  |
|   Minor Issues: 6 (m1-m6) + 1 cross-day (X5)     |
|                                                    |
|   Score: 38/100                                    |
|                                                    |
|   Disposition: BLOCK -- Fix critical issues before |
|   coding begins. The router integration (C2-C3),   |
|   favorites query gap (C4), IntersectionObserver   |
|   jsdom incompatibility (C5), and library.js       |
|   module strategy (X1) will each cause             |
|   implementation failures if not addressed.        |
+---------------------------------------------------+
```

### Required Plan Revisions (must-do before coding):

1. **Specify the full router modification** for #/lecture/:id -- new VIEWS constant, parseHash regex, mountView case, new HTML section, getViewSections mapping, unmountView cleanup.

2. **Decide favorites storage strategy** -- either (a) add getAll() to BookmarkRepository + label index to db.js bookmarks store, or (b) use SettingsRepository to store a favorite_lectures list, or (c) create a dedicated favorites store. Document the choice.

3. **Add IntersectionObserver mock** to jest.setup.js or specify per-test mocking strategy.

4. **Define the hookable renderLibraryView pattern** in Day 1 so Day 6 replacement is not ambiguous. Recommend: module-level callback registration with setLibraryRenderer(fn).

5. **Specify library.js module integration** -- imports needed, script tag in index.html, shared utility strategy (extract createElement/registerListener to dom-utils.js or import from flashcards.js).

6. **Add flashcards.js import updates** to Day 4 task description (ProgressRepository, BookmarkRepository).

---

*HOSTILE_REVIEWER -- Trust nothing. Verify everything.*
