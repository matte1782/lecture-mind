# v0.5.0 "Professor Edition + Live Lecture Mode" — System Architecture

**Version:** 0.5.0-DRAFT
**Author:** ARCHITECT
**Status:** PROPOSED
**Date:** 2026-03-06

---

## 1. Overview

v0.5.0 introduces three features on top of the v0.4.0 Student Playground:

1. **Live Lecture Mode** — Record audio in-browser, transcribe via backend, auto-create lectures with segments and flashcards.
2. **SP4: Confusion Analytics** — Per-segment confusion voting with local aggregation and heatmap visualization.
3. **SP7: Professor Dashboard** — Aggregate view of confusion hotspots, replay data, quiz performance, and CSV export. In v0.5.0 this operates in "local simulation mode" (single user acts as both student and professor).

All three features are local-first. No multi-user backend is introduced in v0.5.0.

---

## 2. System Diagram

```
                          index.html
                              |
              +---------------+---------------+
              |               |               |
          app.js          sw.js          [ES Module Graph]
        (legacy)        (service             |
                         worker)    dom-utils.js          (L0 - leaf)
                                        |
                                   flashcards.js          (L1 - router, study)
                                     /     \
                              analytics.js  recorder.js   (L2 - NEW recorder)
                                     \     /
                                   library.js             (L3 - library grid)
                                        |
                                   professor.js           (L4 - NEW professor)
                                        |
                                   storage/
                                   +-- db.js
                                   +-- models.js      (+ RecordingSession, ConfusionVote already exists)
                                   +-- repositories.js (+ RecordingSessionRepository)
                                   +-- migrations.js   (DB_VERSION 1 -> 2)
                                   +-- sync.js
                                   +-- index.js

Backend (FastAPI):
  /api/transcribe   POST   (audio upload + Whisper transcription)
  /api/health       GET    (existing)
  /api/upload       POST   (existing — video)
  /api/status/:id   GET    (existing)
  /api/results/:id  GET    (existing)
```

---

## 3. Updated Dependency Chain (AD-1 extended)

**Current (v0.4.0):**
```
dom-utils.js <- flashcards.js <- analytics.js <- library.js
     L0              L1               L2              L3
```

**Proposed (v0.5.0):**
```
dom-utils.js <- flashcards.js <- analytics.js  <- library.js  <- professor.js
     L0              L1       <- recorder.js        L3              L4
                                   L2
```

### Key decisions:

| Decision | Rationale |
|----------|-----------|
| `recorder.js` at L2, parallel to `analytics.js` | Recorder needs flashcards.js exports (navigateTo, autoGenerateFlashcards) but NOT analytics or library. It sits at the same level as analytics. |
| `professor.js` at L4, below `library.js` | Professor dashboard aggregates data from library (lectures), analytics (quiz results), and confusion votes. It must sit below all of them. |
| `recorder.js` does NOT import `library.js` | After recording completes, recorder creates a Lecture + Segments in IndexedDB, then calls `navigateTo('#/lecture/:id')`. Library.js picks it up on next render. No circular dependency. |
| `professor.js` imports from library.js | Professor needs `renderConfusionHeatmap` data and lecture lists. This is allowed because professor.js sits below library.js. |

**Dependency rules (enforced):**
- L0 imports nothing from the module graph
- L1 imports only L0
- L2 imports L0 and L1
- L3 imports L0, L1, L2
- L4 imports L0, L1, L2, L3
- NO upward imports. NEVER.

---

## 4. New Files

| File | Layer | Purpose | Est. Lines |
|------|-------|---------|------------|
| `recorder.js` | L2 | MediaRecorder UI, audio capture, chunk management, backend transcription call, lecture creation | ~600 |
| `recorder.test.js` | test | Tests for recorder.js | ~200 |
| `professor.js` | L4 | Professor dashboard: confusion heatmap, replay stats, quiz aggregate, CSV export | ~800 |
| `professor.test.js` | test | Tests for professor.js | ~250 |
| `recorder.css` | style | Record button, waveform, timer, mobile-first layout | ~150 |
| `professor.css` | style | Dashboard grid, heatmap colors, export buttons | ~150 |

