#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-exit-lane.mjs — the RCT2 ENTRANCE/EXIT ADJACENCY + EXIT-LANE audit.
//
// RCT2 puts a ride's entrance and exit on ADJACENT tiles of the same station
// face, both facing OUTWARD: a QUEUE path leads into the entrance and an
// ORDINARY FOOTPATH leads out of the exit. This probe measures, per registered
// ride, whether the design system actually produced that shape:
//
//   * entrance hut / exit hut centre + facing (from manager.footprints())
//   * SAME-FACE?  the two doorway facings within ~15deg of each other
//   * ADJACENT?   along-face separation (want ~1 tile = 1.2 u), across-face
//                 offset (want ~0 — both flush on the same pad edge)
//   * exit -> PAVING: distance from the exit hut to the nearest RENDERED
//     street node / edge centreline, and to the ride's own exit lane if it has
//     one. "STRANDED" = no exit lane AND > 1.2 u of bare ground to the street.
//
//   node probe-exit-lane.mjs <park.tsx> [<park2.tsx> …] [--secs=0]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { bundleParkPage, openParkPage } from './evaltags.mjs';

const MEASURE = () => {
  const store = window.__evalPark;
  if (!store) return { error: 'no __evalPark store' };
  const mgr = store.manager();
  const net = store.paths ? store.paths.net : null;
  const n0 = store.paths ? store.paths.streetNodes : 0;
  const foot = mgr.footprints ? mgr.footprints() : [];
  const ap = mgr.accessPoints ? mgr.accessPoints() : { rides: [], entranceNode: -1 };
  const segD = (ax, az, bx, bz, x, z) => {
    const vx = bx - ax;
    const vz = bz - az;
    const L2 = vx * vx + vz * vz;
    const u = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)) : 0;
    return Math.hypot(x - (ax + u * vx), z - (az + u * vz));
  };
  const toStreet = (x, z) => {
    if (!net) return Infinity;
    let best = Infinity;
    for (let i = 0; i < Math.min(n0, net.nodes.length); i += 1) best = Math.min(best, Math.hypot(net.nodes[i][0] - x, net.nodes[i][1] - z));
    net.edges.forEach(([a, b]) => {
      if (a >= n0 || b >= n0) return;
      best = Math.min(best, segD(net.nodes[a][0], net.nodes[a][1], net.nodes[b][0], net.nodes[b][1], x, z));
    });
    return best;
  };
  const named = (name, suffix) => foot.find((f) => f.label === `${name} ${suffix}`) || null;
  const rides = ap.rides.map((r) => {
    const ent = named(r.name, 'entrance hut');
    const ex = named(r.name, 'exit hut');
    const lane = named(r.name, 'queue lane');
    const exLane = named(r.name, 'exit lane');
    const out = { name: r.name, queueNode: r.queueNode, exitNode: r.exitNode, hasExitLane: !!exLane };
    if (!ent || !ex) return { ...out, error: 'no entrance/exit hut footprint' };
    // hut yaw = doorway facing (local +z)
    const fwd = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
    const eF = fwd(ent.yaw);
    const xF = fwd(ex.yaw);
    const dot = eF[0] * xF[0] + eF[1] * xF[1];
    const dx = ex.cx - ent.cx;
    const dz = ex.cz - ent.cz;
    // decompose the entrance->exit offset in the ENTRANCE face frame
    const along = Math.abs(-dx * eF[1] + dz * eF[0]); // across the facing = along the face
    const across = dx * eF[0] + dz * eF[1]; // along the facing = out from the face
    out.entrance = [+ent.cx.toFixed(2), +ent.cz.toFixed(2)];
    out.entranceFacing = [+eF[0].toFixed(2), +eF[1].toFixed(2)];
    out.exit = [+ex.cx.toFixed(2), +ex.cz.toFixed(2)];
    out.exitFacing = [+xF[0].toFixed(2), +xF[1].toFixed(2)];
    out.sameFaceDot = +dot.toFixed(3);
    out.alongFace = +along.toFixed(2);
    out.acrossFace = +across.toFixed(2);
    out.sameFace = dot > 0.966; // within 15deg
    out.adjacent = out.sameFace && along <= 1.85 && Math.abs(across) <= 0.85;
    out.exitToStreet = +toStreet(ex.cx, ex.cz).toFixed(2);
    out.laneTailToStreet = lane
      ? +toStreet(lane.cx + Math.sin(lane.yaw) * (lane.hz + 0.35), lane.cz + Math.cos(lane.yaw) * (lane.hz + 0.35)).toFixed(2)
      : null;
    if (exLane) {
      out.exitLane = { len: +(exLane.hz * 2).toFixed(2), centre: [+exLane.cx.toFixed(2), +exLane.cz.toFixed(2)] };
      out.exitLaneTailToStreet = +toStreet(
        exLane.cx + Math.sin(exLane.yaw) * exLane.hz,
        exLane.cz + Math.cos(exLane.yaw) * exLane.hz,
      ).toFixed(2);
    }
    // STRANDED: no paved lane out AND more than one tile of bare ground to the street
    out.stranded = !exLane && out.exitToStreet > 1.2;
    return out;
  });
  return { size: store.size, rides };
};

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: node probe-exit-lane.mjs <park.tsx> [more.tsx …]');
  process.exit(1);
}

let strandedTotal = 0;
let rideTotal = 0;
let adjacentTotal = 0;
for (const file of files) {
  const name = path.basename(file).replace(/\.tsx$/, '');
  const html = await bundleParkPage(file, `xl-${name}`);
  const { browser, page, lines } = await openParkPage(html, { waitMs: 90000 });
  const res = await page.evaluate(MEASURE);
  await browser.close();
  const verdict = lines.find((l) => /validatePark →/.test(l)) ?? '(no validatePark line)';
  console.log(`\n=== ${name}   ${verdict.replace(/^\[log\] /, '').slice(0, 160)}`);
  if (res.error) {
    console.log(`  ERROR ${res.error}`);
    continue;
  }
  const fails = lines.filter((l) => /validatePark FAIL/.test(l));
  fails.slice(0, 8).forEach((l) => console.log(`  ${l.slice(0, 220)}`));
  res.rides.forEach((r) => {
    rideTotal += 1;
    if (r.adjacent) adjacentTotal += 1;
    if (r.stranded) strandedTotal += 1;
    if (r.error) {
      console.log(`  ${r.name.padEnd(26)} ERROR ${r.error}`);
      return;
    }
    console.log(
      `  ${r.name.padEnd(26)} ent ${JSON.stringify(r.entrance).padEnd(18)} face ${JSON.stringify(r.entranceFacing).padEnd(14)}` +
        ` exit ${JSON.stringify(r.exit).padEnd(18)} face ${JSON.stringify(r.exitFacing).padEnd(14)}` +
        ` dot ${String(r.sameFaceDot).padStart(6)} along ${String(r.alongFace).padStart(5)} across ${String(r.acrossFace).padStart(6)}` +
        ` | sameFace ${r.sameFace ? 'Y' : 'n'} adjacent ${r.adjacent ? 'Y' : 'n'}` +
        ` | exit→street ${String(r.exitToStreet).padStart(6)}` +
        ` exitLane ${r.exitLane ? `${r.exitLane.len}u → street ${r.exitLaneTailToStreet}` : 'NONE'}` +
        ` ${r.stranded ? '*** STRANDED ***' : ''}`,
    );
  });
}
console.log(
  `\nTOTAL: ${rideTotal} ride(s); ${adjacentTotal} entrance/exit pairs adjacent-and-outward; ${strandedTotal} exit(s) STRANDED on unpaved ground`,
);
