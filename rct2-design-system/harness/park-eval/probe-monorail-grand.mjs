#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-monorail-grand.mjs — VERIFY the §4.2 GRAND CIRCLE, the park-spanning
// MULTI-STATION monorail every park is now required to carry.
//
// WHY A PROBE AND NOT PROSE. Monorail's own documented starter loop was FATAL
// for two rounds running (self-intersecting / past the 40% synthesized-closure
// limit), and a fatal compile renders translucent red and SKIPS the
// GameManager registration entirely — the park's TRANSPORT category reads
// EMPTY with no error anywhere but the console. So the block that ships must
// be MEASURED: closure, clearance, bounds, station poses, and the fact that
// nothing is synthesized.
//
// WHAT IT MEASURES, per candidate:
//   report.valid.worst / valid.ok      (validateSpline, gate 0.9)
//   report.closure.{closed,gap,synthesized}
//   report.fatal / fatalReason, compiler warnings (must be ZERO)
//   report.stations[]                  — one pose per authored `station` piece
//   bbox + worst |coord| vs the park bound, and the LEGAL START range
//   rateCoaster on the compiled points (worst lateral G vs the 1.275 margin)
//
// Usage:
//   node probe-monorail-grand.mjs                # the shipped block at 128
//   node probe-monorail-grand.mjs --size=192     # re-verify at another plot
//   node probe-monorail-grand.mjs --sweep        # the scaling-rule sweep
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, REPO } from './paths.mjs';

// ---- minimal DOM stub (Stage-side material helpers paint canvas textures) ---
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
const SIZE = +arg('size', '128');
const SWEEP = process.argv.includes('--sweep');

// ---- bundle the real kit for node -------------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_mono-grand.ts');
fs.writeFileSync(
  ep,
  `
import { compileTrackPieces, rateCoaster } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit'))};
export { compileTrackPieces, rateCoaster };
`,
);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_mono-grand.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { compileTrackPieces, rateCoaster } = await import(bundlePath);

// ---------------------------------------------------------------------------
// THE GRAND CIRCLE, PARAMETERISED — and the closure algebra it comes from.
//
// Walk the compiler's own cursor. `turnL` advances R along the OLD heading and
// R along the NEW one, and four 90° turns cancel in displacement, so a
// four-legged ring closes on TOTAL LEG RUNS alone:
//
//   leg A (start, heading +z) = station 2.6 + straight a        =: A
//   leg B (heading +x)        = straight p + station 2.6 + q    =: B
//   leg C (heading -z)        = straight p + station 2.6 + q    =: C
//   leg D (heading -x)        = straight p + station 2.6 + q    =: D
//   tail  (heading +z)        = straight e
//
//   final = (B - D, A - C + e)  ⇒  CLOSES iff  B = D  and  C = A + e + 0.3
//                                  (0.3 u short, already facing the station,
//                                   so compileTrackPieces synthesizes NOTHING)
//
// With every leg the SAME run L = 2·p + 2.6 (B = C = D = L) and the station of
// leg A sitting at the ring's mid-z, the whole thing collapses to ONE number:
//
//   p = (L - 2.6) / 2,   a = p,   e = p - 0.3
//
// i.e. a = p on the station leg and the tail is 0.3 u shorter — the mirror of
// it — which is exactly why nothing has to be synthesized. Footprint is then
// (L + 2R) square, and the four station decks land one per COMPASS POINT.
// ---------------------------------------------------------------------------
const grandCircle = (L, R) => {
  const p = +((L - 2.6) / 2).toFixed(2);
  const e = +(p - 0.3).toFixed(2);
  const leg = () => [{ type: 'straight', length: p }, 'station', { type: 'straight', length: p }];
  return {
    p, e, L, R,
    span: +(L + 2 * R).toFixed(2),
    pieces: [
      'station',
      { type: 'straight', length: p },
      { type: 'turnL', angle: 90, radius: R },
      ...leg(),
      { type: 'turnL', angle: 90, radius: R },
      ...leg(),
      { type: 'turnL', angle: 90, radius: R },
      ...leg(),
      { type: 'turnL', angle: 90, radius: R },
      // THE TAIL IS TWO PIECES, AND THAT IS NOT COSMETIC. compileTrackPieces
      // POPS every trailing control point within 0.45 u of the start (so the
      // closed CatmullRom's wrap does not kink), then measures `closure.gap`
      // from whatever point is left and calls the circuit closed only under
      // 2·TURN_RADIUS·1.1 = 3.3 u. A SINGLE long tail straight emits a
      // MIDPOINT (any run > 2.4 u does), the 0.3-u end point gets popped, and
      // the gap is measured from that midpoint — 17.8 u on this ring, i.e.
      // NOT CLOSED and FATAL. Splitting the last 1.5 u off keeps the final
      // emitted-and-kept point 1.8 u from the station: closed, nothing
      // synthesized. Do not merge these two straights.
      { type: 'straight', length: +(e - 1.5).toFixed(2) },
      { type: 'straight', length: 1.5 },
    ],
  };
};

