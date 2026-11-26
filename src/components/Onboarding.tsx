import { useEffect, useState } from 'react';
import { todayKey } from '../lib/date';
import { track } from '../lib/growth';
import { PIGMENT_ORDER, PIGMENTS, type Pigment } from '../lib/pigments';
import { addTask, clearExamples } from '../lib/store';

const DONE_KEY = 'tt:onboarded';

const MEANING: Record<Pigment, string> = {
  white: 'Pas encore jugée.',
  green: 'C’est fait. Bravo, champion.',
  blue: 'La dernière tâche d’un projet, la fin d’un long combat. L’inverse de l’EPIC FAIL.',
  yellow: 'Pas envie aujourd’hui. Demain, promis. Feignasse assumée.',
  purple: 'Reportée, et pour une fois ce n’est pas ta faute.',
  red: 'Plus besoin, ou plus envie. On lâche, sans regret.',
  black: 'Un échec cuisant, légendaire. On en rira plus tard.',
};
export const needsOnboarding = () => !localStorage.getItem(DONE_KEY);

/**
 * L'accueil au premier lancement : on part de la douleur, on montre la méthode,
 * on fait colorer une tâche, et on termine en écrivant la première vraie tâche du jour.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Pigment>('green');
  const [first, setFirst] = useState('');

  useEffect(() => track('onboarding_step', { step }), [step]);

  const finish = (skip = false) => {
    clearExamples();
    if (first.trim()) addTask(todayKey(), first);
    localStorage.setItem(DONE_KEY, '1');
    track('onboarding_done', { skipped: skip, step });
    onDone();
  };

  const steps = [
    {
      eyebrow: 'Tu connais ça',
      title: 'Ta liste ne finit jamais.',
      body: 'Tu ajoutes, tu reportes, tu culpabilises. Et le soir, impossible de dire ce que tu as fait de ta journée. (Spoiler : plein de choses. Juste pas celles de la liste.)',
      visual: (
        <div className="ob-pile" aria-hidden="true">
          {['Répondre à ce mail', 'Appeler la banque', 'Finir le dossier', 'Ranger', 'Sport', 'Relire le contrat'].map((t, i) => (
            <span key={t} style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (2 + i)}deg) translateY(${i * -4}px)` }}>
              {t}
            </span>
          ))}
        </div>
      ),
    },
    {
      eyebrow: 'La méthode',
      title: 'Une ligne par jour. Rien de plus.',
      body: 'Chaque matin, tu poses dans la ligne du jour ce qui compte. Pas de projets, pas d’étiquettes, pas de tableau de bord. Juste aujourd’hui.',
      visual: (
        <div className="ob-rows" aria-hidden="true">
          {['mar 24', 'mer 25', 'jeu 26', 'ven 27'].map((d, i) => (
            <div key={d} className={i === 2 ? 'is-today' : ''}>
              <b>{d}</b>
              <i />
              <i />
              {i < 2 && <i />}
            </div>
          ))}
        </div>
      ),
    },
    {
      eyebrow: 'Le verdict du soir',
      title: 'Chaque tâche reçoit sa couleur.',
      body: 'Faite, flemme, abandonnée… ou EPIC FAIL. Sept couleurs, zéro excuse. Touche-les pour voir ce qu’elles veulent dire.',
      visual: (
        <div className="ob-colors">
          <div className="chips">
            {PIGMENT_ORDER.filter((p) => p !== 'white').map((p) => (
              <button
                key={p}
                className={`chip is-${p} ${picked === p ? 'is-picked' : ''}`}
                style={{ ['--fill' as string]: PIGMENTS[p].fill, ['--ink' as string]: PIGMENTS[p].ink, ['--dot' as string]: p === 'black' ? '#e5483b' : PIGMENTS[p].color }}
                onClick={() => setPicked(p)}
              >
                <span className="ob-dot" />
                {PIGMENTS[p].name}
              </button>
            ))}
          </div>
          <p className="ob-meaning" key={picked}>{MEANING[picked]}</p>
        </div>
      ),
    },
    {
      eyebrow: 'Ta flemme te suit',
      title: 'Ce que tu reportes revient demain.',
      body: 'En jaune, la tâche se recopie toute seule le lendemain, avec son compteur. Au troisième report, l’app commence à te chambrer. Le jour où tu la finis enfin, ouf.',
      visual: (
        <div className="ob-carry" aria-hidden="true">
          <span className="chip is-yellow" style={{ ['--fill' as string]: PIGMENTS.yellow.fill, ['--ink' as string]: PIGMENTS.yellow.ink }}>
            Mail qui fait peur
          </span>
          <span className="ob-arrow">→</span>
          <span className="chip is-yellow" style={{ ['--fill' as string]: PIGMENTS.yellow.fill, ['--ink' as string]: PIGMENTS.yellow.ink }}>
            Flemme ↻3
          </span>
          <span className="ob-arrow">→</span>
          <span className="chip is-green" style={{ ['--fill' as string]: PIGMENTS.green.fill, ['--ink' as string]: PIGMENTS.green.ink }}>
            Enfin faite
          </span>
        </div>
      ),
    },
    {
      eyebrow: 'Dans un mois',
      title: 'Tu verras qui tu es vraiment.',
      body: 'Pas celui que tu promets d’être. Tes jours colorés dessinent ton année : tes EPIC WIN, ta flemme, tes EPIC FAIL. Sans jugement. Enfin, presque.',
      visual: (
        <div className="ob-year" aria-hidden="true">
          {Array.from({ length: 84 }, (_, i) => {
            const c = ['green', 'green', 'blue', 'yellow', 'green', 'purple', 'red', 'green'][(i * 7 + (i >> 3)) % 8] as Pigment;
            return <i key={i} style={{ background: PIGMENTS[c].color, opacity: 0.35 + ((i * 13) % 10) / 15 }} />;
          })}
        </div>
      ),
    },
  ];

  const last = step === steps.length;
  const s = steps[step];

  return (
    <div className="ob-layer">
      <div className="ob glass" role="dialog" aria-modal="true" aria-label="Bienvenue dans Tiger Task">
        <div className="ob-progress" aria-hidden="true">
          {Array.from({ length: steps.length + 1 }, (_, i) => (
            <i key={i} className={i <= step ? 'is-on' : ''} />
          ))}
        </div>

        {!last ? (
          <div className="ob-step" key={step}>
            <div className="ob-visual">{s.visual}</div>
            <p className="ob-eyebrow">{s.eyebrow}</p>
            <h2 className="ob-title">{s.title}</h2>
            <p className="ob-body">{s.body}</p>
          </div>
        ) : (
          <form
            className="ob-step"
            key="first"
            onSubmit={(e) => {
              e.preventDefault();
              finish();
            }}
          >
            <p className="ob-eyebrow">À toi</p>
            <h2 className="ob-title">Qu’est-ce qui compte aujourd’hui&nbsp;?</h2>
            <p className="ob-body">Une seule chose suffit pour commencer. Ce soir, tu lui donneras sa couleur.</p>
            <input className="field ob-input" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Appeler le garage avant midi" autoFocus aria-label="Ta première tâche" />
          </form>
        )}

        <div className="ob-actions">
          {!last && (
            <button className="btn ghost" onClick={() => finish(true)}>
              Passer
            </button>
          )}
          {step > 0 && (
            <button className="btn" onClick={() => setStep(step - 1)}>
              Retour
            </button>
          )}
          <button className="btn primary" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? (first.trim() ? 'Poser ma journée' : 'Commencer') : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}
