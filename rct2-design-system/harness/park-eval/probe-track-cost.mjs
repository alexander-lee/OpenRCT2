#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-track-cost.mjs — what does each track piece COST, and what makes an
// authored circuit close?
//
// WHY THIS EXISTS. A generated park lost all 8 thrill points to one line:
//   "the synthesized closure is 24.6 u — 46% of the 53.5 u authored (limit 40%)"
// `design.ok` was true. The physics were fine. The circuit simply never came
// back. Nothing in the published material explained how to make one close, and
// the guidance that did exist about piece costs was guessed, not measured —
// SETUP.md claimed `hill ~ 3.6` (it is 3.98-8.91, height-dependent) and
// `lift ~ height/0.55`.
//
// THEN THIS PROBE GOT TWO OF ITS OWN NUMBERS WRONG, and the correction is the
// most useful thing in this file. Its first instrument measured the closure's
// synthesized return straight, which silently includes the RAMP the closure
// invents whenever the authored list ends off-level. So:
//   - `lift h` was published as `8.4 + 2.6h`. That is a lift AND its matching
//     drop TOGETHER. One ramp is 5.48 @1 · 7.86 @2 · 10.0 @4 · 12.6 @6.
//   - a climbing 360 helix was published as displacing 5.48/7.86/10.0 at
//     h 1/2/4. Those are exactly the one-ramp costs above, because that is what
//     was being measured. A climbing helix DOES return to its entry point —
//     cost 0 at any height. (`helixR { height: -2 }` still climbs; there is no
//     descending helix.)
//
// THREE MEASUREMENT TRICKS worth knowing before reading the code:
//
//  1. You cannot read forward cost off the last point — the compiler CLOSES the
//     circuit, so it is always back at the station. Use the z-EXTENT.
//
//  2. Any piece that ends at a different HEIGHT than it started contaminates the
//     reading with the closure's ramp home. Read those LEVEL. See `forward`.
//
//  3. `report.closure.gap` is NOT a closure error. It reads a constant ~1.2 on
//     a perfect circuit because it is the brake tail. The honest signal is
//     `report.closure.synthesized` — the list of pieces the compiler invented.
//     `[]` is a clean close.
//
// Run headless, no browser, no GPU:  node probe-track-cost.mjs
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
const ep = path.join(outDir, '_track-cost.ts');
fs.writeFileSync(ep, `
import { compileTrackPieces } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit'))};
import { rateCoaster } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit/ratings'))};
export { compileTrackPieces, rateCoaster };
`);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bp = path.join(outDir, '_track-cost.bundle.mjs');
fs.writeFileSync(bp, res.outputFiles[0].text);
const { compileTrackPieces, rateCoaster } = await import(bp);

const OPTS = { profile: 'coaster', type: 'steel', heading: 0, start: [0, 0.55, 0], bounds: 256 };
const compile = (pieces, o = {}) => compileTrackPieces(pieces, { ...OPTS, ...o });

/**
 * Forward cost, measured as the compiled curve's z-EXTENT.
 *
 * ⚠ THIS INSTRUMENT IS CONTAMINATED FOR ANY PIECE THAT ENDS AT A DIFFERENT
 * HEIGHT THAN IT STARTED, and the first version of this probe published two
 * wrong numbers because of it. When the authored list ends off-level the closure
 * inserts its OWN ramp home, and that ramp's forward run lands in the reading.
 *
 * Proof, from this file's own output: `drop 2` alone reads 15.73 while
 * `helix 360 h2 -> drop 2` reads 7.86. Adding a real 2-unit drop after the helix
 * costs ZERO extra, because the closure was already paying for that ramp — so
 * 15.73 is TWO ramps (the drop's, plus the closure lifting back up) and one ramp
 * at h 2 is 7.86. The helix contributes nothing.
 *
 * So: for a height-CHANGING piece, always end the list level (pair a lift with a
 * drop, or follow a climbing helix with a matching drop) and attribute the cost
 * to the ramp, not to the piece that moved you.
 */
const forward = (extra) => {
  const { points } = compile(['station', { type: 'straight', length: 2 }, ...extra,
    { type: 'straight', length: 2 }]);
  const zs = points.map((p) => p[2]);
  return Math.max(...zs) - Math.min(...zs);
};
/** the synthesized TURN pair — an even 180/180 means no lateral drift */
const lateral = (extra) => {
  const { report } = compile(['station', { type: 'straight', length: 2 }, ...extra,
    { type: 'straight', length: 2 }]);
  return (report.closure?.synthesized ?? []).filter((x) => /turn/.test(x)).join(' ');
};

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log(`  \x1b[31mFAIL\x1b[0m ${msg}`); } };

const BASE = forward([]);
check(Math.abs(forward([{ type: 'straight', length: 4 }]) - BASE - 4) < 0.02,
  'the instrument itself: `straight 4` must measure 4.00');

