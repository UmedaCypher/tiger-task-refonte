import { useMemo } from 'react';
import { monthName } from '../lib/date';
import { PIGMENT_ORDER, PIGMENTS } from '../lib/pigments';
import { bilan } from '../lib/stats';
import { bilanVerdict } from '../lib/roast';
import { useStore } from '../lib/store';
import { openPaywall } from './Paywall';

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function Bilan({ year, locked }: { year: number; locked: boolean }) {
  const tasks = useStore((s) => s.tasks);
  const b = useMemo(() => bilan({ tasks } as never, year), [tasks, year]);
  const max = Math.max(1, ...b.months.map((m) => PIGMENT_ORDER.reduce((a, p) => a + m[p], 0)));

  return (
    <div className={`stack ${locked ? 'is-locked-panel' : ''}`}>
      {locked && (
        <div className="locked-cta">
          <p>Ton bilan te montre ce que tu fais vraiment de ton temps. Il fait partie de Pro.</p>
          <button className="btn primary" onClick={() => openPaywall('bilan')}>
            Voir mon bilan
          </button>
        </div>
      )}
      <p className="verdict">{bilanVerdict(b.flemme, b.epicFails, b.judged)}</p>
      <table className="kv">
        <tbody>
          <tr><th>Tâches en {year}</th><td>{b.total}</td></tr>
          <tr><th>Faites</th><td>{pct(b.accomplishment)}</td></tr>
          <tr><th>Indice de flemme</th><td>{pct(b.flemme)}</td></tr>
          <tr><th>EPIC FAIL</th><td>{b.epicFails}</td></tr>
          <tr><th>Jours de suite</th><td>{b.streak} <span className="muted">· record {b.bestStreak}</span></td></tr>
        </tbody>
      </table>

      <div className="bar-split" aria-label="Répartition des couleurs">
        {PIGMENT_ORDER.filter((p) => p !== 'white' && b.counts[p] > 0).map((p) => (
          <span key={p} style={{ flexGrow: b.counts[p], background: PIGMENTS[p].color }} title={`${PIGMENTS[p].name} : ${b.counts[p]}`} />
        ))}
      </div>

      <table className="kv legend">
        <tbody>
          {PIGMENT_ORDER.map((p) => (
            <tr key={p}>
              <th>
                <span className={`swatch-chip is-${p}`} style={{ background: p === 'white' ? 'transparent' : PIGMENTS[p].color }} />
                {PIGMENTS[p].name}
              </th>
              <td>{b.counts[p]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="months" aria-label="Mois par mois">
        {b.months.map((m, i) => {
          const total = PIGMENT_ORDER.reduce((a, p) => a + m[p], 0);
          return (
            <div key={i} className="month-col" title={`${monthName(i)} : ${total}`}>
              <div className="month-bar" style={{ height: `${(total / max) * 100}%` }}>
                {PIGMENT_ORDER.filter((p) => m[p] > 0).map((p) => (
                  <span key={p} style={{ flexGrow: m[p], background: p === 'white' ? 'var(--line-strong)' : PIGMENTS[p].color }} />
                ))}
              </div>
              <span>{monthName(i).charAt(0).toUpperCase()}</span>
            </div>
          );
        })}
      </div>

      {b.mostCarried && (
        <p className="muted">
          La plus reportée : <strong>{b.mostCarried.text}</strong> ({b.mostCarried.carryCount} fois)
        </p>
      )}
    </div>
  );
}
