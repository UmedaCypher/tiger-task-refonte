import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PIGMENT_ORDER, PIGMENTS } from '../lib/pigments';
import { trackDaily } from '../lib/growth';
import { roastFor, say } from '../lib/roast';
import { deleteTask, editTask, getState, setPigment, tasksOf, useStore } from '../lib/store';

/** Menu d'une cellule : renommer, donner sa couleur, effacer. Popover sur ordinateur, feuille sur mobile. */
export function CellMenu({ taskId, anchor, onClose }: { taskId: string; anchor: DOMRect; onClose: () => void }) {
  const task = useStore((s) => s.tasks[taskId], [taskId]);
  const [text, setText] = useState(task?.text ?? '');
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const mobile = window.innerWidth < 640;

  useLayoutEffect(() => {
    if (mobile || !ref.current) return;
    const h = ref.current.offsetHeight;
    const w = ref.current.offsetWidth;
    let top = anchor.bottom + 6;
    if (top + h > window.innerHeight - 12) top = Math.max(12, anchor.top - h - 6);
    const left = Math.min(Math.max(12, anchor.left), window.innerWidth - w - 12);
    setPos({ top, left });
  }, [anchor, mobile]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const s = () => !mobile && close();
    window.addEventListener('keydown', k);
    window.addEventListener('scroll', s, { passive: true });
    return () => {
      window.removeEventListener('keydown', k);
      window.removeEventListener('scroll', s);
    };
  });

  if (!task) return null;
  function close() {
    editTask(taskId, text);
    onClose();
  }

  return (
    <div className={`menu-layer ${mobile ? 'is-sheet' : ''}`} onMouseDown={close}>
      <div
        ref={ref}
        className="menu glass"
        role="dialog"
        aria-label="Couleur de la tâche"
        style={mobile ? undefined : { top: pos?.top ?? anchor.bottom + 6, left: pos?.left ?? anchor.left, visibility: pos ? 'visible' : 'hidden' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          className="menu-title"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && close()}
          aria-label="Intitulé"
        />
        {task.carryCount > 0 && <p className="menu-note">Reportée {task.carryCount} fois</p>}
        <ul className="swatches">
          {PIGMENT_ORDER.map((p) => {
            const info = PIGMENTS[p];
            return (
              <li key={p}>
                <button
                  className={`swatch ${task.pigment === p ? 'is-active' : ''}`}
                  onClick={() => {
                    editTask(taskId, text);
                    setPigment(taskId, p);
                    if (p !== 'white') trackDaily('day_colored');
                    const st = getState();
                    if (task.pigment !== p) say(roastFor(task, p, tasksOf(st, task.date)));
                    onClose();
                  }}
                >
                  <span className={`swatch-chip is-${p}`} style={{ background: p === 'white' ? 'transparent' : info.color }} />
                  <span className="swatch-name">{info.name}</span>
                  <span className="swatch-meaning">{info.meaning}</span>
                  {info.carries && <span className="swatch-tag">→ demain</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          className="menu-delete"
          onClick={() => {
            deleteTask(taskId);
            onClose();
          }}
        >
          Supprimer la tâche
        </button>
      </div>
    </div>
  );
}
