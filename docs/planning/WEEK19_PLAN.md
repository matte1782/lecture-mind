# Week 19 Task Plan

**Date Range:** 2026-04-06 to 2026-04-12
**Goal:** Polish, hostile review, and v0.5.0 release (with contingency buffer)
**Status:** DRAFT

---

## Prerequisites

- [ ] Weeks 15-18 features complete (audio, photo, confusion, notes)
- [ ] 632+ tests passing
- [ ] No P0 bugs outstanding

---

## Days 1-2: Integration Testing + Edge Cases (6h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W19.1.1 | End-to-end flow testing: record -> photo -> stop -> notes -> library | 2h | Full user journey test across all new features | Manual walkthrough on Chrome + mobile passes |
| W19.1.2 | Edge case tests for recorder.js | 1.5h | Pause/resume, error recovery, mic denied, tab suspension, very long recording (>60min mock) | 5+ new edge case tests |
| W19.1.3 | Edge case tests for notes-engine.js | 1h | Empty transcript, single word, very long text, special characters, API timeout | 4+ new edge case tests |
| W19.1.4 | Cross-browser smoke test | 1.5h | Test on Chrome, Firefox, Safari (if available). Document any browser-specific issues. | Test report written |

---

## Day 3: Accessibility + Performance Audit (4h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W19.2.1 | Full accessibility audit of all v0.5.0 features | 2h | Keyboard navigation, screen reader, focus management, ARIA roles, touch targets >= 44px, color contrast | Zero WCAG 2.1 AA violations |
| W19.2.2 | Performance measurement | 1h | Measure: recording start time, photo resize time, notes generation time, IDB read/write latency | All within performance budget targets |
| W19.2.3 | Mobile usability check | 1h | Test record flow on mobile viewport (375px). Verify one-handed operation, touch targets, scroll behavior | All buttons reachable, no horizontal overflow |

---

## Day 4: Hostile Review + Fixes (4h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W19.3.1 | Run hostile reviewer on full v0.5.0 | 2h | Write review to `docs/reviews/REVIEW_v050_final_gate.md`. Target >= 85/100. | Review file written |
| W19.3.2 | Fix critical/major issues from review | 2h | Address any BLOCKING or MUST-FIX findings | All critical issues resolved, score >= 85 |

---

## Day 5: Release (3h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W19.4.1 | Update CHANGELOG.md | 1h | Document: live capture, photo, confusion voting/heatmap, auto-notes, privacy, storage quota | Complete and accurate |
| W19.4.2 | Update docs (ROADMAP.md, README, guide) | 0.5h | Mark v0.5.0 released, update feature list, add Auto-Notes to user guide | Docs current |
| W19.4.3 | Update SW static assets | 0.25h | Add all new JS/CSS files to sw.js STATIC_ASSETS | SW caches everything |
| W19.4.4 | Final test run | 0.25h | All 640+ tests pass | Green |
| W19.4.5 | Tag v0.5.0 + GitHub release + deploy | 1h | Git tag, GitHub release with full description, deploy playground to GH Pages | Release live |

---

## Estimated Total: 17h (includes contingency buffer for Week 15-18 overflow)

If Weeks 15-18 complete cleanly, only ~10h needed for release prep. Remaining ~7h available for:
- Additional test coverage
- Documentation improvements
- Early v0.6.0 spikes (Tesseract.js, Professor Dashboard)

---

## Contingency Tasks (if overflow from earlier weeks)

| ID | Task | Hours | Original |
|----|------|-------|----------|
| W19.C1 | Auto-Notes edge cases / LLM provider fixes | 3h | W18 |
| W19.C2 | Heatmap polish | 2h | W17 |
| W19.C3 | Photo gallery improvements | 2h | W16 |
| W19.C4 | Recording error recovery | 2h | W15 |

---

## Not In Scope

| Task | Why Deferred |
|------|--------------|
| Professor Dashboard | v0.6.0 |
| Tesseract.js OCR | v0.6.0 |
| Multi-user features | v1.0.0 |
| Real Whisper integration | v1.0.0 |

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | Hostile review returns BLOCK | HIGH | LOW | 2h buffer for fixes, previous reviews informed all decisions |
| R2 | Cross-browser issues discovered late | MEDIUM | MEDIUM | Document as known issues, fix critical only |
| R3 | GH Pages deploy fails | LOW | LOW | Already solved in v0.4.0, same process |

---

## Completion Criteria

- [ ] All v0.5.0 features working: audio capture, photo, confusion, auto-notes, privacy, quota
- [ ] 640+ tests passing, 0 failures
- [ ] Hostile review score >= 85/100
- [ ] CHANGELOG.md, ROADMAP.md, README updated
- [ ] v0.5.0 tagged and released on GitHub
- [ ] Playground deployed to GH Pages
- [ ] No known P0 bugs
