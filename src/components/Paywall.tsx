import { useEffect, useState } from 'react';
import { getReferral, setPendingPlan, startCheckout, track, useFounderSeats, type PlanChoice } from '../lib/growth';
import { signInWithEmail, supabase, useAuth } from '../lib/supabase';

export type PaywallReason = 'history' | 'bilan' | 'sync' | 'upgrade';

/* ----- ouverture depuis n'importe où ----- */
const listeners = new Set<(r: PaywallReason) => void>();
export function openPaywall(reason: PaywallReason = 'upgrade') {
  listeners.forEach((l) => l(reason));
}

const DOWNSELL_SEEN = 'tt:downsell-seen';

const COPY: Record<PaywallReason, { title: string; lead: string }> = {
  history: {
    title: 'Ton année mérite d’être gardée.',
    lead: 'Chaque jour que tu as tenu raconte quelque chose. En gratuit, seuls tes 30 derniers jours restent nets. Le reste s’efface dans le flou.',
  },
  bilan: {
    title: 'Vois enfin où passe ton temps.',
    lead: 'Ce que tu fais vraiment, ce que tu repousses, ce que tu fuis depuis des semaines. Le bilan ne ment pas, et c’est pour ça qu’il aide.',
  },
  sync: {
    title: 'Ta feuille, partout avec toi.',
    lead: 'Commence ta journée sur ton téléphone, termine-la sur ton ordinateur. La même feuille, toujours à jour.',
  },
  upgrade: {
    title: 'Deviens la personne qui tient sa journée.',
    lead: 'La méthode marche quand on la tient dans la durée. Pro te donne de quoi voir ton chemin, jour après jour, année après année.',
  },
};

