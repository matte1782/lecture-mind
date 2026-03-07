# v0.5.0 Plans Consistency Review

**Reviewer:** HOSTILE_REVIEWER
**Date:** 2026-03-07
**Initial Score: 31/100 — REJECT**
**Final Score: 85/100 — APPROVED** (after all fixes applied)

---

## Issues Found and Fixed

### Critical (all fixed)

| # | Issue | Location | Fix Applied |
|---|-------|----------|-------------|
| C1 | autoNotes store missing from DB migration code | ARCHITECTURE §9 | Added `autoNotes` store + indexes to migration block |
| C2 | Modified files table missing notes-engine.js, llm-client.js, AutoNote model | ARCHITECTURE §5 | Added all 3 entries |
| C3 | Section 4 had old 2.5-week timeline conflicting with new calendar | ROADMAP §4 | Rewrote §4 to 5-week breakdown |
| C4 | WEEK16 still had release tasks (Day 5) | WEEK16 | Moved release to WEEK19; W16 Day 5 = a11y audit |
| C5 | LLM API CORS not addressed (OpenAI has no browser CORS) | WEEK18 | Claude-only for v0.5.0; OpenAI deferred to v0.6.0 with proxy |

### Major (all fixed)

| # | Issue | Location | Fix Applied |
|---|-------|----------|-------------|
| M1 | Store count inconsistency (3 vs 4 vs 5) | Multiple docs | Unified to 5 stores everywhere |
| M2 | Auto-Notes data flow missing | ARCHITECTURE | Added §10.3 Auto-Notes Flow |
| M3 | API key storage security not addressed | WEEK18 | Plaintext localStorage, warning in UI, justification documented |
| M4 | Cut list in ROADMAP §5 missing Auto-Notes | ROADMAP §5 | Added Auto-Notes to cut priority table |
| M5 | WEEK17 still referenced v0.5.1 for Auto-Notes spikes | WEEK17 | Updated to reference Week 18; removed duplicate LLM spike |
| M6 | Budget mismatch (51h vs 68h vs 84h) | ROADMAP header | Fixed to 68h core + 16h contingency = 84h max |
| M7 | Test count 60 vs 83 inconsistency | ROADMAP §7 | Updated to 83 new tests, target 640+ total |

### Minor (all fixed)

| # | Issue | Fix |
|---|-------|-----|
| m1 | ARCHITECTURE footer still said ~51h | Updated to ~68h, 4-5 weeks |
| m2 | WEEK15 prereq said old 51h/2.5wk scope | Updated to 68h/4-5 weeks |
| m3 | WEEK17 completion criteria said v0.5.0 from W16 | Updated to W19 |
| m4 | ROADMAP §6 decision points missing W18 CORS check | Added CORS gate decision point |
| m5 | CLAUDE.md still had old 51h/2.5-week scope table | Updated to full 68h scope with Auto-Notes + week column |
| m6 | ROADMAP version table still had v0.5.1 as Auto-Notes | Removed v0.5.1 row; Auto-Notes is now in v0.5.0 |
| m7 | WEEK16 total hours said 20h but tasks added to 15h | Fixed to 15h |
| m8 | WEEK16 test target said 617+ | Updated to 612+ (matches new schedule) |

---

## Final Status: APPROVED

All 20 issues (5 critical, 7 major, 8 minor) resolved.
Plans are internally consistent across: ROADMAP_V050, ARCHITECTURE_v050, WEEK15-19, CLAUDE.md.

Ready to begin Week 15 Day 0 implementation.
