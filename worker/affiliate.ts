import { logEvent } from './billing';
import { bad, cleanCode, DAY, getProfile, getUser, json, patchProfile, RULES, sb, type Env } from './shared';

const REF_COOKIE = 'tt_ref';

/** GET /r/<code> : compte le clic, retient le code 60 jours, renvoie vers l'accueil */
export async function referralLink(req: Request, env: Env, code: string) {
  const c = cleanCode(code);
  const url = new URL(req.url);
  const dest = new URL('/', url.origin);
  if (c) {
    const { data } = await sb<{ code: string }[]>(env, `affiliates?code=eq.${c}&status=eq.active&select=code`).catch(() => ({ data: [] }));
    if (data[0]) {
      const country = (req as Request & { cf?: { country?: string } }).cf?.country ?? null;
      await sb(env, 'referral_clicks', { method: 'POST', body: { code: c, landing: url.searchParams.get('to') ?? '/', country }, prefer: 'return=minimal' }).catch(() => {});
      dest.searchParams.set('ref', c);
      const to = url.searchParams.get('to');
      if (to && to.startsWith('/') && !to.startsWith('//')) dest.pathname = to;
      return new Response(null, {
        status: 302,
        headers: {
          Location: dest.toString(),
          'Set-Cookie': `${REF_COOKIE}=${c}; Max-Age=${60 * 86400}; Path=/; SameSite=Lax; Secure`,
        },
      });
    }
  }
  return Response.redirect(dest.toString(), 302);
}

/** POST /api/referral/claim { code } : rattache le compte connecté à l'affilié (une seule fois, jamais soi-même) */
export async function claim(req: Request, env: Env) {
  const user = await getUser(req, env);
  if (!user) return bad('Connexion requise', 401);
  const { code } = (await req.json()) as { code?: string };
  const c = cleanCode(code ?? '');
  if (!c) return bad('Code manquant');
  const profile = await getProfile(env, user.id);
  if (!profile) return bad('Profil introuvable', 404);
  if (profile.referred_by) return json({ ok: true, code: profile.referred_by, already: true });
  if (profile.stripe_customer_id) return json({ ok: false, reason: 'already_customer' });
  const { data } = await sb<{ user_id: string }[]>(env, `affiliates?code=eq.${c}&status=eq.active&select=user_id`);
  if (!data[0] || data[0].user_id === user.id) return json({ ok: false, reason: 'invalid' });
  await patchProfile(env, `id=eq.${user.id}&referred_by=is.null`, { referred_by: c, referred_at: new Date().toISOString() });
  await logEvent(env, user.id, 'referral_claimed', { code: c });
  return json({ ok: true, code: c, trialDays: RULES.referralTrialDays });
}

/** GET /api/affiliate/me : sa fiche d'affilié et ses chiffres */
export async function me(req: Request, env: Env) {
  const user = await getUser(req, env);
  if (!user) return bad('Connexion requise', 401);
  const { data } = await sb<{ code: string; payout_details: string | null; status: string }[]>(env, `affiliates?user_id=eq.${user.id}&select=code,payout_details,status`);
  const aff = data[0];
  if (!aff) return json({ affiliate: null });
  const [clicks, signups, comms] = await Promise.all([
    sb(env, `referral_clicks?code=eq.${aff.code}&select=id`, { count: true, prefer: 'return=minimal' }),
    sb(env, `profiles?referred_by=eq.${aff.code}&select=id`, { count: true, prefer: 'return=minimal' }),
    sb<{ kind: string; amount_cents: number; status: string; available_at: string; created_at: string }[]>(
      env,
      `commissions?affiliate_code=eq.${aff.code}&select=kind,amount_cents,status,available_at,created_at&order=created_at.desc&limit=200`,
    ),
  ]);
  const now = Date.now();
  const sum = (f: (c: (typeof comms.data)[number]) => boolean) => comms.data.filter(f).reduce((a, c) => a + c.amount_cents, 0);
  return json({
    affiliate: aff,
    stats: {
      clicks: clicks.count ?? 0,
      signups: signups.count ?? 0,
      sales: comms.data.filter((c) => c.status !== 'void').length,
      pendingCents: sum((c) => c.status === 'pending' && Date.parse(c.available_at) > now),
      availableCents: sum((c) => c.status === 'pending' && Date.parse(c.available_at) <= now),
      paidCents: sum((c) => c.status === 'paid'),
    },
    recent: comms.data.slice(0, 20),
  });
}

/** POST /api/affiliate/join { code? } : devenir affilié (tout compte connecté) */
export async function join(req: Request, env: Env) {
  const user = await getUser(req, env);
  if (!user) return bad('Connexion requise', 401);
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  let code = cleanCode(body.code ?? '') || cleanCode((user.email ?? 'tigre').split('@')[0]);
  if (code.length < 3) code = `tigre-${code}`;
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? code : `${code.slice(0, 19)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      await sb(env, 'affiliates', { method: 'POST', body: { user_id: user.id, code: candidate }, prefer: 'return=minimal' });
      await logEvent(env, user.id, 'affiliate_joined', { code: candidate });
      return json({ code: candidate });
    } catch (e) {
      if (String(e).includes('affiliates_pkey')) return bad('Tu es déjà affilié.');
      if (body.code && i === 0) return bad('Ce code est déjà pris.');
    }
  }
  return bad('Impossible de créer le code, réessaie.');
}

/** POST /api/affiliate/payout { details } : IBAN ou PayPal pour les virements */
export async function payoutDetails(req: Request, env: Env) {
  const user = await getUser(req, env);
  if (!user) return bad('Connexion requise', 401);
  const { details } = (await req.json()) as { details?: string };
  await sb(env, `affiliates?user_id=eq.${user.id}`, { method: 'PATCH', body: { payout_details: (details ?? '').slice(0, 300) }, prefer: 'return=minimal' });
  return json({ ok: true });
}

/** POST /api/event { name, anon, props } : événements produit, connectés ou anonymes */
const ALLOWED_EVENTS = new Set([
  'app_open',
  'day_colored',
  'onboarding_step',
  'onboarding_done',
  'paywall_view',
  'paywall_dismiss',
  'downsell_view',
  'downsell_dismiss',
  'signup',
]);
export async function event(req: Request, env: Env) {
  const body = (await req.json().catch(() => null)) as { name?: string; anon?: string; props?: Record<string, unknown> } | null;
  if (!body?.name || !ALLOWED_EVENTS.has(body.name)) return bad('Événement inconnu');
  const user = await getUser(req, env).catch(() => null);
  const anon = typeof body.anon === 'string' ? body.anon.slice(0, 40) : null;
  await logEvent(env, user?.id ?? null, body.name, { ...(body.props ?? {}), anon });
  return json({ ok: true });
}

export { DAY };
