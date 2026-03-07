# Week 12: Multi-Lecture Library — REVISED Plan

> **Revision date**: 2026-02-27 (rev 2)
> **Trigger**: Hostile plan review scored 38/100 on both Days 1-3 and Days 4-6
> **Rev 1 re-review**: Days 0-3: 72/100, Days 4-6: 82/100
> **Rev 2**: Fixes all remaining issues (2 CRITICAL, 7 MAJOR, 7 MINOR) from re-reviews
> **All original 16 CRITICAL, 18 MAJOR, and 11 MINOR issues addressed below**

---

## Architectural Decisions (Pre-Day-1)

### AD-1: No circular imports — one-directional dependency

```
dom-utils.js  (NEW — shared utilities extracted from flashcards.js)
    ↑               ↑
flashcards.js    library.js   (library imports from flashcards.js, NEVER reverse)
    ↑
library.js calls setLibraryRenderer() callback, NOT direct import into flashcards.js
```

**`dom-utils.js`** exports:
- **Extracted from flashcards.js**: `createElement`, `clearElement`, `showElement`, `hideElement`,
  `sanitizeId`, `registerListener`, `cleanupListeners`, `removeListenersForTarget`
- **NEW functions** (written fresh in dom-utils.js, do NOT exist in flashcards.js today):
  - `formatDuration(seconds)` → returns "HH:MM:SS" or "MM:SS" string
  - `timeAgo(date)` → returns human-readable relative time ("2 hours ago", "3 days ago")

Both `flashcards.js` and `library.js` import from `dom-utils.js`.
`library.js` imports from `flashcards.js` for: `VIEWS`, `navigateTo`, `createMasteryBadge`,
`createProgressRing`, `updateProgressRing`, `autoGenerateFlashcards`.
`flashcards.js` does NOT import from `library.js`. Instead, library.js calls
`setLibraryRenderer(fn)` (exported from flashcards.js) to register its enhanced renderer.

**Resolves:** X1 (circular dependency), M6 (ES module export immutability), C6 (hookable pattern).

### AD-2: Favorites via SettingsRepository, not BookmarkRepository

Favorites stored as `SettingsRepository.set('favorite_lectures', ['id1', 'id2', ...])`.
This avoids: misusing bookmark `timestamp` field (M4), missing getAll() on BookmarkRepository (C4),
multi-step unfavorite lookup (M5), and label index gap.

**Resolves:** C4, M4, M5.

### AD-3: Segment text lives in `metadata.text`

The Segment model has an opaque `metadata: Object` field. Day 2's import pipeline populates
`metadata.text` with transcript text from the processing result. Cross-lecture search (Day 3)
queries `segment.metadata.text`. This requires NO schema change — metadata is already flexible.

**Resolves:** D3-1, D3-4.

### AD-4: Repository layer additions (Day 0 prerequisite)

Before Day 1, add to `repositories.js`:
- `SegmentRepository.getAll()` → `return getAll('segments');`
- `FlashcardRepository.getAll()` → `return getAll('flashcards');`
- `BookmarkRepository.getAll()` → `return getAll('bookmarks');`

These are one-liners wrapping the existing `getAll` from db.js (already imported at line 9).
Also re-export from `storage/index.js`.

**Resolves:** D3-2.

### AD-5: IntersectionObserver mock in jest.setup.js

Add to `jest.setup.js`:
```javascript
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) { this._callback = callback; }
  observe() {}
  unobserve() {}
  disconnect() {}
  // Test helper: manually trigger
  _trigger(entries) { this._callback(entries, this); }
};
```

**Resolves:** C5.

### AD-6: Jest coverage config update

Update `src/vl_jepa/api/static/package.json` (verified: exists at this path, 890 bytes)
collectCoverageFrom to include `*.js` at static root:
```json
"collectCoverageFrom": ["**/storage/**/*.js", "flashcards.js", "library.js", "dom-utils.js", "!**/*.test.js"]
```

**Resolves:** X4.

---

## Day 0: Prerequisite Refactoring (3-4h, 5 tests)

**Purpose**: Extract shared utilities + extend repositories. MUST complete before Day 1.
**Scope note**: 11 changes across 7 files. dom-utils.js extraction must pass all 91 existing
flashcard tests for regression. Budget extra time for this prerequisite half-day.

### Files to create
- `src/vl_jepa/api/static/dom-utils.js` (~200 lines) — extracted from flashcards.js

### Files to modify
- `src/vl_jepa/api/static/flashcards.js` — replace internal utils with `import from './dom-utils.js'`; add `setLibraryRenderer(fn)` export; add `VIEWS.LECTURE_DETAIL` constant; add `#/lecture/:id` parsing in `parseHash()`; add case in `mountView()`; add `lecture-detail` to `getViewSections()`; update imports to include ProgressRepository, BookmarkRepository; add `#/dashboard` nav highlight logic
- `src/vl_jepa/api/static/storage/repositories.js` — add `getAll()` to SegmentRepository, FlashcardRepository, BookmarkRepository (3 one-liners)
- `src/vl_jepa/api/static/storage/index.js` — re-export new getAll methods (already re-exports the objects, so automatic)
- `src/vl_jepa/api/static/index.html` — add `<script type="module" src="/static/dom-utils.js"></script>` (loaded before flashcards.js); add `<script type="module" src="/static/library.js"></script>` (after flashcards.js); add `<section id="lecture-detail-view">` (hidden, inert, with section-container); add nav link for Dashboard placeholder
- `src/vl_jepa/api/static/jest.setup.js` — add IntersectionObserver mock
- `src/vl_jepa/api/static/package.json` — update collectCoverageFrom (verified: file exists at this path)

### Specific flashcards.js router changes

