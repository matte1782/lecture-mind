/**
 * recorder.js — v0.5.0 Live Capture
 * @version 0.5.0
 *
 * Layer: L2 (parallel to analytics.js)
 * Imports: flashcards.js (L1), dom-utils.js (L0), storage/ (L0)
 * Never imports: library.js (L3), analytics.js (L2)
 */

import { setRecordRenderer, registerViewCleanup, navigateTo, showToast } from './flashcards.js';
import { createElement, clearElement } from './dom-utils.js';
import {
  RecordingSessionRepository,
  AudioDataRepository,
  PhotoCaptureRepository,
  LectureRepository,
  SegmentRepository,
  createRecordingSession,
  createAudioData,
  createPhotoCapture,
  createLecture,
  RECORDING_STATUS
} from './storage/index.js';

// ============================================================================
// MODULE STATE
// ============================================================================

let _mediaRecorder = null;
let _audioChunks = [];
let _currentSession = null;
let _mediaStream = null;
let _speechRecognition = null;
let _startTime = null;
let _timerInterval = null;
let _timerEl = null;
let _transcriptEl = null;
let _recordBtn = null;
let _stopBtn = null;
let _photoBtn = null;
let _lastStoppedSession = null;
let _lastAudioBlob = null;

// ============================================================================
// CODEC NEGOTIATION
// ============================================================================

const CODEC_PRIORITY = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=aac',
  'audio/wav'
];

/**
 * Negotiate the best available audio codec.
 * @returns {string} mimeType
 */
export function negotiateCodec() {
  if (typeof globalThis.MediaRecorder === 'undefined') {
    return 'audio/wav';
  }
  for (const codec of CODEC_PRIORITY) {
    if (codec === 'audio/wav') return codec; // last resort, always "supported"
    if (globalThis.MediaRecorder.isTypeSupported(codec)) {
      return codec;
    }
  }
  return 'audio/wav';
}

// ============================================================================
// RECORDING LIFECYCLE
// ============================================================================

/**
 * Start a new recording session.
 * @param {Object} [options]
 * @param {string} [options.title] - Optional recording title
 * @returns {Promise<Object>} The created RecordingSession
 */
export async function startRecording(options = {}) {
  const mimeType = negotiateCodec();

  // Request microphone access
  _mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Get sample rate from track settings (may not be available in all browsers)
  const audioTrack = _mediaStream.getAudioTracks()[0];
  const settings = audioTrack && typeof audioTrack.getSettings === 'function'
    ? audioTrack.getSettings()
    : {};
  const sampleRate = settings.sampleRate || 44100;

  // Create recording session in IDB
  _currentSession = await RecordingSessionRepository.create({
    title: options.title || '',
    status: RECORDING_STATUS.RECORDING,
    mimeType,
    sampleRate
  });

  // Set up MediaRecorder
  _audioChunks = [];
  const recorderOptions = mimeType !== 'audio/wav' ? { mimeType } : {};
  _mediaRecorder = new globalThis.MediaRecorder(_mediaStream, recorderOptions);

  _mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      _audioChunks.push(event.data);
    }
  };

  _mediaRecorder.start(1000); // Collect data every second
  _startTime = Date.now();

  return _currentSession;
}

/**
 * Stop the current recording.
 * @returns {Promise<{session: Object, audioBlob: Blob}>}
 */
export async function stopRecording() {
  if (!_mediaRecorder || !_currentSession) {
    return null;
  }

  return new Promise((resolve, reject) => {
    _mediaRecorder.onstop = async () => {
      try {
        // Calculate duration
        const duration = _startTime ? Math.round((Date.now() - _startTime) / 1000) : 0;

        // Concatenate audio chunks into single blob
        const audioBlob = new Blob(_audioChunks, { type: _currentSession.mimeType || 'audio/webm' });

        // Save audio data with key-sharing (id = session.id)
        await AudioDataRepository.create(
          createAudioData({
            id: _currentSession.id,
            blob: audioBlob,
            size: audioBlob.size
          })
        );

        // Update session status
        const updatedSession = await RecordingSessionRepository.update(_currentSession.id, {
          status: RECORDING_STATUS.STOPPED,
          duration
        });

        // Save for completeRecording() to use
        _lastStoppedSession = updatedSession;
        _lastAudioBlob = audioBlob;

        // Clean up resources
        _cleanup();

        resolve({ session: updatedSession, audioBlob });
      } catch (err) {
        _cleanup();
        reject(err);
      }
    };

    _mediaRecorder.stop();
  });
}

