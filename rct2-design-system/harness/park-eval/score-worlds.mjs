// park-eval AXIS 16 SCORER — turns `probe.worlds` into the 5-point WORLDS
// score, with every threshold numeric so two scorers reach the same number.
// This is the executable form of RUBRIC.md axis 16 (the sibling of
// score-layout.mjs for axis 15).
//
// The axis exists because `rules/park-generation-composition.md` §3 inverted
// park composition: a park is no longer terrain-then-paths-then-rides with
// themed lands as advice, it is THREE OR MORE PRESET WORLDS, each built out as
// a self-contained district, then connected. Two things are scored:
//
//   WORLD VARIETY   — at least 3 of the 5 shipped presets, each really built.
//   THEME COHERENCE — a themed piece in a foreign world is a deduction
//                     ("minus points if a lava theme was used in the disco
//                     themed place").
//
// EVERY INPUT IS A `probe.worlds` FIELD. Nothing here re-derives theme
// membership: `probe.worlds` is lifted verbatim off the design system's own
// settle-time audit (`ParkBuilder/worlds.ts: auditWorldThemes`), the same
// function whose findings `validatePark` reports as `crossTheme` warnings.

import { canonicalPresets, canonicalTheme, isOwnHeadlineContent, THEME_CONTENT } from './themes.mjs';

export const THRESHOLDS = {
  // 1.0 pt — WORLD COUNT (§3's "at least 3")
  presetsRequired: 3,
  // 0.5 pt — WORLD CHOICE (added 2026-07-26). Counting worlds alone stopped
  //   discriminating: every worlds park in the corpus declares exactly 3, and
  //   MEASURED over the 10 that declare any, the BUILT presets are
  //   brasswork 7 · pulse 7 · thornwick 5 · emberfall 3 · tidewater 2 —
  //   `pulse` is DECLARED by 10 of 10. So the count term shrinks to 1.0 and
  //   0.5 goes to CHOICE: build a preset the corpus under-uses. The split is
  //   the corpus MEDIAN, recomputed every probe (`underusedPresets` in
  //   corpus.mjs), so the credit follows the campaign instead of naming
  //   favourites in the rubric. No preset is exempt: all five have BUILT at
  //   least twice, so there is no structural excuse to avoid one.
  choiceFull: 0.5, // >= 1 built preset strictly BELOW the corpus median
  choiceHalf: 0.25, // >= 1 built preset AT the median, none below
  // 1 pt — every world is a self-contained district WITH ITS OWN RIDES, split
  //   0.5 districts + 0.5 ownContent (see the scorer body for the measurement
  //   that motivated the split).
  //   a world is BUILT when it holds >= 1 registered ride AND >= 1 stall AND
  //   >= 1 scenery piece / set-piece of its own (worlds.worlds[].built, decided
  //   in worlds.ts so the gate's `worldNotBuiltOut` warning uses the same test)
  //   and it carries OWN CONTENT when >= 1 of its pieces is a ride or stall
  //   belonging to its own theme (themes.mjs: isOwnHeadlineContent)
  // 1 pt — worlds read as separate places
  //   the floor is districtSeparationFloor(size) — layout.mjs, shared with
  //   rules §0.3 check 4 (20 u @48, 32.66 @128, 40 @192). Scored on the
  //   CLOSEST pair: every adjacent pair owes the floor.
  separationHalf: 0.6, // >= 0.6 * floor on the closest pair -> half credit
  // 1.5 pts — THEME COHERENCE
  crossThemePenalty: 0.5, // per offending piece, floored at 0
};

const T = THRESHOLDS;
const round = (v) => Math.round(v * 100) / 100;

