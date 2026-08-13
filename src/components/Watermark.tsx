/**
 * Oversized thumbs-up sitting behind the whole app. Deliberately near-invisible:
 * it should read as texture, never compete with the task list on top of it.
 */
export function Watermark() {
  return (
    <svg className="watermark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2 21h4V9H2v12z" fill="currentColor" />
      <path
        d="M23 10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1z"
        fill="currentColor"
      />
    </svg>
  );
}
