#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-boulevard-avoid.mjs — REGRESSION PROBE for `boulevardPlan({ avoid })`
//
// THE BUG THIS PINS (fixed 2026-07-24, Boulevard/index.tsx):
//
//     const avoid = (input.avoid ?? []).map(snapXZ);        // WRONG
//     const avoid = (input.avoid ?? []).map((p) => snapXZ(p)); // right
//
// `snapXZ(p, cell = CELL)` takes an OPTIONAL second argument, and `Array.map`
// hands its callback (element, INDEX, array). So the bare reference passed the
// index as `cell`:
//     index 0 → cell 0 → Math.round(v / 0) → ±Infinity * 0 → NaN
//                        → the FIRST avoid cell became [NaN, NaN] and every
//                          distance test against it was false → blocked NOTHING
//     index 1 → cell 1 → snapped to the INTEGER grid, not the 1.2 lattice
//     index n → cell n → snapped to an n-unit grid, i.e. somewhere else
// `avoid` was therefore a silent no-op: it cost 4 `scenery` FAILs in a real
// test park (see samples/seedcheck-s1-192.tsx's header note).
//
// The probe is PURE — it only calls `boulevardPlan`, no browser, no mount.
// It asserts, for every index position (0, 1, 2 — the three distinct broken
// cases above) and for both lattice-aligned and off-lattice input cells:
//   1. the un-avoided plan really does dress the cell under test (so the
//      assertion below is not vacuous), and
//   2. the avoided plan has NO dressing anchor within `clear` of it, and
//   3. the anchor count strictly drops.
// It also asserts the snap itself still happens (an off-lattice avoid cell
// blocks the lattice cell it rounds to).
//
// Usage:  node probe-boulevard-avoid.mjs [--verbose]
// Exit 0 = pass, 1 = the bug is back.
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, REPO } from './paths.mjs';

const VERBOSE = process.argv.includes('--verbose');

// ---- bundle boulevardPlan (+ the kit's CELL / snapXZ) for node -------------
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ep = path.join(outDir, '_boulevard-avoid.ts');
fs.writeFileSync(
  ep,
  `
import { boulevardPlan } from ${JSON.stringify(path.join(REPO, 'components/Boulevard'))};
import { CELL, snapXZ } from ${JSON.stringify(path.join(REPO, 'components/SetPieceKit'))};
export { boulevardPlan, CELL, snapXZ };
`,
);
const res = await build({
  entryPoints: [ep], bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, external: ['three'],
  nodePaths: [path.join(HERE, 'node_modules')], target: 'node20', logLevel: 'silent',
});
const bundlePath = path.join(outDir, '_boulevard-avoid.bundle.mjs');
fs.writeFileSync(bundlePath, res.outputFiles[0].text);
const { boulevardPlan, CELL } = await import(bundlePath);

// ---- the plan under test: a long E/W avenue, fully dressed -----------------
const BASE = { id: 'ave', from: [0, 0], to: [48, 0], seed: 6 };
const CLEAR = 1.3; // boulevardPlan's default `clear`

/** every dressing anchor the plan places (lamps, benches, planters, trees) */
const anchors = (plan) => [
  ...plan.lampSpots.map((l) => l.at),
  ...plan.benchSpots.map((b) => b.at),
  ...plan.props.map((p) => p.at),
  ...plan.treeSpots.map((t) => t.at),
];
const near = (a, b, r = CLEAR) => Math.hypot(a[0] - b[0], a[1] - b[1]) < r;
const fmt = (p) => `[${p[0].toFixed(2)}, ${p[1].toFixed(2)}]`;

const REF = boulevardPlan({ ...BASE });
const REF_ANCHORS = anchors(REF);
if (VERBOSE) console.log(`reference plan: ${REF_ANCHORS.length} dressing anchors over ${REF.length} u`);

const fails = [];
const check = (cond, msg) => {
  if (!cond) fails.push(msg);
  if (VERBOSE) console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  return cond;
};

