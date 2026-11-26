import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dayOfYear, fromKey, monthName, todayKey, toKey, weekday, type DayKey } from '../lib/date';
import { PIGMENTS } from '../lib/pigments';
import { byDay } from '../lib/stats';
import { addTask, materializeRituals, quickComplete, useStore, type Task } from '../lib/store';
import { trackDaily } from '../lib/growth';
import { CellMenu } from './CellMenu';

const WD = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
export const COL_LETTERS = 'ABCDEFGHIJKLMNOP';

/** Nombre de colonnes de tâches selon la largeur disponible */
export function useColumns(ref: React.RefObject<HTMLElement | null>) {
  const [cols, setCols] = useState(2);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const gutter = w < 640 ? 84 : 124;
      const min = w < 640 ? 140 : 190;
      setCols(Math.max(2, Math.min(COL_LETTERS.length, Math.floor((w - gutter) / min))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return cols;
}

export function Sheet({
  year,
  cols,
  openDay,
  setOpenDay,
  scrollToToday,
  excel,
  lockBefore,
  onLocked,
}: {
  excel: boolean;
  lockBefore: DayKey | null;
  onLocked: () => void;
  year: number;
  cols: number;
  openDay: DayKey;
  setOpenDay: (d: DayKey) => void;
  scrollToToday: number;
}) {
  const today = todayKey();
  const tasks = useStore((s) => s.tasks);
  const days = useMemo(() => byDay({ tasks } as never), [tasks]);
  const [menu, setMenu] = useState<{ id: string; rect: DOMRect } | null>(null);

  // Garder la ligne cliquée sous le doigt quand une autre ligne se referme au-dessus
  const anchor = useRef<{ day: DayKey; top: number } | null>(null);
  const open = (d: DayKey) => {
    if (d === openDay) return;
    const el = document.querySelector<HTMLElement>(`[data-day="${d}"]`);
    anchor.current = el ? { day: d, top: el.getBoundingClientRect().top } : null;
    setOpenDay(d);
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const el = document.querySelector<HTMLElement>(`[data-day="${a.day}"]`);
    if (el) window.scrollBy(0, el.getBoundingClientRect().top - a.top);
  }, [openDay]);

  useEffect(() => materializeRituals(openDay), [openDay]);

  // Centrer aujourd'hui ; on recommence une fois la mise en page stabilisée (mois rendus à la demande)
  useEffect(() => {
    const go = (smooth: boolean) =>
      document.querySelector<HTMLElement>(`[data-day="${today}"]`)?.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    go(!!scrollToToday);
    const t = setTimeout(() => go(false), scrollToToday ? 600 : 250);
    return () => clearTimeout(t);
  }, [scrollToToday, year, today]);

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => ({
        m,
        days: Array.from({ length: new Date(year, m + 1, 0).getDate() }, (_, i) => toKey(new Date(year, m, i + 1))),
      })),
    [year],
  );

  return (
    <div className="sheet" style={{ ['--cols' as string]: cols }}>
      {months.map(({ m, days: ds }) => (
        <section key={m} className="month" aria-label={`${monthName(m)} ${year}`}>
          <div className="month-row">
            <span className="month-name">{monthName(m)}</span>
          </div>
          {ds.map((d) => [
            lockBefore && d === lockBefore && year === Number(lockBefore.slice(0, 4)) && (
              <button key={`lock-${d}`} className="frontier" onClick={onLocked}>
                <span className="frontier-line" aria-hidden="true" />
                <span className="frontier-text">
                  Au-dessus, tes jours s’effacent. <strong>Garde toute ton année avec Pro</strong>
                </span>
              </button>
            ),
            <Row
              key={d}
              day={d}
              tasks={days.get(d) ?? EMPTY}
              cols={cols}
              excel={excel}
              isOpen={d === openDay}
              isToday={d === today}
              isPast={d < today}
              onOpen={open}
              onMenu={(id, rect) => setMenu({ id, rect })}
              locked={!!lockBefore && d < lockBefore}
              onLocked={onLocked}
            />,
          ])}
        </section>
      ))}
      {menu && <CellMenu taskId={menu.id} anchor={menu.rect} onClose={() => setMenu(null)} />}
    </div>
  );
}

const EMPTY: Task[] = [];

