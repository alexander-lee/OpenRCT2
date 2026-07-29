#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-layout-thresholds.mjs — THE MEASUREMENT BEHIND AXIS 15's DISTRICT AND
// PLOT-UTILISATION NUMBERS (wave-10 P0/P1). Pure node, no browser: it reads the
// stored `layoutRaw` out of `shots/<park>/probe.json` (plus the synthetic
// controls in `fixtures.mjs`), so it re-derives every threshold from the corpus
// without re-rendering a single park.
//
// WHY IT EXISTS. Two numbers in this harness were BLIND PLOT FRACTIONS scaled
// off a size-48 figure, and at the wave-8 default size of 192 they contradicted
// the rulebook:
//
//   * `layout.mjs`'s clustering cut was `0.25 · size` → **48 u** at 192, which
//     is larger than most MEASURED inter-district gaps, so it merged every
//     district in the park into one cluster (briarwood: 8 rides → 1 district;
//     the `seedcheck-s1-192` REFERENCE park: 5 rides → 1 district). Both then
//     scored 0/1 on "districts separated" — for having districts.
//   * `score-layout.mjs`'s `separationAtSize48: 20` scaled to **80 u** at 192,
//     double the ≥ 40 u that `rules/park-generation.md` §0.3/§0.15 mandate.
//
// Section 1 measures the SINGLE-LINK MERGE LADDER of every park's ride
// positions: the intra-district gaps and the inter-district jumps, which is
// what a clustering cut has to separate. Section 2 measures the FEASIBLE
// separation — the largest mutual district separation that fits inside §0.3's
// gate-reach band once each district is given its footprint — which is what
// decides 40 u vs 80 u. Section 3 measures the plotUtilisation CEILING for a
// park that keeps everything inside that band, which is what makes §0.3 a trap
// on axes 2 and 15 unless the rules say the band binds RIDES only.
//
// Usage:
//   node probe-layout-thresholds.mjs            # all three sections
//   node probe-layout-thresholds.mjs --ladder   # section 1 only
//   node probe-layout-thresholds.mjs --feasible # section 2 only
//   node probe-layout-thresholds.mjs --plot     # section 3 only
//   node probe-layout-thresholds.mjs --size=192 # sections 2+3 at another plot
//
// SECTIONS 2 AND 3 ARE SIZE-PARAMETERISED (2026-07-25). They were hardcoded to
// 192, the wave-8 default, and the `<Park size>` default has been 128 since
// 2026-07 — so the published plotUtilisation CEILING (0.722) was being read off
// a plot the harness no longer builds. The geometry moves a LOT: §0.3's
// gate-reach radius is a fixed ~75 u of walking, but the gate sits at
// z = 1.2·round((S/2 − 0.8)/1.2), so on a 192 the band stops at z = 19.8 (two
// quadrants empty by construction) while on a 128 it reaches z = −11.4 and
// crosses the mid-line, which is exactly the constraint the 0.722 ceiling was
// about. `--size=` defaults to 128, the current default plot.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { CONTROLS } from './fixtures.mjs';
import { districtSeparationFloor, districtClusterCut } from './layout.mjs';

const only = process.argv.slice(2).filter((a) => a.startsWith('--') && !a.startsWith('--size=')).map((a) => a.slice(2));
const want = (s) => !only.length || only.includes(s);
const r1 = (v) => Math.round(v * 10) / 10;
/** the plot sections 2 + 3 reason about — the CURRENT `<Park size>` default */
const SIZE = Number((process.argv.find((a) => a.startsWith('--size=')) || '--size=128').split('=')[1]);
/** the gate's own z, the same lattice snap <Gate> uses */
const gateZ = (S) => 1.2 * Math.round((S / 2 - 0.8) / 1.2);
/** §0.3 gate-reach: ~75 u of walking from the gate, clipped to the plot */
const REACH = 75;
const bandOf = (S) => {
  const half = S / 2;
  const gz = gateZ(S);
  return { x0: Math.max(-half, -REACH), x1: Math.min(half, REACH), z0: Math.max(-half, gz - REACH), z1: gz };
};

