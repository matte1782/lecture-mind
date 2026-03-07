# v0.5.0 "Live Capture" -- System Architecture

**Version:** 0.5.0
**Author:** ARCHITECT
**Status:** APPROVED
**Date:** 2026-03-07

---

## 1. Overview

v0.5.0 adds live capture capabilities to the Student Playground, enabling students to record lectures directly from their browser and correlate photos with audio timestamps.

**Features in scope:**

1. **Live Audio Capture** -- MediaRecorder (all browsers) + Web Speech API (live transcript on Android Chrome). Audio stored locally in IndexedDB.
2. **Photo Capture** -- Timestamped photos via file input, canvas-resized to 1920px at 80% JPEG quality. No OCR.
3. **SP4-lite: Personal Confusion Markers** -- Binary confusion voting per segment + heatmap visualization on lecture detail.
4. **Auto-Notes Framework** -- Extractive summarization (TextRank/TF-IDF, free/offline) + LLM-powered notes (user-provided Claude API key). "Notes" tab in lecture detail.
5. **DB Migration v1 to v2** -- Four new IndexedDB stores: recordingSessions, audioData, photoCaptures, autoNotes. (`confusionVotes` already exists in v1.)
6. **Privacy** -- Info-toast at first recording, Web Speech API toggle (default OFF), photo responsibility toast.
7. **Storage Quota UI** -- Usage indicator with warning thresholds.

**Explicitly cut from v0.5.0 (deferred):**

- Professor Dashboard (needs multi-user backend) -- v0.6.0
- Tesseract.js OCR (ship photos first, validate demand) -- v0.6.0
- OpenAI API support for notes (no browser CORS) -- v0.6.0 with backend proxy
- Confusion intensity scale (1-5) -- replaced by binary voting
- Real Whisper transcription -- stub in v0.5.0, real in v1.0.0
- Aggregate confusion analytics -- v0.6.0

