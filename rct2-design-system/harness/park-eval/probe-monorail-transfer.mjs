#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-monorail-transfer.mjs — DO GUESTS ACTUALLY GET CARRIED FROM ONE
// PLATFORM TO ANOTHER? The BEHAVIOURAL half of the multi-station verification.
//
// WHY. Structural checks (registered / closed / every station queued and
// exit-connected) are necessary and not sufficient: a monorail that runs EMPTY
// satisfies every compile check and fails the point of the ride. And the
// browser probe samples the sim ~1.5 s in, long before a train has completed a
// leg, so `probe.sim.transfers` reads 0 there whatever the truth is. This probe
// runs the REAL `createGameManager` headlessly for hundreds of sim-seconds and
// reports, per guest, the platform they BOARDED at and the platform they got
// OFF at.
//
// WHAT COUNTS AS A TRANSFER. `boardStation !== atStation` on unload — a guest
// who queued at platform A and re-entered the path network from platform B's
// exit. That is RCT2's own behaviour, not an embellishment: every station piece
// forces a stop (ride/Vehicle.TrackMotion.cpp:433 →
// ride/Vehicle.Station.cpp:1503-1511) and `UpdateUnloadingPassengers` pushes
// EVERY rider off there (:974-981), while the peep's own station index is
// overwritten with the vehicle's (entity/Guest.cpp:4192 + :4226).
//
// METHOD. No browser, no React, no terrain: a square street ring with four
// spur nodes, one per platform, and a park gate on the south side — the
// topology of the §4.2 Grand Circle reduced to its graph. One monorail
// registered with `stations` (3 extra platforms), guests spawned at the gate,
// `manager.update` stepped at dt = 1/30 exactly as validatePark's smoke loop
// does. Then: transfers, the boarded→left matrix, and every platform's queue.
//
// Usage:
//   node probe-monorail-transfer.mjs                  # 600 sim-s, 24 guests
//   node probe-monorail-transfer.mjs --secs=1200 --guests=40 --stations=4
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { HERE, REPO } from './paths.mjs';

// ---- minimal DOM stub (guest rigs paint canvas textures for their materials)
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

const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const SECS = Number(arg('secs', '600'));
const GUESTS = Number(arg('guests', '24'));
const NSTATIONS = Number(arg('stations', '4'));
const CAP = Number(arg('cap', '6'));
const DUR = Number(arg('dur', '12'));

// ---- bundle the sim for node ------------------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_mono-transfer.ts');
fs.writeFileSync(
  ep,
  `
import { createGameManager } from ${JSON.stringify(path.join(REPO, 'components/GameManager'))};
export { createGameManager };
`,
);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_mono-transfer.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { createGameManager } = await import(bundlePath);

// ---------------------------------------------------------------------------
// THE GRAPH — the §4.2 ring reduced to streets. A hub cross plus a gate spine,
// with the four platform queue tails on it, at the SAME cells the reference
// park uses (`samples/monorail-ref.tsx`), so the walk distances are the real
// ones and not a toy.
//   deck W (-42.6, -8.4)  tail (-36.0, -8.4)   queueDir [ 1,  0]
//   deck N (  0.0,  34.2) tail (  0.0,  27.6)  queueDir [ 0, -1]
//   deck E ( 42.6, -8.4)  tail ( 36.0, -8.4)   queueDir [-1,  0]
//   deck S (  0.0, -51.0) tail (  0.0, -44.4)  queueDir [ 0,  1]
// ---------------------------------------------------------------------------
const laneLenOf = (c) => Math.max(2.2, 0.6 + c * 2 * 0.28 + 0.5);
const JOIN = laneLenOf(CAP) + 0.35;

const NODES = [
  [-6, -62.4], //  0 gate
  [-6, -44.4], //  1
  [0, -44.4], //  2 SOUTH platform tail
  [0, -32.4], //  3
  [0, -20.4], //  4
  [0, -8.4], //  5 hub
  [-18, -8.4], //  6
  [-36.0, -8.4], //  7 WEST platform tail
  [18, -8.4], //  8
  [36.0, -8.4], //  9 EAST platform tail
  [0, 3.6], // 10
  [0, 15.6], // 11
  [0, 27.6], // 12 NORTH platform tail
];
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [5, 6], [6, 7], [5, 8], [8, 9],
  [5, 10], [10, 11], [11, 12],
];

