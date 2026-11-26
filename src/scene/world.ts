import * as THREE from 'three';

/**
 * Le décor low poly : collines, rocher, arbre en fleurs, nuages, et le tigre couché sur son rocher.
 * Tout est construit à la main avec des formes simples à facettes (flatShading) : rien à télécharger.
 */

export type Mood = 'sleep' | 'awake' | 'free';
export interface WorldState {
  progress: number; // 0..1, avancement du jour
  mood: Mood;
  night: boolean;
}

const C = (hex: string) => new THREE.Color(hex);
const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...extra });

// petit hasard reproductible : le paysage est le même à chaque ouverture
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const PALETTE = {
  dawn: { fog: '#f3d3c6', hemiSky: '#fff1ea', hemiGround: '#e2bfae', sun: '#ffe0bd', sunI: 2.6, hemiI: 2.3 },
  gold: { fog: '#f6d2a2', hemiSky: '#fff4d6', hemiGround: '#e2b88a', sun: '#ffcf8a', sunI: 3.2, hemiI: 2.5 },
  night: { fog: '#4a2e4f', hemiSky: '#9a8ad0', hemiGround: '#3a2a4a', sun: '#ffc6a0', sunI: 0.8, hemiI: 1.1 },
};

export function createWorld(canvas: HTMLCanvasElement, opts: { reduced: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.dawn.fog, 22, 70);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  camera.position.set(0, 2.6, 19);
  camera.lookAt(0, 2.3, 0);

  // ---- lumières
  const hemi = new THREE.HemisphereLight(PALETTE.dawn.hemiSky, PALETTE.dawn.hemiGround, PALETTE.dawn.hemiI);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.dawn.sun, PALETTE.dawn.sunI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.bias = -0.002;
  scene.add(sun, sun.target);

  // ---- le sol : un relief à facettes, coloré face par face
  const ground = (() => {
    const g = new THREE.PlaneGeometry(80, 44, 46, 26).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -10);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const height = (x: number, z: number) => {
      const far = Math.max(0, -z - 6);
      return 0.35 * Math.sin(x * 0.35) + 0.3 * Math.cos(z * 0.45 + x * 0.18) + far * far * 0.004 + far * 0.05;
    };
    const jitter = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const k = `${x.toFixed(2)}:${z.toFixed(2)}`;
      if (!jitter.has(k)) jitter.set(k, (rnd() - 0.5) * 0.35);
      pos.setY(i, height(x, z) + jitter.get(k)! - 0.2);
    }
    const colors: number[] = [];
    const near = [C('#ecd0a4'), C('#e6c293'), C('#efd7b0')];
    const mid = [C('#d9b49a'), C('#dcbba8'), C('#d3a993')];
    const far = [C('#c7a2b4'), C('#bf9bb3'), C('#cdaabd')];
    for (let i = 0; i < pos.count; i += 3) {
      const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const set = z > -6 ? near : z > -16 ? mid : far;
      const c = set[Math.floor(rnd() * set.length)];
      for (let j = 0; j < 3; j++) colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    m.receiveShadow = true;
    return m;
  })();
  scene.add(ground);

  // ---- montagnes au loin
  for (let i = 0; i < 9; i++) {
    const h = 5 + rnd() * 6;
    const m = new THREE.Mesh(new THREE.ConeGeometry(4 + rnd() * 4, h, 5 + Math.floor(rnd() * 2)), mat(rnd() > 0.5 ? '#b996b0' : '#c4a3bb'));
    m.position.set(-34 + i * 8.5 + rnd() * 3, h / 2 - 1, -34 - rnd() * 6);
    m.rotation.y = rnd() * Math.PI;
    scene.add(m);
  }

  // ---- le coin du tigre : rocher, arbre en fleurs, petits buissons ; il se cale à droite de l'écran
  const hero = new THREE.Group();
  scene.add(hero);

  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mat('#a8979b'));
  rock.scale.set(1.55, 0.62, 1.05);
  rock.position.set(0, 0.2, 2.2);
  rock.rotation.y = 0.4;
  rock.castShadow = rock.receiveShadow = true;
  hero.add(rock);
  const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), mat('#b5a4a6'));
  pebble.position.set(1.5, 0.05, 2.9);
  pebble.castShadow = true;
  hero.add(pebble);

  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 2.4, 5), mat('#7a5a50'));
  trunk.position.y = 1.2;
  trunk.rotation.z = -0.08;
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 1, 5), mat('#7a5a50'));
  branch.position.set(0.35, 2.0, 0);
  branch.rotation.z = -0.9;
  tree.add(trunk, branch);
  const blossoms: THREE.Mesh[] = [];
  [
    [0, 2.7, 0, 0.95, '#f2b3c4'],
    [0.75, 2.45, 0.15, 0.7, '#e99db2'],
    [-0.6, 2.4, -0.1, 0.7, '#f6c6d3'],
    [0.2, 3.25, -0.1, 0.6, '#f6c6d3'],
  ].forEach(([x, y, z, r, c]) => {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r as number, 0), mat(c as string));
    b.position.set(x as number, y as number, z as number);
    b.rotation.set(rnd() * 3, rnd() * 3, 0);
    b.castShadow = true;
    blossoms.push(b);
    tree.add(b);
  });
  tree.position.set(1.9, 0, 0.9);
  tree.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  hero.add(tree);

  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25 + rnd() * 0.2, 0), mat(rnd() > 0.5 ? '#a9b98d' : '#b8c49a'));
    b.position.set(-1.8 + rnd() * 4.5, 0.05, 3 + rnd() * 1.2);
    b.scale.y = 0.7;
    b.castShadow = true;
    hero.add(b);
  }

  // petits arbres épars au loin
  for (let i = 0; i < 14; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.35 + rnd() * 0.3, 1.2 + rnd() * 0.8, 5), mat(rnd() > 0.5 ? '#a7b48e' : '#c3a7b3'));
    t.position.set(-22 + rnd() * 44, 0.6, -8 - rnd() * 12);
    scene.add(t);
  }

  // ---- le tigre, couché de profil, la tête tournée vers ta liste
  const tiger = new THREE.Group();
  const fur = mat('#ff8a3d');
  const cream = mat('#fff1e2');
  const dark = mat('#3a2418');
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), fur);
  body.scale.set(1.45, 0.62, 0.72);
  body.position.y = 0.62;
  tiger.add(body);
  const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), cream);
  belly.scale.set(1.15, 0.35, 0.62);
  belly.position.set(-0.1, 0.35, 0);
  tiger.add(belly);
  [-0.75, -0.3, 0.15, 0.6, 1.0].forEach((x, i) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5 - i * 0.03, 1.12 - Math.abs(x) * 0.18), dark);
    s.position.set(x, 1.0 - Math.abs(x) * 0.12, 0);
    s.rotation.z = 0.15;
    tiger.add(s);
  });
  const paw = (x: number, z: number, len: number) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(len, 0.24, 0.3), fur);
    p.position.set(x, 0.14, z);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.32), cream);
    tip.position.set(x - len / 2, 0.12, z);
    tiger.add(p, tip);
  };
  paw(-1.35, 0.34, 0.8);
  paw(-1.2, -0.3, 0.7);
  paw(0.85, 0.42, 0.75);

  const tail = new THREE.Group();
  tail.position.set(1.35, 0.55, 0.1);
  let seg: THREE.Object3D = tail;
  const tailSegs: THREE.Object3D[] = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    g.position.x = i === 0 ? 0 : 0.34;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.16), i % 2 ? dark : fur);
    m.position.x = 0.17;
    g.add(m);
    g.rotation.z = 0.25;
    seg.add(g);
    seg = g;
    tailSegs.push(g);
  }
  tiger.add(tail);

  const head = new THREE.Group();
  head.position.set(-1.45, 0.95, 0);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), fur);
  skull.scale.set(1, 0.9, 0.98);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.56), cream);
  snout.position.set(-0.48, -0.18, 0);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.18), dark);
  nose.position.set(-0.7, -0.08, 0);
  const cheekL = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), cream);
  cheekL.position.set(-0.25, -0.25, 0.42);
  const cheekR = cheekL.clone();
  cheekR.position.z = -0.42;
  head.add(skull, snout, nose, cheekL, cheekR);
  const ears: THREE.Mesh[] = [];
  [0.34, -0.34].forEach((z) => {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 4), fur);
    e.position.set(0.05, 0.58, z);
    e.rotation.x = z > 0 ? 0.3 : -0.3;
    ears.push(e);
    head.add(e);
  });
  const eyes: THREE.Mesh[] = [];
  [0.3, -0.3].forEach((z) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.08), dark);
    e.position.set(-0.42, 0.12, z);
    eyes.push(e);
    head.add(e);
  });
  [0.12, -0.12].forEach((z) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.08), dark);
    s.position.set(0.05, 0.45, z * 2.2);
    s.rotation.y = z > 0 ? 0.4 : -0.4;
    head.add(s);
  });
  tiger.add(head);
  tiger.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  tiger.scale.setScalar(0.5);
  tiger.position.set(0.1, 0.68, 2.25);
  tiger.rotation.y = 0.25;
  hero.add(tiger);

  // ---- nuages
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + rnd() * 0.6, 0), mat('#ffffff', { transparent: true, opacity: 0.9, emissive: '#fff6f0', emissiveIntensity: 0.75 }));
      p.position.set(j * 0.8 - n * 0.4, rnd() * 0.3, rnd() * 0.4);
      p.scale.y = 0.65;
      c.add(p);
    }
    c.position.set(-30 + rnd() * 60, 7.5 + rnd() * 3, -22 - rnd() * 10);
    c.scale.setScalar(1.6);
    c.userData.speed = 0.15 + rnd() * 0.2;
    clouds.push(c);
    scene.add(c);
  }

  // ---- lucioles, la nuit
  const flyCount = 40;
  const flyGeo = new THREE.BufferGeometry();
  const flyPos = new Float32Array(flyCount * 3);
  for (let i = 0; i < flyCount; i++) {
    flyPos[i * 3] = -4 + rnd() * 10;
    flyPos[i * 3 + 1] = 0.3 + rnd() * 2.6;
    flyPos[i * 3 + 2] = -2 + rnd() * 6;
  }
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flyMat = new THREE.PointsMaterial({ color: '#ffe9a8', size: 0.09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flies = new THREE.Points(flyGeo, flyMat);
  hero.add(flies);

  // ---- état et animation
  let state: WorldState = { progress: 0, mood: 'sleep', night: false };
  const cur = { progress: 0, night: 0, headLift: 0, hop: 0, perk: 0 };
  let pointerX = 0;
  const onPointer = (e: PointerEvent) => (pointerX = (e.clientX / innerWidth) * 2 - 1);
  addEventListener('pointermove', onPointer, { passive: true });

  const fogColor = new THREE.Color();
  const tmp = new THREE.Color();
  const mix = (a: string, b: string, c: string, t: number, n: number) =>
    tmp.set(a).lerp(C(b), t).lerp(C(c), n);

  let w = 0;
  let h = 0;
  const resize = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // le coin du tigre se place aux trois quarts de la largeur visible
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - 2.2) * camera.aspect;
    hero.position.x = w < 700 ? half * 0.35 : half * 0.52;
    sun.target.position.set(hero.position.x, 0, 2);
  };
  resize();

  const bubbleAnchor = new THREE.Vector3();
  let onBubble: ((x: number, y: number) => void) | null = null;

  const clock = new THREE.Clock();
  let raf = 0;
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const k = opts.reduced ? 1 : 1 - Math.exp(-dt * 2.2);
    cur.progress += (state.progress - cur.progress) * k;
    cur.night += ((state.night ? 1 : 0) - cur.night) * k;
    const awake = state.mood !== 'sleep' ? 1 : 0;
    cur.headLift += (awake - cur.headLift) * (opts.reduced ? 1 : 1 - Math.exp(-dt * 5));
    cur.perk = Math.max(0, cur.perk - dt * 1.6);

    // lumière : l'aube devient dorée à mesure que la journée avance
    const p = cur.progress;
    const n = cur.night;
    fogColor.copy(mix(PALETTE.dawn.fog, PALETTE.gold.fog, PALETTE.night.fog, p, n));
    (scene.fog as THREE.Fog).color.copy(fogColor);
    hemi.color.copy(mix(PALETTE.dawn.hemiSky, PALETTE.gold.hemiSky, PALETTE.night.hemiSky, p, n));
    hemi.groundColor.copy(mix(PALETTE.dawn.hemiGround, PALETTE.gold.hemiGround, PALETTE.night.hemiGround, p, n));
    hemi.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(PALETTE.dawn.hemiI, PALETTE.gold.hemiI, p), PALETTE.night.hemiI, n);
    sun.color.copy(mix(PALETTE.dawn.sun, PALETTE.gold.sun, PALETTE.night.sun, p, n));
    sun.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(PALETTE.dawn.sunI, PALETTE.gold.sunI, p), PALETTE.night.sunI, n);
    const elev = THREE.MathUtils.lerp(0.35, 1.1, p) * (1 - n * 0.6);
    sun.position.set(hero.position.x + 6 - p * 3, 2 + elev * 8, 8);

    // le tigre respire, s'éveille, suit ta souris du regard, saute quand tu es libre
    const breathe = Math.sin(t * (awake ? 2.2 : 1.3)) * (awake ? 0.02 : 0.035);
    body.scale.y = 0.62 * (1 + breathe);
    const lift = cur.headLift + cur.perk * 0.6;
    head.position.y = 0.72 + lift * 0.42;
    head.rotation.z = -0.35 + lift * 0.42;
    const look = awake ? pointerX * -0.35 : 0;
    head.rotation.y += (look - head.rotation.y) * (opts.reduced ? 1 : 0.08);
    const blink = awake && Math.sin(t * 0.9) > 0.985 ? 0.15 : 1;
    eyes.forEach((e) => (e.scale.y = awake ? blink : 0.18));
    ears.forEach((e, i) => (e.rotation.z = Math.sin(t * 3 + i) * (awake ? 0.08 : 0.02) + (Math.sin(t * 0.7) > 0.96 ? 0.25 : 0)));
    tailSegs.forEach((s, i) => (s.rotation.y = Math.sin(t * (awake ? 2 : 0.8) - i * 0.6) * (awake ? 0.22 : 0.1)));
    if (state.mood === 'free' && !opts.reduced) {
      cur.hop = Math.abs(Math.sin(t * 4.2));
      tiger.position.y = 0.68 + cur.hop * 0.45;
      tiger.rotation.y = 0.25 + Math.sin(t * 2.1) * 0.3;
    } else {
      tiger.position.y += (0.68 - tiger.position.y) * 0.15;
      tiger.rotation.y += (0.25 - tiger.rotation.y) * 0.1;
    }

    blossoms.forEach((b, i) => (b.rotation.y = Math.sin(t * 0.5 + i) * 0.06));
    if (!opts.reduced) clouds.forEach((c) => ((c.position.x += c.userData.speed * dt), c.position.x > 34 && (c.position.x = -34)));
    clouds.forEach((c) => c.children.forEach((m) => (((m as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.9 - n * 0.6)));
    flyMat.opacity = n * (0.55 + Math.sin(t * 2.3) * 0.35);
    flies.position.y = Math.sin(t * 0.6) * 0.15;

    renderer.render(scene, camera);

    if (onBubble) {
      head.getWorldPosition(bubbleAnchor);
      bubbleAnchor.y += 0.55;
      bubbleAnchor.project(camera);
      onBubble(((bubbleAnchor.x + 1) / 2) * w, ((1 - bubbleAnchor.y) / 2) * h);
    }
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
    perk() {
      cur.perk = 1;
    },
    onBubble(cb: (x: number, y: number) => void) {
      onBubble = cb;
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
      renderer.dispose();
    },
  };
}

export type World = ReturnType<typeof createWorld>;
