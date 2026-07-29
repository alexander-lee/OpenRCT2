#!/usr/bin/env node
/**
 * ds-push/manifest.mjs — LOCAL change detection for pushes to the Magic Patterns
 * design system `ds-fbd20bf8-b16d-4cf1-8440-d20bc095fc4a`.
 *
 * WHY THIS EXISTS
 * ---------------
 * File bytes travel through MODEL OUTPUT TOKENS, and output is the slowest part
 * of the push loop. The old protocol paid for every file's bytes THREE times:
 * read from disk, read the server copy to diff it, emit the write, then read it
 * back to verify. `rules/park-generation.md` alone (88 KB ~ 22k tokens) cost
 * ~90k tokens for ONE file.
 *
 * Hashing is LOCAL and FREE. This tool keeps `pushed-manifest.json`
 * (serverPath -> { sha256, bytes, pushedAt }) for every file that was pushed AND
 * verified, and answers the only question a push agent actually needs:
 *
 *     which files differ from what I last pushed?
 *
 * That replaces per-file server reads entirely. See ../README.md § FAST PUSH
 * PROTOCOL for the procedure this tool is half of.
 *
 * COMMANDS
 *   status                 changed + never-pushed files, in dependency order (default)
 *   plan                   same as `status` but also prints the batching plan
 *   commit <path...>       record paths as pushed+verified (hash them now)
 *   commit --all-changed   record every path `status` reported
 *   hash <path...>         print sha256 + bytes for paths (no manifest change)
 *   forget <path...>       drop manifest entries so those paths re-push
 *   forget --all           drop the whole manifest (everything re-pushes)
 *   reconcile --server-list=FILE   FILE = JSON array of server file names, or the
 *                          raw get_design_system JSON. Drops manifest entries for
 *                          paths the server does NOT have (they never landed) and
 *                          reports server paths the manifest does not know about.
 *                          Add --assume-clean to BOOTSTRAP the manifest from disk
 *                          hashes for every path the server already has (only safe
 *                          right after a full push has landed — see README).
 *   reconcile --from-dir=DIR       DIR holds server COPIES laid out by server path.
 *                          Hashes them and rewrites those manifest entries from the
 *                          SERVER's bytes — authoritative, use for a small suspect set.
 *   audit                  local tree vs manifest vs excludes, counts only
 *
 * FLAGS
 *   --json                 machine-readable output
 *   --paths=<glob,glob>    restrict to matching server paths (substring or * glob)
 *   --quiet                paths only, one per line (pipe-friendly)
 *
 * PATHS: arguments may be given as either a LOCAL path (absolute, or relative to
 * mp3d/) or a SERVER path (`rules/park-generation.md`). Everything is normalised
 * to the server path, which is what the manifest keys on.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', 'mp3d'); // the design-system source of truth
const MANIFEST = path.join(HERE, 'pushed-manifest.json');

export const DESIGN_SYSTEM_ID = 'ds-fbd20bf8-b16d-4cf1-8440-d20bc095fc4a';

// ---------------------------------------------------------------------------
// NEVER PUSH. Baked in deliberately: a push agent must not be able to
// resurrect these by walking the tree.
// ---------------------------------------------------------------------------

/** Directory prefixes (relative to mp3d/) that are never part of the push set. */
const EXCLUDE_DIRS = [
  'harness', // the eval harness never belongs on the server (it also lives elsewhere)
  'tools', // local scripts
  'node_modules',
  'shots',
  'out',
  'signatures',
  // LOCAL-ONLY DEEP REFERENCE (2026-07-28). `rules/*.md` is never injected into a
  // generation — only `rules/setup.md` and the conditionally-loaded skills reach
  // the agent — but the whole directory IS what `get_design_guidelines` returns,
  // and at 660 KB that single call destroys an agent's context (SETUP.md tells it
  // never to make the call). Superseded reference is archived HERE so it stays
  // readable to us and stops being shipped; the server keeps a short stub in its
  // place, so the guidelines payload shrinks without anything being lost.
  'rules-archive',
];

