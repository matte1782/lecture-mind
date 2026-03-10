# Week 17 Task Plan (CONTINGENCY)

**Date Range:** 2026-03-23 to 2026-03-29
**Goal:** Overflow from Weeks 15-16, or early v0.5.1/v0.6.0 prep
**Status:** DRAFT -- only activate if needed

---

## Activation Criteria

This week is used ONLY if:
- Week 15 or 16 tasks spilled over
- Hostile review returned BLOCK on v0.5.0
- iOS spike revealed issues needing additional work

If Weeks 15-16 complete on schedule, use for v0.5.1/v0.6.0 preparation spikes.

---

## Prerequisites

- [ ] Week 16 complete OR overflow tasks clearly identified
- [ ] v0.5.0 release status determined (released or blocked)

---

## Overflow Tasks (if needed)

| ID | Task | Hours | Original | Acceptance |
|----|------|-------|----------|------------|
| W17.1 | Hostile review fixes | 4 | W16 gate | All BLOCK/CAUTION issues resolved, re-review >= 85/100 |
| W17.2 | Heatmap polish (if degraded to table in W16) | 2 | W16.1 | SVG heatmap renders with color gradient, responsive |
| W17.3 | Recording edge cases (pause/resume, error recovery) | 4 | W15.1 | Pause/resume works, error states tested (6+ tests) |
| W17.4 | Photo gallery polish (lightbox, zoom) | 2 | W15.2 | Photos viewable at full resolution, keyboard navigable |
| W17.5 | Storage quota edge cases | 2 | W16.2 | Bulk delete works, quota warning tested across browsers |

---

## Early v0.5.1/v0.6.0 Prep (if on schedule)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W17.6 | Spike: TextRank/TF-IDF library evaluation | 2 | Evaluate feasibility + pick best JS library for Week 18 Auto-Notes extractive engine | Spike doc in docs/research/ |
| W17.7 | Spike: Tesseract.js OCR | 2 | OCR integration design for captured photos -- evaluate for v0.6.0 | Spike doc with bundle size impact, accuracy expectations |
| W17.8 | Spike: Professor Dashboard architecture | 2 | Multi-user design for v0.7.0 -- auth, data model, API surface | Spike doc with architecture diagram, scope estimate |
| W17.10 | Performance baseline measurements | 2 | Measure: IDB read/write latency, photo resize time, audio chunk storage speed | Baseline doc with numbers, identify bottlenecks |

---

## Estimated Total: 14h overflow OR 14h spikes (not both)

---

## Not In Scope

| Task | Why Deferred |
|------|--------------|
| Implementing any v0.5.1/v0.6.0 features | Spikes only -- no implementation |
| Professor Dashboard build | v0.7.0 -- spike design only |
| Real Whisper integration | v1.0.0 -- spike feasibility only |
| Multi-user backend | v0.7.0+ -- architecture spike only |

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | Overflow consumes entire week | MEDIUM | LOW | Prioritize BLOCK fixes over polish items |
| R2 | Spike results invalidate v0.6.0 plan | LOW | MEDIUM | Document findings honestly, adjust roadmap if needed |

---

## Completion Criteria

- [ ] v0.5.0 on track for Week 19 release (or overflow tasks resolved)
- [ ] All overflow tasks resolved (if any were activated)
- [ ] v0.5.1/v0.6.0 spikes documented in docs/research/
- [ ] Clean handoff to next development phase
- [ ] ROADMAP.md updated with spike findings
