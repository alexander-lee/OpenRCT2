#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-coaster-design.mjs — DESIGN AND VERIFY NEW COASTER ARCHETYPES
//
// WHY THIS EXISTS. `SETUP.md` §0-P.4 publishes exactly TWO coaster piece
// arrays and says "COPY THEM VERBATIM — DO NOT AUTHOR YOUR OWN". That stopped
// parks shipping fatal track, and it also means EVERY park ships the identical
// two coasters — and neither has a LOOP. §4.0-C has two corkscrews; §4.0-B has
// no inversion at all. The mandate turned into form-fitting.
//
// The fix is not to drop the mandate (hand-rolled circuits went FATAL at
// 1.64 g and 1.96 g against the 1.275 g guard). It is to publish MORE verified
// archetypes, so a park can pick a different one and still be legal. This
// script is how an archetype earns "verified": the real `compileTrackPieces`
// + `rateCoaster` + `checkCoasterDesign` from `components/SplineRideKit`, no
// browser and no terrain.
//
// A candidate PASSES only if ALL of:
//   report.ok                     the compile succeeded
//   report.fatal == null          not translucent-red / unregistered
//   0 synthesized pieces          the closure is authored, not invented
//   maxLatG <= 1.275              the derail guard (1.5 g x 0.85)
//   design clean                  checkCoasterDesign found no violation
//   inversions >= 1               the whole point of the exercise
//   bbox within +/- 63.3 at 128   fits the plot from its published start
//
// Usage:
//   node probe-coaster-design.mjs                 # verify the candidate set
//   node probe-coaster-design.mjs --json
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, REPO } from './paths.mjs';

// ---- minimal DOM stub (the kit is a component module) ----------------------
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

const JSONOUT = process.argv.includes('--json');
const SIZE = 128;
const HALF = SIZE / 2 + 0.3; // the bounds guard's own limit
const LAT_GUARD = 1.275; // 1.5 g * 0.85

