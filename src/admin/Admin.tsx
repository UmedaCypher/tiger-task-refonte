import { useEffect, useState } from 'react';
import { callApi, getApi, signInWithEmail, signOut, supabase, useAuth } from '../lib/supabase';

interface KR {
  id: number;
  okr_id: number;
  title: string;
  metric: string | null;
  target: number;
  unit: string | null;
  manual_value: number | null;
  value: number | null;
}
interface Overview {
  generatedAt: string;
  metrics: Record<string, number>;
  metricLabels: Record<string, string>;
  byPlan: Record<string, number>;
  founderSeatsLeft: number;
  funnel: Record<string, number>;
  activation: { cohort: number; activated: number };
  clicks30: number;
  series: { day: string; signups: number; active: number; revenue: number }[];
  affiliates: { code: string; sales: number; pending: number; available: number; paid: number; payout: string | null }[];
  commissionsTotals: { pending: number; available: number; paid: number };
  okrs: { id: number; period: string; objective: string; keyResults: KR[] }[];
}

const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const eurC = (c: number) => eur(c / 100);

export function Admin() {
  const { ready, session, profile } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    getApi<Overview>('/api/admin/overview')
      .then(setData)
      .catch((e) => setErr(e.message));

  useEffect(() => {
    if (session && profile?.is_admin) load();
  }, [session, profile?.is_admin]);

  if (!supabase) return <Center>Supabase n’est pas configuré.</Center>;
  if (!ready) return <Center>Chargement…</Center>;
  if (!session) return <Login />;
  if (!profile) return <Center>Chargement du profil…</Center>;
  if (!profile.is_admin)
    return (
      <Center>
        Ce compte n’a pas accès au back-office.
        <button className="btn" onClick={() => signOut()}>
          Changer de compte
        </button>
      </Center>
    );

  return (
    <div className="admin">
      <header className="admin-bar glass">
        <a href="/app/" className="admin-brand">
          Tiger Task <span>· back-office</span>
        </a>
        <span className="muted small">{data ? `Mis à jour ${new Date(data.generatedAt).toLocaleTimeString('fr-FR')}` : ''}</span>
        <button className="btn" onClick={load}>
          Actualiser
        </button>
      </header>
      {err && <p className="err">{err}</p>}
      {!data ? (
        <Center>Calcul des chiffres…</Center>
      ) : (
        <main className="admin-main">
          <section>
            <h2>Revenus</h2>
            <div className="kpis">
              <Kpi label="MRR" value={eur(data.metrics.mrr)} hint="mensuels + annuels ÷ 12, TTC" />
              <Kpi label="Encaissé sur 30 jours" value={eur(data.metrics.revenue_30d)} />
              <Kpi label="Abonnés payants" value={data.metrics.paying_users} hint={`${data.byPlan.monthly ?? 0} mensuels · ${data.byPlan.yearly ?? 0} annuels · ${data.byPlan.lifetime ?? 0} à vie`} />
              <Kpi label="Places Fondateurs restantes" value={data.founderSeatsLeft} hint="sur 500" />
              <Kpi label="Résiliations sur 30 jours" value={`${data.metrics.churn_30d} %`} />
            </div>
            <Bars title="Encaissé par jour (€)" values={data.series.map((s) => s.revenue)} days={data.series.map((s) => s.day)} />
          </section>

          <section>
            <h2>Utilisateurs</h2>
            <div className="kpis">
              <Kpi label="Comptes" value={data.metrics.users_total} hint={`+${data.metrics.new_users_30d} sur 30 jours`} />
              <Kpi label="Actifs aujourd’hui" value={data.metrics.dau} />
              <Kpi label="Actifs 7 jours" value={data.metrics.wau} />
              <Kpi label="Actifs 30 jours" value={data.metrics.mau} />
              <Kpi
                label="Activation 1re semaine"
                value={`${data.metrics.activation_rate} %`}
                hint={`${data.activation.activated} sur ${data.activation.cohort} ont coloré 5 jours sur 7`}
              />
            </div>
            <Bars title="Appareils actifs par jour" values={data.series.map((s) => s.active)} days={data.series.map((s) => s.day)} />
            <p className="muted small">
              « Actifs » compte les appareils qui ouvrent l’app, connectés ou non (identifiant anonyme). Les comptes ne comptent que les
              personnes connectées.
            </p>
          </section>

          <section>
            <h2>Conversion (30 jours)</h2>
            <div className="funnel">
              {[
                ['Ont vu l’offre Pro', data.funnel.paywall_view],
                ['Ont vu l’offre de rattrapage', data.funnel.downsell_view],
                ['Ont ouvert le paiement', data.funnel.checkout_start],
                ['Ont payé', data.funnel.checkout_done],
              ].map(([label, n]) => (
                <div key={label as string} className="funnel-row">
                  <span>{label}</span>
                  <span className="funnel-bar">
                    <i style={{ width: `${data.funnel.paywall_view ? ((n as number) / data.funnel.paywall_view) * 100 : 0}%` }} />
                  </span>
                  <b>{n}</b>
                </div>
              ))}
            </div>
            <p className="muted small">Conversion offre → achat : {data.metrics.paywall_conversion} %</p>
          </section>

          <section>
            <h2>Affiliation</h2>
            <div className="kpis">
              <Kpi label="Affiliés inscrits" value={data.metrics.affiliates_total} hint={`${data.metrics.active_affiliates} avec au moins une vente`} />
              <Kpi label="Clics sur 30 jours" value={data.clicks30} />
              <Kpi label="Part des ventes via affiliation" value={`${data.metrics.affiliate_share} %`} />
              <Kpi label="À verser maintenant" value={eur(data.commissionsTotals.available)} hint={`${eur(data.commissionsTotals.pending)} en attente des 30 jours`} />
            </div>
            {data.affiliates.length > 0 ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Ventes</th>
                      <th>En attente</th>
                      <th>À verser</th>
                      <th>Versé</th>
                      <th>Coordonnées</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.affiliates.map((a) => (
                      <tr key={a.code}>
                        <td>{a.code}</td>
                        <td>{a.sales}</td>
                        <td>{eurC(a.pending)}</td>
                        <td>
                          <b>{eurC(a.available)}</b>
                        </td>
                        <td>{eurC(a.paid)}</td>
                        <td className="muted">{a.payout ?? '—'}</td>
                        <td>
                          {a.available >= 2000 && (
                            <button
                              className="btn"
                              onClick={async () => {
                                if (!confirm(`Marquer ${eurC(a.available)} comme versés à ${a.code} ?`)) return;
                                await callApi('/api/admin/commissions/pay', { code: a.code });
                                load();
                              }}
                            >
                              Marquer versé
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Aucune vente via affiliation pour l’instant.</p>
            )}
            <p className="muted small">Un virement se fait dès 20 € disponibles. Fais le virement depuis ta banque, puis marque-le ici.</p>
          </section>

          <Okrs data={data} reload={load} />
        </main>
      )}
    </div>
  );
}

function Okrs({ data, reload }: { data: Overview; reload: () => void }) {
  const [editing, setEditing] = useState<Partial<KR> | null>(null);
  const [newObj, setNewObj] = useState('');
  const period = data.okrs[0]?.period ?? 'T1 2027';
  return (
    <section>
      <h2>OKR</h2>
      <div className="okrs">
        {data.okrs.map((o) => (
          <article key={o.id} className="okr">
            <header>
              <span className="muted small">{o.period}</span>
              <h3>{o.objective}</h3>
              <button
                className="btn ghost small"
                onClick={async () => {
                  if (!confirm('Supprimer cet objectif et ses résultats clés ?')) return;
                  await callApi('/api/admin/okr', { id: o.id, delete: true });
                  reload();
                }}
              >
                Supprimer
              </button>
            </header>
            {o.keyResults.map((k) => {
              const pct = k.value == null || !k.target ? 0 : Math.min(100, Math.round((k.value / k.target) * 100));
              return (
                <button key={k.id} className="kr" onClick={() => setEditing(k)}>
                  <span className="kr-title">{k.title}</span>
                  <span className="kr-bar">
                    <i style={{ width: `${pct}%` }} className={pct >= 100 ? 'is-done' : pct >= 70 ? 'is-near' : ''} />
                  </span>
                  <span className="kr-value">
                    {k.value ?? '—'}
                    {k.unit} / {k.target}
                    {k.unit}
                  </span>
                </button>
              );
            })}
            <button className="btn ghost small" onClick={() => setEditing({ okr_id: o.id, title: '', target: 0, unit: '', metric: null })}>
              Ajouter un résultat clé
            </button>
          </article>
        ))}
      </div>
      <form
        className="okr-new"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newObj.trim()) return;
          await callApi('/api/admin/okr', { period, objective: newObj });
          setNewObj('');
          reload();
        }}
      >
        <input className="field" value={newObj} onChange={(e) => setNewObj(e.target.value)} placeholder="Nouvel objectif" aria-label="Nouvel objectif" />
        <button className="btn">Ajouter</button>
      </form>

      {editing && (
        <div className="pw-layer" onMouseDown={() => setEditing(null)}>
          <form
            className="pw glass"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              await callApi('/api/admin/kr', editing);
              setEditing(null);
              reload();
            }}
          >
            <h2 className="pw-title">{editing.id ? 'Résultat clé' : 'Nouveau résultat clé'}</h2>
            <div className="stack tight">
              <label className="muted small" htmlFor="kr-title">Intitulé</label>
              <input id="kr-title" className="field" required value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <label className="muted small" htmlFor="kr-metric">Mesuré automatiquement par</label>
              <select id="kr-metric" className="field" value={editing.metric ?? ''} onChange={(e) => setEditing({ ...editing, metric: e.target.value || null })}>
                <option value="">Saisie manuelle</option>
                {Object.entries(data.metricLabels).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              {!editing.metric && (
                <>
                  <label className="muted small" htmlFor="kr-manual">Valeur actuelle</label>
                  <input id="kr-manual" className="field" type="number" step="any" value={editing.manual_value ?? ''} onChange={(e) => setEditing({ ...editing, manual_value: e.target.value === '' ? null : Number(e.target.value) })} />
                </>
              )}
              <label className="muted small" htmlFor="kr-target">Cible</label>
              <input id="kr-target" className="field" type="number" step="any" required value={editing.target ?? 0} onChange={(e) => setEditing({ ...editing, target: Number(e.target.value) })} />
              <label className="muted small" htmlFor="kr-unit">Unité (%, €…)</label>
              <input id="kr-unit" className="field" value={editing.unit ?? ''} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} />
              <button className="btn primary">Enregistrer</button>
              {editing.id && (
                <button
                  type="button"
                  className="btn ghost danger"
                  onClick={async () => {
                    await callApi('/api/admin/kr', { id: editing.id, delete: true });
                    setEditing(null);
                    reload();
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

function Bars({ title, values, days }: { title: string; values: number[]; days: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <figure className="bars">
      <figcaption>{title}</figcaption>
      <div className="bars-plot" role="img" aria-label={`${title} sur 30 jours, maximum ${max}`}>
        {values.map((v, i) => (
          <span key={days[i]} title={`${days[i]} : ${v}`} style={{ height: `${(v / max) * 100}%` }} />
        ))}
      </div>
      <div className="bars-axis">
        <span>{days[0]?.slice(5)}</span>
        <span>{days[days.length - 1]?.slice(5)}</span>
      </div>
    </figure>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Center>
      <h1 className="pw-title">Back-office</h1>
      {sent ? (
        <p className="ok">Lien envoyé. Ouvre-le sur cet appareil.</p>
      ) : (
        <form
          className="stack tight"
          style={{ width: 'min(320px, 100%)' }}
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await signInWithEmail(email, '/admin/');
              setSent(true);
            } catch (x) {
              setErr(x instanceof Error ? x.message : String(x));
            }
          }}
        >
          <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@email.fr" aria-label="Email" />
          <button className="btn primary">Recevoir un lien</button>
          {err && <p className="err">{err}</p>}
        </form>
      )}
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="admin-center">{children}</div>;
}
