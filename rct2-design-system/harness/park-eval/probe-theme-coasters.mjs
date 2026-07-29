#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-theme-coasters.mjs — design ONE verified circuit per theme preset
// (fire · pirateBeach · steampunk · enchantedForest · neon) so that every
// themed world's coaster reads as THAT world's coaster instead of the same
// rounded rectangle five times.
//
// Compile-only. No browser, no GPU:  node probe-theme-coasters.mjs [stage]
//   stage = cost     the OLD instrument (contaminated for lift/drop/helix — see cost3)
//   stage = cost2    the same contamination, measured a second way
//   stage = cost3    THE HONEST COSTS: height-neutral lists. This is what SETUP.md publishes
//   stage = diag     where the lat-G spike sits (v, kappa_h, roll at the worst sample)
//   stage = diag2    why the two legal circuits are legal; how much drop a loop pair takes
//   stage = design   solve the five themed shapes for a CLEAN closure and rate them
//   stage = design2  the COMPACT alternative (one wide bottom turn) — rejected, thin margin
//   stage = design3  retune pass for the forest and neon shapes
//   stage = final    re-verify ONLY the published literals, FROM theme-coasters.final.json
//
// ⛔ EVERY published array is re-verified from its LITERAL form in a fresh
// process (`stage=final`). A 345-combination sweep once reported 17 passing
// circuits and its own best one re-compiled FATAL at maxLatG 1.82 — the sweep's
// bookkeeping was wrong, the compiler was not.
//
// THE LAW THAT MAKES A DRAMATIC CIRCUIT LEGAL (ratings.ts replayCoasterForces):
//     v = sqrt(2 · (energy − 9.8 · y))      energy is fixed by the circuit maxY
//     latG = v² · κ_h · (1 − |roll|/0.6) / 9.8
// A turn's lateral load is set by how far it sits BELOW maxY, not by the drop.
// So: TURN ON THE TOP DECK, spend the whole height in ONE drop, and put the
// inversions (low κ_h — they curve vertically) at the bottom.
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, REPO } from './paths.mjs';

const ctx2d = new Proxy({}, {
  get: (_t, k) =>
    k === 'canvas' ? { width: 8, height: 8 }
      : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} })
        : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(256) }) : () => {},
});
globalThis.document = {
  createElement: () => ({ width: 8, height: 8, getContext: () => ctx2d, toDataURL: () => '' }),
  createElementNS: () => ({ width: 8, height: 8, getContext: () => ctx2d }),
};
globalThis.window = globalThis;
globalThis.self = globalThis;

const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_theme-coasters.ts');
fs.writeFileSync(ep, `
import { compileTrackPieces, checkCoasterDesign, COASTER_PRESETS } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit'))};
import { rateCoaster, replayCoasterForces } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit/ratings'))};
import * as THREE from 'three';
export { compileTrackPieces, rateCoaster, checkCoasterDesign, COASTER_PRESETS, replayCoasterForces, THREE };
`);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bp = path.join(outDir, '_theme-coasters.bundle.mjs');
fs.writeFileSync(bp, res.outputFiles[0].text);
const { compileTrackPieces, rateCoaster, checkCoasterDesign, COASTER_PRESETS, replayCoasterForces, THREE } =
  await import(bp);

const LAT_GUARD = 1.275;
const SIZE = 128;
const base = { profile: 'coaster', heading: 0, bounds: SIZE };

// silence the compiler's own console.warn while sweeping
let quiet = false;
const realWarn = console.warn, realError = console.error;
console.warn = (...a) => { if (!quiet) realWarn(...a); };
console.error = (...a) => { if (!quiet) realError(...a); };

const st = (length) => ({ type: 'straight', length: +length.toFixed(2) });

/** the one true verification: compile, rate, design-check, report everything. */
function measure(pieces, o = {}) {
  const type = o.type ?? 'steel';
  const bank = o.bank ?? (type === 'wooden' ? 0.42 : 0.7);
  let out;
  try { out = compileTrackPieces(pieces, { ...base, type, start: o.start ?? [0, 0.55, 0], bank, ...o }); }
  catch (e) { return { threw: e.message, ok: false, syn: ['THREW'], synLen: 1e6 }; }
  const { points, report } = out;
  const g = rateCoaster(points, { type, bank, cars: o.cars ?? 3 });
  const d = checkCoasterDesign(points, { type, bank });
  const syn = (report.closure?.synthesized ?? []).filter((s) => !/brake/.test(s));
  // scalar closure error: straights count their length, turns their arc @ r 2.5
  const synLen = syn.reduce((a, s) => {
    const m = /^(straight|drop|lift)\s+([\d.]+)/.exec(s);
    if (m) return a + parseFloat(m[2]);
    const t = /(\d+)°/.exec(s);
    return a + (t ? (parseFloat(t[1]) / 57.2958) * 2.5 : 2);
  }, 0);
  const xs = points.map((p) => p[0]), zs = points.map((p) => p[2]), ys = points.map((p) => p[1]);
  const inBounds = points.every((p) => Math.abs(p[0]) <= 64.3 && Math.abs(p[2]) <= 64.3);
  const viol = (d.violations ?? []).map((v) => v.kind ?? v).join(',');
  const warnWeld = (report.warnings ?? []).some((w) => /lands on the station from a curve/.test(w));
  const ok = report.ok !== false && !report.fatal && g.maxLatG <= LAT_GUARD && !viol && inBounds;
  return {
    ok, g, report, syn, synLen, viol, inBounds, warnWeld, points,
    fp: `${(Math.max(...xs) - Math.min(...xs)).toFixed(1)} × ${(Math.max(...zs) - Math.min(...zs)).toFixed(1)} u, maxY ${Math.max(...ys).toFixed(2)}`,
  };
}

