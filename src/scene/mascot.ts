import * as THREE from 'three';
import type { Mood } from './world';

/**
 * La mascotte : une tête de tigre minimaliste, quelques grandes facettes plates (comme un logo en origami),
 * en 3D dans l'interface, qui suit la souris du regard.
 */

type V = [number, number, number];
// côté droit du visage (x ≥ 0) ; le côté gauche est son miroir. Le tigre regarde vers +z.
const P: Record<string, V> = {
  top: [0, 0.98, 0.3],
  brow: [0, 0.42, 0.66],
  bridge: [0, 0.02, 0.86],
  noseT: [0, -0.2, 1.02],
  mouth: [0, -0.42, 0.9],
  chin: [0, -0.64, 0.6],
  back: [0, 0.7, -0.62],
  backLow: [0, -0.5, -0.45],
  crown: [0.46, 0.96, 0.22],
  earTip: [0.92, 1.36, -0.02],
  earOut: [1.0, 0.74, -0.08],
  temple: [1.02, 0.32, 0.04],
  browOut: [0.56, 0.44, 0.5],
  eyeIn: [0.19, 0.2, 0.74],
  eyeOut: [0.53, 0.24, 0.6],
  cheek: [0.78, -0.02, 0.44],
  ruff: [1.26, -0.28, -0.02],
  ruffLow: [1.04, -0.6, 0.02],
  muzzle: [0.34, -0.26, 0.86],
  noseS: [0.15, -0.19, 0.97],
  lip: [0.27, -0.5, 0.74],
  jaw: [0.46, -0.68, 0.34],
  backSide: [0.84, 0.2, -0.6],
  backLowSide: [0.62, -0.58, -0.4],
};
const ORANGE = '#ec8a2f';
const LIGHT = '#f39b3e';
const DARK = '#d9711f';
const SHADE = '#c46018';
const WHITE = '#f7f2ea';
const CREAM = '#e4d8ca';
const STRIPE = '#241915';
const EAR = '#2e211b';

