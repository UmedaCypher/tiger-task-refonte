import * as THREE from 'three';
import type { Mood } from './world';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * La mascotte : une tête de tigre low poly (sans cou), sculptée puis peinte facette par facette,
 * affichée dans l'interface sur fond transparent. Elle suit la souris du regard.
 */

const C = {
  orange: '#ee8a24',
  orangeLight: '#f59a32',
  orangeDeep: '#d9711b',
  white: '#f4efe8',
  whiteShade: '#e4dcd2',
  stripe: '#2a201c',
  earDark: '#2b2321',
  earInner: '#f2ece6',
  nose: '#c9786a',
  noseDark: '#9c5249',
  iris: '#e2862a',
  pupil: '#1a120e',
};

const gauss = (a: number, m: number, s: number) => Math.exp(-(((a - m) / s) ** 2));
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
let seed = 3;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const shade = (hex: string, amt = 0.035) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + (rnd() - 0.5) * amt)));
};

/** Le volume du crâne : un ovoïde déformé (museau en bloc, menton, collerette en mèches, front plat) */
function sculpt(x0: number, y0: number, z0: number): [number, number, number] {
  // ovoïde de base : un peu plus haut que large, profond
  let x = x0 * 0.8;
  let y = y0 * 0.86;
  let z = z0 * 0.82;
  const front = Math.max(0, z0);
  const ax = Math.abs(x0);
  // sommet plat, front qui descend en pente douce vers le nez
  if (y > 0.55) y = 0.55 + (y - 0.55) * 0.55;
  // museau : un bloc qui avance nettement, du dessous des yeux jusqu'au menton
  const snout = gauss(x0, 0, 0.46) * gauss(y0, -0.24, 0.32) * front;
  z += snout * 0.46;
  // pont du nez
  z += gauss(x0, 0, 0.18) * gauss(y0, 0.12, 0.22) * front * 0.16;
  // arcades sourcilières et orbites
  z += gauss(ax, 0.36, 0.16) * gauss(y0, 0.38, 0.1) * front * 0.08;
  z -= gauss(ax, 0.38, 0.12) * gauss(y0, 0.22, 0.08) * front * 0.06;
  // menton qui descend devant
  if (y0 < -0.45) y -= (-0.45 - y0) * 0.45 * (0.4 + front);
  // collerette : élargit le bas des joues, en mèches
  const band = gauss(y0, -0.12, 0.4) * smooth(0.25, 0.75, ax) * (0.55 + 0.45 * smooth(-0.5, 0.3, z0));
  const spikes = Math.max(0, Math.sin(y0 * 12 + 1.1)) ** 3;
  x += Math.sign(x0) * band * (0.2 + spikes * 0.22);
  y -= Math.sign(y0 + 0.1) * band * spikes * 0.04;
  // bas du visage plus étroit, menton net ; le cou est coupé : dessous plat
  if (y0 < -0.35) x *= 1 - (-0.35 - y0) * 0.45;
  if (y < -0.8) y = -0.8;
  // arrière du crâne
  if (z < 0) z *= 0.95;
  return [x, y, z];
}