/** compile at a start, silencing (but collecting) the component's warns */
function compile(pieces, start, bounds) {
  const warns = [];
  const realWarn = console.warn;
  console.warn = (m) => warns.push(String(m));
  let out;
  try {
    out = compileTrackPieces(pieces, { profile: 'monorail', start, ...(bounds ? { bounds } : {}) });
  } finally {
    console.warn = realWarn;
  }
  const r = out.report;
  const bb = out.points.reduce(
    (a, [x, y, z]) => ({
      x0: Math.min(a.x0, x), x1: Math.max(a.x1, x),
      y1: Math.max(a.y1, y),
      z0: Math.min(a.z0, z), z1: Math.max(a.z1, z),
    }),
    { x0: Infinity, x1: -Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity },
  );
  let worstExt = 0;
  for (const [x, , z] of out.points) worstExt = Math.max(worstExt, Math.abs(x), Math.abs(z));
  return { out, r, bb, worstExt, warns };
}

const fmt = (c) =>
  `worst ${c.r.valid.worst.toFixed(2)} (gate 0.9)  valid.ok ${c.r.valid.ok}  ` +
  `closed ${c.r.closure.closed}  gap ${c.r.closure.gap.toFixed(3)}  ` +
  `synth [${c.r.closure.synthesized.join(', ') || '(none)'}]  ` +
  `fatal ${!!c.r.fatal}${c.r.fatalReason ? ' — ' + c.r.fatalReason : ''}  warns ${c.warns.length}`;

// ---------------------------------------------------------------------------
// THE SHIPPED BLOCK: L = 73.2, R = 6, beam 2.6 u up, centred on a 128 plot.
// ---------------------------------------------------------------------------
const BEAM_Y = 3.6; // the park-scale height (was 2.6 — see Monorail/index.tsx `beamY` default)
const G = grandCircle(73.2, 6);
const HALF = G.span / 2; // 42.6
const START = [-HALF, BEAM_Y, -1.3];

console.log(`=== §4.2 GRAND CIRCLE — L ${G.L}, R ${G.R}, p ${G.p}, tail ${G.e}, span ${G.span} × ${G.span}`);
console.log(`    pieces: ${G.pieces.length}   start [${START.join(', ')}]  heading 0  plot ${SIZE}`);
const c = compile(G.pieces, START, SIZE);
console.log('    ' + fmt(c));
c.warns.forEach((w) => console.log('      warn: ' + w));
console.log(
  `    bbox  x ${c.bb.x0.toFixed(2)}..${c.bb.x1.toFixed(2)}   z ${c.bb.z0.toFixed(2)}..${c.bb.z1.toFixed(2)}   ` +
    `maxY ${c.bb.y1.toFixed(2)}   (${(c.bb.x1 - c.bb.x0).toFixed(2)} × ${(c.bb.z1 - c.bb.z0).toFixed(2)})`,
);
console.log(`    worst |coord| ${c.worstExt.toFixed(2)}  vs bound ±${(SIZE / 2).toFixed(1)} (+0.3 margin) → ${c.worstExt <= SIZE / 2 + 0.3 ? 'IN BOUNDS' : 'OUT OF BOUNDS'}`);
console.log(`    control points ${c.out.points.length}`);