// les grandes facettes : [a, b, c, couleur] (côté droit, recopié en miroir)
const FACES: [string, string, string, string][] = [
  ['top', 'crown', 'brow', LIGHT],
  ['crown', 'browOut', 'brow', ORANGE],
  ['brow', 'browOut', 'eyeIn', WHITE], // le masque blanc au-dessus de l'œil
  ['brow', 'eyeIn', 'bridge', LIGHT],
  ['crown', 'earOut', 'browOut', DARK],
  ['earOut', 'temple', 'browOut', ORANGE],
  ['browOut', 'eyeOut', 'eyeIn', WHITE],
  ['browOut', 'temple', 'cheek', ORANGE],
  ['browOut', 'cheek', 'eyeOut', WHITE], // le blanc sous l'œil, vers la joue
  ['eyeOut', 'cheek', 'muzzle', WHITE],
  ['eyeIn', 'eyeOut', 'muzzle', ORANGE],
  ['eyeIn', 'muzzle', 'noseS', DARK],
  ['eyeIn', 'noseS', 'bridge', ORANGE],
  ['bridge', 'noseS', 'noseT', LIGHT],
  ['temple', 'ruff', 'cheek', ORANGE],
  ['cheek', 'ruff', 'muzzle', WHITE],
  ['ruff', 'ruffLow', 'muzzle', CREAM],
  ['muzzle', 'ruffLow', 'lip', WHITE],
  ['ruffLow', 'jaw', 'lip', CREAM],
  ['noseS', 'muzzle', 'lip', WHITE],
  ['noseS', 'lip', 'mouth', WHITE],
  ['mouth', 'lip', 'chin', WHITE],
  ['lip', 'jaw', 'chin', CREAM],
  // arrière et côtés
  ['crown', 'top', 'back', DARK],
  ['crown', 'back', 'backSide', SHADE],
  ['crown', 'backSide', 'earOut', SHADE],
  ['earOut', 'backSide', 'temple', SHADE],
  ['temple', 'backSide', 'ruff', SHADE],
  ['ruff', 'backSide', 'backLowSide', CREAM],
  ['ruff', 'backLowSide', 'ruffLow', CREAM],
  ['ruffLow', 'backLowSide', 'jaw', CREAM],
  ['jaw', 'backLowSide', 'backLow', CREAM],
  ['jaw', 'backLow', 'chin', CREAM],
  ['back', 'backLow', 'backLowSide', SHADE],
  ['back', 'backLowSide', 'backSide', SHADE],
];
// la collerette : des mèches blanches en pointes qui débordent des joues
const TUFTS: [V, V, V, string][] = [
  [[1.0, 0.2, 0.06], [1.32, 0.04, -0.04], [1.08, -0.06, 0.04], CREAM],
  [[1.08, -0.04, 0.04], [1.38, -0.24, -0.06], [1.16, -0.32, 0.02], WHITE],
  [[1.14, -0.28, 0.02], [1.36, -0.52, -0.06], [1.06, -0.54, 0.04], CREAM],
  [[1.06, -0.5, 0.04], [1.18, -0.76, -0.02], [0.88, -0.64, 0.14], WHITE],
  [[0.86, -0.6, 0.18], [0.74, -0.84, 0.16], [0.56, -0.66, 0.3], CREAM],
]
// rayures : bandes sombres qui encadrent le regard et barrent le front
const STRIPES: [V, V, V][] = [
  // front : barres arquées
  [[0.04, 0.84, 0.42], [0.36, 0.9, 0.3], [0.1, 0.76, 0.48]],
  [[0.06, 0.66, 0.55], [0.4, 0.74, 0.45], [0.14, 0.6, 0.58]],
  // au-dessus de l'œil, vers la tempe
  [[0.5, 0.52, 0.5], [0.94, 0.6, 0.12], [0.56, 0.45, 0.52]],
  // du coin de l'œil vers la joue
  [[0.56, 0.24, 0.6], [0.92, 0.18, 0.34], [0.62, 0.12, 0.56]],
  // tempes et joues
  [[1.0, 0.4, 0.07], [1.02, 0.3, 0.06], [0.7, 0.36, 0.4]],
  [[1.16, -0.12, 0.04], [1.12, -0.22, 0.05], [0.8, -0.1, 0.44]],
  [[1.0, -0.34, 0.05], [0.98, -0.42, 0.06], [0.7, -0.3, 0.52]],
  // entre les yeux
  [[0.0, 0.5, 0.64], [0.06, 0.42, 0.68], [0.0, 0.3, 0.74]],
];

