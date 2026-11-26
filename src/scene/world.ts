import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';

/**
 * Le décor : une étendue zen en low poly (au choix : lac, dunes, neige, océan, collines)
 * et la tête du tigre, sculptée à facettes, qui dort, se réveille, te suit du regard et sourit quand tu es libre.
 * Un flou de maquette (tilt-shift) garde la netteté sur le tigre. Tout est construit en code.
 */

export type Mood = 'sleep' | 'awake' | 'free';
export interface WorldState {
  progress: number; // 0..1, avancement du jour
  mood: Mood;
  night: boolean;
}
export type Biome = 'lac' | 'dunes' | 'neige' | 'ocean' | 'collines';
export const BIOMES: { id: Biome; name: string }[] = [
  { id: 'lac', name: 'Lac miroir' },
  { id: 'dunes', name: 'Dunes' },
  { id: 'neige', name: 'Neige' },
  { id: 'ocean', name: 'Océan' },
  { id: 'collines', name: 'Collines dans la brume' },
];

// ------------------------------------------------------------------ outils

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const range = (a: number, b: number) => a + rnd() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (a: number, m: number, s: number) => Math.exp(-(((a - m) / s) ** 2));
const lerp = THREE.MathUtils.lerp;
const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

const facetMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
const solid = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...extra });

type ColorAt = (x: number, y: number, z: number, ny: number) => THREE.ColorRepresentation;
/** Colore une géométrie face par face (aspect low poly) ; ny = horizontalité de la face (1 = à plat) */
function facet(geo: THREE.BufferGeometry, colorAt: ColorAt) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    d.fromBufferAttribute(p, i + 2);
    const cx = (a.x + b.x + d.x) / 3, cy = (a.y + b.y + d.y) / 3, cz = (a.z + b.z + d.z) / 3;
    const n = e1.subVectors(b, a).cross(e2.subVectors(d, a)).normalize();
    c.set(colorAt(cx, cy, cz, Math.abs(n.y)));
    for (let j = 0; j < 3; j++) c.toArray(cols, (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}
const vary = (hex: string, amount = 0.05) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h + (rnd() - 0.5) * amount * 0.25, hsl.s, Math.min(1, Math.max(0, hsl.l + (rnd() - 0.5) * amount)));
};
const shadows = (o: THREE.Object3D, cast = true, receive = false) =>
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });

// ------------------------------------------------------------------ cadrage

const CAM_Z = 30;
const HOME = { x: 6.4, z: 6 }; // la place du tigre
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
/** Un petit replat là où pose la tête du tigre */
const nearHome = (x: number, z: number) => 1 - smooth(2.6, 5.5, Math.hypot(x - HOME.x, (z - HOME.z) * 0.8 + 0.8));

// ------------------------------------------------------------------ biomes

interface Light {
  top: string;
  mid: string;
  low: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
  sunI: number;
  hemiI: number;
  water: string;
}
interface BiomeDef {
  height: (x: number, z: number) => number;
  color: ColorAt;
  water?: { level: number; opacity: number; rough: number; waves: number };
  fog: [number, number];
  light: { dawn: Light; gold: Light; night: Light };
  extras?: (land: THREE.Group) => void;
}
const NIGHT: Light = { top: '#121531', mid: '#2e2650', low: '#5a3f5c', fog: '#45304f', hemiSky: '#8f84c8', hemiGround: '#2c2140', sun: '#cdd6ff', sunI: 0.75, hemiI: 1.0, water: '#3b3d6e' };

/** Un pic à facettes (option : sommet enneigé) */
function peak(land: THREE.Group, x: number, z: number, h: number, r: number, base: string[], snow = 0) {
  const g = new THREE.ConeGeometry(r, h, 7, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let j = 0; j < p.count; j++) {
    const y = p.getY(j);
    if (y > -h / 2 + 0.1 && y < h / 2 - 0.1) p.setXYZ(j, p.getX(j) + range(-0.1, 0.1) * r, y + range(-0.05, 0.05) * h, p.getZ(j) + range(-0.1, 0.1) * r);
  }
  const m = new THREE.Mesh(facet(g, (_x, y) => (snow && y > h / 2 - h * snow ? vary('#f4f1ee', 0.03) : vary(pick(base), 0.05))), facetMat);
  m.position.set(x, h / 2 - 2.5, z);
  m.rotation.y = rnd() * 6;
  land.add(m);
}
/** Un galet zen, lisse à grandes facettes */
function stone(land: THREE.Group, x: number, y: number, z: number, s: number, colors: string[]) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  g.scale(s * range(1.1, 1.5), s * range(0.45, 0.65), s * range(0.9, 1.2));
  const m = new THREE.Mesh(facet(g, () => vary(pick(colors), 0.04)), facetMat);
  m.position.set(x, y, z);
  m.rotation.y = rnd() * 6;
  shadows(m, true, true);
  land.add(m);
}