const Row = memo(function Row({
  day,
  tasks,
  cols,
  excel,
  isOpen,
  isToday,
  isPast,
  onOpen,
  onMenu,
  locked,
  onLocked,
}: {
  locked: boolean;
  onLocked: () => void;
  day: DayKey;
  tasks: Task[];
  cols: number;
  excel: boolean;
  isOpen: boolean;
  isToday: boolean;
  isPast: boolean;
  onOpen: (d: DayKey) => void;
  onMenu: (id: string, rect: DOMRect) => void;
}) {
  const wd = weekday(day);
  const pending = isPast && tasks.some((t) => t.pigment === 'white');
  const cls = ['row', isOpen && 'is-open', isToday && 'is-today', wd >= 5 && 'is-weekend'].filter(Boolean).join(' ');

  const date = fromKey(day);
  const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // ---- Jour hors de la fenêtre gratuite : visible mais flouté, et il ouvre l'offre Pro
  if (locked) {
    return (
      <button className={`${cls} is-locked`} data-day={day} onClick={onLocked} aria-label={`${label} : disponible avec Pro`}>
        <span className="date">
          <span className="date-wd">{WD[wd]}</span>
          <span className="date-num">{date.getDate()}</span>
        </span>
        <span className="minis" aria-hidden="true">
          {tasks.slice(0, cols).map((t) => (
            <span key={t.id} className={`mini is-${t.pigment}`} style={{ ['--dot' as string]: PIGMENTS[t.pigment].color }}>
              <i />
              <span className="mini-text">{t.text}</span>
            </span>
          ))}
        </span>
      </button>
    );
  }

  if (!excel) {
    // ---- Focale : le jour ouvert est une lentille, les autres jours une ligne légère
    if (isOpen) {
      const done = tasks.filter((t) => PIGMENTS[t.pigment].done).length;
      return (
        <div className={cls + ' lens'} data-day={day}>
          <div className="lens-head">
            <h2>{label.charAt(0).toUpperCase() + label.slice(1)}</h2>
            {tasks.length > 0 && (
              <span className="lens-progress">
                {done}/{tasks.length}
              </span>
            )}
          </div>
          <div className="chips">
            {tasks.map((t) => (
              <Chip key={t.id} task={t} onMenu={onMenu} />
            ))}
            <AddCell day={day} autoFocus={tasks.length === 0 && !isPast} className="chip is-add" />
          </div>
        </div>
      );
    }
    const shown = tasks.slice(0, cols);
    return (
      <button className={cls} data-day={day} onClick={() => onOpen(day)} aria-label={`Ouvrir le ${label}`}>
        <span className="date">
          <span className="date-wd">{WD[wd]}</span>
          <span className="date-num">{date.getDate()}</span>
          {pending && <span className="pending" title="Des tâches attendent leur couleur" />}
        </span>
        <span className="minis">
          {shown.map((t) => (
            <span key={t.id} className={`mini is-${t.pigment}`} style={{ ['--dot' as string]: PIGMENTS[t.pigment].color }}>
              <i />
              <span className="mini-text">{t.text}</span>
            </span>
          ))}
          {tasks.length > shown.length && <span className="mini-more">+{tasks.length - shown.length}</span>}
        </span>
      </button>
    );
  }

  let cells: React.ReactNode[];
  if (isOpen) {
    cells = tasks.map((t) => <Cell key={t.id} task={t} onMenu={onMenu} />);
    cells.push(<AddCell key="add" day={day} autoFocus={tasks.length === 0 && !isPast} />);
    const rest = (cols - (cells.length % cols)) % cols;
    for (let i = 0; i < rest; i++) cells.push(<div key={`f${i}`} className="cell is-empty" />);
  } else {
    const overflow = tasks.length > cols;
    const shown = overflow ? tasks.slice(0, cols - 1) : tasks;
    cells = shown.map((t) => <Cell key={t.id} task={t} onMenu={onMenu} compact />);
    if (overflow) cells.push(<More key="more" tasks={tasks.slice(cols - 1)} />);
    for (let i = cells.length; i < cols; i++) cells.push(<div key={`f${i}`} className="cell is-empty" />);
  }

  return (
    <div
      className={cls}
      data-day={day}
      onClick={isOpen ? undefined : () => onOpen(day)}
      role={isOpen ? undefined : 'button'}
      tabIndex={isOpen ? -1 : 0}
      onKeyDown={(e) => {
        if (!isOpen && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen(day);
        }
      }}
      aria-label={isOpen ? undefined : `Ouvrir le ${label}`}
    >
      <div className="rownum">{dayOfYear(day)}</div>
      <div className="date">
        <span className="date-wd">{WD[wd]}</span>
        <span className="date-num">{date.getDate()}</span>
        {pending && <span className="pending" title="Des tâches attendent leur couleur" />}
      </div>
      <div className="cells">{cells}</div>
    </div>
  );
});

