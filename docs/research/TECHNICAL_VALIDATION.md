# Technical Feasibility Report: Live Lecture Mode

**Date:** 2026-03-06
**Author:** RESEARCH_LEAD
**Scope:** Audio recording, transcription, and summarization for mobile-browser live lecture capture

---

## Executive Summary

Live Lecture Mode is **feasible with a layered approach**. Audio recording via MediaRecorder works reliably on both Android Chrome and iOS Safari (with codec negotiation). Real-time transcription is achievable for free on Android Chrome via the Web Speech API, but not on iOS Safari. The most robust architecture is a hybrid: Web Speech API provides live captions where available, MediaRecorder always captures audio as a safety net, and the existing Whisper backend processes the recording later for high-quality transcripts. This gives students immediate value (live text on Android, guaranteed recording everywhere) with a clear upgrade path as WebGPU matures on mobile.

---

## 1. Audio Recording on Mobile Browser

### MediaRecorder API Support

| Browser | Support | Audio Codecs | Notes |
|---------|---------|-------------|-------|
| Android Chrome | Full | Opus/WebM, PCM | Stable, well-tested |
| iOS Safari 18.4+ | Full | AAC/MP4, Opus/WebM (new), ALAC, PCM | WebM/Opus cross-browser compat achieved in Safari 18.4 |
| Firefox Android | Full | Opus/OGG | Works but smaller market share |
| Firefox Desktop | Full | Opus/OGG | Works |

**Evidence:** Safari 18.4 was the milestone that unified cross-browser Opus/WebM support. Prior to this, iOS Safari only supported AAC/MP4, requiring format detection logic.

**Codec Strategy:** Use `MediaRecorder.isTypeSupported()` to select format in preference order:
1. `audio/webm;codecs=opus` (cross-browser, small files)
2. `audio/mp4;codecs=aac` (iOS fallback)
3. `audio/wav` (universal fallback, large files)

