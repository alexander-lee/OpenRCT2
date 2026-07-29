#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-ride-coverage.mjs — DOES THE WHOLE ROSTER GET RIDDEN?
//
// The old ride appetite was one 10 % roll that picked a single ride uniformly at
// random and threw the roll away if that ride was closed / unreachable / the one
// the guest had just left. That samples WITH REPLACEMENT, so the attractions
// nearest the gate get ridden over and over while the far half of a park is
// barely touched. `navigation.ts seekRide` now filters to eligible rides and
// draws from the UNRIDDEN pool first.
//
// Measured here, on a real park, after N sim-seconds:
//   * per-ride totals — the SPREAD is the point, not the sum
//   * rides with ZERO riders (the defect: a ride nobody ever tries)
//   * distinct rides per guest (mean / max) — "trying them all"
//   * the refusal thoughts that block coverage (tooIntense / moreThrilling)
//
// It CAN fail: drop RIDE_SEEK_NEW back to 0.1 and re-run — zeroRides climbs and
// the per-guest distinct count falls.
//
//   node probe-ride-coverage.mjs <park.tsx> [--secs=600]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { bundleParkPage, openParkPage } from './evaltags.mjs';

const MEASURE = (simSecs) => {
  const store = window.__evalPark;
  if (!store) return { error: 'no __evalPark store' };
  const mgr = store.manager();
  const DT = 1 / 30;
  // START FROM THE MANAGER'S OWN CLOCK. Stepping from t = 0 on a page that has
  // already been rendering sends the sim clock BACKWARDS, and every FSM deadline
  // (ride timers, queue patience, needs cadence) then sits in the future — the
  // first version of this probe did exactly that and reported 0 rides taken while
  // guests had visibly ridden 1.35 each.
  let t = mgr.stats().simTime;
  for (let i = 0; i < Math.round(simSecs / DT); i += 1) {
    t += DT;
    mgr.update(t, DT);
  }
  const rides = (mgr.rides ? mgr.rides() : []).map((r) => ({ name: r.name, total: r.total ?? 0 }));
  // per-guest distinct-ride counts come off the live records' `ridden` plus the
  // thought log for refusals (the records do not expose riddenIds by design)
  const recs = mgr.guests ? mgr.guests() : [];
  const ridden = recs.map((g) => g.ridden);
  const thoughts = {};
  for (const g of recs)
    for (const th of g.thoughts ?? []) {
      const key = /too intense/i.test(th) ? 'tooIntense' : /more thrilling/i.test(th) ? 'moreThrilling' : /can't find/i.test(th) ? 'cantFind' : null;
      if (key) thoughts[key] = (thoughts[key] ?? 0) + 1;
    }
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  return {
    simSecs,
    guests: recs.length,
    rides,
    zeroRides: rides.filter((r) => r.total === 0).map((r) => r.name),
    totalRidden: sum(rides.map((r) => r.total)),
    perGuestMean: recs.length ? +(sum(ridden) / recs.length).toFixed(2) : 0,
    perGuestMax: ridden.length ? Math.max(...ridden) : 0,
    thoughts,
  };
};

const args = process.argv.slice(2);
const secs = Number((args.find((a) => a.startsWith('--secs=')) ?? '--secs=600').split('=')[1]);
const parks = args.filter((a) => !a.startsWith('--'));
if (!parks.length) {
  console.error('usage: node probe-ride-coverage.mjs <park.tsx> [--secs=600]');
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
  const html = await bundleParkPage(src, `cov-${name}`);
  const { browser, page, lines } = await openParkPage(html, { waitMs: 90000 });
  const out = await page.evaluate(MEASURE, secs);
  await browser.close();
  const verdict = lines.find((l) => /validatePark →/.test(l)) ?? '(no validatePark line)';
  console.log(`\n=== ${name}   ${verdict.replace(/^\[log\] /, '').slice(0, 80)}`);
  if (out.error) {
    console.log(`  ERROR ${out.error}`);
    bad += 1;
    continue;
  }
  console.log(`  ${out.guests} guests · ${out.simSecs}s sim`);
  out.rides
    .slice()
    .sort((a, b) => b.total - a.total)
    .forEach((r) => console.log(`    ${String(r.total).padStart(4)}  ${r.name}`));
  console.log(
    `\n  total rides taken: ${out.totalRidden}` +
      `\n  rides with ZERO riders: ${out.zeroRides.length}${out.zeroRides.length ? ` — ${out.zeroRides.join(', ')}` : ''}` +
      `\n  rides per guest: mean ${out.perGuestMean}, max ${out.perGuestMax}` +
      `\n  coverage-blocking thoughts: ${JSON.stringify(out.thoughts)}`,
  );
  const ok = out.zeroRides.length === 0;
  console.log(`\n  VERDICT  ${ok ? 'PASS' : 'FAIL'} — ${out.zeroRides.length} ride(s) nobody ever rode (want 0)`);
  if (!ok) bad += 1;
}
process.exit(bad ? 1 : 0);
