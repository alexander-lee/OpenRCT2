#!/usr/bin/env node
// ---------------------------------------------------------------------------
// mutate-setpiece.mjs — REBUILD THE PRE-THEME Boulevard / FountainPlaza.
//
// The theme-structure work is UNCOMMITTED, so `git show HEAD:` is not a valid
// "before": HEAD predates the working tree these files were already modified
// from, and probing it would compare against code that never ran. (Same trap as
// `mutate-scenery.mjs`, which exists for exactly this reason.)
//
// So the before-state is RECONSTRUCTED by reverting each themed edit at an
// EXACT string anchor into scratch components:
//
//   components/_BoulevardPre/index.tsx
//   components/_FountainPlazaPre/index.tsx
//
// The relative imports (`../Kit`, `../SetPieceKit`, `../Park`) still resolve,
// because the scratch dirs sit at the same depth as the real ones.
//
// IT HARD-EXITS IF ANY ANCHOR IS MISSING. A silently-skipped revert means the
// "before" file still contains the code under test, and then a matching
// fingerprint stops meaning what it looks like it means.
//
//   node mutate-setpiece.mjs          # write the scratch dirs
//   node mutate-setpiece.mjs --clean  # delete them (ALWAYS do this after —
//                                     # a stray components/* dir is in the
//                                     # design system's catalog path)
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const COMP = path.resolve(HARNESS, '..', '..', 'mp3d', 'components');
const TARGETS = [
  ['Boulevard', '_BoulevardPre'],
  ['FountainPlaza', '_FountainPlazaPre'],
];

if (process.argv.includes('--clean')) {
  for (const [, dst] of TARGETS) fs.rmSync(path.join(COMP, dst), { recursive: true, force: true });
  console.log('[mutate-setpiece] scratch dirs removed');
  process.exit(0);
}

/**
 * The two multi-line blocks are read OUT OF THE SOURCE at run time rather than
 * transcribed here: a transcribed anchor drifts the moment the real file gains
 * a comment, and a drifted anchor is a silently-skipped revert.
 */
const slice = (src, from, to) => {
  const s = fs.readFileSync(path.join(COMP, src, 'index.tsx'), 'utf8');
  const i = s.indexOf(from);
  const j = s.indexOf(to, i + 1);
  if (i < 0 || j < 0) {
    console.error(`[mutate-setpiece] ${src}: could not slice ${JSON.stringify(from.slice(0, 60))} .. ${JSON.stringify(to.slice(0, 40))}`);
    process.exit(1);
  }
  return s.slice(i, j + to.length);
};
const KERB_BLOCK = slice('Boulevard', "  // ---- the world's EDGE TREATMENT", '\n  }\n');
const PLAZA_HEAD = slice('FountainPlaza', "  // THE WORLD'S STRUCTURAL DRESS, or null for DEFAULT_THEME", '  } else {\n');

