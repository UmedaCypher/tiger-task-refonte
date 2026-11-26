import { useEffect, useMemo, useRef, useState } from 'react';
import { todayKey } from '../lib/date';
import { reducedMotion } from '../lib/fx';
import { tigerLine } from '../lib/roast';
import { useStore, type Task } from '../lib/store';
import { byDay } from '../lib/stats';
import type { Biome, Mood, World } from './world';
import type { Mascot as MascotApi } from './mascot';

const NONE: Task[] = [];
/** Le décor choisi : ?biome=… dans l'adresse, sinon le dernier choix enregistré */
function currentBiome() {
  const q = new URLSearchParams(location.search).get('biome');
  if (q) localStorage.setItem('tt:biome', q);
  return (q ?? localStorage.getItem('tt:biome') ?? 'lac') as Biome;
}

/** L'avancée d'aujourd'hui, partagée par le décor et la mascotte */
function useToday() {
  const today = todayKey();
  const all = useStore((s) => s.tasks);
  const tasks = useMemo(() => byDay({ tasks: all } as never).get(today) ?? NONE, [all, today]);
  const n = tasks.length;
  const judged = tasks.filter((t) => t.pigment !== 'white').length;
  const progress = n ? judged / n : 0;
  const mood: Mood = n && judged === n ? 'free' : progress >= 0.3 ? 'awake' : 'sleep';
  return { tasks, judged, progress, mood };
}

/** Le décor low poly derrière le mode Aube ; le ciel suit l'avancée d'aujourd'hui */
export function Scene({ night }: { night: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const [ready, setReady] = useState(false);
  const { progress, mood } = useToday();

  useEffect(() => {
    let dead = false;
    let w: World | null = null;
    const id = setTimeout(() => {
      import('./world')
        .then(({ createWorld }) => {
          if (dead || !canvas.current) return;
          w = createWorld(canvas.current, { reduced: reducedMotion(), biome: currentBiome() });
          world.current = w;
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

  return (
    <div className={`scene ${ready ? 'is-ready' : ''}`} aria-hidden="true">
      <div className="sky sky-dawn" />
      <div className="sky sky-gold" style={{ opacity: night ? 0 : progress }} />
      <canvas ref={canvas} className="scene-canvas" />
      <div className="scene-veil" />
    </div>
  );
}

/** La mascotte : la tête du tigre en 3D à côté de ta liste, avec sa bulle */
export function Mascot() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = useRef<MascotApi | null>(null);
  const [ready, setReady] = useState(false);
  const { tasks, judged, mood } = useToday();
  const line = tigerLine(tasks);

  useEffect(() => {
    let dead = false;
    let m: MascotApi | null = null;
    import('./mascot')
      .then(({ createMascot }) => {
        if (dead || !canvas.current) return;
        m = createMascot(canvas.current, { reduced: reducedMotion() });
        api.current = m;
        setReady(true);
      })
      .catch(() => {});
    return () => {
      dead = true;
      m?.dispose();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.setMood(mood);
  }, [mood, ready]);

  const prev = useRef(judged);
  useEffect(() => {
    if (judged > prev.current) api.current?.perk();
    prev.current = judged;
  }, [judged]);

  return (
    <aside className={`mascot ${ready ? 'is-ready' : ''}`} aria-label="Le tigre">
      <canvas ref={canvas} className="mascot-canvas" aria-hidden="true" />
      <p className="mascot-bubble" key={line} role="status">
        {line}
      </p>
    </aside>
  );
}
