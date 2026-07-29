#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-exit-shot.mjs — RIDE CLOSE-UP + the leaving-guest trace.
//
// Frames one registered ride's ACCESS RIG (entrance hut, exit hut, queue lane,
// exit path) from the park camera and shoots it, then runs the sim on and
// records, for every guest that leaves a ride, whether their walk out actually
// followed the exit path — sampled positions vs the exit lane's own centreline.
//
//   node probe-exit-shot.mjs <park.tsx> [--ride="Name"] [--secs=90] [--out=x.png]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { bundleParkPage, openParkPage, sleep } from './evaltags.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const arg = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
if (!file) {
  console.error('usage: node probe-exit-shot.mjs <park.tsx> [--ride=Name] [--secs=90] [--out=x.png]');
  process.exit(1);
}
const wantRide = arg('ride');
const secs = Number(arg('secs', '90'));
const name = path.basename(file).replace(/\.tsx$/, '');
const outPng = path.resolve(arg('out', path.join(HERE, 'shots', `exit-${name}.png`)));
fs.mkdirSync(path.dirname(outPng), { recursive: true });

const html = await bundleParkPage(file, `xs-${name}`);
const { browser, page, lines } = await openParkPage(html, { waitMs: 90000, echo: false });
await sleep(1200);

// ---- pick the ride + frame its access rig ---------------------------------
const rig = await page.evaluate((want) => {
  const store = window.__evalPark;
  if (!store) return { error: 'no __evalPark store' };
  const mgr = store.manager();
  const ap = mgr.accessPoints();
  const r = (want ? ap.rides.find((x) => x.name === want) : null) ?? ap.rides.find((x) => x.exitLaneLen > 0) ?? ap.rides[0];
  if (!r) return { error: 'no registered rides' };
  const foot = mgr.footprints().filter((f) => f.label.startsWith(`${r.name} `));
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  foot.forEach((f) => {
    const ax = [Math.cos(f.yaw), -Math.sin(f.yaw)];
    const az = [Math.sin(f.yaw), Math.cos(f.yaw)];
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
      const px = f.cx + ax[0] * f.hx * sx + az[0] * f.hz * sz;
      const pz = f.cz + ax[1] * f.hx * sx + az[1] * f.hz * sz;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minZ = Math.min(minZ, pz);
      maxZ = Math.max(maxZ, pz);
    });
  });
  return {
    name: r.name,
    labels: foot.map((f) => f.label),
    entranceAt: r.entranceAt,
    entranceDir: r.entranceDir,
    exitAt: r.exitAt,
    exitDir: r.exitDir,
    exitLaneLen: r.exitLaneLen,
    exitLaneEnd: r.exitLaneEnd,
    box: [minX, minZ, maxX, maxZ],
    y: store.groundAt((minX + maxX) / 2, (minZ + maxZ) / 2),
  };
}, wantRide);

if (rig.error) {
  console.log(`ERROR ${rig.error}`);
  await browser.close();
  process.exit(1);
}

const cx = (rig.box[0] + rig.box[2]) / 2;
const cz = (rig.box[1] + rig.box[3]) / 2;
const span = Math.max(rig.box[2] - rig.box[0], rig.box[3] - rig.box[1], 6);
const dist = span * (Number(arg('zoom', '1.35'))) + 4;
// RCT2's own isometric-ish pitch: ~34deg elevation, 45deg azimuth
await page.evaluate(
  (o) => {
    const { cx, cz, y, dist } = o;
    const api = document.querySelector('canvas').__stageApi;
    const el = (o.elDeg * Math.PI) / 180;
    const az = (o.azDeg * Math.PI) / 180;
    api.setCameraPose(
      [cx + Math.cos(el) * Math.sin(az) * dist, y + Math.sin(el) * dist, cz + Math.cos(el) * Math.cos(az) * dist],
      [cx, y + 0.6, cz],
    );
  },
  { cx, cz, y: rig.y, dist, azDeg: Number(arg('az', '45')), elDeg: Number(arg('el', '34')) },
);
await sleep(900);
await page.screenshot({ path: outPng });