const BIOME_DEFS: Record<Biome, BiomeDef> = {
  // ---- un grand lac immobile, des rives douces, des montagnes au loin
  lac: {
    height: (x, z) => {
      const d = ((x - 0.5) / 15) ** 2 + ((z + 22) / 28) ** 2;
      const shore = smooth(0.82, 1.05, d);
      const far = Math.max(0, -z - 30);
      const h = lerp(-0.7, 0.15 + 0.25 * Math.sin(x * 0.3 + z * 0.2) ** 2 + far * 0.05, shore);
      return lerp(h, 0.12, nearHome(x, z));
    },
    color: (_x, y, z, ny) => {
      if (y < -0.1) return vary('#9fa9a0', 0.04);
      if (y < 0.25) return vary('#e6d8bf', 0.04);
      if (ny < 0.85) return vary('#a8b08a', 0.05);
      return vary(z < -35 ? '#b5b3a6' : pick(['#c3c79a', '#b8bf8f', '#cdcda4']), 0.04);
    },
    water: { level: 0, opacity: 0.92, rough: 0.08, waves: 0.012 },
    fog: [40, 150],
    light: {
      dawn: { top: '#9cc0ea', mid: '#f4c8c6', low: '#fbe0cc', fog: '#f1dccf', hemiSky: '#fff0ea', hemiGround: '#c9b0a0', sun: '#ffdfbd', sunI: 3.2, hemiI: 1.45, water: '#8fb6dc' },
      gold: { top: '#b3cbe9', mid: '#f8d2a6', low: '#fde6c2', fog: '#f5dcb8', hemiSky: '#fff3d8', hemiGround: '#c9a07a', sun: '#ffcc84', sunI: 3.8, hemiI: 1.5, water: '#9cc0dc' },
      night: NIGHT,
    },
    extras: (land) => {
      for (let i = 0; i < 9; i++) peak(land, -70 + i * 17 + range(-5, 5), range(-95, -75), range(10, 20), range(10, 16), ['#a6a8c8', '#b3adc9', '#9c9fc0'], range(0.12, 0.25));
      stone(land, -1.5, -0.1, -6, 0.9, ['#8f8a8c', '#9b9597']);
      stone(land, 2.2, -0.15, -12, 1.3, ['#8f8a8c', '#a39c9b']);
      stone(land, HOME.x - 2.4, 0.05, HOME.z - 1.4, 0.55, ['#a29a96', '#b0a8a2']);
    },
  },

  // ---- des dunes à crêtes vives, rien d'autre
  dunes: {
    height: (x, z) => {
      const crest = (f: number, a: number, p: number) => Math.pow(1 - Math.abs(Math.sin(x * f + z * a + Math.sin(z * 0.11 + p) * 1.3 + p)), 1.8);
      const far = Math.max(0, -z - 8);
      const h = 0.2 + (crest(0.16, 0.1, 0) * 1.8 + crest(0.31, -0.08, 2.1) * 0.6) * (1 + far * 0.03);
      return lerp(h, 0.5, nearHome(x, z));
    },
    color: (_x, y, z, ny) => {
      if (z < -45) return vary('#e0b9a0', 0.04);
      if (ny < 0.8) return vary('#d9a776', 0.04);
      if (y > 1.6) return vary('#f4d6a8', 0.03);
      return vary(pick(['#ebc493', '#e6bd88', '#efcc9c']), 0.03);
    },
    fog: [40, 140],
    light: {
      dawn: { top: '#9cc0ea', mid: '#f5c3c2', low: '#fbdcc4', fog: '#f2d2c4', hemiSky: '#ffe9e4', hemiGround: '#c9a08c', sun: '#ffdcb4', sunI: 3.6, hemiI: 1.3, water: '#6fa6d6' },
      gold: { top: '#b3cbe9', mid: '#f8cf9e', low: '#fde3bb', fog: '#f6d6ad', hemiSky: '#fff0d4', hemiGround: '#c99a70', sun: '#ffc97e', sunI: 4.0, hemiI: 1.4, water: '#7fb2d8' },
      night: NIGHT,
    },
    extras: (land) => {
      const g = new THREE.CylinderGeometry(2.2, 2.8, 7, 7, 3);
      const m = new THREE.Mesh(facet(g, (_x, y) => vary(y > 3.4 ? '#e0b493' : pick(['#c98d6e', '#bf7f62']), 0.05)), facetMat);
      m.position.set(-6, 3, -55);
      land.add(m);
    },
  },

  // ---- un champ de neige, des pics bleutés, un lac gelé
  neige: {
    height: (x, z) => {
      const far = Math.max(0, -z - 10);
      const hills = 0.5 * Math.sin(x * 0.18 + 1) * Math.cos(z * 0.13) + 0.35 * Math.sin(x * 0.41 + z * 0.27);
      const lakeD = ((x + 1) / 9) ** 2 + ((z + 14) / 10) ** 2;
      const h = lerp(-0.05, 0.4 + Math.max(0, hills) + far * 0.06, smooth(0.9, 1.3, lakeD));
      return lerp(h, 0.3, nearHome(x, z));
    },
    color: (_x, y, _z, ny) => {
      if (y < 0.02) return vary('#cfe2ee', 0.03);
      if (ny < 0.82) return vary('#c7d3e6', 0.04);
      return vary(pick(['#f6f7fb', '#eef1f8', '#f9f6f6']), 0.025);
    },
    fog: [34, 130],
    light: {
      dawn: { top: '#a9c8ee', mid: '#f1d2dc', low: '#fae7e3', fog: '#eee2e6', hemiSky: '#f6f2ff', hemiGround: '#b9bfd6', sun: '#ffe2c9', sunI: 3.0, hemiI: 1.35, water: '#cfe2ee' },
      gold: { top: '#bcd3ee', mid: '#f7dcc0', low: '#fdeedc', fog: '#f4e6d8', hemiSky: '#fff6e8', hemiGround: '#c2bccd', sun: '#ffd49a', sunI: 3.4, hemiI: 1.4, water: '#d6e6ef' },
      night: { ...NIGHT, hemiGround: '#3a3f66', water: '#7b8bb8' },
    },
    extras: (land) => {
      for (let i = 0; i < 10; i++) peak(land, -75 + i * 16 + range(-5, 5), range(-92, -60), range(14, 26), range(9, 15), ['#a9b4d2', '#b8c0db', '#9aa6c8'], range(0.35, 0.55));
    },
  },

  // ---- une plage à l'aube, une mer qui ondule jusqu'à l'horizon, des îlots
  ocean: {
    height: (x, z) => {
      const beach = smooth(1.5, 5, z) * 0.55 - 0.9 + 0.12 * Math.sin(x * 0.5);
      return lerp(beach, 0.25, nearHome(x, z));
    },
    color: (_x, y) => (y < -0.15 ? vary('#d8c19c', 0.03) : vary(pick(['#f0dcb8', '#ead3ab', '#f3e2c2']), 0.03)),
    water: { level: 0, opacity: 0.95, rough: 0.2, waves: 0.09 },
    fog: [36, 140],
    light: {
      dawn: { top: '#8fb8e6', mid: '#f3bcc0', low: '#fdd9c0', fog: '#f0d2c6', hemiSky: '#ffece6', hemiGround: '#c2a89a', sun: '#ffd6aa', sunI: 3.3, hemiI: 1.45, water: '#5f9bd0' },
      gold: { top: '#a9c6ea', mid: '#f9c992', low: '#fde0b0', fog: '#f6d6ab', hemiSky: '#fff1d6', hemiGround: '#c39c74', sun: '#ffc070', sunI: 3.9, hemiI: 1.5, water: '#6aa6d4' },
      night: NIGHT,
    },
    extras: (land) => {
      const islet = (x: number, z: number, s: number) => {
        const g = new THREE.Group();
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s * (1 - k * 0.25), 0), solid(pick(['#9c8f8c', '#a99b95', '#8e8482'])));
          m.position.set(range(-0.3, 0.3) * s, s * (0.2 + k * 0.7), range(-0.3, 0.3) * s);
          m.scale.y = range(0.9, 1.3);
          g.add(m);
        }
        g.position.set(x, -0.4, z);
        shadows(g, true, true);
        land.add(g);
      };
      islet(-3, -18, 1.8);
      islet(5, -34, 2.6);
      islet(-14, -48, 3);
    },
  },

  // ---- des collines douces en terrasses, noyées dans la brume
  collines: {
    height: (x, z) => {
      const far = Math.max(0, -z + 2);
      const h = 0.6 * Math.sin(x * 0.22 + z * 0.05) + 0.5 * Math.cos(z * 0.21 + x * 0.07) + 0.9 + far * 0.09 + Math.sin(x * 0.09 - z * 0.12) * far * 0.04;
      const terr = Math.round(h * 2.2) / 2.2; // des terrasses, comme des rizières
      return lerp(lerp(h, terr, 0.6), 0.9, nearHome(x, z));
    },
    color: (_x, _y, z, ny) => {
      const t = Math.min(1, Math.max(0, -z / 70));
      const base = new THREE.Color(ny < 0.8 ? '#8ea082' : '#a9b98f').lerp(new THREE.Color('#b9aec4'), t);
      return vary('#' + base.getHexString(), 0.04);
    },
    fog: [30, 120],
    light: {
      dawn: { top: '#a7c3e6', mid: '#f0d0d2', low: '#f8e4da', fog: '#efe0dc', hemiSky: '#fbf2ee', hemiGround: '#a8ae98', sun: '#ffe0c0', sunI: 2.9, hemiI: 1.5, water: '#9fbcd6' },
      gold: { top: '#b8cde8', mid: '#f6dcb4', low: '#fbebcc', fog: '#f3e2c6', hemiSky: '#fff6e2', hemiGround: '#aeaa86', sun: '#ffd089', sunI: 3.4, hemiI: 1.55, water: '#a9c4d8' },
      night: NIGHT,
    },
  },
};