/**
 * Release all recording resources (media tracks, speech recognition, timer).
 * @private
 */
function _cleanup() {
  // Stop media tracks (release microphone)
  if (_mediaStream) {
    _mediaStream.getTracks().forEach(track => track.stop());
    _mediaStream = null;
  }

  // Stop speech recognition
  if (_speechRecognition) {
    try { _speechRecognition.abort(); } catch (_e) { /* ignore */ }
    _speechRecognition = null;
  }

  // Stop timer
  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }

  _mediaRecorder = null;
  _audioChunks = [];
  _currentSession = null;
  _startTime = null;
}

// ============================================================================
// WEB SPEECH API
// ============================================================================

/**
 * Create and configure a SpeechRecognition instance.
 * Returns null if not available.
 * @returns {SpeechRecognition|null}
 */
export function createSpeechRecognition() {
  const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';

  // Auto-restart on end (Chrome may auto-stop after silence)
  // Use setTimeout to avoid InvalidStateError from immediate restart
  // Only restart if recording is still active
  recognition.onend = () => {
    if (!_mediaRecorder || _mediaRecorder.state !== 'recording') return;
    setTimeout(() => {
      if (!_mediaRecorder || _mediaRecorder.state !== 'recording') return;
      try {
        recognition.start();
      } catch (e) {
        // InvalidStateError — retry after longer delay
        if (e.name === 'InvalidStateError') {
          setTimeout(() => {
            try { recognition.start(); } catch (_e) { /* give up */ }
          }, 500);
        }
      }
    }, 100);
  };

  recognition.onresult = (event) => {
    if (!_transcriptEl) return;
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    _transcriptEl.textContent = transcript;
  };

  return recognition;
}

// ============================================================================
// ORPHANED SESSION RECOVERY
// ============================================================================

const ORPHAN_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Recover sessions stuck in 'recording' status (e.g., after tab crash).
 * Sessions older than 10 minutes with status 'recording' are set to 'failed'.
 * @returns {Promise<number>} Number of sessions recovered
 */
export async function recoverOrphanedSessions() {
  const recordingSessions = await RecordingSessionRepository.getByStatus(RECORDING_STATUS.RECORDING);
  let count = 0;
  const now = Date.now();

  for (const session of recordingSessions) {
    // Handle both numeric timestamps and ISO strings
    const createdTime = typeof session.createdAt === 'number'
      ? session.createdAt
      : new Date(session.createdAt).getTime();

    if (now - createdTime > ORPHAN_THRESHOLD_MS) {
      await RecordingSessionRepository.update(session.id, {
        status: RECORDING_STATUS.FAILED,
        error: 'Orphaned recording session recovered after crash'
      });
      count++;
    }
  }

  return count;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format seconds into HH:MM:SS string.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

// ============================================================================
// PHOTO CAPTURE
// ============================================================================

/**
 * Capture a photo during recording, resize via canvas, store in IDB.
 * @param {Blob|File} file - Image file from file input
 * @returns {Promise<Object|null>} PhotoCapture record or null if no active session
 */
export async function capturePhoto(file) {
  if (!_currentSession || !_startTime) return null;

  const timestampMs = Date.now() - _startTime;

  // In jsdom, canvas/Image won't work — store the blob directly
  // In real browser, this would resize via canvas to 1920px max edge + 80% JPEG
  let outputBlob = file;
  let outputSize = file.size;

  // Attempt canvas resize (gracefully skip in jsdom/test environments)
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      const maxEdge = 1920;
      let { width, height } = bitmap;
      if (width > maxEdge || height > maxEdge) {
        const scale = maxEdge / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, width, height);
      outputBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
      outputSize = outputBlob.size;
      bitmap.close();
    }
  } catch (_e) {
    // Canvas APIs not available (jsdom) — use original blob
  }

  const photo = createPhotoCapture({
    recordingSessionId: _currentSession.id,
    timestampMs,
    blob: outputBlob,
    size: outputSize
  });

  await PhotoCaptureRepository.create(photo);
  return photo;
}

// ============================================================================
// TRANSCRIPT STUB SERVICE
// ============================================================================

