import { useEffect, useRef, useState } from 'react';
import { Account } from './components/Account';
import { Bilan } from './components/Bilan';
import { Rituals } from './components/Rituals';
import { needsOnboarding, Onboarding } from './components/Onboarding';
import { openPaywall, PaywallHost } from './components/Paywall';
import { COL_LETTERS, Sheet, useColumns } from './components/Sheet';
import { Stage } from './components/Stage';
import { Scene } from './scene/Scene';
import { addDays, fromKey, todayKey, type DayKey } from './lib/date';
import { captureReferral, claimReferral, startCheckout, takePendingPlan, trackDaily } from './lib/growth';
import { isPro, onAuth, refreshProfile, useAuth } from './lib/supabase';
import { onSay } from './lib/roast';
import { startSync } from './lib/sync';

/** En gratuit : les 30 derniers jours restent nets, les plus anciens sont floutés */
export const FREE_DAYS = 30;

type PanelId = 'bilan' | 'rituels' | 'compte';
const WD_SHORT = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const PANEL_TITLES: Record<PanelId, string> = { bilan: 'Bilan', rituels: 'Rituels', compte: 'Compte' };

let syncStarted = false;

type Theme = 'auto' | 'day' | 'night';
interface Prefs {
  theme: Theme;
  excel: boolean;
  roast: boolean;
}
const PREFS_KEY = 'tiger-task:prefs';
function loadPrefs(): Prefs {
  try {
    return { theme: 'auto', excel: false, roast: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { theme: 'auto', excel: false, roast: true };
  }
}

/** Thème effectif : auto suit le réglage clair/sombre de l'appareil */
function useTheme(theme: Theme) {
  const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [dark, setDark] = useState(mq?.matches ?? false);
  useEffect(() => {
    if (!mq) return;
    const h = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [mq]);
  return theme === 'auto' ? (dark ? 'night' : 'day') : theme;
}

const THEME_NEXT: Record<Theme, Theme> = { auto: 'day', day: 'night', night: 'auto' };
const THEME_LABEL: Record<Theme, string> = { auto: 'Thème automatique', day: 'Thème jour', night: 'Thème nuit' };
const THEME_ICON: Record<Theme, string> = {
  auto: 'M10 3a7 7 0 1 0 0 14V3Z M10 3a7 7 0 0 1 0 14',
  day: 'M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM10 2v1.6M10 16.4V18M2 10h1.6M16.4 10H18M4.3 4.3l1.2 1.2M14.5 14.5l1.2 1.2M4.3 15.7l1.2-1.2M14.5 5.5l1.2-1.2',
  night: 'M16 12.5A6.5 6.5 0 0 1 7.5 4a6.5 6.5 0 1 0 8.5 8.5Z',
};

export function App() {
  const today = todayKey();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [openDay, setOpenDay] = useState<DayKey>(today);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [toToday, setToToday] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(needsOnboarding);
  const [todayAway, setTodayAway] = useState(false);

  // le bouton Aujourd'hui s'anime quand la ligne du jour sort de l'écran
  useEffect(() => {
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.querySelector(`[data-day="${todayKey()}"]`);
        if (!el) return setTodayAway(true);
        const r = el.getBoundingClientRect();
        setTodayAway(r.bottom < 0 || r.top > innerHeight);
      });
    };
    addEventListener('scroll', check, { passive: true });
    check();
    return () => removeEventListener('scroll', check);
  }, []);
  const auth = useAuth();
  const pro = isPro(auth);
  const lockBefore = pro ? null : addDays(today, -FREE_DAYS);

  // croissance : parrainage, mesure d'usage, reprise d'un achat commencé avant la connexion
  useEffect(() => {
    captureReferral();
    trackDaily('app_open');
    // arrivée depuis la page Tarifs du site
    const offre = new URLSearchParams(location.search).get('offre');
    if (offre) {
      history.replaceState(null, '', '/app/');
      setTimeout(() => openPaywall('upgrade'), 400);
    }
    const off = onAuth((a) => {
      if (!a.profile) return;
      claimReferral();
      const pending = takePendingPlan();
      if (pending && !a.profile.is_premium) startCheckout(pending).catch(() => openPaywall('upgrade'));
    });
    return () => {
      off();
    };
  }, []);
  const shell = useRef<HTMLDivElement>(null);
  const cols = useColumns(shell);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const mode = useTheme(prefs.theme);
  const setPref = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.dataset.excel = prefs.excel ? 'on' : 'off';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'night' ? '#171a33' : '#f3f2f7');
  }, [mode, prefs.excel]);

  useEffect(() => {
    if (!syncStarted) {
      syncStarted = true;
      startSync();
    }
    const q = new URLSearchParams(window.location.search);
    if (q.get('pacte') === 'scelle') {
      setToast('Abonnement activé. Merci.');
      setPanel('compte');
      refreshProfile();
      setTimeout(refreshProfile, 4000);
    }
    if (q.has('pacte')) window.history.replaceState({}, '', '/app/');
  }, []);

  useEffect(() => onSay(setToast), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // passage à minuit : la ligne ouverte suit le nouveau jour
  useEffect(() => {
    let last = todayKey();
    const check = () => {
      const now = todayKey();
      if (now !== last) {
        setOpenDay((d) => (d === last ? now : d));
        last = now;
      }
    };
    window.addEventListener('focus', check);
    const i = setInterval(check, 60_000);
    return () => {
      window.removeEventListener('focus', check);
      clearInterval(i);
    };
  }, []);

  const goToday = () => {
    setYear(Number(today.slice(0, 4)));
    setOpenDay(today);
    setToToday((n) => n + 1);
  };

  return (
    <div className="shell" ref={shell}>
      <header className="chrome glass">
        <div className="bar">
          <div className="brand">
            <Logo />
            <span>Tiger Task</span>
          </div>
          {!prefs.excel ? (
            <span className="month-label">{fromKey(openDay).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
          ) : (
          <div className="year" role="group" aria-label="Année">
            <button onClick={() => setYear(year - 1)} aria-label="Année précédente">
              <Chevron dir="left" />
            </button>
            <span>{year}</span>
            <button onClick={() => setYear(year + 1)} aria-label="Année suivante">
              <Chevron dir="right" />
            </button>
          </div>
          )}
          <div className="actions">
            <button
              className={`toggle ${prefs.excel ? 'is-on' : ''}`}
              role="switch"
              aria-checked={prefs.excel}
              onClick={() => setPref({ excel: !prefs.excel })}
            >
              Excel
            </button>
            <IconButton label={THEME_LABEL[prefs.theme]} onClick={() => setPref({ theme: THEME_NEXT[prefs.theme] })} d={THEME_ICON[prefs.theme]} />
            <IconButton label="Bilan" onClick={() => setPanel('bilan')} d="M4 17V10M10 17V5M16 17v-4" />
            <IconButton label="Rituels" onClick={() => setPanel('rituels')} d="M15.5 6.5A6 6 0 1 0 16 12M16 3.5v3h-3" />
            <IconButton label="Compte" onClick={() => setPanel('compte')} d="M10 10a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM4 17c1.1-3 3.4-4.4 6-4.4s4.9 1.4 6 4.4" />
          </div>
        </div>
        {prefs.excel && (
        <div className="colhead" style={{ ['--cols' as string]: cols }} aria-hidden="true">
          <span className="rownum" />
          <span className="date" />
          <span className="letters">
            {COL_LETTERS.slice(0, cols)
              .split('')
              .map((l) => (
                <span key={l}>{l}</span>
              ))}
          </span>
        </div>
        )}
      </header>

      {prefs.excel ? (
        <main>
          <Sheet year={year} cols={cols} excel lockBefore={lockBefore} onLocked={() => openPaywall('history')} openDay={openDay} setOpenDay={setOpenDay} scrollToToday={toToday} />
          <p className="credit">
            D’après la méthode de Fibre Tigre : une ligne par jour, une couleur par tâche.
          </p>
        </main>
      ) : (
        <main className="stage-main">
          <Scene night={mode === 'night'} />
          <Stage openDay={openDay} setOpenDay={setOpenDay} lockBefore={lockBefore} onLocked={() => openPaywall('history')} />
        </main>
      )}

      <button className={`today-fab glass ${(prefs.excel ? todayAway : openDay !== today) ? 'is-away' : ''}`} onClick={goToday} aria-label="Revenir à aujourd’hui">
        <span className="today-fab-wd">{WD_SHORT[new Date().getDay()]}</span>
        <span className="today-fab-num">{new Date().getDate()}</span>
      </button>

      {panel && (
        <div className="panel-layer" onMouseDown={() => setPanel(null)}>
          <aside className="panel glass" role="dialog" aria-label={PANEL_TITLES[panel]} onMouseDown={(e) => e.stopPropagation()}>
            <header className="panel-head">
              <h2>{PANEL_TITLES[panel]}</h2>
              <button className="icon" onClick={() => setPanel(null)} aria-label="Fermer">
                <svg viewBox="0 0 20 20" width="18" height="18">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <div className="panel-body">
              {panel === 'bilan' && <Bilan year={year} locked={!pro} />}
              {panel === 'rituels' && <Rituals />}
              {panel === 'compte' && (
                <Account
                  roast={prefs.roast}
                  onRoast={(roast) => setPref({ roast })}
                  onReplayOnboarding={() => {
                    setPanel(null);
                    setOnboarding(true);
                  }}
                />
              )}
            </div>
          </aside>
        </div>
      )}

      {toast && (
        <div className="toast glass" role="status" key={toast} onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
      <PaywallHost />
      {onboarding && <Onboarding onDone={() => (setOnboarding(false), setToToday((n) => n + 1))} />}
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" rx="5" fill="var(--accent)" />
      <path d="M1 7.5h18M1 12.5h18M7.5 1v18" stroke="#fff" strokeOpacity=".55" strokeWidth="1" />
      <rect x="7.5" y="7.5" width="11.5" height="5" fill="#fff" fillOpacity=".9" />
    </svg>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d={dir === 'left' ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconButton({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button className="icon" onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 20 20" width="19" height="19" aria-hidden="true">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
