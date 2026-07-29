#!/usr/bin/env node
// ---------------------------------------------------------------------------
// mutate-scenery.mjs — REVERT the four 2026-07 geometry fixes into a scratch
// copy of SceneryPack, so `probe-scenery-geom.mjs --src=<that copy>` can be
// shown to go RED. A check that has never failed is not evidence.
//
// HEAD is not usable as the "before" here: the whole scenery detailing pass is
// uncommitted, so HEAD's SceneryPack is 653 lines against the working tree's
// ~1500 and does not contain the code under test at all.
//
//   node mutate-scenery.mjs && node probe-scenery-geom.mjs --src=<printed dir>
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const SRC = path.join(REPO, 'components/SceneryPack/index.tsx');
const DST_DIR = path.join(REPO, 'components/_SceneryPackMutant');
let s = fs.readFileSync(SRC, 'utf8');

const MUTATIONS = [
  {
    name: 'wishingWell: restore the BUTTERFLY pitch (positive rotX on an outboard slab)',
    from: `        rotX: -PITCH * s, // NEGATIVE: lifts the edge nearest the ridge`,
    to: `        rotX: PITCH * s,`,
  },
  {
    name: 'wishingWell: restore the narrow roof that missed the 0.58 rim',
    from: `  const EAVE_Z = 0.66; // past the 0.58 rim, so the roof overhangs the drum`,
    to: `  const EAVE_Z = 0.45;`,
  },
  {
    name: 'gazebo: restore the old per-bay chord angle (m − π instead of −(m + π/2))',
    from: `  const bayRotY = (k: number) => -(bayMid(k) + Math.PI / 2);`,
    to: `  const bayRotY = (k: number) =>
    Math.atan2(Math.cos(ang(k)) - Math.cos(ang(k + 1)), Math.sin(ang(k)) - Math.sin(ang(k + 1))) * -1;`,
  },
  {
    name: 'gazebo: restore the two floating treads at fixed radial offsets',
    from: `    [
      [0.075, 0.86], // top 0.075 ≈ plinth top 0.08
      [0.038, 0.92],
    ].forEach(([h, w], i) => {
      const out = FACE - Math.hypot(mx, mz) + TREAD * (i + 0.5);
      trim.push({ dims: [w, h, TREAD], pos: [mx + ox * out, h / 2, mz + oz * out], rotY: ry, repeat: [4, 1] });
    });`,
    to: `    void FACE;
    [
      [0.13, 0.42],
      [0.05, 0.62],
    ].forEach(([y, out]) => {
      trim.push({ dims: [0.72, 0.06, TREAD + 0.06], pos: [mx + ox * out, y, mz + oz * out], rotY: ry, repeat: [4, 1] });
    });`,
  },
  {
    name: 'hotAirBalloon: restore the straight vertical seam rods at a fixed radius 0.9',
    from: `  const onEnvelope = (phi: number, a: number, k: number) =>
    new t.Vector3(ENV_RXZ * k * Math.sin(phi) * Math.cos(a), 1.95 + ENV_RY * k * Math.cos(phi), ENV_RXZ * k * Math.sin(phi) * Math.sin(a));`,
    to: `  const onEnvelope = (phi: number, a: number, k: number) => {
    void ENV_RXZ;
    void ENV_RY;
    void k;
    const t0 = Math.asin(0.3 / 0.95);
    const u = (phi - t0) / (2.62 - t0); // 0 at the top of the old rod, 1 at its foot
    return new t.Vector3(0.9 * Math.cos(a), 3.0 - u * 2.1, 0.9 * Math.sin(a));
  };`,
  },
  {
    name: 'picnicTable: restore the ribs tilted about WORLD X after the azimuth',
    from: `    const from = new t.Vector3(Math.cos(a) * rIn, canopyY(rIn) + RIB_PROUD, Math.sin(a) * rIn);
    const to = new t.Vector3(Math.cos(a) * rOut, canopyY(rOut) + RIB_PROUD, Math.sin(a) * rOut);`,
    to: `    void rIn;
    void rOut;
    void RIB_PROUD;
    // Rx(0.42) · Ry(-a + PI/2) applied to local +Z — what Euler 'XYZ' produced
    const dir0 = new t.Vector3(Math.cos(a), -Math.sin(a) * Math.sin(0.42), Math.sin(a) * Math.cos(0.42)).normalize();
    const mid0 = new t.Vector3(Math.cos(a) * 0.5, 1.885, Math.sin(a) * 0.5);
    const from = mid0.clone().addScaledVector(dir0, -0.495);
    const to = mid0.clone().addScaledVector(dir0, 0.495);`,
  },
  {
    name: 'marbleStatue: restore the inverted rotZ that detached the lowered hand',
    from: `  g.add(box(t, [0.07, 0.36, 0.07], MARBLE, [-0.17, 1.32, 0], { rough: 0.5, rotZ: -0.35 }));`,
    to: `  g.add(box(t, [0.07, 0.36, 0.07], MARBLE, [-0.17, 1.32, 0], { rough: 0.5, rotZ: 0.35 }));`,
  },
];

let applied = 0;
for (const m of MUTATIONS) {
  if (!s.includes(m.from)) {
    console.error(`  [SKIP] anchor no longer present — ${m.name}`);
    continue;
  }
  s = s.replace(m.from, m.to);
  applied += 1;
  console.log(`  [mutated] ${m.name}`);
}
if (applied !== MUTATIONS.length) {
  console.error(`\n  ${applied}/${MUTATIONS.length} mutations applied — a missing anchor means the mutant does NOT`);
  console.error('  reproduce the original defect, so a red probe would not prove what it looks like it proves.');
  process.exit(1);
}
fs.mkdirSync(DST_DIR, { recursive: true });
fs.writeFileSync(path.join(DST_DIR, 'index.tsx'), s);
console.log(`\n  wrote ${path.join(DST_DIR, 'index.tsx')}`);
console.log(`  now run: node probe-scenery-geom.mjs --src=${DST_DIR}\n`);