/**
 * Stub transcription service. Generates placeholder transcript + segments.
 * Interface matches future Whisper integration.
 * @param {Blob} _audioBlob - Audio data (unused in stub)
 * @param {number} duration - Duration in seconds
 * @returns {Promise<{text: string, segments: Array<{start: number, end: number, text: string}>}>}
 */
export async function transcribe(_audioBlob, duration) {
  const segmentDuration = 60; // 1 segment per 60 seconds
  const segments = [];

  if (duration <= 0) {
    return {
      text: 'No audio content detected.',
      segments: [{ start: 0, end: 0, text: 'No audio content detected.' }]
    };
  }

  const segCount = Math.max(1, Math.ceil(duration / segmentDuration));
  const texts = [];

  for (let i = 0; i < segCount; i++) {
    const start = i * segmentDuration;
    const end = Math.min((i + 1) * segmentDuration, duration);
    const text = `[Segment ${i + 1}] Placeholder transcript for ${start}s - ${end}s. Real transcription will be available in v1.0.0.`;
    segments.push({ start, end, text });
    texts.push(text);
  }

  return { text: texts.join(' '), segments };
}

// ============================================================================
// POST-RECORDING FLOW
// ============================================================================

/**
 * Complete the recording: transcribe, create Lecture + Segments, update session.
 * Call after stopRecording().
 * @returns {Promise<string|null>} Created lecture ID, or null if no stopped session
 */
export async function completeRecording() {
  if (!_lastStoppedSession) return null;

  const session = _lastStoppedSession;
  const audioBlob = _lastAudioBlob;
  _lastStoppedSession = null;
  _lastAudioBlob = null;

  try {
    // Transcribe (stub)
    const duration = session.duration || 0;
    const result = await transcribe(audioBlob, duration);

    // Create Lecture
    const lecture = await LectureRepository.create(
      createLecture({
        title: session.title || `Recording ${new Date(session.createdAt).toLocaleString()}`,
        duration
      })
    );

    // Create Segments
    for (const seg of result.segments) {
      await SegmentRepository.create({
        lectureId: lecture.id,
        startTime: seg.start,
        endTime: seg.end,
        type: 'transcript',
        metadata: { text: seg.text }
      });
    }

    // Update session: link to lecture + mark completed
    await RecordingSessionRepository.update(session.id, {
      lectureId: lecture.id,
      status: RECORDING_STATUS.COMPLETED,
      transcript: result.text
    });

    return lecture.id;
  } catch (err) {
    // Mark session as failed so it doesn't stay in STOPPED limbo
    await RecordingSessionRepository.update(session.id, {
      status: RECORDING_STATUS.FAILED,
      error: err.message || 'Post-recording processing failed'
    }).catch(() => { /* best effort */ });
    throw err;
  }
}

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Render the recording view into the given container.
 * Mobile-first layout: timer, transcript, record/stop/photo buttons.
 * @param {HTMLElement} container
 */