// ---- the corpus: every probed park + the synthetic controls -----------------
function loadParks() {
  const out = [];
  const shots = path.join(HERE, 'shots');
  if (fs.existsSync(shots))
    for (const name of fs.readdirSync(shots).sort()) {
      const f = path.join(shots, name, 'probe.json');
      if (!fs.existsSync(f)) continue;
      let raw;
      try {
        raw = JSON.parse(fs.readFileSync(f, 'utf8')).layoutRaw;
      } catch {
        continue;
      }
      if (!raw || !Array.isArray(raw.rides) || !raw.rides.length) continue;
      const all = raw.rides.filter((r) => r.at);
      const rides = all.some((r) => r.registered) ? all.filter((r) => r.registered) : all;
      out.push({ name, size: raw.size || 48, kind: 'park', pts: rides.map((r) => ({ name: r.name, x: (r.centre || r.at)[0], z: (r.centre || r.at)[1] })) });
    }
  for (const [name, fn] of Object.entries(CONTROLS)) {
    const raw = fn();
    if (!raw.rides || !raw.rides.length) continue;
    out.push({ name, size: raw.size || 48, kind: 'control', pts: raw.rides.filter((r) => r.at).map((r) => ({ name: r.name || '?', x: (r.centre || r.at)[0], z: (r.centre || r.at)[1] })) });
  }
  return out;
}

/** single-link clustering at `cut` — layout.mjs's district pass, verbatim */
function cluster(pts, cut) {
  const parent = pts.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) <= cut) parent[find(i)] = find(j);
  const groups = {};
  pts.forEach((p, i) => {
    const r = find(i);
    (groups[r] = groups[r] || []).push(p);
  });
  const cl = Object.values(groups).map((g) => ({
    size: g.length,
    centroid: [g.reduce((a, p) => a + p.x, 0) / g.length, g.reduce((a, p) => a + p.z, 0) / g.length],
    diameter: Math.max(0, ...g.flatMap((a) => g.map((b) => Math.hypot(a.x - b.x, a.z - b.z)))),
  }));
  let maxSep = 0;
  let minSep = Infinity;
  for (let i = 0; i < cl.length; i++)
    for (let j = i + 1; j < cl.length; j++) {
      const d = Math.hypot(cl[i].centroid[0] - cl[j].centroid[0], cl[i].centroid[1] - cl[j].centroid[1]);
      maxSep = Math.max(maxSep, d);
      minSep = Math.min(minSep, d);
    }
  return { count: cl.length, maxSep, minSep: Number.isFinite(minSep) ? minSep : 0, maxDiameter: Math.max(0, ...cl.map((c) => c.diameter)) };
}

/** the single-link MERGE LADDER: the n−1 distances at which the rides fuse
 *  (Kruskal over the complete distance graph). The biggest STEP in the ladder
 *  is the park's own district scale — everything below it is intra-district
 *  ride pitch, everything above it is a jump between places. */
function mergeLadder(pts) {
  const edges = [];
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) edges.push([Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z), i, j]);
  edges.sort((a, b) => a[0] - b[0]);
  const parent = pts.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const heights = [];
  for (const [w, i, j] of edges)
    if (find(i) !== find(j)) {
      parent[find(i)] = find(j);
      heights.push(w);
    }
  return heights;
}

