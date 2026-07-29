#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-monorail-timetable.mjs — DO THE TRAINS ACTUALLY MOVE, AND ARE THERE MORE
// THAN ONE OF THEM MOVING AT ONCE?
//
// WHY. Every existing monorail probe measures GEOMETRY (probe-monorail-loop /
// -grand: does the circuit compile and close) or GUEST FLOW
// (probe-monorail-transfer: does anyone get carried A→B). Nothing measures the
// thing you actually SEE: a train sitting dead still on the beam. The report
// from the park was "the monorail always freezes instead of consistently
// moving, and only one train is on the track at a time" — which is a claim
// about DISPLACEMENT PER SECOND, per train, over sim time. So measure that.
//
// METHOD. No browser: build the REAL `buildMonorailScene` with the reference
// park's own 4-station ring, register a REAL `createGameManager` ride on the
// same street graph probe-monorail-transfer uses, forward the ride FSM's
// `onStateChange` into the scene exactly as <ConfigurableRide> does, and step
// both at dt = 1/30 for hundreds of sim-seconds — sampling every train car's
// position each step.
//
// WHAT IT REPORTS, per train:
//   dutyCycle    fraction of sampled steps with |Δposition| > 1e-4 (MOVING)
//   longest stall  the longest continuous stretch, in sim-s, with no motion
//   speed        mean / p50 / max u/s while moving, and the coefficient of
//                variation of the per-second speed (CONSTANT ⇒ CoV ≈ 0)
//   distance     total u travelled
// plus, across the fleet: how many trains are moving in the same step
// (`concurrent`), and the min centre-to-centre separation (a fleet that
// collapses onto one point is not a fleet).
//
// Usage:
//   node probe-monorail-timetable.mjs                     # 4 platforms, 4 trains, 400 s
//   node probe-monorail-timetable.mjs --trains=1 --secs=200
//   node probe-monorail-timetable.mjs --guests=0          # an EMPTY park — the worst case
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { HERE, REPO } from './paths.mjs';

// ---- minimal DOM stub (materials paint canvas textures) ---------------------
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
const SECS = Number(arg('secs', '400'));
const GUESTS = Number(arg('guests', '24'));
const TRAINS_ARG = arg('trains', '4'); // `auto` omits the prop — exercises the DEFAULT fleet
const NTRAINS = TRAINS_ARG === 'auto' ? null : Number(TRAINS_ARG);
const CAP = Number(arg('cap', '6'));
const DUR = Number(arg('dur', '12'));

// ---- bundle the real component + manager for node ---------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_mono-motion.ts');
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
const bundlePath = path.join(outDir, '_mono-motion.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { buildMonorailScene, createGameManager } = await import(bundlePath);

// ---- the reference ring (samples/monorail-ref.tsx, verbatim) ----------------
const MONO_PIECES = [
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 },
  { type: 'straight', length: 1.5 },
];
const BEAM_Y = 2.6;

const warns = [];
const realWarn = console.warn;
console.warn = (m) => warns.push(String(m));
const scene = buildMonorailScene(THREE, {
  pieces: MONO_PIECES,
  beamY: BEAM_Y,
  ...(NTRAINS === null ? {} : { trains: NTRAINS }),
});
console.warn = realWarn;

const trains = scene.group.userData.monorailTrains ?? [];
const tt = scene.group.userData.monorailTimetable;
console.log(
  `=== monorail MOTION probe — ${NTRAINS === null ? 'DEFAULT' : NTRAINS} train(s) asked for, ${trains.length} built, ` +
    `${scene.stationPoses?.length ?? 0} platform(s), ${GUESTS} guests, ${SECS} sim-s`,
);
if (tt)
  console.log(
    `    timetable: ${tt.length.toFixed(1)} u circuit, cruise ${tt.cruise} u/s, dwell ${tt.dwell} s × ${tt.stops}, ` +
      `lap ${tt.cycleT.toFixed(1)} s, ${tt.trains} train(s) ${(tt.cycleT / tt.trains).toFixed(1)} s apart`,
  );
if (scene.invalid) console.log('    !! circuit compiled FATAL — the ride would not register');
warns.forEach((w) => console.log(`    warn: ${w}`));