// ---- the leaving-guest trace ----------------------------------------------
// Sample every guest each tick; for anyone in `leavingRide`, measure how far
// they are from the exit path's centreline (the two legs) and from the exit hut.
const trace = await page.evaluate(
  async (o) => {
    const store = window.__evalPark;
    const mgr = store.manager();
    const ap0 = mgr.accessPoints();
    const r = ap0.rides.find((x) => x.name === o.name);
    const foot = mgr.footprints().filter((f) => /exit lane( join)?$/.test(f.label) && f.label.startsWith(`${o.name} `));
    const legs = foot.map((f) => {
      const d = [Math.sin(f.yaw), Math.cos(f.yaw)];
      return { ax: f.cx - d[0] * f.hz, az: f.cz - d[1] * f.hz, bx: f.cx + d[0] * f.hz, bz: f.cz + d[1] * f.hz };
    });
    const segD = (ax, az, bx, bz, x, z) => {
      const vx = bx - ax;
      const vz = bz - az;
      const L2 = vx * vx + vz * vz;
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)) : 0;
      return Math.hypot(x - (ax + u * vx), z - (az + u * vz));
    };
    const toLane = (x, z) => (legs.length ? Math.min(...legs.map((l) => segD(l.ax, l.az, l.bx, l.bz, x, z))) : Infinity);
    // Only guests leaving THIS ride, and only for the walk OUT — the RCT2
    // `leavingRide` state persists after they rejoin the network and pick a new
    // target, so a guest is DROPPED from sampling the moment they reach the
    // point where the exit path meets the street (that walk is over; anything
    // after it is ordinary wandering). A guest first sighted more than a hut's
    // width from THIS exit is leaving some other ride and is ignored outright.
    const end = r ? r.exitLaneEnd : [NaN, NaN];
    const seen = new Map(); // guest id -> { n, sum, worst, done }
    const t0 = performance.now();
    let clock = 0;
    while (clock < o.secs) {
      mgr.update(clock, 1 / 12);
      clock += 1 / 12;
      if (Math.round(clock * 12) % 3 !== 0) continue;
      for (const g of mgr.guests()) {
        if (g.state !== 'leavingRide' || g.hidden || g.gone) continue;
        const [x, , z] = g.position;
        let rec = seen.get(g.id);
        if (!rec) {
          // first sighting: must be stepping out of THIS ride's exit hut
          if (Math.hypot(x - r.exitAt[0], z - r.exitAt[1]) > 1.6) {
            seen.set(g.id, { n: 0, sum: 0, worst: 0, done: true, foreign: true });
            continue;
          }
          rec = { n: 0, sum: 0, worst: 0, done: false, foreign: false };
          seen.set(g.id, rec);
        }
        if (rec.done) continue;
        const d = toLane(x, z);
        rec.n += 1;
        rec.sum += d;
        rec.worst = Math.max(rec.worst, d);
        if (Math.hypot(x - end[0], z - end[1]) < 0.6) rec.done = true; // reached the street
      }
      if (performance.now() - t0 > 120000) break;
    }
    for (const [k, v] of [...seen]) if (v.foreign || v.n === 0) seen.delete(k);
    const recs = [...seen.entries()].map(([id, r2]) => ({ id, n: r2.n, mean: +(r2.sum / r2.n).toFixed(2), worst: +r2.worst.toFixed(2) }));
    return {
      legs: legs.length,
      simSeconds: +clock.toFixed(1),
      riddenTotal: mgr.stats().riddenTotal,
      leavers: recs.length,
      // "on the lane" = never further than half a slab + a guest radius off its
      // centreline (0.275 + 0.20 = 0.475; 0.6 gives a little slack for the
      // doorway apron at the very start of the walk)
      onLane: recs.filter((x) => x.worst <= 0.6).length,
      worstOff: recs.length ? Math.max(...recs.map((x) => x.worst)) : 0,
      sample: recs.slice(0, 10),
      exitNode: r ? r.exitNode : -1,
    };
  },
  { name: rig.name, secs },
);

await browser.close();

console.log(`\n=== ${name}  ride "${rig.name}"`);
console.log(`  footprints: ${rig.labels.join(', ')}`);
console.log(`  entrance ${JSON.stringify(rig.entranceAt)} facing ${JSON.stringify(rig.entranceDir)}`);
console.log(`  exit     ${JSON.stringify(rig.exitAt)} facing ${JSON.stringify(rig.exitDir)}`);
console.log(`  exit path ${rig.exitLaneLen.toFixed(2)} u → meets the street at ${JSON.stringify(rig.exitLaneEnd)} (spur node ${trace.exitNode})`);
console.log(`  shot: ${outPng}`);
console.log(`\n  LEAVING-GUEST TRACE over ${trace.simSeconds} sim-s (${trace.legs} exit-path leg(s)):`);
console.log(`    riddenTotal ${trace.riddenTotal}, guests observed in 'leavingRide': ${trace.leavers}`);
console.log(`    walked ON the exit path (never > 0.6 u off its centreline): ${trace.onLane}/${trace.leavers}`);
console.log(`    worst lateral excursion: ${trace.worstOff.toFixed(2)} u`);
trace.sample.forEach((s) => console.log(`      guest ${s.id}: ${s.n} samples, mean ${s.mean} u off, worst ${s.worst} u`));
const verdict = trace.leavers > 0 && trace.onLane === trace.leavers;
console.log(`\n  ${verdict ? 'PASS' : trace.leavers === 0 ? 'INCONCLUSIVE (nobody finished a ride in the window)' : 'FAIL'} — guests leave along the exit path`);