/** La robe, peinte facette par facette d'après la planche de référence */
function coat(x: number, y: number, z: number, nz: number): string {
  const ax = Math.abs(x);
  const facing = nz > 0.25 && z > 0.1;
  if (facing) {
    // museau blanc (de part et d'autre du pont du nez) et menton
    if (y < -0.06 && z > 0.5 && ax < 0.46 && !(ax < 0.12 && y > -0.22)) return C.white;
    if (y < -0.5) return C.white;
    // collerette blanche, quelques mèches rayées
    if (ax > 0.78 && y < 0.15) return ax < 0.92 && Math.sin(y * 10 - ax * 3) > 0.86 ? C.stripe : y < -0.35 ? C.whiteShade : C.white;
    // sourcil : une bande sombre en biais au-dessus de l'œil
    const brow = 0.43 - (ax - 0.2) * 0.32;
    if (ax > 0.2 && ax < 0.6 && Math.abs(y - brow) < 0.035) return C.stripe;
    // masque blanc : au-dessus de l'œil, et sous l'œil vers la joue
    if (ax > 0.17 && ax < 0.62 && y > 0.1 && y < brow - 0.03) return C.white;
    // trait sombre sous le coin extérieur de l'œil
    if (ax > 0.5 && ax < 0.66 && y > 0.02 && y < 0.2 && Math.abs(y - (0.16 - (ax - 0.5) * 0.6)) < 0.03) return C.stripe;
    // front : flèche centrale et barres arquées de chaque côté
    if (ax < 0.035 && y > 0.48 && y < 0.62) return C.stripe;
    if (y > 0.62 && y < 0.7 && ax < 0.17 - (y - 0.62)) return C.stripe;
    if (Math.abs(y - (0.7 - ax * 0.15)) < 0.03 && ax > 0.22 && ax < 0.5) return C.stripe;
    if (Math.abs(y - (0.58 - ax * 0.1)) < 0.025 && ax > 0.42 && ax < 0.62) return C.stripe;
    // joues : bandes sombres verticales et incurvées
    if (ax > 0.58 && ax < 0.8 && y > -0.42 && y < 0.3 && Math.abs(Math.sin((ax - 0.58) * 22 + y * 3)) > 0.86) return C.stripe;
    return ax < 0.14 && y > -0.15 && y < 0.5 ? C.orangeLight : y < 0 ? C.orangeDeep : C.orange;
  }
  // côtés : collerette blanche devant, rayures verticales
  if (y < -0.45) return C.white;
  if (ax > 0.75 && y < 0.15 && z > -0.15) return C.white;
  // arrière : chevrons sombres
  const chev = y * 5.5 + ax * 2.6 - z * 0.8;
  if (z < 0.3 && Math.abs(Math.sin(chev)) > 0.9 && y > -0.4) return C.stripe;
  return z < -0.4 ? C.orangeDeep : C.orange;
}

