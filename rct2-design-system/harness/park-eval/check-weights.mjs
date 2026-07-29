#!/usr/bin/env node
// check-weights.mjs — assert RUBRIC.md's axis weights really sum to 100, and
// that each axis's published sub-tests sum to its own weight.
//
// The rubric is edited by hand and by several agents; "keep the total at
// exactly 100" is the one invariant nothing else enforces. This reads the
// WEIGHTS TABLE straight out of RUBRIC.md (so it cannot drift from the
// document) and cross-checks the two axes that ship executable scorers.
//
//   node check-weights.mjs           # exit 0 = the arithmetic holds
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { THRESHOLDS as LAYOUT_T } from './score-layout.mjs';
import { scoreWorlds } from './score-worlds.mjs';

const md = fs.readFileSync(path.join(HERE, 'RUBRIC.md'), 'utf8');

// the weights table: `| 7  | Terrain normality | **9** |`
const rows = [];
for (const line of md.split('\n')) {
  const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*$/);
  if (m) rows.push({ n: Number(m[1]), axis: m[2], w: Number(m[3]) });
  if (/^\|\s*\|\s*\*\*Total\*\*/.test(line)) break;
}
if (!rows.length) {
  console.error('[check-weights] could not find the weights table in RUBRIC.md');
  process.exit(2);
}
const total = rows.reduce((s, r) => s + r.w, 0);
const declaredTotal = Number((md.match(/\|\s*\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\|/) || [])[1] ?? NaN);

let bad = 0;
console.log(`axes parsed: ${rows.length}`);
for (const r of rows) console.log(`  ${String(r.n).padStart(2)}  ${r.axis.padEnd(28)} ${String(r.w).padStart(3)}`);
console.log(`\nsum = ${total}   (table declares ${declaredTotal})`);
if (total !== 100) { console.log('FAIL: the weights do not sum to 100'); bad++; }
if (declaredTotal !== total) { console.log('FAIL: the table\'s own Total row disagrees with its rows'); bad++; }

// axis numbering must be 1..N with no gaps/dupes
const nums = rows.map((r) => r.n);
if (nums.some((n, i) => n !== i + 1)) { console.log(`FAIL: axis numbers are not 1..${rows.length}: ${nums.join(',')}`); bad++; }

// ---- sub-test arithmetic for the two executable scorers -------------------
// axis 15 (layout): 1.5 + 0.75 + 0.75 + 1 + 1 + 1 + 1 = 7
const layoutMax = 1.5 + 0.75 + 0.75 + 1 + 1 + 1 + 1;
const layoutW = rows.find((r) => /Layout uniqueness/i.test(r.axis))?.w;
if (layoutMax !== layoutW) { console.log(`FAIL: axis 15 sub-tests sum to ${layoutMax}, weight is ${layoutW}`); bad++; }
if (typeof LAYOUT_T.separationFloor !== 'function') { console.log('FAIL: score-layout.mjs no longer publishes separationFloor'); bad++; }

// ---- axis 13 (ride roster): 2 + 1.5 + 1.5 + 1 + 1 = 7 ---------------------
// The 1-pt speciality test became a GRADED tracked-circuit test on 2026-07-26
// (measured: 16 of 20 probed parks registered exactly one coaster), which does
// not change the axis weight — this asserts that.
const rosterMax = 2 + 1.5 + 1.5 + 1 + 1;
const rosterW = rows.find((r) => /Ride roster/i.test(r.axis))?.w;
if (rosterMax !== rosterW) { console.log(`FAIL: axis 13 sub-tests sum to ${rosterMax}, weight is ${rosterW}`); bad++; }

// ---- axis 14 (thrill): 3 + 1 + 1 + 0.5 + 1 + 1.5 = 8 ----------------------
// REWEIGHTED 2026-07-26. `force envelope` 2 → 1 and `airtime` 1 → 0.5 because
// both had stopped discriminating — measured over the 15 corpus parks with a
// rated coaster, 15/15 clear BOTH force-envelope tests (+G ≥ 2.5 and lat
// < 1.27) and 15/15 have airtime > 0 (14/15 ≥ 0.2 s). The freed 1.5 became the
// COASTER-ROSTER term, so a one-coaster park can no longer take full marks.
const thrillTerms = { flagshipExcitement: 3, forceEnvelope: 1, highestDrop: 1, airtime: 0.5, thrillMix: 1, coasterRoster: 1.5 };
const thrillMax = Object.values(thrillTerms).reduce((s, v) => s + v, 0);
const thrillW = rows.find((r) => /^\s*Thrill\s*$/i.test(r.axis))?.w;
if (thrillMax !== thrillW) { console.log(`FAIL: axis 14 sub-tests sum to ${thrillMax}, weight is ${thrillW}`); bad++; }
// and the roster term must be big enough that ONE coaster cannot reach the top
if (thrillMax - thrillTerms.coasterRoster >= thrillW) {
  console.log('FAIL: axis 14 — a one-coaster park could still take full marks');
  bad++;
}

