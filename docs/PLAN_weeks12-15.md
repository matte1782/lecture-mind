# Lecture Mind v0.4.0 — Weeks 12-15 Implementation Plan

> **Status**: Weeks 10-11 complete (Storage + Flashcards). 383 tests passing.
> **Target**: v0.4.0 release at end of Week 15
> **Date**: 2026-02-26

---

## Progress Summary

| Week | Focus | Status | Tests |
|------|-------|--------|-------|
| 10 | Storage Layer + Design System | DONE | 292 |
| 11 | Flashcard System | DONE | +91 = 383 |
| **12** | **Multi-Lecture Library** | **NEXT** | **+94 = ~477** |
| 13 | Progress & Analytics | Planned | +135 = ~612 |
| 14 | Professor Dashboard | Planned | +90 = ~702 |
| 15 | Polish + Release v0.4.0 | Planned | +30 = ~732 |

---

## Week 12: Multi-Lecture Library (20h, ~94 new tests)

### Goal (Roadmap SP2)
Course organization, cross-lecture search, progress persistence, playlist navigation, favorites.

### Main File: `library.js` (~1650 lines) + `library.test.js`

---

### Day 1: Course Organization + Library Shell (18 tests)

**Create:** `library.js`, `library.test.js`
**Modify:** `flashcards.js` (hookable renderLibraryView), `index.html` (sidebar/toolbar containers), `playground-components.css`

**Functions:**
- `loadCourses()` — returns courses with lecture counts
- `createCourseDialog()` — modal for new course (name, description, color)
- `editCourseDialog(courseId)` — pre-filled modal
- `deleteCourseWithConfirmation(courseId)` — cascade warning
- `renderCourseSidebar(courses, selectedCourseId)` — All/Uncategorized/Courses with color dots
- `renderLibraryToolbar(sortBy, viewMode)` — sort dropdown + grid/list toggle
- `renderEnhancedLibraryCard(lecture, index, course)` — course badge, duration, bookmarks
- `sortLectures(lectures, sortBy)` — recent/title/progress
- `formatDuration(seconds)` — "1h 23m"

**CSS:** `.sp-library-layout`, `.sp-library-sidebar`, `.sp-library-sidebar__item`, `.sp-library-toolbar`

**Acceptance:** Sidebar filters grid, sort works, course CRUD via modals, responsive collapse.
**Review focus:** Modal focus trap, ARIA on sidebar, XSS via course name, listener registry.

---

### Day 2: Import/Organization System (16 tests)

**Modify:** `library.js`, `library.test.js`, `flashcards.js`

**Functions:**
- `importFromProcessingResult(result, jobId)` — bridges app.js upload to library
- `assignLectureToCourse(lectureId, courseId)` — move lecture between courses
- `batchAssignCourse(lectureIds, courseId)` — batch move
- `batchDeleteLectures(lectureIds)` — batch delete with cascade
- `renderCardContextMenu(lecture, courses, onAction)` — kebab menu: assign/edit/delete/generate
- `editLectureTitle(lectureId, currentTitle)` — inline edit modal

**Integration:** CustomEvent `lecturemind:processed` dispatched by app.js, caught by library.js.

**Acceptance:** Processing creates library entry, context menu works, batch ops, idempotent import.
**Review focus:** Import idempotency, context menu keyboard nav, cascade completeness.

---

### Day 3: Cross-Lecture Search (18 tests)

**Modify:** `library.js`, `library.test.js`, `index.html`, `playground-components.css`

**Functions:**
- `crossLectureSearch(query)` — searches segments, flashcards, bookmarks across all lectures
- `scoreMatch(text, terms, fullQuery)` — exact phrase > all terms > partial
- `extractSnippet(text, terms, contextChars)` — surrounding context
- `highlightTerms(container, text, terms)` — safe DOM spans (NO innerHTML)
- `renderSearchInput(container)` — debounced, with clear button
- `renderSearchResults(results, query)` — grouped by type
- `renderSearchTabs(activeTab, counts)` — All/Segments/Flashcards/Bookmarks

**CSS:** `.sp-search`, `.sp-search-result`, `.sp-search-highlight`, `.sp-search-tabs`

**Acceptance:** Finds across lectures, highlights matches safely, debounced, <200ms for 1000 segments.
**Review focus:** XSS in highlighting (must use textNode), regex escaping, ARIA live region.

---

### Day 4: Progress Persistence + Lecture Detail View (16 tests)

