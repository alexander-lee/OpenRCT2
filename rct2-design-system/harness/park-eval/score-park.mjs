#!/usr/bin/env node
// ===========================================================================
// score-park.mjs — THE 16-AXIS RUBRIC SCORER (built 2026-07-26)
// ===========================================================================
//
//   node score-park.mjs <park-name | path/to/probe.json> [--parkType=thrill|family]
//                       [--json] [--no-write] [--allow-unmeasured]
//
// `--parkType` HAS NO DEFAULT (fixed 2026-07-26). The park type is MEASURED by
// `deriveParkType()` off the park's own ratings; the flag is a STRICT-ONLY
// override — `=thrill` over a measured family is accepted, `=family` over a
// measured thrill is REFUSED. See `parkTypeBasis` in score.json.
//
// WHY THIS FILE EXISTS. Until today `eval.mjs` wrote 8 PNGs and a console.log
// and computed NO SCORE AT ALL, and only axis 15 (`score-layout.mjs`) and axis
// 16 (`score-worlds.mjs`, embedded as `probe.worlds.score`) had executable
// scorers. Every other axis was hand-applied prose: an agent read RUBRIC.md,
// read probe.json and did the arithmetic in its head. So every score the
// campaign has produced — including the "90/100" high-water mark — was a
// judgement, not a measurement, and two scorers would not reach the same
// number. The standing goal "two consecutive parks at 100/100" was therefore
// unfalsifiable. This file makes it falsifiable.
//
// THE ONE INVARIANT: **A MISSING INPUT NEVER SCORES AS A PASS.** Every axis
// declares the probe fields it reads up front. If one of them is absent (or
// `null`, which is what probe.mjs writes when a measurement could not be
// obtained), the axis is reported `unmeasured` — its weight leaves the
// denominator, the total is stamped INCOMPLETE, and the process exits non-zero.
// It is never silently awarded and never silently zeroed. This is the defect
// that bit the campaign three times on 2026-07-26 (`preflight` printing "clean"
// for a nonexistent file; `probe.validation` reading `null` for parks whose
// gate had passed; an eval-tag anchor going missing and turning an axis into a
// plausible zero).
//
// REUSE, NOT REIMPLEMENTATION:
//   axis 15 -> `scoreLayout(probe.layout)` from score-layout.mjs
//   axis 16 -> `probe.worlds.score` (already `scoreWorlds()`'s output, written
//              by probe.mjs:1155); `scoreWorlds` is called directly only when
//              an older probe.json has no embedded `score`.
//   weights -> parsed out of RUBRIC.md's own table by `readWeights()` below,
//              the SAME regex `check-weights.mjs` uses, so the scorer cannot
//              drift from the document. `check-weights.mjs` remains the thing
//              that asserts the table sums to 100 — this file only reads it.
//
// AMBIGUITY POLICY. RUBRIC.md gives an explicit numeric sub-test table for
// axes 4, 5, 13, 14, 15 and 16 only. Axes 1, 2, 3, 6, 7, 8, 9, 10, 11 and 12
// state thresholds in prose without a point breakdown. Where a decomposition
// had to be chosen it is (a) documented in the axis body, (b) made to sum
// exactly to the axis weight, and (c) listed in `AMBIGUITIES` below, which the
// CLI prints and score.json carries — so the reading is auditable instead of
// invisible.
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { scoreLayout } from './score-layout.mjs';
import { scoreWorlds } from './score-worlds.mjs';
import { corpusSnapshot, kindFrequency, layoutNovelty, rosterNovelty, underusedPresets } from './corpus.mjs';
import { circuitFamilyOf } from './catalog.mjs';

const round = (v) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 100) / 100);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// THE WEIGHTS COME OUT OF RUBRIC.md, NOT OUT OF THIS FILE
// ---------------------------------------------------------------------------
// Same table, same regex as check-weights.mjs. If someone reweights the rubric
// this scorer follows; if the table stops summing to 100, check-weights.mjs is
// what fails, and this file refuses to score rather than inventing a total.
export function readWeights(rubricPath = path.join(HERE, 'RUBRIC.md')) {
  const md = fs.readFileSync(rubricPath, 'utf8');
  const rows = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*$/);
    if (m) rows.push({ n: Number(m[1]), name: m[2].trim(), weight: Number(m[3]) });
    if (/^\|\s*\|\s*\*\*Total\*\*/.test(line)) break;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// AMBIGUITIES / SPECIFICATION DEFECTS found while implementing RUBRIC.md
// ---------------------------------------------------------------------------
// Reported, not quietly resolved (the task's standing instruction). Each entry
// names the axis, the exact rubric text, and the reading this file implements.
export const AMBIGUITIES = [
  {
    axis: 2,
    what: 'axis 2 vs axis 15 measure the SAME quantity — RESOLVED in the document, kept here as a note',
    rubric:
      'axis 2: "`extentFractionOfPark` is a FLOOR, not a band (fixed 2026-07-26 — was contradicting axis 15)" ' +
      '· axis 15: "`pathExtentFraction` itself is FLOOR-ONLY here (`min(1, pathExtentFraction/0.55)`)"',
    reading:
      'The contradiction the brief warns about (axis 2 band 0.2–0.6 vs axis 15 floor >= 0.55) was ALREADY FIXED in ' +
      'RUBRIC.md on 2026-07-26: axis 2 now says FLOOR ONLY, >= 0.2 healthy, < 0.15 huddling, no upper penalty. ' +
      'Implemented as the floor. NO park is penalised both ways by the current text; the parks that WOULD have been ' +
      'under the old ceiling are quantified in the report.',
  },
  {
    axis: 1,
    what: '"−1 per few litter pieces" has no numeric divisor',
    rubric: '"Full = zero litter, bins + restroom present; −1.5/axis item missing, −1 per few litter pieces."',
    reading: '−1 per 3 pieces of (litter + poop + vomit), rounded up. `avgHappiness` is named as evidence but carries no point value, so it is recorded as advisory and never scored.',
  },
  {
    axis: 2,
    what: 'no point breakdown for the 8 points',
    rubric: '"a coherent skeleton (loop/ring, no dead stubs, no orphan islands), plus `probe.paths` (edges ≥ nodes−1, cycles good; plazas ≥ 1). Grid-lint warnings deduct."',
    reading: '2 connectivity + 1.5 cycles + 1.5 orphan-free + 1 plazas + 1 extent floor + 1 no-dead-stubs = 8, then a capped −1 grid-lint deduction.',
  },
  {
    axis: 3,
    what: 'the `minGap` "comfortable / generous" tiers carry no point value',
    rubric: '"`rideSpacing.obb.minGap` | ≥ ~1.5 u comfortable, ≥ 3 generous."',
    reading: 'minGap >= 1.5 costs nothing; < 1.5 costs 2. "Generous" earns no bonus (the axis cannot exceed its weight).',
  },
  {
    axis: 4,
    what: '`exitNotAdjacent` −0.5: per occurrence or once?',
    rubric: '"`exitNotAdjacent` … is a validatePark WARNING, not a failure … Note it, −0.5, do not fail the axis for it."',
    reading: '−0.5 ONCE for the park, however many rides show it (the sentence is singular and the axis must not be failed by it).',
  },
  {
    axis: 5,
    what: 'the 0.5 "placed on traffic" test names no radius',
    rubric: '"placed on traffic (plaza/junction/midway), visible in shot 05 | `stalls[].at` against `layout.openSpace.spaces` + the net"',
    reading: 'A stall is ON TRAFFIC if its `at` lies within 4.0 u of a street node or inside/within 2.0 u of an open-space rect. Pro-rated over the roster.',
  },
  {
    axis: 7,
    what: 'no point breakdown for the 9 points',
    rubric: '"`probe.terrain`: `lint` empty, no spikes, no floating/buried structures." + the size-dependent stdH bands + the fixed-pitch maxSlope band',
    reading: '3 stdH band + 4 lint (1 for each of the four `terrain.lint` categories being empty) + 2 maxSlope band = 9. The "entrance apron" and "buildable core" paragraphs name no probe field and are not scoreable from probe.json; `terrain.lint.flatEnough` is the field that actually polices the pads and it is scored.',
  },
  {
    axis: 7,
    what: 'TWO stdH BANDS ARE PUBLISHED FOR SIZE >= 64 WITH NO POINT SPLIT — and three of the four current parks sit between them',
    rubric:
      '"on a 128 plot **`stdH` 0.75–1.5 is NORMAL** … Over the wider 24-seed × 4-climate sweep the same statistic runs 0.67–2.19 ' +
      '(p50 1.135), so a park just outside 0.75–1.5 is unusual, not wrong."',
    reading:
      'Inside 0.75–1.5 → the full 3; inside the wider 0.67–2.19 → 1.5 ("unusual, not wrong" is read as neither full nor zero); ' +
      'outside → 0. The POINT SPLIT is still this file\'s choice; the BAND is now settled. ' +
      'THE EARLIER RECOMMENDATION TO LOWER THE FLOOR TO 0.67 IS WITHDRAWN (2026-07-26) — it was grade inflation. Re-measured over ' +
      'a 24-seed × 4-climate × 3-size sweep of the real composer (n = 288): at 128 stdH runs 0.67–2.19 with p5 0.83 and p50 1.135, ' +
      'so 0.75 excludes just 3 of 96 compositions and is well calibrated. `skeleton-a`/`skeleton-b`/`r15a` all pin seed 1 temperate ' +
      '128, for which the composer draws stdH 1.09 / relief 12.13; they BUILT 0.74/0.72/0.75 (keptStdH 73–74%), i.e. they FLATTENED ' +
      'a mid-distribution seed with guard cells planted on its two biggest ranges. They genuinely lose 1.5 pts each and the parks ' +
      'are what should change. Two live defects fall out of the same sweep and are recorded in RUBRIC.md axis 7 rather than ' +
      'silently patched: the "size >= 64" grouping is WRONG AT 64 (31% of the composer\'s own 64 output is under 0.75, min 0.58) and ' +
      'is deliberately left unchanged pending its own review; and "> 2.19 has no precedent" was a 128-only figure (192 reaches ' +
      '2.31). Also: probe.mjs samples a 65x65 CORNER lattice while the band comes from measurePlotRelief\'s 48x48 CELL-CENTRE ' +
      'lattice, so the probe reads ~0.012 low (max 0.05) and no park should be resolved to better than +/-0.05 here.',
  },
  {
    axis: 8,
    what: '"Charge the shortfall only when the park has NOT paid for it with built-out land" has no numeric test',
    rubric: '"A park with a large keepDry mask legitimately reads well under its climate band … Charge the shortfall only when the park has NOT paid for it with built-out land."',
    reading: 'An UNDER-band `fractionOfPark` is charged only when `layout.plot.plotUtilisation` < 0.7 (axis 15\'s own "plot actually used" full-credit floor). An OVER-band value is always charged.',
  },
  {
    axis: 9,
    what: '"night dressing in shot 07" is a VISUAL input with no point value',
    rubric: '"`probe.scenery` + `composables` + night dressing in shot 07. ~1 piece per 25 u² of pathed area is lively. Bare plazas ≤ 2."',
    reading: 'Only the density criterion is numeric, so only it is scored. Night dressing is recorded as NOT MEASURABLE from probe.json; no points hinge on it, so nothing is silently awarded. "Pathed area" is `paths.totalLength · 1.2 u slab + openSpace.totalArea`.',
  },
  {
    axis: 10,
    what: 'the tree-count threshold is pinned at size 16 only',
    rubric: '"`probe.trees.count` (≥ 4 on size 16, mixed `byShape` better) spread across the map; `terrain.peaks ≥ 1`."',
    reading: 'Read as an AREAL density — 4 trees per 16² u² = 1 per 64 u² — so the target is `max(4, round(size²/64))`. A fixed 4 would be met by 4 trees on a 128 plot, which is not what "spread across the map" means.',
  },
  {
    axis: 12,
    what: '`orphanIslands` and `nodesReachableFromGate/nodesTotal` are the SAME defect charged twice',
    rubric: '"`orphanIslands` = 0 (each −2); `nodesReachableFromGate/nodesTotal` = 1.0."',
    reading: 'Both are charged, as written (−2 per island, plus 2·(1−reachRatio)). They are strongly correlated by construction, so a park with orphan islands is charged twice for one cause. FLAGGED as a probable rubric defect. Also "−1..2 per causeway/steep edge" is a RANGE: implemented as −1 per causeway edge and −2 per steep edge, capped at −4 combined.',
  },
  {
    axis: 13,
    what: 'THE CIRCUIT-ROSTER LADDER NAMES ONE FIELD AND THRESHOLDS ANOTHER QUANTITY',
    rubric:
      '"| 1 | **CIRCUIT ROSTER** … | `rideRoster.circuitsBesidesFlagship` (registered circuits − 1) with `rideRoster.circuitFamilyCount` … ' +
      '**≥ 4 circuits AND ≥ 3 families → 1**; 3 circuits and ≥ 2 families → 0.75; 2 circuits → 0.5; 1 → 0.25; 0 → 0. ' +
      'One coaster plus eight flat spinners measures `circuitCount: 1` and scores **0**."',
    reading:
      'The row NAMES `circuitsBesidesFlagship` but its thresholds say "circuits", and its worked example is stated in ' +
      'terms of `circuitCount`. The two readings differ by exactly one. Implemented on the NAMED field ' +
      '(`circuitsBesidesFlagship`), which is the only reading that reproduces the worked example (circuitCount 1 → ' +
      'besides 0 → 0). Under the other reading (circuitCount) every park gains up to 0.25 on this term. Axis 14\'s ' +
      'sibling row is unambiguous — it says `rideRoster.circuitCount ≥ 5` — so the two rows use different bases.',
  },
  {
    axis: 13,
    what: '"Full only if spacing (axis 3) holds" has no definition of "holds"',
    rubric: '"| 2 | **count** … Full only if spacing (axis 3) holds."',
    reading: 'Axis 3 at its full weight (8/8) = holds. Otherwise the 2-pt count term is capped at 1.75.',
  },
  {
    axis: 14,
    what: 'RESOLVED 2026-07-26 — the park type is now MEASURED, not defaulted to the generous branch',
    rubric: '"Scored relative to the park\'s type (thrill vs family), which is MEASURED, not declared and not defaulted" (was: "the park\'s DECLARED type … when ambiguous score as family")',
    reading:
      'THE DEFECT: probe.json carried no declared-type field and no §0 header in samples/ writes one, so EVERY park was "ambiguous" ' +
      'and every park took the FAMILY branch — whose targets are lower on three of the six sub-tests (E 5.0 vs 6.0, +G 1.8 vs 2.5, ' +
      'drop 1.2 vs 2.0). That is not a tie-break, it is a systematic discount, and it is always the branch that scores higher. ' +
      'THE FIX: `deriveParkType()` measures the type off the park\'s OWN ratings — (1) max(coasters[].intensity) over the rated ' +
      'coasters against probe.mjs\'s OWN >6 / <=3 intense/gentle band cuts; (2) failing that, thrill.intensityMix (intense >= gentle ' +
      '=> thrill; zero intense => family); (3) failing both, the STRICTER (thrill) branch, flagged `assumptionBased` on ' +
      '`parkTypeBasis` and pushed to `notes` as a LOWER BOUND. Option (b) — reading a declared type out of the §0 header — was ' +
      'checked and is NOT available: no sample park writes one. `--parkType` survives as a STRICT-ONLY override: ' +
      '`--parkType=thrill` over a measured family is accepted, `--parkType=family` over a measured thrill is REFUSED and the ' +
      'refusal is recorded. The branch is never chosen because it scores higher.',
  },
  {
    axis: 14,
    what: '"one coaster plus flat rides only caps at 6.5/8" does not define "flat rides only"',
    rubric: '"With `ratedCount: 1` the 0.75 second-coaster point is unreachable, so the axis caps at **7.25/8**; one coaster plus flat rides only caps at **6.5/8**."',
    reading: '`ratedCount <= 1 && rideRoster.circuitCount <= 1` = "one coaster plus flat rides only" → cap 6.5. `ratedCount <= 1` alone → cap 7.25.',
  },
  {
    axis: 13,
    what: 'RESOLVED 2026-07-26 — axis 13 no longer DOCKS the duplicate kind that axis 14 MANDATES',
    rubric:
      'axis 13: "| 1.5 | **distinct KINDS** — no duplicate-kind padding, **less the coaster duplicates axis 14 MANDATES**" · ' +
      'axis 14: "**A ONE-COASTER PARK CANNOT TAKE FULL MARKS.** With `ratedCount: 1` the 0.75 second-coaster point is unreachable"',
    reading:
      'THE DEFECT: both coasters register as kind `Coaster`, so a park that obeyed axis 14\'s mandatory second coaster manufactured ' +
      'exactly the duplicate axis 13 called "padding". MEASURED on r15a and skeleton-a: distinctKinds 8 vs registeredCount 9, sole ' +
      'duplicate = the mandated second coaster, so the term scored 1.0 instead of 1.5 — a 0.5 pt fine for following the rules. ' +
      'THE FIX: duplicates are counted PER KIND off rides[] and the MANDATED coaster duplicates are discounted, so a park is ' +
      'neither rewarded nor punished for the mandate. THREE BOUNDS keep it from becoming a padding loophole: capped at 2 (a FOURTH ' +
      'coaster is docked); bounded by `thrill.ratedCount - 1`, so unrated/fatal coaster copies buy nothing and an ABSENT ratedCount ' +
      'buys nothing; and coaster-family kinds only, so a duplicate Carousel is still docked in full. Three selftest mutations prove ' +
      'each bound bites. NET EFFECT: +0.5 on skeleton-a and r15a, 0 elsewhere.',
  },
  {
    axis: 12,
    what: 'THE RAMPING INSTRUMENT CAN READ CLEAN BECAUSE NOTHING IS LOOKING',
    rubric: '"**Ramping** — `probe.rampObservations`: `causewayEdges` … and `steepEdges` … should be empty; cross-check `consoleSummary.rampSignals`."',
    reading:
      'MEASURED on r15a: all three of those fields EMPTY while its console.log carried 13 `ramp lint: elevated node NN … deck ' +
      'unreachable` lines (PathNetwork/build.ts:317). probe.mjs\'s `rampSignals` regex matched causeway/berm/scaffold/nodeY-ramp/float ' +
      'only and never the design system\'s actual ramp lint — FIXED in probe.mjs on 2026-07-26. This scorer additionally treats ' +
      '"all three empty AND the console.log has ramp lints" as UNMEASURED, so a stale probe.json cannot pass the axis on the silence ' +
      'of an unwired instrument. ' +
      'VERIFIED 2026-07-26 by re-probing samples/r15a.tsx: the re-probed probe.json carries rampSignals = 13 lines, the axis is no ' +
      'longer UNMEASURED, and it scores 9/10 — the −1 "the lint fired even though the geometric test did not" branch, because the 13 ' +
      'lints are `deck unreachable` findings while causewayEdges/steepEdges are legitimately empty (maxLift 0.49 < 0.8, maxGrade ' +
      '0.03 < 0.6). r15a therefore went from HAVING NO /100 SCORE to a complete score with a real deduction.',
  },
  {
    axis: 13,
    what: 'RESOLVED 2026-07-26 — the hard-coded "never used" list is DELETED from RUBRIC.md and replaced by a pointer to the derivation',
    rubric:
      'axis 13 now reads: "**THE NEVER-USED SHELF IS DERIVED, NEVER LISTED HERE — see \'NO FROZEN USAGE LISTS\' below.**" ' +
      '(was: "Measured 2026-07-26: **14 of the 27 CIRCUITS in the catalog have never shipped** (`Bassline`, `LavaTubeRun`, ' +
      '`MineTrainCoaster`, `SplineCoaster`, `WyrmsHollow`, `GearworksExpress`, `HauntedMansion`, `Helicycles`, `MotionSimulator`, ' +
      '`DeepDrift`, `MagmaRun`, `OceanTunnelSlide`, `MagneticRide`, `GoKarts`)")',
    reading:
      'That list named `Helicycles`, `HauntedMansion`, `MagneticRide` and `MotionSimulator`, all four of which `skeleton-a` ships — ' +
      'stale within hours of being written. It is DELETED rather than corrected, because correcting it just restarts the clock. ' +
      'NOTHING in this scorer ever read it: `firstUseKinds`/`firstUseCircuits` are recomputed at SCORING time from `signatures/` via ' +
      'corpus.mjs (the same `loadCorpus`+`kindFrequency` pair `usage.mjs` reads), the park\'s own signature is excluded, and the ' +
      'corpus size is stamped on the result. The stored probe.json value is reported when it differs, never used. ' +
      'RUBRIC.md was swept for every other frozen usage/frequency claim and each is now either deleted or stamped as a DATED ' +
      'SNAPSHOT with a re-derive pointer: axis 5\'s stall never-used pair (`EmberRoast`/`SushiStall` — both have since shipped), ' +
      'axis 13\'s "20 of 20 probed parks", axis 14\'s coaster-count and 15/15 pass-rate paragraphs, and axis 16\'s preset build ' +
      'counts (published as brasswork 7 / pulse 7 / thornwick 5 / emberfall 3 / tidewater 2; re-derived 2026-07-26 over 28 ' +
      'signatures / 14 world-parks as 10 / 10 / 9 / 5 / 2).',
  },
  {
    axis: 8,
    what: '"believe the gate" over the body count has no bound, and taken literally forgives real pond scatter',
    rubric: '"**THE GATE IS AUTHORITATIVE ON THE COUNT, NOT THE PROBE** … If `bodyCount` and a clean `validatePark → ok: true` disagree, believe the gate and note the quantisation."',
    reading:
      'The rubric\'s own evidence is a SINGLE-CELL speck (`worlds-ref`, areas [261.3, 112.0, 1.78]), i.e. the rule is about ' +
      'QUANTISATION. Taken literally it also forgives a park with five real lakes and a passing gate. Implemented narrowly: the ' +
      'override fires only when discarding bodies under 3 · minBodyArea RECOVERS the gate\'s count; otherwise the disagreement is ' +
      'reported as a gate/probe CONFLICT and the count is charged. This was caught by the scorer\'s own falsification suite.',
  },
  {
    axis: 14,
    what: 'RESOLVED 2026-07-26 — a FAILED coaster gate now forfeits the RATING too, not just the 1-pt force row',
    rubric: '"| 1 | **force envelope** … **Score 0** if `thrill.coasterGateOk` is false … — and see \'AN ILLEGAL COASTER BANKS NO THRILL\' below: that condition now forfeits four MORE rows, not just this one."',
    reading:
      'THE DEFECT: `coasterGateOk: false` / `fatalCoasters > 0` zeroed the 1-pt force row ONLY, so a coaster the game refuses to open ' +
      'still collected the 3-pt flagship-excitement rating, the 1-pt drop and the 0.5-pt airtime — 4.5 points of thrill off geometry ' +
      'validatePark rejects. HANDOFF.md §3: "thrill must never come from illegality." ' +
      'WHAT THE CHECK COVERS (read, not assumed): coasterGateOk is `consoleSummary.coasterFails.length === 0`, i.e. validate.ts\'s ' +
      '`check: "coaster"` block — a FATAL compiled track; a non-warning checkCoasterDesign violation (slope/pitchRate/inversion/ ' +
      'bankLimit/bankRate/noStation); the track leaving plot bounds; validateSpline self-clearance under 0.9 u; and the derail guard ' +
      '`replayCoasterForces().worstLatAccel > 1.275 g`. rateCoaster() runs THE SAME replayCoasterForces pass and the replay has no ' +
      'early exit, so the ratings of an illegal coaster are internally consistent but describe a lap that ends in crashTrain — ' +
      'UNEARNED, not corrupt. ' +
      'THE FIX: ONLY THE COASTER-DERIVED ROWS forfeit — flagship excitement (3), second rated coaster (0.75), force (1), highest ' +
      'drop (1), airtime (0.5) — and the axis is CAPPED at 1.75/8. The whole axis is deliberately NOT zeroed: circuit span (0.5) and ' +
      'never-used shelf (0.25) are roster-composition facts, and the park thrill MIX (1) bands every registered ride\'s AUTHORED ' +
      '`intensity` prop (flat rides included) and touches no coaster physics — zeroing those would charge the illegality to ' +
      'measurements it never touched. ' +
      'PUBLISHED CAVEAT: coasterGateOk is PARK-WIDE and not attributable to one coaster — registerCoaster is also called for a FATAL ' +
      '<TrackRide> of any profile, so a broken log flume forfeits the block. That is still a defect a 100/100 park must not ship, so ' +
      'the forfeiture stands and the reason string names the cause.',
  },
  {
    axis: 0,
    what: 'the cross-axis validatePark FAIL charge is "2–5 pts" — a RANGE — with no per-kind mapping',
    rubric: '"Score each axis 0..weight (halves fine); charge each `validatePark FAIL` 2–5 pts against its matching axis ONCE (don\'t double-charge …)"',
    reading:
      'A fixed 3 pts (the midpoint) per failure, against the axis in `GATE_FAIL_AXIS`, floored at 0 per axis. Kinds whose ' +
      'evidence an axis ALREADY reads numerically are in `GATE_FAIL_NO_DOUBLE_CHARGE` and are not charged again ' +
      '(footprints/corridor → axis 3 reads `footprintFails`/`corridorFails`; crossTheme/worldNotBuiltOut → axis 16 reads ' +
      '`crossThemeCount`/`built`). This is the single largest discretionary choice in the file.',
  },
];

