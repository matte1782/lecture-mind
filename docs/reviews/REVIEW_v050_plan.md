# v0.5.0 Plan Review -- Hostile Assessment

**Reviewer:** HOSTILE_REVIEWER
**Date:** 2026-03-06
**Artifact:** v0.5.0 Plan Proposal (3 features)

---

## Overall Score: 34/100
## Recommendation: BLOCK

The proposal as written is incoherent. It mixes a brand-new feature (Live Lecture Mode) with two deferred features (SP4, SP7) that were explicitly scoped for v0.5.0 in the roadmap. The Live Lecture Mode alone would consume the entire 40h budget. SP4 and SP7 together require multi-user backend infrastructure that does not exist. The combination of all three is fantasy planning.

---

## Feature 1: Live Lecture Mode

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Scope Creep | 15/100 | This single feature could easily consume 60-80h. It touches audio recording, transcription pipeline, auto-segmentation, auto-flashcard generation, and mobile browser compatibility. |
| Feasibility | 25/100 | Multiple fatal technical risks (see below). |
| User Value | 55/100 | Genuinely useful IF it works, but competing with mature apps (Otter.ai, Notion AI, etc). |
| Privacy | 20/100 | Recording lectures raises serious GDPR/university policy issues with zero mitigation plan. |
| Architecture | 25/100 | Introduces entirely new subsystems (MediaRecorder, audio pipeline, transcript-to-entity pipeline). |
| **Verdict** | **BLOCK** | |

### Critical Issues (BLOCKING)

**[C1] iOS Safari MediaRecorder support is unreliable.**
MediaRecorder on iOS Safari has historically been buggy, with limited codec support (no `audio/webm`; requires `audio/mp4`). The proposal says "mobile browser" but provides zero evidence of iOS compatibility testing. A feature targeting "students on their phone" that does not work on roughly 50% of phones is DOA.

**[C2] Whisper on CPU for 90-minute lecture is not "simple" or "one-tap."**
Whisper base on CPU processes approximately 1x real-time for short clips but degrades to 0.3-0.5x for long audio due to memory pressure and chunking overhead. A 90-minute lecture would take 3-5 hours on CPU. The proposal says "local processing" as an option but provides no latency budget or fallback strategy.

**[C3] No audio storage plan.**
Where does raw audio go? IndexedDB has a practical limit of 500MB-2GB depending on browser. A 90-minute lecture at 128kbps is approximately 86MB. Four lectures fill a significant chunk of storage. No mention of cleanup, compression, or storage limits.

**[C4] No GDPR/privacy analysis for lecture recording.**
Recording a professor's lecture without explicit consent may violate university policy and GDPR Article 6. Many EU universities explicitly prohibit student recording. The proposal mentions "free, simple, one-tap" with zero legal consideration.

**[C5] Scope alone exceeds 40h budget.**
Conservative estimate for Live Lecture Mode: ~58h total -- exceeds 40h budget for ALL of v0.5.0.

### Major Issues

**[M1] No dependency analysis.** Does Live Mode require changes to the AD-1 chain?

**[M2] Competing with established products.** Otter.ai, Notion AI, Apple Notes transcription, and Google Recorder all do this already, for free, with better quality. What is the differentiation?

**[M3] No acceptance criteria.** "Target: free, simple, one-tap" is a marketing slogan, not an acceptance criterion.

### Suggested Cuts

Live Lecture Mode should be **deferred entirely** to v0.6.0 or later, after a dedicated technical spike (4h) to validate:
1. MediaRecorder cross-browser compatibility (especially iOS Safari)
2. Whisper CPU latency for 30/60/90min audio
3. Storage budget for audio blobs in IndexedDB
4. University recording policy survey

---

## Feature 2: SP4 -- Confusion Analytics

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Scope Creep | 55/100 | Scoped in original roadmap; manageable if limited to local-only. |
| Feasibility | 40/100 | "Aggregate" and "anonymous" imply multi-user, but no backend exists for this. |
| User Value | 30/100 | Single-student confusion voting is a bookmark with extra steps. |
| Privacy | 70/100 | Anonymous local voting has minimal privacy risk. |
| Architecture | 60/100 | `createConfusionVote` model already exists in `storage/models.js`. |
| **Verdict** | **CAUTION** | |