function paint(g: THREE.BufferGeometry, colorAt: (x: number, y: number, z: number, nz: number) => string) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(p.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    d.fromBufferAttribute(p, i + 2);
    const n = e1.subVectors(b, a).cross(e2.subVectors(d, a)).normalize();
    const col = shade(colorAt((a.x + b.x + d.x) / 3, (a.y + b.y + d.y) / 3, (a.z + b.z + d.z) / 3, n.z));
    for (let j = 0; j < 3; j++) col.toArray(cols, (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

export function buildTigerHead() {
  seed = 3;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0 });
  const flat = (color: string) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  const root = new THREE.Group();
  const head = new THREE.Group();
  root.add(head);

  // ---- crâne
  const g = new THREE.IcosahedronGeometry(1, 4);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, ...sculpt(pos.getX(i), pos.getY(i), pos.getZ(i)));
  const skull = new THREE.Mesh(paint(g, coat), mat);
  head.add(skull);

  // poser un élément à la surface, vu de face
  const ray = new THREE.Raycaster();
  skull.updateMatrixWorld(true);
  const on = (x: number, y: number, out = 0.012) => {
    ray.set(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(skull)[0];
    const pt = hit ? hit.point.clone() : new THREE.Vector3(x, y, 0.9);
    if (hit?.face) pt.addScaledVector(hit.face.normal, out);
    return pt;
  };
  const strip = (pts: THREE.Vector3[], width: number, color: string) => {
    // un trait sombre qui suit la surface (bouche, philtrum)
    const v: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dir = b.clone().sub(a).normalize();
      const up = new THREE.Vector3(-dir.y, dir.x, 0).normalize().multiplyScalar(width / 2);
      const a1 = a.clone().add(up), a2 = a.clone().sub(up), b1 = b.clone().add(up), b2 = b.clone().sub(up);
      v.push(...a1.toArray(), ...a2.toArray(), ...b1.toArray(), ...b1.toArray(), ...a2.toArray(), ...b2.toArray());
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    sg.computeVertexNormals();
    const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    head.add(m);
    return m;
  };

  // ---- nez : large, rose, plus sombre en dessous
  const nt = on(0, -0.12, 0.0);
  const nose = new THREE.Group();
  nose.position.copy(nt);
  nose.scale.setScalar(0.95);
  const noseG = new THREE.BufferGeometry();
  const N = (x: number, y: number, z: number) => [x, y, z];
  noseG.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        // dessus, en deux pans
        ...N(-0.2, 0.06, -0.04), ...N(0, 0.04, 0.05), ...N(0, -0.12, 0.06),
        ...N(0, 0.04, 0.05), ...N(0.2, 0.06, -0.04), ...N(0, -0.12, 0.06),
        ...N(-0.2, 0.06, -0.04), ...N(0, -0.12, 0.06), ...N(-0.1, -0.1, 0.0),
        ...N(0.2, 0.06, -0.04), ...N(0.1, -0.1, 0.0), ...N(0, -0.12, 0.06),
      ],
      3,
    ),
  );
  noseG.computeVertexNormals();
  nose.add(new THREE.Mesh(noseG, flat(C.nose)));
  const nb = new THREE.BufferGeometry();
  nb.setAttribute('position', new THREE.Float32BufferAttribute([...N(-0.1, -0.1, 0.0), ...N(0, -0.12, 0.06), ...N(0.1, -0.1, 0.0), ...N(-0.1, -0.1, 0.0), ...N(0.1, -0.1, 0.0), ...N(0, -0.17, -0.02)], 3));
  nb.computeVertexNormals();
  nose.add(new THREE.Mesh(nb, flat(C.noseDark)));
  head.add(nose);

  // ---- bouche : un philtrum et un large sourire en vague
  strip([on(0, -0.27), on(0, -0.4)], 0.025, C.stripe);
  const smile: THREE.Vector3[] = [];
  for (let i = -6; i <= 6; i++) {
    const x = (i / 6) * 0.44;
    const y = -0.42 + Math.abs(x) * 0.08 - gauss(Math.abs(x), 0.3, 0.08) * 0.03 + (Math.abs(x) > 0.38 ? (Math.abs(x) - 0.38) * 0.9 : 0);
    smile.push(on(x, y, 0.015));
  }
  strip(smile, 0.032, C.stripe);

  // ---- yeux : amande, iris orangé, pupille ronde, contour sombre, reflet ; paupière pour cligner
  const eyes: { lid: THREE.Mesh; g: THREE.Group }[] = [];
  const eyeMat = (color: string) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const almond = (w: number, h: number, tilt: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0);
    sh.quadraticCurveTo(-w * 0.1, h * 0.95, w / 2, h * 0.18 + tilt);
    sh.quadraticCurveTo(w * 0.05, -h * 0.75, -w / 2, 0);
    return new THREE.ShapeGeometry(sh, 3);
  };
  [1, -1].forEach((s) => {
    const eg = new THREE.Group();
    const at = on(0.37 * s, 0.24, 0.02);
    eg.position.copy(at);
    eg.rotation.y = 0.38 * s;
    eg.rotation.z = -0.12 * s;
    eg.scale.x = s;
    const outline = new THREE.Mesh(almond(0.34, 0.19, 0.028), eyeMat(C.stripe));
    const iris = new THREE.Mesh(almond(0.28, 0.145, 0.02), eyeMat(C.iris));
    iris.position.z = 0.004;
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), eyeMat(C.pupil));
    pupil.position.set(0.005, 0.03, 0.008);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.013, 6), eyeMat('#ffffff'));
    glint.position.set(0.03, 0.05, 0.012);
    const lid = new THREE.Mesh(almond(0.36, 0.21, 0.028), eyeMat(C.orange));
    lid.position.z = 0.016;
    eg.add(outline, iris, pupil, glint, lid);
    head.add(eg);
    eyes.push({ lid, g: eg });
  });

  // ---- oreilles : arrondies, dos et bord sombres, intérieur blanc ; elles pivotent à leur base
  const ears: THREE.Group[] = [];
  const earShape = (w: number, h: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0);
    sh.quadraticCurveTo(-w * 0.55, h * 0.75, 0, h);
    sh.quadraticCurveTo(w * 0.55, h * 0.75, w / 2, 0);
    sh.lineTo(-w / 2, 0);
    return sh;
  };
  [1, -1].forEach((s) => {
    const ear = new THREE.Group();
    ear.position.set(0.5 * s, 0.6, -0.12);
    ear.rotation.z = -0.38 * s;
    ear.rotation.y = 0.25 * s;
    const outerG = new THREE.ExtrudeGeometry(earShape(0.52, 0.5), { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 4 });
    outerG.translate(0, 0, -0.06);
    const outer = new THREE.Mesh(outerG, flat(C.earDark));
    const innerG = new THREE.ShapeGeometry(earShape(0.34, 0.36), 4);
    const inner = new THREE.Mesh(innerG, flat(C.earInner));
    inner.position.set(0, 0.04, 0.1);
    ear.add(outer, inner);
    head.add(ear);
    ears.push(ear);
  });

  // centrer la tête sur son pivot
  head.position.y = 0.05;
  return { root, head, ears, eyes };
}