function show(name, pieces, o = {}) {
  const r = measure(pieces, o);
  if (r.threw) { console.log(`  \x1b[31mTHREW\x1b[0m ${name} — ${r.threw}`); return r; }
  const { g } = r;
  console.log(`  ${r.ok ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${name.padEnd(26)}`
    + ` E${g.excitement.toFixed(2).padStart(6)} I${g.intensity.toFixed(2).padStart(6)} N${g.nausea.toFixed(2).padStart(6)}`
    + ` lat${g.maxLatG.toFixed(2).padStart(5)} inv${String(g.inversions).padStart(2)} drop${g.highestDrop.toFixed(2).padStart(6)}`
    + ` | ${r.fp}`
    + `${r.report.fatal ? ' FATAL' : ''}${r.viol ? ' V:' + r.viol : ''}${r.inBounds ? '' : ' OOB'}`
    + `${r.warnWeld ? ' weld?' : ''} syn ${JSON.stringify(r.syn)}`);
  return r;
}

/** coordinate-descent scan over N free straight lengths; objective = synLen */
function solve(builder, params, o = {}) {
  let cur = params.map((p) => p.v);
  const score = (v) => { const r = measure(builder(v), o); return r.synLen + (r.report?.fatal ? 50 : 0); };
  let best = score(cur);
  for (const step of [2, 0.5, 0.1, 0.02]) {
    let moved = true, guard = 0;
    while (moved && guard++ < 60) {
      moved = false;
      for (let i = 0; i < cur.length; i++) {
        for (const d of [step, -step]) {
          const t = cur.slice(); t[i] = +(t[i] + d).toFixed(2);
          if (t[i] < params[i].min || t[i] > params[i].max) continue;
          const s = score(t);
          if (s < best - 1e-9) { best = s; cur = t; moved = true; }
        }
      }
    }
  }
  return { v: cur, synLen: best };
}

/** where does the lat-G spike sit, and how far below maxY? */
function whereLat(pieces, o = {}) {
  const type = o.type ?? 'steel';
  const bank = o.bank ?? (type === 'wooden' ? 0.42 : 0.7);
  const { points } = compileTrackPieces(pieces, { ...base, type, start: [0, 0.55, 0], bank, ...o });
  const rep = replayCoasterForces(THREE, points, { bank });
  const s = rep.samples.reduce((a, b) => (b.latAccel > a.latAccel ? b : a));
  return { at: s.u, lat: s.latAccel / 9.8, y: s.y, v: s.v, kH: s.kH, roll: s.roll,
    maxY: rep.maxY, below: rep.maxY - s.y };
}

const stage = process.argv[2] ?? 'design';

if (stage === 'design3') {
  quiet = true;
  const cost = (r, target) => {
    if (r.threw) return 1e6;
    const span = Math.max(...r.fp.match(/([\d.]+) × ([\d.]+)/).slice(1, 3).map(Number));
    return 60 * r.synLen + (r.report.fatal ? 400 : 0) + (r.viol ? 200 : 0)
      + (r.inBounds ? 0 : 500) + (r.warnWeld ? 60 : 0)
      + 60 * Math.max(0, r.g.maxLatG - 0.9) + 3.0 * Math.max(0, span - target)
      - 2 * r.g.excitement;
  };
  const opt = (build, init, bounds, o = {}, target = 36) => {
    let cur = init.slice(); let best = cost(measure(build(cur), o), target);
    for (const step of [4, 1, 0.25, 0.1]) {
      let moved = true, guard = 0;
      while (moved && guard++ < 80) { moved = false;
        for (let i = 0; i < cur.length; i++) for (const d of [step, -step]) {
          const t = cur.slice(); t[i] = +(t[i] + d).toFixed(2);
          if (t[i] < bounds[i][0] || t[i] > bounds[i][1]) continue;
          const c = cost(measure(build(t), o), target);
          if (c < best - 1e-9) { best = c; cur = t; moved = true; } } }
    }
    return cur.map((v) => +v.toFixed(1));
  };
  const run = (label, build, init, bounds, o = {}, target = 36) => {
    const v = opt(build, init, bounds, o, target);
    quiet = false; show(`${label} ${JSON.stringify(v)}`, build(v), o); quiet = true;
    return build(v);
  };

  console.log('\n  ENCHANTED FOREST — retune: wooden, four different corners, one camelback');
  console.log('  ' + '-'.repeat(112));
  for (const h of [3, 4]) for (const hh of [0.8, 1.2]) for (const nh of [1, 2]) {
    const build = (v) => ['station', st(v[0]), { type: 'lift', height: h },
      { type: 'turnR', angle: 105, radius: 5 },
      { type: 'sbend', length: 5, radius: 1.6 }, st(v[2]),
      { type: 'turnR', angle: 75, radius: 3.5 }, st(v[3]),
      { type: 'turnR', angle: 60, radius: 6 },
      { type: 'sbend', length: 5, radius: -1.6 }, st(v[4]),
      { type: 'turnR', angle: 120, radius: 4 }, st(v[1]),
      { type: 'drop', height: h },
      ...Array.from({ length: nh }, () => ({ type: 'hill', height: hh })), st(2)];
    run(`wood h${h} hill${hh}x${nh}`, build, [3, 3, 14, 14, 14],
      [[1, 10], [2, 12], [3, 34], [3, 34], [3, 34]], { type: 'wooden' }, 38);
  }

  console.log('\n  NEON — retune: the beat runs ALONG THE STREET (hills on the top deck)');
  console.log('  ' + '-'.repeat(112));
  for (const h of [3, 4]) for (const R of [2.5, 4]) for (const hh of [0.8, 1.2]) {
    const build = (v) => ['station', st(v[0]), { type: 'lift', height: h },
      { type: 'turnL', angle: 120, radius: R },
      { type: 'hill', height: hh }, st(v[2]),
      { type: 'turnL', angle: 120, radius: R },
      { type: 'hill', height: hh }, st(v[2]),
      { type: 'turnL', angle: 120, radius: R }, st(v[1]),
      { type: 'drop', height: h },
      { type: 'corkscrewL' }, st(2.4), { type: 'corkscrewR' }, st(2)];
    run(`neon h${h} R${R} hill${hh}`, build, [2, 3, 22],
      [[1, 10], [2, 12], [8, 44]], {}, 34);
  }
}

