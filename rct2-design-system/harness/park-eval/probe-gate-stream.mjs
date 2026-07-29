#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-gate-stream.mjs — MEASURES the two guest-population changes:
//
//   1. how much a bigger OPENING POPULATION costs (sim-ms per frame) and how
//      it shifts validatePark's 60-sim-s smoke gate (first completed cycle);
//   2. whether the GATE STREAM (continued arrivals gated on aggregate guest
//      happiness) actually grows a happy park and stalls/drains an unhappy
//      one, and where the size-scaled ceiling lands.
//
// Method, deliberately the same as probe-sim-reach.mjs: no browser, no React,
// no terrain — the REAL `createGameManager` on a synthetic street graph, driven
// by validatePark's own smoke loop (dt = 1/30, absolute time).
//
//   node probe-gate-stream.mjs perf     [--guests=12,25,50,75,100,150]
//   node probe-gate-stream.mjs arrivals [--secs=600] [--guests=50]
//                                    [--scen=pleasant,starved,mobbed,miserable]
//   node probe-gate-stream.mjs rule     [--n=50]   # the analytic happiness gate
//   node probe-gate-stream.mjs curve               # guests/ceiling vs plot size
//   node probe-gate-stream.mjs gate     [--guests=12,50,100] [--d=6,15,30]
//   node probe-gate-stream.mjs all
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { HERE, REPO } from './paths.mjs';

// ---- minimal DOM stub (guest rigs paint canvas textures) -------------------
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
const mode = process.argv[2] ?? 'all';
const nums = (s) => String(s).split(',').map(Number);

// ---- bundle the sim for node ----------------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_gate-stream.ts');
fs.writeFileSync(
  ep,
  `
import { createGameManager } from ${JSON.stringify(path.join(REPO, 'components/GameManager'))};
import { SIM_SMOKE_SECONDS } from ${JSON.stringify(path.join(REPO, 'components/ParkBuilder'))};
export { createGameManager, SIM_SMOKE_SECONDS };
export * as PR from ${JSON.stringify(path.join(REPO, 'components/Park/parkRoot'))};
`,
);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three', 'react', 'react-dom', 'react-dom/client'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_gate-stream.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { createGameManager, SIM_SMOKE_SECONDS, PR } = await import(bundlePath);

const CELL = 1.2;
const laneLenOf = (c) => Math.max(2.2, 0.6 + c * 2 * 0.28 + 0.5);

/**
 * A synthetic but REALISTIC park: a spine running south from the gate with
 * `rides` queue tails hung off alternating side stubs, plus food/drink stalls,
 * bins and a restroom, so the needs clock has somewhere to send everyone.
 * `size` only sets the gate cell (like <Park>'s composed gate at z=size/2−1.2).
 */
function buildPark({ size = 128, rides = 6, stalls = 3, dist = 15, dur = 10, cap = 8, guests = 12, arrivals, price = 0, bins = true } = {}) {
  const gateZ = size / 2 - CELL;
  const spineLen = Math.max(dist + 8, 40);
  const steps = Math.round(spineLen / CELL);
  const nodes = [];
  for (let i = 0; i <= steps; i += 1) nodes.push([0, +(gateZ - i * CELL).toFixed(4)]);
  const edges = nodes.slice(1).map((_n, i) => [i, i + 1]);
  // side stubs: one per ride/stall, two cells east or west off the spine
  const stubAt = [];
  const need = rides + stalls + 1;
  for (let k = 0; k < need; k += 1) {
    const along = Math.max(1, Math.round((dist + k * 3.6) / CELL));
    const sgn = k % 2 === 0 ? 1 : -1;
    const base = Math.min(along, steps);
    let prev = base;
    for (let j = 1; j <= 2; j += 1) {
      nodes.push([+(sgn * j * CELL).toFixed(4), nodes[base][1]]);
      edges.push([prev, nodes.length - 1]);
      prev = nodes.length - 1;
    }
    stubAt.push({ node: prev, x: nodes[prev][0], z: nodes[prev][1], sgn });
  }
  const mgr = createGameManager(THREE, {
    net: { nodes, edges },
    groundAt: () => 0,
    bins: bins ? stubAt.slice(0, 3).map((s) => [s.x, s.z + 0.9]) : [],
    ...(arrivals === undefined ? {} : { arrivals }),
  });
  mgr.registerParkEntrance({ spawnPoint: [0, 0, 0.6], archway: [0, 0, 0] }, { position: [0, 0, gateZ], yaw: 0 });
  for (let k = 0; k < rides; k += 1) {
    const st = stubAt[k];
    const join = laneLenOf(cap) + 0.35;
    const head = [st.x + st.sgn * join, st.z];
    const pad = [head[0] + st.sgn * 5.4, st.z];
    mgr.registerRide({
      name: `Ride ${k + 1}`,
      capacity: cap,
      rideDuration: dur,
      queueAnchor: [head[0], 0, head[1]],
      queueDir: [-st.sgn, 0],
      boardPoint: [pad[0], 0.6, pad[1]],
      exitPoint: [pad[0], 0, pad[1] + 2.4],
      intensity: 2 + (k % 7),
      price,
    });
  }
  const kinds = ['food', 'drink', 'food', 'drink', 'balloon'];
  for (let k = 0; k < stalls; k += 1) {
    const st = stubAt[rides + k];
    mgr.registerStall({
      name: `Stall ${k + 1}`,
      item: kinds[k % kinds.length],
      anchor: [st.x + st.sgn * 1.6, 0, st.z],
      dir: [-st.sgn, 0],
      price: 4,
      value: 6,
    });
  }
  const rr = stubAt[rides + stalls];
  mgr.registerRestroom({ anchor: [rr.x + rr.sgn * 1.6, 0, rr.z], doorway: [rr.x, 0, rr.z] });
  mgr.spawnGuests(guests);
  return mgr;
}

