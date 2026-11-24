import { getProfile, getUser, json, stripe, type Env } from './_shared';

/** POST /api/checkout { plan: 'monthly' | 'yearly' } → { url } vers Stripe Checkout */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return json({ error: 'Connexion requise' }, 401);

  const { plan } = (await request.json()) as { plan?: string };
  const price = plan === 'yearly' ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY;
  const origin = env.APP_URL ?? new URL(request.url).origin;

  const profile = await getProfile(env, user.id);
  const params: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    client_reference_id: user.id,
    'metadata[user_id]': user.id,
    'metadata[plan]': plan === 'yearly' ? 'yearly' : 'monthly',
    'subscription_data[metadata][user_id]': user.id,
    'subscription_data[metadata][plan]': plan === 'yearly' ? 'yearly' : 'monthly',
    success_url: `${origin}/?pacte=scelle`,
    cancel_url: `${origin}/?pacte=annule`,
    allow_promotion_codes: 'true',
    locale: 'fr',
  };
  if (profile?.stripe_customer_id) params.customer = profile.stripe_customer_id;
  else if (user.email) params.customer_email = user.email;

  const session = await stripe(env, 'checkout/sessions', params);
  return json({ url: session.url });
};
