# v0.5.0 Architecture Hostile Review

**Reviewer:** HOSTILE_REVIEWER
**Date:** 2026-03-07
**Score: 44/100 — REJECT**
**Critical: 4 | Major: 5 | Minor: 3**

---

## Summary

The architecture contains a runtime-crashing bug in its own pseudocode (C1), a false security
guarantee already printed in the security table (C2), an unresolved module-layer gap that breaks
AD-1 coverage (C3), and a direct factual contradiction between two documents both marked APPROVED
(C4). Five major issues address unhandled failure modes for the primary mobile use case. None of
these are style concerns. Each one either produces wrong runtime behavior, invalidates a stated
design guarantee, or will force an unplanned schema migration.

---

## Critical Issues (90%+ confidence)

### C1. IDB Migration Pseudocode References Undefined Variable `tx` — Runtime Crash

**Location:** `docs/architecture/ARCHITECTURE_v050.md` §9, `tx.objectStore()` calls

**Issue:** The migration block calls `tx.objectStore('recordingSessions')`,
`tx.objectStore('photoCaptures')`, `tx.objectStore('confusionVotes')`, and
`tx.objectStore('autoNotes')` — but `tx` is never declared anywhere in the pseudocode.
The `onupgradeneeded` callback receives `event` and exposes `db` (the `IDBDatabase`), not `tx`.

If a developer implements directly from this pseudocode, every `tx.objectStore()` call throws
`ReferenceError: tx is not defined` at runtime. IndexedDB rolls back the entire upgrade
transaction on any unhandled error. The database version is then permanently blocked: IDB will
never attempt the upgrade to version 2 again for that browser profile. The app breaks on first
launch after update for every user who hits this path, with no recovery short of clearing the DB.

**Suggested Fix:** Use the return value of `db.createObjectStore()` directly, since it returns
the new `IDBObjectStore`:
```js
const rsStore = db.createObjectStore('recordingSessions', { keyPath: 'id' });
rsStore.createIndex('lectureId', 'lectureId', { unique: false });
rsStore.createIndex('status', 'status', { unique: false });
rsStore.createIndex('createdAt', 'createdAt', { unique: false });

const pcStore = db.createObjectStore('photoCaptures', { keyPath: 'id' });
pcStore.createIndex('recordingSessionId', 'recordingSessionId', { unique: false });
pcStore.createIndex('timestampMs', 'timestampMs', { unique: false });

const cvStore = db.createObjectStore('confusionVotes', { keyPath: 'id' });
cvStore.createIndex('lectureId', 'lectureId', { unique: false });
cvStore.createIndex('segmentId', 'segmentId', { unique: false });

const anStore = db.createObjectStore('autoNotes', { keyPath: 'id' });
anStore.createIndex('lectureId', 'lectureId', { unique: false });
anStore.createIndex('generatedAt', 'generatedAt', { unique: false });
```
The pseudocode in §9 must be corrected before W15.1.1 is implemented.

---

### C2. Security Table Makes a False Guarantee: Canvas `toBlob()` Does Not Always Strip EXIF

**Location:** `docs/architecture/ARCHITECTURE_v050.md` §17 (security table), §10.4 Step 2

**Issue:** The security table states: "Photos are always re-encoded via canvas (resize + JPEG
compress), stripping EXIF and potential payloads."

Two problems compound here:

First, §10.4 Step 2 says "Resized to max 1920px on longest edge." The conditional is implicit: if
a photo is already under 1920px, a naive implementation may skip the canvas step and write the
raw file blob directly to IDB. The security table says "always" but the data flow spec does not
enforce it for small images.

Second, EXIF stripping via `canvas.toBlob()` is a browser behaviour, not a W3C normative
guarantee. Chrome and Firefox discard metadata when decoding into pixel data via `drawImage()`,
but this is not specified. A student photographing a slide in a hospital or private research
facility has a reasonable expectation their location is not embedded in a stored JPEG.