All features are local-first. No backend endpoints are introduced in v0.5.0. Transcription is a stub. LLM API calls go directly from browser to Claude API (user's own key).

---

## 2. System Diagram

```
                      index.html
                          |
          +---------------+---------------+
          |               |               |
      app.js          sw.js          [ES Module Graph]
    (legacy)        (service             |
                     worker)    dom-utils.js          (L0)
                                    |
                               flashcards.js          (L1 - router, study)
                                 /     \
                          analytics.js  recorder.js   (L2 - parallel)
                                 \     /
                               library.js             (L3)
                                    |
                               storage/
                               +-- db.js
                               +-- models.js
                               +-- repositories.js
                               +-- migrations.js   (DB_VERSION 1 -> 2)
                               +-- sync.js
                               +-- index.js
```

There is no backend component in v0.5.0. No `/api/transcribe` endpoint. Transcription is a stub service inside `recorder.js` that returns placeholder data.

---

## 3. Dependency Chain (AD-1 Extended)

### Current (v0.4.0)

```
dom-utils.js <- flashcards.js <- analytics.js <- library.js
     L0              L1               L2              L3
```

### v0.5.0

```
dom-utils.js <- flashcards.js <- analytics.js  <- library.js
     L0              L1       <- recorder.js        L3
                                   L2
```

`recorder.js` sits at L2, parallel to `analytics.js`. Both import from flashcards.js (L1). `library.js` (L3) imports from both L2 modules.

### Dependency Rules (enforced)

| Rule | Description |
|------|-------------|
| L0 imports nothing | `dom-utils.js` and pure utilities are leaf modules. A module with zero internal project imports and no DOM/IDB side effects beyond `fetch` is L0 by definition. |
| L1 imports only L0 | `flashcards.js` imports `dom-utils.js` only |
| L2 imports L0 and L1 | `recorder.js`, `analytics.js`, `notes-engine.js` import from `dom-utils.js` and `flashcards.js` |
| L3 imports L0, L1, L2 | `library.js` can import from any lower layer |
| No upward imports | Never. L2 never imports L3. L1 never imports L2. L2 never imports L2. |
| No cross-L2 imports | `recorder.js` cannot import `notes-engine.js`. Notes generation must be orchestrated by L3 (`library.js`) or via DOM events. |

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| `recorder.js` at L2 | Needs flashcards.js exports (navigateTo, registerViewCleanup) but NOT analytics or library |
| `recorder.js` does NOT import `library.js` | After recording, calls `navigateTo('#/lecture/:id')`. Library picks it up on next render. No coupling. |
| No `professor.js` | Professor Dashboard deferred to v0.6.0. No L4 module in this release. |

---

## 4. New Files

| File | Layer | Purpose | Est. Lines |
|------|-------|---------|------------|
| `recorder.js` | L2 | MediaRecorder + Web Speech API + photo capture + recording UI | ~700 |
| `recorder.test.js` | test | Tests for recorder.js (MediaRecorder mock, getUserMedia, IDB, photo resize) | ~300 |
| `recorder.css` | style | Record button, timer, photo thumbnail grid, mobile-first layout | ~150 |
| `notes-engine.js` | L2 | TextRank/TF-IDF extractive summarization + notes persistence | ~300 |
| `notes-engine.test.js` | test | Tests for extractive pipeline (300+ lines; covers empty, single-sentence, long, stopword-only, Unicode input) | ~300 |
| `llm-client.js` | **L0** | Claude API client (user-provided key, direct browser CORS). Zero internal imports — pure `fetch` wrapper. | ~150 |

---

## 5. Modified Files

| File | Changes |
|------|---------|
| `flashcards.js` | Add `VIEWS.RECORD` to router. Add parseHash case for `#/record`. Add `setRecordRenderer(fn)` hookable callback. Export it. |
| `index.html` | Add `<section id="record-view">` section. Add nav link for Record. |
| `storage/db.js` | Bump `DB_VERSION` to 2. Add 4 new stores to STORES constant (`confusionVotes` already there). |
| `storage/models.js` | Add factories: `createRecordingSession`, `createAudioData`, `createPhotoCapture`, `createAutoNote`. (`createConfusionVote` already exists.) |
| `storage/repositories.js` | Add repos: `RecordingSessionRepository`, `AudioDataRepository`, `PhotoCaptureRepository`, `AutoNoteRepository`. Add `toggle()` to existing `ConfusionVoteRepository`. |
| `storage/migrations.js` | Migration v1 to v2: create 4 new object stores. (`confusionVotes` pre-existing, skipped.) |
| `storage/index.js` | Re-export 4 new repositories. (`ConfusionVoteRepository` already exported.) |
| `sw.js` | Add `recorder.js`, `recorder.css`, `notes-engine.js`, `llm-client.js` to `STATIC_ASSETS`. Bump `CACHE_NAME` to `lm-v0.5.0`. |
| `library.js` | Add confusion vote button on segment cards. Add photo gallery to lecture detail. Add confusion heatmap tab. |
| `analytics.js` | Add `getConfusionAggregates(lectureId)` for heatmap data. |
| `sw.js` | Add `recorder.js`, `recorder.css` to STATIC_ASSETS. |
| `playground-components.css` | Add confusion vote button styles, heatmap gradient CSS custom properties. |

---

## 6. Routes

### New Route

| Route | View Name | Section ID | Renderer Location |
|-------|-----------|------------|-------------------|
| `#/record` | record | `record-view` | `recorder.js` via `setRecordRenderer` |

### Router Changes in flashcards.js

```
VIEWS = {
  LANDING: 'landing',
  PLAYGROUND: 'playground',
  STUDY: 'study',
  LECTURE_DETAIL: 'lecture-detail',
  DASHBOARD: 'dashboard',
  RECORD: 'record'           // NEW
};

parseHash addition:
  'record' -> { view: VIEWS.RECORD, params: {} }
```

### HTML Section to Add

```html
<section id="record-view" class="app-section hidden" aria-label="Record Lecture" inert>
  <div class="record-container"></div>
</section>
```

---

## 7. Hookable Renderer Pattern

Following the established pattern from v0.4.0 (`setLibraryRenderer`):

```
flashcards.js exports:
  setRecordRenderer(fn)  -- called by recorder.js on module load

recorder.js on load:
  import { setRecordRenderer } from './flashcards.js';
  setRecordRenderer(renderRecordView);

flashcards.js mountView():
  case VIEWS.RECORD:
    if (_recordRenderer) _recordRenderer(container);
    break;
```

This preserves AD-1: flashcards.js never imports from recorder.js. The downstream module registers itself.

---

## 8. Storage Models

### 8.1 RecordingSession

```
Store: recordingSessions
KeyPath: id
Indexes: lectureId, status, createdAt

Fields:
  id: string (UUID)
  lectureId: string|null     -- null until transcription completes and lecture is created
  title: string              -- user-provided or auto ("Recording 2026-03-06 14:30")
  status: 'recording' | 'stopped' | 'transcribing' | 'completed' | 'failed'
  duration: number           -- total duration in seconds
  sampleRate: number         -- audio sample rate (e.g. 44100)
  mimeType: string           -- e.g. 'audio/webm;codecs=opus'
  transcript: string|null    -- raw transcript text (populated after stub transcription)
  error: string|null         -- error message if failed
  createdAt: number
  updatedAt: number
```

### 8.2 AudioData

```
Store: audioData
KeyPath: id (same as RecordingSession.id)

Fields:
  id: string          -- matches RecordingSession.id
  blob: Blob          -- concatenated audio data
  size: number        -- blob size in bytes
```

Audio is stored as a single Blob per recording session. Codec negotiation selects the best available format:

```
isTypeSupported('audio/webm;codecs=opus')   -> preferred (~20MB/90min at 32kbps)
isTypeSupported('audio/mp4;codecs=aac')     -> fallback
'audio/wav'                                 -> last resort
```

### 8.3 PhotoCapture

```
Store: photoCaptures
KeyPath: id
Indexes: recordingSessionId, timestampMs

Fields:
  id: string (UUID)
  recordingSessionId: string  -- links to RecordingSession.id
  timestampMs: number         -- ms offset from recording start
  blob: Blob                  -- JPEG image data
  size: number                -- blob size in bytes
  caption: string|null        -- optional user caption
  createdAt: number
```

Photos are captured via `<input type="file" accept="image/*">` (triggers camera on mobile). Images are resized on a canvas element to max 1920px on the longest edge and compressed to 80% JPEG quality (~0.5MB each).

There is no `ocrText` field. OCR is deferred to v0.5.1+.

### 8.4 ConfusionVote

```
Store: confusionVotes        -- EXISTS IN v1 (not new in v2)
KeyPath: id
Indexes: lectureId, segmentId

Fields (matches production models.js:454):
  id: string (UUID)
  lectureId: string
  segmentId: string
  comment: string             -- optional user note, defaults to ''
  createdAt: number           -- timestamp when vote was cast
```

Confusion voting is binary (confused or not). There is no intensity field. A vote exists or it does not.
The `confusionVotes` store was created in v1 and is NOT new in the v1→v2 migration.
The only new work for v0.5.0 is adding a `toggle(segmentId, lectureId)` method to the
existing `ConfusionVoteRepository` (with a per-key mutex — see CLAUDE.md anti-patterns).

### 8.5 AutoNote

```
Store: autoNotes
KeyPath: id
Indexes: lectureId, generatedAt

Fields:
  id: string (UUID)
  lectureId: string
  content: string             -- generated notes (Markdown format)
  source: 'extractive' | 'llm'  -- how the notes were generated
  model: string|null          -- LLM model used (e.g. 'claude-opus-4-6'), null for extractive
  generatedAt: number
  editedAt: number|null       -- null until student edits the notes
```

One AutoNote per lecture (upsert by lectureId). Student edits are saved back to the same record.

---

## 9. DB Migration (v1 to v2)

```
DB_VERSION: 1 -> 2

onupgradeneeded(event):
  if (event.oldVersion < 2) {
    // Create new object stores
    // NOTE: confusionVotes already exists in v1 — createObjectStore() skips it if present.
    // Only 4 stores are genuinely new in v2.

    const rsStore = db.createObjectStore('recordingSessions', { keyPath: 'id' });
    rsStore.createIndex('lectureId', 'lectureId', { unique: false });
    rsStore.createIndex('status', 'status', { unique: false });
    rsStore.createIndex('createdAt', 'createdAt', { unique: false });

    db.createObjectStore('audioData', { keyPath: 'id' });

    const pcStore = db.createObjectStore('photoCaptures', { keyPath: 'id' });
    pcStore.createIndex('recordingSessionId', 'recordingSessionId', { unique: false });
    pcStore.createIndex('timestampMs', 'timestampMs', { unique: false });

    const anStore = db.createObjectStore('autoNotes', { keyPath: 'id' });
    anStore.createIndex('lectureId', 'lectureId', { unique: true });   // enforces one-per-lecture
    anStore.createIndex('generatedAt', 'generatedAt', { unique: false });
  }
```

Migration is forward-only. Existing v1 data (lectures, segments, flashcards, studySessions, events) is untouched.

---

## 10. Data Flows

### 10.1 Live Recording Flow

```
Step 1: User taps "Record" (nav link)
  -> navigateTo('#/record')
  -> flashcards.js routes to record-view
  -> recorder.js renders recording UI

Step 2: User taps "Start Recording"
  -> navigator.mediaDevices.getUserMedia({ audio: true })
  -> MediaRecorder starts (codec negotiated via isTypeSupported)
  -> Optional: Web Speech API starts if user enabled toggle
  -> RecordingSession created in IDB (status: 'recording')
  -> UI shows: timer + live transcript (if Web Speech ON) + stop button + photo button

Step 3: During recording
  -> ondataavailable: chunks accumulate in memory array
  -> Web Speech API: live transcript displayed in real-time
  -> Photo button: opens file input -> canvas resize -> store in photoCaptures with timestampMs

Step 4: User taps "Stop"
  -> MediaRecorder.stop()
  -> Web Speech API stops (if running)
  -> All chunks concatenated into single Blob
  -> Blob saved to audioData store
  -> RecordingSession updated (status: 'stopped', duration computed)

Step 5: Stub transcription
  -> Stub service generates placeholder transcript + segments
  -> Create Lecture in IDB from stub data
  -> Create Segments in IDB from stub data
  -> Link photos to lecture via recordingSessionId
  -> RecordingSession.lectureId = new lecture ID
  -> RecordingSession.status = 'completed'
  -> navigateTo('#/lecture/' + lectureId)
```

Note: Real Whisper transcription is deferred to v1.0.0. The stub service demonstrates the full flow with mock data.

### 10.2 Confusion Voting Flow

```
Step 1: Student views lecture detail (#/lecture/:id, segments tab)
  -> Each segment card shows a "Confused?" button

Step 2: Student taps "Confused?" on a segment
  -> Toggle behavior:
     - If no vote exists: ConfusionVote created in IDB
     - If vote exists: ConfusionVote deleted from IDB
  -> Button visual state updates (active/inactive)
  -> Toast: "Confusion marked" / "Confusion cleared"

Step 3: Confusion heatmap (analytics tab in lecture detail)
  -> ConfusionVoteRepository queries by lectureId
  -> analytics.js getConfusionAggregates(lectureId) returns [{ segmentId, voteCount }]
  -> Rendered as timeline heatmap:
     - X axis: lecture timeline (0 to duration)
     - Color: green (0 votes) -> red (votes present)
     - Segment bars colored by vote count
  -> Also shown as sorted list: "Most confusing segments"
```

### 10.3 Auto-Notes Flow

**Call site:** `library.js` (L3) is the legal orchestrator. Two options:
- **Option A (lazy):** library.js calls `notes-engine.js runExtractive()` on first Notes tab open.
- **Option B (immediate):** `recorder.js` dispatches `new CustomEvent('lectureCreated', { detail: { lectureId } })` after transcription; `library.js` listens and calls `notes-engine.js`.

Decision must be made before W18 implementation. Recorder.js CANNOT import notes-engine.js (same L2 layer — violates AD-1 no-cross-L2 rule).

```
Step 1: After stub transcription completes (triggered by library.js on Notes tab open OR via lectureCreated event)
  -> notes-engine.js runExtractive(transcript) -> string (Markdown bullets)
  -> AutoNote created in IDB (source: 'extractive')
  -> "Notes" tab in lecture detail shows auto-generated notes

Step 2 (optional): User has Claude API key configured in Settings
  -> "Enhance with AI" button visible on Notes tab
  -> User clicks -> llm-client.js generateNotes(transcript, apiKey)
  -> POST to https://api.anthropic.com/v1/messages
     Headers: { 'x-api-key': apiKey, 'anthropic-dangerous-direct-browser-access': 'true' }
  -> Response parsed -> formatted Markdown notes
  -> AutoNote updated in IDB (source: 'llm', model: 'claude-opus-4-6')

Step 3: Student edits notes
  -> <textarea> on Notes tab (NOT contentEditable — avoids stored XSS; see §17)
  -> Content stored as plain Markdown string (no HTML)
  -> On blur: check editedAt !== null; if edits exist and user clicks Regenerate, show confirmation
  -> AutoNote.content updated in IDB, editedAt set
  -> Toast: "Notes saved"

Step 4: Export
  -> "Export" button -> downloads .md file via Blob + URL.createObjectURL
```

Decision point (Week 18 Day 3): Test CORS header. If browser blocks the request despite
`anthropic-dangerous-direct-browser-access`, fall back to extractive-only for v0.5.0 and
add LLM integration in v0.6.0 behind a backend proxy.

### 10.4 Photo Capture Flow

```
Step 1: During active recording, user taps photo button
  -> <input type="file" accept="image/*" capture="environment"> opens
  -> On mobile: triggers camera app
  -> On desktop: opens file picker

Step 2: File selected
  -> Image loaded into off-screen canvas
  -> Resized to max 1920px on longest edge (aspect ratio preserved)
  -> Compressed to 80% JPEG via canvas.toBlob()
  -> PhotoCapture created in IDB with timestampMs = Date.now() - recordingStartTime
  -> Thumbnail appears in recording UI

Step 3: After recording completes
  -> Photos linked to lecture via recordingSessionId
  -> Photos displayed in lecture detail photo gallery
  -> Each photo shows its timestamp offset in the recording
```

---

## 11. Privacy Architecture

| Trigger | Mechanism | Storage |
|---------|-----------|---------|
| First recording | Info-toast: "Audio is recorded and stored locally on your device." | `localStorage: recordingToastAcknowledged` |
| Web Speech API toggle ON | Info-toast: "Live transcription sends audio to Google's servers." | `localStorage: webSpeechToastAcknowledged` |
| First photo capture | Info-toast: "You are responsible for obtaining permission to photograph." | `localStorage: photoToastAcknowledged` |

**Design principles:**

- Info-toasts, not blocking dialogs. A local-first personal tool should not gate features behind modal consent flows.
- Web Speech API defaults to OFF. Enabling it is an explicit opt-in because it sends audio to Google.
- All audio/photo data stays in local IndexedDB. Nothing is sent to any server in v0.5.0.
- GDPR household exemption applies: this is a personal study tool, not a service processing others' data.

---

## 12. Performance Budget

| Operation | Target | Notes |
|-----------|--------|-------|
| Audio recording start | <500ms | getUserMedia permission prompt is browser-controlled |
| Audio Opus 32kbps / 90min | ~20MB | Within IDB limits |
| Photo resize + store | <2s per photo | Canvas resize + JPEG encode + IDB put |
| Photo JPEG 1920px 80% | ~0.5MB each | Acceptable for gallery display |
| Confusion vote write | <10ms | Single IDB put |
| Confusion aggregate query | <50ms | Index scan on lectureId |
| Storage quota check | <100ms | `navigator.storage.estimate()` |

---

## 13. Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Microphone denied | `getUserMedia` rejection | Show permission instructions, disable record button |
| MediaRecorder unsupported | `typeof MediaRecorder === 'undefined'` | Show "Browser not supported" message |
| Tab suspended (iOS Safari) | Recording stops unexpectedly | Save partial audio blob + warn user |
| IDB quota exceeded | `DOMException QuotaExceeded` | Warn user, offer to delete old recordings |
| Web Speech auto-stops | `onend` event fires during recording | Auto-restart recognition with gap logging |
| Photo kills audio (iOS) | iOS spike result (Day 0.5) | Disable photo button during recording on iOS |
| IDB version upgrade blocked | `onblocked` event | Prompt user to close other tabs |
| Recording interrupted (tab close) | `beforeunload` event (unreliable on iOS) | Save partial audio + set status to 'stopped'. **On next app init:** query `getByStatus('recording')` — any session older than 10 min → set `status: 'failed'`, `error: 'Orphaned'`. Show failed sessions in recordings list with delete button. |
| Audio blob too large | Size check after stop | Warn, suggest shorter recordings |

---

## 14. Mobile-First Design

Live Capture is primarily a mobile feature. Students record in lecture halls using their phones.

### Design Constraints

| Constraint | Solution |
|------------|----------|
| One-handed operation | Record button 56px+ touch target, bottom-anchored |
| Screen must stay on | Screen Wake Lock API (`navigator.wakeLock.request('screen')`). Re-acquire on `visibilitychange` → `'visible'` during active recording. Show lock-status icon in timer bar. |
| iOS background suspension | "Keep this tab open" warning banner |
| Small screen | Minimal recording UI: timer + live transcript + stop + photo button |
| Network unavailable | Fully local-first. No backend needed. |
| Accessibility | Record button has `aria-label`, timer uses `aria-live="polite"` |

### Record View Layout (Mobile)

```
+---------------------------+
|  < Back    Record Lecture  |
|                           |
|   Title: [____________]   |
|                           |
|        00:45:30           |
|     "Recording..."        |
|                           |
|  [photo1] [photo2] [+]   |
|                           |
|  Live transcript:         |
|  "...and the key idea     |
|   here is that..."        |
|                           |
|    ( STOP )  ( PHOTO )    |
+---------------------------+
```

### Record View Layout (Desktop)

```
+------------------------------------------------+
|  < Back to Library    Record Lecture            |
|                                                |
|  +------------------------------------------+  |
|  |              00:45:30                    |  |
|  |           "Recording..."                 |  |
|  |                                          |  |
|  |  Live transcript:                        |  |
|  |  "...and the key idea here is that..."   |  |
|  |                                          |  |
|  |       ( STOP )     ( PHOTO )             |  |
|  +------------------------------------------+  |
|                                                |
|  Photos:                                       |
|  [photo1 00:12] [photo2 00:23] [photo3 00:45]  |
|                                                |
|  Settings:                                     |
|  [ ] Enable live transcription (Web Speech)    |
|  Title: [________________]                     |
+------------------------------------------------+
```

---

## 15. Audio Strategy

### Codec Negotiation

```
Priority order (checked via MediaRecorder.isTypeSupported):
1. audio/webm;codecs=opus   -- smallest, best quality/size (Chrome, Firefox)
2. audio/mp4;codecs=aac     -- Safari fallback
3. audio/wav                -- last resort (10x larger)
```

### Web Speech API

- Default OFF. User must enable via toggle.
- `continuous: true` mode for ongoing recognition.
- Known issue: Chrome may auto-stop after silence. Mitigation: listen for `onend`, auto-restart with `setTimeout(() => recognition.start(), 100)` — NOT immediate call, which throws `InvalidStateError`. Catch `InvalidStateError` and retry after 500ms.
- Android Chrome: full support. iOS Safari: SpeechRecognition not available.
- Transcript is best-effort live text. Not stored permanently (the stub transcription generates the final transcript).

### Storage Sizing

| Duration | Opus 32kbps | AAC 64kbps | WAV 16-bit 16kHz |
|----------|-------------|------------|-------------------|
| 30 min | ~7MB | ~14MB | ~56MB |
| 60 min | ~14MB | ~29MB | ~113MB |
| 90 min | ~20MB | ~43MB | ~169MB |

---

## 16. Storage Quota UI

- Use `navigator.storage.estimate()` to get `{ usage, quota }`.
- Display usage bar in Record view and Library view.
- Warning thresholds:
  - 75% usage: yellow indicator.
  - 90% usage: red indicator + "Consider deleting old recordings" message.
- List recordings by size with delete buttons.

---

## 17. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Microphone access | Only requested on explicit user action (tap Start Recording). Permission prompt is browser-controlled. |
| Audio data privacy | Audio stored only in local IndexedDB. Never sent to any server in v0.5.0. |
| Photo data privacy | Photos stored only in local IndexedDB. Never uploaded. |
| Web Speech API data | Toggle defaults to OFF. When ON, audio is sent to Google for recognition. Info-toast warns the user. |
| XSS in transcript display | Transcripts rendered via `textContent`, never `innerHTML`. Same safe DOM pattern as v0.4.0. |
| Photo blob injection | Photos are **unconditionally** re-encoded via canvas + `toBlob()` (even if under 1920px) — this is enforced in W15.2.2 spec. Canvas decode discards EXIF in Chrome/Firefox; this is browser behaviour not a W3C guarantee, but is the strongest available mitigation without a server. |
| SW cache | `recorder.js` and `recorder.css` added to known `STATIC_ASSETS` list. Origin check enforced. |

---

## 18. Trade-offs and Alternatives

### Audio Storage: IndexedDB vs. File System Access API

**Chosen: IndexedDB**
- Pros: Universal browser support, offline-first, simple API, self-contained
- Cons: IDB bloat for long recordings (~20MB per 90min with Opus)
- Alternative rejected: File System Access API has poor mobile support (no Safari, no Firefox)
- Future: Consider OPFS in v1.0 for large-file handling

### Recorder Module Placement: L2 vs. L3

**Chosen: L2 (parallel to analytics.js)**
- Pros: Minimal imports (only dom-utils + flashcards), clean separation
- Cons: Cannot directly call library.js functions
- Mitigation: Uses `navigateTo('#/lecture/:id')` to hand off to library.js after recording

### Confusion Voting: Binary vs. Intensity Scale

**Chosen: Binary (confused or not)**
- Pros: Simplest possible UX (one tap), no slider needed, easy toggle semantics
- Cons: Less granular data
- Alternative rejected: 1-5 intensity scale adds UI complexity and extra model fields for uncertain benefit in single-user context
- Future: Intensity can be added in v0.6.0 alongside multi-user aggregation where granularity matters

### Transcription: Stub vs. Real Whisper

**Chosen: Stub service in v0.5.0**
- Pros: No backend dependency, ships faster, validates the full recording flow
- Cons: Generated transcripts are placeholder data
- Future: Real Whisper integration in v1.0.0

### Photo Capture: During Recording vs. After Only

**Chosen: During recording (with iOS caveat)**
- Pros: Photos correlated with exact timestamp in the lecture
- Cons: On iOS, opening camera may kill MediaRecorder audio stream
- Mitigation: iOS spike (Day 0.5) determines behavior. If photo kills audio on iOS, disable photo button during active recording on iOS only.

---

## 19. ADR References

| ADR | Title | Status |
|-----|-------|--------|
| ADR-0005 | Recorder module at dependency level L2 | Proposed |
| ADR-0006 | Audio storage in IndexedDB for v0.5.0 | Proposed |
| ADR-0007 | Binary confusion voting for v0.5.0 | Proposed |
| ADR-0008 | DB migration strategy v1 to v2 | Proposed |
| ADR-0009 | Stub transcription service for v0.5.0 | Proposed |

---

## ARCHITECT: Design Complete

Artifacts:
- `docs/architecture/ARCHITECTURE_v050.md` (this file)

Status: APPROVED

Scope: v0.5.0 "Live Capture" (Option B+photo-light + Auto-Notes, ~68h, 4-5 weeks)

---

*ARCHITECT -- Good design makes implementation obvious.*