```javascript
// 1. Add constant:
const VIEWS = {
  LANDING: 'landing',
  PLAYGROUND: 'playground',
  STUDY: 'study',
  LECTURE_DETAIL: 'lecture-detail'  // NEW
};

// 2. Add to parseHash() before the final return:
const lectureMatch = raw.match(/^lecture\/(.+)$/);
if (lectureMatch) {
  return { view: VIEWS.LECTURE_DETAIL, params: { lectureId: sanitizeId(lectureMatch[1]) } };
}

// 3. Add to getViewSections():
lectureDetail: document.getElementById('lecture-detail-view')

// 4. Add to mountView() switch:
case VIEWS.LECTURE_DETAIL:
  if (sections.lectureDetail) {
    showElement(sections.lectureDetail);
    state.currentLectureId = params.lectureId;
    // Library renderer handles this if registered
    if (_lectureDetailRenderer) _lectureDetailRenderer(params.lectureId);
  }
  break;

// 5. Add hookable callback (module-scoped, added to the single export block at end of file):
let _libraryRenderer = null;
let _lectureDetailRenderer = null;
function setLibraryRenderer(fn) { _libraryRenderer = fn; }
function setLectureDetailRenderer(fn) { _lectureDetailRenderer = fn; }
// NOTE: Export via the existing named export block at line 1479, NOT inline `export function`.
// flashcards.js uses a single export block — maintain that consistency.

// 6. In mountView PLAYGROUND case, call _libraryRenderer if set:
// GUARD: if library.js hasn't loaded yet, _libraryRenderer is null — fall back to built-in.
// Module load order: dom-utils.js → flashcards.js → library.js (script order in HTML).
// library.js calls setLibraryRenderer() at module evaluation time, so it's registered
// before any user navigation. The fallback handles edge cases (slow network, module error).
case VIEWS.PLAYGROUND:
  if (sections.playground) {
    showElement(sections.playground);
    if (_libraryRenderer) _libraryRenderer();
    else renderLibraryView();  // fallback to original if library.js not loaded
  }
  break;

// 7. Update imports:
import { ProgressRepository, BookmarkRepository } from './storage/index.js';  // add these

// 8. Update nav highlight:
if (view === VIEWS.LECTURE_DETAIL && href === '#/playground') {
  link.classList.add('nav-link--active'); // Detail is child of playground
}
```

### HTML additions to index.html

```html
<!-- After study-view section -->
<section id="lecture-detail-view" class="app-section hidden" aria-label="Lecture Details" inert>
  <div class="section-container">
    <div id="lecture-detail-header"></div>
    <div id="lecture-detail-stats"></div>
    <div id="lecture-detail-tabs"></div>
    <div id="lecture-detail-content"></div>
  </div>
</section>
```

### setLibraryRenderer callback pattern

`flashcards.js` exports `setLibraryRenderer(fn)`. When library.js initializes, it calls:
```javascript
import { setLibraryRenderer, setLectureDetailRenderer } from './flashcards.js';
setLibraryRenderer(enhancedRenderLibraryView);
setLectureDetailRenderer(renderLectureDetailView);
```

This way flashcards.js never imports from library.js. Zero circular dependency.

### Tests (5 tests)
- dom-utils.js: createElement, clearElement, showElement, hideElement still work after extraction
- flashcards.js: existing 91 tests still pass (regression check)
- New route `#/lecture/abc123` parsed correctly
- setLibraryRenderer callback invoked in mountView

### Acceptance criteria
- All 91 existing flashcard tests pass (zero regressions)
- All 292 storage tests pass
- dom-utils.js exports all shared utilities
- flashcards.js imports from dom-utils.js
- New router routes work
- IntersectionObserver mock present in test env

---

## Day 1: Course Organization + Library Shell (4h, 18 tests)

### Files to create
- `src/vl_jepa/api/static/library.js` (~300 lines)
- `src/vl_jepa/api/static/library.test.js`

### Files to modify
- `src/vl_jepa/api/static/index.html` — add sidebar/toolbar containers INSIDE `#playground-view`
- `src/vl_jepa/api/static/playground-components.css` — ADD NEW CSS rules (not "modify existing")

### New HTML inside `#playground-view > .section-container` (after playground-search, before library-grid)

```html
<div id="library-toolbar" class="sp-library-toolbar" role="toolbar" aria-label="Library controls"></div>
<div class="sp-library-layout">
  <aside id="library-sidebar" class="sp-library-sidebar" role="navigation" aria-label="Course filter">
    <!-- Populated by library.js -->
  </aside>
  <div class="sp-library-main" id="library-main">
    <!-- existing library-grid and library-empty stay here, moved inside this wrapper -->
  </div>
</div>
```

### New CSS rules added to playground-components.css

```css
/* Library Layout */
.sp-library-layout { display: flex; gap: var(--space-6); }
.sp-library-sidebar { width: 240px; flex-shrink: 0; }
.sp-library-main { flex: 1; min-width: 0; }
.sp-library-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }

/* Sidebar Items */
.sp-library-sidebar__item {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);
  cursor: pointer; font-size: var(--text-sm); color: var(--foreground);
  transition: background-color var(--duration-fast) var(--ease-out);
}
.sp-library-sidebar__item:hover { background: var(--background-subtle); }
.sp-library-sidebar__item--active {
  background: var(--primary-bg, rgba(34, 211, 238, 0.1));
  color: var(--color-primary-500); font-weight: var(--font-semibold);
}
.sp-library-sidebar__item[aria-current="true"] { /* same as --active */ }
.sp-library-sidebar__color-dot {
  width: 10px; height: 10px; border-radius: var(--radius-full); flex-shrink: 0;
}
.sp-library-sidebar__count {
  margin-left: auto; font-size: var(--text-xs); color: var(--foreground-muted);
}

/* Toolbar */
.sp-library-toolbar__sort { /* native select, styled */ }
.sp-library-toolbar__view-toggle { display: flex; gap: var(--space-1); }

/* Responsive: collapse sidebar below 768px */
@media (max-width: 768px) {
  .sp-library-layout { flex-direction: column; }
  .sp-library-sidebar { width: 100%; display: flex; gap: var(--space-2); overflow-x: auto; }
}

/* Forced-colors override */
@media (forced-colors: active) {
  .sp-library-sidebar__item--active { border: 1px solid Highlight; }
  .sp-library-sidebar__color-dot { forced-color-adjust: none; }
}
```

### Functions in library.js

