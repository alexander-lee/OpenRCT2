#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-tracked-roster.mjs — WHICH RIDES ARE CIRCUITS, AND WHAT DOES OMITTING
// `pieces` ACTUALLY COST?
//
// WHY THIS EXISTS (measured gap, 2026-07-26). Every §4.0 archetype block and
// the whole Thrill axis were written around a SINGULAR flagship, so nothing in
// the rules or the rubric ever asked for a second circuit. Measured across the
// 24-park corpus: **16 of 20 probed parks registered exactly ONE coaster, 3
// registered none, and exactly one (`hollowmere2`) registered two.** A park of
// one big coaster plus a field of flat spinners scored the same as a park with
// a real tracked-ride roster, because `thrill.flagshipExcitement` is a single
// field.
//
// The fix is only affordable because of what this probe measures: **most
// circuit rides ship a WORKING STOCK LAYOUT and cost nothing to add.** Two
// distinct mechanisms, and the difference matters:
//
//   MODE 'conditional' — `if (opts.pieces) { … compileTrackPieces(…) }`.
//     With no `pieces` prop `compileTrackPieces` is NEVER CALLED: there is no
//     closure report, no `report.fatal`, no synthesized Dubins leg, and
//     therefore ZERO closure risk. `<LogFlume position register />` is a
//     registered, rated, WATER-category ride for one line.
//   MODE 'default' — `compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, …)`.
//     The compile ALWAYS runs, but on the component's OWN shipped piece list.
//     This probe compiles those defaults through the REAL `compileTrackPieces`
//     so "the default is safe" is a measurement, not an assumption.
//
// Usage:
//   node probe-tracked-roster.mjs             # the classification + corpus table
//   node probe-tracked-roster.mjs --json
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, REPO } from './paths.mjs';
import { rideCatalog, CIRCUIT_FAMILY, PIECES_MODE, circuitFamilyOf } from './catalog.mjs';
import { loadCorpus, kindFrequency } from './corpus.mjs';

const JSONOUT = process.argv.includes('--json');

// ---- minimal DOM stub (SplineRideKit is a component module) ----------------
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

// ---- bundle the real compileTrackPieces ------------------------------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_tracked-roster.ts');
fs.writeFileSync(ep, `
import { compileTrackPieces } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit'))};
export { compileTrackPieces };
`);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_tracked-roster.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { compileTrackPieces } = await import(bundlePath);

// ---- read each circuit component's own DEFAULT_PIECES + compile options ----
const compSrc = (kind) => {
  try {
    return fs.readFileSync(path.join(REPO, 'components', kind, 'index.tsx'), 'utf8');
  } catch {
    return null;
  }
};

/** the `const DEFAULT_PIECES: TrackPiece[] = [ … ];` literal, as a JS value */
function defaultPieces(src) {
  const i = src.indexOf('const DEFAULT_PIECES');
  if (i < 0) return null;
  // skip the `: TrackPiece[]` annotation — the literal starts after the `=`
  const eq = src.indexOf('=', i);
  const open = eq < 0 ? -1 : src.indexOf('[', eq);
  if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '[') depth++;
    else if (src[j] === ']') {
      depth--;
      if (depth === 0) {
        const lit = src.slice(open, j + 1).replace(/\/\/[^\n]*/g, '');
        // helpers the list can spread: `const FALL = 4.4;` scalars and
        // `const corner = (r: number): TrackPiece[] => [ … ];` piece builders
        const helpers = {};
        for (const h of src.matchAll(/^const ([a-zA-Z][a-zA-Z0-9_]*) = (-?[0-9.]+);/gm)) helpers[h[1]] = Number(h[2]);
        for (const h of src.matchAll(/^const ([a-zA-Z][a-zA-Z0-9_]*) = \(([^)]*)\)(?::[^=]+?)? => (\[[\s\S]*?\n\]);/gm)) {
          const params = h[2].split(',').map((p) => p.split(':')[0].trim()).filter(Boolean);
          const body = h[3].replace(/\/\/[^\n]*/g, '');
          try {
            // eslint-disable-next-line no-new-func
            helpers[h[1]] = Function(...params, `"use strict"; return (${body});`);
          } catch { /* ignore */ }
        }
        const names = Object.keys(helpers).filter((n) => new RegExp(`\\b${n}\\b`).test(lit));
        try {
          // eslint-disable-next-line no-new-func
          return Function(...names, `"use strict"; return (${lit});`)(...names.map((n) => helpers[n]));
        } catch (e) {
          return { error: String(e && e.message) };
        }
      }
    }
  }
  return null;
}

