/**
 * @fileoverview Tests for recorder.js — v0.5.0 Live Capture module.
 * Covers codec negotiation, recording lifecycle, Web Speech API integration,
 * orphaned session recovery, time formatting, and UI rendering.
 * TDD: tests written before implementation.
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { closeDatabase, deleteDatabase, put, openDatabase } from './storage/db.js';
import {
  RecordingSessionRepository,
  AudioDataRepository,
  PhotoCaptureRepository,
  LectureRepository,
  SegmentRepository,
  createRecordingSession,
  RECORDING_STATUS
} from './storage/index.js';

import {
  negotiateCodec,
  startRecording,
  stopRecording,
  recoverOrphanedSessions,
  formatTime,
  renderRecordView,
  createSpeechRecognition,
  capturePhoto,
  transcribe,
  completeRecording
} from './recorder.js';

// ============================================================================
// MOCK CLASSES
// ============================================================================

class MockMediaRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
    this.mimeType = (options && options.mimeType) || '';
  }
  start(timeslice) { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['test-audio'], { type: 'audio/webm' }) });
    }
    if (this.onstop) this.onstop();
  }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  static isTypeSupported(type) { return type === 'audio/webm;codecs=opus'; }
}

class MockSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = '';
    this.onresult = null;
    this.onend = null;
    this.onerror = null;
  }
  start() {}
  stop() {}
  abort() {}
}

// ============================================================================
// TEST SETUP
// ============================================================================

let originalMediaRecorder;
let originalGetUserMedia;
let originalSpeechRecognition;

beforeAll(() => {
  // Save originals
  originalMediaRecorder = globalThis.MediaRecorder;
  originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
  originalSpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
});

afterAll(async () => {
  // Restore originals
  if (originalMediaRecorder) {
    globalThis.MediaRecorder = originalMediaRecorder;
  } else {
    delete globalThis.MediaRecorder;
  }
  if (originalSpeechRecognition) {
    globalThis.SpeechRecognition = originalSpeechRecognition;
  } else {
    delete globalThis.SpeechRecognition;
    delete globalThis.webkitSpeechRecognition;
  }
  await closeDatabase();
  await deleteDatabase();
});

beforeEach(() => {
  // Set up default mocks
  globalThis.MediaRecorder = MockMediaRecorder;
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  navigator.mediaDevices.getUserMedia = jest.fn(() => Promise.resolve({
    getTracks: () => [{ stop: jest.fn(), kind: 'audio' }],
    getAudioTracks: () => [{ stop: jest.fn(), kind: 'audio' }]
  }));

  // Clean DOM using clearElement-style approach
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
});

afterEach(async () => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ============================================================================
// GROUP 1: CODEC NEGOTIATION
// ============================================================================

describe('negotiateCodec', () => {
  it('returns audio/webm;codecs=opus when supported', () => {
    globalThis.MediaRecorder = class extends MockMediaRecorder {
      static isTypeSupported(type) {
        return type === 'audio/webm;codecs=opus';
      }
    };
    const codec = negotiateCodec();
    expect(codec).toBe('audio/webm;codecs=opus');
  });

  it('returns audio/mp4;codecs=aac as fallback when opus not supported', () => {
    globalThis.MediaRecorder = class extends MockMediaRecorder {
      static isTypeSupported(type) {
        return type === 'audio/mp4;codecs=aac';
      }
    };
    const codec = negotiateCodec();
    expect(codec).toBe('audio/mp4;codecs=aac');
  });

  it('returns audio/wav as last resort when nothing else supported', () => {
    globalThis.MediaRecorder = class extends MockMediaRecorder {
      static isTypeSupported() { return false; }
    };
    const codec = negotiateCodec();
    expect(codec).toBe('audio/wav');
  });
});

// ============================================================================
// GROUP 2: RECORDING LIFECYCLE
// ============================================================================

describe('Recording lifecycle', () => {
  it('startRecording creates a RecordingSession in IDB with status recording', async () => {
    const session = await startRecording();
    expect(session).not.toBeNull();
    expect(session).toBeDefined();
    // Verify session was persisted
    if (session && session.id) {
      const stored = await RecordingSessionRepository.getById(session.id);
      expect(stored).toBeDefined();
      expect(stored.status).toBe(RECORDING_STATUS.RECORDING);
    }
  });

  it('startRecording requests getUserMedia with audio:true', async () => {
    await startRecording();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: true })
    );
  });

  it('stopRecording saves audio blob to AudioData store with matching session id', async () => {
    const session = await startRecording();
    if (!session || !session.id) {
      // Stub returns null — test will fail as expected for TDD
      expect(session).not.toBeNull();
      return;
    }
    const result = await stopRecording();
    expect(result).not.toBeNull();
    if (result) {
      expect(result.audioBlob).toBeDefined();
      // Audio data should be stored with same ID as session (key-sharing)
      const storedAudio = await AudioDataRepository.getById(session.id);
      expect(storedAudio).toBeDefined();
    }
  });

  it('stopRecording updates session status to stopped and sets duration', async () => {
    const session = await startRecording();
    if (!session || !session.id) {
      expect(session).not.toBeNull();
      return;
    }
    const result = await stopRecording();
    expect(result).not.toBeNull();
    if (result && result.session) {
      expect(result.session.status).toBe(RECORDING_STATUS.STOPPED);
      expect(typeof result.session.duration).toBe('number');
      expect(result.session.duration).toBeGreaterThanOrEqual(0);
    }
  });
});

// ============================================================================
// GROUP 3: WEB SPEECH API
// ============================================================================

describe('createSpeechRecognition', () => {
  it('returns null when SpeechRecognition is not available', () => {
    delete globalThis.SpeechRecognition;
    delete globalThis.webkitSpeechRecognition;
    const recognition = createSpeechRecognition();
    expect(recognition).toBeNull();
  });

  it('configures continuous:true and interimResults:true when available', () => {
    globalThis.SpeechRecognition = MockSpeechRecognition;
    const recognition = createSpeechRecognition();
    expect(recognition).not.toBeNull();
    if (recognition) {
      expect(recognition.continuous).toBe(true);
      expect(recognition.interimResults).toBe(true);
    }
  });

  it('auto-restarts on onend via setTimeout when recording is active', async () => {
    jest.useFakeTimers();
    globalThis.SpeechRecognition = MockSpeechRecognition;
    const startSpy = jest.spyOn(MockSpeechRecognition.prototype, 'start');

    // Must have an active recording for auto-restart guard to pass
    await jest.runAllTimersAsync();
    const session = await startRecording();
    expect(session).not.toBeNull();

    const recognition = createSpeechRecognition();
    expect(recognition).not.toBeNull();

    if (recognition && recognition.onend) {
      // Simulate the recognition ending during active recording
      recognition.onend();
      // The auto-restart should use setTimeout(fn, 100)
      await jest.advanceTimersByTimeAsync(200);
      expect(startSpy).toHaveBeenCalled();
    }

    startSpy.mockRestore();
    // Clean up the recording
    jest.useRealTimers();
    await stopRecording();
  });
});

// ============================================================================
// GROUP 4: ORPHANED SESSION RECOVERY
// ============================================================================

describe('recoverOrphanedSessions', () => {
  it('sets old recording sessions to failed status', async () => {
    await openDatabase();
    // Create an old session with status "recording" (simulating a crash)
    const oldSession = createRecordingSession({
      id: 'orphan-old-1',
      status: RECORDING_STATUS.RECORDING
    });
    // Manually set createdAt to 30 minutes ago
    oldSession.createdAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    oldSession.updatedAt = oldSession.createdAt;
    await put('recordingSessions', oldSession);

    const count = await recoverOrphanedSessions();
    expect(count).toBeGreaterThanOrEqual(1);

    const recovered = await RecordingSessionRepository.getById('orphan-old-1');
    expect(recovered.status).toBe('failed');
  });

  it('ignores recent sessions less than 10 minutes old', async () => {
    await openDatabase();
    // Create a recent session with status "recording"
    const recentSession = await RecordingSessionRepository.create({
      id: 'orphan-recent-1',
      status: RECORDING_STATUS.RECORDING
    });

    await recoverOrphanedSessions();

    const stillRecording = await RecordingSessionRepository.getById('orphan-recent-1');
    expect(stillRecording.status).toBe(RECORDING_STATUS.RECORDING);
  });
});

// ============================================================================
// GROUP 5: formatTime UTILITY
// ============================================================================

describe('formatTime', () => {
  it('formats 0 seconds as 00:00:00', () => {
    expect(formatTime(0)).toBe('00:00:00');
  });

  it('formats 3661 seconds as 01:01:01', () => {
    expect(formatTime(3661)).toBe('01:01:01');
  });

  it('formats 59 seconds as 00:00:59', () => {
    expect(formatTime(59)).toBe('00:00:59');
  });
});

// ============================================================================
// GROUP 6: UI RENDERING
// ============================================================================

describe('renderRecordView', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'record-view';
    document.body.appendChild(container);
  });

  it('creates a record button with aria-label', () => {
    renderRecordView(container);
    const buttons = container.querySelectorAll('button, [role="button"]');
    const recordButton = Array.from(buttons).find(
      btn => {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return label.includes('record');
      }
    );
    expect(recordButton).toBeDefined();
    expect(recordButton).not.toBeNull();
  });

  it('creates a timer display with aria-live="polite"', () => {
    renderRecordView(container);
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    // Timer should show initial time
    if (liveRegion) {
      expect(liveRegion.textContent).toContain('00:00');
    }
  });

  it('creates a photo capture button', () => {
    renderRecordView(container);
    const buttons = container.querySelectorAll('button, [role="button"]');
    const photoButton = Array.from(buttons).find(
      btn => {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        const text = (btn.textContent || '').toLowerCase();
        return label.includes('photo') || text.includes('photo') ||
               label.includes('capture') || text.includes('capture');
      }
    );
    expect(photoButton).toBeDefined();
    expect(photoButton).not.toBeNull();
  });

  it('record button has 56px+ minimum touch target', () => {
    renderRecordView(container);
    const buttons = container.querySelectorAll('button, [role="button"]');
    const recordButton = Array.from(buttons).find(
      btn => {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return label.includes('record');
      }
    );
    expect(recordButton).not.toBeNull();
    if (recordButton) {
      // Check via inline style or CSS class that ensures min touch target
      const minWidth = parseInt(recordButton.style.minWidth, 10) ||
                       parseInt(recordButton.style.width, 10) || 0;
      const minHeight = parseInt(recordButton.style.minHeight, 10) ||
                        parseInt(recordButton.style.height, 10) || 0;
      const hasTargetClass = recordButton.classList.contains('touch-target') ||
                             recordButton.classList.contains('record-btn');
      // Either inline style >= 56px or has a class that guarantees it
      expect(minWidth >= 56 || minHeight >= 56 || hasTargetClass).toBe(true);
    }
  });
});

// ============================================================================
// GROUP 7: PHOTO CAPTURE
// ============================================================================

describe('capturePhoto', () => {
  it('creates a PhotoCapture in IDB with correct timestampMs', async () => {
    // Start a recording so _currentSession and _startTime exist
    const session = await startRecording();
    expect(session).not.toBeNull();

    // Create a mock file (small 1x1 PNG as data URL won't work in jsdom canvas)
    const mockFile = new Blob(['fake-image-data'], { type: 'image/jpeg' });

    const photo = await capturePhoto(mockFile);
    expect(photo).not.toBeNull();
    expect(photo.recordingSessionId).toBe(session.id);
    expect(typeof photo.timestampMs).toBe('number');
    expect(photo.timestampMs).toBeGreaterThanOrEqual(0);

    // Verify persisted
    const stored = await PhotoCaptureRepository.getById(photo.id);
    expect(stored).toBeDefined();
    expect(stored.recordingSessionId).toBe(session.id);

    await stopRecording();
  });

  it('returns null when no recording is active', async () => {
    const mockFile = new Blob(['fake-image-data'], { type: 'image/jpeg' });
    const result = await capturePhoto(mockFile);
    expect(result).toBeNull();
  });

  it('stores the blob with a size value', async () => {
    const session = await startRecording();
    const mockFile = new Blob(['fake-image-data'], { type: 'image/jpeg' });

    const photo = await capturePhoto(mockFile);
    expect(photo).not.toBeNull();
    expect(typeof photo.size).toBe('number');
    expect(photo.size).toBeGreaterThan(0);

    await stopRecording();
  });
});

// ============================================================================
// GROUP 8: TRANSCRIPT STUB SERVICE
// ============================================================================

describe('transcribe', () => {
  it('returns object with text and segments array', async () => {
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const result = await transcribe(blob, 120);
    expect(result).toBeDefined();
    expect(typeof result.text).toBe('string');
    expect(Array.isArray(result.segments)).toBe(true);
  });

  it('segments have start, end, and text fields', async () => {
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const result = await transcribe(blob, 120);
    expect(result.segments.length).toBeGreaterThan(0);
    for (const seg of result.segments) {
      expect(typeof seg.start).toBe('number');
      expect(typeof seg.end).toBe('number');
      expect(typeof seg.text).toBe('string');
      expect(seg.end).toBeGreaterThan(seg.start);
    }
  });

  it('generates approximately 1 segment per 60 seconds', async () => {
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const result = await transcribe(blob, 180); // 3 minutes
    // Should generate ~3 segments (1 per 60s)
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
    expect(result.segments.length).toBeLessThanOrEqual(4);
  });

  it('handles 0 duration gracefully', async () => {
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const result = await transcribe(blob, 0);
    expect(result).toBeDefined();
    expect(typeof result.text).toBe('string');
    expect(Array.isArray(result.segments)).toBe(true);
    // 0 duration should produce at most 1 segment
    expect(result.segments.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// GROUP 9: POST-RECORDING FLOW
// ============================================================================

describe('completeRecording', () => {
  it('creates Lecture and Segments in IDB after stopping', async () => {
    const session = await startRecording({ title: 'Test Lecture' });
    expect(session).not.toBeNull();

    const result = await stopRecording();
    expect(result).not.toBeNull();

    const lectureId = await completeRecording();
    expect(lectureId).toBeDefined();
    expect(typeof lectureId).toBe('string');

    // Verify lecture was created
    const lecture = await LectureRepository.getById(lectureId);
    expect(lecture).toBeDefined();
    expect(lecture.title).toBe('Test Lecture');

    // Verify segments were created
    const segments = await SegmentRepository.getByLecture(lectureId);
    expect(segments.length).toBeGreaterThan(0);
  });

  it('updates session status to completed and sets lectureId', async () => {
    const session = await startRecording({ title: 'Flow Test' });
    const result = await stopRecording();

    const lectureId = await completeRecording();

    // Session should be updated
    const updatedSession = await RecordingSessionRepository.getById(session.id);
    expect(updatedSession.status).toBe(RECORDING_STATUS.COMPLETED);
    expect(updatedSession.lectureId).toBe(lectureId);
  });

  it('returns null when no stopped session exists', async () => {
    const result = await completeRecording();
    expect(result).toBeNull();
  });
});
