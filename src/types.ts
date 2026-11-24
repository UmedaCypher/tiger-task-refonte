export type TaskStatus = 'white' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'black';

export interface Task {
  id: string;
  userId: string;
  text: string;
  description?: string;
  status: TaskStatus;
  priority: number; // 1 to 10 subjective priority score
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  isPremium?: boolean;
  premiumPlan?: 'monthly' | 'yearly' | 'free' | null;
  isVerified?: boolean;
}

export interface StatsDistribution {
  total: number;
  todo: number;
  completed: number;
  postponedFlemme: number;
  postponedVolonte: number;
  failedGuilt: number;
  failedSad: number;
}

export interface Stats {
  distribution: StatsDistribution;
  flemmeIndex: number; // Percentage
  avgCompletedPriority: number;
  history7Days: {
    [date: string]: {
      done: number;
      postponed: number;
      failed: number;
    }
  };
}

export interface StatusConfig {
  value: TaskStatus;
  label: string;
  frenchDesc: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  glowClass: string;
  badgeClass: string;
}

export const STATUS_CONFIGS: Record<TaskStatus, StatusConfig> = {
  white: {
    value: 'white',
    label: 'À faire',
    frenchDesc: 'Tâche non faite / En attente',
    colorClass: 'text-slate-800 dark:text-slate-100',
    bgClass: 'bg-white/10 dark:bg-white/5 backdrop-blur-md',
    borderClass: 'border-white/30 dark:border-white/10',
    glowClass: 'shadow-[0_0_15px_rgba(255,255,255,0.1)]',
    badgeClass: 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30'
  },
  green: {
    value: 'green',
    label: 'Faite',
    frenchDesc: 'Tâche faite :-)',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/20 backdrop-blur-md',
    borderClass: 'border-emerald-500/40 dark:border-emerald-500/20',
    glowClass: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    badgeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
  },
  yellow: {
    value: 'yellow',
    label: 'Reportée (flemme)',
    frenchDesc: 'Reportée à demain par flemme',
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500/20 backdrop-blur-md',
    borderClass: 'border-amber-500/40 dark:border-amber-500/20',
    glowClass: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
    badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40'
  },
  red: {
    value: 'red',
    label: 'Flemme / Échouée',
    frenchDesc: 'Flemme ou échouée (culpabilité)',
    colorClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-500/20 backdrop-blur-md',
    borderClass: 'border-rose-500/40 dark:border-rose-500/20',
    glowClass: 'shadow-[0_0_20px_rgba(244,63,94,0.25)]',
    badgeClass: 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40'
  },
  blue: {
    value: 'blue',
    label: 'Récurrente finie',
    frenchDesc: 'Tâche récurrente enfin finie :-)',
    colorClass: 'text-sky-600 dark:text-sky-400',
    bgClass: 'bg-sky-500/20 backdrop-blur-md',
    borderClass: 'border-sky-500/40 dark:border-sky-500/20',
    glowClass: 'shadow-[0_0_20px_rgba(14,165,233,0.25)]',
    badgeClass: 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/40'
  },
  purple: {
    value: 'purple',
    label: 'Reportée (indépendant)',
    frenchDesc: 'Reportée indépendamment de ma volonté',
    colorClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'bg-violet-500/20 backdrop-blur-md',
    borderClass: 'border-violet-500/40 dark:border-violet-500/20',
    glowClass: 'shadow-[0_0_20px_rgba(139,92,246,0.25)]',
    badgeClass: 'bg-violet-500/20 text-violet-600 dark:text-violet-300 border-violet-500/40'
  },
  black: {
    value: 'black',
    label: 'Échec cuisant',
    frenchDesc: 'Échec cuisant et triste',
    colorClass: 'text-slate-800 dark:text-slate-200',
    bgClass: 'bg-slate-950/70 backdrop-blur-md',
    borderClass: 'border-slate-800/80 dark:border-slate-800/50',
    glowClass: 'shadow-[0_0_20px_rgba(15,23,42,0.4)]',
    badgeClass: 'bg-slate-900 text-slate-100 border-slate-700'
  }
};