**Modify:** `library.js`, `library.test.js`, `flashcards.js` (add `#/lecture/:id` route), `index.html`, `playground-components.css`

**Functions:**
- `updateLectureProgress(lectureId, segmentId, position)` — updates ProgressRepository
- `getLectureStats(lectureId)` — aggregate: segments, flashcards, bookmarks, progress
- `renderLectureDetailView(lectureId)` — header, stats, tab panel
- `renderDetailHeader(lecture, course)` — back button, editable title, course badge
- `renderDetailStats(stats)` — stat cards with progress ring
- `renderDetailTabs(activeTab)` — Segments/Flashcards/Bookmarks/Info
- `renderSegmentsList(lectureId)` — with completion checkboxes
- `renderFlashcardsList(lectureId)` — with edit/delete per card
- `renderBookmarksList(lectureId)` — with timestamps and labels
- `timeAgo(timestamp)` — "5 minutes ago", "3 days ago"

**CSS:** `.sp-detail-stats`, `.sp-detail-stat`, `.sp-segment-item`

**Acceptance:** Detail view shows accurate stats, persists across reloads, tab switching works.
**Review focus:** Division by zero (0 segments), route sanitization, focus on tab switch.

---

### Day 5: Playlist Navigation + Favorites (14 tests)

**Modify:** `library.js`, `library.test.js`, `playground-components.css`

**Functions:**
- `getPlaylistForLecture(lectureId)` — returns { previous, current, next, total }
- `renderPlaylistNav(playlist)` — prev/next buttons with titles
- `renderPlaylistMinimap(playlist)` — dot progress indicator
- `toggleFavorite(lectureId)` — bookmark with special label
- `isFavorite(lectureId)` / `getFavoriteLectures()`
- `renderFavoriteButton(lectureId, isFav)` — star toggle
- `renderFavoritesFilter()` — sidebar "Favorites" item

**CSS:** `.sp-playlist-nav`, `.sp-playlist-minimap`, `.sp-favorite-btn`

**Acceptance:** Prev/next navigation, minimap dots, star toggle, favorites filter in sidebar.
**Review focus:** Single-lecture playlist, double-click race, keyboard Arrow conflict with inputs.

---

### Day 6: Integration + Performance (12 tests)

**Modify:** `library.js`, `library.test.js`, `flashcards.js` (wire enhancedRenderLibraryView)

**Functions:**
- `renderLibraryViewPaginated(lectures, pageSize)` — IntersectionObserver lazy loading
- `enhancedRenderLibraryView()` — replaces simple renderLibraryView
- `initLibraryKeyboardShortcuts()` — "/" or Ctrl+K for search, Escape to clear
- Empty states: course/search/favorites

**Acceptance (Week 12 Gate):** Library manages 10+ lectures without slowdown. 94 tests pass.
**Review focus:** Memory leaks, N+1 queries, state consistency after delete, CSS budget.

---

## Week 13: Progress & Analytics (20h, ~135 new tests)

### Goal (Roadmap SP3 + SP4)
Study analytics dashboard, confusion voting/aggregation, study reports.

### Main Files: `analytics.js` (~1200 lines), `analytics.test.js`, `analytics.css` (~300 lines)

---

### Day 1: Data Layer + Watch Progress Tracking (25 tests)

**Modify:** `storage/db.js` (add studySessions + studyGoals stores, DB_VERSION 1→2), `storage/models.js`, `storage/repositories.js`, `storage/index.js`
**Add to `analytics.js`:** WatchProgressTracker class

**New models:**
- `createStudySession({ lectureId, cardsReviewed, correct, duration, accuracy, masteryChanges })`
- `createStudyGoal({ weekStart, targetMinutes, targetCards, actualMinutes, actualCards, streakDays })`

**New repositories:**
- `StudySessionRepository` — create, getByLecture, getByDateRange, getTotalStudyTime, getWeeklyStats
- `StudyGoalRepository` — getOrCreateForWeek, update, getCurrentWeek, getStreak

**Acceptance:** DB upgrades safely 1→2, factories validate, repositories CRUD works.
**Review focus:** DB migration backward-compat, date range off-by-one, timezone in streak.

---

### Day 2: SVG Chart Primitives + Aggregation (30 tests)

**Add to `analytics.js`:** All SVG charts + data aggregation functions

