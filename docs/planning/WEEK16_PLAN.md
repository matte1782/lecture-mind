# Week 16 Task Plan (REVISED)

**Date Range:** 2026-03-16 to 2026-03-22
**Goal:** Fix P1 UX bugs from Day 6 research, then confusion heatmap, privacy controls, storage quota UI
**Status:** DRAFT
**Revision:** v2.0 — incorporates Day 6 UX findings (~4h added, total ~19h)

---

## Prerequisites

- [x] Week 15 gate passed (live audio capture + photo capture + confusion voting working)
- [x] 652 tests passing (11 suites)
- [x] No P0 bugs from Week 15
- [x] recorder.js at L2, parallel to analytics.js (AD-1 preserved)
- [ ] Day 6 UX research findings reviewed and prioritized

---

## Day 0: UX Bug Fixes (4h)

**Rationale:** These are visible bugs on the live GitHub Pages demo. Users see blank toasts, broken dark mode, and wrong colors. Fix before adding new features.

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W16.0.1 | SW cache version bump | 0.1 | Change `sw.js:12` from `'lm-v0.4.0'` to `'lm-v0.5.0'` | `grep 'lm-v0.5.0' sw.js` returns match |
| W16.0.2 | Fix recorder toast calls (6 sites) | 0.5 | `recorder.js:505-570` calls `showToast('text')` with 1 arg. Fix to `showToast('info', 'Recording', 'Recording started')` (3-arg variant/title/message). All 6 call sites. | Test: toast renders with visible title+message text, not blank white box |
| W16.0.3 | Fix analytics dark mode (CSS tokens) | 1 | `analytics.css:1-14` defines its own `:root` block with `--sp-primary`, `--sp-card-bg` etc. Replace all 8 variable names with `token.css` equivalents (`--color-primary-500`, `--color-surface-100`, etc.). Remove duplicate `:root` block. | Dark mode toggle changes dashboard colors. Test: no `--sp-` tokens remain in analytics.css |
| W16.0.4 | Fix recorder CSS tokens | 0.5 | `recorder.css:8-35` uses `var(--primary, #6366f1)` (purple). Replace with `var(--color-primary-500, #22d3ee)` (app cyan) and align all token names with `token.css`. | Visual: recorder UI uses cyan, not purple. Test: no `--primary` bare token in recorder.css |
| W16.0.5 | Backend availability guard | 1 | Add `isBackendAvailable()` in `app.js` — fetch `/api/health` with 2s timeout. If no backend (GitHub Pages), hide demo upload sections, show info banner: "Running in Playground mode — use Record to capture lectures." | Test: when fetch fails, banner visible, upload sections hidden |
| W16.0.6 | Empty state CTA update | 0.25 | Update playground-view empty state to add "Record a Lecture" button as primary CTA alongside existing "Upload" link. Link navigates to `#/record`. | Test: empty state contains link/button to `#/record` with text "Record a Lecture" |

**Day 0 test target:** +6 tests (658 total)

---

## Days 1-2: SP4-lite Confusion Heatmap (8h)

**Dependencies:** W15.5 (confusion voting data exists in IDB)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W16.1.1 | Aggregate confusion data: `getConfusionHeatmapData(lectureId)` | 2 | Returns `{segmentId, voteCount, percentage}[]` sorted by segment order. Uses batch-fetch pattern: `ConfusionVoteRepository.getByLecture()` + Map grouping. | Unit tests with fixture data pass; empty lecture returns `[]` |
| W16.1.2 | HTML/CSS heatmap component (bar chart) | 3 | Horizontal bar chart using `div` elements with CSS gradient (green-yellow-red). Each bar = one segment, width proportional to confusion %. Responsive. ARIA `role="img"` with `aria-label` description. Fallback from SVG to HTML/CSS per R1 risk mitigation. | Renders with mock data, ARIA description present, responsive at 320px-1200px |
| W16.1.3 | Integrate heatmap into lecture detail "Confusion" tab | 1.5 | New tab alongside segments/flashcards/bookmarks/photos in lecture detail view. Roving tabindex on tab bar. Empty state: "No confusion data yet -- vote on segments to see your heatmap." | Tab renders heatmap, empty state when no votes, roving tabindex correct, tab count assertion in analytics.test.js updated |
| W16.1.4 | Confusion summary stats on lecture detail | 1.5 | Total votes cast, most confused segment (name + %), segments with >50% confusion count. Edge cases: 0 votes, 1 segment, all confused, none confused. | Stats render correctly for all edge cases, unit tests cover each |

