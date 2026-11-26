import { bad, DAY, getProfile, getUser, json, origin, patchProfile, RULES, sb, stripe, type Env, type Plan, type Profile } from './shared';

/** Le parrainage donne-t-il encore droit à l'essai offert / à la réduction ? */
const hasReferral = (p: Profile | null) => !!p?.referred_by && !p.stripe_subscription_id && p.premium_plan !== 'lifetime';

async function lifetimeSold(env: Env) {
  const { count } = await sb(env, 'payments?plan=eq.lifetime&select=id', { count: true, prefer: 'return=minimal' });
  return count ?? 0;
}

/** Prix affichés par l'app (offre Fondateurs encore ouverte ?) */
export async function offers(env: Env) {
  const sold = await lifetimeSold(env).catch(() => 0);
  return json({ founderSeatsLeft: Math.max(0, RULES.founderSeats - sold) });
}

/**
 * POST /api/checkout { plan, offer? } → { url } vers Stripe Checkout.
 * - lien d'affilié : 30 jours offerts sur le mensuel et l'annuel, -10 % sur l'offre à vie
 * - offer "downsell" : l'annuel à 19,90 € la première année, une seule fois par compte
 * - offre à vie au prix Fondateurs tant que les 500 places ne sont pas parties
 */
export async function checkout(req: Request, env: Env) {
  const user = await getUser(req, env);
  if (!user) return bad('Connexion requise', 401);
  const { plan, offer } = (await req.json()) as { plan?: Plan; offer?: string };
  if (!plan || !['monthly', 'yearly', 'lifetime'].includes(plan)) return bad('Offre inconnue');

  const profile = await getProfile(env, user.id);
  if (profile?.premium_plan === 'lifetime') return bad('Tu as déjà l’offre à vie.');
  if (profile?.is_premium && plan !== 'lifetime') return bad('Tu as déjà un abonnement. Gère-le depuis ton compte.');

  const referred = hasReferral(profile);
  const downsell = offer === 'downsell' && plan === 'yearly' && !profile?.downsell_used;
  const base = origin(req, env);

  const p: Record<string, string> = {
    client_reference_id: user.id,
    'metadata[user_id]': user.id,
    'metadata[plan]': plan,
    'metadata[offer]': downsell ? 'downsell' : referred ? 'referral' : 'standard',
    success_url: `${base}/app/?pacte=scelle`,
    cancel_url: `${base}/app/?pacte=annule`,
    locale: 'fr',
    'line_items[0][quantity]': '1',
  };
  if (profile?.stripe_customer_id) p.customer = profile.stripe_customer_id;
  else if (user.email) p.customer_email = user.email;
  if (env.STRIPE_TAX === 'on') p['automatic_tax[enabled]'] = 'true';

  if (plan === 'lifetime') {
    const founder = (await lifetimeSold(env)) < RULES.founderSeats;
    p.mode = 'payment';
    p['line_items[0][price]'] = founder ? env.STRIPE_PRICE_LIFETIME_FOUNDER : env.STRIPE_PRICE_LIFETIME;
    p['metadata[founder]'] = founder ? 'yes' : 'no';
    p['payment_intent_data[metadata][user_id]'] = user.id;
    p['invoice_creation[enabled]'] = 'true';
    if (!profile?.stripe_customer_id) p.customer_creation = 'always';
    if (referred) p['discounts[0][coupon]'] = env.STRIPE_COUPON_LIFETIME_REF;
    else p.allow_promotion_codes = 'true';
  } else {
    p.mode = 'subscription';
    p['line_items[0][price]'] = plan === 'yearly' ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY;
    p['subscription_data[metadata][user_id]'] = user.id;
    p['subscription_data[metadata][plan]'] = plan;
    if (referred) p['subscription_data[trial_period_days]'] = String(RULES.referralTrialDays);
    if (downsell) p['discounts[0][coupon]'] = env.STRIPE_COUPON_DOWNSELL;
    else if (!referred) p.allow_promotion_codes = 'true';
  }

  const session = await stripe(env, 'checkout/sessions', p);
  await logEvent(env, user.id, 'checkout_start', { plan, offer: p['metadata[offer]'] });
  return json({ url: session.url });
}

/** POST /api/portal → { url } vers le portail client Stripe (gérer, changer d'offre, résilier) */
export async function portal(req: Request, env: Env) {
  const user = await getUser(req, env);
  if (!user) return bad('Connexion requise', 401);
  const profile = await getProfile(env, user.id);
  if (!profile?.stripe_customer_id) return bad('Aucun abonnement', 404);
  const session = await stripe(env, 'billing_portal/sessions', {
    customer: profile.stripe_customer_id,
    return_url: `${origin(req, env)}/app/`,
  });
  return json({ url: session.url });
}

