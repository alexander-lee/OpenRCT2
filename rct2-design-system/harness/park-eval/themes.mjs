// park-eval THEME ABSTRACTION — the one place the harness resolves a theme id.
//
// WHY THIS FILE EXISTS
// --------------------
// The design system renamed its five world themes. They were originally
// INVENTED PLACES — Emberfall Caldera, Tidewater Hollow, Brasswork Foundry,
// Thornwick Glade, Pulse District — and `SetPieceKit.WORLD_THEMES` now leads
// with plain GENRE ids (`fire`, `pirateBeach`, `steampunk`,
// `enchantedForest`, `neon`), keeping the place names as resolvable aliases.
// Its own comment gives the reason: a proper noun invites a generator to
// invent matching lore instead of just picking the LOOK it wants.
//
// The rubric never followed. `corpus.mjs` hard-coded
// `WORLD_PRESETS = ['emberfall', 'tidewater', 'brasswork', 'thornwick',
// 'pulse']`, and `presetFrequency`'s `if (p in freq)` silently DROPPED any
// build that used a canonical id. Two consequences, both measured:
//
//   1. Every corpus signature on disk is in place-name space (brasswork 12 ·
//      pulse 12 · thornwick 11 · emberfall 5 · tidewater 2), while every park
//      written since the rename reports genre ids. The two never intersect.
//   2. Axis 16's 0.5-point world-CHOICE credit was therefore UNEARNABLE.
//      skeleton-l builds `pirateBeach` — which IS `tidewater`, the rarest
//      preset in the corpus at 2 of 30 — and scored choice 0/0.5. The park did
//      exactly what the term pays for and the rubric could not see it.
//
// So: ONE canonical space, and everything folds into it before comparison.
//
// THE ORIGINAL THEME
// ------------------
// `default` is a first-class theme and is NOT a preset world. It is the
// classic un-themed RCT2 dress — the hub, the entrance plaza, the midway that
// a park hangs its themed lands off. A park cannot satisfy "≥ 3 worlds" with
// it (that is the point: three lands dressed `default` are one place), but it
// is not an absence either, and `canonicalTheme('default')` resolves rather
// than returning null so a caller can tell "the Original dress" apart from
// "no theme at all".
//
// EVERY TABLE HERE IS DERIVED FROM THE DESIGN SYSTEM SOURCE at load time and
// asserted against it — see `verifyAgainstSource()` at the bottom. A mirror
// that can drift is worse than no mirror: it would score parks against a
// theme catalog the generator cannot actually build from.

import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './paths.mjs';

/** the Original theme — the classic un-themed dress. NOT a preset world. */
export const ORIGINAL_THEME_ID = 'default';

/** the CANONICAL preset ids, in the design system's own stable order
 *  (`SetPieceKit.THEME_IDS`). These are what a generator chooses from. */
export const THEME_IDS = ['fire', 'steampunk', 'pirateBeach', 'enchantedForest', 'neon'];

/** legacy place name -> canonical genre id (`SetPieceKit.WORLD_THEMES`'s
 *  "LEGACY IDS, still resolvable" block) */
export const THEME_ALIASES = {
  emberfall: 'fire',
  tidewater: 'pirateBeach',
  brasswork: 'steampunk',
  thornwick: 'enchantedForest',
  pulse: 'neon',
};

/** human titles, for report lines that used to read as place names */
export const THEME_TITLES = {
  default: 'Original',
  fire: 'Fire (Emberfall Caldera)',
  steampunk: 'Steampunk (Brasswork Foundry)',
  pirateBeach: 'Pirate Beach (Tidewater Hollow)',
  enchantedForest: 'Enchanted Forest (Thornwick Glade)',
  neon: 'Neon (Pulse District)',
};

/**
 * Fold ANY theme id — canonical, legacy place name, or `'default'` — onto the
 * canonical space. Returns `null` for an id the design system does not ship,
 * so an unknown string is never silently counted as a preset.
 */
export function canonicalTheme(id) {
  if (typeof id !== 'string' || !id) return null;
  if (id === ORIGINAL_THEME_ID) return ORIGINAL_THEME_ID;
  if (THEME_IDS.includes(id)) return id;
  return THEME_ALIASES[id] ?? null;
}

/** the canonical PRESET ids of a list of theme ids: aliases folded, `default`
 *  and unknowns dropped, de-duplicated, in `THEME_IDS` order. This is the
 *  function every "which presets did this park build?" question goes through. */
export function canonicalPresets(ids) {
  const seen = new Set();
  for (const raw of ids || []) {
    const c = canonicalTheme(raw);
    if (c && c !== ORIGINAL_THEME_ID) seen.add(c);
  }
  return THEME_IDS.filter((t) => seen.has(t));
}

