import { useEffect, useState } from 'react';
import { clearExamples, exportJSON } from '../lib/store';
import { callApi, signInWithEmail, signInWithGoogle, signOut, supabase, useAuth } from '../lib/supabase';
import { syncNow, useSyncStatus } from '../lib/sync';
import { Affiliate } from './Affiliate';
import { openPaywall } from './Paywall';

const SYNC_LABEL: Record<string, string> = {
  off: 'Sur cet appareil uniquement',
  locked: 'Synchronisation en pause',
  idle: 'Synchronisée sur tous tes appareils',
  syncing: 'Synchronisation…',
  error: 'Synchronisation impossible pour l’instant',
  offline: 'Hors ligne. Tout partira au retour du réseau.',
};

const PLAN_LABEL = { monthly: 'Pro mensuel', yearly: 'Pro annuel', lifetime: 'Pro à vie' } as const;

export function Account({ onReplayOnboarding, roast, onRoast }: { onReplayOnboarding: () => void; roast: boolean; onRoast: (v: boolean) => void }) {
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
      {/* 1. Où sont mes tâches ? */}
      <section className={`status-card ${session ? 'is-safe' : 'is-local'}`}>
        {!session ? (
          <>
            <h3>Ta feuille n’est que sur cet appareil</h3>
            <p className="muted">
              Crée ton compte gratuit pour la sauvegarder et la retrouver sur ton téléphone comme sur ton ordinateur. Ce qui est déjà ici est
              conservé.
            </p>
            {!supabase ? (
              <p className="muted">Les comptes arrivent bientôt.</p>
            ) : sent ? (
              <p className="ok">Lien envoyé à {email}. Ouvre-le sur cet appareil pour te connecter.</p>
            ) : (
              <>
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
                  <button className="btn primary" disabled={busy || !ready}>
                    Créer mon compte ou me connecter
                  </button>
                </form>
                <button className="btn" onClick={() => run(signInWithGoogle)}>
                  Continuer avec Google
                </button>
                <p className="fine-print">Pas de mot de passe : tu reçois un lien de connexion par email.</p>
              </>
            )}
          </>
        ) : (
          <>
            <h3>{sync === 'error' || sync === 'offline' ? 'Ta feuille attend le réseau' : 'Ta feuille est sauvegardée'}</h3>
            <p className={`sync is-${sync}`}>
              <i /> {SYNC_LABEL[sync]}
              {(sync === 'idle' || sync === 'error') && (
                <button className="link" onClick={() => syncNow()}>
                  Synchroniser
                </button>
              )}
            </p>
            <p className="muted">Connecté avec {session.user.email}. Connecte-toi avec le même email sur tes autres appareils.</p>
          </>
        )}
      </section>

      {/* 2. Mon offre */}
      <section className="group">
        <h3>Ton offre</h3>
        {profile?.is_premium ? (
          <>
            <p className="ok">{PLAN_LABEL[profile.premium_plan ?? 'yearly']} : toute ton année et ton bilan. Merci de soutenir Tiger Task.</p>
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
            <p className="muted">
              <strong>Gratuit</strong> : toute la méthode, sur tous tes appareils. Tes 30 derniers jours restent nets, les plus anciens sont
              sauvegardés mais floutés.
            </p>
            <button className="btn primary" onClick={() => openPaywall('upgrade')}>
              Débloquer toute mon année
            </button>
          </>
        )}
      </section>

      {/* 3. Recommander */}
      {session && (
        <section className="group">
          <h3>Recommander Tiger Task</h3>
          <Affiliate />
        </section>
      )}

      {err && <p className="err">{err}</p>}

      {/* 4. Le reste */}
      <section className="group">
        <h3>Plus</h3>
        <label className="switch-row">
          <span>
            <strong>Mode roast</strong>
            <span className="muted">L’app te chambre, gentiment, quand tu colores tes tâches.</span>
          </span>
          <input type="checkbox" role="switch" checked={roast} onChange={(e) => onRoast(e.target.checked)} />
        </label>
        {install && (
          <button className="btn" onClick={install}>
            Installer l’app sur cet appareil
          </button>
        )}
        {profile?.is_admin && (
          <a className="btn" href="/admin/">
            Ouvrir le back-office
          </a>
        )}
        <button className="btn" onClick={download}>
          Exporter mes tâches (JSON)
        </button>
        <button className="btn ghost" onClick={onReplayOnboarding}>
          Revoir la présentation
        </button>
        <button className="btn ghost" onClick={clearExamples}>
          Effacer les tâches d’exemple
        </button>
        {session && (
          <button className="btn ghost" onClick={() => signOut()}>
            Se déconnecter
          </button>
        )}
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