/**
 * Component folders DELETED DELIBERATELY (the v6.0 prefab "land macro" removal).
 * They are gone from the server and must stay gone; if one reappears on disk it
 * is a mistake, not a change to push. harness/park-eval/preflight.mjs fails a
 * park that imports any of them.
 */
const DELETED_COMPONENTS = [
  'GrandPark',
  'ThornwickGlade',
  'EmberfallCaldera',
  'TidewaterHollow',
  'BrassworkFoundry',
  'PulseDistrict',
];

/**
 * SERVER-AHEAD files: the server copy is newer than the disk copy and pushing
 * would REGRESS it. Never push these until someone pulls them down to disk and
 * removes them from this list.
 */
const SERVER_AHEAD = [
  'components/Road/Context.md',
  'components/ColorKit/Context.md',
  'components/DirtPath/Context.md',
  'components/NormalPath/Context.md',
  'components/QueuePath/Context.md',
];

/** File-name patterns that are local scratch, never design-system files. */
const EXCLUDE_FILE_RE = [
  /(^|\/)\.DS_Store$/,
  /(^|\/)_[^/]*\.json$/, // _A.json, _payload.json, … scratch payload dumps
  /(^|\/)\..*/, // any dotfile
  /(^|\/)package-lock\.json$/,
  /^skills-drafts\/README\.md$/, // the drafts folder's own note — not a design-system file
  /\.(png|jpg|jpeg|gif|webp|mp4|zip|pyc)$/i,
];

/** Extensions that ARE design-system files. */
const INCLUDE_EXT = new Set(['.tsx', '.ts', '.md', '.css', '.js', '.json']);

/**
 * LOCAL -> SERVER path remaps. The design system stores the end-to-end manual as
 * `rules/setup.md`; on disk it lives at the root of mp3d/ as `SETUP.md`.
 *
 * The five SKILLS live on disk under `skills-drafts/` and on the server under
 * `skills/`. They used to be EXCLUDED here as "local drafts", which meant every
 * skill push went through model output tokens instead of the wire — ~30k tokens
 * and a hand-retyped 90 KB file per skill, which is exactly the transcription
 * risk this script exists to remove. They are the deep reference the generator
 * conditionally loads, so they are design-system files like any other.
 */
const PATH_MAP = new Map([
  ['SETUP.md', 'rules/setup.md'],
  ['skills-drafts/coaster-pieces/SKILL.md', 'skills/coaster-pieces/SKILL.md'],
  ['skills-drafts/park-composition/SKILL.md', 'skills/park-composition/SKILL.md'],
  ['skills-drafts/park-skeletons/SKILL.md', 'skills/park-skeletons/SKILL.md'],
  ['skills-drafts/park-troubleshooting/SKILL.md', 'skills/park-troubleshooting/SKILL.md'],
  ['skills-drafts/ride-and-stall-roster/SKILL.md', 'skills/ride-and-stall-roster/SKILL.md'],
]);
const REVERSE_MAP = new Map([...PATH_MAP].map(([l, s]) => [s, l]));

