// park-eval CROSS-PARK CORPUS — the signature store behind the two novelty
// points (layout SHAPE novelty on axis 15, ride SELECTION novelty on axis 13).
//
// One JSON per park under signatures/<name>.json:
//   { name, park, when, size, layoutSignature: number[29],
//     rideKinds: [...], stallKinds: [...], rideNames: [...], stallNames: [...] }
//
// Nothing here is a hash: the layout signature is a normalised shape-statistics
// VECTOR (see layout.mjs) so distances are meaningful, and the roster novelty is
// a Jaccard distance over catalog kind sets.

import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { sigDistance, jaccardDistance } from './layout.mjs';

export const SIG_DIR = path.join(HERE, 'signatures');

export function loadCorpus({ exclude } = {}) {
  if (!fs.existsSync(SIG_DIR)) return [];
  return fs
    .readdirSync(SIG_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(SIG_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter((s) => s && s.name !== exclude)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function saveSignature(rec) {
  fs.mkdirSync(SIG_DIR, { recursive: true });
  fs.writeFileSync(path.join(SIG_DIR, `${rec.name}.json`), JSON.stringify(rec, null, 2));
}

/** layout-SHAPE novelty: the smallest signature distance to any prior park */
export function layoutNovelty(signature, corpus) {
  const ranked = corpus
    .filter((c) => Array.isArray(c.layoutSignature) && c.layoutSignature.length === signature.length)
    .map((c) => ({ park: c.name, distance: sigDistance(signature, c.layoutSignature) }))
    .sort((a, b) => a.distance - b.distance);
  return {
    corpusSize: ranked.length,
    distance: ranked.length ? ranked[0].distance : null,
    nearest: ranked.length ? ranked[0].park : null,
    nearestThree: ranked.slice(0, 3),
  };
}

/** ride/stall SELECTION novelty: the smallest Jaccard distance to any prior
 *  park's kind set (1 = shares nothing, 0 = the identical selection) */
export function rosterNovelty(kinds, corpus, field = 'rideKinds') {
  const ranked = corpus
    .filter((c) => Array.isArray(c[field]) && c[field].length)
    .map((c) => ({ park: c.name, distance: jaccardDistance(kinds, c[field]), shared: c[field].filter((k) => kinds.includes(k)) }))
    .sort((a, b) => a.distance - b.distance);
  return {
    corpusSize: ranked.length,
    distance: ranked.length ? ranked[0].distance : null,
    nearest: ranked.length ? ranked[0].park : null,
    nearestThree: ranked.slice(0, 3).map((r) => ({ park: r.park, distance: r.distance, shared: r.shared })),
  };
}

/** how many corpus parks use each kind (the campaign-wide frequency table) */
export function kindFrequency(corpus, field = 'rideKinds') {
  const freq = {};
  corpus.forEach((c) => {
    [...new Set(c[field] || [])].forEach((k) => {
      freq[k] = (freq[k] || 0) + 1;
    });
  });
  return freq;
}

/** the deliverable table: every catalog kind with its corpus usage count, and
 *  the NEVER-USED list (count 0) — `catalog` is rideCatalog()/stallCatalog() */
export function usageTable(catalog, corpus, field = 'rideKinds') {
  const freq = kindFrequency(corpus, field);
  const rows = catalog
    .map((c) => ({ ...c, parks: freq[c.kind] || 0, usedBy: corpus.filter((p) => (p[field] || []).includes(c.kind)).map((p) => p.name) }))
    .sort((a, b) => b.parks - a.parks || a.kind.localeCompare(b.kind));
  return { rows, neverUsed: rows.filter((r) => r.parks === 0).map((r) => r.kind), corpusSize: corpus.length };
}
