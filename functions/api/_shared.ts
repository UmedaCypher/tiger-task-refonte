export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_MONTHLY: string;
  STRIPE_PRICE_YEARLY: string;
  APP_URL?: string;
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

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

/** Appel REST à Stripe (pas de SDK : léger et compatible Workers) */
export async function stripe(env: Env, path: string, params: Record<string, string>, method = 'POST') {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'GET' ? undefined : new URLSearchParams(params),
  });
  const data = (await res.json()) as Record<string, any>;
  if (!res.ok) throw new Error(data?.error?.message ?? 'Stripe error');
  return data;
}

/** Écrit dans la table profiles avec la clé service_role (contourne RLS, côté serveur uniquement) */
export async function updateProfile(env: Env, filter: string, patch: Record<string, unknown>) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Supabase: ${res.status} ${await res.text()}`);
}

export async function getProfile(env: Env, userId: string) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=stripe_customer_id`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const rows = (await res.json()) as { stripe_customer_id: string | null }[];
  return rows[0] ?? null;
}
