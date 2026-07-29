#!/usr/bin/env node
// ===========================================================================
// score-park.selftest.mjs — PROOF THAT score-park.mjs CAN FAIL
// ===========================================================================
//
//   node score-park.selftest.mjs [--park=<name>]     # exit 0 = every proof held
//
// "A scorer that always returns a high number is the bug we are replacing." This
// mutates an IN-MEMORY copy of a high-scoring park's probe.json — nothing is
// written to disk, no signature is published, `shots/` and `signatures/` are
// untouched — and asserts that each mutation costs points ON THE AXIS IT SHOULD.
// It also asserts the three policy invariants: a MISSING input is unmeasured
// (neither awarded nor zeroed), an UNKNOWN gate-failure kind is not forgiven, and
// two runs on the same probe.json are byte-identical.
//
// It found two real defects in score-park.mjs while being written: axis 8's
// "believe the gate" rule forgave five real water bodies, and (via the r15a
// comparison) the highest-drop credibility test extrapolated top speed LINEARLY
// where the physics is sqrt.
import fs from 'node:fs';
import { scoreProbe, GATE_FAIL_SUBTAG_AXIS, GATE_FAIL_SUBTAG_PREFIX_AXIS, GATE_FAIL_NO_DOUBLE_CHARGE, subtagAxisOf, detailSubtagOf } from './score-park.mjs';
import { corpusSnapshot, rosterNovelty } from './corpus.mjs';
import { verifyAgainstSource, isOwnHeadlineContent } from './themes.mjs';
import { scoreWorlds } from './score-worlds.mjs';

const parkArg = (process.argv.find((a) => a.startsWith('--park=')) || '--park=skeleton-a').slice(7);
const BASE = new URL(`./shots/${parkArg}/probe.json`, import.meta.url).pathname;
if (!fs.existsSync(BASE)) { console.error(`[selftest] no such probe.json: ${BASE}`); process.exit(2); }
const raw = fs.readFileSync(BASE, 'utf8');
const load = () => JSON.parse(raw);
const base = scoreProbe(load(), { park: parkArg });
const ax = (r, n) => r.axes.find((a) => a.axis === n);
console.log(`BASELINE ${parkArg}: ${base.total}/100  complete=${base.complete}`);
console.log('');

