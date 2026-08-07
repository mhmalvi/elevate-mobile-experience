/**
 * Speech recognition abstraction.
 *
 * WHY THIS EXISTS
 * ---------------
 * The app previously called `window.SpeechRecognition || window.webkitSpeechRecognition`
 * directly. That API is a Chrome-*browser* feature and is NOT implemented in the
 * Android System WebView, which is what Capacitor runs. So in the Play Store build
 * the centre microphone — the most prominent control in the UI — fell straight into
 * the "Voice not supported, use Chrome or Safari" branch on every device.
 *
 * This module picks the right engine per platform:
 *   - native (Android/iOS): @capacitor-community/speech-recognition
 *   - web:                  Web Speech API, unchanged behaviour
 *
 * and exposes one interface to the UI so neither component has to care.
 *
 * A note on "continuous" listening: the Web Speech API supports `continuous = true`
 * and streams until told to stop. The native recognisers do not — Android in
 * particular ends the session after a silence window. `startListening` papers over
 * that by restarting the native recogniser until the caller stops it, accumulating
 * finalised utterances as it goes.
 */

import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as NativeSpeech } from '@capacitor-community/speech-recognition';
import { TextToSpeech as NativeTts } from '@capacitor-community/text-to-speech';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export type SpeechErrorCode =
  | 'not-supported'
  | 'permission-denied'
  | 'no-speech'
  | 'aborted'
  | 'network'
  | 'unknown';

/**
 * Why a session ended.
 *
 * `requested` — the caller invoked `stop()`.
 * `engine`    — the recogniser ended on its own (finished, failed, or went away).
 *
 * The UI needs to tell these apart: an engine-side end while nothing was heard
 * deserves an explanation to the user, whereas the user tapping Cancel does not.
 */
export type SpeechEndReason = 'requested' | 'engine';

export interface SpeechCallbacks {
  /** Fires with the in-progress utterance (not yet finalised). */
  onPartial?: (text: string) => void;
  /** Fires when an utterance is finalised. May fire several times per session. */
  onFinal?: (text: string) => void;
  /** Fires on a real error. `no-speech` and `aborted` are reported but are not fatal. */
  onError?: (code: SpeechErrorCode, raw?: unknown) => void;
  /** Fires once when the session has fully ended and no more callbacks will run. */
  onEnd?: (reason: SpeechEndReason) => void;
}

export interface SpeechSession {
  stop: () => void;
}

const isNative = () => Capacitor.isNativePlatform();

/**
 * Best-effort BCP-47 tag for the user's device.
 *
 * Replaces the hardcoded 'en-AU' that was applied to every user regardless of
 * where they are — recognition accuracy against a US, Indian or Scottish accent
 * under an en-AU acoustic model is measurably worse, and non-English speakers
 * had no path at all.
 *
 * `navigator.language` reflects the device locale inside the Capacitor WebView
 * too, so this works on all three platforms without another dependency.
 */
export function resolveSpeechLocale(preferred?: string | null): string {
  if (preferred) return preferred;
  if (typeof navigator !== 'undefined') {
    const tag = navigator.language || (navigator.languages && navigator.languages[0]);
    if (tag) return tag;
  }
  return 'en-US';
}

/** Whether any speech engine is usable on this device. */
export async function isSpeechAvailable(): Promise<boolean> {
  if (isNative()) {
    try {
      const { available } = await NativeSpeech.available();
      return available;
    } catch {
      return false;
    }
  }
  return typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Ensure we hold microphone / speech permission.
 * On web the browser prompts implicitly when recognition starts, so this is a no-op.
 */
export async function ensureSpeechPermission(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const current = await NativeSpeech.checkPermissions();
    if (current.speechRecognition === 'granted') return true;
    const requested = await NativeSpeech.requestPermissions();
    return requested.speechRecognition === 'granted';
  } catch {
    return false;
  }
}

/** Map a Web Speech API error string onto our normalised codes. */
function mapWebError(err: string): SpeechErrorCode {
  switch (err) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission-denied';
    case 'no-speech':
      return 'no-speech';
    case 'aborted':
      return 'aborted';
    case 'network':
      return 'network';
    default:
      return 'unknown';
  }
}

/**
 * Start listening. Returns a handle whose `stop()` ends the session.
 * `onEnd` is guaranteed to fire exactly once.
 */