// ------------------------------------------------------------------ monde

export function createWorld(canvas: HTMLCanvasElement, opts: { reduced: boolean; biome?: Biome }) {
  seed = 11;
  const B = BIOME_DEFS[opts.biome && BIOME_DEFS[opts.biome] ? opts.biome : 'lac'];
  const small = Math.min(innerWidth, innerHeight) < 600;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  const dpr = Math.min(devicePixelRatio, small ? 1 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(B.light.dawn.fog, B.fog[0], B.fog[1]);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);
  const camBase = new THREE.Vector3(0, 8.5, CAM_Z);
  const camLook = new THREE.Vector3(0, 1.6, -8);
  const land = new THREE.Group();
  scene.add(land);

  // ---- ciel
  const skyU = {
    top: { value: new THREE.Color() },
    mid: { value: new THREE.Color() },
    low: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0.4, 0.2, -1).normalize() },
    sunCol: { value: new THREE.Color('#fff4dc') },
    sunSize: { value: 1 },
  };
  scene.add(
    new THREE.Mesh(
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
    ),
  );

  // ---- lumières
  const hemi = new THREE.HemisphereLight('#fff', '#888', 1.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 512 : 1024, small ? 512 : 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 60 });
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---- sol : grandes facettes devant, plus grossier au loin
  const groundPiece = (depth: number, zCenter: number, segX: number, segZ: number, edgeZ: number) => {
    const g = new THREE.PlaneGeometry(150, depth, segX, segZ).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, zCenter);
    const p = g.attributes.position as THREE.BufferAttribute;
    const jit = new Map<string, number>();
    const amp = segX > 100 ? 0.18 : 0.3;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const k = `${x.toFixed(2)}:${z.toFixed(2)}`;
      if (!jit.has(k)) jit.set(k, Math.abs(z - edgeZ) < 0.01 ? 0 : (rnd() - 0.5) * amp * (1 - nearHome(x, z) * 0.8));
      p.setY(i, B.height(x, z) + jit.get(k)!);
    }
    const m = new THREE.Mesh(cullToV(facet(g, B.color)), facetMat);
    m.receiveShadow = true;
    land.add(m);
  };
  groundPiece(30, 1, 150, 30, -14);
  groundPiece(90, -59, 56, 26, -14);

  // ---- eau
  let water: THREE.Mesh | null = null;
  if (B.water) {
    const plane = new THREE.PlaneGeometry(150, 120, 110, 80).toNonIndexed();
    plane.rotateX(-Math.PI / 2);
    plane.translate(0, B.water.level - 0.05, -44);
    const g = cullToV(plane);
    water = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color: B.light.dawn.water, flatShading: true, roughness: B.water.rough, metalness: 0.1, transparent: true, opacity: B.water.opacity }),
    );
    water.receiveShadow = true;
    water.userData.base = Float32Array.from((g.attributes.position as THREE.BufferAttribute).array);
    land.add(water);
  }
  B.extras?.(land);

  // ---- nuages : de longues nappes à facettes
  const clouds: THREE.Mesh[] = [];
  const cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, transparent: true, opacity: 0.92, emissive: '#ffffff', emissiveIntensity: 0.35, fog: false });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(range(7, 13), range(0.6, 1), range(2, 4));
    const c = new THREE.Mesh(facet(g, (_x, y) => (y > 0 ? vary('#fff7f2', 0.03) : vary('#f6dcd8', 0.04))), cloudMat);
    c.position.set(range(-90, 90), range(18, 30), range(-120, -90));
    c.userData.speed = range(0.15, 0.35);
    clouds.push(c);
    scene.add(c);
  }

  // ---- lucioles, la nuit
  const flyCount = 50;
  const flyPos = new Float32Array(flyCount * 3);
  for (let i = 0; i < flyCount; i++) flyPos.set([HOME.x + range(-9, 4), range(0.4, 3), HOME.z + range(-9, 3)], i * 3);
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flyMat = new THREE.PointsMaterial({ color: '#ffe9a8', size: 0.09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  land.add(new THREE.Points(flyGeo, flyMat));

  // le point de mise au point du décor : là où était le tigre
  const anchor = new THREE.Object3D();
  anchor.position.set(HOME.x, B.height(HOME.x, HOME.z) + 0.6, HOME.z);
  land.add(anchor);

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
    const L = layout(camera.aspect, w < 700);
    camera.fov = L.vfov;
    camera.updateProjectionMatrix();
    land.position.x = L.offset;
    hBlur.uniforms.h.value = 3.2 / w;
    vBlur.uniforms.v.value = 3.2 / Math.max(h, w * 0.5);
  };
  resize();

  const tmp = new THREE.Color();
  const tmp2 = new THREE.Color();
  const blend = (key: keyof Light, p: number, n: number) =>
    tmp.set(B.light.dawn[key] as string).lerp(tmp2.set(B.light.gold[key] as string), p).lerp(tmp2.set(B.light.night[key] as string), n);
  const num = (key: 'sunI' | 'hemiI', p: number, n: number) => lerp(lerp(B.light.dawn[key], B.light.gold[key], p), B.light.night[key], n);
  const focusPos = new THREE.Vector3();
  const sunDir = new THREE.Vector3();

  const clock = new THREE.Clock();
  let raf = 0;
  const frame = () => {
    const dt = opts.reduced ? 1 : Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    cur.progress = opts.reduced ? state.progress : damp(cur.progress, state.progress, 1.8, dt);
    cur.night = opts.reduced ? (state.night ? 1 : 0) : damp(cur.night, state.night ? 1 : 0, 1.8, dt);
    const p = cur.progress;
    const n = cur.night;

    skyU.top.value.copy(blend('top', p, n));
    skyU.mid.value.copy(blend('mid', p, n));
    skyU.low.value.copy(blend('low', p, n));
    (scene.fog as THREE.Fog).color.copy(blend('fog', p, n));
    hemi.color.copy(blend('hemiSky', p, n));
    hemi.groundColor.copy(blend('hemiGround', p, n));
    hemi.intensity = num('hemiI', p, n);
    sun.color.copy(blend('sun', p, n));
    sun.intensity = num('sunI', p, n);
    if (water) (water.material as THREE.MeshStandardMaterial).color.copy(blend('water', p, n));
    const elev = lerp(0.05, 0.32, p) * (1 - n) + n * 0.42;
    sunDir.set(0.32 - p * 0.1, elev, -1).normalize();
    skyU.sunDir.value.copy(sunDir);
    skyU.sunCol.value.set(n > 0.5 ? '#e8ecff' : '#fff1d6').multiplyScalar(n > 0.5 ? 0.7 : 1);
    skyU.sunSize.value = n > 0.5 ? 0.6 : 1;
    sun.position.set(anchor.position.x + land.position.x + 8, Math.max(9, sunDir.y * 40), anchor.position.z + 14);
    sun.target.position.copy(anchor.position).add(land.position);

    if (!opts.reduced) {
      if (water && B.water) {
        const pos = water.geometry.attributes.position as THREE.BufferAttribute;
        const base = water.userData.base as Float32Array;
        const a = B.water.waves;
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3];
          const z = base[i * 3 + 2];
          pos.setY(i, base[i * 3 + 1] + Math.sin(x * 0.7 + t * 0.9) * a + Math.cos(z * 1.1 + t * 0.7 + x * 0.3) * a * 0.8);
        }
        pos.needsUpdate = true;
        water.geometry.computeVertexNormals();
      }
      clouds.forEach((c) => ((c.position.x += c.userData.speed * dt), c.position.x > 90 && (c.position.x = -90)));
    }
    cloudMat.opacity = 0.92 - n * 0.6;
    flyMat.opacity = n * (0.6 + Math.sin(t * 2.3) * 0.3);

    pointer.sx = opts.reduced ? 0 : damp(pointer.sx, pointer.x, 2.2, dt);
    pointer.sy = opts.reduced ? 0 : damp(pointer.sy, pointer.y, 2.2, dt);

    // ---- caméra : légère parallaxe ; fenêtre très basse, elle se resserre sur le tigre
    camera.position.set(camBase.x + pointer.sx * 0.6, camBase.y - pointer.sy * 0.25, camBase.z);
    const tight = smooth(26, 12, camera.fov);
    camera.lookAt(
      lerp(camLook.x, anchor.position.x + land.position.x - 3.2, tight),
      lerp(camLook.y, anchor.position.y + 0.4, tight),
      lerp(camLook.z, anchor.position.z, tight),
    );

    // ---- netteté au premier plan, flou de maquette au loin
    anchor.getWorldPosition(focusPos);
    focusPos.project(camera);
    hBlur.uniforms.r.value = (focusPos.y + 1) / 2;
    vBlur.uniforms.r.value = (focusPos.y + 1) / 2;

    composer.render();

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
  const onResize = () => (resize(), opts.reduced && frame());
  addEventListener('resize', onResize);
  start();
  if (opts.reduced) frame();

  return {
    setState(s: WorldState) {
      state = s;
      if (opts.reduced) frame();
    },
    dispose() {
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

// ================================================================ la tête du tigre

export interface HeadPose {
  pitch: number;
  mood: Mood;
  t: number;
  dt: number;
  look: number;
  lookUp: number;
  perk: number;
  still: boolean;
}

export function buildHead({ bust = false }: { bust?: boolean } = {}) {
  const ORANGE = '#ef8a36';
  const DEEP = '#d8702a';
  const WHITE = '#f7f0e7';
  const CREAM = '#ede1d1';
  const STRIPE = '#2a1b16';

  const root = new THREE.Group(); // posé au sol : le tigre est couché, la tête levée vers toi
  const nod = new THREE.Group(); // pivot du cou : incline et tourne la tête
  nod.position.set(0, 0.7, -0.35);
  root.add(nod);
  const headG = new THREE.Group();
  headG.position.set(0, 0.5, 0.35);
  nod.add(headG);

  // le corps couché derrière la tête, et les deux pattes avant posées devant (version « dans le décor »)
  if (bust) {
  const bodyGeo = new THREE.IcosahedronGeometry(1, 2);
  bodyGeo.scale(1.08, 0.62, 1.7);
  const body = new THREE.Mesh(
    facet(bodyGeo, (x, y, z) => {
      if (y < -0.3) return vary(WHITE, 0.03);
      if (Math.sin(z * 5.5 + Math.abs(x) * 2.4) > 0.8 && y > -0.15) return STRIPE;
      return vary(y > 0.2 ? ORANGE : DEEP, 0.04);
    }),
    facetMat,
  );
  body.position.set(0, 0.55, -1.35);
  root.add(body);
  [1, -1].forEach((sd) => {
    const legGeo = new THREE.IcosahedronGeometry(1, 1);
    legGeo.scale(0.26, 0.22, 0.62);
    const leg = new THREE.Mesh(facet(legGeo, (_x, _y, z) => (z > 0.35 ? vary(WHITE, 0.03) : Math.sin(z * 14) > 0.75 ? STRIPE : vary(ORANGE, 0.04))), facetMat);
    leg.position.set(0.5 * sd, 0.2, 0.35);
    leg.rotation.y = -0.08 * sd;
    root.add(leg);
  });
  }

  // ---- le crâne : une sphère à facettes sculptée (museau, joues, arcades, menton)
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    x *= 1.14;
    y *= 0.95;
    if (y > 0.45) y = 0.45 + (y - 0.45) * 0.78; // front plus plat
    const front = Math.max(0, z);
    const mz = gauss(x, 0, 0.42) * gauss(y, -0.3, 0.3) * front; // museau qui avance
    z += mz * 0.46;
    y -= mz * 0.05;
    z += gauss(x, 0, 0.16) * gauss(y, 0.02, 0.22) * front * 0.1; // pont du nez
    z += gauss(Math.abs(x), 0.34, 0.16) * gauss(y, 0.32, 0.09) * front * 0.1; // arcades
    z -= gauss(Math.abs(x), 0.36, 0.12) * gauss(y, 0.14, 0.08) * front * 0.09; // orbites
    const ch = gauss(y, -0.22, 0.3) * Math.max(0, Math.abs(x) - 0.45); // joues larges
    x += Math.sign(x) * ch * 0.55;
    if (y < -0.6) z -= (-0.6 - y) * 0.6; // menton qui rentre
    if (z < 0) z *= 0.88; // arrière du crâne plus court
    p.setXYZ(i, x, y, z);
  }
  const skull = new THREE.Mesh(
    facet(g, (x, y, z) => {
      const ax = Math.abs(x);
      if (z > 0.7 && y < -0.05 && ax < 0.5) return vary(WHITE, 0.03); // museau
      if (y < -0.58 && z > 0.1) return vary(WHITE, 0.03); // menton
      if (ax > 0.82 && y < 0.02 && y > -0.8) {
        if (Math.sin(y * 15 + ax * 3) > 0.82 && z > -0.3) return STRIPE; // rayures de joue
        return vary(ax > 1.05 ? CREAM : WHITE, 0.03);
      }
      if (ax > 0.17 && ax < 0.52 && y > 0.24 && y < 0.4 && z > 0.6) return vary(WHITE, 0.03); // sourcils
      // front : des barres arquées qui s'emboîtent, plus larges au centre
      if (y > 0.46 && y < 0.88 && z > 0.25 && ax < 0.42 - (y - 0.46) * 0.4 && Math.sin(y * 17 + ax * ax * 9) > 0.5) return STRIPE;
      // tempes : larges bandes en biais qui partent vers les joues
      if (ax > 0.58 && y > -0.05 && z > -0.45 && Math.sin(y * 8.5 + ax * 5) > 0.6) return STRIPE;
      // arrière du crâne
      if (z < -0.3 && Math.sin(x * 6 + y * 2) > 0.7) return STRIPE;
      return vary(y < -0.25 ? DEEP : ORANGE, 0.04);
    }),
    facetMat,
  );
  headG.add(skull);

  // poser un élément à la surface du crâne, vu de face
  const ray = new THREE.Raycaster();
  skull.updateMatrixWorld(true);
  const onSurface = (x: number, y: number) => {
    ray.set(new THREE.Vector3(x, y, 4), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(skull)[0];
    return hit ? hit.point.clone() : new THREE.Vector3(x, y, 0.9);
  };

  // ---- nez, bouche, mâchoire
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 3).rotateX(Math.PI).rotateY(Math.PI / 6), solid('#c86d66'));
  nose.position.copy(onSurface(0, -0.12)).add(new THREE.Vector3(0, 0.02, 0.03));
  nose.scale.z = 0.6;
  headG.add(nose);
  const lineMat = solid(STRIPE);
  const philtrum = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.03), lineMat);
  philtrum.position.copy(onSurface(0, -0.26)).add(new THREE.Vector3(0, 0, 0.015));
  headG.add(philtrum);
  [1, -1].forEach((s) => {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.03), lineMat);
    lip.position.copy(onSurface(0.08 * s, -0.33)).add(new THREE.Vector3(0, 0, 0.012));
    lip.rotation.z = -0.35 * s;
    headG.add(lip);
  });
  const jaw = new THREE.Group();
  jaw.position.copy(onSurface(0, -0.4)).add(new THREE.Vector3(0, 0.02, -0.25));
  const mouth = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1).scale(1.3, 0.5, 0.8), solid('#5a2a2a'));
  mouth.position.set(0, -0.02, 0.18);
  const jawMesh = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.2, 1).scale(1.25, 0.45, 1), () => vary(WHITE, 0.03)), facetMat);
  jawMesh.position.set(0, -0.06, 0.22);
  jaw.add(mouth, jawMesh);
  headG.add(jaw);

  // ---- moustaches
  const whiskerMat = solid('#fffaf2', { emissive: '#ffffff', emissiveIntensity: 0.2 });
  [1, -1].forEach((s) => {
    const base = onSurface(0.3 * s, -0.24);
    for (let k = 0; k < 3; k++) {
      const wsk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.6, 3).rotateZ(Math.PI / 2).translate(0.3 * s, 0, 0), whiskerMat);
      wsk.position.copy(base);
      wsk.rotation.z = (k - 1) * 0.16 * s;
      wsk.rotation.y = -0.35 * s;
      headG.add(wsk);
    }
  });

  // ---- yeux en amande, avec paupières
  const eyes: { lid: THREE.Mesh; lash: THREE.Mesh; pupil: THREE.Mesh }[] = [];
  [1, -1].forEach((s) => {
    const eg = new THREE.Group();
    eg.position.copy(onSurface(0.35 * s, 0.13)).add(new THREE.Vector3(0, 0, 0.005));
    eg.rotation.y = 0.5 * s;
    eg.rotation.z = -0.22 * s;
    const liner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1).scale(1.7, 0.95, 0.35), solid(STRIPE));
    const iris = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1).scale(1.4, 0.74, 0.4), solid('#e6ad3a', { emissive: '#7a5210', emissiveIntensity: 0.35, roughness: 0.4 }));
    iris.position.z = 0.012;
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), solid('#120c0a'));
    pupil.position.z = 0.03;
    const glint = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.02), solid('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.8 }));
    glint.position.set(0.035, 0.03, 0.045);
    const lid = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.1, 1).scale(1.75, 1, 0.42), () => vary(ORANGE, 0.03)), facetMat);
    lid.position.set(0, 0, 0.02);
    const lash = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.018, 0.02), solid(STRIPE));
    lash.position.set(0, -0.005, 0.065);
    eg.add(liner, iris, pupil, glint, lid, lash);
    headG.add(eg);
    eyes.push({ lid, lash, pupil });
  });

  // ---- oreilles
  const ears: THREE.Group[] = [];
  [1, -1].forEach((s) => {
    const ear = new THREE.Group();
    ear.position.set(0.6 * s, 0.62, -0.08);
    const outer = new THREE.Mesh(
      facet(new THREE.ConeGeometry(0.27, 0.42, 5, 1).translate(0, 0.21, 0), (_x, y, z) => (z < 0 ? vary(STRIPE, 0.02) : y > 0.32 ? STRIPE : vary(ORANGE, 0.04))),
      facetMat,
    );
    outer.scale.z = 0.55;
    const inner = new THREE.Mesh(facet(new THREE.ConeGeometry(0.17, 0.28, 5, 1).translate(0, 0.15, 0), () => vary(WHITE, 0.03)), facetMat);
    inner.position.z = 0.07;
    inner.scale.z = 0.5;
    ear.add(outer, inner);
    headG.add(ear);
    ears.push(ear);
  });

  // ---- collerette : des mèches blanches qui débordent des joues
  [1, -1].forEach((s) => {
    for (let k = 0; k < 4; k++) {
      const tuft = new THREE.Mesh(facet(new THREE.ConeGeometry(0.13, 0.42, 4).translate(0, 0.21, 0), () => vary(k % 2 ? CREAM : WHITE, 0.03)), facetMat);
      tuft.position.set(1.05 * s, -0.1 - k * 0.15, 0.05 - k * 0.05);
      tuft.rotation.z = (-1.55 - k * 0.22) * s;
      tuft.rotation.y = 0.25 * s;
      headG.add(tuft);
    }
  });

  shadows(root, true, false);

  const focus = new THREE.Object3D();
  focus.position.set(0, 0.1, 0.5);
  headG.add(focus);
  const top = new THREE.Object3D();
  top.position.set(0.25, 1.25, 0);
  headG.add(top);

  const s = { awake: 0, happy: 0, blink: 0, nextBlink: 2, flick: 0, nextFlick: 4 };
  function pose(q: HeadPose) {
    const { t, dt } = q;
    const awakeT = q.mood === 'sleep' ? 0 : 1;
    const happyT = q.mood === 'free' ? 1 : 0;
    s.awake = q.still ? awakeT : damp(s.awake, awakeT, 3, dt);
    s.happy = q.still ? happyT : damp(s.happy, happyT, 3, dt);
    const a = s.awake;
    const hp = s.happy;

    // clignements et coups d'oreille, de temps en temps
    if (!q.still) {
      s.nextBlink -= dt;
      if (s.nextBlink < 0) {
        s.blink = 1;
        s.nextBlink = range(2.5, 5.5);
      }
      s.blink = Math.max(0, s.blink - dt * 7);
      s.nextFlick -= dt;
      if (s.nextFlick < 0) {
        s.flick = 1;
        s.nextFlick = range(3, 7);
      }
      s.flick = Math.max(0, s.flick - dt * 4);
    }

    // respiration et inclinaison : posée et penchée en dormant, droite et attentive éveillée
    const breathe = Math.sin(t * (a > 0.5 ? 2 : 1.2)) * (a > 0.5 ? 0.008 : 0.016);
    headG.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
    const bob = hp * Math.sin(t * 3.2) * 0.06;
    nod.rotation.x = lerp(0.42, q.pitch - q.perk * 0.12 + q.lookUp * 0.25, a) + bob;
    nod.rotation.z = lerp(0.14, Math.sin(t * 1.6) * 0.05 * hp, a);
    nod.rotation.y = lerp(0.12, q.look * 0.42, a);

    // yeux : fermés en dormant, ronds éveillé, plissés de bonheur quand tu es libre
    const closed = Math.max(1 - a, s.blink, hp * 0.55);
    eyes.forEach((e) => {
      e.lid.scale.y = Math.max(0.001, closed);
      e.lid.visible = closed > 0.02;
      e.lid.position.y = (1 - closed) * 0.08;
      e.lash.visible = closed > 0.85;
      e.pupil.position.x = q.look * 0.03 * a;
    });

    // oreilles : à plat en dormant, dressées éveillé, qui frétillent de joie
    ears.forEach((e, i) => {
      const side = i === 0 ? 1 : -1;
      e.rotation.x = lerp(-0.35, 0.05 - q.perk * 0.15, a) + s.flick * 0.4 * (i === 0 ? 1 : 0);
      e.rotation.z = -0.35 * side + hp * Math.sin(t * 6 + i) * 0.12;
    });

    // bouche : un bâillement en dormant, un sourire ouvert quand tu es libre
    const yawn = (1 - a) * Math.max(0, Math.sin(t * 0.35) - 0.93) * 6;
    jaw.rotation.x = Math.max(yawn * 0.45, hp * (0.18 + Math.max(0, Math.sin(t * 1.4)) * 0.12));
  }

  return { root, focus, top, pose };
}

export type World = ReturnType<typeof createWorld>;