// ---- station poses ----------------------------------------------------------
console.log(`\n    STATIONS (report.stations — ${c.r.stations.length}):`);
const COMPASS = ['W', 'N', 'E', 'S'];
c.r.stations.forEach((st, i) => {
  const deg = ((st.yaw * 180) / Math.PI + 360) % 360;
  console.log(
    `      ${i} piece ${String(st.piece).padStart(2)}  ${COMPASS[i] ?? '?'}  ` +
      `centre [${st.center.map((v) => v.toFixed(2)).join(', ')}]  ` +
      `deck ${st.length} u  yaw ${deg.toFixed(0)}°  dir [${st.dir.map((v) => +v.toFixed(2)).join(', ')}]  ` +
      `left [${st.left.map((v) => +v.toFixed(2)).join(', ')}]`,
  );
});

// ---- the legal-start range, per axis ---------------------------------------
{
  const lo = { x: Infinity, z: Infinity };
  const hi = { x: -Infinity, z: -Infinity };
  for (const [x, , z] of c.out.points) {
    lo.x = Math.min(lo.x, x - START[0]);
    hi.x = Math.max(hi.x, x - START[0]);
    lo.z = Math.min(lo.z, z - START[2]);
    hi.z = Math.max(hi.z, z - START[2]);
  }
  const lim = SIZE / 2 + 0.3;
  const rng = (a) => `[${(-lim - lo[a]).toFixed(2)}, ${(lim - hi[a]).toFixed(2)}]`;
  console.log(
    `\n    LOCAL bbox (offsets from start): x ${lo.x.toFixed(2)}..${hi.x.toFixed(2)}, z ${lo.z.toFixed(2)}..${hi.z.toFixed(2)}`,
  );
  console.log(`    LEGAL START at size ${SIZE}: x ∈ ${rng('x')}, z ∈ ${rng('z')}`);
}

// ---- ratings / lateral G (the beam is flat, so this is the turn check) ------
{
  const rr = rateCoaster(c.out.points, { type: 'wooden', bank: 0.08, cars: 3 });
  console.log(
    `\n    rateCoaster (bank 0.08 — the monorail designBank): maxLatG ${rr.maxLatG.toFixed(3)} g ` +
      `(margin 1.275 → ${(((1.275 - rr.maxLatG) / 1.275) * 100).toFixed(0)}% under)  ` +
      `length ${rr.length.toFixed(1)}  maxSpeed ${rr.maxSpeed.toFixed(2)}  avgSpeed ${rr.avgSpeed.toFixed(2)}  ` +
      `drops ${rr.dropCount}  highestDrop ${rr.highestDrop.toFixed(2)}  duration ${rr.duration.toFixed(1)} s  ` +
      `+G ${rr.maxPosVertG.toFixed(2)} / -G ${rr.maxNegVertG.toFixed(2)}  inversions ${rr.inversions}`,
  );
}

// ---- clearance over ground: how far the beam flies -------------------------
console.log(
  `\n    BEAM HEIGHT: rail centreline y ${BEAM_Y} → beam SOFFIT ${(BEAM_Y - 0.15).toFixed(2)} u over local grade.\n` +
    `      over a footpath slab (top 0.09): ${(BEAM_Y - 0.15 - 0.09).toFixed(2)} u  (validatePark's overfly gate: ≥ 2.2)\n` +
    `      over a stall canopy   (top 2.10): ${(BEAM_Y - 0.15 - 2.1).toFixed(2)} u  (strict re-audit: ≥ 0.3)\n` +
    `      over an entrance hut  (top 1.50): ${(BEAM_Y - 0.15 - 1.5).toFixed(2)} u  (strict re-audit: ≥ 0.3)`,
);

