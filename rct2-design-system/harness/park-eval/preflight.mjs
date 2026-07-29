#!/usr/bin/env node
// park-eval preflight.mjs — FAST PRE-BUNDLE LINT (wave-10 disaster recovery).
//
// WHAT HAPPENED: a generated park (`samples/hollowmere.tsx`) imported
// `BrassworkFoundry`, `PulseDistrict` and `ThornwickGlade` — three of the five
// prefab "land macro" components DELETED in v6.0 (see worlds-ref.tsx's
// docstring). esbuild refused the whole bundle. `eval.mjs` produced 0
// screenshots, no `probe.json`, no `validatePark` line — the round scored
// 0/100 by ABSENCE OF EVIDENCE, and the cause took a human-visible chunk of
// time to diagnose from a raw esbuild "could not resolve" dump.
//
// This module is the gate that turns that into a one-line-per-problem report
// in milliseconds, before esbuild (or a browser) is ever invoked. It resolves
// every LOCAL component import in the park file — and any sibling plan module
// it imports — against the components that ACTUALLY EXIST on disk right now
// (`mp3d/components/*`, read fresh every run, never a hard-coded list), plus
// two other cheap defects that have separately cost whole rounds:
//
//   * a `<Coaster>`/`<TrackRide>` `pieces` prop smuggled through a
//     `as unknown as string[]` (or `as string[]`) cast — `pieces` is
//     `TrackPiece[]`, and the double-cast is a tell that a type mismatch is
//     being hidden, not fixed. (Plain `as any` on `pieces` is NOT flagged —
//     several clean reference parks use it to satisfy `compileTrackPieces`'s
//     own literal-tuple typing and that is a different, harmless spot.)
//   * an authored `ratings={{ ... }}` on a `<Coaster>` with NO `rateCoaster`
//     call anywhere in the file — those numbers are being TRANSCRIBED from a
//     rules doc and presented as measured, which silently defeats the point
//     of `rateCoaster` (see `briarwood.tsx` / `stormhollow.tsx` for the
//     correct pattern: call it, log it, don't paste it).
//
// It also carries the two MANDATE gates — the things a park cannot recover from
// later and kept "forgetting" while they were documented as advice: the
// `<Park roster>` prop (§0 header block) and, since wave 15, the §4.2-A
// MONORAIL RING on any plot >= 64 (§0 monorail block). Both refuse to bundle.
//
// Usage:
//   node preflight.mjs <parkFile.tsx>     # exit 0 clean, 1 = problems found
// Library:
//   import { preflightCheck } from './preflight.mjs';
//   const problems = preflightCheck(parkFile);   // string[], empty = clean
//
// Wired into `eval.mjs` and `probe.mjs`: both call this BEFORE
// `bundleParkPage` and refuse to launch esbuild/a browser on failure,
// printing the lint instead of a raw esbuild dump.
import fs from 'node:fs';
import path from 'node:path';
import { HERE, REPO } from './paths.mjs';

const DELETED_LAND_MACROS = new Set([
  'BrassworkFoundry',
  'PulseDistrict',
  'ThornwickGlade',
  'EmberfallCaldera',
  'TidewaterHollow',
]);
const LAND_MACRO_REMEDY =
  "the prefab LAND MACROS were removed in v6.0 — build the world from a themed set-piece plan " +
  "(fountainPlazaPlan/bazaarPlan/boulevardPlan with `theme`) plus that world's own rides/stalls " +
  "and its surviving *Scenery pack; see rules §3.1";
const UNKNOWN_REMEDY = 'no such component under mp3d/components/ — check the spelling, or it was removed; the current catalog is the filesystem (ls mp3d/components)';

/** every component directory that ACTUALLY EXISTS right now (never a
 *  hard-coded list, so this stays correct as components come and go) */
function existingComponents() {
  const dir = path.join(REPO, 'components');
  return new Set(fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()));
}