/** every themed edit, as [current, before]. `null` before = delete the block. */
const REVERTS = {
  Boulevard: [
    [
      `// the STRUCTURAL half of the theme layer — a sibling module of SetPieceKit
// rather than part of its 81 KB index, which is already at the size where a
// whole-file \`write_design_system_files\` push is the binding constraint
import { dressOf } from '../SetPieceKit/dress';
`,
      '',
    ],
    [
      `/** kerb offset from the carriageway centreline: the slab is 1.1 wide (edge
 *  0.55) and the lamp verge starts at 1.35, so the run sits in the band between
 *  them and no themed kerb ever stands in a walked slab */
const KERB_LAT = 0.82;

`,
      '',
    ],
    [
      `  // THE WORLD'S STRUCTURAL DRESS, or null. \`dressOf\` has no entry for
  // DEFAULT_THEME (nor for a hand-rolled theme with an unknown id), so an
  // un-themed avenue never enters the themed branches below and keeps its
  // historic geometry by CONTROL FLOW rather than by promise — which is what
  // makes "identical with no theme" testable in one place instead of five.
  const dress = dressOf(plan.theme);
`,
      '',
    ],
    [
      `    // the themed standards are oriented ALONG the avenue (a ship's yard and a
    // gaslight ladder-bar both have to face the street, not the compass)
    const lamp = dress
      ? dress.lamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light, yaw: plan.rotation })
      : setPieceLamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light, theme: plan.theme });`,
      `    const lamp = setPieceLamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light, theme: plan.theme });`,
    ],
    [
      `    const span = dress
      ? dress.span(t, ha, hb)
      : setPieceSpan(t, ha, hb, { colors: [bulbCols[0], bulbCols[bulbCols.length - 1]], bulbs: 5 });`,
      `    const span = setPieceSpan(t, ha, hb, { colors: [bulbCols[0], bulbCols[bulbCols.length - 1]], bulbs: 5 });`,
    ],
    [
      `    if (dress) {
      const seat = dress.bench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw);
      g.add(seat.group);
      if (seat.update) ups.push(seat.update);
    } else g.add(setPieceBench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw));`,
      `    g.add(setPieceBench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw));`,
    ],
    [
      `  // ONE prop slot becomes the world's own LANDMARK — a real piece out of that
  // world's scenery component (a basalt colonnade, a pile of dock pilings, a
  // giant gear, a toadstool clump, a speaker stack). It takes over the MIDDLE
  // planter slot rather than getting a position of its own on purpose: that
  // slot has already been through the planner's \`avoid\` filter and is already
  // in \`plan.cells\`, so the landmark inherits the avenue's keepDry guard and
  // cannot land on a queue lane, an exit hut or a ride pad.
  const lmSlot = dress && plan.props.length ? Math.floor((plan.props.length - 1) / 2) : -1;
  plan.props.forEach((p, i) => {
    if (dress && i === lmSlot) {
      const lm = dress.landmark(t, p.seed);
      // tag the imported piece so \`probe-setpiece-attach\` grades it as ONE
      // object: its internal part-to-part separations belong to its own
      // component's audit, not to this set-piece's
      lm.group.userData.importedPiece = lm.name;
      lm.group.position.set(p.at[0], floor(p.at), p.at[1]);
      lm.group.rotation.y = p.yaw;
      g.add(lm.group);
      if (lm.update) ups.push(lm.update);
      reg.plant(lm.name, p.at, lm.radius);
      return;
    }
    const built`,
      `  plan.props.forEach((p) => {
    const built`,
    ],
    // the whole EDGE TREATMENT block, deleted rather than commented out (a
    // commented block still contains the string `dress.kerb`, which the
    // survivor guard below would — correctly — refuse to accept)
    [KERB_BLOCK, ''],
  ],
  FountainPlaza: [
    [
      `// the STRUCTURAL half of the theme layer (see SetPieceKit/dress.ts) — kept out
// of SetPieceKit's 81 KB index, which is at the whole-file push ceiling
import { dressOf } from '../SetPieceKit/dress';
`,
      '',
    ],
    // the themed paving/parapet/centrepiece branch, deleted outright so the
    // legacy `else` body becomes the only body
    [PLAZA_HEAD, '  {'],
    [
      `    const lamp = dress
      ? dress.lamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light, yaw: plan.rotation })
      : setPieceLamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light, theme: plan.theme });`,
      `    const lamp = setPieceLamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light, theme: plan.theme });`,
    ],
    [
      `    if (dress) {
      const seat = dress.bench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw);
      g.add(seat.group);
      if (seat.update) ups.push(seat.update);
    } else g.add(setPieceBench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw));`,
      `    g.add(setPieceBench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw));`,
    ],
    [
      `    const span = dress ? dress.span(t, ha, hb) : setPieceSpan(t, ha, hb, { colors: pal.spanBulbs });`,
      `    const span = setPieceSpan(t, ha, hb, { colors: pal.spanBulbs });`,
    ],
    [
      `  const lmSlots = dress && plan.props.length >= 2 ? [0, 1] : [];
  plan.props.forEach((p, i) => {
    if (dress && lmSlots.includes(i)) {
      const lm = dress.landmark(t, p.seed);
      // tag the imported piece so \`probe-setpiece-attach\` grades it as ONE
      // object: its internal part-to-part separations belong to its own
      // component's audit, not to this set-piece's
      lm.group.userData.importedPiece = lm.name;
      lm.group.position.set(p.at[0], floor(p.at), p.at[1]);
      lm.group.rotation.y = p.yaw;
      g.add(lm.group);
      if (lm.update) ups.push(lm.update);
      reg.plant(lm.name, p.at, lm.radius);
      return;
    }
    const built`,
      `  plan.props.forEach((p) => {
    const built`,
    ],
  ],
};

let bad = 0;
for (const [src, dst] of TARGETS) {
  let s = fs.readFileSync(path.join(COMP, src, 'index.tsx'), 'utf8');
  for (const [from, to] of REVERTS[src]) {
    const n = s.split(from).length - 1;
    if (n !== 1) {
      console.error(`[mutate-setpiece] ${src}: anchor matched ${n} times, expected 1 —\n---\n${from.slice(0, 160)}\n---`);
      bad += 1;
      continue;
    }
    s = s.replace(from, to);
  }
  // THE SURVIVOR GUARD. Strip comments first, then insist that not one
  // reference to the themed dress is left in live code — that is the whole
  // point of a reconstructed "before", and a leftover call would make a
  // matching fingerprint prove nothing.
  const live = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const survivors = live.match(/dressOf|dress\.[a-z]/g);
  if (survivors) {
    console.error(`[mutate-setpiece] ${src}: ${survivors.length} themed-dress reference(s) SURVIVED the revert: ${[...new Set(survivors)].join(', ')}`);
    bad += 1;
  }
  fs.mkdirSync(path.join(COMP, dst), { recursive: true });
  fs.writeFileSync(
    path.join(COMP, dst, 'index.tsx'),
    `// GENERATED by harness/mp3d-render/mutate-setpiece.mjs — the PRE-THEME state of\n// components/${src}, for the default-path fingerprint baseline. Delete with\n// \`node mutate-setpiece.mjs --clean\`; never edit or publish.\n${s}`,
  );
}
if (bad) {
  console.error(`\n[mutate-setpiece] ${bad} anchor failure(s) — the reconstructed "before" is NOT trustworthy, refusing`);
  for (const [, dst] of TARGETS) fs.rmSync(path.join(COMP, dst), { recursive: true, force: true });
  process.exit(1);
}
console.log('[mutate-setpiece] wrote _BoulevardPre and _FountainPlazaPre');