// ---- the street graph + a real registered ride ------------------------------
const laneLenOf = (c) => Math.max(2.2, 0.6 + c * 2 * 0.28 + 0.5);
const JOIN = laneLenOf(CAP) + 0.35;
const NODES = [
  [-6, -62.4], [-6, -44.4], [0, -44.4], [0, -32.4], [0, -20.4], [0, -8.4],
  [-18, -8.4], [-36.0, -8.4], [18, -8.4], [36.0, -8.4], [0, 3.6], [0, 15.6], [0, 27.6],
];
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [5, 6], [6, 7], [5, 8], [8, 9], [5, 10], [10, 11], [11, 12],
];
const PLATFORMS = [
  { label: 'West', deck: [-42.6, BEAM_Y, -8.4], tail: [-36.0, -8.4], dir: [1, 0], face: [0, 1] },
  { label: 'North', deck: [0, BEAM_Y, 34.2], tail: [0, 27.6], dir: [0, -1], face: [1, 0] },
  { label: 'East', deck: [42.6, BEAM_Y, -8.4], tail: [36.0, -8.4], dir: [-1, 0], face: [0, 1] },
  { label: 'South', deck: [0, BEAM_Y, -51.0], tail: [0, -44.4], dir: [0, 1], face: [1, 0] },
];
const stationCfg = (p) => ({
  label: p.label,
  boardPoint: p.deck,
  queueAnchor: [p.tail[0] - p.dir[0] * JOIN, 0.05, p.tail[1] - p.dir[1] * JOIN],
  queueDir: p.dir,
  exitPoint: [
    p.tail[0] - p.dir[0] * (JOIN + 0.62) + p.face[0] * 1.2,
    p.tail[1] === undefined ? 0.05 : 0.05,
    p.tail[1] - p.dir[1] * (JOIN + 0.62) + p.face[1] * 1.2,
  ],
  exitDir: p.dir,
});

const rwarns = [];
console.warn = (m) => rwarns.push(String(m));
const mgr = createGameManager(THREE, { net: { nodes: NODES, edges: EDGES }, groundAt: () => 0 });
mgr.registerParkEntrance({ spawnPoint: [0, 0, 0.6], archway: [0, 0, 0] }, { position: [-6, 0, -62.4], yaw: 0 });
const s0 = stationCfg(PLATFORMS[0]);
const stateLog = [];
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
  seatWorld: scene.seatWorld,
  onStateChange: (st) => {
    stateLog.push(st);
    scene.onStateChange(st);
  },
});
if (GUESTS > 0) mgr.spawnGuests(GUESTS);
console.warn = realWarn;

// ---- run, sampling every train every step -----------------------------------
const dt = 1 / 30;
const steps = Math.round(SECS / dt);
const P = new THREE.Vector3();
const prev = trains.map(() => null);
const stat = trains.map(() => ({
  dist: 0, moving: 0, stall: 0, longestStall: 0, perSec: [], secDist: 0,
}));
const concurrent = new Array(trains.length + 1).fill(0);
let minSep = Infinity;
const stateTime = new Map();
let lastState = null;
let lastStateT = 0;
let downSteps = 0;

for (let s = 1; s <= steps; s += 1) {
  const time = s * dt;
  mgr.update(time, dt);
  scene.update(time);
  // OUT OF SERVICE IS NOW AN ASSERTION, NOT AN ALLOWANCE. This used to be an
  // exclusion window: a broken ride is SUPPOSED to be stationary (RCT2 stops it
  // and sends a mechanic), so those steps were dropped from the duty/stall
  // verdict. No ride in this design system can break down any more
  // (GameManager/access.ts `statusOf` returns only 'open' / 'closed'), so the
  // count must stay at ZERO and any hit is a REGRESSION in that rule, not
  // maintenance to be excused. The exclusion arithmetic below is kept so the
  // verdict is still honest if it ever fires — but it also fails the run.
  const st8 = handle.status();
  const down = st8 === 'brokenDown' || st8 === 'beingRepaired';
  if (down) downSteps += 1;
  let nMoving = 0;
  trains.forEach((cars, i) => {
    cars[0].updateWorldMatrix(true, false);
    P.set(0, 0, 0).applyMatrix4(cars[0].matrixWorld);
    const p = [P.x, P.y, P.z];
    const q = prev[i];
    prev[i] = p;
    if (!q) return;
    const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const st = stat[i];
    st.dist += d;
    st.secDist += d;
    if (d > 1e-4) {
      st.moving += 1;
      st.stall = 0;
      nMoving += 1;
    } else if (down) {
      st.stall = 0; // out of service — not a timetable stall
    } else {
      st.stall += dt;
      st.longestStall = Math.max(st.longestStall, st.stall);
    }
    if (s % 30 === 0) {
      st.perSec.push(st.secDist);
      st.secDist = 0;
    }
  });
  concurrent[nMoving] += 1;
  // fleet separation
  for (let a = 0; a < trains.length; a += 1)
    for (let b = a + 1; b < trains.length; b += 1) {
      if (!prev[a] || !prev[b]) continue;
      const d = Math.hypot(prev[a][0] - prev[b][0], prev[a][2] - prev[b][2]);
      if (d < minSep) minSep = d;
    }
  // FSM state occupancy
  const cur = stateLog.length ? stateLog[stateLog.length - 1] : 'init';
  if (cur !== lastState) {
    if (lastState !== null) stateTime.set(lastState, (stateTime.get(lastState) ?? 0) + (time - lastStateT));
    lastState = cur;
    lastStateT = time;
  }
}
if (lastState !== null) stateTime.set(lastState, (stateTime.get(lastState) ?? 0) + (SECS - lastStateT));