export function renderRecordView(container) {
  clearElement(container);

  // Title input
  const titleRow = createElement('div', 'record-title-row');
  const titleLabel = createElement('label', 'record-title-label');
  titleLabel.textContent = 'Title';
  titleLabel.setAttribute('for', 'record-title-input');
  const titleInput = createElement('input', 'record-title-input');
  titleInput.type = 'text';
  titleInput.id = 'record-title-input';
  titleInput.placeholder = 'Recording title (optional)';
  titleRow.appendChild(titleLabel);
  titleRow.appendChild(titleInput);

  // Timer display
  _timerEl = createElement('div', 'record-timer');
  _timerEl.setAttribute('aria-live', 'polite');
  _timerEl.textContent = '00:00:00';

  // Status indicator
  const statusEl = createElement('div', 'record-status');
  statusEl.textContent = 'Ready to record';

  // Transcript area
  _transcriptEl = createElement('div', 'record-transcript');
  _transcriptEl.setAttribute('aria-label', 'Live transcript');
  _transcriptEl.textContent = '';

  // Photo thumbnails
  const photoGrid = createElement('div', 'record-photo-grid');

  // Button row
  const btnRow = createElement('div', 'record-btn-row');

  // Record button
  _recordBtn = createElement('button', 'record-btn');
  _recordBtn.setAttribute('aria-label', 'Start recording');
  _recordBtn.textContent = 'Record';
  _recordBtn.style.minWidth = '56px';
  _recordBtn.style.minHeight = '56px';
  _recordBtn.addEventListener('click', async () => {
    try {
      const title = titleInput.value.trim();
      await startRecording({ title });
      _recordBtn.style.display = 'none';
      _stopBtn.style.display = '';
      _photoBtn.disabled = false;
      statusEl.textContent = 'Recording...';
      _startTimer();
      showToast('success', 'Recording', 'Recording started');
    } catch (err) {
      showToast('error', 'Microphone Error', 'Microphone access denied');
    }
  });

  // Stop button (hidden initially)
  _stopBtn = createElement('button', 'stop-btn');
  _stopBtn.setAttribute('aria-label', 'Stop recording');
  _stopBtn.textContent = 'Stop';
  _stopBtn.style.minWidth = '56px';
  _stopBtn.style.minHeight = '56px';
  _stopBtn.style.display = 'none';
  _stopBtn.addEventListener('click', async () => {
    try {
      statusEl.textContent = 'Saving...';
      const result = await stopRecording();
      _recordBtn.style.display = '';
      _stopBtn.style.display = 'none';
      _photoBtn.disabled = true;
      statusEl.textContent = 'Recording saved — click Save to create lecture';
      if (result && result.session) {
        showToast('success', 'Recording', 'Recording saved');
        saveBtn.disabled = false;
      }
    } catch (err) {
      statusEl.textContent = 'Error saving recording';
      showToast('error', 'Recording Error', 'Error saving recording');
    }
  });

  // Photo button
  _photoBtn = createElement('button', 'photo-btn');
  _photoBtn.setAttribute('aria-label', 'Take photo');
  _photoBtn.textContent = 'Photo';
  _photoBtn.disabled = true;

  // Hidden file input for photo capture
  const photoInput = createElement('input', 'photo-input');
  photoInput.type = 'file';
  photoInput.accept = 'image/*';
  photoInput.setAttribute('capture', 'environment');
  photoInput.style.display = 'none';

  _photoBtn.addEventListener('click', () => {
    photoInput.click();
  });

  // Save & Create Lecture button (disabled until recording is stopped)
  const saveBtn = createElement('button', 'save-btn');
  saveBtn.setAttribute('aria-label', 'Save and create lecture');
  saveBtn.textContent = 'Save & Create Lecture';
  saveBtn.disabled = true;
  saveBtn.addEventListener('click', async () => {
    try {
      saveBtn.disabled = true;
      statusEl.textContent = 'Creating lecture...';
      const lectureId = await completeRecording();
      if (lectureId) {
        showToast('success', 'Lecture', 'Lecture created successfully');
        navigateTo(`#/lecture/${lectureId}`);
      }
    } catch (err) {
      statusEl.textContent = 'Error creating lecture';
      showToast('error', 'Lecture Error', 'Error creating lecture');
      saveBtn.disabled = false;
    }
  });

  btnRow.appendChild(_recordBtn);
  btnRow.appendChild(_stopBtn);
  btnRow.appendChild(_photoBtn);
  btnRow.appendChild(saveBtn);

  // Assemble
  container.appendChild(titleRow);
  container.appendChild(_timerEl);
  container.appendChild(statusEl);
  container.appendChild(_transcriptEl);
  container.appendChild(photoGrid);
  container.appendChild(btnRow);
  container.appendChild(photoInput);
}

/**
 * Start the recording timer.
 * @private
 */
function _startTimer() {
  if (_timerInterval) clearInterval(_timerInterval);
  const start = Date.now();
  _timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    if (_timerEl) {
      _timerEl.textContent = formatTime(elapsed);
    }
  }, 1000);
}

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

// Register with router (AD-1: downstream registers itself)
setRecordRenderer(renderRecordView);

// Register cleanup for record view — must release microphone if navigating away
registerViewCleanup('record', () => {
  // Stop active recording and release microphone
  _cleanup();
  // Release post-recording state (can hold 20MB+ audio blob)
  _lastStoppedSession = null;
  _lastAudioBlob = null;
  // Null DOM refs
  _timerEl = null;
  _transcriptEl = null;
  _recordBtn = null;
  _stopBtn = null;
  _photoBtn = null;
});
