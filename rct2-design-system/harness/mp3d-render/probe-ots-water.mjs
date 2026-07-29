#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-ots-water.mjs — WHERE IS THE WATERLINE IN OceanTunnelSlide'S LAGOON?
//
// The same ruler as probe-reef-water.mjs, pointed at the sea slide. No browser:
// it bundles the component for node behind a canvas shim (Stage's procedural
// textures paint onto a <canvas>; geometry never reads the pixels), builds the
// scene with the PREVIEW's ground (flat, `groundAt = () => 0`) and then
// MEASURES BY RAYCAST rather than by re-deriving the component's own arithmetic:
//
//   * the sheet's plane height and its DISPLACED surface (a baked shore dive
//     means the surface is NOT one plane), plus its clip ellipse
//   * the sand top on a grid, tagged with WHICH class was hit (bed / wet / dry /
//     spit / dune, off `userData.sand` — every sand class is the same white
//     `mat()` + texture, so colour cannot tell them apart)
//   * for every grid cell over the basin floor: is there water over the sand and
//     HOW DEEP — the exposed-floor area, and the depth DISTRIBUTION, which is
//     what "the pool has no depth read" actually means numerically
//   * whether the host's own ground (the grass disc / <Terrain>) is what shows
//     through the sheet instead of the component's pale bed — the defect that
//     makes a lagoon read as one flat painted disc
//   * the shore band: how far it is from the last water cell to the first DRY
//     plate, per azimuth (0 = a hard cut from teal to sand)
//   * every reef item (rock / kelp) — submerged, awash or PROUD of the water
//   * the spit (the queue stands on it) and the trough water, against the line
//   * THE RIDE'S OWN ACCESS ANCHORS against its own shoreline (see §8 below) —
//     because a lagoon with the ride's queue standing in the middle of it is not
//     a fixed lagoon, and that is exactly what the first pass shipped
//
//   node probe-ots-water.mjs [--json] [--rays=N] [--src=<index.tsx>]
//
// `--src=` probes a DIFFERENT copy of the component, which is how the
// pre-change baseline is measured with this exact ruler instead of trusting
// remembered numbers.
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, set: () => true });
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => noop, toDataURL: () => '' }),
};

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });
const asJson = process.argv.includes('--json');
const srcArg = (process.argv.find((a) => a.startsWith('--src=')) || '').slice(6);
const SRC = srcArg ? path.resolve(srcArg) : path.join(REPO, 'components/OceanTunnelSlide/index.tsx');
const suffix = srcArg ? '-alt' : '';

const entry = path.join(OUT, `_probe-ots-water-entry${suffix}.ts`);
// THE CHASSIS'S OWN ARITHMETIC, IMPORTED, NEVER RETYPED. `layout.front` is not
// the entrance hut and it is not the exit at all: the hut stands HUT_BACK (0.62)
// behind the queue head and the exit is DERIVED one TILE along the station face
// by `adjacentExitCells` (`layout.exit` has been a side hint only since the RCT2
// adjacency rework). The previous pass measured the exit at the old absolute
// `layout.exit` offset [2.0, 2.2] — a cell the chassis has not placed a hut on
// for two versions — and reported plan radius 0.904 for a hut that was actually
// at 0.751. Import the real functions and the probe cannot make that mistake.
fs.writeFileSync(
  entry,
  `export * from ${JSON.stringify(SRC)};
export * as THREE from 'three';
export { adjacentExitCells } from ${JSON.stringify(path.join(REPO, 'components/Park/configurableRide'))};
export { laneLenOf, TILE } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
`,
);
const bundlePath = path.join(OUT, `_probe-ots-water-bundle${suffix}.mjs`);
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundlePath,
  format: 'esm',
  jsx: 'automatic',
  platform: 'node',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  target: 'node20',
  logLevel: 'error',
});
const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;