export async function logEvent(env: Env, userId: string | null, name: string, props?: Record<string, unknown>) {
  await sb(env, 'events', { method: 'POST', body: { user_id: userId, name, props: props ?? null }, prefer: 'return=minimal' }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Webhook Stripe                                                      */
/* ------------------------------------------------------------------ */

async function verify(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(',');
  const t = parts.find((x) => x.startsWith('t='))?.slice(2);
  const v1 = parts.filter((x) => x.startsWith('v1=')).map((x) => x.slice(3));
  if (!t || v1.length === 0 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return v1.includes(hex);
}

async function addCommission(env: Env, profile: Profile, kind: 'yearly' | 'lifetime', stripeRef: string) {
  if (!profile.referred_by) return;
  const { data: aff } = await sb<{ user_id: string; status: string }[]>(env, `affiliates?code=eq.${profile.referred_by}&select=user_id,status`);
  if (!aff[0] || aff[0].status !== 'active' || aff[0].user_id === profile.id) return;
  await sb(env, 'commissions?on_conflict=referred_user,kind', {
    method: 'POST',
    prefer: 'resolution=ignore-duplicates,return=minimal',
    body: {
      affiliate_code: profile.referred_by,
      referred_user: profile.id,
      kind,
      amount_cents: kind === 'yearly' ? RULES.commissionYearlyCents : RULES.commissionLifetimeCents,
      available_at: new Date(Date.now() + RULES.commissionHoldDays * DAY).toISOString(),
      stripe_ref: stripeRef,
    },
  });
}

async function profileByCustomer(env: Env, customer: string) {
  const { data } = await sb<Profile[]>(env, `profiles?stripe_customer_id=eq.${customer}&select=*`);
  return data[0] ?? null;
}

function planOfPrice(env: Env, priceId?: string): Plan | null {
  if (priceId === env.STRIPE_PRICE_MONTHLY) return 'monthly';
  if (priceId === env.STRIPE_PRICE_YEARLY) return 'yearly';
  if (priceId === env.STRIPE_PRICE_LIFETIME || priceId === env.STRIPE_PRICE_LIFETIME_FOUNDER) return 'lifetime';
  return null;
}

export async function webhook(req: Request, env: Env) {
  const payload = await req.text();
  if (!(await verify(payload, req.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET))) return bad('Signature invalide');
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, any> } };
  const o = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const userId: string | undefined = o.client_reference_id ?? o.metadata?.user_id;
      if (!userId) break;
      const plan = o.metadata?.plan as Plan;
      const patch: Record<string, unknown> = { stripe_customer_id: o.customer, is_premium: true, premium_plan: plan };
      if (o.metadata?.offer === 'downsell') patch.downsell_used = true;
      if (o.mode === 'subscription') patch.stripe_subscription_id = o.subscription;
      if (plan === 'lifetime') patch.premium_until = null;
      await patchProfile(env, `id=eq.${userId}`, patch);

      if (o.mode === 'payment' && o.amount_total > 0) {
        const ref = o.payment_intent ?? o.id;
        await sb(env, 'payments?on_conflict=stripe_ref', {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates,return=minimal',
          body: { user_id: userId, plan: 'lifetime', amount_cents: o.amount_total, currency: o.currency, stripe_ref: ref },
        });
        const profile = await getProfile(env, userId);
        if (profile) await addCommission(env, profile, 'lifetime', ref);
      }
      await logEvent(env, userId, 'checkout_done', { plan, offer: o.metadata?.offer });
      break;
    }

    case 'invoice.paid': {
      if (!o.amount_paid || !o.customer) break;
      const profile = await profileByCustomer(env, o.customer);
      const line = o.lines?.data?.[0];
      const plan = planOfPrice(env, line?.price?.id ?? line?.pricing?.price_details?.price);
      if (!plan || plan === 'lifetime') break;
      await sb(env, 'payments?on_conflict=stripe_ref', {
        method: 'POST',
        prefer: 'resolution=ignore-duplicates,return=minimal',
        body: { user_id: profile?.id ?? null, plan, amount_cents: o.amount_paid, currency: o.currency, stripe_ref: o.id },
      });
      // 7 € une seule fois : le premier paiement annuel d'un filleul (essai inclus, ou passage du mensuel à l'annuel)
      if (plan === 'yearly' && profile?.referred_at && Date.now() - Date.parse(profile.referred_at) < RULES.referralWindowDays * DAY) {
        await addCommission(env, profile, 'yearly', o.id);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const active = event.type !== 'customer.subscription.deleted' && ['active', 'trialing', 'past_due'].includes(o.status);
      const plan = planOfPrice(env, o.items?.data?.[0]?.price?.id) ?? o.metadata?.plan ?? null;
      const end = o.items?.data?.[0]?.current_period_end ?? o.current_period_end;
      // ne jamais toucher un compte « à vie »
      await patchProfile(env, `stripe_customer_id=eq.${o.customer}&or=(premium_plan.is.null,premium_plan.neq.lifetime)`, {
        is_premium: active,
        premium_plan: active ? plan : null,
        stripe_subscription_id: active ? o.id : null,
        premium_until: end ? new Date(end * 1000).toISOString() : null,
      });
      if (event.type === 'customer.subscription.deleted') {
        const profile = await profileByCustomer(env, o.customer);
        await logEvent(env, profile?.id ?? null, 'subscription_canceled', { plan });
      }
      break;
    }

    case 'charge.refunded': {
      // remboursement : la commission correspondante n'est pas due
      const refs = [o.invoice, o.payment_intent].filter(Boolean).map((r: string) => `"${r}"`).join(',');
      if (refs) await sb(env, `commissions?stripe_ref=in.(${refs})&status=eq.pending`, { method: 'PATCH', body: { status: 'void' }, prefer: 'return=minimal' });
      if (o.payment_intent && o.amount_refunded === o.amount) {
        await patchProfile(env, `stripe_customer_id=eq.${o.customer}&premium_plan=eq.lifetime`, { is_premium: false, premium_plan: null });
      }
      break;
    }
  }
  return json({ received: true });
}