/** the options object literal handed to the DEFAULT_PIECES compile, with the
 *  module consts it names (START / HEADING / …) resolved out of the same file */
function compileOpts(src) {
  const m = src.match(/compileTrackPieces\(\s*opts\.pieces \?\? DEFAULT_PIECES,\s*(\{[\s\S]*?\})\s*\)/);
  if (!m) return null;
  const consts = {};
  // module consts the options literal can name: numeric expressions (possibly
  // `Math.PI`-valued) and tuple literals, with or without a type annotation
  for (const c of src.matchAll(/^const ([A-Z][A-Z0-9_]*)(?::\s*[^=]+?)? = (\[[^\]]*\]|-?[-+*/0-9.\s]*(?:Math\.PI)?[-+*/0-9.\s]*);/gm)) {
    if (!String(c[2]).trim()) continue;
    try {
      // eslint-disable-next-line no-new-func
      consts[c[1]] = Function(`"use strict"; return (${c[2]});`)();
    } catch { /* ignore */ }
  }
  // second pass: consts whose value references an EARLIER const (BEAM_Y, …)
  for (const c of src.matchAll(/^const ([A-Z][A-Z0-9_]*)(?::\s*[^=]+?)? = (\[[^\]]*\]);/gm)) {
    if (c[1] in consts) continue;
    const names = [...new Set([...c[2].matchAll(/\b([A-Z][A-Z0-9_]+)\b/g)].map((x) => x[1]))].filter((n) => n in consts);
    try {
      // eslint-disable-next-line no-new-func
      consts[c[1]] = Function(...names, `"use strict"; return (${c[2]});`)(...names.map((n) => consts[n]));
    } catch { /* ignore */ }
  }
  const lit = m[1].replace(/\/\/[^\n]*/g, '');
  const names = [...new Set([...lit.matchAll(/\b([A-Z][A-Z0-9_]{1,})\b/g)].map((x) => x[1]))];
  const args = names.filter((n) => n in consts);
  try {
    // eslint-disable-next-line no-new-func
    return { opts: Function(...args, `"use strict"; return (${lit});`)(...args.map((n) => consts[n])), resolved: args };
  } catch (e) {
    return { error: String(e && e.message) };
  }
}

const catalog = rideCatalog();
const rows = [];
for (const r of catalog) {
  const family = circuitFamilyOf(r.kind);
  if (!family) continue;
  const mode = PIECES_MODE[r.kind] || 'chassis';
  const row = { kind: r.kind, category: r.category, family, mode, closureRisk: mode !== 'conditional' };
  if (mode === 'default') {
    const src = compSrc(r.kind);
    const pieces = src && defaultPieces(src);
    const oo = src && compileOpts(src);
    if (!Array.isArray(pieces) || !oo || oo.error || !oo.opts) {
      row.defaults = { measured: false, why: (pieces && pieces.error) || (oo && oo.error) || 'could not extract DEFAULT_PIECES / options' };
    } else {
      try {
        const { points, report } = compileTrackPieces(pieces, { ...oo.opts, bounds: { half: 1000 } });
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = -Infinity;
        for (const [x, y, z] of points) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
          z0 = Math.min(z0, z); z1 = Math.max(z1, z); y1 = Math.max(y1, y);
        }
        row.defaults = {
          measured: true,
          pieces: pieces.length,
          profile: oo.opts.profile ?? null,
          fatal: !!report.fatal,
          fatalReason: report.fatal ? String(report.fatalReason ?? report.fatal) : null,
          warnings: report.warnings.length,
          closed: report.closure.closed,
          gap: +report.closure.gap.toFixed(2),
          synthesized: report.closure.synthesized.length,
          spanX: +(x1 - x0).toFixed(2),
          spanZ: +(z1 - z0).toFixed(2),
          maxY: +y1.toFixed(2),
        };
      } catch (e) {
        row.defaults = { measured: false, why: String(e && e.message ? e.message : e) };
      }
    }
  }
  rows.push(row);
}

// ---- corpus: circuits vs flats, per park ----------------------------------
const corpus = loadCorpus();
const freq = kindFrequency(corpus, 'rideKinds');
const perPark = corpus.map((c) => {
  const kinds = c.rideKinds || [];
  const circuits = kinds.filter((k) => circuitFamilyOf(k));
  const fams = [...new Set(circuits.map((k) => circuitFamilyOf(k)))].sort();
  return {
    park: c.name, size: c.size,
    rideKinds: kinds.length,
    circuitKinds: circuits.length,
    flatKinds: kinds.length - circuits.length,
    families: fams,
    familyCount: fams.length,
    circuits,
  };
});

