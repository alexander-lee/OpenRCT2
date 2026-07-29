#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-sim-reach.mjs — HOW FAR from the gate can the first ride sit and still
// complete a cycle inside the `validatePark` sim smoke run?
//
// WHY. Wave 8 made `<Park size>` default to 192. The gate spawns at
// z = size/2 − 1.2 (94.8 on a 192), so the far edge of the plot is ~190 u from
// the gate, while `SIM_SMOKE_SECONDS` is 75 (60 until 2026-07-28, raised with the
// boarding-quiet departure rule off THIS probe's numbers) and guests walk 0.3-0.65 u/s
// (`GameManager/locomotion.ts` `speedOf`). The smoke check FAILs unless some
// guest completes one full cycle in the window, so the plot is now big enough
// that a legal, well-composed park can fail the acceptance gate purely on
// walking distance. This probe MEASURES the bound instead of guessing it.
//
// METHOD. No browser, no React, no terrain: the real `createGameManager` on a
// straight 1.2-u street running south from the gate node to a single ride's
// queue tail at distance D. Guests spawn at the gate exactly as `<Park>` does.
// The loop is `validatePark`'s own smoke loop (dt = 1/30, `manager.update`),
// and the reported window is the sim time at which `stats().riddenTotal`
// first reaches 1 — i.e. the SMALLEST `SIM_SMOKE_SECONDS` that would pass.
//
// Usage:
//   node probe-sim-reach.mjs                       # the default sweep
//   node probe-sim-reach.mjs --d=6,15,30 --cap=8 --dur=10 --guests=12 --max=400
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

const SIZE = Number(arg('size', '192'));
const CAP = Number(arg('cap', '8'));
const DUR = Number(arg('dur', '10'));
const GUESTS = Number(arg('guests', '12'));
const MAXS = Number(arg('max', '420')); // give every distance room to finish
const DISTS = arg('d', '6,12,15,20,24,30,40,60,80,96,120,160').split(',').map(Number);
const CELL = 1.2;

// ---- bundle the sim for node ----------------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_sim-reach.ts');
fs.writeFileSync(
  ep,
  `
import { createGameManager } from ${JSON.stringify(path.join(REPO, 'components/GameManager'))};
import { SIM_SMOKE_SECONDS } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
export { createGameManager, SIM_SMOKE_SECONDS };
`,
);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_sim-reach.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { createGameManager, SIM_SMOKE_SECONDS } = await import(bundlePath);

// `validatePark`'s own window formula
const windowFor = (maxDur) => Math.max(SIM_SMOKE_SECONDS, Math.ceil(2.5 * maxDur + 20));

/** the ride's queue reach — GameManager's default laneLen + the 0.35 tail gap */
const laneLenOf = (c) => Math.max(2.2, 0.6 + c * 2 * 0.28 + 0.5);

/**
 * One trial: a straight street from the gate south to a tail `d` u away, one
 * ride behind it. Returns the sim time of the FIRST completed ride cycle.
 */
function trial(d) {
  const gateZ = SIZE / 2 - CELL; // <Park>'s composed gate cell
  const steps = Math.max(2, Math.round(d / CELL));
  const nodes = [];
  for (let i = 0; i <= steps; i += 1) nodes.push([0, +(gateZ - i * CELL).toFixed(4)]);
  const edges = nodes.slice(1).map((_n, i) => [i, i + 1]);
  const tail = nodes[nodes.length - 1];
  const join = laneLenOf(CAP) + 0.35;
  // the lane extends from the HEAD back toward the gate — `queueDir` points
  // head → tail (`registry.ts`: tail = queueAnchor + (laneLen + 0.35)·queueDir),
  // so the pad sits BEYOND the head, further from the gate than the lane.
  const head = [tail[0], tail[1] - join];
  const pad = [head[0], head[1] - 5.4];

  const mgr = createGameManager(THREE, { net: { nodes, edges }, groundAt: () => 0 });
  mgr.registerParkEntrance(
    { spawnPoint: [0, 0, 0.6], archway: [0, 0, 0] },
    { position: [0, 0, gateZ], yaw: 0 },
  );
  mgr.registerRide({
    name: 'Probe Ride',
    capacity: CAP,
    rideDuration: DUR,
    queueAnchor: [head[0], 0, head[1]],
    queueDir: [0, 1],
    boardPoint: [pad[0], 0.6, pad[1]],
    exitPoint: [pad[0] + 2.4, 0, pad[1]],
    intensity: 4,
    price: 0,
  });
  mgr.spawnGuests(GUESTS);

  const dt = 1 / 30;
  const steps2 = Math.round(MAXS / dt);
  let firstRide = null;
  let firstQueue = null;
  for (let s = 1; s <= steps2; s += 1) {
    const time = s * dt;
    mgr.update(time, dt);
    if (s % 15) continue; // sample every 0.5 s, exactly like validatePark
    if (firstQueue === null && mgr.rides().some((r) => r.queue > 0)) firstQueue = time;
    if (firstRide === null && mgr.stats().riddenTotal >= 1) firstRide = time;
    if (firstRide !== null && time > firstRide + 0.6) break;
  }
  const gone = mgr.guests().filter((g) => g.gone).length;
  return { d, firstQueue, firstRide, ridden: mgr.stats().riddenTotal, gone };
}