// ---------------------------------------------------------------------------
// WHAT EACH THEME OWNS — parsed from `ParkBuilder/worlds.ts: COMPONENT_THEME`
// ---------------------------------------------------------------------------
// The design system's table is `displayName -> themeId`. The rubric wants the
// inverse (what may a `neon` world be furnished with?) and it wants it SPLIT BY
// CLASS, because axis 16's own-content term deliberately does not accept
// scenery: dressing a generic Carousel with mushrooms is not an enchanted
// forest, its own RIDE is.

// NOTE: `MagicMirror` and `BigPiano` are NOT here. Both are built by
// `composable()` -> dsClass 'scenery' (walk-on watch zones that register no ride
// handle), so counting them as rides credited a world for a ride it did not have
// and made `enchantedForest`/`neon` look like they owned 3 rides when they own 2.
// A rules table said otherwise and was wrong.
const RIDE_KINDS = new Set([
  // fire
  'MagmaRun', 'EmberWings', 'LavaTubeRun',
  // pirateBeach
  'ReefRacer', 'DeepDrift', 'OceanTunnelSlide',
  // steampunk
  'GearworksExpress', 'AetherBalloons', 'BoilerBurst',
  // enchantedForest (Chairlift claimed 2026-07-28 — a canopy ride over the glade)
  'WyrmsHollow', 'MoonlitBarge', 'Chairlift',
  // neon (MagneticRide claimed 2026-07-28 — it was the third ride neon lacked)
  'Bassline', 'Discotron', 'MagneticRide',
]);

const STALL_KINDS = new Set(['EmberRoast', 'SushiStall', 'GoggleWorks', 'Honeywitch', 'NeonSlush']);

/** parse `COMPONENT_THEME` out of the design system source — the SAME table
 *  `auditWorldThemes` classifies pieces with, so the rubric cannot grade a
 *  park against a catalog the park could not have built from */
function parseComponentTheme() {
  const src = fs.readFileSync(path.join(REPO, 'components', 'ParkBuilder', 'worlds.ts'), 'utf8');
  const open = src.indexOf('export const COMPONENT_THEME');
  if (open < 0) throw new Error('themes.mjs: COMPONENT_THEME not found in ParkBuilder/worlds.ts');
  const start = src.indexOf('{', open);
  const end = src.indexOf('\n};', start);
  if (start < 0 || end < 0) throw new Error('themes.mjs: could not bound the COMPONENT_THEME literal');
  const body = src.slice(start + 1, end);
  const table = {};
  for (const line of body.split('\n')) {
    const m = /^\s*([A-Za-z_$][\w$]*)\s*:\s*'([^']+)'\s*,/.exec(line);
    if (m) table[m[1]] = m[2];
  }
  if (Object.keys(table).length < 20)
    throw new Error(`themes.mjs: COMPONENT_THEME parsed to only ${Object.keys(table).length} entries — the literal's shape changed`);
  return table;
}

/** catalog component displayName -> canonical theme id (NEUTRAL pieces absent) */
export const COMPONENT_THEME = (() => {
  const raw = parseComponentTheme();
  const out = {};
  for (const [kind, id] of Object.entries(raw)) {
    const c = canonicalTheme(id);
    if (!c) throw new Error(`themes.mjs: COMPONENT_THEME maps <${kind}> to unknown theme '${id}'`);
    out[kind] = c;
  }
  return out;
})();

/** the world a catalog component belongs to, or `null` when it is NEUTRAL */
export const themeOfComponent = (kind) => (kind && COMPONENT_THEME[kind]) || null;

/** canonical theme id -> { rides, stalls, scenery } it owns, each sorted */
export const THEME_CONTENT = (() => {
  const out = {};
  for (const t of THEME_IDS) out[t] = { rides: [], stalls: [], scenery: [] };
  for (const [kind, t] of Object.entries(COMPONENT_THEME)) {
    const bucket = RIDE_KINDS.has(kind) ? 'rides' : STALL_KINDS.has(kind) ? 'stalls' : 'scenery';
    out[t][bucket].push(kind);
  }
  for (const t of THEME_IDS) for (const b of ['rides', 'stalls', 'scenery']) out[t][b].sort();
  return out;
})();

/**
 * WHAT EACH WORLD MUST ACTUALLY MOUNT — the user's call, not a derived figure.
 *
 * `min` is how many of that world's own rides have to be registered inside its
 * rect. `must` names the ones there is no substitute for, and `signature` names
 * a scenery piece the world is not finished without.
 *
 * `fire` is the deliberate exception (2026-07-28): it takes `EmberWings` and the
 * lava flume `MagmaRun`, and `LavaTubeRun` — the lava tunnel COASTER — became
 * optional, because three tracked rides in one caldera is one too many and two
 * of them are coasters.
 *
 * `WyrmsHollow` is named for the opposite reason: the glade is not the glade
 * without the wyrm, and it kept being the ride that got dropped when a park
 * mounted two of `enchantedForest`'s three.
 *
 * `MagicMirror` and `BigPiano` are `signature`, never `must`: both build as
 * dsClass 'scenery' (walk-on watch zones registering no ride handle), so
 * counting them as rides would credit a world for a ride it does not have.
 * They were in the scenery column all along and no generated park ever placed
 * one, which is exactly why they now have a name of their own here.
 */
