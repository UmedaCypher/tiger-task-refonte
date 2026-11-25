import { useEffect, useState } from 'react';
import { clearExamples, exportJSON } from '../lib/store';
import { callApi, signInWithEmail, signInWithGoogle, signOut, supabase, SYNC_REQUIRES_PREMIUM, useAuth } from '../lib/supabase';
import { syncNow, useSyncStatus } from '../lib/sync';

/** Prix affichés — à aligner avec les prix créés dans Stripe */
const PRICES = { monthly: '3 € / mois', yearly: '24 € / an' };

const SYNC_LABEL: Record<string, string> = {
  off: 'Données sur cet appareil uniquement',
  locked: 'Synchronisation réservée aux abonnés',
  idle: 'Synchronisé',
  syncing: 'Synchronisation…',
  error: 'Synchronisation impossible pour l’instant',
  offline: 'Hors ligne. Tout partira au retour du réseau.',
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
  const go = (path: string, body: unknown) =>
    run(async () => {
      const { url } = await callApi<{ url: string }>(path, body);
      window.location.href = url;
    });

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
    a.download = `tiger-task-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="stack">
      <section className="group">
        {!supabase && <p className="muted">Tes tâches sont enregistrées sur cet appareil et fonctionnent hors ligne.</p>}
        {supabase && ready && !session && (
          <>
            <h3>Retrouver tes tâches partout</h3>
            <p className="muted">Connecte-toi pour synchroniser tes appareils. Ce qui est déjà ici est conservé.</p>
            {sent ? (
              <p className="ok">Lien envoyé. Ouvre-le sur cet appareil.</p>
            ) : (
              <form
                className="stack tight"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await signInWithEmail(email);
                    setSent(true);
                  });
                }}
              >
                <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@email.fr" aria-label="Email" />
                <button className="btn primary" disabled={busy}>
                  Recevoir un lien de connexion
                </button>
              </form>
            )}
            <button className="btn" onClick={() => run(signInWithGoogle)}>
              Continuer avec Google
            </button>
          </>
        )}
        {session && (
          <>
            <p>{session.user.email}</p>
            <p className={`sync is-${sync}`}>
              <i /> {SYNC_LABEL[sync]}
              {(sync === 'idle' || sync === 'error') && (
                <button className="link" onClick={() => syncNow()}>
                  Synchroniser
                </button>
              )}
            </p>
            <button className="btn ghost" onClick={() => signOut()}>
              Se déconnecter
            </button>
          </>
        )}
      </section>

      <section className="group">
        <h3>Abonnement</h3>
        {profile?.is_premium ? (
          <>
            <p className="ok">Abonnement actif. Merci de soutenir Tiger Task.</p>
            <button className="btn" onClick={() => go('/api/portal', {})} disabled={busy}>
              Gérer l’abonnement
            </button>
          </>
        ) : (
          <>
            <ul className="bullets">
              {SYNC_REQUIRES_PREMIUM && <li>Synchronisation sur tous tes appareils</li>}
              <li>Widgets d’écran d’accueil, dès leur sortie</li>
              <li>Une app indépendante, sans publicité</li>
            </ul>
            {session ? (
              <div className="stack tight">
                <button className="btn primary" onClick={() => go('/api/checkout', { plan: 'yearly' })} disabled={busy}>
                  S’abonner · {PRICES.yearly}
                </button>
                <button className="btn" onClick={() => go('/api/checkout', { plan: 'monthly' })} disabled={busy}>
                  Au mois · {PRICES.monthly}
                </button>
              </div>
            ) : (
              <p className="muted">Connecte-toi pour t’abonner.</p>
            )}
          </>
        )}
      </section>

      {err && <p className="err">{err}</p>}

      <section className="group">
        <h3>Données</h3>
        {install && (
          <button className="btn" onClick={install}>
            Installer l’app
          </button>
        )}
        <button className="btn" onClick={download}>
          Exporter en JSON
        </button>
        <button className="btn ghost" onClick={clearExamples}>
          Effacer les tâches d’exemple
        </button>
      </section>
    </div>
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
