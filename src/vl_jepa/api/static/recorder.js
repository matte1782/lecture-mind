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
  createRecordingSession,
  createAudioData,
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
      showToast('Recording started');
    } catch (err) {
      showToast('Microphone access denied');
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
      statusEl.textContent = 'Recording saved';
      if (result && result.session) {
        showToast('Recording saved');
      }
    } catch (err) {
      statusEl.textContent = 'Error saving recording';
      showToast('Error saving recording');
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

  btnRow.appendChild(_recordBtn);
  btnRow.appendChild(_stopBtn);
  btnRow.appendChild(_photoBtn);

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
  // Null DOM refs
  _timerEl = null;
  _transcriptEl = null;
  _recordBtn = null;
  _stopBtn = null;
  _photoBtn = null;
});
