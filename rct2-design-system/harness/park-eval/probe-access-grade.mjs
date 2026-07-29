#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-access-grade.mjs — THE STEP AT THE STREET, and whether an exit path
// is actually a ROAD.
//
// Three complaints, measured off the BUILT MESHES (a downward ray into the
// manager's own group), never off the arithmetic that produced them:
//
//   1. ELEVATION. A ride's queue lane is pinned at the ride pad and its exit
//      path at the exit hut, but both have to land on the street lattice, which
//      is solved to its own levels. Both used to be dead-flat slabs, so the
//      whole difference collected as a STEP where they meet the pavement.
//      Measured: the rendered surface at the far end of each run vs
//      `paths.walkYAt` at the street point it joins.
//
//   2. IS IT A ROAD? A street here is a pave slab + pale KERBS straddling both
//      edges 0.01 proud + expansion seams; the exit path had only the slab.
//      Measured: a lateral profile across the run — a road shows two lips
//      ~0.01 above the wearing course at ±(W/2 + 0.02) = ±0.295.
//
//   3. BENCHES. Do guests actually SIT on them? Steps the sim and counts
//      guests in state 'sitting' whose position lands on a published seat.
//
// Every number can go the other way: revert the `tailY`/`endY` ramps and the
// steps go non-zero; revert the kerbs and the lateral profile goes flat;
// revert the bench routing and `satOnBench` goes 0.
//
//   node probe-access-grade.mjs <park.tsx> [--secs=90]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { bundleParkPage, openParkPage } from './evaltags.mjs';