/** run `secs` of sim at validatePark's dt, sampling every `every` sim-s.
 *  `warm` sim-s are run FIRST and excluded from the timing — the opening
 *  cohort enters the gate staggered, so a cold 60 s window would time a park
 *  that is still mostly outside the arch. */
function run(mgr, secs, every = 0, warm = 0) {
  const dt = 1 / 30;
  if (warm) for (let s = 1; s <= Math.round(warm / dt); s += 1) mgr.update(s * dt, dt);
  const t00 = warm;
  const steps = Math.round(secs / dt);
  const stride = every ? Math.round(every / dt) : 0;
  const samples = [];
  let firstRide = null;
  const t0 = process.hrtime.bigint();
  for (let s = 1; s <= steps; s += 1) {
    const time = t00 + s * dt;
    mgr.update(time, dt);
    if (firstRide === null && s % 15 === 0 && mgr.stats().riddenTotal >= 1) firstRide = time;
    if (stride && s % stride === 0) {
      const st = mgr.stats();
      samples.push({
        t: +time.toFixed(1),
        pop: st.activeGuests,
        happy: +st.avgHappiness.toFixed(1),
        rating: st.parkRating ?? null,
        prob: st.guestGenerationProbability ?? null,
        arrived: st.arrivals ?? null,
        ridden: st.riddenTotal,
        litter: st.litterCount,
      });
    }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ms, steps, msPerStep: ms / steps, firstRide, samples, stats: mgr.stats() };
}

const F = (n, w = 6, d = 1) => String(n === null || n === undefined ? '—' : typeof n === 'number' ? n.toFixed(d) : n).padStart(w);

if (mode === 'perf' || mode === 'all') {
  const list = nums(arg('guests', '12,25,50,75,100,150'));
  const secs = Number(arg('secs', '60'));
  console.log(`\n=== PERF: sim cost vs opening population (size 128 park, 6 rides / 3 stalls, ${secs} sim-s @ dt 1/30)`);
  console.log('  guests |  total ms |  ms/frame | budget@60fps | ridden | pop@end | happy@end');
  console.log('  -------+-----------+-----------+--------------+--------+---------+----------');
  for (const g of list) {
    const mgr = buildPark({ guests: g, arrivals: { enabled: false } });
    const r = run(mgr, secs, 0, Number(arg('warm', '150')));
    const pct = (r.msPerStep / (1000 / 60)) * 100;
    console.log(
      `  ${F(g, 6, 0)} | ${F(r.ms, 9)} | ${F(r.msPerStep, 9, 3)} | ${F(pct, 11, 1)}% | ${F(r.stats.riddenTotal, 6, 0)} | ${F(
        r.stats.activeGuests, 7, 0,
      )} | ${F(r.stats.avgHappiness, 9)}`,
    );
  }
}

if (mode === 'gate' || mode === 'all') {
  const list = nums(arg('guests', '12,22,50,75,100'));
  const dists = nums(arg('d', '6,15,30'));
  const dur = Number(arg('dur', '10'));
  const W = Math.max(SIM_SMOKE_SECONDS, Math.ceil(2.5 * dur + 20));
  console.log(`\n=== SMOKE GATE: sim-s to the FIRST completed ride cycle (window = ${W} s, rideDuration ${dur})`);
  console.log('  guests |' + dists.map((d) => ` gate→tail ${String(d).padStart(3)}u`.padEnd(17) + '|').join(''));
  for (const g of list) {
    let row = `  ${F(g, 6, 0)} |`;
    for (const d of dists) {
      const mgr = buildPark({ guests: g, dist: d, dur, arrivals: { enabled: false } });
      const r = run(mgr, W);
      row += ` ${r.firstRide === null ? '   FAIL (none) ' : `${F(r.firstRide, 7)} s  ${r.firstRide <= W ? 'ok' : 'LATE'}`.padEnd(15)} |`;
    }
    console.log(row);
  }
  console.log('  (with the gate stream ON, same run — arrivals must not push the first cycle out)');
  for (const g of list) {
    let row = `  ${F(g, 6, 0)} |`;
    for (const d of dists) {
      const mgr = buildPark({ guests: g, dist: d, dur });
      const r = run(mgr, W);
      row += ` ${r.firstRide === null ? '   FAIL (none) ' : `${F(r.firstRide, 7)} s  ${r.firstRide <= W ? 'ok' : 'LATE'}`.padEnd(15)} |`;
    }
    console.log(row);
  }
}

