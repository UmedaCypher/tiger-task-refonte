/**
 * Les sept couleurs de la méthode Fibre Tigre.
 * Chaque tâche de la journée finit par recevoir une couleur : c'est le verdict du soir.
 */
export type Pigment = 'white' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'black';

export interface PigmentInfo {
  id: Pigment;
  /** Nom de la pigmentation, façon carnet de peintre */
  name: string;
  /** Sens dans la méthode */
  meaning: string;
  /** Vers court affiché au moment du choix */
  verse: string;
  color: string;
  /** Cette couleur fait renaître la tâche le lendemain */
  carries: boolean;
  /** Compte comme accomplie */
  done: boolean;
}

export const PIGMENTS: Record<Pigment, PigmentInfo> = {
  white: {
    id: 'white',
    name: 'Page blanche',
    meaning: 'À faire',
    verse: 'Rien n’est encore écrit.',
    color: '#efe6d2',
    carries: false,
    done: false,
  },
  green: {
    id: 'green',
    name: 'Jade',
    meaning: 'Faite',
    verse: 'La chose est faite. Elle ne reviendra pas.',
    color: '#4fae7e',
    carries: false,
    done: true,
  },
  yellow: {
    id: 'yellow',
    name: 'Safran',
    meaning: 'Reportée à demain, par flemme',
    verse: 'Demain la portera. Mais demain se souviendra.',
    color: '#e8b23a',
    carries: true,
    done: false,
  },
  red: {
    id: 'red',
    name: 'Vermillon',
    meaning: 'Pas faite, par flemme — avec culpabilité',
    verse: 'Le tigre a dormi. Il le sait.',
    color: '#d9483b',
    carries: false,
    done: false,
  },
  blue: {
    id: 'blue',
    name: 'Azur',
    meaning: 'Tâche qui traînait, enfin faite',
    verse: 'Longtemps fuie, enfin vaincue.',
    color: '#4c8fd6',
    carries: false,
    done: true,
  },
  purple: {
    id: 'purple',
    name: 'Améthyste',
    meaning: 'Reportée, indépendamment de ma volonté',
    verse: 'Le vent a tourné. Ce n’est pas ta faute.',
    color: '#9a6bd6',
    carries: true,
    done: false,
  },
  black: {
    id: 'black',
    name: 'Encre',
    meaning: 'Échec cuisant et triste',
    verse: 'Certaines nuits n’ont pas d’étoiles.',
    color: '#2a2433',
    carries: false,
    done: false,
  },
};

export const PIGMENT_ORDER: Pigment[] = ['green', 'blue', 'yellow', 'purple', 'red', 'black', 'white'];
