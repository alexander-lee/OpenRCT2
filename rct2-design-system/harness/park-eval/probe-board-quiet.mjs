#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-board-quiet.mjs — WHEN DOES A RIDE ACTUALLY LEAVE THE STATION?
//
// WHY. The departure rule in `GameManager/rideFsm.ts` (`waitingForPassengers`)
// is not observable from a screenshot and only barely observable from
// `probe.json`, which samples the sim ~1.5 s in. The user-visible complaint it
// exists to answer — "the rides aren't starting until ALL guests board" — is a
// statement about TIMING, so it has to be measured in sim seconds: how long
// after the FIRST guest sits down does the train leave, how many riders does it
// leave with, and how many cycles does that buy per sim-minute.
//
// It also pins the invariant that the `st.entering.length === 0` guard exists
// for: a ride must NEVER depart while a guest is mid-doorway (admitted out of
// the queue, walking into the entrance hut, not yet a rider). If that ever
// fires, the guest is stranded in `enteringRide` with a train that has left.
//
// METHOD. Same idiom as `probe-sim-reach.mjs` / `probe-monorail-transfer.mjs`:
// no browser, no React, no terrain — esbuild-bundle the REAL
// `createGameManager` for node behind a tiny DOM stub, build a street graph by
// hand, register the ride(s), and step `mgr.update(t, dt)` at dt = 1/30 exactly
// as `validatePark`'s smoke loop does. Every metric is sampled EVERY step (not
// every 0.5 s) because a state transition is one step wide.
//
// WHAT IT WATCHES, per ride, per cycle:
//   * `waitingForPassengers -> waitingToDepart`   = the departure decision
//   * riders 0 -> 1 inside that cycle             = the FIRST boarding
//   * every riders++ inside that cycle            = a boarding (for the gaps)
//   * guests in state 'enteringRide' at the moment of the decision  = must be 0
//
// SCENARIOS (all three, or one with --only=):
//   flat-trickle  single-station flat ride, capacity 8, ONE guest admitted every
//                 --arrive sim-s. The complaint's regime: a queue that is rarely
//                 empty and never fills a train.
//   flat-busy     the same ride with the whole cohort spawned at once — the
//                 regime where a full vehicle is reachable.
//   mono          the 4-platform §4.2 monorail graph from
//                 probe-monorail-transfer.mjs (multi-station takes the OTHER
//                 branch of the departure rule: the empty-platform rule).
//
// Usage:
//   node probe-board-quiet.mjs                       # every scenario, 600 sim-s
//   node probe-board-quiet.mjs --legacy              # ...under the OLD rule (A/B)
//   node probe-board-quiet.mjs --secs=1800 --arrive=18 --only=flat-trickle
//   node probe-board-quiet.mjs --json                # machine-readable
//
// `--legacy` restores the pre-2026-07-28 departure condition IN MEMORY at bundle
// time (see LEGACY_SWAPS) so the before/after stays reproducible after the fact.
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
const has = (n) => process.argv.includes(`--${n}`);
const SECS = Number(arg('secs', '600'));
const ARRIVE = Number(arg('arrive', '20')); // trickle: one guest every N sim-s
const COHORT = Number(arg('guests', '24'));
const JSON_OUT = has('json');
const ONLY = arg('only', '');