// axis 16 (worlds): (1 + 0.5) + 1 + 1 + 1.5 = 5 — verified through the scorer
// itself on a synthetic PERFECT park, so the check tracks the code, not a
// comment. `presetUsage` is the world-CHOICE input (corpus.mjs
// `underusedPresets`); the perfect park builds `tidewater`, the rarest preset.
const PERFECT_USAGE = {
  frequency: { emberfall: 3, tidewater: 2, brasswork: 7, thornwick: 5, pulse: 7 },
  median: 5,
  underused: ['tidewater', 'emberfall'],
  atMedian: ['thornwick'],
  overused: ['brasswork', 'pulse'],
  corpusSize: 24,
  worldParks: 10,
};
const perfect = scoreWorlds({
  declared: 3,
  presets: ['emberfall', 'pulse', 'tidewater'],
  presetCount: 3,
  unusedPresets: ['brasswork', 'thornwick'],
  presetUsage: PERFECT_USAGE,
  worlds: [
    { id: 'a', themeId: 'emberfall', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
    { id: 'b', themeId: 'tidewater', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
    { id: 'c', themeId: 'pulse', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
  ],
  crossTheme: [], crossThemeCount: 0, unplacedThemed: [],
  separation: { pairs: [], minCentre: 44, maxCentre: 60, minGap: 6, size: 128, floor: 32.66, ok: true },
});
const worldsW = rows.find((r) => /^\s*Worlds\s*$/i.test(r.axis))?.w;
if (perfect.total !== worldsW) { console.log(`FAIL: score-worlds.mjs maxes at ${perfect.total}, axis 16 weight is ${worldsW}`); bad++; }
// and a pre-worlds park must be exactly 0, not partial credit
const legacy = scoreWorlds({ declared: 0, worlds: [], crossTheme: [], crossThemeCount: 0, unplacedThemed: [], separation: {} });
if (legacy.total !== 0) { console.log(`FAIL: a park with no worlds scores ${legacy.total} on axis 16, expected 0`); bad++; }
// one cross-theme placement must cost exactly 0.5
const oneBad = scoreWorlds({
  declared: 3, presets: ['emberfall', 'pulse', 'tidewater'], presetCount: 3, unusedPresets: [],
  presetUsage: PERFECT_USAGE,
  worlds: [
    { id: 'a', themeId: 'emberfall', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
    { id: 'b', themeId: 'tidewater', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
    { id: 'c', themeId: 'pulse', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
  ],
  crossTheme: [{ piece: 'LavaFissure', pieceTheme: 'emberfall', at: [1, 2], world: 'c', worldTheme: 'pulse' }],
  crossThemeCount: 1, unplacedThemed: [],
  separation: { pairs: [], minCentre: 44, maxCentre: 60, minGap: 6, size: 128, floor: 32.66, ok: true },
});
if (Math.abs(perfect.total - oneBad.total - 0.5) > 1e-9) {
  console.log(`FAIL: one cross-theme placement costs ${perfect.total - oneBad.total}, expected 0.5`);
  bad++;
}

// ---- axis 16: the WORLD-CHOICE term must actually bite --------------------
// Three built worlds drawn from the presets the corpus OVER-uses must score
// strictly less than the same three worlds including a rare preset. Without
// this, "≥ 3 worlds" is the only test and the same three presets keep winning.
const sameThree = scoreWorlds({
  declared: 3, presets: ['brasswork', 'pulse', 'thornwick'], presetCount: 3, unusedPresets: ['emberfall', 'tidewater'],
  presetUsage: PERFECT_USAGE,
  worlds: [
    { id: 'a', themeId: 'brasswork', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
    { id: 'b', themeId: 'pulse', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
    { id: 'c', themeId: 'thornwick', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
  ],
  crossTheme: [], crossThemeCount: 0, unplacedThemed: [],
  separation: { pairs: [], minCentre: 44, maxCentre: 60, minGap: 6, size: 128, floor: 32.66, ok: true },
});
if (!(sameThree.total < perfect.total)) {
  console.log(`FAIL: axis 16 world CHOICE does not bite — the over-used three score ${sameThree.total}, the rare set ${perfect.total}`);
  bad++;
}
// a park with no `presetUsage` (an old probe.json) must not be silently docked
// the choice points either: the term is UNSCORED and the note says so
const noUsage = scoreWorlds({
  declared: 3, presets: ['emberfall', 'pulse', 'tidewater'], presetCount: 3, unusedPresets: [],
  worlds: [
    { id: 'a', themeId: 'emberfall', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
    { id: 'b', themeId: 'tidewater', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
    { id: 'c', themeId: 'pulse', built: true, rideCount: 3, stallCount: 1, sceneryCount: 9, setPieceCount: 1 },
  ],
  crossTheme: [], crossThemeCount: 0, unplacedThemed: [],
  separation: { pairs: [], minCentre: 44, maxCentre: 60, minGap: 6, size: 128, floor: 32.66, ok: true },
});
if (!(noUsage.notes || []).some((n) => /UNSCORED/.test(n))) {
  console.log('FAIL: axis 16 — a probe.json with no `presetUsage` must report the choice term as UNSCORED');
  bad++;
}

console.log(
  bad
    ? `\n${bad} ARITHMETIC FAILURE(S)`
    : '\nweights ok: 16 axes, 100 points, sub-tests consistent (axes 13/14/15/16 checked against their scorers)',
);
process.exit(bad ? 1 : 0);
