import { useEffect, useMemo, useRef, useState } from 'react';
import { todayKey } from '../lib/date';
import { reducedMotion } from '../lib/fx';
import { tigerLine } from '../lib/roast';
import { useStore, type Task } from '../lib/store';
import { byDay } from '../lib/stats';
import type { Mood, World } from './world';

const NONE: Task[] = [];

/** Le décor low poly derrière le mode Aube ; il suit l'avancée d'aujourd'hui */
export function Scene({ night }: { night: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const [ready, setReady] = useState(false);
  const today = todayKey();
  const all = useStore((s) => s.tasks);
  const tasks = useMemo(() => byDay({ tasks: all } as never).get(today) ?? NONE, [all, today]);
  const n = tasks.length;
  const judged = tasks.filter((t) => t.pigment !== 'white').length;
  const progress = n ? judged / n : 0;
  const mood: Mood = n && judged === n ? 'free' : progress >= 0.3 ? 'awake' : 'sleep';

  useEffect(() => {
    let dead = false;
    let w: World | null = null;
    // le décor arrive après la liste : la page reste instantanée
    const id = setTimeout(() => {
      import('./world')
        .then(({ createWorld }) => {
          if (dead || !canvas.current) return;
          w = createWorld(canvas.current, { reduced: reducedMotion() });
          world.current = w;
          w.onBubble((x, y) => {
            const b = bubble.current;
            if (b) b.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
          });
          setReady(true);
        })
        .catch(() => {});
    }, 60);
    return () => {
      dead = true;
      clearTimeout(id);
      w?.dispose();
      world.current = null;
    };
  }, []);

  useEffect(() => {
    world.current?.setState({ progress, mood, night });
  }, [progress, mood, night, ready]);

  const prevJudged = useRef(judged);
  useEffect(() => {
    if (judged > prevJudged.current) world.current?.perk();
    prevJudged.current = judged;
  }, [judged]);

  return (
    <div className={`scene ${ready ? 'is-ready' : ''}`} aria-hidden="true">
      <div className="sky sky-dawn" />
      <div className="sky sky-gold" style={{ opacity: night ? 0 : progress }} />
      <div className="sky-sun" style={{ transform: `translateY(${Math.round((1 - progress) * 22)}vh)` }} />
      <canvas ref={canvas} className="scene-canvas" />
      <div className="scene-veil" />
      <div className="tiger-bubble-anchor" ref={bubble}>
        <div className="tiger-bubble" key={tigerLine(tasks)}>
          {tigerLine(tasks)}
        </div>
      </div>
    </div>
  );
}