// ---- sweep ----------------------------------------------------------------
const W = windowFor(DUR);
console.log(
  `sim-reach probe — size ${SIZE} (gate cell z ${(SIZE / 2 - CELL).toFixed(1)}), capacity ${CAP}, rideDuration ${DUR}, ${GUESTS} guests\n` +
    `validatePark window = max(SIM_SMOKE_SECONDS ${SIM_SMOKE_SECONDS}, 2.5·${DUR}+20) = ${W} sim-s; probe runs to ${MAXS} sim-s\n`,
);
console.log('  gate→tail |  first queue |  first cycle |  u/s implied | passes @60 | passes @window | left park');
console.log('  ----------+--------------+--------------+--------------+------------+----------------+----------');
const rows = [];
for (const d of DISTS) {
  const r = trial(d);
  rows.push(r);
  const impl = r.firstRide ? (d / r.firstRide).toFixed(2) : '—';
  console.log(
    `  ${String(d).padStart(7)} u | ${(r.firstQueue ? r.firstQueue.toFixed(1) + ' s' : 'never').padStart(12)} | ` +
      `${(r.firstRide ? r.firstRide.toFixed(1) + ' s' : 'NEVER').padStart(12)} | ${impl.padStart(12)} | ` +
      `${String(!!(r.firstRide && r.firstRide <= 60)).padStart(10)} | ${String(!!(r.firstRide && r.firstRide <= W)).padStart(14)} | ${String(r.gone).padStart(8)}`,
  );
}

// THE HEADLINE IS THE LIVE WINDOW, NOT A LITERAL 60. `SIM_SMOKE_SECONDS` moved
// 60 → 75 on 2026-07-28 with the boarding-quiet departure rule, and this summary
// used to hard-code 60 — it would have reported "largest distance: 12 u" while
// the column beside it said 24 u passes the window the gate actually applies.
const okW = rows.filter((r) => r.firstRide && r.firstRide <= W);
const worst = okW.length ? Math.max(...okW.map((r) => r.d)) : null;
const firstBad = rows.find((r) => !(r.firstRide && r.firstRide <= W));
const margin = worst === null ? null : W - okW.find((r) => r.d === worst).firstRide;
console.log(
  `\nlargest gate→tail distance that completes a cycle within the ${W}-sim-s window: ${worst === null ? 'NONE' : worst + ' u'}` +
    (margin === null ? '' : ` (${margin.toFixed(1)} s of margin there)`) +
    (firstBad ? `  (first failing distance sampled: ${firstBad.d} u → ${firstBad.firstRide ? firstBad.firstRide.toFixed(1) + ' s' : 'no cycle in ' + MAXS + ' s'})` : ''),
);
// per-distance margin against the live window — this is what §0.3's floor is
// chosen from, so print it rather than making the reader subtract
console.log(
  `margin at each sampled distance: ${rows
    .map((r) => `${r.d} u ${r.firstRide ? (W - r.firstRide >= 0 ? '+' : '') + (W - r.firstRide).toFixed(1) + ' s' : 'no cycle'}`)
    .join(', ')}`,
);
const need = rows.filter((r) => r.firstRide);
if (need.length) {
  const far = need[need.length - 1];
  console.log(`window needed at ${far.d} u (the far end of a ${SIZE} plot): ${Math.ceil(far.firstRide)} sim-s`);
  // linear fit of firstRide against d — the marginal seconds per unit of walk
  const n = need.length;
  const mx = need.reduce((a, r) => a + r.d, 0) / n;
  const my = need.reduce((a, r) => a + r.firstRide, 0) / n;
  const k = need.reduce((a, r) => a + (r.d - mx) * (r.firstRide - my), 0) / need.reduce((a, r) => a + (r.d - mx) ** 2, 0);
  console.log(`marginal cost of distance: ${k.toFixed(2)} sim-s per u of gate→tail walk (fixed overhead ${(my - k * mx).toFixed(1)} s)`);
}