console.log('\n  FORWARD COST — units consumed along the heading');
console.log('  ' + '-'.repeat(60));
for (const [name, ex] of [
  ['straight 4', [{ type: 'straight', length: 4 }]],
  ['hill 0.4', [{ type: 'hill', height: 0.4 }]],
  ['hill 0.8', [{ type: 'hill', height: 0.8 }]],
  ['hill 1.2', [{ type: 'hill', height: 1.2 }]],
  ['hill 2.0', [{ type: 'hill', height: 2.0 }]],
  // height-changing pieces MUST be read level — see `forward`'s note. These
  // pairs read as ONE ramp each, which is the honest per-ramp cost.
  ['lift 1 + drop 1', [{ type: 'lift', height: 1 }, { type: 'drop', height: 1 }]],
  ['lift 2 + drop 2', [{ type: 'lift', height: 2 }, { type: 'drop', height: 2 }]],
  ['lift 4 + drop 4', [{ type: 'lift', height: 4 }, { type: 'drop', height: 4 }]],
  ['lift 6 + drop 6', [{ type: 'lift', height: 6 }, { type: 'drop', height: 6 }]],
  ['helix h2 + drop 2', [{ type: 'helixR', angle: 360, height: 2 }, { type: 'drop', height: 2 }]],
  ['loop r1.4', [{ type: 'loop', radius: 1.4 }]],
  ['loop r1.8', [{ type: 'loop', radius: 1.8 }]],
  ['loop r2.2', [{ type: 'loop', radius: 2.2 }]],
  ['corkscrewR', [{ type: 'corkscrewR' }]],
  ['sbend len 4', [{ type: 'sbend', length: 4, radius: 1.5 }]],
  ['helix 360 h0', [{ type: 'helixR', angle: 360, height: 0 }]],
  ['helix 360 h2', [{ type: 'helixR', angle: 360, height: 2 }]],
  ['helix 720 h2', [{ type: 'helixR', angle: 720, height: 2 }]],
]) {
  try { console.log(`  ${name.padEnd(16)} ${(forward(ex) - BASE).toFixed(2).padStart(7)}`); }
  catch { console.log(`  ${name.padEnd(16)}   THREW`); }
}
check(Math.abs(forward([{ type: 'helixR', angle: 360, height: 0 }]) - BASE) < 0.02,
  'a FLAT 360 helix must return to its entry point');
// A CLIMBING helix also returns to its entry point — cost 0 at any height. Read
// it with the circuit ending LEVEL or the closure's ramp is charged to the helix.
check(Math.abs(forward([{ type: 'helixR', angle: 360, height: 2 }, { type: 'drop', height: 2 }])
  - forward([{ type: 'drop', height: 2 }, { type: 'helixR', angle: 360, height: 2 }])) < 0.05,
  'a CLIMBING 360 helix costs the same whichever side of its matching drop it sits — i.e. 0');
check(Math.abs(forward([{ type: 'drop', height: 2 }]) - BASE
  - 2 * (forward([{ type: 'helixR', angle: 360, height: 2 }]) - BASE)) < 0.1,
  'a lone drop reads as TWO ramps (its own + the closure lifting back) — the contamination itself');

console.log('\n  LATERAL DRIFT — an even 180/180 means the piece stayed on its line');
console.log('  ' + '-'.repeat(60));
for (const [name, ex] of [
  ['(baseline)', []],
  ['loopR', [{ type: 'loopR', radius: 1.8 }]],
  ['loopL', [{ type: 'loopL', radius: 1.8 }]],
  ['loopR + loopL', [{ type: 'loopR', radius: 1.8 }, { type: 'straight', length: 6 }, { type: 'loopL', radius: 1.8 }]],
  ['sbend 4', [{ type: 'sbend', length: 4, radius: 1.5 }]],
  ['corkscrewR', [{ type: 'corkscrewR' }]],
  ['lift 3', [{ type: 'lift', height: 3 }]],
]) {
  try { console.log(`  ${name.padEnd(16)} ${lateral(ex)}`); } catch { console.log(`  ${name.padEnd(16)} THREW`); }
}
check(lateral([{ type: 'loopR', radius: 1.8 }]) !== lateral([]),
  'a lone loop must show lateral drift (its `offset`, default 1.2)');
check(lateral([{ type: 'loopR', radius: 1.8 }, { type: 'straight', length: 6 },
  { type: 'loopL', radius: 1.8 }]) === lateral([]),
  'loopR + loopL must CANCEL — this is how you keep an inversion in a closed polygon');

console.log('\n  CLOSURE — a balanced polygon synthesizes NOTHING');
console.log('  ' + '-'.repeat(60));
const ngon = (n, side, R, dir = 'turnR') => {
  const p = ['station', { type: 'straight', length: +(side - 2.6).toFixed(2) },
    { type: dir, angle: 360 / n, radius: R }];
  for (let i = 1; i < n; i++) p.push({ type: 'straight', length: side }, { type: dir, angle: 360 / n, radius: R });
  return p;
};
const shape = (name, pieces) => {
  const { points, report } = compile(pieces, { bounds: 128 });
  const g = rateCoaster(points, { type: 'steel', bank: 0.7, cars: 3 });
  const syn = report.closure?.synthesized ?? [];
  console.log(`  ${name.padEnd(30)} fatal ${(report.fatal ? 'YES' : 'no ')}  latG ${g.maxLatG.toFixed(2)}  synth ${JSON.stringify(syn)}`);
  return { report, syn };
};
// the station is a SIDE, not a prologue: N turns need N sides
const clean = [
  ['pentagon 5x72 side 8', ngon(5, 8, 2.5)],
  ['hexagon  6x60 side 7', ngon(6, 7, 2.5)],
  ['octagon  8x45 side 5', ngon(8, 5, 2.5, 'turnL')],
  ['rectangle 4x90 side 8', ngon(4, 8, 2.5)],
];
for (const [n, p] of clean) {
  const { report, syn } = shape(n, p);
  check(!report.fatal && syn.length === 0, `${n} must close with NO synthesized track`);
}
const unbal = ngon(6, 7, 2.5); unbal[1] = { type: 'straight', length: 14 };
const u = shape('the same hex, ONE side x2', unbal);
check(!!u.report.fatal, 'unbalancing one side MUST go fatal (else the rule is vacuous)');

console.log('\n  ' + '-'.repeat(60));
if (failures) { console.log(`  \x1b[31m${failures} check(s) FAILED\x1b[0m — SETUP.md's published numbers may be stale\n`); process.exit(1); }
console.log("  \x1b[32mall checks passed\x1b[0m — SETUP.md's published costs still hold\n");
