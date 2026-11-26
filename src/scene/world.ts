import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Le décor low poly : une vallée, un lac, des arbres en fleurs, des falaises,
 * et un tigre articulé qui vit sur la rive. Un flou de maquette (tilt-shift)
 * garde la netteté sur le tigre et donne de la profondeur.
 * Tout est construit en code avec des formes à facettes : rien à télécharger.
 */

export type Mood = 'sleep' | 'awake' | 'free';
export interface WorldState {
  progress: number; // 0..1, avancement du jour
  mood: Mood;
  night: boolean;
}

// ------------------------------------------------------------------ outils

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const range = (a: number, b: number) => a + rnd() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = THREE.MathUtils.lerp;
const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

const facetMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
const solid = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0, ...extra });

/** Colore une géométrie face par face (aspect low poly), selon la position du centre de chaque face */
function facet(geo: THREE.BufferGeometry, colorAt: (x: number, y: number, z: number) => THREE.ColorRepresentation) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    c.set(colorAt(x, y, z));
    for (let j = 0; j < 3; j++) c.toArray(cols, (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}
const vary = (hex: string, amount = 0.06) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h + (rnd() - 0.5) * amount * 0.3, hsl.s, Math.min(1, Math.max(0, hsl.l + (rnd() - 0.5) * amount)));
};
const blob = (r: number, detail: number, sx: number, sy: number, sz: number, color: (x: number, y: number, z: number) => THREE.ColorRepresentation) => {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(sx, sy, sz);
  return new THREE.Mesh(facet(g, color), facetMat);
};
const shadows = (o: THREE.Object3D, cast = true, receive = false) =>
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });

// ------------------------------------------------------------------ ambiances

const MOODS = {
  dawn: { top: '#9cc0ea', mid: '#f5c3c2', low: '#fbdcc4', fog: '#f4d6c8', hemiSky: '#fff1ea', hemiGround: '#d9b9a4', sun: '#ffe1bf', sunI: 2.7, hemiI: 2.1, water: '#86b0dc' },
  gold: { top: '#b3cbe9', mid: '#f8cf9e', low: '#fde3bb', fog: '#f7dbb4', hemiSky: '#fff4d8', hemiGround: '#d9b088', sun: '#ffd08c', sunI: 3.3, hemiI: 2.3, water: '#93b9dc' },
  night: { top: '#121531', mid: '#33284f', low: '#64415a', fog: '#4b3352', hemiSky: '#8f84c8', hemiGround: '#2c2140', sun: '#cdd6ff', sunI: 0.7, hemiI: 1.0, water: '#3d3e6e' },
};
type Palette = typeof MOODS.dawn;

// ------------------------------------------------------------------ relief

const LAKE_X = (z: number) => 0.6 + Math.sin(z * 0.09 + 0.6) * 2.6;
const LAKE_W = (z: number) => 1.7 + Math.max(0, 6 - z) * 0.11 + Math.max(0, -z - 12) * 0.35;
function height(x: number, z: number) {
  const dx = Math.abs(x - LAKE_X(z));
  const w = LAKE_W(z);
  const far = Math.max(0, -z - 8);
  const hills = 0.55 * Math.sin(x * 0.23 + 1) + 0.4 * Math.cos(z * 0.27 + x * 0.11) + 0.25 * Math.sin(x * 0.7 + z * 0.4);
  const land = 0.25 + Math.max(0, hills) * smooth(w + 2, w + 7, dx) + far * 0.02 + far * far * 0.0007;
  const cliffs = x - LAKE_X(z) > 0 ? smooth(w + 7, w + 11, dx) * (2.2 + Math.sin(z * 0.5) * 0.8) * smooth(4, -6, z) : 0;
  return lerp(-0.9, land + cliffs, smooth(w, w + 1.6, dx));
}

// ------------------------------------------------------------------ monde

