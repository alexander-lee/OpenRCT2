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
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HERE } from './paths.mjs';
import { sigDistance, jaccardDistance } from './layout.mjs';
import { THEME_IDS, THEME_ALIASES, canonicalPresets, canonicalTheme } from './themes.mjs';

export const SIG_DIR = path.join(HERE, 'signatures');
export const SHOTS_DIR = path.join(HERE, 'shots');

export function loadCorpus({ exclude } = {}) {
  return corpusSnapshot({ exclude }).records;
}

// ---------------------------------------------------------------------------
// PARK IDENTITY COMPARISON — one place, because there are two shapes
// ---------------------------------------------------------------------------
// A signature's `park` is normally a resolved absolute path, but the synthetic
// controls store a SENTINEL (`fixture:control`) that `path.resolve` would mangle
// into `<cwd>/fixture:control`. Compare raw first, then resolved, and never
// resolve something that carries a `scheme:` prefix.
const isSentinelPark = (v) => /^[a-z][a-z0-9+.-]*:/i.test(String(v));
const resolvePark = (v) => (isSentinelPark(v) ? String(v) : path.resolve(String(v)));
export function samePark(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b) || resolvePark(a) === resolvePark(b);
}

// ===========================================================================
// THE CORPUS SNAPSHOT (wave-16 P0) — a NOVELTY DENOMINATOR THAT CAN BE REPRODUCED
// ===========================================================================
//
// THE DEFECT. `signatures/` is a shared mutable directory and `saveSignature`
// writes into it at the END of every probe run. Waves 16A and 16B ran
// CONCURRENTLY, so 16B's novelty was computed against `corpusSize 29` while
// 16A's park was landing in the same directory: the two parks of one wave were
// scored against DIFFERENT corpora, and re-running either wave cannot reproduce
// its own novelty figures. `loadCorpus()` returning a bare array hid this —
// nothing recorded WHICH parks were in the denominator, only how many.
//
// THE FIX. Every consumer resolves the corpus ONCE, through this function, and
// gets back an object that NAMES its membership and carries a content hash. The
// caller stores `{ size, excluded, names, sha256 }` in whatever artefact it
// writes (probe.json, score.json), so:
//
//   * two parks in one wave can be scored against an IDENTICAL corpus — pass
//     the recorded `names` back in as `pin`;
//   * a later re-score can PROVE it used the same denominator (compare
//     `sha256`), instead of comparing a size that two different corpora share;
//   * a `saveSignature` landing mid-wave is DETECTABLE rather than silent.
//
// `sha256` covers the fields novelty actually reads (name + layoutSignature +
// rideKinds + stallKinds + worlds), not the whole file: a re-probe that only
// refreshes `when` must not invalidate a denominator it did not change.
// A PARK IS EXCLUDED BY ITS RESOLVED SOURCE PATH, NOT BY ITS NAME (wave-16 P0).
//
// THE DEFECT. `exclude` was matched against `rec.name`, but a signature's NAME is
// only a filename while `rec.park` (the resolved source path) is its IDENTITY —
// `saveSignature` says so itself, and deliberately keeps the ESTABLISHED name
// when a park path already has an entry. So `samples/skeleton-b.tsx` is stored as
// `w18-skeleton-b`, `--park=skeleton-b` matched nothing, and skeleton-b was
// scored WITH ITS OWN SIGNATURE IN THE CORPUS: measured
// `layout.novelty { distance: 0, nearest: "w18-skeleton-b" }` — a park certified
// as a zero-distance copy of itself. `samples/skeleton-c.tsx` (`w18-skeleton-c`)
// and `samples/r12a-run.tsx` (`r12a`) have the same name/path split.
//
// `exclude` now takes either a bare name (back-compatible) or
// `{ name, park }`, and drops a record when EITHER matches. Both, because the
// path is the true identity but is not always resolvable at scoring time, and a
// name match is still better than no exclusion at all.
export function corpusSnapshot({ exclude, pin } = {}) {
  const exName = typeof exclude === 'string' ? exclude : exclude && exclude.name ? exclude.name : null;
  const exPark = exclude && typeof exclude === 'object' && exclude.park ? path.resolve(exclude.park) : null;
  const pinned = pin ? new Set(pin) : null;
  const files = fs.existsSync(SIG_DIR) ? fs.readdirSync(SIG_DIR).filter((f) => f.endsWith('.json')).sort() : [];
  const kept = [];
  const missing = [];
  const excludedRecs = [];
  for (const f of files) {
    let rec = null;
    try {
      rec = JSON.parse(fs.readFileSync(path.join(SIG_DIR, f), 'utf8'));
    } catch {
      rec = null;
    }
    if (!rec || !rec.name) continue;
    // `rec.park` may be a sentinel like `fixture:control`, which path.resolve
    // would mangle — `samePark` compares raw as well as resolved
    const byPath = !!(exPark && rec.park && samePark(rec.park, exPark));
    if (rec.name === exName || byPath) {
      excludedRecs.push({ name: rec.name, park: rec.park ?? null, matchedBy: byPath ? 'park path' : 'name' });
      continue;
    }
    if (pinned && !pinned.has(rec.name)) continue;
    kept.push({ file: f, rec });
  }
  kept.sort((a, b) => String(a.rec.name).localeCompare(String(b.rec.name)));
  // a pinned name that is MISSING is a shrunken denominator and must be
  // reported; the park's OWN name is not missing, it is deliberately excluded,
  // and a stamp taken from the whole directory necessarily contains it
  if (pinned)
    for (const n of pinned)
      if (n !== exName && !excludedRecs.some((e) => e.name === n) && !kept.some((k) => k.rec.name === n)) missing.push(n);
  const records = kept.map((k) => k.rec);
  const material = records.map((r) => ({
    name: r.name,
    layoutSignature: r.layoutSignature ?? null,
    rideKinds: r.rideKinds ?? null,
    stallKinds: r.stallKinds ?? null,
    worlds: r.worlds ?? null,
  }));
  return {
    size: records.length,
    excluded: exName,
    /** WHAT was dropped as "this park", and which field matched — so a park that
     *  silently failed to exclude itself is visible instead of scoring against a
     *  copy of itself */
    selfExcluded: excludedRecs,
    excludedByPath: exPark,
    names: records.map((r) => r.name),
    files: kept.map((k) => k.file),
    sha256: crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex').slice(0, 16),
    /** names the caller PINNED that are not on disk — a pinned re-score whose
     *  corpus has been deleted must not silently shrink its denominator */
    pinnedButMissing: missing,
    records,
  };
}