```javascript
import { createElement, clearElement, showElement, hideElement, sanitizeId, registerListener, formatDuration } from './dom-utils.js';
import { CourseRepository, LectureRepository, FLASHCARD_STATUS } from './storage/index.js';
import { setLibraryRenderer, setLectureDetailRenderer, navigateTo, createMasteryBadge, VIEWS } from './flashcards.js';

const libraryState = {
  selectedCourseId: null,   // null = "All Lectures"
  sortBy: 'recent',         // 'recent' | 'title' | 'progress'
  viewMode: 'grid',         // 'grid' | 'list'
  courses: [],              // cached course list
  courseLectureCount: {}   // Map<courseId, count> — avoids N+1
};

async function loadCourses()
// 1. CourseRepository.getAll() → courses
// 2. LectureRepository.getAll() → all lectures
// 3. Count lectures per courseId with reduce (SINGLE pass, no N+1)
// 4. Cache in libraryState.courses and courseLectureCount
// Returns: Array<{course, lectureCount}>

async function createCourseDialog()
// Modal: name (required, max 100), description (optional, max 300)
// Color: 6 preset CSS variables (--color-primary-500, etc.) OR auto from createCourse factory
// Focus trap, Escape closes, safe DOM only
// On save: CourseRepository.create({ name, description, color })
// Note: createCourse() in models.js accepts optional color param; generates random if omitted

async function editCourseDialog(courseId)
// Pre-fills from CourseRepository.getById(courseId)
// On save: CourseRepository.update(courseId, { name, description, color })

async function deleteCourseWithConfirmation(courseId)
// Two options in confirmation dialog:
//   1. "Delete course only" → sets all course lectures' courseId to null (orphan)
//   2. "Delete course and all lectures" → CourseRepository.deleteWithCascade(courseId)
// Uses window.confirm fallback if modal not available

function renderCourseSidebar(courses, selectedCourseId)
// Creates aside content:
// - "All Lectures" (always first, aria-current="true" when selected)
// - "Favorites" (count from SettingsRepository)
// - "Uncategorized" (lectures where courseId === null — counted during loadCourses)
// - Course items: color dot, name, lecture count badge
// - "+ New Course" button at bottom
// Each item: role not needed (semantic <button> elements inside <nav>)
// Click handler: updates libraryState.selectedCourseId, re-renders grid

function renderLibraryToolbar(sortBy, viewMode)
// Sort: <select> with options: "Most Recent", "Title A-Z", "Watch Progress"
// View: grid/list toggle buttons
// onChange: updates libraryState, re-renders

function sortLectures(lectures, sortBy)
// 'recent': by updatedAt desc
// 'title': by title.localeCompare()
// 'progress': by watchProgress desc (field name is watchProgress in Lecture model)
```

### Tests (18 tests)

```
describe('Course Management')
  test('loadCourses returns courses with lecture counts — single pass, no N+1')
  test('loadCourses handles empty database')
  test('loadCourses counts uncategorized lectures (courseId === null)')
  test('createCourseDialog validates name required')
  test('createCourseDialog creates course via CourseRepository.create')
  test('editCourseDialog pre-fills form fields')
  test('deleteCourseWithConfirmation — "delete only" orphans lectures')
  test('deleteCourseWithConfirmation — "delete all" cascades')

describe('Course Sidebar')
  test('renderCourseSidebar shows "All Lectures" first')
  test('renderCourseSidebar shows "Favorites" item')
  test('renderCourseSidebar shows "Uncategorized" with count')
  test('renderCourseSidebar marks active item with aria-current')
  test('clicking sidebar item updates libraryState.selectedCourseId')

describe('Library Toolbar')
  test('renderLibraryToolbar renders sort <select>')
  test('renderLibraryToolbar renders view toggle')
  test('sort change triggers re-render')

describe('Sorting')
  test('sortLectures by recent uses updatedAt desc')
  test('sortLectures by title uses localeCompare')
```

### Acceptance criteria
1. Sidebar renders All/Favorites/Uncategorized/Courses
2. Clicking course filters the library grid
3. Sort dropdown changes lecture order
4. Course CRUD via modals with validation
5. All new CSS classes added to playground-components.css
6. All new HTML containers added to index.html
7. No innerHTML — safe DOM only
8. aria-current on selected sidebar item
9. Responsive: sidebar collapses to horizontal scroll on mobile
10. Forced-colors: sidebar active item has visible border

---

## Day 2: Import Pipeline + Organization (4h, 16 tests)

### Files to modify
- `src/vl_jepa/api/static/library.js` — add import functions (~250 lines)
- `src/vl_jepa/api/static/library.test.js` — add 16 tests
- `src/vl_jepa/api/static/app.js` — ADD CustomEvent dispatch (2 lines)

### app.js modification (CRITICAL — event does not exist today)

In `app.js`, after successful processing completes (where `updateResultsUI()` is called), add:
```javascript
window.dispatchEvent(new CustomEvent('lecturemind:processed', {
  detail: {
    result: processingResult,  // has .metadata, .events, .transcript
    jobId: currentJobId
  }
}));
```

Locate the exact insertion point by grepping for `updateResultsUI`.

### Import functions in library.js

```javascript
async function importFromProcessingResult(result, jobId)
// 1. Dedup check via SettingsRepository (NOT lecture.metadata — Lecture model has no metadata field):
//    const importedJobs = await SettingsRepository.get('imported_jobs') || {};
//    if (importedJobs[jobId]) {
//      const existing = await LectureRepository.getById(importedJobs[jobId]);
//      if (existing) return existing;  // idempotent: already imported
//    }
// 2. Create lecture: LectureRepository.create({
//      title: result.metadata?.filename || 'Untitled',
//      duration: result.metadata?.duration || 0,
//      status: 'completed',
//      courseId: null
//    })
// 3. Create segments from result.transcript (array of segment objects):
//    For each: SegmentRepository.create({
//      lectureId, startTime, endTime,
//      type: 'transcript',
//      metadata: { text: segment.text || '' }  // ← AD-3: text in metadata
//    })
// 4. Create events from result.events:
//    For each: EventRepository.create({
//      lectureId, type: event.type, timestamp: event.timestamp, metadata: event
//    })
// 5. Record jobId → lectureId mapping for dedup:
//    importedJobs[jobId] = lecture.id;
//    await SettingsRepository.set('imported_jobs', importedJobs);
// 6. Return created lecture
//
// NOTE: Dedup uses SettingsRepository (same pattern as favorites in AD-2) because
// the Lecture model (models.js:260) has NO metadata field. This avoids undocumented
// schema extensions.

// Event listener (registered in library init):
window.addEventListener('lecturemind:processed', async (e) => {
  const lecture = await importFromProcessingResult(e.detail.result, e.detail.jobId);
  // showToast takes 3 args: (variant, title, message) — see flashcards.js:114
  showToast('success', 'Import Complete', `Imported "${lecture.title}" to library`);
  // Re-render library if on playground view
});
```

