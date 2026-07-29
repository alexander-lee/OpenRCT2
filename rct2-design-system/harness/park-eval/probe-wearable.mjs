#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-wearable.mjs — DOES A GUEST ACTUALLY BUY AND WEAR A WEARABLE?
//
// WHY. The live design system threw `t.fx.attachWearable is not a function`:
// the server's `guestFx.ts` was a pre-wearable revision while `needs.ts`,
// `navigation.ts` and `guestPass.ts` were current and called it. A compile
// check cannot catch that class of bug, and neither can "the park renders" —
// `attachWearable` is also a SILENT NO-OP when the stall ships no `heldItem`
// builder (it returns null before touching the head slot). So this probe
// asserts the whole chain END TO END, on the real `createGameManager`:
//
//   1. a guest walks up to a 'wearable' stall and transacts (`st.sold` rises)
//   2. `g.worn` is set and names the selling stall (`recordOf().worn`)
//   3. a group named 'wornItem' is REALLY PARENTED to that peep's `headSlot`
//      — the mesh proof; (2) alone would pass on a bookkeeping-only fix
//   4. the goggles SURVIVE a ride (the wearable's whole contract: it rides
//      `peep.headSlot`, so boarding must not strip it)
//   5. nobody buys a second one (the `alreadyWearing` gate)
//
// METHOD is probe-sim-reach.mjs's: no browser, no React, no terrain — a
// straight 1.2-u street south from the park gate with the shop on one side and
// one ride at the end, driven by validatePark's own dt = 1/30 smoke loop.
// Deterministic (every draw is hashed off the guest index), so this is a
// regression test, not a spot check.
//
// Usage:  node probe-wearable.mjs [--guests=24] [--max=300] [--seedscan]
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
const GUESTS = Number(arg('guests', '24'));
const MAXS = Number(arg('max', '300'));
// NEGATIVE CONTROL: register the stall with NO `heldItem` builder. The purchase
// still transacts, but `attachWearable` bails before touching the head slot —
// the exact SILENT NO-OP a compile check (and a "does the park render?" check)
// would sail straight past. The mesh assertions below must FAIL in this mode,
// which is what makes them worth anything in the normal one.
const NOITEM = process.argv.includes('--noitem');
const CELL = 1.2;
const SIZE = 48;

// ---- bundle the sim + the real wearable recipe for node --------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_wearable.ts');
fs.writeFileSync(
  ep,
  `
import { createGameManager } from ${JSON.stringify(path.join(REPO, 'components/GameManager'))};
import { buildWornGoggles } from ${JSON.stringify(path.join(REPO, 'components/GoggleWorks'))};
export { createGameManager, buildWornGoggles };
`,
);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_wearable.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { createGameManager, buildWornGoggles } = await import(bundlePath);

/** every object named `n` anywhere under `root` */
const findAll = (root, n) => {
  const out = [];
  root.traverse((o) => { if (o.name === n) out.push(o); });
  return out;
};
/** is `anc` an ancestor of `o`? — the head-slot parentage proof */
const isUnder = (o, anc) => {
  for (let p = o.parent; p; p = p.parent) if (p === anc) return true;
  return false;
};

