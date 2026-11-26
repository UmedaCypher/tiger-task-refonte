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
  dawn: { top: '#9cc0ea', mid: '#f5c3c2', low: '#fbdcc4', fog: '#f2d2c4', hemiSky: '#ffe9e4', hemiGround: '#c9a08c', sun: '#ffdcb4', sunI: 3.6, hemiI: 1.35, water: '#6fa6d6' },
  gold: { top: '#b3cbe9', mid: '#f8cf9e', low: '#fde3bb', fog: '#f6d6ad', hemiSky: '#fff0d4', hemiGround: '#c99a70', sun: '#ffc97e', sunI: 4.0, hemiI: 1.45, water: '#7fb2d8' },
  night: { top: '#121531', mid: '#33284f', low: '#64415a', fog: '#4b3352', hemiSky: '#8f84c8', hemiGround: '#2c2140', sun: '#cdd6ff', sunI: 0.7, hemiI: 1.0, water: '#3d3e6e' },
};
type Palette = typeof MOODS.dawn;

// ------------------------------------------------------------------ relief

const LAKE_X = (z: number) => 0.6 + Math.sin(z * 0.09 + 0.6) * 2.6;
const LAKE_W = (z: number) => 1.7 + Math.max(0, 6 - z) * 0.11 + Math.max(0, -z - 12) * 0.35;
const SHORE = (z: number) => LAKE_X(z) + LAKE_W(z) + 1.35;
const HOME = { x: SHORE(5.6) + 1.2, z: 5.6 }; // la place du tigre, près du grand arbre
const PATH = { z: 5.9, a: SHORE(5.9) - 0.2, b: SHORE(5.9) + 3.6 }; // la rive qu'il arpente
// ---- cadrage : la caméra garde la même largeur de champ quelle que soit la forme de la fenêtre
const CAM_Z = 30;
const H_TAN = Math.tan(THREE.MathUtils.degToRad(14)) * 1.78; // largeur de champ d'un écran 16:9
function layout(aspect: number, narrow: boolean) {
  const vfov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(H_TAN / aspect)), 9, 34);
  const hTan = Math.tan(THREE.MathUtils.degToRad(vfov / 2)) * aspect;
  const halfAt = hTan * (CAM_Z - HOME.z);
  return { vfov, offset: halfAt * (narrow ? 0.3 : 0.46) - HOME.x };
}
// la scène n'existe que dans un V qui suit le champ de vision : étroit devant, large au fond
const V_CX = HOME.x - 3;
const inV = (x: number, z: number, margin = 3) => Math.abs(x - V_CX) < 0.56 * (CAM_Z - z) + margin;
/** Ne garde que les faces d'une géométrie (non indexée) qui tombent dans le champ */
function cullToV(g: THREE.BufferGeometry, margin = 4) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const c = g.attributes.color as THREE.BufferAttribute | undefined;
  const keepP: number[] = [];
  const keepC: number[] = [];
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    if (!inV(x, z, margin)) continue;
    for (let j = 0; j < 3; j++) {
      keepP.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j));
      if (c) keepC.push(c.getX(i + j), c.getY(i + j), c.getZ(i + j));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
  if (c) out.setAttribute('color', new THREE.Float32BufferAttribute(keepC, 3));
  out.computeVertexNormals();
  return out;
}

/** Garde dégagés la place du tigre et son chemin, pour qu'aucun objet ne le cache */
const clear = (x: number, z: number) =>
  Math.hypot(x - HOME.x, z - HOME.z) > 2.4 && !(z > PATH.z - 1.6 && z < PATH.z + 3.5 && x > PATH.a - 1.2 && x < PATH.b + 1.6);
function height(x: number, z: number) {
  const dx = Math.abs(x - LAKE_X(z));
  const w = LAKE_W(z);
  const far = Math.max(0, -z - 8);
  // dunes : des crêtes vives, longues et ondulées, plus hautes en s'éloignant de l'eau
  const crest = (f: number, a: number, p: number) => Math.pow(1 - Math.abs(Math.sin(x * f + z * a + Math.sin(z * 0.11 + p) * 1.3 + p)), 1.8);
  const dunes = crest(0.2, 0.13, 0) * 1.5 + crest(0.37, -0.09, 2.1) * 0.6;
  const land = 0.22 + dunes * smooth(w + 1.2, w + 7, dx) * (1 + far * 0.04) + far * 0.02;
  return lerp(-0.9, land, smooth(w, w + 1.4, dx));
}