/** the snapshot fields worth STORING (everything but the records themselves) */
export function corpusStampOf(snap) {
  return {
    size: snap.size,
    excluded: snap.excluded,
    selfExcluded: snap.selfExcluded,
    excludedByPath: snap.excludedByPath,
    sha256: snap.sha256,
    names: snap.names,
    pinnedButMissing: snap.pinnedButMissing,
  };
}

// wave-12 P0 (RUBRIC.md "corpus de-duplication policy"): `park` (the
// resolved source file path) is a signature's IDENTITY; `name` is only a
// filename. Before this fix `saveSignature` always wrote a NEW file at
// `${rec.name}.json`, so a scratch `--name=w11-worlds-ref` on the CLI forked
// a fresh entry instead of refreshing the one `worlds-ref.tsx` already had —
// which is exactly how five near-identical copies of ONE reference park
// (`worlds-ref`, `w11-worlds-ref`, `w11b-worlds-ref`, `w11c-worlds-ref`,
// `w11f-worlds-ref`) piled up across four waves, at effectively 0 distance
// from each other, making the novelty axis unwinnable by padding every
// park's `nearestThree` with copies of one neighbour instead of three real
// ones (round 11: `layout.novelty.distance 0.053` against a 0.08 floor, all
// three nearest neighbours the SAME park). Now: if any signature already on
// disk has this exact `park` path, that file is OVERWRITTEN in place (under
// its ESTABLISHED name, not `rec.name`) instead of a new one being created —
// one signature per distinct park, by construction, no matter what `--name`
// a later run passes.
export function existingSignatureFor(park) {
  if (!fs.existsSync(SIG_DIR) || !park) return null;
  for (const f of fs.readdirSync(SIG_DIR).sort()) {
    if (!f.endsWith('.json')) continue;
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(SIG_DIR, f), 'utf8'));
      if (rec && samePark(rec.park, park)) return { file: f, rec };
    } catch {
      /* ignore unreadable entries */
    }
  }
  return null;
}