/** one platform: deck centre, its queue tail node, and the inward queue dir */
const PLATFORMS = [
  { label: 'West', deck: [-42.6, 2.6, -8.4], tail: [-36.0, -8.4], dir: [1, 0], face: [0, 1] },
  { label: 'North', deck: [0, 2.6, 34.2], tail: [0, 27.6], dir: [0, -1], face: [1, 0] },
  { label: 'East', deck: [42.6, 2.6, -8.4], tail: [36.0, -8.4], dir: [-1, 0], face: [0, 1] },
  { label: 'South', deck: [0, 2.6, -51.0], tail: [0, -44.4], dir: [0, 1], face: [1, 0] },
].slice(0, Math.max(1, Math.min(4, NSTATIONS)));

/** `queueAnchor = tail − dir·JOIN`, entrance hut 0.62 further back, exit one
 *  tile (1.2) along the station FACE — the §4.2 arithmetic, verbatim */
const stationCfg = (p) => ({
  label: p.label,
  boardPoint: p.deck,
  queueAnchor: [p.tail[0] - p.dir[0] * JOIN, 0.05, p.tail[1] - p.dir[1] * JOIN],
  queueDir: p.dir,
  exitPoint: [
    p.tail[0] - p.dir[0] * (JOIN + 0.62) + p.face[0] * 1.2,
    0.05,
    p.tail[1] - p.dir[1] * (JOIN + 0.62) + p.face[1] * 1.2,
  ],
  exitDir: p.dir,
});

// ---- build the sim ----------------------------------------------------------
const warns = [];
const realWarn = console.warn;
console.warn = (m) => warns.push(String(m));
const mgr = createGameManager(THREE, { net: { nodes: NODES, edges: EDGES }, groundAt: () => 0 });
mgr.registerParkEntrance({ spawnPoint: [0, 0, 0.6], archway: [0, 0, 0] }, { position: [-6, 0, -62.4], yaw: 0 });
const s0 = stationCfg(PLATFORMS[0]);
const handle = mgr.registerRide({
  name: 'Grand Circle Monorail',
  capacity: CAP,
  rideDuration: DUR,
  intensity: 1,
  price: 0,
  queueAnchor: s0.queueAnchor,
  queueDir: s0.queueDir,
  boardPoint: s0.boardPoint,
  exitPoint: s0.exitPoint,
  exitDir: s0.exitDir,
  stations: PLATFORMS.slice(1).map(stationCfg),
});
mgr.spawnGuests(GUESTS);
console.warn = realWarn;

console.log(
  `=== multi-station TRANSFER probe — ${PLATFORMS.length} platform(s), capacity ${CAP}, ` +
    `rideDuration ${DUR} s (leg ${(DUR / PLATFORMS.length).toFixed(2)} s), ${GUESTS} guests, ${SECS} sim-s`,
);
console.log(`    registration warnings: ${warns.length}`);
warns.forEach((w) => console.log(`      warn: ${w}`));
console.log(`    stationCount() ${handle.stationCount()}   currentStation() ${handle.currentStation()}`);
console.log('    per-platform access (EVERY row needs queueNode ≥ 0 and exitLaneLen > 0):');
for (const st of handle.stations())
  console.log(
    `      ${st.idx} ${String(st.label).padEnd(34)} board [${st.boardPoint.map((v) => v.toFixed(1)).join(', ')}]  ` +
      `queueNode ${String(st.queueNode).padStart(3)}  exitNode ${String(st.exitNode).padStart(3)}  ` +
      `exitLaneLen ${st.exitLaneLen.toFixed(2)}${st.exitLaneLen > 0 ? '' : '   ← STR_EXIT_NOT_CONNECTED'}`,
  );

