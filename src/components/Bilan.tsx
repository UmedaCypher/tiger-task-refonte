import { useMemo, useState } from 'react';
import { monthName, todayKey } from '../lib/date';
import { PIGMENT_ORDER, PIGMENTS } from '../lib/pigments';
import { bilan } from '../lib/stats';
import { useStore } from '../lib/store';

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function Bilan() {
  const [year, setYear] = useState(Number(todayKey().slice(0, 4)));
  const tasks = useStore((s) => s.tasks);
  const b = useMemo(() => bilan({ tasks } as never, year), [tasks, year]);
  const maxMonth = Math.max(1, ...b.months.map((m) => PIGMENT_ORDER.reduce((a, p) => a + m[p], 0)));

  return (
    <section className="bilan">
      <header className="page-head">
        <p className="eyebrow">Le livre de comptes</p>
        <h1 className="page-title">
          Bilan{' '}
          <span className="year-switch">
            <button onClick={() => setYear(year - 1)} aria-label="Année précédente">‹</button>
            {year}
            <button onClick={() => setYear(year + 1)} aria-label="Année suivante">›</button>
          </span>
        </h1>
      </header>

      <div className="figures">
        <Figure value={b.total} label="tâches inscrites" />
        <Figure value={pct(b.accomplishment)} label="accomplies" tone="green" />
        <Figure value={pct(b.flemme)} label="indice de flemme" tone="yellow" />
        <Figure value={b.streak} label={`jours de suite · record ${b.bestStreak}`} tone="gold" />
      </div>

      <div className="spectrum" aria-label="Répartition des couleurs">
        {PIGMENT_ORDER.filter((p) => b.counts[p] > 0).map((p) => (
          <span key={p} className={`thread-${p}`} style={{ flexGrow: b.counts[p] }} title={`${PIGMENTS[p].name} : ${b.counts[p]}`} />
        ))}
      </div>

      <ul className="legend">
        {PIGMENT_ORDER.map((p) => (
          <li key={p}>
            <span className={`seal seal-${p} small`} />
            <span className="legend-name">{PIGMENTS[p].name}</span>
            <span className="legend-meaning">{PIGMENTS[p].meaning}</span>
            <span className="legend-count">{b.counts[p]}</span>
          </li>
        ))}
      </ul>

      <h2 className="section-title">Mois après mois</h2>
      <div className="months">
        {b.months.map((m, i) => {
          const total = PIGMENT_ORDER.reduce((a, p) => a + m[p], 0);
          return (
            <div key={i} className="month-col" title={`${monthName(i)} : ${total} tâches`}>
              <div className="month-bar" style={{ height: `${(total / maxMonth) * 100}%` }}>
                {PIGMENT_ORDER.filter((p) => m[p] > 0).map((p) => (
                  <span key={p} className={`thread-${p}`} style={{ flexGrow: m[p] }} />
                ))}
              </div>
              <span className="month-label">{monthName(i).slice(0, 1).toUpperCase()}</span>
            </div>
          );
        })}
      </div>

      {b.mostCarried && (
        <blockquote className="nemesis">
          <span className="eyebrow">Ta Némésis</span>
          <p>« {b.mostCarried.text} »</p>
          <span>reportée {b.mostCarried.carryCount} fois</span>
        </blockquote>
      )}

      <p className="footnote">
        {b.activeDays} jours tissés en {year}. L’indice de flemme compte le safran et le vermillon ; l’améthyste, elle, ne
        t’est pas reprochée.
      </p>
    </section>
  );
}

function Figure({ value, label, tone }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className={`figure ${tone ? `tone-${tone}` : ''}`}>
      <span className="figure-value">{value}</span>
      <span className="figure-label">{label}</span>
    </div>
  );
}