/** the signature stored under `name`, or null (never throws on a bad file) */
export function readSignature(name) {
  const file = path.join(SIG_DIR, `${name}.json`);
  if (!name || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// ===========================================================================
// `--name` MUST NOT BE ABLE TO OVERWRITE ANOTHER PARK'S SIGNATURE (2026-07-27)
// ===========================================================================
//
// THE DEFECT, observed live on 2026-07-26. `node probe.mjs samples/zzbase-a.tsx
// --name=skeleton-a` was run as a throwaway baseline measurement while another
// agent was scoring. `existingSignatureFor` keys on the SOURCE PATH — and
// `zzbase-a.tsx` had no signature — so the "one signature per park" guard below
// found nothing to refresh and fell through to its `${rec.name}.json` default,
// which is `skeleton-a.json`. The scratch park's numbers were written into the
// corpus entry for `samples/skeleton-a.tsx`, `park` and all, and the real
// skeleton-a measurement was gone. Nothing said a word; it was caught only
// because a third agent happened to `diff` signatures/.
//
// The two guards that already existed do NOT cover this:
//   * `--signature` (opt-in publication) shrinks the exposure to runs that ASKED
//     to publish, but a run that asks to publish is exactly the hazardous one.
//   * `corpusSnapshot({ exclude })` matching on path as well as name fixes
//     self-exclusion, which is a different failure.
// The hole is that `existingSignatureFor` keys on the park and `--name` decides
// the FILENAME, so the two are free to disagree — and when they do, the name
// wins and the park's identity is rewritten under it.
//
// THE FIX. Before writing `${name}.json`, look at what is already there. If a
// signature exists under that name and its recorded `park` is a DIFFERENT park,
// refuse: throw `SIGNATURE_NAME_CONFLICT` naming both paths. `--reassign-signature`
// (`{ reassign: true }`) is the deliberate opt-out for the rare legitimate
// rename, and it stamps `reassignedFrom` into the record so the swap is visible
// afterwards instead of being indistinguishable from a normal refresh.
//
// NOT covered on purpose: the park already owning a signature under a different
// name. That case is handled below — the established file is refreshed in place
// and `${name}.json` is never touched — so there is nothing to protect.
export function signatureConflict({ name, park }) {
  if (!name || !park) return null;
  const rec = readSignature(name);
  if (!rec) return null;
  if (samePark(rec.park, park)) return null;
  // `saveSignature` would redirect this write to the park's ESTABLISHED file,
  // so `${name}.json` is not at risk
  if (existingSignatureFor(park)) return null;
  return {
    file: `${name}.json`,
    name,
    storedPark: rec.park ?? null,
    storedWhen: rec.when ?? null,
    park: resolvePark(park),
  };
}

/** the human-readable refusal, shared by saveSignature and probe.mjs's pre-flight */
export function signatureConflictMessage(c) {
  return [
    `[corpus] REFUSING to write signatures/${c.file} — that corpus entry belongs to a DIFFERENT park.`,
    `           stored park : ${c.storedPark}${c.storedWhen ? `   (measured ${c.storedWhen})` : ''}`,
    `           probed park : ${c.park}`,
    `         A signature's IDENTITY is its \`park\`, not its \`--name\`. Writing this would make the corpus entry`,
    `         "${c.name}" claim a measurement it does not have, and would destroy the one it does — which is`,
    `         exactly how skeleton-a's measurement was lost on 2026-07-26 to a --name=skeleton-a scratch run.`,
    `         Probe under a different --name (or none), or pass --reassign-signature if "${c.name}" really is`,
    `         meant to become ${c.park} from now on.`,
  ].join('\n');
}

export function saveSignature(rec, { reassign = false } = {}) {
  fs.mkdirSync(SIG_DIR, { recursive: true });
  const existing = existingSignatureFor(rec.park);
  if (existing && existing.rec.name !== rec.name)
    console.error(
      `[corpus] "${rec.park}" already has a signature ("${existing.rec.name}") — overwriting it in place instead of creating "${rec.name}" (one signature per park; pick a genuinely distinct park to add a second entry)`,
    );
  const clash = existing ? null : signatureConflict({ name: rec.name, park: rec.park });
  if (clash && !reassign) {
    const e = new Error(signatureConflictMessage(clash));
    e.code = 'SIGNATURE_NAME_CONFLICT';
    e.conflict = clash;
    throw e;
  }
  const file = existing ? existing.file : `${rec.name}.json`;
  const name = existing ? existing.rec.name : rec.name;
  const out = { ...rec, name };
  if (clash) {
    // the opt-out leaves a TRAIL: a reassignment must not look like a refresh
    out.reassignedFrom = { park: clash.storedPark, when: clash.storedWhen, at: new Date().toISOString() };
    console.error(
      `[corpus] --reassign-signature: signatures/${file} REASSIGNED from ${clash.storedPark} to ${clash.park} (recorded as \`reassignedFrom\`)`,
    );
  }
  fs.writeFileSync(path.join(SIG_DIR, file), JSON.stringify(out, null, 2));
  return { file, name, park: out.park ?? null, action: existing ? 'refreshed' : clash ? 'reassigned' : 'created' };
}

// ===========================================================================
// `shots/<name>/` IS THE SAME HAZARD, AND IT IS THE ONE THAT ACTUALLY BIT
// ===========================================================================
// The scratch run above overwrote `shots/skeleton-a/probe.json` as well as the
// signature, and THAT is the loss that could not be undone: `probe.json` is the
// only stored copy of a park's `layoutRaw`, and `resign.mjs` regenerates every
// signature's layout vector from `shots/<name>/probe.json`. So a clobbered shots
// directory does not just lose one measurement, it stands ready to launder a
// foreign park's geometry into the corpus on the next `resign.mjs --write`.
//
// This check runs on EVERY probe, not only on `--signature` runs, because the
// shots write is unconditional. Two independent records of who owns the name:
//
//   1. `shots/<name>/probe.json`'s `parkSource` — authoritative when present
//      (added 2026-07-26; reports written before that date do not carry it, and
//      an ABSENT parkSource is reported as UNKNOWN, never as a match — refusing
//      on it would refuse every legacy directory in the harness).
//   2. `signatures/<name>.json`'s `park` — the corpus's own statement of which
//      park that name denotes. Weaker evidence, but it is what makes the
//      hazardous command shape refuse even without `--signature`.
export function shotsProbePath(name) {
  return path.join(SHOTS_DIR, name, 'probe.json');
}

export function shotsConflict({ name, park }) {
  if (!name || !park) return null;
  const probePath = shotsProbePath(name);
  if (fs.existsSync(probePath)) {
    let stored = null;
    try {
      stored = JSON.parse(fs.readFileSync(probePath, 'utf8'));
    } catch {
      stored = null;
    }
    const src = stored && stored.parkSource;
    if (src && !samePark(src, park))
      return {
        name,
        evidence: `shots/${name}/probe.json \`parkSource\``,
        storedPark: src,
        storedWhen: (stored && stored.when) || null,
        park: resolvePark(park),
        probePath,
      };
    if (src) return null; // provenance present AND matching: nothing to protect
  }
  const rec = readSignature(name);
  if (rec && rec.park && !samePark(rec.park, park))
    return {
      name,
      evidence: `signatures/${name}.json \`park\``,
      storedPark: rec.park,
      storedWhen: rec.when || null,
      park: resolvePark(park),
      probePath,
    };
  return null;
}

export function shotsConflictMessage(c) {
  return [
    `[probe] REFUSING to measure into shots/${c.name}/ — that directory is another park's measurement.`,
    `           owned by    : ${c.storedPark}${c.storedWhen ? `   (measured ${c.storedWhen})` : ''}`,
    `           this park   : ${c.park}`,
    `           evidence    : ${c.evidence}`,
    `         shots/${c.name}/probe.json is the ONLY stored copy of that park's layoutRaw, and resign.mjs rebuilds`,
    `         its corpus signature from it — overwriting it destroys a measurement AND primes the corpus to be`,
    `         re-signed from the wrong geometry. This is the write that lost skeleton-a on 2026-07-26.`,
    `         Use a different --name, or pass --reassign-shots if shots/${c.name}/ really is meant to hold`,
    `         ${c.park} from now on.`,
  ].join('\n');
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
  // AN EMPTY SUBJECT SET IS UNMEASURED, NOT MAXIMALLY NOVEL. `jaccardDistance([], K)`
  // is `1 - 0/|K|` = 1.0 — the top of the scale — so a park that registered NOTHING
  // (or whose mount died before the roster was read) used to score full novelty credit
  // off an empty array. Found 2026-07-27 on wave 18B: `registeredCount 0, kinds []`
  // came back `distance 1, nearest arch-ref, shared []`. Returning null makes the
  // axis's `io.need(...)` mark it UNMEASURED, which is what a missing roster is.
  if (!Array.isArray(kinds) || !kinds.length)
    return {
      corpusSize: corpus.filter((c) => Array.isArray(c[field]) && c[field].length).length,
      distance: null,
      nearest: null,
      nearestThree: [],
      unmeasured: `the subject's ${field} set is empty — nothing to compare, so novelty is UNMEASURED (an empty set is not novel)`,
    };
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

// ---------------------------------------------------------------------------
// WORLD-PRESET FREQUENCY (added 2026-07-26) — the same treatment that exposed
// 27 of 44 rides going unused, applied to the five shipped presets.
//
// MEASURED over the 24-park corpus, counting BUILT worlds (signature
// `worlds.builtPresets`), 10 parks declare any world at all:
//   brasswork 7 · pulse 6 · thornwick 5 · emberfall 3 · tidewater 2
// Declared-but-not-built is worse still: `pulse` is declared by 10 of 10.
// No preset is structurally unusable — all five have BUILT at least twice — so
// the rules must not excuse anyone from the two at the bottom of this table.
//
// ---- CANONICALISED 2026-07-27 -------------------------------------------
// These five ids USED TO BE the literal strings above — the design system's
// LEGACY place names. The design system renamed its themes to plain genres
// (`SetPieceKit.THEME_IDS`) and kept the place names as aliases, and this table
// never followed, so `presetFrequency`'s `if (p in freq)` silently DROPPED
// every build a post-rename park reported. Measured consequence: skeleton-l
// builds `pirateBeach`, which IS `tidewater` — the rarest preset in the corpus
// at 2 of 30 — and earned world-CHOICE 0 of 0.5. The credit was unearnable by
// any park written after the rename.
//
// Everything now folds through `themes.mjs: canonicalPresets` on BOTH sides:
// the corpus records on disk (all of them still place names) and the subject
// park (genre ids). The counts are unchanged, only their keys are — see
// `node themes.mjs` for the mapping.
export const WORLD_PRESETS = THEME_IDS;

/** the legacy place-name spelling of a canonical preset, for report lines that
 *  have to match a corpus signature a human may go and read */
export const PRESET_ALIAS_OF = Object.fromEntries(
  Object.entries(THEME_ALIASES).map(([alias, canon]) => [canon, alias]),
);

/** preset -> how many corpus parks BUILT a world with that theme. Both the
 *  record's ids and this table's keys are CANONICAL, so a park that declared
 *  `tidewater` and a park that declared `pirateBeach` count as the same world. */
export function presetFrequency(corpus) {
  const freq = {};
  WORLD_PRESETS.forEach((p) => { freq[p] = 0; });
  corpus.forEach((c) => {
    const w = c.worlds || {};
    const built = w.builtPresets || (Array.isArray(w.presets) ? w.presets : []);
    canonicalPresets(built).forEach((p) => { freq[p] += 1; });
  });
  return freq;
}

/** the presets the corpus UNDER-uses, split on the MEDIAN build count of the
 *  five. This is what axis 16's world-CHOICE term pays for, mirroring how axis
 *  13's roster novelty already works. Measured 2026-07-26 (median 5):
 *    underused  tidewater 2 · emberfall 3
 *    atMedian   thornwick 5
 *    overused   brasswork 7 · pulse 7      ← "the same three every park picks"
 *  Recomputed from the corpus on every probe, so it TRACKS the campaign: once
 *  tidewater is common the credit moves to whatever is rare then. */
export function underusedPresets(corpus) {
  const freq = presetFrequency(corpus);
  const counts = WORLD_PRESETS.map((p) => freq[p]).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];
  const by = (a, b) => freq[a] - freq[b];
  return {
    frequency: freq,
    median,
    /** strictly BELOW the median — full world-choice credit */
    underused: WORLD_PRESETS.filter((p) => freq[p] < median).sort(by),
    /** exactly at the median — half credit */
    atMedian: WORLD_PRESETS.filter((p) => freq[p] === median).sort(by),
    /** above the median — "the same presets every park reaches for" */
    overused: WORLD_PRESETS.filter((p) => freq[p] > median).sort((a, b) => freq[b] - freq[a]),
    corpusSize: corpus.length,
    worldParks: corpus.filter((c) => (c.worlds && c.worlds.declared) > 0).length,
    /** the id space these keys are in. Older probe.json files carry place-name
     *  keys; a consumer that sees no `space` must canonicalise before comparing. */
    space: 'canonical',
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

// ===========================================================================
// THE PROVENANCE AUDIT — `node corpus.mjs --audit`
// ===========================================================================
// The guards above stop the NEXT bad write. This reports the ones already on
// disk, because both known incidents were found by accident: the five forked
// copies of `worlds-ref` by someone reading the novelty table, and the
// skeleton-a overwrite by a third agent happening to diff signatures/.
//
// It NEVER deletes or rewrites anything. Removing a corpus entry shifts every
// park's novelty distance and the axis-16 preset median, so that is a decision,
// not a cleanup.
//
// What it checks, per `signatures/*.json`:
//   ERROR  the record's `name` disagrees with its own filename — `corpusSnapshot`
//          keys novelty on `rec.name` while every path in the harness keys on the
//          filename, so the two must not split
//   ERROR  `park` is absent, or names a file that is NOT on disk
//   ERROR  `park` looks like a scratch/baseline/diagnostic copy rather than a park
//   ERROR  two signatures claim the SAME `park` (the worlds-ref fork class)
//   ERROR  `shots/<name>/probe.json` records a DIFFERENT `parkSource` — the entry
//          and the measurement `resign.mjs` would rebuild it from disagree
//   NOTE   `park` is a `fixture:*` sentinel (the synthetic ctrl-* controls)
//   NOTE   basename(`park`) differs from `name` (legitimate: skeleton-b is stored
//          as w18-skeleton-b) — reported so a name is never assumed to be a file
//   NOTE   no `shots/<name>/probe.json`, or one with no `parkSource` at all
//          (every report written before 2026-07-26) — provenance UNKNOWN, which
//          is not the same as provenance WRONG
const SCRATCH_SOURCE_PATTERNS = [
  [/^zzbase/i, 'a `zzbase*` throwaway baseline copy'],
  [/^_scratch/i, 'a `_scratch*` scratch copy'],
  [/^__/, 'a `__*` harness scratch bundle'],
  [/^\./, 'a dotfile'],
  [/-diag\.[jt]sx?$/i, 'a `*-diag` diagnostic copy'],
  [/-(scratch|tmp|temp|copy|bak)\.[jt]sx?$/i, 'a scratch/temp/copy source'],
  [/\.(bak|orig|old)$/i, 'a backup file'],
];

function scratchReason(park) {
  const base = path.basename(String(park));
  for (const [re, why] of SCRATCH_SOURCE_PATTERNS) if (re.test(base)) return why;
  if (path.dirname(path.resolve(String(park))) === path.join(HERE, 'out')) return 'a generated bundle under out/ (the scratch dir), not a park source';
  return null;
}

export function auditSignatures() {
  const files = fs.existsSync(SIG_DIR) ? fs.readdirSync(SIG_DIR).filter((f) => f.endsWith('.json')).sort() : [];
  const rows = [];
  const problems = [];
  const add = (severity, name, what) => problems.push({ severity, name, what });
  const byPark = new Map();

  for (const f of files) {
    const stem = f.replace(/\.json$/, '');
    let rec = null;
    try {
      rec = JSON.parse(fs.readFileSync(path.join(SIG_DIR, f), 'utf8'));
    } catch (e) {
      add('ERROR', stem, `unreadable signature file: ${e.message}`);
      rows.push({ file: f, name: stem, unreadable: true });
      continue;
    }
    const name = rec && rec.name;
    const park = (rec && rec.park) || null;
    const sentinel = park ? isSentinelPark(park) : false;
    const exists = park && !sentinel ? fs.existsSync(resolvePark(park)) : null;
    const scratch = park && !sentinel ? scratchReason(park) : null;

    if (name !== stem) add('ERROR', stem, `record \`name\` is "${name}" but the file is ${f} — novelty keys on \`name\`, paths key on the filename`);
    if (!park) add('ERROR', stem, 'no `park` field — this entry cannot say what it was measured from');
    else if (sentinel) add('NOTE', stem, `\`park\` is the sentinel "${park}" (synthetic fixture, no source file)`);
    else {
      if (!exists) add('ERROR', stem, `\`park\` points at a file that is NOT on disk: ${park}`);
      if (scratch) add('ERROR', stem, `\`park\` is ${scratch}: ${park}`);
      const base = path.basename(String(park)).replace(/\.[jt]sx?$/, '');
      if (base !== stem) add('NOTE', stem, `name/file split: stored as "${stem}" but measured from ${path.basename(String(park))} (\`park\` is the identity, so this is legitimate — just never infer the file from the name)`);
      const key = resolvePark(park);
      byPark.set(key, [...(byPark.get(key) || []), stem]);
    }
    if (rec && rec.reassignedFrom) add('NOTE', stem, `REASSIGNED from ${rec.reassignedFrom.park} at ${rec.reassignedFrom.at} (--reassign-signature)`);

    // ---- the measurement behind the entry ---------------------------------
    const shotsName = (rec && rec.shots) || stem;
    const probePath = shotsProbePath(shotsName);
    let shots = { dir: shotsName, probeExists: false, parkSource: null, match: 'no probe.json' };
    if (fs.existsSync(probePath)) {
      let stored = null;
      try {
        stored = JSON.parse(fs.readFileSync(probePath, 'utf8'));
      } catch {
        stored = null;
      }
      const src = stored && stored.parkSource ? stored.parkSource : null;
      shots = { dir: shotsName, probeExists: true, parkSource: src, match: !src ? 'unknown (pre-2026-07-26 report)' : samePark(src, park) ? 'match' : 'MISMATCH' };
      if (shots.match === 'MISMATCH')
        add('ERROR', stem, `shots/${shotsName}/probe.json was measured from ${src}, but this signature claims ${park} — resign.mjs would rebuild this entry from the WRONG park`);
      else if (!src) add('NOTE', stem, `shots/${shotsName}/probe.json carries no \`parkSource\` (written before provenance was recorded) — provenance UNKNOWN, not verified`);
    } else if (!sentinel) {
      add('NOTE', stem, `no shots/${shotsName}/probe.json — resign.mjs cannot re-derive this signature (it skips it)`);
    }

    rows.push({ file: f, name: stem, recName: name, park, sentinel, exists, scratch, shots });
  }

  for (const [park, names] of byPark)
    if (names.length > 1) add('ERROR', names.join(','), `${names.length} signatures claim the SAME park ${park} — near-zero-distance duplicates flatten the novelty axis (see the worlds-ref fork note in corpus.mjs)`);

  const errors = problems.filter((p) => p.severity === 'ERROR');
  return { dir: SIG_DIR, count: files.length, rows, problems, errors, ok: errors.length === 0 };
}

// ---------------------------------------------------------------------------
// CLI: node corpus.mjs --audit [--json]
// ---------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (!process.argv.includes('--audit')) {
    console.error('usage: node corpus.mjs --audit [--json]');
    console.error('  --audit   report every signature whose `park` is missing, scratch, duplicated, or');
    console.error('            disagrees with the probe.json it would be re-derived from. Reports only —');
    console.error('            it never deletes a corpus entry (that shifts every novelty distance).');
    process.exit(1);
  }
  const a = auditSignatures();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(a, null, 2));
  } else {
    const pad = (s, n) => String(s ?? '').padEnd(n);
    console.log(`\nSIGNATURE PROVENANCE AUDIT — ${a.count} entries in ${a.dir}\n`);
    console.log(pad('name', 20), pad('park', 26), pad('on disk', 9), 'measured from');
    console.log('-'.repeat(96));
    for (const r of a.rows)
      console.log(
        pad(r.name, 20),
        pad(r.sentinel ? r.park : r.park ? path.basename(r.park) : '(none)', 26),
        pad(r.sentinel ? 'fixture' : r.exists === null ? '?' : r.exists ? 'yes' : 'NO', 9),
        `${r.shots ? r.shots.match : '?'}${r.shots && r.shots.dir !== r.name ? ` [shots/${r.shots.dir}]` : ''}`,
      );
    const order = { ERROR: 0, NOTE: 1 };
    console.log('');
    for (const p of [...a.problems].sort((x, y) => order[x.severity] - order[y.severity])) console.log(`${pad(p.severity, 6)} ${pad(p.name, 20)} ${p.what}`);
    console.log(`\n${a.errors.length} error(s), ${a.problems.length - a.errors.length} note(s) over ${a.count} signatures.`);
    if (a.ok) console.log('No signature is missing its source, scratch-derived, duplicated, or contradicted by its own probe.json.');
    else console.log('NOTHING WAS DELETED. Removing a corpus entry shifts every novelty distance and the axis-16 preset median — decide deliberately.');
  }
  process.exit(a.ok ? 0 : 1);
}