if (stage === 'design2') {
  quiet = true;
  // Can a park have BOTH a compact plan and a safe lateral margin? The mega-side
  // skeleton is safe (lat 0.2-0.5) but its plan diameter is >= station + lift +
  // drop + drama, which lands at 45-55 u. The shipped PLUNGE preset is 27.5 u
  // across but runs at 1.23 against the 1.275 guard — 4% margin.
  //
  // THE TEST: put the drop on the side BEFORE the last turn, make the last turn
  // WIDE, and give it a LONG straight run home so the bank is fully developed
  // through it (the earlier 2.18 g failures all had roll 0.2-0.35 because the
  // bottom turn sat right on the station weld, where the bank ramps out).
  const cost = (r, target) => {
    if (r.threw) return 1e6;
    const span = Math.max(...r.fp.match(/([\d.]+) × ([\d.]+)/).slice(1, 3).map(Number));
    return 40 * r.synLen + (r.report.fatal ? 400 : 0) + (r.viol ? 200 : 0)
      + (r.inBounds ? 0 : 500) + (r.warnWeld ? 60 : 0)
      + 60 * Math.max(0, r.g.maxLatG - 1.0) + 4.0 * Math.max(0, span - target);
  };
  const opt = (build, init, bounds, o = {}, target = 34) => {
    let cur = init.slice(); let best = cost(measure(build(cur), o), target);
    for (const step of [4, 1, 0.25, 0.1]) {
      let moved = true, guard = 0;
      while (moved && guard++ < 80) { moved = false;
        for (let i = 0; i < cur.length; i++) for (const d of [step, -step]) {
          const t = cur.slice(); t[i] = +(t[i] + d).toFixed(2);
          if (t[i] < bounds[i][0] || t[i] > bounds[i][1]) continue;
          const c = cost(measure(build(t), o), target);
          if (c < best - 1e-9) { best = c; cur = t; moved = true; } } }
    }
    return cur.map((v) => +v.toFixed(1));
  };
  console.log('\n  COMPACT variant — drop on the last-but-one side, ONE wide bottom turn, long run home');
  console.log('  ' + '-'.repeat(112));
  for (const h of [4, 5]) for (const RB of [4, 6, 8]) for (const lr of [1.8, 2.2]) {
    const build = (v) => ['station', st(v[0]), { type: 'lift', height: h },
      { type: 'turnR', angle: 60, radius: 3 }, st(v[2]),
      { type: 'turnR', angle: 60, radius: 3 }, st(v[3]),
      { type: 'turnR', angle: 60, radius: 3 }, st(v[3]),
      { type: 'turnR', angle: 60, radius: 3 }, st(v[2]),
      { type: 'turnR', angle: 60, radius: 3 }, st(v[1]),
      { type: 'drop', height: h }, { type: 'loopR', radius: lr }, st(2),
      { type: 'loopL', radius: lr }, st(2),
      { type: 'turnR', angle: 60, radius: RB }, st(v[4])];
    const v = opt(build, [2, 3, 8, 8, 14], [[1, 10], [2, 12], [3, 30], [3, 30], [4, 34]]);
    quiet = false;
    const r = show(`hex h${h} bottomR${RB} loop${lr} ${JSON.stringify(v)}`, build(v));
    if (r.ok) { const w = whereLat(build(v)); console.log(`        worst lat at u=${w.at.toFixed(3)} y ${w.y.toFixed(2)} v ${w.v.toFixed(2)} kH ${w.kH.toFixed(3)} roll ${w.roll.toFixed(2)}`); }
    quiet = true;
  }
}