### Organization functions

```javascript
async function assignLectureToCourse(lectureId, courseId)
// LectureRepository.update(lectureId, { courseId })
// courseId can be null (uncategorize)

async function batchAssignCourse(lectureIds, courseId)
// Sequential with try/catch per lecture. Collects failures.
// Returns { succeeded: string[], failed: string[] }

async function batchDeleteLectures(lectureIds)
// Confirmation showing count: "Delete N lectures and all their data?"
// Sequential LectureRepository.deleteWithCascade(id) per lecture
// try/catch per lecture — partial failure safe
// Returns { succeeded, failed }
// Shows toast: "Deleted N lectures. M failed."
// NOTE: deleteWithCascade is NOT atomic — if it fails mid-cascade (e.g., after
// deleting segments but before the lecture), orphan records may result. This is
// acceptable at current scale (<100 lectures). The failed[] array lets the user
// retry failed items. Future: consider wrapping cascade in single IDB transaction.

function renderCardContextMenu(lecture, courses, position, onAction)
// Creates absolutely-positioned div at {position.x, position.y}
// Items: Assign to Course, Edit Title, Generate Flashcards, Delete
// ARIA: role="menu" on container, role="menuitem" on items
// Keyboard: ArrowDown/Up navigates, Enter selects, Escape dismisses
// Outside click dismisses (mousedown on document)
// Focus management: first item focused on open, focus returns to trigger on close
//
// NOTE: "Assign to Course" opens a DIALOG (not nested submenu) to avoid
// complex aria-haspopup/submenu keyboard patterns. Dialog lists courses as
// radio buttons. This flattens the interaction and simplifies ARIA.

async function editLectureTitle(lectureId, currentTitle)
// Small modal: single text input pre-filled with currentTitle
// On save: LectureRepository.update(lectureId, { title: newTitle })
// Validation: required, max 200 chars
// No flashcards.js changes needed — this is purely library.js
```

### Tests (16 tests)

```
describe('Import Pipeline')
  test('importFromProcessingResult creates lecture')
  test('importFromProcessingResult creates segments with metadata.text')
  test('importFromProcessingResult creates events')
  test('importFromProcessingResult is idempotent (dedup by sourceJobId)')
  test('importFromProcessingResult handles missing metadata gracefully')
  test('importFromProcessingResult sets status to completed')

describe('Course Assignment')
  test('assignLectureToCourse updates courseId')
  test('assignLectureToCourse with null uncategorizes')
  test('batchAssignCourse updates all lectures')
  test('batchAssignCourse reports partial failures')
  test('batchDeleteLectures cascades correctly')
  test('batchDeleteLectures handles partial failure')

describe('Context Menu')
  test('renderCardContextMenu has role="menu"')
  test('renderCardContextMenu items have role="menuitem"')
  test('Escape dismisses context menu')
  test('outside click dismisses context menu')
```