**Suggested Fix:** The canvas encode must be unconditional. W15.2.2 spec must state explicitly:
"always draw to canvas and call `toBlob()` regardless of image dimensions." Remove "always" from
the security table and replace with: "Photos are re-encoded via canvas in all code paths; see
W15.2.2 implementation requirement." Add a unit test verifying the canvas path is taken for
images already under 1920px.

---

### C3. `llm-client.js` Has No Assigned Layer — AD-1 Structural Loophole

**Location:** `docs/architecture/ARCHITECTURE_v050.md` §4 (new files table), §3 (Dependency Rules)

**Issue:** The new files table assigns `llm-client.js` the layer "util." The dependency rules in
§3 define exactly four layers (L0–L3) with explicit import restrictions. "util" is not one of
them. No rule in §3 governs what a "util" module may import, or which layers may import it.

Three concrete consequences:
1. `notes-engine.js` (L2) imports `llm-client.js`. If `llm-client.js` is L0, it must import
   nothing — but since "util" is outside the layer system, no rule prevents it from importing
   an L1 module in future.
2. `library.js` (L3) could import `llm-client.js` directly, bypassing `notes-engine.js`. The
   AD-1 rule "L3 imports L0, L1, L2" doesn't cover "util" — so this import is invisible to the
   enforcement model.
3. An unclassified module is exactly how `app.js` became a 3500-line dependency tangle. The
   project's own CLAUDE.md anti-patterns warn against dead API surface. An unclassified import
   surface is worse.

**Suggested Fix:** Assign `llm-client.js` explicitly to L0. Update the Dependency Rules table:
"L0 may contain pure utility modules (no internal imports, no DOM/IDB side effects beyond
`fetch`)." Add a rule: "Any module with zero internal project imports is L0 by definition." Add
a test or comment-based rule verifying `llm-client.js` contains no imports from any internal
module.

---

### C4. Audio Chunk Strategy Contradicts Between Two APPROVED Documents

**Location:** `ARCHITECTURE_v050.md` §10.1 Step 3 vs. `ROADMAP_V050.md` §2 (Live Audio Capture MVP)

**Issue:** The two documents specify opposite audio strategies:

- **ARCHITECTURE §10.1 Step 3:** "ondataavailable: chunks accumulate in memory array"
- **ROADMAP §2 line ~54:** "Audio captured via MediaRecorder API, chunked to IndexedDB every 5 seconds"
- **WEEK15_PLAN W15.1.4:** "chunked audio accumulation in memory" (agrees with architecture)

These are not equivalent. Memory accumulation = zero IDB writes during recording, single Blob
write on stop, peak RAM = full audio size (~20MB for 90 min at Opus). Chunked-to-IDB = IDB write
every 5s, near-zero peak RAM, but requires reading all chunks back and concatenating on stop (an
async operation that can fail mid-way with no defined partial recovery path).

Both documents are marked APPROVED. A developer reading only the roadmap will implement chunked
IDB writes. The resulting systems have different failure modes under iOS tab suspension.

**Suggested Fix:** Declare the architecture authoritative (WEEK15_PLAN agrees). Update ROADMAP
§2 to: "Audio chunks accumulated in memory during recording; written as a single Blob to IDB on
stop." Add a note in §10.1 documenting the peak RAM consequence and "audio loss on tab kill
before stop" as a known limitation. The roadmap correction must happen before W15.1.4 is coded.

---

## Major Issues (75%+ confidence)

### M1. RecordingSession State Machine Missing `paused` State — Will Force Future Migration

**Location:** `ARCHITECTURE_v050.md` §8.1 (`status` field union); `WEEK15_PLAN` W15.1.4

**Issue:** Status union: `'recording' | 'stopped' | 'transcribing' | 'completed' | 'failed'`.
No `'paused'` state. WEEK15_PLAN W15.1.4 lists pause/resume as required operations. If pause is
implemented in Week 17 without a schema change, paused sessions must masquerade as `'recording'`
(semantically wrong) or the developer adds `'paused'` as an undocumented value (schema drift,
breaks the orphan-cleanup logic in M2, breaks any typed switch statements).

