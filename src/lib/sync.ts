import { useEffect, useState } from 'react';
import { getState, markAllDirty, markSynced, mergeRemote, subscribe, type Ritual, type Task } from './store';
import { getAuth, onAuth, supabase, SYNC_REQUIRES_PREMIUM } from './supabase';

/**
 * Synchronisation local-first :
 *  - l'app écrit toujours d'abord en local (marche hors ligne) ;
 *  - on pousse les éléments modifiés, puis on tire ce qui a changé ailleurs ;
 *  - en cas de conflit, la modification la plus récente gagne.
 */

export type SyncStatus = 'off' | 'locked' | 'idle' | 'syncing' | 'error' | 'offline';

let status: SyncStatus = 'off';
const listeners = new Set<(s: SyncStatus) => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  listeners.forEach((l) => l(s));
};

export function useSyncStatus() {
  const [s, set] = useState(status);
  useEffect(() => {
    listeners.add(set);
    set(status);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return s;
}

const taskToRow = (t: Task, user_id: string) => ({
  id: t.id,
  user_id,
  text: t.text,
  date: t.date,
  pigment: t.pigment,
  ritual_id: t.ritualId,
  carried_from: t.carriedFrom,
  carry_count: t.carryCount,
  sort: t.sort,
  created_at: t.createdAt,
  updated_at: t.updatedAt,
  deleted: t.deleted,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToTask = (r: any): Task => ({
  id: r.id,
  text: r.text,
  date: r.date,
  pigment: r.pigment,
  ritualId: r.ritual_id,
  carriedFrom: r.carried_from,
  carryCount: r.carry_count,
  sort: r.sort,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deleted: r.deleted,
});

const ritualToRow = (r: Ritual, user_id: string) => ({
  id: r.id,
  user_id,
  text: r.text,
  weekdays: r.weekdays,
  start_date: r.startDate,
  active: r.active,
  created_at: r.createdAt,
  updated_at: r.updatedAt,
  deleted: r.deleted,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToRitual = (r: any): Ritual => ({
  id: r.id,
  text: r.text,
  weekdays: r.weekdays,
  startDate: r.start_date,
  active: r.active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deleted: r.deleted,
});

function canSync() {
  const { session, profile } = getAuth();
  if (!supabase || !session) return false;
  if (SYNC_REQUIRES_PREMIUM && !profile?.is_premium) return false;
  return true;
}

let running = false;
let again = false;

export async function syncNow() {
  const { session } = getAuth();
  if (!supabase || !session) return setStatus('off');
  if (!canSync()) return setStatus('locked');
  if (!navigator.onLine) return setStatus('offline');
  if (running) {
    again = true;
    return;
  }
  running = true;
  setStatus('syncing');
  try {
    const uid = session.user.id;

    // première connexion de ce compte sur cet appareil : on envoie tout le carnet local
    const LAST = 'tiger-task:last-user';
    if (localStorage.getItem(LAST) !== uid) {
      markAllDirty();
      localStorage.setItem(LAST, uid);
    }

    const s = getState();
    const tasks = s.dirtyTasks.map((id) => s.tasks[id]).filter(Boolean);
    const rituals = s.dirtyRituals.map((id) => s.rituals[id]).filter(Boolean);

    for (let i = 0; i < rituals.length; i += 500) {
      const { error } = await supabase.from('rituals').upsert(rituals.slice(i, i + 500).map((r) => ritualToRow(r, uid)));
      if (error) throw error;
    }
    for (let i = 0; i < tasks.length; i += 500) {
      const { error } = await supabase.from('tasks').upsert(tasks.slice(i, i + 500).map((t) => taskToRow(t, uid)));
      if (error) throw error;
    }
    markSynced(
      tasks.map((t) => t.id),
      rituals.map((r) => r.id),
    );

    const pulledAt = new Date().toISOString();
    const since = getState().lastPulledAt ?? '1970-01-01T00:00:00Z';
    // on recule de 5 s pour couvrir les petits décalages d'horloge
    const sinceSafe = new Date(new Date(since).getTime() - 5000).toISOString();

    const [rt, rr] = await Promise.all([
      supabase.from('tasks').select('*').gt('synced_at', sinceSafe).limit(10000),
      supabase.from('rituals').select('*').gt('synced_at', sinceSafe).limit(1000),
    ]);
    if (rt.error) throw rt.error;
    if (rr.error) throw rr.error;
    mergeRemote((rt.data ?? []).map(rowToTask), (rr.data ?? []).map(rowToRitual), pulledAt);
    setStatus('idle');
  } catch (e) {
    console.error('[sync]', e);
    setStatus('error');
  } finally {
    running = false;
    if (again) {
      again = false;
      syncNow();
    }
  }
}

let timer: number | undefined;
export function startSync() {
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(syncNow, 1500);
  };
  let lastDirty = 0;
  subscribe(() => {
    const s = getState();
    const n = s.dirtyTasks.length + s.dirtyRituals.length;
    if (n > 0 && n !== lastDirty) schedule();
    lastDirty = n;
  });
  onAuth(() => syncNow());
  window.addEventListener('online', syncNow);
  window.addEventListener('focus', syncNow);
  window.setInterval(syncNow, 60_000);
  syncNow();
}