**SVG Charts (all via `createElementNS`, zero innerHTML):**
- `createMasteryDonut(counts, size)` — concentric arcs by status
- `createWeeklyBarChart(dailyData, maxHeight)` — 7 vertical bars Mon-Sun
- `createConfusionHeatmap(segmentVotes, segments)` — colored rects by density
- `createAccuracySparkline(sessions)` — polyline of last 10 sessions

**Aggregation functions:**
- `aggregateMasteryDistribution(lectureId?)` — { new, learning, review, mastered }
- `aggregateWeeklyStudyData(weekStartMs)` — 7 daily entries
- `aggregateConfusionData(lectureId)` — per-segment vote counts
- `aggregateStudyStreak()` — { currentStreak, longestStreak }
- `aggregateOverallProgress()` — totals across all lectures

**Acceptance:** SVG renders valid elements, ARIA on all charts, colors from tokens, handles empty data.
**Review focus:** SVG namespace, donut arc math, bar chart division by zero, regex in heatmap.

---

### Day 3: Analytics Dashboard UI — Study Tab (20 tests)

**Modify:** `analytics.js`, `index.html` (add analytics-view + nav link), create `analytics.css`

**Route:** `#/analytics` with tab navigation (Study Progress / Confusion Map)

**Layout:** Mastery donut + weekly bar chart + 4 stat cards (mastered/study time/streak/accuracy) + accuracy sparkline + weekly goal editor

**Functions:**
- `renderAnalyticsDashboard()` — main entry
- `renderStudyProgressTab(container)` — study tab content
- `renderStatCard(container, { label, value, icon })` — reusable metric card
- `renderWeeklyGoal(container)` — goal progress bar + editor
- `renderStreakBadge(streakDays)` — fire icon for 7+ days

**Acceptance:** Route works, stats correct, tab keyboard nav, responsive grid.
**Review focus:** ARIA tablist/tab/aria-selected, NaN handling, goal form accessibility.

---

### Day 4: Confusion Voting + Aggregation (22 tests)

**Add to `analytics.js`:** Confusion voting UI + confusion tab

**Functions:**
- `createConfusionVoteButton(lectureId, segmentId)` — per-segment vote button
- `aggregateConfusionForLecture(lectureId)` — vote counts + heatmap data
- `getTopConfusingSegments(lectureId, limit)` — top N most-voted
- `renderConfusionTab(container)` — lecture selector + heatmap + top segments + summary

**Acceptance:** Vote toggle works, dedup per session, heatmap colors correct, top segments list.
**Review focus:** Vote dedup correctness, division by zero, selector XSS, confusion thresholds.

---

### Day 5: Study Report Export + Session Persistence (20 tests)

**Modify:** `analytics.js`, `flashcards.js` (add `recordStudySession` call in renderSessionComplete)

**Functions:**
- `recordStudySession(session)` — persists to StudySessionRepository, updates weekly goal + streak
- `exportStudyReport(format)` — triggers download
- `generateMarkdownReport(data)` / `generateJSONReport(data)`
- `triggerDownload(content, filename, mimeType)` — Blob + anchor click
- `getWeekStartMs()` / `formatDuration(seconds)`

**Acceptance:** Session data persists, goal increments, streak updates, exports valid Markdown/JSON.
**Review focus:** Race condition on concurrent recordStudySession, Markdown injection, Blob URL leak.

---

### Day 6: Integration Tests + Polish (18 tests)

**Full lifecycle tests:** Create lecture → study session → vote confusion → check dashboard → export.
**Empty state tests, multi-lecture aggregation, accessibility audit, edge cases.**

**Polish:** Reduced motion for charts, dark mode, responsive, loading skeletons, empty states.

**Acceptance (Week 13 Gate):** 135 new tests pass. Analytics accurate. Privacy preserved.

---

## Week 14: Professor Dashboard (20h, ~90 new tests)

### Goal (Roadmap SP7)
Educator-facing analytics with anonymous aggregation, heatmap visualization, export.

### Main Files: `dashboard-aggregation.js` (~250 lines), `dashboard.js` (~800 lines), `dashboard-components.css` (~300 lines)

---

### Day 1: Dashboard Data Aggregation Layer (25 tests)

**Create:** `dashboard-aggregation.js`, `dashboard-aggregation.test.js`

