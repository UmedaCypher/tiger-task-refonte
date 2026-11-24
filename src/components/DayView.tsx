import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, dayOfYear, formatLong, todayKey, weekStart, WEEKDAY_SHORT, type DayKey } from '../lib/date';
import { PIGMENTS } from '../lib/pigments';
import {
  addTask,
  materializeRituals,
  pendingVerdicts,
  quickComplete,
  tasksOf,
  useStore,
  type Task,
} from '../lib/store';
import { verseOf } from '../lib/verses';
import { PigmentSheet } from './PigmentSheet';

export function DayView({ day, setDay }: { day: DayKey; setDay: (d: DayKey) => void }) {
  const today = todayKey();
  const tasks = useStore((s) => tasksOf(s, day), [day]);
  const pending = useStore((s) => pendingVerdicts(s, today), [today]);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => materializeRituals(day), [day]);

  const rel = day === today ? 'Aujourd’hui' : day === addDays(today, -1) ? 'Hier' : day === addDays(today, 1) ? 'Demain' : null;
  const judged = tasks.filter((t) => t.pigment !== 'white').length;
  const allWoven = tasks.length > 0 && judged === tasks.length;
  const pendingOther = pending.filter((d) => d !== day);

  return (
    <section className="day" key={day}>
      <WeekRibbon day={day} setDay={setDay} />

      <header className="day-head">
        <p className="eyebrow">
          {rel ?? 'Jour'} · jour {dayOfYear(day)} de {day.slice(0, 4)}
        </p>
        <h1 className="day-title">{formatLong(day)}</h1>
        <p className="verse">« {verseOf(day)} »</p>
      </header>

      {pendingOther.length > 0 && (
        <button className="verdict-banner" onClick={() => setDay(pendingOther[pendingOther.length - 1])}>
          <span className="pulse" />
          {pendingOther.length === 1 ? 'Une journée passée attend' : `${pendingOther.length} journées passées attendent`} son verdict
          <span className="arrow">→</span>
        </button>
      )}

      <DayWeave tasks={tasks} />

      <ol className="tasks">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onOpen={() => setOpen(t.id)} />
        ))}
      </ol>

      {tasks.length === 0 && (
        <p className="empty">
          Page blanche.
          <br />
          <span>Qu’as-tu à conquérir {day === today ? 'aujourd’hui' : 'ce jour-là'} ?</span>
        </p>
      )}

      {allWoven && <p className="woven">La journée est tissée. Le tigre peut dormir.</p>}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          addTask(day, draft);
          setDraft('');
          inputRef.current?.focus();
        }}
      >
        <span className="seal seal-white ghost-seal" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Inscrire une tâche…"
          enterKeyHint="done"
          aria-label="Nouvelle tâche"
        />
        <button type="submit" className="ink-btn" disabled={!draft.trim()} aria-label="Ajouter">
          ↵
        </button>
      </form>

      {open && <PigmentSheet taskId={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const [stamp, setStamp] = useState(0);
  const info = PIGMENTS[task.pigment];
  const prev = useRef(task.pigment);
  useEffect(() => {
    if (prev.current !== task.pigment) setStamp((n) => n + 1);
    prev.current = task.pigment;
  }, [task.pigment]);

  return (
    <li className={`task is-${task.pigment}`} style={{ ['--c' as string]: info.color }}>
      <button
        className="seal-btn"
        onClick={() => quickComplete(task.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpen();
        }}
        aria-label={`${info.name} — ${info.meaning}. Toucher pour marquer faite.`}
      >
        <span key={stamp} className={`seal seal-${task.pigment} ${stamp ? 'stamp' : ''}`} />
      </button>
      <button className="task-body" onClick={onOpen}>
        <span className="task-text">{task.text}</span>
        <span className="task-meta">
          {task.pigment !== 'white' && <span className="pigment-name">{info.name}</span>}
          {task.carryCount > 0 && <span className="badge">↷ {task.carryCount}</span>}
          {task.ritualId && <span className="badge">rituel</span>}
        </span>
      </button>
    </li>
  );
}

/** Le fil de la journée : une bande tissée des couleurs déjà rendues */
function DayWeave({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return null;
  return (
    <div className="weave" aria-hidden="true">
      {tasks.map((t) => (
        <span key={t.id} className={`thread thread-${t.pigment}`} />
      ))}
    </div>
  );
}

function WeekRibbon({ day, setDay }: { day: DayKey; setDay: (d: DayKey) => void }) {
  const today = todayKey();
  const start = weekStart(day);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const all = useStore((s) => s.tasks);
  const byDay = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const t of Object.values(all)) if (!t.deleted && days.includes(t.date)) (m[t.date] ??= []).push(t);
    return m;
  }, [all, days]);

  return (
    <nav className="ribbon" aria-label="Semaine">
      <button className="ribbon-arrow" onClick={() => setDay(addDays(day, -7))} aria-label="Semaine précédente">
        ‹
      </button>
      {days.map((d, i) => {
        const ts = (byDay[d] ?? []).sort((a, b) => a.sort - b.sort);
        return (
          <button
            key={d}
            className={`ribbon-day ${d === day ? 'is-current' : ''} ${d === today ? 'is-today' : ''}`}
            onClick={() => setDay(d)}
          >
            <span className="ribbon-wd">{WEEKDAY_SHORT[i]}</span>
            <span className="ribbon-num">{Number(d.slice(8))}</span>
            <span className="ribbon-threads">
              {ts.slice(0, 8).map((t) => (
                <i key={t.id} className={`thread-${t.pigment}`} />
              ))}
            </span>
          </button>
        );
      })}
      <button className="ribbon-arrow" onClick={() => setDay(addDays(day, 7))} aria-label="Semaine suivante">
        ›
      </button>
      {day !== today && (
        <button className="ribbon-today" onClick={() => setDay(today)}>
          Revenir à aujourd’hui
        </button>
      )}
    </nav>
  );
}