// ---- the CORRIDOR CELL TABLE ------------------------------------------------
// The 1.2-grid cells inside the LOW corridor: within 1.6 u of the compiled
// polyline where the rails run < 2.2 u up. The whole circuit is 2.45 u up, so
// on flat grade NOTHING is in the low corridor — but the cells the beam and
// its PIERS occupy are still cells a street must not be laid down the middle
// of, so publish the swept footprint either way.
{
  const CORR = 1.6;
  const cells = new Set();
  const pts = c.out.points;
  for (let i = 0; i < pts.length; i += 1) {
    const [ax, , az] = pts[i];
    const [bx, , bz] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(len / 0.6));
    for (let k = 0; k <= steps; k += 1) {
      const x = ax + ((bx - ax) * k) / steps;
      const z = az + ((bz - az) * k) / steps;
      for (let ox = -CORR; ox <= CORR; ox += 0.6)
        for (let oz = -CORR; oz <= CORR; oz += 0.6) {
          if (Math.hypot(ox, oz) > CORR) continue;
          cells.add(`${Math.round((x + ox) / 1.2) * 1.2},${Math.round((z + oz) / 1.2) * 1.2}`);
        }
    }
  }
  const byX = new Map();
  for (const key of cells) {
    const [x, z] = key.split(',').map(Number);
    if (!byX.has(x)) byX.set(x, []);
    byX.get(x).push(z);
  }
  const xs = [...byX.keys()].sort((a, b) => a - b);
  const runs = (zs) => {
    zs.sort((a, b) => a - b);
    const out = [];
    let s0 = zs[0];
    let prev = zs[0];
    for (const z of zs.slice(1)) {
      if (Math.abs(z - prev - 1.2) < 1e-6) prev = z;
      else {
        out.push(s0 === prev ? `${s0.toFixed(1)}` : `${s0.toFixed(1)}..${prev.toFixed(1)}`);
        s0 = z;
        prev = z;
      }
    }
    out.push(s0 === prev ? `${s0.toFixed(1)}` : `${s0.toFixed(1)}..${prev.toFixed(1)}`);
    return out.join(', ');
  };
  console.log(`\n    CORRIDOR CELLS (1.6-u sweep, ${cells.size} cells over ${xs.length} columns) — WORLD cells at start [${START[0]}, ${START[2]}]:`);
  // print only the columns that are not part of a long uniform band, plus the bands
  const bands = xs.filter((x) => byX.get(x).length > 6);
  const thin = xs.filter((x) => byX.get(x).length <= 6);
  console.log(`      the four LEGS (columns with a long run): ${bands.map((x) => x.toFixed(1)).join(', ')}`);
  for (const x of bands) console.log(`        x ${x.toFixed(1).padStart(6)}: z ${runs(byX.get(x))}`);
  console.log(`      the four CORNER arcs occupy the ${thin.length} remaining columns:`);
  console.log(`        x ${thin[0].toFixed(1)} … ${thin[thin.length - 1].toFixed(1)} (z runs listed by the sweep; the arcs are inside the ring's corners)`);
}

