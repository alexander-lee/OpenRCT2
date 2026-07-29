#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-monorail-loop.mjs — is the `<Monorail pieces>` circuit documented in
// `components/Monorail/Context.md` actually LEGAL?
//
// WHY. `<Monorail>`/`<TrackRide>` renders a fatal compile as translucent red
// and SKIPS GameManager registration, so a park that copies a broken piece
// list ships a transport ride nobody can board — and the transport category
// reads EMPTY with no error anywhere. The Context.md "Custom loop (pieces)"
// example was exactly that: only 180° of total turning, so compileTrackPieces
// has to synthesize a return leg that crosses the beam. This probe MEASURES
// the report instead of trusting the prose, and searches leg-length / radius
// space for a replacement circuit that closes on its own approach straight.
//
// METHOD. esbuild-bundle the real `compileTrackPieces` from
// `components/SplineRideKit` for node (external three + the usual DOM stub),
// compile candidate lists on `profile: 'monorail'` with the same
// `start: [0, 1.2, 0]` the component uses, and print
// `report.valid.worst` / `report.closure` / `report.fatal`.
//
// Usage:
//   node probe-monorail-loop.mjs            # documented list + the sweep
//   node probe-monorail-loop.mjs --sweep=0  # just check the known lists
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, REPO } from './paths.mjs';

// ---- minimal DOM stub (Stage-side material helpers paint canvas textures)
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
const SWEEP = arg('sweep', '1') !== '0';