// ---- report ------------------------------------------------------------------
const upSteps = Math.max(1, steps - downSteps);
const pct = (n) => `${((100 * n) / steps).toFixed(1)}%`;
const pctUp = (n) => `${((100 * n) / upSteps).toFixed(1)}%`;
console.log(
  `\n    out of service (brokenDown / beingRepaired): ${((downSteps * dt)).toFixed(1)} s of ${SECS} s ` +
    `(${((100 * downSteps) / steps).toFixed(1)}%) — MUST BE 0.0 s: no ride can break down` +
    (downSteps ? '   <-- BREAKDOWN REGRESSION' : ''),
);
console.log('\n    PER-TRAIN MOTION (dt 1/30, sampled every step):');
console.log('      train   duty    distance   mean u/s   max u/s   CoV(all)   CoV(cruise)   longest stall');
const summary = [];
const covOf = (xs) => {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (m < 1e-6) return 0;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) / m;
};
stat.forEach((st, i) => {
  const secs = st.perSec;
  const mean = secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : 0;
  const max = secs.length ? Math.max(...secs) : 0;
  // CRUISE windows: the 1-s samples where the train was actually running
  // between platforms. Dwelling at a station is not speed variation — it is
  // the timetable — so the "constant speed" question is about these only.
  const cruise = secs.filter((d) => d > 0.5 * max);
  const cov = covOf(secs);
  const covCruise = covOf(cruise);
  summary.push({ duty: st.moving / upSteps, mean, cov, covCruise, stall: st.longestStall });
  console.log(
    `      ${String(i).padStart(5)}   ${pctUp(st.moving).padStart(6)}   ${st.dist.toFixed(1).padStart(8)}   ` +
      `${mean.toFixed(3).padStart(8)}   ${max.toFixed(3).padStart(7)}   ${cov.toFixed(3).padStart(8)}   ` +
      `${covCruise.toFixed(3).padStart(11)}   ${st.longestStall.toFixed(1).padStart(11)} s`,
  );
});

console.log('\n    HOW MANY TRAINS MOVE IN THE SAME STEP:');
concurrent.forEach((n, k) => {
  if (n) console.log(`      ${k} moving: ${pct(n)}`);
});
console.log(`\n    min centre-to-centre separation across the fleet: ${Number.isFinite(minSep) ? minSep.toFixed(2) : 'n/a'} u`);

console.log('\n    RIDE FSM state occupancy:');
[...stateTime.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`      ${String(k).padEnd(24)} ${v.toFixed(1)} s  (${((100 * v) / SECS).toFixed(1)}%)`));
console.log(`    currentStation() ${handle.currentStation()}   totalRides() ${handle.totalRides()}   transfers() ${handle.transfers()}`);

// ---- verdict -------------------------------------------------------------------
// A transport ride that reads as RUNNING: every train moves most of the time,
// never sits still for a long stretch, and holds a near-constant speed.
const DUTY_MIN = 0.85;
const STALL_MAX = 6; // a platform dwell plus its brake, and nothing more
const COV_MAX = 0.1; // between platforms the speed must not wander
const fail = [];
summary.forEach((s, i) => {
  if (s.duty < DUTY_MIN) fail.push(`train ${i} duty ${(100 * s.duty).toFixed(1)}% < ${100 * DUTY_MIN}%`);
  if (s.stall > STALL_MAX) fail.push(`train ${i} stalled ${s.stall.toFixed(1)} s (> ${STALL_MAX} s)`);
  if (s.covCruise > COV_MAX) fail.push(`train ${i} cruise CoV ${s.covCruise.toFixed(3)} (> ${COV_MAX}) — not a constant cruise`);
});
// ...and it is never out of service. No ride can break down (see the sampling
// note above), so a single `brokenDown` / `beingRepaired` step is a regression
// in that rule and fails the run — the figure used to be excused as maintenance.
if (downSteps > 0)
  fail.push(
    `the ride reported brokenDown/beingRepaired for ${(downSteps * dt).toFixed(1)} s — NO RIDE MAY BREAK DOWN ` +
      '(GameManager/access.ts `statusOf`, GameManager/rideFsm.ts: the breakdown schedule was removed)',
  );
if (NTRAINS !== null && trains.length !== NTRAINS) fail.push(`${trains.length} trains built, ${NTRAINS} asked for`);
if (NTRAINS === null && trains.length < 2) fail.push(`the DEFAULT fleet on a ${PLATFORMS.length}-platform ring is ${trains.length} train(s)`);
const multiMoving = concurrent.slice(2).reduce((a, b) => a + b, 0) / steps;
if (trains.length > 1 && multiMoving < 0.8) fail.push(`≥2 trains moving only ${(100 * multiMoving).toFixed(1)}% of the time`);

console.log(`\n=== VERDICT: ${fail.length ? 'FAIL' : 'PASS'}`);
fail.forEach((f) => console.log(`      - ${f}`));
process.exit(fail.length ? 1 : 0);
