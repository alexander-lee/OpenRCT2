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
// SETUP.md claimed `hill ~ 3.6` (it is 3.98-8.91, height-dependent), `lift ~
// height/0.55` (it is ~8.4 + 2.6h, so an h-1 lift eats ELEVEN units), and that a
// 360 helix "returns to its entry point" (only when height is 0).
//
// This probe measures all of it. Its numbers are what SETUP.md now publishes.
//
// TWO MEASUREMENT TRICKS worth knowing before reading the code:
//
//  1. You cannot read forward cost off `points[]`. The compiler CLOSES the
//     circuit, so the last point is always back at the station. The
//     displacement shows up instead in the U-turn straight it SYNTHESIZES to
//     get home — diff that against a straights-only baseline. Sanity check
//     built in: `straight 4` must measure exactly 4.00.
//
//  2. `report.closure.gap` is NOT a closure error. It reads a constant ~1.2 on
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

/** the synthesized return straight = forward displacement (+ a constant that cancels) */
const forward = (extra) => {
  const { report } = compile(['station', { type: 'straight', length: 2 }, ...extra,
    { type: 'straight', length: 2 }]);
  const s = (report.closure?.synthesized ?? []).find((x) => /^straight/.test(x) && !/brake/.test(x));
  return s ? parseFloat(s.split(' ')[1]) : NaN;
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
  ['lift 1', [{ type: 'lift', height: 1 }]],
  ['lift 3', [{ type: 'lift', height: 3 }]],
  ['lift 5', [{ type: 'lift', height: 5 }]],
  ['drop 3', [{ type: 'drop', height: 3 }]],
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
check(forward([{ type: 'helixR', angle: 360, height: 2 }]) - BASE > 5,
  'a CLIMBING 360 helix must NOT (SETUP.md asserted the unqualified claim twice)');
check(forward([{ type: 'lift', height: 1 }]) - BASE > 9,
  'a 1-unit lift really does cost ~11 u — the single most under-budgeted piece');

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