// ---------------------------------------------------------------------------
// Dependency order — the order a batch must be pushed in.
// A file that imports something not yet on the server makes the server return
// HTTP 500 with NO validationErrors. Pushing the dependency first fixes it.
// Lower rank goes first.
// ---------------------------------------------------------------------------
function rank(serverPath) {
  const p = serverPath;
  if (p === 'package.json' || p === 'tailwind.config.js' || p === 'index.css') return 0;
  if (/^components\/[^/]+\/[^/]+\.ts$/.test(p)) return 1; // leaf/type modules
  if (/^components\/[^/]+\/(?!index\.tsx|.*\.previews\.tsx|Context\.md)[^/]+\.tsx$/.test(p))
    return 2; // non-index tsx submodules (pieces.tsx, wrappers.tsx, …)
  if (/^components\/[^/]+\/index\.tsx$/.test(p)) return 3; // component entry
  if (/\.previews\.tsx$/.test(p)) return 4; // previews import the component
  if (/^components\/[^/]+\/Context\.md$/.test(p)) return 5;
  if (/^rules\//.test(p)) return 6; // rules last — nothing imports them
  return 3;
}

// Consumers that must land AFTER their providers even at the same rank.
// Kits/builders are imported by nearly everything else.
const LATE_COMPONENTS = ['Park', 'ParkBuilder', 'GameManager', 'PathNetwork', 'SetPieceKit'];
const EARLY_COMPONENTS = ['Kit', 'ColorKit', 'ParticleKit', 'TerrainKit', 'TrackKit', 'SplineRideKit'];
function subRank(serverPath) {
  const m = /^components\/([^/]+)\//.exec(serverPath);
  if (!m) return 0;
  if (EARLY_COMPONENTS.includes(m[1])) return -1;
  if (LATE_COMPONENTS.includes(m[1])) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Batching cut-off. Small files may share ONE write_design_system_files call;
// large files are strictly one per call (a chunked/oversized write truncated a
// file on this server). See ../README.md.
// ---------------------------------------------------------------------------
export const SMALL_FILE_BYTES = 8 * 1024; // per-file ceiling to be batchable
export const BATCH_BYTES = 24 * 1024; // total bytes allowed in one batched call
export const BATCH_MAX_FILES = 6;

// ---------------------------------------------------------------------------

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export function isExcludedLocal(rel) {
  const first = rel.split('/')[0];
  if (EXCLUDE_DIRS.includes(first)) return `excluded dir: ${first}/`;
  const comp = /^components\/([^/]+)\//.exec(rel);
  if (comp && DELETED_COMPONENTS.includes(comp[1]))
    return `deleted component: components/${comp[1]}/`;
  for (const re of EXCLUDE_FILE_RE) if (re.test(rel)) return `scratch/ignored file`;
  if (!INCLUDE_EXT.has(path.extname(rel))) return `not a design-system extension`;
  return null;
}

function isExcludedServer(serverPath) {
  if (SERVER_AHEAD.includes(serverPath)) return 'server-ahead (server copy is newer)';
  return null;
}

function toServer(rel) {
  return PATH_MAP.get(rel) ?? rel;
}
function toLocal(serverPath) {
  return REVERSE_MAP.get(serverPath) ?? serverPath;
}

function walk(dir, acc = [], base = REPO) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(base, abs);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.includes(rel.split('/')[0])) continue;
      if (e.name.startsWith('.')) continue;
      walk(abs, acc, base);
    } else if (e.isFile()) {
      acc.push(rel);
    }
  }
  return acc;
}

/** The full local push set: [{ serverPath, localPath, abs, bytes, sha256 }] */
export function scanLocal() {
  const out = [];
  for (const rel of walk(REPO)) {
    if (isExcludedLocal(rel)) continue;
    const serverPath = toServer(rel);
    if (isExcludedServer(serverPath)) continue;
    const abs = path.join(REPO, rel);
    const buf = fs.readFileSync(abs);
    out.push({ serverPath, localPath: rel, abs, bytes: buf.length, sha256: sha256(buf) });
  }
  out.sort((a, b) => a.serverPath.localeCompare(b.serverPath));
  return out;
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) return { version: 1, designSystemId: DESIGN_SYSTEM_ID, files: {} };
  const j = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  j.files ??= {};
  return j;
}

function saveManifest(m) {
  m.updatedAt = new Date().toISOString();
  const ordered = {};
  for (const k of Object.keys(m.files).sort()) ordered[k] = m.files[k];
  m.files = ordered;
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
}

