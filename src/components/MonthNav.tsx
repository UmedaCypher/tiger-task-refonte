import { useEffect, useRef, useState } from 'react';
import { fromKey, toKey, todayKey, type DayKey } from '../lib/date';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Le mois affiché, avec flèches mois par mois et un sélecteur rapide mois / année */
export function MonthNav({ day, onGo }: { day: DayKey; onGo: (d: DayKey) => void }) {
  const d = fromKey(day);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(d.getFullYear());
  const box = useRef<HTMLDivElement>(null);
  const today = fromKey(todayKey());

  useEffect(() => setYear(d.getFullYear()), [day]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('mousedown', off);
    addEventListener('keydown', key);
    return () => {
      removeEventListener('mousedown', off);
      removeEventListener('keydown', key);
    };
  }, [open]);

  /** Va au même jour du mois voulu (ou à aujourd'hui si c'est le mois en cours) */
  const goMonth = (y: number, m: number) => {
    if (y === today.getFullYear() && m === today.getMonth()) return onGo(todayKey());
    const last = new Date(y, m + 1, 0).getDate();
    onGo(toKey(new Date(y, m, Math.min(d.getDate(), last))));
  };
  const step = (n: number) => {
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    goMonth(t.getFullYear(), t.getMonth());
  };
  const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="mnav" ref={box}>
      <button className="mnav-arrow mnav-step" onClick={() => step(-1)} aria-label="Mois précédent">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button className="mnav-label" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog">
        <span className="mnav-long">{label}</span>
        <span className="mnav-short">{d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button className="mnav-arrow mnav-step" onClick={() => step(1)} aria-label="Mois suivant">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="mnav-pop glass" role="dialog" aria-label="Choisir un mois">
          <div className="mnav-year">
            <button className="mnav-arrow" onClick={() => setYear(year - 1)} aria-label="Année précédente">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span>{year}</span>
            <button className="mnav-arrow" onClick={() => setYear(year + 1)} aria-label="Année suivante">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="mnav-grid">
            {MONTHS.map((m, i) => {
              const cur = year === d.getFullYear() && i === d.getMonth();
              const now = year === today.getFullYear() && i === today.getMonth();
              return (
                <button
                  key={m}
                  className={`mnav-m ${cur ? 'is-current' : ''} ${now ? 'is-now' : ''}`}
                  aria-current={cur ? 'date' : undefined}
                  onClick={() => {
                    goMonth(year, i);
                    setOpen(false);
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <button
            className="mnav-today"
            onClick={() => {
              onGo(todayKey());
              setOpen(false);
            }}
          >
            Revenir à aujourd’hui
          </button>
        </div>
      )}
    </div>
  );
}