// ---- bundle the sim for node ------------------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_board-quiet.ts');
fs.writeFileSync(
  ep,
  `
import { createGameManager } from ${JSON.stringify(path.join(REPO, 'components/GameManager'))};
import { SIM_SMOKE_SECONDS } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
export { createGameManager, SIM_SMOKE_SECONDS };
`,
);
// ---- `--legacy`: the PRE-2026-07-28 departure rule, restored IN MEMORY -------
// The point of a before/after is that both halves stay runnable. `rideFsm.ts` is
// patched at bundle time by an esbuild `onLoad` plugin — the same trick
// `evaltags.mjs` uses for its eval tags — so nothing under `mp3d/` is ever
// written and the two rules can be A/B'd in one command. Every swap ASSERTS its
// anchor is present, so a future edit to the rule makes `--legacy` fail loudly
// instead of silently measuring the new rule twice.
const LEGACY_SWAPS = [
  ['if (!doorsClosing && aboard < r.cfg.capacity) {', 'if (aboard < r.cfg.capacity) {'],
  [
    '(laden && ((full && r.timer >= r.minWait) || quietOut || capped || (r.timer >= r.minWait && st.queue.length === 0))) ||',
    '(laden && ((full && r.timer >= r.minWait) || r.timer >= r.maxWait || (r.timer >= r.minWait && st.queue.length === 0))) ||',
  ],
];
const legacyPlugin = {
  name: 'legacy-departure-rule',
  setup(b) {
    b.onLoad({ filter: /GameManager[\\/]rideFsm\.ts$/ }, async (a) => {
      let src = await fs.promises.readFile(a.path, 'utf8');
      for (const [from, to] of LEGACY_SWAPS) {
        if (!src.includes(from)) throw new Error(`--legacy: anchor not found in rideFsm.ts:\n  ${from}`);
        src = src.split(from).join(to);
      }
      return { contents: src, loader: 'ts' };
    });
  },
};
const LEGACY = has('legacy');
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
  plugins: LEGACY ? [legacyPlugin] : [],
});
const bundlePath = path.join(outDir, `_board-quiet.bundle.${Date.now()}.mjs`);
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { createGameManager, SIM_SMOKE_SECONDS } = await import(bundlePath);
// validatePark's own two numbers, imported rather than restated so this probe
// cannot drift from the gate it is reasoning about (`ParkBuilder/validate.ts`)
const windowFor = (dur) => Math.max(SIM_SMOKE_SECONDS, Math.ceil(2.5 * dur + 20));
const stallSecsFor = (dur) => Math.max(45, Math.round(0.75 * windowFor(dur)));
fs.rmSync(bundlePath, { force: true });

/** GameManager's own default queue-lane length + the 0.35 tail gap */
const laneLenOf = (c) => Math.max(2.2, 0.6 + c * 2 * 0.28 + 0.5);
const CELL = 1.2;

// ---------------------------------------------------------------------------
// SINGLE-STATION FLAT RIDE — a straight street from the gate to the queue tail,
// deliberately SHORT (the walk is not what is being measured here).
// ---------------------------------------------------------------------------
function buildFlat({ cap, dur, minWait, maxWait, quietWait, lane }) {
  const gateZ = 20;
  const nodes = [];
  for (let i = 0; i <= 10; i += 1) nodes.push([0, +(gateZ - i * CELL).toFixed(4)]);
  const edges = nodes.slice(1).map((_n, i) => [i, i + 1]);
  const tail = nodes[nodes.length - 1];
  const join = (lane ?? laneLenOf(cap)) + 0.35;
  const head = [tail[0], tail[1] - join];
  const pad = [head[0], head[1] - 5.4];
  const mgr = createGameManager(THREE, { net: { nodes, edges }, groundAt: () => 0 });
  mgr.registerParkEntrance({ spawnPoint: [0, 0, 0.6], archway: [0, 0, 0] }, { position: [0, 0, gateZ], yaw: 0 });
  const handle = mgr.registerRide({
    name: 'Carousel',
    capacity: cap,
    rideDuration: dur,
    intensity: 3,
    price: 0,
    queueAnchor: [head[0], 0, head[1]],
    queueDir: [0, 1],
    boardPoint: [pad[0], 0.6, pad[1]],
    exitPoint: [pad[0] + 2.4, 0, pad[1]],
    exitDir: [1, 0],
    ...(lane === undefined ? {} : { laneLen: lane }),
    ...(minWait === undefined ? {} : { minWait }),
    ...(maxWait === undefined ? {} : { maxWait }),
    ...(quietWait === undefined ? {} : { quietWait }),
  });
  return { mgr, handles: [handle], stationCount: 1 };
}