export function createWorld(canvas: HTMLCanvasElement, opts: { reduced: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  const dpr = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(MOODS.dawn.fog, 38, 150);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);
  const camBase = new THREE.Vector3(0, 8.5, 30);
  const camLook = new THREE.Vector3(0, 1.6, -8);

  const land = new THREE.Group(); // tout le paysage ; décalé pour laisser la gauche au contenu
  scene.add(land);

  // ---- ciel
  const skyU = {
    top: { value: new THREE.Color(MOODS.dawn.top) },
    mid: { value: new THREE.Color(MOODS.dawn.mid) },
    low: { value: new THREE.Color(MOODS.dawn.low) },
    sunDir: { value: new THREE.Vector3(0.4, 0.2, -1).normalize() },
    sunCol: { value: new THREE.Color('#fff4dc') },
    sunSize: { value: 1 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyU,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunSize;
        varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 c = mix(low, mid, smoothstep(-0.02, 0.12, h));
          c = mix(c, top, smoothstep(0.12, 0.55, h));
          float d = max(dot(normalize(vDir), sunDir), 0.0);
          c += sunCol * (smoothstep(0.9985 - 0.0012 * sunSize, 0.9992 - 0.0012 * sunSize, d) * 1.2 + pow(d, 40.0) * 0.35 + pow(d, 6.0) * 0.12);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sky);

  // ---- lumières
  const hemi = new THREE.HemisphereLight(MOODS.dawn.hemiSky, MOODS.dawn.hemiGround, MOODS.dawn.hemiI);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(MOODS.dawn.sun, MOODS.dawn.sunI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 60 });
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---- sol
  {
    const g = new THREE.PlaneGeometry(140, 110, 120, 90).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -41);
    const p = g.attributes.position as THREE.BufferAttribute;
    const jit = new Map<string, number>();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const k = `${x.toFixed(2)}:${z.toFixed(2)}`;
      if (!jit.has(k)) jit.set(k, (rnd() - 0.5) * 0.18);
      p.setY(i, height(x, z) + jit.get(k)!);
    }
    const grass = ['#a9b46a', '#b5bb72', '#9cab62', '#bcb978'];
    const dry = ['#cdb97d', '#d6c088', '#c4ae74'];
    const sand = ['#e3cc9c', '#ead6a8', '#dcc292'];
    const rock = ['#a8989f', '#b2a3a9', '#9d8f99'];
    const mauve = ['#b9a3b6', '#c2aebf', '#ad97ad'];
    const geo = facet(g, (x, y, z) => {
      if (y < -0.12) return vary('#c7b48e');
      if (y < 0.32 && Math.abs(x - LAKE_X(z)) < LAKE_W(z) + 2.2) return vary(pick(sand));
      if (y > 1.6 && x - LAKE_X(z) > 0 && z > -30) return vary(pick(rock));
      if (z < -45) return vary(pick(mauve));
      return vary(pick(rnd() > 0.75 ? dry : grass));
    });
    const ground = new THREE.Mesh(geo, facetMat);
    ground.receiveShadow = true;
    land.add(ground);
  }

  // ---- eau
  const water = (() => {
    const g = new THREE.PlaneGeometry(140, 110, 80, 60).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.05, -41);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color: MOODS.dawn.water, flatShading: true, roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.96 }),
    );
    m.receiveShadow = true;
    m.userData.base = Float32Array.from((g.attributes.position as THREE.BufferAttribute).array);
    land.add(m);
    return m;
  })();

  // ---- montagnes lointaines
  for (let i = 0; i < 14; i++) {
    const h = range(5, 10);
    const g = new THREE.ConeGeometry(range(6, 11), h, Math.floor(range(5, 8)), 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < p.count; j++) if (p.getY(j) > -h / 2 + 0.1 && p.getY(j) < h / 2 - 0.1) p.setX(j, p.getX(j) + range(-0.8, 0.8));
    const m = new THREE.Mesh(facet(g, () => vary(pick(['#a9a6c6', '#b6aecb', '#9d9cbf']), 0.05)), facetMat);
    m.position.set(range(-80, 80), h / 2 - 1.5, range(-100, -85));
    m.rotation.y = rnd() * 6;
    land.add(m);
  }

  // ---- falaises à droite (blocs empilés, comme des orgues)
  for (let i = 0; i < 26; i++) {
    const z = range(-40, -10);
    const x = LAKE_X(z) + LAKE_W(z) + range(9, 16);
    const h = range(0.8, 2.6) * smooth(-6, -18, z) + range(0.6, 1.2);
    const g = new THREE.CylinderGeometry(range(0.8, 1.5), range(1.2, 2.2), h, Math.floor(range(5, 7)));
    const m = new THREE.Mesh(facet(g, () => vary(pick(['#9d93ad', '#aaa0b8', '#8f88a6']), 0.07)), facetMat);
    m.position.set(x, height(x, z) + h / 2 - 0.6, z);
    m.rotation.y = rnd() * 6;
    shadows(m, true, true);
    land.add(m);
  }

  // ---- arbres
  const trunkMat = solid('#7a5849');
  const blossomTree = (x: number, z: number, s: number) => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 1.8, 5), trunkMat);
    trunk.position.y = 0.9;
    trunk.rotation.z = range(-0.1, 0.1);
    t.add(trunk);
    const n = Math.floor(range(3, 6));
    for (let i = 0; i < n; i++) {
      const r = range(0.45, 0.8);
      const b = blob(r, 1, 1, range(0.8, 1), 1, () => vary(pick(['#f0a8bb', '#e898ae', '#f5bccb', '#dd8aa2']), 0.07));
      b.position.set(range(-0.6, 0.6), range(1.8, 2.6), range(-0.4, 0.4));
      b.rotation.set(rnd() * 3, rnd() * 3, 0);
      t.add(b);
    }
    t.position.set(x, height(x, z) - 0.05, z);
    t.scale.setScalar(s);
    shadows(t, true, false);
    land.add(t);
    return t;
  };
  const eggTree = (x: number, z: number, s: number) => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1, 5), trunkMat);
    trunk.position.y = 0.5;
    const top = blob(0.55, 1, 1, range(1.5, 2), 1, () => vary(pick(['#9ea559', '#b2a95c', '#8f9b56', '#c2b066']), 0.07));
    top.position.y = 1.55;
    t.add(trunk, top);
    t.position.set(x, height(x, z) - 0.05, z);
    t.scale.setScalar(s);
    shadows(t, true, false);
    land.add(t);
    return t;
  };
  const swaying: THREE.Object3D[] = [];
  for (let i = 0; i < 48; i++) {
    const z = range(-40, 9);
    const side = rnd() > 0.45 ? 1 : -1;
    const x = LAKE_X(z) + side * (LAKE_W(z) + range(2.4, side > 0 ? 11 : 18));
    if (height(x, z) < 0.1 || (side < 0 && z > -6)) continue;
    const s = range(0.7, 1.15) * (z < -15 ? 1.4 : 1);
    swaying.push(rnd() > 0.5 ? blossomTree(x, z, s) : eggTree(x, z, s));
  }
  // un grand arbre en fleurs qui encadre le tigre
  swaying.push(blossomTree(LAKE_X(6) + LAKE_W(6) + 4.4, 5.2, 1.6));

  // ---- rochers
  const rockAt = (x: number, z: number, s: number, flat = 1) => {
    const m = blob(s, 0, range(1, 1.6), range(0.5, 0.8) * flat, range(0.8, 1.2), () => vary(pick(['#a99a99', '#b8a9a4', '#9c8e90']), 0.08));
    m.position.set(x, Math.max(height(x, z), -0.15) + s * 0.2, z);
    m.rotation.y = rnd() * 6;
    shadows(m, true, true);
    land.add(m);
  };
  for (let i = 0; i < 60; i++) {
    const z = range(-25, 12);
    const x = LAKE_X(z) + (rnd() > 0.5 ? 1 : -1) * (LAKE_W(z) + range(-0.2, 9));
    rockAt(x, z, range(0.15, 0.6));
  }
  for (let i = 0; i < 7; i++) {
    const z = 3.5 + range(-0.4, 0.4);
    rockAt(LAKE_X(z) - LAKE_W(z) + 0.4 + i * 0.5, z, 0.16, 0.6);
  }

  // ---- roseaux et herbes (instanciés)
  const blades = (count: number, place: () => [number, number] | null, colors: string[], hRange: [number, number], wid: number) => {
    const g = new THREE.ConeGeometry(wid, 1, 3);
    g.translate(0, 0.5, 0);
    const m = new THREE.InstancedMesh(g, solid('#ffffff'), count);
    const o = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < count * 3 && n < count; i++) {
      const at = place();
      if (!at) continue;
      const [x, z] = at;
      o.position.set(x, Math.max(height(x, z), -0.3), z);
      o.rotation.set(range(-0.35, 0.35), rnd() * 6, range(-0.35, 0.35));
      o.scale.set(1, range(...hRange), 1);
      o.updateMatrix();
      m.setMatrixAt(n, o.matrix);
      m.setColorAt(n, vary(pick(colors), 0.08));
      n++;
    }
    m.count = n;
    m.castShadow = true;
    land.add(m);
    return m;
  };
  blades(
    420,
    () => {
      const z = range(-14, 10);
      return [LAKE_X(z) + (rnd() > 0.5 ? 1 : -1) * (LAKE_W(z) + range(-0.25, 0.7)), z];
    },
    ['#a7a65a', '#c1ad62', '#8f9a52', '#d0b66c'],
    [0.35, 0.9],
    0.035,
  );
  blades(
    500,
    () => {
      const z = range(-6, 11);
      const x = range(-14, 16);
      return height(x, z) > 0.15 ? [x, z] : null;
    },
    ['#a8b064', '#c3b469', '#93a35b'],
    [0.2, 0.45],
    0.03,
  );
  // grandes herbes au premier plan : floues, elles donnent la profondeur
  const front = blades(26, () => [range(2, 20), range(12, 13.6)], ['#7f9447', '#a4a24f', '#c2a45b', '#8c8a3e'], [0.9, 1.8], 0.08);

  // ---- nuages : de longues nappes à facettes
  const clouds: THREE.Mesh[] = [];
  const cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, transparent: true, opacity: 0.92, emissive: '#ffffff', emissiveIntensity: 0.35, fog: false });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(range(6, 12), range(0.6, 1.1), range(2, 4));
    const c = new THREE.Mesh(facet(g, (_x, y) => (y > 0 ? vary('#fff7f2', 0.04) : vary('#f6d9d6', 0.05))), cloudMat);
    c.position.set(range(-90, 90), range(16, 30), range(-120, -90));
    c.userData.speed = range(0.15, 0.4);
    clouds.push(c);
    scene.add(c);
  }

  // ---- oiseaux au loin
  const birds: THREE.Group[] = [];
  const wingG = new THREE.BufferGeometry();
  wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.35, 0, 0.1, 0.15, 0, -0.1], 3));
  const wingM = new THREE.MeshBasicMaterial({ color: '#5e4a57', side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    const l = new THREE.Mesh(wingG, wingM);
    const r = new THREE.Mesh(wingG, wingM);
    r.scale.x = -1;
    b.add(l, r);
    b.userData = { l, r, phase: rnd() * 6, speed: range(0.6, 1.1), y: range(6, 9) };
    b.position.set(range(-30, 30), b.userData.y, range(-30, -18));
    birds.push(b);
    land.add(b);
  }

  // ---- lucioles
  const flyCount = 60;
  const flyGeo = new THREE.BufferGeometry();
  const flyPos = new Float32Array(flyCount * 3);
  for (let i = 0; i < flyCount; i++) {
    const z = range(-4, 9);
    flyPos.set([LAKE_X(z) + range(-6, 8), range(0.3, 2.4), z], i * 3);
  }
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flyMat = new THREE.PointsMaterial({ color: '#ffe9a8', size: 0.09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flies = new THREE.Points(flyGeo, flyMat);
  land.add(flies);

  // ================================================================ le tigre
  const T = buildTiger();
  const tiger = T.root;
  land.add(tiger);
  const shore = (z: number) => LAKE_X(z) + LAKE_W(z) + 1.35;
  const home = { x: shore(5.6) + 1.2, z: 5.6 }; // sa place pour dormir, près du grand arbre
  const path = { z: 5.9, a: shore(5.9) - 0.2, b: shore(5.9) + 3.6 }; // la rive qu'il arpente
  const tg = { x: home.x, z: home.z, heading: Math.PI, lie: 1, walk: 0, phase: 0, perk: 0, dir: 1, pause: 0, look: 0, lookUp: 0 };
  tiger.position.set(home.x, height(home.x, home.z), home.z);
  let focus: THREE.Object3D = T.head; // ce que la mise au point et la bulle suivent
  let model: ReturnType<typeof rigModel> | null = null;
  // un vrai modèle animé, s'il est fourni, remplace le tigre en formes simples
  loadModel().then((gltf) => {
    if (!gltf || disposed) return;
    model = rigModel(gltf);
    T.body.visible = false;
    tiger.add(model.wrapper);
    focus = model.head;
    shadows(model.wrapper, true, false);
    if (opts.reduced) frame();
  });
  let disposed = false;

  // ================================================================ rendu
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.addPass(new RenderPass(scene, camera));
  const hBlur = new ShaderPass(HorizontalTiltShiftShader);
  const vBlur = new ShaderPass(VerticalTiltShiftShader);
  composer.addPass(hBlur);
  composer.addPass(vBlur);
  composer.addPass(new OutputPass());

  let state: WorldState = { progress: 0, mood: 'sleep', night: false };
  const cur = { progress: 0, night: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener('pointermove', onPointer, { passive: true });

  let w = 0;
  let h = 0;
  const resize = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // le tigre se place aux trois quarts de l'écran (au centre-droit sur mobile)
    const halfAt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camBase.z - home.z) * camera.aspect;
    land.position.x = halfAt * (w < 700 ? 0.3 : 0.46) - home.x;
    hBlur.uniforms.h.value = 3.4 / w;
    vBlur.uniforms.v.value = 3.4 / h;
  };
  resize();

  const tmp = new THREE.Color();
  const tmp2 = new THREE.Color();
  const blend = (key: keyof Palette, p: number, n: number) =>
    tmp.set(MOODS.dawn[key] as string).lerp(tmp2.set(MOODS.gold[key] as string), p).lerp(tmp2.set(MOODS.night[key] as string), n);
  const headPos = new THREE.Vector3();
  const sunDir = new THREE.Vector3();
  const sunOff = new THREE.Vector3();
  let onBubble: ((x: number, y: number) => void) | null = null;

  const clock = new THREE.Clock();
  let raf = 0;
  const frame = () => {
    const dt = opts.reduced ? 1 : Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    cur.progress = opts.reduced ? state.progress : damp(cur.progress, state.progress, 1.8, dt);
    cur.night = opts.reduced ? (state.night ? 1 : 0) : damp(cur.night, state.night ? 1 : 0, 1.8, dt);
    const p = cur.progress;
    const n = cur.night;

    // ---- lumière et ciel suivent la journée
    skyU.top.value.copy(blend('top', p, n));
    skyU.mid.value.copy(blend('mid', p, n));
    skyU.low.value.copy(blend('low', p, n));
    (scene.fog as THREE.Fog).color.copy(blend('fog', p, n));
    hemi.color.copy(blend('hemiSky', p, n));
    hemi.groundColor.copy(blend('hemiGround', p, n));
    hemi.intensity = lerp(lerp(MOODS.dawn.hemiI, MOODS.gold.hemiI, p), MOODS.night.hemiI, n);
    sun.color.copy(blend('sun', p, n));
    sun.intensity = lerp(lerp(MOODS.dawn.sunI, MOODS.gold.sunI, p), MOODS.night.sunI, n);
    (water.material as THREE.MeshStandardMaterial).color.copy(blend('water', p, n));
    const elev = lerp(0.05, 0.32, p) * (1 - n) + n * 0.42;
    sunDir.set(0.32 - p * 0.1, elev, -1).normalize();
    skyU.sunDir.value.copy(sunDir);
    skyU.sunCol.value.set(n > 0.5 ? '#e8ecff' : '#fff1d6').multiplyScalar(n > 0.5 ? 0.7 : 1);
    skyU.sunSize.value = n > 0.5 ? 0.6 : 1;
    // la lumière vient du soleil, un peu de face pour bien modeler le tigre
    sunOff.set(sunDir.x * 30, Math.max(8, sunDir.y * 40), 10);
    sun.position.copy(tiger.position).add(land.position).add(sunOff);
    sun.target.position.copy(tiger.position).add(land.position);

    // ---- vie du décor
    if (!opts.reduced) {
      const pos = water.geometry.attributes.position as THREE.BufferAttribute;
      const base = water.userData.base as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        pos.setY(i, base[i * 3 + 1] + Math.sin(x * 0.9 + t * 0.8) * 0.025 + Math.cos(z * 1.3 + t * 0.6) * 0.02);
      }
      pos.needsUpdate = true;
      water.geometry.computeVertexNormals();
      swaying.forEach((s, i) => (s.rotation.z = Math.sin(t * 0.6 + i) * 0.012));
      clouds.forEach((c) => ((c.position.x += c.userData.speed * dt), c.position.x > 80 && (c.position.x = -80)));
      birds.forEach((b) => {
        const u = b.userData;
        b.position.x += u.speed * dt;
        if (b.position.x > 40) b.position.x = -40;
        b.position.y = u.y + Math.sin(t * 0.5 + u.phase) * 0.4;
        const f = Math.sin(t * 7 + u.phase) * 0.6;
        u.l.rotation.z = f;
        u.r.rotation.z = -f;
      });
      front.rotation.z = Math.sin(t * 0.7) * 0.006;
    }
    birds.forEach((b) => (b.visible = n < 0.6));
    cloudMat.opacity = 0.92 - n * 0.6;
    flyMat.opacity = n * (0.6 + Math.sin(t * 2.3) * 0.3);

    // ---- le tigre
    animateTiger(opts.reduced ? 0 : dt, t);

    // ---- caméra : légère parallaxe avec la souris, pour la profondeur
    pointer.sx = opts.reduced ? 0 : damp(pointer.sx, pointer.x, 2, dt);
    pointer.sy = opts.reduced ? 0 : damp(pointer.sy, pointer.y, 2, dt);
    camera.position.set(camBase.x + pointer.sx * 0.6, camBase.y - pointer.sy * 0.25, camBase.z);
    camera.lookAt(camLook.x, camLook.y, camLook.z);

    // ---- netteté sur le tigre, flou de maquette autour
    focus.getWorldPosition(headPos);
    headPos.project(camera);
    hBlur.uniforms.r.value = (headPos.y + 1) / 2;
    vBlur.uniforms.r.value = (headPos.y + 1) / 2;

    composer.render();

    if (onBubble) {
      focus.getWorldPosition(headPos);
      headPos.y += 0.5;
      headPos.project(camera);
      onBubble(((headPos.x + 1) / 2) * w, ((1 - headPos.y) / 2) * h);
    }
  };

  /** Comportement du tigre : il dort, se lève et te regarde, puis arpente la rive quand tu es libre */
  function animateTiger(dt: number, t: number) {
    const mood = state.mood;
    tg.perk = Math.max(0, tg.perk - dt * 1.2);
    let targetX = home.x;
    let targetZ = home.z;
    let moving = false;
    if (mood === 'free' && !opts.reduced) {
      if (tg.pause > 0) tg.pause -= dt;
      else {
        targetX = tg.dir > 0 ? path.b : path.a;
        targetZ = path.z;
        moving = true;
        if (Math.hypot(tg.x - targetX, tg.z - targetZ) < 0.08) {
          tg.dir *= -1;
          tg.pause = range(1.2, 2.6);
          moving = false;
        }
      }
      if (!moving) {
        targetX = tg.x;
        targetZ = tg.z;
      }
    } else {
      moving = !opts.reduced && Math.hypot(tg.x - home.x, tg.z - home.z) > 0.08;
    }
    if (opts.reduced) {
      tg.x = targetX;
      tg.z = targetZ;
    }

    const dx = targetX - tg.x;
    const dz = targetZ - tg.z;
    const dist = Math.hypot(dx, dz);
    if (moving && dist > 0.01) {
      const want = Math.atan2(dz, -dx); // le modèle regarde vers -x
      let d = want - tg.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      tg.heading += d * (1 - Math.exp(-dt * 5));
      if (Math.abs(d) < 0.7) {
        const step = Math.min(dist, 0.7 * dt);
        tg.x += (dx / dist) * step;
        tg.z += (dz / dist) * step;
      }
    } else {
      // au repos, il se tourne vers ta liste, un peu vers toi
      let d = 0.45 - tg.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      tg.heading += d * (opts.reduced ? 1 : 1 - Math.exp(-dt * 2.5));
    }
    tiger.position.set(tg.x, Math.max(height(tg.x, tg.z), -0.1), tg.z);
    tiger.rotation.y = tg.heading;

    const lieTarget = mood === 'sleep' && !moving ? 1 : 0;
    tg.lie = opts.reduced ? lieTarget : damp(tg.lie, lieTarget, 2.2, dt);
    tg.walk = opts.reduced ? 0 : damp(tg.walk, moving ? 1 : 0, 6, dt);
    if (moving) tg.phase += dt * 6.2;

    const awake = mood !== 'sleep';
    tg.look = damp(tg.look, awake && !moving ? -pointer.sx * 0.7 : 0, 3, dt);
    tg.lookUp = damp(tg.lookUp, awake && !moving ? -pointer.sy * 0.25 : 0, 3, dt);

    if (model) model.update(dt, { moving, sleeping: lieTarget === 1, happy: mood === 'free', look: tg.look, perk: tg.perk });
    else T.pose({ lie: tg.lie, walk: tg.walk, phase: tg.phase, t, awake, perk: tg.perk, look: tg.look, lookUp: tg.lookUp, happy: mood === 'free' });
  }

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
  const onResize = () => (resize(), opts.reduced && frame());
  addEventListener('resize', onResize);
  start();
  if (opts.reduced) frame();

  return {
    setState(s: WorldState) {
      state = s;
      if (opts.reduced) frame();
    },
    perk() {
      tg.perk = 1;
    },
    onBubble(cb: (x: number, y: number) => void) {
      onBubble = cb;
      if (opts.reduced) frame();
    },
    dispose() {
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('resize', onResize);
      removeEventListener('pointermove', onPointer);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mt = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose());
      });
      composer.dispose();
      renderer.dispose();
    },
  };
}