function geometry(tris: { v: V[]; c: string }[]) {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const t of tris) {
    c.set(t.c);
    for (const v of t.v) {
      pos.push(...v);
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
const mirror = (v: V): V => [-v[0], v[1], v[2]];
const fwd = (v: V, d = 0.012): V => [v[0], v[1], v[2] + d];

function buildTigerHead() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const root = new THREE.Group();
  const head = new THREE.Group();
  root.add(head);

  const tris: { v: V[]; c: string }[] = [];
  for (const [a, b, d, c] of FACES) {
    tris.push({ v: [P[a], P[b], P[d]], c });
    tris.push({ v: [mirror(P[a]), mirror(P[d]), mirror(P[b])], c });
  }
  for (const [a, b, d, c] of TUFTS) {
    tris.push({ v: [a, b, d], c });
    tris.push({ v: [mirror(a), mirror(d), mirror(b)], c });
  }
  for (const s of STRIPES) {
    tris.push({ v: s.map((v) => fwd(v)) as V[], c: STRIPE });
    tris.push({ v: s.map((v) => fwd(mirror(v))) as V[], c: STRIPE });
  }
  head.add(new THREE.Mesh(geometry(tris), mat));

  // le nez : large et rosé, bordé de sombre ; la bouche en Y
  head.add(
    new THREE.Mesh(
      geometry([
        { v: [fwd([-0.2, -0.14, 0.98], 0.015), fwd([0.2, -0.14, 0.98], 0.015), fwd([0, -0.36, 0.94], 0.015)], c: '#2a1c18' },
        { v: [fwd([-0.15, -0.155, 0.985], 0.03), fwd([0.15, -0.155, 0.985], 0.03), fwd([0, -0.31, 0.95], 0.03)], c: '#c9756a' },
        { v: [fwd([-0.015, -0.34, 0.94], 0.02), fwd([0.015, -0.34, 0.94], 0.02), fwd([0, -0.44, 0.9], 0.02)], c: STRIPE },
        { v: [fwd([0, -0.42, 0.9], 0.02), fwd([0.26, -0.48, 0.77], 0.02), fwd([0, -0.46, 0.89], 0.02)], c: STRIPE },
        { v: [fwd([0, -0.42, 0.9], 0.02), fwd([0, -0.46, 0.89], 0.02), fwd([-0.26, -0.48, 0.77], 0.02)], c: STRIPE },
      ]),
      mat,
    ),
  );

  // les oreilles : sombres, avec un intérieur clair ; elles pivotent à leur base
  const ears: THREE.Group[] = [];
  [1, -1].forEach((s) => {
    const m = (v: V): V => (s > 0 ? v : mirror(v));
    const base = m([0.73, 0.85, 0.07]);
    const ear = new THREE.Group();
    ear.position.set(...base);
    const rel = (v: V): V => {
      const q = m(v);
      return [q[0] - base[0], q[1] - base[1], q[2] - base[2]];
    };
    const outer = [rel(P.crown), rel(P.earTip), rel(P.earOut)];
    const inner = [rel([0.6, 0.93, 0.18]), rel([0.88, 1.22, 0.06]), rel([0.92, 0.82, 0.04])];
    ear.add(new THREE.Mesh(geometry([{ v: outer, c: EAR }, { v: inner.map((v) => fwd(v, 0.02)) as V[], c: '#f3e6d8' }]), mat));
    head.add(ear);
    ears.push(ear);
  });

  // les yeux : un triangle ambré et une pupille fendue ; ils se ferment en se plissant
  const eyes: THREE.Group[] = [];
  // les yeux passent toujours devant les facettes voisines (la tête ne tourne jamais assez pour que ça se voie)
  const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthTest: false });
  [1, -1].forEach((s) => {
    const m = (v: V): V => (s > 0 ? v : mirror(v));
    const eye = new THREE.Group();
    const c: V = m([0.36, 0.2, 0.69]);
    eye.position.set(c[0], c[1], c[2] + 0.1);
    const rel = (v: V): V => {
      const q = m(v);
      return [q[0] - c[0], q[1] - c[1], 0];
    };
    const R = (x: number, y: number, z = 0): V => {
      const q = rel([x, y, 0]);
      return [q[0], q[1], z];
    };
    eye.add(
      new THREE.Mesh(
        geometry([
          // contour sombre en amande
          { v: [R(0.12, 0.21), R(0.36, 0.33), R(0.38, 0.09)], c: '#1d1411' },
          { v: [R(0.36, 0.33), R(0.62, 0.29), R(0.38, 0.09)], c: '#1d1411' },
          // iris ambré
          { v: [R(0.18, 0.21, 0.01), R(0.36, 0.3, 0.01), R(0.38, 0.12, 0.01)], c: '#e9a836' },
          { v: [R(0.36, 0.3, 0.01), R(0.56, 0.27, 0.01), R(0.38, 0.12, 0.01)], c: '#f2bd4a' },
          // pupille fendue
          { v: [R(0.355, 0.29, 0.02), R(0.395, 0.29, 0.02), R(0.375, 0.13, 0.02)], c: '#120c0a' },
          // reflet
          { v: [R(0.42, 0.26, 0.03), R(0.46, 0.255, 0.03), R(0.44, 0.225, 0.03)], c: '#ffffff' },
        ]),
        eyeMat,
      ),
    );
    eye.renderOrder = 2;
    eye.rotation.y = 0.35 * s;
    head.add(eye);
    eyes.push(eye);
  });

  return { root, head, ears, eyes };
}