// ------------------------------------------------------------------ monde

export function createWorld(canvas: HTMLCanvasElement, opts: { reduced: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  const small = Math.min(innerWidth, innerHeight) < 600;
  const dpr = Math.min(devicePixelRatio, small ? 1 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(MOODS.dawn.fog, 38, 150);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);
  const camBase = new THREE.Vector3(0, 8.5, CAM_Z);
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
  sun.shadow.mapSize.set(small ? 512 : 1024, small ? 512 : 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 60 });
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---- sol : fin au premier plan, grossier au loin (le flou et la brume font le reste)
  const groundPiece = (depth: number, zCenter: number, segX: number, segZ: number, edgeZ: number) => {
    const g = new THREE.PlaneGeometry(140, depth, segX, segZ).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, zCenter);
    const p = g.attributes.position as THREE.BufferAttribute;
    const jit = new Map<string, number>();
    const amp = segX > 100 ? 0.22 : 0.4;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const k = `${x.toFixed(2)}:${z.toFixed(2)}`;
      // pas de relief aléatoire sur la couture entre les deux morceaux
      if (!jit.has(k)) jit.set(k, Math.abs(z - edgeZ) < 0.01 ? 0 : (rnd() - 0.5) * amp);
      p.setY(i, height(x, z) + jit.get(k)!);
    }
    const sand = ['#eac391', '#e5bb86', '#efcb9a'];
    const wet = ['#c9a47c', '#d1ad85'];
    const crest = ['#f3d4a6', '#f0cf9f'];
    const far = ['#dcb39a', '#d6ab95', '#e0bba2'];
    const geo = facet(g, (x, y, z) => {
      if (y < -0.12) return vary('#b99671', 0.04);
      if (y < 0.3 && Math.abs(x - LAKE_X(z)) < LAKE_W(z) + 1.6) return vary(pick(wet), 0.04);
      if (z < -40) return vary(pick(far), 0.04);
      if (y > 1.3) return vary(pick(crest), 0.03);
      return vary(pick(sand), 0.035);
    });
    const m = new THREE.Mesh(cullToV(geo), facetMat);
    m.receiveShadow = true;
    m.userData.keep = true;
    land.add(m);
  };
  groundPiece(28, 0, 150, 32, -14); // devant : grandes facettes nettes
  groundPiece(84, -56, 56, 26, -14); // fond, plus grossier

  // ---- eau
  const water = (() => {
    const plane = new THREE.PlaneGeometry(140, 110, 100, 70).toNonIndexed();
    plane.rotateX(-Math.PI / 2);
    plane.translate(0, -0.05, -41);
    const g = cullToV(plane);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color: MOODS.dawn.water, flatShading: true, roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.96 }),
    );
    m.receiveShadow = true;
    m.userData.keep = true;
    m.userData.base = Float32Array.from((g.attributes.position as THREE.BufferAttribute).array);
    land.add(m);
    return m;
  })();

  // ---- montagnes lointaines : de grands pics à facettes, sommets enneigés
  for (let i = 0; i < 11; i++) {
    const h = range(12, 24);
    const rad = range(10, 18);
    const g = new THREE.ConeGeometry(rad, h, 7, 4);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < p.count; j++) {
      const y = p.getY(j);
      if (y > -h / 2 + 0.1 && y < h / 2 - 0.1) p.setXYZ(j, p.getX(j) + range(-1.4, 1.4), y + range(-0.8, 0.8), p.getZ(j) + range(-1.4, 1.4));
    }
    const snow = range(0.15, 0.3);
    const m = new THREE.Mesh(
      facet(g, (_x, y) => (y > h / 2 - h * snow ? vary('#f3eee8', 0.03) : vary(pick(['#a9a3c6', '#b7a8c6', '#9e9bbf', '#c2a9bd']), 0.05))),
      facetMat,
    );
    m.position.set(-90 + i * 18 + range(-6, 6), h / 2 - 3, range(-100, -78));
    m.rotation.y = rnd() * 6;
    land.add(m);
  }

  // ---- grands rochers : mesas et monolithes de grès, en couches
  const swaying: THREE.Object3D[] = [];
  const mesa = (x: number, z: number, h: number, r: number) => {
    const grp = new THREE.Group();
    const layers = Math.max(2, Math.round(h / 1.6));
    const rot = rnd() * 6;
    const sides = Math.floor(range(6, 9));
    let y = 0;
    for (let k = 0; k < layers; k++) {
      const lh = h / layers;
      const rr = r * (1 - k * 0.12) * range(0.9, 1.05);
      const g = new THREE.CylinderGeometry(rr * range(0.86, 0.94), rr, lh, sides, 1);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < p.count; j++) p.setXYZ(j, p.getX(j) + range(-0.12, 0.12) * r, p.getY(j), p.getZ(j) + range(-0.12, 0.12) * r);
      const base = pick(['#c98d6e', '#bf7f62', '#d39a7a', '#b8775c']);
      const layer = new THREE.Mesh(facet(g, (_x, yy) => (yy > lh / 2 - 0.01 ? vary('#e0b493', 0.04) : vary(base, 0.06))), facetMat);
      layer.position.y = y + lh / 2;
      layer.rotation.y = rot + range(-0.08, 0.08);
      grp.add(layer);
      y += lh * 0.98;
    }
    grp.position.set(x, height(x, z) - 0.3, z);
    shadows(grp, true, true);
    land.add(grp);
  };
  // au loin, de part et d'autre du lac
  for (let i = 0; i < 9; i++) {
    const z = range(-70, -22);
    const side = rnd() > 0.35 ? 1 : -1;
    const x = LAKE_X(z) + side * (LAKE_W(z) + range(4, 18));
    mesa(x, z, range(4, 11), range(1.6, 3.4));
  }
  // plus près, quelques blocs qui cadrent la scène
  mesa(HOME.x + 4.2, HOME.z - 5.5, 3.6, 1.4);
  mesa(LAKE_X(-12) - LAKE_W(-12) - 4, -12, 3.2, 1.8);

  // ---- dalles de pierre au bord de l'eau
  for (let i = 0; i < 5; i++) {
    const z = range(-10, 4);
    const side = i % 2 ? -1 : 1;
    const x = LAKE_X(z) + side * (LAKE_W(z) + range(0.2, 1.4));
    if (!clear(x, z)) continue;
    const grp = new THREE.Group();
    const n = Math.floor(range(2, 4));
    for (let k = 0; k < n; k++) {
      const g = new THREE.BoxGeometry(range(1.4, 2.4) * (1 - k * 0.2), range(0.3, 0.45), range(1, 1.6) * (1 - k * 0.15), 1, 1, 1);
      const pp = g.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < pp.count; j++) pp.setXYZ(j, pp.getX(j) + range(-0.1, 0.1), pp.getY(j) + range(-0.04, 0.04), pp.getZ(j) + range(-0.1, 0.1));
      const slab = new THREE.Mesh(facet(g, (_x, y) => vary(y > 0.1 ? '#d6a785' : '#b98466', 0.05)), facetMat);
      slab.position.set(range(-0.2, 0.2), 0.1 + k * 0.36, range(-0.15, 0.15));
      slab.rotation.y = range(-0.3, 0.3);
      grp.add(slab);
    }
    grp.position.set(x, Math.max(height(x, z), -0.4) - 0.1, z);
    grp.rotation.y = rnd() * 6;
    shadows(grp, true, true);
    land.add(grp);
  }

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

  // tout ce qui tombe hors du champ est retiré
  for (const o of [...land.children]) {
    if (o.userData.keep || (o as THREE.InstancedMesh).isInstancedMesh || o instanceof THREE.Points) continue;
    if (!inV(o.position.x, o.position.z, 2)) land.remove(o);
  }

  // ================================================================ le tigre
  const T = buildTiger();
  const tiger = T.root;
  land.add(tiger);
  const home = HOME;
  const path = PATH;
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
    // le tigre se place aux trois quarts de l'écran (au centre-droit sur mobile)
    const L = layout(camera.aspect, w < 700);
    camera.fov = L.vfov;
    camera.updateProjectionMatrix();
    land.position.x = L.offset;
    hBlur.uniforms.h.value = 3.4 / w;
    vBlur.uniforms.v.value = 3.4 / Math.max(h, w * 0.5);
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
    // fenêtre très basse : la caméra se resserre et vise le tigre pour qu'il reste à l'image
    const tight = smooth(26, 12, camera.fov);
    camera.lookAt(
      lerp(camLook.x, tiger.position.x + land.position.x - 3.2, tight),
      lerp(camLook.y, tiger.position.y + 0.6, tight),
      lerp(camLook.z, tiger.position.z, tight),
    );

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

