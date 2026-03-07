# Week 18 Task Plan

**Date Range:** 2026-03-30 to 2026-04-05
**Goal:** Auto-Notes Framework -- extractive summarization + LLM API integration
**Status:** DRAFT

---

## Prerequisites

- [ ] Week 17 gate passed (heatmap + privacy + quota working)
- [ ] 617+ tests passing
- [ ] Transcript stub service operational (provides text to summarize)
- [ ] No P0 bugs from Weeks 15-17

---

## Days 1-2: Extractive Summarization Engine (5h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W18.1.1 | Integrate TextRank/TF-IDF library (client-side) | 1.5h | Evaluate `text-summarizer` (~5KB) or `sum.js`. Import as ES module. No server needed. | Library imported, basic `summarize(text)` call works in test |
| W18.1.2 | `notes-engine.js` -- extractive pipeline | 2h | Input: transcript text (string or segments[]). Output: structured notes (key sentences, grouped by time chunks). Chunk transcript into 2-5 minute blocks, extract top 2-3 sentences per chunk. | 8+ tests: empty input, single segment, long transcript, edge cases |
| W18.1.3 | Notes data model + repository | 1.5h | `createAutoNote` factory. Fields: id, lectureId, content (HTML/Markdown), source ('extractive'|'llm'), generatedAt, editedAt. `AutoNoteRepository` with put/get/getByLecture. | CRUD tests pass (5+ tests) |

---

## Days 3-4: LLM API Integration + Notes UI (7h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W18.2.1 | API key management in Settings | 1.5h | Settings section: "AI Notes API Key" input (password field). Claude API only for v0.5.0 (OpenAI lacks browser CORS support). Key stored in localStorage as plaintext (honest — localStorage is not secure storage, but acceptable for user's own API key on their own device). Clear key button. Warning: "Your key is stored locally on this device only." | Key persists, masked display, clearable |
| W18.2.2 | LLM API client (`llm-client.js`) | 2h | Client: `generateNotes(transcript, apiKey) -> Promise<string>`. Claude API only (uses `anthropic-dangerous-direct-browser-access: true` header for browser CORS). Sends transcript chunks, receives structured notes. Error handling: invalid key, rate limit, network error, CORS failure. OpenAI support deferred until backend proxy exists. | 6+ tests: mock API responses, error cases, CORS header present |
| W18.2.3 | "Notes" tab in lecture detail view | 2h | New tab alongside segments/flashcards/bookmarks/confusion. Shows auto-generated notes. "Regenerate" button. Toggle: extractive (free) vs LLM (requires key). Notes editable via contentEditable div. | Tab renders, notes display, editing works, saves to IDB |
| W18.2.4 | Export notes as Markdown/HTML | 1h | "Export Notes" button on Notes tab. Downloads as `.md` or `.html` file. Uses Blob + URL.createObjectURL + `<a download>`. | File downloads with correct content |
| W18.2.5 | Auto-generate notes after transcription | 0.5h | After transcript stub completes, auto-run extractive summarization. If LLM key configured, offer "Enhance with AI" button. | Notes appear automatically after recording flow |

---

## Estimated Total: 12h

---

## Architecture Notes

- `notes-engine.js` at L2 (parallel to recorder.js and analytics.js) -- imports from dom-utils + flashcards only
- `llm-client.js` is a pure utility (no DOM, no IDB) -- imported by notes-engine.js
- Notes tab registered via the existing lecture detail tab system in library.js
- `autoNotes` IDB store is created in the v1→v2 migration (Week 15) along with the other 4 new stores -- all 5 stores are created before any v0.5.0 release ships
- API key in localStorage, NOT in IndexedDB (simpler, no migration needed)
- LLM API calls go directly from browser to Claude API only (uses `anthropic-dangerous-direct-browser-access` header). OpenAI deferred to v0.6.0 when backend proxy exists.

### Dependency:
```
dom-utils.js <- flashcards.js <- notes-engine.js (L2, imports llm-client.js)
                              <- recorder.js (L2)
                              <- analytics.js (L2)
                                    all <- library.js (L3)
```

---

## Not In Scope

| Task | Why Deferred |
|------|--------------|
| Real-time notes during recording | Post-processing only for v0.5.0 |
| Built-in API key (our cost) | User provides own key -- zero cost model |
| Speaker diarization | v1.0.0 -- requires advanced Whisper features |
| PDF export | Markdown/HTML sufficient for v0.5.0 |
| Generative summarization without API key | Extractive is the free tier |

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | TextRank library quality insufficient | MEDIUM | LOW | Evaluate 2-3 libraries in W18.1.1, pick best |
| R2 | Claude/GPT API breaking changes | LOW | LOW | Abstract behind llm-client.js interface |
| R3 | API key stored in plaintext localStorage | LOW | CERTAIN | Acceptable: user's own key on their own device. Warn in UI. Offer clear button. No more secure option exists in browser without a backend. |
| R4 | LLM API rate limits on large transcripts | MEDIUM | MEDIUM | Chunk transcript into 3000-token blocks, send sequentially, respect rate limits |
| R5 | Claude API CORS from browser requires `anthropic-dangerous-direct-browser-access` header | MEDIUM | LOW | Header is documented and supported. Test in W18 Day 3 first thing. If blocked: fall back to extractive-only for v0.5.0, add LLM in v0.6.0 with backend proxy. Decision point in ROADMAP. |
| R6 | OpenAI API does not support browser CORS | MEDIUM | CERTAIN | Defer OpenAI support to v0.6.0 when backend proxy is available. Claude-only for v0.5.0. |

---

## Completion Criteria

- [ ] Extractive notes generated from any transcript (free, offline)
- [ ] LLM-powered notes working with user-provided Claude API key
- [ ] Notes tab visible in lecture detail view
- [ ] Notes editable and exportable (Markdown/HTML)
- [ ] API key management in Settings (store, display masked, clear)
- [ ] 15+ new tests added (target: 632+ total)
- [ ] All existing tests still pass