// ---------------------------------------------------------------------------
// validatePark FAIL -> axis. Parsed off `consoleSummary.validatorFails`, whose
// lines carry `validatePark FAIL [<check>]`. NOTE: `probe.validation.failures[]`
// entries have `kind: undefined` on every stored probe.json inspected
// (2026-07-26) — the structured array carries only `detail` — so the console
// summary is the authoritative source for the CHECK NAME.
// ---------------------------------------------------------------------------
export const GATE_FAIL_AXIS = {
  paths: 2,
  grid: 2,
  deadStreetNode: 2,
  spacing: 3,
  footprints: 3,
  blockers: 12,
  corridor: 3,
  coaster: 14,
  accessibility: 4,
  queue: 4,
  entrance: 6,
  gate: 6,
  terrain: 7,
  water: 8,
  scenery: 9,
  planting: 10,
  roster: 13,
  worlds: 16,
  // NOTE: `autofix` is DELIBERATELY ABSENT. It is a generic bucket check whose
  // real subject lives in a `[subTag]` at the head of the detail, so mapping the
  // bucket to one axis would be a guess. Unrecognised `autofix` failures are
  // reported as an UNMAPPED attribution (i.e. unmeasured), not forgiven and not
  // charged to an axis picked by this file.
};
// ---------------------------------------------------------------------------
// THE `[subTag]` MAP — WHY `autofix` NEEDS ONE, AND WHY IT IS ENUMERATED FROM
// THE VALIDATOR SOURCE RATHER THAN FROM WHAT ONE PARK HAPPENED TO PRODUCE
// ---------------------------------------------------------------------------
// `validate.ts:402/407` is the whole story:
//
//     warnings.filter((w) => w.fatal).forEach((w) => fail('autofix', `[${w.kind}] ${w.detail}`));
//     const warn = (kind, detail, fatal = false) => { …; if (fatal) fail('autofix', `[${kind}] ${detail}`); };
//
// `'autofix'` is a BUCKET. It is the single most common `check` value on a
// failing park — 12 of `r16a`'s 23 failures — and its real subject is the
// bracketed kind at the head of the detail. This map was previously TWELVE
// entries long and covered 3 of the 6 subkinds r16a produced, so the other
// three collapsed into the unmapped `autofix` bucket, `r16a` was declared
// UNSCOREABLE, and (worse) so would EVERY park whose defects arrive through the
// plan-lint path — which is the path SETUP.md §0-P.5 tells authors is normal:
// "those DEGRADE and record a plan lint by design".
//
// THE POLICY DOES NOT CHANGE: an unrecognised kind is still refused, never
// forgiven. What changes is that the recognised set is now the FULL set, taken
// from the source rather than from one park's output. Enumerated 2026-07-26 by
// walking every `reportPlanLint(` / `reportLint(` / `note(` / `lint(` call site
// in `mp3d/**` plus every `warn(` in `ParkBuilder/validate.ts` (48 call sites,
// 45 distinct kinds). Kinds are listed here whether or not they are CURRENTLY
// fatal, because `FATAL_LINT_KINDS` (validate.ts:117) can promote a non-fatal
// lint into an `'autofix'` failure without touching this file.
export const GATE_FAIL_SUBTAG_AXIS = {
  // ---- axis 2 · the STREET NETWORK (buildParkNet / <Paths> / Boulevard) ----
  edgeDiagonal: 2, // SetPieceKit:923 — RCT2 paths run N/S/E/W; L-routed
  boulevardDiagonal: 2, // Boulevard:143 — same rule for an avenue
  boulevardTooShort: 2, // Boulevard:162
  netWarnings: 2, // SetPieceKit:1130 — every buildParkNet warning, fatal by §3.1
  unknownPort: 2, // SetPieceKit:688/844 — a piece ref resolved to a fallback port
  badEdgeEndpoint: 2, // SetPieceKit:856
  noNodeOnCell: 2, // SetPieceKit:1175 — a cell ref resolved to the nearest node
  deadStreetNode: 2, // validate.ts:790
  pathClipping: 2, // wrappersLand:733
  latticeInWater: 2, // wrappersLand:565 — a street slab over open water
  // ---- axis 3 · RIDE SPACING (pads, and the track-corridor sweep) ----------
  padOnStreet: 3, // configurableRide:558/568/578/599
  padNearStreet: 3, // configurableRide:485
  corridorPinned: 3, // configurableRide:688  — the six corridor auto-fixes.
  corridorExitRelocated: 3, // configurableRide:725   `corridor` is axis 3 in
  corridorLaneTrim: 3, // configurableRide:821   GATE_FAIL_AXIS, and unlike the
  corridorShift: 3, // configurableRide:831   `[corridor]` CHECK these are
  corridorExitStuck: 3, // configurableRide:851   build-time rescues that axis
  corridorUnresolved: 3, // configurableRide:858   3's numeric test never reads,
  //                                              so they are NOT double-charged.
  // ---- axis 4 · ENTRANCE / EXIT / QUEUE ------------------------------------
  queueDirFlip: 4, // configurableRide:293
  queueDirUnfixable: 4, // configurableRide:303
  queueAnchorIsHead: 4, // configurableRide:1085
  queueTailShared: 4, // parkRoot:255
  laneTrim: 4, // configurableRide:1255
  exitHutRelocated: 4, // configurableRide:334
  exitHutUnfixable: 4, // configurableRide:347
  exitFaceBlocked: 4, // configurableRide:1199
  exitLaneUnreachable: 4, // configurableRide:1214
  exitNotAdjacent: 4, // pieces:496 / wrappers:216 / validate.ts:621
  // ---- axis 5 · FOOD STALLS ------------------------------------------------
  bazaarStallCount: 5, // Bazaar:186 — a stall row padded to the 3-stall minimum
  // ---- axis 7 · TERRAIN ----------------------------------------------------
  terrainFlattened: 7, // validate.ts:1129 — the built horizon reads as a field
  // ---- axis 8 · WATER ------------------------------------------------------
  waterRePicked: 8, // validate.ts:1003
  waterShrunk: 8, // validate.ts:1018
  waterGrew: 8, // validate.ts:1034
  // ---- axis 10 · PLANTING --------------------------------------------------
  plantedInWater: 10, // wrappers:397
  plantedWetCell: 10, // wrappers:388
  // ---- axis 12 · ACCESSIBILITY + RAMPING -----------------------------------
  edgeThroughSolid: 12, // SetPieceKit:966/974 — a street across a piece's CENTRE.
  //                       This is precisely what validatePark's `blockers` check
  //                       reports, and `blockers` is axis 12 in GATE_FAIL_AXIS;
  //                       the lint fires on the edges buildParkNet RETIED, the
  //                       check on the ones it could not, so they are DIFFERENT
  //                       edges and charging both is not a double-charge.
  causeway: 12, // wrappersLand:517/606 — a hoisted slab, the ramping sub-test
  causewayRefused: 12, // wrappersLand:584
  // ---- axis 14 · THRILL ----------------------------------------------------
  // `coaster:<violationKind>` (pieces.tsx:286/331) is a FAMILY, not one key —
  // its tail is whatever `checkCoasterDesign` names, and `coaster:shortDrop` is
  // in validate.ts's FATAL_LINT_KINDS. Matched by prefix, see subtagAxisOf().
  // ---- axis 16 · WORLDS ----------------------------------------------------
  worldIdReused: 16, // parkContext:797
  worldUnthemed: 16, // SetPieceKit:1359 / validate.ts:1279
  worldEmpty: 16, // SetPieceKit:1353
  worldNoPorts: 16, // SetPieceKit:1488
  worldVariety: 16, // validate.ts:1307
  themedPieceOutsideWorlds: 16, // validate.ts:1314
  // -------------------------------------------------------------------------
  // DELIBERATELY UNMAPPED — the axis is genuinely ambiguous, and unscoreable is
  // better than misattributed (both are currently NON-fatal, so neither can
  // reach `'autofix'` unless validate.ts promotes it, at which point whoever
  // promotes it picks the axis):
  //   `plazaTilesClamped`  (FountainPlaza:127/135) — a plaza clamped to the
  //       7..13-tile range. Its subject is half axis 2 (the plaza IS walkable
  //       path area) and half axis 9 (plazas are the scenery armature).
  //   `pathLevelMedian`    (wrappersLand:465) — reports that the street surface
  //       now FOLLOWS THE LAND instead of standing flat. Subject is the street
  //       (axis 2) and the grade (axis 12), and the lint fires on the GOOD
  //       outcome, so even its sign is unclear.
  // Also note `exitNotConnected` was in this map and exists NOWHERE in mp3d/ —
  // RCT2's STR_EXIT_NOT_CONNECTED reaches the gate as an `accessibility` FAIL,
  // not as a subtag. It is kept below only so an older probe.json cannot
  // regress, and it is marked as unverified.
  exitNotConnected: 4, // NOT FOUND in mp3d/ (2026-07-26) — legacy entry

  // ---- the three `sim` call sites (validate.ts:1764/1765/1767) -------------
  // Synthesised from the detail text by detailSubtagOf(); see
  // GATE_FAIL_DETAIL_SUBTAG for why `sim` gets no single axis of its own.
  'sim:noRideCycle': 4, // axis 4 already reads sim.riding/queued/activeGuests — NO_DOUBLE_CHARGE
  'sim:queueStalled': 4, // ditto: a held queue IS sim.queued standing against sim.riding
  'sim:guestStuck': 12, // axis 12's numeric reads (orphanIslands, nodesReachableFromGate)
  //                       CANNOT see this: a guest can stand still on a fully
  //                       connected graph, so this one is genuinely additional
  //                       information and it IS charged.
};
/** `coaster:*` → axis 14. `checkCoasterDesign`'s violation kinds are an open
 *  set (`coaster:${v.kind}`), so the family is matched by PREFIX rather than
 *  enumerated — a new stat-gate violation lands on thrill without an edit. */