export function createMascot(canvas: HTMLCanvasElement, opts: { reduced: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  camera.position.set(0, 0.1, 7.2);
  camera.lookAt(0, 0.2, 0);
  // une lumière douce et presque uniforme : les couleurs des facettes restent celles du dessin
  scene.add(new THREE.HemisphereLight('#ffffff', '#d8c4b4', 2.4));
  const key = new THREE.DirectionalLight('#fff3e6', 0.9);
  key.position.set(-2, 3, 5);
  scene.add(key);

  const T = buildTigerHead();
  scene.add(T.root);

  let mood: Mood = 'sleep';
  let perk = 0;
  const s = { awake: 0, happy: 0, blink: 0, nextBlink: 2, flick: 0, nextFlick: 4 };
  const look = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    look.x = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.4), -1, 1);
    look.y = THREE.MathUtils.clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight * 0.4), -1, 1);
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

  const damp = (c: number, t: number, r: number, dt: number) => c + (t - c) * (1 - Math.exp(-r * dt));
  const clock = new THREE.Clock();
  let raf = 0;
  const frame = () => {
    const still = opts.reduced;
    const dt = still ? 1 : Math.min(clock.getDelta(), 0.05);
    const t = still ? 0 : clock.elapsedTime;
    perk = Math.max(0, perk - dt * 1.3);
    s.awake = still ? (mood === 'sleep' ? 0 : 1) : damp(s.awake, mood === 'sleep' ? 0 : 1, 3, dt);
    s.happy = still ? (mood === 'free' ? 1 : 0) : damp(s.happy, mood === 'free' ? 1 : 0, 3, dt);
    look.sx = still ? 0 : damp(look.sx, look.x, 4, dt);
    look.sy = still ? 0 : damp(look.sy, look.y, 4, dt);
    if (!still) {
      s.nextBlink -= dt;
      if (s.nextBlink < 0) (s.blink = 1), (s.nextBlink = 2.5 + Math.random() * 3);
      s.blink = Math.max(0, s.blink - dt * 7);
      s.nextFlick -= dt;
      if (s.nextFlick < 0) (s.flick = 1), (s.nextFlick = 3 + Math.random() * 4);
      s.flick = Math.max(0, s.flick - dt * 4);
    }
    const a = s.awake;
    const hp = s.happy;

    // la tête suit la souris (éveillé), penche et respire en dormant, se dandine quand tu es libre
    const breathe = Math.sin(t * (a > 0.5 ? 2 : 1.1)) * (a > 0.5 ? 0.01 : 0.02);
    T.head.scale.set(1 + breathe * 0.4, 1 + breathe, 1);
    T.head.rotation.y = THREE.MathUtils.lerp(0.08, look.sx * 0.55, a);
    T.head.rotation.x = THREE.MathUtils.lerp(0.32, look.sy * 0.35 - perk * 0.15, a) + hp * Math.sin(t * 3.2) * 0.05;
    T.head.rotation.z = THREE.MathUtils.lerp(0.12, -look.sx * 0.06, a) + hp * Math.sin(t * 1.6) * 0.05;

    const closed = Math.max(1 - a, s.blink, hp * 0.6);
    T.eyes.forEach((e) => (e.scale.y = Math.max(0.08, 1 - closed)));
    T.ears.forEach((e, i) => {
      const side = i === 0 ? 1 : -1;
      e.rotation.z = side * (THREE.MathUtils.lerp(-0.35, 0, a) + perk * 0.15) + hp * Math.sin(t * 6 + i) * 0.1 + (i === 0 ? s.flick * 0.25 : 0);
    });
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
