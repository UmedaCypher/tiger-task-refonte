import { useMemo, useState } from 'react';
import { monthName, todayKey, toKey, type DayKey } from '../lib/date';
import { byDay } from '../lib/stats';
import { useStore } from '../lib/store';

/**
 * La tapisserie de l'année : douze rangs, un par mois, un point par jour.
 * Chaque point est tissé des couleurs de ses tâches — c'est le tableur de Fibre Tigre, vu de loin.
 */
export function Tapestry({ onPick }: { onPick: (d: DayKey) => void }) {
  const today = todayKey();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const tasks = useStore((s) => s.tasks);
  const days = useMemo(() => byDay({ tasks } as never), [tasks]);
  const years = useMemo(() => {
    const ys = new Set<number>([Number(today.slice(0, 4))]);
    for (const d of days.keys()) ys.add(Number(d.slice(0, 4)));
    return [...ys].sort();
  }, [days, today]);

  return (
    <section className="tapestry">
      <header className="page-head">
        <p className="eyebrow">Vue d’ensemble</p>
        <h1 className="page-title">
          La tapisserie <span className="year-switch">
            <button onClick={() => setYear(year - 1)} disabled={!years.includes(year - 1)} aria-label="Année précédente">‹</button>
            {year}
            <button onClick={() => setYear(year + 1)} disabled={!years.includes(year + 1)} aria-label="Année suivante">›</button>
          </span>
        </h1>
        <p className="verse">Chaque jour, un fil. Chaque fil, une couleur. Recule d’un pas : c’est ton année.</p>
      </header>

      <div className="loom" role="grid" aria-label={`Année ${year}`}>
        <div className="loom-row loom-days" aria-hidden="true">
          <span className="loom-month" />
          {Array.from({ length: 31 }, (_, i) => (
            <span key={i} className="loom-daynum">
              {(i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}
            </span>
          ))}
        </div>
        {Array.from({ length: 12 }, (_, m) => {
          const len = new Date(year, m + 1, 0).getDate();
          return (
            <div key={m} className="loom-row" role="row">
              <span className="loom-month">{monthName(m).slice(0, 4)}</span>
              {Array.from({ length: 31 }, (_, i) => {
                if (i >= len) return <span key={i} className="knot is-void" />;
                const key = toKey(new Date(year, m, i + 1));
                const ts = days.get(key) ?? [];
                return (
                  <button
                    key={i}
                    role="gridcell"
                    className={`knot ${key === today ? 'is-today' : ''} ${key > today ? 'is-future' : ''}`}
                    onClick={() => onPick(key)}
                    aria-label={`${i + 1} ${monthName(m)} : ${ts.length} tâches`}
                    title={`${i + 1} ${monthName(m)} — ${ts.length} tâche${ts.length > 1 ? 's' : ''}`}
                  >
                    {ts.map((t) => (
                      <i key={t.id} className={`thread-${t.pigment}`} />
                    ))}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
