#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-no-breakdown.mjs — CAN A RIDE STILL BREAK DOWN? (2026-07-28)
//
// THE RULE. No ride in this design system may ever break down, by any path,
// including a park that passes `breakdownEvery`. RCT2 does break rides down and
// sends a mechanic; this is a DELIBERATE DIVERGENCE, because these parks are
// looked at rather than managed and there is nobody to dispatch. The machinery
// was REMOVED, not disarmed: `RideRec` no longer carries `brokenAt`/`breakN`/
// `nextBreak`, `rideFsm.ts` has no schedule and no `breakDown()`, and
// `access.ts`'s `statusOf` can only answer 'open' or 'closed'.
//
// WHY A PROBE AND NOT A READING. "There is no code path" is a claim about the
// whole sim, and the sim is ~10 modules deep. So drive the REAL
// `createGameManager` headlessly for 1800 sim-s and SAMPLE `handle.status()`
// EVERY STEP — a state transition is one step wide, so anything coarser can
// step over an 18 s outage the way the browser probe used to. Zero steps out of
// service is the assertion; anything else exits 1.
//
// THE THREE RIDES, and why the middle one is the point:
//   flat          a single-station flat ride, registered normally.
//   flat-optin    the SAME ride WITH `breakdownEvery: 30`. A knob that still
//                 worked would contradict the rule, so this ride must behave
//                 identically to `flat` AND must have raised exactly one
//                 `breakdownEvery … is IGNORED` warning at registration —
//                 ignored LOUDLY, so an author is never left wondering.
//   mono          the 4-platform monorail (the graph probe-monorail-transfer
//                 pins, copied verbatim so the probes talk about one ride),
//                 also with `breakdownEvery` set. Breakdowns used to freeze
//                 this fleet for 14.3 % of the clock.
//
// `--breakdowns` RESTORES THE OLD BEHAVIOUR IN MEMORY (esbuild `onLoad`, the
// same trick `probe-board-quiet.mjs --legacy` and `evaltags.mjs` use — nothing
// under `mp3d/` is written) and then INVERTS the assertion: that half must
// observe downtime. A probe that passes whatever the code does proves nothing,
// so the A/B is what makes the zero credible, and it is also how the throughput
// delta is measured on ONE ruler instead of against remembered numbers.
//
// Usage:
//   node probe-no-breakdown.mjs                    # the rule: assert ZERO downtime
//   node probe-no-breakdown.mjs --breakdowns       # the old schedule, in memory (A/B)
//   node probe-no-breakdown.mjs --secs=3600 --guests=40 --json
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
const SECS = Number(arg('secs', '1800'));
const GUESTS = Number(arg('guests', '24'));
const CAP = Number(arg('cap', '8'));
const DUR = Number(arg('dur', '12'));
/** the `breakdownEvery` the two opt-in rides pass — ignored, and warned about */
const EVERY = Number(arg('every', '30'));
const JSON_OUT = has('json');
const LEGACY = has('breakdowns');
/**
 * WHICH COPY OF THE DESIGN SYSTEM TO MEASURE (default: the live `mp3d/`).
 *
 * Same escape hatch as `mp3d-render/probe-reef-water.mjs --src=`: point the probe
 * at a snapshot tree and it measures THAT with this ruler, instead of the reader
 * having to trust remembered numbers. Two uses: measuring a pre-change baseline,
 * and — since `mp3d/components/GameManager/` is edited by more than one session
 * at a time — running when an UNRELATED lane has the live tree mid-refactor.
 */
const MP3D = arg('repo', REPO);

// ---- bundle the sim for node ------------------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_no-breakdown.ts');
fs.writeFileSync(
  ep,
  `
import { createGameManager } from ${JSON.stringify(path.join(MP3D, 'components/GameManager'))};
export { createGameManager };
`,
);

