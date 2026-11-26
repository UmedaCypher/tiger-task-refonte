/**
 * Le mode roast : l'app te chambre, gentiment. Rien de méchant, tout au second degré.
 * Désactivable dans Compte › Plus.
 */
import type { DayKey } from './date';
import type { Pigment } from './pigments';
import type { Task } from './store';

const PREFS_KEY = 'tiger-task:prefs';

export function roastEnabled() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}').roast !== false;
  } catch {
    return true;
  }
}

/* ----- bulle de message, affichée par l'App ----- */
const listeners = new Set<(msg: string) => void>();
export function onSay(l: (msg: string) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function say(msg: string | null) {
  if (msg && roastEnabled()) listeners.forEach((l) => l(msg));
}

let last = '';
function pick(lines: string[], n = 0) {
  const pool = lines.length > 1 ? lines.filter((l) => l !== last) : lines;
  const line = pool[Math.floor(Math.random() * pool.length)].replace('{n}', String(n));
  last = line;
  return line;
}

const LINES: Record<Exclude<Pigment, 'white' | 'yellow'>, string[]> = {
  green: [
    'Faite. Regarde-toi, tout responsable.',
    'Une de moins. Le tigre approuve.',
    'Cochée. Tu peux te la péter un peu.',
    'Bien joué. Ne t’habitue pas trop aux compliments.',
  ],
  blue: [
    'EPIC WIN. Projet bouclé. Champagne (avec modération).',
    'C’est fini. Tu as le droit de le dire à tout le monde.',
    'Des semaines de boulot, et c’est plié. Respect absolu.',
    'EPIC WIN. Encadre cette ligne, elle le mérite.',
  ],
  purple: [
    'Imprévu. Pour une fois, ce n’est pas ta faute.',
    'La vie a gagné cette manche. Revanche demain.',
    'Le destin s’en est mêlé. On te croit. Presque.',
  ],
  red: [
    'Abandonnée. Parfois, lâcher, c’est grandir.',
    'Rayée. Elle ne te manquera pas.',
    'Tu as dit non. Ça aussi, c’est de l’organisation.',
  ],
  black: [
    'EPIC FAIL. Légendaire. On en parlera encore dans dix ans.',
    'EPIC FAIL débloqué. Il fallait oser.',
    'Échec cuisant. Au moins, c’est spectaculaire.',
    'EPIC FAIL. Respire. Demain est une page neuve.',
  ],
};

function flemme(n: number) {
  if (n <= 1) return pick(['Flemme assumée. Demain, promis.', 'Pas aujourd’hui. On note. On ne juge pas. Enfin, un peu.', 'Reportée. Toi-de-demain va adorer ce cadeau.']);
  if (n === 2) return pick(['Deuxième report. Elle commence à te connaître.', 'Deux fois. La flemme devient une relation.']);
  if (n <= 4) return pick(['{n} reports. Elle a emménagé chez toi.', '{n} fois. Elle fait partie de la famille, maintenant.'], n);
  return pick(['{n} reports. Ce n’est plus de la flemme, c’est de l’art.', '{n} fois. On devrait l’encadrer.'], n);
}

/** La réplique quand une tâche reçoit sa couleur. `dayTasks` = la journée après le changement. */
export function roastFor(task: Task, pigment: Pigment, dayTasks: Task[]): string | null {
  if (pigment === 'white') return null;
  const judged = dayTasks.filter((t) => t.pigment !== 'white');
  const done = dayTasks.filter((t) => t.pigment === 'green' || t.pigment === 'blue');
  if (judged.length === dayTasks.length && dayTasks.length >= 3 && done.length === dayTasks.length) {
    return 'Tout est vert. Qui es-tu, et qu’as-tu fait de toi ?';
  }
  if (judged.length === dayTasks.length && dayTasks.length >= 3) return 'Journée bouclée. Va te reposer, tu l’as bien mérité.';
  if (pigment === 'yellow') return flemme(task.carryCount + 1);
  if (pigment === 'blue') return pick(LINES.blue);
  if (pigment === 'green' && task.carryCount >= 2) return pick(['Enfin ! Elle commençait à payer un loyer.', 'Après {n} reports. Miracle, on va prévenir ta mère.'], task.carryCount);
  if (pigment === 'green') return Math.random() < 0.35 ? pick(LINES.green) : null;
  return pick(LINES[pigment]);
}

/** La petite phrase sous la date du jour ouvert */
export function dayLine(tasks: Task[], day: DayKey, today: DayKey): string {
  const n = tasks.length;
  const c = (p: Pigment) => tasks.filter((t) => t.pigment === p).length;
  const done = c('green') + c('blue');
  const white = c('white');
  if (n === 0) {
    if (day < today) return 'Rien ce jour-là. Des vacances, on espère.';
    if (day > today) return 'Rien de prévu. Profite, ça ne durera pas.';
    return 'Page blanche. Ambitieux.';
  }
  if (c('blue') > 0) return c('black') > 0 ? 'Un EPIC WIN et un EPIC FAIL. Journée intense.' : 'EPIC WIN du jour. Encadre cette ligne.';
  if (c('black') > 0) return c('black') > 1 ? `${c('black')} EPIC FAIL. Journée historique.` : 'Un EPIC FAIL au compteur. Journée mémorable.';
  if (done === n) return 'Tout vert. Suspect, mais bravo.';
  if (c('yellow') >= 2) return 'La flemme est forte aujourd’hui.';
  if (day < today && white > 0) return 'Le verdict n’a jamais été rendu. Tu fuis ?';
  if (day > today) return n > 5 ? `${n} tâches prévues. Toi-de-demain va adorer.` : 'Toi-de-demain te remercie de prévenir.';
  if (white === n) return n > 6 ? `${n} tâches. Rien que ça.` : `${n} tâche${n > 1 ? 's' : ''}. Le soir dira la vérité.`;
  if (done / n >= 0.6) return `${done} sur ${n}. Pas mal du tout.`;
  return `${done} sur ${n}. La journée n’est pas finie.`;
}

/** Le verdict du bilan, d'après l'indice de flemme */
export function bilanVerdict(flemmeRate: number, epicFails: number, judged: number, epicWins = 0): string {
  if (judged < 10) return 'Pas encore assez de verdicts pour te roaster. Reviens dans quelques jours.';
  const f = flemmeRate * 100;
  const base =
    f < 10
      ? 'Indice de flemme exemplaire. Presque suspect.'
      : f < 25
        ? 'Une flemme raisonnable. Humaine, quoi.'
        : f < 45
          ? 'La flemme et toi, c’est sérieux.'
          : 'Tu n’as pas une flemme. Tu ES la flemme.';
  const fails = epicFails === 0 ? '' : epicFails === 1 ? ' Et un EPIC FAIL, pour le folklore.' : ` Et ${epicFails} EPIC FAIL. Une collection.`;
  const wins = epicWins === 0 ? '' : epicWins === 1 ? ' Mais un EPIC WIN : ça, personne ne te l’enlèvera.' : ` Mais ${epicWins} EPIC WIN : chapeau.`;
  return base + fails + wins;
}

/** Le grand message du jour ouvert : plus vite c'est fini, plus vite on est libre */
export function freedomLine(tasks: Task[], day: DayKey, today: DayKey): string {
  const n = tasks.length;
  const judged = tasks.filter((t) => t.pigment !== 'white').length;
  const left = n - judged;
  if (day > today) return n ? 'Pas encore là. Tu peux préparer le terrain.' : 'Une page vierge. Rien ne presse.';
  if (day < today) {
    if (!n) return 'Un jour sans rien. Repos bien mérité, on suppose.';
    if (left) return 'Ce jour attend toujours son verdict.';
    return tasks.some((t) => t.pigment === 'black') ? 'Un EPIC FAIL au compteur. On en rira plus tard.' : 'Journée close. Ce qui est fait est fait.';
  }
  if (!n) return 'Qu’est-ce qu’on accomplit aujourd’hui ?';
  const r = judged / n;
  if (r === 0) return 'Une journée neuve. Plus vite tu t’y mets, plus vite tu es libre.';
  if (r < 0.4) return 'C’est parti. TikTok peut attendre un peu.';
  if (r < 0.7) return 'À mi-chemin. Ton canapé commence à t’appeler.';
  if (left === 1) return 'Plus qu’une. La liberté est juste là.';
  if (left > 0) return `Encore ${left} et tu es libre.`;
  return 'Libre ! Va scroller, tu l’as mérité.';
}
