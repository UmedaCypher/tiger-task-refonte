import { useRef, useSyncExternalStore } from 'react';
import { addDays, fromKey, todayKey, toKey, weekday, type DayKey } from './date';
import { PIGMENTS, type Pigment } from './pigments';

export interface Task {
  id: string;
  text: string;
  date: DayKey;
  pigment: Pigment;
  /** Rituel (tâche récurrente) qui a fait naître cette tâche */
  ritualId: string | null;
  /** Tâche de la veille dont celle-ci est le report */
  carriedFrom: string | null;
  /** Nombre de fois que la tâche a déjà été reportée */
  carryCount: number;
  sort: number;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface Ritual {
  id: string;
  text: string;
  /** 0 = lundi … 6 = dimanche */
  weekdays: number[];
  startDate: DayKey;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface State {
  tasks: Record<string, Task>;
  rituals: Record<string, Ritual>;
  dirtyTasks: string[];
  dirtyRituals: string[];
  lastPulledAt: string | null;
}

const STORAGE_KEY = 'tiger-task:v1';

const empty: State = { tasks: {}, rituals: {}, dirtyTasks: [], dirtyRituals: [], lastPulledAt: null };

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    return { ...empty, ...JSON.parse(raw) };
  } catch (e) {
    console.error('[store] carnet illisible', e);
    return { ...empty };
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function emit(next: State) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* stockage plein ou indisponible : on garde l'état en mémoire */
  }
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Lit une partie de l'état. Le résultat est mis en cache tant que l'état et les
 * dépendances (`deps`) ne changent pas — indispensable quand le sélecteur crée un nouveau tableau.
 */
export function useStore<T>(selector: (s: State) => T, deps: unknown[] = []): T {
  const cache = useRef<{ s: State; deps: unknown[]; v: T } | null>(null);
  return useSyncExternalStore(subscribe, () => {
    const c = cache.current;
    if (c && c.s === state && c.deps.length === deps.length && c.deps.every((d, i) => Object.is(d, deps[i]))) return c.v;
    const v = selector(state);
    cache.current = { s: state, deps, v };
    return v;
  });
}

// déclarations de fonctions (hissées) : utilisées dès le chargement de l'état
function now() {
  return new Date().toISOString();
}
function uid() {
  return crypto.randomUUID();
}
function uniq(a: string[]) {
  return Array.from(new Set(a));
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

function putTasks(tasks: Task[], base: State = state): State {
  const next = { ...base.tasks };
  for (const t of tasks) next[t.id] = t;
  return { ...base, tasks: next, dirtyTasks: uniq([...base.dirtyTasks, ...tasks.map((t) => t.id)]) };
}

function putRitual(r: Ritual, base: State = state): State {
  return {
    ...base,
    rituals: { ...base.rituals, [r.id]: r },
    dirtyRituals: uniq([...base.dirtyRituals, r.id]),
  };
}

function nextSort(date: DayKey) {
  const ts = Object.values(state.tasks).filter((t) => t.date === date && !t.deleted);
  return ts.length ? Math.max(...ts.map((t) => t.sort)) + 1 : 0;
}

function makeTask(partial: Partial<Task> & Pick<Task, 'text' | 'date'>): Task {
  const t = now();
  return {
    id: uid(),
    pigment: 'white',
    ritualId: null,
    carriedFrom: null,
    carryCount: 0,
    sort: nextSort(partial.date),
    createdAt: t,
    updatedAt: t,
    deleted: false,
    ...partial,
  };
}

export function addTask(date: DayKey, text: string) {
  const clean = text.trim();
  if (!clean) return;
  emit(putTasks([makeTask({ text: clean, date })]));
}

export function editTask(id: string, text: string) {
  const t = state.tasks[id];
  const clean = text.trim();
  if (!t || !clean || clean === t.text) return;
  emit(putTasks([{ ...t, text: clean, updatedAt: now() }]));
}

/** Le report vivant (non encore coloré) d'une tâche, s'il existe */
function liveChild(id: string): Task | undefined {
  return Object.values(state.tasks).find((c) => c.carriedFrom === id && !c.deleted);
}

export function deleteTask(id: string) {
  const t = state.tasks[id];
  if (!t) return;
  const changes: Task[] = [{ ...t, deleted: true, updatedAt: now() }];
  const child = liveChild(id);
  if (child && child.pigment === 'white') changes.push({ ...child, deleted: true, updatedAt: now() });
  emit(putTasks(changes));
}

/**
 * Le cœur de la méthode : donner sa couleur à une tâche.
 * Safran et Améthyste font renaître la tâche le lendemain ;
 * revenir sur ce choix efface le report s'il n'a pas encore été touché.
 */
export function setPigment(id: string, pigment: Pigment) {
  const t = state.tasks[id];
  if (!t || t.pigment === pigment) return;
  const changes: Task[] = [{ ...t, pigment, updatedAt: now() }];
  const child = liveChild(id);
  const carries = PIGMENTS[pigment].carries;

  if (carries && !child) {
    const date = addDays(t.date, 1);
    changes.push(
      makeTask({
        text: t.text,
        date,
        carriedFrom: t.id,
        carryCount: t.carryCount + 1,
        sort: -1 - t.carryCount, // les reports remontent en tête de journée
      }),
    );
  } else if (!carries && child && child.pigment === 'white') {
    changes.push({ ...child, deleted: true, updatedAt: now() });
  }
  emit(putTasks(changes));
}

/** Geste rapide : toucher le sceau marque « faite » (Azur si la tâche traînait). */
export function quickComplete(id: string) {
  const t = state.tasks[id];
  if (!t) return;
  if (t.pigment === 'white') setPigment(id, t.carryCount > 0 ? 'blue' : 'green');
  else setPigment(id, 'white');
}

/* ----------------------------- Rituels ----------------------------- */

export function addRitual(text: string, weekdays: number[]) {
  const clean = text.trim();
  if (!clean || weekdays.length === 0) return;
  const t = now();
  emit(
    putRitual({
      id: uid(),
      text: clean,
      weekdays: [...weekdays].sort(),
      startDate: todayKey(),
      active: true,
      createdAt: t,
      updatedAt: t,
      deleted: false,
    }),
  );
  materializeRituals(todayKey());
}

export function updateRitual(id: string, patch: Partial<Pick<Ritual, 'text' | 'weekdays' | 'active'>>) {
  const r = state.rituals[id];
  if (!r) return;
  emit(putRitual({ ...r, ...patch, updatedAt: now() }));
  materializeRituals(todayKey());
}

export function deleteRitual(id: string) {
  const r = state.rituals[id];
  if (!r) return;
  emit(putRitual({ ...r, deleted: true, active: false, updatedAt: now() }));
}

/**
 * Fait apparaître dans la journée les tâches des rituels prévus ce jour-là.
 * Uniquement pour aujourd'hui et le futur proche : on ne réécrit pas le passé.
 */
export function materializeRituals(date: DayKey) {
  if (date < todayKey()) return;
  const wd = weekday(date);
  const existing = Object.values(state.tasks).filter((t) => t.date === date && t.ritualId);
  const toCreate: Task[] = [];
  for (const r of Object.values(state.rituals)) {
    if (!r.active || r.deleted || date < r.startDate || !r.weekdays.includes(wd)) continue;
    if (existing.some((t) => t.ritualId === r.id)) continue; // y compris supprimée : on respecte le choix
    toCreate.push(makeTask({ text: r.text, date, ritualId: r.id, sort: -100 }));
  }
  if (toCreate.length) emit(putTasks(toCreate));
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

export function tasksOf(s: State, date: DayKey): Task[] {
  return Object.values(s.tasks)
    .filter((t) => t.date === date && !t.deleted)
    .sort((a, b) => a.sort - b.sort || a.createdAt.localeCompare(b.createdAt));
}

/** Jours passés qui ont encore des tâches sans couleur — le verdict n'a pas été rendu */
export function pendingVerdicts(s: State, today: DayKey): DayKey[] {
  const days = new Set<DayKey>();
  for (const t of Object.values(s.tasks)) {
    if (!t.deleted && t.pigment === 'white' && t.date < today) days.add(t.date);
  }
  return [...days].sort();
}

/* ------------------------------------------------------------------ */
/* Synchronisation (utilisé par sync.ts)                               */
/* ------------------------------------------------------------------ */

export function markSynced(taskIds: string[], ritualIds: string[]) {
  const t = new Set(taskIds);
  const r = new Set(ritualIds);
  emit({
    ...state,
    dirtyTasks: state.dirtyTasks.filter((id) => !t.has(id)),
    dirtyRituals: state.dirtyRituals.filter((id) => !r.has(id)),
  });
}

/** Fusion « la dernière écriture gagne » */
export function mergeRemote(tasks: Task[], rituals: Ritual[], pulledAt: string) {
  const nextTasks = { ...state.tasks };
  for (const t of tasks) {
    const local = nextTasks[t.id];
    if (!local || local.updatedAt <= t.updatedAt) nextTasks[t.id] = t;
  }
  const nextRituals = { ...state.rituals };
  for (const r of rituals) {
    const local = nextRituals[r.id];
    if (!local || local.updatedAt <= r.updatedAt) nextRituals[r.id] = r;
  }
  emit({ ...state, tasks: nextTasks, rituals: nextRituals, lastPulledAt: pulledAt });
}

/** À la connexion d'un nouveau compte : tout l'historique local devient à envoyer */
export function markAllDirty() {
  emit({ ...state, dirtyTasks: Object.keys(state.tasks), dirtyRituals: Object.keys(state.rituals), lastPulledAt: null });
}

export function exportJSON(): string {
  return JSON.stringify({ tasks: Object.values(state.tasks), rituals: Object.values(state.rituals) }, null, 2);
}

/* ------------------------------------------------------------------ */
/* Premier lancement : un carnet qui n'est pas vide                    */
/* ------------------------------------------------------------------ */

function seed(): State {
  const today = todayKey();
  const t = now();
  const mk = (date: DayKey, text: string, pigment: Pigment, extra: Partial<Task> = {}, sort = 0): Task => ({
    id: uid(),
    text,
    date,
    pigment,
    ritualId: null,
    carriedFrom: null,
    carryCount: 0,
    sort,
    createdAt: t,
    updatedAt: t,
    deleted: false,
    ...extra,
  });
  const y = addDays(today, -1);
  const carried = mk(y, 'Répondre au mail qui fait peur', 'yellow', {}, 1);
  const tasks: Task[] = [
    mk(y, 'Écrire la première page du carnet', 'green', {}, 0),
    carried,
    mk(y, 'Ranger le bureau', 'red', {}, 2),
    mk(today, 'Répondre au mail qui fait peur', 'white', { carriedFrom: carried.id, carryCount: 1 }, -2),
    mk(today, 'Toucher le carré pour marquer une tâche faite', 'white', {}, 0),
    mk(today, 'Toucher l’intitulé pour choisir une autre couleur', 'white', {}, 1),
    mk(today, 'Le soir, donner une couleur à chaque tâche', 'white', {}, 2),
  ];
  // un peu de passé pour que la tapisserie respire dès le premier jour
  const palette: Pigment[] = ['green', 'green', 'green', 'blue', 'yellow', 'purple', 'red', 'green', 'black'];
  const d0 = fromKey(today);
  for (let i = 2; i < 40; i++) {
    const d = new Date(d0);
    d.setDate(d.getDate() - i);
    const n = 2 + ((i * 7) % 4);
    for (let j = 0; j < n; j++) {
      tasks.push(mk(toKey(d), 'Tâche d’exemple', palette[(i * 3 + j * 5) % palette.length], {}, j));
    }
  }
  return {
    ...empty,
    tasks: Object.fromEntries(tasks.map((x) => [x.id, x])),
    dirtyTasks: [],
  };
}

export function clearExamples() {
  const changes = Object.values(state.tasks)
    .filter((t) => t.text === 'Tâche d’exemple' && !t.deleted)
    .map((t) => ({ ...t, deleted: true, updatedAt: now() }));
  if (changes.length) emit(putTasks(changes));
}
