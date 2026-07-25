import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { UIDayNight } from '../UIDayNight';

// ---------------------------------------------------------------------------
// Stage — shared three.js viewport for every 3D rig: renderer, orbit camera
// (drag + auto-rotate), warm sun + soft shadows, a textured grass ground, and
// a library of PROCEDURAL canvas textures (wood, metal, asphalt, foliage,
// fabric, concrete, grass, plastic) that are UV-mapped with RepeatWrapping and
// paired bump maps for surface relief. No external image assets required.
// ---------------------------------------------------------------------------

export type TexName =
  | 'wood'
  | 'metal'
  | 'asphalt'
  | 'leaf'
  | 'fabric'
  | 'concrete'
  | 'grass'
  | 'plastic'
  | 'sand';

// ---- colour helpers ----
function toRGB(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}
function cl(v: number) {
  return Math.max(0, Math.min(255, v | 0));
}
function shade(hex: number, amt: number, sat = 1) {
  const [r, g, b] = toRGB(hex);
  return `rgb(${cl(r + amt)},${cl(g + amt * sat)},${cl(b + amt)})`;
}

// ---- procedural texture drawing (returns an HTMLCanvasElement) ----
function drawTexture(name: TexName, color: number, S = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const [r, g, b] = toRGB(color);
  x.fillStyle = `rgb(${r},${g},${b})`;
  x.fillRect(0, 0, S, S);
  const rnd = (a: number, bb: number) => a + Math.random() * (bb - a);

  if (name === 'wood') {
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = shade(color, rnd(-26, 14));
      x.lineWidth = rnd(0.5, 1.6);
      const y = rnd(0, S);
      x.beginPath();
      x.moveTo(0, y);
      for (let px = 0; px <= S; px += 8) x.lineTo(px, y + Math.sin(px * 0.08 + i) * 1.5);
      x.stroke();
    }
    for (let p = 0; p <= S; p += S / 4) {
      x.strokeStyle = shade(color, -34);
      x.lineWidth = 1.5;
      x.beginPath();
      x.moveTo(0, p);
      x.lineTo(S, p);
      x.stroke();
    }
    for (let k = 0; k < 3; k++) {
      x.strokeStyle = shade(color, -30);
      x.beginPath();
      x.ellipse(rnd(0, S), rnd(0, S), rnd(2, 5), rnd(3, 7), 0, 0, Math.PI * 2);
      x.stroke();
    }
  } else if (name === 'metal') {
    for (let i = 0; i < 160; i++) {
      x.strokeStyle = shade(color, rnd(-22, 30));
      x.lineWidth = rnd(0.4, 1);
      const y = rnd(0, S);
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(S, y);
      x.stroke();
    }
  } else if (name === 'asphalt') {
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = shade(color, rnd(-34, 34));
      const s = rnd(0.6, 2.2);
      x.fillRect(rnd(0, S), rnd(0, S), s, s);
    }
  } else if (name === 'leaf') {
    for (let i = 0; i < 320; i++) {
      x.fillStyle = shade(color, rnd(-40, 34), 1.3);
      x.beginPath();
      x.arc(rnd(0, S), rnd(0, S), rnd(2.5, 7), 0, Math.PI * 2);
      x.fill();
    }
  } else if (name === 'fabric') {
    for (let p = 0; p < S; p += 3) {
      x.strokeStyle = shade(color, 12);
      x.globalAlpha = 0.35;
      x.beginPath();
      x.moveTo(p, 0);
      x.lineTo(p, S);
      x.stroke();
      x.strokeStyle = shade(color, -16);
      x.beginPath();
      x.moveTo(0, p);
      x.lineTo(S, p);
      x.stroke();
    }
    x.globalAlpha = 1;
  } else if (name === 'concrete') {
    for (let i = 0; i < 1800; i++) {
      x.fillStyle = shade(color, rnd(-18, 22));
      x.fillRect(rnd(0, S), rnd(0, S), 1, 1);
    }
  } else if (name === 'grass') {
    for (let i = 0; i < 2200; i++) {
      x.strokeStyle = shade(color, rnd(-30, 26), 1.4);
      x.lineWidth = 1;
      const gx = rnd(0, S);
      const gy = rnd(0, S);
      x.beginPath();
      x.moveTo(gx, gy);
      x.lineTo(gx + rnd(-1.5, 1.5), gy - rnd(2, 5));
      x.stroke();
    }
  } else if (name === 'plastic') {
    const grad = x.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, shade(color, 30));
    grad.addColorStop(0.5, shade(color, 4));
    grad.addColorStop(1, shade(color, -22));
    x.fillStyle = grad;
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) {
      x.fillStyle = shade(color, rnd(-8, 8));
      x.fillRect(rnd(0, S), rnd(0, S), 1, 1);
    }
  } else if (name === 'sand') {
    // fine grain speckle + soft wind-ripple streaks
    for (let i = 0; i < 2400; i++) {
      x.fillStyle = shade(color, rnd(-20, 24));
      const s = rnd(0.5, 1.4);
      x.fillRect(rnd(0, S), rnd(0, S), s, s);
    }
    for (let i = 0; i < 14; i++) {
      x.strokeStyle = shade(color, rnd(-14, -6));
      x.globalAlpha = 0.5;
      x.lineWidth = rnd(1, 2.2);
      const y = rnd(0, S);
      x.beginPath();
      x.moveTo(0, y);
      for (let px = 0; px <= S; px += 10) x.lineTo(px, y + Math.sin(px * 0.05 + i * 2) * 3);
      x.stroke();
    }
    x.globalAlpha = 1;
  }
  return c;
}