// ---------------------------------------------------------------------------
// THE 4-PLATFORM MONORAIL — the graph is copied verbatim from
// probe-monorail-transfer.mjs so the two probes talk about the same ride.
// ---------------------------------------------------------------------------
function buildMono({ cap, dur, quietWait }) {
  const NODES = [
    [-6, -62.4], [-6, -44.4], [0, -44.4], [0, -32.4], [0, -20.4], [0, -8.4],
    [-18, -8.4], [-36.0, -8.4], [18, -8.4], [36.0, -8.4], [0, 3.6], [0, 15.6], [0, 27.6],
  ];
  const EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [5, 8], [8, 9], [5, 10], [10, 11], [11, 12],
  ];
  const PLATFORMS = [
    { label: 'West', deck: [-42.6, 2.6, -8.4], tail: [-36.0, -8.4], dir: [1, 0], face: [0, 1] },
    { label: 'North', deck: [0, 2.6, 34.2], tail: [0, 27.6], dir: [0, -1], face: [1, 0] },
    { label: 'East', deck: [42.6, 2.6, -8.4], tail: [36.0, -8.4], dir: [-1, 0], face: [0, 1] },
    { label: 'South', deck: [0, 2.6, -51.0], tail: [0, -44.4], dir: [0, 1], face: [1, 0] },
  ];
  const JOIN = laneLenOf(cap) + 0.35;
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
  const mgr = createGameManager(THREE, { net: { nodes: NODES, edges: EDGES }, groundAt: () => 0 });
  mgr.registerParkEntrance({ spawnPoint: [0, 0, 0.6], archway: [0, 0, 0] }, { position: [-6, 0, -62.4], yaw: 0 });
  const s0 = stationCfg(PLATFORMS[0]);
  const handle = mgr.registerRide({
    name: 'Grand Circle Monorail',
    capacity: cap,
    rideDuration: dur,
    intensity: 1,
    price: 0,
    queueAnchor: s0.queueAnchor,
    queueDir: s0.queueDir,
    boardPoint: s0.boardPoint,
    exitPoint: s0.exitPoint,
    exitDir: s0.exitDir,
    stations: PLATFORMS.slice(1).map(stationCfg),
    ...(quietWait === undefined ? {} : { quietWait }),
  });
  return { mgr, handles: [handle], stationCount: 4 };
}

