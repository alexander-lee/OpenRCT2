#!/usr/bin/env node
// ---------------------------------------------------------------------------
// resign.mjs — RE-DERIVE the stored corpus signatures from the stored probes,
// without re-rendering a single park.
//
// WHY. `signatures/<park>.json` holds the 29-dim layout SIGNATURE the two
// novelty points compare against, and two of those dimensions are
// `districts.count` and `districts.maxSeparation` (layout.mjs `signatureOf`).
// So the moment a district THRESHOLD changes (wave-10 P0 moved the clustering
// cut off `0.25·size`), every signature written before the change is stale and
// novelty starts comparing old-ruler vectors against new-ruler ones. Re-probing
// a size-192 park costs minutes of SwiftShader; it is also unnecessary —
// `layoutMetrics` is a pure function over `probe.json`'s `layoutRaw`, exactly so
// the axis can be recalibrated over a stored corpus (layout.mjs, header).
//
// WHAT IT DOES. For every EXISTING `signatures/<name>.json` it recomputes
// `layoutSignature` + `gridRegularity` from `shots/<name>/probe.json`'s
// `layoutRaw` (or, for the synthetic `ctrl-*` controls, from `fixtures.mjs`),
// and leaves every roster field (`rideKinds`/`stallKinds`/names/`park`/`when`)
// exactly as it was. It never CREATES a corpus entry — adding a park to the
// corpus is `probe.mjs`'s job, because it changes every other park's novelty.
//
// Usage:
//   node resign.mjs           # dry run: print what would change
//   node resign.mjs --write   # rewrite the signature files
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { layoutMetrics, sigDistance } from './layout.mjs';
import { CONTROLS } from './fixtures.mjs';
import { SIG_DIR, loadCorpus, samePark } from './corpus.mjs';

const write = process.argv.includes('--write');

// PROVENANCE IS CHECKED BEFORE A SIGNATURE IS RE-DERIVED FROM A PROBE (2026-07-27).
// This tool rewrites a corpus entry's layout vector from `shots/<name>/probe.json`,
// so a shots directory holding a DIFFERENT park's measurement would launder that
// park's geometry into this entry — which is precisely what the 2026-07-26
// `--name=skeleton-a` scratch run set up. Two changes:
//   * the probe is looked up by the signature's OWN `shots` field when it has one,
//     falling back to `name`. A name is not a path (`w18-skeleton-b` is measured
//     from `skeleton-b.tsx`), and both w18 entries are silently skipped today
//     because this lookup assumed it was.
//   * a stored `parkSource` that disagrees with the signature's `park` is a HARD
//     skip, reported, never re-signed.
function rawFor(rec) {
  if (CONTROLS[rec.name]) return { raw: CONTROLS[rec.name](), from: `fixtures.mjs CONTROLS.${rec.name}` };
  const dir = rec.shots || rec.name;
  const f = path.join(HERE, 'shots', dir, 'probe.json');
  if (!fs.existsSync(f)) return { raw: null, from: f };
  try {
    const probe = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (probe.parkSource && rec.park && !samePark(probe.parkSource, rec.park))
      return { raw: null, from: f, conflict: probe.parkSource };
    return { raw: probe.layoutRaw || null, from: f, parkSource: probe.parkSource || null };
  } catch {
    return { raw: null, from: f };
  }
}

let changed = 0;
let skipped = 0;
for (const rec of loadCorpus()) {
  const { raw, from, conflict } = rawFor(rec);
  if (conflict) {
    console.log(`[REFUSE] ${rec.name}: ${from} was measured from ${conflict}, but this signature is ${rec.park} — NOT re-signed`);
    skipped += 1;
    continue;
  }
  if (!raw || !raw.nodes || !raw.nodes.length) {
    console.log(`[skip] ${rec.name}: no stored layoutRaw at ${from} (re-run probe.mjs to refresh this one)`);
    skipped += 1;
    continue;
  }
  const m = layoutMetrics(raw);
  const d = sigDistance(rec.layoutSignature, m.signature);
  if (d === 0) {
    console.log(`[same] ${rec.name}`);
    continue;
  }
  changed += 1;
  console.log(`[${write ? 'writ' : 'stal'}e] ${rec.name}: signature moved ${d} per dim (gridRegularity ${rec.gridRegularity} → ${m.gridRegularity})`);
  if (write) {
    fs.writeFileSync(
      path.join(SIG_DIR, `${rec.name}.json`),
      JSON.stringify({ ...rec, layoutSignature: m.signature, gridRegularity: m.gridRegularity, resignedAt: new Date().toISOString() }, null, 2),
    );
  }
}
console.log(
  `\n${changed} signature(s) ${write ? 'rewritten' : 'stale'}, ${skipped} skipped.` +
    (write || !changed ? '' : ' Re-run with --write to bring the corpus onto the current ruler.'),
);
