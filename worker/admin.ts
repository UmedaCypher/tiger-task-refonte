import { bad, DAY, getProfile, getUser, json, RULES, sb, type Env } from './shared';

async function requireAdmin(req: Request, env: Env) {
  const user = await getUser(req, env);
  if (!user) return null;
  const p = await getProfile(env, user.id);
  return p?.is_admin ? user : null;
}

type Row = Record<string, any>;
const dayKey = (iso: string) => iso.slice(0, 10);

/** Les métriques connues, réutilisées par les résultats clés des OKR */
export const METRICS: Record<string, string> = {
  users_total: 'Comptes créés',
  new_users_30d: 'Nouveaux comptes (30 j)',
  dau: 'Actifs aujourd’hui',
  wau: 'Actifs sur 7 jours',
  mau: 'Actifs sur 30 jours',
  activation_rate: 'Activation 1re semaine (%)',
  paying_users: 'Abonnés payants',
  mrr: 'MRR (€)',
  revenue_30d: 'Encaissé sur 30 j (€)',
  paywall_conversion: 'Conversion paywall → achat (%)',
  churn_30d: 'Résiliations sur 30 j (%)',
  affiliates_total: 'Affiliés inscrits',
  active_affiliates: 'Affiliés avec au moins une vente',
  affiliate_share: 'Part des ventes via affiliation (%)',
};

export async function overview(req: Request, env: Env) {
  if (!(await requireAdmin(req, env))) return bad('Réservé aux admins', 403);
  const now = Date.now();
  const since90 = new Date(now - 90 * DAY).toISOString();

  const [profiles, payments, events, commissions, affiliates, clicks, okrs, krs] = await Promise.all([
    sb<Row[]>(env, 'profiles?select=id,created_at,is_premium,premium_plan,referred_by&limit=100000'),
    sb<Row[]>(env, 'payments?select=user_id,plan,amount_cents,created_at&order=created_at.asc&limit=100000'),
    sb<Row[]>(env, `events?select=user_id,name,props,created_at&created_at=gte.${since90}&limit=200000`),
    sb<Row[]>(env, 'commissions?select=id,affiliate_code,kind,amount_cents,status,available_at,created_at&limit=100000'),
    sb<Row[]>(env, 'affiliates?select=user_id,code,payout_details,status,created_at&limit=10000'),
    sb(env, `referral_clicks?select=id&created_at=gte.${new Date(now - 30 * DAY).toISOString()}`, { count: true, prefer: 'return=minimal' }),
    sb<Row[]>(env, 'okrs?select=*&order=sort.asc,id.asc'),
    sb<Row[]>(env, 'key_results?select=*&order=sort.asc,id.asc'),
  ]);

  const P = profiles.data;
  const E = events.data;
  const who = (e: Row) => e.user_id ?? e.props?.anon ?? null;
  const since = (d: number) => now - d * DAY;

  // ------ utilisateurs et activité
  const opens = E.filter((e) => e.name === 'app_open');
  const activeIn = (days: number) => new Set(opens.filter((e) => Date.parse(e.created_at) >= since(days)).map(who).filter(Boolean)).size;

  const firstOpen = new Map<string, number>();
  for (const e of opens) {
    const k = who(e);
    if (!k) continue;
    const t = Date.parse(e.created_at);
    if (!firstOpen.has(k) || t < firstOpen.get(k)!) firstOpen.set(k, t);
  }
  const coloredDays = new Map<string, Set<string>>();
  for (const e of E) {
    if (e.name !== 'day_colored') continue;
    const k = who(e);
    if (!k) continue;
    if (!coloredDays.has(k)) coloredDays.set(k, new Set());
    coloredDays.get(k)!.add(dayKey(e.created_at));
  }
  // cohorte : premier lancement il y a 7 à 37 jours (semaine complète observée)
  let cohort = 0;
  let activated = 0;
  for (const [k, t] of firstOpen) {
    if (t > since(7) || t < since(37)) continue;
    cohort++;
    const days = [...(coloredDays.get(k) ?? [])].filter((d) => {
      const x = Date.parse(d);
      return x >= t - DAY && x <= t + 7 * DAY;
    });
    if (days.length >= 5) activated++;
  }

  // ------ revenus
  const paying = P.filter((p) => p.is_premium);
  const byPlan = { monthly: 0, yearly: 0, lifetime: 0 } as Record<string, number>;
  for (const p of paying) if (p.premium_plan) byPlan[p.premium_plan] = (byPlan[p.premium_plan] ?? 0) + 1;
  const mrrCents = byPlan.monthly * RULES.priceCents.monthly + (byPlan.yearly * RULES.priceCents.yearly) / 12;
  const pay = payments.data;
  const revenue30 = pay.filter((p) => Date.parse(p.created_at) >= since(30)).reduce((a, p) => a + p.amount_cents, 0);
  const lifetimeSold = pay.filter((p) => p.plan === 'lifetime').length;

  // ------ entonnoir paywall (30 j)
  const distinct = (name: string, days = 30) =>
    new Set(E.filter((e) => e.name === name && Date.parse(e.created_at) >= since(days)).map(who).filter(Boolean)).size;
  const funnel = {
    paywall_view: distinct('paywall_view'),
    downsell_view: distinct('downsell_view'),
    checkout_start: distinct('checkout_start'),
    checkout_done: distinct('checkout_done'),
  };
  const canceled30 = distinct('subscription_canceled');

  // ------ affiliation
  const C = commissions.data.filter((c) => c.status !== 'void');
  const activeAffiliates = new Set(C.map((c) => c.affiliate_code)).size;
  const sales = E.filter((e) => e.name === 'checkout_done').length;
  const byAff = new Map<string, { code: string; sales: number; pending: number; available: number; paid: number }>();
  for (const c of C) {
    const a = byAff.get(c.affiliate_code) ?? { code: c.affiliate_code, sales: 0, pending: 0, available: 0, paid: 0 };
    a.sales++;
    if (c.status === 'paid') a.paid += c.amount_cents;
    else if (Date.parse(c.available_at) <= now) a.available += c.amount_cents;
    else a.pending += c.amount_cents;
    byAff.set(c.affiliate_code, a);
  }
  const affRows = [...byAff.values()]
    .map((a) => ({ ...a, payout: affiliates.data.find((x) => x.code === a.code)?.payout_details ?? null }))
    .sort((x, y) => y.sales - x.sales);

  const metrics: Record<string, number> = {
    users_total: P.length,
    new_users_30d: P.filter((p) => Date.parse(p.created_at) >= since(30)).length,
    dau: activeIn(1),
    wau: activeIn(7),
    mau: activeIn(30),
    activation_rate: cohort ? Math.round((activated / cohort) * 100) : 0,
    paying_users: paying.length,
    mrr: Math.round(mrrCents) / 100,
    revenue_30d: revenue30 / 100,
    paywall_conversion: funnel.paywall_view ? Math.round((funnel.checkout_done / funnel.paywall_view) * 100) : 0,
    churn_30d: paying.length + canceled30 ? Math.round((canceled30 / (paying.length + canceled30)) * 100) : 0,
    affiliates_total: affiliates.data.length,
    active_affiliates: activeAffiliates,
    affiliate_share: sales ? Math.round((C.length / sales) * 100) : 0,
  };

  // ------ séries sur 30 jours
  const days30 = Array.from({ length: 30 }, (_, i) => new Date(now - (29 - i) * DAY).toISOString().slice(0, 10));
  const series = days30.map((d) => ({
    day: d,
    signups: P.filter((p) => dayKey(p.created_at) === d).length,
    active: new Set(opens.filter((e) => dayKey(e.created_at) === d).map(who).filter(Boolean)).size,
    revenue: pay.filter((p) => dayKey(p.created_at) === d).reduce((a, p) => a + p.amount_cents, 0) / 100,
  }));

  return json({
    generatedAt: new Date(now).toISOString(),
    metrics,
    metricLabels: METRICS,
    byPlan,
    founderSeatsLeft: Math.max(0, RULES.founderSeats - lifetimeSold),
    funnel,
    activation: { cohort, activated },
    clicks30: clicks.count ?? 0,
    series,
    affiliates: affRows,
    commissionsTotals: {
      pending: affRows.reduce((a, r) => a + r.pending, 0) / 100,
      available: affRows.reduce((a, r) => a + r.available, 0) / 100,
      paid: affRows.reduce((a, r) => a + r.paid, 0) / 100,
    },
    okrs: okrs.data.map((o) => ({
      ...o,
      keyResults: krs.data
        .filter((k) => k.okr_id === o.id)
        .map((k) => ({ ...k, value: k.manual_value ?? (k.metric ? metrics[k.metric] ?? null : null) })),
    })),
  });
}