// ================================================================ le tigre articulé

interface Pose {
  lie: number;
  walk: number;
  phase: number;
  t: number;
  awake: boolean;
  perk: number;
  look: number;
  lookUp: number;
  happy: boolean;
}

function buildTiger() {
  const ORANGE = '#f0822f';
  const DEEP = '#d86a22';
  const CREAM = '#fff1e0';
  const STRIPE = '#2e1d16';
  // rayures : des bandes verticales qui ondulent, ventre crème
  const fur = (freq: number, phase: number, bellyY: number) => (x: number, y: number, z: number) => {
    if (y < bellyY) return vary(CREAM, 0.04);
    const band = Math.sin(x * freq + phase + Math.sin(y * 6 + z * 2) * 0.5);
    if (band > 0.82 && y > bellyY + 0.05) return STRIPE;
    return vary(y > 0.1 ? ORANGE : DEEP, 0.05);
  };
  const part = (r: number, sx: number, sy: number, sz: number, color: (x: number, y: number, z: number) => THREE.ColorRepresentation, detail = 1) =>
    blob(r, detail, sx, sy, sz, color);

  const root = new THREE.Group();
  const body = new THREE.Group(); // descend quand il se couche
  root.add(body);

  const hips = new THREE.Group();
  hips.position.set(0.5, 1.04, 0);
  hips.add(part(1, 0.56, 0.34, 0.32, fur(11, 0.3, -0.2), 2));
  const chest = new THREE.Group();
  chest.position.set(-0.42, 1.08, 0);
  chest.add(part(1, 0.58, 0.39, 0.36, fur(11, 1.4, -0.23), 2));
  const waist = part(1, 0.6, 0.31, 0.3, fur(11, 0.9, -0.19), 1);
  waist.position.set(0.04, 1.05, 0);
  body.add(hips, chest, waist);

  // cou et tête
  const neck = new THREE.Group();
  neck.position.set(-0.42, 0.16, 0);
  chest.add(neck);
  const neckMesh = part(1, 0.26, 0.3, 0.27, fur(14, 0, -0.18), 1);
  neckMesh.position.set(-0.1, 0.05, 0);
  neckMesh.rotation.z = 0.5;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.set(-0.3, 0.14, 0);
  neck.add(head);
  const skull = part(
    1,
    0.34,
    0.3,
    0.33,
    (x, y, z) => {
      if (y < -0.1 || (x < -0.18 && y < 0.02)) return vary(CREAM, 0.03);
      if (y > 0.12 && Math.abs(z) < 0.12 && Math.sin(z * 40) > 0.4) return STRIPE;
      if (Math.abs(z) > 0.2 && Math.sin(y * 30) > 0.6 && x > -0.1) return STRIPE;
      return vary(ORANGE, 0.05);
    },
    2,
  );
  head.add(skull);
  const muzzle = part(1, 0.18, 0.12, 0.19, () => vary(CREAM, 0.03));
  muzzle.position.set(-0.27, -0.09, 0);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.08), solid('#3b2320'));
  nose.position.set(-0.43, -0.03, 0);
  head.add(nose);
  const jaw = new THREE.Group();
  jaw.position.set(-0.08, -0.15, 0);
  const jawMesh = part(1, 0.15, 0.05, 0.12, () => vary(CREAM, 0.03));
  jawMesh.position.x = -0.1;
  jaw.add(jawMesh);
  head.add(jaw);
  [1, -1].forEach((s) => {
    const ruff = part(1, 0.12, 0.13, 0.08, () => vary(CREAM, 0.04));
    ruff.position.set(0.0, -0.11, 0.25 * s);
    head.add(ruff);
  });
  const ears: THREE.Group[] = [];
  const eyes: THREE.Mesh[] = [];
  [1, -1].forEach((s) => {
    const ear = new THREE.Group();
    ear.position.set(0.04, 0.23, 0.17 * s);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.15, 4), solid(ORANGE));
    outer.position.y = 0.06;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.06, 4), solid(STRIPE));
    tip.position.y = 0.12;
    ear.add(outer, tip);
    ear.rotation.x = 0.25 * s;
    ears.push(ear);
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.03), solid('#2a2a12', { emissive: '#4a3a10', emissiveIntensity: 0.3 }));
    eye.position.set(-0.25, 0.07, 0.15 * s);
    eye.rotation.y = -0.4 * s;
    eyes.push(eye);
    head.add(eye);
  });

  // pattes : hanche → genou → cheville → pied
  interface Leg {
    hip: THREE.Group;
    knee: THREE.Group;
    ankle: THREE.Group;
    front: boolean;
    offset: number;
  }
  const legs: Leg[] = [];
  const makeLeg = (parent: THREE.Group, x: number, y: number, z: number, front: boolean, offset: number) => {
    const hip = new THREE.Group();
    hip.position.set(x, y, z);
    const upper = new THREE.Mesh(facet(new THREE.CylinderGeometry(front ? 0.14 : 0.17, 0.1, 0.46, 6, 2).translate(0, -0.23, 0), fur(18, offset * 3, -10)), facetMat);
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    hip.add(knee);
    const lower = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.095, 0.085, 0.42, 6, 2).translate(0, -0.21, 0), fur(20, offset * 5, -10)), facetMat);
    knee.add(lower);
    const ankle = new THREE.Group();
    ankle.position.y = -0.42;
    knee.add(ankle);
    const foot = part(1, 0.14, 0.06, 0.1, (_x, y) => vary(y < 0 ? CREAM : ORANGE, 0.04));
    foot.position.set(-0.05, -0.02, 0);
    ankle.add(foot);
    parent.add(hip);
    legs.push({ hip, knee, ankle, front, offset });
  };
  // séquence latérale : arrière gauche, avant gauche, arrière droit, avant droit
  makeLeg(chest, -0.12, -0.2, 0.2, true, 0.25);
  makeLeg(chest, -0.12, -0.2, -0.2, true, 0.75);
  makeLeg(hips, 0.12, -0.16, 0.19, false, 0);
  makeLeg(hips, 0.12, -0.16, -0.19, false, 0.5);

  // queue : 9 segments articulés
  const tail: THREE.Group[] = [];
  let parent: THREE.Object3D = hips;
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    g.position.set(i === 0 ? 0.5 : 0.15, i === 0 ? 0.12 : 0, 0);
    const r = 0.07 - i * 0.004;
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.9, r, 0.16, 6).rotateZ(Math.PI / 2).translate(0.075, 0, 0),
      solid((i % 2 && i > 1) || i === 8 ? STRIPE : ORANGE),
    );
    g.add(m);
    parent.add(g);
    parent = g;
    tail.push(g);
  }

  root.scale.setScalar(0.85);
  shadows(root, true, false);

  /** Mélange les poses debout, couché et la marche, articulation par articulation */
  function pose(p: Pose) {
    const { lie, walk, phase, t } = p;
    const breathe = Math.sin(t * (p.awake ? 2.4 : 1.4)) * (p.awake ? 0.012 : 0.022);

    const bob = walk * Math.abs(Math.sin(phase)) * 0.035;
    body.position.y = lerp(0, -0.6, lie) + bob;
    hips.rotation.z = lerp(0, -0.06, lie) + walk * Math.sin(phase) * 0.04;
    chest.rotation.z = lerp(0, 0.04, lie) - walk * Math.sin(phase) * 0.03;
    chest.scale.y = 1 + breathe;
    hips.rotation.x = walk * Math.sin(phase) * 0.05;
    chest.rotation.x = -walk * Math.sin(phase) * 0.05;

    for (const L of legs) {
      const ph = phase + L.offset * Math.PI * 2;
      const swing = Math.sin(ph);
      const lift = Math.max(0, Math.cos(ph));
      if (L.front) {
        L.hip.rotation.z = lerp(-swing * 0.42 * walk, -1.42, lie);
        L.knee.rotation.z = lerp(lift * 0.75 * walk, 0.12, lie);
        L.ankle.rotation.z = lerp(-lift * 0.5 * walk, 1.3, lie);
      } else {
        L.hip.rotation.z = lerp(-swing * 0.38 * walk + 0.08, -1.15, lie);
        L.knee.rotation.z = lerp(-lift * 0.7 * walk - 0.15, 2.55, lie);
        L.ankle.rotation.z = lerp(lift * 0.45 * walk + 0.07, -1.4, lie);
      }
    }

    // tête : posée sur les pattes en dormant, levée et curieuse éveillée
    const perk = p.perk;
    const sleepNeck = 0.55 + Math.sin(t * 1.4) * 0.03;
    const awakeNeck = -0.15 - perk * 0.25 + p.lookUp * 0.4 + walk * 0.12;
    neck.rotation.z = lerp(awakeNeck, sleepNeck, lie);
    neck.rotation.y = lerp(p.look * 0.6, 0.2, lie);
    head.rotation.z = lerp(-0.05 + walk * Math.sin(phase * 2) * 0.03, 0.15, lie);
    head.rotation.y = lerp(p.look * 0.5, 0.15, lie);
    head.rotation.x = lerp(0, 0.18, lie);
    jaw.rotation.z = p.happy && walk < 0.5 ? Math.max(0, Math.sin(t * 1.3)) * 0.18 : 0;
    const blink = p.awake && Math.sin(t * 0.83) > 0.985 ? 0.12 : 1;
    eyes.forEach((e) => (e.scale.y = lerp(p.awake ? blink : 0.15, 0.15, lie)));
    ears.forEach((e, i) => {
      const twitch = Math.sin(t * 0.55 + i * 2) > 0.97 ? 0.4 : 0;
      e.rotation.z = twitch - perk * 0.3;
    });

    // queue : ondulation qui se propage, haute et joyeuse quand il est libre
    const energy = lerp(p.awake ? 1 : 0.35, 0.25, lie);
    tail.forEach((s, i) => {
      const k = i / tail.length;
      const base = i === 0 ? lerp(p.happy ? 0.25 : -0.95, -0.55, lie) : lerp(p.happy ? 0.1 : 0.13, 0.03, lie);
      s.rotation.z = base + Math.sin(t * 1.8 - i * 0.55) * 0.08 * energy * (1 + k);
      s.rotation.y = Math.sin(t * (p.happy ? 3 : 1.6) - i * 0.7) * 0.22 * energy * (0.4 + k) + (i === 0 ? lerp(0, 0.9, lie) : lerp(0, 0.12, lie));
    });
  }

  return { root, body, head, pose };
}