const MEASURE = (simSecs) => {
  const store = window.__evalPark;
  if (!store) return { error: 'no __evalPark store' };
  const THREE = store.three;
  const mgr = store.manager();
  const walkY = (x, z) => store.paths.walkYAt(x, z);
  const rc = new THREE.Raycaster();
  rc.far = 400;
  const DOWN = new THREE.Vector3(0, -1, 0);
  /** the top rendered surface at (x, z) inside the manager's own group — the
   *  ride access rigs (lanes, huts, exit paths, berms) all live there */
  const topAt = (x, z) => {
    rc.set(new THREE.Vector3(x, 80, z), DOWN);
    const hits = rc.intersectObject(mgr.group, true).filter((h) => h.object.visible);
    return hits.length ? hits[0].point.y : null;
  };
  /** what the top ray actually HIT — used only when a kerb reads flat, so the
   *  dump names the mesh instead of leaving us guessing */
  const topHit = (x, z) => {
    rc.set(new THREE.Vector3(x, 80, z), DOWN);
    const hits = rc.intersectObject(mgr.group, true).filter((h) => h.object.visible);
    if (!hits.length) return null;
    const m = hits[0].object.material;
    const col = m && m.color ? `#${m.color.getHexString()}` : '?';
    return { y: +hits[0].point.y.toFixed(4), col, geo: hits[0].object.geometry?.type ?? '?', n: hits.length };
  };

  const foot = mgr.footprints ? mgr.footprints() : [];
  // the ride's OWN idea of where its exit run ends (`r.exitOut`), so a run whose
  // audited FOOTPRINT has drifted from the mesh can be told apart from a run
  // that was never built — the ray missing tells you nothing on its own
  const ap = mgr.accessPoints ? mgr.accessPoints() : { rides: [] };
  const laneEnds = new Map();
  for (const r of ap.rides) {
    laneEnds.set(`${r.name} exit lane`, r.exitLaneEnd);
    for (const st of r.stations ?? []) laneEnds.set(`${st.label} exit lane`, st.exitLaneEnd);
  }
  const runs = [];
  for (const f0 of foot) {
    const kind = /queue lane$/.test(f0.label) ? 'queue' : /exit lane$/.test(f0.label) ? 'exit' : null;
    if (!kind) continue;
    // an L-shaped exit path is TWO audited legs (`… exit lane` + `… exit lane
    // join`); the street is at the far end of the SECOND one, so measure the
    // step there and take the lateral profile off the first leg's middle
    const join = kind === 'exit' ? foot.find((q) => q.label === `${f0.label} join`) : null;
    const f = f0;
    const endLeg = join ?? f0;
    // the rect's local +z is its yaw facing and hz its half-length; for a queue
    // lane that runs HEAD (ride) → TAIL (street), for an exit lane hut → street
    const dx = Math.sin(f.yaw);
    const dz = Math.cos(f.yaw);
    const edx = Math.sin(endLeg.yaw);
    const edz = Math.cos(endLeg.yaw);
    const nearX = f.cx - dx * f.hz;
    const nearZ = f.cz - dz * f.hz;
    const farX = endLeg.cx + edx * endLeg.hz;
    const farZ = endLeg.cz + edz * endLeg.hz;
    // sample the run's own surface just INSIDE each end (a ray exactly on the
    // end plane can miss), and the street a third of a tile beyond the far end
    const nearY = topAt(nearX + dx * 0.12, nearZ + dz * 0.12);
    const farY = topAt(farX - edx * 0.12, farZ - edz * 0.12);
    const street = walkY(farX + edx * 0.35, farZ + edz * 0.35);
    // LATERAL PROFILE across the run — is there a kerb?
    //
    // Taken at THREE longitudinal offsets, because an EXPANSION SEAM spans the
    // full lane width and stands 0.003 proud of the wearing course: a profile
    // that lands on one raises the whole cross-section, the centreline
    // reference goes up with it, and a perfectly good 0.01 kerb reads as 0.001.
    // Seams are laid every 0.5, so no set of offsets 0.17 apart can all land on
    // one, and the lip is the best reading of the three.
    const profileAt = (off) => {
      const out = [];
      for (let lat = -0.42; lat <= 0.4201; lat += 0.02) {
        const y = topAt(f.cx + Math.cos(f.yaw) * lat + dx * off, f.cz - Math.sin(f.yaw) * lat + dz * off);
        out.push({ lat: +lat.toFixed(2), y });
      }
      return out;
    };
    const profiles = [0, 0.17, -0.17].map(profileAt);
    const prof = profiles[0];
    /** the kerb lip on one side: how far the slab EDGE stands above the
     *  wearing course at the same station along the run */
    const lipIn = (p, sign) => {
      const centre = p.find((q) => Math.abs(q.lat) < 0.005)?.y ?? null;
      if (centre == null) return null;
      let best = -Infinity;
      for (const q of p)
        if (Math.sign(q.lat) === sign && Math.abs(q.lat) >= 0.24 && Math.abs(q.lat) <= 0.36 && q.y != null) best = Math.max(best, q.y);
      return best > -Infinity ? best - centre : null;
    };
    const centre = prof.find((p) => Math.abs(p.lat) < 0.005)?.y ?? null;
    const lip = (sign) => {
      const vals = profiles.map((p) => lipIn(p, sign)).filter((v) => v != null);
      return vals.length ? +Math.max(...vals).toFixed(4) : null;
    };
    runs.push({
      label: f.label,
      kind,
      len: +(f.hz * 2).toFixed(2),
      nearY: nearY == null ? null : +nearY.toFixed(3),
      farY: farY == null ? null : +farY.toFixed(3),
      street: +street.toFixed(3),
      // the DEFECT: how far the run's far end is from the street it joins
      step: farY == null ? null : +(farY - street).toFixed(3),
      // how much the run itself climbs — 0 means it is still a flat slab
      rise: nearY == null || farY == null ? null : +(farY - nearY).toFixed(3),
      kerbL: lip(-1),
      kerbR: lip(1),
      // how far the audited footprint's far end is from where the ride says its
      // exit run actually ends — non-zero means the RECT has drifted off the
      // mesh, which is an audit defect, not a missing road
      drift: (() => {
        const e = laneEnds.get(f0.label);
        return e ? +Math.hypot(e[0] - farX, e[1] - farZ).toFixed(2) : null;
      })(),
      prof: prof.map((p) => (p.y == null ? null : +(p.y - (centre ?? 0)).toFixed(3))),
      hits: [0, 0.26, 0.295, 0.33].map((lat) => ({
        lat,
        hit: topHit(f.cx + Math.cos(f.yaw) * lat, f.cz - Math.sin(f.yaw) * lat),
      })),
    });
  }

  // ---- BENCHES -------------------------------------------------------------
  const seats = store.paths.benches ?? [];
  // run the sim forward so the rest impulse has time to fire
  const DT = 1 / 30;
  let t = mgr.simTime ? mgr.simTime() : 0;
  let satOnBenchPeak = 0;
  let sittingPeak = 0;
  const seatsUsed = new Set();
  for (let i = 0; i < Math.round(simSecs / DT); i += 1) {
    t += DT;
    mgr.update(t, DT);
    if (i % 15 !== 0) continue;
    const recs = mgr.guests();
    let sitting = 0;
    let onBench = 0;
    for (const g of recs) {
      if (g.state !== 'sitting' || g.gone) continue;
      sitting += 1;
      for (let k = 0; k < seats.length; k += 1) {
        const s2 = seats[k];
        if (Math.hypot(s2.x - g.position[0], s2.z - g.position[2]) < 0.22) {
          onBench += 1;
          seatsUsed.add(k);
          break;
        }
      }
    }
    sittingPeak = Math.max(sittingPeak, sitting);
    satOnBenchPeak = Math.max(satOnBenchPeak, onBench);
  }
  return {
    runs,
    benches: { seats: seats.length, distinctSeatsUsed: seatsUsed.size, sittingPeak, satOnBenchPeak, simSecs },
  };
};