/** POST /api/admin/okr { id?, period, objective, delete? } */
export async function saveOkr(req: Request, env: Env) {
  if (!(await requireAdmin(req, env))) return bad('Réservé aux admins', 403);
  const b = (await req.json()) as Row;
  if (b.delete && b.id) await sb(env, `okrs?id=eq.${Number(b.id)}`, { method: 'DELETE', prefer: 'return=minimal' });
  else if (b.id) await sb(env, `okrs?id=eq.${Number(b.id)}`, { method: 'PATCH', body: { period: b.period, objective: b.objective }, prefer: 'return=minimal' });
  else await sb(env, 'okrs', { method: 'POST', body: { period: b.period, objective: b.objective }, prefer: 'return=minimal' });
  return json({ ok: true });
}

/** POST /api/admin/kr { id?, okr_id, title, metric, target, unit, manual_value, delete? } */
export async function saveKr(req: Request, env: Env) {
  if (!(await requireAdmin(req, env))) return bad('Réservé aux admins', 403);
  const b = (await req.json()) as Row;
  if (b.delete && b.id) {
    await sb(env, `key_results?id=eq.${Number(b.id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return json({ ok: true });
  }
  const row = {
    okr_id: Number(b.okr_id),
    title: String(b.title ?? '').slice(0, 200),
    metric: b.metric && METRICS[b.metric] ? b.metric : null,
    target: Number(b.target) || 0,
    unit: b.unit ?? '',
    manual_value: b.manual_value === '' || b.manual_value == null ? null : Number(b.manual_value),
  };
  if (b.id) await sb(env, `key_results?id=eq.${Number(b.id)}`, { method: 'PATCH', body: row, prefer: 'return=minimal' });
  else await sb(env, 'key_results', { method: 'POST', body: row, prefer: 'return=minimal' });
  return json({ ok: true });
}

/** POST /api/admin/commissions/pay { code } : marque comme payées les commissions disponibles d'un affilié */
export async function markPaid(req: Request, env: Env) {
  if (!(await requireAdmin(req, env))) return bad('Réservé aux admins', 403);
  const { code } = (await req.json()) as { code?: string };
  if (!code) return bad('Code manquant');
  await sb(env, `commissions?affiliate_code=eq.${encodeURIComponent(code)}&status=eq.pending&available_at=lte.${new Date().toISOString()}`, {
    method: 'PATCH',
    body: { status: 'paid', paid_at: new Date().toISOString() },
    prefer: 'return=minimal',
  });
  return json({ ok: true });
}