export function PaywallHost() {
  const [reason, setReason] = useState<PaywallReason | null>(null);
  const [downsell, setDownsell] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    const l = (r: PaywallReason) => {
      setReason(r);
      track('paywall_view', { reason: r });
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const dismiss = () => {
    setReason(null);
    track('paywall_dismiss');
    const eligible = !profile?.downsell_used && !localStorage.getItem(DOWNSELL_SEEN) && profile?.premium_plan == null;
    if (eligible) {
      localStorage.setItem(DOWNSELL_SEEN, '1');
      setDownsell(true);
      track('downsell_view');
    }
  };

  if (downsell) return <Downsell onClose={() => (setDownsell(false), track('downsell_dismiss'))} />;
  if (!reason) return null;
  return <Paywall reason={reason} onClose={dismiss} />;
}

function Paywall({ reason, onClose }: { reason: PaywallReason; onClose: () => void }) {
  const { session } = useAuth();
  const seats = useFounderSeats();
  const referred = !!getReferral() || !!useAuth().profile?.referred_by;
  const [plan, setPlan] = useState<PlanChoice['plan']>('yearly');
  const copy = COPY[reason];
  const founder = seats === null || seats > 0;

  const options: { id: PlanChoice['plan']; name: string; price: string; note: string; badge?: string }[] = [
    { id: 'yearly', name: 'Annuel', price: '29,90 € / an', note: 'soit 2,49 € par mois', badge: 'Le plus choisi' },
    { id: 'monthly', name: 'Mensuel', price: '3,99 € / mois', note: 'sans engagement' },
    {
      id: 'lifetime',
      name: 'À vie',
      price: founder ? '59,90 € une fois' : '79,90 € une fois',
      note: founder ? (seats !== null ? `prix Fondateurs · plus que ${seats} places` : 'prix Fondateurs, places limitées') : 'payé une fois, à toi pour toujours',
    },
  ];

  const perk = referred ? (plan === 'lifetime' ? 'Recommandé par un ami : −10 % sur l’offre à vie.' : 'Recommandé par un ami : ton premier mois est offert.') : null;

  return (
    <Modal onClose={onClose} label="Passer à Pro">
      <h2 className="pw-title">{copy.title}</h2>
      <p className="pw-lead">{copy.lead}</p>
      <ul className="pw-gains">
        <li>Relis chaque jour de ton année, et de toutes les suivantes</li>
        <li>Ton bilan : ce que tu fais vraiment, ce que tu repousses</li>
        <li>Ta feuille synchronisée sur tous tes appareils</li>
      </ul>
      <div className="pw-plans" role="radiogroup" aria-label="Offre">
        {options.map((o) => (
          <button key={o.id} role="radio" aria-checked={plan === o.id} className={`pw-plan ${plan === o.id ? 'is-on' : ''}`} onClick={() => setPlan(o.id)}>
            <span className="pw-radio" aria-hidden="true" />
            <span className="pw-plan-main">
              <span className="pw-plan-name">
                {o.name}
                {o.badge && <em>{o.badge}</em>}
              </span>
              <span className="pw-plan-note">{o.note}</span>
            </span>
            <span className="pw-plan-price">{o.price}</span>
          </button>
        ))}
      </div>
      {perk && <p className="pw-perk">{perk}</p>}
      <Checkout choice={{ plan }} label={referred && plan !== 'lifetime' ? 'Commencer mon mois offert' : 'Continuer'} loggedIn={!!session} />
      <p className="pw-fine">{plan === 'lifetime' ? 'Paiement unique, sécurisé par Stripe.' : 'Résiliable à tout moment en deux clics. Paiement sécurisé par Stripe.'}</p>
      <button className="pw-later" onClick={onClose}>
        Plus tard
      </button>
    </Modal>
  );
}

function Downsell({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  return (
    <Modal onClose={onClose} label="Offre de bienvenue">
      <p className="pw-eyebrow">Une dernière chose</p>
      <h2 className="pw-title">Ta première année à 19,90 €.</h2>
      <p className="pw-lead">
        Au lieu de 29,90 €, pour que le prix ne soit pas ce qui t’empêche de tenir ta feuille. Moins de 1,70 € par mois. Cette offre n’apparaîtra
        qu’une fois.
      </p>
      <Checkout choice={{ plan: 'yearly', offer: 'downsell' }} label="Garder mon année à 19,90 €" loggedIn={!!session} />
      <p className="pw-fine">Puis 29,90 € par an, résiliable à tout moment.</p>
      <button className="pw-later" onClick={onClose}>
        Non merci
      </button>
    </Modal>
  );
}

/** Le bouton d'achat : direct si connecté, sinon on demande l'email et on reprend après la connexion */
function Checkout({ choice, label, loggedIn }: { choice: PlanChoice; label: string; loggedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (!loggedIn) {
    if (!supabase) return <p className="err">Les comptes ne sont pas encore configurés.</p>;
    if (sent) return <p className="ok pw-sent">Lien envoyé à {email}. Ouvre-le sur cet appareil : ton choix sera repris.</p>;
    return (
      <form
        className="pw-login"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            setPendingPlan(choice);
            await signInWithEmail(email);
            setSent(true);
          } catch (x) {
            setErr(x instanceof Error ? x.message : String(x));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="pw-login-label" htmlFor="pw-email">
          Ton email, pour retrouver ton accès
        </label>
        <input id="pw-email" className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@email.fr" />
        <button className="btn primary pw-cta" disabled={busy}>
          {busy ? 'Envoi…' : label}
        </button>
        {err && <p className="err">{err}</p>}
      </form>
    );
  }
  return (
    <>
      <button
        className="btn primary pw-cta"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await startCheckout(choice);
          } catch (x) {
            setErr(x instanceof Error ? x.message : String(x));
            setBusy(false);
          }
        }}
      >
        {busy ? 'Ouverture du paiement…' : label}
      </button>
      {err && <p className="err">{err}</p>}
    </>
  );
}

function Modal({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="pw-layer" onMouseDown={onClose}>
      <div className="pw glass" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => e.stopPropagation()}>
        <span className="pw-halo" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
