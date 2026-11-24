import { useEffect, useState } from 'react';
import { PIGMENT_ORDER, PIGMENTS } from '../lib/pigments';
import { deleteTask, editTask, setPigment, useStore } from '../lib/store';

/** La palette du verdict : choisir la couleur d'une tâche, la renommer, l'effacer. */
export function PigmentSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useStore((s) => s.tasks[taskId], [taskId]);
  const [text, setText] = useState(task?.text ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!task) return null;

  const close = () => {
    editTask(task.id, text);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet" role="dialog" aria-label="Choisir la couleur" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <input
          className="sheet-title"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && close()}
          aria-label="Intitulé de la tâche"
        />
        {task.carryCount > 0 && (
          <p className="sheet-note">Reportée {task.carryCount} fois. Si tu la finis, elle méritera l’azur.</p>
        )}
        <div className="palette">
          {PIGMENT_ORDER.map((p) => {
            const info = PIGMENTS[p];
            const active = task.pigment === p;
            return (
              <button
                key={p}
                className={`swatch ${active ? 'is-active' : ''}`}
                style={{ ['--c' as string]: info.color }}
                onClick={() => {
                  setPigment(task.id, p);
                  editTask(task.id, text);
                  onClose();
                }}
              >
                <span className={`seal seal-${p}`} />
                <span className="swatch-text">
                  <strong>{info.name}</strong>
                  <span>{info.meaning}</span>
                  {active && <em>{info.verse}</em>}
                </span>
                {info.carries && <span className="swatch-tag">↷ demain</span>}
              </button>
            );
          })}
        </div>
        <button
          className="ghost danger"
          onClick={() => {
            deleteTask(task.id);
            onClose();
          }}
        >
          Effacer cette tâche du carnet
        </button>
      </div>
    </div>
  );
}
