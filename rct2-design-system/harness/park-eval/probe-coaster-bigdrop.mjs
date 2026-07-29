#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-coaster-bigdrop.mjs — DESIGN a BIG-DROP-PLUS-LOOP archetype, the one
// combination `probe-coaster-design.mjs` has never got past the derail guard.
//
// THE STANDING PROBLEM. Of the six candidates that probe grades, the ones with
// a real drop and a loop (4.0-D at drop 7, 4.0-H at drop 5.9) fail at maxLatG
// 3.23 and 3.40 against the 1.275 guard. The one that passes (4.0-L) buys its
// legality by shrinking the drop to 4.19. So the published set has "a loop" or
// "a big drop" and never both.
//
// WHY, from `SplineRideKit/ratings.ts` `replayCoasterForces` — this is the
// whole model, and it is short:
//
//     v      = sqrt(2 · (energy − 9.8 · y))        energy is set by maxY
//     latG   = v² · κ_h · (1 − |roll| / 0.6) / 9.8
//
// so the lateral load at a turn is set by **how far that turn sits BELOW the
// highest point on the circuit**, not by the drop height as such. The published
// idiom (lift → straight → turn → drop, four times round a rectangle) puts each
// turn at its own local crest, and those crests DESCEND: the last one in 4.0-D
// sits 3.95 u under maxY and eats 3.16 g of the measured 3.23.
//
// THE MOVE THIS PROBE TESTS. Climb ONCE, do all four turns on the top deck at
// a single height, and spend the whole height budget on ONE drop into the loop
// on the final side. Every turn is then at maxY, where v is the 1.4 floor and
// latG is nil, and the drop can be as big as the plot allows.
//
// Closure is solved, not guessed: `measure()` compiles each piece ALONE and
// reads its forward advance, so the rectangle's opposite sides are matched from
// the kit's own numbers (see the `mp3d-track-physics` note — a lift costs
// ~8.4 + 2.6h, far more than intuition suggests).
//
// Usage:
//   node probe-coaster-bigdrop.mjs                 # solve + grade the sweep
//   node probe-coaster-bigdrop.mjs --json
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

const JSON_OUT = process.argv.includes('--json');
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_bigdrop.ts');
fs.writeFileSync(
  ep,
  `
import { compileTrackPieces, rateCoaster, checkCoasterDesign, replayCoasterForces } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit'))};
export { compileTrackPieces, rateCoaster, checkCoasterDesign, replayCoasterForces };
`,
);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_bigdrop.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { compileTrackPieces, rateCoaster, checkCoasterDesign, replayCoasterForces } = await import(bundlePath);

const quiet = (fn) => {
  const w = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = w; }
};

// ---- HOW THE ANSWER WAS FOUND, and why it is a GRID and not a solver --------
// Two clever approaches failed before this dumb one worked, and both failures
// are worth keeping:
//
//  1. MEASURE EACH PIECE, THEN DO THE ALGEBRA. Compiling `['station', piece]`
//     and reading how far downrange it got is wrong: an open chain gets
//     auto-closed with a large invented U-turn, and that U-turn's own forward
//     reach is what you measure. It reported a lift at h=4 as 22.2 u, and every
//     rectangle built on it came out ~15 u out of square.
//  2. COORDINATE DESCENT ON `closure.gap`. Gap bottoms out near 1.2 even on a
//     PERFECT circuit — that residue is the brake tail, not an error — so the
//     search walks away from the answer. Switching the objective to the length
//     of the synthesized list got within ~3.4 u and then stalled in a local
//     minimum, still reporting "solved".
//
// The closing (B, C) pairs turn out to occupy a narrow band a long way from
// where any seed would put them (C ~ 15 when "station + a 6-u lift" intuits
// ~30), and there are only ~16 of them at 0.1-u resolution. A grid finds them
// in seconds and cannot converge to a lie. `report.closure.synthesized.length
// === 0` is the only closure test used — never `gap`.
const GUARD = 1.275;
const HALF = 63.3;
const START = [16.8, 0.55, -3.6];

/** the shape: climb once, three turns on the TOP DECK, one drop into a loop pair */
const mk = (h, r, rt, B, C, tail = 3) => [
  'station',
  { type: 'lift', height: h },
  { type: 'turnR', angle: 90, radius: rt },
  { type: 'straight', length: +B.toFixed(2) },
  { type: 'turnR', angle: 90, radius: rt },
  { type: 'straight', length: +C.toFixed(2) },
  { type: 'turnR', angle: 90, radius: rt },
  { type: 'drop', height: h },
  { type: 'loopR', radius: r },
  { type: 'straight', length: 2 },
  { type: 'loopL', radius: r },
  { type: 'straight', length: +tail.toFixed(2) },
  { type: 'turnR', angle: 90, radius: rt },
];