const args = process.argv.slice(2);
const secs = Number((args.find((a) => a.startsWith('--secs=')) ?? '--secs=90').split('=')[1]);
const parks = args.filter((a) => !a.startsWith('--'));
if (!parks.length) {
  console.error('usage: node probe-access-grade.mjs <park.tsx> [--secs=90]');
  process.exit(2);
}

let bad = 0;
for (const p of parks) {
  const src = path.resolve(HERE, p);
  if (!fs.existsSync(src)) {
    console.error(`missing ${p}`);
    bad += 1;
    continue;
  }
  const name = path.basename(p, '.tsx');
  const html = await bundleParkPage(src, `grade-${name}`);
  const { browser, page, lines } = await openParkPage(html, { waitMs: 90000 });
  const out = await page.evaluate(MEASURE, secs);
  await browser.close();
  const verdict = lines.find((l) => /validatePark →/.test(l)) ?? '(no validatePark line)';
  console.log(`\n${verdict.replace(/^\[log\] /, '').slice(0, 160)}`);
  if (out.error) {
    console.error(`${name}: ${out.error}`);
    bad += 1;
    continue;
  }
  console.log(`\n=== ${name}`);
  console.log('  run                                    len   nearY   farY  street    STEP   rise   kerbL  kerbR  drift');
  let worstStep = 0;
  let flatRoads = 0;
  let driftedRects = 0;
  const dumps = [];
  for (const r of out.runs) {
    // A run whose audited RECT has drifted off its own mesh cannot be measured
    // from that rect, and the drift is a separate (pre-existing) defect:
    // `moveRide` calls `replanExitLane` — which re-adds the exit-lane rects at
    // their new world position — and only THEN shifts every `${name} `
    // footprint by the same delta, so those rects get the move applied twice.
    const drifted = r.kind === 'exit' && r.drift != null && r.drift > 0.3;
    if (drifted) driftedRects += 1;
    if (r.step != null && !drifted) worstStep = Math.max(worstStep, Math.abs(r.step));
    if (r.kind === 'exit' && !drifted && !(r.kerbL > 0.004 && r.kerbR > 0.004)) {
      flatRoads += 1;
      dumps.push(
        `  ${r.label}: lateral profile (lat −0.42 → +0.42 step 0.02, relative to the centreline)\n    ${r.prof.join(' ')}\n` +
          `    top hits: ${r.hits.map((h) => `lat ${h.lat} → ${h.hit ? `${h.hit.y} ${h.hit.col} (${h.hit.n} hits)` : 'MISS'}`).join(' | ')}`,
      );
    }
    console.log(
      `  ${r.label.padEnd(36)} ${String(r.len).padStart(5)} ${String(r.nearY).padStart(7)} ${String(r.farY).padStart(6)} ${String(
        r.street,
      ).padStart(7)} ${String(r.step).padStart(7)} ${String(r.rise).padStart(6)} ${String(r.kerbL).padStart(7)} ${String(r.kerbR).padStart(6)} ${String(
        r.drift,
      ).padStart(6)}`,
    );
  }
  dumps.forEach((d) => console.log(d));
  const b = out.benches;
  console.log(
    `\n  worst STEP at the street: ${worstStep.toFixed(3)} u   (want < 0.05 — a slab thickness is 0.09)` +
      `\n  exit paths with NO kerb:  ${flatRoads}   (want 0 — an exit path is a road)` +
      `\n  audited rects OFF their mesh: ${driftedRects}   (moveRide double-shifts exit-lane rects — PRE-EXISTING, reported not gated)` +
      `\n  benches: ${b.seats} seats · peak ${b.satOnBenchPeak} guests sat ON one (${b.distinctSeatsUsed} distinct seats used) of ${b.sittingPeak} resting, over ${b.simSecs}s`,
  );
  const ok = worstStep < 0.05 && flatRoads === 0 && (b.seats === 0 || b.satOnBenchPeak > 0);
  console.log(`\n  VERDICT  ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) bad += 1;
}
process.exit(bad ? 1 : 0);
