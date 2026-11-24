import { json, updateProfile, type Env } from './_shared';

/** Vérifie la signature Stripe (HMAC-SHA256) avec Web Crypto */
async function verify(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts.t;
  const v1 = header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));
  if (!t || v1.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return v1.includes(hex);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const payload = await request.text();
  if (!(await verify(payload, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: 'Signature invalide' }, 400);
  }
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, any> } };
  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const userId = obj.client_reference_id ?? obj.metadata?.user_id;
      if (!userId) break;
      await updateProfile(env, `id=eq.${userId}`, {
        is_premium: true,
        premium_plan: obj.metadata?.plan ?? 'monthly',
        stripe_customer_id: obj.customer,
      });
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const active = ['active', 'trialing', 'past_due'].includes(obj.status);
      await updateProfile(env, `stripe_customer_id=eq.${obj.customer}`, {
        is_premium: active,
        premium_plan: obj.metadata?.plan ?? null,
        premium_until: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
      });
      break;
    }
    case 'customer.subscription.deleted': {
      await updateProfile(env, `stripe_customer_id=eq.${obj.customer}`, { is_premium: false, premium_plan: null });
      break;
    }
  }
  return json({ received: true });
};
