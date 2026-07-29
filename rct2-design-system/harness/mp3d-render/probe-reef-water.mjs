#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-reef-water.mjs — WHERE IS THE WATERLINE IN ReefRacer'S LAGOON?
//
// No browser. Bundles ReefRacer for node behind a canvas shim (Stage's
// procedural textures paint onto a <canvas>; geometry never reads the pixels),
// builds the scene with the PREVIEW's ground (flat, groundAt = () => 0) and
// then measures, by RAYCAST rather than by re-deriving the component's own
// arithmetic:
//
//   * the water sheet's plane height, and its DISPLACED surface (the §3b dive
//     bakes a dip into the vertices, so the sheet's surface is NOT one plane)
//   * the sand top at a grid of points, tagged with WHICH mesh was hit
//     (bed / wet / dry / spit / dune by material colour)
//   * for every grid point inside the sheet's own ellipse: is there water over
//     the sand, and how deep — i.e. the EXPOSED FLOOR area and the wet shore
//   * every reef-scatter item (coral head, reef rock) — its seat, its top, and
//     whether the top is under the waterline
//   * the track centreline's lowest point and the trough floor under it (what
//     the water must never reach), and the trestle SUPPORT FEET (what a dug
//     basin would leave floating)
//
//   node probe-reef-water.mjs [--json] [--rays=N]
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
// `--src=<index.tsx>` probes a DIFFERENT copy of the component — used to measure
// the pre-change baseline with this exact ruler instead of trusting old output.
const srcArg = (process.argv.find((a) => a.startsWith('--src=')) || '').slice(6);
const SRC = srcArg ? path.resolve(srcArg) : path.join(REPO, 'components/ReefRacer/index.tsx');