// the PREVIEW's ground: flat at 0. Stage's own grass disc sits at y = −0.02 in a
// preview, so "is the component's bed above the host's surface" is a question
// about 0 here and about the <Terrain> mesh in a park — same arithmetic either
// way, because every level in the component is quoted off `groundAt`.
const HOST_GROUND = 0;
const built = K.buildOceanTunnelSlideScene(T, { groundAt: () => HOST_GROUND });
const g = built.group;
g.updateMatrixWorld(true);

// ---------------------------------------------------------------------------
// 1. the sheet + the published plan
// ---------------------------------------------------------------------------
const plan = g.userData.lagoon ?? null;
let sheet = null;
g.traverse((o) => {
  if (o.isMesh && o.userData.lagoonSheet) sheet = o;
});
if (!sheet) {
  console.error('probe: no water sheet found (expected userData.lagoonSheet on the lagoon mesh)');
  process.exit(1);
}
const sheetY = sheet.position.y;
const spos = sheet.geometry.getAttribute('position');
const kx = sheet.scale.x;
let diveMin = Infinity;
let diveMax = -Infinity;
let lx0 = Infinity;
let lx1 = -Infinity;
for (let i = 0; i < spos.count; i += 1) {
  diveMin = Math.min(diveMin, spos.getZ(i));
  diveMax = Math.max(diveMax, spos.getZ(i));
  lx0 = Math.min(lx0, spos.getX(i));
  lx1 = Math.max(lx1, spos.getX(i));
}
const uRadius = sheet.material.uniforms?.uRadius?.value ?? null;
const uWav = sheet.material.uniforms?.uWav?.value ?? null;
const uAmp = sheet.material.uniforms?.uAmp?.value ?? null;
const LX = sheet.position.x;
const LZ = sheet.position.z;
const LB = plan ? plan.b : uRadius;
const LA = plan ? plan.a : uRadius * kx;
const clipB = uRadius;
const clipA = uRadius * kx;
const W = Math.round(Math.sqrt(spos.count)); // the plane is seg+1 square
const step = (lx1 - lx0) / (W - 1);
/** the sheet's DISPLACED surface height at a world point, or null where the
 *  shader discards (outside its own clip circle) */
const sheetHeightAt = (wx, wz) => {
  const lxv = (wx - LX) / kx;
  const lyv = -(wz - LZ);
  const ix = Math.round((lxv - lx0) / step);
  const iy = Math.round((lyv - lx0) / step);
  if (ix < 0 || ix >= W || iy < 0 || iy >= W) return null;
  if (Math.hypot(lxv, lyv) > uRadius) return null; // the shader discards here
  return sheetY + spos.getZ((W - 1 - iy) * W + ix);
};
const sheetR = (x, z) => Math.hypot((x - LX) / LA, (z - LZ) / LB);

// ---------------------------------------------------------------------------
// 2. the sand lattice, by its OWN userData.sand tag
// ---------------------------------------------------------------------------
const classes = new Map();
const v = new T.Vector3();
const rayTargets = [];
const sandOf = (o) => {
  let n = o;
  while (n) {
    if (n.userData && n.userData.sand) return n.userData.sand;
    n = n.parent;
  }
  return null;
};
g.traverse((o) => {
  if (!o.isMesh) return;
  const m = o.material;
  if (m && (m.isShaderMaterial || m.isRawShaderMaterial)) return; // water
  rayTargets.push(o);
  const key = sandOf(o);
  if (!key) return;
  let c = classes.get(key);
  if (!c) classes.set(key, (c = { n: 0, yMin: Infinity, yMax: -Infinity, rMin: Infinity, rMax: -Infinity }));
  const p = o.geometry.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
    c.n += 1;
    c.yMin = Math.min(c.yMin, v.y);
    c.yMax = Math.max(c.yMax, v.y);
    const r = sheetR(v.x, v.z);
    c.rMin = Math.min(c.rMin, r);
    c.rMax = Math.max(c.rMax, r);
  }
});