if (mode === 'arrivals' || mode === 'all') {
  const secs = Number(arg('secs', '600'));
  const g0 = Number(arg('guests', '50'));
  console.log(`\n=== GATE STREAM: population over ${secs} sim-s, opening ${g0} guests`);
  for (const scen of String(arg('scen', 'pleasant,starved,mobbed')).split(',')) {
    // 'starved': no stalls, no restroom-reachable needs relief and ONE ride —
    // appetites go unmet, happiness falls, the leave roll fires
    // 'starved'  — ONE ride, no stalls: RCT2's suggestedGuestMaximum (Σ ride
    //              BonusValue) is tiny, so the probability is quartered
    // 'miserable' — rides nobody can afford (price 25 vs 40-130 cash) and no
    //              bins, so refusal thoughts (-8 happiness each) and litter
    //              pile up: the rating's guest + litter halves both collapse
    const mgr = scen === 'pleasant'
      ? buildPark({ guests: g0, rides: 6, stalls: 3 })
      : scen === 'starved'
        ? buildPark({ guests: g0, rides: 1, stalls: 0 })
        : scen === 'miserable'
          ? buildPark({ guests: g0, rides: 6, stalls: 3, price: Number(arg('price', '25')), bins: false })
          // 'mobbed' — ONE 1-seat 40 s ride for the whole park: the queue never
          // advances, QUEUE_UNHAPPY_AT drains −4 happiness per 512-tick cycle
          // (needs.ts, Guest.cpp:1240) and the crowd sours for RCT2's own reason
          : buildPark({ guests: g0, rides: 1, stalls: 0, cap: 1, dur: 40, bins: false });
    const r = run(mgr, secs, 60);
    console.log(`\n  -- ${scen} park`);
    console.log('       t |    pop |  happy | rating |  prob | arrived | ridden | litter');
    for (const s of r.samples)
      console.log(
        `  ${F(s.t, 6)} | ${F(s.pop, 6, 0)} | ${F(s.happy, 6)} | ${F(s.rating, 6, 0)} | ${F(s.prob, 5, 0)} | ${F(
          s.arrived, 7, 0,
        )} | ${F(s.ridden, 6, 0)} | ${F(s.litter, 6, 0)}`,
      );
  }
}

if (mode === 'curve' || mode === 'all') {
  console.log('\n=== CURVE: <Park guests> / ceiling as a function of plot size');
  console.log('  size | guests | ceiling');
  for (const s of [16, 24, 32, 48, 64, 96, 128, 160, 192, 256]) {
    const g = PR.guestsForSize ? PR.guestsForSize(s) : '—';
    const c = PR.guestCapForSize ? PR.guestCapForSize(s) : '—';
    console.log(`  ${F(s, 4, 0)} | ${F(g, 6, 0)} | ${F(c, 7, 0)}`);
  }
}

if (mode === 'rule' || mode === 'all') {
  // the ANALYTIC gate — mirrors GameManager/arrivals.ts (RCT2 Park.cpp:391,
  // 410-415, 439-445, 475-483 + 168-218) for a park of N guests whose rides are
  // all open and whose paths are clean, as a function of the HAPPY FRACTION
  // (RCT2's "happy" is happiness > 128, Park.cpp:404)
  const N = Number(arg('n', '50'));
  const ratingAt = (frac) => {
    const happy = Math.round(frac * N);
    let r = 1150 - (150 - Math.min(2000, N) / 13) - 500;
    if (N > 0) r += 2 * Math.min(250, Math.floor((happy * 300) / N));
    r -= 200;
    r += 200; // all rides open (uptime 100)
    r -= 100; // no MEASURED ride ratings -> RCT2's RideHasRatings gate skips
    r -= 200; //   the balance bonus and the excitement/intensity total
    r -= 600 - 4 * 150; // no litter
    return Math.max(0, Math.min(999, Math.round(r)));
  };
  const probAt = (r, over) => {
    const p = 50 + Math.max(0, Math.min(650, r - 200));
    return over ? Math.floor(p / 4) : p;
  };
  console.log(`\n=== THE HAPPINESS GATE (analytic, N = ${N} guests, rides open, paths clean)`);
  console.log('  happy% | rating | prob/65536 | arrivals/min | over RCT2 soft cap: prob | /min');
  for (const f of [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.7, 0.8, 0.833, 0.9, 1]) {
    const r = ratingAt(f);
    const p = probAt(r, false);
    const pq = probAt(r, true);
    console.log(
      `  ${F(f * 100, 6, 1)} | ${F(r, 6, 0)} | ${F(p, 10, 0)} | ${F((p / 65536) * 40 * 60, 12, 1)} | ${F(pq, 24, 0)} | ${F(
        (pq / 65536) * 40 * 60, 4, 1,
      )}`,
    );
  }
}