const grade = (pieces) => {
  const o = quiet(() => compileTrackPieces(pieces, { profile: 'coaster', type: 'steel', heading: 0, start: START, bounds: 128 }));
  const synth = o.report.closure?.synthesized ?? [];
  if (synth.length) return null; // not closed — nothing else is worth measuring
  const pts = o.points;
  const rating = quiet(() => rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 }));
  let dv = [];
  try {
    const d = quiet(() => checkCoasterDesign(pts, { type: 'steel', bank: 0.7 }));
    dv = (d?.violations ?? d?.failures ?? []).filter((v) => !/short(Drop|Length)/i.test(JSON.stringify(v)));
  } catch { /* the design check is advisory here; the gate below is not */ }
  const bb = pts.reduce(
    (a, q) => ({ x0: Math.min(a.x0, q[0]), x1: Math.max(a.x1, q[0]), z0: Math.min(a.z0, q[2]), z1: Math.max(a.z1, q[2]), y1: Math.max(a.y1, q[1]) }),
    { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, y1: -1e9 },
  );
  const why = [];
  if (!o.report.ok) why.push('report.ok false');
  if (o.report.fatal) why.push('FATAL');
  if (rating.maxLatG > GUARD) why.push(`latG ${rating.maxLatG.toFixed(2)} > ${GUARD}`);
  if (dv.length) why.push(`design ${JSON.stringify(dv).slice(0, 50)}`);
  if (Math.max(Math.abs(bb.x0), Math.abs(bb.x1), Math.abs(bb.z0), Math.abs(bb.z1)) > HALF) why.push('bbox outside the plot');
  const n2 = (v) => +Number(v).toFixed(2);
  return {
    ok: !why.length, why, pieces,
    E: n2(rating.excitement), I: n2(rating.intensity), N: n2(rating.nausea),
    inv: rating.inversions, latG: n2(rating.maxLatG), drop: n2(rating.highestDrop ?? rating.drop),
    bbox: `x[${n2(bb.x0)},${n2(bb.x1)}] z[${n2(bb.z0)},${n2(bb.z1)}] maxY ${n2(bb.y1)}`,
  };
};

const found = [];
for (const h of [5, 6, 7, 8]) {
  for (const r of [1.6, 2.0, 2.4]) {
    for (const rt of [2.5, 4, 6, 8, 10, 12, 14]) {
      let best = null;
      for (let C = 10; C <= 24; C += 0.1) {
        for (let B = 18; B <= 34; B += 0.5) {
          const g = grade(mk(h, r, rt, B, C));
          if (g && g.ok && (!best || g.E > best.E)) best = { ...g, h, r, rt, B: +B.toFixed(2), C: +C.toFixed(2) };
        }
      }
      if (best) found.push(best);
    }
  }
}

found.sort((a, b) => b.drop - a.drop || b.E - a.E);
console.log(`  BIG-DROP + LOOP: ${found.length} LEGAL circuit(s) out of the swept family\n`);
for (const f of found.slice(0, 12))
  console.log(`  h=${f.h} loop r=${f.r} turn r=${f.rt}  B ${f.B} C ${f.C}  drop ${f.drop}  E ${f.E}  I ${f.I}  N ${f.N}  inv ${f.inv}  latG ${f.latG}  ${f.bbox}`);

// THE PUBLISHED PRESET must still be the best thing this search can find. If a
// bigger legal drop shows up, promote it; if the preset stops being legal at
// all, that is a regression in the kit and this exits non-zero.
const PRESET = { h: 6, r: 1.6, rt: 2.5, B: 22.5, C: 15.1, drop: 5.99, latG: 1.23 };
const preset = grade(mk(PRESET.h, PRESET.r, PRESET.rt, PRESET.B, PRESET.C));
const okPreset = preset && preset.ok && Math.abs(preset.drop - PRESET.drop) < 0.05 && Math.abs(preset.latG - PRESET.latG) < 0.05;
console.log(`\n  COASTER_PRESETS.plunge: ${okPreset ? 'PASS' : 'FAIL'}` + (preset ? ` — drop ${preset.drop}, E ${preset.E}, I ${preset.I}, inv ${preset.inv}, latG ${preset.latG}` : ' — DOES NOT CLOSE'));
if (preset && !preset.ok) preset.why.forEach((w) => console.log(`      - ${w}`));
const better = found.filter((f) => f.drop > PRESET.drop + 0.05);
if (better.length) console.log(`  NOTE: ${better.length} legal circuit(s) now beat the preset's drop — biggest ${better[0].drop} (h=${better[0].h} r=${better[0].r} turn ${better[0].rt}). Consider promoting.`);
process.exit(okPreset ? 0 : 1);