const entry = path.join(OUT, `_probe-reef-entry${srcArg ? '-alt' : ''}.ts`);
fs.writeFileSync(
  entry,
  `export * from ${JSON.stringify(SRC)};
export { compileTrackPieces } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit/pieces.ts'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, `_probe-reef-bundle${srcArg ? '-alt' : ''}.mjs`);
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

const built = K.buildReefRacerScene(T, { groundAt: () => 0 });
const g = built.group;
g.updateMatrixWorld(true);

// ---------------------------------------------------------------------------
// 1. the water sheet + the cove's published plan
// ---------------------------------------------------------------------------
const plan = g.userData.lagoon ?? null;
let sheet = null;
g.traverse((o) => {
  if (o.isMesh && o.userData.lagoonSheet) sheet = o;
});
if (!sheet)
  g.traverse((o) => {
    if (o.isMesh && o.material && (o.material.isShaderMaterial || o.material.isRawShaderMaterial)
        && o.geometry.getAttribute('position').count === 129 * 129) sheet = o;
  });
if (!sheet) { console.error('probe: no water sheet found'); process.exit(1); }
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
// the SHEET's own clip ellipse (what the shader draws) and the COVE's plan
// ellipse (what the sand is laid out against) are deliberately different sizes
const LB = plan ? plan.b : uRadius;
const LA = plan ? plan.a : uRadius * kx;
const LX = sheet.position.x;
const LZ = sheet.position.z;
const clipB = uRadius;
const clipA = uRadius * kx;
const W = 129;
const step = (lx1 - lx0) / (W - 1);
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
  while (n) { if (n.userData && n.userData.sand) return n.userData.sand; n = n.parent; }
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
    x: +o.position.x.toFixed(4),
    z: +o.position.z.toFixed(4),
    seatY: +o.position.y.toFixed(4),
    top: +bb.max.y.toFixed(4),
    bottom: +bb.min.y.toFixed(4),
    r: +sheetR(o.position.x, o.position.z).toFixed(4),
  });
});

// ---------------------------------------------------------------------------
// 4. RAYCAST height map. Straight down from y = +8 over the sheet's bbox.
// ---------------------------------------------------------------------------
const N = Number((process.argv.find((a) => a.startsWith('--rays=')) || '').slice(7) || 121);
const rc = new T.Raycaster();
rc.far = 40;
const down = new T.Vector3(0, -1, 0);
const cells = [];
for (let i = 0; i < N; i += 1)
  for (let j = 0; j < N; j += 1) {
    const x = LX + ((i / (N - 1)) * 2 - 1) * LA * 1.35;
    const z = LZ + ((j / (N - 1)) * 2 - 1) * LB * 1.35;
    rc.set(new T.Vector3(x, 8, z), down);
    const hits = rc.intersectObjects(rayTargets, true);
    if (!hits.length) continue;
    // the TOP-most hit that is ground-ish (skip the track/trestle overhead):
    // take the highest hit at or below y = 1.2 so a trestle bent overhead does
    // not shadow the sand under it.
    const h = hits.find((q) => q.point.y <= 1.2);
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
// 5. the flume trough (what the lagoon must never reach) and the ride group's
//    own footing (what a floating support foot would show up as)
// ---------------------------------------------------------------------------
let ribbon = null;
g.traverse((o) => {
  if (!o.isMesh || o.userData.lagoonSheet) return;
  const m = o.material;
  if (m && (m.isShaderMaterial || m.isRawShaderMaterial)) ribbon = o;
});
const ribbonBB = ribbon ? new T.Box3().setFromObject(ribbon) : null;
const rideBB = new T.Box3().setFromObject(g.children[0]);

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------
// THE BASIN FLOOR is the bed + the awash wet band. The spit is dry by design
// (the queue stands on it) and the apron is MEANT to stand above the sheet (the
// §3b dive tucks the sheet under it), so neither is "exposed floor".
const inside = cells.filter((c) => c.what === 'bed' || c.what === 'wet');
// BARE BASIN FLOOR: a bed/wet cell with no water over it — either the sand
// stands above the sheet's surface, or (the defect that made the grey-brown
// ring) the sheet's clip ellipse never reached that far out at all.
const exposed = inside.filter((c) => c.wy === null || c.y > c.wy);
const depths = inside.filter((c) => c.wy !== null && c.y <= c.wy).map((c) => c.wy - c.y).sort((a, b) => a - b);
const pct = (n, d) => `${((100 * n) / d).toFixed(1)}%`;
const q = (a, f) => (a.length ? a[Math.min(a.length - 1, Math.floor(f * a.length))] : NaN);

// dry-band width along 24 rays: from the outermost water cell to the first
// DRY-class cell, measured in world units
const bands = [];
for (let k = 0; k < 24; k += 1) {
  const a = (k / 24) * Math.PI * 2;
  let rWater = 0; // largest r with water over the sand
  let rDry = Infinity; // smallest r whose hit is a DRY class
  for (let s = 0; s <= 200; s += 1) {
    const r = 0.2 + (s / 200) * 1.15;
    const x = LX + Math.cos(a) * LA * r;
    const z = LZ + Math.sin(a) * LB * r;
    rc.set(new T.Vector3(x, 8, z), down);
    const hits = rc.intersectObjects(rayTargets, true);
    const h = hits.find((p2) => p2.point.y <= 1.2);
    if (!h) continue;
    const wy = sheetHeightAt(x, z);
    if (wy !== null && h.point.y < wy) rWater = r;
    const nm = sandOf(h.object);
    if ((nm === 'dry' || nm === 'dune') && r < rDry) rDry = r;
  }
  const rr = Math.hypot(Math.cos(a) * LA, Math.sin(a) * LB);
  bands.push({ deg: Math.round((a * 180) / Math.PI), rWater, rDry, widthU: (rDry - rWater) * rr });
}

const out = {
  plan,
  sheet: {
    clipA,
    clipB,
    plane_y: sheetY,
    uRadius_LB: LB,
    LA,
    LX,
    LZ,
    dive_min: diveMin,
    dive_max: diveMax,
    surface_y_min: sheetY + diveMin,
    surface_y_max: sheetY + diveMax,
  },
  sandClasses: [...classes.entries()].map(([k, c]) => ({
    class: k,
    verts: c.n,
    yMin: +c.yMin.toFixed(4),
    yMax: +c.yMax.toFixed(4),
    rMin: +c.rMin.toFixed(3),
    rMax: +c.rMax.toFixed(3),
  })),
  coverage: {
    cellsInsideSheet: inside.length,
    exposedFloor: exposed.length,
    exposedPct: pct(exposed.length, inside.length),
    depth_p10: q(depths, 0.1),
    depth_median: q(depths, 0.5),
    depth_p90: q(depths, 0.9),
    depth_max: depths[depths.length - 1],
  },
  shoreBands: bands,
  shoreBandMedianU: bands.map((b) => b.widthU).sort((a, b) => a - b)[12],
  scatter: {
    n: scatter.length,
    submerged: scatter.filter((s) => s.top < sheetY - 0.04).length,
    awash: scatter.filter((s) => s.top >= sheetY - 0.04 && s.top < sheetY + 0.06).length,
    proud: scatter.filter((s) => s.top >= sheetY + 0.06).length,
    topMin: Math.min(...scatter.map((s) => s.top)),
    topMax: Math.max(...scatter.map((s) => s.top)),
    seatMin: Math.min(...scatter.map((s) => s.seatY)),
    seatMax: Math.max(...scatter.map((s) => s.seatY)),
    items: scatter.sort((a, b) => b.top - a.top).slice(0, 12),
  },
  channelWater: ribbonBB ? { y_min: ribbonBB.min.y, y_max: ribbonBB.max.y } : null,
  rideGroup: { y_min: rideBB.min.y, y_max: rideBB.max.y },
  wreck: {
    hullAt: g.userData.wreckAt,
    bowAt: g.userData.bowAt,
    bowspritAt: g.userData.bowspritAt,
  },
};

if (asJson) {
  console.log(JSON.stringify(out, null, 2));
} else {
  const p = (s) => console.log(s);
  p('=== ReefRacer lagoon, groundAt = 0 (the previews\' ground) ===');
  if (plan) p(`published plan: waterY ${plan.waterY.toFixed(4)}  bedFloor ${plan.bedFloorY.toFixed(4)}  bedShelf ${plan.bedShelfY.toFixed(4)}  LIP ${plan.lipY.toFixed(4)}  spit ${plan.spitY.toFixed(4)}`);
  p(`sheet clip ellipse ${clipA.toFixed(3)} x ${clipB.toFixed(3)} vs cove plan ${LA.toFixed(3)} x ${LB.toFixed(3)}  (ratio ${(clipB / LB).toFixed(3)})`);
  p(`water sheet plane y   ${sheetY.toFixed(4)}   centre (${LX.toFixed(3)}, ${LZ.toFixed(3)})  LA ${LA.toFixed(3)}  LB ${LB.toFixed(3)}`);
  p(`  displaced surface   ${(sheetY + diveMin).toFixed(4)} .. ${(sheetY + diveMax).toFixed(4)}  (dive ${diveMin.toFixed(4)}..${diveMax.toFixed(4)})`);
  p('');
  p('sand classes (world y over ALL vertices, r = sheet-ellipse radius):');
  for (const c of out.sandClasses)
    p(`  ${c.class.padEnd(16)} verts ${String(c.verts).padStart(7)}  y ${c.yMin.toFixed(4)} .. ${c.yMax.toFixed(4)}   r ${c.rMin.toFixed(2)} .. ${c.rMax.toFixed(2)}`);
  p('');
  p(`coverage over the BASIN FLOOR — bed + wet band (${inside.length} raycast cells):`);
  p(`  EXPOSED floor (sand above the water surface)  ${exposed.length}  = ${out.coverage.exposedPct}`);
  p(`  depth p10 / median / p90 / max  ${out.coverage.depth_p10?.toFixed(4)} / ${out.coverage.depth_median?.toFixed(4)} / ${out.coverage.depth_p90?.toFixed(4)} / ${out.coverage.depth_max?.toFixed(4)}`);
  p('');
  p(`shore band (outermost water -> first DRY plate), median ${out.shoreBandMedianU.toFixed(3)} u:`);
  p('  ' + bands.map((b) => `${b.deg}:${b.widthU.toFixed(2)}`).join(' '));
  p('');
  p(`reef scatter: ${scatter.length} items — submerged ${out.scatter.submerged}, awash ${out.scatter.awash}, PROUD ${out.scatter.proud}`);
  p(`  seat y ${out.scatter.seatMin.toFixed(3)} .. ${out.scatter.seatMax.toFixed(3)}   top y ${out.scatter.topMin.toFixed(3)} .. ${out.scatter.topMax.toFixed(3)}`);
  for (const s of out.scatter.items)
    p(`  ${s.kind.padEnd(6)} r ${s.r.toFixed(2)}  seat ${s.seatY.toFixed(3)}  top ${s.top.toFixed(3)}  (${(s.top - sheetY).toFixed(3)} vs waterline)`);
  p('');
  p(`channel water ribbon y ${ribbonBB.min.y.toFixed(3)} .. ${ribbonBB.max.y.toFixed(3)}   (lagoon must stay under ${ribbonBB.min.y.toFixed(3)})`);
  p(`ride group (supports -> summit) y ${rideBB.min.y.toFixed(3)} .. ${rideBB.max.y.toFixed(3)}`);
  p(`wreck hull at ${JSON.stringify(out.wreck.hullAt?.map((n) => +n.toFixed(2)))}  bow at ${JSON.stringify(out.wreck.bowAt?.map((n) => +n.toFixed(2)))}`);
}

// ---------------------------------------------------------------------------
// ASSERTIONS — each one names the defect it catches. exit 1 on any FAIL.
// ---------------------------------------------------------------------------
const lip = plan ? plan.lipY : Math.max(...out.sandClasses.filter((c) => c.class === 'dry').map((c) => c.yMax));
const spitTop = plan ? plan.spitY : NaN;
const bedFloor = plan ? plan.bedFloorY : NaN;
const scatterTops = scatter.map((x) => x.top).sort((a, b) => a - b);
const median = (a) => a[Math.floor(a.length / 2)];
const checks = [
  ['waterBelowApronLip', sheetY < lip, `water ${sheetY.toFixed(3)} < apron lip ${lip.toFixed(3)}`],
  ['waterAboveBedFloor', sheetY > bedFloor + 0.15, `water ${sheetY.toFixed(3)} > bed floor ${bedFloor.toFixed(3)} + 0.15`],
  ['bedAboveHostGround', bedFloor > 0, `bed floor ${bedFloor.toFixed(3)} > host ground 0 (else the host's surface hides it)`],
  ['spitStaysDry', spitTop > sheetY + 0.02, `spit ${spitTop.toFixed(3)} > water ${sheetY.toFixed(3)} + 0.02`],
  ['troughNotFlooded', ribbonBB && sheetY < ribbonBB.min.y - 0.1, `water ${sheetY.toFixed(3)} < channel water ${ribbonBB.min.y.toFixed(3)} - 0.1`],
  ['basinFloorCovered', exposed.length / inside.length < 0.05, `${out.coverage.exposedPct} of the basin floor has no water over it (< 5%; it was 22.8% before this pass)`],
  ['scatterMostlySubmerged', median(scatterTops) < sheetY, `median scatter top ${median(scatterTops).toFixed(3)} < water ${sheetY.toFixed(3)}`],
  ['someScatterBreaksSurface', scatterTops[scatterTops.length - 1] > sheetY + 0.05, `tallest scatter top ${scatterTops[scatterTops.length - 1].toFixed(3)} > water + 0.05`],
  ['wreckBreaksSurface', rideBB.max.y > sheetY && (g.userData.wreckAt?.[1] ?? 0) >= sheetY - 0.4, `wreck hull origin ${(g.userData.wreckAt?.[1] ?? NaN).toFixed(3)} at/above the waterline`],
];
let bad = 0;
console.log('');
for (const [name, ok, detail] of checks) {
  if (!ok) bad += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name.padEnd(24)} ${detail}`);
}
if (bad) {
  console.log(`\n${bad} assertion(s) FAILED`);
  process.exit(1);
}