/** blank out comments (char-for-char, newlines preserved) so a doc comment
 *  that PASTES a call-shaped string — hollowmere.tsx literally has
 *  "rateCoaster (cars 3, bank 0.7) — MEASURED, §4.0-B published table" in its
 *  docstring — can't be mistaken for the real call the ratings check looks
 *  for. String/template literals are passed through untouched (so import
 *  specifiers are unaffected) and every kept character keeps its column, so
 *  line numbers computed off the result still match the original file. */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const two = src[i] + (src[i + 1] || '');
    if (two === '//') {
      while (i < n && src[i] !== '\n') {
        out += ' ';
        i += 1;
      }
    } else if (two === '/*') {
      out += '  ';
      i += 2;
      while (i < n && src[i] + (src[i + 1] || '') !== '*/') {
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < n) {
        out += '  ';
        i += 2;
      }
    } else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const quote = src[i];
      out += src[i];
      i += 1;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < n) {
          out += src[i] + src[i + 1];
          i += 2;
          continue;
        }
        out += src[i];
        i += 1;
      }
      if (i < n) {
        out += src[i];
        i += 1;
      }
    } else {
      out += src[i];
      i += 1;
    }
  }
  return out;
}

const stripCache = new Map();
function readStripped(file) {
  if (!stripCache.has(file)) stripCache.set(file, stripComments(fs.readFileSync(file, 'utf8')));
  return stripCache.get(file);
}

const rawCache = new Map();
function readRaw(file) {
  if (!rawCache.has(file)) rawCache.set(file, fs.readFileSync(file, 'utf8'));
  return rawCache.get(file);
}

/** every import specifier in a source file, with its 1-based line number */
function importsOf(src) {
  const out = [];
  const re = /(?:\bfrom\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
  let m;
  while ((m = re.exec(src))) out.push({ spec: m[2], line: src.slice(0, m.index).split('\n').length });
  return out;
}

/** does this relative specifier look like it names a design-system
 *  component? Two shapes both count (RUBRIC.md's "required import shape"):
 *  an explicit `.../components/<Name>[...]` path (always a component
 *  reference, existing or not — this is how a deleted-component import is
 *  actually spelled in every sample seen so far), or a BARE relative like
 *  `'../FerrisWheel'` whose PascalCase basename either IS a known component
 *  OR does not resolve to any real sibling file in the importing file's own
 *  directory (so a bare import of a deleted/misspelled component doesn't
 *  silently fall through as "just a local module that happens to be
 *  missing"). Returns the component name or null. */
function componentNameOf(spec, existing, fromDir) {
  const m = spec.match(/(?:^|\/)components\/([A-Za-z0-9_]+)(?:\/|$)/);
  if (m) return m[1];
  if (!spec.startsWith('.')) return null;
  const base = spec.replace(/\/(index(\.tsx?)?)?$/, '').split('/').pop();
  if (!base || !/^[A-Za-z0-9_]+$/.test(base)) return null;
  if (existing.has(base)) return base;
  if (fromDir && /^[A-Z]/.test(base)) {
    const resolvesLocally = ['.tsx', '.ts', '/index.tsx', '/index.ts', ''].some((ext) => fs.existsSync(path.resolve(fromDir, spec + ext)));
    if (!resolvesLocally) return base; // PascalCase, bare, and no such local file — treat as a component reference
  }
  return null;
}

/** walk the entry + every LOCAL sibling module it imports (plan files etc —
 *  the same "follow relative imports inside the park's own dir" shape
 *  `typecheck.mjs`'s `parkSources` uses, kept independent on purpose: this
 *  gate must run standalone with zero dependency on the type-check pass). */
function collectLocalFiles(entry, existing) {
  const dir = path.dirname(path.resolve(entry));
  const seen = new Set();
  const files = [];
  const walk = (file) => {
    const real = path.resolve(file);
    if (seen.has(real) || !fs.existsSync(real)) return;
    seen.add(real);
    files.push(real);
    const src = readStripped(real);
    const fromDir = path.dirname(real);
    for (const { spec } of importsOf(src)) {
      if (!spec.startsWith('.') || componentNameOf(spec, existing, fromDir)) continue; // DS import — checked, not walked into
      for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts', '']) {
        const cand = path.resolve(fromDir, spec + ext);
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          walk(cand);
          break;
        }
      }
    }
  };
  walk(entry);
  return files;
}

/** extract balanced-brace JSX opening tags for the given tag names, e.g.
 *  `<Coaster ...props.../>` even when props span lines and contain `{...}` */
