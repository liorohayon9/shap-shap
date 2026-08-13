import { useEffect, useRef, useState } from 'react';
import type { Repeat } from '../lib/types';
import { formatCountdown, fromLocalInput, toLocalInput } from '../lib/format';

export interface Draft {
  title: string;
  at: number;
  repeat: Repeat;
  timeGuessed: boolean;
  transcript?: string;
}

interface Props {
  draft: Draft;
  /** "Set reminder" for a new one, "Save changes" when editing an existing task. */
  saveLabel: string;
  onSave: (d: Draft) => void;
  onCancel: () => void;
  onRerecord?: () => void;
}

const REPEATS: Array<{ value: Repeat; label: string }> = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Every week' },
];

export function ConfirmSheet({ draft, saveLabel, onSave, onCancel, onRerecord }: Props) {
  const [title, setTitle] = useState(draft.title);
  const [at, setAt] = useState(draft.at);
  const [repeat, setRepeat] = useState<Repeat>(draft.repeat);
  const titleRef = useRef<HTMLInputElement>(null);

  // A guessed time is the one thing most likely to be wrong — send focus there.
  useEffect(() => {
    if (!draft.timeGuessed) return;
    const el = document.getElementById('when-input') as HTMLInputElement | null;
    el?.focus();
  }, [draft.timeGuessed]);

  const past = at <= Date.now();
  const canSave = title.trim().length > 0 && !past;

  return (
    <div className="sheet" role="dialog" aria-label="Confirm reminder">
      <div className="sheet__body">
        {draft.transcript && (
          <p className="heard">
            <span className="heard__label">Heard</span> “{draft.transcript}”
          </p>
        )}

        <label className="field">
          <span className="field__label">Remind me to</span>
          <input
            ref={titleRef}
            className="field__input field__input--title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Call Mary"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field__label">
            When
            {draft.timeGuessed && <em className="field__warn">no time heard — check this</em>}
          </span>
          <input
            id="when-input"
            type="datetime-local"
            className={`field__input ${draft.timeGuessed ? 'field__input--warn' : ''}`}
            value={toLocalInput(at)}
            onChange={(e) => {
              const ms = fromLocalInput(e.target.value);
              if (ms !== null) setAt(ms);
            }}
          />
        </label>

        <div className="field">
          <span className="field__label">Repeat</span>
          <div className="chips">
            {REPEATS.map((r) => (
              <button
                key={r.value}
                type="button"
                className={`chip ${repeat === r.value ? 'chip--on' : ''}`}
                onClick={() => setRepeat(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <p className={`countdown ${past ? 'countdown--bad' : ''}`}>
          {past ? 'That time has already passed — pick a later one.' : `Rings ${formatCountdown(at)}`}
        </p>
      </div>

      <div className="sheet__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Discard
        </button>
        {onRerecord && (
          <button type="button" className="btn btn--ghost" onClick={onRerecord}>
            Say again
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canSave}
          onClick={() => onSave({ ...draft, title: title.trim(), at, repeat })}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