export async function startListening(
  opts: SpeechCallbacks & { lang?: string },
): Promise<SpeechSession> {
  const lang = resolveSpeechLocale(opts.lang);

  if (!(await isSpeechAvailable())) {
    opts.onError?.('not-supported');
    opts.onEnd?.('engine');
    return { stop: () => { } };
  }

  if (!(await ensureSpeechPermission())) {
    opts.onError?.('permission-denied');
    opts.onEnd?.('engine');
    return { stop: () => { } };
  }

  return isNative()
    ? startNative(lang, opts)
    : startWeb(lang, opts);
}

// ---------------------------------------------------------------- native path

/**
 * How long we wait for ANY sign of life from the native recogniser before
 * treating the utterance as dead.
 *
 * The plugin gives us no error channel in `partialResults` mode. It calls
 * `call.resolve()` the instant it hands the intent to the OS, so when the
 * recogniser later fails, `onError` rejects an already-settled call and the
 * bridge drops the rejection — and that path emits no `listeningState` event
 * either. Verified on device: the recogniser opened the mic, closed it 5.3s
 * later with NO_SPEECH_DETECTED followed by a client-side error, and the
 * WebView was told nothing at all. Without a watchdog the UI counts
 * "Listening" over a microphone that is already shut, for the full two-minute
 * cap, and never restarts or reports anything.
 *
 * Android's own silence timeout is ~5s, so a working recogniser always reports
 * something well inside this window.
 */
const NATIVE_ACTIVITY_TIMEOUT_MS = 12_000;

/**
 * Consecutive dead cycles before we give up rather than restart again.
 * One dead cycle is ordinary (a user who has not spoken yet); a second means
 * the recogniser is not coming back and the user needs to be told.
 */
const NATIVE_SILENT_CYCLE_LIMIT = 2;

async function startNative(lang: string, opts: SpeechCallbacks): Promise<SpeechSession> {
  let stopped = false;
  let ended = false;
  let lastPartial = '';
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let silentCycles = 0;

  const clearWatchdog = () => {
    if (watchdog === null) return;
    clearTimeout(watchdog);
    watchdog = null;
  };

  const finish = (reason: SpeechEndReason) => {
    if (ended) return;
    ended = true;
    clearWatchdog();
    void NativeSpeech.removeAllListeners();
    opts.onEnd?.(reason);
  };

  const armWatchdog = () => {
    clearWatchdog();
    watchdog = setTimeout(onDeadCycle, NATIVE_ACTIVITY_TIMEOUT_MS);
  };

  /** Hand up whatever the recogniser gave us before the utterance closed. */
  const commitPartial = () => {
    if (!lastPartial.trim()) return;
    opts.onFinal?.(lastPartial.trim());
    lastPartial = '';
  };

  const beginUtterance = () => {
    armWatchdog();
    return NativeSpeech.start({
      language: lang,
      partialResults: true,
      popup: false,
    });
  };

  /** The recogniser said nothing for a whole window — assume it is gone. */
  function onDeadCycle() {
    watchdog = null;
    if (stopped || ended) return;

    silentCycles += 1;
    commitPartial();

    if (silentCycles >= NATIVE_SILENT_CYCLE_LIMIT) {
      // Report as no-speech rather than a hard error: silence is by far the
      // likeliest cause, and it is the truthful description of what we saw.
      opts.onError?.('no-speech');
      finish('engine');
      return;
    }

    void beginUtterance().catch(() => finish('engine'));
  }

  await NativeSpeech.removeAllListeners();

  await NativeSpeech.addListener('partialResults', (data) => {
    const text = data?.matches?.[0] ?? '';
    if (!text) return;
    // Real audio is coming through: the session is healthy, so reset both the
    // watchdog and the dead-cycle tally.
    silentCycles = 0;
    armWatchdog();
    lastPartial = text;
    opts.onPartial?.(text);
  });

  await NativeSpeech.addListener('listeningState', (data) => {
    if (data.status !== 'stopped') {
      // 'started' — the recogniser heard speech begin. Still alive.
      silentCycles = 0;
      armWatchdog();
      return;
    }

    // The native recogniser ended this utterance. Commit whatever it had.
    commitPartial();

    if (stopped) {
      finish('requested');
      return;
    }

    // Emulate continuous listening: the caller has not asked us to stop, so
    // begin another utterance. Guarded by `stopped` so stop() always wins.
    void beginUtterance().catch(() => finish('engine'));
  });

  try {
    await beginUtterance();
  } catch (err) {
    opts.onError?.('unknown', err);
    finish('engine');
  }

  return {
    stop: () => {
      stopped = true;
      clearWatchdog();
      // The plugin's stop() never settles: SpeechRecognition.java posts the
      // work to the WebView thread and returns without ever calling resolve()
      // or reject() on any path. Hanging finish() off that promise — as this
      // did — meant onEnd was silently lost on every explicit stop, so the
      // caller's cleanup never ran. Fire and forget, and end the session here.
      void NativeSpeech.stop().catch(() => { /* already stopped */ });
      finish('requested');
    },
  };
}