**Backend:**

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/vl_jepa/api/transcribe.py` | Whisper transcription endpoint, audio chunking, segment extraction | ~200 |

---

## 5. Modified Files

| File | Changes |
|------|---------|
| `flashcards.js` | Add VIEWS.RECORD and VIEWS.PROFESSOR to router. Add parseHash cases for `#/record` and `#/professor`. Add `setRecordRenderer` and `setProfessorRenderer` hookable callbacks. Export them. |
| `index.html` | Add `<section id="record-view">` and `<section id="professor-view">` sections. Add nav links for Record and Professor. |
| `storage/db.js` | Bump DB_VERSION to 2. Add `recordingSessions` store to STORES. |
| `storage/models.js` | Add `createRecordingSession`, `validateRecordingSession` factory/validator. Extend ConfusionVote model with `intensity` field (1-5 scale, default 1). |
| `storage/repositories.js` | Add `RecordingSessionRepository`. Add `getAggregateByLecture()` to ConfusionVoteRepository. |
| `storage/migrations.js` | Add migration from v1 to v2 (create `recordingSessions` store, add `intensity` field default to existing votes). |
| `storage/index.js` | Re-export new repository. |
| `library.js` | Add confusion voting UI to lecture detail segment list (thumbs-up/thumbs-down per segment). Add confusion heatmap to lecture detail analytics tab. |
| `analytics.js` | Add `getConfusionAggregates(lectureId)` function. Add replay tracking hooks (record which segments are replayed). |
| `sw.js` | Add new CSS/JS files to STATIC_ASSETS list. |
| `main.py` | Import and mount transcribe router. |
| `playground-components.css` | Add confusion vote button styles, heatmap gradient tokens. |

---

## 6. New Routes

| Route | View Name | Section ID | Renderer Location |
|-------|-----------|------------|-------------------|
| `#/record` | `record` | `record-view` | `recorder.js` via `setRecordRenderer` |
| `#/professor` | `professor` | `professor-view` | `professor.js` via `setProfessorRenderer` |

### Router changes in flashcards.js:

```
VIEWS = {
  LANDING: 'landing',
  PLAYGROUND: 'playground',
  STUDY: 'study',
  LECTURE_DETAIL: 'lecture-detail',
  DASHBOARD: 'dashboard',
  RECORD: 'record',           // NEW
  PROFESSOR: 'professor'      // NEW
};

parseHash additions:
  'record'    -> { view: VIEWS.RECORD, params: {} }
  'professor' -> { view: VIEWS.PROFESSOR, params: {} }
```

### HTML sections to add to index.html:

```html
<section id="record-view" class="app-section hidden" aria-label="Record Lecture" inert>
  <div class="record-container"></div>
</section>

<section id="professor-view" class="app-section hidden" aria-label="Professor Dashboard" inert>
  <div class="professor-container"></div>
</section>
```

---

## 7. New Storage Models

### 7.1 RecordingSession

```
Store: recordingSessions
KeyPath: id
Indexes: lectureId, status, createdAt

Fields:
  id: string (UUID)
  lectureId: string|null     — null until transcription completes and lecture is created
  title: string              — user-provided or auto ("Recording 2026-03-06 14:30")
  status: 'recording' | 'stopped' | 'transcribing' | 'completed' | 'failed'
  audioBlobs: number         — count of saved audio chunks (blobs stored in separate IDB store or as files)
  duration: number           — total duration in seconds
  sampleRate: number         — audio sample rate (e.g. 44100)
  mimeType: string           — e.g. 'audio/webm;codecs=opus'
  transcript: string|null    — raw transcript text (populated after transcription)
  error: string|null         — error message if failed
  createdAt: number
  updatedAt: number
```

**Design note on audio storage:** Raw audio blobs are large (1MB/min at 128kbps). Two options:

| Option | Pros | Cons |
|--------|------|------|
| A: Store blobs in IndexedDB | Simple, offline-first | IDB bloat, 50MB+ for 1hr lecture |
| B: Store as File System Access API | No IDB bloat | Limited browser support, permission prompts |

**Decision: Option A for MVP.** Store audio as a single Blob in a dedicated `audioData` store (key = recordingSession.id, value = Blob). This keeps the recording self-contained and offline-capable. For v1.0, migrate to OPFS (Origin Private File System) for better performance.

### 7.2 AudioData (companion store)

```
Store: audioData
KeyPath: id (same as RecordingSession.id)

Fields:
  id: string          — matches RecordingSession.id
  blob: Blob          — raw audio data
  size: number        — blob size in bytes
```

