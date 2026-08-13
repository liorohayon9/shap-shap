import type { Task } from '../lib/types';
import { formatDay, formatTime, repeatLabel } from '../lib/format';

interface Props {
  tasks: Task[];
  onDone: (id: number) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
}

function TaskRow({ task, onDone, onEdit, onDelete }: { task: Task } & Omit<Props, 'tasks'>) {
  const missed = !task.done && task.at <= Date.now();

  return (
    <li className={`task ${task.done ? 'task--done' : ''} ${missed ? 'task--missed' : ''}`}>
      <button
        type="button"
        className="task__check"
        onClick={() => onDone(task.id)}
        aria-label={task.done ? 'Mark not done' : 'Mark done'}
      >
        {task.done && (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="m5 13 4.5 4.5L19 7" />
          </svg>
        )}
      </button>

      <button type="button" className="task__main" onClick={() => onEdit(task)}>
        <span className="task__title">{task.title}</span>
        <span className="task__meta">
          {missed && <span className="task__badge">Missed</span>}
          {formatDay(task.at)} at {formatTime(task.at)}
          {task.repeat !== 'none' && <span className="task__repeat">· {repeatLabel(task.repeat)}</span>}
        </span>
      </button>

      <button
        type="button"
        className="task__delete"
        onClick={() => onDelete(task.id)}
        aria-label={`Delete ${task.title}`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}

export function TaskList({ tasks, onDone, onEdit, onDelete }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Nothing scheduled</p>
        <p className="empty__hint">
          Tap the button and say something like<br />
          <em>“remind me to call Mary at nine pm”</em>
        </p>
      </div>
    );
  }

  const upcoming = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="list">
      {upcoming.length > 0 && (
        <ul className="list__group">
          {upcoming.map((t) => (
            <TaskRow key={t.id} task={t} onDone={onDone} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <>
          <h2 className="list__heading">Done</h2>
          <ul className="list__group">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onDone={onDone} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