// ---- the SCALING RULE / second verified variant -----------------------------
if (SWEEP) {
  // THE SCALING RULE, stated once and then MEASURED at every plot size:
  //   span = the 1.2-lattice value nearest ⅔ · size   (the ring encloses the
  //          developed middle and leaves a ⅙ · size apron on every edge)
  //   L    = span − 2R,  p = (L − 2.6)/2,  tail = p − 0.3 split (p − 1.8, 1.5)
  //   start = [−span/2, 2.6, −1.3],  heading 0
  const lattice = (v) => +(Math.round(v / 1.2) * 1.2).toFixed(1);
  const ruleFor = (size, R = 6) => {
    const span = lattice((2 * size) / 3);
    return { span, L: +(span - 2 * R).toFixed(1), R };
  };
  console.log('\n=== SCALING SWEEP — span = lattice(⅔·size), L = span − 12, R 6 ===');
  console.log('    size    L      span   start            worst  gap    synth  fatal  warns  |coord|  stations');
  for (const size of [48, 64, 96, 128, 160, 192]) {
    const { L } = ruleFor(size);
    const g = grandCircle(L, 6);
    const h = g.span / 2;
    const st = [-h, BEAM_Y, -1.3];
    const cc = compile(g.pieces, st, size);
    console.log(
      `    ${String(size).padStart(4)}  ${L.toFixed(1).padStart(6)}  ${g.span.toFixed(1).padStart(5)}  ` +
        `[${st[0].toFixed(1)}, ${st[2].toFixed(1)}]`.padEnd(17) +
        `${cc.r.valid.worst.toFixed(2).padStart(5)}  ${cc.r.closure.gap.toFixed(3)}  ` +
        `${String(cc.r.closure.synthesized.length).padStart(5)}  ${String(!!cc.r.fatal).padStart(5)}  ` +
        `${String(cc.warns.length).padStart(5)}  ${cc.worstExt.toFixed(1).padStart(7)}  ${cc.r.stations.length}`,
    );
  }
  console.log('\n=== RADIUS sweep at L 73.2 (does the corner radius matter?) ===');
  for (const R of [2, 3, 4, 6, 8, 10]) {
    const g = grandCircle(73.2, R);
    const h = g.span / 2;
    const cc = compile(g.pieces, [-h, BEAM_Y, -1.3], 128);
    console.log(
      `    R ${String(R).padStart(2)}  span ${g.span.toFixed(1).padStart(5)}  worst ${cc.r.valid.worst.toFixed(2)}  ` +
        `gap ${cc.r.closure.gap.toFixed(3)}  synth ${cc.r.closure.synthesized.length}  fatal ${!!cc.r.fatal}  warns ${cc.warns.length}`,
    );
  }
  console.log('\n=== STATION COUNT sweep (1..5 platforms, L 73.2 R 6) ===');
  for (const n of [1, 2, 3, 4, 5]) {
    // n platforms: keep the ring, drop station pieces off the later legs
    const g = grandCircle(73.2, 6);
    let seen = 0;
    const pieces = g.pieces.map((pc) => {
      if (pc === 'station') {
        seen += 1;
        return seen <= n ? pc : { type: 'straight', length: 2.6 };
      }
      return pc;
    });
    const cc = compile(pieces, [-g.span / 2, BEAM_Y, -1.3], 128);
    console.log(
      `    ${n} platform(s): stations ${cc.r.stations.length}  worst ${cc.r.valid.worst.toFixed(2)}  ` +
        `gap ${cc.r.closure.gap.toFixed(3)}  synth ${cc.r.closure.synthesized.length}  fatal ${!!cc.r.fatal}  warns ${cc.warns.length}`,
    );
  }
}

console.log('\n=== VERDICT ===');
const clean = !c.r.fatal && c.r.valid.ok && c.r.closure.closed && c.r.closure.synthesized.length === 0 && c.warns.length === 0 && c.worstExt <= SIZE / 2 + 0.3;
console.log(`  ${clean ? 'PASS' : 'FAIL'} — the §4.2 Grand Circle at size ${SIZE}: ${c.r.stations.length} platforms, ` +
  `clearance ${c.r.valid.worst.toFixed(2)}, nothing synthesized, ${c.warns.length} warnings, worst |coord| ${c.worstExt.toFixed(2)}`);
process.exit(clean ? 0 : 1);