### Critical Issues

**[C6] "Aggregate" requires multi-user data -- no backend exists.**

**[C7] "Anonymous voting" is meaningless for a single user.**

### What Would Make SP4 APPROVABLE

Strip SP4 to **local-only single-user confusion marking**:
1. Student taps "confused" button during segment playback
2. Confusion markers appear on segment timeline (personal heatmap)
3. Student can review their own confusion hotspots
4. No aggregation, no "anonymous" claims, no export
5. Estimated effort: 10-12h

---

## Feature 3: SP7 -- Professor Dashboard

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Scope Creep | 20/100 | Requires entirely new user role, new API endpoints, new data pipeline. |
| Feasibility | 15/100 | Cannot work without multi-user backend, authentication, and data aggregation. |
| User Value | 45/100 | High value IF multi-user infrastructure exists. Zero value without it. |
| Privacy | 35/100 | "Anonymous" aggregation requires careful implementation. |
| Architecture | 15/100 | Requires: auth system, role-based access, aggregation API. None exist. |
| **Verdict** | **BLOCK** | |

### Critical Issues

**[C8] No authentication system exists.**
**[C9] No multi-user data pipeline.**
**[C10] "Most-replayed segments" requires server-side event tracking.**
**[C11] Privacy risk with small class sizes.**

### Suggestion

SP7 should be **deferred to v0.6.0 or v1.0.0** when multi-user infrastructure exists.

---

## Recommended v0.5.0 Scope

### APPROVED for v0.5.0 (estimated 35-40h)

| Feature | Hours | Rationale |
|---------|-------|-----------|
| SP4-lite: Personal confusion markers | 12h | Student marks confused segments; personal heatmap on timeline. |
| SP3-complete: Progress tracking polish | 8h | SP3 was "Partial" in v0.4.0. Complete it. |
| Tech debt cleanup | 8h | getCSSVar tests, renderConfetti, LICENSE, dead exports. |
| Multi-user backend spike | 6h | Design doc only: auth model, aggregation API, data flow. |
| analytics.js test coverage | 6h | Currently only 18 tests for 1240 lines. Bring to 40+. |

### DEFERRED to v0.6.0+

| Feature | Reason |
|---------|--------|
| Live Lecture Mode | Requires technical spike, iOS validation, privacy analysis |
| SP7: Professor Dashboard | Requires multi-user backend |
| SP4-full: Aggregate confusion | Requires multi-user backend |

---

## Risk Matrix

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| R1 | Live Mode consumes entire budget | CRITICAL | 90% | Defer entirely |
| R2 | "Anonymous aggregation" impossible without multi-user backend | CRITICAL | 100% | Strip aggregation |
| R3 | iOS Safari MediaRecorder breaks Live Mode | HIGH | 75% | Technical spike first |
| R4 | Professor Dashboard ships without auth | CRITICAL | 50% | Defer until auth exists |
| R5 | Scope creep from 40h to 80h+ | HIGH | 70% | Hard cut at 40h |

---

## Findings Summary

- **Critical (BLOCKING): 11**
- **Major (MUST FIX): 7**
- **Minor: 0**

---

## VERDICT

```
+---------------------------------------------------+
|   HOSTILE_REVIEWER: REJECT                        |
|                                                   |
|   Critical Issues: 11                             |
|   Major Issues: 7                                 |
|   Minor Issues: 0                                 |
|                                                   |
|   Disposition: BLOCK all three features as        |
|   proposed. Resubmit with reduced scope per       |
|   "Recommended v0.5.0 Scope" above. Live Mode     |
|   requires technical spike. Professor Dashboard   |
|   requires multi-user backend (v0.6.0+).          |
+---------------------------------------------------+
```

*HOSTILE_REVIEWER -- Trust nothing. Verify everything.*
