#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-coaster-sweep.mjs — SEARCH for a loop-bearing archetype that PASSES
//
// probe-coaster-design.mjs proved the instrument (both published controls
// reproduce exactly) and that four hand-authored loop layouts FAIL: deep drops
// into a 2.5-u turn push maxLatG to 3.2-3.5 against the 1.275 guard, and the
// ring self-intersects because a `loop` consumes ~no forward distance.
//
// So do not hand-author. Start from §4.0-C — which PASSES — and make the
// SMALLEST possible edit: substitute a `loop` for one corkscrew, then sweep the
// compensating straight length and the loop radius. Report every variant that
// clears every gate.
//
// Usage:  node probe-coaster-sweep.mjs [--top=12]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
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

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split('=').slice(1).join('=') : d;
};
const TOP = Number(arg('top', '12'));
const SIZE = 128, HALF = SIZE / 2 + 0.3, LAT_GUARD = 1.275;
const START = [16.8, 0.55, -3.6];

const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_coaster-sweep.ts');
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
const bp = path.join(outDir, '_coaster-sweep.bundle.mjs');
fs.writeFileSync(bp, res.outputFiles[0].text);
const { compileTrackPieces, rateCoaster } = await import(bp);

/** §4.0-C with the FIRST inversion swapped for `loop`, parameterised.
 *  s1 compensates the forward distance a loop does not consume;
 *  lift1/drop1 set the entry speed into the loop. */
const variant = ({ r, s1, lift1, second }) => ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 5.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'straight', length: 2.72 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: lift1 }, { type: 'loop', radius: r }, { type: 'straight', length: s1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: lift1 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: second }, { type: 'straight', length: 2.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'straight', length: 1.5 }];

const rows = [];
for (const r of [1.4, 1.6, 1.8, 2.0, 2.2]) {
  for (const s1 of [2.0, 3.0, 4.0, 5.0, 6.0, 6.4]) {
    for (const lift1 of [3.6, 4.2, 4.8]) {
      for (const second of ['corkscrewR', 'corkscrewL']) {
        const pieces = variant({ r, s1, lift1, second });
        try {
          const { points, report } = compileTrackPieces(pieces, {
            profile: 'coaster', type: 'steel', heading: 0, start: START, bounds: SIZE,
          });
          const g = rateCoaster(points, { type: 'steel', bank: 0.7, cars: 3 });
          const synth = report.synthesizedCount ?? report.synthesized ?? 0;
          const bb = points.reduce((a, p) => ({
            mnX: Math.min(a.mnX, p[0]), mxX: Math.max(a.mxX, p[0]),
            mnZ: Math.min(a.mnZ, p[2]), mxZ: Math.max(a.mxZ, p[2]), mxY: Math.max(a.mxY, p[1]),
          }), { mnX: 1e9, mxX: -1e9, mnZ: 1e9, mxZ: -1e9, mxY: -1e9 });
          const inB = Math.max(Math.abs(bb.mnX), Math.abs(bb.mxX), Math.abs(bb.mnZ), Math.abs(bb.mxZ)) <= HALF;
          const ok = report.ok && !report.fatal && synth === 0 && g.maxLatG <= LAT_GUARD
            && (g.inversions ?? 0) >= 2 && inB;
          rows.push({ ok, r, s1, lift1, second, E: g.excitement, I: g.intensity, N: g.nausea,
            inv: g.inversions, latG: g.maxLatG, drop: g.highestDrop, synth,
            fatal: !!report.fatal, okc: report.ok, inB,
            bbox: `x[${bb.mnX.toFixed(1)},${bb.mxX.toFixed(1)}] z[${bb.mnZ.toFixed(1)},${bb.mxZ.toFixed(1)}] y${bb.mxY.toFixed(1)}` });
        } catch (e) { rows.push({ ok: false, r, s1, lift1, second, threw: String(e.message).slice(0, 60) }); }
      }
    }
  }
}

const pass = rows.filter((x) => x.ok).sort((a, b) => b.E - a.E);
const r2 = (v) => (typeof v === 'number' ? +v.toFixed(2) : v);
console.log('');
console.log(`  SWEEP: ${rows.length} variants of §4.0-C with a LOOP substituted · ${pass.length} PASS every gate`);
console.log('  (gates: report.ok · not fatal · 0 synthesized · maxLatG <= 1.275 · inversions >= 2 · in bounds)');
console.log('  ' + '-'.repeat(100));
if (!pass.length) {
  const near = rows.filter((x) => typeof x.latG === 'number').sort((a, b) => a.latG - b.latG).slice(0, 8);
  console.log('  NONE passed. The 8 closest on lateral G:');
  near.forEach((x) => console.log(`    r ${x.r} s1 ${x.s1} lift ${x.lift1} ${x.second}: latG ${r2(x.latG)} E ${r2(x.E)} I ${r2(x.I)} inv ${x.inv} ok ${x.okc} fatal ${x.fatal} synth ${x.synth} inB ${x.inB}`));
} else {
  console.log('  rank  loopR  str   lift  2nd inv    E      I      N    latG   drop   bbox');
  pass.slice(0, TOP).forEach((x, i) => console.log(
    `  ${String(i + 1).padStart(4)}  ${String(x.r).padStart(5)}  ${String(x.s1).padStart(4)}  ${String(x.lift1).padStart(4)}  ${x.second === 'corkscrewR' ? ' R' : ' L'}  ${String(x.inv).padStart(2)}  ${String(r2(x.E)).padStart(5)}  ${String(r2(x.I)).padStart(5)}  ${String(r2(x.N)).padStart(5)}  ${String(r2(x.latG)).padStart(5)}  ${String(r2(x.drop)).padStart(5)}   ${x.bbox}`));
}
console.log('');
process.exit(pass.length ? 0 : 1);