### 7.3 ConfusionVote (EXISTING — extended)

```
Store: confusionVotes (already exists)

Added fields:
  intensity: number   — 1 (slightly confused) to 5 (completely lost), default 1
```

The existing `createConfusionVote` factory and `ConfusionVoteRepository` already handle the basic CRUD. Extensions needed:

- `createConfusionVote` gains optional `intensity` parameter (default 1)
- `ConfusionVoteRepository.getAggregateByLecture(lectureId)` — returns `{ segmentId, voteCount, avgIntensity }[]`

### 7.4 ReplayEvent (reuse existing Event model)

No new store needed. Replay tracking uses the existing `events` store with a new event type:

```
EVENT_TYPES += ['segment_replay']

Event fields (existing):
  type: 'segment_replay'
  metadata: { segmentId: string, replayCount: number }
```

This requires adding `'segment_replay'` to the `EVENT_TYPES` array in `models.js`.

---

## 8. API Endpoints (Backend)

### 8.1 POST /api/transcribe

```
Request:
  Content-Type: multipart/form-data
  Body:
    file: audio file (webm, ogg, wav, mp3) — max 100MB
    title: string (optional)

Response (200):
  {
    "transcript": "Full transcript text...",
    "segments": [
      {
        "startTime": 0.0,
        "endTime": 30.5,
        "text": "Welcome to today's lecture..."
      },
      ...
    ],
    "duration": 3600.0,
    "language": "en",
    "flashcards": [
      { "front": "What is...", "back": "It is..." },
      ...
    ]
  }

Error responses:
  400: Invalid file format
  413: File too large
  429: Rate limited
  500: Transcription failed
```