// ---- SECTION 1: the merge ladder ------------------------------------------
if (want('ladder')) {
  const parks = loadParks();
  console.log('\n=== 1. SINGLE-LINK MERGE LADDER — what a clustering cut has to separate ===\n');
  console.log('park                kind     size  n   merge heights (u)                         gap  natural cut');
  console.log('-'.repeat(112));
  const intra = { 48: [], 192: [], other: [] };
  const jumps = { 48: [], 192: [], other: [] };
  for (const p of parks) {
    const L = mergeLadder(p.pts);
    // the biggest STEP in the ladder splits intra-district pitch from
    // inter-district jumps
    let bestGap = 0;
    let at = -1;
    for (let i = 1; i < L.length; i++)
      if (L[i] - L[i - 1] > bestGap) {
        bestGap = L[i] - L[i - 1];
        at = i;
      }
    const natural = at > 0 ? (L[at] + L[at - 1]) / 2 : null;
    const bucket = p.size === 48 ? '48' : p.size === 192 ? '192' : 'other';
    // a park with no STEP in its ladder (a uniform lattice, a single huddle) has
    // no district scale to contribute either way — it is not evidence
    if (at > 0 && bestGap > 1) {
      L.slice(0, at).forEach((h) => intra[bucket].push(h));
      L.slice(at).forEach((h) => jumps[bucket].push(h));
    }
    console.log(
      `${p.name.padEnd(19)} ${p.kind.padEnd(8)} ${String(p.size).padStart(4)} ${String(p.pts.length).padStart(2)}   ` +
        `[${L.map((h) => r1(h)).join(' ')}]`.padEnd(42) +
        ` ${String(bestGap ? r1(bestGap) : '-').padStart(5)} ${String(natural === null ? '-' : r1(natural)).padStart(7)}`,
    );
  }
  const span = (a) => (a.length ? `${r1(Math.min(...a))}-${r1(Math.max(...a))} u (n=${a.length})` : 'none');
  console.log('\nINTRA-DISTRICT ride gaps (below each park\'s own ladder step):');
  console.log(`   size 48 : ${span(intra['48'])}`);
  console.log(`   size 192: ${span(intra['192'])}`);
  console.log('INTER-DISTRICT jumps (above it):');
  console.log(`   size 48 : ${span(jumps['48'])}`);
  console.log(`   size 192: ${span(jumps['192'])}`);
  console.log(
    '\nRide PITCH does not scale with the plot (§0.3 item 3 floors it at 6 u), so a\n' +
      'clustering cut expressed as a plot FRACTION drifts off the thing it measures.\n' +
      `PUBLISHED (layout.mjs, the one source of truth): cut ${districtClusterCut(48)} u @48, ` +
      `${districtClusterCut(192)} u @192; separation floor ${districtSeparationFloor(48)} u @48, ` +
      `${districtSeparationFloor(192)} u @192.\n`,
  );

  console.log('CLUSTER COUNT / maxSep / minSep at the OLD cut (0.25·size) vs the PUBLISHED cut:\n');
  console.log('park                size   old cut  n  maxSep  minSep     new cut  n  maxSep  minSep  maxDiam');
  console.log('-'.repeat(100));
  for (const p of parks) {
    const oldC = 0.25 * p.size;
    const newC = districtClusterCut(p.size);
    const a = cluster(p.pts, oldC);
    const b = cluster(p.pts, newC);
    console.log(
      `${p.name.padEnd(19)} ${String(p.size).padStart(4)}   ${String(r1(oldC)).padStart(7)} ${String(a.count).padStart(2)} ${String(r1(a.maxSep)).padStart(7)} ${String(r1(a.minSep)).padStart(7)}` +
        `     ${String(r1(newC)).padStart(7)} ${String(b.count).padStart(2)} ${String(r1(b.maxSep)).padStart(7)} ${String(r1(b.minSep)).padStart(7)} ${String(r1(b.maxDiameter)).padStart(8)}`,
    );
  }
  console.log(
    '\nMEASURED DISTRICT DIAMETER (maxDiam at the published cut) is the footprint the\n' +
      'separation floor is derived FROM: floor = diameter + one approach boulevard.\n',
  );
}

// ---- SECTION 2: is 40 u or 80 u the right floor? --------------------------
// The largest MUTUAL separation k district centres can achieve inside a
// rectangle, by random-restart coordinate ascent on the min pairwise distance.
function maxMinSeparation(k, x0, x1, z0, z1, restarts = 300) {
  const val = (q) => {
    let m = Infinity;
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) m = Math.min(m, Math.hypot(q[i][0] - q[j][0], q[i][1] - q[j][1]));
    return m;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  let best = -1;
  let bestP = null;
  for (let r = 0; r < restarts; r++) {
    let p = Array.from({ length: k }, () => [rnd(x0, x1), rnd(z0, z1)]);
    let v = val(p);
    let step = Math.max(x1 - x0, z1 - z0) / 4;
    while (step > 0.05) {
      let moved = false;
      for (let i = 0; i < k; i++)
        for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, step], [-step, -step], [step, -step], [-step, step]]) {
          const q = p.map((a) => a.slice());
          q[i][0] = Math.min(x1, Math.max(x0, q[i][0] + dx));
          q[i][1] = Math.min(z1, Math.max(z0, q[i][1] + dz));
          const nv = val(q);
          if (nv > v + 1e-9) {
            v = nv;
            p = q;
            moved = true;
          }
        }
      if (!moved) step /= 2;
    }
    if (v > best) {
      best = v;
      bestP = p;
    }
  }
  return { sep: best, centres: bestP.map((a) => a.map((x) => r1(x))) };
}