function Cell({ task, onMenu, compact }: { task: Task; onMenu: (id: string, rect: DOMRect) => void; compact?: boolean }) {
  const p = PIGMENTS[task.pigment];
  const ref = useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = useState(0);
  const prev = useRef(task.pigment);
  useEffect(() => {
    if (prev.current !== task.pigment) setPulse((n) => n + 1);
    prev.current = task.pigment;
  }, [task.pigment]);

  return (
    <div
      ref={ref}
      key={pulse}
      className={`cell is-${task.pigment} ${pulse ? 'is-changed' : ''}`}
      style={{ ['--fill' as string]: p.fill, ['--ink' as string]: p.ink, ['--dot' as string]: p.color }}
    >
      {!compact && (
        <button
          className="mark"
          aria-label={task.pigment === 'white' ? `Marquer « ${task.text} » comme faite` : `Remettre « ${task.text} » à faire`}
          onClick={(e) => {
            e.stopPropagation();
            quickComplete(task.id);
            trackDaily('day_colored');
          }}
        >
          <MarkIcon pigment={task.pigment} />
        </button>
      )}
      {compact && <span className="mark is-static" aria-hidden="true"><MarkIcon pigment={task.pigment} /></span>}
      <button
        className="cell-text"
        tabIndex={compact ? -1 : 0}
        onClick={(e) => {
          if (compact) return;
          e.stopPropagation();
          onMenu(task.id, ref.current!.getBoundingClientRect());
        }}
        title={task.text}
      >
        {task.text}
      </button>
      {task.carryCount > 0 && !compact && <span className="carry" title={`Reportée ${task.carryCount} fois`}>↻{task.carryCount}</span>}
    </div>
  );
}

function MarkIcon({ pigment }: { pigment: Task['pigment'] }) {
  if (pigment === 'white') return <svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="2" width="12" height="12" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>;
  const done = PIGMENTS[pigment].done;
  return (
    <svg viewBox="0 0 16 16" width="16" height="16">
      <rect x="2" y="2" width="12" height="12" rx="3.5" fill="var(--dot)" />
      {done && <path d="M5 8.2 7 10.2 11 6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      {pigment === 'yellow' || pigment === 'purple' ? <path d="M6 8h4M8.5 6.2 10.3 8 8.5 9.8" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {pigment === 'red' || pigment === 'black' ? <path d="M6 6l4 4M10 6l-4 4" fill="none" stroke={pigment === 'black' ? '#e5483b' : '#fff'} strokeWidth="1.5" strokeLinecap="round" /> : null}
    </svg>
  );
}

function More({ tasks }: { tasks: Task[] }) {
  return (
    <div className="cell is-more" title={`${tasks.length} autres tâches`}>
      <span className="more-count">+{tasks.length}</span>
      <span className="more-dots" aria-hidden="true">
        {tasks.slice(0, 12).map((t) => (
          <i key={t.id} style={{ background: t.pigment === 'white' ? 'transparent' : PIGMENTS[t.pigment].color }} className={t.pigment === 'white' ? 'is-white' : ''} />
        ))}
      </span>
    </div>
  );
}

function AddCell({ day, autoFocus, className = 'cell is-add' }: { day: DayKey; autoFocus: boolean; className?: string }) {
  const [v, setV] = useState('');
  return (
    <form
      className={className}
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        addTask(day, v);
        setV('');
      }}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Ajouter" aria-label="Nouvelle tâche" enterKeyHint="done" autoFocus={autoFocus && window.innerWidth > 640} />
    </form>
  );
}

function Chip({ task, onMenu }: { task: Task; onMenu: (id: string, rect: DOMRect) => void }) {
  const p = PIGMENTS[task.pigment];
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={`chip is-${task.pigment}`} style={{ ['--dot' as string]: p.color, ['--fill' as string]: p.fill, ['--ink' as string]: p.ink }}>
      <button
        className="chip-mark"
        aria-label={task.pigment === 'white' ? `Marquer « ${task.text} » comme faite` : `Remettre « ${task.text} » à faire`}
        onClick={() => {
          quickComplete(task.id);
          trackDaily('day_colored');
        }}
      >
        <MarkIcon pigment={task.pigment} />
      </button>
      <button className="chip-text" onClick={() => onMenu(task.id, ref.current!.getBoundingClientRect())}>
        {task.text}
      </button>
      {task.carryCount > 0 && <span className="carry" title={`Reportée ${task.carryCount} fois`}>↻{task.carryCount}</span>}
    </div>
  );
}
