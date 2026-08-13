import { Capacitor } from '@capacitor/core';

export type SpeechHandlers = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
};

/** Stops the current recognition session. Safe to call twice. */
export type StopListening = () => void;

const LANG = 'en-US';

// -- Web Speech API (Chrome on Android, desktop Chrome) ----------------------

interface WebSpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface WebSpeechEvent {
  resultIndex: number;
  results: { length: number; [i: number]: WebSpeechResult };
}
interface WebSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: WebSpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => WebSpeechRecognition;

function webCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function startWeb(h: SpeechHandlers): StopListening {
  const Ctor = webCtor();
  if (!Ctor) {
    h.onError('This browser cannot listen. Use Chrome on Android, or install the app.');
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = LANG;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let best = '';
  let settled = false;

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) best += r[0].transcript;
      else interim += r[0].transcript;
    }
    h.onPartial((best + interim).trim());
  };
  rec.onerror = (e) => {
    if (settled) return;
    settled = true;
    h.onError(
      e.error === 'not-allowed'
        ? 'Microphone permission denied.'
        : e.error === 'no-speech'
          ? "Didn't catch that."
          : `Could not listen (${e.error}).`,
    );
  };
  rec.onend = () => {
    if (settled) return;
    settled = true;
    const text = best.trim();
    if (text) h.onFinal(text);
    else h.onError("Didn't catch that.");
  };

  try {
    rec.start();
  } catch {
    h.onError('Could not start the microphone.');
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}

// -- Native (Capacitor plugin, used inside the APK) --------------------------

/**
 * Loaded lazily: the plugin package is Android-only, and importing it eagerly
 * would drag native stubs into the browser build.
 */
/** Nothing heard at all for this long — stop rather than leave him staring at "Listening…". */
const SILENCE_GIVE_UP_MS = 20_000;

async function startNative(h: SpeechHandlers): Promise<StopListening> {
  const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');

  const { available } = await SpeechRecognition.available();
  if (!available) {
    h.onError('This phone has no speech recogniser. Install Google’s "Speech Recognition & Synthesis".');
    return () => {};
  }

  const perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== 'granted') {
    h.onError('Microphone permission denied.');
    return () => {};
  }

  let best = '';
  let settled = false;
  const handles: Array<{ remove: () => Promise<void> }> = [];
  let giveUp: ReturnType<typeof setTimeout> | undefined;

  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(giveUp);
    for (const handle of handles) void handle.remove();
    const text = best.trim();
    if (text) h.onFinal(text);
    else h.onError("Didn't catch that.");
  };

  handles.push(
    await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
      const text = data.matches?.[0]?.trim();
      if (!text) return;
      best = text;
      h.onPartial(text);
    }),
  );

  // With partialResults on, this is the only signal that recognition has ended.
  handles.push(
    await SpeechRecognition.addListener('listeningState', (data: { status: 'started' | 'stopped' }) => {
      if (data.status === 'stopped') finish();
    }),
  );

  giveUp = setTimeout(() => {
    void SpeechRecognition.stop().catch(() => {});
    finish();
  }, SILENCE_GIVE_UP_MS);

  try {
    // Documented to resolve immediately when partialResults is true, so its
    // resolution says nothing about whether he has finished speaking. Only use
    // a returned transcript if the plugin actually hands one back.
    const res = await SpeechRecognition.start({
      language: LANG,
      partialResults: true,
      popup: false,
      maxResults: 5,
    });
    const direct = res?.matches?.[0]?.trim();
    if (direct) {
      best = direct;
      finish();
    }
  } catch {
    h.onError('Could not start listening.');
    settled = true;
    clearTimeout(giveUp);
    for (const handle of handles) void handle.remove();
  }

  return () => {
    void SpeechRecognition.stop().catch(() => {});
  };
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function speechSupported(): boolean {
  return isNative() || webCtor() !== null;
}

/** Begins listening. Returns a stop function; handlers fire at most once for final/error. */
export function startListening(h: SpeechHandlers): StopListening {
  if (!isNative()) return startWeb(h);

  let stop: StopListening = () => {};
  let cancelled = false;
  void startNative(h).then((s) => {
    if (cancelled) s();
    else stop = s;
  });
  return () => {
    cancelled = true;
    stop();
  };
}