export const GATE_FAIL_SUBTAG_PREFIX_AXIS = [[/^coaster:/, 14]];

// ---------------------------------------------------------------------------
// `sim` HAS NO `[subTag]` — IT IS ATTRIBUTED FROM THE DETAIL TEXT (2026-07-27)
// ---------------------------------------------------------------------------
// Wave 18A came back 75.89 ***INCOMPLETE*** on a single unmapped `sim` failure.
// `sim` cannot take one axis the way `terrain` or `water` can, because
// `ParkBuilder/validate.ts` emits it from THREE call sites that mean different
// things and land on different axes:
//
//   :1764  riddenTotal < 1        "no guest completed a ride cycle in <n> sim-s"
//   :1765  stuck guest            "guest <id> stood still >25 sim-s while \"walking\""
//   :1767  rec.stalled            "<name>: its queue held for >… without ever advancing"
//
// So the detail is parsed into a SYNTHETIC subtag and the existing subtag
// machinery does the rest. Enumerated from those three call sites, not from what
// one park happened to produce — and a `sim` line matching NONE of them stays
// UNMAPPED (reported, never forgiven), which is the same policy as `autofix`.
export const GATE_FAIL_DETAIL_SUBTAG = [
  ['sim', /no guest completed a ride cycle/i, 'sim:noRideCycle'],
  ['sim', /stood still .* while ["“]?walking/i, 'sim:guestStuck'],
  ['sim', /queue held for .* without ever advancing/i, 'sim:queueStalled'],
];

/** synthesise a subtag for a bracket-less check from its detail text */
export function detailSubtagOf(check, text) {
  if (!check) return null;
  for (const [c, re, sub] of GATE_FAIL_DETAIL_SUBTAG) if (c === check && re.test(String(text))) return sub;
  return null;
}

/** the axis a `[subTag]` belongs to, or `undefined` — exact key first, then the
 *  open-set prefixes. `undefined` means UNMAPPED, which means REFUSED. */
export function subtagAxisOf(sub) {
  if (sub === undefined || sub === null) return undefined;
  if (GATE_FAIL_SUBTAG_AXIS[sub] !== undefined) return GATE_FAIL_SUBTAG_AXIS[sub];
  for (const [re, ax] of GATE_FAIL_SUBTAG_PREFIX_AXIS) if (re.test(sub)) return ax;
  return undefined;
}
// charged by an axis's own numeric test already; charging again is the
// double-charge the rubric explicitly forbids
export const GATE_FAIL_NO_DOUBLE_CHARGE = new Set([
  'footprints', 'corridor', 'crossTheme', 'worldNotBuiltOut', 'rosterOverstated',
  // axis 4 reads `sim.riding` / `sim.queued` / `sim.activeGuests` numerically, so
  // these two are the SAME evidence arriving twice. `sim:guestStuck` is NOT here:
  // no axis reads it numerically. (Same double-charge shape as the 40-pt render
  // cap firing on by-design `[plan] FATAL` lines, which cost r16a 16.55 wrongly.)
  'sim:noRideCycle', 'sim:queueStalled',
]);
export const GATE_FAIL_CHARGE = 3;

// ---------------------------------------------------------------------------
// A RENDER FAILURE IS NOT "ANY console.error" (2026-07-26)
// ---------------------------------------------------------------------------
// The three predicates, kept IDENTICAL to probe.mjs's capture-time split so a
// stored probe.json written before that split is classified the same way a fresh
// one is. See the long note at the 40-cap for the measurement that forced this.
//
//   PAGE   `[pageerror] …`            evaltags.mjs:483, page.on('pageerror')
//          `[error] JSHandle@error`   react-dom 18.3.1 production's
//                                     logCapturedError does a BARE
//                                     `console.error(error)` for an uncaught
//                                     render with no boundary, and the page
//                                     shell mounts `createRoot().render()` with
//                                     no boundary. Verified in the shipped
//                                     bundle: `function Li(a,b){try{console.error(b.value)}…}`.
//          `[error] Uncaught…`        a page that logged its own uncaught error
//   COMP   `[error] [Prefix] …`       `[plan]`, `[Coaster]`,
//                                     `[TrackRide:coaster]`, `[<ParkName>]` — the
//                                     design system reporting a survived defect
//   ELSE   unclassified               reported, never bucketed by guess
export const isPageErrorLine = (l) =>
  /^\[pageerror\]/.test(l) || /^\[error\]\s*JSHandle@error\s*$/.test(l) || /^\[error\]\s*(Uncaught|Unhandled)\b/.test(l);
export const componentErrorPrefixOf = (l) => (/^\[error\]\s*\[([^\]]+)\]/.exec(String(l)) || [])[1] ?? null;

/** split a consoleSummary's error lines into the three classes. Prefers the
 *  fields probe.mjs now publishes; falls back to re-deriving them from the
 *  legacy union `errors` with the same predicates. */
export function classifyErrorLines(consoleSummary) {
  const cs = consoleSummary || {};
  if (Array.isArray(cs.pageErrors)) {
    const byPrefix = (cs.errorCounts && cs.errorCounts.byComponentPrefix) || {};
    return {
      source: 'probe.mjs consoleSummary.pageErrors/.componentErrors/.unclassifiedErrors',
      pageErrors: cs.pageErrors,
      componentErrors: cs.componentErrors || [],
      unclassified: cs.unclassifiedErrors || [],
      byComponentPrefix: byPrefix,
    };
  }
  const all = Array.isArray(cs.errors) ? cs.errors : [];
  const pageErrors = all.filter(isPageErrorLine);
  const componentErrors = all.filter((l) => !isPageErrorLine(l) && componentErrorPrefixOf(l));
  const unclassified = all.filter((l) => !isPageErrorLine(l) && !componentErrorPrefixOf(l));
  const byComponentPrefix = {};
  for (const l of componentErrors) {
    const p = componentErrorPrefixOf(l);
    byComponentPrefix[p] = (byComponentPrefix[p] || 0) + 1;
  }
  return { source: 're-derived from the legacy consoleSummary.errors union', pageErrors, componentErrors, unclassified, byComponentPrefix };
}

// climate p5–p95 bands for `water.terrainWater.fractionOfPark` (RUBRIC.md axis 8)
const CLIMATE_WATER_BAND = {
  temperate: [0.039, 0.218],
  desert: [0.024, 0.076],
  alpine: [0.023, 0.104],
  coastal: [0.073, 0.243],
};
const PATH_SLAB_WIDTH = 1.2; // u — the walked slab, for axis 9's "pathed area"

// ===========================================================================
// AXIS 14'S PARK TYPE IS MEASURED, NOT DEFAULTED (fixed 2026-07-26)
// ===========================================================================
// RUBRIC.md axis 14 scores "relative to the park's DECLARED type (thrill vs
// family; when ambiguous score as family)", and probe.json carries NO declared
// type — no §0 header in `samples/` writes one either (checked across the
// corpus 2026-07-26: the headers publish SEED / SHAPE / CATS / CIRCUITS and
// never a park type). So EVERY park was "ambiguous" and every park took the
// FAMILY branch, whose targets are lower on three of the six sub-tests
// (E 5.0 vs 6.0, +G 1.8 vs 2.5, drop 1.2 vs 2.0). That is not a tie-break, it
// is a systematic discount, and it is the branch that always scores higher.
//
// THE TYPE IS NOW DERIVED FROM THE PARK'S OWN MEASURED RATINGS — a
// MEASUREMENT, not a default, and computed with no reference to what it would
// score. The signals, in order of authority:
//
//   1. THE FLAGSHIP'S OWN RCT2 INTENSITY (`coasters[].intensity`, max over the
//      rated coasters — the same number `ratedCoasters[].intensityBand` bands).
//      Cut points are NOT invented here: they are the SAME >6 / <=3 cuts
//      probe.mjs already uses to band `thrill.intensityMix` into
//      intense / moderate / gentle (probe.mjs, `mgrRides` banding), which are
//      RCT2's own rating bands. Intensity > 6 = a thrill park's coaster;
//      intensity <= 3 = a family park's coaster; in between decides nothing.
//   2. THE REGISTERED ROSTER'S INTENSITY MIX (`thrill.intensityMix`, banded off
//      every registered ride's authored `intensity`). intense >= gentle = a
//      thrill roster; zero intense rides with at least one gentle = a family
//      roster; anything else decides nothing.
//   3. NEITHER DECIDES -> the STRICTER branch (thrill), flagged
//      `assumptionBased: true` on `parkTypeBasis` in score.json and named in
//      axis 14's reason. The rubric's own "score as family" tie-break is
//      DELIBERATELY NOT followed: it hands the generous branch to every park
//      whose evidence is thin, which is the defect being fixed.
//
// You cannot claim to be "just a family park" while shipping an intensity-9.55
// hypercoaster, and a park cannot lower its own bar by declining to declare.
export const PARK_TYPE_INTENSE_CUT = 6; // probe.mjs's own "intense" band floor
export const PARK_TYPE_GENTLE_CUT = 3; // probe.mjs's own "gentle" band ceiling

export function deriveParkType(probe) {
  const t = (probe && probe.thrill) || {};
  const coasters = (probe && probe.coasters) || [];
  const evidence = [];
  // ---- signal 1: the flagship coaster's measured intensity -----------------
  const rated = coasters.filter((c) => typeof c.intensity === 'number' && typeof c.excitement === 'number');
  const flagI = rated.length ? Math.max(...rated.map((c) => c.intensity)) : null;
  if (flagI === null) evidence.push('flagship intensity: no rated coaster with a measured `intensity` in probe.coasters[]');
  else if (flagI > PARK_TYPE_INTENSE_CUT) {
    evidence.push(`flagship intensity ${round(flagI)} > ${PARK_TYPE_INTENSE_CUT} (probe.mjs's own "intense" band) -> THRILL`);
    return { type: 'thrill', source: 'measured: flagship coaster intensity', evidence, assumptionBased: false };
  } else if (flagI <= PARK_TYPE_GENTLE_CUT) {
    evidence.push(`flagship intensity ${round(flagI)} <= ${PARK_TYPE_GENTLE_CUT} (probe.mjs's own "gentle" band) -> FAMILY`);
    return { type: 'family', source: 'measured: flagship coaster intensity', evidence, assumptionBased: false };
  } else evidence.push(`flagship intensity ${round(flagI)} sits in the MODERATE band (${PARK_TYPE_GENTLE_CUT}–${PARK_TYPE_INTENSE_CUT}) — decides nothing`);
  // ---- signal 2: the registered roster's own intensity mix -----------------
  const mix = t.intensityMix;
  if (!mix) evidence.push('thrill.intensityMix is absent — the roster mix decides nothing');
  else {
    const g = mix.gentle || 0, i = mix.intense || 0;
    if (i > 0 && i >= g) {
      evidence.push(`roster mix intense ${i} >= gentle ${g} -> THRILL`);
      return { type: 'thrill', source: 'measured: registered-roster intensity mix', evidence, assumptionBased: false };
    }
    if (i === 0 && g > 0) {
      evidence.push(`roster mix has ZERO intense rides against ${g} gentle -> FAMILY`);
      return { type: 'family', source: 'measured: registered-roster intensity mix', evidence, assumptionBased: false };
    }
    evidence.push(`roster mix intense ${i} vs gentle ${g} — neither dominant, decides nothing`);
  }
  // ---- neither decided: the STRICTER branch, loudly ------------------------
  evidence.push('NO measured signal decided the type, so the STRICTER (thrill) branch is assumed — RUBRIC.md\'s "score as family" tie-break is not followed because it is the branch that always scores higher');
  return { type: 'thrill', source: 'ASSUMED (stricter branch) — no measured signal decided', evidence, assumptionBased: true };
}

// ===========================================================================
// the input reader — every axis's reads are RECORDED, and a missing required
// field makes the axis unmeasured instead of making the score up
// ===========================================================================
class Reader {
  constructor(probe) {
    this.p = probe;
    this.inputs = {};
    this.missing = [];
  }
  /** raw resolve of a dotted path; arrays support `.length` */
  resolve(p) {
    let cur = this.p;
    for (const key of p.split('.')) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[key];
    }
    return cur;
  }
  /** REQUIRED: absent or null => the axis is unmeasured */
  need(p) {
    const v = this.resolve(p);
    this.inputs[p] = summarise(v);
    if (v === undefined || v === null) this.missing.push(p);
    return v;
  }
  /** OPTIONAL: recorded, may be null; the axis must handle that itself */
  opt(p, fallback = null) {
    const v = this.resolve(p);
    this.inputs[p] = v === undefined ? '(absent)' : summarise(v);
    return v === undefined || v === null ? fallback : v;
  }
  /** an advisory read that is deliberately NOT scored */
  note(p, why) {
    const v = this.resolve(p);
    this.inputs[p] = `${v === undefined ? '(absent)' : summarise(v)}  [advisory: ${why}]`;
    return v;
  }
}
function summarise(v) {
  if (v === undefined) return '(absent)';
  if (v === null) return null;
  if (Array.isArray(v)) return v.length <= 6 && v.every((x) => typeof x !== 'object') ? v : `Array(${v.length})`;
  if (typeof v === 'object') return `{${Object.keys(v).slice(0, 8).join(',')}}`;
  return v;
}