export interface MascotOpts {
  reduced: boolean;
  /** pour les vues fixes (atelier) : angle imposé et humeur */
  fixed?: { yaw: number; pitch?: number; mood: Mood };
}

export function createMascot(canvas: HTMLCanvasElement, opts: MascotOpts) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: !!opts.fixed });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  camera.position.set(0, 0.05, 6.4);
  camera.lookAt(0, 0, 0);
  // éclairage studio doux : une clé en haut à gauche, un contre-jour léger
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9a596', 1.9));
  const key = new THREE.DirectionalLight('#fff4e8', 1.5);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#dfe8ff', 0.6);
  rim.position.set(4, 2, -4);
  scene.add(rim);

  const T = buildTigerHead();
  scene.add(T.root);
  let redraw = () => {};

  // un modèle 3D fourni (public/models/tiger-head.glb) remplace la tête sculptée en code
  (async () => {
    try {
      const res = await fetch('/models/tiger-head.glb', { method: 'HEAD' });
      if (!res.ok || !/gltf|octet|model/.test(res.headers.get('content-type') ?? '')) return;
      const gltf = await new GLTFLoader().loadAsync('/models/tiger-head.glb');
      const m = gltf.scene;
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      m.scale.multiplyScalar(2.1 / Math.max(size.x, size.y, size.z));
      box.setFromObject(m);
      m.position.sub(box.getCenter(new THREE.Vector3()));
      T.head.visible = false;
      T.root.add(m);
      redraw();
    } catch {
      /* on garde la tête sculptée */
    }
  })();

  let mood: Mood = opts.fixed?.mood ?? 'sleep';
  let perk = 0;
  const s = { awake: 0, happy: 0, blink: 0, nextBlink: 2, flick: 0, nextFlick: 4 };
  const look = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    look.x = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.4), -1, 1);
    look.y = THREE.MathUtils.clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight * 0.4), -1, 1);
  };
  if (!opts.fixed) addEventListener('pointermove', onPointer, { passive: true });

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
    const still = opts.reduced || !!opts.fixed;
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

    if (opts.fixed) {
      T.root.rotation.set(opts.fixed.pitch ?? 0, opts.fixed.yaw, 0);
    } else {
      const breathe = Math.sin(t * (a > 0.5 ? 2 : 1.1)) * (a > 0.5 ? 0.008 : 0.016);
      T.head.scale.set(1 + breathe * 0.4, 1 + breathe, 1);
      T.root.rotation.y = THREE.MathUtils.lerp(0.1, look.sx * 0.6, a);
      T.root.rotation.x = THREE.MathUtils.lerp(0.3, look.sy * 0.35 - perk * 0.15, a) + hp * Math.sin(t * 3.2) * 0.05;
      T.root.rotation.z = THREE.MathUtils.lerp(0.12, -look.sx * 0.06, a) + hp * Math.sin(t * 1.6) * 0.05;
    }

    // paupières : fermées en dormant, plissées de joie quand tu es libre
    const closed = Math.max(1 - a, s.blink, hp * 0.55);
    T.eyes.forEach((e) => {
      e.lid.scale.y = closed;
      e.lid.position.y = (1 - closed) * 0.07;
      e.lid.visible = closed > 0.02;
    });
    T.ears.forEach((e, i) => {
      const side = i === 0 ? 1 : -1;
      e.rotation.z = side * (-0.38 + THREE.MathUtils.lerp(-0.25, 0, a) - perk * 0.12) + hp * Math.sin(t * 6 + i) * 0.1 + (i === 0 ? s.flick * 0.25 : 0);
    });
    renderer.render(scene, camera);
  };

  redraw = () => frame();
  let running = false;
  const loop = () => {
    frame();
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || opts.reduced || opts.fixed) return;
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
  if (opts.reduced || opts.fixed) frame();

  return {
    setMood(m: Mood) {
      mood = m;
      if (opts.reduced) frame();
    },
    perk() {
      perk = 1;
    },
    render: frame,
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