**Pure functions (no IndexedDB calls — take arrays, return objects):**
- `aggregateConfusionBySegment(votes, segments)` — per-segment vote counts + intensity
- `buildConfusionHeatmapData(votes, segments, duration)` — time buckets with normalized scores
- `identifyMostReplayedSegments(events, segments, topN)` — ranked by seek-to events
- `aggregateFlashcardPerformance(flashcards)` — status distribution + avg ease
- `computeEngagementMetrics(progress[], lectures[])` — watch time, completion rates
- `buildLectureSummary(lectureId, data)` / `buildCourseSummary(courseId, data)`
- `stripPersonalData(record)` — removes userId fields (defense in depth)

**Acceptance:** All pure functions, zero userId in outputs, handles empty data.
**Review focus:** PRIVACY — any function that leaks individual student data is critical fail.

---

### Day 2: Dashboard Router + View Shell (12 tests)

**Create:** `dashboard.js`, `dashboard.test.js`
**Modify:** `flashcards.js` (extend VIEWS + parseHash + mountView), `index.html` (dashboard section + nav + script)

**Route:** `#/dashboard` and `#/dashboard/:lectureId`

**HTML:** `<section id="dashboard-view">` with controls + content containers, privacy banner placeholder.

**Acceptance:** Route works, nav highlights, section hidden/shown correctly.

---

### Day 3: Confusion Heatmap SVG Visualization (18 tests)

**Modify:** `dashboard.js`
**Create:** `dashboard-components.css`

**SVG components (all via `createElementNS`):**
- `renderConfusionHeatmap(container, heatmapData, duration)` — colored rects
- `confusionIntensityToColor(normalizedScore)` — maps to CSS vars
- `renderTimeAxis(svg, duration, width, yOffset)` — tick marks
- `renderHeatmapBars(svg, buckets, width, height)` — colored bars
- `renderMostReplayedList(container, segments)` — ordered list
- `renderMetricCard(container, { label, value, icon, trend })` — reusable card

**Acceptance:** SVG valid, colors from tokens, tooltip on hover, ARIA role="img".
**Review focus:** innerHTML in SVG, hardcoded colors, missing ARIA, dark mode.

---

### Day 4: Quiz Analytics + Engagement Panels (15 tests)

**Modify:** `dashboard.js`, `dashboard-components.css`

**Functions:**
- `renderFlashcardAnalytics(container, performance)` — mastery bar + stats
- `renderMasteryDistributionBar(container, byStatus)` — horizontal stacked SVG bar
- `renderEngagementPanel(container, metrics)` — metric card grid
- `loadDashboardData(lectureId)` — fetch from repositories + aggregate
- `renderDashboardView(lectureId)` — FULL WIRING of all panels

**Acceptance:** All panels use aggregate-only data, mastery bar sums to 100%.
**Review focus:** Individual data exposure, division by zero, skeleton accessibility.

---

### Day 5: Export Reports — CSV/JSON (15 tests)

**Modify:** `dashboard.js`

**Functions:**
- `exportDashboardCSV(data, title)` / `exportDashboardJSON(data, title)`
- `generateConfusionCSV(heatmapData)` — time/votes/intensity table
- `generateFlashcardCSV(performance)` — status/count/percentage table
- `sanitizeForCSV(value)` — escapes commas, quotes, CSV injection (`=`, `+`, `-`, `@`)
- `triggerDownload(content, filename, mimeType)` — Blob + anchor + revoke
- `renderExportControls(container)` — CSV/JSON buttons

**Acceptance:** CSV opens in Excel, JSON is valid, no personal data, CSV injection prevented.
**Review focus:** CSV injection, Blob URL leak, personal data in exports.

---

### Day 6: Privacy Controls + Integration Testing (12 tests)

**Modify:** `dashboard.js`, `dashboard-components.css`, `index.html`

**Functions:**
- `renderPrivacyBanner(container)` — "All data anonymized" notice
- `renderDataAccessControls(container)` — toggles for confusion/engagement data
- `validatePrivacy(dashboardData)` — programmatic check for userId/email fields

**Integration tests:** Full flow, empty data, multi-lecture aggregation, navigation, privacy.

**Acceptance (Week 14 Gate):** 90 tests pass. Dashboard useful for professors. Privacy verified.

---

## Week 15: Polish + Release (20h, ~30 new tests)

### Goal
Offline mode, animation polish, final hostile review, documentation, v0.4.0 release.

---

### Day 1: Service Worker for Offline Mode (18 tests)

**Create:** `sw.js` (~200 lines), `offline.js` (~150 lines), `offline.test.js`
**Modify:** `index.html` (script tag + offline indicator)