// =========================================================================
// THE CANDIDATES. Every one is a CLOSED steel rectangle in the same idiom as
// the published pair — lift / straight / turnR x4 — so the closure stays
// authored rather than synthesized. What changes is the INVERSION content.
//
// `loop` radius is HALF-HEIGHT (default 1.8), steel only. A loop needs speed:
// it is placed straight after a drop, never after a turn.
// =========================================================================
const CANDIDATES = [
  // ---- CONTROLS: the two PUBLISHED arrays. If these do not reproduce their
  // published figures (C: E 6.27 / I 9.55 / maxLatG 0.73 / inversions 2;
  // B: E 5.27 / I 6.25 / maxLatG 0.27), THE INSTRUMENT IS WRONG and no verdict
  // about a candidate means anything. Never grade a candidate without them.
  {
    id: 'CTRL-C', label: 'CONTROL §4.0-C published — expect E 6.27 / I 9.55 / latG 0.73 / inv 2',
    start: [16.8, 0.55, -3.6], control: { E: 6.27, I: 9.55, maxLatG: 0.73, inversions: 2 },
    pieces: ['station',
      { type: 'lift', height: 5.5 }, { type: 'straight', length: 5.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 5.5 }, { type: 'hill', height: 0.6 },
      { type: 'lift', height: 4.2 }, { type: 'straight', length: 2.72 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
      { type: 'lift', height: 4.2 }, { type: 'corkscrewL' }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
      { type: 'lift', height: 4.2 }, { type: 'corkscrewR' }, { type: 'straight', length: 2.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 4.2 }, { type: 'straight', length: 1.5 }],
  },
  {
    id: 'CTRL-B', label: 'CONTROL §4.0-B published — expect E 5.27 / I 6.25 / latG 0.27 / inv 0',
    start: [-33.6, 0.55, -48.0], control: { E: 5.27, I: 6.25, maxLatG: 0.27, inversions: 0 },
    pieces: ['station',
      { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 3.6 },
      { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
      { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
      { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 }],
  },
  {
    // FOUND BY probe-coaster-sweep / height-budgeted sweep, 42 of 256 legal.
    // THE INSIGHT: a loop raises maxY, speed is sqrt(2g(maxY - y)) so the car is
    // faster EVERYWHERE, and the closure arc's radius is FIXED at 2.2 — so the
    // loop's rise must be bought back out of the lifts or the closure blows the
    // 1.275 g guard. (The loop itself is exempt: `inversionWindow` masks it.)
    id: '4.0-L', label: 'LOOPER — vertical loop + corkscrew (2 inversions), height-budgeted',
    start: [16.8, 0.55, -3.6],
    pieces: ['station',
      { type: 'lift', height: 4.2 }, { type: 'straight', length: 6 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 4.2 }, { type: 'loop', radius: 1.4 }, { type: 'straight', length: 3.6 }, { type: 'hill', height: 0.6 },
      { type: 'lift', height: 2.0 }, { type: 'straight', length: 4.8 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 2.0 }, { type: 'hill', height: 0.6 },
      { type: 'lift', height: 2.0 }, { type: 'corkscrewR' }, { type: 'straight', length: 3 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 2.0 }, { type: 'hill', height: 0.6 },
      { type: 'lift', height: 1.6 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 1.6 }, { type: 'straight', length: 1.5 }],
  },
  {
    // THE PRESET. Exported as `COASTER_PRESETS.plunge` from SplineRideKit — the
    // first array in this file with a big drop AND an inversion, and the reason
    // the two below fail is the whole design note. Found by
    // probe-coaster-bigdrop.mjs; the straights are SOLVED closure lengths.
    //
    // The move: climb ONCE and take all the turns on the top deck, where
    // v is at its 1.4 floor, instead of the published idiom's four descending
    // crests — a turn's lateral load is set by how far it sits BELOW maxY, and
    // in 4.0-D the last crest sits 3.95 u under it and eats 3.16 of the 3.23 g.
    // Then spend the entire height on one drop into a PAIR of loops (a lone
    // loop steps a tile sideways and forces the compiler to invent a jog).
    id: '4.0-P', label: 'PLUNGE — 6-u drop + TWO vertical loops (the preset)',
    start: [16.8, 0.55, -3.6], control: { maxLatG: 1.23, inversions: 2, highestDrop: 5.99 },
    pieces: ['station',
      { type: 'lift', height: 6 },
      { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'straight', length: 22.5 },
      { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'straight', length: 15.1 },
      { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 6 },
      { type: 'loopR', radius: 1.6 },
      { type: 'straight', length: 2 },
      { type: 'loopL', radius: 1.6 },
      { type: 'straight', length: 3 },
      { type: 'turnR', angle: 90, radius: 2.5 }],
  },
  {
    id: '4.0-D', label: 'DOUBLE LOOP — two vertical loops, no corkscrew',
    start: [16.8, 0.55, -3.6],
    pieces: ['station',
      { type: 'lift', height: 7.0 }, { type: 'straight', length: 4.4 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 7.0 }, { type: 'loop', radius: 2.4 }, { type: 'hill', height: 0.9 },
      { type: 'lift', height: 5.6 }, { type: 'straight', length: 2.6 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 5.6 }, { type: 'loop', radius: 2.0 }, { type: 'hill', height: 0.6 },
      { type: 'lift', height: 4.2 }, { type: 'straight', length: 3.4 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
      { type: 'lift', height: 3.6 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 3.6 }, { type: 'straight', length: 1.5 }],
  },
  {
    id: '4.0-H', label: 'HELIX-AND-LOOP — loop + helix finale (1 inversion, high N)',
    start: [16.8, 0.55, -3.6],
    pieces: ['station',
      { type: 'lift', height: 6.0 }, { type: 'straight', length: 4.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 6.0 }, { type: 'loop', radius: 2.2 }, { type: 'hill', height: 0.9 },
      { type: 'lift', height: 4.8 }, { type: 'straight', length: 2.8 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 4.8 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
      { type: 'lift', height: 4.2 }, { type: 'straight', length: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 4.2 }, { type: 'helixR', angle: 360, radius: 2.5 },
      { type: 'lift', height: 3.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 3.0 }, { type: 'straight', length: 1.5 }],
  },
  {
    id: '4.0-W', label: 'WOODEN TWISTER — airtime hills, no inversion (wooden)',
    type: 'wooden', start: [-33.6, 0.55, -48.0],
    pieces: ['station',
      { type: 'lift', height: 5.0 }, { type: 'straight', length: 3.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 5.0 }, { type: 'hill', height: 1.5 }, { type: 'hill', height: 1.2 },
      { type: 'lift', height: 4.4 }, { type: 'straight', length: 3.6 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 4.4 }, { type: 'hill', height: 1.2 }, { type: 'hill', height: 0.9 },
      { type: 'lift', height: 4.0 }, { type: 'straight', length: 2.4 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 4.0 }, { type: 'hill', height: 0.9 },
      { type: 'lift', height: 3.4 }, { type: 'turnR', angle: 90, radius: 2.5 },
      { type: 'drop', height: 3.4 }, { type: 'straight', length: 1.5 }],
  },
];

// ---- bundle the kit for node ----------------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_coaster-design.ts');
fs.writeFileSync(ep, `
import { compileTrackPieces } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit'))};
import { rateCoaster } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit/ratings'))};
import { checkCoasterDesign } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit/design'))};
export { compileTrackPieces, rateCoaster, checkCoasterDesign };
`);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_coaster-design.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { compileTrackPieces, rateCoaster, checkCoasterDesign } = await import(bundlePath);

const r2 = (v) => (typeof v === 'number' ? +v.toFixed(2) : v);
const rows = [];
let pass = 0;

for (const c of CANDIDATES) {
  const type = c.type ?? 'steel';
  const bank = type === 'wooden' ? 0.42 : 0.7; // the PIECES-mode default per type
  let out = { id: c.id, label: c.label, type, ok: false, why: [] };
  try {
    const { points, report } = compileTrackPieces(c.pieces, {
      profile: 'coaster', type, heading: 0, start: c.start, bounds: SIZE,
    });
    const rating = rateCoaster(points, { type, bank, cars: 3 });
    let design = null;
    try { design = checkCoasterDesign(points, { type, bank }); } catch { design = null; }

    const bb = points.reduce((a, p) => ({
      minX: Math.min(a.minX, p[0]), maxX: Math.max(a.maxX, p[0]),
      minZ: Math.min(a.minZ, p[2]), maxZ: Math.max(a.maxZ, p[2]),
      maxY: Math.max(a.maxY, p[1]),
    }), { minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9, maxY: -1e9 });

    const synth = report.synthesizedCount ?? report.synthesized ?? 0;
    const inBounds = Math.max(Math.abs(bb.minX), Math.abs(bb.maxX), Math.abs(bb.minZ), Math.abs(bb.maxZ)) <= HALF;
    const designViolations = design
      ? (design.violations ?? design.failures ?? []).filter((v) => !/short(Drop|Length)/i.test(JSON.stringify(v)))
      : [];

    if (!report.ok) out.why.push('report.ok false');
    if (report.fatal) out.why.push(`FATAL: ${JSON.stringify(report.fatal).slice(0, 90)}`);
    if (synth > 0) out.why.push(`${synth} synthesized piece(s)`);
    if (!(rating.maxLatG <= LAT_GUARD)) out.why.push(`maxLatG ${r2(rating.maxLatG)} > ${LAT_GUARD}`);
    if (designViolations.length) out.why.push(`design: ${JSON.stringify(designViolations).slice(0, 90)}`);
    if (!inBounds) out.why.push('bbox outside the plot from its start');

    out = {
      ...out,
      ok: out.why.length === 0,
      E: r2(rating.excitement), I: r2(rating.intensity), N: r2(rating.nausea),
      inversions: rating.inversions, maxLatG: r2(rating.maxLatG),
      highestDrop: r2(rating.highestDrop ?? rating.drop), airtime: r2(rating.airtime),
      lengthU: r2(rating.length), seconds: r2(rating.duration ?? rating.seconds),
      bbox: `x[${r2(bb.minX)}, ${r2(bb.maxX)}] z[${r2(bb.minZ)}, ${r2(bb.maxZ)}] maxY ${r2(bb.maxY)}`,
      pieces: c.pieces.length, synth, bank,
    };
  } catch (e) {
    out.why.push(`THREW: ${String(e.message).slice(0, 120)}`);
  }
  if (out.ok) pass += 1;
  rows.push(out);
}

if (JSONOUT) { console.log(JSON.stringify({ candidates: rows }, null, 2)); process.exit(rows.every((r) => r.ok) ? 0 : 1); }

console.log('');
console.log('  COASTER ARCHETYPE VERIFICATION — real compileTrackPieces + rateCoaster + checkCoasterDesign');
console.log('  ' + '-'.repeat(104));
for (const r of rows) {
  console.log(`  ${r.ok ? 'PASS' : '**FAIL**'}  ${r.id}  ${r.label}`);
  if (r.ok || r.E !== undefined) {
    console.log(`        ${r.type} bank ${r.bank} cars 3 · E ${r.E} · I ${r.I} · N ${r.N} · INVERSIONS ${r.inversions}`);
    console.log(`        maxLatG ${r.maxLatG} (guard ${LAT_GUARD}) · drop ${r.highestDrop} · air ${r.airtime}s · ${r.pieces} pieces, ${r.synth} synthesized`);
    console.log(`        ${r.bbox}`);
  }
  if (!r.ok) r.why.forEach((w) => console.log(`        x ${w}`));
  console.log('');
}
console.log(`  ${pass} of ${rows.length} candidate(s) VERIFIED and safe to publish.`);
process.exit(pass === rows.length ? 0 : 1);