// ---- `--breakdowns`: THE REMOVED SCHEDULE, RESTORED IN MEMORY ----------------
// Seven swaps across five modules, because the breakdown model was never one
// place: the FSM fired and paused, `statusOf` reported the two mechanic states,
// and `needs`/`navigation`/`arrivals` each read the clock (a broken ride was
// refused, skipped as a goal, and worth 25 uptime instead of 100). Restoring
// only the FSM would measure a legacy that never existed — guests would keep
// queuing for a dead ride — so all five are restored and the A/B is honest.
//
// The injected code carries its own constants (12 s fault + 6 s repair, and the
// hashed 40–95 s interval taken from the last revision that had it) and stores
// its clock on the record as an untyped field, so it depends on NOTHING that was
// deleted. Every swap ASSERTS its anchor: a future edit makes `--breakdowns`
// fail loudly instead of silently measuring the current code twice.
const LEGACY_INTERVAL = `
  const __legacyInterval = (r: any): number => {
    const rel = hash01(r.idx * 47.9 + 11.3); // 0 fragile .. 1 reliable
    const base = r.cfg.breakdownEvery ?? 40 + rel * 55;
    return base + hash01(r.idx * 13.1 + (r.breakN ?? 0) * 29.7) * base * 0.25;
  };
`;
const LEGACY_SCHEDULE = `
    const __rr = r as any;
    if (__rr.brokenAt === undefined) {
      __rr.brokenAt = -1;
      __rr.breakN = 0;
      __rr.nextBreak = s.simTime + __legacyInterval(__rr);
    }
    if (r.state !== 'crashed') {
      if (__rr.brokenAt >= 0) {
        if (s.simTime - __rr.brokenAt >= 12 + 6) {
          __rr.brokenAt = -1;
          __rr.breakN += 1;
          __rr.nextBreak = s.simTime + __legacyInterval(__rr);
        } else return;
      } else if (s.simTime >= __rr.nextBreak) {
        __rr.brokenAt = s.simTime;
        drainRide(r);
        setState(r, 'movingToEndOfStation', 1.0);
        return;
      }
    }
`;
const LEGACY_SWAPS = {
  'rideFsm.ts': [
    ['  const crashRide = (r: RideRec) => {', `${LEGACY_INTERVAL}  const crashRide = (r: RideRec) => {`],
    [
      "    if (r.state !== 'crashed' && r.cfg.vehicleHandle?.crashed?.()) {\n      crashRide(r);\n      return;\n    }\n",
      "    if (r.state !== 'crashed' && r.cfg.vehicleHandle?.crashed?.()) {\n      crashRide(r);\n      return;\n    }\n" + LEGACY_SCHEDULE,
    ],
  ],
  'access.ts': [
    [
      "  const statusOf = (r: RideRec): RideStatus => (r.state === 'crashed' ? 'closed' : 'open');",
      "  const statusOf = (r: RideRec): RideStatus => {\n" +
        "    if (r.state === 'crashed') return 'closed';\n" +
        '    const rr = r as any;\n' +
        "    if (rr.brokenAt >= 0) return s.simTime - rr.brokenAt < 12 ? 'brokenDown' : 'beingRepaired';\n" +
        "    return 'open';\n  };",
    ],
  ],
  'needs.ts': [
    [
      "    if (r.state === 'crashed') return 'notSafe';",
      "    if (r.state === 'crashed') return 'notSafe';\n    if ((r as any).brokenAt >= 0) return 'notSafe';",
    ],
  ],
  'navigation.ts': [
    ["      if (r.state === 'crashed') continue;", "      if (r.state === 'crashed' || (r as any).brokenAt >= 0) continue;"],
  ],
  'arrivals.ts': [
    ["      uptime += ride.state === 'crashed' ? 0 : 100;", "      uptime += ride.state === 'crashed' ? 0 : (ride as any).brokenAt >= 0 ? 25 : 100;"],
    ["      if (r.state === 'crashed') continue;", "      if (r.state === 'crashed' || (r as any).brokenAt >= 0) continue;"],
  ],
};
const legacyPlugin = {
  name: 'restore-breakdowns',
  setup(b) {
    b.onLoad({ filter: /GameManager[\\/](rideFsm|access|needs|navigation|arrivals)\.ts$/ }, async (a) => {
      const file = path.basename(a.path);
      let src = await fs.promises.readFile(a.path, 'utf8');
      for (const [from, to] of LEGACY_SWAPS[file] ?? []) {
        if (!src.includes(from)) throw new Error(`--breakdowns: anchor not found in ${file}:\n  ${from.split('\n')[0]}`);
        src = src.split(from).join(to);
      }
      return { contents: src, loader: 'ts' };
    });
  },
};

const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
  plugins: LEGACY ? [legacyPlugin] : [],
});
const bundlePath = path.join(outDir, `_no-breakdown.bundle.${Date.now()}.mjs`);
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { createGameManager } = await import(bundlePath);
fs.rmSync(bundlePath, { force: true });

/** GameManager's own default queue-lane length + the 0.35 tail gap */
const laneLenOf = (c) => Math.max(2.2, 0.6 + c * 2 * 0.28 + 0.5);
const CELL = 1.2;