// ---------------------------------------------------------------------------
// THE RUN — one scenario, stepped at dt = 1/30, sampled EVERY step.
// ---------------------------------------------------------------------------
function run(scenario) {
  const built = scenario.build();
  const { mgr, handles } = built;
  const dt = 1 / 30;
  const steps = Math.round(SECS / dt);
  // trickle mode admits one guest at a time; cohort mode spawns them up front
  const warnSink = console.warn;
  console.warn = () => {};
  if (scenario.trickle) mgr.spawnGuests(1);
  else mgr.spawnGuests(scenario.cohort ?? COHORT);
  console.warn = warnSink;
  let spawned = 1;

  const per = handles.map((h) => ({
    name: h.name,
    cycles: [], // { firstBoardAt, departAt, riders, enteringAtDepart, gaps: [] }
    open: null,
    prevState: h.state(),
    prevRiders: h.occupancy().riders,
    lastBoardAt: null,
  }));

  // THE SIM-SMOKE-GATE QUANTITY. `validatePark` passes only if some guest
  // completes a full cycle inside its window (`probe-sim-reach.mjs` measures the
  // walking bound on it), so a departure rule that holds the doors open longer
  // pushes this number out and can fail a park that used to pass. Measure it.
  let firstRideAt = null;
  // THE QUEUE-STALL DETECTOR, replicated EXACTLY as `ParkBuilder/validate.ts`
  // runs it (sampled every 15 steps = 0.5 s; the hold resets only when the queue
  // is observed SMALLER than the previous sample, or empty), because a threshold
  // must be set from the quantity it actually thresholds. `stallSecs =
  // max(30, maxDur + 15)` fails the park when a hold exceeds it — and the hold is
  // one full ride CYCLE, which the boarding-quiet dwell made longer.
  const stall = handles.map(() => ({ since: -1, prev: 0, longest: 0, holdEnd: 0 }));
  for (let s = 1; s <= steps; s += 1) {
    const time = s * dt;
    mgr.update(time, dt);
    if (firstRideAt === null && mgr.stats().riddenTotal >= 1) firstRideAt = time;
    if (s % 15 === 0) {
      for (let i = 0; i < handles.length; i += 1) {
        const q = handles[i].queueLength();
        const rec = stall[i];
        if (q < rec.prev || q === 0) rec.since = -1;
        else if (q > 0 && rec.since < 0) rec.since = time;
        if (rec.since >= 0 && time - rec.since > rec.longest) {
          rec.longest = time - rec.since;
          rec.holdEnd = time;
        }
        rec.prev = q;
      }
    }
    if (scenario.trickle && time >= spawned * ARRIVE && spawned < (scenario.cap ?? 1e9)) {
      const w = console.warn;
      console.warn = () => {};
      mgr.spawnGuests(1);
      console.warn = w;
      spawned += 1;
    }
    for (let i = 0; i < handles.length; i += 1) {
      const h = handles[i];
      const p = per[i];
      const st = h.state();
      const riders = h.occupancy().riders;
      if (st === 'waitingForPassengers' && p.prevState !== 'waitingForPassengers') {
        p.open = { enteredAt: time, firstBoardAt: null, gaps: [], lastBoardAt: null };
      }
      if (p.open && riders > p.prevRiders && st === 'waitingForPassengers') {
        for (let k = 0; k < riders - p.prevRiders; k += 1) {
          if (p.open.firstBoardAt === null) p.open.firstBoardAt = time;
          else p.open.gaps.push(time - p.open.lastBoardAt);
          p.open.lastBoardAt = time;
        }
      }
      // THE DEPARTURE DECISION — one step wide
      if (p.prevState === 'waitingForPassengers' && st === 'waitingToDepart') {
        // guests still mid-doorway on THIS ride: the invariant that must hold
        const entering = mgr.guests().filter((g) => g.state === 'enteringRide' && g.ride === h.name).length;
        const o = p.open ?? { enteredAt: time, firstBoardAt: null, gaps: [], lastBoardAt: null };
        p.cycles.push({
          enteredAt: o.enteredAt,
          firstBoardAt: o.firstBoardAt,
          lastBoardAt: o.lastBoardAt,
          departAt: time,
          dwellFromFirstBoard: o.firstBoardAt === null ? null : time - o.firstBoardAt,
          dwellFromLastBoard: o.lastBoardAt === null ? null : time - o.lastBoardAt,
          dwellFromArrival: time - o.enteredAt,
          riders: p.prevRiders,
          entering,
          // WHICH CLAUSE FIRED — told apart from outside by the queue depth and
          // the seat count at the decision step. It must be the CURRENT
          // PLATFORM's queue, not `queueLength()`: that one sums every platform
          // (queries.ts `rideList`), and the rule reads `st.queue.length` — on a
          // 4-platform monorail the two disagree constantly and the difference
          // is exactly the empty-platform departures.
          queue: h.stations()[h.currentStation()].queueLength,
          full: p.prevRiders >= h.occupancy().capacity,
          gaps: o.gaps,
        });
        p.open = null;
      }
      p.prevState = st;
      p.prevRiders = riders;
    }
  }
  const stats = mgr.stats();
  return {
    stats,
    firstRideAt,
    spawned: scenario.trickle ? spawned : (scenario.cohort ?? COHORT),
    active: stats.activeGuests,
    per: per.map((p, i) => ({ ...p, total: handles[i].totalRides(), transfers: handles[i].transfers?.() ?? 0, longestQueueHold: stall[i].longest })),
  };
}

// the DEFAULTS the scenarios below run on (types.ts BOARD_QUIET_SECS, and
// registry.ts's `maxWait: T(32 * 60)` = 12 s) — used only to attribute a
// departure to the deadline that caused it
const QUIET = Number(arg('quiet-secs', '10'));
const MAXW = Number(arg('max-secs', '12'));

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const med = (a) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2;
};
const f = (v, d = 2) => (v === null || v === undefined ? '   —  ' : v.toFixed(d));

