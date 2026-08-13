import { useCallback, useEffect, useRef, useState } from 'react';
import { RecordButton } from './components/RecordButton';
import { ConfirmSheet, type Draft } from './components/ConfirmSheet';
import { TaskList } from './components/TaskList';
import { RingScreen } from './components/RingScreen';
import { SetupBanner } from './components/SetupBanner';
import { nextOccurrence, parseSpeech } from './lib/parse';
import { loadTasks, nextId, saveTasks, sortByTime } from './lib/store';
import { startListening, speechSupported, type StopListening } from './lib/speech';
import {
  cancelAlarm,
  checkPermissions,
  isNativeAlarm,
  onWebAlarm,
  resyncAlarms,
  scheduleAlarm,
  type AlarmPermissions,
} from './lib/alarms';
import type { Task } from './lib/types';

type Mode =
  | { kind: 'idle' }
  | { kind: 'listening' }
  | { kind: 'confirm'; draft: Draft }
  | { kind: 'editing'; task: Task; draft: Draft }
  | { kind: 'ringing'; task: Task };

const OPEN_PERMS: AlarmPermissions = {
  exactAlarm: true,
  notifications: true,
  batteryOptimized: false,
  fullScreen: true,
};

/** Rolls repeating tasks past due onto their next slot; leaves one-offs as "missed". */
function reconcile(tasks: Task[], now = Date.now()): Task[] {
  return tasks.map((t) => {
    if (t.done || t.at > now || t.repeat === 'none') return t;
    const next = nextOccurrence(t.at, t.repeat, new Date(now));
    return next ? { ...t, at: next } : t;
  });
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => reconcile(loadTasks()));
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [perms, setPerms] = useState<AlarmPermissions>(OPEN_PERMS);
  const stopRef = useRef<StopListening | null>(null);

  useEffect(() => saveTasks(tasks), [tasks]);

  const refreshPerms = useCallback(() => {
    void checkPermissions().then(setPerms);
  }, []);

  // Re-arm on open: covers reboots, force-stops, and long-range alarms.
  useEffect(() => {
    void resyncAlarms(tasks);
    refreshPerms();
    onWebAlarm((task) => setMode({ kind: 'ringing', task }));

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setTasks((prev) => reconcile(prev));
      refreshPerms();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // Runs once: `tasks` here is only the initial snapshot for the first resync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopListening = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const record = useCallback(() => {
    if (mode.kind === 'listening') {
      stopListening();
      return;
    }
    setError(null);
    setHeard('');
    setMode({ kind: 'listening' });

    stopRef.current = startListening({
      onPartial: setHeard,
      onFinal: (text) => {
        stopRef.current = null;
        const parsed = parseSpeech(text);
        setMode({ kind: 'confirm', draft: { ...parsed, transcript: text } });
      },
      onError: (message) => {
        stopRef.current = null;
        setError(message);
        setMode({ kind: 'idle' });
      },
    });
  }, [mode.kind, stopListening]);

  const saveNew = useCallback((d: Draft) => {
    const task: Task = {
      id: nextId(),
      title: d.title,
      at: d.at,
      repeat: d.repeat,
      done: false,
      createdAt: Date.now(),
      transcript: d.transcript,
    };
    setTasks((prev) => sortByTime([...prev, task]));
    void scheduleAlarm(task);
    setMode({ kind: 'idle' });
  }, []);

  const saveEdit = useCallback((original: Task, d: Draft) => {
    const updated: Task = { ...original, title: d.title, at: d.at, repeat: d.repeat, done: false };
    setTasks((prev) => sortByTime(prev.map((t) => (t.id === updated.id ? updated : t))));
    void cancelAlarm(updated.id).then(() => scheduleAlarm(updated));
    setMode({ kind: 'idle' });
  }, []);

  const toggleDone = useCallback((id: number) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        if (done) void cancelAlarm(id);
        else void scheduleAlarm({ ...t, done });
        return { ...t, done };
      }),
    );
  }, []);

  const remove = useCallback((id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    void cancelAlarm(id);
  }, []);

  const dismissRinging = useCallback((task: Task) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        const next = nextOccurrence(t.at, t.repeat, new Date());
        if (next) {
          const rolled = { ...t, at: next };
          void scheduleAlarm(rolled);
          return rolled;
        }
        return { ...t, done: true };
      }),
    );
    setMode({ kind: 'idle' });
  }, []);

  if (mode.kind === 'ringing') {
    return <RingScreen task={mode.task} onDismiss={() => dismissRinging(mode.task)} />;
  }

  const listening = mode.kind === 'listening';
  const sheet =
    mode.kind === 'confirm'
      ? { draft: mode.draft, label: 'Set reminder', save: saveNew, rerecord: record }
      : mode.kind === 'editing'
        ? {
            draft: mode.draft,
            label: 'Save changes',
            save: (d: Draft) => saveEdit(mode.task, d),
            rerecord: undefined,
          }
        : null;

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Remind Me</h1>
        {tasks.some((t) => !t.done) && (
          <span className="app__count">{tasks.filter((t) => !t.done).length} upcoming</span>
        )}
      </header>

      <main className="app__main">
        {isNativeAlarm() && <SetupBanner permissions={perms} onRecheck={refreshPerms} />}
        {!isNativeAlarm() && (
          <p className="webnote">
            Running in the browser — alarms only ring while this tab is open. Install the app for
            real alarms.
          </p>
        )}
        <TaskList tasks={tasks} onDone={toggleDone} onEdit={(task) => setMode({ kind: 'editing', task, draft: { ...task, timeGuessed: false } })} onDelete={remove} />
      </main>

      <footer className="app__footer">
        {error && <p className="error">{error}</p>}
        {listening && (
          <p className="transcript">{heard || <span className="transcript--wait">Listening…</span>}</p>
        )}
        {!listening && !error && <p className="prompt">Tap and say what you need to remember</p>}
        <RecordButton listening={listening} disabled={!speechSupported()} onPress={record} />
      </footer>

      {sheet && (
        <>
          <div className="scrim" onClick={() => setMode({ kind: 'idle' })} />
          <ConfirmSheet
            draft={sheet.draft}
            saveLabel={sheet.label}
            onSave={sheet.save}
            onCancel={() => setMode({ kind: 'idle' })}
            onRerecord={sheet.rerecord}
          />
        </>
      )}
    </div>
  );
}