function run() {
  const gateZ = SIZE / 2 - CELL;
  const steps = 14;
  const nodes = [];
  for (let i = 0; i <= steps; i += 1) nodes.push([0, +(gateZ - i * CELL).toFixed(4)]);
  const edges = nodes.slice(1).map((_n, i) => [i, i + 1]);

  const mgr = createGameManager(THREE, { net: { nodes, edges }, groundAt: () => 0 });
  mgr.registerParkEntrance({ spawnPoint: [0, 0, 0.6], archway: [0, 0, 0] }, { position: [0, 0, gateZ], yaw: 0 });

  // THE SHOP. `heldItem` is REQUIRED for a wearable to be visible at all —
  // attachWearable returns null without one — so this uses GoggleWorks' own
  // exported recipe, the same one the <GoggleWorks> composable registers.
  const shopZ = nodes[6][1];
  const shop = mgr.registerStall({
    name: 'The Goggle Works',
    item: 'wearable',
    price: 4,
    value: 6,
    anchor: [-1.5, 0, shopZ],
    dir: [1, 0], // serving front faces the street
    ...(NOITEM ? {} : { heldItem: buildWornGoggles }),
  });

  // one ride at the far end, so a wearer can board and we can prove the
  // goggles survive the entrance hut / seating / exit walk
  const tail = nodes[nodes.length - 1];
  const head = [0, tail[1] - (Math.max(2.2, 0.6 + 6 * 2 * 0.28 + 0.5) + 0.35)];
  mgr.registerRide({
    name: 'Probe Ride',
    capacity: 6,
    rideDuration: 8,
    queueAnchor: [head[0], 0, head[1]],
    queueDir: [0, 1],
    boardPoint: [head[0], 0.6, head[1] - 5.4],
    exitPoint: [head[0] + 2.4, 0, head[1] - 5.4],
    intensity: 3,
    price: 0,
  });

  mgr.spawnGuests(GUESTS);

  const dt = 1 / 30;
  let firstWornAt = null;
  let wornThroughRideAt = null;
  const seenWearers = new Set();
  let peakWearers = 0;

  for (let s = 1; s <= Math.round(MAXS / dt); s += 1) {
    const time = s * dt;
    mgr.update(time, dt);
    if (s % 15) continue; // sample every 0.5 s, exactly like validatePark

    const recs = mgr.guests();
    const wearers = recs.filter((g) => g.worn);
    peakWearers = Math.max(peakWearers, wearers.length);
    for (const w of wearers) seenWearers.add(w.id);
    if (firstWornAt === null && wearers.length) firstWornAt = time;
    // a wearer who has completed a ride AND still has the goggles on
    if (wornThroughRideAt === null && wearers.some((g) => g.ridden >= 1)) wornThroughRideAt = time;
    if (firstWornAt !== null && wornThroughRideAt !== null && time > firstWornAt + 30) break;
  }

  // ---- the MESH proof: walk the real scene graph -----------------------------
  const worn = findAll(mgr.group, 'wornItem');
  const recs = mgr.guests();
  const wearerRecs = recs.filter((g) => g.worn);
  // each wornItem must hang off a headSlot, and carry real geometry
  const slots = findAll(mgr.group, 'headSlot');
  const parented = worn.filter((w) => slots.some((h) => isUnder(w, h)));
  let meshCount = 0;
  for (const w of worn) w.traverse((o) => { if (o.isMesh) meshCount += 1; });

  return {
    sold: shop.sold(),
    firstWornAt, wornThroughRideAt,
    wearersNow: wearerRecs.length,
    everWorn: seenWearers.size,
    peakWearers,
    wornNodes: worn.length,
    headSlots: slots.length,
    parented: parented.length,
    meshCount,
    wornStallNames: [...new Set(wearerRecs.map((g) => g.worn))],
    ridden: mgr.stats().riddenTotal,
    wearerRidden: wearerRecs.filter((g) => g.ridden >= 1).length,
    thoughts: mgr.stats().thoughts.filter((t) => /goggle|souvenir/i.test(t.text)).slice(0, 4),
    doubleBuys: wearerRecs.length ? worn.length - wearerRecs.length : worn.length,
  };
}

const r = run();
const P = (b) => (b ? 'PASS' : 'FAIL');
console.log(`wearable probe — ${GUESTS} guests, one 'wearable' stall (The Goggle Works), one ride, ${MAXS} sim-s max\n`);
console.log(`  stall transactions (st.sold)      : ${r.sold}`);
console.log(`  first guest wearing at            : ${r.firstWornAt === null ? 'NEVER' : r.firstWornAt.toFixed(1) + ' sim-s'}`);
console.log(`  guests wearing at end / ever      : ${r.wearersNow} / ${r.everWorn}  (peak ${r.peakWearers})`);
console.log(`  recordOf().worn names             : ${JSON.stringify(r.wornStallNames)}`);
console.log(`  'wornItem' groups in scene graph  : ${r.wornNodes}   (headSlots present: ${r.headSlots})`);
console.log(`  ...parented under a peep headSlot : ${r.parented}`);
console.log(`  real meshes inside those groups   : ${r.meshCount}`);
console.log(`  rides completed (total)           : ${r.ridden}`);
console.log(`  wearers who rode & KEPT the item  : ${r.wearerRidden}${r.wornThroughRideAt ? ` (first at ${r.wornThroughRideAt.toFixed(1)} s)` : ''}`);
if (r.thoughts.length) console.log(`  purchase thoughts                 : ${r.thoughts.map((t) => `"${t.text}"`).join(', ')}`);
console.log('');

const checks = [
  ['a guest transacted at the wearable stall', r.sold >= 1],
  ['at least one guest IS wearing one', r.wearersNow >= 1],
  ['recordOf().worn names the selling stall', r.wornStallNames.length === 1 && r.wornStallNames[0] === 'The Goggle Works'],
  ["a 'wornItem' group exists per wearer", r.wornNodes === r.wearersNow && r.wornNodes >= 1],
  ['every one is parented under a peep headSlot', r.parented === r.wornNodes && r.parented >= 1],
  ['the worn groups carry real geometry', r.meshCount >= r.wornNodes],
  ['no guest bought a second one', r.doubleBuys === 0],
  ['a wearer boarded a ride and KEPT it', r.wearerRidden >= 1],
];
let bad = 0;
for (const [label, ok] of checks) {
  if (!ok) bad += 1;
  console.log(`  ${P(ok)}  ${label}`);
}
console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nall wearable checks pass');
process.exit(bad ? 1 : 0);
