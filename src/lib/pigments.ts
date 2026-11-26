/**
 * Les sept couleurs du verdict du soir. Sans se prendre au sérieux :
 * jaune = la flemme assumée, rouge = on abandonne, noir = l'EPIC FAIL.
 * fill/ink : remplissage de cellule façon tableur (teinte douce + texte lisible).
 */
export type Pigment = 'white' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'black';

export interface PigmentInfo {
  id: Pigment;
  name: string;
  meaning: string;
  /** couleur pleine (pastille, légende) */
  color: string;
  /** remplissage de cellule */
  fill: string;
  /** texte sur le remplissage */
  ink: string;
  /** fait renaître la tâche le lendemain */
  carries: boolean;
  done: boolean;
}

export const PIGMENTS: Record<Pigment, PigmentInfo> = {
  white: { id: 'white', name: 'À faire', meaning: 'Pas encore jugée. Elle attend ton verdict', color: '#ffffff', fill: 'transparent', ink: '#1c1c1e', carries: false, done: false },
  green: { id: 'green', name: 'Faite', meaning: 'C’est fait. Bravo, champion', color: '#21a366', fill: '#dcf3e6', ink: '#11603a', carries: false, done: true },
  blue: { id: 'blue', name: 'Enfin !', meaning: 'Elle traînait depuis des jours. Miracle', color: '#3b82f6', fill: '#dde9fd', ink: '#1d4a8f', carries: false, done: true },
  yellow: { id: 'yellow', name: 'Flemme', meaning: 'Pas envie. Demain, promis. Feignasse assumée', color: '#f2b705', fill: '#fdf2c9', ink: '#6e5000', carries: true, done: false },
  purple: { id: 'purple', name: 'Imprévu', meaning: 'Reportée, et pour une fois ce n’est pas ta faute', color: '#8b5cf6', fill: '#ece4fd', ink: '#55349a', carries: true, done: false },
  red: { id: 'red', name: 'Abandonnée', meaning: 'Plus besoin, ou plus envie. On lâche, sans regret', color: '#e5483b', fill: '#fbe0dd', ink: '#962015', carries: false, done: false },
  black: { id: 'black', name: 'EPIC FAIL', meaning: 'Un échec cuisant. Légendaire. On en rira plus tard', color: '#1c1c1e', fill: '#1c1c1e', ink: '#f5f5f7', carries: false, done: false },
};

export const PIGMENT_ORDER: Pigment[] = ['green', 'blue', 'yellow', 'purple', 'red', 'black', 'white'];