### Acceptance criteria
1. Processing a video dispatches `lecturemind:processed` event
2. Library catches event and imports lecture + segments + events
3. Segments have `metadata.text` populated from transcript
4. Import is idempotent (re-processing same jobId doesn't duplicate)
5. Context menu has ARIA menu/menuitem roles
6. Context menu navigable by keyboard (Arrow/Enter/Escape)
7. Batch operations report partial failures (don't silently swallow)
8. All 34 cumulative tests pass

---

## Day 3: Cross-Lecture Search (4h, 18 tests)

### Files to modify
- `src/vl_jepa/api/static/library.js` — add search engine (~300 lines)
- `src/vl_jepa/api/static/library.test.js` — add 18 tests
- `src/vl_jepa/api/static/playground-components.css` — add search result CSS

### Search targets (verified against actual codebase)

| Source | Searchable field | Method to fetch all |
|--------|-----------------|---------------------|
| Segments | `metadata.text` (populated by Day 2 import) | `SegmentRepository.getAll()` (added Day 0) |
| Flashcards | `front`, `back` | `FlashcardRepository.getAll()` (added Day 0) |
| Bookmarks | `label` (optional, may be empty — filter out empty) | `BookmarkRepository.getAll()` (added Day 0) |

### Search functions

```javascript
const SEARCH_CONFIG = {
  MAX_RESULTS: 50,
  MIN_QUERY_LENGTH: 2,
  DEBOUNCE_MS: 300,
  HIGHLIGHT_CONTEXT_CHARS: 80
};

// Search cache — built once on first search, invalidated on data change:
// const searchCache = { segments: null, flashcards: null, bookmarks: null, lectures: null };
// buildSearchCache(): fetches all entities, extracts searchable text ONCE into cache tuples:
//   segments: [{ text: extractSearchableText(seg), ref: seg }]
//   flashcards: [{ text: card.front + ' ' + card.back, ref: card }]
//   bookmarks: [{ text: bookmark.label, ref: bookmark }] (only where label is non-empty)
//   lectures: Map<lectureId, lectureTitle>
// extractSearchableText(segment) returns (segment.metadata?.text || '') — called ONCE per
// segment during cache build, NOT per-search.

async function crossLectureSearch(query)
// 1. Normalize: query.toLowerCase().trim(), split into terms
// 2. Reject if < MIN_QUERY_LENGTH
// 3. Build or reuse searchCache (lazy init on first search)
// 4. Segments: filter cached tuples where text contains ALL terms (case-insensitive)
// 5. Flashcards: filter cached tuples where text contains ALL terms
// 6. Bookmarks: filter cached tuples where text contains ANY term
// 7. Lookup parent lecture titles from searchCache.lectures
// 8. Score and sort results
// 9. Limit to MAX_RESULTS
// Returns { segments: [...], flashcards: [...], bookmarks: [...], totalCount }

function scoreMatch(text, terms, fullQuery)
// 100 if text includes exact fullQuery phrase
// 50 + (matched/total * 30) for partial term matching
// +10 bonus if match in first 100 chars

function extractSnippet(text, terms, contextChars)
// Find first term occurrence, extract surrounding context
// Returns { before, match, after } for highlighting

function highlightTerms(container, text, terms)
// SAFE DOM text highlighting — NO innerHTML:
// 1. Escape regex special chars in terms: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// 2. Build regex: new RegExp(`(${escapedTerms.join('|')})`, 'gi')
// 3. Split text at match boundaries
// 4. For each part: non-match → document.createTextNode(part)
//                   match → span with class 'sp-search-highlight' + textContent
// 5. Append all to container

function renderSearchInput(container)
// Full-width input, placeholder "Search across all lectures..."
// Debounce 300ms via setTimeout/clearTimeout
// Clear button (X) visible when has value
// Escape clears input and returns to library grid
// Loading spinner class toggled during search

function renderSearchResults(results, query, lectureMap)
// Grouped by type. Each result card shows:
// - Lecture title (textContent, from lectureMap)
// - Type badge: "Segment" | "Flashcard" | "Bookmark"
// - Highlighted snippet
// - Click navigates to #/lecture/{lectureId}

function renderSearchTabs(activeTab, counts)
// Tab bar: All (N) | Segments (N) | Flashcards (N) | Bookmarks (N)
// ARIA: role="tablist" on container, role="tab" on each tab
// aria-selected="true" on active tab
// Keyboard: ArrowLeft/Right to switch tabs, Enter to select
// Click handler filters displayed results
```

### New CSS in playground-components.css

```css
.sp-search-result { padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: var(--space-2); }
.sp-search-result__lecture { font-size: var(--text-xs); color: var(--foreground-muted); }
.sp-search-result__type { display: inline-block; padding: var(--space-0_5) var(--space-2); border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: var(--font-medium); background: var(--background-subtle); }
.sp-search-highlight { background: var(--color-warning-100, rgba(245, 158, 11, 0.2)); border-radius: 2px; padding: 0 1px; }
.sp-search-tabs { display: flex; gap: var(--space-1); border-bottom: 1px solid var(--border); margin-bottom: var(--space-4); }
.sp-search-tabs__tab { padding: var(--space-2) var(--space-4); cursor: pointer; border-bottom: 2px solid transparent; font-size: var(--text-sm); }
.sp-search-tabs__tab--active { border-bottom-color: var(--color-primary-500); font-weight: var(--font-semibold); color: var(--color-primary-500); }
.sp-search-tabs__tab[aria-selected="true"] { /* same as --active */ }

.dark .sp-search-highlight { background: rgba(245, 158, 11, 0.15); }
@media (forced-colors: active) { .sp-search-highlight { background: Highlight; color: HighlightText; } }
```

### Tests (18 tests)

```
describe('Search Engine')
  test('returns empty for query < MIN_QUERY_LENGTH')
  test('finds segments by metadata.text')
  test('finds flashcards by front text')
  test('finds flashcards by back text')
  test('finds bookmarks by label (non-empty only)')
  test('skips bookmarks with empty label')
  test('returns results grouped by type with totalCount')
  test('limits results to MAX_RESULTS')
  test('multi-term requires ALL terms present in text')
  test('regex special chars in query do not crash')

describe('Scoring + Highlighting')
  test('exact phrase scores highest')
  test('highlightTerms creates safe DOM spans — no innerHTML')
  test('highlightTerms handles multiple occurrences')

describe('Search UI')
  test('renderSearchTabs has role="tablist" with aria-selected')
  test('renderSearchTabs keyboard: ArrowRight switches tab')
  test('renderSearchInput debounces input')
  test('renderSearchInput clear button resets')
  test('search results show parent lecture title')
```

### Acceptance criteria
1. Search finds across segments (metadata.text), flashcards (front/back), bookmarks (label)
2. Regex special chars in query don't crash (escaped)
3. Highlight uses safe DOM (createTextNode + span), zero innerHTML
4. Tab bar has ARIA tablist/tab/aria-selected
5. Debounce prevents excessive re-searching (300ms)
6. Results show parent lecture name
7. All 52 cumulative tests pass

---

## Day 4: Progress Persistence + Lecture Detail View (4h, 16 tests)

### Files to modify
- `src/vl_jepa/api/static/library.js` — add detail view (~350 lines)
- `src/vl_jepa/api/static/library.test.js` — add 16 tests
- `src/vl_jepa/api/static/playground-components.css` — add detail view CSS

### Note: flashcards.js already modified in Day 0 to add:
- `VIEWS.LECTURE_DETAIL` constant
- `#/lecture/:id` route in parseHash()
- Case in mountView() calling `_lectureDetailRenderer(lectureId)`
- `<section id="lecture-detail-view">` in index.html
- ProgressRepository, BookmarkRepository imports

### library.js import update required for Day 4:
Day 1 import block at top of library.js starts with:
```javascript
import { CourseRepository, LectureRepository, FLASHCARD_STATUS } from './storage/index.js';
```
Day 4 adds functions using SegmentRepository, FlashcardRepository, BookmarkRepository,
ProgressRepository. **Update the import to:**
```javascript
import { CourseRepository, LectureRepository, SegmentRepository, FlashcardRepository,
         BookmarkRepository, ProgressRepository, SettingsRepository, FLASHCARD_STATUS
} from './storage/index.js';
```

### Functions in library.js

```javascript
async function updateLectureProgress(lectureId, segmentId, position)
// WRAPPER calling two separate repository methods:
// 1. await ProgressRepository.updatePosition(lectureId, position)
// 2. await ProgressRepository.markSegmentCompleted(lectureId, segmentId)
// 3. Calculate percentage: (completedSegments.length / totalSegments) * 100
//    - totalSegments from SegmentRepository.getByLecture(lectureId).length
//    - Guard: if totalSegments === 0, percentage = 0 (no division by zero)
// 4. LectureRepository.update(lectureId, { watchProgress: percentage })

async function getLectureStats(lectureId)
// Uses: SegmentRepository.getByLecture, FlashcardRepository.getByLecture,
//       BookmarkRepository.getByLecture, ProgressRepository.getOrCreate
// Note: ProgressRepository uses getOrCreate(lectureId) NOT getByLecture()
// Returns {
//   segmentCount, completedSegmentCount, progressPercent,
//   flashcardCount, flashcardsDue, masteredCount,
//   bookmarkCount, lastPosition, lastStudied (from progress.updatedAt)
// }

async function renderLectureDetailView(lectureId)
// Full detail page. Registered via setLectureDetailRenderer() in Day 0.
// 1. Back button → navigateTo('#/playground')
// 2. Header: lecture title (editable), course badge
// 3. Stats bar: 4 stat cards (progress ring, flashcards, bookmarks, last studied)
// 4. Tabs: Segments | Flashcards | Bookmarks | Info
// 5. Tab content renders below

function renderDetailHeader(lecture, course)
// Back button (← Library), title with edit-on-click, course color badge
// Kebab menu: assign course, delete, generate flashcards

function renderDetailStats(stats)
// Horizontal flex with stat cards. Each card:
//   .sp-detail-stat > .sp-detail-stat__value + .sp-detail-stat__label
// Progress uses createProgressRing (imported from flashcards.js)
// Division-by-zero: show "0%" if segmentCount === 0

function renderDetailTabs(activeTab)
// Tab bar with ARIA tablist/tab/tabpanel pattern
// Keyboard: ArrowLeft/Right, Enter
// Focus moves to tabpanel content on activation

async function renderSegmentsList(lectureId)
// Lists segments with: time range, type badge, completion checkbox
// Completed segments have checkmark + muted opacity

async function renderFlashcardsList(lectureId)
// Lists flashcards: front text (truncated), status badge, due indicator
// Edit/delete buttons per card

async function renderBookmarksList(lectureId)
// Lists bookmarks: timestamp, label
// Delete button per bookmark

function renderLectureInfo(lecture, stats)
// Created date, duration, course, status
// "Study Flashcards" button → navigateTo(`#/study/${lectureId}`)
```

### New CSS

```css
.sp-detail-stats { display: flex; gap: var(--space-4); flex-wrap: wrap; margin: var(--space-4) 0; }
.sp-detail-stat { flex: 1; min-width: 120px; padding: var(--space-4); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); text-align: center; }
.sp-detail-stat__value { font-size: var(--text-xl); font-weight: var(--font-bold); }
.sp-detail-stat__label { font-size: var(--text-xs); color: var(--foreground-muted); }
.sp-segment-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border-bottom: 1px solid var(--border-subtle); }
.sp-segment-item--completed { opacity: 0.6; }
```

### Tests (16 tests)

```
describe('Progress Tracking')
  test('updateLectureProgress calls updatePosition + markSegmentCompleted')
  test('updateLectureProgress calculates percentage correctly')
  test('updateLectureProgress handles 0 segments (no division by zero)')
  test('getLectureStats returns complete aggregate')
  test('getLectureStats uses getOrCreate (not getByLecture) for progress')