// pick three distinct dressed cells, so we can place one at avoid index 0,
// one at index 1 and one at index 2 — the three broken snap cases
const targets = [];
for (const a of REF_ANCHORS) {
  if (targets.every((t) => !near(t, a, 3.2))) targets.push(a);
  if (targets.length === 3) break;
}
check(targets.length === 3, `found 3 well-separated dressed cells to test (got ${targets.length})`);

// ---- 1. each index position must block ------------------------------------
// The avoid list is REORDERED so each target visits index 0, 1 and 2 in turn.
// Pre-fix, index 0 blocked nothing at all and 1/2 blocked the wrong grid.
for (let rot = 0; rot < targets.length; rot += 1) {
  const list = targets.map((_t, i) => targets[(i + rot) % targets.length]);
  const plan = boulevardPlan({ ...BASE, avoid: list });
  const got = anchors(plan);
  for (let i = 0; i < list.length; i += 1) {
    const cell = list[i];
    check(
      REF_ANCHORS.some((a) => near(a, cell, 1e-6)),
      `avoid index ${i} target ${fmt(cell)} IS dressed without \`avoid\` (assertion not vacuous)`,
    );
    const leaks = got.filter((a) => near(a, cell));
    check(leaks.length === 0, `avoid index ${i} ${fmt(cell)} blocks its cell — ${leaks.length} anchor(s) leaked${leaks.length ? ` e.g. ${fmt(leaks[0])}` : ''}`);
  }
  check(got.length < REF_ANCHORS.length, `avoid rotation ${rot}: anchor count drops ${REF_ANCHORS.length} → ${got.length}`);
}

// ---- 2. a SINGLE avoid cell must block (the pure index-0 case) -------------
// This is the exact shape the composing agent writes and the one that failed
// hardest pre-fix: one avoid cell, index 0, cell = 0 → [NaN, NaN].
{
  const cell = targets[0];
  const plan = boulevardPlan({ ...BASE, avoid: [cell] });
  const got = anchors(plan);
  check(got.filter((a) => near(a, cell)).length === 0, `single-element avoid [${fmt(cell)}] blocks its cell (the [NaN, NaN] case)`);
  check(got.length < REF_ANCHORS.length, `single-element avoid drops anchors ${REF_ANCHORS.length} → ${got.length}`);
  // and it must block ONLY near that cell — `avoid` is not a global mute
  const far = REF_ANCHORS.filter((a) => !near(a, cell));
  check(
    far.every((a) => got.some((g) => near(g, a, 1e-6))),
    `single-element avoid keeps all ${far.length} anchors outside its clearance`,
  );
}

// ---- 3. the snap still happens --------------------------------------------
// An off-lattice avoid cell must round onto the 1.2 lattice and block the
// dressed cell it lands on (this is what `snapXZ` is FOR — the fix must not
// have been "drop the snap").
{
  const cell = targets[0];
  const jitter = [cell[0] + CELL * 0.4, cell[1] - CELL * 0.4]; // < half a cell off
  const plan = boulevardPlan({ ...BASE, avoid: [jitter] });
  check(
    anchors(plan).filter((a) => near(a, cell)).length === 0,
    `off-lattice avoid ${fmt(jitter)} snaps onto ${fmt(cell)} and blocks it`,
  );
}

// ---- 4. `clear` still widens the exclusion -------------------------------
{
  const cell = targets[0];
  const tight = anchors(boulevardPlan({ ...BASE, avoid: [cell], clear: 0.5 })).length;
  const wide = anchors(boulevardPlan({ ...BASE, avoid: [cell], clear: 4 })).length;
  check(wide < tight, `\`clear\` scales the exclusion: 4 u removes more than 0.5 u (${tight} → ${wide})`);
}

console.log(
  fails.length
    ? `\nBoulevard avoid probe: ${fails.length} FAILURE(S)\n  ${fails.join('\n  ')}\n\nThe \`.map(snapXZ)\` index bug is back — see this file's header.`
    : `\nBoulevard avoid probe: PASS (${REF_ANCHORS.length} reference anchors, ${targets.length} cells tested at avoid index 0/1/2)`,
);
process.exit(fails.length ? 1 : 0);