// ------------------------------------------------------------------- web path

function startWeb(lang: string, opts: SpeechCallbacks): SpeechSession {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;
  recognition.maxAlternatives = 1;

  let ended = false;
  let stopRequested = false;
  const finish = (reason: SpeechEndReason) => {
    if (ended) return;
    ended = true;
    opts.onEnd?.(reason);
  };

  // Track how many results we have already finalised so a `continuous` session
  // doesn't re-emit earlier utterances on every event.
  let finalisedCount = 0;

  recognition.onresult = (event: any) => {
    let interim = '';
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        if (i >= finalisedCount) {
          opts.onFinal?.(result[0].transcript);
          finalisedCount = i + 1;
        }
      } else {
        interim += result[0].transcript;
      }
    }
    if (interim) opts.onPartial?.(interim);
  };

  recognition.onerror = (event: any) => {
    opts.onError?.(mapWebError(event?.error), event);
  };

  recognition.onend = () => finish(stopRequested ? 'requested' : 'engine');

  try {
    recognition.start();
  } catch (err) {
    opts.onError?.('unknown', err);
    finish('engine');
  }

  return {
    stop: () => {
      stopRequested = true;
      try {
        recognition.stop();
      } catch {
        finish('requested');
      }
    },
  };
}

// ------------------------------------------------------------ text to speech

/**
 * Speak a response.
 *
 * Two engines, for the same reason as recognition:
 * `window.speechSynthesis` is **undefined** in the Android System WebView.
 * Verified on device (Android 16, WebView/Chrome 150): both `speechSynthesis`
 * and `SpeechSynthesisUtterance` report `undefined`, so every spoken reply the
 * assistant makes would have been silent in the Play Store build — it would
 * have degraded to text-only without saying so.
 *
 * Native platforms therefore go through the Capacitor TTS plugin; the web keeps
 * the Web Speech API. Picks a voice matching the user's locale rather than the
 * previous hardcoded list of macOS/iOS Australian and Irish voice names
 * (Karen, Moira, Tessa…), which existed on no Android device at all.
 */
export function speakText(
  text: string,
  opts: { lang?: string; onEnd?: () => void } = {},
): void {
  const lang = resolveSpeechLocale(opts.lang);

  if (isNative()) {
    // The plugin resolves when playback finishes, so the promise IS the
    // end-of-speech signal. Failures must still call onEnd or the caller's
    // state machine stays stuck in 'speaking'.
    NativeTts.speak({
      text,
      lang,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      category: 'ambient',
    })
      .catch((e) => console.error('TTS: native speak failed', e))
      .finally(() => opts.onEnd?.());
    return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts.onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  const voice = pickVoiceForLocale(lang);
  if (voice) utterance.voice = voice;

  if (opts.onEnd) {
    utterance.onend = () => opts.onEnd?.();
    utterance.onerror = () => opts.onEnd?.();
  }

  window.speechSynthesis.speak(utterance);
}

function pickVoiceForLocale(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const lower = lang.toLowerCase();
  const base = lower.split('-')[0];

  // Exact locale, then same language in any region, then give up and let the
  // platform choose — never silently fall back to another language.
  return (
    voices.find((v) => v.lang.toLowerCase() === lower) ||
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === lower) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ||
    null
  );
}

export function cancelSpeech(): void {
  if (isNative()) {
    void NativeTts.stop().catch(() => { /* nothing was playing */ });
    return;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
