import * as THREE from 'three';
import { buildHead, type Mood } from './world';

/**
 * La mascotte : la tête du tigre en 3D, dans l'interface (fond transparent),
 * qui suit la souris du regard, comme le renard d'un portefeuille crypto bien connu.
 */
export function createMascot(canvas: HTMLCanvasElement, opts: { reduced: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 0.15, 6.2);
  camera.lookAt(0, 0.05, 0);

  scene.add(new THREE.HemisphereLight('#fff4ea', '#c9a48c', 1.6));
  const key = new THREE.DirectionalLight('#ffe8cf', 2.6);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#cfe0ff', 1.1);
  rim.position.set(4, 2, -3);
  scene.add(rim);

  const T = buildHead();
  T.root.position.set(0, -1.18, -0.3);
  scene.add(T.root);

  let mood: Mood = 'sleep';
  let perk = 0;
  const look = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    look.x = THREE.MathUtils.clamp((e.clientX - cx) / (innerWidth * 0.45), -1, 1);
    look.y = THREE.MathUtils.clamp((e.clientY - cy) / (innerHeight * 0.45), -1, 1);
  };
  addEventListener('pointermove', onPointer, { passive: true });

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const clock = new THREE.Clock();
  let raf = 0;
  const frame = () => {
    const dt = opts.reduced ? 1 : Math.min(clock.getDelta(), 0.05);
    const t = opts.reduced ? 0 : clock.elapsedTime;
    perk = Math.max(0, perk - dt * 1.3);
    const k = opts.reduced ? 1 : 1 - Math.exp(-dt * 4);
    look.sx += (look.x - look.sx) * k;
    look.sy += (look.y - look.sy) * k;
    T.pose({ mood, t, dt, look: look.sx, lookUp: look.sy, perk, still: opts.reduced, pitch: 0.05 });
    renderer.render(scene, camera);
  };
  let running = false;
  const loop = () => {
    frame();
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || opts.reduced) return;
    running = true;
    clock.getDelta();
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  start();
  if (opts.reduced) frame();

  return {
    setMood(m: Mood) {
      mood = m;
      if (opts.reduced) frame();
    },
    perk() {
      perk = 1;
    },
    dispose() {
      stop();
      ro.disconnect();
      removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVis);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mt = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose());
      });
      renderer.dispose();
    },
  };
}
export type Mascot = ReturnType<typeof createMascot>;