// ===========================================================================
// THE 16 AXES
// ===========================================================================
const AXES = [
  // -----------------------------------------------------------------------
  {
    n: 1,
    key: 'cleanliness',
    score(io) {
      const litter = io.need('sim.litterCount');
      const poop = io.need('sim.poopCount');
      const vomit = io.need('sim.vomitCount');
      const bins = io.need('paths.bins');
      const restrooms = io.need('restrooms.length');
      io.note('sim.avgHappiness', 'RUBRIC.md names it as evidence but assigns it no point value');
      if (io.missing.length) return null;
      const mess = litter + poop + vomit;
      let s = this.weight;
      const why = [];
      if (bins < 1) { s -= 1.5; why.push('no bins (−1.5)'); }
      if (restrooms < 1) { s -= 1.5; why.push('no restroom (−1.5)'); }
      if (mess > 0) {
        const d = Math.ceil(mess / 3);
        s -= d;
        why.push(`${mess} litter/poop/vomit (−${d} at −1 per 3)`);
      }
      return { score: clamp(s, 0, this.weight), reason: why.length ? why.join('; ') : `zero litter, ${bins} bin(s), ${restrooms} restroom(s) — full marks` };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 2,
    key: 'paths',
    score(io) {
      const nodes = io.need('paths.nodes');
      const edges = io.need('paths.edges');
      const plazas = io.need('paths.plazas');
      const extent = io.need('paths.extentFractionOfPark');
      const orphans = io.need('accessibility.orphanIslands');
      const comps = io.need('accessibility.pathComponents');
      const d1 = io.need('layout.lattice.degreeShare.d1');
      const lintKinds = io.need('consoleSummary.lintKinds');
      if (io.missing.length) return null;
      const why = [];
      // 2.0 connectivity: a spanning structure at minimum
      const pConn = edges >= nodes - 1 ? 2 : 0;
      why.push(`connectivity ${pConn}/2 (edges ${edges} vs nodes−1 ${nodes - 1})`);
      // 1.5 cycles: a loop/ring skeleton, not a tree. cyclomatic = E − N + C
      const cycles = edges - nodes + comps;
      const pCyc = cycles >= 1 ? 1.5 : 0;
      why.push(`cycles ${pCyc}/1.5 (${cycles} independent cycle(s))`);
      // 1.5 orphan islands
      const pOrph = clamp(1.5 - 0.75 * orphans, 0, 1.5);
      why.push(`orphan islands ${pOrph}/1.5 (${orphans})`);
      // 1.0 plazas
      const pPlaza = plazas >= 1 ? 1 : 0;
      why.push(`plazas ${pPlaza}/1 (${plazas})`);
      // 1.0 extent FLOOR ONLY (axis 2 fixed 2026-07-26 to match axis 15)
      const pExt = extent >= 0.2 ? 1 : extent >= 0.15 ? 0.5 : 0;
      why.push(`extent floor ${pExt}/1 (extentFractionOfPark ${extent}; >= 0.2 healthy, < 0.15 huddled, NO upper penalty)`);
      // 1.0 dead stubs — degree-1 share of the AUTHORED street net
      const pStub = d1 <= 0.15 ? 1 : d1 <= 0.3 ? 0.5 : 0;
      why.push(`dead stubs ${pStub}/1 (degree-1 share ${d1})`);
      let s = pConn + pCyc + pOrph + pPlaza + pExt + pStub;
      // grid-lint deduction, capped at 1
      const gridLints = Object.entries(lintKinds).filter(([k]) => /grid|lattice|deadStreetNode|pathClip/i.test(k));
      const ded = Math.min(1, 0.5 * gridLints.reduce((a, [, v]) => a + v, 0));
      if (ded > 0) { s -= ded; why.push(`grid-lint −${round(ded)} (${gridLints.map(([k, v]) => `${k}×${v}`).join(', ')})`); }
      return { score: clamp(s, 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 3,
    key: 'rideSpacing',
    score(io) {
      const overlapping = io.need('rideSpacing.obb.overlappingPairs');
      const minGap = io.need('rideSpacing.obb.minGap');
      const fpFails = io.need('consoleSummary.footprintFails');
      const corFails = io.need('consoleSummary.corridorFails');
      io.note('rideSpacing.touchingPairs', 'AABB, advisory only — containment is NOT overlap (RUBRIC.md axis 3)');
      io.note('rideSpacing.aabbContainedPairs', 'never charged');
      if (io.missing.length) return null;
      let s = this.weight;
      const why = [];
      if (overlapping.length) { s -= 3 * overlapping.length; why.push(`${overlapping.length} OBB overlapping pair(s) −${3 * overlapping.length}`); }
      if (minGap < 1.5) { s -= 2; why.push(`obb.minGap ${minGap} < 1.5 u −2`); }
      else why.push(`obb.minGap ${minGap} (>= 1.5 comfortable)`);
      if (fpFails.length) { s -= fpFails.length; why.push(`${fpFails.length} footprintFail −${fpFails.length}`); }
      if (corFails.length) { s -= corFails.length; why.push(`${corFails.length} corridorFail −${corFails.length}`); }
      if (!overlapping.length && !fpFails.length && !corFails.length && minGap >= 1.5) why.push('no OBB overlap, no gate footprint/corridor fail — full marks');
      return { score: clamp(s, 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 4,
    key: 'entranceExit',
    score(io) {
      const access = io.need('entrance.rideAccessNodes');
      const reach = io.need('accessibility.perRideReachable');
      const registered = io.need('rideRoster.registeredCount');
      const queued = io.need('sim.queued');
      const riding = io.need('sim.riding');
      const activeGuests = io.need('sim.activeGuests');
      const simRides = io.opt('sim.rides', []);
      const warnKinds = io.opt('consoleSummary.gateWarningKinds', {});
      const lintKinds = io.opt('consoleSummary.lintKinds', {});
      if (io.missing.length) return null;
      if (!registered) return { score: 0, reason: 'no registered rides — the whole axis is 0' };
      const reachBy = new Map(reach.map((r) => [r.name, r]));
      const why = [];
      let per = 0;
      const failed = [];
      for (const r of access) {
        const rr = reachBy.get(r.name) || {};
        let pts = 0;
        const bad = [];
        if (r.queueNode >= 0 && rr.queueReachable) pts += 2; else bad.push('queue');
        if (r.exitLaneLen > 0) pts += 2; else bad.push('exitLane');
        if (r.exitNode >= 0 && rr.exitReachable) pts += 2; else bad.push('exitStranded');
        per += pts;
        if (bad.length) failed.push(`${r.name}[${bad.join(',')}]`);
      }
      // 6 of the 7 points are the per-ride tests, pro-rated over the roster
      const perRide = access.length ? (per / access.length) : 0; // 0..6
      why.push(`per-ride ${round(perRide)}/6 over ${access.length} ride(s)${failed.length ? ` — failures: ${failed.join(' ')}` : ' — all queue-attached, all exit lanes paved, no stranded exit'}`);
      // 1 pt: guests actually use them. SNAPSHOT — do not charge unless
      // activeGuests is also 0 (RUBRIC.md axis 4, measured on worlds-ref).
      const moving = simRides.some((r) => r.state && r.state !== 'movingToEndOfStation');
      let pUse;
      if (queued > 0 || riding > 0 || moving) { pUse = 1; why.push('usage 1/1 (queued/riding/off-station)'); }
      else if (activeGuests > 0) { pUse = 1; why.push(`usage 1/1 (snapshot reads queued 0 / riding 0 but activeGuests ${activeGuests} — RUBRIC.md forbids charging this)`); }
      else { pUse = 0; why.push('usage 0/1 (queued 0, riding 0 AND activeGuests 0)'); }
      let s = perRide + pUse;
      const notAdj = (warnKinds.exitNotAdjacent || 0) + (lintKinds.exitNotAdjacent || 0);
      if (notAdj) { s -= 0.5; why.push(`exitNotAdjacent warning −0.5 (once, ${notAdj} occurrence(s))`); }
      return { score: clamp(s, 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 5,
    key: 'foodStalls',
    score(io) {
      const count = io.need('stallRoster.registeredCount');
      const distinct = io.need('stallRoster.distinctKinds');
      const covers = io.need('stallRoster.coversFoodAndDrink');
      const themed = io.need('stallRoster.themedNameCount');
      const stalls = io.need('stallRoster.stalls');
      const nodes = io.need('layoutRaw.nodes');
      const spaces = io.need('layout.openSpace.spaces');
      if (io.missing.length) return null;
      if (count === 0) return { score: 0, reason: '0 registered stalls — the whole axis is 0 (RUBRIC.md axis 5)' };
      const why = [];
      const p1 = count >= 2 ? 1 : 0;
      why.push(`count ${p1}/1 (${count} registered)`);
      const p2 = distinct >= 3 && covers ? 1.5 : distinct >= 2 ? 0.75 : 0;
      why.push(`variety ${p2}/1.5 (distinctKinds ${distinct}, food+drink ${covers})`);
      const p3 = round(1 * (themed / count));
      why.push(`naming ${p3}/1 (${themed}/${count} themed)`);
      // traffic: within 4 u of a street node, or within 2 u of an open-space rect
      const onTraffic = stalls.filter((s) => {
        if (!s.at) return false;
        const nearNode = nodes.some((nd) => Math.hypot(nd[0] - s.at[0], nd[1] - s.at[1]) <= 4.0);
        const nearSpace = spaces.some((sp) => sp.centre && Math.hypot(sp.centre[0] - s.at[0], sp.centre[1] - s.at[1]) <= Math.sqrt(sp.area) / 2 + 2.0);
        return nearNode || nearSpace;
      }).length;
      const p4 = round(0.5 * (onTraffic / count));
      why.push(`on traffic ${p4}/0.5 (${onTraffic}/${count} within 4 u of the net or 2 u of a plaza)`);
      return { score: clamp(p1 + p2 + p3 + p4, 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 6,
    key: 'parkEntrance',
    score(io) {
      const gates = io.need('entrance.gateMeshes');
      const attached = io.need('entrance.attachedToPathNode');
      io.opt('entrance.gateAt');
      if (io.missing.length) return null;
      if (gates < 1) return { score: 0, reason: 'gateMeshes 0 — no gate, the whole axis is 0' };
      if (!attached) return { score: 1.5, reason: `gateMeshes ${gates} but attachedToPathNode false — unattached gate caps at 1.5` };
      return { score: this.weight, reason: `gateMeshes ${gates}, attachedToPathNode true — full marks` };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 7,
    key: 'terrain',
    score(io) {
      const size = io.need('terrain.size');
      const stdH = io.need('terrain.stdH');
      const maxSlope = io.need('terrain.maxSlope');
      const pitch = io.need('terrain.slopePitch');
      const lint = io.need('terrain.lint');
      io.note('terrain.maxSlopeCoarse', 'the retired size-relative figure — ran BACKWARDS against relief (RUBRIC.md axis 7)');
      io.opt('terrain.minH'); io.opt('terrain.maxH'); io.opt('terrain.peaks');
      if (io.missing.length) return null;
      // The pitch must be the FIXED ~0.6 u stencil, not the retired
      // size-relative one (`S/64`, which was 0.25 u at size 16, 2.0 at 128 and
      // 3.0 at 192 and made the number run BACKWARDS against relief). probe.mjs
      // targets `SLOPE_PITCH = 0.6` but publishes the QUANTISED cell it landed
      // on, so a size-16 park legitimately reads 0.59 — measured across the whole
      // shots corpus: 0.59 at size 16, 0.60 at 48 / 128 / 192. A tolerance band
      // is therefore right; an exact-equality test made every small park's axis 7
      // unmeasured for a rounding artefact, and false alarms devalue real ones.
      if (!(pitch >= 0.5 && pitch <= 0.75))
        return { unmeasured: `terrain.slopePitch is ${pitch}, outside the 0.5–0.75 u window around the fixed 0.6 u stencil this axis's maxSlope band was measured at — the retired size-relative stencil (S/64) is not comparable (RUBRIC.md axis 7)` };
      const why = [];
      // 3 pts — the SIZE-DEPENDENT stdH band
      let pStd;
      if (size <= 48) {
        pStd = stdH >= 0.3 && stdH <= 1.0 ? 3 : stdH >= 0.2 && stdH <= 1.5 ? 1.5 : 0;
        why.push(`stdH ${pStd}/3 (${stdH}; size ${size} <= 48 band 0.3–1.0)`);
      } else {
        pStd = stdH >= 0.75 && stdH <= 1.5 ? 3 : stdH < 0.5 ? 0 : stdH > 2.19 ? 0 : 1.5;
        why.push(`stdH ${pStd}/3 (${stdH}; size ${size} >= 64 band 0.75–1.5 normal, < 0.5 DEAD FLAT, > 2.19 no precedent)`);
      }
      // 4 pts — the four lint categories, 1 each
      const cats = ['isDry', 'slopeAt', 'flatEnough', 'inBounds'];
      let pLint = 0;
      const lintWhy = [];
      for (const c of cats) {
        const entries = lint[c] === undefined ? undefined : Object.keys(lint[c] || {}).length;
        if (entries === undefined) return { unmeasured: `terrain.lint.${c} is absent — the lint category cannot be certified empty` };
        if (entries === 0) pLint += 1;
        else lintWhy.push(`${c}×${entries}`);
      }
      why.push(`lint ${pLint}/4${lintWhy.length ? ` (${lintWhy.join(', ')})` : ' (all four categories empty)'}`);
      // 2 pts — maxSlope at the fixed 0.6 u pitch
      const pSlope = maxSlope <= 6 ? 2 : maxSlope <= 8 ? 1 : 0;
      why.push(`maxSlope ${pSlope}/2 (${maxSlope} @ pitch ${pitch}; <= 6 flat-to-strong-relief, > 8 suspect a spike)`);
      return { score: clamp(pStd + pLint + pSlope, 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 8,
    key: 'water',
    score(io) {
      const bodyCount = io.need('water.terrainWater.bodyCount');
      const wanted = io.need('water.terrainWater.bodiesWanted');
      const frac = io.need('water.terrainWater.fractionOfPark');
      const climate = io.need('terrain.climate');
      const plotUtil = io.need('layout.plot.plotUtilisation');
      const secondFrac = io.opt('water.terrainWater.secondFrac');
      const gap = io.opt('water.terrainWater.bodyGap');
      const gapReq = io.opt('water.terrainWater.gapRequired');
      const areas = io.need('water.terrainWater.bodyAreas');
      const minBodyArea = io.need('water.terrainWater.minBodyArea');
      const gateOk = io.opt('__gateOk', null);
      io.note('water.terrainWater.bodyCountRaw', 'pre-filter count');
      io.note('water.terrainWater.gridCellArea', 'the probe quantisation the gate overrides');
      if (io.missing.length) return null;
      const band = CLIMATE_WATER_BAND[climate];
      if (!band) return { unmeasured: `terrain.climate "${climate}" has no published p5–p95 band in RUBRIC.md axis 8 (known: ${Object.keys(CLIMATE_WATER_BAND).join(', ')})` };
      if (areas.length !== bodyCount)
        return { unmeasured: `water.terrainWater is INTERNALLY INCONSISTENT — bodyCount ${bodyCount} but ${areas.length} entr(ies) in bodyAreas. The count cannot be trusted either way.` };
      const why = [];
      let s = this.weight;
      let cap = this.weight;
      let effectiveCount = bodyCount;
      // THE GATE OVERRIDE IS FOR QUANTISATION ONLY. RUBRIC.md's evidence for it
      // is `worlds-ref`: `bodyCount: 3` with areas `[261.3, 112.0, 1.78]` — one
      // SPECK one probe cell wide. So the override fires only when discarding the
      // unresolvable specks (area < 3 · minBodyArea) actually RECOVERS the gate's
      // count. A park with five REAL bodies and a passing gate is a genuine
      // gate/probe CONFLICT, not a rounding artefact, and is not forgiven here.
      const resolvable = areas.filter((a) => a >= 3 * minBodyArea).length;
      if (bodyCount !== wanted && gateOk === true) {
        if (resolvable === wanted) {
          effectiveCount = wanted;
          why.push(`bodyCount ${bodyCount} vs bodiesWanted ${wanted}, but validatePark → ok: true AND ${bodyCount - resolvable} body/ies are under 3× minBodyArea (${round(3 * minBodyArea)} u²) — QUANTISATION, believe the gate (grid cell ${io.resolve('water.terrainWater.gridCellArea')} u²)`);
        } else {
          why.push(`CONFLICT: bodyCount ${bodyCount} vs bodiesWanted ${wanted} with validatePark → ok: true, but ${resolvable} of those bodies are RESOLVABLE (>= 3× minBodyArea ${round(3 * minBodyArea)} u², areas [${areas.map((a) => round(a)).join(', ')}]) — too large to be the probe's quantisation, so the gate override does NOT apply`);
        }
      }
      if (effectiveCount === wanted) why.push(`bodyCount ${effectiveCount} == bodiesWanted ${wanted} — full marks on the count`);
      else if (effectiveCount < wanted) { cap = 3; why.push(`bodyCount ${effectiveCount} < ${wanted} — axis capped at 3`); }
      else { cap = 2; why.push(`bodyCount ${effectiveCount} > ${wanted} — SCATTER, axis capped at 2`); }
      if (wanted >= 2) {
        if (secondFrac === null || gap === null || gapReq === null)
          return { unmeasured: 'water.terrainWater.secondFrac / bodyGap / gapRequired absent — the SECONDARY-body test cannot be run on a plot that wants 2 bodies' };
        if (secondFrac < 0.16) { s -= 2; why.push(`secondFrac ${secondFrac} < 0.16 −2`); } else why.push(`secondFrac ${secondFrac} >= 0.16`);
        if (gap < gapReq) { s -= 2; why.push(`bodyGap ${gap} < required ${gapReq} −2 (one lake, not two)`); } else why.push(`bodyGap ${gap} >= ${gapReq}`);
      }
      // climate band
      const [p5, p95] = band;
      if (frac > p95) {
        const d = Math.floor((frac - p95) / 0.05) + 1;
        s -= d;
        why.push(`fractionOfPark ${frac} above ${climate} p95 ${p95} −${d}`);
      } else if (frac < p5) {
        if (plotUtil < 0.7) {
          const d = Math.floor((p5 - frac) / 0.05) + 1;
          s -= d;
          why.push(`fractionOfPark ${frac} below ${climate} p5 ${p5} −${d} (plotUtilisation ${plotUtil} < 0.7, so the shortfall was NOT paid for with built-out land)`);
        } else why.push(`fractionOfPark ${frac} below ${climate} p5 ${p5} but plotUtilisation ${plotUtil} >= 0.7 — keepDry paid for, not charged`);
      } else why.push(`fractionOfPark ${frac} inside ${climate} p5–p95 ${p5}–${p95}`);
      return { score: clamp(Math.min(s, cap), 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 9,
    key: 'scenery',
    score(io) {
      const sceneryCount = io.need('scenery.count');
      const composables = io.need('composables');
      const totalLength = io.need('paths.totalLength');
      const openArea = io.need('layout.openSpace.totalArea');
      io.inputs['(shot 07 night dressing)'] = 'NOT MEASURABLE from probe.json — a visual read, and RUBRIC.md assigns it no point value';
      if (io.missing.length) return null;
      const pieces = sceneryCount + Object.values(composables).reduce((a, b) => a + b, 0);
      const pathedArea = totalLength * PATH_SLAB_WIDTH + openArea;
      const target = pathedArea / 25;
      const density = target > 0 ? pieces / target : 0;
      let s = this.weight * clamp(density, 0, 1);
      const why = [`${pieces} piece(s) over ${round(pathedArea)} u² pathed area = ${round(density)}× the "1 per 25 u²" target`];
      if (density < 0.4) { s = Math.min(s, 2); why.push('bare plazas — capped at 2'); }
      return { score: clamp(round(s), 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 10,
    key: 'trees',
    score(io) {
      const count = io.need('trees.count');
      const byShape = io.need('trees.byShape');
      const positions = io.need('trees.positions');
      const peaks = io.need('terrain.peaks');
      const size = io.need('parkSize');
      if (io.missing.length) return null;
      const why = [];
      // 1.5 count, as an AREAL density: 4 per 16² = 1 per 64 u²
      const target = Math.max(4, Math.round((size * size) / 64));
      const pCount = count >= target ? 1.5 : count >= target / 2 ? 0.75 : count > 0 ? 0.375 : 0;
      why.push(`count ${pCount}/1.5 (${count} vs target ${target} = max(4, size²/64))`);
      // 1.0 shape mix
      const shapes = Object.entries(byShape).filter(([, v]) => v > 0).length;
      const pShape = shapes >= 3 ? 1 : shapes === 2 ? 0.5 : shapes === 1 ? 0.25 : 0;
      why.push(`shape mix ${pShape}/1 (${shapes} distinct shape(s))`);
      // 0.5 spread over quadrants
      const q = [0, 0, 0, 0];
      for (const p of positions) q[(p[0] >= 0 ? 1 : 0) + (p[1] >= 0 ? 2 : 0)] += 1;
      const occupied = q.filter((c) => count > 0 && c / count >= 0.05).length;
      const pSpread = occupied === 4 ? 0.5 : occupied === 3 ? 0.25 : 0;
      why.push(`spread ${pSpread}/0.5 (${occupied}/4 quadrants hold >= 5% of trees: [${q.join(', ')}])`);
      // 1.0 natural mountains
      const pPeaks = peaks >= 1 ? 1 : 0;
      why.push(`peaks ${pPeaks}/1 (${peaks})`);
      let s = pCount + pShape + pSpread + pPeaks;
      if (count === 0 && peaks < 1) { s = Math.min(s, 1.5); why.push('treeless AND flat — capped at 1.5'); }
      return { score: clamp(s, 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 11,
    key: 'creativity',
    score(io) {
      const rides = io.need('rides');
      const stallCount = io.need('stallRoster.registeredCount');
      const themedStalls = io.need('stallRoster.themedNameCount');
      const variety = io.need('sceneryVariety.varietyIndex');
      io.opt('sceneryVariety.flavourItems');
      io.inputs['(per-zone theme cohesion)'] = 'MOVED TO AXIS 16 by RUBRIC.md — deliberately not scored here';
      if (io.missing.length) return null;
      const reg = rides.filter((r) => r.registered);
      // A `<Coaster>`/`<TrackRide>` has NO catalog default name, so the probe
      // writes `defaultName: null` for it. An earlier version of this test read
      // `name && defaultName && name !== defaultName`, which counted r15a's
      // "Thunderhead" and "Wolds Runner" as UNTHEMED and cost the park 0.14 —
      // a null-input false negative, i.e. exactly the defect class this file
      // exists to stop. No default name means any name is AUTHORED.
      const noDefault = reg.filter((r) => r.name && !r.defaultName).length;
      const themedRides = reg.filter((r) => r.name && (!r.defaultName || r.name !== r.defaultName)).length;
      if (noDefault) io.inputs['(rides with defaultName: null)'] = `${noDefault} — no catalog default (e.g. <Coaster>), so the shipped name is authored and counts as THEMED`;
      const namedTotal = reg.length + stallCount;
      const pName = namedTotal ? round(1.5 * ((themedRides + themedStalls) / namedTotal)) : 0;
      // varietyIndex: >= 6 rich, <= 2 monotone, linear between
      const pVar = variety >= 6 ? 1.5 : variety <= 2 ? 0 : round(1.5 * ((variety - 2) / 4));
      return {
        score: clamp(pName + pVar, 0, this.weight),
        reason: `naming ${pName}/1.5 (${themedRides}/${reg.length} rides + ${themedStalls}/${stallCount} stalls themed); scenery flavour ${pVar}/1.5 (varietyIndex ${variety}; >= 6 rich, <= 2 monotone)`,
      };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 12,
    key: 'accessibility',
    score(io) {
      const allRides = io.need('accessibility.allRidesReachable');
      const allStalls = io.need('accessibility.allStallsReachable');
      const orphans = io.need('accessibility.orphanIslands');
      const reachable = io.need('accessibility.nodesReachableFromGate');
      const total = io.need('accessibility.nodesTotal');
      const causeway = io.need('rampObservations.causewayEdges');
      const steep = io.need('rampObservations.steepEdges');
      const rampSignals = io.need('consoleSummary.rampSignals');
      const consoleRampLints = io.opt('__consoleRampLints', null);
      if (io.missing.length) return null;
      // ---------------------------------------------------------------------
      // THE RAMPING INSTRUMENT CAN BE BLIND — DO NOT PASS THE AXIS FOR SILENCE
      // ---------------------------------------------------------------------
      // Measured on `r15a` (round 15A): `causewayEdges`, `steepEdges` AND
      // `rampSignals` were ALL EMPTY while the park's own console.log carried 13
      // `ramp lint: elevated node NN … deck unreachable` lines. probe.mjs's
      // `rampSignals` regex did not match the design system's actual ramp lint
      // (fixed 2026-07-26). An older probe.json still carries the blind capture,
      // so if the console.log disagrees with the probe the RAMPING TERM IS
      // UNMEASURED — a clean read from an instrument that is not wired up is not
      // evidence of a clean park.
      const rampSilent = causeway.length === 0 && steep.length === 0 && rampSignals.length === 0;
      if (rampSilent && consoleRampLints > 0)
        return {
          unmeasured:
            `RAMPING INSTRUMENT BLIND: rampObservations.causewayEdges, .steepEdges and consoleSummary.rampSignals are ALL EMPTY, but ` +
            `${consoleRampLints} "ramp lint … deck unreachable" line(s) are present in this park's console.log. probe.mjs's rampSignals ` +
            `regex did not match the design system's ramp lint until 2026-07-26 — RE-PROBE this park. The axis is NOT passed for the ` +
            `silence of an instrument that was not wired up.`,
        };
      let s = this.weight;
      const why = [];
      if (!allRides) { s -= 2; why.push('allRidesReachable false −2'); }
      if (!allStalls) { s -= 2; why.push('allStallsReachable false −2'); }
      if (orphans > 0) { s -= 2 * orphans; why.push(`${orphans} orphan island(s) −${2 * orphans}`); }
      const ratio = total > 0 ? reachable / total : 0;
      if (ratio < 1) { const d = round(2 * (1 - ratio)); s -= d; why.push(`gate reach ${reachable}/${total} = ${round(ratio)} −${d}`); }
      const ramp = Math.min(4, causeway.length * 1 + steep.length * 2);
      if (ramp > 0) { s -= ramp; why.push(`${causeway.length} causeway + ${steep.length} steep edge(s) −${ramp} (capped at 4)`); }
      else if (rampSignals.length) { s -= 1; why.push(`${rampSignals.length} rampSignal console line(s) with 0 causeway/steep edges −1 (the lint fired even though the geometric test did not)`); }
      if (!why.length) why.push(`all rides + stalls reachable, 0 orphan islands, ${reachable}/${total} nodes from the gate, no causeway/steep edges — full marks`);
      return { score: clamp(s, 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 13,
    key: 'rideRoster',
    score(io, ctx) {
      const registered = io.need('rideRoster.registeredCount');
      const rides = io.need('rideRoster.rides');
      const categoryCount = io.need('rideRoster.categoryCount');
      const unclassified = io.need('rideRoster.unclassifiedKinds');
      const besides = io.need('rideRoster.circuitsBesidesFlagship');
      const families = io.need('rideRoster.circuitFamilyCount');
      const noveltyD = io.need('rideRoster.novelty.distance');
      const noveltyCorpus = io.need('rideRoster.novelty.corpusSize');
      const storedFirstUse = io.need('rideRoster.firstUseKinds');
      const mono = io.need('monorail');
      io.opt('rideRoster.novelty.nearest');
      io.opt('rideRoster.headerClaim.overstated');
      if (io.missing.length) return null;
      if (unclassified.length)
        return { unmeasured: `rideRoster.unclassifiedKinds is non-empty (${unclassified.join(', ')}) — RUBRIC.md axis 13: "If unclassifiedKinds is ever non-empty again, the CATALOG TABLE is stale, not the park: fix RIDE_CATEGORY before scoring"` };
      const why = [];
      // 2 — count. "Full only if spacing (axis 3) holds."
      let pCount = registered >= 5 ? 2 : registered === 4 ? 1.75 : registered === 3 ? 1 : registered === 2 ? 0.5 : 0;
      const spacingHolds = ctx.axis3 !== null && ctx.axis3 >= ctx.weights[3];
      if (pCount === 2 && !spacingHolds) { pCount = 1.75; why.push(`count 1.75/2 (${registered} registered, but axis 3 spacing is ${ctx.axis3}/${ctx.weights[3]} — not full)`); }
      else why.push(`count ${pCount}/2 (${registered} registered)`);
      // 1.5 — distinct KINDS, counted off rides[] (what REGISTERED)
      //
      // THE MANDATED-COASTER EXEMPTION (RUBRIC.md axis 13, fixed 2026-07-26).
      // §4.0-E and axis 14 REQUIRE a second rated coaster ("A ONE-COASTER PARK
      // CANNOT TAKE FULL MARKS"), and both coasters register as the same kind
      // `Coaster`, so a park that OBEYS the mandate manufactures exactly the
      // duplicate this row calls "padding". Measured on r15a and skeleton-a:
      // distinctKinds 8 vs registeredCount 9, the sole duplicate being the
      // mandated second coaster -> 1.0 instead of 1.5, i.e. a 0.5 pt penalty for
      // following the rules. The row now discounts the duplicates the mandate
      // MAKES, so a park is NEITHER rewarded NOR punished for obeying.
      //
      // THE EXEMPTION IS DELIBERATELY NARROW, so this cannot become a padding
      // loophole:
      //   * it is capped at TWO duplicates (the second AND third coaster). A
      //     FOURTH coaster is padding again and is docked.
      //   * it is bounded by `thrill.ratedCount − 1`, NOT by how many coaster
      //     components the park mounted. Axis 14's mandate is literally
      //     `thrill.ratedCount >= 2`, so only a coaster that actually RATED
      //     buys an exemption; three copies of a fatal/unrated coaster buy
      //     nothing. Padding with dead track is still charged.
      //   * it applies to COASTER-family kinds only (`circuitFamilyOf(kind) ===
      //     'coaster'`, from the live catalog). A duplicate Carousel, a
      //     duplicate LogFlume or a duplicate of any other kind is still docked
      //     in full — duplicates are counted PER KIND, so 2 Coasters + 2
      //     Carousels exempts the coaster pair and still charges the Carousel.
      //   * if `thrill.ratedCount` is absent the exemption is ZERO, i.e. the
      //     strict pre-fix reading. A missing input never buys credit here.
      const kindCounts = {};
      let kindless = 0;
      for (const r of rides) if (r.kind) kindCounts[r.kind] = (kindCounts[r.kind] || 0) + 1; else kindless += 1;
      const perKindDupes = Object.entries(kindCounts).map(([k, c]) => [k, c - 1]).filter(([, d]) => d > 0);
      const regKinds = new Set(Object.keys(kindCounts));
      // A ride with NO `kind` cannot be CERTIFIED distinct, so it is charged as a
      // duplicate rather than counted as variety — the same reading the old
      // `registeredCount − distinctKinds` formula gave it, kept deliberately so
      // moving to a per-kind count could not turn an unknown into a free point.
      // (Zero occurrences across the current corpus; this is the guard, not a fix.)
      const rawDupes = perKindDupes.reduce((a, [, d]) => a + d, 0) + kindless;
      if (kindless) why.push(`${kindless} registered ride(s) carry NO \`kind\` — charged as duplicate(s), because an unknown kind cannot be certified distinct`);
      const coasterKindDupes = perKindDupes
        .filter(([k]) => circuitFamilyOf(k) === 'coaster' || /Coaster/i.test(k))
        .reduce((a, [, d]) => a + d, 0);
      const ratedCount = io.opt('thrill.ratedCount', null);
      const mandated = ratedCount === null ? 0 : clamp(ratedCount - 1, 0, 2);
      const exempt = Math.min(coasterKindDupes, mandated);
      const dupes = Math.max(0, rawDupes - exempt);
      const pKinds = dupes <= 0 ? 1.5 : dupes === 1 ? 1 : 0.5;
      why.push(`kinds ${pKinds}/1.5 (${regKinds.size} distinct of ${registered} registered = ${rawDupes} raw duplicate(s), ${dupes} chargeable)`);
      if (exempt > 0)
        why.push(
          `MANDATE EXEMPTION: ${exempt} of those duplicate(s) are the SECOND/THIRD rated coaster that axis 14 REQUIRES ` +
            `(thrill.ratedCount ${ratedCount}, coaster-kind duplicates ${coasterKindDupes}) — discounted, so the mandate is neither ` +
            `rewarded nor punished. Capped at 2: a FOURTH coaster, and every non-coaster duplicate, is still docked.`,
        );
      else if (coasterKindDupes > 0)
        why.push(
          `NO mandate exemption despite ${coasterKindDupes} coaster-kind duplicate(s): thrill.ratedCount is ${ratedCount === null ? 'ABSENT' : ratedCount}, ` +
            `so at most ${mandated} duplicate(s) are mandated — the surplus copies are padding and are charged.`,
        );
      // 1.5 — category balance. THE MANDATE IS FIVE, SO FULL MARKS START AT FIVE
      // (aligned 2026-07-26).
      //
      // SETUP.md §0-P.4 — "THE BUILD MANDATES — state them positively, because
      // they are unconditional" — reads: ">= 8 rides, all distinct kinds, across
      // 5 categories (gentle · transport · water · thrill · dark)". This row
      // banded `>= 4` at full marks, so `r16b` shipped FOUR categories, declared
      // `categories: 4` honestly on its `<Park roster>` prop, was correctly
      // scored `overstated: false` — and lost NOTHING. A published, unconditional
      // build mandate was unenforced by the yardstick that decides whether the
      // build met it, which makes the mandate advisory in practice.
      //
      // NOT A TIGHTENED THRESHOLD DRESSED AS A FIX: the bands below 5 are
      // re-spaced, not lowered wholesale, so the row stays strictly monotone and
      // a 4-category park is charged 0.5 — the same size of charge axis 13
      // already levies for one duplicate kind. The 5th category is REACHABLE and
      // that is measured, not assumed: `r16a` (same wave) imported `GhostTrain`
      // and shipped `dark`; `r15a` shipped `GhostTrain` + `ObservationTower`;
      // `skeleton-a` shipped `HauntedMansion`. A "the catalog does not offer a
      // 5th category" excuse was investigated and REFUTED — the full 112-component
      // catalog is offered, and r16b's own header comment claiming "dark + tower
      // rides are absent from this catalog build" is a confabulation.
      const pCat = categoryCount >= 5 ? 1.5 : categoryCount === 4 ? 1 : categoryCount === 3 ? 0.75 : categoryCount === 2 ? 0.5 : 0;
      why.push(
        `categories ${pCat}/1.5 (${categoryCount} of the 5 RCT2 groups` +
          (categoryCount < 5 ? `; §0-P.4 MANDATES all 5 — full marks start at 5, not 4` : '') +
          ')',
      );
      // 1 — CIRCUIT ROSTER, on the field the row NAMES (see AMBIGUITIES)
      const pCirc = besides >= 4 && families >= 3 ? 1 : besides === 3 && families >= 2 ? 0.75 : besides === 2 ? 0.5 : besides === 1 ? 0.25 : 0;
      why.push(`circuits ${pCirc}/1 (circuitsBesidesFlagship ${besides}, families ${families})`);
      // 1 — selection NOVELTY, capped at 0.5 with no first-use kind.
      // firstUseKinds is taken from the LIVE corpus (ctx.live), not from the
      // value probe.json baked in at probe time, and never from a prose list.
      const firstUse = ctx.live ? ctx.live.firstUseKinds : storedFirstUse;
      const fuSrc = ctx.live ? `LIVE corpus of ${ctx.live.corpusSize} (excl. ${ctx.live.excluded ?? 'nothing'})` : 'probe.json (stored)';
      if (ctx.live && JSON.stringify([...storedFirstUse].sort()) !== JSON.stringify([...firstUse].sort()))
        why.push(`NOTE: probe.json recorded firstUseKinds [${storedFirstUse.join('/') || 'none'}] against its probe-time corpus; the LIVE corpus of ${ctx.live.corpusSize} gives [${firstUse.join('/') || 'none'}] — the live value is used`);
      let pNov = noveltyD >= 0.4 ? 1 : noveltyD >= 0.25 ? 0.5 : 0;
      if (!firstUse.length && pNov > 0.5) { pNov = 0.5; why.push(`novelty 0.5/1 (distance ${noveltyD} vs ${noveltyCorpus}-park corpus, but firstUseKinds is EMPTY [${fuSrc}] — capped at 0.5)`); }
      else why.push(`novelty ${pNov}/1 (distance ${noveltyD} vs ${noveltyCorpus}-park corpus, firstUseKinds ${firstUse.length ? firstUse.join('/') : 'none'} [${fuSrc}])`);
      // −1 — the MONORAIL deduction, capped at −1, axis floors at 0
      let ded = 0;
      const md = [];
      if (!mono.present) { ded += 1; md.push('absent'); }
      else {
        if (!mono.registered || mono.fatal || !mono.circuitClosed) { ded += 1; md.push(`present but registered=${mono.registered}/fatal=${mono.fatal}/closed=${mono.circuitClosed}`); }
        if (mono.everyStationExitConnected === false || mono.everyStationQueued === false) { ded += 0.5; md.push('a platform guests cannot reach'); }
        if (mono.worldsDeclared > 0 && mono.worldsTouched < mono.worldsDeclared) { ded += 0.5; md.push(`touches ${mono.worldsTouched}/${mono.worldsDeclared} worlds`); }
      }
      ded = Math.min(1, ded);
      if (ded) why.push(`monorail −${ded} (${md.join('; ')})`);
      else why.push('monorail present/registered/closed/all-worlds — no deduction');
      const s = pCount + pKinds + pCat + pCirc + pNov - ded;
      return { score: clamp(s, 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 14,
    key: 'thrill',
    score(io, ctx) {
      const coasterCount = io.need('thrill.coasterCount');
      const ratedCount = io.need('thrill.ratedCount');
      const fatal = io.need('thrill.fatalCoasters');
      const gateOk = io.need('thrill.coasterGateOk');
      const mixComplete = io.need('thrill.mixComplete');
      const mix = io.need('thrill.intensityMix');
      const nauseaExtreme = io.need('thrill.nauseaExtreme');
      const lateralSafe = io.need('thrill.lateralSafe');
      const circuitCount = io.need('rideRoster.circuitCount');
      const circuitFamilies = io.need('rideRoster.circuitFamilyCount');
      const storedFirstUseCircuits = io.need('rideRoster.firstUseCircuits');
      const flagshipE = io.opt('thrill.flagshipExcitement');
      const peakG = io.opt('thrill.peakPosVertG');
      const drop = io.opt('thrill.bestHighestDrop');
      const airtime = io.opt('thrill.bestAirtimeSeconds');
      const negG = io.opt('thrill.bestNegVertG');
      const secondQualifies = io.opt('thrill.secondCoasterQualifies', false);
      const secondArch = io.opt('thrill.secondDistinctArchetype', false);
      const coasters = io.opt('coasters', []);
      if (io.missing.length) return null;
      // the never-used shelf, derived LIVE (see ctx.live) — never a prose list
      const firstUseCircuits = ctx.live ? ctx.live.firstUseCircuits : storedFirstUseCircuits;
      // THE TYPE IS DERIVED FROM THIS PARK'S OWN MEASURED RATINGS — see
      // deriveParkType(). It is no longer a default, and an explicit
      // --parkType can only make it stricter.
      const type = ctx.parkType;
      const basis = ctx.parkTypeBasis || { source: 'unknown', evidence: [], assumptionBased: false };
      const T = type === 'thrill' ? { e: 6.0, g: 2.5, d: 2.0 } : { e: 5.0, g: 1.8, d: 1.2 };
      const why = [
        `scored as a ${type.toUpperCase()} park (targets E ${T.e} / +G ${T.g} / drop ${T.d}) — ` +
          `${basis.source}${basis.assumptionBased ? ' [ASSUMPTION-BASED: no measured signal decided, so the STRICTER branch was taken]' : ''}` +
          `${basis.evidence && basis.evidence.length ? ` [${basis.evidence.join(' | ')}]` : ''}` +
          `${basis.override ? ` [${basis.override}]` : ''}`,
      ];
      // -----------------------------------------------------------------------
      // AN ILLEGAL COASTER BANKS NO THRILL (RUBRIC.md axis 14, fixed 2026-07-26)
      // -----------------------------------------------------------------------
      // `coasterGateOk: false` USED to zero the 1-pt force row only, so a coaster
      // the gate rejects still collected the 3-pt excitement rating, the 1-pt
      // drop and the 0.5-pt airtime — 4.5 points of thrill off geometry the game
      // refuses. HANDOFF.md §3: "thrill must never come from illegality".
      //
      // WHICH ROWS FORFEIT, AND WHY — read off what the check ACTUALLY covers.
      // `coasterGateOk` is `consoleSummary.coasterFails.length === 0`
      // (probe.mjs:1056), i.e. validatePark's `check: 'coaster'` block
      // (`validate.ts` "coaster legality: design rules + clearance + CRASH-FREE
      // guard"), which fires on exactly five things: a FATAL compiled track; a
      // non-warning `checkCoasterDesign` violation (slope / pitchRate /
      // inversion / bankLimit / bankRate / noStation); the track leaving the
      // plot bounds; `validateSpline` self-clearance under 0.9 u; and the derail
      // guard — `replayCoasterForces().worstLatAccel > 1.275 g`, "the train would
      // crash".
      //
      // `rateCoaster()` runs THE SAME `replayCoasterForces` pass (ratings.ts:
      // "there is exactly ONE physics model in the kit"), and the replay has no
      // early exit, so an illegal coaster still yields internally-consistent
      // numbers — they simply describe a lap that in the live sim ends in
      // `crashTrain` and is never completed. So the numbers are not corrupt;
      // they are UNEARNED. Every row measured off that track or that replay
      // forfeits:
      //     flagship excitement 3   (replay speed/G + track geometry)
      //     second rated coaster 0.75 (a rated-coaster credit)
      //     force envelope 1        (was already 0 — the derail guard IS this row)
      //     highest drop 1          (the drop of a track the gate rejects)
      //     airtime 0.5             (the same replay's vertG dwell)
      // and only the two rows that are NOT coaster-derived survive:
      //     circuit span 0.5 + never-used shelf 0.25 — `rideRoster.circuitCount`
      //       / `circuitFamilyCount` / `firstUseCircuits`: roster COMPOSITION,
      //       true whether or not the flagship is legal.
      //     park thrill MIX 1 — `thrill.intensityMix` is banded off each
      //       registered ride's AUTHORED `intensity` prop over ALL rides (flat
      //       rides included, GameManager registry.ts), and touches no coaster
      //       physics at all.
      // So an illegal-coaster park caps at 1.75/8 rather than 8/8. The whole
      // axis is NOT zeroed, because zeroing rows a legal flat-ride roster earned
      // would charge the illegality to measurements it never touched.
      //
      // ATTRIBUTION CAVEAT, published rather than papered over: `coasterGateOk`
      // is PARK-WIDE and not attributable to one coaster — `registerCoaster` is
      // also called for a FATAL `<TrackRide>` of any profile, so a broken log
      // flume flips it false. That is still a real defect a 100/100 park must
      // not have, so the forfeiture stands; the reason string names the cause.
      const coasterLegal = gateOk === true && fatal === 0;
      if (!coasterLegal)
        why.push(
          `ILLEGAL COASTER (coasterGateOk ${gateOk}, fatalCoasters ${fatal}) — the flagship-excitement (3), ` +
            `second-coaster (0.75), force (1), drop (1) and airtime (0.5) rows are ALL FORFEIT: every one of them is ` +
            `measured off the rejected track or off the same replayCoasterForces pass the derail guard failed. ` +
            `Only circuit span (0.5), never-used shelf (0.25) and the authored-intensity MIX (1) survive, so this axis ` +
            `caps at 1.75/8. NOTE coasterGateOk is park-wide and a fatal <TrackRide> can also cause it.`,
        );
      // 3 — flagship excitement, pro-rated: full at target, 1.5 at 60%, 0 below 25%
      let pFlag = 0;
      if (!coasterLegal) why.push('flagship 0/3 (FORFEIT — illegal coaster)');
      else if (ratedCount > 0 && flagshipE !== null) {
        const r = flagshipE / T.e;
        if (r >= 1) pFlag = 3;
        else if (r >= 0.6) pFlag = 1.5 + 1.5 * ((r - 0.6) / 0.4);
        else if (r > 0.25) pFlag = 1.5 * ((r - 0.25) / 0.35);
        pFlag = round(pFlag);
        why.push(`flagship ${pFlag}/3 (E ${flagshipE} = ${round(r * 100)}% of ${T.e})`);
      } else why.push('flagship 0/3 (no rated coaster)');
      // 1.5 — the ROSTER term: 0.75 + 0.5 + 0.25
      let pSecond = 0;
      if (coasterLegal && ratedCount >= 2) pSecond = secondQualifies && secondArch ? 0.75 : secondQualifies ? 0.5 : 0.25;
      const pSpan = circuitCount >= 5 && circuitFamilies >= 3 ? 0.5 : circuitCount >= 4 && circuitFamilies >= 2 ? 0.25 : 0;
      const pShelf = firstUseCircuits.length ? 0.25 : 0;
      why.push(`roster ${round(pSecond + pSpan + pShelf)}/1.5 (second coaster ${pSecond}/0.75 [${coasterLegal ? `ratedCount ${ratedCount}, qualifies ${secondQualifies}, distinct archetype ${secondArch}` : 'FORFEIT — illegal coaster'}]; circuit span ${pSpan}/0.5 [${circuitCount} circuits, ${circuitFamilies} families]; never-used shelf ${pShelf}/0.25 [${firstUseCircuits.join('/') || 'none'}])`);
      // 1 — force envelope. 0 if the coaster gate failed or anything is fatal.
      let pForce = 0;
      if (!coasterLegal) why.push(`force 0/1 (coasterGateOk ${gateOk}, fatalCoasters ${fatal})`);
      else if (ratedCount === 0) why.push('force 0/1 (no rated coaster)');
      else {
        const gOk = peakG !== null && peakG >= T.g;
        pForce = gOk && lateralSafe ? 1 : gOk || lateralSafe ? 0.5 : 0;
        why.push(`force ${pForce}/1 (+G ${peakG} vs ${T.g}, lateralSafe ${lateralSafe})`);
      }
      // 1 — highest drop with a credible top speed (a 2 u drop should read >~ 6 u/s)
      let pDrop = 0;
      const maxSpeed = coasters.reduce((a, c) => Math.max(a, c.maxSpeed || 0), 0);
      // CREDIBLE TOP SPEED. RUBRIC.md pins ONE point — "a 2 u drop should read
      // >~ 6 u/s" — and speed off a drop goes as SQRT(h), not linearly. An
      // earlier version here extrapolated linearly (>= 3·drop), which demanded
      // 16.4 u/s of r15a's 5.47 u drop and failed a coaster measuring 10.91 u/s,
      // i.e. essentially free-fall (sqrt(2·9.81·5.47) = 10.4). The hand-score was
      // right and the linear test was wrong. Anchored on the published point and
      // scaled as sqrt: 6·sqrt(drop/2), which reproduces 6 u/s at drop 2 exactly.
      const speedFloor = round(6 * Math.sqrt((drop ?? 0) / 2));
      if (!coasterLegal) why.push('drop 0/1 (FORFEIT — illegal coaster)');
      else if (drop !== null && drop >= T.d) { pDrop = maxSpeed >= speedFloor ? 1 : 0.5; why.push(`drop ${pDrop}/1 (${drop} u vs ${T.d}, maxSpeed ${maxSpeed} vs the 6·sqrt(drop/2) = ${speedFloor} u/s credibility floor)`); }
      else why.push(`drop 0/1 (${drop} u vs ${T.d})`);
      // 0.5 — airtime
      const pAir = !coasterLegal ? 0
        : (airtime !== null && airtime >= 0.2) || (airtime > 0 && negG !== null && negG <= -0.1) ? 0.5 : airtime > 0 || (negG !== null && negG <= -0.1) ? 0.25 : 0;
      why.push(`airtime ${pAir}/0.5 (${coasterLegal ? `${airtime} s, bestNegVertG ${negG}` : 'FORFEIT — illegal coaster'})`);
      // 1 — park thrill MIX
      const bands = ['gentle', 'moderate', 'intense'].filter((b) => (mix[b] || 0) > 0).length;
      const pMix = mixComplete ? 1 : bands === 2 ? 0.5 : 0;
      why.push(`mix ${pMix}/1 (${bands}/3 bands: ${JSON.stringify(mix)})`);
      let s = pFlag + pSecond + pSpan + pShelf + pForce + pDrop + pAir + pMix;
      // the deliberate caps
      // The illegal-coaster cap is stated as a CAP as well as a per-row
      // forfeiture, so no future row added above this line can leak thrill
      // credit past it without someone deciding to raise the number here.
      if (!coasterLegal && s > 1.75) { why.push(`ILLEGAL-COASTER CAP: capped at 1.75/8 (scored ${round(s)})`); s = 1.75; }
      if (ratedCount <= 1) {
        const cap = circuitCount <= 1 ? 6.5 : 7.25;
        if (s > cap) { why.push(`ratedCount ${ratedCount}${circuitCount <= 1 ? ' with no other circuit' : ''} — capped at ${cap}/8`); s = cap; }
        else why.push(`(ratedCount ${ratedCount} caps this axis at ${cap}/8; scored ${round(s)})`);
      }
      if (nauseaExtreme) { why.push('NAUSEA GUARD: nauseaExtreme — capped at 5/8'); s = Math.min(s, 5); }
      if (coasterCount === 0) why.push('no coaster at all');
      return { score: clamp(round(s), 0, this.weight), reason: why.join('; ') };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 15,
    key: 'layoutUniqueness',
    score(io) {
      // REUSED, not reimplemented: score-layout.mjs is the executable form of
      // this axis. Every field it touches is required here so a truncated
      // `layout` object cannot silently produce a plausible number.
      for (const p of [
        'layout.gridRegularity', 'layout.edgeLengths.effectiveClasses', 'layout.edgeBearings.obliqueEdgeFraction',
        'layout.lattice.latticeNodeShare', 'layout.curves.hasCurveOrDiagonal', 'layout.districts.count',
        'layout.districts.maxSeparation', 'layout.districts.separationTarget', 'layout.plot.plotUtilisation',
        'layout.openSpace.count', 'layout.openSpace.areaSpread', 'layout.openSpace.largestArea',
      ]) io.need(p);
      const nov = io.need('layout.novelty.distance');
      const corpus = io.need('layout.novelty.corpusSize');
      if (io.missing.length) return null;
      const r = scoreLayout(io.p.layout);
      return {
        score: r.total,
        reason: `scoreLayout(): antiLattice ${r.parts.antiLattice}/3, districts ${r.parts.districts}/2, plazaVariety ${r.parts.plazaVariety}/1, novelty ${r.parts.novelty}/1 (signature distance ${nov} vs a ${corpus}-park corpus)`,
        detail: r,
      };
    },
  },
  // -----------------------------------------------------------------------
  {
    n: 16,
    key: 'worlds',
    score(io) {
      const declared = io.need('worlds.declared');
      if (io.missing.length) return null;
      if (declared === 0) {
        io.opt('worlds.score.total');
        return { score: 0, reason: 'declared 0 — a pre-worlds park scores 0 on the whole axis (RUBRIC.md axis 16, intended reading)', detail: scoreWorlds(io.p.worlds) };
      }
      // REUSED, not reimplemented: probe.mjs:1155 already stores
      // `scoreWorlds(report.worlds)` on `worlds.score`.
      //
      // VERSION SKEW IS DETECTED. `worlds.score` written before the 2026-07-26
      // count/choice split has no `varietyTerms`, and a probe.json with no
      // `worlds.presetUsage` cannot produce the CHOICE term at all. RUBRIC.md
      // axis 16: "If `presetUsage` is absent (an old probe.json) the CHOICE term
      // is reported UNSCORED, never docked." score-worlds.mjs pushes the
      // UNSCORED note but still adds choice = 0, i.e. it DOES dock it — so the
      // 0.5 is removed from this axis's MAX here instead of being lost silently.
      const embedded = io.opt('worlds.score.total');
      const hasVarietyTerms = !!io.opt('worlds.score.varietyTerms');
      const usage = io.opt('worlds.presetUsage.corpusSize');
      io.need('worlds.worlds'); io.need('worlds.separation'); io.need('worlds.crossThemeCount');
      if (io.missing.length) return null;
      let r, provenance;
      if (embedded !== null && hasVarietyTerms && usage !== null) { r = io.p.worlds.score; provenance = 'EMBEDDED scoreWorlds() output, reused verbatim'; }
      else {
        r = scoreWorlds(io.p.worlds);
        provenance = embedded === null
          ? '(absent) — recomputed by calling scoreWorlds(probe.worlds)'
          : `STALE (${!hasVarietyTerms ? 'no varietyTerms: predates the 2026-07-26 count/choice split' : 'presetUsage absent'}) — RECOMPUTED with the current scoreWorlds(); the embedded total was ${embedded}`;
      }
      io.inputs['worlds.score'] = provenance;
      const parts = r.parts || {};
      const out = {
        score: r.total,
        reason: `scoreWorlds(): variety ${parts.variety}/1.5, buildOut ${parts.buildOut}/1, separation ${parts.separation}/1, coherence ${parts.coherence}/1.5 [${provenance}]`,
        detail: r,
      };
      if (usage === null) {
        out.max = this.weight - 0.5;
        out.unmeasuredWeight = 0.5;
        out.reason += ' — worlds.presetUsage is ABSENT, so the 0.5-pt world-CHOICE term is UNSCORED: its weight is REMOVED from the denominator rather than docked (RUBRIC.md axis 16). Re-probe to score it.';
      } else out.reason += ` (world-CHOICE credit is corpus-median-relative — corpus size ${usage})`;
      return out;
    },
  },
];

// ===========================================================================
// the driver
// ===========================================================================
export function scoreProbe(probe, opts = {}) {
  const weightRows = opts.weights || readWeights();
  const weights = {};
  for (const r of weightRows) weights[r.n] = r.weight;
  const weightSum = weightRows.reduce((a, r) => a + r.weight, 0);
  if (weightRows.length !== 16 || weightSum !== 100)
    throw new Error(`RUBRIC.md's weights table parsed as ${weightRows.length} axes summing to ${weightSum}, not 16/100 — run \`node check-weights.mjs\` before scoring`);

  // ---- THE PARK TYPE IS MEASURED (see deriveParkType above) ---------------
  // An explicit `--parkType` is honoured only when it does NOT select a branch
  // more generous than the measurement. Letting a flag downgrade a measured
  // thrill park to the family targets would reopen the exact hole this fixes,
  // so the measurement wins and the refusal is published in score.json.
  const basis = deriveParkType(probe);
  let parkType = basis.type;
  if (opts.parkType && opts.parkType !== basis.type) {
    if (opts.parkType === 'thrill') {
      parkType = 'thrill';
      basis.override = `--parkType=thrill accepted: it is STRICTER than the measured "${basis.type}"`;
    } else {
      basis.override =
        `--parkType=family REFUSED: the measurement says THRILL (${basis.source}) and family is the more generous branch ` +
        `(E 5.0/+G 1.8/drop 1.2 vs 6.0/2.5/2.0). RUBRIC.md axis 14: the branch is never chosen because it scores higher.`;
    }
  } else if (opts.parkType) basis.override = `--parkType=${opts.parkType} agrees with the measurement`;
  const global = { unmeasured: [], notes: [], caps: [] };
  if (basis.assumptionBased)
    global.notes.push(
      `axis 14 is ASSUMPTION-BASED on the park type: ${basis.evidence[basis.evidence.length - 1]} — it was scored against the ` +
        `THRILL targets. Its score is a LOWER BOUND, not a measurement of the intended type.`,
    );
  if (basis.override) global.notes.push(`parkType: ${basis.override}`);

  // ---- the GATE VERDICT, read once ---------------------------------------
  // `probe.validation` is `null` on older probe.json files even when the gate
  // PASSED, so the console summary is the fallback — and if BOTH are missing
  // the verdict is UNMEASURED, never "no failures".
  const vLine = probe.consoleSummary ? probe.consoleSummary.validatorLine : undefined;
  const vFails = (probe.consoleSummary && probe.consoleSummary.validatorFails) || null;
  let gateOk = probe.validation ? probe.validation.ok : null;
  if (gateOk === null || gateOk === undefined) {
    if (typeof vLine === 'string') gateOk = /ok:\s*true/.test(vLine);
    else gateOk = null;
  }
  if (gateOk === null)
    global.unmeasured.push({ what: 'the validatePark verdict', detail: 'probe.validation is null/absent AND consoleSummary.validatorLine is absent — the gate verdict is UNKNOWN. It is NOT "no failures".' });
  if (probe.validation === null && vFails)
    global.notes.push('probe.validation is NULL on this probe.json (a stale-format run); the gate verdict and failure kinds were read off consoleSummary.validatorLine / validatorFails instead.');

  // ---- gate FAIL kinds ----------------------------------------------------
  // TWO SOURCES, ONE PARSE. `validation.failures[]` is the structured array and
  // its `check` IS populated (`'autofix' | 'terrain' | 'coaster' | 'blockers'`
  // …); what is `undefined` on every stored probe.json is `kind`, which is why
  // this used to read the console instead. Both carry the same text, so both are
  // accepted and the console keeps precedence (it is present on the older
  // `validation: null` probes where the structured array is not).
  //
  // THE KEY IS THE SUBKIND WHENEVER ONE EXISTS FOR A BUCKET CHECK. `'autofix'`
  // has no axis of its own by construction (see GATE_FAIL_AXIS's note), so
  // keying an autofix failure on the bucket THROWS AWAY the only attribution it
  // has. It is now keyed on the subkind unconditionally — mapped or not — so an
  // unrecognised one is reported BY NAME ("[edgeThroughSolid]"), which is
  // actionable, instead of as a count of anonymous "autofix" failures, which is
  // not. For a check that HAS its own axis, the subtag still only wins when it
  // is mapped, so `[terrain] [somethingNew]` cannot lose its terrain attribution.
  const BUCKET_CHECKS = new Set(['autofix']);
  const parseFailLine = (text) => {
    // `validatePark FAIL [autofix] [coaster:shortDrop] …` — the subtag charset
    // must include `:`; it did not, so the whole `coaster:*` family was invisible
    const m = String(text).match(/validatePark FAIL \[([^\]]+)\](?:\s*\[([A-Za-z][\w:]*)\])?/);
    // a check with no bracket subtag may still be attributable from its DETAIL
    // (`sim` is emitted from three call sites that land on two axes)
    if (m) return { check: m[1], sub: m[2] ?? detailSubtagOf(m[1], text) };
    // the structured array's `detail` has no "validatePark FAIL" preamble
    const d = String(text).match(/^\s*\[([A-Za-z][\w:]*)\]/);
    return { check: null, sub: d ? d[1] : null };
  };
  const keyOf = (check, sub) => {
    if (sub && (BUCKET_CHECKS.has(check) || check === null || subtagAxisOf(sub) !== undefined)) return sub;
    return check || 'UNPARSED';
  };
  const failKinds = {};
  let failSource = null;
  if (vFails && vFails.length) {
    failSource = 'consoleSummary.validatorFails';
    for (const l of vFails) {
      const { check, sub } = parseFailLine(l);
      const k = keyOf(check, sub);
      failKinds[k] = (failKinds[k] || 0) + 1;
    }
  } else if (probe.validation && Array.isArray(probe.validation.failures) && probe.validation.failures.length) {
    // FALLBACK: the console lines are absent (a probe run whose console was not
    // captured) but the structured verdict is there. `check` + the `[subkind]`
    // at the head of `detail` carry exactly the same two fields.
    failSource = 'validation.failures[] (check + the [subkind] at the head of detail)';
    for (const f of probe.validation.failures) {
      const { sub } = parseFailLine(f.detail ?? '');
      const k = keyOf(f.check ?? null, sub ?? detailSubtagOf(f.check ?? null, f.detail ?? ''));
      failKinds[k] = (failKinds[k] || 0) + 1;
    }
    global.notes.push(`gate FAIL kinds were read off ${failSource} — consoleSummary.validatorFails was empty on this probe.json`);
  }

  // ---- run the axes -------------------------------------------------------
  // -------------------------------------------------------------------------
  // THE NEVER-USED SHELF IS DERIVED LIVE, NEVER HARD-CODED (2026-07-26)
  // -------------------------------------------------------------------------
  // RUBRIC.md:482 hard-codes a 14-kind "never shipped" list that is already
  // STALE — it names `Helicycles`, which `skeleton-a` ships. Prose lists rot;
  // `signatures/` does not. So `firstUseKinds` / `firstUseCircuits` are
  // RECOMPUTED here from the live corpus (the same `loadCorpus` +
  // `kindFrequency` pair `usage.mjs` uses), excluding this park's own signature,
  // and the corpus size is stamped on the result. The value baked into
  // probe.json is kept for comparison: it was computed against the corpus AS OF
  // THE PROBE RUN, which is not the corpus at scoring time.
  //
  // -------------------------------------------------------------------------
  // AND THE CORPUS IS SNAPSHOTTED ONCE, BY NAME, WITH A HASH (wave-16 P0)
  // -------------------------------------------------------------------------
  // `signatures/` is shared and mutable and every probe run writes into it, so
  // "a 29-park corpus" identifies nothing: waves 16A and 16B ran concurrently
  // and 16B's denominator may or may not have contained 16A's park depending on
  // which run reached `saveSignature` first. `corpusSnapshot()` resolves the
  // membership ONCE, sorted, and returns the NAMES plus a content hash, which is
  // recorded in score.json. Two parks of one wave can then be scored against a
  // provably identical corpus (`--corpus=<stamp>`), and a re-score that disagrees
  // can be told apart from a corpus that moved under it.
  //
  // WHAT THIS DOES NOT FIX, stated plainly rather than papered over: the three
  // novelty FIGURES this scorer consumes (axis 13 `rideRoster.novelty`, axis 15
  // `layout.novelty`, axis 16 `worlds.presetUsage`) are computed at PROBE time
  // and baked into probe.json. Recording a scoring-time snapshot cannot make a
  // probe-time number reproducible. probe.mjs therefore records ITS snapshot
  // too, and `corpusStamp.probeTime` below republishes it; a probe.json written
  // before that change carries only the three SIZES, and `reproducible: false`
  // says so instead of implying otherwise.
  //
  // -------------------------------------------------------------------------
  // AND THE PARK EXCLUDES ITSELF BY RESOLVED PATH, NOT BY NAME (wave-16 P0)
  // -------------------------------------------------------------------------
  // MEASURED: `samples/skeleton-b.tsx` is stored under the name
  // `w18-skeleton-b`, so `--park=skeleton-b` excluded NOTHING and the park was
  // scored against its own signature — `layout.novelty { distance: 0, nearest:
  // "w18-skeleton-b" }`, a park certified as a zero-distance copy of itself.
  // `park` (the resolved source path) is the identity; `name` is a filename.
  // Resolution order, most authoritative first:
  //   1. `probe.parkSource` — recorded by probe.mjs from the file it bundled.
  //   2. `samples/<label>.tsx`, when that exists — covers the stored corpus,
  //      whose probe.json files predate (1).
  //   3. name only, with the weakness NAMED in the stamp rather than assumed away.
  const selfSource = (() => {
    if (typeof probe.parkSource === 'string' && probe.parkSource) return { path: probe.parkSource, how: 'probe.parkSource' };
    if (opts.park) {
      const guess = path.join(HERE, 'samples', `${opts.park}.tsx`);
      if (fs.existsSync(guess)) return { path: fs.realpathSync(guess), how: `samples/${opts.park}.tsx (probe.json predates parkSource)` };
    }
    return null;
  })();
  let live = null;
  let scoringSnap = null;
  try {
    scoringSnap = corpusSnapshot({ exclude: { name: opts.park, park: selfSource ? selfSource.path : null }, pin: opts.corpusPin ?? null });
    if (!selfSource)
      global.notes.push(
        `SELF-EXCLUSION IS BY NAME ONLY for this park: neither probe.parkSource nor samples/${opts.park}.tsx resolved, so if its ` +
          `signature is stored under a DIFFERENT name (as samples/skeleton-b.tsx is, under "w18-skeleton-b") it is still in its own ` +
          `novelty denominator. Re-probe to record parkSource.`,
      );
    else if (!scoringSnap.selfExcluded.length)
      global.notes.push(`this park has NO signature in signatures/ yet (nothing was self-excluded), so its novelty is measured against the whole corpus`);
    else if (scoringSnap.selfExcluded.some((e) => e.matchedBy === 'park path' && e.name !== opts.park))
      global.notes.push(
        `SELF-MATCH AVERTED: this park's own signature is stored as "${scoringSnap.selfExcluded.map((e) => e.name).join('/')}", not ` +
          `"${opts.park}", so a name-based exclusion would have left it in its own novelty denominator. Excluded by resolved path ` +
          `(${selfSource.how}).`,
      );
    const freq = kindFrequency(scoringSnap.records, 'rideKinds');
    const regKinds = [...new Set(((probe.rideRoster && probe.rideRoster.rides) || []).map((r) => r.kind).filter(Boolean))];
    live = {
      corpusSize: scoringSnap.size,
      corpusSha256: scoringSnap.sha256,
      excluded: opts.park || null,
      firstUseKinds: regKinds.filter((k) => !(freq[k] > 0)),
      firstUseCircuits: regKinds.filter((k) => circuitFamilyOf(k) && !(freq[k] > 0)),
      source: 'signatures/ via corpus.mjs corpusSnapshot+kindFrequency — resolved ONCE, membership recorded in corpusStamp; NO hard-coded list',
    };
    if (scoringSnap.pinnedButMissing.length)
      global.unmeasured.push({
        what: 'the PINNED corpus snapshot',
        detail: `--corpus pinned ${opts.corpusPin.length} signature(s); ${scoringSnap.pinnedButMissing.length} are no longer on disk (${scoringSnap.pinnedButMissing.join(', ')}), so this score's denominator is NOT the one that was pinned`,
      });
  } catch (e) {
    global.unmeasured.push({ what: 'the live never-used shelf', detail: `could not read signatures/ to derive firstUseKinds at scoring time: ${e.message}` });
  }

  const ctx = { parkType, parkTypeBasis: basis, weights, axis3: null, live };
  const axes = [];
  // `__gateOk` is the ONE resolved verdict (validation.ok, else the console
  // line, else null) so an axis never has to re-derive it and never mistakes a
  // stale `validation: null` for a failing gate.
  // `__consoleRampLints` — how many "ramp lint … deck unreachable" lines the
  // park's OWN console.log carries, used by axis 12 to detect a blind ramping
  // instrument. `null` = no console.log was supplied, so no cross-check is
  // possible (and axis 12 does not pretend one was done).
  const P = { ...probe, __gateOk: gateOk, __consoleRampLints: opts.consoleRampLints ?? null };
  if (opts.consoleRampLints === null || opts.consoleRampLints === undefined)
    global.notes.push('no console.log was supplied, so axis 12\'s ramp-lint cross-check (round 15A: 13 ramp lints invisible to rampSignals) could NOT be run.');

  // -------------------------------------------------------------------------
  // THE TWO NOVELTY DISTANCES ARE RECOMPUTED AGAINST THE RECORDED SNAPSHOT
  // (wave-16 P0) — the same treatment the never-used shelf already gets
  // -------------------------------------------------------------------------
  // `layout.novelty` (axis 15) and `rideRoster.novelty` (axis 13) were BAKED at
  // probe time. That made them (a) unreproducible — the denominator was a size,
  // not a membership — and (b) immune to the self-exclusion fix above, because a
  // park cannot re-derive its own probe-time corpus. Both are now recomputed here
  // from `scoringSnap`, whose exact membership and hash this score records, using
  // the SAME `layoutNovelty`/`rosterNovelty` functions probe.mjs calls, so the
  // recorded stamp is the denominator that was actually used rather than a
  // decorative annotation. The probe-time value is kept and any disagreement is
  // reported — a corpus that grew since the probe is normal and now visible.
  //
  // RE-PROBING WAS THE ALTERNATIVE AND IT IS NOT AVAILABLE: `samples/*.tsx` have
  // been edited since these probe.json files were written, so re-probing would
  // measure DIFFERENT parks and destroy the calibration table rather than repair
  // it. Recomputing from the stored signature vector re-scores the SAME park.
  const noveltyMoves = [];
  if (scoringSnap) {
    if (P.layout && Array.isArray(P.layout.signature)) {
      const was = P.layout.novelty ?? null;
      const now = layoutNovelty(P.layout.signature, scoringSnap.records);
      P.layout = { ...P.layout, novelty: { ...now, source: `recomputed at scoring time vs corpus ${scoringSnap.sha256} (${scoringSnap.size} parks)`, probeTime: was } };
      if (was && (was.distance !== now.distance || was.nearest !== now.nearest))
        noveltyMoves.push(`layout: probe time ${was.distance} vs ${was.nearest} -> scoring time ${now.distance} vs ${now.nearest}`);
    }
    const rk = probe.rideRoster && Array.isArray(probe.rideRoster.kinds) ? probe.rideRoster.kinds : null;
    if (rk && P.rideRoster) {
      const was = P.rideRoster.novelty ?? null;
      const now = rosterNovelty(rk, scoringSnap.records, 'rideKinds');
      P.rideRoster = { ...P.rideRoster, novelty: { ...now, source: `recomputed at scoring time vs corpus ${scoringSnap.sha256} (${scoringSnap.size} parks)`, probeTime: was } };
      if (was && (was.distance !== now.distance || was.nearest !== now.nearest))
        noveltyMoves.push(`roster: probe time ${was.distance} vs ${was.nearest} -> scoring time ${now.distance} vs ${now.nearest}`);
    }
    // ---- AXIS 16's WORLD-CHOICE TERM IS CORPUS-RELATIVE TOO, AND IT WAS ESCAPING
    // THE PIN (found 2026-07-27). `--corpus=` pinned axes 13 and 15 (recomputed just
    // above) but NOT axis 16: when the probe supplies `varietyTerms` + `presetUsage`
    // the axis takes `provenance = 'EMBEDDED scoreWorlds() output, reused verbatim'`,
    // i.e. the CHOICE credit computed at PROBE time against the live `signatures/`.
    // Symptom: `skeleton-l` scored 96.43 and then 96.18 on IDENTICAL code against an
    // identical pinned corpus (sha 4cd4c2681672f1c6) — the whole 0.25 was axis 16's
    // variety term (1.25 -> 1.0). That is the same yardstick drift the corpus stamp
    // exists to prevent, so recompute it here off the SAME snapshot novelty uses.
    if (P.worlds && P.worlds.presetUsage) {
      const wasUsage = P.worlds.presetUsage;
      const nowUsage = underusedPresets(scoringSnap.records);
      P.worlds = {
        ...P.worlds,
        presetUsage: { ...nowUsage, source: `recomputed at scoring time vs corpus ${scoringSnap.sha256} (${scoringSnap.size} parks)`, probeTime: wasUsage },
      };
      // the embedded `worlds.score` was computed from the PROBE-time usage, so it is
      // now stale by construction: drop it and let the axis call scoreWorlds() again.
      if (P.worlds.score) P.worlds = { ...P.worlds, score: null, scoreProbeTime: P.worlds.score };
      if (wasUsage.median !== nowUsage.median || JSON.stringify(wasUsage.underused) !== JSON.stringify(nowUsage.underused))
        noveltyMoves.push(`worlds presetUsage: probe-time median ${wasUsage.median} underused [${wasUsage.underused}] -> scoring-time median ${nowUsage.median} underused [${nowUsage.underused}]`);
    }
    if (noveltyMoves.length)
      global.notes.push(
        `NOVELTY RECOMPUTED against this score's recorded corpus (${scoringSnap.size} parks, sha ${scoringSnap.sha256}) rather than the ` +
          `probe-time value baked into probe.json — ${noveltyMoves.join('; ')}. The scoring-time figure is the one used, and it is the one ` +
          `the recorded stamp can reproduce.`,
      );
  }
  for (const def of AXES) {
    const weight = weights[def.n];
    const row = weightRows.find((r) => r.n === def.n);
    const io = new Reader(P);
    let out;
    try {
      out = def.score.call({ weight }, io, ctx);
    } catch (e) {
      out = { unmeasured: `the scorer threw while reading this axis: ${e.message}` };
    }
    const rec = { axis: def.n, name: row ? row.name : def.key, weight, max: weight, score: null, inputs: io.inputs, reason: '' };
    if (out === null || (out && out.unmeasured)) {
      rec.score = null;
      rec.unmeasured = true;
      rec.reason = out && out.unmeasured ? out.unmeasured : `MISSING INPUT(S): ${io.missing.join(', ')} — this axis was NOT measured and is neither awarded nor zeroed`;
      global.unmeasured.push({ what: `axis ${def.n} (${rec.name})`, detail: rec.reason });
    } else {
      rec.score = round(out.score);
      rec.reason = out.reason;
      if (out.detail) rec.detail = out.detail;
      // an axis may report a PARTIALLY unmeasured sub-term: its weight leaves
      // the denominator instead of being silently docked or silently awarded
      if (out.max !== undefined && out.max !== weight) {
        rec.max = out.max;
        rec.partiallyUnmeasured = out.unmeasuredWeight ?? round(weight - out.max);
        global.unmeasured.push({ what: `axis ${def.n} (${rec.name}) — ${rec.partiallyUnmeasured} pt sub-term`, detail: out.reason });
      }
    }
    if (def.n === 3) ctx.axis3 = rec.score;
    axes.push(rec);
  }

  // ---- the cross-axis validatePark FAIL charge ----------------------------
  const charges = [];
  for (const [kind, n] of Object.entries(failKinds)) {
    if (GATE_FAIL_NO_DOUBLE_CHARGE.has(kind)) { charges.push({ kind, count: n, axis: null, charge: 0, why: 'already charged by the axis\'s own numeric test — not double-charged' }); continue; }
    const subAx = subtagAxisOf(kind);
    const ax = subAx !== undefined ? subAx : GATE_FAIL_AXIS[kind];
    if (ax === undefined) {
      global.unmeasured.push({ what: `validatePark FAIL kind "${kind}" (×${n})`, detail: 'not in GATE_FAIL_AXIS nor GATE_FAIL_SUBTAG_AXIS — the failure cannot be attributed to an axis, so it is NOT silently forgiven. Add it to the map.' });
      charges.push({ kind, count: n, axis: null, charge: 0, why: 'UNMAPPED — reported as unmeasured, not forgiven' });
      continue;
    }
    const rec = axes.find((a) => a.axis === ax);
    if (!rec || rec.unmeasured) { charges.push({ kind, count: n, axis: ax, charge: 0, why: `axis ${ax} is unmeasured, so the charge cannot be applied` }); continue; }
    const want = GATE_FAIL_CHARGE * n;
    const applied = Math.min(want, rec.score);
    rec.score = round(rec.score - applied);
    rec.reason += `; validatePark FAIL [${kind}]×${n} −${round(applied)}${applied < want ? ` (axis floored at 0; ${round(want)} was due)` : ''}`;
    charges.push({ kind, count: n, axis: ax, charge: round(applied) });
  }

  // ---- the total ----------------------------------------------------------
  const measured = axes.filter((a) => !a.unmeasured);
  const measurableMax = measured.reduce((a, r) => a + r.max, 0);
  let total = round(measured.reduce((a, r) => a + r.score, 0));
  // ---- THE 40-POINT RENDER CAP -------------------------------------------
  // RUBRIC.md:1084: "`[pageerror]`/render errors cap the total at 40." It fires
  // on a park that FAILED TO RENDER, and on nothing else.
  //
  // THE DEFECT (fixed 2026-07-26). The cap read `consoleSummary.errors`, which
  // probe.mjs filled with `^\[(pageerror|error)\]` — ANY `console.error`. So on
  // `r16a` it fired on ten lines, NONE of which was a page error: eight
  // `[error] [plan] FATAL …` from `buildParkNet`'s by-design degrade path (which
  // SETUP.md §0-P.5 describes as "those DEGRADE and record a plan lint by
  // design", i.e. the mechanism that keeps a bad plan from taking the page at
  // all) and two `[error] [Coaster] … FATAL track`. The park rendered
  // completely, `validatePark` spoke, and every one of the ten was ALREADY
  // charged on its own axis — `latticeInWater` on 2, `padOnStreet` on 3, the two
  // fatal coasters on 14 (which forfeits the whole 6.25-pt coaster block). The
  // cap charged them a SECOND time and pinned a 56.55 at 40 — the exact
  // double-charge the rubric's own "don't double-charge" rule forbids.
  //
  // THE FIX. probe.mjs now SPLITS the classes at capture (`pageErrors` /
  // `componentErrors` / `unclassifiedErrors`, with counts), so the distinction is
  // available to every consumer instead of re-derived per consumer. Only
  // `pageErrors` caps. The same split is re-derived HERE for probe.json files
  // written before that change, using the identical predicates — so the fix
  // applies to the stored corpus, not just to future probes.
  const cs = probe.consoleSummary;
  const errors = cs ? cs.errors : undefined;
  if (errors === undefined && (!cs || cs.pageErrors === undefined))
    global.unmeasured.push({ what: 'consoleSummary.errors/.pageErrors', detail: 'absent — the "[pageerror]/render errors cap the total at 40" rule cannot be applied' });
  else {
    const split = classifyErrorLines(cs);
    if (split.pageErrors.length) {
      global.caps.push({
        cap: 40,
        why:
          `${split.pageErrors.length} GENUINE render/page failure(s) — RUBRIC.md caps the total at 40 ` +
          `[${split.pageErrors.slice(0, 2).map((l) => String(l).slice(0, 70)).join(' | ')}]`,
      });
    }
    if (split.componentErrors.length)
      global.notes.push(
        `${split.componentErrors.length} console.error line(s) are COMPONENT-prefixed ` +
          `(${Object.entries(split.byComponentPrefix).map(([k, v]) => `[${k}]×${v}`).join(', ')}) — the design system reporting defects it ` +
          `SURVIVED, not a render failure. They do NOT trigger the 40-point cap; each is charged on the axis that measures it ` +
          `(see gate.charges) and charging the total as well would be the double-charge RUBRIC.md forbids.`,
      );
    if (split.unclassified.length)
      global.unmeasured.push({
        what: `${split.unclassified.length} UNCLASSIFIED console.error line(s)`,
        detail:
          `neither a page/uncaught-exception marker nor a component-prefixed report: ` +
          `[${split.unclassified.slice(0, 3).map((l) => String(l).slice(0, 90)).join(' | ')}]. ` +
          `Whether this park rendered is therefore UNKNOWN, and the 40-cap is neither applied nor waived. ` +
          `Classify the shape in probe.mjs's error split.`,
      });
  }
  for (const c of global.caps) if (total > c.cap) total = c.cap;

  return {
    scorer: 'score-park.mjs',
    scoredAt: new Date().toISOString(),
    rubric: 'RUBRIC.md (16 axes, 100 points; weights parsed from its own table)',
    parkType,
    parkTypeBasis: basis,
    total,
    outOf: 100,
    measurableMax,
    unmeasuredWeight: round(100 - measurableMax),
    complete: global.unmeasured.length === 0,
    gate: { ok: gateOk, validatorLine: typeof vLine === 'string' ? vLine.slice(0, 120) : vLine ?? null, failKinds, charges },
    corpusStamp: (() => {
      const ride = probe.rideRoster && probe.rideRoster.novelty ? probe.rideRoster.novelty.corpusSize : null;
      const lay = probe.layout && probe.layout.novelty ? probe.layout.novelty.corpusSize : null;
      const wor = probe.worlds && probe.worlds.presetUsage ? probe.worlds.presetUsage.corpusSize : null;
      const probeSnap = probe.corpusSnapshot ?? null;
      const sizes = [ride, lay, wor].filter((v) => v !== null);
      return {
        rideNoveltyCorpusSize: ride,
        layoutNoveltyCorpusSize: lay,
        worldsPresetUsageCorpusSize: wor,
        /** the corpus THIS SCORING RUN resolved, by name + hash — the denominator
         *  of the live never-used shelf, and the thing to pin with --corpus */
        scoringTime: scoringSnap
          ? {
              size: scoringSnap.size,
              excluded: scoringSnap.excluded,
              excludedByPath: scoringSnap.excludedByPath,
              selfExcluded: scoringSnap.selfExcluded,
              sha256: scoringSnap.sha256,
              names: scoringSnap.names,
              pinned: opts.corpusPin ? true : false,
            }
          : null,
        /** how this park was kept out of its own denominator. `name` alone is the
         *  weak case — see the SELF-EXCLUSION note in `notes`. */
        selfExclusion: selfSource ? { by: 'resolved park path', source: selfSource.path, how: selfSource.how } : { by: 'name only', source: null, how: 'neither probe.parkSource nor samples/<label>.tsx resolved' },
        /** the axis-13 / axis-15 novelty distances were recomputed here, against
         *  `scoringTime`, so they ARE reproducible from this stamp regardless of
         *  what the probe recorded */
        noveltyRecomputedAtScoringTime: !!scoringSnap,
        noveltyMovedVsProbeTime: noveltyMoves,
        /** the corpus the PROBE resolved — the denominator of the three novelty
         *  figures above. `null` on a probe.json written before probe.mjs started
         *  recording it, which is exactly when the figures are unreproducible. */
        probeTime: probeSnap ? { size: probeSnap.size, excluded: probeSnap.excluded, sha256: probeSnap.sha256, names: probeSnap.names, pinnedFrom: probeSnap.pinnedFrom ?? null } : null,
        /** can the three novelty figures in this score be reproduced? Only if the
         *  probe recorded WHICH parks were in its corpus. A size alone cannot:
         *  two different 29-park corpora are the same size. */
        noveltyReproducible: !!scoringSnap,
        /** the three figures disagreeing means the probe read `signatures/` more
         *  than once while it was being written (the concurrency defect) */
        probeTimeSizesAgree: sizes.length ? sizes.every((v) => v === sizes[0]) : null,
        note:
          'NOVELTY IS CORPUS-RELATIVE AND DECAYS. Any novelty figure (axes 13, 15) and axis 16\'s corpus-median world-CHOICE ' +
          'credit are only comparable between parks scored against the SAME corpus — the same MEMBERSHIP, not merely the same ' +
          'size. Compare `probeTime.sha256`, not the sizes. When `noveltyReproducible` is false, the probe predates the ' +
          'snapshot record and its novelty figures cannot be reproduced: re-probe with `--corpus=<stamp.json>` to pin one.',
      };
    })(),
    axes,
    unmeasured: global.unmeasured,
    notes: global.notes,
    caps: global.caps,
    ambiguities: AMBIGUITIES,
  };
}

// ===========================================================================
// CLI
// ===========================================================================
function resolveProbePath(arg) {
  if (arg.endsWith('.json')) return path.resolve(arg);
  const p = path.join(HERE, 'shots', arg, 'probe.json');
  if (fs.existsSync(p)) return p;
  return path.resolve(arg);
}

export function printTable(res, label) {
  const w = (s, n) => String(s).padEnd(n);
  console.log(`\n  RUBRIC SCORE — ${label}`);
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${w('#', 3)}${w('axis', 28)}${'score'.padStart(7)}${'/max'.padStart(6)}`);
  console.log('  ' + '-'.repeat(76));
  for (const a of res.axes) {
    const sc = a.unmeasured ? 'UNMEAS' : String(a.score);
    console.log(`  ${w(a.axis, 3)}${w(a.name, 28)}${sc.padStart(7)}${String('/' + a.max).padStart(6)}${a.unmeasured ? '   <-- NOT MEASURED' : ''}`);
  }
  console.log('  ' + '-'.repeat(76));
  if (res.complete) console.log(`  TOTAL ${res.total} / 100`);
  else console.log(`  TOTAL ${res.total} / ${res.measurableMax} MEASURED  ***INCOMPLETE*** (${res.unmeasuredWeight} pts of weight unmeasured; the /100 score DOES NOT EXIST for this park)`);
  if (res.caps.length) for (const c of res.caps) console.log(`  CAP applied: ${c.cap} — ${c.why}`);
  console.log(`  gate: validatePark ok = ${res.gate.ok}${Object.keys(res.gate.failKinds).length ? `  FAILS: ${JSON.stringify(res.gate.failKinds)}` : ''}`);
  console.log(`  corpus stamp: ride-novelty ${res.corpusStamp.rideNoveltyCorpusSize}, layout-novelty ${res.corpusStamp.layoutNoveltyCorpusSize}, worlds presetUsage ${res.corpusStamp.worldsPresetUsageCorpusSize}`);
  if (res.notes.length) for (const n of res.notes) console.log(`  NOTE: ${n}`);
  if (res.unmeasured.length) {
    console.log('');
    console.log(`  !!! ${res.unmeasured.length} UNMEASURED ITEM(S) — THIS PARK HAS NO VALID /100 SCORE !!!`);
    for (const u of res.unmeasured) console.log(`    x ${u.what}\n        ${u.detail}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) {
    console.error('usage: node score-park.mjs <park-name | path/to/probe.json> [--parkType=thrill|family] [--corpus=<stamp.json>] [--json] [--no-write] [--allow-unmeasured]');
    process.exit(2);
  }
  const optOf = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const probePath = resolveProbePath(target);
  if (!fs.existsSync(probePath)) {
    // THE `preflight printed "clean" for a nonexistent file` DEFECT, refused.
    console.error(`[score-park] NO SUCH PROBE: ${probePath}`);
    console.error('[score-park] nothing was scored. A missing probe.json is NOT a clean run.');
    process.exit(2);
  }
  const probe = JSON.parse(fs.readFileSync(probePath, 'utf8'));
  const label = path.basename(path.dirname(probePath));
  // the park's own console.log, for axis 12's ramp-lint cross-check
  const logPath = path.join(path.dirname(probePath), 'console.log');
  let consoleRampLints = null;
  if (fs.existsSync(logPath))
    consoleRampLints = fs.readFileSync(logPath, 'utf8').split('\n').filter((l) => /ramp lint|deck unreachable/i.test(l)).length;
  // NO DEFAULT `--parkType`. Passing `'family'` here is what made every park
  // take the generous branch; the type is now DERIVED by deriveParkType() and
  // the flag is an explicit, strict-only override.
  // `--corpus=<stamp.json>` PINS the novelty denominator: pass the `names` list
  // out of an earlier probe.json/score.json `corpusStamp` and every park of a
  // wave is scored against a provably identical corpus, no matter what landed in
  // `signatures/` in between.
  let corpusPin = null;
  const corpusArg = optOf('corpus', null);
  if (corpusArg) {
    const pinned = JSON.parse(fs.readFileSync(path.resolve(corpusArg), 'utf8'));
    corpusPin = Array.isArray(pinned) ? pinned : pinned.names ?? (pinned.corpusStamp && (pinned.corpusStamp.probeTime || pinned.corpusStamp.scoringTime) || {}).names;
    if (!Array.isArray(corpusPin)) {
      console.error(`[score-park] --corpus=${corpusArg} carries no \`names\` array — expected a JSON array, or an object with \`names\`, or a probe.json/score.json with a corpusStamp`);
      process.exit(2);
    }
  }
  const res = scoreProbe(probe, { parkType: optOf('parkType', null), park: label, consoleRampLints, corpusPin });
  res.consoleLog = fs.existsSync(logPath) ? { path: logPath, rampLintLines: consoleRampLints } : null;
  res.park = label;
  res.probe = probePath;
  if (args.includes('--json')) console.log(JSON.stringify(res, null, 2));
  else printTable(res, label);
  if (!args.includes('--no-write')) {
    const out = path.join(path.dirname(probePath), 'score.json');
    fs.writeFileSync(out, JSON.stringify(res, null, 2));
    if (!args.includes('--json')) console.log(`\n  wrote ${out}`);
  }
  process.exit(res.complete || args.includes('--allow-unmeasured') ? 0 : 1);
}