// ---------------------------------------------------------------------------
// 3. the reef scatter, by its OWN userData.reef tag
// ---------------------------------------------------------------------------
const scatter = [];
g.traverse((o) => {
  if (!o.userData || !o.userData.reef) return;
  const bb = new T.Box3().setFromObject(o);
  scatter.push({
    kind: o.userData.reef,
    x: +o.position.x.toFixed(3),
    z: +o.position.z.toFixed(3),
    seatY: +o.position.y.toFixed(4),
    top: +bb.max.y.toFixed(4),
    r: +sheetR(o.position.x, o.position.z).toFixed(3),
  });
});

// ---------------------------------------------------------------------------
// 4. RAYCAST height map, straight down over the sheet's own bbox
// ---------------------------------------------------------------------------
const N = Number((process.argv.find((a) => a.startsWith('--rays=')) || '').slice(7) || 121);
const rc = new T.Raycaster();
rc.far = 60;
const down = new T.Vector3(0, -1, 0);
const cells = [];
for (let i = 0; i < N; i += 1)
  for (let j = 0; j < N; j += 1) {
    const x = LX + ((i / (N - 1)) * 2 - 1) * LA * 1.35;
    const z = LZ + ((j / (N - 1)) * 2 - 1) * LB * 1.35;
    rc.set(new T.Vector3(x, 14, z), down);
    const hits = rc.intersectObjects(rayTargets, true);
    if (!hits.length) continue;
    // the highest hit at or below y = 1.4: the tower deck, the track and the
    // tube all fly overhead and must not shadow the sand under them
    const h = hits.find((q) => q.point.y <= 1.4);
    if (!h) continue;
    cells.push({
      x,
      z,
      r: sheetR(x, z),
      y: h.point.y,
      what: sandOf(h.object) ?? 'other',
      wy: sheetHeightAt(x, z),
    });
  }

// ---------------------------------------------------------------------------
// 5. what is UNDER the sheet where it is drawn — the flat-disc question.
//    A cell whose top hit is 'other' (i.e. NOT one of this component's sand
//    plates) is either the host's ground or a piece of the ride; a cell with no
//    hit at all is bare host ground the raycast never sees, which reads exactly
//    the same on screen. Both mean the sheet has no bed of its own under it.
// ---------------------------------------------------------------------------
const wet = cells.filter((c) => c.wy !== null); // the sheet is DRAWN here
// WHICH CLASS is the sheet drawn over, and how far under the surface is it?
// `dry`/`dune`/`spit` appearing here at all means the sheet is drawn over land
// that is meant to be DRY — a lagoon painted across its own beach.
const perClass = new Map();
for (const c of wet) {
  let e = perClass.get(c.what);
  if (!e) perClass.set(c.what, (e = { n: 0, under: [], over: 0 }));
  e.n += 1;
  if (c.y > c.wy) e.over += 1;
  else e.under.push(c.wy - c.y);
}
const overBed = wet.filter((c) => c.what === 'bed' || c.what === 'wet');
const overOther = wet.filter((c) => c.what !== 'bed' && c.what !== 'wet');
const depths = overBed.filter((c) => c.y <= c.wy).map((c) => c.wy - c.y).sort((a, b) => a - b);
const exposed = overBed.filter((c) => c.y > c.wy);
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');
const q = (a, f) => (a.length ? a[Math.min(a.length - 1, Math.floor(f * a.length))] : NaN);
// a lagoon with a DEPTH READ has a spread of depths; a painted disc has one
// depth everywhere. p90 − p10 is that spread in world units.
const spread = depths.length ? q(depths, 0.9) - q(depths, 0.1) : NaN;

