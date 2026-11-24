/** Dates au format YYYY-MM-DD, en heure locale. */
export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): DayKey {
  return toKey(new Date());
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function dayOfYear(key: DayKey): number {
  const d = fromKey(key);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.round((d.getTime() - start.getTime()) / 86400000) + 1;
}

export function daysInYear(year: number): number {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

/** Lundi = 0 … Dimanche = 6 */
export function weekday(key: DayKey): number {
  return (fromKey(key).getDay() + 6) % 7;
}

export function weekStart(key: DayKey): DayKey {
  return addDays(key, -weekday(key));
}

const longFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long' });

export function formatLong(key: DayKey): string {
  const s = longFmt.format(fromKey(key));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthName(monthIndex: number): string {
  return monthFmt.format(new Date(2000, monthIndex, 1));
}

export const WEEKDAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const WEEKDAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
