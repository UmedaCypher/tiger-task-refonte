import { dayOfYear, type DayKey } from './date';

/** Une ligne par jour, pour ouvrir la page du carnet. */
const VERSES = [
  'Le tigre ne compte pas ses pas. Il compte ses proies.',
  'Une journée est une page. Écris-la avant qu’elle ne s’écrive seule.',
  'Ce que tu reportes ce soir, tu le porteras demain.',
  'La couleur ne ment pas. C’est toute sa cruauté, et toute sa douceur.',
  'Une tâche faite pèse moins qu’une tâche pensée.',
  'Le matin promet, le soir juge.',
  'Les grandes années sont faites de petits jours bien tenus.',
  'Avance d’une case. Puis d’une autre. La tapisserie viendra.',
  'Même le safran a sa place dans la toile.',
  'On n’apprivoise pas le temps. On apprend à marcher à ses côtés.',
  'Commence par la tâche qui te fait peur ; les autres suivront.',
  'Le vermillon d’hier n’interdit pas le jade d’aujourd’hui.',
  'Le tigre dort aussi. Mais il sait quand il dort.',
  'Une liste n’est pas une prison. C’est une carte.',
  'Chaque soir, rends ton verdict. Sans colère, sans mensonge.',
  'Ce qui traîne finit par devenir azur, si l’on s’y tient.',
  'L’encre noire sèche, elle aussi. Demain est une page neuve.',
  'Il n’y a pas de petite tâche, il n’y a que des tâches faites.',
  'Regarde ta tapisserie : c’est toi, tissé jour après jour.',
  'L’année ne se gagne pas en janvier. Elle se gagne chaque mardi.',
  'Le courage tient souvent en une ligne.',
  'Pose la tâche sur le papier, et elle cessera de te poursuivre.',
  'Le vent emporte parfois tes plans. L’améthyste est là pour ça.',
  'Rugir n’est pas utile. Finir l’est.',
];

export function verseOf(day: DayKey): string {
  return VERSES[(dayOfYear(day) * 7 + Number(day.slice(0, 4))) % VERSES.length];
}