// ---------------------------------------------------------------------------
// 6. the shore band, per azimuth: last water cell -> first DRY plate
// ---------------------------------------------------------------------------
const bands = [];
for (let k = 0; k < 24; k += 1) {
  const a = (k / 24) * Math.PI * 2;
  let rWater = 0;
  let rDry = Infinity;
  let rWetBand = Infinity;
  for (let s = 0; s <= 200; s += 1) {
    const r = 0.2 + (s / 200) * 1.2;
    const x = LX + Math.cos(a) * LA * r;
    const z = LZ + Math.sin(a) * LB * r;
    rc.set(new T.Vector3(x, 14, z), down);
    const hits = rc.intersectObjects(rayTargets, true);
    const h = hits.find((p2) => p2.point.y <= 1.4);
    if (!h) continue;
    const wy = sheetHeightAt(x, z);
    if (wy !== null && h.point.y < wy) rWater = r;
    const nm = sandOf(h.object);
    if ((nm === 'dry' || nm === 'dune') && r < rDry) rDry = r;
    if (nm === 'wet' && r < rWetBand) rWetBand = r;
  }
  const rr = Math.hypot(Math.cos(a) * LA, Math.sin(a) * LB);
  bands.push({
    deg: Math.round((a * 180) / Math.PI),
    rWater,
    rDry: Number.isFinite(rDry) ? rDry : null,
    widthU: Number.isFinite(rDry) ? (rDry - rWater) * rr : null,
    wetFrom: Number.isFinite(rWetBand) ? rWetBand : null,
  });
}
const bandW = bands.map((b) => b.widthU).filter((n) => n !== null).sort((a, b) => a - b);

// ---------------------------------------------------------------------------
// 7. the trough water (must never be drowned) and the ride group's extent
// ---------------------------------------------------------------------------
let ribbon = null;
g.traverse((o) => {
  if (!o.isMesh || o.userData.lagoonSheet) return;
  const m = o.material;
  if (m && (m.isShaderMaterial || m.isRawShaderMaterial) && o.geometry.getAttribute('local')) ribbon = o;
});
const ribbonBB = ribbon ? new T.Box3().setFromObject(ribbon) : null;

// ---------------------------------------------------------------------------
// 8. THE RIDE'S OWN ACCESS ANCHORS, against its own shoreline.
//
// <ConfigurableRide> seats the queue lane and BOTH huts on the PARK's terrain
// (configurableRide.tsx:684), not on this component's sand — so any access
// anchor inside the lagoon is a hut standing in the ride's own hero water, and
// the first pass had all four of them there (queue head plan radius 0.854).
//
// TWO CONTOURS ARE MEASURED, and the difference between them is the whole point:
//
//   WATERLINE  the outermost radius on the anchor's own azimuth where water
//              actually stands over the sand. What you SEE.
//   CLIP       the outermost radius where the shader draws the sheet AT ALL
//              (`uRadius`, plan 1.16). Past the waterline by design, because
//              §5b hides the overshoot UNDER proud sand — except over the spit,
//              where the sand is at the host's level and cannot hide anything, so
//              there the sheet is only kept off by the §5b MASK.
//
// An anchor outside the WATERLINE is dry in the shipped build. An anchor outside
// the CLIP is dry NO MATTER WHAT THE MASK DOES — which is the only version of
// this that a future edit to the water cannot silently undo.
// ---------------------------------------------------------------------------
const access = g.userData.access ?? null;
const topAt = (x, z) => {
  rc.set(new T.Vector3(x, 14, z), down);
  const hits = rc.intersectObjects(rayTargets, true);
  const h = hits.find((p2) => p2.point.y <= 1.4); // the deck, the track and the tube fly overhead
  return h ? { y: h.point.y, what: sandOf(h.object) ?? 'other' } : null;
};
/** how many WORLD units one unit of PLAN RADIUS is worth on this azimuth — the
 *  cove is an ellipse, so a radius margin means nothing until it is converted */