**Suggested Fix:** Add `'paused'` to the union now. Week 15 will not write it to IDB, but the
schema is forward-compatible and no migration will be needed in Week 17. Also document all valid
state transitions as a table (e.g., `recording → paused`, `paused → recording`, `paused →
stopped`, `recording → failed` on tab kill).

---

### M2. Orphaned `status: 'recording'` Sessions After iOS Tab Kill Are Never Cleaned Up

**Location:** `ARCHITECTURE_v050.md` §13 (failure modes table)

**Issue:** Tab-close recovery uses `beforeunload`: "Save partial audio + set status to 'stopped'."
`beforeunload` is not reliably fired on iOS Safari when the OS kills a tab. After a tab kill,
a `RecordingSession` remains in `status: 'recording'` with no `audioData` blob. On next app
open, no cleanup routine is specified. The orphaned session appears as an active recording
indefinitely. No delete UI for failed or orphaned sessions is specified anywhere.

**Suggested Fix:** Add a startup recovery routine to the spec: on every app init, call
`RecordingSessionRepository.getByStatus('recording')` and for any sessions older than 10 minutes,
transition to `status: 'failed'` with `error: 'Orphaned — tab closed during recording'`. Specify
that the recordings list shows failed sessions with a delete button. Add this to W15.1.3
acceptance criteria.

---

### M3. Screen Wake Lock Silently Lost on Screen Lock — No Re-Acquisition on `visibilitychange`

**Location:** `ARCHITECTURE_v050.md` §14

**Issue:** The W3C Screen Wake Lock spec §6.3 states a wake lock is automatically released when
the browsing context becomes hidden (tab switch, Home button, lock screen). The architecture does
not specify listening for `document.visibilitychange` and re-acquiring the lock on return. A
student who briefly switches apps loses the wake lock silently for the rest of the lecture with
no warning and no re-acquisition attempt.

**Suggested Fix:** Add to recorder.js spec: listen for `document.visibilitychange`. When
`document.visibilityState` returns to `'visible'` during active recording, call
`navigator.wakeLock.request('screen')` again. Catch `NotAllowedError` and show a toast: "Screen
may auto-lock during recording." Add a small lock icon in the recording UI showing current wake
lock status.

---

### M4. Web Speech API Auto-Restart Throws `InvalidStateError` on Immediate Restart

**Location:** `ARCHITECTURE_v050.md` §15; `WEEK15_PLAN` W15.1.4

**Issue:** The architecture specifies auto-restart when `SpeechRecognition.onend` fires. The
implied implementation — calling `recognition.start()` directly inside `onend` — throws
`InvalidStateError` in Chrome intermittently because the previous recognition's audio pipeline
cleanup is asynchronous. `onend` fires before cleanup completes. This failure is timing-dependent:
it does not occur every time, making it appear to work in testing while failing randomly in
production on slower devices. Mock objects in jsdom tests do not replicate this timing. The
W15.1.4 acceptance criteria for "10+ unit tests with fully mocked SpeechRecognition" will not
catch it.

**Suggested Fix:** The architecture must specify a delayed restart:
```js
recognition.onend = () => {
  if (isRecordingActive) {
    setTimeout(() => {
      try { recognition.start(); }
      catch (e) {
        if (e.name === 'InvalidStateError') setTimeout(restart, 500);
      }
    }, 100);
  }
};
```
W15.1.4 acceptance criteria must include: "restart uses `setTimeout` (not immediate); `InvalidStateError` is caught and retried."

---

### M5. `autoNotes` `lectureId` Index Is Non-Unique — Contradicts "One AutoNote Per Lecture" Invariant

**Location:** `ARCHITECTURE_v050.md` §8.5, §9 (`autoNotes` store creation)

