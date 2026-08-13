import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../lib/types';
import { formatTime } from '../lib/format';

const HOLD_MS = 3000;

/**
 * Browser-only alarm screen, so the flow can be tested without a phone.
 * The real one is a native Activity that shows over the lock screen.
 */
export function RingScreen({ task, onDismiss }: { task: Task; onDismiss: () => void }) {
  const [progress, setProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const audio = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(ctx.destination);

      // Two-tone alarm chirp on a repeating envelope.
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 880;
      osc.connect(gain);
      osc.start();

      const beat = setInterval(() => {
        if (cancelled) return;
        const t = ctx.currentTime;
        osc.frequency.setValueAtTime(osc.frequency.value === 880 ? 660 : 880, t);
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      }, 600);

      audio.current = {
        ctx,
        stop: () => {
          clearInterval(beat);
          try {
            osc.stop();
          } catch {
            /* already stopped */
          }
          void ctx.close();
        },
      };
    } catch {
      // No audio (autoplay policy) — the screen alone still does the job.
    }

    if ('vibrate' in navigator) {
      const buzz = setInterval(() => navigator.vibrate?.([600, 400]), 1000);
      return () => {
        cancelled = true;
        clearInterval(buzz);
        navigator.vibrate?.(0);
        audio.current?.stop();
      };
    }
    return () => {
      cancelled = true;
      audio.current?.stop();
    };
  }, []);

  const tick = useCallback(() => {
    if (holdStart.current === null) return;
    const elapsed = Date.now() - holdStart.current;
    const p = Math.min(1, elapsed / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      audio.current?.stop();
      navigator.vibrate?.(0);
      onDismiss();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [onDismiss]);

  const begin = () => {
    holdStart.current = Date.now();
    raf.current = requestAnimationFrame(tick);
  };
  const end = () => {
    holdStart.current = null;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    setProgress(0);
  };

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
  }, []);

  return (
    <div className="ring">
      <p className="ring__time">{formatTime(task.at)}</p>
      <h1 className="ring__title">{task.title}</h1>

      <button
        type="button"
        className="ring__hold"
        onPointerDown={begin}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        style={{ ['--p' as string]: progress }}
      >
        <span className="ring__fill" />
        <span className="ring__label">
          {progress > 0 ? 'Keep holding…' : 'Hold to dismiss'}
        </span>
      </button>

      <p className="ring__hint">Hold the button for 3 seconds</p>
    </div>
  );
}