const radialScaleAt = (az) => Math.hypot(Math.cos(az) * LA, Math.sin(az) * LB);
const azOf = (x, z) => Math.atan2((z - LZ) / LB, (x - LX) / LA);
const scanAz = (az) => {
  let rWater = null;
  let rDrawn = null;
  for (let s = 0; s <= 480; s += 1) {
    const r = 0.05 + (s / 480) * 1.6;
    const x = LX + Math.cos(az) * LA * r;
    const z = LZ + Math.sin(az) * LB * r;
    const wy = sheetHeightAt(x, z);
    if (wy === null) continue;
    rDrawn = r;
    const h = topAt(x, z);
    if (h && h.y < wy) rWater = r;
  }
  return { rWater, rDrawn };
};
const anchors = [];
if (access) {
  // the probe builds the component at the ORIGIN with no rotation, so its local
  // frame IS world here: local +z is world +z. In a park the same offsets are
  // rotated by the mount yaw, which cannot change any radius quoted below —
  // `front` is measured along the ride's own +z face either way.
  const front = access.front ?? 1.8;
  const dir = [0, 1];
  const head = [0, front];
  const cells = K.adjacentExitCells(head, dir, Math.sign((access.exit ?? [-1.5, 1.35])[0]) || -1);
  // the entrance hut is the MIDPOINT of the two candidate exit cells (they sit
  // one tile either side of it) — derived, so HUT_BACK is never retyped here
  const ehut = [(cells[0].cell[0] + cells[1].cell[0]) / 2, (cells[0].cell[1] + cells[1].cell[1]) / 2];
  const laneLen = K.laneLenOf(access.defaults?.capacity ?? 4);
  const pts = [
    ['queue head', head],
    ['entrance hut', ehut],
    [`exit cell ${cells[0].side > 0 ? '-x' : '+x'} (hinted)`, cells[0].cell],
    [`exit cell ${cells[1].side > 0 ? '-x' : '+x'} (alt)`, cells[1].cell],
    ['lane mid', [head[0] + dir[0] * laneLen * 0.5, head[1] + dir[1] * laneLen * 0.5]],
    ['lane tail', [head[0] + dir[0] * laneLen, head[1] + dir[1] * laneLen]],
  ];
  for (const [label, p] of pts) {
    const [x, z] = p;
    const r = sheetR(x, z);
    const az = azOf(x, z);
    const sc = radialScaleAt(az);
    const { rWater, rDrawn } = scanAz(az);
    const wy = sheetHeightAt(x, z);
    const h = topAt(x, z);
    anchors.push({
      label,
      x: +x.toFixed(2),
      z: +z.toFixed(2),
      r: +r.toFixed(3),
      rWater: rWater === null ? null : +rWater.toFixed(3),
      rClip: rDrawn === null ? null : +rDrawn.toFixed(3),
      marginWaterU: rWater === null ? null : +((r - rWater) * sc).toFixed(2),
      marginClipU: rDrawn === null ? null : +((r - rDrawn) * sc).toFixed(2),
      sheetDrawn: wy !== null,
      // POSITIVE = water standing over this anchor, which is the defect
      waterDepth: wy === null || h === null ? null : +(wy - h.y).toFixed(3),
      standsOn: h ? h.what : null,
      // the huts are seated on the PARK's terrain: sand ABOVE the host's ground
      // here is sand the hut is BURIED in (the reason `front` cannot just keep
      // growing — past the spit the apron crest climbs to SEA + 0.055)
      sandTop: h ? +(h.y - HOST_GROUND).toFixed(3) : null,
    });
  }
}

