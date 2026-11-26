/**
 * Croissance : mesure d'usage anonyme, parrainage, choix d'offre en attente.
 * Aucune donnée personnelle : un identifiant aléatoire par appareil, jamais le contenu des tâches.
 */
import { useEffect, useState } from 'react';
import { callApi, getAuth, refreshProfile } from './supabase';

const ANON_KEY = 'tt:anon';
const REF_KEY = 'tt:ref';
const ONCE_KEY = 'tt:once';
const PENDING_KEY = 'tt:pending-plan';

export function anonId() {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export function track(name: string, props?: Record<string, unknown>) {
  const token = getAuth().session?.access_token;
  fetch('/api/event', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ name, anon: anonId(), props }),
  }).catch(() => {});
}

/** Un événement au plus une fois par jour et par appareil (ouverture, journée colorée) */
export function trackDaily(name: string) {
  const today = new Date().toISOString().slice(0, 10);
  let once: Record<string, string> = {};
  try {
    once = JSON.parse(localStorage.getItem(ONCE_KEY) ?? '{}');
  } catch {
    /* rien */
  }
  if (once[name] === today) return;
  once[name] = today;
  localStorage.setItem(ONCE_KEY, JSON.stringify(once));
  track(name);
}

/* ------------------------------ parrainage ------------------------------ */

interface StoredRef {
  code: string;
  at: number;
}

/** Récupère le code d'affilié arrivé par ?ref= ou par le cookie posé par /r/<code> (valable 60 jours) */
export function captureReferral() {
  const fromUrl = new URLSearchParams(location.search).get('ref');
  const fromCookie = document.cookie.match(/(?:^|; )tt_ref=([a-z0-9-]+)/)?.[1];
  const code = fromUrl ?? fromCookie;
  if (code && /^[a-z0-9-]{3,24}$/.test(code)) {
    const prev = getReferral();
    if (!prev || prev.code !== code) localStorage.setItem(REF_KEY, JSON.stringify({ code, at: Date.now() }));
  }
}

export function getReferral(): StoredRef | null {
  try {
    const r = JSON.parse(localStorage.getItem(REF_KEY) ?? 'null') as StoredRef | null;
    if (r && Date.now() - r.at < 60 * 86_400_000) return r;
  } catch {
    /* rien */
  }
  return null;
}

/** Une fois connecté : rattache le compte à l'affilié (le serveur refuse l'auto-parrainage et les doublons) */
export async function claimReferral() {
  const ref = getReferral();
  const { session, profile } = getAuth();
  if (!ref || !session || !profile || profile.referred_by) return;
  try {
    const res = await callApi<{ ok: boolean }>('/api/referral/claim', { code: ref.code });
    if (res.ok) await refreshProfile();
  } catch {
    /* réessayé au prochain lancement */
  }
}

/** Le visiteur bénéficie-t-il d'un parrainage (pour afficher « 1 mois offert ») ? */
export function useReferralPerk() {
  const [ref] = useState(getReferral);
  const { profile } = getAuth();
  return !!(profile?.referred_by || ref) && profile?.premium_plan !== 'lifetime';
}

/* --------------------------- offre en attente --------------------------- */

export type PlanChoice = { plan: 'monthly' | 'yearly' | 'lifetime'; offer?: 'downsell' };

export function setPendingPlan(c: PlanChoice | null) {
  if (c) localStorage.setItem(PENDING_KEY, JSON.stringify(c));
  else localStorage.removeItem(PENDING_KEY);
}

export function takePendingPlan(): PlanChoice | null {
  try {
    const c = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null');
    localStorage.removeItem(PENDING_KEY);
    return c;
  } catch {
    return null;
  }
}

export async function startCheckout(c: PlanChoice) {
  const { url } = await callApi<{ url: string }>('/api/checkout', c);
  window.location.href = url;
}

/* ------------------------------ offres ---------------------------------- */

export function useFounderSeats() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/offers')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLeft(d.founderSeatsLeft))
      .catch(() => {});
  }, []);
  return left;
}
