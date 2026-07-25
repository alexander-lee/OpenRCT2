// park-eval AXIS 15 CALIBRATION — run the layout metrics + scorer over every
// available fixture / park source, seed the signature corpus, and print the
// table. Zero dependencies (pure node), so it runs whatever else is in flight.
//
//   node calibrate.mjs            # controls + every samples/*.tsx that parses
//   node calibrate.mjs --matrix   # + the pairwise signature-distance matrix

import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { layoutMetrics, sigDistance } from './layout.mjs';
import { scoreLayout } from './score-layout.mjs';
import { CONTROLS, rawFromParkSource } from './fixtures.mjs';
import { layoutNovelty, saveSignature, loadCorpus } from './corpus.mjs';

const matrix = process.argv.includes('--matrix');
const entries = [];

// ---- controls -------------------------------------------------------------
for (const [name, fn] of Object.entries(CONTROLS)) entries.push({ name, raw: fn(), kind: 'control' });

// ---- real park sources ----------------------------------------------------
const sampleDir = path.join(HERE, 'samples');
const RIDE_ANCHORS = {
  // <Coaster points=…> anchors on its station straight; cinder-peak's station
  // sits at the east end of the lattice (its queue tail node is [22.8, -3.6])
  'cinder-peak': { coasterAt: [19.2, -3.6] },
};
if (fs.existsSync(sampleDir))
  for (const f of fs.readdirSync(sampleDir).filter((f) => f.endsWith('.tsx')).sort()) {
    const name = f.replace(/\.tsx$/, '');
    try {
      const raw = rawFromParkSource(path.join(sampleDir, f), RIDE_ANCHORS[name] || {});
      if (!raw.nodes.length || !raw.edges.length) { console.error(`[skip] ${name}: no street net found in source`); continue; }
      entries.push({ name, raw, kind: 'park' });
    } catch (e) {
      console.error(`[skip] ${name}: ${e.message}`);
    }
  }

// ---- metrics --------------------------------------------------------------
for (const e of entries) e.m = layoutMetrics(e.raw);

// ---- novelty: score each entry against ALL the others (a full corpus pass,
// not the incremental one probe.mjs does) ----------------------------------
for (const e of entries) {
  const corpus = entries.filter((o) => o !== e).map((o) => ({ name: o.name, layoutSignature: o.m.signature }));
  e.m.novelty = layoutNovelty(e.m.signature, corpus);
  e.m.noveltyThresholds = { distinct: 0.08, derivative: 0.04 };
  e.score = scoreLayout(e.m);
}

// ---- seed the persistent corpus ------------------------------------------
if (process.argv.includes('--save'))
  for (const e of entries)
    saveSignature({
      name: e.name, park: `fixture:${e.kind}`, when: new Date().toISOString(), size: e.raw.size,
      layoutSignature: e.m.signature, gridRegularity: e.m.gridRegularity,
      rideKinds: [...new Set((e.raw.rides || []).map((r) => r.kind).filter(Boolean))].sort(),
      stallKinds: [...new Set((e.raw.stalls || []).map((s) => s.kind).filter(Boolean))].sort(),
      rideNames: (e.raw.rides || []).map((r) => r.name),
      stallNames: (e.raw.stalls || []).map((s) => s.name),
    });

// ---- table ---------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
const num = (v, n = 5) => String(v === null || v === undefined ? '-' : v).padStart(n);
console.log('\nLAYOUT UNIQUENESS (axis 15, max 7) — calibration\n');
console.log(pad('park', 16), num('grid'), num('effL'), num('obl%'), num('dist'), num('sep'), num('plot'), num('open'), num('sprd'), num('novl'), num('SCORE', 6));
console.log('-'.repeat(86));
for (const e of entries.sort((a, b) => b.score.total - a.score.total)) {
  const m = e.m;
  console.log(
    pad(e.name, 16),
    num(m.gridRegularity),
    num(m.edgeLengths.effectiveClasses),
    num(Math.round(m.edgeBearings.obliqueEdgeFraction * 100)),
    num(m.districts.count),
    num(m.districts.maxSeparation),
    num(m.plot.plotUtilisation),
    num(m.openSpace.count),
    num(m.openSpace.areaSpread),
    num(m.novelty.distance),
    num(e.score.total, 6),
  );
}
console.log('\nper-park breakdown (antiLattice/3 + districts/2 + plaza/1 + novelty/1):\n');
for (const e of entries) {
  const p = e.score.parts;
  console.log(`${pad(e.name, 16)} ${num(p.antiLattice)} + ${num(p.districts)} + ${num(p.plazaVariety)} + ${num(p.novelty)} = ${num(e.score.total)}`);
  console.log(`${' '.repeat(17)}grid ${p.antiLatticeTerms.gridRegularity} len ${p.antiLatticeTerms.lengthVariety} block ${p.antiLatticeTerms.blockIrregularity} | sep ${p.districtTerms.separation} plot ${p.districtTerms.plotUtilisation}`);
  e.score.notes.forEach((n) => console.log(`${' '.repeat(17)}· ${n}`));
}

if (matrix) {
  console.log('\npairwise signature distance:\n');
  console.log(pad('', 16) + entries.map((e) => pad(e.name.slice(0, 7), 8)).join(''));
  for (const a of entries)
    console.log(pad(a.name, 16) + entries.map((b) => pad(a === b ? '-' : sigDistance(a.m.signature, b.m.signature), 8)).join(''));
}

fs.writeFileSync(
  path.join(HERE, 'out', 'layout-calibration.json'),
  JSON.stringify(entries.map((e) => ({ name: e.name, kind: e.kind, layout: e.m, score: e.score })), null, 2),
);
console.log(`\nwrote out/layout-calibration.json (corpus on disk: ${loadCorpus().length} signatures)`);