// ---------------------------------------------------------------------------
// SINGLE-STATION FLAT RIDE on a straight street from the gate — the graph is
// probe-board-quiet.mjs's `buildFlat`, so the walk is the one that probe's
// departure numbers were measured on.
// ---------------------------------------------------------------------------
function buildFlat({ every }) {
  const gateZ = 20;
  const nodes = [];
  for (let i = 0; i <= 10; i += 1) nodes.push([0, +(gateZ - i * CELL).toFixed(4)]);
  const edges = nodes.slice(1).map((_n, i) => [i, i + 1]);
  const tail = nodes[nodes.length - 1];
  const join = laneLenOf(CAP) + 0.35;
  const head = [tail[0], tail[1] - join];
  const pad = [head[0], head[1] - 5.4];
  const mgr = createGameManager(THREE, { net: { nodes, edges }, groundAt: () => 0 });
  mgr.registerParkEntrance({ spawnPoint: [0, 0, 0.6], archway: [0, 0, 0] }, { position: [0, 0, gateZ], yaw: 0 });
  const handle = mgr.registerRide({
    name: 'Carousel',
    capacity: CAP,
    rideDuration: DUR,
    intensity: 3,
    price: 0,
    queueAnchor: [head[0], 0, head[1]],
    queueDir: [0, 1],
    boardPoint: [pad[0], 0.6, pad[1]],
    exitPoint: [pad[0] + 2.4, 0, pad[1]],
    exitDir: [1, 0],
    ...(every === undefined ? {} : { breakdownEvery: every }),
  });
  return { mgr, handles: [handle] };
}

// ---------------------------------------------------------------------------
// THE 4-PLATFORM MONORAIL — graph copied verbatim from
// probe-monorail-transfer.mjs (as probe-board-quiet.mjs copies it) so all three
// probes measure the same ride.
// ---------------------------------------------------------------------------
function buildMono({ every }) {
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
  const JOIN = laneLenOf(CAP) + 0.35;
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
    ...(every === undefined ? {} : { breakdownEvery: every }),
  });
  return { mgr, handles: [handle] };
}

const SCENARIOS = [
  { key: 'flat', title: 'flat ride, registered normally (no breakdownEvery)', every: undefined, build: buildFlat },
  { key: 'flat-optin', title: `flat ride WITH breakdownEvery: ${EVERY} — the knob must buy nothing`, every: EVERY, build: buildFlat },
  { key: 'mono', title: `4-platform monorail WITH breakdownEvery: ${EVERY}`, every: EVERY, build: buildMono },
];

// ---------------------------------------------------------------------------
// THE RUN — dt = 1/30 (validatePark's own smoke step), sampled EVERY step.
// ---------------------------------------------------------------------------
function run(sc) {
  // registration warnings are the OTHER half of the assertion: `breakdownEvery`
  // must be ignored LOUDLY. Capture them around the build only, so a warning
  // raised later by the sim is not mistaken for a registration one.
  const warns = [];
  const realWarn = console.warn;
  console.warn = (m) => warns.push(String(m));
  let built;
  try {
    built = sc.build({ every: sc.every });
    built.mgr.spawnGuests(GUESTS);
  } finally {
    console.warn = realWarn;
  }
  const { mgr, handles } = built;
  const dt = 1 / 30;
  const steps = Math.round(SECS / dt);
  const seen = handles.map(() => new Map()); // status -> steps
  for (let i = 1; i <= steps; i += 1) {
    const time = i * dt;
    mgr.update(time, dt);
    handles.forEach((h, k) => {
      const st = h.status();
      seen[k].set(st, (seen[k].get(st) ?? 0) + 1);
    });
  }
  const stats = mgr.stats();
  return {
    warns,
    steps,
    rides: handles.map((h, k) => {
      const counts = [...seen[k].entries()].sort((a, b) => b[1] - a[1]);
      const downSteps = (seen[k].get('brokenDown') ?? 0) + (seen[k].get('beingRepaired') ?? 0);
      return {
        name: h.name,
        statuses: counts.map(([st, n]) => ({ status: st, secs: +(n * dt).toFixed(2), pct: +((100 * n) / steps).toFixed(2) })),
        outOfServiceSecs: +(downSteps * dt).toFixed(2),
        outOfServicePct: +((100 * downSteps) / steps).toFixed(2),
        ridersServed: h.totalRides(),
        ridersServedPerSimMinute: +((h.totalRides() / SECS) * 60).toFixed(2),
        transfers: h.transfers(),
        queueLength: h.queueLength(),
      };
    }),
    riddenTotal: stats.riddenTotal,
    riddenPerSimMinute: +((stats.riddenTotal / SECS) * 60).toFixed(2),
    // `stats()` SPREADS the arrivals snapshot at the top level (queries.ts) —
    // there is no `stats().arrivals` object, and reading one gave `null`
    parkRating: stats.parkRating ?? null,
    arrivals: stats.arrivals ?? null,
    activeGuests: stats.activeGuests ?? null,
  };
}