**Days 1-2 test target:** +12 tests (670 total)

---

## Days 3-4: Privacy + Storage Quota (5h)

**Dependencies:** W15.2 (record view exists), W15.1 (IDB stores exist)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W16.2.1 | Privacy info-toast at first recording | 1.5 | Toast: "Recording may be subject to institutional policies. Audio is stored locally only on your device." + "Don't show again" checkbox. Stored in `localStorage` key `lm-privacy-ack`. NOT a blocking dialog. Shown when user taps Record for the first time. | `pytest`-style: toast shows when `localStorage` has no key, dismissible, not shown after acknowledgment. 2 tests. |
| W16.2.2 | Web Speech API privacy toggle (default OFF) | 1 | Toggle switch in record view: "Enable live transcription (sends audio to Google servers)". Default OFF. Stored in `localStorage` key `lm-speech-enabled`. When OFF, only MediaRecorder runs (no SpeechRecognition created). | Toggle persists across sessions, Web Speech only activates when ON. 2 tests. |
| W16.2.3 | Storage quota UI: usage indicator + warning | 2 | Storage usage bar using `navigator.storage.estimate()`. Shows "X MB used of ~Y MB". Warning toast at 75% and 90% (two thresholds per CLAUDE.md). Bulk delete option for old recording sessions (oldest first). Feature-detect: if `estimate()` unavailable, show "Storage usage unavailable on this browser." | Usage displays correctly, warning triggers at thresholds, bulk delete removes oldest session + cascade. 4 tests. |
| W16.2.4 | Photo capture disclaimer (first-use) | 0.5 | One-time toast: "Ensure you have permission to photograph this content." Stored in `localStorage` key `lm-photo-ack`. | Shows once on first photo capture, never shown again. 1 test. |

**Days 3-4 test target:** +9 tests (679 total)

---

## Day 5: Accessibility Audit (2h)

**Dependencies:** W16.1, W16.2, W16.0 (all new components exist)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W16.3.1 | Accessibility audit of all new v0.5.0 components | 2 | Audit scope: recorder controls, photo button, confusion vote button, heatmap, privacy toggle, storage quota bar, info-toasts. Check: `role`, `tabindex`, keyboard handlers (`Enter`/`Space`), `focus-visible`, ARIA labels, touch targets >= 44px (WCAG) / 56px (preferred). Timer `aria-live="polite"`. Color contrast on heatmap bars. | Zero ARIA violations found. All interactive elements keyboard-operable. Touch targets meet minimum. Fixes applied in-session. |

**Day 5 test target:** +2 tests (681 total)

---

## Estimated Total: ~19.35h

| Block | Hours | Tests |
|-------|-------|-------|
| Day 0: UX Bug Fixes | 4.35 | +6 |
| Days 1-2: Confusion Heatmap | 8 | +12 |
| Days 3-4: Privacy + Storage Quota | 5 | +9 |
| Day 5: Accessibility Audit | 2 | +2 |
| **Total** | **~19.35** | **+29 (681 target)** |

---

## Dependency Chain

```
Day 0 (UX fixes):
  W16.0.1 (SW version) ---------> no dependencies
  W16.0.2 (toast fix) ----------> no dependencies
  W16.0.3 (analytics CSS) ------> no dependencies
  W16.0.4 (recorder CSS) -------> no dependencies
  W16.0.5 (backend guard) ------> no dependencies
  W16.0.6 (empty state CTA) ----> no dependencies
  (All Day 0 tasks are independent — can be done in any order)

Days 1-2 (heatmap):
  W16.1.1 (aggregation fn) -----> W15.5 (confusion vote data exists)
  W16.1.2 (bar chart component)-> no dependencies (takes data as input)
  W16.1.3 (tab integration) ----> W16.1.1 + W16.1.2
  W16.1.4 (summary stats) ------> W16.1.1

Days 3-4 (privacy + storage):
  W16.2.1 (privacy toast) ------> W15.2 (record view exists)
  W16.2.2 (speech toggle) ------> W15.2 (record view exists)
  W16.2.3 (storage quota) ------> W15.1 (IDB stores exist)
  W16.2.4 (photo disclaimer) ---> W15.3 (photo capture exists)
  (W16.2.x tasks are independent of each other)

Day 5 (a11y audit):
  W16.3.1 ----------------------> W16.0.x + W16.1.x + W16.2.x (all components must exist)
```

