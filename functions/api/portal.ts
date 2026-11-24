import { getProfile, getUser, json, stripe, type Env } from './_shared';

/** POST /api/portal → { url } vers le portail client Stripe (gérer / résilier) */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return json({ error: 'Connexion requise' }, 401);
  const profile = await getProfile(env, user.id);
  if (!profile?.stripe_customer_id) return json({ error: 'Aucun abonnement' }, 404);
  const origin = env.APP_URL ?? new URL(request.url).origin;
  const session = await stripe(env, 'billing_portal/sessions', {
    customer: profile.stripe_customer_id,
    return_url: `${origin}/`,
  });
  return json({ url: session.url });
};