const SCENARIOS = [
  {
    key: 'flat-trickle',
    title: `single-station flat ride, capacity 8, rideDuration 12 s, ONE guest arriving every ${ARRIVE} s`,
    trickle: true,
    build: () => buildFlat({ cap: 8, dur: 12 }),
  },
  {
    key: 'flat-busy',
    title: `single-station flat ride, capacity 8, rideDuration 12 s, ${COHORT} guests at once`,
    build: () => buildFlat({ cap: 8, dur: 12 }),
  },
  {
    // THE COMPLAINT'S REGIME. A queue that never runs dry defeats every timer in
    // the old rule: `st.queue.length === 0` never holds, and while ANY guest is
    // mid-doorway `st.entering.length === 0` is false, so even `maxWait` cannot
    // fire. The train only leaves when it is FULL — "the rides aren't starting
    // until ALL guests board".
    key: 'flat-crowded',
    title: 'single-station flat ride, capacity 8, rideDuration 12 s, 60 guests at once (queue never runs dry)',
    cohort: 60,
    build: () => buildFlat({ cap: 8, dur: 12 }),
  },
  {
    // The same crowd behind a LONG queue lane (30 u ≈ 50 slots) — a popular ride
    // in a real park, where the lane holds far more guests than one train seats
    // and `st.queue.length` is essentially never 0.
    key: 'flat-longqueue',
    title: 'single-station flat ride, capacity 8, rideDuration 12 s, 60 guests, 30 u queue lane',
    cohort: 60,
    build: () => buildFlat({ cap: 8, dur: 12, lane: 30 }),
  },
  {
    key: 'mono',
    title: `4-platform monorail, capacity 6, rideDuration 12 s, ${COHORT} guests at once`,
    build: () => buildMono({ cap: 6, dur: 12 }),
  },
].filter((sc) => !ONLY || ONLY.split(',').includes(sc.key));

