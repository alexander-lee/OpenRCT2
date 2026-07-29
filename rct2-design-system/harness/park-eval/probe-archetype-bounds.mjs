#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-archetype-bounds.mjs — WHERE may a §4.0 archetype's `start` sit?
//
// WHY THIS EXISTS (a real scoring failure, round-10). A generated park
// ("Stormhollow") dropped the §4.0-A coaster archetype at start x = −90 on a
// size-192 plot because its author assumed the ring "grows +x from the start
// corner". It does not: §4.0-A's local x runs 0 → −37.61, i.e. it grows toward
// −x, so a start hugging the −x edge throws the whole ring off the plot. The
// compile fataled with `the track reaches ±127.6 u — outside the ±96.0 u park
// bounds`, `<Coaster>` skipped the GameManager registration, the ride never
// existed and the park lost ~10 points. §4.0 published the piece list and a
// closure table but never a copyable LEGAL START RANGE — this probe MEASURES
// one instead of leaving it to arithmetic-by-hand.
//
// METHOD. No browser, no React, no terrain: the real `compileTrackPieces` from
// `components/SplineRideKit` on each published piece list (profile 'coaster',
// type 'steel', heading 0, start [0, 0.55, 0]) with `bounds: { half: 1000 }`
// so the guard cannot fatalize and we see the WHOLE circuit. Because the start
// is the local origin, the compiled point cloud IS the local bounding box —
// closure-synthesized points included, which is what matters: the bounds guard
// (`SplineRideKit/index.tsx` ~line 884) walks `points` AFTER closure.
//
// THE ARITHMETIC. The guard is `worstExt > half + margin` over |x| and |z| of
// every point, `half = size / 2`, `margin` default 0.3. A point is
// `start + local`, so per axis the legal start interval is exactly
//     start ∈ [ −(half + margin) − localMin ,  (half + margin) − localMax ]
// and, because parks translate archetypes by multiples of the 1.2-u lattice,
// the probe also prints that interval snapped INWARD to the lattice — those
// two numbers are the ones to paste into a park.
//
// Usage:
//   node probe-archetype-bounds.mjs                  # A, B, C at size 192 + 48
//   node probe-archetype-bounds.mjs --sizes=192,48,24
//   node probe-archetype-bounds.mjs --margin=0.3 --cell=1.2 --json
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, REPO } from './paths.mjs';

// ---- minimal DOM stub (the kit is a component module; keep it importable) --
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
const SIZES = arg('sizes', '192,48').split(',').map(Number);
const MARGIN = Number(arg('margin', '0.3')); // SplineRideKit's bounds-guard default
const CELL = Number(arg('cell', '1.2')); // the lattice parks translate on
const JSONOUT = process.argv.includes('--json');

// ---- the three PUBLISHED §4.0 piece lists, verbatim -----------------------
// rules/park-generation.md §4.0-A / §4.0-B / §4.0-C. Do NOT re-tune these:
// they are searched layouts. Copied here so the probe measures what the rules
// actually publish (a drift between the two IS the finding).
const A_PIECES = ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 4.84 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 1.2 },
  { type: 'lift', height: 5.1 }, { type: 'straight', length: 2.34 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'straight', length: 1.5 }];

const B_PIECES = ['station',
  { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 }];

const C_PIECES = ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 5.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'straight', length: 2.72 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewL' }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewR' }, { type: 'straight', length: 2.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'straight', length: 1.5 }];

const ARCHETYPES = [
  { id: '4.0-A', label: 'THRILL steel rectangle', pieces: A_PIECES, publishedStart: [16.8, 0.55, -3.6] },
  { id: '4.0-B', label: 'FAMILY steel rectangle', pieces: B_PIECES, publishedStart: [14.4, 0.55, -2.4] },
  { id: '4.0-C', label: 'INVERTING steel rectangle', pieces: C_PIECES, publishedStart: [16.8, 0.55, -3.6] },
];

// ---- bundle compileTrackPieces for node ------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_archetype-bounds.ts');
fs.writeFileSync(
  ep,
  `
import { compileTrackPieces } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit'))};
export { compileTrackPieces };
`,
);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_archetype-bounds.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { compileTrackPieces } = await import(bundlePath);