const out = {
  plan,
  access,
  anchors,
  sheet: {
    plane_y: sheetY,
    clipA,
    clipB,
    LA,
    LB,
    LX,
    LZ,
    segments: W - 1,
    uWav,
    uAmp,
    swell: uAmp !== null && uWav !== null ? 0.3 * uAmp * uWav : null, // OCTAVES sum to ~0.30
    dive_min: diveMin,
    dive_max: diveMax,
    surface_y_min: sheetY + diveMin,
    surface_y_max: sheetY + diveMax,
  },
  hostGround: HOST_GROUND,
  sandClasses: [...classes.entries()].map(([k, c]) => ({
    class: k,
    verts: c.n,
    yMin: +c.yMin.toFixed(4),
    yMax: +c.yMax.toFixed(4),
    aboveHost: +(c.yMax - HOST_GROUND).toFixed(4),
    rMin: +c.rMin.toFixed(3),
    rMax: +c.rMax.toFixed(3),
  })),
  drawnOver: [...perClass.entries()]
    .map(([k, e]) => ({
      class: k,
      cells: e.n,
      pct: pct(e.n, wet.length),
      standingProud: e.over,
      depthMedian: e.under.length ? +e.under.sort((a, b) => a - b)[Math.floor(e.under.length / 2)].toFixed(4) : null,
    }))
    .sort((a, b) => b.cells - a.cells),
  underTheSheet: {
    cellsDrawn: wet.length,
    overOwnBed: overBed.length,
    overOwnBedPct: pct(overBed.length, wet.length),
    overSomethingElse: overOther.length,
    overSomethingElsePct: pct(overOther.length, wet.length),
    exposedFloor: exposed.length,
    exposedPct: pct(exposed.length, overBed.length),
  },
  depth: {
    n: depths.length,
    p10: q(depths, 0.1),
    median: q(depths, 0.5),
    p90: q(depths, 0.9),
    max: depths[depths.length - 1],
    spread_p10_p90: spread,
  },
  shore: {
    medianBandU: bandW.length ? bandW[Math.floor(bandW.length / 2)] : null,
    minBandU: bandW[0] ?? null,
    maxBandU: bandW[bandW.length - 1] ?? null,
    bands,
  },
  scatter: {
    n: scatter.length,
    submerged: scatter.filter((s) => s.top < sheetY - 0.04).length,
    awash: scatter.filter((s) => s.top >= sheetY - 0.04 && s.top < sheetY + 0.06).length,
    proud: scatter.filter((s) => s.top >= sheetY + 0.06).length,
    seatMin: scatter.length ? Math.min(...scatter.map((s) => s.seatY)) : null,
    seatMax: scatter.length ? Math.max(...scatter.map((s) => s.seatY)) : null,
    items: scatter.sort((a, b) => b.top - a.top).slice(0, 10),
  },
  troughWater: ribbonBB ? { y_min: +ribbonBB.min.y.toFixed(4), y_max: +ribbonBB.max.y.toFixed(4) } : null,
  meshes: rayTargets.length,
};

