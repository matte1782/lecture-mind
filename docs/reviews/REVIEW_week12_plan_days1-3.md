# Week 12 Plan Review -- Days 1-3

**Reviewer:** HOSTILE_REVIEWER
**Date:** 2026-02-27
**Artifact:** `docs/PLAN_weeks12-15.md` (Week 12, Days 1-3)
**Verdict:** PLAN_NEEDS_REVISION
**Score: 38/100**

---

## Day 1: Course Organization + Library Shell (18 tests)

### Feasible: PARTIAL

### Issues Found:

- **[CRITICAL-D1-1]** `loadCourses()` -- returns courses with lecture counts has no repository support. (confidence: 95%) `CourseRepository.getAll()` exists (repositories.js:292) and returns raw course objects. There is NO method to get lecture counts per course. This requires N+1 queries: one `CourseRepository.getAll()` + one `LectureRepository.getByCourse(courseId)` per course.

- **[CRITICAL-D1-2]** Planned CSS classes `.sp-library-layout`, `.sp-library-sidebar`, `.sp-library-sidebar__item`, `.sp-library-toolbar` DO NOT EXIST in `playground-components.css`. (confidence: 100%) Grepped: zero matches. Plan says Modify but does not say Add new CSS rules.

- **[CRITICAL-D1-3]** No `library-sidebar` or `library-toolbar` DOM containers in `index.html`. (confidence: 100%) `#playground-view` section (index.html:918-938) has only: section header, `#playground-search`, `#library-grid`, `#library-empty`. No sidebar, toolbar, or layout wrapper.

- **[MAJOR-D1-4]** `deleteCourseWithConfirmation()` -- `CourseRepository.deleteWithCascade()` deletes all lectures AND child entities. Plan does not clarify DELETE vs REASSIGN. (confidence: 80%)

- **[MAJOR-D1-5]** `createCourseDialog()` includes color but `createCourse()` auto-generates color. (confidence: 70%)

- **[MINOR-D1-6]** Uncategorized requires `courseId === null` query. IndexedDB null index behavior varies. (confidence: 90%)

- **[MINOR-D1-7]** `sortLectures` uses progress but model field is `watchProgress`. (confidence: 85%)

### Missing from plan:
- How `library.js` imports from `flashcards.js` -- circular dependency risk.
- No ARIA specification for sidebar.
- No responsive breakpoint spec.

---

## Day 2: Import/Organization System (16 tests)

### Feasible: NO

### Issues Found:

- **[CRITICAL-D2-1]** `importFromProcessingResult()` depends on `lecturemind:processed` CustomEvent from `app.js`. Grepped: zero matches. Event does not exist. (confidence: 100%)

- **[CRITICAL-D2-2]** `batchDeleteLectures()` -- cascade = 7 async ops/lecture. 5 lectures = 35+ transactions. No partial failure handling. (confidence: 95%)

- **[CRITICAL-D2-3]** `batchAssignCourse()` -- no batch update in repository layer. Each update = separate transaction. (confidence: 90%)

- **[MAJOR-D2-4]** `renderCardContextMenu` -- no dismissal, focus, or ARIA spec. (confidence: 85%)

- **[MAJOR-D2-5]** `editLectureTitle` -- unspecified `flashcards.js` modifications. (confidence: 80%)

- **[MAJOR-D2-6]** Idempotent import -- no dedup key. Lecture model has no `jobId` or `sourceHash` field. (confidence: 90%)

### Missing from plan:
- `app.js` modification not listed as dependency.
- No processing result schema.
- Multi-select UI unspecified.

---

## Day 3: Cross-Lecture Search (18 tests)

### Feasible: NO

### Issues Found:

- **[CRITICAL-D3-1]** `crossLectureSearch()` -- Segment model has NO searchable text field. (confidence: 100%) Segment model (models.js:289-305): id, lectureId, startTime, endTime, type, metadata, createdAt. No text/summary/transcript. Fundamental data model gap blocks entire search.

- **[CRITICAL-D3-2]** `SegmentRepository`, `FlashcardRepository`, `BookmarkRepository` lack `getAll()` methods. (confidence: 100%) Verified: none have getAll().

- **[CRITICAL-D3-3]** Bookmark `label` is optional (default empty). Most bookmarks unsearchable. (confidence: 100%)

- **[MAJOR-D3-4]** `scoreMatch`/`extractSnippet` assume text param -- segments have no text. (confidence: 95%)

- **[MAJOR-D3-5]** `highlightTerms` -- safe DOM text splitting complexity unacknowledged. (confidence: 75%)

- **[MAJOR-D3-6]** `renderSearchTabs` -- ARIA tablist pattern unspecified. (confidence: 85%)

- **[MAJOR-D3-7]** Performance <200ms/1000 segments -- no indexing strategy. (confidence: 90%)

- **[MINOR-D3-8]** `renderSearchInput` -- debounce duration unspecified. (confidence: 70%)

### Missing from plan:
- What text field in Segments is searched (fundamental gap).
- Whether getAll() methods need adding.
- Search result navigation to source lecture.

---

## Cross-Day Issues

### Circular Dependency Risk (CRITICAL)
`library.js` imports from `flashcards.js`. Day 6: `flashcards.js` wires `enhancedRenderLibraryView` from `library.js`. Both directions = circular import.

### Missing app.js Modification (Day 2 blocker)
`lecturemind:processed` event does not exist in `app.js`. Not listed as modified.

### Data Model Gap Blocks Day 3
Segment model has no text field. Cross-lecture search dead on arrival.

### Repository Layer Gaps
- getAll() on Segment/Flashcard/BookmarkRepository (Day 3)
- Batch update on LectureRepository (Day 2)
- Count-by-course on LectureRepository (Day 1)

### IntersectionObserver (Day 6)
jsdom lacks it. Must mock. jest.setup.js only has structuredClone polyfill.

### Test Config
jest collectCoverageFrom scoped to **/storage/**/*.js. library.js outside scope.

---

## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| CRITICAL | 8 | D1-1, D1-2, D1-3, D2-1, D2-2, D3-1, D3-2, D3-3 |
| MAJOR | 8 | D1-4, D2-4, D2-5, D2-6, D3-4, D3-5, D3-6, D3-7 |
| MINOR | 4 | D1-6, D1-7, D3-8, cross-day test config |

---

## Verdict

HOSTILE_REVIEWER: **REJECT**

Critical: 8 | Major: 8 | Minor: 4 | Score: 38/100

Day 3 is architecturally broken (no searchable text in Segment model). Day 2 depends on fictional event in app.js. Day 1 references nonexistent CSS classes and DOM containers. Repository methods assumed but not implemented. Circular dependency unaddressed.

## Required Revisions

1. Add text/summary field to Segment model or define searchable metadata key. May need DB migration.
2. Add getAll() to SegmentRepository, FlashcardRepository, BookmarkRepository.
3. Specify app.js modification to dispatch lecturemind:processed event with payload schema.
4. Specify new CSS class definitions as NEW additions.
5. Specify new HTML structure for sidebar/toolbar in #playground-view with ARIA.
6. Resolve library.js <-> flashcards.js dependency direction to prevent circular imports.
7. Define import deduplication key for importFromProcessingResult().
8. Add IntersectionObserver mock to jest.setup.js.
9. Address courseId === null IndexedDB query behavior.
10. Specify batch operation partial failure handling.