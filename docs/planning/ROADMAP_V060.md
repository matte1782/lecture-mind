# v0.6.0 "Vision" -- Implementation Roadmap

**Version:** 1.0.0
**Author:** PLANNER
**Status:** DRAFT (pending v0.5.0 release)
**Duration:** 3-4 weeks
**Budget:** 48h core + 10h contingency = 58h max
**Trigger:** Hostile review of v0.5.0 (score 35/100 for slides/notes handling)

---

## Executive Summary

- **Goal:** Make captured photos intelligent -- extract text from slides, support handwritten notes, integrate visual content into auto-notes and search. Transform photos from "dumb JPEGs" into searchable, study-integrated content.
- **Critical Path:** Tesseract.js integration -> OCR on photos -> search integration -> Auto-Notes v2 (multi-source) -> Claude Vision for handwriting -> manual notes import -> release
- **Major Risks:** (1) Tesseract.js slow on mobile (~1-5s/photo), (2) handwriting OCR accuracy, (3) ~6MB lazy-load download for Tesseract WASM + language data
- **UX Principle:** Zero-tap OCR. Student takes a photo, text appears below it within seconds. Google Lens is the UX benchmark.

---

## 1. Priority Stack

### P0 -- Must Ship (cuts here mean no release)

| Feature | MVP Definition | Hours |
|---------|---------------|-------|
| **Tesseract.js OCR on photos** | Automatic client-side OCR after every photo capture. Tesseract.js WASM (~2MB) + English language data (~4MB), lazy-loaded on first use. Runs in Web Worker to avoid blocking UI. Results stored in `ocrText` field (already exists as null in v0.5.0). | 12h |
| **OCR text search integration** | Extend existing library search to index `ocrText` from photos. Photos become searchable by slide content. Search results show photo thumbnail + matched text. | 4h |
| **Auto-Notes v2: multi-source** | Modify `notes-engine.js runExtractive()` to accept `{ transcript, slideTexts[] }`. Notes combine spoken + visual content. LLM mode sends both transcript and slide text to Claude API. | 6h |

### P1 -- Should Ship (release is weaker without these)