/** score(probe.worlds) -> { total, parts, notes } (max 5) */
export function scoreWorlds(w) {
  if (!w) return { total: 0, parts: {}, notes: ['no worlds object in probe.json'] };
  const notes = [];

  // A park that declares NO world scores 0 on the whole axis — deliberately,
  // and it is the correct reading for every park that predates the world layer:
  // world variety, per-world build-out, world separation and world coherence
  // are all undefined without a declared world, and awarding the coherence
  // points "because nothing is wrong" would pay a park for not having worlds.
  if (!w.declared) {
    notes.push('no <World> declared — the whole axis is 0 (pre-worlds park, or §3 not followed)');
    return {
      total: 0,
      parts: { variety: 0, buildOut: 0, separation: 0, coherence: 0 },
      notes,
    };
  }

  // ---- 1 pt: WORLD COUNT --------------------------------------------------
  // Counted over BUILT worlds' presets, not declared ones: a declared rect with
  // nothing in it is a label, and §3's "at least 3 worlds" means three places.
  // CANONICALISED (2026-07-27). `canonicalPresets` folds the design system's
  // legacy place names onto its genre ids and drops `'default'` — the Original
  // dress is a theme but NOT a preset world, so three lands dressed `default`
  // are still one place. Before this, a park declaring `pirateBeach` and a
  // corpus entry declaring `tidewater` named the SAME world and compared as
  // different strings, which cost every post-rename park the CHOICE term below.
  const builtPresets = canonicalPresets((w.worlds || []).filter((x) => x.built).map((x) => x.themeId));
  const n = builtPresets.length;
  const count = n >= T.presetsRequired ? 1 : n === 2 ? 0.5 : n === 1 ? 0.2 : 0;
  if (n < T.presetsRequired)
    notes.push(
      `${n} BUILT preset world(s) (${builtPresets.join(', ') || 'none'}) of ${w.declared} declared — §3 wants ≥ ${
        T.presetsRequired
      }; unused presets: ${(w.unusedPresets || []).join(', ') || 'none'}`,
    );

  // ---- 0.5 pt: WORLD CHOICE ----------------------------------------------
  // `w.presetUsage` is `underusedPresets(corpus)` from corpus.mjs, attached by
  // probe.mjs. Absent (an old probe.json, or a corpus of one) → the term is
  // NOT scored and the note says so, rather than paying or docking blind.
  const usage = w.presetUsage || null;
  let choice = 0;
  if (!usage) {
    notes.push('no `worlds.presetUsage` in probe.json — the world-CHOICE term is UNSCORED (re-probe to score it)');
  } else if (!n) {
    notes.push('no BUILT world — the world-CHOICE term is 0');
  } else {
    // The usage table may predate the canonicalisation (an old probe.json
    // carries place-name keys), so fold ITS lists too rather than trusting
    // `usage.space` to be present.
    const rare = builtPresets.filter((p) => canonicalPresets(usage.underused || []).includes(p));
    const mid = builtPresets.filter((p) => canonicalPresets(usage.atMedian || []).includes(p));
    if (rare.length) choice = T.choiceFull;
    else if (mid.length) choice = T.choiceHalf;
    if (choice < T.choiceFull)
      notes.push(
        `world CHOICE ${choice}/${T.choiceFull}: built ${builtPresets.join(' + ')} — the corpus UNDER-uses ` +
          `${(usage.underused || []).map((p) => `${p} (${usage.frequency[p]})`).join(', ') || 'nothing'} ` +
          `and OVER-uses ${(usage.overused || []).map((p) => `${p} (${usage.frequency[p]})`).join(', ') || 'nothing'} ` +
          `across ${usage.worldParks ?? '?'} worlds parks; do not default to the same three`,
      );
  }
  const variety = round(count + choice);

  // ---- 1 pt: every world is a self-contained district, WITH ITS OWN RIDES --
  // Two halves, because "built out" alone stopped meaning "a different place".
  //
  //   districts  0.5 — the share of declared worlds that are `built`. The test
  //                    is UNCHANGED and still decided in `ParkBuilder/worlds.ts`
  //                    so it stays identical to the gate's `worldNotBuiltOut`
  //                    warning: >= 1 ride AND >= 1 stall AND >= 1 scenery.
  //   ownContent 0.5 — the share of BUILT worlds holding >= 1 of their OWN
  //                    themed RIDE or STALL.
  //
  // WHY THE SECOND HALF EXISTS. `built` counts pieces, not provenance, so three
  // worlds can pass it while being the same park three times with different
  // shrubbery. MEASURED on skeleton-l (2026-07-27), a 3-world park that scored
  // buildOut 1.0: its neon and pirateBeach worlds held themed SCENERY and a
  // generic `Bazaar`, and their rides were a renamed HauntedMansion and a
  // Monorail. Only enchantedForest held a themed ride (MoonlitBarge). The park
  // read as fully built out and was, in the way that matters, one place.
  //
  // SCENERY IS DELIBERATELY EXCLUDED. Dressing a stock Carousel with giant
  // toadstools is not an enchanted forest; `WyrmsHollow` is. Each preset ships
  // THREE rides and a stall of its own (see `node themes.mjs`), so every world
  // has four ways to earn this and no theme is structurally excluded.
  const ws = w.worlds || [];
  const builtWs = ws.filter((x) => x.built);
  const share = ws.length ? builtWs.length / ws.length : 0;
  ws.filter((x) => !x.built).forEach((x) =>
    notes.push(
      `world "${x.id}" (${x.themeId}) is not built out: ${x.rideCount} ride(s), ${x.stallCount} stall(s), ${
        x.sceneryCount + x.setPieceCount
      } scenery/set-piece(s)`,
    ),
  );

  // A world's own headline pieces, from the audit's themed-piece list. Match on
  // the world's ID (what `auditWorldThemes` stamps on each piece) and require
  // the piece's theme to canonicalise to the world's own.
  const themed = w.themedPieces || [];
  const ownOf = (x) =>
    themed.filter(
      (p) => p.world === x.id && canonicalTheme(p.themeId) === canonicalTheme(x.themeId) && isOwnHeadlineContent(p.kind, x.themeId),
    );
  const withOwn = builtWs.filter((x) => ownOf(x).length > 0);
  const ownShare = builtWs.length ? withOwn.length / builtWs.length : 0;
  const buildOut = round(0.5 * share + 0.5 * ownShare);
  builtWs
    .filter((x) => !ownOf(x).length)
    .forEach((x) => {
      const t = canonicalTheme(x.themeId);
      const c = (t && THEME_CONTENT[t]) || null;
      notes.push(
        `world "${x.id}" (${x.themeId}) is built out but holds NONE of its own themed rides or stalls — ` +
          `it is dressed ${x.themeId} and stocked generic. Give it one of ` +
          `${c ? [...c.rides, ...c.stalls].join(', ') : 'its own catalog pieces'}`,
      );
    });

  // ---- 1 pt: worlds are SEPARATED ----------------------------------------
  const sep = w.separation || {};
  let separation = 0;
  if (ws.length < 2) notes.push('a single world — separation is undefined, 0/1');
  else if (sep.minCentre === null || sep.floor === undefined) notes.push('no separation measurement');
  else if (sep.minCentre >= sep.floor) separation = 1;
  else if (sep.minCentre >= T.separationHalf * sep.floor) separation = 0.5;
  if (ws.length >= 2 && separation < 1 && sep.minCentre !== null)
    notes.push(
      `closest two world centres are ${sep.minCentre} u apart vs the ${sep.floor} u floor (size ${sep.size}) — those two read as one place`,
    );

  // ---- 1.5 pts: THEME COHERENCE ------------------------------------------
  const bad = w.crossThemeCount || 0;
  const coherence = Math.max(0, round(1.5 - bad * T.crossThemePenalty));
  (w.crossTheme || []).slice(0, 8).forEach((c) =>
    notes.push(`CROSS-THEME: <${c.piece}> (${c.pieceTheme}) at [${c.at[0]}, ${c.at[1]}] inside the ${c.worldTheme} world "${c.world}"`),
  );
  if ((w.unplacedThemed || []).length)
    notes.push(
      `ADVISORY (not scored): ${w.unplacedThemed.length} themed piece(s) stand outside every declared world — grow the world bounds if that was not deliberate`,
    );

  const total = round(variety + buildOut + separation + coherence);
  return {
    total,
    parts: {
      variety: round(variety),
      buildOut,
      separation: round(separation),
      coherence,
    },
    // the two halves of `variety`, published so a scorer can see WHICH one a
    // park lost — a 3-world park that picked brasswork + pulse + thornwick
    // reads variety 1.25, not 1.5, and the note names the rarer presets
    varietyTerms: { count: round(count), choice: round(choice) },
    // the two halves of `buildOut`, for the same reason
    buildOutTerms: {
      districts: round(0.5 * share),
      ownContent: round(0.5 * ownShare),
      builtWorlds: builtWs.length,
      worldsWithOwnContent: withOwn.length,
    },
    builtPresets,
    crossThemeCount: bad,
    notes,
  };
}
