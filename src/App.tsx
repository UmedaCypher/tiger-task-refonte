import { useEffect, useState } from 'react';
import { Account } from './components/Account';
import { Bilan } from './components/Bilan';
import { DayView } from './components/DayView';
import { Rituals } from './components/Rituals';
import { Tapestry } from './components/Tapestry';
import { Stripes, TigerMark } from './components/TigerMark';
import { todayKey, type DayKey } from './lib/date';
import { refreshProfile } from './lib/supabase';
import { startSync } from './lib/sync';

type Tab = 'jour' | 'tapisserie' | 'bilan' | 'rituels' | 'compte';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'jour', label: 'Jour', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'tapisserie', label: 'Tapisserie', icon: 'M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4z' },
  { id: 'bilan', label: 'Bilan', icon: 'M5 20V11M12 20V5M19 20v-7' },
  { id: 'rituels', label: 'Rituels', icon: 'M12 4a8 8 0 1 1-7.4 5M4 4v5h5' },
  { id: 'compte', label: 'Compte', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6' },
];

let syncStarted = false;

export function App() {
  const [tab, setTab] = useState<Tab>('jour');
  const [day, setDay] = useState<DayKey>(todayKey());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!syncStarted) {
      syncStarted = true;
      startSync();
    }
    const q = new URLSearchParams(window.location.search);
    if (q.get('pacte') === 'scelle') {
      setToast('Le pacte est scellé. Bienvenue, tigre.');
      setTab('compte');
      refreshProfile();
      setTimeout(refreshProfile, 4000); // le webhook Stripe peut arriver un peu après
    }
    if (q.has('pacte')) window.history.replaceState({}, '', '/');
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // au retour sur l'app après minuit, on revient au nouveau jour
  useEffect(() => {
    let last = todayKey();
    const check = () => {
      const now = todayKey();
      if (now !== last) {
        if (day === last) setDay(now);
        last = now;
      }
    };
    window.addEventListener('focus', check);
    const i = setInterval(check, 60_000);
    return () => {
      window.removeEventListener('focus', check);
      clearInterval(i);
    };
  }, [day]);

  return (
    <div className="app">
      <Stripes />
      <aside className="rail">
        <div className="brand">
          <TigerMark size={34} />
          <span>
            Tiger <em>Task</em>
          </span>
        </div>
        <Nav tab={tab} setTab={setTab} />
      </aside>

      <main className="stage">
        {tab === 'jour' && <DayView day={day} setDay={setDay} />}
        {tab === 'tapisserie' && (
          <Tapestry
            onPick={(d) => {
              setDay(d);
              setTab('jour');
            }}
          />
        )}
        {tab === 'bilan' && <Bilan />}
        {tab === 'rituels' && <Rituals />}
        {tab === 'compte' && <Account />}
      </main>

      <nav className="dock" aria-label="Navigation">
        <Nav tab={tab} setTab={setTab} />
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Nav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <ul className="nav">
      {TABS.map((t) => (
        <li key={t.id}>
          <button className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
