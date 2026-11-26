import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null tant que Supabase n'est pas configuré : l'app reste 100 % locale. */
export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;

/** La synchronisation fait partie de Pro (VITE_SYNC_FREE=true pour l'ouvrir à tous, par exemple en test) */
export const SYNC_REQUIRES_PREMIUM = import.meta.env.VITE_SYNC_FREE !== 'true';

export interface Profile {
  id: string;
  is_premium: boolean;
  premium_plan: 'monthly' | 'yearly' | 'lifetime' | null;
  premium_until: string | null;
  referred_by: string | null;
  downsell_used: boolean;
  is_admin: boolean;
}

export interface AuthState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
}

let authState: AuthState = { ready: !supabase, session: null, profile: null };
const listeners = new Set<(s: AuthState) => void>();

function setAuth(patch: Partial<AuthState>) {
  authState = { ...authState, ...patch };
  listeners.forEach((l) => l(authState));
}

export async function refreshProfile() {
  if (!supabase || !authState.session) return setAuth({ profile: null });
  const { data } = await supabase
    .from('profiles')
    .select('id, is_premium, premium_plan, premium_until, referred_by, downsell_used, is_admin')
    .eq('id', authState.session.user.id)
    .maybeSingle();
  setAuth({ profile: (data as Profile) ?? null });
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    setAuth({ session: data.session, ready: true });
    refreshProfile();
  });
  supabase.auth.onAuthStateChange((_e, session) => {
    setAuth({ session });
    refreshProfile();
  });
}

export function useAuth(): AuthState {
  const [s, set] = useState(authState);
  useEffect(() => {
    listeners.add(set);
    set(authState);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return s;
}

export function getAuth() {
  return authState;
}

export function onAuth(l: (s: AuthState) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export async function signInWithEmail(email: string, path = '/app/') {
  if (!supabase) throw new Error('Supabase non configuré');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + path },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase non configuré');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/app/' },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/** Appelle une Pages Function en s'authentifiant avec le jeton Supabase */
export async function callApi<T>(path: string, body: unknown): Promise<T> {
  const token = authState.session?.access_token;
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Le service ne répond pas. Réessaie dans un instant.');
  }
  return res.json() as Promise<T>;
}

export async function getApi<T>(path: string): Promise<T> {
  const token = authState.session?.access_token;
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Le service ne répond pas. Réessaie dans un instant.');
  }
  return res.json() as Promise<T>;
}

export const isPro = (s: AuthState) => !!s.profile?.is_premium;