// ---- measure ---------------------------------------------------------------
const START = [0, 0.55, 0]; // the local origin: compiled point == local offset
const r1 = (v) => +v.toFixed(2);
/** the guard's own arithmetic: start ∈ [−lim − localMin, lim − localMax] */
const legal = (min, max, lim) => [-lim - min, lim - max];
/** snap an interval INWARD to the `CELL` lattice (empty ⇒ null) */
const snapIn = ([lo, hi]) => {
  const a = Math.ceil(lo / CELL - 1e-9) * CELL;
  const b = Math.floor(hi / CELL + 1e-9) * CELL;
  return a > b + 1e-9 ? null : [+a.toFixed(4), +b.toFixed(4)];
};
const dirWord = (min, max, axis) => {
  const plus = axis === 'x' ? 'EAST (+x)' : 'NORTH (+z)';
  const minus = axis === 'x' ? 'WEST (−x)' : 'SOUTH (−z)';
  if (max <= 1e-6) return `grows ${minus} ONLY — the start is the ${axis === 'x' ? 'EAST' : 'NORTH'}most point`;
  if (min >= -1e-6) return `grows ${plus} ONLY — the start is the ${axis === 'x' ? 'WEST' : 'SOUTH'}most point`;
  return `straddles the start: ${r1(-min)} u ${minus} and ${r1(max)} u ${plus}`;
};

const results = [];
for (const a of ARCHETYPES) {
  const { points, report } = compileTrackPieces(a.pieces, {
    profile: 'coaster', type: 'steel', heading: 0, start: START, bounds: { half: 1000 },
  });
  const bb = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, maxY: -Infinity };
  for (const [x, y, z] of points) {
    bb.minX = Math.min(bb.minX, x); bb.maxX = Math.max(bb.maxX, x);
    bb.minZ = Math.min(bb.minZ, z); bb.maxZ = Math.max(bb.maxZ, z);
    bb.maxY = Math.max(bb.maxY, y);
  }
  results.push({
    id: a.id, label: a.label, publishedStart: a.publishedStart,
    points: points.length,
    ok: report.ok, fatal: !!report.fatal, warnings: report.warnings.length,
    closed: report.closure.closed, gap: r1(report.closure.gap),
    synthesized: report.closure.synthesized.length,
    local: {
      minX: r1(bb.minX), maxX: r1(bb.maxX), minZ: r1(bb.minZ), maxZ: r1(bb.maxZ),
      maxY: r1(bb.maxY), // absolute compiled y (start y = 0.55), as §4.0 publishes it
      spanX: r1(bb.maxX - bb.minX), spanZ: r1(bb.maxZ - bb.minZ),
      worst: r1(Math.max(Math.abs(bb.minX), Math.abs(bb.maxX), Math.abs(bb.minZ), Math.abs(bb.maxZ))),
    },
    sizes: SIZES.map((size) => {
      const lim = size / 2 + MARGIN;
      const x = legal(bb.minX, bb.maxX, lim);
      const z = legal(bb.minZ, bb.maxZ, lim);
      return {
        size, half: size / 2, lim,
        x: [r1(x[0]), r1(x[1])], z: [r1(z[0]), r1(z[1])],
        xFits: x[0] <= x[1], zFits: z[0] <= z[1],
        xLattice: snapIn(x), zLattice: snapIn(z),
      };
    }),
  });
}

if (JSONOUT) {
  console.log(JSON.stringify({ margin: MARGIN, cell: CELL, start: START, archetypes: results }, null, 2));
  process.exit(0);
}

// ---- report ----------------------------------------------------------------
console.log(
  `archetype-bounds probe — real compileTrackPieces, profile 'coaster', type 'steel', heading 0,\n` +
    `start ${JSON.stringify(START)} (so every compiled point IS its LOCAL offset), bounds { half: 1000 } so nothing fatalizes.\n` +
    `guard: SplineRideKit/index.tsx ~884  worstExt = max(|x|,|z|) over ALL points (closure included) > half + margin  →  FATAL\n` +
    `margin ${MARGIN}, lattice ${CELL} u\n`,
);