**SW strategies:**
- Cache-first for `/static/*` (all CSS, JS, storage modules)
- Network-first for `/api/*`
- Stale-while-revalidate for fonts

**Functions:**
- `registerServiceWorker()` — with update lifecycle
- `renderOfflineIndicator(container)` — uses `.sp-sync-indicator` component
- `getCacheStatus()` — { cached, version, assetCount }

**Acceptance:** App loads offline after initial cache, sync indicator updates, old caches cleaned.

---

### Day 2: Animation Polish + Page Transitions (10 tests)

**Modify:** `animations-v2.css`, `dashboard-components.css`, `flashcards.js`, `dashboard.js`
**Create:** `transitions.test.js`

**New animations:**
- `viewFadeIn` — crossfade between views
- `dashCardEntrance` — staggered dashboard cards
- `heatmapReveal` — left-to-right bar fill
- `counterFadeIn` — stat number entrance

All with reduced-motion overrides. Only transform/opacity animated.

**Acceptance:** 60fps transitions, all reduced-motion covered, no permanent will-change.

---

### Day 3: Final Hostile Review

**Create:** `docs/reviews/REVIEW_hostile_v040_final.md`

**Checklist (100 points):**
- Security (30): zero innerHTML, sanitization, CSV injection, privacy, SW safety
- Accessibility (20): ARIA, keyboard, SVG labels, focus, forced-colors, touch targets
- Performance (15): no layout thrash, transform-only animations, indexed queries, no memory leaks
- Architecture (15): no circular imports, clean modules, consistent patterns, error handling
- Code Quality (10): consistent style, BEM naming, token colors, no TODOs
- Testing (10): critical path coverage, edge cases, privacy tests, integration tests

**Target:** Score 85+/100. If below, Day 5 becomes fix day.

---

### Day 4: Documentation

**Create:**
- `docs/student-playground/quickstart.md` — 5-minute setup
- `docs/student-playground/flashcards.md` — flashcard guide
- `docs/student-playground/professor.md` — dashboard guide
- `docs/student-playground/offline.md` — offline mode guide

**Modify:** `docs/ROADMAP.md` — mark Weeks 12-15 complete

---

### Day 5: Fix Review Issues + Final Polish

Address hostile review findings. If score was 85+, add keyboard shortcuts, hover effects, cross-browser notes.

---

### Day 6: Release v0.4.0

1. Final test run (~730+ tests, 0 failures)
2. Update ROADMAP.md to v0.4.0 RELEASED
3. Create CHANGELOG.md entry
4. Git commit + tag v0.4.0
5. Verification checklist (features, security, a11y, performance, docs)

---

## Dependency Graph

```
Week 12 (Library)
├── Day 1: courses, sidebar, toolbar
│   ├── Day 2: import, context menu
│   │   └── Day 3: cross-lecture search
│   └── Day 4: detail view, progress
│       └── Day 5: playlist, favorites
│           └── Day 6: integration
│
Week 13 (Analytics) — depends on Week 12 library
├── Day 1: data layer (DB v2, new repos)
│   └── Day 2: SVG charts + aggregation
│       └── Day 3: dashboard UI
│           └── Day 4: confusion voting
│               └── Day 5: export + session persistence
│                   └── Day 6: integration
│
Week 14 (Dashboard) — depends on Week 13 analytics
├── Day 1: aggregation layer (pure functions)
│   └── Day 2: router + shell
│       └── Day 3: heatmap SVG
│           └── Day 4: quiz + engagement panels
│               └── Day 5: CSV/JSON export
│                   └── Day 6: privacy + integration
│
Week 15 (Polish + Release) — depends on all above
├── Day 1: Service Worker (independent)
├── Day 2: Animations (independent)
├── Day 3: Hostile review
├── Day 4: Documentation
├── Day 5: Fix issues
└── Day 6: Release v0.4.0
```

---

## Key Constraints (All Weeks)

- **Safe DOM only**: `createElement()` + `textContent`, zero `innerHTML`
- **SVG via `createElementNS`**: never `innerHTML` for SVG
- **BEM CSS**: `sp-*` prefix, CSS custom properties from tokens
- **Accessibility**: ARIA, keyboard nav, reduced-motion, forced-colors, 44px touch targets
- **TDD**: tests alongside implementation
- **Hostile review**: score 85+/100 required to proceed
- **Privacy-first**: no individual student data in dashboard/exports
- **Module pattern**: ES modules, no global pollution

---

*"Build tools that make learning a joy, not a chore."*