if (asJson) {
  console.log(JSON.stringify(out, null, 2));
} else {
  const p = (s) => console.log(s);
  p(`=== OceanTunnelSlide lagoon${srcArg ? ` [${path.basename(SRC)} @ ${path.dirname(SRC)}]` : ''}, groundAt = ${HOST_GROUND} ===`);
  if (plan)
    p(
      `published plan: waterY ${plan.waterY.toFixed(4)}` +
        (plan.bedFloorY !== undefined ? `  bedFloor ${plan.bedFloorY.toFixed(4)}  bedShelf ${plan.bedShelfY.toFixed(4)}` : '') +
        (plan.lipY !== undefined ? `  LIP ${plan.lipY.toFixed(4)}` : '') +
        (plan.spitY !== undefined ? `  spit ${plan.spitY.toFixed(4)}` : ''),
    );
  p(`sheet plane y ${sheetY.toFixed(4)}  clip ${clipA.toFixed(2)} x ${clipB.toFixed(2)}  plan ${LA.toFixed(2)} x ${LB.toFixed(2)}  (clip/plan ${(clipB / LB).toFixed(3)})`);
  p(`  displaced surface ${(sheetY + diveMin).toFixed(4)} .. ${(sheetY + diveMax).toFixed(4)}   swell +-${out.sheet.swell?.toFixed(4)}  (amp ${uAmp} x wav ${uWav})`);
  p('');
  p('sand classes (world y over ALL vertices, r = plan-ellipse radius):');
  for (const c of out.sandClasses)
    p(`  ${c.class.padEnd(6)} verts ${String(c.verts).padStart(7)}  y ${c.yMin.toFixed(4)} .. ${c.yMax.toFixed(4)}  (top ${c.aboveHost >= 0 ? '+' : ''}${c.aboveHost.toFixed(4)} vs host)  r ${c.rMin.toFixed(2)} .. ${c.rMax.toFixed(2)}`);
  p('');
  p(`WHAT IS UNDER THE SHEET (${wet.length} raycast cells where the shader draws water):`);
  p(`  over this component's own BED/WET sand   ${overBed.length}  = ${out.underTheSheet.overOwnBedPct}`);
  p(`  over something else (host ground / ride)  ${overOther.length}  = ${out.underTheSheet.overSomethingElsePct}`);
  p(`  BED/WET sand standing ABOVE the surface   ${exposed.length}  = ${out.underTheSheet.exposedPct}`);
  for (const d of out.drawnOver)
    p(`    over ${d.class.padEnd(6)} ${String(d.cells).padStart(5)} cells = ${d.pct.padStart(6)}   median depth ${d.depthMedian === null ? 'n/a' : d.depthMedian.toFixed(4)}  standing proud ${d.standingProud}`);
  p('');
  p(`DEPTH over the bed (${depths.length} cells):`);
  p(`  p10 ${out.depth.p10?.toFixed(4)}  median ${out.depth.median?.toFixed(4)}  p90 ${out.depth.p90?.toFixed(4)}  max ${out.depth.max?.toFixed(4)}`);
  p(`  SPREAD p90-p10 ${Number.isFinite(spread) ? spread.toFixed(4) : 'n/a'}   <- 0 = one flat depth everywhere = a painted disc`);
  p('');
  p(`SHORE band (last water -> first DRY plate): median ${out.shore.medianBandU?.toFixed(3)} u  min ${out.shore.minBandU?.toFixed(3)}  max ${out.shore.maxBandU?.toFixed(3)}`);
  p('  ' + bands.map((b) => `${b.deg}:${b.widthU === null ? '-' : b.widthU.toFixed(2)}`).join(' '));
  p('');
  p(`REEF scatter: ${out.scatter.n} items — submerged ${out.scatter.submerged}  awash ${out.scatter.awash}  PROUD ${out.scatter.proud}`);
  for (const s of out.scatter.items)
    p(`  ${s.kind.padEnd(5)} at (${s.x}, ${s.z}) r ${s.r}  seat ${s.seatY}  top ${s.top}  ${s.top >= sheetY + 0.06 ? 'PROUD' : s.top >= sheetY - 0.04 ? 'awash' : 'under'}`);
  if (ribbonBB) p('');
  if (ribbonBB) p(`trough water y ${out.troughWater.y_min} .. ${out.troughWater.y_max}   (sheet ${sheetY.toFixed(4)})`);
  p('');
  if (!access) {
    p('ACCESS ANCHORS: the build published no `userData.access` — cannot check the huts against the water');
  } else {
    p(
      `ACCESS ANCHORS (layout: front ${access.front}, exit hint [${access.exit}], board [${access.board}], capacity ${access.defaults?.capacity}):`,
    );
    for (const a of anchors)
      p(
        `  ${a.label.padEnd(22)} (${String(a.x).padStart(5)}, ${String(a.z).padStart(5)})  plan r ${a.r.toFixed(3)}` +
          `  | waterline ${a.rWater === null ? ' none' : a.rWater.toFixed(3)} -> ${a.marginWaterU === null ? 'n/a' : `${a.marginWaterU > 0 ? '+' : ''}${a.marginWaterU.toFixed(2)} u`}` +
          `  | clip ${a.rClip === null ? ' none' : a.rClip.toFixed(3)} -> ${a.marginClipU === null ? 'n/a' : `${a.marginClipU > 0 ? '+' : ''}${a.marginClipU.toFixed(2)} u`}` +
          `  | ${a.waterDepth !== null && a.waterDepth > 0 ? `UNDER ${a.waterDepth.toFixed(3)} OF WATER` : 'dry'}` +
          `  on ${String(a.standsOn).padEnd(5)} at ${a.sandTop === null ? 'n/a' : `${a.sandTop >= 0 ? '+' : ''}${a.sandTop.toFixed(3)}`} vs host`,
      );
    p('  (margins are WORLD units out along each anchor\'s own azimuth: waterline = what you see,');
    p('   clip = the radius past which no water can be drawn at all, i.e. dry whatever the spit mask does)');
  }
}