**Implementation:** Uses OpenAI Whisper (whisper-large-v3 or whisper-base depending on hardware). Segments are split on silence boundaries (pydub or Whisper's own segmentation). Flashcards are optionally auto-generated from transcript using keyword extraction.

### 8.2 Offline fallback

When the backend is unavailable (GitHub Pages, no local server), the Record feature operates in **capture-only mode**:

1. Audio is recorded and saved to IndexedDB (audioData store)
2. RecordingSession status = 'stopped'
3. A banner shows: "Recording saved. Connect to backend to transcribe."
4. When the user later connects to a backend, they can trigger transcription from the library view

This is critical for the mobile use case where students record in a lecture hall with no backend access.

---

## 9. Data Flow — Feature by Feature

### 9.1 Live Lecture Mode

```
Step 1: User taps "Record" (nav link or FAB)
  -> navigateTo('#/record')
  -> flashcards.js routes to record-view
  -> recorder.js renders recording UI

Step 2: User taps "Start Recording"
  -> navigator.mediaDevices.getUserMedia({ audio: true })
  -> MediaRecorder starts (mimeType: 'audio/webm;codecs=opus')
  -> UI shows waveform + timer
  -> RecordingSession created in IDB (status: 'recording')
  -> ondataavailable: chunks accumulated in memory array

Step 3: User taps "Stop"
  -> MediaRecorder.stop()
  -> All chunks concatenated into single Blob
  -> Blob saved to audioData store
  -> RecordingSession updated (status: 'stopped', duration computed)
  -> UI shows: "Transcribe Now" or "Save for Later"

Step 4a: "Transcribe Now" (backend available)
  -> POST /api/transcribe with audio blob
  -> RecordingSession status = 'transcribing'
  -> Response received:
     -> Create Lecture in IDB (title, duration, status: 'completed')
     -> Create Segments in IDB from response.segments
     -> Auto-generate Flashcards from response.flashcards or transcript
     -> RecordingSession.lectureId = new lecture ID
     -> RecordingSession.transcript = response.transcript
     -> RecordingSession.status = 'completed'
  -> navigateTo('#/lecture/' + lectureId)

Step 4b: "Save for Later" (offline)
  -> RecordingSession stays status: 'stopped'
  -> Appears in library with "Pending Transcription" badge
  -> User can transcribe later from lecture detail view
```

### 9.2 Confusion Analytics (SP4)

```
Step 1: Student views lecture detail (#/lecture/:id, segments tab)
  -> Each segment row shows a "Confused?" button (thumbs-down icon)

Step 2: Student taps "Confused?" on a segment
  -> Confusion intensity picker appears (1-5 scale, default 1-tap = intensity 3)
  -> ConfusionVote created in IDB { lectureId, segmentId, intensity }
  -> Button changes to "Marked" state (prevents duplicate for same segment in same session)
  -> Toast: "Confusion marked"

Step 3: Viewing confusion data (analytics tab in lecture detail)
  -> ConfusionVoteRepository.getAggregateByLecture(lectureId)
  -> Returns [{segmentId, voteCount, avgIntensity}]
  -> Rendered as timeline heatmap:
     - X axis: lecture timeline (0 to duration)
     - Color intensity: green (0 votes) -> yellow -> red (high confusion)
     - Segment bars colored by avgIntensity
  -> Also shown as sorted list: "Most confusing segments"
```

### 9.3 Professor Dashboard (SP7)

```
Step 1: Professor navigates to #/professor
  -> professor.js renders dashboard

Step 2: Dashboard loads aggregate data
  -> All lectures from LectureRepository.getAll()
  -> For each lecture:
     -> ConfusionVoteRepository.getAggregateByLecture(lectureId)
     -> Analytics: quiz accuracy, study session count
     -> EventRepository: segment_replay counts
  -> Data aggregated into:
     a. Class-wide confusion heatmap (all lectures, color-coded)
     b. "Most confusing segments" leaderboard
     c. "Most replayed segments" leaderboard
     d. Quiz performance summary (avg accuracy, trend)

Step 3: Export
  -> "Export CSV" button
  -> Generates CSV with columns: Lecture, Segment, StartTime, EndTime,
     ConfusionVotes, AvgIntensity, ReplayCount, QuizAccuracy
  -> Downloaded via Blob + URL.createObjectURL + <a download>

Step 4: "Local simulation" note
  -> In v0.5.0, all data is single-user
  -> Banner: "Showing your own data. Multi-user aggregation in v1.0."
  -> Professor can still use this to review their own lecture experience
```

---

## 10. Performance Budget

| Operation | Target | Constraint |
|-----------|--------|------------|
| Audio recording start | <500ms | getUserMedia permission prompt |
| Audio chunk accumulation | Real-time | Memory: ~1MB/min at 128kbps |
| Max recording duration | 120 min | ~120MB audio blob in memory |
| Transcription (backend) | <60s for 1hr audio | GPU with Whisper base; CPU may be 5-10x slower |
| Confusion vote write | <10ms | Single IDB put |
| Confusion aggregate query | <50ms | Index scan on lectureId |
| Professor dashboard load | <500ms | Aggregates across all lectures |
| CSV export generation | <200ms | Client-side, no backend |

---

## 11. Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Microphone denied | getUserMedia rejection | Show permission instructions, disable record button |
| MediaRecorder not supported | typeof MediaRecorder === 'undefined' | Show "Browser not supported" message, suggest Chrome/Firefox |
| Recording interrupted (tab close) | beforeunload event | Save partial audio blob + RecordingSession with status 'stopped' |
| Audio blob too large for IDB | DOMException QuotaExceeded | Warn user, offer to discard, suggest shorter recordings |
| Backend unavailable for transcription | fetch throws / network error | Save locally, show "Transcribe later" option |
| Whisper OOM on long audio | Backend 500 | Return error, suggest splitting recording |
| IDB version upgrade fails | onblocked event | Prompt user to close other tabs |
| Corrupt audio blob | Whisper returns empty transcript | Show error, allow re-record |

---

## 12. Mobile-First Design Constraints

Live Lecture Mode is primarily a mobile feature. Design constraints:

| Constraint | Solution |
|------------|----------|
| One-handed operation | Large record button (56px+ touch target), bottom-anchored |
| Screen off during recording | MediaRecorder continues in background on most mobile browsers |
| Battery drain | Use audio-only (no video), low sample rate option (16kHz for speech) |
| Network unavailable in lecture hall | Capture-only mode, transcribe later |
| Small screen | Minimal UI during recording: timer + waveform + stop button only |
| Accessibility | Record button has aria-label, timer uses aria-live="polite" |

### Record View Layout (mobile)

```
+---------------------------+
|  < Back    Record Lecture  |
|                           |
|                           |
|     [Waveform visual]     |
|                           |
|        00:45:30           |
|     "Recording..."        |
|                           |
|                           |
|      ( STOP button )      |
|                           |
+---------------------------+
```

### Record View Layout (desktop)

```
+------------------------------------------------+
|  < Back to Library    Record Lecture            |
|                                                |
|  +------------------------------------------+  |
|  |                                          |  |
|  |         [Waveform visualization]         |  |
|  |                                          |  |
|  |              00:45:30                    |  |
|  |           "Recording..."                 |  |
|  |                                          |  |
|  |            ( STOP )                      |  |
|  +------------------------------------------+  |
|                                                |
|  Recording Settings:                           |
|  [x] Auto-transcribe when done                |
|  [ ] Generate flashcards from transcript       |
|  Title: [________________]                     |
|  Course: [Dropdown________]                    |
+------------------------------------------------+
```

---

## 13. Hookable Renderer Pattern (continued)

Following the established pattern from v0.4.0:

```
flashcards.js exports:
  setRecordRenderer(fn)      — called by recorder.js on module load
  setProfessorRenderer(fn)   — called by professor.js on module load

recorder.js on load:
  import { setRecordRenderer } from './flashcards.js';
  setRecordRenderer(renderRecordView);

professor.js on load:
  import { setProfessorRenderer } from './flashcards.js';
  setProfessorRenderer(renderProfessorDashboard);

flashcards.js mountView():
  case VIEWS.RECORD:
    if (_recordRenderer) _recordRenderer(container);
    break;
  case VIEWS.PROFESSOR:
    if (_professorRenderer) _professorRenderer(container);
    break;
```

This preserves AD-1: flashcards.js never imports from recorder.js or professor.js. The downstream modules register themselves.

---

## 14. DB Migration (v1 -> v2)

```
DB_VERSION: 1 -> 2

onupgradeneeded(event):
  if (event.oldVersion < 2) {
    // Create new stores
    db.createObjectStore('recordingSessions', { keyPath: 'id' });
    db.createObjectStore('audioData', { keyPath: 'id' });

    // Add indexes to recordingSessions
    const rsStore = transaction.objectStore('recordingSessions');
    rsStore.createIndex('lectureId', 'lectureId', { unique: false });
    rsStore.createIndex('status', 'status', { unique: false });
    rsStore.createIndex('createdAt', 'createdAt', { unique: false });

    // Add 'segment_replay' to EVENT_TYPES (code-level, no schema change)
  }
```

**Note:** The existing `confusionVotes` store does not need schema changes. The `intensity` field is simply added to new records via the factory function. Existing votes without `intensity` default to 1 at read time.

---

## 15. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Microphone access | Only requested on explicit user action (tap Record). Permission prompt is browser-controlled. |
| Audio data privacy | Audio stored only in local IndexedDB. Never sent to third-party servers. Backend transcription is user-initiated only. |
| Audio upload to backend | Same origin check. Rate limited. Max file size enforced (100MB). |
| Professor dashboard data | Local-only in v0.5.0. No shared data between users. |
| XSS in transcript display | Transcripts rendered via textContent, never innerHTML. Same safe DOM pattern as v0.4.0. |
| Audio blob injection | Backend validates audio format via ffprobe before passing to Whisper. |

---

## 16. Open Questions

| # | Question | Owner | Deadline | Impact |
|---|----------|-------|----------|--------|
| Q1 | Should we support video recording (camera) in addition to audio? | Product | Week 15 start | Scope: video adds ~200 lines, 10x storage, marginal value for transcription |
| Q2 | What Whisper model size for the default backend? base (74M) vs. small (244M) vs. large-v3 (1.5B)? | ML Eng | Week 15 Day 1 | Performance vs. accuracy tradeoff. Recommend `base` for CPU, `large-v3` for GPU. |
| Q3 | Should confusion votes be editable/deletable? | UX | Week 15 Day 2 | Complexity: adds undo flow. Recommend: allow delete, not edit. |
| Q4 | Maximum number of recordings stored before warning? | Product | Week 15 | Storage: 10 x 1hr recordings = ~600MB in IDB. Need quota management. |
| Q5 | Should professor dashboard support filtering by course? | Product | Week 16 | Scope: minor, ~50 lines. Recommend yes. |
| Q6 | Audio format: webm/opus vs wav? | Eng | Week 15 Day 1 | webm/opus is ~10x smaller but needs ffmpeg conversion for Whisper. wav is lossless but huge. Recommend webm/opus with backend conversion. |

---

## 17. Week-by-Week Implementation Plan

### Week 15: Recording + Confusion Voting (20h)

| Day | Task | Hours | Deliverable |
|-----|------|-------|-------------|
| 1 | DB migration v1->v2, RecordingSession model, AudioData store | 3h | Storage tests passing |
| 2 | recorder.js: MediaRecorder wrapper, capture UI, save to IDB | 5h | Can record + save audio |
| 3 | Backend: /api/transcribe endpoint with Whisper | 4h | Audio in -> transcript out |
| 4 | recorder.js: transcription flow, lecture creation from transcript | 4h | Record -> transcribe -> lecture appears in library |
| 5 | Confusion voting: UI in library.js segment list, ConfusionVote writes | 4h | Can vote confused on segments |

### Week 16: Professor Dashboard + Polish (20h)

| Day | Task | Hours | Deliverable |
|-----|------|-------|-------------|
| 1 | Confusion heatmap in lecture detail analytics tab | 4h | Visual heatmap per lecture |
| 2 | professor.js: dashboard skeleton, aggregate queries | 4h | Dashboard route works |
| 3 | professor.js: heatmap, leaderboards, quiz summary | 4h | Full dashboard UI |
| 4 | professor.js: CSV export, replay tracking | 4h | Export works, replay data collected |
| 5 | Polish, hostile review, tests, release | 4h | v0.5.0 tagged |

### Test targets:
- recorder.js: ~40 tests (MediaRecorder mock, IDB storage, transcription flow, error handling)
- recorder.test.js mocks: MediaRecorder, getUserMedia, fetch
- professor.js: ~30 tests (aggregation logic, CSV generation, rendering)
- Confusion voting in library.js: ~20 tests (vote creation, toggle state, aggregate display)
- Storage: ~30 tests (RecordingSession CRUD, AudioData CRUD, migration)
- **Total new: ~120 tests. Grand total: ~677 tests.**

---

## 18. Trade-offs and Alternatives Considered

### Audio Storage: IndexedDB vs. File System Access API

**Chosen: IndexedDB (Option A)**
- Pros: Universal browser support, offline-first, simple API
- Cons: IDB bloat for long recordings, 50MB+ per hour
- Alternative rejected: File System Access API has poor mobile support (Safari, Firefox)
- Future: Migrate to OPFS in v1.0 for better large-file handling

### Recorder Module Placement: L2 vs. L3

**Chosen: L2 (parallel to analytics.js)**
- Pros: Minimal imports (only dom-utils + flashcards), no dependency on library or analytics
- Cons: Cannot directly call library.js functions
- Alternative rejected: L3 (beside library.js) would create a peer dependency and complicate the chain
- Mitigation: After recording, use `navigateTo('#/lecture/:id')` to hand off to library.js

### Confusion Voting: Binary vs. Intensity Scale

**Chosen: Intensity scale (1-5) with 1-tap default (intensity 3)**
- Pros: Richer data for professor dashboard, still simple for quick voting
- Cons: Slightly more complex UI, extra field in model
- Alternative rejected: Binary (confused/not confused) loses granularity
- Compromise: Default tap = intensity 3. Long-press or second tap shows slider for 1-5.

### Professor Dashboard: Separate module vs. analytics.js extension

**Chosen: Separate professor.js**
- Pros: Clean separation of student vs. professor concerns, analytics.js stays focused
- Cons: New file, new test file, slightly more code
- Alternative rejected: Extending analytics.js would bloat it beyond 2000 lines and mix student/professor concerns

---

## 19. ADR References

The following Architecture Decision Records should be created alongside this document:

| ADR | Title | Status |
|-----|-------|--------|
| ADR-0005 | Recorder module at dependency level L2 | Proposed |
| ADR-0006 | Audio storage in IndexedDB for v0.5.0 MVP | Proposed |
| ADR-0007 | Professor dashboard as separate module at L4 | Proposed |
| ADR-0008 | Confusion intensity scale (1-5) vs. binary | Proposed |
| ADR-0009 | DB migration strategy v1 to v2 | Proposed |

---

## ARCHITECT: Design Complete

Artifacts:
- `docs/architecture/ARCHITECTURE_v050.md` (this file)

Status: PENDING_HOSTILE_REVIEW

Next steps:
1. Human reviews and approves/modifies this architecture
2. Create ADR files if architecture is approved
3. Begin Week 15 implementation per the plan above
