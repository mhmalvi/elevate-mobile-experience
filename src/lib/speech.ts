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

export interface SpeechCallbacks {
  /** Fires with the in-progress utterance (not yet finalised). */
  onPartial?: (text: string) => void;
  /** Fires when an utterance is finalised. May fire several times per session. */
  onFinal?: (text: string) => void;
  /** Fires on a real error. `no-speech` and `aborted` are reported but are not fatal. */
  onError?: (code: SpeechErrorCode, raw?: unknown) => void;
  /** Fires once when the session has fully ended and no more callbacks will run. */
  onEnd?: () => void;
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
    opts.onEnd?.();
    return { stop: () => { } };
  }

  if (!(await ensureSpeechPermission())) {
    opts.onError?.('permission-denied');
    opts.onEnd?.();
    return { stop: () => { } };
  }

  return isNative()
    ? startNative(lang, opts)
    : startWeb(lang, opts);
}

// ---------------------------------------------------------------- native path

async function startNative(lang: string, opts: SpeechCallbacks): Promise<SpeechSession> {
  let stopped = false;
  let ended = false;
  let lastPartial = '';

  const finish = () => {
    if (ended) return;
    ended = true;
    void NativeSpeech.removeAllListeners();
    opts.onEnd?.();
  };

  await NativeSpeech.removeAllListeners();

  await NativeSpeech.addListener('partialResults', (data) => {
    const text = data?.matches?.[0] ?? '';
    if (!text) return;
    lastPartial = text;
    opts.onPartial?.(text);
  });

  await NativeSpeech.addListener('listeningState', (data) => {
    if (data.status !== 'stopped') return;

    // The native recogniser ended this utterance. Commit whatever it had.
    if (lastPartial.trim()) {
      opts.onFinal?.(lastPartial.trim());
      lastPartial = '';
    }

    if (stopped) {
      finish();
      return;
    }

    // Emulate continuous listening: the caller has not asked us to stop, so
    // begin another utterance. Guarded by `stopped` so stop() always wins.
    void NativeSpeech.start({
      language: lang,
      partialResults: true,
      popup: false,
    }).catch(() => finish());
  });

  try {
    await NativeSpeech.start({
      language: lang,
      partialResults: true,
      popup: false,
    });
  } catch (err) {
    opts.onError?.('unknown', err);
    finish();
  }

  return {
    stop: () => {
      stopped = true;
      NativeSpeech.stop()
        .catch(() => { /* already stopped */ })
        .finally(() => finish());
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
  const finish = () => {
    if (ended) return;
    ended = true;
    opts.onEnd?.();
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

  recognition.onend = () => finish();

  try {
    recognition.start();
  } catch (err) {
    opts.onError?.('unknown', err);
    finish();
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        finish();
      }
    },
  };
}

// ------------------------------------------------------------ text to speech

/**
 * Speak a response. Picks a voice matching the user's locale rather than the
 * previous hardcoded list of macOS/iOS Australian and Irish voice names
 * (Karen, Moira, Tessa…), which existed on no Android device at all.
 */
export function speakText(
  text: string,
  opts: { lang?: string; onEnd?: () => void } = {},
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts.onEnd?.();
    return;
  }

  const lang = resolveSpeechLocale(opts.lang);
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
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