| Feature | MVP Definition | Hours |
|---------|---------------|-------|
| **Claude Vision for handwriting/diagrams** | Extend `llm-client.js` to send photo blobs to Claude Vision API (user's own key). Handles handwriting, diagrams, complex layouts that Tesseract.js can't. Uses claude-sonnet-4-6 for cost-effectiveness (~$0.005/image). | 6h |
| **Manual notes import** | Students photograph handwritten notes -> OCR -> stored as AutoNote with `source: 'imported'`. Photo gallery shows "Import Notes" button. | 4h |
| **Photo-segment correlation** | Associate photos with specific lecture segments based on timestamp overlap. Show slide content alongside segment text in lecture detail. | 4h |

### P2 -- Nice to Have (cut first if behind schedule)

| Feature | MVP Definition | Hours |
|---------|---------------|-------|
| **Batch OCR on existing photos** | "Process all unscanned photos" button for photos captured in v0.5.0 before OCR existed. Progress bar with cancel. | 2h |
| **OCR language selection** | Allow users to select Tesseract language packs beyond English in Settings. Lazy-download additional language data. | 2h |
| **OCR confidence indicator** | Show confidence score on extracted text. Low-confidence results highlighted with "May be inaccurate" warning. | 2h |

---

## 2. Feature MVPs (Smallest Useful Version)

### Tesseract.js OCR MVP

What it IS:
- Automatic OCR on every captured photo (zero user action needed)
- Tesseract.js v5+ running in a dedicated Web Worker
- ~6MB total download (WASM core + English trained data), lazy-loaded and cached by SW
- Results stored in `PhotoCapture.ocrText` and `PhotoCapture.ocrStatus`
- Processing indicator: shimmer skeleton under photo thumbnail while OCR runs
- 1-5 seconds per photo on mobile, <1s on desktop
- 85-95% accuracy on printed slides (English)

What it is NOT:
- No real-time OCR during camera preview (post-capture only)
- No multi-language support in MVP (English only, others in P2)
- No layout analysis (text extracted as flat string, not preserving slide structure)
- No diagram/chart interpretation (text only; Claude Vision handles these)

### Claude Vision MVP

What it IS:
- "Enhance with AI" button on photos with low OCR confidence or handwriting
- Sends photo to Claude API with vision capability
- Returns structured text + description of diagrams/charts
- Uses same API key mechanism as Auto-Notes LLM (already in v0.5.0)
- Cost: ~$0.005 per image (claude-sonnet-4-6)

What it is NOT:
- Not automatic (user-triggered, costs money)
- No batch processing (one photo at a time)
- No real-time streaming of results

### Manual Notes Import MVP

What it IS:
- "Import Notes" button in photo gallery or Notes tab
- Opens camera/file picker -> photo captured -> OCR runs -> text stored as AutoNote
- Source marked as `'imported'` (distinct from 'extractive' and 'llm')
- Student can edit imported text like any other note
- Export as Markdown

What it is NOT:
- No handwriting-specific preprocessing
- No multi-page document scanning
- No automatic segmentation of handwritten content

---

## 3. Architecture Decisions

### AD-16: OCR Module Position

```
ocr-utils.js (L0) -- pure Tesseract.js wrapper, zero internal imports
  |
  +-- Called by recorder.js (L2) after photo capture
  +-- Called by library.js (L3) for batch processing and photo gallery
```

`ocr-utils.js` is a leaf module at L0. It wraps Tesseract.js Worker initialization and provides `extractText(blob) -> Promise<{text, confidence, status}>`. No DOM, no IDB -- pure utility.

### AD-17: Claude Vision Integration

Extend existing `llm-client.js` (L0) with:
```javascript
export async function extractFromImage(blob, apiKey) {
  // Convert blob to base64
  // POST to Claude API with image content block
  // Return { text, description }
}
```

Same API key, same CORS header (`anthropic-dangerous-direct-browser-access`), same error handling as Auto-Notes LLM. No new module needed.

### AD-18: Auto-Notes v2 Interface Change

```javascript
// v0.5.0 (current)
runExtractive(transcript) -> string

// v0.6.0 (new)
runExtractive({ transcript, slideTexts }) -> string
```

`slideTexts` is an array of `{ timestampMs, text }` from photo OCR results. The extractive pipeline treats them as additional "sentences" weighted by temporal proximity to transcript chunks.

### AD-19: OCR Processing Pipeline

```
Photo captured
  -> ocrStatus = 'pending'
  -> Web Worker: Tesseract.js extractText(blob)
  -> Success: ocrStatus = 'completed', ocrText = result
  -> Failure: ocrStatus = 'failed', ocrText = null
  -> UI updates inline (shimmer -> text or error)
```

OCR runs asynchronously. Student can continue taking photos while previous ones process. No blocking.

---

## 4. Data Model

### Already in v0.5.0 (prep fields, always null)

```
PhotoCapture:
  ocrText: string|null       -- null in v0.5.0, populated by OCR in v0.6.0
  ocrStatus: string|null     -- null | 'pending' | 'completed' | 'failed'

AUTO_NOTE_SOURCE:
  EXTRACTIVE: 'extractive'
  LLM: 'llm'
  IMPORTED: 'imported'       -- new in v0.5.0 prep
```

### DB Migration (v0.6.0): Likely DB_VERSION 2 -> 3

If we need to query photos by OCR status (e.g., "find all pending photos for batch processing"), we need an index on `ocrStatus`. This requires a DB_VERSION bump:

```javascript
if (event.oldVersion < 3) {
  const pcStore = transaction.objectStore('photoCaptures');
  pcStore.createIndex('ocrStatus', 'ocrStatus', { unique: false });
}
```

**Decision point:** If batch OCR (P2) is cut, we may not need this index. Evaluate during implementation.

---

## 5. UX Requirements (from hostile review)

These are NON-NEGOTIABLE:

1. **Zero-tap OCR:** Automatic after photo capture. No "Run OCR" button for basic use.
2. **Inline results:** OCR text displays directly under photo thumbnail, not in separate modal.
3. **One-tap import:** Photo of handwritten notes -> OCR -> Notes tab. One action.
4. **Graceful loading:** Shimmer skeleton during OCR, not blocking spinner. Can keep taking photos.
5. **Error transparency:** "Could not read text clearly" with photo still visible.
6. **No settings for basic use:** Tesseract.js works with zero configuration.

**UX benchmark:** Google Lens. If a student can't see extracted text within 10 seconds, the feature has failed.

---

## 6. Technical Details

### Tesseract.js Integration

- **Library:** tesseract.js v5+ (WASM-based)
- **Loading:** Lazy -- only downloaded on first photo capture or manual trigger
- **Size:** ~2MB WASM core + ~4MB English trained data = ~6MB total
- **Caching:** Added to SW STATIC_ASSETS after first download
- **Worker:** Dedicated Web Worker (required to avoid blocking main thread)
- **Accuracy:** 85-95% on printed slides, 60-80% on handwriting (English)
- **Speed:** 1-5s per photo on mobile, <1s on desktop

### Claude Vision API

- **Endpoint:** `https://api.anthropic.com/v1/messages` with image content blocks
- **Header:** `anthropic-dangerous-direct-browser-access: true`
- **Model:** claude-sonnet-4-6 (cost-effective: ~$0.005/image)
- **Capabilities:** Printed text, handwriting, diagrams, charts, code, multi-column
- **Auth:** User's own API key (same as Auto-Notes, stored in localStorage)

### Cost Model

| Usage | Images/week | Tesseract (free) | Claude Vision |
|-------|------------|------------------|---------------|
| Light | 10 | $0 | ~$0.05/week |
| Medium | 50 | $0 | ~$0.25/week |
| Heavy | 100 | $0 | ~$0.50/week |

---

## 7. Week-by-Week Breakdown

### Week 20 (post v0.5.0 release): OCR Foundation

**Focus:** Tesseract.js integration + automatic OCR pipeline
**Hours:** 16h

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Days 1-2 | ocr-utils.js: Tesseract.js wrapper + Web Worker setup | 6h | OCR utility module, lazy loading, caching |
| Days 3-4 | Photo capture OCR pipeline: auto-trigger after capture + inline display | 6h | Zero-tap OCR working end-to-end |
| Day 5 | Search integration: index ocrText, show in results | 4h | Photos searchable by slide content |

**New tests:** ~20. **New files:** ocr-utils.js, ocr-utils.test.js

### Week 21: Auto-Notes v2 + Claude Vision

**Focus:** Multi-source notes + enhanced OCR for handwriting
**Hours:** 14h

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Days 1-2 | Auto-Notes v2: modify runExtractive() for multi-source input | 6h | Notes incorporate slide text |
| Days 3-4 | Claude Vision: extend llm-client.js + "Enhance with AI" button | 6h | Handwriting/diagram support |
| Day 5 | Photo-segment correlation | 2h | Slide content shown alongside segments |

**New tests:** ~15

### Week 22: Import + Polish + Release

**Focus:** Manual notes import + batch OCR + review + release
**Hours:** 12h

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Day 1 | Manual notes import flow | 4h | Photo -> OCR -> Notes tab |
| Day 2 | Batch OCR for v0.5.0 photos + language selection (P2) | 4h | Retroactive OCR |
| Day 3 | Hostile review + fixes | 2h | Review score >= 85 |
| Day 4 | CHANGELOG, docs, tag v0.6.0 | 2h | Release |

**New tests:** ~8

### Week 23: CONTINGENCY

**Activation:** Only if Weeks 20-22 overflow or hostile review returns BLOCK.
**Hours:** Up to 10h

---

## 8. Cut Line

If behind schedule, cut in this order (bottom first):

| Priority | Feature | Cut Impact |
|----------|---------|------------|
| CUT LAST | Tesseract.js OCR (P0) | No release without this |
| CUT 5th | OCR search integration (P0) | Photos extracted but not searchable |
| CUT 4th | Auto-Notes v2 multi-source (P0) | Notes still transcript-only |
| CUT 3rd | Claude Vision (P1) | Tesseract-only, no handwriting |
| CUT 2nd | Manual notes import (P1) | Import deferred to v0.7.0 |
| CUT 1st | Batch OCR + language selection (P2) | Nice-to-have only |

**Minimum viable release:** Tesseract.js OCR on photos + search integration. This alone closes the biggest product gap identified in the hostile review.

---

## 9. What is CUT from v0.6.0 (Deferred)

| Feature | Deferred To | Reason |
|---------|-------------|--------|
| Professor Dashboard | v0.7.0 "Community" | Still needs multi-user backend |
| Aggregate confusion analytics | v0.7.0 | Needs multi-user |
| Broader audience rebranding | v0.7.0 | Marketing, not engineering |
| Multi-language OCR packs | v0.6.1 if demand | English-first MVP |
| PDF/document scanning | v0.7.0+ | Scope creep risk |

---

## 10. Dependencies

```
Week 20:
  W20.1 (ocr-utils.js) ---------> v0.5.0 released (PhotoCapture.ocrText field exists)
  W20.2 (OCR pipeline) ----------> W20.1 (utility exists)
  W20.3 (search integration) ----> W20.2 (ocrText populated)

Week 21:
  W21.1 (Auto-Notes v2) --------> W20.2 (slide texts available)
  W21.2 (Claude Vision) ---------> W20.1 (llm-client.js exists from v0.5.0 W18)
  W21.3 (photo-segment) ---------> W20.2 (OCR data exists)

Week 22:
  W22.1 (notes import) ----------> W20.1 + W21.1 (OCR + notes pipeline)
  W22.2 (batch OCR) -------------> W20.2 (OCR pipeline)
  W22.3 (hostile review) --------> W22.1 (all features complete)
  W22.4 (release) ---------------> W22.3 (review passes)
```

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tesseract.js slow on mobile (>5s) | MEDIUM | MEDIUM | Web Worker + progress indicator + "Processing..." shimmer |
| Tesseract.js poor on handwriting | HIGH | LOW | Claude Vision as enhanced fallback |
| 6MB Tesseract download on mobile data | MEDIUM | MEDIUM | Lazy-load, warn about download, cache in SW |
| Claude Vision CORS blocked | LOW | LOW | Already validated in v0.5.0 W18 |
| ocrStatus index needs DB migration | MEDIUM | LOW | Only if batch OCR (P2) ships; can defer |
| Auto-Notes v2 interface change breaks tests | LOW | LOW | Backward-compatible: `runExtractive(text)` still works if string passed |

---

*PLANNER -- Simplest solution that works. AI prepares, Human decides.*