const CASES = [
  ['axis 1  litter 9 + no bins + no restroom', 1, (p) => { p.sim.litterCount = 9; p.paths.bins = 0; p.restrooms = []; }],
  ['axis 2  0 plazas + 3 orphan islands + tree net (no cycles)', 2, (p) => { p.paths.plazas = 0; p.accessibility.orphanIslands = 3; p.paths.edges = p.paths.nodes - 1; }],
  ['axis 2  huddled net (extentFractionOfPark 0.09)', 2, (p) => { p.paths.extentFractionOfPark = 0.09; }],
  ['axis 3  2 OBB overlapping pairs + minGap 0.3', 3, (p) => { p.rideSpacing.obb.overlappingPairs = ['A <> B', 'C <> D']; p.rideSpacing.obb.minGap = 0.3; }],
  ['axis 4  every exit lane unpaved (exitLaneLen 0)', 4, (p) => { p.entrance.rideAccessNodes.forEach((r) => { r.exitLaneLen = 0; }); }],
  ['axis 5  1 stall, default-named', 5, (p) => { p.stallRoster.registeredCount = 1; p.stallRoster.distinctKinds = 1; p.stallRoster.coversFoodAndDrink = false; p.stallRoster.themedNameCount = 0; p.stallRoster.stalls = [{ name: 'Burger Bar', kind: 'BurgerShop', item: 'food', at: [500, 500] }]; }],
  ['axis 6  gate not attached to the path net', 6, (p) => { p.entrance.attachedToPathNode = false; }],
  ['axis 6  no gate at all', 6, (p) => { p.entrance.gateMeshes = 0; }],
  ['axis 7  DEAD FLAT (stdH 0.2) + a pad on a slope', 7, (p) => { p.terrain.stdH = 0.2; p.terrain.lint.flatEnough = { 'Pad X': 'on a 0.9 slope' }; }],
  ['axis 7  spike (maxSlope 11)', 7, (p) => { p.terrain.maxSlope = 11; }],
  ['axis 8  POND SCATTER (bodyCount 5)', 8, (p) => { p.water.terrainWater.bodyCount = 5; p.water.terrainWater.bodyAreas = [900, 300, 120, 90, 60]; }],
  ['axis 8  secondary body is a puddle + fused lobes', 8, (p) => { p.water.terrainWater.secondFrac = 0.03; p.water.terrainWater.bodyGap = 1.0; }],
  ['axis 9  bare plazas (2 scenery pieces)', 9, (p) => { p.scenery.count = 2; p.composables = {}; }],
  ['axis 10 treeless + flat', 10, (p) => { p.trees.count = 0; p.trees.byShape = {}; p.trees.positions = []; p.terrain.peaks = 0; }],
  ['axis 11 default-named rides/stalls + monotone scenery', 11, (p) => { p.rides.forEach((r) => { r.name = r.defaultName; }); p.stallRoster.themedNameCount = 0; p.sceneryVariety.varietyIndex = 1; }],
  ['axis 12 2 orphan islands + stalls unreachable + steep edges', 12, (p) => { p.accessibility.orphanIslands = 2; p.accessibility.allStallsReachable = false; p.rampObservations.steepEdges = ['e1', 'e2']; }],
  ['axis 13 2 rides, 1 category, no monorail, derivative roster', 13, (p) => { p.rideRoster.registeredCount = 2; p.rideRoster.rides = [{ kind: 'Carousel' }, { kind: 'Carousel' }]; p.rideRoster.categoryCount = 1; p.rideRoster.circuitsBesidesFlagship = 0; p.rideRoster.circuitFamilyCount = 1; p.rideRoster.novelty.distance = 0.1; p.rideRoster.firstUseKinds = []; p.monorail.present = false; }],
  // ---- the MANDATED-COASTER EXEMPTION must not become a padding loophole.
  // Baseline skeleton-a is 9 rides / 2 Coasters / ratedCount 2, so exactly ONE
  // duplicate is exempt and the kinds row pays the full 1.5. These three prove
  // the exemption is bounded in all three directions it could leak.
  ['axis 13 a GENUINE (non-coaster) duplicate kind is STILL docked', 13, (p) => {
    // swap MoonlitBarge for a second RiverRapids: 2 Coasters (1 exempt) AND a
    // duplicate water ride (chargeable) -> kinds 1.5 -> 1.0
    p.rideRoster.rides = p.rideRoster.rides.map((r) => (r.kind === 'MoonlitBarge' ? { ...r, kind: 'RiverRapids' } : r));
  }],
  ['axis 13 a FOURTH coaster is STILL docked (exemption caps at 2)', 13, (p) => {
    // 4 Coasters, ALL rated: 3 duplicates, only the 2nd and 3rd are mandated
    p.rideRoster.rides = p.rideRoster.rides.map((r) => (r.kind === 'MotionSimulator' || r.kind === 'HauntedMansion' ? { ...r, kind: 'Coaster' } : r));
    p.thrill.ratedCount = 4;
  }],
  ['axis 13 PADDING with UNRATED coaster copies buys NO exemption', 13, (p) => {
    // 3 Coasters but only ONE of them rated -> the mandate is 0 duplicates, so
    // BOTH copies are padding and both are charged
    p.rideRoster.rides = p.rideRoster.rides.map((r) => (r.kind === 'MotionSimulator' ? { ...r, kind: 'Coaster' } : r));
    p.thrill.ratedCount = 1;
  }],
  ['axis 14 ONE coaster, no second, weak E/G/drop', 14, (p) => { p.thrill.ratedCount = 1; p.thrill.coasterCount = 1; p.thrill.flagshipExcitement = 1.4; p.thrill.peakPosVertG = 0.6; p.thrill.bestHighestDrop = 0.3; p.thrill.bestAirtimeSeconds = 0; p.thrill.bestNegVertG = 0; p.thrill.mixComplete = false; p.thrill.intensityMix = { gentle: 1, moderate: 0, intense: 0 }; p.rideRoster.circuitCount = 1; p.rideRoster.firstUseCircuits = []; }],
  ['axis 14 NAUSEA GUARD (nauseaExtreme)', 14, (p) => { p.thrill.nauseaExtreme = true; }],
  ['axis 14 coaster gate FAILED', 14, (p) => { p.thrill.coasterGateOk = false; p.thrill.fatalCoasters = 1; }],
  // an ILLEGAL coaster must not bank the RATING its illegal geometry produced.
  // `coasterGateOk: false` ALONE (nothing fatal, every rating number still
  // present and excellent) used to cost 1 of 8; it must now cost the whole
  // flagship/second/force/drop/airtime block.
  ['axis 14 gate FAILED but nothing fatal — the E rating is FORFEIT', 14, (p) => { p.thrill.coasterGateOk = false; }],
  ['axis 15 a MONOTONOUS LATTICE (gridRegularity 0.82)', 15, (p) => { p.layout.gridRegularity = 0.82; p.layout.edgeLengths.effectiveClasses = 1.1; p.layout.lattice.latticeNodeShare = 0.95; }],
  ['axis 16 3 cross-theme placements', 16, (p) => { delete p.worlds.score; p.worlds.crossThemeCount = 3; p.worlds.crossTheme = [1, 2, 3].map((i) => ({ piece: 'LavaFissure', pieceTheme: 'emberfall', at: [i, i], world: 'pulse', worldTheme: 'pulse' })); }],
];