export const WORLD_REQUIREMENT = {
  fire: { min: 2, must: ['EmberWings', 'MagmaRun'], signature: [] },
  pirateBeach: { min: 3, must: [], signature: [] },
  steampunk: { min: 3, must: [], signature: [] },
  enchantedForest: { min: 3, must: ['WyrmsHollow'], signature: ['MagicMirror'] },
  neon: { min: 3, must: [], signature: ['BigPiano'] },
};

/** is this component one of `themeId`'s OWN rides or stalls? (scenery excluded
 *  on purpose — see THEME_CONTENT's note) */
export function isOwnHeadlineContent(kind, themeId) {
  const t = canonicalTheme(themeId);
  if (!t || t === ORIGINAL_THEME_ID) return false;
  return themeOfComponent(kind) === t && (RIDE_KINDS.has(kind) || STALL_KINDS.has(kind));
}

// ---------------------------------------------------------------------------
// THE MIRROR CHECK
// ---------------------------------------------------------------------------

/**
 * Assert this file still agrees with the design system it mirrors. Returns
 * `{ ok, problems[] }` — `node themes.mjs` prints it, and the scorer selftest
 * calls it, so a rename in `SetPieceKit`/`worlds.ts` fails loudly here instead
 * of quietly mis-scoring axis 16.
 */
export function verifyAgainstSource() {
  const problems = [];
  const kitSrc = fs.readFileSync(path.join(REPO, 'components', 'SetPieceKit', 'index.tsx'), 'utf8');

  // 1. THEME_IDS must match SetPieceKit's own canonical list, in order.
  const idsM = /export const THEME_IDS = \[([^\]]+)\]/.exec(kitSrc);
  if (!idsM) problems.push('SetPieceKit.THEME_IDS not found');
  else {
    const dsIds = [...idsM[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    if (dsIds.join(',') !== THEME_IDS.join(','))
      problems.push(`THEME_IDS drift: harness [${THEME_IDS}] vs SetPieceKit [${dsIds}]`);
  }

  // 2. Every alias must still resolve in WORLD_THEMES, to the theme we claim.
  //    (`WORLD_THEMES` lists them as `emberfall: FIRE`, i.e. alias -> the CONST
  //    for the canonical theme, so compare against the const's name.)
  const CONST_OF = {
    fire: 'FIRE',
    steampunk: 'STEAMPUNK',
    pirateBeach: 'PIRATE_BEACH',
    enchantedForest: 'ENCHANTED_FOREST',
    neon: 'NEON_CITY',
  };
  for (const [alias, canon] of Object.entries(THEME_ALIASES)) {
    const re = new RegExp(`^\\s*${alias}:\\s*(\\w+),`, 'm');
    const m = re.exec(kitSrc);
    if (!m) problems.push(`alias '${alias}' is no longer in SetPieceKit.WORLD_THEMES`);
    else if (m[1] !== CONST_OF[canon])
      problems.push(`alias '${alias}' now resolves to ${m[1]}, not ${CONST_OF[canon]} (canonical '${canon}')`);
  }

  // 3. Every theme must own at least one ride and one stall, or the axis-16
  //    own-content term would be structurally impossible for it.
  for (const t of THEME_IDS) {
    const c = THEME_CONTENT[t];
    if (!c.rides.length) problems.push(`theme '${t}' owns no rides — axis 16 own-content would be unearnable`);
    if (!c.stalls.length) problems.push(`theme '${t}' owns no stall`);
  }

  // 4. Every kind we bucketed as a ride/stall must actually be in the table.
  for (const k of [...RIDE_KINDS, ...STALL_KINDS])
    if (!COMPONENT_THEME[k]) problems.push(`'${k}' is bucketed as themed content but COMPONENT_THEME no longer lists it`);

  return { ok: problems.length === 0, problems };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const v = verifyAgainstSource();
  console.log(`THEME ABSTRACTION — ${THEME_IDS.length} presets + the Original ('${ORIGINAL_THEME_ID}') dress\n`);
  for (const t of THEME_IDS) {
    const c = THEME_CONTENT[t];
    const alias = Object.entries(THEME_ALIASES).find(([, v2]) => v2 === t)?.[0];
    console.log(`${t}  (alias '${alias}')  — ${THEME_TITLES[t]}`);
    console.log(`   rides   ${c.rides.join(', ') || '—'}`);
    console.log(`   stalls  ${c.stalls.join(', ') || '—'}`);
    console.log(`   scenery ${c.scenery.join(', ') || '—'}\n`);
  }
  console.log(v.ok ? 'MIRROR OK — agrees with the design system source' : `MIRROR DRIFT:\n  ${v.problems.join('\n  ')}`);
  process.exit(v.ok ? 0 : 1);
}