function extractTags(src, tagNames) {
  const out = [];
  const tagRe = new RegExp(`<(${tagNames.join('|')})\\b`, 'g');
  let m;
  while ((m = tagRe.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0) {
        i += 1;
        break;
      }
      i += 1;
    }
    out.push({ tag: m[1], text: src.slice(m.index, i), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

const RIDE_TAGS = ['Coaster', 'TrackRide'];
const PARK_TAG = ['Park'];

// ---------------------------------------------------------------------------
// §0 THE MANDATORY MONORAIL RING (wave-15 disaster recovery, round 13 park B).
//
// WHAT HAPPENED, TWICE. `rules/park-generation-rides.md` §4.2-A is a VERIFIED
// ring block (4 platforms, worst clearance 16.66, `closure.gap` 1.800, nothing
// synthesized, 0 compiler warnings), and both skills say in as many words that
// pasting it is a ZERO-RISK action and that NOT pasting it is the only move
// with a cost (−1.0, an empty TRANSPORT category, and the roster-novelty
// floor). Round 12 dropped it anyway. Round 13's park B dropped it again, and
// wrote its reasoning down: *"Given the accumulated complexity and one-shot
// constraint, I'll make pragmatic simplifications… use flat/self-contained
// rides where possible."* Prose advice has now failed twice in a row on the
// same −1, so it stops being advice.
//
// THIS IS THE SAME CLASS OF GATE AS THE `roster` PROP ABOVE: a one-line
// omission that no later check can recover, refused before esbuild runs. A
// park cannot rationalise its way past an exit code.
//
// SCOPE, and it is deliberately narrow:
//   * the ENTRY file must itself author a `<Park>` (so `demo-ref.tsx` and
//     `district-ref.tsx`, which mount an in-repo preview component and have no
//     `<Park>` tag of their own, are outside the check by construction);
//   * the park's resolved `size` must be >= 64. §4.2-B publishes ring blocks
//     down to 48, but the ≤48 plots are the compact/probe shapes (`arch-ref`,
//     `setpiece-ref`, `r12b`, `cinder-peak`) and the standing mandate is
//     written for the 128 default. A size we cannot resolve to a number is
//     SKIPPED rather than guessed at;
//   * PINNED PRE-MANDATE FIXTURES are grandfathered by name (below).
const MIN_MONORAIL_SIZE = 64;
const DEFAULT_PARK_SIZE = 128; // parkRoot.tsx:137 — parks OMIT the size prop

// Pinned references that predate the ring mandate and must keep bundling:
// `worlds-ref` and `seedcheck-s1-192` are the NOVELTY baselines the scorer
// measures every new park against, `briarwood` and `voltmoor` are the large-plot
// coaster/terrain references, `coolpark-a` is the §0-header reference. Editing
// them would move the baselines, so the gate steps around them instead.
// **THIS LIST IS CLOSED.** It is a record of what shipped before the gate
// existed, not an opt-out: a park being authored now cannot be added to it, and
// there is deliberately no in-file marker that suppresses this check.
const MONORAIL_GRANDFATHERED = new Set([
  'briarwood.tsx',
  'coolpark-a.tsx',
  'coolpark.tsx',
  'seedcheck-s1-192.tsx',
  'voltmoor.tsx',
  'worlds-ref.tsx',
]);

const MONORAIL_REMEDY =
  'PASTE §4.2-A VERBATIM from rules/park-generation-rides.md — it is verified (4 platforms, worst clearance 16.66, ' +
  "`closure.gap` 1.800, nothing synthesized, 0 compiler warnings), so pasting it is zero-risk and skipping it is the " +
  'only move with a cost: −1.0, an EMPTY transport category, and the roster-novelty floor. At 128 mount it at the ' +
  'START POSE `[-42.6, 0, -9.7]` (NOT the ring centre) with `beamY={2.6}`, `price={0}`, `pinned`, author the four ' +
  'queue tails `[-36.0,-8.4] [0,27.6] [36.0,-8.4] [0,-44.4]` as street nodes, and walk its 16 ground cells against ' +
  'your seed row before pinning the seed (see the ride-and-stall-roster skill, step 3). If the ring truly cannot ' +
  'fit, TRANSLATE it rigidly inside x ∈ [−63.6, −21.6], z ∈ [−22.8, 20.4] — do not drop it';

/** the `<Park>`'s resolved `size`, or null when this file authors no `<Park>`
 *  or names a size we cannot resolve to a literal (never guessed). A bare
 *  identifier is resolved against every local source, because the plan-module
 *  spelling `size={SIZE}` + `export const SIZE = 192` in a sibling is common
 *  (`samples/meadowmere.tsx`). */
function parkSizeOf(src, sources = [src]) {
  const tags = extractTags(src, PARK_TAG);
  if (!tags.length) return null; // not a park-authoring file
  const m = tags[0].text.match(/\bsize=\{([^}]*)\}/);
  if (!m) return DEFAULT_PARK_SIZE; // omitted — the documented default
  const raw = m[1].trim();
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  if (/^[A-Za-z_$][\w$]*$/.test(raw)) {
    const re = new RegExp(`\\b(?:const|let|var)\\s+${raw}\\b[^=;]*=\\s*(-?\\d+(?:\\.\\d+)?)`);
    for (const s of sources) {
      const decl = s.match(re);
      if (decl) return Number(decl[1]);
    }
  }
  return null; // e.g. size={props.size} — unmeasurable, so unchecked
}

/** entry-file gate: a park on a >= 64 plot with no `<Monorail>` anywhere in its
 *  own sources. `sources` is the stripped text of the entry + its local
 *  siblings, so a ring mounted from a plan module still counts. */
function checkMonorail(rel, entrySrc, sources, problems) {
  if (MONORAIL_GRANDFATHERED.has(path.basename(rel))) return;
  const size = parkSizeOf(entrySrc, sources);
  if (size === null || size < MIN_MONORAIL_SIZE) return;
  if (sources.some((s) => /<Monorail\b/.test(s))) return;
  const parkLine = extractTags(entrySrc, PARK_TAG)[0].line;
  problems.push(
    `${rel}:${parkLine}: park at size ${size} mounts NO <Monorail> — the park-spanning multi-station ring is ` +
      `MANDATORY at size >= ${MIN_MONORAIL_SIZE} (rules/park-generation-checks.md §0.21, -rides.md §4.2-A). ${MONORAIL_REMEDY}`,
  );
}

// ---------------------------------------------------------------------------
// §0 PRE-FLIGHT HEADER PRESENCE (wave-12 disaster recovery, round 11 park B).
//
// WHAT HAPPENED: a generated park shipped with `grep "PRE-FLIGHT"` returning
// ZERO hits — the §0.0-H header (rules/park-generation.md) was never written
// at all, and four separate defects that the header's own arithmetic would
// have caught ON PAPER (missing <World> declarations, ride pads landing
// inside a published mountain peak, an absent `plazas` prop, a missing
// `rateCoaster` call) shipped instead. §0.0 step 2 says write the header
// FIRST; nothing enforced it, so a six-word prompt could skip straight past
// the arithmetic the rest of the rules assume happened.
//
// This check is deliberately TOLERANT OF FORM and STRICT ABOUT PRESENCE: it
// does not police the §0.0-H template's exact row labels or banner glyphs
// (`samples/coolpark-a.tsx`'s header is a shorter, differently-shaped block
// than the full template and still counts), only whether the file's LEADING
// comment reads like real pre-flight arithmetic rather than a one-line
// docstring or no comment at all — a substantial block (>= 200 chars) naming
// at least one of the arithmetic's own vocabulary words (SEED, SIZE, WORLDS,
// ROSTER, GATE, FLAG, ...) or the §0/PRE-FLIGHT banner itself.
const HEADER_KEYWORDS = [
  /§0/, /PRE-FLIGHT/i, /\bSEED\b/i, /\bSIZE\b/i, /\bWORLDS?\b/i, /\bROSTER\b/i,
  /\bGATE\b/i, /\bFLAG\b/i, /\bQUEUE\b/i, /\bLATTICE\b/i, /\bSPREAD\b/i,
  /\bDRESS\b/i, /\bMONO(?:RAIL)?\b/i,
];
const HEADER_MIN_LEN = 200;

/** the file's leading comment — a `/* ... *\/` block or a contiguous run of
 *  `//` lines starting at the first non-whitespace character — or '' if the
 *  file opens with anything else (an import, JSX, code). Whichever form the
 *  author used, this is "the header" if anything is. */
function leadingCommentBlock(src) {
  let i = 0;
  const n = src.length;
  while (i < n && /\s/.test(src[i])) i += 1;
  if (src.slice(i, i + 2) === '/*') {
    const end = src.indexOf('*/', i + 2);
    return end === -1 ? src.slice(i) : src.slice(i, end + 2);
  }
  if (src.slice(i, i + 2) === '//') {
    let k = i;
    let blockEnd = i;
    while (k < n) {
      let lineEnd = src.indexOf('\n', k);
      if (lineEnd === -1) lineEnd = n;
      if (!/^[ \t]*\/\//.test(src.slice(k, lineEnd))) break;
      blockEnd = lineEnd;
      k = lineEnd + 1;
    }
    return src.slice(i, blockEnd);
  }
  return '';
}

function hasPreflightHeader(rawSrc) {
  const block = leadingCommentBlock(rawSrc);
  return block.length >= HEADER_MIN_LEN && HEADER_KEYWORDS.some((re) => re.test(block));
}

const HEADER_REMEDY =
  'write the §0 PRE-FLIGHT header block FIRST (rules/park-generation.md §0.0-H) and finish it last — every number in it ' +
  'COUNTED FROM THE FILE you are shipping (SEED/SIZE, WORLDS separation pairs, the ROSTER line, GATE reach, the LATTICE ' +
  'edge-length classes), never estimated. Had round 11\'s park B written it, its own arithmetic would have caught the ' +
  'missing <World> declarations, the ride pads landing inside a published mountain peak, the absent `plazas` prop and ' +
  'the missing rateCoaster call before a line of JSX existed.';

/** §0 header + the roster PROP that wires its claim to the live registry.
 *  Entry-file only — a sibling plan module has no park-level header to write. */
function checkPreflightHeader(rel, rawSrc, strippedSrc, problems) {
  if (!hasPreflightHeader(rawSrc)) problems.push(`${rel}:1: no §0 PRE-FLIGHT header found — ${HEADER_REMEDY}`);
  const parkTags = extractTags(strippedSrc, PARK_TAG);
  if (parkTags.length && !parkTags.some((p) => /\broster\s*=\s*\{/.test(p.text)))
    problems.push(
      `${rel}:${parkTags[0].line}: <Park> has no \`roster={{ rides, stalls, categories }}\` prop — the header's roster ` +
        'arithmetic (if written at all) is never wired to the live registry, so validatePark\'s `rosterOverstated` check ' +
        '(§0.16) has nothing to audit. Pass `roster={{ rides: N, stalls: M, categories: K }}`, counted off the ' +
        'registration, not the header (see samples/coolpark-a.tsx)',
    );
}

/** the three checks, run over one file's source */
function checkImports(rel, src, existing, problems, fromDir) {
  for (const { spec, line } of importsOf(src)) {
    if (!spec.startsWith('.')) continue;
    const name = componentNameOf(spec, existing, fromDir);
    if (!name || existing.has(name)) continue;
    const remedy = DELETED_LAND_MACROS.has(name) ? LAND_MACRO_REMEDY : UNKNOWN_REMEDY;
    problems.push(`${rel}:${line}: import '${name}' not found in mp3d/components/ (from '${spec}') — ${remedy}`);
  }
}

function checkPiecesCast(rel, src, problems) {
  for (const { tag, text, line } of extractTags(src, RIDE_TAGS)) {
    const pm = text.match(/pieces=\{([^}]*)\}/);
    if (!pm) continue;
    if (/\bas\s+(?:unknown\s+as\s+)?string\[\]/.test(pm[1])) {
      problems.push(
        `${rel}:${line}: <${tag}> 'pieces' is cast to string[] (${pm[1].trim()}) — pieces is TrackPiece[]; drop the cast and fix the real type mismatch instead of hiding it`,
      );
    }
  }
}

function checkRatingsWithoutMeasurement(rel, src, problems) {
  const hasRateCoaster = /\brateCoaster\s*\(/.test(src);
  if (hasRateCoaster) return;
  for (const { tag, text, line } of extractTags(src, RIDE_TAGS)) {
    if (/ratings=\{\{/.test(text)) {
      problems.push(
        `${rel}:${line}: <${tag}> has an authored 'ratings={{ ... }}' but no 'rateCoaster(' call anywhere in the file — these numbers look transcribed from the rule book, not measured; call rateCoaster on the compiled points and log it (see briarwood.tsx / stormhollow.tsx)`,
      );
    }
  }
}

/** run every check over the entry + its local sibling modules.
 *  Returns a flat array of one-line-per-problem strings; empty = clean. */
export function preflightCheck(entry) {
  const existing = existingComponents();
  // THE SAME MISSING-ENTRY HOLE THE CLI CLOSED, CLOSED FOR LIBRARY CALLERS TOO
  // (2026-07-26). The guard added below at the CLI covers `node preflight.mjs
  // nope.tsx`, but probe.mjs and eval.mjs call THIS function directly — and for a
  // nonexistent entry `collectLocalFiles` still returned zero files, so this
  // returned zero problems and `reportPreflight` printed "clean" before
  // bundleParkPage threw. "clean" for a file that does not exist is the exact
  // defect class this audit is about, so it is a problem here as well.
  if (!fs.existsSync(path.resolve(entry)))
    return [`${entry}: NO SUCH FILE — nothing was linted (this is not "clean")`];
  const files = collectLocalFiles(entry, existing);
  if (!files.length) return [`${entry}: preflight collected ZERO source files — nothing was linted (this is not "clean")`];
  const problems = [];
  const entryResolved = path.resolve(entry);
  const sources = files.map((f) => readStripped(f));
  for (const file of files) {
    const rel = path.relative(HERE, file);
    const src = readStripped(file);
    checkImports(rel, src, existing, problems, path.dirname(file));
    checkPiecesCast(rel, src, problems);
    checkRatingsWithoutMeasurement(rel, src, problems);
    // entry-file only: a sibling plan module has no park-level §0 header, and
    // the ring is counted across the whole park but reported on its <Park>
    if (path.resolve(file) === entryResolved) {
      checkPreflightHeader(rel, readRaw(file), src, problems);
      checkMonorail(rel, src, sources, problems);
    }
  }
  return problems;
}

/** print the report; returns true if clean (nothing printed on the happy
 *  path except a one-line OK, so callers piping stdout stay quiet) */
export function reportPreflight(entry, problems) {
  if (!problems.length) {
    console.error(`[preflight] ${entry}: clean`);
    return true;
  }
  console.error(`[preflight] ${problems.length} problem(s) in ${entry} — refusing to bundle:`);
  for (const p of problems) console.error(`  ${p}`);
  return false;
}

// CLI
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node preflight.mjs <parkFile.tsx>   (or just the park name, e.g. r15a)');
    process.exit(2);
  }
  // A MISSING ENTRY USED TO REPORT "clean". `collectLocalFiles`'s walk() opens with
  // `if (seen.has(real) || !fs.existsSync(real)) return;`, so a nonexistent entry
  // yielded zero files, zero problems, exit 0 — the gate advertised as "run this
  // FIRST" green-lit a park that did not exist, and it hid the fact that the bare
  // `preflight.mjs r15a` form (which everyone types, and which the round briefs
  // used) resolved to `park-eval/r15a` rather than `park-eval/samples/r15a.tsx`.
  // probe.mjs and eval.mjs already hard-fail via bundleParkPage's existence check;
  // this brings the first gate in line and accepts the bare-name form explicitly.
  const candidates = path.extname(arg) ? [arg] : [arg, path.join('samples', `${arg}.tsx`)];
  const entry = candidates.find((c) => fs.existsSync(path.resolve(c)));
  if (!entry) {
    console.error(`[preflight] no such park file: ${candidates.join(' or ')}`);
    process.exit(2);
  }
  const problems = preflightCheck(entry);
  const ok = reportPreflight(entry, problems);
  process.exit(ok ? 0 : 1);
}