---

## Cut Line (if behind schedule)

Cut from bottom up. W17 contingency absorbs overflow.

| Priority | Task | Cut Impact | Push To |
|----------|------|------------|---------|
| CUT LAST | Day 0 UX fixes (W16.0.x) | Live demo stays broken — unacceptable | N/A (must ship) |
| CUT 5th | Privacy toast + speech toggle (W16.2.1-2.2) | P0 scope — should not cut | W17 |
| CUT 4th | Heatmap aggregation + component (W16.1.1-1.2) | Voting data captured but invisible | W17 |
| CUT 3rd | Heatmap tab integration + stats (W16.1.3-1.4) | Partial heatmap, no tab yet | W17 |
| CUT 2nd | Storage quota UI (W16.2.3) | No usage visibility — acceptable short-term | W17 |
| CUT 1st | A11y audit (W16.3.1) | Deferred polish — lowest risk | W19 |

**Minimum viable W16:** Day 0 UX fixes + Privacy controls (W16.2.1-2.2). This fixes live demo and ships P0 privacy requirements. Heatmap and quota can overflow to W17 contingency.

---

## Blocked Tasks

| ID | Task | Blocked By | Unblock Condition |
|----|------|------------|-------------------|
| W16.B1 | Aggregate confusion across users | Multi-user auth system | v0.7.0 — local personal data only for v0.5.0 |

---

## Not In Scope

| Task | Why Deferred |
|------|--------------|
| Professor Dashboard | v0.7.0 — needs multi-user backend |
| Tesseract.js OCR on photos | v0.6.0 — ship photos first, validate demand |
| Real Whisper transcription | v1.0.0 — stub is sufficient for v0.5.0 |
| Auto-Notes Framework | Week 18 — separate focus week |
| v0.5.0 release | Week 19 — release after all features complete |
| W19 deferred tech debt (blob revoke, save click test, etc.) | Week 19 polish — tracked in CLAUDE.md |

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | SVG heatmap complexity (responsive + accessible) | HIGH | MEDIUM | Plan already uses HTML/CSS bar chart (not SVG). analytics.js has no hand-written SVG to reuse. HTML div bars with CSS gradient are simpler and WCAG compliant. |
| R2 | UX fixes take longer than 4h (hidden complexity) | MEDIUM | LOW | Day 0 tasks are all isolated one-file changes. W17 contingency available if overflow. |
| R3 | `navigator.storage.estimate()` not available on all browsers | LOW | MEDIUM | Feature-detect with fallback to "storage usage unavailable" message |
| R4 | Backend guard in app.js touches legacy code (~3500 lines) | MEDIUM | LOW | Minimal change: add guard function + call at init. Do not refactor surrounding code. |
| R5 | analytics.css token replacement breaks existing dashboard styling | MEDIUM | MEDIUM | Map each `--sp-*` token to exact `token.css` equivalent before editing. Visual regression check on dashboard after change. |

---

## Completion Criteria

- [ ] All 6 UX bugs from Day 6 research fixed and tested
- [ ] Recorder toasts show visible text (not blank white boxes)
- [ ] Analytics dashboard responds to dark mode toggle
- [ ] Recorder UI uses app cyan, not purple
- [ ] Backend guard hides demo sections on GitHub Pages
- [ ] SW cache version is `lm-v0.5.0`
- [ ] Confusion heatmap renders on lecture detail view with color gradient
- [ ] Privacy info-toast and Web Speech toggle working and persisted
- [ ] Storage quota indicator showing usage with warning at 75%/90%
- [ ] Photo capture disclaimer shows on first use
- [ ] All new components keyboard accessible with proper ARIA
- [ ] 29+ new tests added (target: 681 total)
- [ ] All 652+ existing tests still pass (zero regressions)
- [ ] No release in this week — release is in Week 19
