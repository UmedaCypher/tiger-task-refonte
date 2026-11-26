/** Configuration du Worker : variables et secrets à définir dans Cloudflare (Settings › Variables and secrets). */
export interface Env {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_MONTHLY: string;
  STRIPE_PRICE_YEARLY: string;
  STRIPE_PRICE_LIFETIME: string;
  STRIPE_PRICE_LIFETIME_FOUNDER: string;
  /** Coupon « -10 € une fois » : l'offre de rattrapage (29,90 → 19,90 la 1re année) */
  STRIPE_COUPON_DOWNSELL: string;
  /** Coupon « -10 % une fois » : offre à vie achetée via un lien d'affilié */
  STRIPE_COUPON_LIFETIME_REF: string;
  /** "on" pour laisser Stripe Tax calculer la TVA du pays de l'acheteur */
  STRIPE_TAX?: string;
  APP_URL?: string;
}

/** Règles commerciales, en un seul endroit */
export const RULES = {
  founderSeats: 500,
  referralTrialDays: 30,
  /** une commission « annuel » compte si l'abonnement payé arrive dans ce délai après le parrainage (60 j + 30 j d'essai) */
  referralWindowDays: 90,
  commissionYearlyCents: 700,
  commissionLifetimeCents: 1500,
  commissionHoldDays: 30,
  /** prix TTC affichés, en centimes, pour le calcul du MRR */
  priceCents: { monthly: 399, yearly: 2990, lifetime: 7990, founder: 5990 },
};

export type Plan = 'monthly' | 'yearly' | 'lifetime';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const bad = (message: string, status = 400) => json({ error: message }, status);

export const DAY = 86_400_000;

/** Vérifie le jeton Supabase envoyé par le navigateur et renvoie l'utilisateur */
export async function getUser(req: Request, env: Env): Promise<{ id: string; email?: string } | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: env.SUPABASE_SERVICE_ROLE_KEY },
  });
  if (!res.ok) return null;
  return res.json();
}

/** Appel REST à Supabase avec la clé service_role (côté serveur uniquement : contourne RLS) */
export async function sb<T = unknown>(
  env: Env,
  path: string,
  init: { method?: string; body?: unknown; prefer?: string; count?: boolean } = {},
): Promise<{ data: T; count: number | null }> {
  const headers: Record<string, string> = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const prefer = [init.prefer, init.count ? 'count=exact' : ''].filter(Boolean).join(',');
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} sur ${path.split('?')[0]} : ${await res.text()}`);
  const range = res.headers.get('Content-Range');
  const count = range && range.includes('/') ? Number(range.split('/')[1]) : null;
  const text = await res.text();
  return { data: (text ? JSON.parse(text) : null) as T, count };
}

export interface Profile {
  id: string;
  is_premium: boolean;
  premium_plan: Plan | null;
  is_admin: boolean;
  referred_by: string | null;
  referred_at: string | null;
  downsell_used: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export async function getProfile(env: Env, userId: string): Promise<Profile | null> {
  const { data } = await sb<Profile[]>(env, `profiles?id=eq.${userId}&select=*`);
  return data[0] ?? null;
}

export async function patchProfile(env: Env, filter: string, patch: Partial<Profile> & Record<string, unknown>) {
  await sb(env, `profiles?${filter}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
}

/** Appel REST à Stripe (pas de SDK : léger et compatible Workers) */
export async function stripe(env: Env, path: string, params: Record<string, string> = {}, method = 'POST') {
  const qs = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === 'GET' && qs.size ? `?${qs}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'GET' ? undefined : qs,
  });
  const data = (await res.json()) as Record<string, any>;
  if (!res.ok) throw new Error(data?.error?.message ?? 'Erreur Stripe');
  return data;
}

export const origin = (req: Request, env: Env) => env.APP_URL ?? new URL(req.url).origin;

/** Un code affilié : lettres minuscules, chiffres et tirets */
export const cleanCode = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
