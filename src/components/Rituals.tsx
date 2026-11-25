import { useState } from 'react';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../lib/date';
import { addRitual, deleteRitual, updateRitual, useStore } from '../lib/store';

const toggle = (arr: number[], d: number) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d].sort());

export function Rituals() {
  const rituals = useStore((s) => Object.values(s.rituals).filter((r) => !r.deleted));
  const [text, setText] = useState('');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);

  return (
    <div className="stack">
      <p className="muted">Les tâches qui reviennent chaque semaine s’ajoutent seules à la ligne du jour.</p>
      <form
        className="stack tight"
        onSubmit={(e) => {
          e.preventDefault();
          addRitual(text, days);
          setText('');
        }}
      >
        <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire 500 mots" aria-label="Nouveau rituel" />
        <Weekdays value={days} onChange={setDays} />
        <button className="btn primary" disabled={!text.trim() || days.length === 0}>
          Ajouter le rituel
        </button>
      </form>

      {rituals.length > 0 && (
        <ul className="list">
          {rituals.map((r) => (
            <li key={r.id} className={r.active ? '' : 'is-paused'}>
              <div className="list-main">
                <span>{r.text}</span>
                <Weekdays value={r.weekdays} onChange={(w) => updateRitual(r.id, { weekdays: w })} small />
              </div>
              <div className="list-actions">
                <button className="btn ghost" onClick={() => updateRitual(r.id, { active: !r.active })}>
                  {r.active ? 'Pause' : 'Reprendre'}
                </button>
                <button className="btn ghost danger" onClick={() => deleteRitual(r.id)}>
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Weekdays({ value, onChange, small }: { value: number[]; onChange: (v: number[]) => void; small?: boolean }) {
  return (
    <div className={`weekdays ${small ? 'small' : ''}`} role="group" aria-label="Jours">
      {WEEKDAY_SHORT.map((w, i) => (
        <button type="button" key={i} className={value.includes(i) ? 'is-on' : ''} aria-pressed={value.includes(i)} aria-label={WEEKDAY_LONG[i]} onClick={() => onChange(toggle(value, i))}>
          {w}
        </button>
      ))}
    </div>
  );
}
