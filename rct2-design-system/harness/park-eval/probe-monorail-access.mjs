#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-monorail-access.mjs — WHERE DO THE HUTS ACTUALLY LAND, relative to the
// platform deck and its ELEVATOR?
//
// WHY. The station lift is placed by `buildStationDeck` from the COMPILED deck
// pose alone (deck centre + the `left` unit that points at the ring interior).
// The entrance and exit huts are placed by the GameManager from the PARK's
// authored `queueAnchor` / `queueDir` / `exitPoint`. Nothing has ever compared
// the two, so "the lift is in front of the entrance" / "the exit has no lift"
// are claims about numbers nobody has printed. This prints them.
//
// The entrance hut is at `queueAnchor − 0.62·queueDir` (GameManager/registry.ts
// :155, the hut standing back from the queue HEAD); the exit hut is
// `handle.stations()[i].exitAt` verbatim.
//
// Usage:  node probe-monorail-access.mjs
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { HERE, REPO } from './paths.mjs';

const ctx2d = new Proxy({}, {
  get: (_t, k) =>
    k === 'canvas' ? { width: 8, height: 8 }
      : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} })
        : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4 * 64) })
          : () => {},
});
globalThis.document = {
  createElement: () => ({ width: 8, height: 8, getContext: () => ctx2d, toDataURL: () => '' }),
  createElementNS: () => ({ width: 8, height: 8, getContext: () => ctx2d }),
};
globalThis.window = globalThis;
globalThis.self = globalThis;

const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_mono-access.ts');
fs.writeFileSync(
  ep,
  `
import { buildMonorailScene } from ${JSON.stringify(path.join(REPO, 'components/Monorail'))};
import { createGameManager } from ${JSON.stringify(path.join(REPO, 'components/GameManager'))};
export { buildMonorailScene, createGameManager };
`,
);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_mono-access.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { buildMonorailScene, createGameManager } = await import(bundlePath);

// ---- the reference park's ring, at its reference MOUNT ----------------------
// samples/monorail-ref.tsx: <Monorail position={[-42.6, 0, -9.7]} beamY={2.6}>
const MONO_PIECES = [
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 }, { type: 'straight', length: 1.5 },
];
const BEAM_Y = 3.6;
const MOUNT = [-42.6, 0, -9.7]; // the component's world position

const quiet = console.warn;
console.warn = () => {};
const scene = buildMonorailScene(THREE, { pieces: MONO_PIECES, beamY: BEAM_Y, trains: 4 });
console.warn = quiet;
const poses = scene.stationPoses ?? [];
const L2W = (p) => [p[0] + MOUNT[0], p[1] + MOUNT[1], p[2] + MOUNT[2]];

// ---- the same registration the reference park performs ----------------------
const CAP = 6;
const laneLenOf = (c) => Math.max(2.2, 0.6 + c * 2 * 0.28 + 0.5);
const JOIN = laneLenOf(CAP) + 0.35;
const DECK_Y = BEAM_Y;
const NODES = [
  [-6, -62.4], [-6, -44.4], [0, -44.4], [0, -32.4], [0, -20.4], [0, -8.4],
  [-18, -8.4], [-36.0, -8.4], [18, -8.4], [36.0, -8.4], [0, 3.6], [0, 15.6], [0, 27.6],
];
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [5, 8], [8, 9], [5, 10], [10, 11], [11, 12]];
const STATIONS = [
  { label: 'West (primary)', boardPoint: [-42.6, DECK_Y, -8.4], queueAnchor: [-36.0 - JOIN, 0.05, -8.4], queueDir: [1, 0], exitPoint: [-36.0 - JOIN - 0.62, 0.05, -7.2], exitDir: [1, 0] },
  { label: 'North Gate', boardPoint: [0, DECK_Y, 34.2], queueAnchor: [0, 0.05, 27.6 + JOIN], queueDir: [0, -1], exitPoint: [-1.2, 0.05, 27.6 + JOIN + 0.62], exitDir: [0, -1] },
  { label: 'East Works', boardPoint: [42.6, DECK_Y, -8.4], queueAnchor: [36.0 + JOIN, 0.05, -8.4], queueDir: [-1, 0], exitPoint: [36.0 + JOIN + 0.62, 0.05, -7.2], exitDir: [-1, 0] },
  { label: 'South Gate', boardPoint: [0, DECK_Y, -51.0], queueAnchor: [0, 0.05, -44.4 - JOIN], queueDir: [0, 1], exitPoint: [1.2, 0.05, -44.4 - JOIN - 0.62], exitDir: [0, 1] },
];
const warns = [];
console.warn = (m) => warns.push(String(m));
const mgr = createGameManager(THREE, { net: { nodes: NODES, edges: EDGES }, groundAt: () => 0 });
mgr.registerParkEntrance({ spawnPoint: [0, 0, 0.6], archway: [0, 0, 0] }, { position: [-6, 0, -62.4], yaw: 0 });
const handle = mgr.registerRide({
  name: 'Grand Circle Monorail', capacity: CAP, rideDuration: 12, intensity: 1, price: 0,
  queueAnchor: STATIONS[0].queueAnchor, queueDir: STATIONS[0].queueDir,
  boardPoint: STATIONS[0].boardPoint, exitPoint: STATIONS[0].exitPoint, exitDir: STATIONS[0].exitDir,
  stations: STATIONS.slice(1),
  seatWorld: scene.seatWorld, onStateChange: scene.onStateChange,
});
console.warn = quiet;
warns.forEach((w) => console.log(`  registration warn: ${w}`));