/** Un volume « extrudé » le long de x : une suite d'ellipses [x, centreY, rayonY, rayonZ] reliées par des facettes */
function loft(rings: [number, number, number, number][], seg = 12, wobble = 0.012) {
  const pts: THREE.Vector3[][] = rings.map(([x, cy, ry, rz], ri) =>
    Array.from({ length: seg }, (_, i) => {
      const a = (i / seg) * Math.PI * 2 + (ri % 2) * (Math.PI / seg);
      const n = ri === 0 || ri === rings.length - 1 ? 0 : (rnd() - 0.5) * wobble;
      return new THREE.Vector3(x + n, cy + Math.sin(a) * (ry + n), Math.cos(a) * (rz + n));
    }),
  );
  const v: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => v.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let r = 0; r < pts.length - 1; r++)
    for (let i = 0; i < seg; i++) {
      const a = pts[r][i], b = pts[r][(i + 1) % seg], c = pts[r + 1][i], d = pts[r + 1][(i + 1) % seg];
      tri(a, c, b);
      tri(b, c, d);
    }
  const cap = (ring: THREE.Vector3[], flip: boolean) => {
    const ctr = ring.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(ring.length);
    for (let i = 0; i < seg; i++) (flip ? tri(ctr, ring[(i + 1) % seg], ring[i]) : tri(ctr, ring[i], ring[(i + 1) % seg]));
  };
  cap(pts[0], false);
  cap(pts[pts.length - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

function buildTiger() {
  const ORANGE = '#ee8a3a';
  const DEEP = '#d9702a';
  const WHITE = '#f6efe6';
  const STRIPE = '#2a1b16';
  const mesh = (g: THREE.BufferGeometry, color: (x: number, y: number, z: number) => THREE.ColorRepresentation) => new THREE.Mesh(facet(g, color), facetMat);
  // rayures en chevrons qui partent du dos et s'affinent vers le ventre
  const coat = (freq: number, phase: number, belly: number, top: number) => (x: number, y: number, z: number) => {
    if (y < belly) return vary(WHITE, 0.03);
    const h = (y - belly) / (top - belly); // 0 au ventre, 1 au dos
    const wave = x * freq + phase + Math.abs(z) * 3.2 + Math.sin(y * 9) * 0.35;
    const band = Math.sin(wave);
    if (band > 0.96 - h * 0.14 && h > 0.25) return vary(STRIPE, 0.02);
    return vary(h > 0.45 ? ORANGE : DEEP, 0.045);
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // hanches et poitrail : deux volumes sculptés qui se chevauchent, pour que le dos se plie en marchant
  const hips = new THREE.Group();
  hips.position.set(0.48, 1.06, 0);
  hips.add(
    mesh(
      loft([
        [-0.42, -0.02, 0.27, 0.25],
        [-0.15, 0, 0.31, 0.28],
        [0.12, 0.04, 0.35, 0.31],
        [0.34, 0.03, 0.34, 0.3],
        [0.52, -0.02, 0.26, 0.24],
        [0.62, -0.05, 0.13, 0.13],
      ], 14),
      coat(15, 0.4, -0.2, 0.36),
    ),
  );
  const chest = new THREE.Group();
  chest.position.set(-0.4, 1.08, 0);
  chest.add(
    mesh(
      loft([
        [0.44, -0.02, 0.27, 0.25],
        [0.2, 0.02, 0.33, 0.3],
        [-0.02, 0.07, 0.4, 0.34],
        [-0.22, 0.05, 0.41, 0.34],
        [-0.42, 0, 0.35, 0.3],
        [-0.56, -0.04, 0.2, 0.2],
      ], 14),
      (x, y, z) => (x < -0.36 && y < 0.12 ? vary(WHITE, 0.03) : coat(14, 1.6, -0.22, 0.45)(x, y, z)),
    ),
  );
  body.add(hips, chest);

  // cou et tête
  const neck = new THREE.Group();
  neck.position.set(-0.44, 0.12, 0);
  chest.add(neck);
  const neckMesh = mesh(
    loft([
      [0.12, -0.04, 0.27, 0.25],
      [-0.08, 0.02, 0.26, 0.24],
      [-0.28, 0.07, 0.22, 0.21],
    ], 12),
    (x, y, z) => (y < -0.06 ? vary(WHITE, 0.03) : coat(18, 0.2, -0.1, 0.3)(x, y, z)),
  );
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.set(-0.32, 0.12, 0);
  neck.add(head);
  head.add(
    mesh(
      loft([
        [0.22, 0.02, 0.17, 0.19],
        [0.12, 0.04, 0.27, 0.3],
        [-0.02, 0.03, 0.3, 0.33],
        [-0.16, 0, 0.26, 0.28],
        [-0.27, -0.04, 0.17, 0.2],
        [-0.37, -0.06, 0.11, 0.14],
        [-0.43, -0.07, 0.05, 0.07],
      ], 14),
      (x, y, z) => {
        const az = Math.abs(z);
        if (y < -0.1) return vary(WHITE, 0.03); // menton
        if (x < -0.24 && y < 0.03) return vary(WHITE, 0.03); // museau
        if (x < -0.02 && x > -0.26 && az > 0.18 && y < 0.05) return vary(WHITE, 0.03); // joues
        if (x < -0.06 && x > -0.2 && y > 0.07 && y < 0.15 && az > 0.07 && az < 0.22) return vary(WHITE, 0.03); // sourcils
        if (y > 0.14 && Math.sin(az * 48 + x * 6) > 0.55) return STRIPE; // front
        if (az > 0.22 && Math.sin(y * 34 - x * 9) > 0.6 && x > -0.12) return STRIPE; // tempes
        return vary(x < -0.2 ? DEEP : ORANGE, 0.04);
      },
    ),
  );
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.06, 3).rotateZ(Math.PI / 2).rotateX(Math.PI / 6), solid('#b96a62'));
  nose.position.set(-0.44, -0.035, 0);
  head.add(nose);
  const jaw = new THREE.Group();
  jaw.position.set(-0.1, -0.14, 0);
  const jawMesh = mesh(loft([[0.02, 0, 0.05, 0.13], [-0.14, -0.01, 0.05, 0.1], [-0.26, 0, 0.03, 0.05]], 10), () => vary(WHITE, 0.03));
  jaw.add(jawMesh);
  head.add(jaw);
  // collerette blanche : des mèches qui pointent vers l'arrière
  [1, -1].forEach((s) => {
    for (let i = 0; i < 3; i++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), solid(i === 1 ? '#efe4d6' : WHITE));
      tuft.position.set(0.04 + i * 0.03, -0.06 - i * 0.05, 0.27 * s);
      tuft.rotation.set(0.9 * s, 0, -1.9 + i * 0.25);
      head.add(tuft);
    }
  });
  const ears: THREE.Group[] = [];
  const eyes: THREE.Mesh[] = [];
  [1, -1].forEach((s) => {
    const ear = new THREE.Group();
    ear.position.set(0.06, 0.25, 0.17 * s);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.17, 5), solid(STRIPE));
    outer.position.y = 0.07;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 5), solid(WHITE));
    inner.position.set(-0.03, 0.06, 0);
    ear.add(outer, inner);
    ear.rotation.x = 0.3 * s;
    ears.push(ear);
    head.add(ear);
    const eye = new THREE.Group();
    const iris = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.02), solid('#e0a83a', { emissive: '#6a4a10', emissiveIntensity: 0.4 }));
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.022), solid('#1a120e'));
    pupil.position.x = -0.005;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.024), solid(STRIPE));
    lid.position.y = 0.026;
    eye.add(iris, pupil, lid);
    eye.position.set(-0.24, 0.08, 0.17 * s);
    eye.rotation.y = -0.55 * s;
    eyes.push(iris, pupil);
    head.add(eye);
  });

  // pattes : cuisse musclée → jambe → patte avec doigts et griffes
  interface Leg { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group; front: boolean; offset: number }
  const legs: Leg[] = [];
  const limb = (rings: [number, number, number, number][], color: (x: number, y: number, z: number) => THREE.ColorRepresentation) => {
    const g = loft(rings, 9, 0.008);
    g.rotateZ(-Math.PI / 2); // de l'axe x vers le bas
    return mesh(g, color);
  };
  const legCoat = (inner: number, freq: number) => (x: number, y: number, z: number) => {
    if (z * inner > 0.05) return vary(WHITE, 0.03);
    if (Math.sin(y * freq + x * 4) > 0.82) return STRIPE;
    return vary(ORANGE, 0.045);
  };
  const makeLeg = (parent: THREE.Group, x: number, y: number, z: number, front: boolean, offset: number) => {
    const side = Math.sign(z);
    const hip = new THREE.Group();
    hip.position.set(x, y, z);
    hip.add(
      limb(
        front
          ? [[-0.06, 0, 0.17, 0.13], [0.12, 0.01, 0.16, 0.12], [0.3, 0, 0.12, 0.1], [0.47, 0, 0.1, 0.085]]
          : [[-0.08, 0.02, 0.22, 0.15], [0.12, 0.03, 0.2, 0.14], [0.3, 0.01, 0.13, 0.1], [0.47, 0, 0.095, 0.08]],
        legCoat(-side, 22),
      ),
    );
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    hip.add(knee);
    knee.add(limb([[0, 0, 0.1, 0.085], [0.2, 0, 0.085, 0.075], [0.43, 0, 0.08, 0.072]], front ? legCoat(-side, 26) : (_x, _y, zz) => vary(zz * -side > 0 || !front ? WHITE : ORANGE, 0.03)));
    const ankle = new THREE.Group();
    ankle.position.y = -0.42;
    knee.add(ankle);
    const paw = mesh(loft([[0.08, 0.02, 0.06, 0.1], [-0.04, 0.0, 0.07, 0.11], [-0.15, -0.02, 0.045, 0.1]], 8), (_x, y) => vary(y < -0.01 ? WHITE : ORANGE, 0.04));
    paw.position.y = -0.03;
    ankle.add(paw);
    for (let k = -1; k <= 1; k++) {
      const toe = blob(0.04, 0, 1.2, 0.8, 1, () => vary(WHITE, 0.03));
      toe.position.set(-0.17, -0.045, k * 0.055);
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.035, 3).rotateZ(Math.PI / 2), solid('#2a1b16'));
      claw.position.set(-0.215, -0.06, k * 0.055);
      ankle.add(toe, claw);
    }
    parent.add(hip);
    legs.push({ hip, knee, ankle, front, offset });
  };
  makeLeg(chest, -0.18, -0.24, 0.2, true, 0.25);
  makeLeg(chest, -0.18, -0.24, -0.2, true, 0.75);
  makeLeg(hips, 0.16, -0.2, 0.19, false, 0);
  makeLeg(hips, 0.16, -0.2, -0.19, false, 0.5);

  // queue : 10 anneaux, blanche et noire au bout
  const tail: THREE.Group[] = [];
  let parent: THREE.Object3D = hips;
  const ring = (i: number) => (i >= 9 ? STRIPE : i >= 6 ? (i % 2 ? WHITE : STRIPE) : i % 2 ? STRIPE : ORANGE);
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    g.position.set(i === 0 ? 0.58 : 0.14, i === 0 ? 0.1 : 0, 0);
    const r = 0.075 - i * 0.0035;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, 0.15, 7).rotateZ(Math.PI / 2).translate(0.07, 0, 0), solid(ring(i))));
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
    // épaules qui roulent en marchant
    chest.position.y = 1.08 + walk * Math.sin(phase * 2) * 0.015;

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
    eyes.forEach((e) => (e.scale.y = lerp(p.awake ? blink : 0.1, 0.1, lie)));
    ears.forEach((e, i) => {
      const twitch = Math.sin(t * 0.55 + i * 2) > 0.97 ? 0.4 : 0;
      e.rotation.z = twitch - perk * 0.3;
    });

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
