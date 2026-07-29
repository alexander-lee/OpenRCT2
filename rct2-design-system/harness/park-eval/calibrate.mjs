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
import { layoutNovelty, saveSignature, loadCorpus, underusedPresets } from './corpus.mjs';
import { scoreWorlds } from './score-worlds.mjs';

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

// ---- WORLDS (axis 16) ------------------------------------------------------
// Two sources, in order:
//   1. `signatures/<name>.json`'s `worlds` block, written by a real probe run —
//      the authoritative numbers (they come from the design system's own
//      `auditWorldThemes`).
//   2. a STATIC read of the park source when there is no probed record. A park
//      whose source never mounts `<World` cannot have a declared world, so the
//      axis is 0 BY CONSTRUCTION — which is exactly the pre-worlds corpus, and
//      is provable without a browser.
{
  const sigs = loadCorpus();
  const byName = Object.fromEntries(sigs.map((s) => [s.name, s]));
  // the WORLDS axis covers EVERY park in the corpus, not just the ones whose
  // street net `rawFromParkSource` can parse statically: a `buildParkNet` park
  // (which is every worlds park — §3.1 mandates it) is skipped by the layout
  // fixture parser, and skipping it here would hide the one park that HAS worlds
  // axis 16's world-CHOICE split, computed from the corpus on disk (see corpus.mjs)
  const PRESET_USAGE = underusedPresets(sigs);
  const names = [...new Set([...entries.map((e) => e.name), ...sigs.map((s) => s.name), ...(fs.existsSync(sampleDir) ? fs.readdirSync(sampleDir).filter((f) => f.endsWith('.tsx')).map((f) => f.replace(/\.tsx$/, '')) : [])])].sort();
  const rows = [];
  for (const e of names.map((name) => ({ name }))) {
    const rec = byName[e.name];
    if (rec && rec.worlds && rec.worlds.declared > 0) {
      const w = rec.worlds;
      // RE-SCORE from the signature's own fields rather than printing the
      // `score` it was written with (2026-07-26): a signature carries whatever
      // scorer version last probed it, and axis 16's world-CHOICE term is
      // CORPUS-RELATIVE — it moves as parks are added, so a stored number is
      // stale by construction. `presetUsage` is recomputed here from the corpus
      // on disk, which is what makes this table reproducible.
      // ONLY the variety term is recomputed. `buildOut`, `separation` and
      // `coherence` are kept from the stored `parts` — a signature does not
      // carry the per-world build-out list, so re-deriving them from
      // `builtPresets` would silently pay every park with an unbuilt world a
      // full 1.0 for build-out. (That bug was caught here: it moved `r14b`
      // 3.92 -> 4.25 and `voltmoor` 3.42 -> 4.0 before being fixed.)
      const built = w.builtPresets && w.builtPresets.length ? w.builtPresets : w.presets || [];
      const varietyOnly = scoreWorlds({
        declared: w.declared,
        presets: w.presets || [],
        unusedPresets: w.unusedPresets || [],
        presetUsage: PRESET_USAGE,
        worlds: built.map((t, i) => ({ id: `w${i}`, themeId: t, built: true, rideCount: 1, stallCount: 1, sceneryCount: 1, setPieceCount: 0 })),
        crossTheme: [], crossThemeCount: 0, unplacedThemed: [],
        separation: {},
      });
      const kept = w.parts || {};
      const parts = {
        variety: varietyOnly.parts.variety,
        buildOut: kept.buildOut ?? 0,
        separation: kept.separation ?? 0,
        coherence: kept.coherence ?? 0,
      };
      const total = Math.round((parts.variety + parts.buildOut + parts.separation + parts.coherence) * 100) / 100;
      rows.push({
        name: e.name,
        declared: w.declared,
        presets: built.join('+'),
        xt: w.crossThemeCount,
        sep: w.minCentreSeparation,
        floor: w.separationFloor,
        score: total,
        parts,
        varietyTerms: varietyOnly.varietyTerms,
        stored: w.score,
        why: total === w.score ? 'probed' : `probed — variety RE-SCORED vs corpus ${PRESET_USAGE.corpusSize} (stored ${w.score} -> ${total})`,
      });
      continue;
    }
    let src = '';
    const f = path.join(sampleDir, `${e.name}.tsx`);
    try { src = fs.readFileSync(f, 'utf8'); } catch { /* a control fixture has no source */ }
    const declares = /<World[\s/>]|worldPlan\s*\(/.test(src);
    rows.push({
      name: e.name,
      declared: declares ? '?' : 0,
      presets: '-',
      xt: declares ? '?' : 0,
      sep: null,
      floor: null,
      score: declares ? null : 0,
      parts: null,
      why: declares ? 'declares <World> but never probed — run probe.mjs' : src ? 'no <World> in source' : 'control fixture (no source)',
    });
  }
  console.log('\n\nWORLDS (axis 16, max 5) — calibration\n');
  console.log(pad('park', 16), num('decl', 5), pad('presets', 26), num('xTheme', 7), num('minSep', 7), num('floor', 6), num('SCORE', 6));
  console.log('-'.repeat(80));
  for (const r of rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)))
    console.log(pad(r.name, 16), num(r.declared, 5), pad(r.presets, 26), num(r.xt, 7), num(r.sep, 7), num(r.floor, 6), num(r.score, 6));
  console.log('\nper-park breakdown (variety/1.5 + buildOut/1 + separation/1 + coherence/1.5):\n');
  for (const r of rows) {
    if (r.parts)
      console.log(`${pad(r.name, 16)} ${num(r.parts.variety)} + ${num(r.parts.buildOut)} + ${num(r.parts.separation)} + ${num(r.parts.coherence)} = ${num(r.score)}   (${r.why})`);
    else console.log(`${pad(r.name, 16)} ${num(r.score, 5)}   — ${r.why}`);
  }
  fs.writeFileSync(path.join(HERE, 'out', 'worlds-calibration.json'), JSON.stringify(rows, null, 2));
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
