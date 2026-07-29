#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-monorail-fleet.mjs — the two ADDITIONS to the multi-station monorail:
//
//   1. A FLEET. `trains={N}` puts N trains on one beam. They must start evenly
//      spaced round the circuit and NEVER close on each other — measured as the
//      minimum gap between any two train centres over a full lap.
//
//      The fleet runs a TIMETABLE off the raw clock, not the ride FSM (see
//      Monorail/index.tsx `loopCtl` and park-eval/probe-monorail-timetable.mjs
//      for why), so this no longer fakes 'departing'/'arriving' edges: the
//      trains are `cycleT/N` seconds apart on one shared schedule, which is
//      what makes the spacing permanent rather than merely initial.
//
//   2. AN ELEVATOR at every platform, from the ground-level entrance lobby up
//      to the deck. Measured as the vertical TRAVEL of the car over its cycle:
//      it has to start on the lobby pad and finish flush with the landing, so
//      the travel is the deck height, not a token bob.
//
// Both can fail: drop `trains` to 1 and the fleet count goes 1; delete the
// buildStationLift call and the car count goes 0.
//
//   node probe-monorail-fleet.mjs
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });
const entry = path.join(OUT, '_fleet-entry.ts');
fs.writeFileSync(
  entry,
  `export { buildMonorailScene } from ${JSON.stringify(path.join(REPO, 'components/Monorail/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_fleet-bundle.mjs');
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundlePath,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  platform: 'node',
  target: 'node20',
  logLevel: 'error',
});
const grad = () => ({ addColorStop() {} });
const ctx2d = new Proxy({ measureText: () => ({ width: 0 }) }, {
  get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.endsWith('Gradient') ? grad : () => {}),
  set: () => true,
});
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? { width: 128, height: 128, getContext: () => ctx2d, style: {} } : { style: {} }),
};
const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;

// the shipped 4-platform ring (Monorail.previews.tsx, the §4.2 shape)
const PIECES = [
  'station',
  { type: 'straight', length: 8.9 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 8.9 },
  'station',
  { type: 'straight', length: 8.9 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 8.9 },
  'station',
  { type: 'straight', length: 8.9 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 8.9 },
  'station',
  { type: 'straight', length: 8.9 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 7.1 },
  { type: 'straight', length: 1.5 },
];

const quiet = console.warn;
console.warn = () => {};
const scene = K.buildMonorailScene(T, { pieces: PIECES, beamY: 2.6, trains: 4 });
console.warn = quiet;

const fleets = scene.group.userData.monorailTrains ?? [];
const centreOf = (cars) => {
  const v = new T.Vector3();
  cars.forEach((c) => v.add(c.position));
  return v.multiplyScalar(1 / cars.length);
};

// ---- 1. THE FLEET ----------------------------------------------------------
// TWO FULL LAPS of the published timetable: if the trains are going to bunch,
// they bunch inside one lap.
const tt = scene.group.userData.monorailTimetable;
console.log(
  tt
    ? `timetable: ${tt.length.toFixed(1)} u circuit, cruise ${tt.cruise} u/s, lap ${tt.cycleT.toFixed(1)} s, ` +
        `${tt.trains} trains ${(tt.cycleT / tt.trains).toFixed(1)} s apart`
    : 'NO TIMETABLE PUBLISHED — userData.monorailTimetable is missing',
);
let t = 0;
const step = (secs) => {
  for (let i = 0; i < Math.round(secs * 60); i += 1) {
    t += 1 / 60;
    scene.update(t);
  }
};
let minGap = Infinity;
let maxGap = 0;
scene.onStateChange('waitingForPassengers');
step(1 / 60);
for (let i = 0; i < Math.round((tt ? tt.cycleT * 2 : 300) * 60); i += 1) {
  t += 1 / 60;
  scene.update(t);
  if (i % 10) continue;
  const cs = fleets.map(centreOf);
  for (let a = 0; a < cs.length; a += 1)
    for (let b = a + 1; b < cs.length; b += 1) {
      const d = cs[a].distanceTo(cs[b]);
      minGap = Math.min(minGap, d);
      maxGap = Math.max(maxGap, d);
    }
}

// ---- 2. THE ELEVATORS ------------------------------------------------------
// TWO per platform now, not one: an ENTRANCE lift beside the entrance hut and
// an EXIT lift off the deck end on the exit side (the old single lift stood in
// the queue lane mouth — harness/park-eval/probe-monorail-access.mjs). Each
// vertical core tags itself `userData.monorailCore`, so find the cars by
// walking the tagged cores rather than by guessing at child counts: the old
// `children.length >= 4` heuristic silently stopped matching the moment the car
// was batched down to three meshes, and reported ZERO lifts on a station that
// has eight.
const cores = [];
scene.group.traverse((o) => {
  if (o.userData && o.userData.monorailCore) cores.push(o);
});
const liftCores = cores.filter((o) => String(o.userData.monorailCore).startsWith('lift'));
const stairCores = cores.filter((o) => o.userData.monorailCore === 'stairs');
const movers = new Map();
const sample = (time) => {
  scene.update(time);
  liftCores.forEach((core) =>
    core.children.forEach((c) => {
      if (c.type !== 'Group') return;
      const rec = movers.get(c.uuid) ?? { lo: Infinity, hi: -Infinity };
      rec.lo = Math.min(rec.lo, c.position.y);
      rec.hi = Math.max(rec.hi, c.position.y);
      movers.set(c.uuid, rec);
    }),
  );
};
for (let s = 0; s <= 16.2; s += 0.2) sample(t + s);
const lifts = [...movers.values()].filter((r) => r.hi - r.lo > 0.3).map((r) => ({
  travel: +(r.hi - r.lo).toFixed(3),
  low: +r.lo.toFixed(3),
  high: +r.hi.toFixed(3),
}));

const deckY = 2.6; // beamY: the platform deck the lift has to reach
console.log(`\nFLEET  trains on the beam: ${fleets.length} (asked for 4, 4 platforms)`);
console.log(`  train centre gap over two full laps: min ${minGap.toFixed(2)} u   max ${maxGap.toFixed(2)} u`);
console.log(`\nVERTICAL CORES  ${cores.length} tagged (want 3 per platform = 12: stairs + entrance lift + exit lift)`);
console.log(`  ${stairCores.length} stair core(s), ${liftCores.length} lift shaft(s)`);
console.log(`ELEVATOR  cars that travel vertically: ${lifts.length} (want one per lift shaft = 8)`);
lifts.forEach((l, i) => console.log(`  car ${i}: travels ${l.travel} u   ${l.low} → ${l.high}   (deck is ~${(deckY - 0.42).toFixed(2)} up)`));

// a 3-car train is 2.5 u long, so anything under that is trains overlapping
const fleetOk = fleets.length === 4 && minGap > 3;
const liftOk = cores.length === 12 && liftCores.length === 8 && stairCores.length === 4 && lifts.length === 8 && lifts.every((l) => l.travel > 1.5);
console.log(`\nVERDICT  fleet ${fleetOk ? 'PASS' : 'FAIL'} · elevator ${liftOk ? 'PASS' : 'FAIL'}\n`);
process.exit(fleetOk && liftOk ? 0 : 1);
