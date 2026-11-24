import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus, STATUS_CONFIGS } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Clock, Check } from 'lucide-react';

interface TaskCardProps {
  key?: string;
  task: Task;
  isCompact?: boolean;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPostpone: (id: string, reason: 'flemme' | 'volonte') => Promise<void>;
  onClick?: () => void;
}

export default function TaskCard({ 
  task, 
  isCompact = false, 
  onUpdate, 
  onDelete, 
  onPostpone,
  onClick 
}: TaskCardProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0 });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside or scrolling
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    function handleScroll() {
      setIsDropdownOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleStatusCircleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent triggering card details modal
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Position dropdown below the circle button
    setDropdownCoords({
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 260) // Prevent overflow on right screen edge
    });
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handlePostponeClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent triggering card details modal
    await onPostpone(task.id, 'flemme');
  };

  const config = STATUS_CONFIGS[task.status] || STATUS_CONFIGS.white;

  return (
    <>
      <motion.div 
        layout
        id={`task-card-${task.id}`}
        onClick={() => {
          if (onClick) onClick();
        }}
        className={`rounded-xl border transition-all flex items-center justify-between gap-2.5 group relative hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
          config.bgClass
        } ${
          config.borderClass
        } ${
          config.glowClass
        } ${
          isCompact 
            ? 'p-1.5 px-2.5 text-[11px] w-48 shrink-0 h-9' 
            : 'p-2.5 px-3.5 text-xs w-60 shrink-0 h-11'
        }`}
      >
        <div className="flex items-center gap-2 w-full min-w-0">
          
          {/* Status indicator button */}
          <div className="shrink-0" ref={dropdownRef}>
            <button
              onClick={handleStatusCircleClick}
              className={`rounded-full border-2 transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
                isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'
              } ${
                task.status === 'white' ? 'border-slate-400 bg-transparent' : 
                task.status === 'green' ? 'border-emerald-500 bg-emerald-500' :
                task.status === 'yellow' ? 'border-amber-400 bg-amber-400' :
                task.status === 'red' ? 'border-rose-500 bg-rose-500' :
                task.status === 'blue' ? 'border-sky-500 bg-sky-500' :
                task.status === 'purple' ? 'border-violet-500 bg-violet-500' :
                'border-slate-800 bg-slate-900'
              }`}
              title="Changer le statut"
              id={`status-btn-${task.id}`}
            />
          </div>

          {/* Priority Badge */}
          <div 
            className={`px-1 py-0.2 font-mono font-bold rounded bg-slate-950/40 text-slate-300 border border-white/10 shrink-0 text-[9px]`}
            id={`priority-badge-${task.id}`}
          >
            <span className="text-[8px] text-slate-500">P</span>{task.priority}
          </div>

          {/* Task Text (truncated) */}
          <div className="min-w-0 flex-1">
            <span 
              className={`block truncate font-medium select-none ${
                isCompact ? 'text-[11px]' : 'text-xs'
              } ${
                task.status === 'green' || task.status === 'blue'
                  ? 'line-through text-slate-500 opacity-60' 
                  : 'text-slate-100'
              }`}
              id={`task-text-label-${task.id}`}
              title={task.text}
            >
              {task.text}
            </span>
          </div>
        </div>

        {/* Action controls (delete/postpone) - Hidden on compact rows unless hovered, shown nicely */}
        <div 
          className={`flex items-center gap-1 shrink-0 transition-opacity ${
            isCompact ? 'md:opacity-0 md:group-hover:opacity-100' : 'opacity-100'
          }`} 
          id={`task-actions-${task.id}`}
        >
          {/* Postponement button */}
          {task.status === 'white' && (
            <div className="shrink-0">
              <button
                onClick={handlePostponeClick}
                className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-all border border-transparent hover:border-amber-500/10 active:scale-95 cursor-pointer"
                title="Reporter cette tâche à demain"
                id={`postpone-trigger-${task.id}`}
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Avoid opening details modal
              onDelete(task.id);
            }}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/10 active:scale-95 cursor-pointer"
            title="Supprimer la tâche"
            id={`delete-btn-${task.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Floating Status Selector Menu (Using fixed layout to escape scroll clipping) */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="fixed z-[9999] w-60 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl p-1.5 backdrop-blur-md"
            style={{
              top: `${dropdownCoords.top}px`,
              left: `${dropdownCoords.left}px`,
            }}
            id={`status-dropdown-${task.id}`}
          >
            <div className="px-2.5 py-1.5 border-b border-white/5 mb-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Statuts d'organisation
            </div>
            {Object.values(STATUS_CONFIGS).map((item) => (
              <button
                key={item.value}
                onClick={async (e) => {
                  e.stopPropagation();
                  await onUpdate(task.id, { status: item.value });
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between text-left p-1.5 rounded-lg hover:bg-white/10 transition-colors group cursor-pointer"
                id={`status-option-${task.id}-${item.value}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${
                    item.value === 'white' ? 'border border-slate-400' : 
                    item.value === 'green' ? 'bg-emerald-500' :
                    item.value === 'yellow' ? 'bg-amber-400' :
                    item.value === 'red' ? 'bg-rose-500' :
                    item.value === 'blue' ? 'bg-sky-500' :
                    item.value === 'purple' ? 'bg-violet-500' :
                    'bg-slate-900 border border-slate-700'
                  }`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white leading-none">{item.label}</div>
                    <div className="text-[9px] text-slate-400 truncate mt-0.5">{item.frenchDesc}</div>
                  </div>
                </div>
                {task.status === item.value && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