function globToRe(g) {
  if (!g.includes('*')) return new RegExp(g.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(
    '^' + g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
  );
}

/** `--paths=<glob,glob>` -> predicate over server paths. Exported for push.mjs. */
export function makeFilter(argv) {
  const spec = argv.find((a) => a.startsWith('--paths='));
  if (!spec) return () => true;
  const res = spec.slice('--paths='.length).split(',').filter(Boolean).map(globToRe);
  return (p) => res.some((re) => re.test(p));
}

/** Normalise a user-supplied path to a server path. */
function normaliseArg(a) {
  let p = a;
  if (path.isAbsolute(p)) p = path.relative(REPO, p);
  p = p.replace(/^\.\//, '');
  // tolerate "mp3d/rules/x.md"
  p = p.replace(/^mp3d\//, '');
  return toServer(p);
}

/** Compute the changed set. */
export function diff({ filter = () => true } = {}) {
  const manifest = loadManifest();
  const local = scanLocal().filter((f) => filter(f.serverPath));
  const changed = [];
  const unchanged = [];
  for (const f of local) {
    const m = manifest.files[f.serverPath];
    if (!m) changed.push({ ...f, reason: 'NEW (not in manifest)' });
    else if (m.sha256 !== f.sha256)
      changed.push({
        ...f,
        reason: `CHANGED (${m.bytes} -> ${f.bytes} B, last pushed ${m.pushedAt})`,
        prevBytes: m.bytes,
      });
    else unchanged.push(f);
  }
  changed.sort(
    (a, b) =>
      rank(a.serverPath) - rank(b.serverPath) ||
      subRank(a.serverPath) - subRank(b.serverPath) ||
      a.serverPath.localeCompare(b.serverPath)
  );
  // manifest entries with no local file: pushed once, now deleted on disk
  const orphans = Object.keys(manifest.files)
    .filter(filter)
    .filter((p) => !local.some((f) => f.serverPath === p) && !fs.existsSync(path.join(REPO, toLocal(p))));
  return { manifest, local, changed, unchanged, orphans };
}

/** Group the changed set into write calls, honouring the batching cut-off. */
export function planBatches(changed) {
  const calls = [];
  let batch = null;
  const flush = () => {
    if (batch && batch.files.length) calls.push(batch);
    batch = null;
  };
  for (const f of changed) {
    if (f.bytes > SMALL_FILE_BYTES) {
      flush();
      calls.push({ kind: 'single', files: [f], bytes: f.bytes });
      continue;
    }
    // Files inside ONE write call land ATOMICALLY, so a dependency between two
    // files in the same batch is fine; and the changed list is already in
    // dependency order, so a batch never depends on a LATER call. Batches may
    // therefore span ranks. The limits are what keep a rejected batch cheap to
    // re-emit (a rejection throws away every byte in the call).
    if (
      !batch ||
      batch.files.length >= BATCH_MAX_FILES ||
      batch.bytes + f.bytes > BATCH_BYTES
    ) {
      flush();
      batch = { kind: 'batch', files: [], bytes: 0 };
    }
    batch.files.push(f);
    batch.bytes += f.bytes;
  }
  flush();
  return calls;
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const tok = (n) => Math.round(n / 4); // ~4 bytes per token for this source mix

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

function cmdStatus(argv, { withPlan = false } = {}) {
  const json = argv.includes('--json');
  const quiet = argv.includes('--quiet');
  const { changed, local, unchanged, orphans } = diff({ filter: makeFilter(argv) });
  const calls = planBatches(changed);

  if (json) {
    console.log(
      JSON.stringify(
        {
          designSystemId: DESIGN_SYSTEM_ID,
          localFiles: local.length,
          unchanged: unchanged.length,
          changed: changed.map((f) => ({
            serverPath: f.serverPath,
            localPath: f.localPath,
            bytes: f.bytes,
            sha256: f.sha256,
            reason: f.reason,
            rank: rank(f.serverPath),
          })),
          orphans,
          writeCalls: calls.map((c) => ({
            kind: c.kind,
            bytes: c.bytes,
            files: c.files.map((f) => f.serverPath),
          })),
          totalBytes: changed.reduce((s, f) => s + f.bytes, 0),
        },
        null,
        2
      )
    );
    return;
  }
  if (quiet) {
    for (const f of changed) console.log(f.serverPath);
    return;
  }

  const total = changed.reduce((s, f) => s + f.bytes, 0);
  console.log(`design system : ${DESIGN_SYSTEM_ID}`);
  console.log(`source        : ${REPO}`);
  console.log(`manifest      : ${MANIFEST}${fs.existsSync(MANIFEST) ? '' : '  (MISSING — first run)'}`);
  console.log(
    `local push set: ${local.length} files   unchanged: ${unchanged.length}   TO PUSH: ${changed.length}`
  );
  console.log(`bytes to push : ${kb(total)}  (~${tok(total)} output tokens)`);
  if (orphans.length) {
    console.log(`\nORPHANS (in manifest, gone from disk — delete on the server by hand if intended):`);
    for (const p of orphans) console.log(`  ${p}`);
  }
  if (!changed.length) {
    console.log(`\nNothing to push.`);
    return;
  }
  console.log(`\nPUSH IN THIS ORDER (dependency order; rank 0 first):\n`);
  let lastRank = -1;
  for (const f of changed) {
    const r = rank(f.serverPath);
    if (r !== lastRank) {
      lastRank = r;
      const label = [
        'root config',
        'leaf .ts modules',
        '.tsx submodules',
        'component index.tsx',
        'previews',
        'Context.md',
        'rules/*.md',
      ][r];
      console.log(`  --- rank ${r}: ${label} ---`);
    }
    console.log(
      `  ${String(f.bytes).padStart(7)} B  ${f.bytes > SMALL_FILE_BYTES ? 'SINGLE ' : 'batchable'}  ${f.serverPath}   [${f.reason}]`
    );
  }
  if (withPlan) {
    console.log(`\nWRITE-CALL PLAN — ${calls.length} write_design_system_files call(s):\n`);
    calls.forEach((c, i) => {
      if (c.kind === 'single')
        console.log(`  ${String(i + 1).padStart(3)}. SINGLE  ${kb(c.bytes).padStart(9)}  ${c.files[0].serverPath}`);
      else
        console.log(
          `  ${String(i + 1).padStart(3)}. BATCH   ${kb(c.bytes).padStart(9)}  ${c.files.length} files: ${c.files.map((f) => f.serverPath).join(', ')}`
        );
    });
    console.log(
      `\n  cut-off: a file > ${SMALL_FILE_BYTES} B is ALWAYS its own call; a batch is <= ${BATCH_MAX_FILES} files and <= ${BATCH_BYTES} B total.`
    );
  }
  console.log(
    `\nNext: push in that order, one call per line above, then ONE get_design_system\n` +
      `file-list check, then:  node manifest.mjs commit --all-changed`
  );
}

function cmdCommit(argv) {
  const m = loadManifest();
  let targets;
  if (argv.includes('--all-changed')) {
    targets = diff({ filter: makeFilter(argv) }).changed;
  } else {
    const args = argv.filter((a) => !a.startsWith('--'));
    if (!args.length) {
      console.error('commit needs <path...> or --all-changed');
      process.exit(2);
    }
    const set = new Set(args.map(normaliseArg));
    targets = scanLocal().filter((f) => set.has(f.serverPath));
    const missing = [...set].filter((p) => !targets.some((f) => f.serverPath === p));
    if (missing.length) {
      console.error(`refusing: not in the local push set (excluded or absent):`);
      for (const p of missing) console.error(`  ${p}`);
      process.exit(2);
    }
  }
  const now = new Date().toISOString();
  for (const f of targets) {
    m.files[f.serverPath] = { sha256: f.sha256, bytes: f.bytes, pushedAt: now };
  }
  m.designSystemId = DESIGN_SYSTEM_ID;
  saveManifest(m);
  console.log(`recorded ${targets.length} file(s) as pushed+verified at ${now}`);
  for (const f of targets) console.log(`  ${String(f.bytes).padStart(7)} B  ${f.serverPath}`);
  console.log(`manifest now tracks ${Object.keys(m.files).length} files`);
}

function cmdHash(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const all = scanLocal();
  const pick = args.length ? new Set(args.map(normaliseArg)) : null;
  for (const f of all) {
    if (pick && !pick.has(f.serverPath)) continue;
    console.log(`${f.sha256}  ${String(f.bytes).padStart(7)}  ${f.serverPath}`);
  }
}

function cmdForget(argv) {
  const m = loadManifest();
  if (argv.includes('--all')) {
    const n = Object.keys(m.files).length;
    m.files = {};
    saveManifest(m);
    console.log(`dropped all ${n} manifest entries — the whole push set will re-push`);
    return;
  }
  const filter = argv.some((a) => a.startsWith('--paths=')) ? makeFilter(argv) : null;
  const args = argv.filter((a) => !a.startsWith('--')).map(normaliseArg);
  const drop = Object.keys(m.files).filter((p) => (filter ? filter(p) : args.includes(p)));
  if (!drop.length) {
    console.log('nothing matched; manifest unchanged');
    return;
  }
  for (const p of drop) delete m.files[p];
  saveManifest(m);
  console.log(`dropped ${drop.length} entry(ies); they will re-push:`);
  for (const p of drop) console.log(`  ${p}`);
}

function serverListFrom(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.files)) return raw.files;
  throw new Error(`${file}: expected a JSON array of file names, or an object with a "files" array`);
}

function cmdReconcile(argv) {
  const listArg = argv.find((a) => a.startsWith('--server-list='));
  const dirArg = argv.find((a) => a.startsWith('--from-dir='));
  if (!listArg && !dirArg) {
    console.error(
      'reconcile needs --server-list=FILE (cheap: names only) and/or --from-dir=DIR (authoritative: server bytes)'
    );
    process.exit(2);
  }
  const m = loadManifest();
  const local = scanLocal();

  const assumeClean = argv.includes('--assume-clean');

  if (listArg) {
    const serverPaths = new Set(serverListFrom(listArg.slice('--server-list='.length)));
    const dropped = Object.keys(m.files).filter((p) => !serverPaths.has(p));
    for (const p of dropped) delete m.files[p];
    const untracked = [...serverPaths].filter((p) => !m.files[p]).sort();
    const notLocal = [...serverPaths]
      .filter((p) => !local.some((f) => f.serverPath === p))
      .sort();
    console.log(`server file list: ${serverPaths.size} files`);
    console.log(
      `dropped ${dropped.length} manifest entry(ies) the server does NOT have (they never landed):`
    );
    for (const p of dropped) console.log(`  ${p}`);
    console.log(
      `\n${untracked.length} server path(s) NOT tracked by the manifest — they will show as NEW and re-push:`
    );
    for (const p of untracked) console.log(`  ${p}`);
    console.log(`\n${notLocal.length} server path(s) with NO local counterpart (server-only / excluded):`);
    for (const p of notLocal) console.log(`  ${p}`);

    if (assumeClean) {
      // BOOTSTRAP ONLY. Asserts "the server copy of this path equals my disk copy"
      // WITHOUT checking. Only true immediately after a full push has landed and
      // nobody has edited mp3d/ since. Wrong entries mean a real change is
      // silently NOT pushed — the one failure mode worth being afraid of.
      const now = new Date().toISOString();
      let n = 0;
      for (const f of local) {
        if (!serverPaths.has(f.serverPath)) continue;
        if (m.files[f.serverPath]) continue;
        m.files[f.serverPath] = {
          sha256: f.sha256,
          bytes: f.bytes,
          pushedAt: now,
          source: 'assumed',
        };
        n++;
      }
      console.log(
        `\n--assume-clean: seeded ${n} entry(ies) from DISK hashes (source:"assumed").\n` +
          `  These were NOT verified against server bytes. If a push is known to be\n` +
          `  mid-flight or the tree was edited since the last push, run\n` +
          `  \`forget --paths=...\` on the suspect paths.`
      );
    }
  }

  if (dirArg) {
    const dir = path.resolve(dirArg.slice('--from-dir='.length));
    const files = walk(dir, [], dir).filter((rel) => !isExcludedLocal(rel));
    const now = new Date().toISOString();
    console.log(`\nhashing ${files.length} SERVER copy(ies) from ${dir}`);
    for (const rel of files) {
      const buf = fs.readFileSync(path.join(dir, rel));
      const sp = toServer(rel);
      const lf = local.find((f) => f.serverPath === sp);
      const s = sha256(buf);
      m.files[sp] = { sha256: s, bytes: buf.length, pushedAt: now, source: 'server' };
      const state = !lf ? 'NO LOCAL FILE' : lf.sha256 === s ? 'identical to disk' : 'DIFFERS from disk';
      console.log(`  ${String(buf.length).padStart(7)} B  ${sp}   [${state}]`);
    }
  }

  m.designSystemId = DESIGN_SYSTEM_ID;
  saveManifest(m);
  console.log(`\nmanifest now tracks ${Object.keys(m.files).length} files`);
}

function cmdAudit(argv) {
  const all = walk(REPO);
  const excluded = new Map();
  let included = 0;
  for (const rel of all) {
    const why = isExcludedLocal(rel) || isExcludedServer(toServer(rel));
    if (why) excluded.set(why, (excluded.get(why) ?? 0) + 1);
    else included++;
  }
  const local = scanLocal();
  const bytes = local.reduce((s, f) => s + f.bytes, 0);
  console.log(`walked            : ${all.length} files under ${REPO}`);
  console.log(`in push set       : ${included} files, ${kb(bytes)} (~${tok(bytes)} tokens if all pushed)`);
  console.log(`excluded          :`);
  for (const [why, n] of [...excluded].sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(6)}  ${why}`);
  console.log(`\nnever-push lists baked in:`);
  console.log(`  dirs              : ${EXCLUDE_DIRS.join(', ')}`);
  console.log(`  deleted components: ${DELETED_COMPONENTS.join(', ')}`);
  console.log(`  server-ahead      : ${SERVER_AHEAD.join(', ')}`);
  console.log(`  path remaps       : ${[...PATH_MAP].map(([l, s]) => `${l} -> ${s}`).join(', ')}`);
  const big = local.filter((f) => f.bytes > SMALL_FILE_BYTES).length;
  console.log(
    `\nbatching          : ${local.length - big} file(s) <= ${SMALL_FILE_BYTES} B are batchable, ${big} are SINGLE-write only`
  );
}

// ---------------------------------------------------------------------------

// Only run the CLI when invoked directly — the exports above are importable for
// tests without firing off a `status` run.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (!invokedDirectly) {
  // imported as a module; nothing to do
} else {
const [cmd = 'status', ...argv] = process.argv.slice(2);
try {
  switch (cmd) {
    case 'status':
      cmdStatus(argv);
      break;
    case 'plan':
      cmdStatus(argv, { withPlan: true });
      break;
    case 'commit':
      cmdCommit(argv);
      break;
    case 'hash':
      cmdHash(argv);
      break;
    case 'forget':
      cmdForget(argv);
      break;
    case 'reconcile':
      cmdReconcile(argv);
      break;
    case 'audit':
      cmdAudit(argv);
      break;
    case '--help':
    case 'help':
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
      break;
    default:
      console.error(`unknown command: ${cmd}  (status|plan|commit|hash|forget|reconcile|audit)`);
      process.exit(2);
  }
} catch (e) {
  console.error(`ds-push/manifest.mjs: ${e.message}`);
  process.exit(1);
}
}
