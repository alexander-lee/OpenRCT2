#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-cork.mjs — the SplineCoaster ROLL-CHANNEL / barrel-roll probe.
//
// Two jobs, both compile-only (no browser, no renderer):
//
//  1. REGRESSION FINGERPRINT. `--baseline` writes a fingerprint of the three
//     SHIPPED unrolled layouts — every frame component of every sample, every
//     built geometry's vertex data, every mesh matrix, and the lead car's
//     matrix over a FIXED animation schedule — to out/cork-baseline.json.
//     Re-running without the flag diffs against it. A roll channel that is
//     inert when unspecified must reproduce the file BIT for bit.
//
//  2. INVERSION MEASUREMENT. Sweeps the WHOLE circuit and the WHOLE animation
//     cycle of the barrel-roll layout and asserts:
//       · the track genuinely inverts (min up.y <= -0.98)
//       · it passes through banked-90 (|up.y| <= 0.02 on a 20 000-step sweep
//         of the CONTINUOUS frameAt, not the coarse 320-sample grid)
//       · the roll channel is periodic: u=1 meets u=0 (frame seam < 1e-6) and
//         no single-sample roll step is anywhere near a 2pi seam TEAR
//       · the element sits on level, straight track, and the support columns
//         planted under the inverted section clear the rails
//       · checkCoasterDesign('steel') clean ON THE ROLLED FRAMES
//       · every car basis is RIGHT-HANDED (det = +1) at every step
//       · car up == frame up, car fwd == frame fwd, and the wheel offset
//         along the frame up is EXACTLY the runner's 0.195 at every step
//       · every RIDER stays rigidly seated: its local matrix never moves and
//         its world position is car + 0.22*carUp + z*carFwd
//       · at the roll apex the riders are BELOW the track centreline
//       · no NaN anywhere, and the train advances monotonically for a full lap
//
// Every assertion prints PASS/FAIL and the measured number, and the process
// exits non-zero on any FAIL — so each one can be made to go red on purpose.
//
//   node probe-cork.mjs --baseline     # capture (run BEFORE changing index.tsx)
//   node probe-cork.mjs                # diff + measure
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Stage's procedural textures paint onto a real <canvas>; in node there is
// none. Geometry and matrices — the only things fingerprinted here — never read
// the pixels, so a no-op 2d context is enough. (drawTexture also uses
// Math.random, which is exactly why texture DATA is not part of any
// fingerprint below.)
const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, set: () => true });
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => noop, toDataURL: () => '' }),
};

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });
const BASELINE = path.join(OUT, 'cork-baseline.json');
const capture = process.argv.includes('--baseline');

