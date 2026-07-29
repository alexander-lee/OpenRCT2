#!/usr/bin/env node
// Monorail MOTION probe — the three complaints, measured.
//
//   1. "moves too fast / should be a consistent speed around the park"
//      -> sample the train's world speed every frame of a whole lap.
//   2. "doesn't stop at the station correctly, stops a little ahead"
//      -> when parked, measure the TRAIN CENTRE (not the head car) against the
//         platform centre the compiler reported.
//   3. "always freezes instead of consistently moving"
//      -> what fraction of a lap is the train actually in motion, and is the
//         dwell count the platform count (or something else entirely)?
//
// Drives the real component: builds the scene and runs the clock for exactly
// one published lap. It does NOT fake FSM edges any more — the fleet runs its
// own timetable (see the note by the sampling loop below).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });
const entry = path.join(OUT, '_mono-entry.ts');
fs.writeFileSync(
  entry,
  `export { buildMonorailScene } from ${JSON.stringify(path.join(REPO, 'components/Monorail/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_mono-bundle.mjs');
await build({
  entryPoints: [entry], bundle: true, outfile: bundlePath, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')], external: ['react', 'react-dom', 'react/jsx-runtime'],
  platform: 'node', target: 'node20', logLevel: 'error',
});
const grad = () => ({ addColorStop() {} });
const ctx2d = new Proxy({ measureText: () => ({ width: 0 }) }, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.endsWith('Gradient') ? grad : () => {}), set: () => true });
globalThis.document = { createElement: (tag) => (tag === 'canvas' ? { width: 128, height: 128, getContext: () => ctx2d, style: {} } : { style: {} }) };

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
const built = K.buildMonorailScene(T, { beamY: 2.6, pieces: PIECES });
console.warn = quiet;
const root = built.group;
const stations = built.stationPoses ?? [];
console.log(`${stations.length} platforms; cruise measured on the timetable rail clock`);

// the three cars are the direct children that carry the seat anchors; the
// TRAIN CENTRE is what a platform brakes onto, so average the car positions
const cars = root.userData.trainCars ?? [];
const trainCentre = () => {
  root.updateMatrixWorld(true);
  const v = new T.Vector3();
  const acc = new T.Vector3();
  let n = 0;
  // fall back to the exposed vehicle + its siblings when no tag exists
  const list = cars.length ? cars : [built.vehicle];
  for (const c of list) { c.getWorldPosition(v); acc.add(v); n += 1; }
  return acc.divideScalar(n || 1);
};
const nearestPlatform = (p) => {
  let best = null;
  for (const st of stations) {
    const d = Math.hypot(p.x - st.center[0], p.z - st.center[2]);
    if (!best || d < best.d) best = { d, st };
  }
  return best;
};

const DT = 1 / 30;
let time = 0;

// THE TRAINS NO LONGER RUN ON THE FSM. They run their own TIMETABLE off the
// raw clock (Monorail/index.tsx `loopCtl`), because driving them off the ride
// FSM left every train still 69.7% of the time — measured in
// park-eval/probe-monorail-timetable.mjs. So this probe no longer fakes
// 'departing'/'arriving' edges: it just runs the clock for a full lap and
// watches what the train does, which is exactly what a player sees.
const tt = root.userData.monorailTimetable;
console.log(
  tt
    ? `timetable: ${tt.length.toFixed(1)} u circuit, cruise ${tt.cruise} u/s, dwell ${tt.dwell} s × ${tt.stops}, lap ${tt.cycleT.toFixed(1)} s`
    : 'NO TIMETABLE PUBLISHED — userData.monorailTimetable is missing',
);
const LAP = tt ? tt.cycleT : 120;

// EXACTLY one lap, sampled every frame. Record the speed and the nearest
// platform at each step; the dwells and the cruise are read off afterwards.
const STEPS = Math.round(LAP / DT);
const v = new Array(STEPS).fill(0);
const off = new Array(STEPS).fill(Infinity);
// one update BEFORE the baseline: the cars are at their constructed origin
// until the first tick, and the jump onto the beam is not a speed sample
time += DT;
built.update(time);
let prev = trainCentre().clone();
for (let i = 0; i < STEPS; i += 1) {
  time += DT;
  built.update(time);
  const now = trainCentre().clone();
  v[i] = now.distanceTo(prev) / DT;
  prev = now;
  const np = nearestPlatform(now);
  off[i] = np ? np.d : Infinity;
}

// DWELLS: runs of stationary frames. Measure the train CENTRE against the
// platform centre the compiler reported — RCT2 brakes a train onto the MIDDLE
// of its deck, not a little ahead of it.
const stopped = v.map((s) => s < 0.02);
const dwells = [];
for (let i = 0; i < STEPS; i += 1) {
  if (!stopped[i]) continue;
  let j = i;
  let best = Infinity;
  while (j < STEPS && stopped[j]) {
    best = Math.min(best, off[j]);
    j += 1;
  }
  if ((j - i) * DT > 0.2) dwells.push({ secs: (j - i) * DT, offset: best });
  i = j;
}
// FLAT RUNNING is everything more than RAMP_GUARD seconds clear of a dwell:
// the eased ends of a leg are DELIBERATE (a train accelerates off a platform
// and brakes into the next), so including them would measure the ramp, not the
// cruise. Anything left that still wanders is a real speed defect.
const RAMP_GUARD = 1.5;
const guard = Math.round(RAMP_GUARD / DT);
const nearStop = new Array(STEPS).fill(false);
for (let i = 0; i < STEPS; i += 1) {
  if (!stopped[i]) continue;
  for (let k = -guard; k <= guard; k += 1) nearStop[(((i + k) % STEPS) + STEPS) % STEPS] = true;
}
const moving = v.filter((_, i) => !stopped[i]);
const flat = v.filter((_, i) => !nearStop[i]);
const mean = moving.reduce((a, b) => a + b, 0) / (moving.length || 1);
const mx = Math.max(...moving, 0);
const mn = Math.min(...moving, 99);
const fMax = Math.max(...flat, 0);
const fMin = Math.min(...flat, 99);
console.log(
  `\ncruise over one lap: mean ${mean.toFixed(2)} u/s   min ${mn.toFixed(2)}   max ${mx.toFixed(2)}\n` +
    `   flat-running spread (${RAMP_GUARD} s clear of every platform ramp): ${(fMax - fMin).toFixed(3)} u/s   ` +
    `[${fMin.toFixed(3)} … ${fMax.toFixed(3)}] over ${flat.length} frames`,
);
console.log(`   (a guest walks 0.3-0.65 u/s; the spread is what "inconsistent speed" means)`);

console.log(`\n${dwells.length} platform dwell(s) in one ${LAP.toFixed(0)} s lap (want ${stations.length}):`);
dwells.forEach((d, i) => console.log(`   dwell ${i}: ${d.secs.toFixed(1)} s parked, train centre ${d.offset.toFixed(3)} u off the platform centre`));
const worstOffset = dwells.reduce((a, d) => Math.max(a, d.offset), 0);
const movingFrac = moving.length / STEPS;

const fails = [];
if (dwells.length !== stations.length) fails.push(`${dwells.length} dwells per lap, ${stations.length} platforms`);
if (worstOffset >= 0.35) fails.push(`worst parking offset ${worstOffset.toFixed(3)} u (want < 0.35, i.e. inside the 2.6 deck)`);
if (fMax - fMin > 0.05) fails.push(`flat-running spread ${(fMax - fMin).toFixed(3)} u/s — the cruise is not constant`);
if (movingFrac < 0.9) fails.push(`moving only ${(100 * movingFrac).toFixed(1)}% of the lap`);
console.log(
  `\nVERDICT  ${fails.length ? 'FAIL' : 'PASS'} — moving ${(100 * movingFrac).toFixed(1)}% of the lap, ` +
    `worst parking offset ${worstOffset.toFixed(3)} u`,
);
fails.forEach((f) => console.log(`   - ${f}`));
process.exit(fails.length ? 1 : 0);
