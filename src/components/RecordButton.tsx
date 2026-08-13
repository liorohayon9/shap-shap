interface Props {
  listening: boolean;
  disabled: boolean;
  onPress: () => void;
}

export function RecordButton({ listening, disabled, onPress }: Props) {
  return (
    <button
      type="button"
      className={`record ${listening ? 'record--live' : ''}`}
      onClick={onPress}
      disabled={disabled}
      aria-label={listening ? 'Stop recording' : 'Start recording'}
    >
      <span className="record__ring" aria-hidden="true" />
      <span className="record__core">
        {listening ? (
          <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"
            />
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              d="M6 11a6 6 0 0 0 12 0M12 17v3"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