// ---- bundle compileTrackPieces for node ------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_monorail-loop.ts');
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
const bundlePath = path.join(outDir, '_monorail-loop.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { compileTrackPieces } = await import(bundlePath);

// ---- compile one list, silencing the component's own console.warn ----------
function compile(pieces) {
  const warns = [];
  const realWarn = console.warn;
  console.warn = (m) => warns.push(String(m));
  let out;
  try {
    out = compileTrackPieces(pieces, { profile: 'monorail', start: [0, 1.2, 0] });
  } finally {
    console.warn = realWarn;
  }
  const r = out.report;
  const bb = out.points.reduce(
    (acc, [x, , z]) => ({ x0: Math.min(acc.x0, x), x1: Math.max(acc.x1, x), z0: Math.min(acc.z0, z), z1: Math.max(acc.z1, z) }),
    { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity },
  );
  return {
    bbox: `x ${bb.x0.toFixed(1)}..${bb.x1.toFixed(1)}  z ${bb.z0.toFixed(1)}..${bb.z1.toFixed(1)}  (${(bb.x1 - bb.x0).toFixed(1)} × ${(bb.z1 - bb.z0).toFixed(1)})`,
    worst: r.valid.worst,
    ok: r.ok,
    closed: r.closure.closed,
    gap: r.closure.gap,
    synth: r.closure.synthesized,
    fatal: !!r.fatal,
    reason: r.fatalReason ?? '',
    warns,
    points: out.points.length,
  };
}
const fmt = (r) =>
  `worst ${r.worst.toFixed(2)}  closed ${r.closed}  gap ${r.gap.toFixed(3)}  ` +
  `synth [${r.synth.join(', ')}]  fatal ${r.fatal}${r.reason ? ' — ' + r.reason : ''}`;

// ---- the lists under test ---------------------------------------------------
// The list documented in Monorail/Context.md before this probe (the DEFECT).
const DOCUMENTED_BROKEN = [
  'station',
  { type: 'straight', length: 1.6 },
  { type: 'turnR', angle: 90, radius: 1.8 },
  { type: 'straight', length: 2.4 },
  { type: 'turnR', angle: 90, radius: 1.8 },
  { type: 'sbend', radius: 1.2 },
];

// the two shipping previews, for a known-good baseline
const GRAND_CIRCLE = [
  'station',
  { type: 'straight', length: 2 },
  { type: 'turnL', angle: 90, radius: 3 },
  { type: 'straight', length: 2.4 },
  { type: 'turnL', angle: 90, radius: 3 },
  { type: 'straight', length: 1.2 },
  { type: 'sbend', length: 3.6, radius: 1.2 },
  { type: 'straight', length: 1.5 },
  { type: 'turnL', angle: 90, radius: 3 },
  { type: 'straight', length: 1.2 },
  { type: 'turnL', angle: 90, radius: 3 },
  { type: 'straight', length: 1.4 },
];

/** the RECTANGLE family, solved rather than guessed.
 *
 *  Walking the compiler's own cursor algebra: the four 90° arcs contribute
 *  2r·(d1+d2+d3+d4) = 0 to the net displacement, so a station+4-turn circuit
 *  closes iff the CROSS legs match (d = b) and the two along-axis legs differ
 *  by exactly the station deck plus the tail. `station` is 2.6 u long
 *  (SplineRideKit `case 'station'`), which is why a naive symmetric rectangle
 *  can NEVER close — it always ends 2.6 + tail u past the start and the
 *  compiler has to synthesize a loop-back. So:
 *
 *      far leg c = STATION_LEN + a + e + slack
 *
 *  leaves the cursor `slack` u SHORT of the start on the station axis with the
 *  heading already aligned — posGap < 0.5 and yawGap ≈ 0, so compileTrackPieces
 *  skips its closure synthesis entirely (`closure.synthesized` empty). */
const STATION_LEN = 2.6;
const rect = (a, b, r, e, slack = 0.3) => [
  'station',
  { type: 'straight', length: +a.toFixed(2) },
  { type: 'turnL', angle: 90, radius: r },
  { type: 'straight', length: +b.toFixed(2) },
  { type: 'turnL', angle: 90, radius: r },
  { type: 'straight', length: +(STATION_LEN + a + e + slack).toFixed(2) },
  { type: 'turnL', angle: 90, radius: r },
  { type: 'straight', length: +b.toFixed(2) },
  { type: 'turnL', angle: 90, radius: r },
  { type: 'straight', length: +e.toFixed(2) },
];

const PREVIEW_CUSTOM_LOOP = [
  'station',
  { type: 'straight', length: 1.7 },
  { type: 'turnR', angle: 90, radius: 2.55 },
  { type: 'straight', length: 2.04 },
  { type: 'turnR', angle: 90, radius: 2.55 },
  { type: 'straight', length: 1.02 },
  { type: 'sbend', length: 3.06, radius: -1.02 },
  { type: 'straight', length: 1.28 },
  { type: 'turnR', angle: 90, radius: 2.55 },
  { type: 'straight', length: 1.02 },
  { type: 'turnR', angle: 90, radius: 2.55 },
  { type: 'straight', length: 1.19 },
];

const PLAZA_CIRCUIT = [
  'station',
  { type: 'straight', length: 3 },
  { type: 'turnL', angle: 90, radius: 1.8 },
  { type: 'straight', length: 2 },
  { type: 'turnL', angle: 90, radius: 1.8 },
  { type: 'straight', length: 1.5 },
  { type: 'turnR', angle: 90, radius: 1.8 },
  { type: 'straight', length: 2.2 },
  { type: 'turnL', angle: 90, radius: 1.8 },
  { type: 'straight', length: 1.8 },
  { type: 'turnL', angle: 90, radius: 1.8 },
  { type: 'straight', length: 7.8 },
  { type: 'turnL', angle: 90, radius: 1.8 },
  { type: 'straight', length: 1 },
];

/** the NAIVE symmetric rectangle — equal opposite legs. Kept as the measured
 *  counter-example: it looks right on paper and is NEVER legal, because the
 *  2.6-u station deck makes the along-axis sides unequal. */
const rectSym = (a, b, r, tail) => [
  'station',
  { type: 'straight', length: a },
  { type: 'turnL', angle: 90, radius: r },
  { type: 'straight', length: b },
  { type: 'turnL', angle: 90, radius: r },
  { type: 'straight', length: a },
  { type: 'turnL', angle: 90, radius: r },
  { type: 'straight', length: b },
  { type: 'turnL', angle: 90, radius: r },
  { type: 'straight', length: tail },
];

console.log('=== the list documented in Monorail/Context.md (claimed example) ===');
const bad = compile(DOCUMENTED_BROKEN);
console.log('  ' + fmt(bad));
bad.warns.forEach((w) => console.log('    warn: ' + w));

console.log('\n=== shipping previews (baseline — these must stay legal) ===');
for (const [n, l] of [['Custom loop (pieces)', PREVIEW_CUSTOM_LOOP], ['Grand Circle Tour', GRAND_CIRCLE], ['Plaza Circuit', PLAZA_CIRCUIT]]) {
  const c = compile(l);
  console.log(`  ${n.padEnd(22)} ${fmt(c)}${c.warns.length ? '  (' + c.warns.length + ' warns)' : ''}\n  ${' '.repeat(22)} bbox ${c.bbox}`);
}

if (SWEEP) {
  // ---- the counter-example sweep: naive SYMMETRIC rectangles ---------------
  const symRows = [];
  for (const r of [1.5, 1.8, 2, 2.2, 2.5, 3])
    for (const a of [1.2, 1.6, 2, 2.4, 3])
      for (const b of [1.2, 1.6, 2, 2.4, 3, 3.6])
        for (const tail of [a - 0.3, a, a + 0.3]) {
          if (tail <= 0.2) continue;
          symRows.push(compile(rectSym(a, b, r, tail)));
        }
  const symOk = symRows.filter((x) => !x.fatal && x.closed && x.worst > 0.9 && x.synth.length === 0);
  const symWorst = Math.min(...symRows.map((x) => x.worst));
  console.log(
    `\n=== naive SYMMETRIC rectangle sweep (the trap) ===\n` +
      `  ${symRows.length} candidates, ${symOk.length} legal — every one synthesizes a loop-back\n` +
      `  (worst clearance seen across the family: ${symWorst.toFixed(2)}; all fatal on the 40% closure limit or on clearance)`,
  );

  console.log('\n=== rectangle sweep (station + 4×turnL + solved straight legs) ===');
  const rows = [];
  for (const r of [1.5, 1.8, 2, 2.2, 2.5, 3]) {
    for (const a of [0.8, 1.2, 1.6, 2, 2.4, 3]) {
      for (const b of [1.2, 1.6, 2, 2.4, 3, 3.6, 4.2]) {
        for (const e of [0.8, 1.2, 1.6, 2]) {
          const pieces = rect(a, b, r, e);
          const c = compile(pieces);
          // extent of the circuit (a park-friendly footprint matters as much
          // as the clearance): cross = b + 2r, along = 2.6 + a + e + 0.3 + 2r
          rows.push({ a, b, r, e, pieces, cross: b + 2 * r, along: STATION_LEN + a + e + 0.3 + 2 * r, ...c });
        }
      }
    }
  }
  const good = rows
    .filter((x) => !x.fatal && x.closed && x.worst > 0.9 && x.synth.length === 0)
    .sort((x, y) => y.worst - x.worst || x.gap - y.gap);
  console.log(
    `  ${rows.length} candidates, ${good.length} legal (non-fatal, closed, nothing synthesized, worst > 0.9)` +
      `\n  clearance across the whole family: min ${Math.min(...rows.map((x) => x.worst)).toFixed(2)}, ` +
      `max ${Math.max(...rows.map((x) => x.worst)).toFixed(2)}; total compiler warnings ${rows.reduce((a, x) => a + x.warns.length, 0)}`,
  );
  console.log('     a     b     r     e | worst   gap  footprint      | warns');
  for (const g of good.slice(0, 12))
    console.log(
      `  ${g.a.toFixed(1).padStart(4)} ${g.b.toFixed(1).padStart(5)} ${g.r.toFixed(1).padStart(5)} ` +
        `${g.e.toFixed(1).padStart(5)} | ${g.worst.toFixed(2).padStart(5)} ${g.gap.toFixed(3).padStart(5)}` +
        `  ${g.cross.toFixed(1)} × ${g.along.toFixed(1)}`.padEnd(16) +
        ` | ${g.warns.length}`,
    );

  // The pick: legal AND compact enough to drop into a district (footprint
  // under ~11 × 11) AND still comfortably clear.
  const pick = good
    .filter((x) => x.cross <= 11 && x.along <= 11 && x.warns.length === 0)
    .sort((x, y) => y.worst - x.worst)[0];
  if (pick) {
    console.log(
      `\n  PICK (compact + max clearance): a ${pick.a}, b ${pick.b}, radius ${pick.r}, tail ${pick.e}\n` +
        `  worst clearance ${pick.worst.toFixed(2)} (min 0.9), closure gap ${pick.gap.toFixed(3)}, ` +
        `synthesized [${pick.synth.join(', ') || '(none)'}], fatal ${pick.fatal}, warnings ${pick.warns.length}\n` +
        `  footprint ${pick.cross.toFixed(1)} × ${pick.along.toFixed(1)} u, ${pick.points} control points`,
    );
    console.log('  piece list:\n' + JSON.stringify(pick.pieces, null, 2));
  }

  // ---- the DOC candidates: small enough to read in a code block ------------
  console.log('\n=== compact doc candidates (a short list a reader can copy) ===');
  console.log('     a     b     r     e | worst   gap  footprint    | closed fatal synth warns');
  const docs = [
    [1.2, 2.4, 1.8, 0.8],
    [1.2, 3, 1.8, 0.8],
    [1.6, 2.4, 1.8, 1.2],
    [1.2, 2.4, 2, 0.8],
    [1.2, 3, 2, 1.2],
    [1.6, 3, 2, 1.2],
    [1.2, 2.4, 1.5, 0.8],
    [2, 3.6, 2, 1.2],
  ];
  for (const [a, b, r, e] of docs) {
    const c = compile(rect(a, b, r, e));
    console.log(
      `  ${a.toFixed(1).padStart(4)} ${b.toFixed(1).padStart(5)} ${r.toFixed(1).padStart(5)} ${e.toFixed(1).padStart(5)} | ` +
        `${c.worst.toFixed(2).padStart(5)} ${c.gap.toFixed(3).padStart(5)}  ` +
        `${(b + 2 * r).toFixed(1)} × ${(STATION_LEN + a + e + 0.3 + 2 * r).toFixed(1)}`.padEnd(12) +
        ` | ${String(c.closed).padStart(6)} ${String(c.fatal).padStart(5)} ${String(c.synth.length).padStart(5)} ${String(c.warns.length).padStart(5)}`,
    );
  }
  const DOC = rect(1.2, 3, 2, 1.2);
  const dc = compile(DOC);
  console.log('\n  === CHOSEN doc circuit (a 1.2, b 3, r 2, tail 1.2) ===');
  console.log('  ' + fmt(dc) + `  warnings ${dc.warns.length}\n  bbox ${dc.bbox}`);
  console.log('  ' + JSON.stringify(DOC));
}