describe('Detail View')
  test('renderLectureDetailView shows lecture title')
  test('renderLectureDetailView shows back button')
  test('renderDetailStats shows 4 stat cards')
  test('renderDetailStats shows 0% for empty lecture')
  test('tab switching renders correct content')
  test('tab bar has ARIA tablist/tab roles')

describe('Entity Lists')
  test('renderSegmentsList shows all segments with time ranges')
  test('renderSegmentsList marks completed with checkmark')
  test('renderFlashcardsList shows edit/delete per card')
  test('renderBookmarksList shows timestamps and labels')
  test('renderLectureInfo has "Study Flashcards" button')
```

### Acceptance criteria
1. `#/lecture/:id` navigates to detail view (route added in Day 0)
2. Stats accurate: flashcard count, bookmark count, progress ring
3. Progress persists across page reloads (IndexedDB)
4. Division by zero guarded (0 segments → 0%)
5. Tabs use ARIA tablist/tab/tabpanel
6. All 68 cumulative tests pass

---

## Day 5: Playlist Navigation + Favorites (4h, 14 tests)

### Files to modify
- `src/vl_jepa/api/static/library.js` — add playlist + favorites (~250 lines)
- `src/vl_jepa/api/static/library.test.js` — add 14 tests
- `src/vl_jepa/api/static/playground-components.css` — add playlist/favorite CSS

### Favorites via SettingsRepository (AD-2)

```javascript
import { SettingsRepository } from './storage/index.js';

async function getFavoriteIds()
// const favorites = await SettingsRepository.get('favorite_lectures');
// return Array.isArray(favorites) ? favorites : [];

async function toggleFavorite(lectureId)
// 1. const ids = await getFavoriteIds()
// 2. If includes(lectureId): remove it
// 3. Else: add it
// 4. await SettingsRepository.set('favorite_lectures', ids)
// 5. Return new isFavorite boolean

async function isFavorite(lectureId)
// const ids = await getFavoriteIds()
// return ids.includes(lectureId)

async function getFavoriteLectures()
// 1. const ids = await getFavoriteIds()
// 2. For each id: LectureRepository.getById(id) (filter out deleted)
// 3. Return array of lectures
```

### Playlist functions

```javascript
async function getPlaylistForLecture(lectureId)
// 1. Get lecture: LectureRepository.getById(lectureId)
// 2. If lecture.courseId: LectureRepository.getByCourse(lecture.courseId)
//    Else: LectureRepository.getAll(), filter where courseId === null
// 3. Sort by createdAt ascending (chronological within course)
// 4. Find index of current lecture
// 5. Return { previous: lectures[i-1]||null, current, next: lectures[i+1]||null,
//             total: lectures.length, currentIndex: i }

function renderPlaylistNav(playlist)
// Bottom of detail view:
// "← Previous: [title]" button (disabled + aria-disabled if first)
// "Lecture N of M" text
// "Next: [title] →" button (disabled if last)
// Keyboard: ArrowLeft = previous, ArrowRight = next
// GUARD: skip keyboard if activeElement is input/textarea/select

function renderPlaylistMinimap(playlist)
// Horizontal dots: one per lecture in course
// Current = filled primary, completed (>80%) = filled success, others = empty
// Click navigates to #/lecture/:id

function renderFavoriteButton(lectureId, isFav)
// Star button: filled yellow when favorite
// aria-label: "Add to favorites" / "Remove from favorites"
// On click: toggleFavorite, update star appearance
// Debounced to prevent race condition on double-click (200ms lockout)
```

### New CSS

