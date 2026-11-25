/**
 * Les sept couleurs de la méthode Fibre Tigre — le verdict de chaque tâche.
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
  white: { id: 'white', name: 'À faire', meaning: 'Pas encore de verdict', color: '#ffffff', fill: 'transparent', ink: '#1c1c1e', carries: false, done: false },
  green: { id: 'green', name: 'Faite', meaning: 'Faite', color: '#21a366', fill: '#dcf3e6', ink: '#11603a', carries: false, done: true },
  blue: { id: 'blue', name: 'Enfin faite', meaning: 'Traînait depuis un moment, enfin faite', color: '#3b82f6', fill: '#dde9fd', ink: '#1d4a8f', carries: false, done: true },
  yellow: { id: 'yellow', name: 'Reportée', meaning: 'Reportée à demain, par flemme', color: '#f2b705', fill: '#fdf2c9', ink: '#6e5000', carries: true, done: false },
  purple: { id: 'purple', name: 'Imprévu', meaning: 'Reportée, indépendamment de ma volonté', color: '#8b5cf6', fill: '#ece4fd', ink: '#55349a', carries: true, done: false },
  red: { id: 'red', name: 'Pas faite', meaning: 'Pas faite, par flemme', color: '#e5483b', fill: '#fbe0dd', ink: '#962015', carries: false, done: false },
  black: { id: 'black', name: 'Échec', meaning: 'Échec cuisant', color: '#1c1c1e', fill: '#1c1c1e', ink: '#f5f5f7', carries: false, done: false },
};

export const PIGMENT_ORDER: Pigment[] = ['green', 'blue', 'yellow', 'purple', 'red', 'black', 'white'];