**Source:** [MediaRecorder API - Can I Use](https://caniuse.com/mediarecorder), [Safari ALAC/PCM support](https://blog.addpipe.com/record-high-quality-audio-in-safari-with-alac-and-pcm-support-via-mediarecorder/), [iPhone Safari MediaRecorder guide](https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription)

### Battery and Memory Impact

- **Battery drain:** Approximately 15% for a 90-minute audio-only recording, comparable to music playback with screen off.
- **Memory:** Audio-only recording has minimal memory impact. At Opus 32kbps, a 90-minute lecture produces approximately 20MB. WAV would be ~460MB (avoid).
- **Storage:** IndexedDB can handle 20MB blobs. For WAV fallback, chunked storage or filesystem API needed.

**Evidence quality:** MEDIUM -- battery figures extrapolated from developer reports on continuous recording; no controlled benchmark found for browser MediaRecorder specifically.

### Background Tab Behavior -- CRITICAL RISK

| Scenario | Android Chrome | iOS Safari |
|----------|---------------|------------|
| Switch to another app | Recording MAY continue (varies by OS version) | Recording STOPS |
| Lock screen | Recording MAY continue | Recording STOPS |
| Tab in background | Throttled but usually continues | Likely stops |

**This is the single biggest technical risk.** iOS Safari aggressively suspends background tabs and web audio. Android Chrome is more permissive but not guaranteed.

**Mitigations:**
1. Display prominent "Keep this tab open" warning
2. Use `navigator.wakeLock` API (Screen Wake Lock) to prevent screen dimming
3. Consider PWA/Add-to-Home-Screen for better background behavior
4. Play a silent audio track to keep audio context alive (hack, unreliable)
5. Accept this limitation and document it clearly

**Source:** [WebKit bug 198277](https://bugs.webkit.org/show_bug.cgi?id=198277), [Apple Developer Forums](https://developer.apple.com/forums/thread/662277)

---

## 2. Transcription Options (Ranked)

### Feasibility Scores

| Option | Feasibility (1-10) | Free? | Real-time? | Mobile? | Offline? |
|--------|-------------------|-------|-----------|---------|---------|
| A: In-browser Whisper (WASM) | 3 | Yes | No | Barely | Yes |
| B: Laptop backend (WebSocket) | 7 | Yes | Near-RT | Requires laptop | Yes |
| C: Free cloud APIs | 5 | Partial | Yes | Yes | No |
| D: Record now, process later | 9 | Yes | No | Yes | Yes |
| E: Web Speech API + MediaRecorder | 8 | Yes | Partial | Yes | Partial |

### Option A: In-Browser Whisper (WASM / transformers.js)

**Feasibility: 3/10**

The whisper.cpp WASM demo exists and works on desktop browsers. However:

- **Model size:** Whisper tiny = 75MB download (acceptable on WiFi, bad on mobile data)
- **Phone CPU performance:** WASM Whisper tiny on a phone would take approximately 30-90 seconds to process 30 seconds of audio. This is 1-3x *slower* than real-time, making it unusable for live transcription on mobile.
- **Memory:** ~300-500MB RAM during inference, which may crash mobile Safari (iOS limits web content to ~1.5GB)
- **WebGPU future:** iOS 26 (late 2025) brings WebGPU to mobile Safari. When available, this could make Whisper tiny near-real-time on phone GPUs. But adoption will take 1-2 years.
- **whisper.cpp explicitly warns:** "For real-time streaming, you need a fast desktop or laptop computer (not a mobile phone)"

**Verdict:** Not viable today for phones. Revisit in 2027 when WebGPU has broad mobile adoption.

**Source:** [whisper.cpp WASM demo](https://ggml.ai/whisper.cpp/), [whisper-web repo](https://github.com/xenova/whisper-web), [Whisper model sizes](https://openwhispr.com/blog/whisper-model-sizes-explained), [iOS 26 WebGPU](https://brandlens.io/blog/the-untold-revolution-beneath-ios-26-webgpu-is-coming-everywhere-and-it-changes-everything/)

### Option B: Local Laptop Backend (Phone sends audio chunks via HTTP/WebSocket)

**Feasibility: 7/10**

The student runs the Lecture Mind backend on their laptop, and the phone sends audio chunks to `http://192.168.x.x:8000/transcribe`.

- **Whisper tiny on laptop CPU:** ~1-3x real-time (30s audio transcribed in 10-30s). Near-real-time with chunked processing.
- **Whisper base on laptop GPU:** ~10-30x real-time. True real-time with buffering.
- **Existing infrastructure:** FastAPI backend already exists. Adding a `/live-transcribe` WebSocket endpoint is straightforward.
- **Network requirement:** Both devices on same WiFi. Discovery could use mDNS or manual IP entry.

**Downsides:**
- Student must bring laptop AND phone to lecture
- Must set up local network connection (friction)
- Laptop must be open and running (battery, noise)

**Verdict:** Good for power users but too much friction for "one-tap start" goal.

**Source:** [whisper.cpp benchmarks](https://github.com/ggml-org/whisper.cpp/issues/89), existing project architecture

### Option C: Free Cloud APIs

**Feasibility: 5/10**

| Service | Free Quota | Meets 90-min requirement? | API Key Required? |
|---------|-----------|--------------------------|-------------------|
| Web Speech API (browser) | Unlimited | Unreliable for long sessions | No |
| Google Cloud STT | 60 min/month | No | Yes |
| Azure STT | 5 hours/month | Barely (3-4 lectures/mo) | Yes |
| Mozilla DeepSpeech | Self-hosted only | N/A | N/A |

The Web Speech API is the only truly free option. Google and Azure free tiers require API keys and have insufficient quota for regular lecture use.

**Verdict:** Web Speech API is the only viable cloud option. Others violate the "free, no API keys" requirement.

**Source:** [Google Cloud quotas](https://docs.cloud.google.com/speech-to-text/docs/quotas), [AssemblyAI free STT overview](https://www.assemblyai.com/blog/the-top-free-speech-to-text-apis-and-open-source-engines)

### Option D: Hybrid Record-and-Process-Later

**Feasibility: 9/10**

The simplest and most reliable approach:
1. Phone records audio via MediaRecorder (confirmed working)
2. Student downloads the audio file or transfers to laptop
3. Existing Whisper backend processes it (already built)
4. Transcript feeds into library, flashcards, search

- **No real-time requirement** eliminates all latency concerns
- **Works offline** -- recording needs no network
- **Works on all browsers** -- just needs MediaRecorder
- **File transfer:** Download as file, or use existing upload endpoint

**Downside:** No live captions during lecture. Student gets transcript only after processing.

**Verdict:** Highest reliability, lowest risk. Should be the guaranteed fallback.

### Option E: Web Speech API Primary + MediaRecorder Backup (RECOMMENDED)

**Feasibility: 8/10**

Layered approach:
1. **Always:** MediaRecorder captures audio (guaranteed recording)
2. **Where available:** Web Speech API provides live text (Android Chrome, desktop Chrome)
3. **Fallback:** If Web Speech unavailable (iOS Safari, Firefox), show "Recording... transcript available after processing"
4. **Post-lecture:** Upload audio to laptop backend for Whisper-quality transcript

| Platform | Live text? | Recording? | Post-processing? |
|----------|-----------|-----------|-----------------|
| Android Chrome | Yes (Web Speech) | Yes | Yes |
| iOS Safari | No | Yes | Yes |
| Desktop Chrome | Yes (Web Speech) | Yes | Yes |
| Firefox | No | Yes | Yes |

**Web Speech API details:**
- Free, no API key, no quota limits documented
- Requires internet (sends audio to Google servers in Chrome)
- `continuous: true` mode works but may auto-stop; needs `onend` auto-restart
- Quality is decent for English lectures (Google's ASR)
- Results come as interim + final, suitable for live display

**Verdict:** Best balance of immediate value, reliability, and zero cost.

**Source:** [Chrome Web Speech API](https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api), [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)

---

## 3. Real-time vs. Near-real-time vs. Post-processing

| Mode | Latency | Quality | Feasibility | User Experience |
|------|---------|---------|-------------|----------------|
| Real-time (Web Speech API) | 1-3 seconds | Good (Google ASR) | Android Chrome only | Live captions during lecture |
| Near-real-time (30s chunks to laptop) | 30-60 seconds | High (Whisper) | Requires laptop running | Delayed but accurate paragraphs |
| Post-processing (after lecture) | 3-15 minutes | Highest (any Whisper model) | Universal | Full transcript with timestamps |

**Recommendation for MVP:** Combine real-time (where available) with post-processing (always). Skip near-real-time -- it adds complexity without clear user benefit over the combination of the other two.

---

## 4. Summarization from Transcript

### Option Analysis

| Approach | Runs on phone? | Quality | Complexity | Dependencies |
|----------|---------------|---------|------------|-------------|
| Extractive (TF-IDF sentence ranking) | Yes | Low-Medium | Low | None (pure JS) |
| Extractive (TextRank) | Yes | Medium | Low | ~5KB JS library |
| Keyword extraction (frequency-based) | Yes | Low | Minimal | None |
| Generative (local LLM) | No | High | Very High | 2-7GB model |
| Generative (cloud LLM API) | Yes | Highest | Medium | API key + cost |

**Recommended for MVP:** Extractive summarization via TextRank or TF-IDF in JavaScript.

Available libraries (all client-side, no server needed):
- **text-summarizer** (TextRank-based, client-side, privacy-safe)
- **sum.js** (TF-IDF, fully embeddable, no API calls)
- **fast-ai-text-summary** (frequency-based, lightweight)

**How it works with transcript chunks:**
1. Web Speech API / Whisper produces transcript text
2. Split into paragraphs by timestamp (every 2-5 minutes)
3. Run extractive summarization on each paragraph
4. Display key sentences as "auto-notes"
5. Student can edit/refine

**Quality note:** Extractive summarization will not produce elegant notes. It selects important sentences verbatim. For a lecture context, this is actually acceptable -- students want key points, not prose. The existing flashcard auto-generation (already in v0.4.0) can also work on transcript chunks.

**Future path:** When the project reaches v1.0.0 (Phi-3 mini integration per roadmap), generative summarization on the laptop backend becomes viable.

**Source:** [text-summarizer](https://github.com/arnavroy/text-summarizer), [sum.js](https://github.com/topliceanu/sum), [fast-ai-text-summary](https://github.com/AkshayPanchivala/fast-ai-text-summary)

---

## 5. Prior Art and Competition

See `docs/research/COMPETITORS.md` for full analysis.

**Key finding:** No existing tool combines all of: free, mobile browser, lecture-focused, local-first, study-tool integration. Otter.ai is the closest but charges money and caps free tier at 30 minutes per session. Google Recorder is free and local but Pixel-only. Open-source alternatives (Meetily, Char) are desktop meeting tools.

**Our gap to fill:** Free mobile recording that feeds into an integrated study workflow (flashcards, search, analytics).

---

## 6. Technical Risks

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| 1 | iOS Safari kills recording when app goes to background | HIGH | HIGH | Screen Wake Lock API, "keep tab open" warning, PWA mode. Accept as known limitation and document it. |
| 2 | Web Speech API auto-stops during long lectures | MEDIUM | HIGH | Auto-restart on `onend` event. Log gaps. Inform user of reconnections. |
| 3 | Web Speech API unavailable (iOS, Firefox, offline) | MEDIUM | CERTAIN (for those platforms) | MediaRecorder always running as backup. Degrade gracefully to record-only mode. |
| 4 | Audio quality in large lecture halls (echo, distance) | MEDIUM | MEDIUM | Document best practices (sit near front, use earbuds as mic). Cannot solve in software alone. |
| 5 | MediaRecorder codec fragmentation across browsers | LOW | MEDIUM | Use `isTypeSupported()` negotiation. Test on real devices. Opus/WebM is now universal as of Safari 18.4. |
| 6 | IndexedDB storage limits for large audio blobs | LOW | LOW | 90-min Opus = ~20MB, well within browser quotas (typically 50MB-1GB+). Offer download/export for archival. |
| 7 | Web Speech API sends audio to Google servers (privacy) | MEDIUM | CERTAIN | Document clearly. Offer record-only mode for privacy-sensitive users. Post-processing via local Whisper is fully private. |

---

## 7. Recommended Approach

### Architecture: Layered Degradation

```
Best case (Android Chrome + internet):
  Web Speech API (live text) + MediaRecorder (audio backup)
  -> Live captions + guaranteed recording

Degraded (iOS Safari / Firefox / offline):
  MediaRecorder only (audio capture)
  -> "Recording... process later for transcript"

Post-lecture (all platforms):
  Upload audio to laptop Whisper backend
  -> High-quality transcript with timestamps
  -> Auto-generate flashcards, feed into library/search
```

### Why This Approach

1. **Zero new dependencies for MVP** -- Web Speech API and MediaRecorder are browser-native
2. **Leverages existing backend** -- Whisper already integrated
3. **Graceful degradation** -- Always useful, even on worst-case platforms
4. **Privacy options** -- Record-only mode avoids sending audio to Google
5. **Free** -- No API keys, no subscriptions, no cloud costs
6. **Path to improvement** -- WebGPU Whisper on phone is 1-2 years away

### Feasibility Score: 8/10

The 2 points deducted are for:
- iOS background recording limitation (unavoidable platform constraint)
- Web Speech API reliability for 90-minute continuous sessions (needs robust auto-restart)

---

## 8. MVP Definition

### Minimum Viable Live Lecture Mode

**Scope:** 1-2 weeks of work (fits within v0.5.0 timeline alongside Professor Edition)

**Features:**
1. "Record Lecture" button on mobile playground (single tap)
2. MediaRecorder captures audio with visual timer/waveform
3. Web Speech API displays live transcript (Android Chrome) with auto-restart
4. Graceful fallback to "recording only" mode on unsupported browsers
5. "Stop" button saves audio blob to IndexedDB
6. Audio playback from library
7. "Process Transcript" button (sends to laptop backend or downloads file)
8. Transcript displayed with timestamps, integrated into lecture detail view

**Not in MVP:**
- In-browser Whisper (wait for WebGPU maturity)
- Auto-summarization (add in next iteration with extractive JS)
- Speaker diarization
- Background recording workarounds (document limitation instead)

**Success criteria:**
- Student can record a 90-minute lecture on Android Chrome with live captions
- Student can record a 90-minute lecture on iOS Safari (audio only)
- Audio can be processed via existing Whisper backend for full transcript
- Transcript appears in library with search/flashcard generation

---

## RESEARCH_LEAD: Research Complete

**Artifacts:**
- `docs/research/TECHNICAL_VALIDATION.md` (this file)
- `docs/research/EVIDENCE.md`
- `docs/research/COMPETITORS.md`

**Key Findings:**
1. MediaRecorder API works cross-browser for audio capture; iOS background tab suspension is the main risk
2. Web Speech API provides free real-time transcription on Android Chrome (no API key)
3. In-browser Whisper is not viable on phones today; revisit when WebGPU matures
4. The hybrid approach (live captions where available + guaranteed recording + post-processing) gives the best cost/value/reliability tradeoff
5. No competitor fills the free-mobile-lecture-study niche

**Open Questions:**
1. Exact Web Speech API behavior for 90-minute continuous sessions (needs real-device testing)
2. Screen Wake Lock API effectiveness on iOS Safari (needs testing)
3. Whether the MVP should ship as part of v0.5.0 or as v0.6.0 (depends on Professor Edition scope)

**Status:** READY_FOR_ARCHITECTURE

**Next:** Architecture design for Live Lecture Mode integration with existing codebase

---

## Sources

- [MediaRecorder API - Can I Use](https://caniuse.com/mediarecorder)
- [Safari MediaRecorder ALAC/PCM Support](https://blog.addpipe.com/record-high-quality-audio-in-safari-with-alac-and-pcm-support-via-mediarecorder/)
- [iPhone Safari MediaRecorder Guide](https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription)
- [whisper.cpp GitHub](https://github.com/ggml-org/whisper.cpp)
- [whisper.cpp WASM Demo](https://ggml.ai/whisper.cpp/)
- [whisper-web (transformers.js)](https://github.com/xenova/whisper-web)
- [Whisper Model Sizes](https://openwhispr.com/blog/whisper-model-sizes-explained)
- [Whisper WebGPU Demo](https://huggingface.co/spaces/Xenova/realtime-whisper-webgpu)
- [iOS 26 WebGPU Announcement](https://brandlens.io/blog/the-untold-revolution-beneath-ios-26-webgpu-is-coming-everywhere-and-it-changes-everything/)
- [Chrome Web Speech API](https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api)
- [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [Speech Recognition - Can I Use](https://caniuse.com/speech-recognition)
- [Google Cloud STT Quotas](https://docs.cloud.google.com/speech-to-text/docs/quotas)
- [Free STT Engines Overview](https://www.assemblyai.com/blog/the-top-free-speech-to-text-apis-and-open-source-engines)
- [Otter.ai Pricing](https://otter.ai/pricing)
- [Google Recorder](https://recorder.google.com/about)
- [Meetily - Open Source Meeting Tool](https://char.com/blog/open-source-meeting-transcription-software/)
- [text-summarizer (TextRank, client-side)](https://github.com/arnavroy/text-summarizer)
- [sum.js (TF-IDF, embeddable)](https://github.com/topliceanu/sum)
- [WebKit Background Audio Bug](https://bugs.webkit.org/show_bug.cgi?id=198277)
- [whisper.cpp Benchmarks](https://github.com/ggml-org/whisper.cpp/issues/89)
- [Offline Whisper in Browser (AssemblyAI)](https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js)
- [Cross-Browser Media Recording](https://media-codings.com/articles/recording-cross-browser-compatible-media)