console.log('LOCAL bounding box, relative to `start` (closure-synthesized points included; maxY is the');
console.log('compiled ABSOLUTE y, i.e. rail height above local ground, which is how §4.0 publishes it)');
console.log('  arch  |    local x     |    local z     |  span x × z   | maxY | worst | pts | closed | synth | ok');
console.log('  ------+----------------+----------------+---------------+------+-------+-----+--------+-------+----');
for (const r of results) {
  const L = r.local;
  console.log(
    `  ${r.id.padEnd(5)} | ${`${L.minX.toFixed(2)}..${L.maxX.toFixed(2)}`.padStart(14)} | ${`${L.minZ.toFixed(2)}..${L.maxZ.toFixed(2)}`.padStart(14)} | ` +
      `${`${L.spanX.toFixed(2)} × ${L.spanZ.toFixed(2)}`.padStart(13)} | ${L.maxY.toFixed(2).padStart(4)} | ${L.worst.toFixed(2).padStart(5)} | ` +
      `${String(r.points).padStart(3)} | ${String(r.closed).padStart(6)} | ${String(r.synthesized).padStart(5)} | ${r.fatal ? 'FATAL' : String(r.ok)}`,
  );
}

console.log('\nGROWTH DIRECTION (in words)');
for (const r of results) {
  console.log(`  ${r.id} ${r.label}`);
  console.log(`    x: ${dirWord(r.local.minX, r.local.maxX, 'x')}`);
  console.log(`    z: ${dirWord(r.local.minZ, r.local.maxZ, 'z')}`);
}

console.log('\nLEGAL START RANGE — start ∈ [−(half+margin) − localMin, (half+margin) − localMax], per axis');
for (const r of results) {
  console.log(`  ${r.id} ${r.label}`);
  for (const s of r.sizes) {
    if (!s.xFits || !s.zFits) {
      console.log(`    size ${String(s.size).padStart(3)} (half ${s.half}): NO LEGAL START — the circuit is bigger than the plot`);
      continue;
    }
    console.log(
      `    size ${String(s.size).padStart(3)} (half ${s.half}, lim ${s.lim}):  ` +
        `x ∈ [${s.x[0].toFixed(2)}, ${s.x[1].toFixed(2)}]   z ∈ [${s.z[0].toFixed(2)}, ${s.z[1].toFixed(2)}]`,
    );
    console.log(
      `        ${CELL}-u lattice (snapped INWARD): ` +
        `x ∈ [${s.xLattice ? `${s.xLattice[0].toFixed(1)}, ${s.xLattice[1].toFixed(1)}` : 'none'}]   ` +
        `z ∈ [${s.zLattice ? `${s.zLattice[0].toFixed(1)}, ${s.zLattice[1].toFixed(1)}` : 'none'}]`,
    );
  }
  const s192 = r.sizes.find((s) => s.size === 192);
  const ps = r.publishedStart;
  if (s192 && ps) {
    const inX = ps[0] >= s192.x[0] && ps[0] <= s192.x[1];
    const inZ = ps[2] >= s192.z[0] && ps[2] <= s192.z[1];
    console.log(`        §4.0's VERIFIED start [${ps[0]}, ${ps[2]}] at size 192: x ${inX ? 'legal' : 'ILLEGAL'}, z ${inZ ? 'legal' : 'ILLEGAL'}`);
  }
}

console.log(
  `\nNOTE the ranges above are the TRACK bounds guard only. §4.0 also puts the queue tail at\n` +
    `start.x + 6.0 and the exit hut at start.x + 2.4, which the footprints check tests separately —\n` +
    `so cap start.x at half − 6 on top of these numbers (size 192 → start.x ≤ 90).`,
);

// ---- the Stormhollow failure, replayed ------------------------------------
const A = results[0];
const bad = -90;
const worstAt = Math.max(
  Math.abs(bad + A.local.minX), Math.abs(bad + A.local.maxX),
  Math.abs(A.local.minZ), Math.abs(A.local.maxZ),
);
console.log(
  `\nthe round-10 failure, replayed: §4.0-A at start x = ${bad} on a 192 reaches ` +
    `±${worstAt.toFixed(1)} u vs the ±96.0 bound → report.fatal, ride NEVER registered.\n` +
    `the ring grows AWAY from the start corner (x → ${A.local.minX < 0 ? '−x' : '+x'}), so a start near the ` +
    `${A.local.minX < 0 ? '−x (WEST)' : '+x (EAST)'} edge is the failure mode — start on the OPPOSITE edge.`,
);
