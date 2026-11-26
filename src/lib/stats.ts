import { addDays, todayKey, type DayKey } from './date';
import { PIGMENT_ORDER, PIGMENTS, type Pigment } from './pigments';
import type { State, Task } from './store';

export type Counts = Record<Pigment, number>;

export const zeroCounts = (): Counts =>
  Object.fromEntries(PIGMENT_ORDER.map((p) => [p, 0])) as Counts;

/** Toutes les tâches vivantes, indexées par jour */
export function byDay(s: State): Map<DayKey, Task[]> {
  const m = new Map<DayKey, Task[]>();
  for (const t of Object.values(s.tasks)) {
    if (t.deleted) continue;
    const arr = m.get(t.date);
    if (arr) arr.push(t);
    else m.set(t.date, [t]);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.sort - b.sort);
  return m;
}

export interface Bilan {
  counts: Counts;
  total: number;
  judged: number;
  /** (faites + enfin faites) / tâches jugées */
  accomplishment: number;
  /** jaune / tâches jugées — l'indice de flemme (abandonner n'est pas de la flemme) */
  flemme: number;
  epicFails: number;
  /** jours consécutifs (jusqu'à hier ou aujourd'hui) avec au moins une tâche faite */
  streak: number;
  bestStreak: number;
  activeDays: number;
  /** la tâche reportée le plus de fois */
  mostCarried: Task | null;
  /** ventilation par mois (index 0-11) */
  months: Counts[];
}

export function bilan(s: State, year: number): Bilan {
  const counts = zeroCounts();
  const months = Array.from({ length: 12 }, zeroCounts);
  let mostCarried: Task | null = null;
  const days = byDay(s);
  let activeDays = 0;

  for (const [day, tasks] of days) {
    if (!day.startsWith(String(year))) continue;
    activeDays++;
    const m = Number(day.slice(5, 7)) - 1;
    for (const t of tasks) {
      counts[t.pigment]++;
      months[m][t.pigment]++;
      if (!mostCarried || t.carryCount > mostCarried.carryCount) mostCarried = t;
    }
  }
  const total = PIGMENT_ORDER.reduce((a, p) => a + counts[p], 0);
  const judged = total - counts.white;
  const done = counts.green + counts.blue;

  // séries
  const didSomething = (d: DayKey) => (days.get(d) ?? []).some((t) => PIGMENTS[t.pigment].done);
  let streak = 0;
  let cursor = todayKey();
  if (!didSomething(cursor)) cursor = addDays(cursor, -1);
  while (didSomething(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  let bestStreak = 0;
  let run = 0;
  const sortedDays = [...days.keys()].filter((d) => d.startsWith(String(year))).sort();
  let prev: DayKey | null = null;
  for (const d of sortedDays) {
    if (didSomething(d)) {
      run = prev && addDays(prev, 1) === d ? run + 1 : 1;
      prev = d;
      bestStreak = Math.max(bestStreak, run);
    }
  }

  return {
    counts,
    total,
    judged,
    accomplishment: judged ? done / judged : 0,
    flemme: judged ? counts.yellow / judged : 0,
    epicFails: counts.black,
    streak,
    bestStreak: Math.max(bestStreak, streak),
    activeDays,
    mostCarried: mostCarried && mostCarried.carryCount > 0 ? mostCarried : null,
    months,
  };
}