**Issue:** §8.5 states: "One AutoNote per lecture (upsert by lectureId)." The migration creates
the `lectureId` index with `{ unique: false }`. IDB will not enforce the one-per-lecture
constraint at the storage layer. If any code path calls `put()` directly — in a test, a future
extension, or an error recovery retry — a second AutoNote for the same lecture is created
silently. On subsequent reads, index lookups return whichever record was inserted first
(insertion-order-dependent, non-deterministic across browsers). The other record becomes an
invisible orphan inflating storage.

**Suggested Fix:** Change the `lectureId` index to `{ unique: true }`. IDB throws
`ConstraintError` on any duplicate insert, making the invariant machine-enforced.
`AutoNoteRepository.upsert()` must catch `ConstraintError` and update the existing record
instead of creating a new one.

---

## Minor Issues (60%+ confidence)

### m1. Migration Pseudocode Omits v1 Store Creation for Fresh Installs

**Location:** `ARCHITECTURE_v050.md` §9

**Issue:** The guard `if (event.oldVersion < 2)` also fires for `oldVersion === 0` (fresh
install). The pseudocode only shows the five new v0.5.0 stores. The five v1 stores (`lectures`,
`segments`, `flashcards`, `studySessions`, `events`) must also be created for users who install
v0.5.0 directly without ever running v0.4.0. If a `if (event.oldVersion < 1)` block exists in
`storage/migrations.js` already, this is fine — but the architecture pseudocode doesn't show it,
creating ambiguity.

**Suggested Fix:** Show the complete migration function including the `if (event.oldVersion < 1)`
block for v1 stores. Removes all ambiguity about what a fresh install receives.

---

### m2. Confusion Vote Toggle Has No Debounce or Per-Key Mutex — Documented Anti-Pattern

**Location:** `WEEK15_PLAN` W15.3.2; `CLAUDE.md` Anti-Patterns section

**Issue:** The toggle operation is a read-modify-write on IDB: query by segmentId, delete if
found, create if not. A double-tap on mobile (common when the first tap appears unresponsive)
fires two toggle calls. Both reads complete before either write. Both see "no vote exists." Both
create a vote. Result: two records for the same segment, violating the binary voting invariant.
CLAUDE.md explicitly lists: "Any read-modify-write on shared IndexedDB keys needs a per-key
mutex." W15.3.2 acceptance criteria make no mention of this.

**Suggested Fix:** Add a per-segment in-memory lock (a `Set` of pending segment IDs) to the UI
handler. If a toggle for segment X is already in-flight, ignore subsequent clicks until the
first settles. Add this to W15.3.2 acceptance criteria.

---

### m3. `notes-engine.test.js` 150-Line Estimate Insufficient for Correctness Coverage

**Location:** `ARCHITECTURE_v050.md` §4 (new files table)

**Issue:** ~150 lines covers roughly 6–8 test cases. TextRank/TF-IDF has numerous correctness
edge cases not listed: all-identical words (TF uniform, IDF collapses), single-sentence input,
Unicode/non-Latin content (tokenization assumptions break on CJK), stopword-only input (empty
output), very long transcripts (naive TextRank is O(n²) — may OOM or time out).

**Suggested Fix:** Revise estimate to 300+ lines, or explicitly scope which edge cases are
covered and which are deferred with justification. Do not ship an untested extractive pipeline.

---

## Verdict

| Severity | Count | Blocking? |
|----------|-------|-----------|
| Critical | 4 | YES — all 4 must be fixed |
| Major | 5 | M1-M5 must be addressed or formally accepted as known risks |
| Minor | 3 | Address before implementation |

**Required before Week 15 Day 1:**
- [C1] Fix `tx` → `db.createObjectStore()` return value in §9 pseudocode
- [C2] Make canvas encode unconditional in W15.2.2 spec; retract "always strips EXIF" claim
- [C3] Assign `llm-client.js` to L0 in §3 and §4
- [C4] Update ROADMAP §2 to match architecture (memory accumulation, not chunked-to-IDB)

---

*HOSTILE_REVIEWER — Trust nothing. Verify everything.*
