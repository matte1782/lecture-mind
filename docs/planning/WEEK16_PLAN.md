# Week 16 Task Plan

**Date Range:** 2026-03-16 to 2026-03-22
**Goal:** Confusion Heatmap, Professor Dashboard UI, and v0.5.0 release polish
**Status:** DRAFT

---

## Prerequisites

- [ ] Week 15 gate passed (live capture + confusion voting working)
- [ ] 590+ tests passing
- [ ] No P0 bugs from Week 15

---

## Days 1-2: Confusion Heatmap Visualization (8h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W16.1.1 | Aggregate confusion data per lecture | 2 | `getConfusionHeatmapData(lectureId)` returns `{segmentId, voteCount, percentage}[]` | Unit tests with fixture data pass, sorts by segment order |
| W16.1.2 | SVG heatmap component | 3 | Horizontal bar chart in analytics style, color gradient (green->yellow->red), segment labels | Renders with mock data, responsive width, ARIA description |
| W16.1.3 | Integrate heatmap into lecture detail view | 1.5 | New "Confusion" tab in lecture detail alongside segments/flashcards/bookmarks | Tab renders heatmap, empty state when no votes |
| W16.1.4 | Confusion summary stats | 1.5 | Total votes, most confused segment, average confusion rate | Stats render correctly, tested with edge cases (0 votes, 1 segment) |

---

## Days 3-4: Professor Dashboard (8h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W16.2.1 | Route `#/professor` + professor-view section | 1 | New route in flashcards.js, `<section id="professor-view">` in index.html | Navigation works, view renders |
| W16.2.2 | Dashboard layout: lecture selector + metrics | 2 | Dropdown to pick lecture, cards for key metrics (total confusion votes, hotspot count, avg quiz score) | Renders with real IndexedDB data, empty state handled |
| W16.2.3 | Class-wide confusion heatmap | 2 | Reuse W16.1.2 component, aggregate across all lectures or filter by course | Heatmap renders for selected lecture/course |
| W16.2.4 | Most-replayed segments list | 1.5 | Ranked list of segments by replay count (from ProgressRepository watch data) | List renders, sorted descending, shows segment title + count |
| W16.2.5 | Quiz performance aggregate | 1.5 | Average accuracy, mastery distribution chart (reuse analytics.js patterns) | Chart renders, data matches underlying flashcard results |

---

## Day 5: Export + Polish + Release (6h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W16.3.1 | Export confusion report as JSON/CSV | 2 | Button on professor dashboard, downloads file | File downloads, contains correct data, tested |
| W16.3.2 | Navigation: add Professor link to sidebar/nav | 0.5 | Visible link in navigation, icon distinguishes from student views | Link visible, navigates correctly |
| W16.3.3 | Accessibility audit (ARIA, keyboard, focus) | 1.5 | All new components: role, tabindex, keyboard handlers, focus-visible | Manual + automated check passes |
| W16.3.4 | v0.5.0 release prep | 2 | Update CHANGELOG.md, ROADMAP.md, tag, GitHub release | All docs updated, tag pushed, release created |

---

## Estimated Total: 22h (with 2x buffer on visualization work)

---

## Blocked Tasks

| ID | Task | Blocked By | Unblock Condition |
|----|------|------------|-------------------|
| W16.B1 | Real multi-user aggregation | Auth system | v1.0.0 — local simulation only for v0.5.0 |

---

## Not In Scope

| Task | Why Deferred |
|------|--------------|
| Multi-user backend | v1.0.0 |
| Real-time WebSocket confusion feed | v1.0.0 |
| PDF export of reports | v1.0.0 (JSON/CSV sufficient) |
| Professor account/login | v1.0.0 |

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | SVG heatmap complexity (responsive, accessible) | MEDIUM | MEDIUM | Reuse analytics.js SVG patterns, keep it simple |
| R2 | Router getting crowded (6 routes now) | LOW | LOW | Document route table, consider route config object |
| R3 | Professor dashboard scope creep | HIGH | HIGH | Strict MVP: 3 cards + 1 heatmap + 1 list + export |
| R4 | Week 15 delays push into Week 16 | MEDIUM | MEDIUM | Cut line: export can be deferred |

---

## Completion Criteria

- [ ] Confusion heatmap renders on lecture detail view
- [ ] Professor dashboard shows metrics for any lecture
- [ ] Export downloads valid JSON/CSV
- [ ] 25+ new tests added (target: 615+ total)
- [ ] All tests pass
- [ ] HOSTILE_REVIEWER approves v0.5.0 final gate
- [ ] CHANGELOG.md and ROADMAP.md updated
- [ ] v0.5.0 tagged and released
