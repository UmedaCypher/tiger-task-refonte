import { useEffect, useState } from 'react';
import { clearExamples, exportJSON } from '../lib/store';
import { callApi, signInWithEmail, signInWithGoogle, signOut, supabase, SYNC_REQUIRES_PREMIUM, useAuth } from '../lib/supabase';
import { syncNow, useSyncStatus } from '../lib/sync';
import { TigerMark } from './TigerMark';

/** Prix affichés — à aligner avec les prix créés dans Stripe */
const PRICES = { monthly: '3 € / mois', yearly: '24 € / an' };

const SYNC_LABEL: Record<string, string> = {
  off: 'Carnet local uniquement',
  locked: 'Synchronisation réservée au Pacte',
  idle: 'Carnet synchronisé',
  syncing: 'Synchronisation…',
  error: 'Erreur de synchronisation',
  offline: 'Hors ligne — les tâches partiront au retour du réseau',
};

export function Account() {
  const { session, profile, ready } = useAuth();
  const sync = useSyncStatus();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const install = useInstallPrompt();

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const checkout = (plan: 'monthly' | 'yearly') =>
    run(async () => {
      const { url } = await callApi<{ url: string }>('/api/checkout', { plan });
      window.location.href = url;
    });

  const portal = () =>
    run(async () => {
      const { url } = await callApi<{ url: string }>('/api/portal', {});
      window.location.href = url;
    });

  const download = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tiger-task-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <section className="account">
      <header className="page-head">
        <p className="eyebrow">Le gardien du carnet</p>
        <h1 className="page-title">Compte</h1>
      </header>

      {/* ---------------- Connexion ---------------- */}
      <div className="card">
        {!supabase && (
          <p className="muted">
            Ton carnet vit sur cet appareil, et fonctionne hors ligne. La connexion apparaîtra dès que Supabase sera configuré.
          </p>
        )}
        {supabase && ready && !session && (
          <>
            <h2 className="card-title">Emporter le carnet partout</h2>
            <p className="muted">Connecte-toi pour retrouver tes journées sur tous tes appareils. Ce qui est déjà écrit ici sera conservé.</p>
            {sent ? (
              <p className="success">Un lien t’attend dans ta boîte mail. Ouvre-le sur cet appareil.</p>
            ) : (
              <form
                className="login"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await signInWithEmail(email);
                    setSent(true);
                  });
                }}
              >
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" />
                <button className="gold-btn" disabled={busy}>
                  Recevoir un lien
                </button>
              </form>
            )}
            <button className="ghost" onClick={() => run(signInWithGoogle)}>
              Continuer avec Google
            </button>
          </>
        )}
        {session && (
          <>
            <p className="who">
              <span className="muted">Connecté·e en tant que</span> {session.user.email}
            </p>
            <p className={`sync sync-${sync}`}>
              <span className="dot" /> {SYNC_LABEL[sync]}
              {(sync === 'idle' || sync === 'error') && (
                <button className="link" onClick={() => syncNow()}>
                  synchroniser
                </button>
              )}
            </p>
            <button className="ghost" onClick={() => signOut()}>
              Se déconnecter
            </button>
          </>
        )}
      </div>

      {/* ---------------- Premium ---------------- */}
      <div className={`card pact ${profile?.is_premium ? 'is-sealed' : ''}`}>
        <TigerMark size={56} />
        <h2 className="card-title">Le Pacte du Tigre</h2>
        {profile?.is_premium ? (
          <>
            <p className="pact-verse">Le pacte est scellé. Merci de faire vivre le carnet.</p>
            <button className="ghost" onClick={portal} disabled={busy}>
              Gérer mon abonnement
            </button>
          </>
        ) : (
          <>
            <p className="pact-verse">Pour celles et ceux qui tiennent leur carnet chaque jour.</p>
            <ul className="pact-list">
              {SYNC_REQUIRES_PREMIUM && <li>Synchronisation sur tous tes appareils</li>}
              <li>Les widgets d’écran d’accueil, dès leur sortie</li>
              <li>Le soutien d’une app indépendante, sans publicité</li>
            </ul>
            {session ? (
              <div className="pact-offers">
                <button className="gold-btn" onClick={() => checkout('yearly')} disabled={busy}>
                  Sceller pour un an · {PRICES.yearly}
                </button>
                <button className="ghost" onClick={() => checkout('monthly')} disabled={busy}>
                  Au mois · {PRICES.monthly}
                </button>
              </div>
            ) : (
              <p className="muted small">Connecte-toi pour sceller le pacte.</p>
            )}
          </>
        )}
      </div>

      {err && <p className="error">{err}</p>}

      {/* ---------------- Carnet ---------------- */}
      <div className="card">
        <h2 className="card-title">Le carnet</h2>
        {install && (
          <button className="ghost" onClick={install}>
            Installer Tiger Task sur cet appareil
          </button>
        )}
        <button className="ghost" onClick={download}>
          Exporter tout le carnet (JSON)
        </button>
        <button className="ghost" onClick={clearExamples}>
          Effacer les tâches d’exemple
        </button>
      </div>

      <p className="footnote">
        Tiger Task s’inspire de la méthode d’organisation que Fibre Tigre a décrite dans ses billets annuels : une liste par jour, une
        couleur par tâche, et une année entière à regarder en face.
      </p>
    </section>
  );
}

type BIPEvent = Event & { prompt: () => Promise<void> };

function useInstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return evt ? () => evt.prompt().then(() => setEvt(null)) : null;
}