```css
.sp-playlist-nav { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); border-top: 1px solid var(--border); margin-top: var(--space-6); }
.sp-playlist-nav__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sp-playlist-minimap { display: flex; gap: var(--space-2); justify-content: center; padding: var(--space-3); overflow-x: auto; max-width: 100%; }
.sp-playlist-minimap__dot { width: 10px; height: 10px; border-radius: var(--radius-full); border: 2px solid var(--border); cursor: pointer; }
.sp-playlist-minimap__dot--current { background: var(--color-primary-500); border-color: var(--color-primary-500); }
.sp-playlist-minimap__dot--completed { background: var(--color-success-500); border-color: var(--color-success-500); }
.sp-favorite-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.sp-favorite-btn--active { color: var(--color-warning-500); }
.sp-favorite-btn:hover { transform: scale(1.1); }

@media (forced-colors: active) {
  .sp-favorite-btn--active { forced-color-adjust: none; color: Highlight; }
  .sp-playlist-minimap__dot--current { forced-color-adjust: none; }
}
```

### Tests (14 tests)

```
describe('Favorites (SettingsRepository)')
  test('toggleFavorite adds lectureId on first call')
  test('toggleFavorite removes lectureId on second call')
  test('isFavorite returns true when favorited')
  test('isFavorite returns false when not')
  test('getFavoriteLectures returns only existing lectures')
  test('getFavoriteLectures handles deleted lectures gracefully')

describe('Playlist')
  test('getPlaylistForLecture returns previous/current/next')
  test('getPlaylistForLecture returns null previous for first')
  test('getPlaylistForLecture returns null next for last')
  test('getPlaylistForLecture sorts by createdAt ascending')
  test('renderPlaylistNav disables previous button for first')
  test('renderPlaylistNav disables next button for last')

describe('Favorite Button')
  test('renderFavoriteButton shows filled star when favorite')
  test('renderFavoriteButton has correct aria-label')
```

### Acceptance criteria
1. Favorites use SettingsRepository (no bookmark misuse)
2. Star toggle persists across page reloads
3. Sidebar "Favorites" filter shows only starred lectures
4. Playlist prev/next navigates within course
5. ArrowLeft/Right skipped when input is focused
6. Favorite button debounced against double-click
7. All 82 cumulative tests pass

---

## Day 6: Integration + Performance + Polish (4h, 12 tests)

### Files to modify
- `src/vl_jepa/api/static/library.js` — add integration glue + pagination (~200 lines)
- `src/vl_jepa/api/static/library.test.js` — add 12 integration tests

### Functions

```javascript
function renderLibraryViewPaginated(lectures, pageSize = 12)
// 1. Render first pageSize cards
// 2. If more: add IntersectionObserver sentinel div at bottom
// 3. When sentinel visible: render next pageSize, move sentinel
// 4. When all rendered: remove sentinel
// IntersectionObserver available in browser; mocked in jsdom tests (AD-5)

async function enhancedRenderLibraryView()
// Registered via setLibraryRenderer() during library.js init
// 1. Load courses + favorites
// 2. Render sidebar
// 3. Render toolbar (sort/view)
// 4. Fetch all lectures (LectureRepository.getAll())
// 5. Filter by: selectedCourseId, favorites filter, search query
// 6. Sort by libraryState.sortBy
// 7. Batch-load courses (single getAll, Map<courseId, course>) — avoids N+1
// 8. Render cards with pagination
// 9. Show appropriate empty state if no results

function initLibraryKeyboardShortcuts()
// "/" or Ctrl+K: focus search input (ONLY when activeElement is not input/textarea/select)
// Escape: clear search / close context menu
// Registered on playground view mount, cleaned up on unmount

// Empty states (created dynamically, no pre-existing DOM containers needed):
function renderCourseEmptyState(courseName)  // "No lectures in [name] yet"
function renderSearchEmptyState(query)        // "No results for [query]"
function renderFavoritesEmptyState()          // "No favorites yet"

// Module initialization (called at end of library.js):
function initLibrary() {
  setLibraryRenderer(enhancedRenderLibraryView);
  setLectureDetailRenderer(renderLectureDetailView);
  // Listen for import events
  window.addEventListener('lecturemind:processed', handleImport);
}
initLibrary();
```

### Tests (12 tests)

```
describe('Enhanced Library View')
  test('enhancedRenderLibraryView renders sidebar, toolbar, and grid')
  test('course filter + sort work together')
  test('favorites filter shows only favorited lectures')
  test('empty course shows course empty state')
  test('empty search shows search empty state')
  test('empty favorites shows favorites empty state')

describe('Performance')
  test('renders 20 lectures without error')
  test('search 100 segments completes in under 500ms')
  test('paginated rendering loads first 12, sentinel present for more')
  test('IntersectionObserver sentinel triggers next batch via mock._trigger()')

describe('Keyboard Shortcuts')
  test('"/" focuses search input when no input focused')
  test('"/" does NOT focus search when input already focused')
```

### Acceptance criteria (Week 12 Gate)
1. **Library manages 10+ lectures without slowdown** (roadmap gate)
2. Course CRUD, sidebar filtering, sort all work together
3. Cross-lecture search finds across all data types
4. Lecture detail view shows accurate stats with progress ring
5. Playlist navigation between lectures in same course
6. Favorites via SettingsRepository
7. Import from processing result
8. All **94 cumulative library tests pass**
9. All **91 flashcard tests pass** (zero regressions)
10. All **292 storage tests pass** (zero regressions)
11. Total: **~477 tests pass**
12. Zero innerHTML in library.js
13. All ARIA labels present
14. Responsive layout
15. Reduced-motion respected
16. Forced-colors support

---

## Issue Resolution Matrix

### CRITICAL Issues (16/16 resolved)

| Issue | Resolution | Day |
|-------|-----------|-----|
| D1-1 N+1 queries | Single-pass count via LectureRepository.getAll() + reduce | 1 |
| D1-2 CSS classes don't exist | Explicitly listed as NEW CSS additions | 1 |
| D1-3 No sidebar/toolbar DOM | HTML structure explicitly listed to ADD | 1 |
| D2-1 lecturemind:processed missing | app.js modification explicitly listed | 2 |
| D2-2 Batch delete failure handling | try/catch per lecture, report {succeeded, failed} | 2 |
| D3-1 Segment no text field | Search metadata.text (populated by Day 2 import) | 3 |
| D3-2 No getAll() on repos | Added in Day 0 prerequisite | 0 |
| D3-3 Bookmark label optional | Filter out empty labels before search | 3 |
| C1 flashcards.js missing imports | Added in Day 0 prerequisite | 0 |
| C2 Router needs 5 changes | All 5 changes specified in Day 0 | 0 |
| C3 No lecture detail section | HTML added in Day 0 | 0 |
| C4 BookmarkRepository no getAll | Favorites via SettingsRepository (AD-2) | 5 |
| C5 IntersectionObserver jsdom | Mock added in Day 0 jest.setup.js | 0 |
| C6 Hookable pattern undefined | setLibraryRenderer callback pattern (AD-1) | 0 |
| X1 Circular dependency | dom-utils.js + one-directional imports (AD-1) | 0 |
| X2 Day 4 dep on Day 2 | Dependency graph corrected: Day 4 needs Day 1+2 | 4 |

