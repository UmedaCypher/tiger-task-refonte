import { useEffect, useState } from 'react';
import { callApi, getApi } from '../lib/supabase';

interface Me {
  affiliate: { code: string; payout_details: string | null; status: string } | null;
  stats?: { clicks: number; signups: number; sales: number; pendingCents: number; availableCents: number; paidCents: number };
}

const eur = (c: number) => (c / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

/** Espace affilié : son lien, ses chiffres, ses coordonnées de paiement */
export function Affiliate() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [payout, setPayout] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () =>
    getApi<Me>('/api/affiliate/me')
      .then((m) => {
        setMe(m);
        setPayout(m.affiliate?.payout_details ?? '');
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  if (err) return <p className="err">{err}</p>;
  if (!me) return <p className="muted">Chargement…</p>;

  if (!me.affiliate) {
    return (
      <>
        <p className="muted">
          Partage Tiger Task autour de toi. Tes amis ont <strong>leur premier mois offert</strong>, et tu gagnes <strong>7 €</strong> par abonnement
          annuel et <strong>15 €</strong> par offre à vie.
        </p>
        <form
          className="stack tight"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await callApi('/api/affiliate/join', { code });
              await load();
            } catch (x) {
              setErr(x instanceof Error ? x.message : String(x));
            }
          }}
        >
          <label className="muted" htmlFor="aff-code">
            Ton code (facultatif)
          </label>
          <input id="aff-code" className="field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="camille" />
          <button className="btn primary">Devenir affilié</button>
        </form>
      </>
    );
  }

  const link = `${location.origin}/r/${me.affiliate.code}`;
  const s = me.stats!;
  return (
    <>
      <div className="aff-link">
        <code>{link}</code>
        <button
          className="btn"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
      <table className="kv">
        <tbody>
          <tr><th>Clics</th><td>{s.clicks}</td></tr>
          <tr><th>Inscrits</th><td>{s.signups}</td></tr>
          <tr><th>Ventes</th><td>{s.sales}</td></tr>
          <tr><th>En attente (30 jours)</th><td>{eur(s.pendingCents)}</td></tr>
          <tr><th>Disponible</th><td>{eur(s.availableCents)}</td></tr>
          <tr><th>Déjà versé</th><td>{eur(s.paidCents)}</td></tr>
        </tbody>
      </table>
      <form
        className="stack tight"
        onSubmit={async (e) => {
          e.preventDefault();
          await callApi('/api/affiliate/payout', { details: payout });
          setSaved(true);
          setTimeout(() => setSaved(false), 1800);
        }}
      >
        <label className="muted" htmlFor="aff-payout">
          IBAN ou email PayPal pour les virements (dès 20 € disponibles)
        </label>
        <input id="aff-payout" className="field" value={payout} onChange={(e) => setPayout(e.target.value)} placeholder="FR76 …" />
        <button className="btn">{saved ? 'Enregistré' : 'Enregistrer'}</button>
      </form>
    </>
  );
}
