import { useEffect, useRef, useState } from 'react';
import { Account } from './components/Account';
import { Bilan } from './components/Bilan';
import { Rituals } from './components/Rituals';
import { COL_LETTERS, Sheet, useColumns } from './components/Sheet';
import { todayKey, type DayKey } from './lib/date';
import { refreshProfile } from './lib/supabase';
import { startSync } from './lib/sync';

type PanelId = 'bilan' | 'rituels' | 'compte';
const PANEL_TITLES: Record<PanelId, string> = { bilan: 'Bilan', rituels: 'Rituels', compte: 'Compte' };

let syncStarted = false;

export function App() {
  const today = todayKey();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [openDay, setOpenDay] = useState<DayKey>(today);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [toToday, setToToday] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const cols = useColumns(shell);

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
    if (q.has('pacte')) window.history.replaceState({}, '', '/');
  }, []);

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
          <div className="year" role="group" aria-label="Année">
            <button onClick={() => setYear(year - 1)} aria-label="Année précédente">
              <Chevron dir="left" />
            </button>
            <span>{year}</span>
            <button onClick={() => setYear(year + 1)} aria-label="Année suivante">
              <Chevron dir="right" />
            </button>
          </div>
          <div className="actions">
            <button className="pill" onClick={goToday}>
              Aujourd’hui
            </button>
            <IconButton label="Bilan" onClick={() => setPanel('bilan')} d="M4 17V10M10 17V5M16 17v-4" />
            <IconButton label="Rituels" onClick={() => setPanel('rituels')} d="M15.5 6.5A6 6 0 1 0 16 12M16 3.5v3h-3" />
            <IconButton label="Compte" onClick={() => setPanel('compte')} d="M10 10a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM4 17c1.1-3 3.4-4.4 6-4.4s4.9 1.4 6 4.4" />
          </div>
        </div>
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
      </header>

      <main>
        <Sheet year={year} cols={cols} openDay={openDay} setOpenDay={setOpenDay} scrollToToday={toToday} />
        <p className="credit">
          D’après la méthode de Fibre Tigre : une ligne par jour, une couleur par tâche.
        </p>
      </main>

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
              {panel === 'bilan' && <Bilan year={year} />}
              {panel === 'rituels' && <Rituals />}
              {panel === 'compte' && <Account />}
            </div>
          </aside>
        </div>
      )}

      {toast && <div className="toast glass">{toast}</div>}
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" rx="5" fill="var(--green)" />
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