// ---- hand the RESOLVED huts back, exactly as <ConfigurableRide> does --------
// The component is mounted at MOUNT, so put the group there before `update`:
// `onAccessPlaced` takes WORLD xz and converts through the group's own matrix, and
// a group left at the origin would convert them to the wrong local frame — the
// same trap the deferred-until-first-tick comment in index.tsx describes.
const st = handle.stations();
scene.group.position.set(MOUNT[0], MOUNT[1], MOUNT[2]);
scene.onAccessPlaced(
  st.map((s) => ({
    entrance: [s.queueAnchor[0] - s.queueDir[0] * 0.62, s.queueAnchor[2] - s.queueDir[1] * 0.62],
    exit: [s.exitAt[0], s.exitAt[2]],
  })),
);
scene.update(0); // the deferred placement lands on the first tick

// ---- what the COMPONENT actually built, per deck ----------------------------
// READ the cores out of the scene graph (userData.monorailCore) rather than
// re-deriving their offsets: re-deriving is how the old placement went
// unnoticed — the probe agreed with the bug because it repeated its arithmetic.
const OFF_ISLAND = 0.62;
const cores = [];
scene.group.traverse((o) => {
  if (o.userData && o.userData.monorailCore) cores.push(o);
});
const V = new THREE.Vector3();
const worldXZ = (o) => {
  o.updateWorldMatrix(true, false);
  V.set(0, 0, 0).applyMatrix4(o.matrixWorld);
  return [V.x, V.z];
};

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
console.log(`\n=== monorail ACCESS geometry — ${poses.length} platform(s), mounted at [${MOUNT.join(', ')}]`);
console.log(`    ${cores.length} vertical cores built (want ${poses.length * 3}: stairs + entrance lift + exit lift per deck)\n`);
const fails = [];
poses.forEach((p, i) => {
  const c = L2W(p.center);
  const [lx, lz] = p.left;
  const island = [c[0] + lx * OFF_ISLAND, c[2] + lz * OFF_ISLAND];
  const mine = cores.slice(i * 3, i * 3 + 3);
  const byKind = Object.fromEntries(mine.map((o) => [o.userData.monorailCore, worldXZ(o)]));
  const tower = byKind.stairs ?? [NaN, NaN];
  const lift = byKind.liftIn ?? [NaN, NaN];
  const liftOut = byKind.liftOut ?? [NaN, NaN];
  const s = st[i];
  const ent = s ? [s.queueAnchor[0] - s.queueDir[0] * 0.62, s.queueAnchor[2] - s.queueDir[1] * 0.62] : null;
  const exi = s ? [s.exitAt[0], s.exitAt[2]] : null;
  // along-deck and across-deck offsets of each hut, in the DECK's own frame
  const proj = (q) => {
    if (!q) return null;
    const dx = q[0] - c[0];
    const dz = q[1] - c[2];
    return { along: dx * p.dir[0] + dz * p.dir[1], across: dx * lx + dz * lz };
  };
  const pe = proj(ent);
  const px = proj(exi);
  const pt = proj(tower);
  const pl = proj(lift);
  const plo = proj(liftOut);
  // the queue HEAD: the lane runs OUTWARD from here, so anything at a greater
  // `across` than this is standing in the lane
  const head = s ? proj([s.queueAnchor[0], s.queueAnchor[2]]) : null;
  console.log(`platform ${i} — ${s ? s.label : '(unregistered)'}`);
  console.log(`  deck centre  [${c[0].toFixed(2)}, ${c[2].toFixed(2)}]   dir [${p.dir.map((v) => v.toFixed(2))}]   left [${p.left.map((v) => v.toFixed(2))}]   length ${p.length.toFixed(2)}`);
  console.log(`  island       [${island[0].toFixed(2)}, ${island[1].toFixed(2)}]   along 0.00, across ${OFF_ISLAND.toFixed(2)}`);
  if (ent) console.log(`  ENTRANCE hut [${ent[0].toFixed(2)}, ${ent[1].toFixed(2)}]   along ${pe.along.toFixed(2)}, across ${pe.across.toFixed(2)}`);
  if (exi) console.log(`  EXIT hut     [${exi[0].toFixed(2)}, ${exi[1].toFixed(2)}]   along ${px.along.toFixed(2)}, across ${px.across.toFixed(2)}`);
  if (head) console.log(`  queue HEAD   along ${head.along.toFixed(2)}, across ${head.across.toFixed(2)}   (the lane runs OUTWARD from here)`);
  console.log(`  stair core   along ${pt.along.toFixed(2)}, across ${pt.across.toFixed(2)}`);
  console.log(
    `  ENTRANCE lift along ${pl.along.toFixed(2)}, across ${pl.across.toFixed(2)}` +
      (ent ? `   → ${d2(lift, ent).toFixed(2)} u from its hut` : ''),
  );
  console.log(
    `  EXIT lift     along ${plo.along.toFixed(2)}, across ${plo.across.toFixed(2)}` +
      (exi ? `   → ${d2(liftOut, exi).toFixed(2)} u from its hut` : ''),
  );
  console.log('');

  // ---- THE ASSERTIONS -------------------------------------------------------
  // A core is 0.54 wide (buildStationLift `S`); a hut rect is 1.10 × 1.00
  // (GameManager/access.ts hutRect). Two boxes clash when they overlap on BOTH
  // deck axes, so "clear" is a separation on at least one.
  const HALF = 0.27;
  const HUT_HALF_ALONG = 0.55;
  const HUT_HALF_ACROSS = 0.5;
  const clash = (core, hut, what, which) => {
    if (!hut) return;
    const dAlong = Math.abs(core.along - hut.along);
    const dAcross = Math.abs(core.across - hut.across);
    if (dAlong < HALF + HUT_HALF_ALONG && dAcross < HALF + HUT_HALF_ACROSS)
      fails.push(`platform ${i}: the ${what} core stands INSIDE the ${which} hut (Δalong ${dAlong.toFixed(2)}, Δacross ${dAcross.toFixed(2)})`);
  };
  [['stair', pt], ['entrance lift', pl], ['exit lift', plo]].forEach(([what, core]) => {
    clash(core, pe, what, 'entrance');
    clash(core, px, what, 'exit');
    // …and nothing may stand in the QUEUE LANE, which runs outward from the head
    if (head && core.across > head.across - HALF && Math.abs(core.along - head.along) < HALF + 0.45)
      fails.push(`platform ${i}: the ${what} core stands IN THE QUEUE LANE (across ${core.across.toFixed(2)} vs head ${head.across.toFixed(2)})`);
  });
  if (ent && d2(lift, ent) > 2.0) fails.push(`platform ${i}: the entrance lift is ${d2(lift, ent).toFixed(2)} u from its hut — too far to read as serving it`);
  if (exi && d2(liftOut, exi) > 2.0) fails.push(`platform ${i}: the exit lift is ${d2(liftOut, exi).toFixed(2)} u from its hut — too far to read as serving it`);
});
console.log(
  'READ IT LIKE THIS: "across" is distance out along `left` (the ring interior) from the beam\n' +
    'centreline; "along" is distance down the deck from its centre. Every core must be CLEAR of\n' +
    "both hut rects and of the queue lane, and each lift must be within 2 u of the hut it serves.",
);
if (cores.length !== poses.length * 3) fails.push(`${cores.length} cores built, expected ${poses.length * 3}`);
console.log(`\n=== VERDICT: ${fails.length ? 'FAIL' : 'PASS'}`);
fails.forEach((f) => console.log(`   - ${f}`));
process.exit(fails.length ? 1 : 0);