if (stage === 'cost2') {
  // TRUE in-situ forward displacement: compile a straight-line list and read
  // the FARTHEST z reached. The closure's U-turn overshoot is a constant that
  // cancels in the diff. (The `synthesized straight` method used by
  // probe-track-cost.mjs DOUBLE-COUNTS a lift: it reports 25.18 for `lift 6`
  // where the shipped PLUNGE preset's own geometry says 12.5.)
  const reach = (extra) => {
    quiet = true;
    const { points } = compileTrackPieces(['station', st(2), ...extra, st(2)],
      { ...base, type: 'steel', start: [0, 0.55, 0], bounds: 256 });
    quiet = false;
    return Math.max(...points.map((p) => p[2]));
  };
  const B = reach([]);
  console.log('\n  TRUE forward displacement (max-z reach, baseline subtracted)');
  console.log('  ' + '-'.repeat(60));
  for (const [n, ex] of [
    ['straight 4', [st(4)]],
    ['straight 10', [st(10)]],
    ['lift 2', [{ type: 'lift', height: 2 }]],
    ['lift 3', [{ type: 'lift', height: 3 }]],
    ['lift 4', [{ type: 'lift', height: 4 }]],
    ['lift 5', [{ type: 'lift', height: 5 }]],
    ['lift 6', [{ type: 'lift', height: 6 }]],
    ['drop 4', [{ type: 'drop', height: 4 }]],
    ['drop 6', [{ type: 'drop', height: 6 }]],
    ['loopR 1.6', [{ type: 'loopR', radius: 1.6 }]],
    ['loopR 2.0', [{ type: 'loopR', radius: 2.0 }]],
    ['loopR 2.6', [{ type: 'loopR', radius: 2.6 }]],
    ['corkscrewR', [{ type: 'corkscrewR' }]],
    ['hill 0.8', [{ type: 'hill', height: 0.8 }]],
    ['hill 1.2', [{ type: 'hill', height: 1.2 }]],
    ['hill 2.0', [{ type: 'hill', height: 2.0 }]],
    ['helixR 360 h2', [{ type: 'helixR', angle: 360, height: 2 }]],
    ['helixR 360 h3', [{ type: 'helixR', angle: 360, height: 3 }]],
    ['helixR 360 h-2', [{ type: 'helixR', angle: 360, height: -2 }]],
    ['sbend 5 r1.6', [{ type: 'sbend', length: 5, radius: 1.6 }]],
  ]) {
    try { console.log(`  ${n.padEnd(16)} ${(reach(ex) - B).toFixed(2).padStart(8)}`); }
    catch { console.log(`  ${n.padEnd(16)}    THREW`); }
  }
}

