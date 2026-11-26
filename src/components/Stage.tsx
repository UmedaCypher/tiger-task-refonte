import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addDays, fromKey, todayKey, weekday, type DayKey } from '../lib/date';
import { PIGMENTS } from '../lib/pigments';
import { byDay } from '../lib/stats';
import { dayLine, freedomLine } from '../lib/roast';
import { materializeRituals, useStore, type Task } from '../lib/store';
import { reducedMotion } from '../lib/fx';
import { AddCell, Chip } from './Sheet';
import { CellMenu } from './CellMenu';

const WD = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const AROUND = 7;
const EMPTY: Task[] = [];

/**
 * Mode Aube : le jour ouvert au centre, les autres jours en lignes au-dessus et en dessous.
 * On change de jour d'un cran (molette, glissé, flèches) et les lignes glissent en place.
 */
export function Stage({
  openDay,
  setOpenDay,
  lockBefore,
  onLocked,
  children,
}: {
  children?: React.ReactNode;
  openDay: DayKey;
  setOpenDay: (d: DayKey) => void;
  lockBefore: DayKey | null;
  onLocked: () => void;
}) {
  const today = todayKey();
  const tasks = useStore((s) => s.tasks);
  const days = useMemo(() => byDay({ tasks } as never), [tasks]);
  const [menu, setMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => materializeRituals(openDay), [openDay]);

  // ---- Navigation d'un cran
  const dayRef = useRef(openDay);
  dayRef.current = openDay;
  const go = (d: DayKey) => {
    if (lockBefore && d < lockBefore) return onLocked();
    setOpenDay(d);
  };
  const step = (n: number) => go(addDays(dayRef.current, n));
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const el = stage.current!;
    let acc = 0;
    let lastEvent = 0;
    let lastStep = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // zoom
      e.preventDefault();
      const now = performance.now();
      if (now - lastEvent > 200) acc = 0;
      lastEvent = now;
      acc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      if (Math.abs(acc) >= 60 && now - lastStep > 170) {
        stepRef.current(acc > 0 ? 1 : -1);
        acc = 0;
        lastStep = now;
      }
    };
    let y0: number | null = null;
    const onStart = (e: TouchEvent) => (y0 = e.touches[0].clientY);
    const onEnd = (e: TouchEvent) => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0;
      y0 = null;
      if (Math.abs(dy) > 44) stepRef.current(dy < 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [role="dialog"], .menu') || document.querySelector('[role="dialog"]')) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') stepRef.current(1);
      else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') stepRef.current(-1);
      else return;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
      removeEventListener('keydown', onKey);
    };
  }, []);

  // ---- Animation : chaque jour glisse de là où il était (même en pleine animation) vers sa nouvelle place
  const rendered = useRef<DayKey | null>(null);
  const before = useRef<Map<string, number> | null>(null);
  if (rendered.current !== null && rendered.current !== openDay && stage.current) {
    const m = new Map<string, number>();
    stage.current.querySelectorAll<HTMLElement>('[data-day]').forEach((el) => m.set(el.dataset.day!, el.getBoundingClientRect().top));
    before.current = m;
  }
  const dir = rendered.current && openDay < rendered.current ? -1 : 1;
  rendered.current = openDay;

  useLayoutEffect(() => {
    const m = before.current;
    before.current = null;
    if (!m || !stage.current) return;
    const reduce = reducedMotion();
    stage.current.querySelectorAll<HTMLElement>('[data-day]').forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      const isLens = el.classList.contains('st-lens');
      if (reduce) {
        if (isLens) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
        return;
      }
      const was = m.get(el.dataset.day!);
      const top = el.getBoundingClientRect().top;
      const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
      if (was === undefined) {
        el.animate([{ transform: `translateY(${dir * 24}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 480, easing });
      } else if (isLens) {
        el.animate(
          [
            { transform: `translateY(${was - top}px) scale(0.96)`, opacity: 0.25 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 560, easing },
        );
      } else if (was !== top) {
        el.animate([{ transform: `translateY(${was - top}px)` }, { transform: 'none' }], { duration: 520, easing });
      }
    });
  }, [openDay, dir]);

  const above = Array.from({ length: AROUND }, (_, i) => addDays(openDay, i - AROUND));
  const below = Array.from({ length: AROUND }, (_, i) => addDays(openDay, i + 1));
  const row = (d: DayKey, i: number) => (
    <Line
      key={d}
      day={d}
      tasks={days.get(d) ?? EMPTY}
      dist={i}
      isToday={d === today}
      isPast={d < today}
      locked={!!lockBefore && d < lockBefore}
      onOpen={() => go(d)}
    />
  );

  const dayTasks = days.get(openDay) ?? EMPTY;
  return (
    <div className="stage" ref={stage}>
      <div className="st-above">{above.map((d, i) => row(d, AROUND - i))}</div>
      <Lens day={openDay} tasks={dayTasks} today={today} onStep={step} onMenu={(id, rect) => setMenu({ id, rect })} />
      <div className="st-below">{below.map((d, i) => row(d, i + 1))}</div>
      {menu && <CellMenu taskId={menu.id} anchor={menu.rect} onClose={() => setMenu(null)} />}
      {children}
    </div>
  );
}

function Line({
  day,
  tasks,
  dist,
  isToday,
  isPast,
  locked,
  onOpen,
}: {
  day: DayKey;
  tasks: Task[];
  dist: number;
  isToday: boolean;
  isPast: boolean;
  locked: boolean;
  onOpen: () => void;
}) {
  const date = fromKey(day);
  const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const judged = tasks.filter((t) => t.pigment !== 'white').length;
  const pending = isPast && judged < tasks.length;
  const cls = ['st-line', isToday && 'is-today', locked && 'is-locked', date.getDate() === 1 && 'is-first'].filter(Boolean).join(' ');
  return (
    <button
      className={cls}
      data-day={day}
      style={{ ['--d' as string]: dist }}
      onClick={onOpen}
      aria-label={locked ? `${label} : disponible avec Pro` : `Ouvrir le ${label}`}
      tabIndex={dist > 3 ? -1 : 0}
    >
      <span className="st-date">
        <span className="st-wd">{WD[weekday(day)]}</span>
        <span className="st-num">{date.getDate()}</span>
        {date.getDate() === 1 && <span className="st-month">{date.toLocaleDateString('fr-FR', { month: 'short' })}</span>}
        {pending && <span className="pending" title="Des tâches attendent leur couleur" />}
      </span>
      <span className="minis">
        {tasks.map((t) => (
          <span key={t.id} className={`mini is-${t.pigment}`} style={{ ['--dot' as string]: PIGMENTS[t.pigment].color }}>
            <i />
            <span className="mini-text">{t.text}</span>
          </span>
        ))}
      </span>
      {tasks.length > 0 && day <= todayKey() && <span className="st-score">{Math.round((judged / tasks.length) * 100)} %</span>}
    </button>
  );
}

function Lens({
  day,
  tasks,
  today,
  onStep,
  onMenu,
}: {
  day: DayKey;
  tasks: Task[];
  today: DayKey;
  onStep: (n: number) => void;
  onMenu: (id: string, rect: DOMRect) => void;
}) {
  const date = fromKey(day);
  const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const n = tasks.length;
  const judged = tasks.filter((t) => t.pigment !== 'white').length;
  const pct = n ? Math.round((judged / n) * 100) : 0;
  const left = n - judged;
  const free = day > today ? 'À venir' : !n ? '' : left === 0 ? 'Liberté débloquée' : day < today ? 'En attente de verdict' : `Liberté dans ${left} tâche${left > 1 ? 's' : ''}`;
  return (
    <section className={`st-lens lens ${day === today ? 'is-today' : ''} ${n && !left ? 'is-free' : ''}`} data-day={day} aria-label={label}>
      <div className="st-head">
        <button className="st-nav" onClick={() => onStep(-1)} aria-label="Jour précédent">
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="m5 12.5 5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className={`st-pill ${day === today ? 'is-today' : ''}`}>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
        <button className="st-nav" onClick={() => onStep(1)} aria-label="Jour suivant">
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <h1 className="st-msg">{freedomLine(tasks, day, today)}</h1>
      {n > 0 && (
        <div className="st-gauge">
          <div className="st-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Avancement de la journée">
            <div className="st-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="st-legend">
            <span>
              {judged} sur {n} · {pct} % de la journée
            </span>
            <span>{free}</span>
          </div>
        </div>
      )}
      <div className="chips st-chips">
        {tasks.map((t) => (
          <Chip key={t.id} task={t} onMenu={onMenu} />
        ))}
        <AddCell key={day} day={day} autoFocus={n === 0 && day === today} className="chip is-add" />
      </div>
      <p className="lens-line">{dayLine(tasks, day, today)}</p>
    </section>
  );
}
