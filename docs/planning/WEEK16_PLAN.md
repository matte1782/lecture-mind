# Week 16 Task Plan

**Date Range:** 2026-03-16 to 2026-03-22
**Goal:** Confusion heatmap visualization, privacy controls, storage quota UI
**Status:** DRAFT

---

## Prerequisites

- [ ] Week 15 gate passed (live audio capture + photo capture + confusion voting working)
- [ ] 592+ tests passing
- [ ] No P0 bugs from Week 15
- [ ] recorder.js at L2, parallel to analytics.js (AD-1 preserved)

---

## Days 1-2: SP4-lite Confusion Heatmap (8h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W16.1.1 | Aggregate confusion data: `getConfusionHeatmapData(lectureId)` | 2 | Returns `{segmentId, voteCount, percentage}[]` sorted by segment order | Unit tests with fixture data pass |
| W16.1.2 | SVG heatmap component (analytics-style) | 3 | Horizontal bar chart, color gradient green-yellow-red, segment labels, responsive | Renders with mock data, ARIA description present |
| W16.1.3 | Integrate heatmap into lecture detail "Confusion" tab | 1.5 | New tab alongside segments/flashcards/bookmarks in lecture detail view | Tab renders heatmap, empty state when no votes, roving tabindex on tab bar |
| W16.1.4 | Confusion summary stats on lecture detail | 1.5 | Total votes, most confused segment, segments with >50% confusion | Stats render correctly, edge cases tested (0 votes, 1 segment) |

---

## Days 3-4: Privacy + Storage Quota (5h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W16.2.1 | Privacy info-toast at first recording | 1.5 | Toast: "Recording may be subject to policies. Audio stored locally only." + "Don't show again" checkbox. Stored in localStorage. NOT a blocking dialog. | Toast shows on first record tap, dismissible, not shown again after acknowledgment |
| W16.2.2 | Web Speech API privacy toggle (default OFF) | 1 | Toggle in record view: "Enable live transcription (sends audio to Google)". Default OFF. Stored in localStorage. When OFF, only MediaRecorder runs. | Toggle persists across sessions, Web Speech only activates when ON |
| W16.2.3 | Storage quota UI: usage indicator + warning | 2 | Storage usage bar using `navigator.storage.estimate()`, shows "X MB used of ~Y MB". Warning toast at 80% quota. Bulk delete option for old recordings. Feature-detect fallback. | Usage displays correctly, warning triggers at threshold |
| W16.2.4 | Photo capture disclaimer (first-use) | 0.5 | One-time toast: "You are responsible for ensuring you have permission to photograph this content." Stored in localStorage. | Shows once on first photo, never shown again |

---

## Day 5: Accessibility Audit (2h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W16.3.1 | Accessibility audit of all new v0.5.0 components | 2 | All new components: role, tabindex, keyboard handlers, focus-visible, ARIA labels. Record button 56px+ touch target. Timer `aria-live="polite"`. | Manual + automated check passes, no ARIA violations |

---

## Estimated Total: 15h

---

## Blocked Tasks

| ID | Task | Blocked By | Unblock Condition |
|----|------|------------|-------------------|
| W16.B1 | Aggregate confusion across users | Multi-user auth system | v0.6.0 -- local personal data only for v0.5.0 |

---

## Not In Scope

| Task | Why Deferred |
|------|--------------|
| Professor Dashboard | v0.6.0 -- CUT from v0.5.0, needs multi-user backend |
| Tesseract.js OCR on photos | v0.6.0 -- ship photos first, validate demand |
| Real Whisper transcription | v1.0.0 -- stub is sufficient for v0.5.0 |
| Auto-Notes Framework | Week 18 -- separate focus week |
| v0.5.0 release | Week 19 -- release after all features complete |

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | SVG heatmap complexity (responsive + accessible) | MEDIUM | MEDIUM | Reuse analytics.js SVG patterns, keep simple horizontal bars |
| R2 | Week 15 delays push tasks into Week 16 | MEDIUM | MEDIUM | Cut line: heatmap can degrade to simple table, Week 17 contingency available |
| R3 | `navigator.storage.estimate()` not available on all browsers | LOW | MEDIUM | Feature-detect with fallback to "storage usage unavailable" message |

---

## Completion Criteria

- [ ] Confusion heatmap renders on lecture detail view with color gradient
- [ ] Privacy info-toast and Web Speech toggle working and persisted
- [ ] Storage quota indicator showing usage with warning at 80%
- [ ] Photo capture disclaimer shows on first use
- [ ] All new components keyboard accessible with proper ARIA
- [ ] 20+ new tests added (target: 612+ total)
- [ ] All tests pass
- [ ] No release in this week -- release is in Week 19