if (stage === 'cost3') {
  // ⛔ BOTH earlier instruments were CONTAMINATED for lift/drop/climbing-helix.
  // When the authored list ends at a DIFFERENT HEIGHT from the station, the
  // Dubins closure has to insert its own `lift`/`drop` to get back down — and
  // that synthesized ramp travels FORWARD before the U-turn, so its run gets
  // added to whatever you were trying to measure. SETUP.md's `lift h ≈ 8.4 +
  // 2.6h` is therefore ~2× the truth: the shipped PLUNGE preset's own control
  // points advance only 12.6 u through its `lift 6`, not 25.18.
  //
  // The clean instrument: make the authored list HEIGHT-NEUTRAL (climb h, then
  // drop h) so the closure inserts no ramp, and halve the pair.
  const reach = (extra) => {
    quiet = true;
    const { points } = compileTrackPieces(['station', st(2), ...extra, st(2)],
      { ...base, type: 'steel', start: [0, 0.55, 0], bounds: 256 });
    quiet = false;
    return Math.max(...points.map((p) => p[2]));
  };
  const B = reach([]);
  console.log('\n  HEIGHT-NEUTRAL pairs — the honest lift/drop cost is HALF the published one');
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'pair'.padEnd(30)} ${'pair cost'.padStart(10)} ${'each'.padStart(8)} ${'SETUP.md says'.padStart(14)}`);
  for (const h of [1, 2, 3, 4, 5, 6]) {
    const pair = reach([{ type: 'lift', height: h }, st(4), { type: 'drop', height: h }]) - B - 4;
    console.log(`  ${`lift ${h} + drop ${h}`.padEnd(30)} ${pair.toFixed(2).padStart(10)}`
      + ` ${(pair / 2).toFixed(2).padStart(8)} ${(8.4 + 2.6 * h).toFixed(2).padStart(14)}`);
  }
  for (const h of [1, 2, 3, 4]) {
    const pair = reach([{ type: 'helixR', angle: 360, height: h }, st(4), { type: 'drop', height: h }]) - B - 4;
    const drop = (() => {
      const p = reach([{ type: 'lift', height: h }, st(4), { type: 'drop', height: h }]) - B - 4;
      return p / 2;
    })();
    console.log(`  ${`helixR 360 h${h} (+ drop ${h})`.padEnd(30)} ${pair.toFixed(2).padStart(10)}`
      + ` ${(pair - drop).toFixed(2).padStart(8)} ${'(helix alone)'.padStart(14)}`);
  }
  console.log('\n  height-NEUTRAL pieces need no correction — cross-check that they agree');
  console.log('  ' + '-'.repeat(76));
  for (const [n, ex] of [
    ['straight 10', [st(10)]],
    ['hill 1.2', [{ type: 'hill', height: 1.2 }]],
    ['loopR 2.0', [{ type: 'loopR', radius: 2.0 }]],
    ['corkscrewR', [{ type: 'corkscrewR' }]],
    ['sbend 5 r1.6', [{ type: 'sbend', length: 5, radius: 1.6 }]],
    ['helixR 360 h0', [{ type: 'helixR', angle: 360, height: 0 }]],
  ]) console.log(`  ${n.padEnd(30)} ${(reach(ex) - B).toFixed(2).padStart(10)}`);
}

if (stage === 'diag2') {
  const dump = (name, pieces, o = {}) => {
    quiet = true; const w = whereLat(pieces, o); const r = measure(pieces, o); quiet = false;
    console.log(`  ${name.padEnd(30)} lat ${w.lat.toFixed(2).padStart(5)} at u=${w.at.toFixed(3)}`
      + ` y ${w.y.toFixed(2)} (${w.below.toFixed(2)} below) v ${w.v.toFixed(2)} kH ${w.kH.toFixed(3)}`
      + ` roll ${w.roll.toFixed(2)}  inv ${r.g.inversions} syn ${JSON.stringify(r.syn)}`);
  };
  console.log('\n  the two circuits that ARE legal — what makes them legal?');
  console.log('  ' + '-'.repeat(112));
  dump('COASTER_PRESETS.plunge', COASTER_PRESETS.plunge.pieces, { start: COASTER_PRESETS.plunge.start });
  const sea = (h, R, v) => [
    'station', st(v[0]), { type: 'lift', height: h },
    { type: 'turnR', angle: 180, radius: R }, st(v[1]),
    { type: 'turnR', angle: 180, radius: R }, st(v[2]), { type: 'drop', height: h },
    { type: 'corkscrewR' }, st(2.4), { type: 'corkscrewL' }, st(2.5),
  ];
  dump('sea h5 R3 (solved)', sea(5, 3, [3, 50.28, 4]));

  console.log('\n  HOW MUCH DROP can a bottom loop pair take? (out-and-back, no bottom turn)');
  console.log('  ' + '-'.repeat(112));
  const seaLoop = (h, R, lr, mid, v) => [
    'station', st(v[0]), { type: 'lift', height: h },
    { type: 'turnR', angle: 180, radius: R }, st(v[1]),
    { type: 'turnR', angle: 180, radius: R }, st(v[2]), { type: 'drop', height: h },
    { type: 'loopR', radius: lr }, st(mid), { type: 'loopL', radius: lr }, st(2.5),
  ];
  for (const h of [3, 4, 5, 6]) for (const lr of [1.6, 2.0, 2.6]) {
    const bld = (v) => seaLoop(h, R_ = 3, lr, 2, v);
    const s = solve(bld, [{ v: 3, min: 1, max: 14 }, { v: 46, min: 20, max: 62 }, { v: 4, min: 1, max: 20 }]);
    quiet = false; dump(`seaLoop h${h} r${lr}`, bld(s.v)); quiet = true;
  }
  var R_;

  console.log('\n  and with a speed-bleeding HILL between the drop and the loops');
  console.log('  ' + '-'.repeat(112));
  const seaHillLoop = (h, lr, hh, v) => [
    'station', st(v[0]), { type: 'lift', height: h },
    { type: 'turnR', angle: 180, radius: 3 }, st(v[1]),
    { type: 'turnR', angle: 180, radius: 3 }, st(v[2]), { type: 'drop', height: h },
    { type: 'hill', height: hh },
    { type: 'loopR', radius: lr }, st(2), { type: 'loopL', radius: lr }, st(2.5),
  ];
  for (const h of [4, 5, 6]) for (const lr of [1.6, 2.0]) for (const hh of [1.2, 2.0]) {
    const bld = (v) => seaHillLoop(h, lr, hh, v);
    const s = solve(bld, [{ v: 3, min: 1, max: 14 }, { v: 46, min: 20, max: 62 }, { v: 4, min: 1, max: 20 }]);
    dump(`hill+loop h${h} r${lr} hill${hh}`, bld(s.v));
  }
}

if (stage === 'diag') {
  const R = 3, h = 4;
  const hexTop = (drama) => [
    'station', st(4), { type: 'lift', height: h },
    { type: 'turnR', angle: 60, radius: R }, st(20),
    { type: 'turnR', angle: 60, radius: R }, st(20),
    { type: 'turnR', angle: 60, radius: R }, st(20),
    { type: 'turnR', angle: 60, radius: R }, st(20),
    { type: 'turnR', angle: 60, radius: R },
    { type: 'drop', height: h }, ...drama,
    { type: 'turnR', angle: 60, radius: R }, st(2.5),
  ];
  const noTurn = (drama) => [
    'station', st(4), { type: 'lift', height: h },
    { type: 'turnR', angle: 60, radius: R }, st(20),
    { type: 'turnR', angle: 60, radius: R }, st(20),
    { type: 'turnR', angle: 60, radius: R }, st(20),
    { type: 'turnR', angle: 60, radius: R }, st(20),
    { type: 'turnR', angle: 60, radius: R }, st(20),
    { type: 'turnR', angle: 60, radius: R },
    { type: 'drop', height: h }, ...drama, st(2.5),
  ];
  console.log('\n  WHERE the lat-G spike sits — is it the bottom TURN or the drama?');
  console.log('  ' + '-'.repeat(96));
  for (const [n, p] of [
    ['hex, bottom turn, no drama', hexTop([])],
    ['hex, bottom turn, loop pair', hexTop([{ type: 'loopR', radius: 1.6 }, st(3), { type: 'loopL', radius: 1.6 }, st(3)])],
    ['hex, NO bottom turn, no drama', noTurn([])],
    ['hex, NO bottom turn, loop pair', noTurn([{ type: 'loopR', radius: 1.6 }, st(3), { type: 'loopL', radius: 1.6 }, st(3)])],
    ['hex, NO bottom turn, cork pair', noTurn([{ type: 'corkscrewR' }, st(2.4), { type: 'corkscrewL' }, st(3)])],
  ]) {
    quiet = true; const w = whereLat(p); quiet = false;
    console.log(`  ${n.padEnd(32)} lat ${w.lat.toFixed(2).padStart(5)} at u=${w.at.toFixed(3)}`
      + `  y ${w.y.toFixed(2)} (${w.below.toFixed(2)} below maxY)  v ${w.v.toFixed(2)}  kH ${w.kH.toFixed(3)}  roll ${w.roll.toFixed(2)}`);
  }
  console.log('\n  and the same question for the LOOP RADIUS at the foot of a big drop');
  console.log('  ' + '-'.repeat(96));
  for (const lr of [0.9, 1.2, 1.6, 2.0, 2.6]) {
    for (const off of [1.0, 1.2, 1.8]) {
      quiet = true;
      const w = whereLat(noTurn([{ type: 'loopR', radius: lr, offset: off }, st(3),
        { type: 'loopL', radius: lr, offset: off }, st(3)]));
      quiet = false;
      console.log(`  loop r${lr} offset${off}`.padEnd(34) + ` lat ${w.lat.toFixed(2).padStart(5)} at u=${w.at.toFixed(3)} y ${w.y.toFixed(2)} v ${w.v.toFixed(2)} kH ${w.kH.toFixed(3)} roll ${w.roll.toFixed(2)}`);
    }
  }
}

// ===========================================================================
if (stage === 'cost') {
  const fwd = (extra) => {
    const { report } = compileTrackPieces(['station', st(2), ...extra, st(2)],
      { ...base, type: 'steel', start: [0, 0.55, 0], bounds: 256 });
    const s = (report.closure?.synthesized ?? []).find((x) => /^straight/.test(x) && !/brake/.test(x));
    return s ? parseFloat(s.split(' ')[1]) : NaN;
  };
  const B = fwd([]);
  console.log('\n  EXACT forward cost of the blocks used below');
  console.log('  ' + '-'.repeat(60));
  for (const [n, ex] of [
    ['straight 4', [st(4)]],
    ['lift 3', [{ type: 'lift', height: 3 }]],
    ['lift 4', [{ type: 'lift', height: 4 }]],
    ['lift 5', [{ type: 'lift', height: 5 }]],
    ['lift 6', [{ type: 'lift', height: 6 }]],
    ['drop 3', [{ type: 'drop', height: 3 }]],
    ['drop 4', [{ type: 'drop', height: 4 }]],
    ['drop 5', [{ type: 'drop', height: 5 }]],
    ['drop 6', [{ type: 'drop', height: 6 }]],
    ['loopR 1.6', [{ type: 'loopR', radius: 1.6 }]],
    ['loopR 2.0', [{ type: 'loopR', radius: 2.0 }]],
    ['loopR 2.6', [{ type: 'loopR', radius: 2.6 }]],
    ['corkscrewR', [{ type: 'corkscrewR' }]],
    ['hill 0.8', [{ type: 'hill', height: 0.8 }]],
    ['hill 1.2', [{ type: 'hill', height: 1.2 }]],
    ['helixR 360 h2', [{ type: 'helixR', angle: 360, height: 2 }]],
    ['helixR 360 h3', [{ type: 'helixR', angle: 360, height: 3 }]],
    ['helixR 360 h-3', [{ type: 'helixR', angle: 360, height: -3 }]],
    ['helixR 180 h2', [{ type: 'helixR', angle: 180, height: 2 }]],
    ['sbend 5 r1.6', [{ type: 'sbend', length: 5, radius: 1.6 }]],
    ['sbend 5 r-1.6', [{ type: 'sbend', length: 5, radius: -1.6 }]],
  ]) {
    try { console.log(`  ${n.padEnd(16)} ${(fwd(ex) - B).toFixed(2).padStart(8)}`); }
    catch (e) { console.log(`  ${n.padEnd(16)}    THREW`); }
  }
  console.log('\n  the shipped PLUNGE preset, for calibration');
  console.log('  ' + '-'.repeat(60));
  show('COASTER_PRESETS.plunge', COASTER_PRESET_pieces());
  function COASTER_PRESET_pieces() { return COASTER_PRESETS.plunge.pieces; }
}

// ===========================================================================
if (stage === 'design') {
  quiet = true;

  // ---- THE SKELETON, derived from the two circuits that measured legal -----
  // ONE MEGA-SIDE carries the whole ride: the station sits in the MIDDLE of a
  // straight side, the lift climbs FORWARD off it, every turn happens on the
  // top deck, and the plunge comes back down the SAME LINE into the station.
  // There is NO TURN between the drop and the station, which is what keeps the
  // lateral load off the fast part of the circuit. Sides 1..N-1 are plain
  // top-deck straights and are what the solver is allowed to move.
  //
  //   station, st(a), lift h, [turn] st(s1) [turn] ... [turn], st(g),
  //   drop h, <drama>, st(tail)
  //
  // Closure: N equal turns of 360/N; the side TOTALS must satisfy
  // sum(T_k * dir_k) = 0. Even N: opposite sides equal. Odd N: all equal (or a
  // second-harmonic set). The solver finds it; `final` re-proves it.

  const skeleton = ({ n, angle, R, dir = 'turnR', h, a, g, drama, tail, sides, pre = [], climb }) => {
    const p = ['station', st(a), ...(climb ?? [{ type: 'lift', height: h }])];
    for (let i = 0; i < n; i++) {
      p.push({ type: dir, angle: angle ?? 360 / n, radius: R });
      if (i < n - 1) { if (pre[i]) p.push(...pre[i]); p.push(st(sides[i])); }
    }
    p.push(st(g), { type: 'drop', height: h }, ...drama, st(tail));
    return p;
  };

  /** minimise closure error first, then footprint and lateral load */
  const cost = (r, target) => {
    if (r.threw) return 1e6;
    const span = Math.max(...r.fp.match(/([\d.]+) × ([\d.]+)/).slice(1, 3).map(Number));
    return 40 * r.synLen + (r.report.fatal ? 400 : 0) + (r.viol ? 200 : 0)
      + (r.inBounds ? 0 : 500) + (r.warnWeld ? 60 : 0)
      + 60 * Math.max(0, r.g.maxLatG - 1.1) + 4.0 * Math.max(0, span - target);
  };
  const opt = (build, init, bounds, o = {}, target = 40) => {
    let cur = init.slice();
    let best = cost(measure(build(cur), o), target);
    for (const step of [4, 1, 0.25, 0.1]) {
      let moved = true, guard = 0;
      while (moved && guard++ < 80) {
        moved = false;
        for (let i = 0; i < cur.length; i++) for (const d of [step, -step]) {
          const t = cur.slice(); t[i] = +(t[i] + d).toFixed(2);
          if (t[i] < bounds[i][0] || t[i] > bounds[i][1]) continue;
          const c = cost(measure(build(t), o), target);
          if (c < best - 1e-9) { best = c; cur = t; moved = true; }
        }
      }
    }
    return cur.map((v) => +v.toFixed(1));
  };

  const run = (label, build, init, bounds, o = {}, target = 40) => {
    const v = opt(build, init, bounds, o, target);
    quiet = false;
    const r = show(`${label} ${JSON.stringify(v)}`, build(v), o);
    quiet = true;
    return { v, r, pieces: build(v) };
  };

  const RESULT = {};

  /** skeleton with per-corner turn angles (they must SUM to 360) */
  const shape = ({ turns, R, h, a, g, drama, tail, sides, pre = [], climb, dir = 'turnR' }) => {
    const p = ['station', st(a), ...(climb ?? [{ type: 'lift', height: h }])];
    turns.forEach((ang, i) => {
      p.push({ type: Array.isArray(dir) ? dir[i] : dir, angle: ang, radius: Array.isArray(R) ? R[i] : R });
      if (i < turns.length - 1) { if (pre[i]) p.push(...pre[i]); p.push(st(sides[i])); }
    });
    p.push(st(g), { type: 'drop', height: h }, ...drama, st(tail));
    return p;
  };

  // ---- 1. FIRE — the caldera rim -----------------------------------------
  console.log('\n  FIRE — hexagon rim round the cone, one full-height plunge into a twin loop');
  console.log('  ' + '-'.repeat(112));
  for (const h of [4, 5]) for (const lr of [1.8, 2.2]) for (const R of [3, 4]) {
    const build = (v) => shape({
      turns: [60, 60, 60, 60, 60, 60], R, h, a: v[0], g: v[1], tail: 2.6,
      sides: [v[2], v[3], v[4], v[3], v[2]],
      drama: [{ type: 'loopR', radius: lr }, st(2), { type: 'loopL', radius: lr }, st(2)],
    });
    RESULT[`fire h${h} loop${lr} R${R}`] = run(`fire h${h} loop${lr} R${R}`, build,
      [2, 3, 8, 8, 8], [[1, 10], [2, 12], [3, 30], [3, 30], [3, 30]], {}, 34);
  }

  // ---- 2. PIRATE BEACH — the pier ----------------------------------------
  console.log('\n  PIRATE BEACH — 2 × turnR 180, a pier out over the water and back');
  console.log('  ' + '-'.repeat(112));
  for (const h of [4, 5]) for (const R of [3, 4, 5]) {
    const build = (v) => shape({
      turns: [180, 180], R, h, a: v[0], g: v[1], tail: 2.5, sides: [v[2]],
      drama: [{ type: 'corkscrewR' }, st(2.4), { type: 'corkscrewL' }, st(3)],
    });
    RESULT[`sea h${h} R${R}`] = run(`sea h${h} R${R}`, build,
      [3, 3, 40], [[1, 10], [2, 12], [20, 56]], {}, 46);
  }

  // ---- 3. STEAMPUNK — the cog + the spiral tower -------------------------
  console.log('\n  STEAMPUNK — octagon cog, the climb bought by a ZERO-COST helix tower');
  console.log('  ' + '-'.repeat(112));
  for (const h of [4, 5]) for (const R of [2.5, 3.5]) {
    const build = (v) => shape({
      turns: [45, 45, 45, 45, 45, 45, 45, 45], R, dir: 'turnL', h, a: v[0], g: v[1], tail: 2.6,
      climb: [{ type: 'helixL', angle: 360, height: h }],
      sides: [v[2], v[3], v[4], v[5], v[4], v[3], v[2]],
      drama: [{ type: 'hill', height: 1.2 }, st(2)],
    });
    RESULT[`cog h${h} R${R}`] = run(`cog h${h} R${R}`, build,
      [3, 3, 6, 6, 6, 6], [[1, 10], [2, 12], [3, 22], [3, 22], [3, 22], [3, 22]], {}, 34);
  }

  // ---- 4. ENCHANTED FOREST — the wandering trestle -----------------------
  // FOUR DIFFERENT TURN ANGLES, so no two corners of the plan match: the shape
  // itself reads as a path that wandered rather than a layout that was set out.
  // WOODEN track — no inversion is legal on it and the bank limit is 25°, so
  // this land's character is PLAN and AIRTIME.
  // ⛔ `helixR { height: -2 }` DOES NOT DESCEND — measured, it climbs 2 and the
  // compiler synthesizes `lift 2.00` to get home. `drop` is the only way down.
  console.log('\n  ENCHANTED FOREST — wooden, four DIFFERENT corners, sbend chicanes, camelbacks');
  console.log('  ' + '-'.repeat(112));
  for (const h of [3, 4]) for (const hh of [0.8, 1.2]) for (const RS of [[5, 3.5, 6, 4], [4, 3, 5, 3.5]]) {
    const build = (v) => shape({
      turns: [105, 75, 60, 120], R: RS, h, a: v[0], g: v[1], tail: 2.6,
      sides: [v[2], v[3], v[4]],
      pre: [[{ type: 'sbend', length: 5, radius: 1.6 }], [], [{ type: 'sbend', length: 5, radius: -1.6 }]],
      drama: [{ type: 'hill', height: hh }, { type: 'hill', height: hh }, st(2)],
    });
    RESULT[`wood h${h} hill${hh} R${RS[0]}`] = run(`wood h${h} hill${hh} R${RS[0]}`, build,
      [3, 3, 10, 10, 10], [[1, 10], [2, 12], [3, 34], [3, 34], [3, 34]], { type: 'wooden' }, 36);
  }

  // ---- 5. NEON — the bassline --------------------------------------------
  console.log('\n  NEON — a triangle; drop, a chain of equal hills for the beat, then the spin');
  console.log('  ' + '-'.repeat(112));
  for (const h of [3, 4]) for (const R of [3, 4]) for (const hh of [0.8, 1.2]) for (const nh of [1, 2]) {
    const build = (v) => shape({
      turns: [120, 120, 120], R, dir: 'turnL', h, a: v[0], g: v[1], tail: 2.6, sides: [v[2], v[2]],
      drama: [...Array.from({ length: nh }, () => ({ type: 'hill', height: hh })),
        { type: 'corkscrewL' }, st(2.4), { type: 'corkscrewR' }, st(2)],
    });
    RESULT[`neon h${h} R${R} hill${hh}x${nh}`] = run(`neon h${h} R${R} hill${hh}x${nh}`, build,
      [2, 3, 30], [[1, 10], [2, 12], [14, 50]], {}, 36);
  }

  fs.writeFileSync(path.join(HERE, 'out', 'theme-coasters.candidates.json'),
    JSON.stringify(Object.fromEntries(Object.entries(RESULT).map(([k, x]) => [k, x.pieces])), null, 1));
  console.log('\n  candidates written to out/theme-coasters.candidates.json\n');
}

// ===========================================================================
if (stage === 'final') {
  const FINAL = JSON.parse(fs.readFileSync(path.join(HERE, 'theme-coasters.final.json'), 'utf8'));
  console.log('\n  RE-VERIFY THE PUBLISHED LITERALS — fresh process, literal arrays');
  console.log('  ' + '-'.repeat(112));
  let bad = 0;
  for (const [name, spec] of Object.entries(FINAL)) {
    const r = show(name, spec.pieces, spec.opts ?? {});
    if (!r.ok || r.synLen > 0.01) bad++;   // syn MUST be []
  }
  console.log('  ' + '-'.repeat(112));
  console.log(bad ? `  \x1b[31m${bad} FAILED\x1b[0m\n` : '  \x1b[32mall five published circuits verify clean\x1b[0m\n');
  process.exit(bad ? 1 : 0);
}
