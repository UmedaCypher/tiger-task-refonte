import React from 'react';
import { Task } from '../types';
import TaskCard from './TaskCard';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Lock } from 'lucide-react';

interface DayBlockProps {
  key?: string;
  dateStr: string; // YYYY-MM-DD
  tasks: Task[];
  isHighlighted: boolean;
  onAddTaskClick: (date: string) => void;
  onTaskClick: (task: Task) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onPostponeTask: (id: string, reason: 'flemme' | 'volonte') => Promise<void>;
  onSelectDay: (date: string) => void;
  isLocked?: boolean;
}

export default function DayBlock({ 
  dateStr, 
  tasks, 
  isHighlighted,
  onAddTaskClick,
  onTaskClick,
  onUpdateTask, 
  onDeleteTask, 
  onPostponeTask,
  onSelectDay,
  isLocked = false
}: DayBlockProps) {
  const dateObj = new Date(dateStr);
  
  const frenchDayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' });
  const capitalizedDayName = frenchDayName.charAt(0).toUpperCase() + frenchDayName.slice(1);
  const frenchDateFormatted = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const isToday = new Date().toISOString().split("T")[0] === dateStr;
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6; // Sunday or Saturday

  return (
    <motion.div 
      layout="position"
      id={`day-block-${dateStr}`}
      onClick={() => {
        if (!isLocked) {
          onSelectDay(dateStr);
        }
      }}
      className={`glass-panel rounded-xl relative overflow-hidden flex flex-row items-center justify-between transition-all duration-300 ${
        isLocked
          ? 'p-1.5 px-4 border-slate-900 bg-slate-950/20 opacity-40 cursor-not-allowed select-none'
          : isHighlighted 
            ? 'p-4 px-6 border-violet-500/50 bg-slate-900/60 shadow-[0_0_25px_rgba(139,92,246,0.12)] min-h-[96px] my-1 cursor-pointer' 
            : 'p-1.5 px-4 border-white/5 bg-slate-950/20 min-h-[50px] opacity-75 hover:opacity-100 hover:bg-white/[0.02] cursor-pointer'
      }`}
    >
      {/* Visual left colored accent for Today or Weekend */}
      {isToday && !isLocked && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-violet-500 to-indigo-500" />
      )}
      {!isToday && isWeekend && !isLocked && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-500/40" />
      )}

      {/* LEFT COLUMN: Date indicator square (Extremely clean, no redundant day name) */}
      <div className="flex items-center shrink-0 w-12 md:w-14" id={`day-left-${dateStr}`}>
        <div className={`rounded-xl flex flex-col items-center justify-center shrink-0 border text-center transition-all duration-300 ${
          isLocked
            ? 'w-8.5 h-8.5 bg-slate-950/80 border-slate-900 text-slate-600'
            : isToday
              ? 'w-10 h-10 bg-violet-500/25 border-violet-500 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.3)] scale-105 font-bold'
              : isWeekend
                ? 'w-9 h-9 bg-amber-500/10 border-amber-500/30 text-amber-300'
                : isHighlighted
                  ? 'w-9 h-9 bg-white/15 border-white/25 text-white scale-105'
                  : 'w-8.5 h-8.5 bg-white/5 border-white/5 text-slate-400'
        }`}>
          <span className={`uppercase tracking-wider font-mono font-bold leading-none text-[7px]`}>
            {dateObj.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').slice(0, 3)}
          </span>
          <span className={`font-bold leading-none font-mono mt-0.5 ${
            isToday && !isLocked ? 'text-sm' : 'text-xs'
          }`}>
            {dateObj.getDate()}
          </span>
        </div>
      </div>

      {/* MIDDLE COLUMN: Horizontal or wrapped list of tasks */}
      <div 
        className={`flex-1 min-w-0 py-1 px-2 select-none`} 
        id={`day-middle-${dateStr}`}
      >
        {isLocked ? (
          <div className="text-slate-600 text-[11px] italic font-mono flex items-center h-8 gap-1.5">
            <Lock className="w-3 h-3 text-slate-700" />
            <span>Semaine bloquée (Offre Gratuite)</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-slate-600 text-[11px] italic font-mono select-none flex items-center h-8">
            <span>Aucune tâche</span>
          </div>
        ) : (
          <div 
            className={`flex items-center gap-2 ${
              isHighlighted 
                ? 'flex-wrap py-1.5' 
                : 'flex-nowrap overflow-x-auto overflow-y-hidden scrollbar-none'
            }`}
          >
            <AnimatePresence mode="popLayout">
              {tasks.map((task) => (
                <TaskCard 
                  key={task.id}
                  task={task}
                  isCompact={!isHighlighted}
                  onUpdate={onUpdateTask}
                  onDelete={onDeleteTask}
                  onPostpone={onPostponeTask}
                  onClick={() => onTaskClick(task)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Ultra compact + Task button */}
      <div className="w-12 md:w-16 shrink-0 flex items-center justify-end" id={`day-right-${dateStr}`}>
        {isLocked ? (
          <div 
            className="rounded-lg bg-slate-900/80 border border-slate-900 text-slate-700 flex items-center justify-center w-6 h-6 shrink-0"
            title="Cette date est hors de la semaine en cours (Offre Gratuite). Passez à la formule Premium !"
          >
            <Lock className="w-3 h-3" />
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddTaskClick(dateStr);
            }}
            className={`rounded-lg bg-white/5 border border-white/10 hover:border-violet-500/30 hover:bg-violet-600/20 text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer ${
              isHighlighted 
                ? 'w-8 h-8 scale-100' 
                : 'w-6 h-6 scale-90 opacity-60 hover:opacity-100'
            }`}
            title="Ajouter une tâche pour ce jour"
            id={`add-task-modal-btn-${dateStr}`}
          >
            <Plus className={isHighlighted ? "w-4 h-4" : "w-3.5 h-3.5"} />
          </button>
        )}
      </div>

    </motion.div>
  );
}