let bad = 0;
for (const [label, n, mut] of CASES) {
  const p = load(); mut(p);
  const r = scoreProbe(p, { park: parkArg });
  const b = ax(base, n), a = ax(r, n);
  const drop = (b.score ?? 0) - (a.score ?? 0);
  const ok = drop > 0;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  ${label}`);
  console.log(`        axis ${n}: ${b.score} -> ${a.score}  (−${Math.round(drop * 100) / 100})   total ${base.total} -> ${r.total}`);
  console.log(`        reason: ${String(a.reason).slice(0, 190)}`);
}

// ---- the UNMEASURED policy: a deleted input must NOT pass and must NOT zero
console.log('');
{
  const p = load(); delete p.paths.bins;
  const r = scoreProbe(p, { park: parkArg }); const a = ax(r, 1);
  const ok = a.unmeasured === true && a.score === null && !r.complete && r.measurableMax === 95;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  MISSING INPUT (delete paths.bins) -> axis 1 unmeasured, NOT awarded, NOT zeroed`);
  console.log(`        axis 1 score=${a.score} unmeasured=${a.unmeasured} complete=${r.complete} total ${r.total}/${r.measurableMax}`);
}
{
  const p = load(); p.validation = null; delete p.consoleSummary.validatorLine;
  const r = scoreProbe(p, { park: parkArg });
  const ok = !r.complete && r.unmeasured.some((u) => /validatePark verdict/.test(u.what));
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  MISSING GATE VERDICT -> reported unmeasured, never read as "no failures"`);
}
// ===========================================================================
// THE 40-POINT RENDER CAP — IT MUST STILL FIRE, AND ONLY ON A RENDER FAILURE
// ===========================================================================
// Wave 16A: the cap read `consoleSummary.errors` (ANY console.error) and pinned
// r16a's 56.55 at 40 over ten lines that were all charged on their own axes
// already. Deleting the cap would have been the wrong fix, so these four
// mutations bracket it from both sides: two genuine failures that MUST cap, one
// pile of component reports that must NOT, and one unclassifiable line that must
// make the verdict UNMEASURED rather than silently pass either way.
{
  const p = load(); p.consoleSummary.errors = ['[pageerror] TypeError: boom'];
  delete p.consoleSummary.pageErrors; delete p.consoleSummary.componentErrors; delete p.consoleSummary.unclassifiedErrors;
  const r = scoreProbe(p, { park: parkArg });
  const ok = r.total === 40 && r.caps.length === 1;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  A GENUINE RENDER FAILURE STILL CAPS: [pageerror] -> total 40 (got ${r.total})`);
}
{
  // React 18.3.1 production's logCapturedError does a BARE `console.error(err)`
  // for an uncaught render with no boundary, which puppeteer renders as
  // `JSHandle@error` and NOT as a pageerror. It is the only error marker on the
  // parks that rendered nothing at all (w11d-hm2: 17 of them, validatorLine
  // null), so it must cap too — the fix must not narrow the cap to the literal
  // string `[pageerror]`.
  const p = load(); p.consoleSummary.errors = ['[error] JSHandle@error', '[error] JSHandle@error'];
  delete p.consoleSummary.pageErrors; delete p.consoleSummary.componentErrors; delete p.consoleSummary.unclassifiedErrors;
  const r = scoreProbe(p, { park: parkArg });
  const ok = r.total === 40 && r.caps.length === 1;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  REACT'S UNCAUGHT-RENDER MARKER STILL CAPS: [error] JSHandle@error -> total 40 (got ${r.total})`);
}
{
  // ten COMPONENT-prefixed lines, the exact r16a shape: no cap, a note that says
  // why, and the total left where the axes put it
  const p = load();
  p.consoleSummary.errors = [
    ...Array(8).fill('[error] [plan] FATAL edgeDiagonal: buildParkNet: your edge 29 ... is DIAGONAL'),
    ...Array(2).fill('[error] [Coaster] "X" has a FATAL track — worst lateral 1.64 g'),
  ];
  delete p.consoleSummary.pageErrors; delete p.consoleSummary.componentErrors; delete p.consoleSummary.unclassifiedErrors;
  const r = scoreProbe(p, { park: parkArg });
  const ok = r.caps.length === 0 && r.total === base.total && r.notes.some((n) => /COMPONENT-prefixed/.test(n));
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  10 COMPONENT-prefixed console.error(s) do NOT cap (r16a's shape): total ${base.total} -> ${r.total}, caps ${r.caps.length}`);
}
{
  const p = load(); p.consoleSummary.errors = ['[error] something nobody has classified'];
  delete p.consoleSummary.pageErrors; delete p.consoleSummary.componentErrors; delete p.consoleSummary.unclassifiedErrors;
  const r = scoreProbe(p, { park: parkArg });
  const ok = r.caps.length === 0 && !r.complete && r.unmeasured.some((u) => /UNCLASSIFIED console\.error/.test(u.what));
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  an UNCLASSIFIED [error] line -> UNMEASURED (cap neither applied nor waived)`);
}
{
  const p = load(); p.consoleSummary.validatorFails = ['[warn] [Park] validatePark FAIL [totallyNewCheck] something new'];
  const r = scoreProbe(p, { park: parkArg });
  const ok = !r.complete && r.unmeasured.some((u) => /totallyNewCheck/.test(u.what));
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  UNMAPPED gate FAIL kind -> unmeasured, NOT silently forgiven`);
}
// ===========================================================================
// EVERY `autofix` SUBKIND LANDS ON ITS INTENDED AXIS
// ===========================================================================
// `validation.failures[].check` is `'autofix'` for 12 of r16a's 23 failures and
// the real kind is a `[subkind]` inside `detail`. The scorer used to key the
// failure on the BUCKET, which has no axis, so the park was unscoreable — and so
// was every park whose defects arrive through the plan-lint path SETUP.md §0-P.5
// calls normal. This asserts the whole map is wired, one subkind at a time,
// against the axis the map claims: a typo in the table is a failing proof, not a
// silently misattributed charge.
console.log('');
{
  let cases = 0, fails = 0;
  for (const [sub, wantAxis] of Object.entries(GATE_FAIL_SUBTAG_AXIS)) {
    const p = load();
    p.consoleSummary.validatorFails = [`[warn] [Park] validatePark FAIL [autofix] [${sub}] injected by the selftest`];
    const r = scoreProbe(p, { park: parkArg });
    const charge = r.gate.charges.find((c) => c.kind === sub);
    const a = ax(r, wantAxis), b = ax(base, wantAxis);
    // A subkind in GATE_FAIL_NO_DOUBLE_CHARGE is attributed but DELIBERATELY not
    // charged — the axis already reads the same evidence numerically. So it must
    // still be RECOGNISED (never unmapped) and must NOT move the axis.
    const guarded = GATE_FAIL_NO_DOUBLE_CHARGE.has(sub);
    const landed = guarded
      ? r.gate.failKinds[sub] === 1 && charge && charge.charge === 0 && /not double-charged/.test(String(charge.why))
      : charge && charge.axis === wantAxis && r.gate.failKinds[sub] === 1;
    const cost = b.score !== null && a.score !== null && (guarded ? a.score === b.score : a.score < b.score);
    cases++;
    if (!(landed && cost && r.complete)) {
      fails++;
      console.log(`  **FAIL**  [autofix] [${sub}]${guarded ? ' (no-double-charge)' : ''} -> axis ${wantAxis}: charged=${charge && charge.axis} axis ${b.score}->${a.score} complete=${r.complete}`);
    }
  }
  // the open-set `coaster:*` FAMILY, matched by prefix rather than enumerated
  for (const [re, wantAxis] of GATE_FAIL_SUBTAG_PREFIX_AXIS) {
    const sub = re.source.replace(/[^\w:]/g, '') + 'someNewViolation';
    const p = load();
    p.consoleSummary.validatorFails = [`[warn] [Park] validatePark FAIL [autofix] [${sub}] injected by the selftest`];
    const r = scoreProbe(p, { park: parkArg });
    const charge = r.gate.charges.find((c) => c.kind === sub);
    cases++;
    if (!(charge && charge.axis === wantAxis && subtagAxisOf(sub) === wantAxis)) {
      fails++;
      console.log(`  **FAIL**  the ${re} FAMILY: [${sub}] -> expected axis ${wantAxis}, charged ${charge && charge.axis}`);
    }
  }
  if (fails) bad++;
  console.log(`${fails ? '**FAIL**' : 'PASS'}  ${cases - fails}/${cases} autofix subkind(s) land on the axis GATE_FAIL_SUBTAG_AXIS names (incl. the coaster:* prefix family)`);
}
{
  // r16a's four previously-unmapped subkinds, named, because those are the ones
  // that made a fully-rendered park unscoreable
  const p = load();
  p.consoleSummary.validatorFails = ['edgeThroughSolid', 'edgeDiagonal', 'netWarnings', 'terrainFlattened'].map(
    (k) => `[warn] [Park] validatePark FAIL [autofix] [${k}] injected by the selftest`,
  );
  const r = scoreProbe(p, { park: parkArg });
  const ok = r.complete && Object.keys(r.gate.failKinds).length === 4 && r.gate.charges.every((c) => c.axis !== null && c.charge > 0);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  r16a's four unmapped subkinds are now SCOREABLE: ${JSON.stringify(r.gate.failKinds)} -> axes ${r.gate.charges.map((c) => c.axis).join('/')}, complete=${r.complete}`);
}
{
  // ...and the refuse-to-forgive policy survives INSIDE the bucket: an autofix
  // subkind nobody has mapped is reported BY ITS OWN NAME, not as an anonymous
  // "autofix" count, and does not silently score 0 charge on a guessed axis
  const p = load();
  p.consoleSummary.validatorFails = ['[warn] [Park] validatePark FAIL [autofix] [brandNewSubkind] injected by the selftest'];
  const r = scoreProbe(p, { park: parkArg });
  const ok = !r.complete
    && r.unmeasured.some((u) => /brandNewSubkind/.test(u.what))
    && r.gate.charges.some((c) => c.kind === 'brandNewSubkind' && c.axis === null && c.charge === 0);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  an UNRECOGNISED autofix SUBKIND is still refused, reported by name (not as "autofix")`);
}
{
  // the `[subkind]` charset must admit `:` — `coaster:shortDrop` is in
  // validate.ts's FATAL_LINT_KINDS and the old `[A-Za-z][\w]*` could not see it
  const ok = subtagAxisOf('coaster:shortDrop') === 14 && subtagAxisOf('autofix') === undefined;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  coaster:shortDrop -> axis 14 (the ':' charset), and the bucket 'autofix' itself stays UNMAPPED`);
}
// ---- axis 13: §0-P.4 MANDATES 5 CATEGORIES, so 4 must cost something
{
  const p = load(); p.rideRoster.categoryCount = 4;
  const r = scoreProbe(p, { park: parkArg });
  const b = ax(base, 13), a = ax(r, 13);
  const ok = a.score === b.score - 0.5 && /MANDATES all 5/.test(a.reason);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  4 of 5 ride CATEGORIES costs 0.5 (§0-P.4 mandates 5): axis 13 ${b.score} -> ${a.score}`);
}
{
  const p = load(); p.rideRoster.categoryCount = 5;
  const r = scoreProbe(p, { park: parkArg });
  const ok = ax(r, 13).score === ax(base, 13).score && /categories 1.5\/1.5/.test(ax(r, 13).reason);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  5 of 5 categories still takes the full 1.5 (the band was re-spaced, not just tightened)`);
}
// ---- the MONORAIL DECK CENTRES ARE IN WORLD SPACE
{
  // probe-side fix, asserted here as a FORWARD GUARD: any probe.json that
  // declares `deckCenterFrame: 'world'` must have its deck centres agree with
  // the manager's own world-space boardPoints. A regression to the ring's local
  // template frame shows up as a constant offset on every station at once.
  const p = load();
  const m = p.monorail || {};
  if (m.deckCenterFrame === 'world' && Array.isArray(m.deckCenters) && Array.isArray(m.stations) && m.stations.length === m.deckCenters.length) {
    const worst = Math.max(
      ...m.deckCenters.map((c, i) => {
        const bp = m.stations[i].boardPoint;
        return bp ? Math.hypot(c[0] - bp[0], c[2] - bp[2]) : 0;
      }),
    );
    const ok = worst < 3;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : '**FAIL**'}  monorail deckCenters are WORLD space (worst deck-vs-boardPoint gap ${Math.round(worst * 100) / 100} u)`);
  } else {
    console.log(`SKIP  monorail deckCenters frame — this probe.json predates \`deckCenterFrame\` (re-probe to assert it)`);
  }
}
// ---- THE NOVELTY DENOMINATOR IS PINNABLE AND RECORDED
{
  // Waves 16A and 16B ran concurrently and both wrote into `signatures/`
  // mid-run, so the same park scored twice can get two different novelty
  // denominators. A PINNED snapshot must reproduce exactly, and the score must
  // record which parks were in it (a size cannot identify a corpus: two
  // different 29-park corpora are both "29").
  const snap = corpusSnapshot({ exclude: parkArg });
  const one = scoreProbe(load(), { park: parkArg, corpusPin: snap.names });
  const two = scoreProbe(load(), { park: parkArg, corpusPin: snap.names });
  const st = one.corpusStamp.scoringTime;
  const ok = st && st.pinned === true && st.sha256 === snap.sha256 && Array.isArray(st.names) && st.names.length === snap.size
    && one.total === two.total && JSON.stringify(one.axes) === JSON.stringify(two.axes);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  a PINNED corpus reproduces exactly and is RECORDED by name+hash in score.json (${snap.size} parks, sha ${snap.sha256})`);
}
{
  // and dropping a park out of the pin CHANGES the recorded hash — the stamp is
  // load-bearing, not decorative
  const snap = corpusSnapshot({ exclude: parkArg });
  const shorter = snap.names.slice(0, -1);
  const r = scoreProbe(load(), { park: parkArg, corpusPin: shorter });
  const ok = r.corpusStamp.scoringTime.sha256 !== snap.sha256 && r.corpusStamp.scoringTime.size === shorter.length;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  removing one park from the pin changes the recorded corpus hash (${snap.size} -> ${r.corpusStamp.scoringTime.size})`);
}
// ---- A PARK IS NEVER IN ITS OWN NOVELTY DENOMINATOR
{
  // `samples/skeleton-b.tsx` is stored under the name `w18-skeleton-b`, so a
  // NAME-based exclusion left it scoring against a zero-distance copy of itself
  // (`layout.novelty { distance: 0, nearest: "w18-skeleton-b" }`). Identity is the
  // resolved `park` PATH. This proves the path match bites where the name does not.
  const byName = corpusSnapshot({ exclude: 'skeleton-b' });
  const byPath = corpusSnapshot({ exclude: { name: 'skeleton-b', park: new URL('./samples/skeleton-b.tsx', import.meta.url).pathname } });
  const ok = byName.size === byPath.size + 1
    && byPath.selfExcluded.some((e) => e.name === 'w18-skeleton-b' && e.matchedBy === 'park path')
    && byName.selfExcluded.length === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  SELF-EXCLUSION BY RESOLVED PATH catches what the name misses (skeleton-b: name-excl ${byName.size} vs path-excl ${byPath.size}, dropped ${JSON.stringify(byPath.selfExcluded.map((e) => e.name))})`);
}
{
  // and the scorer never certifies a park as a copy of itself: whatever the
  // corpus contains, this park's own signature must not be the nearest neighbour
  const r = scoreProbe(load(), { park: parkArg });
  const st = r.corpusStamp;
  const nearest = r.axes.find((a) => a.axis === 15) && (r.corpusStamp.scoringTime || {});
  const ownNames = (st.scoringTime && st.scoringTime.selfExcluded || []).map((e) => e.name);
  const inDenominator = ownNames.filter((n) => (st.scoringTime.names || []).includes(n));
  const ok = st.selfExclusion.by === 'resolved park path' && inDenominator.length === 0 && !!nearest;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  ${parkArg} self-excludes by ${st.selfExclusion.by} (dropped ${JSON.stringify(ownNames)}), and 0 of its own signatures remain in the ${st.scoringTime.size}-park denominator`);
}
// ---- AN ILLEGAL COASTER BANKS NO THRILL: the forfeiture is a HARD CEILING,
// not a nudge. Every rating number is left excellent and only the gate flips.
{
  const p = load(); p.thrill.coasterGateOk = false;
  const r = scoreProbe(p, { park: parkArg }); const a = ax(r, 14);
  const ok = a.score <= 1.75 && /FORFEIT|ILLEGAL COASTER/.test(a.reason);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  ILLEGAL COASTER -> axis 14 capped at 1.75/8, the E/second/force/drop/airtime rows FORFEIT`);
  console.log(`        axis 14 ${ax(base, 14).score} -> ${a.score} (flagshipExcitement left at ${p.thrill.flagshipExcitement})`);
}
// ---- THE PARK TYPE IS MEASURED, AND --parkType CANNOT LOOSEN IT.
// skeleton-a's flagship rates intensity 9.55, so the measurement says THRILL
// (the stricter targets). `--parkType=family` must be REFUSED, not obeyed.
{
  const derived = scoreProbe(load(), { park: parkArg });
  const forced = scoreProbe(load(), { park: parkArg, parkType: 'family' });
  const ok = derived.parkType === 'thrill'
    && derived.parkTypeBasis.assumptionBased === false
    && forced.parkType === 'thrill'
    && /REFUSED/.test(String(forced.parkTypeBasis.override))
    && forced.total === derived.total;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  PARK TYPE is MEASURED (${derived.parkType}, ${derived.parkTypeBasis.source}) and --parkType=family is REFUSED as the more generous branch`);
  console.log(`        derived ${derived.parkType}/${derived.total}  vs  --parkType=family ${forced.parkType}/${forced.total}`);
}
// ---- and the stricter override IS honoured, and a park with NO decisive
// evidence falls to the STRICT branch flagged as an assumption
{
  const p = load();
  // strip every intensity signal: no rated coaster, and a mix that decides nothing
  p.coasters = []; p.thrill.intensityMix = { gentle: 0, moderate: 3, intense: 0 };
  const r = scoreProbe(p, { park: parkArg });
  const ok = r.parkType === 'thrill' && r.parkTypeBasis.assumptionBased === true
    && r.notes.some((n) => /ASSUMPTION-BASED/.test(n));
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  NO decisive intensity evidence -> the STRICTER (thrill) branch, flagged assumptionBased in score.json`);
}
// ---- AN EMPTY ROSTER IS UNMEASURED, NOT MAXIMALLY NOVEL (wave 18B, 2026-07-27).
// `jaccardDistance([], K)` is 1.0 — the TOP of the novelty scale — so a park that
// registered nothing used to collect full novelty credit off an empty array.
{
  const corpus = [{ name: 'ref-a', rideKinds: ['Coaster', 'Monorail'] }, { name: 'ref-b', rideKinds: ['FerrisWheel'] }];
  const empty = rosterNovelty([], corpus);
  const real = rosterNovelty(['Coaster', 'GhostTrain'], corpus);
  const ok = empty.distance === null && empty.nearest === null && /UNMEASURED/.test(String(empty.unmeasured))
    && empty.corpusSize === 2                       // the denominator is still reported
    && real.distance > 0 && real.distance < 1 && real.nearest === 'ref-a';   // and the real path still works
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  an EMPTY ride roster reads UNMEASURED (distance null), not novelty 1.0; a real roster still scores (${real.distance} vs ${real.nearest})`);
}
// ---- `sim` IS ATTRIBUTED FROM ITS DETAIL TEXT (wave 18A, 2026-07-27).
// 18A scored 75.89 ***INCOMPLETE*** on one unmapped bare `sim` failure. `sim` is
// emitted from three validate.ts call sites that land on two different axes, so
// it is keyed on a synthetic subtag parsed out of the detail — and an unrecognised
// `sim` message must STILL be refused rather than absorbed by a guessed axis.
{
  const inject = (detail) => {
    const p = load();
    p.consoleSummary.validatorFails = [`[warn] [Park] validatePark FAIL [sim] ${detail}`];
    return scoreProbe(p, { park: parkArg });
  };
  const stuck = inject('guest 41 stood still >25 sim-s while "walking" — stuck off the graph?');
  const noRide = inject('no guest completed a ride cycle in 60 sim-s');
  const novel = inject('some sim message nobody has written yet');
  const a12 = ax(stuck, 12), b12 = ax(base, 12);
  const ok = detailSubtagOf('sim', 'no guest completed a ride cycle in 60 sim-s') === 'sim:noRideCycle'
    && stuck.gate.failKinds['sim:guestStuck'] === 1 && a12.score < b12.score && stuck.complete   // charged
    && noRide.gate.failKinds['sim:noRideCycle'] === 1 && noRide.complete                          // recognised
    && ax(noRide, 4).score === ax(base, 4).score                                                  // but not double-charged
    && novel.gate.failKinds.sim === 1 && novel.complete === false;                                // novel one REFUSED
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  bare \`sim\` attributes from its DETAIL (guestStuck -> axis 12 charged ${b12.score}->${a12.score}; noRideCycle -> axis 4 uncharged), and an UNKNOWN sim message is still refused`);
}
// ---- THE THEME ABSTRACTION (2026-07-27) --------------------------------
// Axis 16 speaks ONE theme id space. Three things must hold: the harness's
// mirror still agrees with the design system source; a legacy place name and
// its canonical genre id score IDENTICALLY; and the own-content term actually
// discriminates a world stocked with its own rides from one dressed in its
// scenery and stocked generic.
{
  const v = verifyAgainstSource();
  if (!v.ok) bad++;
  console.log(`${v.ok ? 'PASS' : '**FAIL**'}  themes.mjs mirrors the design system (THEME_IDS order, all 5 aliases resolve, every preset owns a ride + a stall)${v.ok ? '' : `\n        ${v.problems.join('\n        ')}`}`);
}
{
  // the SAME park, its world themes spelled the two different ways
  const spell = (map) => {
    const p = load();
    if (!p.worlds || !p.worlds.worlds) return null;
    p.worlds = JSON.parse(JSON.stringify(p.worlds));
    p.worlds.worlds.forEach((x) => { x.themeId = map[x.themeId] ?? x.themeId; });
    (p.worlds.themedPieces || []).forEach((q) => { q.themeId = map[q.themeId] ?? q.themeId; });
    return scoreProbe(p, { park: parkArg });
  };
  const TO_LEGACY = { fire: 'emberfall', pirateBeach: 'tidewater', steampunk: 'brasswork', enchantedForest: 'thornwick', neon: 'pulse' };
  const TO_CANON = Object.fromEntries(Object.entries(TO_LEGACY).map(([a, b]) => [b, a]));
  const legacy = spell(TO_LEGACY);
  const canon = spell(TO_CANON);
  const ok = legacy && canon && ax(legacy, 16).score === ax(canon, 16).score;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  a world spelled 'tidewater' and one spelled 'pirateBeach' score the SAME on axis 16 (${legacy ? ax(legacy, 16).score : '?'} both ways) — the id space no longer decides the score`);
}
{
  // strip every world's OWN themed ride/stall and the ownContent half must go
  // to 0 while the districts half is untouched — worlds still "built", just
  // no longer different places.
  const p = load();
  const before = scoreWorlds(p.worlds);
  const gutted = JSON.parse(JSON.stringify(p.worlds || {}));
  gutted.themedPieces = (gutted.themedPieces || []).filter((q) => !isOwnHeadlineContent(q.kind, q.themeId));
  const after = scoreWorlds(gutted);
  const ok = before.buildOutTerms && after.buildOutTerms
    && after.buildOutTerms.ownContent === 0
    && after.buildOutTerms.districts === before.buildOutTerms.districts
    && after.total < before.total
    && after.notes.some((n) => /holds NONE of its own themed rides or stalls/.test(n));
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  removing every world's OWN themed ride/stall zeroes ownContent (${before.buildOutTerms?.ownContent} -> ${after.buildOutTerms?.ownContent}) and leaves districts at ${after.buildOutTerms?.districts}; axis 16 ${before.total} -> ${after.total}`);
}
{
  // SCENERY MUST NOT BUY IT. A world holding only its own scenery is the exact
  // failure the term was added for, so scenery-only has to read as no own content.
  const sceneryOnly = isOwnHeadlineContent('GiantToadstools', 'enchantedForest');
  const ride = isOwnHeadlineContent('WyrmsHollow', 'enchantedForest');
  const stall = isOwnHeadlineContent('Honeywitch', 'enchantedForest');
  const foreign = isOwnHeadlineContent('WyrmsHollow', 'neon');
  const viaAlias = isOwnHeadlineContent('WyrmsHollow', 'thornwick');
  const ok = !sceneryOnly && ride && stall && !foreign && viaAlias;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  own-content counts RIDES and STALLS only: WyrmsHollow ${ride}, Honeywitch ${stall}, GiantToadstools(scenery) ${sceneryOnly}, WyrmsHollow-in-neon ${foreign}, and the alias 'thornwick' resolves ${viaAlias}`);
}
// ---- DETERMINISM: two runs on the same probe must be byte-identical
{
  const strip = (r) => JSON.stringify({ ...r, scoredAt: null });
  const ok = strip(scoreProbe(load(), { park: parkArg })) === strip(scoreProbe(load(), { park: parkArg }));
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : '**FAIL**'}  DETERMINISM: two runs on the same probe.json are byte-identical`);
}
console.log('');
console.log(bad ? `${bad} PROOF FAILURE(S)` : 'all proofs passed — the scorer takes points off, refuses missing inputs, and is deterministic');
process.exit(bad ? 1 : 0);