if (JSONOUT) {
  console.log(JSON.stringify({ rows, perPark, freq }, null, 2));
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n);
console.log('CIRCUIT CLASSIFICATION — every catalog ride that runs a VEHICLE ALONG A TRACK.');
console.log('mode: conditional = `if (opts.pieces)`, so with NO `pieces` prop compileTrackPieces is');
console.log('      NEVER CALLED (zero closure risk); default = `opts.pieces ?? DEFAULT_PIECES`, the');
console.log('      compile always runs and this probe compiled the component\'s OWN default below.\n');
console.log(pad('kind', 20), pad('family', 11), pad('category', 11), pad('mode', 12), pad('parks', 6), 'default-pieces compile');
console.log('-'.repeat(120));
for (const r of rows.sort((a, b) => a.family.localeCompare(b.family) || a.kind.localeCompare(b.kind))) {
  const d = r.defaults;
  const note = !d
    ? r.mode === 'conditional' ? 'n/a — no compile without `pieces`'
      : r.mode === 'none' ? 'n/a — no `pieces` prop; builds its own rig'
        : 'n/a — chassis wrapper, `pieces` REQUIRED'
    : d.measured
      ? `${d.fatal ? 'FATAL' : 'ok'} · ${d.pieces}p · closed ${d.closed} gap ${d.gap} synth ${d.synthesized} · warn ${d.warnings} · ${d.spanX}×${d.spanZ} u`
      : `NOT MEASURED — ${d.why}`;
  console.log(pad(r.kind, 20), pad(r.family, 11), pad(r.category, 11), pad(r.mode, 12), pad(freq[r.kind] || 0, 6), note);
}

console.log('\nCIRCUITS vs FLATS, per corpus park (kinds named in the park file)\n');
console.log(pad('park', 18), pad('size', 5), pad('kinds', 6), pad('CIRC', 5), pad('flat', 5), pad('fams', 5), 'circuit families');
console.log('-'.repeat(96));
for (const p of perPark) console.log(pad(p.park, 18), pad(p.size, 5), pad(p.rideKinds, 6), pad(p.circuitKinds, 5), pad(p.flatKinds, 5), pad(p.familyCount, 5), p.families.join(', ') || '—');

const dist = {};
perPark.forEach((p) => { dist[p.circuitKinds] = (dist[p.circuitKinds] || 0) + 1; });
console.log('\ncircuit-kind count distribution:', JSON.stringify(dist));
const never = rows.filter((r) => !(freq[r.kind] > 0));
// ---- drift guard: a new catalog ride must be classified, not silently ignored
const unclassified = catalog.filter((r) => !circuitFamilyOf(r.kind) && !(r.kind in CIRCUIT_FAMILY));
const noMode = rows.filter((r) => !PIECES_MODE[r.kind]);
if (noMode.length) console.log(`\n[DRIFT] circuits with no PIECES_MODE entry — classify them in catalog.mjs: ${noMode.map((r) => r.kind).join(', ')}`);
const notMeasured = rows.filter((r) => r.defaults && !r.defaults.measured);
if (notMeasured.length)
  console.log(
    `\n[NOT COMPILE-VERIFIED] ${notMeasured.length} default-pieces circuit(s) whose DEFAULT_PIECES this probe could not extract — ` +
      `treat "the default is clean" as UNPROVEN for these: ${notMeasured.map((r) => `${r.kind} (${r.defaults.why})`).join('; ')}`,
  );
console.log(
  `\nflat (non-circuit) catalog rides: ${catalog.length - rows.length} of ${catalog.length}` +
    ` — a park of one coaster plus these measures circuitCount 1`,
);
console.log(`\nNEVER-USED CIRCUITS (${never.length}/${rows.length}) — the shelf a multi-circuit park should raid:`);
for (const fam of [...new Set(rows.map((r) => r.family))].sort())
  {
    const inFam = never.filter((r) => r.family === fam);
    if (inFam.length) console.log(`  ${pad(fam, 11)} ${inFam.map((r) => `${r.kind}(${r.mode === 'conditional' ? 'no-compile' : 'default'})`).join(', ')}`);
  }