const report = { rule: LEGACY ? 'legacy (pre-2026-07-28)' : 'boarding-quiet', secs: SECS, arrive: ARRIVE, cohort: COHORT, scenarios: {} };
if (!JSON_OUT) console.log(`RULE UNDER TEST: ${report.rule}   (${SECS} sim-s per scenario, dt = 1/30)`);
let allOk = true;
for (const sc of SCENARIOS) {
  const r = run(sc);
  const rows = [];
  for (const p of r.per) {
    const cycles = p.cycles;
    const laden = cycles.filter((c) => c.riders > 0);
    const fb = laden.map((c) => c.dwellFromFirstBoard);
    const lb = laden.map((c) => c.dwellFromLastBoard);
    const gaps = laden.flatMap((c) => c.gaps);
    const stuck = cycles.filter((c) => c.entering > 0);
    const row = {
      ride: p.name,
      departures: cycles.length,
      ladenDepartures: laden.length,
      emptyDepartures: cycles.length - laden.length,
      ridersPerDeparture: mean(laden.map((c) => c.riders)),
      maxRiders: laden.length ? Math.max(...laden.map((c) => c.riders)) : null,
      firstBoardToDepart: { mean: mean(fb), median: med(fb), min: fb.length ? Math.min(...fb) : null, max: fb.length ? Math.max(...fb) : null },
      lastBoardToDepart: { mean: mean(lb), median: med(lb) },
      interBoardingGap: { mean: mean(gaps), median: med(gaps), n: gaps.length },
      // WHICH DEADLINE ENDED THE DWELL. Told apart from outside by arithmetic on
      // the two stamps: a quiet-window departure is `quietWait` past the LAST
      // boarding, a capped one `maxWait` past the FIRST. (`--legacy` has no quiet
      // window and measures maxWait from the platform ARRIVAL, so its timer
      // departures land in `other`.)
      endedBy: {
        full: laden.filter((c) => c.full).length,
        quietWindow: laden.filter((c) => !c.full && c.dwellFromLastBoard >= QUIET - 0.2).length,
        maxWaitCap: laden.filter((c) => !c.full && c.dwellFromLastBoard < QUIET - 0.2 && c.dwellFromFirstBoard >= MAXW - 0.2).length,
        queueEmpty: laden.filter((c) => !c.full && c.dwellFromLastBoard < QUIET - 0.2 && c.dwellFromFirstBoard < MAXW - 0.2 && c.queue === 0).length,
        other: laden.filter((c) => !c.full && c.dwellFromLastBoard < QUIET - 0.2 && c.dwellFromFirstBoard < MAXW - 0.2 && c.queue > 0).length,
      },
      fullDepartures: laden.filter((c) => c.full).length,
      queueEmptyAtDepart: laden.filter((c) => !c.full && c.queue === 0).length,
      timerDepartures: laden.filter((c) => !c.full && c.queue > 0).length,
      queueAtDepart: { mean: mean(laden.map((c) => c.queue)), max: laden.length ? Math.max(...laden.map((c) => c.queue)) : null },
      cyclesPerSimMinute: (cycles.length / SECS) * 60,
      ridersServedPerSimMinute: (p.total / SECS) * 60,
      totalRides: p.total,
      transfers: p.transfers,
      departedWithGuestEntering: stuck.length,
      // the queue-stall detector's own quantity, against the threshold
      // validatePark would apply to THIS ride (maxDur = rideDuration here)
      longestQueueHold: p.longestQueueHold,
    };
    if (stuck.length) allOk = false;
    rows.push(row);
  }
  report.scenarios[sc.key] = { title: sc.title, spawned: r.spawned, active: r.active, riddenTotal: r.stats.riddenTotal, firstRideAt: r.firstRideAt, rides: rows };
  if (JSON_OUT) continue;
  console.log(`\n=== ${sc.key} — ${sc.title}`);
  console.log(`    ${r.spawned} guest(s) admitted, ${r.active} still in the park, riddenTotal ${r.stats.riddenTotal}`);
  console.log(`    FIRST COMPLETED CYCLE at ${r.firstRideAt === null ? 'NEVER' : r.firstRideAt.toFixed(2) + ' sim-s'} (validatePark's sim-smoke gate needs one inside its window)`);
  for (const row of rows) {
    console.log(`    ${row.ride}:`);
    console.log(`      departures ${row.departures} (${row.ladenDepartures} laden / ${row.emptyDepartures} empty)   cycles/sim-min ${f(row.cyclesPerSimMinute)}   riders served/sim-min ${f(row.ridersServedPerSimMinute)}`);
    console.log(`      riders per LADEN departure ${f(row.ridersPerDeparture)} of capacity (max seen ${row.maxRiders ?? '—'})`);
    console.log(`      left because FULL ${row.fullDepartures}   because the QUEUE WAS EMPTY ${row.queueEmptyAtDepart}   on a TIMER with guests still queuing ${row.timerDepartures}   (queue at depart mean ${f(row.queueAtDepart.mean)}, max ${row.queueAtDepart.max ?? '—'})`);
    console.log(`      ENDED BY: full ${row.endedBy.full}   quiet window (${QUIET} s since the last boarding) ${row.endedBy.quietWindow}   maxWait cap (${MAXW} s since the first) ${row.endedBy.maxWaitCap}   queue empty ${row.endedBy.queueEmpty}   other ${row.endedBy.other}`);
    console.log(`      FIRST BOARDING -> DEPARTURE   mean ${f(row.firstBoardToDepart.mean)} s   median ${f(row.firstBoardToDepart.median)} s   min ${f(row.firstBoardToDepart.min)}   max ${f(row.firstBoardToDepart.max)}`);
    console.log(`      last boarding  -> departure   mean ${f(row.lastBoardToDepart.mean)} s   median ${f(row.lastBoardToDepart.median)} s`);
    console.log(`      gap BETWEEN boardings         mean ${f(row.interBoardingGap.mean)} s   median ${f(row.interBoardingGap.median)} s   (n ${row.interBoardingGap.n})`);
    console.log(`      departed with a guest still in 'enteringRide': ${row.departedWithGuestEntering}${row.departedWithGuestEntering ? '   <-- INVARIANT BROKEN' : ''}`);
    console.log(
      `      LONGEST QUEUE HOLD (no observed shrink) ${f(row.longestQueueHold)} s — validatePark FAILS this ride past ` +
        `stallSecs = max(45, 0.75·${windowFor(12)}) = ${stallSecsFor(12)} s` +
        (row.longestQueueHold > stallSecsFor(12) ? '   <-- WOULD FAIL THE sim CHECK' : ''),
    );
  }
}

if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
else console.log(`\n=== VERDICT: ${allOk ? 'PASS' : 'FAIL'} — no ride departed with a guest mid-doorway`);
process.exit(allOk ? 0 : 1);