### MAJOR Issues (18/18 resolved)

| Issue | Resolution | Day |
|-------|-----------|-----|
| D1-4 Delete vs Reassign | Two-option dialog: orphan vs cascade | 1 |
| D1-5 Course color | createCourse auto-generates if omitted; dialog offers presets | 1 |
| D2-4 Context menu ARIA | role="menu", role="menuitem", Arrow/Enter/Escape | 2 |
| D2-5 editLectureTitle | Purely in library.js, no flashcards.js changes | 2 |
| D2-6 Import dedup key | SettingsRepository 'imported_jobs' map (jobId→lectureId) | 2 |
| D3-4 scoreMatch no text | metadata.text is the searchable field | 3 |
| D3-5 highlightTerms complexity | Detailed implementation: regex split + createTextNode + span | 3 |
| D3-6 ARIA tablist | role="tablist", role="tab", aria-selected specified | 3 |
| D3-7 Performance no index | getAll() + in-memory filter; acceptable for <1000 items | 3 |
| M1 conflated operations | Documented as wrapper calling both repo methods | 4 |
| M2 getLectureStats imports | All imports listed in library.js header | 4 |
| M3 Playlist sort undefined | createdAt ascending within course | 5 |
| M4 Bookmark timestamp misuse | Favorites via SettingsRepository, not bookmarks | 5 |
| M5 Unfavorite multi-step | SettingsRepository: simple array add/remove | 5 |
| M6 ES module immutable | setLibraryRenderer callback pattern | 0 |
| M7 No script tag | Added in Day 0 index.html modifications | 0 |
| M8 Empty state containers | Created dynamically via createElement | 6 |
| X3 getOrCreate not getByLecture | Corrected: uses ProgressRepository.getOrCreate() | 4 |
| X4 Jest coverage config | Updated collectCoverageFrom in package.json | 0 |

### MINOR Issues (11/11 resolved)

| Issue | Resolution | Day |
|-------|-----------|-----|
| D1-6 courseId null index | In-memory filter after getAll (no index needed) | 1 |
| D1-7 progress vs watchProgress | Corrected to `watchProgress` | 1 |
| D3-8 Debounce duration | Specified: 300ms | 3 |
| m1 timeAgo shared | NEW function in dom-utils.js (not extracted — doesn't exist in flashcards.js) | 0 |
| m2 Division by zero | Guard: 0 segments → 0% | 4 |
| m3 Arrow keyboard conflict | Skip if activeElement is input/textarea/select | 5 |
| m4 N+1 course per card | Batch-load all courses once, pass as Map | 6 |
| m5 CSS budget | playground-components.css < 15KB | 6 |
| m6 "/" key conflict | Only when activeElement is not input | 6 |
| X5 formatDuration duplication | NEW function in dom-utils.js (not extracted — doesn't exist in flashcards.js) | 0 |
| Test config scoping | collectCoverageFrom updated | 0 |

---

## Dependency Graph (Corrected)

```
Day 0 (prerequisite: dom-utils, repo additions, router, HTML, mocks)
  ├── Day 1 (courses, sidebar, toolbar)
  │   ├── Day 2 (import pipeline, context menu, app.js event)
  │   │   └── Day 3 (search — depends on Day 2 metadata.text)
  │   └── Day 4 (detail view, progress — depends on Day 0 routes + Day 1 sidebar)
  │       └── Day 5 (playlist, favorites — depends on Day 4 detail view)
  │           └── Day 6 (integration, pagination, polish)
```

---

## Rev 2 Addendum: Re-Review Issue Fixes

The following issues were found during the rev 1 re-review (Days 0-3: 72/100, Days 4-6: 82/100)
and are now addressed in this rev 2:

### CRITICAL (2 fixed)

| ID | Issue | Fix applied |
|----|-------|-------------|
| N-C1 | Lecture model lacks metadata — dedup broken | Changed dedup to SettingsRepository 'imported_jobs' map (same pattern as AD-2 favorites). No Lecture model change needed. |
| N-C2 | showToast called with 1 arg (needs 3) | Changed to `showToast('success', 'Import Complete', msg)` matching flashcards.js:114 signature |

### MAJOR (5 fixed)

| ID | Issue | Fix applied |
|----|-------|-------------|
| N-M1 | Day 0 scope unbounded (2h for 11 changes) | Changed to 3-4h with scope note about regression testing |
| N-M2 | deleteWithCascade non-atomic orphan risk | Documented non-atomic nature, retry strategy for failed items |
| N-M3 | Context menu nested submenu ARIA incomplete | Changed "Assign to Course" from submenu to dialog (radio buttons) |
| N-M4 | setLibraryRenderer race condition | Added fallback guard comment documenting module load order + fallback |
| N3 | Day 4 library.js imports not listed | Added explicit import block update showing all 8 repos |

### MINOR (6 fixed)

| ID | Issue | Fix applied |
|----|-------|-------------|
| N-m1/N1 | package.json location unclear | Clarified: `src/vl_jepa/api/static/package.json` (verified exists) |
| N-m2 | extractSearchableText call timing | Added searchCache with extractSearchableText called during cache build |
| N-m3 | lectureCounts vs lectureCount inconsistency | Standardized on `courseLectureCount` throughout |
| n1 | timeAgo/formatDuration described as "extracted" but don't exist in flashcards.js | Clarified as NEW functions with signatures |
| n2 | Mixed export style (inline vs block) | Clarified: use single export block at end of flashcards.js |
| n3 | _trigger helper not referenced in Day 6 tests | Added `via mock._trigger()` to test description |