// ---------------------------------------------------------------------------
const report = { mode: LEGACY ? 'breakdowns RESTORED in memory (A/B baseline)' : 'the rule: no ride can break down', secs: SECS, guests: GUESTS, capacity: CAP, rideDuration: DUR, breakdownEvery: EVERY, scenarios: {} };
const fail = [];

if (!JSON_OUT)
  console.log(
    `=== NO-BREAKDOWN probe — ${report.mode}\n` +
      `    ${SECS} sim-s per scenario at dt = 1/30 (${Math.round(SECS / (1 / 30))} steps, status sampled EVERY step), ` +
      `${GUESTS} guests seeded + the gate stream, capacity ${CAP}, rideDuration ${DUR} s`,
  );

for (const sc of SCENARIOS) {
  const r = run(sc);
  report.scenarios[sc.key] = { title: sc.title, ...r };
  const ignoreWarns = r.warns.filter((w) => /breakdownEvery/.test(w) && /IGNORED/.test(w));
  if (!JSON_OUT) {
    console.log(`\n=== ${sc.key} — ${sc.title}`);
    console.log(`    registration warnings ${r.warns.length}; breakdownEvery-IGNORED warnings ${ignoreWarns.length}`);
    ignoreWarns.forEach((w) => console.log(`      ${w}`));
    for (const row of r.rides) {
      console.log(`    ${row.name}:`);
      console.log(`      status occupancy: ${row.statuses.map((s) => `${s.status} ${s.secs} s (${s.pct}%)`).join('   ')}`);
      console.log(
        `      OUT OF SERVICE ${row.outOfServiceSecs} s of ${SECS} s (${row.outOfServicePct}%)` +
          (LEGACY ? '   <-- expected: this half restores breakdowns' : '   <-- MUST BE 0'),
      );
      console.log(
        `      riders served ${row.ridersServed} (${row.ridersServedPerSimMinute}/sim-min)   transfers ${row.transfers}   queue at end ${row.queueLength}`,
      );
    }
    console.log(
      `    park-wide riddenTotal ${r.riddenTotal} (${r.riddenPerSimMinute}/sim-min)   parkRating ${r.parkRating}   ` +
        `gate arrivals ${r.arrivals}   guests in park ${r.activeGuests}`,
    );
  }

  // ---- the assertions ------------------------------------------------------
  const down = r.rides.reduce((n, row) => n + row.outOfServiceSecs, 0);
  if (LEGACY) {
    // THE RULER MUST BITE. If the restored half shows no downtime, an anchor
    // matched but did nothing and the "0 s" in the other half means nothing.
    if (down <= 0) fail.push(`${sc.key}: --breakdowns restored the schedule but NOTHING went out of service — the A/B baseline is not real`);
  } else {
    for (const row of r.rides) {
      if (row.outOfServiceSecs > 0)
        fail.push(`${sc.key}/${row.name}: out of service ${row.outOfServiceSecs} s — NO RIDE MAY BREAK DOWN`);
      const illegal = row.statuses.filter((s) => s.status !== 'open' && s.status !== 'closed');
      if (illegal.length) fail.push(`${sc.key}/${row.name}: handle.status() returned ${illegal.map((s) => s.status).join(', ')} — statusOf may only answer open/closed`);
      if (row.statuses.some((s) => s.status === 'closed'))
        fail.push(`${sc.key}/${row.name}: reported 'closed' — nothing crashed here, so a closed ride is a defect`);
      if (row.ridersServed <= 0) fail.push(`${sc.key}/${row.name}: served NOBODY in ${SECS} sim-s — the scenario is broken, so its zero downtime proves nothing`);
    }
    // ...and the knob must be ignored LOUDLY, exactly once per registration.
    if (sc.every !== undefined && ignoreWarns.length !== 1)
      fail.push(`${sc.key}: breakdownEvery=${sc.every} raised ${ignoreWarns.length} IGNORED warning(s), expected exactly 1 — a silently honoured or silently dropped knob both contradict the rule`);
    if (sc.every === undefined && ignoreWarns.length !== 0)
      fail.push(`${sc.key}: warned about breakdownEvery without being given one`);
  }
}

report.verdict = fail.length ? 'FAIL' : 'PASS';
report.failures = fail;
if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`\n=== VERDICT: ${report.verdict}`);
  fail.forEach((f) => console.log(`      - ${f}`));
  if (!fail.length && !LEGACY)
    console.log(
      `      ${SECS} sim-s x ${SCENARIOS.length} scenarios, status sampled every 1/30 s: 0.00 s out of service, ` +
        'including both rides that passed breakdownEvery.',
    );
}
process.exit(fail.length ? 1 : 0);
