// park-eval CATALOG USAGE TABLE — which catalog rides and stalls the campaign
// has actually used, and which it has NEVER used. Pure node, no deps.
//
//   node usage.mjs            # both tables
//   node usage.mjs --never    # only the never-used lists
//
// The corpus is signatures/*.json (one per probed park). Anything listed under
// NEVER USED is a component that ships in the design system and that no park in
// the corpus has ever placed — the shortlist an author should raid before
// building yet another Carousel + FerrisWheel + DropTower park.

import { rideCatalog, stallCatalog, CATEGORIES } from './catalog.mjs';
import { loadCorpus, usageTable } from './corpus.mjs';

const corpus = loadCorpus();
const rides = usageTable(rideCatalog(), corpus, 'rideKinds');
const stalls = usageTable(stallCatalog(), corpus, 'stallKinds');
const onlyNever = process.argv.includes('--never');
const pad = (s, n) => String(s).padEnd(n);

console.log(`corpus: ${corpus.length} park(s) — ${corpus.map((c) => c.name).join(', ') || '(empty)'}\n`);

if (!onlyNever) {
  console.log(`RIDE CATALOG (${rides.rows.length} registerable kinds)\n`);
  console.log(pad('kind', 22), pad('category', 11), pad('tracked', 8), pad('parks', 6), 'used by');
  console.log('-'.repeat(78));
  for (const r of rides.rows)
    console.log(pad(r.kind, 22), pad(r.category, 11), pad(r.tracked ? 'yes' : '-', 8), pad(r.parks, 6), r.usedBy.join(', ') || '—');

  console.log(`\nSTALL CATALOG (${stalls.rows.length} kinds)\n`);
  console.log(pad('kind', 22), pad('item', 11), pad('default name', 16), pad('parks', 6), 'used by');
  console.log('-'.repeat(78));
  for (const s of stalls.rows)
    console.log(pad(s.kind, 22), pad(s.item, 11), pad(s.defaultName, 16), pad(s.parks, 6), s.usedBy.join(', ') || '—');
}

console.log(`\nNEVER USED — rides (${rides.neverUsed.length}/${rides.rows.length}):`);
for (const c of [...CATEGORIES, 'unclassified']) {
  const inCat = rides.rows.filter((r) => r.parks === 0 && r.category === c).map((r) => r.kind + (r.tracked ? '*' : ''));
  if (inCat.length) console.log(`  ${pad(c, 12)} ${inCat.join(', ')}`);
}
console.log(`  (* = TRACKED/water/transport speciality — the axis-13 speciality point)`);
console.log(`\nNEVER USED — stalls (${stalls.neverUsed.length}/${stalls.rows.length}): ${stalls.neverUsed.join(', ') || 'none'}`);
