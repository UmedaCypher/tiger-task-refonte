import { useEffect, useRef, useState } from 'react';
import { onAuth, signInWithEmail, signInWithGoogle, supabase, useAuth } from '../lib/supabase';
import { say } from '../lib/roast';

type Why = 'default' | 'sync' | 'pay';
const listeners = new Set<(why: Why) => void>();
/** Ouvre la fenêtre de connexion depuis n'importe où */
export function openLogin(why: Why = 'default') {
  listeners.forEach((l) => l(why));
}

const LEAD: Record<Why, string> = {
  default: 'Ton compte garde ta feuille à l’abri et la synchronise sur ton téléphone comme sur ton ordinateur. C’est gratuit.',
  sync: 'Connecte-toi pour retrouver ta feuille sur tous tes appareils. Ce qui est déjà ici est conservé.',
  pay: 'Connecte-toi d’abord : ton offre sera liée à ton compte, sur tous tes appareils.',
};

/** Traduit les erreurs courantes en phrases claires */
function human(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/rate|too many|security purposes/i.test(m)) return 'Trop de demandes d’un coup. Attends une minute avant de réessayer.';
  if (/invalid.*email|email.*invalid/i.test(m)) return 'Cette adresse email ne semble pas valide.';
  if (/network|fetch/i.test(m)) return 'Pas de connexion internet pour l’instant. Réessaie dans un instant.';
  return 'La connexion n’a pas marché. Réessaie, ou utilise l’autre méthode.';
}

export function LoginHost() {
  const [why, setWhy] = useState<Why | null>(null);
  const { session, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const l = (w: Why) => {
      setWhy(w);
      setSent(false);
      setErr(null);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  // connecté : la fenêtre se ferme toute seule
  const isOpen = useRef(false);
  isOpen.current = why !== null;
  useEffect(() => {
    const off = onAuth((a) => {
      if (a.session && isOpen.current) {
        say('Connecté. Ta feuille te suit partout maintenant.');
        setWhy(null);
      }
    });
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    if (!why) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setWhy(null);
    addEventListener('keydown', onKey);
    setTimeout(() => input.current?.focus(), 60);
    return () => removeEventListener('keydown', onKey);
  }, [why]);

  if (!why || session) return null;
  const close = () => setWhy(null);

  const sendLink = async () => {
    setErr(null);
    setBusy('email');
    try {
      await signInWithEmail(email.trim());
      setSent(true);
    } catch (e) {
      setErr(human(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pw-layer" onMouseDown={close}>
      <div className="pw lg glass" role="dialog" aria-modal="true" aria-labelledby="lg-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pw-halo" aria-hidden="true" />
        <button className="lg-close icon" onClick={close} aria-label="Fermer">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {!supabase ? (
          <>
            <h2 className="pw-title" id="lg-title">Les comptes arrivent bientôt</h2>
            <p className="pw-lead">En attendant, ta feuille est gardée sur cet appareil.</p>
          </>
        ) : sent ? (
          <div className="lg-sent">
            <div className="lg-mail" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="48" height="48">
                <rect x="6" y="11" width="36" height="26" rx="6" fill="var(--accent-tint)" stroke="var(--accent)" strokeWidth="2" />
                <path d="m8 14 16 12 16-12" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="pw-title" id="lg-title">Regarde tes emails</h2>
            <p className="pw-lead">
              On t’a envoyé un lien de connexion à <strong>{email}</strong>. Ouvre-le sur cet appareil : tu seras connecté directement, sans mot de passe.
            </p>
            <p className="fine-print">Rien reçu après une minute ? Regarde dans les indésirables.</p>
            <div className="lg-row">
              <button className="btn" onClick={() => setSent(false)}>
                Changer d’email
              </button>
              <button className="btn" disabled={busy !== null} onClick={sendLink}>
                Renvoyer le lien
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="pw-eyebrow">Ton compte</p>
            <h2 className="pw-title" id="lg-title">Connexion</h2>
            <p className="pw-lead">{LEAD[why]}</p>

            <button
              className="btn lg-google"
              disabled={busy !== null || !ready}
              onClick={async () => {
                setErr(null);
                setBusy('google');
                try {
                  await signInWithGoogle();
                } catch (e) {
                  setErr(human(e));
                  setBusy(null);
                }
              }}
            >
              <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
              </svg>
              {busy === 'google' ? 'Ouverture de Google…' : 'Continuer avec Google'}
            </button>

            <div className="lg-or" aria-hidden="true">
              <span>ou avec ton email</span>
            </div>

            <form
              className="stack tight"
              onSubmit={(e) => {
                e.preventDefault();
                sendLink();
              }}
            >
              <label className="lg-label" htmlFor="lg-email">
                Adresse email
              </label>
              <input
                ref={input}
                id="lg-email"
                className="field"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@email.fr"
              />
              <button className="btn primary" disabled={busy !== null || !ready || !email}>
                {busy === 'email' ? 'Envoi…' : 'Recevoir mon lien de connexion'}
              </button>
            </form>
            <p className="fine-print">Pas de mot de passe à retenir. Même email = même compte, que tu crées ton compte ou que tu reviennes.</p>
          </>
        )}

        {err && (
          <p className="lg-err" role="alert">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