if (want('feasible')) {
  console.log(`\n=== 2. FEASIBLE DISTRICT SEPARATION — is the ${districtSeparationFloor(SIZE)}-u floor reachable at size ${SIZE}? ===\n`);
  // §0.3 check 2: the gate sits at z = 1.2·round((S/2 − 0.8)/1.2) and everything
  // a guest reaches inside the smoke run lies within ~75 u of it. A district
  // CENTRE must sit one district half-footprint inside that band; the measured
  // district diameter is ~19-23 u at 192 and ~10 u at 128 (section 1) with the
  // §4.0-A flagship ring at 37.6 × 37.6 — so 15 u of half-footprint is the
  // honest inset on any big plot.
  const B = bandOf(SIZE);
  const INSET = 15;
  const dims = (x0, x1, z0, z1) => `${r1(x1 - x0)} x ${r1(z1 - z0)}`;
  const inHalf = SIZE / 2 - INSET;
  const cases = [
    [`gate-reach band at ${SIZE}, centres anywhere`, [B.x0, B.x1, B.z0, B.z1], dims(B.x0, B.x1, B.z0, B.z1)],
    [
      `gate-reach band at ${SIZE}, centres inset ${INSET} u (a district half-footprint)`,
      [B.x0 + INSET, B.x1 - INSET, B.z0 + INSET, B.z1 - INSET],
      dims(B.x0 + INSET, B.x1 - INSET, B.z0 + INSET, B.z1 - INSET),
    ],
    [`whole ${SIZE} plot, centres inset ${INSET} u (ignores the sim)`, [-inHalf, inHalf, -inHalf, inHalf], dims(-inHalf, inHalf, -inHalf, inHalf)],
    ['size-48 plot, centres inset 8 u', [-16, 16, -16, 16], '32 x 32'],
  ];
  console.log('region                                                           box        k=2    k=3    k=4    k=5');
  console.log('-'.repeat(104));
  const rows = {};
  for (const [label, box, dims] of cases) {
    const vals = [2, 3, 4, 5].map((k) => maxMinSeparation(k, ...box).sep);
    rows[label] = vals;
    console.log(`${label.padEnd(64)} ${dims.padEnd(10)} ${vals.map((v) => String(r1(v)).padStart(6)).join(' ')}`);
  }
  const band = rows[cases[1][0]];
  const floor = districtSeparationFloor(SIZE);
  console.log(
    `\nVERDICT. §3 asks for 3-5 themed lands + the hub, i.e. k = 4-6 districts.\n` +
      `Inside the gate-reach band with a district footprint allowed for, the LARGEST\n` +
      `mutual separation achievable at size ${SIZE} is ${r1(band[1])} u at k=3, ${r1(band[2])} u at k=4 and ${r1(band[3])} u at k=5.\n` +
      `The published floor is ${floor} u (districtSeparationFloor(${SIZE})), which leaves ` +
      `${r1(band[2] - floor)} u of\n` +
      `slack even at k=4${band[3] >= floor ? ` and ${r1(band[3] - floor)} u at k=5` : ` but FAILS at k=5 (${r1(band[3])} < ${floor})`}. ` +
      `A blind 4x of the size-48 figure (80 u) stays\n` +
      `INFEASIBLE from three districts up.\n`,
  );
}

// ---- SECTION 3: the plotUtilisation ceiling inside the band ---------------
// layout.mjs: plotUtilisation = 0.4·clamp(ext/0.55) + 0.3·clamp(occ/0.35)
//             + 0.3·quadrantSpread, quadrantSpread = clamp((1 − maxQuadShare)/0.75),
// where `ext` is the STREET-NODE bbox area / size², `occ` is the share of an
// 8x8 coarse grid touched by nodes+rides+stalls+plazas, and the quadrants are
// signed by x and z. Scenery and trees are NOT features — only the street net,
// the rides, the stalls and the plazas move this number.
function plotUtil(extFrac, occFrac, maxQuadShare) {
  const c = (v) => Math.max(0, Math.min(1, v));
  return c(0.4 * c(extFrac / 0.55) + 0.3 * c(occFrac / 0.35) + 0.3 * c((1 - maxQuadShare) / 0.75));
}

