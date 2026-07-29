#!/usr/bin/env node
// ---------------------------------------------------------------------------
// typecheck.mjs — the STATIC TYPE GATE for a generated park (wave-9).
//
// WHY. The eval pipeline bundles with esbuild, which STRIPS types without ever
// checking them. Two round-8 parks died from defects a compiler would have
// caught in a second, before a browser was ever launched:
//
//   * Park B declared `TREE_SPOTS: Array<{ position: [number, number]; shape: string }>`
//     and then filled it with 48 TUPLES `[[x, z], 'round']`, while the consumer
//     destructured `({ position, shape })`. Every tree got `position: undefined`.
//     esbuild shipped it happily; the park would have scored ~0 on planting even
//     with its crash fixed.
//   * Park A/B both wired a set-piece port that does not exist / a spine node
//     one cell off a port. `plan.port('N')` on a `<Bazaar>` is now a typed
//     literal union (`'W' | 'E'` via `facing`), so the wrong compass name is a
//     compile error rather than a black page.
//
// WHAT IT DOES. Copies the park's own sources into `out/_tc-<name>/` with the
// design-system import specifiers rewritten to absolute paths (the SAME
// `preprocessParkSource` the bundler uses), runs `tsc --noEmit` over them, and
// reports ONLY the diagnostics that land in the park's own files. Errors inside
// the design system are printed separately as a footnote and never fail the
// park — this gate is about the generated source.
//
// Usage:
//   node typecheck.mjs samples/meadowmere.tsx [more.tsx …]
//   node typecheck.mjs --all               # every samples/*.tsx
//   node typecheck.mjs --ds                # also FAIL on design-system errors
// Exit 0 = clean, 1 = the park has type errors (a DEFECT — report it).
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { HERE, REPO } from './paths.mjs';
import { preprocessParkSource } from './evaltags.mjs';
import { preflightCheck } from './preflight.mjs';

const args = process.argv.slice(2);
const FAIL_ON_DS = args.includes('--ds');
let files = args.filter((a) => !a.startsWith('--'));
if (args.includes('--all') || !files.length)
  files = fs
    .readdirSync(path.join(HERE, 'samples'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => path.join('samples', f));

const tsc = path.join(HERE, 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(tsc)) {
  console.error(`[typecheck] typescript is not installed here — run:\n  cd ${HERE} && npm i typescript @types/react @types/three`);
  process.exit(2);
}

/** every source file the park pulls in from its OWN directory (plan modules) */
function parkSources(entry) {
  const dir = path.dirname(path.resolve(entry));
  const seen = new Set();
  const out = [];
  const walk = (file) => {
    const real = path.resolve(file);
    if (seen.has(real) || !fs.existsSync(real)) return;
    seen.add(real);
    out.push(real);
    const src = fs.readFileSync(real, 'utf8');
    for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s+)['"]([^'"\n]+)['"]/g)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;
      const base = spec.replace(/\/(index(\.tsx?)?)?$/, '').split('/').pop();
      if (/^[A-Za-z0-9_]+$/.test(base) && fs.existsSync(path.join(REPO, 'components', base))) continue; // DS
      if (/(^|\/)components\//.test(spec)) continue; // DS
      for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts', '']) {
        const cand = path.resolve(dir, spec + ext);
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          walk(cand);
          break;
        }
      }
    }
  };
  walk(entry);
  return out;
}

let bad = 0;
for (const entry of files) {
  console.log(`\n=== ${entry}`);

  // PRE-FLIGHT LINT (wave-10) — runs BEFORE tsc: an import of a deleted/
  // unknown component (the hollowmere.tsx disaster — 3 removed land macros,
  // 0 screenshots, 0 probe.json) is both faster to catch and clearer to read
  // here than as a pile of tsc TS2307 "cannot find module" noise mixed in
  // with real design-system diagnostics.
  const preflightProblems = preflightCheck(entry);
  if (preflightProblems.length) {
    console.log(`  PRE-FLIGHT: ${preflightProblems.length} problem(s) — skipping tsc for this file`);
    preflightProblems.forEach((p) => console.log(`    ${p}`));
    bad += 1;
    continue;
  }

  const name = path.basename(entry).replace(/\.tsx$/, '');
  const work = path.join(HERE, 'out', `_tc-${name}`);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const sources = parkSources(entry);
  const copied = [];
  for (const src of sources) {
    const rel = path.basename(src);
    const dst = path.join(work, rel);
    // parkDir is deliberately OMITTED: with it, `preprocessParkSource`
    // absolutizes park-LOCAL specifiers too (`./meadowmere.plan` →
    // `samples/meadowmere.plan.ts`), so tsc followed the import back OUT of the
    // work dir, type-checked the UNREWRITTEN original, and reported its
    // design-system imports as TS2307 "cannot find module" — which this script
    // then filed under "design-system diagnostics" and never failed on. Left
    // relative, the specifier resolves to the rewritten COPY beside it and the
    // plan module is really checked.
    fs.writeFileSync(dst, preprocessParkSource(fs.readFileSync(src, 'utf8')));
    copied.push(dst);
  }
  const tsconfig = {
    compilerOptions: {
      noEmit: true,
      strict: false,
      // the ONE strictness that matters for the defects this gate exists for:
      // a tuple assigned to an object type, a misspelled prop, a wrong literal
      strictNullChecks: false,
      jsx: 'react-jsx',
      module: 'esnext',
      moduleResolution: 'bundler',
      target: 'es2020',
      skipLibCheck: true,
      allowJs: false,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: false,
      typeRoots: [path.join(HERE, 'node_modules', '@types')],
      baseUrl: HERE,
      paths: { react: [path.join(HERE, 'node_modules', '@types', 'react')], three: [path.join(HERE, 'node_modules', 'three', 'src', 'Three.js')] },
    },
    files: copied,
  };
  fs.writeFileSync(path.join(work, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  let out = '';
  try {
    execFileSync(process.execPath, [tsc, '-p', path.join(work, 'tsconfig.json')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const diags = out.split('\n').filter((l) => /error TS\d+/.test(l));
  const own = diags.filter((l) => l.includes(`out/_tc-${name}/`) || l.includes(`_tc-${name}`));
  const ds = diags.filter((l) => !own.includes(l));
  console.log(`  park files: ${copied.map((c) => path.basename(c)).join(', ')}`);
  console.log(`  PARK type errors: ${own.length}${own.length ? '' : '  (clean)'}`);
  own.slice(0, 25).forEach((l) => console.log(`    ${l.replace(work + path.sep, '')}`));
  if (ds.length) console.log(`  (design-system diagnostics, informational: ${ds.length})`);
  if (own.length || (FAIL_ON_DS && ds.length)) bad += 1;
}
console.log(bad ? `\n${bad} park(s) with TYPE ERRORS — fix them before scoring (they are defects)` : '\nall parks type-check clean');
process.exit(bad ? 1 : 0);