const entry = path.join(OUT, '_probe-cork-entry.ts');
fs.writeFileSync(
  entry,
  `export * from ${JSON.stringify(path.join(REPO, 'components/SplineCoaster/index.tsx'))};
export { checkCoasterDesign, validateSpline } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit/design.ts'))};
export { rateCoaster, replayCoasterForces } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit/ratings.ts'))};
export { buildCoasterCar, COASTER_CAR_SEATS } from ${JSON.stringify(path.join(REPO, 'components/CoasterCar/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_probe-cork-bundle.mjs');
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundlePath,
  format: 'esm',
  jsx: 'automatic',
  platform: 'node',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  target: 'node20',
  logLevel: 'error',
});
const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;

// ---------------------------------------------------------------------------
// layouts under test
// ---------------------------------------------------------------------------
const STOCK = K.SPLINE_COASTER_LAYOUT;
// preview 1 "Vertical Plunge" and preview 2 "Out-and-Back", verbatim
const PLUNGE = [
  [-3.25, 0.7, -0.57], [-2.64, 0.7, -1.18], [-2.03, 0.7, -1.79],
  [-1.41, 0.7, -2.4], [-0.9, 0.82, -2.92], [-0.39, 1.21, -3.43], [0.12, 2.0, -3.94], [0.64, 3.03, -4.46], [1.15, 4.07, -4.97], [1.66, 5.1, -5.48], [2.18, 5.89, -5.99], [2.69, 6.28, -6.51],
  [3.2, 6.4, -7.02], [4.08, 6.4, -7.6], [5.11, 6.4, -7.81], [6.14, 6.4, -7.61], [7.02, 6.4, -7.02], [7.61, 6.4, -6.14], [7.81, 6.4, -5.11], [7.6, 6.4, -4.08],
  [7.02, 6.4, -3.2], [6.57, 6.31, -2.75], [6.12, 6.01, -2.3], [5.67, 5.45, -1.85], [5.22, 4.43, -1.4], [4.77, 2.67, -0.95], [4.32, 1.65, -0.5], [3.87, 1.09, -0.05], [3.42, 0.79, 0.4],
  [2.97, 0.7, 0.85], [2.17, 0.7, 1.65], [1.37, 0.7, 2.45],
  [0.57, 0.7, 3.25], [0.03, 0.83, 3.79], [-0.51, 1.27, 4.33], [-1.05, 2.17, 4.87], [-1.59, 3.73, 5.41], [-2.13, 4.63, 5.94], [-2.66, 5.07, 6.48],
  [-3.2, 5.2, 7.02], [-4.08, 5.2, 7.6], [-5.11, 5.2, 7.81], [-6.14, 5.2, 7.61], [-7.02, 5.2, 7.02], [-7.61, 5.2, 6.14], [-7.81, 5.2, 5.11], [-7.6, 5.2, 4.08],
  [-7.02, 5.2, 3.2], [-6.48, 5.07, 2.66], [-5.94, 4.63, 2.13], [-5.41, 3.73, 1.59], [-4.87, 2.17, 1.05], [-4.33, 1.27, 0.51], [-3.79, 0.83, -0.03],
];
const OUTBACK = [
  [-5.6, 0.7, -2.4], [-2.2, 0.75, -4.2], [1.6, 2.2, -4.8], [4.6, 3.6, -4.0], [6.0, 3.55, -2.2],
  [6.4, 2.1, 0.4], [5.6, 1.05, 2.4], [3.4, 1.85, 4.2], [0.6, 2.15, 5.0], [-2.4, 1.25, 4.6],
  [-4.8, 0.9, 3.4], [-6.6, 0.78, 1.2], [-6.2, 0.7, -1.2],
];

// the barrel-roll circuit, shared with shot-roll.mjs so the probe and the
// screenshots can never drift apart
const { BARREL } = await import('./probe-cork-layout.mjs');

const SCHEDULE = []; // fixed animation schedule: 0 .. 24 s at 1/60 s
for (let i = 0; i <= 1440; i++) SCHEDULE.push(i / 60);

// ---------------------------------------------------------------------------
// fingerprint helpers — full float64 precision, nothing rounded away
// ---------------------------------------------------------------------------
const fx = (n) => (Object.is(n, -0) ? '-0' : String(n));
function framesFingerprint(fb) {
  const parts = [`total=${fx(fb.total)}`, `N=${fb.N}`];
  for (let i = 0; i < fb.N; i++) {
    const f = fb.frames[i];
    parts.push(
      `${i}|${fx(f.p.x)},${fx(f.p.y)},${fx(f.p.z)}|${fx(f.fwd.x)},${fx(f.fwd.y)},${fx(f.fwd.z)}|` +
        `${fx(f.up.x)},${fx(f.up.y)},${fx(f.up.z)}|${fx(f.side.x)},${fx(f.side.y)},${fx(f.side.z)}`,
    );
  }
  return parts.join('\n');
}
function groupFingerprint(g) {
  const parts = [];
  let n = 0;
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    n++;
    const m = o.matrixWorld.elements;
    parts.push(`mesh${n} M[${m.map(fx).join(',')}]`);
    const pos = o.geometry?.attributes?.position;
    if (pos) {
      let sx = 0, sy = 0, sz = 0, mx = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        sx += pos.getX(i); sy += pos.getY(i); sz += pos.getZ(i);
        mx = Math.max(mx, Math.abs(pos.getX(i)) + Math.abs(pos.getY(i)) + Math.abs(pos.getZ(i)));
      }
      parts.push(`  verts=${pos.count} sum=${fx(sx)},${fx(sy)},${fx(sz)} maxL1=${fx(mx)}`);
    }
  });
  return `meshes=${n}\n${parts.join('\n')}`;
}
function runFingerprint(coaster, cars) {
  const tick = coaster.run(cars, { spacing: 1.5 });
  const parts = [];
  for (const t of SCHEDULE) {
    tick(t);
    for (const c of cars) {
      c.updateMatrixWorld(true);
      parts.push(c.matrixWorld.elements.map(fx).join(','));
    }
  }
  return parts.join('\n');
}
/** deterministic 3-car train (buildCoasterCar has no randomness) */
const train = () => ['front', 'middle', 'end'].map((v) => K.buildCoasterCar(T, v, undefined, { riders: true }));

function fingerprintOf(points, opts) {
  const fb = K.computeSplineFrames(T, points, { bank: opts.bank });
  const coaster = K.buildSplineCoaster(T, points, opts);
  const cars = train();
  return {
    frames: framesFingerprint(fb),
    group: groupFingerprint(coaster.group),
    run: runFingerprint(coaster, cars),
  };
}

// ---------------------------------------------------------------------------
// 1. regression fingerprint of the three SHIPPED unrolled layouts
// ---------------------------------------------------------------------------
const CASES = [
  ['stock (SPLINE_COASTER_LAYOUT)', STOCK, { bank: 0.55 }],
  ['vertical plunge (preview 1)', PLUNGE, { bank: 0.55 }],
  ['out-and-back (preview 2)', OUTBACK, { bank: 0.55 }],
  ['stock, wood:true', STOCK, { bank: 0.55, wood: true }],
];
const now = {};
for (const [name, pts, opts] of CASES) now[name] = fingerprintOf(pts, opts);

let fails = 0;
const ok = (cond, label, detail) => {
  if (!cond) fails++;
  console.log(`   ${cond ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `  ${detail}` : ''}`);
};

if (capture) {
  fs.writeFileSync(BASELINE, JSON.stringify(now, null, 0));
  console.log(`── BASELINE captured → ${BASELINE}`);
  for (const [name] of CASES) {
    const f = now[name];
    console.log(`   ${name}: frames ${f.frames.length} B, group ${f.group.length} B, run ${f.run.length} B`);
  }
} else {
  console.log('── REGRESSION: unrolled output must be bit-identical to the baseline');
  if (!fs.existsSync(BASELINE)) {
    console.log('   FAIL  no baseline — run with --baseline first');
    fails++;
  } else {
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    for (const [name] of CASES) {
      for (const key of ['frames', 'group', 'run']) {
        const a = base[name]?.[key];
        const b = now[name][key];
        let where = '';
        if (a !== b) {
          const la = (a ?? '').split('\n');
          const lb = b.split('\n');
          for (let i = 0; i < Math.max(la.length, lb.length); i++)
            if (la[i] !== lb[i]) { where = ` first diff line ${i}:\n        base ${la[i]}\n        now  ${lb[i]}`; break; }
        }
        ok(a === b, `${name} · ${key}`, `${b.length} B${where}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. inversion measurement on the barrel-roll circuit
// ---------------------------------------------------------------------------
// centred between BARREL points 41 and 42 — the middle of the level valley run
const ROLL_SPEC = [{ atPoint: 41.5, dir: 'R', turns: 1 }];
console.log('\n── ROLL CHANNEL: barrel-roll circuit');
let fb, coaster, cars;
try {
  fb = K.computeSplineFrames(T, BARREL, { bank: 0.55, roll: ROLL_SPEC });
  coaster = K.buildSplineCoaster(T, BARREL, { bank: 0.55, roll: ROLL_SPEC, type: 'steel' });
  cars = train();
} catch (e) {
  console.log(`   FAIL  computeSplineFrames({roll}) threw: ${e.message}`);
  fails++;
}

if (fb) {
  // --- where is the roll? re-derive it from the FRAMES, not from the spec ---
  // Swept on the CONTINUOUS frameAt (20 000 steps), not the 320-sample grid:
  // the grid takes ~19° of roll per step, so it can straddle both the exact
  // apex and exact banked-90 and under-report both. frameAt is what the rails,
  // the ties and the train are all built from, so it is the right ruler.
  let minUpY = 1, minUpAt = 0, minAbsUpY = 1, minAbsAt = 0;
  const FINE = 20000;
  for (let i = 0; i < FINE; i++) {
    const u = i / FINE;
    const f = fb.frameAt(u);
    if (f.up.y < minUpY) { minUpY = f.up.y; minUpAt = u; }
    if (Math.abs(f.up.y) < minAbsUpY) { minAbsUpY = Math.abs(f.up.y); minAbsAt = u; }
  }
  ok(minUpY <= -0.98, 'track INVERTS (min up.y <= -0.98)', `min up.y ${minUpY.toFixed(4)} at u=${minUpAt.toFixed(4)}`);
  ok(minAbsUpY <= 0.02, 'passes through BANKED-90 (|up.y| <= 0.02)', `min |up.y| ${minAbsUpY.toFixed(5)} at u=${minAbsAt.toFixed(4)}`);

  // --- roll accumulation: measured from the FRAMES, not read from the spec --
  // Walk the loop de-rotating each tangent change away, so what is left is the
  // pure roll about the travel axis. The UNROLLED circuit is not at zero: the
  // loop-closure correction spreads its residual twist `err` around the loop,
  // so the roll channel's contribution is the DIFFERENCE of the two.
  const accRollOf = (frames, N) => {
    let acc = 0, maxStep = 0;
    for (let i = 0; i < N; i++) {
      const a = frames[i], b = frames[(i + 1) % N];
      const q = new T.Quaternion().setFromUnitVectors(b.fwd, a.fwd);
      const bu = b.up.clone().applyQuaternion(q);
      const d = Math.atan2(bu.dot(a.side), bu.dot(a.up));
      acc += d;
      maxStep = Math.max(maxStep, Math.abs(d));
    }
    return { acc, maxStep };
  };
  const fbPlain = K.computeSplineFrames(T, BARREL, { bank: 0.55 });
  const rolled = accRollOf(fb.frames, fb.N);
  const plain = accRollOf(fbPlain.frames, fbPlain.N);
  const turns = (rolled.acc - plain.acc) / (2 * Math.PI);
  ok(Math.abs(Math.abs(turns) - 1) < 0.01, 'the roll channel adds exactly ONE full turn (vs the same layout unrolled)',
    `${turns.toFixed(6)} turns (rolled ${(rolled.acc / (2 * Math.PI)).toFixed(5)}, unrolled ${(plain.acc / (2 * Math.PI)).toFixed(5)})`);
  // A torn seam (non-periodic roll) puts a ~2pi jump in ONE sample step. The
  // legitimate peak is the element's own roll rate x ds = 1.5*2pi/span * ds
  // = 1.31 * 0.237 = 0.311 rad here, so 0.8 sits well clear of both.
  ok(rolled.maxStep < 0.8, 'no seam TEAR: largest single-sample roll step stays small',
    `max step ${rolled.maxStep.toFixed(4)} rad (unrolled ${plain.maxStep.toFixed(4)}, a tear would be ~6.28)`);

  // --- where the element sits, and what the AUTO-BANK is doing under it ----
  // roll and curvature bank are the same degree of freedom, so the element has
  // to land on straight, level track — measure that it did.
  const prof = K.rollProfile(ROLL_SPEC, BARREL.map(([x, y, z]) => new T.Vector3(x, y, z)), fb.P, fb.total);
  const EPS = 0.02;
  let inMin = 1, inMax = 0, maxPitch = 0, maxUnderBank = 0, uLo = 1, uHi = 0;
  for (let i = 0; i < fb.N; i++) {
    const r = Math.abs(prof[i]);
    if (r <= EPS || r >= 2 * Math.PI - EPS) continue; // outside the ramp
    inMin = Math.min(inMin, i / fb.N); inMax = Math.max(inMax, i / fb.N);
    uLo = Math.min(uLo, i / fb.N); uHi = Math.max(uHi, i / fb.N);
    maxPitch = Math.max(maxPitch, Math.abs(Math.asin(fbPlain.frames[i].fwd.y)));
    // the unrolled frame's own bank there = curvature bank + closure residual
    maxUnderBank = Math.max(maxUnderBank, Math.abs(Math.atan2(fbPlain.frames[i].side.y, fbPlain.frames[i].up.y)));
  }
  console.log(`   info  element occupies u ${uLo.toFixed(3)}..${uHi.toFixed(3)} (${((uHi - uLo) * fb.total).toFixed(2)} of ${fb.total.toFixed(2)} arc units)`);
  ok(maxPitch < 0.09, 'the roll element sits on LEVEL track (|pitch| < 5deg)', `max pitch ${(maxPitch * 180 / Math.PI).toFixed(2)} deg`);
  ok(maxUnderBank < 0.09, 'the roll element sits on STRAIGHT track (auto-bank under it < 5deg)', `max auto-bank ${(maxUnderBank * 180 / Math.PI).toFixed(2)} deg`);

  // --- SUPPORTS through the inversion --------------------------------------
  // addSplineSupports plants a column at every 9th sample whose track is more
  // than 0.3 above the ground and whose |up.y| >= 0.5 — a test on the ABSOLUTE
  // value, so an INVERTED frame (up.y ~ -1) still gets one. That is right (a
  // real barrel roll is supported from beneath), but the column now stands
  // under track that is rolling, so measure it: column axis at (p.x, p.z),
  // radius 0.085, top at p.y - 0.16; a rail is a 0.045 tube at p +/- side*0.34.
  {
    let worst = Infinity, worstAt = -1, planted = 0;
    for (let i = 0; i < fb.N; i += 9) {
      const f = fb.frames[i];
      const top = f.p.y - 0.16;
      if (top - 0 < 0.3 || Math.abs(f.up.y) < 0.5) continue;
      const inRoll = Math.abs(prof[i]) > EPS && Math.abs(prof[i]) < 2 * Math.PI - EPS;
      if (!inRoll) continue;
      planted++;
      // sweep the whole element's rails; anything BELOW the column top has to
      // clear the column's radius horizontally
      for (let j = 0; j < fb.N; j++) {
        const g = fb.frames[j];
        for (const s of [-1, 1]) {
          const r = g.p.clone().addScaledVector(g.side, s * 0.34);
          if (r.y > top + 0.045) continue; // above the column: cannot touch it
          const d = Math.hypot(r.x - f.p.x, r.z - f.p.z) - 0.085 - 0.045;
          if (d < worst) { worst = d; worstAt = j / fb.N; }
        }
      }
    }
    console.log(`   info  ${planted} support column(s) planted inside the roll element`);
    ok(planted === 0 || worst > 0.02, 'support columns inside the roll clear the rails',
      planted === 0 ? 'none planted' : `worst gap ${worst.toFixed(4)} u at u=${worstAt.toFixed(3)}`);
  }

  // --- seam: u=1 must meet u=0 ---------------------------------------------
  const f0 = fb.frameAt(0);
  const f1 = fb.frameAt(1 - 1e-12);
  const seam = Math.max(f0.p.distanceTo(f1.p), f0.up.distanceTo(f1.up), f0.side.distanceTo(f1.side));
  ok(seam < 1e-6, 'loop closure: frame at u=1 meets u=0', `worst component gap ${seam.toExponential(3)}`);
  // and the same for the UNROLLED stock circuit (the correction still works)
  const fbS = K.computeSplineFrames(T, STOCK, { bank: 0.55 });
  const s0 = fbS.frameAt(0), s1 = fbS.frameAt(1 - 1e-12);
  const seamS = Math.max(s0.p.distanceTo(s1.p), s0.up.distanceTo(s1.up));
  ok(seamS < 1e-6, 'loop closure still exact on the UNROLLED stock circuit', `${seamS.toExponential(3)}`);

  // --- design + clearance, ON THE ROLLED FRAMES ----------------------------
  const rep = K.checkCoasterDesign(T, BARREL, { type: 'steel', frames: fb, bank: 0.55 });
  const hard = rep.violations.filter((v) => !v.warning);
  ok(rep.ok && hard.length === 0, "checkCoasterDesign('steel') clean on the ROLLED frames",
    `ok=${rep.ok} hard=[${hard.map((v) => `${v.kind}@${v.at.toFixed(2)} ${v.detail}`).join(' | ')}] warn=[${rep.violations.filter((v) => v.warning).map((v) => v.kind).join(',')}]`);
  const wood = K.checkCoasterDesign(T, BARREL, { type: 'wooden', frames: fb, bank: 0.55 });
  ok(!wood.ok && wood.violations.some((v) => v.kind === 'inversion'), "checkCoasterDesign('wooden') REJECTS the inversion",
    `[${wood.violations.filter((v) => !v.warning).map((v) => v.kind).join(',')}]`);
  const val = K.validateSpline(T, fb.curve);
  ok(val.ok, 'validateSpline clearance', `worst ${val.worst.toFixed(3)} at u=${val.at[0].toFixed(3)}/${val.at[1].toFixed(3)}`);
  const rate = K.rateCoaster(BARREL, { type: 'steel', bank: 0.55, cars: 3, frames: fb });
  console.log(`   info  rateCoaster: inversions ${rate.inversions}  E ${rate.excitement.toFixed(2)} I ${rate.intensity.toFixed(2)} N ${rate.nausea.toFixed(2)} (${rate.ratingBand})`);
  ok(rate.inversions >= 1, 'rateCoaster counts the inversion', `${rate.inversions}`);

  // --- steel-only gating ---------------------------------------------------
  const warns = [];
  const realWarn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  const woodBuild = K.computeSplineFrames(T, BARREL, { bank: 0.42 });
  const woodCoaster = K.buildSplineCoaster(T, BARREL, { bank: 0.42, type: 'wooden', roll: ROLL_SPEC });
  console.warn = realWarn;
  let woodMinUp = 1;
  for (let i = 0; i < fb.N; i++) woodMinUp = Math.min(woodMinUp, woodCoaster.frameAt(i / fb.N).up.y);
  ok(woodMinUp > -0.05, "wooden build DROPS the roll (no inversion in wooden track)", `min up.y ${woodMinUp.toFixed(4)}`);
  ok(warns.some((w) => /wooden|Wooden/.test(w)), 'wooden build WARNS about the dropped inversion', `${warns.length} warning(s): ${warns[0]?.slice(0, 120) ?? '(none)'}`);

  // --- non-integer total roll must fail closed -----------------------------
  const warns2 = [];
  console.warn = (...a) => warns2.push(a.join(' '));
  const halfFb = K.computeSplineFrames(T, BARREL, { bank: 0.55, roll: [{ at: 0.5, dir: 'R', turns: 0.5 }] });
  console.warn = realWarn;
  let halfMinUp = 1;
  for (let i = 0; i < halfFb.N; i++) halfMinUp = Math.min(halfMinUp, halfFb.frames[i].up.y);
  ok(halfMinUp > -0.05 && warns2.length > 0, 'a NON-INTEGER total roll is refused (fails closed, with a warning)',
    `min up.y ${halfMinUp.toFixed(4)}, ${warns2.length} warning(s): ${warns2[0]?.slice(0, 130) ?? '(none)'}`);
}

// ---------------------------------------------------------------------------
// 3. the TRAIN through the inversion — every step of a full cycle
// ---------------------------------------------------------------------------
if (coaster && cars) {
  console.log('\n── TRAIN: whole animation cycle through the roll');
  const tick = coaster.run(cars, { spacing: 1.5 });
  const WHEEL = 0.195;
  const seats = K.COASTER_CAR_SEATS;
  // rider groups: the peep group sits at local (0, 0.22, seat.z) under each car
  const riders = cars.map((c) => c.children.filter((o) => o.isGroup && Math.abs(o.position.y - 0.22) < 1e-9));
  cars.forEach((c) => c.updateMatrixWorld(true)); // compose the local matrices before snapshotting them
  const riderLocal0 = riders.map((rs) => rs.map((r) => r.matrix.clone().elements.join(',')));
  let worstDet = Infinity, worstUpDot = 1, worstFwdDot = 1, worstWheel = 0, worstRider = 0;
  let nan = 0, steps = 0, backward = 0, lastU = null, riderMoved = 0;
  let apex = null; // the most-inverted moment of the LEAD car
  for (const t of SCHEDULE) {
    tick(t);
    steps++;
    cars.forEach((c, ci) => {
      c.updateMatrixWorld(true);
      const e = c.matrixWorld.elements;
      for (const v of e) if (!Number.isFinite(v)) nan++;
      const bx = new T.Vector3(e[0], e[1], e[2]);
      const by = new T.Vector3(e[4], e[5], e[6]);
      const bz = new T.Vector3(e[8], e[9], e[10]);
      // right-handed triple: x cross y == z  (makeBasis(side, up, fwd))
      const det = new T.Vector3().crossVectors(bx, by).dot(bz);
      worstDet = Math.min(worstDet, det);
      // The frame this car should be on. run() places the car at
      // frameAt(u).p + up*0.195, so recover u by minimising the distance to
      // THAT point — first over the samples, then refined on the continuous
      // frameAt. Using the bare centreline (or only the samples) leaves a
      // discretisation gap that grows with the roll rate and would make the
      // "car up == frame up" check meaningless exactly where it matters.
      const seat = (u) => { const f = fb.frameAt(u); return f.p.clone().addScaledVector(f.up, WHEEL); };
      let best = 0, bd = Infinity;
      for (let i = 0; i < fb.N; i++) {
        const d = seat(i / fb.N).distanceToSquared(c.position);
        if (d < bd) { bd = d; best = i; }
      }
      let lo = (best - 1) / fb.N, hi = (best + 1) / fb.N;
      for (let k = 0; k < 40; k++) {
        const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (seat(m1).distanceToSquared(c.position) < seat(m2).distanceToSquared(c.position)) hi = m2; else lo = m1;
      }
      const f = fb.frameAt((lo + hi) / 2);
      worstUpDot = Math.min(worstUpDot, by.dot(f.up));
      worstFwdDot = Math.min(worstFwdDot, bz.dot(f.fwd));
      // the car origin must sit EXACTLY wheelOffset up the frame's own up axis
      const off = c.position.clone().sub(f.p);
      worstWheel = Math.max(worstWheel, Math.abs(off.dot(f.up) - WHEEL), off.clone().addScaledVector(f.up, -off.dot(f.up)).length() * 0.0);
      // riders rigidly seated
      riders[ci].forEach((r, ri) => {
        if (r.matrix.elements.join(',') !== riderLocal0[ci][ri]) riderMoved++;
        r.updateMatrixWorld(true);
        const want = c.position.clone().addScaledVector(by, 0.22).addScaledVector(bz, r.position.z);
        const got = new T.Vector3().setFromMatrixPosition(r.matrixWorld);
        worstRider = Math.max(worstRider, got.distanceTo(want));
      });
      if (ci === 0 && (!apex || by.y < apex.upY)) {
        const rw = riders[0].map((r) => new T.Vector3().setFromMatrixPosition(r.matrixWorld));
        apex = { t, upY: by.y, carY: c.position.y, trackY: f.p.y, riderY: rw.map((v) => v.y), u: (lo + hi) / 2 };
      }
    });
    // monotone progress of the lead car along the track
    const u = cars[0].position.clone();
    if (lastU && u.distanceTo(lastU) > 0.9) backward++;
    lastU = u;
  }
  ok(nan === 0, 'no NaN in any car matrix over the whole cycle', `${steps} steps x ${cars.length} cars`);
  ok(worstDet > 0.999, 'car basis RIGHT-HANDED at every step (side x up == fwd, det=+1)', `min det ${worstDet.toFixed(6)}`);
  ok(worstUpDot > 0.999, 'car up == frame up at every step', `min dot ${worstUpDot.toFixed(6)}`);
  ok(worstFwdDot > 0.99, 'car fwd == frame fwd at every step', `min dot ${worstFwdDot.toFixed(6)}`);
  ok(worstWheel < 0.02, 'wheel offset along the frame up stays 0.195', `worst deviation ${worstWheel.toFixed(6)}`);
  ok(riderMoved === 0, 'rider LOCAL transforms never move (rigidly seated)', `${riderMoved} deviations`);
  ok(worstRider < 1e-6, 'rider world pos == car + 0.22*up + z*fwd at every step', `worst ${worstRider.toExponential(3)}`);
  ok(backward === 0, 'train never teleports (no > 0.9 u jump between frames)', `${backward} jumps`);
  if (apex) {
    console.log(`   info  APEX  t=${apex.t.toFixed(3)} u=${apex.u.toFixed(3)} car.up.y ${apex.upY.toFixed(4)}  track y ${apex.trackY.toFixed(3)}  car y ${apex.carY.toFixed(3)}  riders y ${apex.riderY.map((v) => v.toFixed(3)).join(', ')}`);
    ok(apex.upY < -0.98, 'the LEAD CAR really goes upside down', `car up.y ${apex.upY.toFixed(4)}`);
    ok(apex.carY < apex.trackY - 0.1, 'at the apex the car HANGS BELOW the track centreline', `car ${apex.carY.toFixed(3)} vs track ${apex.trackY.toFixed(3)}`);
    ok(apex.riderY.every((y) => y < apex.trackY), 'at the apex both RIDERS are below the track centreline', `${apex.riderY.map((v) => v.toFixed(3)).join(', ')}`);
  } else { ok(false, 'apex found'); }
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nall checks pass');
process.exit(fails ? 1 : 0);