if (want('plot')) {
  const S = SIZE;
  console.log(`\n=== 3. plotUtilisation CEILING for a park confined to the gate-reach band (size ${S}) ===\n`);
  const G = 8;
  const cell = S / G;
  const B = bandOf(S);
  const cellsOf = (x0, x1, z0, z1) => {
    const ix0 = Math.floor(((x0 + S / 2) / S) * G);
    const ix1 = Math.floor(((x1 + S / 2) / S) * G);
    const iz0 = Math.floor(((z0 + S / 2) / S) * G);
    const iz1 = Math.floor(((z1 + S / 2) / S) * G);
    return (Math.min(G - 1, ix1) - Math.max(0, ix0) + 1) * (Math.min(G - 1, iz1) - Math.max(0, iz0) + 1);
  };
  /** maxQuadrantShare for features spread EVENLY over the bbox: the biggest
   *  share of the bbox area any one signed (x, z) quadrant holds. Hardcoding
   *  0.5 was only right while the band sat wholly north of z = 0 — at size 128
   *  the band CROSSES the mid-line, which is the whole point of re-measuring. */
  const evenQuadShare = (x0, x1, z0, z1) => {
    const area = (x1 - x0) * (z1 - z0);
    const ov = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    const H = S / 2;
    let m = 0;
    for (const [qx0, qx1] of [[-H, 0], [0, H]])
      for (const [qz0, qz1] of [[-H, 0], [0, H]]) m = Math.max(m, (ov(x0, x1, qx0, qx1) * ov(z0, z1, qz0, qz1)) / area);
    return m;
  };
  const scenario = (label, x0, x1, z0, z1, quadShare) => {
    const q = quadShare ?? evenQuadShare(x0, x1, z0, z1);
    const ext = ((x1 - x0) * (z1 - z0)) / (S * S);
    const occ = cellsOf(x0, x1, z0, z1) / (G * G);
    const pu = plotUtil(ext, occ, q);
    console.log(
      `${label.padEnd(56)} bbox ${String(r1(x1 - x0)).padStart(5)} x ${String(r1(z1 - z0)).padStart(5)}  ext ${ext.toFixed(3)}  occ ${occ.toFixed(3)}  maxQuad ${q.toFixed(2)}  -> plotUtilisation ${pu.toFixed(3)}`,
    );
    return pu;
  };
  console.log(
    `(8x8 grid, cell ${r1(cell)} u; the gate stands at z = ${r1(gateZ(S))} and §0.3's ~${REACH}-u reach\n` +
      ` puts the band's far edge at z = ${r1(B.z0)}${B.z0 < 0 ? ' — SOUTH of the mid-line, so all four quadrants are reachable' : ' — north of the mid-line, so two quadrants are empty by construction'})\n`,
  );
  const theo = scenario('BAND, spanned edge to edge, features perfectly even', B.x0, B.x1, B.z0, B.z1);
  const inset = Math.min(3, S * 0.025);
  const real = scenario(
    'BAND, a realistic band-confined layout',
    B.x0 + inset, B.x1 - inset, B.z0 + inset, B.z1 - inset,
    evenQuadShare(B.x0 + inset, B.x1 - inset, B.z0 + inset, B.z1 - inset) + 0.05,
  );
  const half = scenario('HALF the band (a park that only fills the gate end)', B.x0 / 2, B.x1 / 2, (B.z0 + B.z1) / 2, B.z1);
  console.log(
    `\nVERDICT (size ${S}). The scored thresholds are plotUtilisation >= 0.70 for the full\n` +
      `point and >= 0.45 for half (score-layout.mjs). A park that keeps EVERYTHING inside\n` +
      `§0.3's gate-reach band tops out at ${theo.toFixed(3)} at size ${S} — spanning the band edge to\n` +
      `edge (x ${r1(B.x0)}..${r1(B.x1)}, z ${r1(B.z0)}..${r1(B.z1)}) with its features evenly spread. A realistic\n` +
      `band-confined layout reads ~${real.toFixed(2)}; a park that fills only the gate end reads ${half.toFixed(2)}.\n` +
      (B.z0 < 0
        ? `AT THIS SIZE THE BAND IS NOT THE BINDING CONSTRAINT: ${REACH} u of gate reach carries past\n` +
          `the mid-line (z = ${r1(B.z0)}), so all four quadrants are reachable and the full point is\n` +
          `attainable without breaking §0.3. What still loses the point is huddling.\n`
        : `The band starts at z = ${r1(B.z0)}, so two of the four quadrants are empty by construction\n` +
          `and quadrantSpread is capped — the band must bind RIDES only, see §0.3 check 2.\n`),
  );
}
