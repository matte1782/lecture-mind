# Spike: Photo Capture During MediaRecorder on iOS Safari

**Date:** 2026-03-08
**Sprint:** v0.5.0 Week 15 Day 0.5
**Status:** PENDING
**Time budget:** 2h

---

## Question

> Does triggering `<input type="file" accept="image/*" capture="environment">` during an active MediaRecorder audio session kill the recording on iOS Safari?

This determines whether photo capture is enabled during recording on iOS, or only before/after.

---

## Background

- iOS Safari aggressively suspends background tabs and web audio contexts
- Opening the native camera via file input may cause the browser tab to be suspended
- MediaRecorder state could transition to `inactive` when the tab loses focus
- See: `docs/research/TECHNICAL_VALIDATION.md` Risk #1

---

## Test Setup

### Requirements
- iPhone (any model with iOS 14.5+ for MediaRecorder; iOS 18.4+ for Opus/WebM codec parity)
- Safari browser (not Chrome on iOS — all iOS browsers use WebKit)
- WiFi connection to access the test page

> **IMPORTANT**: `getUserMedia` requires a **secure context** (HTTPS or localhost).
> A phone accessing `http://<laptop-ip>:8903` is plain HTTP — microphone access will be blocked.
> Use Option A (GitHub Pages) or Option B (ngrok HTTPS tunnel).

### Serving the Test Page

**Option A — GitHub Pages (recommended):**
Push the branch, then open:
```
https://matte1782.github.io/lecture-mind/playground/ios-spike.html
```

**Option B — ngrok HTTPS tunnel (local dev):**
```bash
cd src/vl_jepa/api/static
python -m http.server 8903 --bind 0.0.0.0
# In another terminal:
ngrok http 8903
# Open the https://xxxx.ngrok-free.app/ios-spike.html URL on iPhone
```

**Option C — Local HTTP (desktop testing only, NOT for iPhone):**
```bash
cd src/vl_jepa/api/static
python -m http.server 8903
# http://localhost:8903/ios-spike.html — works on same machine only
```

---

## Test Protocol

> **Notes on iOS Safari behavior:**
> - Zero chunks during recording may be normal — iOS Safari may ignore the `timeslice` parameter and only fire `ondataavailable` on `stop()`. The definitive check is `MediaRecorder.state`, not chunk count.
> - The 200ms monitor interval in the harness will be suspended while the native camera is open. All queued checks fire in rapid succession on return — timestamps in the monitor log may be misleading. The `onPhotoTaken` handler is the authoritative check.

### Test 1: Basic Photo During Recording

1. Open `ios-spike.html` on iPhone Safari
2. Check the **Codec** status — note which codec was selected
3. Tap **"Start Recording"** — allow microphone when prompted
4. Wait 5 seconds (verify timer is counting and chunks are arriving in log)
5. Tap **"Take Photo"** — this opens the native camera
6. Take a photo and tap **"Use Photo"**
7. Observe:
   - Does the app return to the browser?
   - What is the **MediaRecorder state** shown?
   - Did the PASS/FAIL indicator update?
   - Check the event log for any `STOPPED` or `ERROR` events
8. If PASS: wait 30 more seconds recording, verify chunks still arriving

### Test 2: Quick Photo (< 3 seconds in camera)

1. Reset and start recording again
2. Quickly take a photo (< 3 seconds in camera app)
3. Return and check state
4. Compare with Test 1

### Test 3: Long Photo (> 30 seconds in camera)

1. Reset and start recording again
2. Open camera via the button
3. Wait 30+ seconds before taking the photo
4. Return and check state
5. This tests whether extended time away kills the recording

### Test 4: Photo Cancel

1. Reset and start recording again
2. Open camera via the button
3. Cancel (don't take a photo)
4. Return and check state

### Test 5: Wake Lock + Photo

1. Reset
2. Tap **"Request Wake Lock"** first
3. Start recording
4. Take a photo
5. Check if Wake Lock helped preserve the recording

---

## What to Record

For each test, note:

| Field | Value |
|-------|-------|
| iPhone model | |
| iOS version | |
| Safari version | |
| Codec selected | |
| MediaRecorder state BEFORE photo | |
| Time spent in camera app | |
| MediaRecorder state AFTER photo | |
| Chunks received after return? | |
| Any error events? | |
| Wake Lock status (if tested) | |
| PASS / FAIL | |

---

## Decision Matrix

| Result | Action for v0.5.0 |
|--------|-------------------|
| **All tests PASS** | Enable photo capture during recording on all platforms |
| **Quick photo PASS, long photo FAIL** | Enable with warning: "Take photos quickly to avoid interrupting recording" |
| **All tests FAIL** | Disable photo button during active recording on iOS; show "Stop recording to take photos" message. Photos only available before/after recording. |
| **Inconsistent results** | Disable by default on iOS with a user toggle: "Enable photo during recording (may interrupt audio)" |

### Implementation Impact

- **PASS path**: `btnPhoto.disabled = false` during recording (all platforms)
- **FAIL path**: Detect iOS/iPadOS and conditionally disable:
  ```javascript
  // iPadOS 13+ reports desktop UA, so check maxTouchPoints + Macintosh
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 0 && /Macintosh/.test(navigator.userAgent));
  btnPhoto.disabled = isRecording && isIOS;
  ```
- **Wake Lock result**: If works on iOS, add to recorder.js startup flow

---

## Results

> **Fill in after testing on real device**

### Device Info
- iPhone model:
- iOS version:
- Safari version:

### Test Results

| Test | PASS/FAIL | Notes |
|------|-----------|-------|
| Test 1: Basic photo | | |
| Test 2: Quick photo | | |
| Test 3: Long photo (30s+) | | |
| Test 4: Photo cancel | | |
| Test 5: Wake Lock + photo | | |

### Conclusion

**Spike result:** _(PASS / FAIL / PARTIAL)_

**Decision:** _(Enable everywhere / Disable on iOS during recording / Enable with warning)_

**Wake Lock on iOS Safari:** _(Works / Does not work / Partial)_

### Implications for recorder.js
- [ ] Photo button behavior during recording: ___
- [ ] Wake Lock integration: ___
- [ ] Any additional mitigations needed: ___

---

## Follow-up

- Update `docs/architecture/ARCHITECTURE_v050.md` with spike result
- Update `memory/MEMORY.md` with finding
- Apply decision in Week 15 Days 3-4 (photo capture implementation)
