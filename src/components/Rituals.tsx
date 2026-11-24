import { useState } from 'react';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../lib/date';
import { addRitual, deleteRitual, updateRitual, useStore } from '../lib/store';

export function Rituals() {
  const rituals = useStore((s) => Object.values(s.rituals).filter((r) => !r.deleted));
  const [text, setText] = useState('');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);

  const toggle = (arr: number[], d: number) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]);

  return (
    <section className="rituals">
      <header className="page-head">
        <p className="eyebrow">Ce qui revient</p>
        <h1 className="page-title">Les rituels</h1>
        <p className="verse">Les gestes qui reviennent, chaque semaine, aux mêmes jours. Ils s’inscrivent seuls dans le carnet.</p>
      </header>

      <form
        className="ritual-form"
        onSubmit={(e) => {
          e.preventDefault();
          addRitual(text, days);
          setText('');
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. : Écrire 500 mots" aria-label="Nouveau rituel" />
        <div className="weekdays">
          {WEEKDAY_SHORT.map((w, i) => (
            <button
              type="button"
              key={i}
              className={days.includes(i) ? 'is-on' : ''}
              onClick={() => setDays(toggle(days, i))}
              aria-pressed={days.includes(i)}
              aria-label={WEEKDAY_LONG[i]}
            >
              {w}
            </button>
          ))}
        </div>
        <button className="gold-btn" disabled={!text.trim() || days.length === 0}>
          Instituer le rituel
        </button>
      </form>

      <ul className="ritual-list">
        {rituals.length === 0 && <li className="empty small">Aucun rituel pour l’instant.</li>}
        {rituals.map((r) => (
          <li key={r.id} className={r.active ? '' : 'is-paused'}>
            <span className="ritual-text">{r.text}</span>
            <div className="weekdays small">
              {WEEKDAY_SHORT.map((w, i) => (
                <button
                  key={i}
                  className={r.weekdays.includes(i) ? 'is-on' : ''}
                  onClick={() => updateRitual(r.id, { weekdays: toggle(r.weekdays, i).sort() })}
                  aria-label={WEEKDAY_LONG[i]}
                >
                  {w}
                </button>
              ))}
            </div>
            <div className="ritual-actions">
              <button className="ghost" onClick={() => updateRitual(r.id, { active: !r.active })}>
                {r.active ? 'Suspendre' : 'Reprendre'}
              </button>
              <button className="ghost danger" onClick={() => deleteRitual(r.id)}>
                Abolir
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