// ---- run --------------------------------------------------------------------
// Instrument the unload edge: the manager does not publish per-guest boarding
// history, so watch each rider's own `boardStation` and the ride's `atStation`
// across the step in which it leaves `riders`.
const rides = mgr.rides;
const guestsOf = mgr.guests;
const matrix = new Map(); // "A->B" -> count
const dt = 1 / 30;
const steps = Math.round(SECS / dt);
let aboard = new Map(); // guest idx -> boardStation while seated
let firstTransferAt = null;
let stops = 0;
let lastStation = handle.currentStation();
const stopHits = new Array(PLATFORMS.length).fill(0);
const boardedAt = new Array(PLATFORMS.length).fill(0);
const leftAt = new Array(PLATFORMS.length).fill(0);

for (let s = 1; s <= steps; s += 1) {
  const time = s * dt;
  mgr.update(time, dt);
  const cur = handle.currentStation();
  if (cur !== lastStation) {
    stops += 1;
    stopHits[cur] += 1;
    lastStation = cur;
  }
  // sample every 0.1 s — a rider is seated for ≫ that, so no boarding is missed
  if (s % 3) continue;
  // `mgr.guests()` returns RECORDS (queries.ts `recordOf`), not raw SimGuests —
  // the additive `ride` / `boardStation` fields are what make this observable
  const seated = new Map();
  for (const g of guestsOf()) {
    if (g.state === 'onRide' && g.ride === 'Grand Circle Monorail') seated.set(g.id, g.boardStation);
  }
  // anyone who WAS seated and is not now has just been unloaded at `cur`
  for (const [idx, from] of aboard) {
    if (seated.has(idx)) continue;
    const to = cur;
    boardedAt[from] = (boardedAt[from] ?? 0) + 1;
    leftAt[to] = (leftAt[to] ?? 0) + 1;
    const key = `${from}->${to}`;
    matrix.set(key, (matrix.get(key) ?? 0) + 1);
    if (from !== to && firstTransferAt === null) firstTransferAt = time;
  }
  aboard = seated;
  void rides;
}

// ---- report -----------------------------------------------------------------
const stats = mgr.stats();
console.log(
  `\n    after ${SECS} sim-s: riddenTotal ${stats.riddenTotal}, ` +
    `handle.totalRides() ${handle.totalRides()}, handle.transfers() ${handle.transfers()}, ` +
    `stats().transfers ${stats.transfers}`,
);
console.log(`    train stopped ${stops} time(s); stops per platform [${stopHits.join(', ')}]`);
console.log(`    first TRANSFER (boarded A, left B≠A) at ${firstTransferAt === null ? 'NEVER' : firstTransferAt.toFixed(1) + ' sim-s'}`);
console.log(`    boarded per platform [${boardedAt.join(', ')}]   left per platform [${leftAt.join(', ')}]`);
console.log('\n    THE BOARDED → LEFT MATRIX (rows = boarding platform):');
const names = PLATFORMS.map((p) => p.label);
console.log('      from \\ to  ' + names.map((n) => n.padStart(7)).join(' '));
let diag = 0;
let off = 0;
for (let a = 0; a < PLATFORMS.length; a += 1) {
  const row = [];
  for (let b = 0; b < PLATFORMS.length; b += 1) {
    const v = matrix.get(`${a}->${b}`) ?? 0;
    if (a === b) diag += v;
    else off += v;
    row.push(String(v).padStart(7));
  }
  console.log(`      ${names[a].padEnd(10)} ${row.join(' ')}`);
}
console.log(`\n    OFF-DIAGONAL (real transfers) ${off}   on-diagonal (boarded and left the same platform) ${diag}`);

const ok =
  handle.stationCount() === PLATFORMS.length &&
  handle.stations().every((st) => st.queueNode >= 0 && st.exitLaneLen > 0) &&
  (PLATFORMS.length === 1 ? true : off > 0 && handle.transfers() > 0);
console.log(
  `\n=== VERDICT: ${ok ? 'PASS' : 'FAIL'} — ${PLATFORMS.length} platforms, all queue-attached and exit-connected, ` +
    `${off} measured A→B transfer(s)` + (PLATFORMS.length === 1 ? ' (a one-platform ride cannot transfer, by definition)' : ''),
);
process.exit(ok ? 0 : 1);