const _texCache = new Map<string, THREE.CanvasTexture>();
function getTex(three: typeof THREE, name: TexName, color: number, rx: number, ry: number) {
  const key = `${name}:${color}:${rx}:${ry}`;
  const hit = _texCache.get(key);
  if (hit) return hit;
  const tex = new three.CanvasTexture(drawTexture(name, color));
  tex.wrapS = tex.wrapT = three.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (three as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _texCache.set(key, tex);
  return tex;
}

// GEOMETRY CACHE: box()/cyl()/ball() never mutate their geometry after build
// (all placement happens on the mesh transform), so identical dimensions share
// ONE BufferGeometry — thousands of park boxes collapse to a few hundred GPU
// buffers and geometry builds. Cached geometries carry `userData.shared`;
// disposal paths (Park's disposeDeep, the Stage teardown) skip them so the
// cache survives remounts, exactly like the texture cache above. mergedBoxes
// does NOT use it (it bakes transforms into a bespoke geometry).
const _geoCache = new Map<string, THREE.BufferGeometry>();
function getGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = _geoCache.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    _geoCache.set(key, g);
  }
  return g;
}

// ---- material + geometry helpers ----
export interface MatOpts {
  rough?: number;
  metal?: number;
  flat?: boolean;
  emissive?: number;
  opacity?: number;
  tex?: TexName;
  repeat?: [number, number];
  bump?: number;
}
// NOTE ON MATERIAL CACHING: textures ARE cached (getTex above — one
// CanvasTexture per name:color:repeat), but materials are deliberately NOT.
// ~20 components mutate their meshes' materials per frame or per mesh after
// creation (night-gated `material.emissiveIntensity` on lamp heads/bulbs in
// TrackKit, PathNetwork, CoasterCar, LogFlume, Bobsleigh, RiverRapids…, plus
// `.side`/opacity tweaks). A cache keyed on opts+color would silently SHARE
// those instances and leak one bulb's glow onto every same-coloured mesh in
// the scene. Material count is not the bottleneck (draw calls are — see
// mergedBoxes below); keep materials per-mesh.
export function mat(three: typeof THREE, color: number, o: MatOpts = {}) {
  const m = new three.MeshStandardMaterial({
    color: o.tex ? 0xffffff : color,
    roughness: o.rough ?? 0.82,
    metalness: o.metal ?? 0.0,
    flatShading: o.flat ?? false,
    emissive: o.emissive ?? 0x000000,
    transparent: o.opacity != null,
    opacity: o.opacity ?? 1,
  });
  if (o.tex) {
    const [rx, ry] = o.repeat ?? [1, 1];
    const t = getTex(three, o.tex, color, rx, ry);
    m.map = t;
    m.bumpMap = t;
    m.bumpScale = o.bump ?? 0.02;
  }
  return m;
}
export function box(
  three: typeof THREE,
  dims: [number, number, number],
  color: number,
  pos: [number, number, number] = [0, 0, 0],
  o: MatOpts & { rotX?: number; rotY?: number; rotZ?: number } = {},
) {
  const m = new three.Mesh(getGeo(`b:${dims[0]}:${dims[1]}:${dims[2]}`, () => new three.BoxGeometry(...dims)), mat(three, color, o));
  m.position.set(...pos);
  if (o.rotX) m.rotation.x = o.rotX;
  if (o.rotY) m.rotation.y = o.rotY;
  if (o.rotZ) m.rotation.z = o.rotZ;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function cyl(
  three: typeof THREE,
  rTop: number,
  rBot: number,
  h: number,
  color: number,
  pos: [number, number, number] = [0, 0, 0],
  o: MatOpts & { rotX?: number; rotY?: number; rotZ?: number; seg?: number } = {},
) {
  const m = new three.Mesh(
    getGeo(`c:${rTop}:${rBot}:${h}:${o.seg ?? 16}`, () => new three.CylinderGeometry(rTop, rBot, h, o.seg ?? 16)),
    mat(three, color, o),
  );
  m.position.set(...pos);
  if (o.rotX) m.rotation.x = o.rotX;
  if (o.rotY) m.rotation.y = o.rotY;
  if (o.rotZ) m.rotation.z = o.rotZ;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function ball(
  three: typeof THREE,
  r: number,
  color: number,
  pos: [number, number, number] = [0, 0, 0],
  o: MatOpts = {},
) {
  const m = new three.Mesh(getGeo(`s:${r}:${o.flat ? 1 : 3}`, () => new three.IcosahedronGeometry(r, o.flat ? 1 : 3)), mat(three, color, o));
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** one box in a `mergedBoxes` batch — same fields the `box()` helper takes,
 *  plus an optional per-box texture `repeat` that gets BAKED into the UVs */
export interface MergedBoxSpec {
  dims: [number, number, number];
  pos?: [number, number, number];
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  /** full precomposed transform — overrides pos/rot (for boxes that lived in
   *  nested rotated groups: compose the group matrix with the local offset) */
  matrix?: THREE.Matrix4;
  /** texture repeat for THIS box (baked into UVs; RepeatWrapping tiles it) —
   *  visually identical to `box(..., { repeat })` but every box in the batch
   *  shares ONE texture and ONE draw call */
  repeat?: [number, number];
}

/**
 * STATIC-GEOMETRY MERGE — collapses N same-material boxes into ONE mesh
 * (one draw call instead of N, and N fewer shadow-pass draws). Use for
 * static dressing built from many small `box()` calls: kerbs, seams, pads,
 * spokes, lattice rungs, fence pickets… Per-box texture repeats are baked
 * into the UVs so mixed-length parts still share a single texture/material.
 * NOT for boxes that move independently or mutate their material per frame
 * (night-glow bulbs etc.) — merged parts share one material forever.
 */
export function mergedBoxes(three: typeof THREE, parts: MergedBoxSpec[], color: number, o: MatOpts = {}) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const m4 = new three.Matrix4();
  const e = new three.Euler();
  for (const p of parts) {
    const g = new three.BoxGeometry(...p.dims);
    if (p.matrix) {
      m4.copy(p.matrix);
    } else {
      e.set(p.rotX ?? 0, p.rotY ?? 0, p.rotZ ?? 0);
      m4.makeRotationFromEuler(e);
      const pos = p.pos ?? [0, 0, 0];
      m4.setPosition(pos[0], pos[1], pos[2]);
    }
    g.applyMatrix4(m4); // transforms normals too (applyMatrix4 handles the normal matrix)
    const base = positions.length / 3;
    const pa = g.getAttribute('position');
    const na = g.getAttribute('normal');
    const ua = g.getAttribute('uv');
    const [rx, ry] = p.repeat ?? [1, 1];
    for (let i = 0; i < pa.count; i++) {
      positions.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      normals.push(na.getX(i), na.getY(i), na.getZ(i));
      uvs.push(ua.getX(i) * rx, ua.getY(i) * ry);
    }
    const idx = g.getIndex()!;
    for (let i = 0; i < idx.count; i++) indices.push(base + idx.getX(i));
    g.dispose();
  }
  const geo = new three.BufferGeometry();
  geo.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new three.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new three.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  // material repeat stays [1,1] — per-part repeats live in the baked UVs
  const mesh = new three.Mesh(geo, mat(three, color, { ...o, repeat: [1, 1] }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** normalized rect for an extra viewport — x/y from the canvas TOP-LEFT, all 0..1 */
export interface StageViewportRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Standard 4:3 viewport-inset rect (rules/ui.md: ALL `addViewport` insets
 * render at a 4:3 pixel aspect and get a `ViewportFrame`). Given the
 * normalized x/y/width and the canvas aspect (canvas width / height), returns
 * the rect whose normalized height makes the rendered pixels 4:3.
 */
export function rect43(x: number, y: number, w: number, canvasAspect: number): StageViewportRect {
  return { x, y, w, h: 0.75 * w * canvasAspect };
}

/** per-viewport render options for `addViewport` */
export interface StageViewportOpts {
  /** objects hidden ONLY during this viewport's render pass (visible toggled
   *  on the roots — descendants are skipped too — and restored right after).
   *  Player/onboard cams pass their own vehicle so it can't block the POV. */
  hide?: THREE.Object3D[];
}

/**
 * Additive Stage API handed to `build` as an optional THIRD argument.
 * `addViewport` registers an extra camera rendered each frame into a
 * normalized-rect corner of the canvas (scissor/viewport multi-view; rendered
 * AFTER the main view) and returns a disposer. `setCameraPose` re-aims the
 * main orbit camera (position + optional look-at target); orbit dragging keeps
 * working afterwards.
 */
export interface StageApi {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  addViewport(cam: THREE.Camera, rect: StageViewportRect, opts?: StageViewportOpts): () => void;
  /** every camera that renders this frame: the main orbit cam + all active
   *  viewport-inset cams. The Park ride runtime measures LOD distance against
   *  ALL of them so an onboard/inset view keeps its ride at full detail. */
  cameras?(): THREE.Camera[];
  setCameraPose?(pos: [number, number, number], target?: [number, number, number]): void;
  /**
   * The PLAYER PILL — an invisible capsule that IS "the user" in the scene,
   * Minecraft-style: it tracks the orbit/fly target every frame (the arrows/
   * WASD glide it, Space/Shift fly it, the ground clamp keeps its feet out of
   * the terrain) and the camera orbits/zooms around it (scroll wheel dollies
   * right down to its eyes for a first-person feel). Invisible to the
   * renderer and never raycast-delivered, but a real Object3D — probe it for
   * position/collision logic if a scene needs the "player".
   */
  player?: THREE.Object3D;
  /**
   * Terrain following: register/replace the ground sampler at runtime
   * (overrides the `groundAt` prop). Every frame the camera is clamped to
   * y ≥ groundAt(cam.x, cam.z) + 0.35 and the orbit target to
   * y ≥ groundAt(x, z) + 0.15 (smoothed) so the view never clips into
   * terrain or walls.
   */
  setGroundSampler?(fn: (x: number, z: number) => number): void;
  /**
   * Click-pick registration (rules/ui.md clickability): raycasts pointer
   * clicks (not drags) into the scene, walks UP the parent chain from the hit
   * mesh and delivers the first ancestor whose `userData` carries a `rideRef`
   * or `guestRef`. Returns an unsubscriber.
   */
  onPick?(cb: (obj: THREE.Object3D) => void): () => void;
  /**
   * Render-budget probe: totals for the LAST COMPLETE FRAME (all passes —
   * shadow map + main view + extra viewports) straight from `renderer.info`,
   * plus a rolling fps average, a rolling CPU frame-time (ms) and the number
   * of ACTIVE (visible) Point/Spot lights in the scene. Poll it (≥300ms —
   * rules/ui.md) from a HUD or a harness script to check a scene against the
   * budgets in SETUP.md §13; the Stage also logs a one-time warning when a
   * scene sits over budget.
   */
  stats?(): { drawCalls: number; triangles: number; fps: number; frameMs: number; lights: number };
}

export type BuildFn = (three: typeof THREE, group: THREE.Group, api?: StageApi) => ((t: number) => void) | void;

/**
 * Stage QUALITY TIER — one knob for the whole shared-rendering budget:
 *
 *   tier      pixel-ratio cap   antialias   sun shadow map
 *   'high'    2 (default)       on          2048²
 *   'medium'  1.5               on          1024²
 *   'low'     1                 off         512²
 *
 * 'high' is the default everywhere (previews stay pixel-identical). Pass
 * 'medium' on big composed parks — at park scale the fill-rate and
 * shadow-resolution savings are invisible from the orbit camera. <Park>
 * forwards its own `quality` prop here.
 */
export type StageQuality = 'high' | 'medium' | 'low';

const QUALITY = {
  high: { pixelRatio: 2, antialias: true, shadowMap: 2048 },
  medium: { pixelRatio: 1.5, antialias: true, shadowMap: 1024 },
  low: { pixelRatio: 1, antialias: false, shadowMap: 512 },
} as const;

/**
 * Walk up the parent chain to the nearest object carrying a `userData.nightK`
 * (the Stage writes it onto the build group every frame: 0 = day, 1 = night).
 * Returns 0 when the object isn't mounted under a Stage — daytime look.
 */
export function nightKOf(obj: THREE.Object3D): number {
  let o: THREE.Object3D | null = obj;
  while (o) {
    const k = (o.userData as { nightK?: unknown }).nightK;
    if (typeof k === 'number') return k;
    o = o.parent;
  }
  return 0;
}

export interface StageProps {
  build: BuildFn;
  height?: number;
  /**
   * Fill the viewport: the wrapper becomes 100% wide x 100vh tall (no border
   * radius) and the responsive canvas tracks it. Park generation scenes MUST
   * render full-screen (mount in a full-viewport container + set this);
   * small fixed-height canvases are for component previews only.
   */
  fullscreen?: boolean;
  background?: string;
  autoRotate?: boolean;
  distance?: number;
  targetY?: number;
  /** show the grass ground disc (turn off for water / terrain scenes) */
  ground?: boolean;
  /** start in night mode (every stage also gets a day/night toggle button) */
  night?: boolean;
  /**
   * Terrain-following ground sampler (e.g. TerrainKit's `heightAt`). When
   * set, the camera never clips under the ground: camera y is clamped to
   * ≥ groundAt(cam.x, cam.z) + 0.35 and the orbit target to ≥ groundAt + 0.15
   * every frame, with a lerp so the clamp never pops. Also settable at
   * runtime via `api.setGroundSampler(fn)`.
   */
  groundAt?: (x: number, z: number) => number;
  /**
   * Distance fog (default `true` = the classic near `distance*2.2` /
   * far `distance*4.5` haze). `false` disables it. Pass `{ near, far }` on
   * BIG park scenes to pull the horizon in — the camera far plane then
   * tightens to just beyond `far`, so everything past the fog wall is
   * genuinely FRUSTUM-CULLED (fewer draw calls), not just tinted out.
   */
  fog?: boolean | { near: number; far: number };
  /** shared-rendering quality tier (default 'high' — previews stay
   *  pixel-identical). See StageQuality; <Park> forwards its own prop. */
  quality?: StageQuality;
}

export function Stage({
  build,
  height = 340,
  fullscreen = false,
  background = '#9ec7d8',
  autoRotate = true,
  distance = 8,
  targetY = 0.7,
  ground = true,
  night = false,
  groundAt,
  fog = true,
  quality = 'high',
}: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const buildRef = useRef(build);
  buildRef.current = build;
  const groundAtRef = useRef(groundAt);
  groundAtRef.current = groundAt;
  const [isNight, setIsNight] = useState(night);
  const nightRef = useRef(isNight);
  nightRef.current = isNight;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let w = el.clientWidth || 480;
    let h = el.clientHeight || height;

    const q = QUALITY[quality] ?? QUALITY.high;
    const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: 'high-performance' });
    // retina cap: >2x device pixels quadruple the fill cost for no visible
    // gain at park scale (same cap as the reference RC Park stage); lower
    // quality tiers cap tighter (see StageQuality)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // info is reset ONCE per rAF in the loop (not per render call) so
    // api.stats() reports whole-frame totals incl. shadow + viewport passes
    renderer.info.autoReset = false;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    // fog: default haze, custom {near, far} horizon, or off. A custom far
    // also tightens the camera far plane just past the fog wall — geometry
    // beyond it is fully fog-coloured anyway, so clipping it is invisible
    // and turns the fog into real frustum culling on big parks.
    const fogRange = fog === true ? { near: distance * 2.2, far: distance * 4.5 } : fog || null;
    if (fogRange) scene.fog = new THREE.Fog(new THREE.Color(background).getHex(), fogRange.near, fogRange.far);
    const camFar = fog && fog !== true ? fog.far * 1.05 : 200;

    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, camFar);
    const target = new THREE.Vector3(0, targetY, 0);

    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6b7a55, 0.62);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d6, 1.15);
    sun.position.set(6, 11, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    const s = 7;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    // night rig: two warm park floodlights + a cool moon fill (intensity lerped in the loop)
    const floods: THREE.PointLight[] = [];
    [
      [3.2, 3.4, 2.2],
      [-3.2, 3.4, -2.2],
    ].forEach(([x, y, z]) => {
      const fl = new THREE.PointLight(0xffb45e, 0, 18, 1.8);
      fl.position.set(x, y, z);
      scene.add(fl);
      floods.push(fl);
    });
    const dayBg = new THREE.Color(background);
    const nightBg = new THREE.Color(0x0e1728);
    const daySun = new THREE.Color(0xfff0d6);
    const moonCol = new THREE.Color(0xa9c4ff);
    const dayHemiSky = new THREE.Color(0xdff0ff);
    const nightHemiSky = new THREE.Color(0x24365e);
    const dayHemiGnd = new THREE.Color(0x6b7a55);
    const nightHemiGnd = new THREE.Color(0x141c14);
    const bgNow = new THREE.Color(background);
    let nightK = nightRef.current ? 1 : 0;

    // textured grass ground (optional — off for water / terrain scenes)
    if (ground) {
      const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
      groundMat.map = getTex(THREE, 'grass', 0x6f9e54, 24, 24);
      const groundMesh = new THREE.Mesh(new THREE.CircleGeometry(distance * 1.6, 64), groundMat);
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.position.y = -0.02;
      groundMesh.receiveShadow = true;
      scene.add(groundMesh);
    }

    const group = new THREE.Group();
    scene.add(group);

    // the player pill: an invisible capsule standing on the view target —
    // "the user" as a scene object (api.player). visible:false means the
    // renderer never draws it; the pick raycast walks past it (no userData
    // refs), so it costs nothing.
    const player = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.85, 3, 10),
      new THREE.MeshBasicMaterial(),
    );
    player.visible = false;
    scene.add(player);

    let az = Math.PI * 0.25;
    let el2 = Math.PI * 0.28;
    let camDist = distance;
    let dragging = false;
    let px = 0;
    let py = 0;
    const applyCam = () => {
      const r = camDist;
      camera.position.set(
        target.x + r * Math.cos(el2) * Math.sin(az),
        target.y + r * Math.sin(el2),
        target.z + r * Math.cos(el2) * Math.cos(az),
      );
      camera.lookAt(target);
    };

    // additive Stage API (optional third build arg): extra scissor viewports + camera pose
    const viewports: { cam: THREE.Camera; rect: StageViewportRect; hide?: THREE.Object3D[] }[] = [];
    const pickCbs: ((obj: THREE.Object3D) => void)[] = [];
    // terrain following: runtime sampler override (api.setGroundSampler) wins
    // over the groundAt prop; smoothed lift so the clamp never pops
    let groundOverride: ((x: number, z: number) => number) | null = null;
    let camGroundLift = 0;
    let statDrawCalls = 0;
    let statTriangles = 0;
    let statFps = 0;
    let statFrameMs = 0;
    const api: StageApi = {
      scene,
      camera,
      renderer,
      player,
      addViewport(cam, rect, opts) {
        const entry = { cam, rect, hide: opts?.hide };
        viewports.push(entry);
        // every inset re-renders the WHOLE scene (shadow maps are reused, but
        // the colour pass is full price) — one live inset is the budget
        if (viewports.length > 1)
          console.warn(
            `Stage: ${viewports.length} extra viewports active — each inset is a full scene render pass. Keep ONE live inset (close the previous RideViewer/PlayerCam first).`,
          );
        return () => {
          const i = viewports.indexOf(entry);
          if (i >= 0) viewports.splice(i, 1);
        };
      },
      cameras() {
        return [camera, ...viewports.map((v) => v.cam)];
      },
      setGroundSampler(fn) {
        groundOverride = fn;
      },
      setCameraPose(pos, tgt) {
        if (tgt) target.set(tgt[0], tgt[1], tgt[2]);
        const dx = pos[0] - target.x;
        const dy = pos[1] - target.y;
        const dz = pos[2] - target.z;
        camDist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy + dz * dz));
        el2 = Math.max(0.08, Math.min(1.45, Math.asin(dy / camDist)));
        az = Math.atan2(dx, dz);
      },
      onPick(cb) {
        pickCbs.push(cb);
        return () => {
          const i = pickCbs.indexOf(cb);
          if (i >= 0) pickCbs.splice(i, 1);
        };
      },
      stats() {
        let lights = 0;
        scene.traverse((o) => {
          const l = o as { isPointLight?: boolean; isSpotLight?: boolean; visible?: boolean };
          if ((l.isPointLight || l.isSpotLight) && l.visible) lights += 1;
        });
        return {
          drawCalls: statDrawCalls,
          triangles: statTriangles,
          fps: Math.round(statFps * 10) / 10,
          frameMs: Math.round(statFrameMs * 100) / 100,
          lights,
        };
      },
    };
    // dev probe hook: harness/HUD scripts can reach the api (and stats())
    // from the DOM without threading React props through
    (renderer.domElement as unknown as { __stageApi?: StageApi }).__stageApi = api;
    const update = buildRef.current(THREE, group, api) || undefined;

    // LIGHT BUDGET (dev warning): every extra Point/SpotLight recompiles the
    // forward shaders and adds per-fragment cost. Components should keep ≤4
    // real lights and go emissive beyond that (SETUP.md → Performance).
    {
      let lightCount = 0;
      group.traverse((o) => {
        const t = (o as { isPointLight?: boolean; isSpotLight?: boolean });
        if (t.isPointLight || t.isSpotLight) lightCount += 1;
      });
      if (lightCount > 8)
        console.warn(
          `Stage: scene carries ${lightCount} Point/Spot lights — over the ~8 budget. Prefer emissive materials (nightKOf-gated) over real lights.`,
        );
    }
    // STATIC-SCENE SHADOW FREEZE: a build with no per-frame updater cannot
    // move its shadow casters and the sun never moves, so after the first
    // second of frames the shadow map is frozen (the day/night lerp only
    // changes light colour/intensity, which does not touch the depth map).
    const staticScene = !update;
    let shadowFreezeAt = staticScene ? 60 : Infinity;

    const dom = renderer.domElement;
    dom.style.cursor = 'grab';
    let downX = 0;
    let downY = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      px = downX = e.clientX;
      py = downY = e.clientY;
      dom.style.cursor = 'grabbing';
      dom.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      az -= (e.clientX - px) * 0.01;
      el2 = Math.max(0.08, Math.min(1.45, el2 + (e.clientY - py) * 0.01));
      px = e.clientX;
      py = e.clientY;
    };
    const raycaster = new THREE.Raycaster();
    const up = (e: PointerEvent) => {
      dragging = false;
      dom.style.cursor = 'grab';
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      // click-pick: a click (not a drag) raycasts for rideRef/guestRef
      // carriers. Threshold 8px: real clicks (trackpads especially) wobble
      // 3-7px between down and up — under 8px is still a click, not an orbit.
      if (pickCbs.length && Math.hypot(e.clientX - downX, e.clientY - downY) < 8) {
        const r = dom.getBoundingClientRect();
        const castAt = (cx: number, cy: number): THREE.Object3D | null => {
          const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
          raycaster.setFromCamera(ndc, camera);
          for (const hit of raycaster.intersectObjects(scene.children, true)) {
            let o: THREE.Object3D | null = hit.object;
            while (o) {
              const ud = o.userData as { rideRef?: unknown; guestRef?: unknown };
              if (ud.rideRef !== undefined || ud.guestRef !== undefined) return o;
              o = o.parent;
            }
          }
          return null;
        };
        // screen-space tolerance: guests are small moving targets — when the
        // exact ray misses every carrier, retry a deterministic ±6px jitter
        // ring so near-miss clicks (aim error / the guest walked on since the
        // player aimed) still land. First carrier found wins.
        let picked = castAt(e.clientX, e.clientY);
        if (!picked) {
          const JIT: [number, number][] = [[6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, -4]];
          for (const [jx, jy] of JIT) {
            picked = castAt(e.clientX + jx, e.clientY + jy);
            if (picked) break;
          }
        }
        if (picked) {
          const target = picked;
          pickCbs.forEach((cb) => cb(target));
          return;
        }
      }
    };
    dom.addEventListener('pointerdown', down);
    dom.addEventListener('pointermove', move);
    dom.addEventListener('pointerup', up);

    // scroll to zoom: exponential dolly toward/away from the player pill.
    // Zooming all the way in (~0.9 units) puts the camera at the pill's eyes
    // — first-person; zooming out stops before the fog wall/far plane.
    const zoomMax = Math.max(distance * 3, 24);
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); // the page must not scroll under the canvas
      camDist = Math.max(0.9, Math.min(zoomMax, camDist * Math.exp(e.deltaY * 0.0011)));
    };
    dom.addEventListener('wheel', wheel, { passive: false });

    // keyboard navigation (always enabled): the arrows PAN the whole view
    // (orbit target + camera together) across the ground plane in
    // VIEW-RELATIVE directions — ↑ glides toward where the camera looks
    // (heading projected onto XZ), ↓ back, ← → strafe — while Space / Shift
    // fly the view UP / DOWN at ~2.2 units/s. Held-key set integrated
    // per-frame with dt → key-repeat safe; preventDefault stops the page
    // scrolling on Space/arrows. Drag stays the orbit; dolly stays on ↑↓ drag.
    type NavKey = 'fwd' | 'back' | 'left' | 'right' | 'up' | 'down';
    const NAV_KEYS: Record<string, NavKey> = {
      ArrowUp: 'fwd',
      ArrowDown: 'back',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      // Minecraft-fly aliases — same glide, WASD hands
      w: 'fwd',
      W: 'fwd',
      s: 'back',
      S: 'back',
      a: 'left',
      A: 'left',
      d: 'right',
      D: 'right',
      ' ': 'up',
      Spacebar: 'up',
      Shift: 'down',
    };
    const held = new Set<NavKey>();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = NAV_KEYS[e.key];
      if (!k) return;
      held.add(k);
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = NAV_KEYS[e.key];
      if (k) held.delete(k);
    };
    const onBlur = () => held.clear();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const clock = new THREE.Clock();
    let raf = 0;
    let lastT = 0;
    let frameN = 0;
    let budgetWarned = false;
    const FLY_SPEED = 2.2; // vertical fly, units/s (Space up / Shift down)
    const loop = () => {
      const frameStart = performance.now();
      const t = clock.getElapsedTime();
      const dt = Math.min(Math.max(t - lastT, 0), 0.1);
      lastT = t;
      renderer.info.reset(); // whole-frame totals for api.stats()
      if (dt > 0) statFps += (1 / dt - statFps) * 0.05; // rolling average
      if (shadowFreezeAt !== Infinity && --shadowFreezeAt <= 0) {
        renderer.shadowMap.autoUpdate = false; // static scene: depth map is final
        shadowFreezeAt = Infinity;
      }
      if (autoRotate && !dragging) az += 0.0045;
      // keyboard nav: glide the orbit target — the camera (derived from it)
      // rides along. Arrows pan view-relative on XZ (forward = camera heading
      // with y flattened: (-sin az, -cos az); right = forward × up), speed
      // scaling with the camera distance; Space/Shift fly vertically.
      if (held.size) {
        const fwd = (held.has('fwd') ? 1 : 0) - (held.has('back') ? 1 : 0);
        const side = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
        if (fwd || side) {
          const speed = Math.max(1.5, camDist * 0.45) * dt;
          const fx = -Math.sin(az);
          const fz = -Math.cos(az);
          target.x += (fwd * fx + side * -fz) * speed;
          target.z += (fwd * fz + side * fx) * speed;
        }
        if (held.has('up')) target.y += FLY_SPEED * dt;
        if (held.has('down')) target.y -= FLY_SPEED * dt;
      }
      // terrain following: soft-clamp the target above the ground first...
      const groundFn = groundOverride ?? groundAtRef.current;
      if (groundFn) {
        const tMin = groundFn(target.x, target.z) + 0.15;
        if (target.y < tMin) target.y += (tMin - target.y) * Math.min(1, dt * 10);
      }
      // the player pill stands on the target: eyes at the target height, feet
      // 0.66 below (capsule half-height 0.705, feet clear of the clamp)
      player.position.set(target.x, target.y - 0.05, target.z);
      player.rotation.y = az + Math.PI; // faces where the camera looks
      applyCam();
      // ...then lift the camera clear of the ground under it. The lift is
      // instant upward (never clips) but lerps back down (never pops).
      if (groundFn) {
        const cMin = groundFn(camera.position.x, camera.position.z) + 0.35;
        const need = Math.max(0, cMin - camera.position.y);
        camGroundLift = Math.max(need, camGroundLift + (need - camGroundLift) * Math.min(1, dt * 8));
        if (camGroundLift > 1e-4) {
          camera.position.y += camGroundLift;
          camera.lookAt(target);
        }
      } else {
        camGroundLift = 0;
      }
      // smooth day/night transition: sun fades to moonlight, park floods rise
      nightK += ((nightRef.current ? 1 : 0) - nightK) * 0.06;
      sun.intensity = 1.15 * (1 - nightK) + 0.12 * nightK;
      sun.color.lerpColors(daySun, moonCol, nightK);
      hemi.intensity = 0.62 * (1 - nightK) + 0.15 * nightK;
      hemi.color.lerpColors(dayHemiSky, nightHemiSky, nightK);
      hemi.groundColor.lerpColors(dayHemiGnd, nightHemiGnd, nightK);
      floods.forEach((fl, fi) => (fl.intensity = nightK * (1.7 + 0.15 * Math.sin(t * 7 + fi * 3))));
      bgNow.lerpColors(dayBg, nightBg, nightK);
      scene.background = bgNow;
      if (scene.fog) (scene.fog as THREE.Fog).color = bgNow;
      group.userData.nightK = nightK; // components read this via nightKOf()
      if (update) update(t);
      // main view first, then registered extra viewports (scissor multi-view)
      renderer.setScissorTest(true);
      renderer.setViewport(0, 0, w, h);
      renderer.setScissor(0, 0, w, h);
      renderer.render(scene, camera);
      // inset passes REUSE this frame's shadow maps: the sun didn't move
      // between passes, so re-rendering the depth map per viewport is pure
      // waste — freeze it for the insets, restore afterwards
      const shadowAutoWas = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      for (const vp of viewports) {
        const vw = Math.max(1, Math.round(vp.rect.w * w));
        const vh = Math.max(1, Math.round(vp.rect.h * h));
        const vx = Math.round(vp.rect.x * w);
        const vy = Math.round((1 - vp.rect.y - vp.rect.h) * h); // rect y is from the top; GL is from the bottom
        const pc = vp.cam as THREE.PerspectiveCamera;
        if (pc.isPerspectiveCamera && Math.abs(pc.aspect - vw / vh) > 1e-3) {
          pc.aspect = vw / vh;
          pc.updateProjectionMatrix();
        }
        renderer.setViewport(vx, vy, vw, vh);
        renderer.setScissor(vx, vy, vw, vh);
        // per-viewport hide list: toggle the roots invisible for THIS pass
        // only (descendants are skipped with them), restore right after —
        // lets onboard/chase player cams see past their own vehicle
        const hidden: THREE.Object3D[] = [];
        if (vp.hide) {
          for (const o of vp.hide) {
            if (o.visible) {
              o.visible = false;
              hidden.push(o);
            }
          }
        }
        renderer.render(scene, vp.cam);
        for (const o of hidden) o.visible = true;
      }
      renderer.shadowMap.autoUpdate = shadowAutoWas;
      statDrawCalls = renderer.info.render.calls;
      statTriangles = renderer.info.render.triangles;
      statFrameMs += (performance.now() - frameStart - statFrameMs) * 0.05; // rolling CPU frame time
      // one-time budget warning once the scene has settled (~5 s in): the
      // SETUP.md §13 reference points are ≲300 draws for a rig, ~2000 for a
      // park — 3000+/2.5M tris means something is unbatched
      frameN += 1;
      if (!budgetWarned && frameN === 300 && (statDrawCalls > 3000 || statTriangles > 2_500_000)) {
        budgetWarned = true;
        console.warn(
          `Stage: over render budget — ${statDrawCalls} draw calls / ${statTriangles} triangles per frame (budget ~3000 / 2.5M). Batch with mergedBoxes/InstancedMesh, tighten fog culling, or drop <Park quality>. SETUP.md §13.`,
        );
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    // responsive canvas: track BOTH dimensions of the wrapper
    const ro = new ResizeObserver(() => {
      w = el.clientWidth || w;
      h = el.clientHeight || h;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener('pointerdown', down);
      dom.removeEventListener('pointermove', move);
      dom.removeEventListener('pointerup', up);
      dom.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      renderer.dispose();
      scene.traverse((obj) => {
        const anyObj = obj as unknown as {
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        if (anyObj.geometry && !anyObj.geometry.userData?.shared) anyObj.geometry.dispose();
        const m = anyObj.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m?.dispose?.();
      });
      if (dom.parentNode === el) el.removeChild(dom);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // `height` is only the default — the canvas tracks the wrapper's real
    // size via ResizeObserver, so parents may stretch either dimension.
    // `fullscreen` (mandatory for park generation scenes) fills the viewport.
    <div style={{ position: 'relative', width: '100%', height: fullscreen ? '100vh' : height }}>
      <div
        ref={ref}
        style={{ width: '100%', height: '100%', borderRadius: fullscreen ? 0 : 12, overflow: 'hidden' }}
      />
      <UIDayNight night={isNight} onToggle={() => setIsNight((n) => !n)} />
    </div>
  );
}
