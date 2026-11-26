import { useEffect, useState } from 'react';
import { clearExamples, exportJSON } from '../lib/store';
import { callApi, signInWithEmail, signInWithGoogle, signOut, supabase, useAuth } from '../lib/supabase';
import { syncNow, useSyncStatus } from '../lib/sync';
import { Affiliate } from './Affiliate';
import { openPaywall } from './Paywall';

const SYNC_LABEL: Record<string, string> = {
  off: 'Données sur cet appareil uniquement',
  locked: 'La synchronisation fait partie de Pro',
  idle: 'Synchronisé',
  syncing: 'Synchronisation…',
  error: 'Synchronisation impossible pour l’instant',
  offline: 'Hors ligne. Tout partira au retour du réseau.',
};

const PLAN_LABEL = { monthly: 'Pro mensuel', yearly: 'Pro annuel', lifetime: 'Pro à vie' } as const;

export function Account({ onReplayOnboarding }: { onReplayOnboarding: () => void }) {
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
            <h3>Ton compte</h3>
            <p className="muted">Pour passer à Pro, devenir affilié et retrouver ta feuille sur tous tes appareils. Ce qui est déjà ici est conservé.</p>
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
            {profile?.is_admin && (
              <a className="btn" href="/admin/">
                Ouvrir le back-office
              </a>
            )}
            <button className="btn ghost" onClick={() => signOut()}>
              Se déconnecter
            </button>
          </>
        )}
      </section>

      <section className="group">
        <h3>Tiger Task Pro</h3>
        {profile?.is_premium ? (
          <>
            <p className="ok">{PLAN_LABEL[profile.premium_plan ?? 'yearly']} actif. Merci de soutenir Tiger Task.</p>
            {profile.premium_plan !== 'lifetime' && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const { url } = await callApi<{ url: string }>('/api/portal', {});
                    window.location.href = url;
                  })
                }
              >
                Gérer mon abonnement
              </button>
            )}
          </>
        ) : (
          <>
            <p className="muted">Garde toute ton année lisible, vois ton bilan, retrouve ta feuille partout.</p>
            <button className="btn primary" onClick={() => openPaywall('upgrade')}>
              Découvrir Pro
            </button>
          </>
        )}
      </section>

      {session && (
        <section className="group">
          <h3>Recommander Tiger Task</h3>
          <Affiliate />
        </section>
      )}

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
        <button className="btn ghost" onClick={onReplayOnboarding}>
          Revoir la présentation
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