// ================================================================ modèle 3D fourni (facultatif)

/**
 * Dépose un fichier public/models/tiger.glb (modèle riggé et animé, par exemple sorti de Meshy ou Tripo)
 * et il remplace automatiquement le tigre en formes simples.
 * Les animations sont reconnues par leur nom : walk, idle, sleep / lie / rest, sit, jump / happy.
 */
const MODEL_URL = '/models/tiger.glb';
const MODEL_LENGTH = 2.3; // longueur voulue, en unités du décor
const MODEL_YAW = -Math.PI / 2; // la plupart des modèles regardent vers +z ; le décor attend -x

async function loadModel() {
  try {
    const head = await fetch(MODEL_URL, { method: 'HEAD' });
    if (!head.ok || !(head.headers.get('content-type') ?? '').match(/gltf|octet|model/)) return null;
    return await new GLTFLoader().loadAsync(MODEL_URL);
  } catch {
    return null;
  }
}

function rigModel(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) {
  const wrapper = new THREE.Group();
  const inner = gltf.scene;
  // mise à l'échelle et pieds au sol
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const s = MODEL_LENGTH / Math.max(size.x, size.z, 0.001);
  inner.scale.multiplyScalar(s);
  box.setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  wrapper.add(inner);
  wrapper.rotation.y = MODEL_YAW;
  wrapper.scale.setScalar(1 / 0.85); // compense l'échelle du tigre en formes simples

  const mixer = new THREE.AnimationMixer(inner);
  const find = (...keys: string[]) => gltf.animations.find((a) => keys.some((k) => a.name.toLowerCase().includes(k)));
  const clips = {
    idle: find('idle', 'stand', 'breath') ?? gltf.animations[0],
    walk: find('walk', 'trot', 'run'),
    sleep: find('sleep', 'lie', 'lay', 'rest'),
    sit: find('sit'),
    happy: find('jump', 'happy', 'play', 'roar'),
  };
  const actions = new Map<THREE.AnimationClip, THREE.AnimationAction>();
  const act = (clip?: THREE.AnimationClip) => {
    if (!clip) return null;
    if (!actions.has(clip)) actions.set(clip, mixer.clipAction(clip));
    return actions.get(clip)!;
  };
  let current: THREE.AnimationAction | null = null;
  const play = (clip?: THREE.AnimationClip, speed = 1) => {
    const a = act(clip);
    if (!a) return;
    a.timeScale = speed;
    if (a === current) return;
    a.reset().play();
    if (current) a.crossFadeFrom(current, 0.45, true);
    current = a;
  };

  // la tête, pour la mise au point et le regard
  let head: THREE.Object3D = wrapper;
  inner.traverse((o) => {
    if ((o as THREE.Bone).isBone && /head/i.test(o.name) && head === wrapper) head = o;
  });
  const headRest = head !== wrapper ? head.quaternion.clone() : null;
  const yawQ = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  return {
    wrapper,
    head,
    update(dt: number, s: { moving: boolean; sleeping: boolean; happy: boolean; look: number; perk: number }) {
      if (s.moving) play(clips.walk ?? clips.idle);
      else if (s.sleeping) play(clips.sleep ?? clips.sit ?? clips.idle, clips.sleep ? 1 : 0.4);
      else if (s.happy && clips.happy && Math.sin(performance.now() / 2400) > 0.6) play(clips.happy);
      else play(clips.sit && !s.happy ? clips.sit : clips.idle);
      // on retire le regard ajouté à l'image précédente, puis l'animation joue, puis on le rajoute
      if (headRest) head.quaternion.multiply(yawQ.invert());
      mixer.update(dt);
      yawQ.setFromAxisAngle(up, s.sleeping ? 0 : s.look * 0.8);
      if (headRest) head.quaternion.multiply(yawQ);
    },
  };
}

export type World = ReturnType<typeof createWorld>;
