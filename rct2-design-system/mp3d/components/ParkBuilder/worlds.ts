// ---------------------------------------------------------------------------
// ParkBuilder/worlds.ts — THE WORLD LAYER's machine-readable half.
//
// `SetPieceKit`'s `WorldTheme` is the DRESS (palette, planting, lamp
// character, ride preset, path surface). This file is the part that has to be
// readable by CODE THAT CANNOT SEE A THEME OBJECT: the acceptance gate, the
// eval harness's probe, and the composition lints. It holds
//
//   1. `COMPONENT_THEME` — the MACHINE-READABLE THEME TAG. Every themed ride /
//      scenery piece / stall in the catalog maps to the WORLD it
//      belongs to, by component displayName. Anything absent from the table is
//      NEUTRAL and may stand anywhere (benches, bins, generic trees, paths,
//      the plaza/bazaar/boulevard set-pieces, every stock flat ride).
//   2. `WorldRegionRec` — a DECLARED world: a rect of land dressed for exactly
//      one theme, registered with `<Park>` by `<World plan={…}>`.
//   3. `auditWorldThemes` — the POSITIONAL COHERENCE AUDIT. Sweeps a park's
//      scene for tagged components (and, since wave 16B, for any group holding a
//      REGISTERED RIDE HANDLE — an untagged ride used to be dropped outright,
//      which made a world with a ride in it report `rideCount: 0`), resolves
//      which declared world each one
//      stands in, and reports every themed piece sitting inside a world of a
//      DIFFERENT theme (the "lava rock in the disco" defect) plus the per-world
//      build-out counts. `validatePark` raises its findings as warnings and the
//      eval probe publishes them as `probe.worlds`.
//
// Why this lives in ParkBuilder and not in SetPieceKit: SetPieceKit imports
// `../Park`, and both `Park/parkRoot` (which runs the audit) and
// `ParkBuilder/validate` (which reports it) import `../ParkBuilder`. Keeping
// the registry + audit here is the only placement with NO import cycle. It is
// also why the registry is keyed by a STRING theme id rather than by a
// `WorldTheme`: the ids are `SetPieceKit`'s `WORLD_THEMES` keys, and nothing
// here needs the palette.
//
// Deterministic and pure — no THREE geometry is built, nothing is mutated.
// ---------------------------------------------------------------------------

import * as THREE from 'three';

/** a shipped WORLD PRESET's id — the keys of `SetPieceKit`'s `WORLD_THEMES` */
// CANONICAL generic ids + the five legacy place names, which still resolve
// (SetPieceKit WORLD_THEMES documents why the rename happened)
export type WorldThemeId =
  | 'default'
  | 'fire'
  | 'steampunk'
  | 'pirateBeach'
  | 'enchantedForest'
  | 'neon'
  | 'emberfall'
  | 'tidewater'
  | 'brasswork'
  | 'thornwick'
  | 'pulse';

/**
 * The five PRESET WORLDS a park composes from (`'default'` is the classic
 * un-themed dress, not a world — a park cannot satisfy the "≥ 3 worlds" rule
 * with it). Keep in sync with `SetPieceKit.WORLD_THEMES`; `worldPresetIds()`
 * in SetPieceKit asserts the two agree.
 */
export const WORLD_PRESET_IDS: WorldThemeId[] = ['fire', 'pirateBeach', 'steampunk', 'enchantedForest', 'neon'];

// `WORLD_LAND_COMPONENT` (theme id → the one-call land MACRO that built the
// whole world: `<EmberfallCaldera>`, `<TidewaterHollow>`, `<BrassworkFoundry>`,
// `<ThornwickGlade>`, `<PulseDistrict>`) WAS HERE AND IS GONE. Those five
// components were removed from the design system in v6.0, so every value in
// that table named a component that can no longer be imported, and nothing
// consumed it but its own re-export.
//
// THE PRESETS THEMSELVES ARE UNAFFECTED and all five worlds are still fully
// buildable — the macros were a CONVENIENCE, not the world layer. A world is
// still `worldPlan({ theme, pieces })` + `<World>` from SetPieceKit, filled by
// hand from the surviving themed catalog: each preset keeps its own rides, its
// own stall and its own five-piece scenery set (see `componentsOfWorld(id)`
// below, and `rules/park-generation-composition.md` §3.1 for the worked park).

/**
 * THE MACHINE-READABLE THEME TAG: catalog component displayName → the WORLD it
 * belongs to. Every entry is a piece whose *subject matter* is one world's —
 * a lava fissure, a coral cluster, a mirror-ball pylon. Placed in another
 * world it is a theme break, and `auditWorldThemes` says so by position.
 *
 * **WHAT IS DELIBERATELY ABSENT IS AS IMPORTANT AS WHAT IS HERE.** A piece is
 * NEUTRAL — legal in every world and in the un-themed hub — unless it appears
 * below. Neutral by design:
 *
 *   * infrastructure: `Paths`/`Gate`/`Fence`/`Road`, benches + bins (`Kit`),
 *     `NormalPath`/`QueuePath`/`DirtPath`, `Restroom`;
 *   * the generic set-pieces `FountainPlaza` / `Bazaar` / `Boulevard` — they
 *     are STRUCTURE and take whatever `theme` the world hands them, so they
 *     are classified by their PLAN's theme id (see `dsWorldTheme` below), not
 *     by this table;
 *   * generic planting and scenery: `OakTree`, `Kit.tree`, `RockCluster`,
 *     `SceneryPack` pieces, `Torch`, `StringLights`, `Fountain`;
 *   * every stock RCT2 flat ride and coaster (`Carousel`, `FerrisWheel`,
 *     `DropTower`, `Coaster`, `LogFlume`, `Monorail`, …) — an RCT2 park puts a
 *     carousel in any land, and colouring it is what `theme.ridePreset` is for;
 *   * `DanceFloor`, `NeonSign`, `BalloonStand` — these predate the Pulse
 *     District and `rules/park-generation-composition.md` §3 uses the dance
 *     terrace and the neon marquee as generic BOARDWALK flavour. Tagging them
 *     `pulse` would make the rulebook's own advice a theme break;
 *   * (`MagneticRide` USED TO BE LISTED HERE as "neutral until a world claims
 *     it". `neon` claimed it on 2026-07-28 — a maglev is a nightclub-street
 *     ride, and it was the third ride `neon` needed to own a full roster.)
 *
 * **THE FIVE LAND MACROS ARE NO LONGER KEYS HERE.** `EmberfallCaldera`,
 * `TidewaterHollow`, `BrassworkFoundry`, `ThornwickGlade` and `PulseDistrict`
 * were removed from the design system in v6.0. A key in this table is only ever
 * reached through a `dsComponent` tag that some mounted component actually
 * stamps, so those five could never match again — they were dead entries that
 * made `componentsOfWorld()` advertise an unbuildable piece in every
 * `crossTheme` message. Each world's REAL content (its rides, its stall, its
 * five scenery pieces) is untouched and is what fills a world now.
 */
export const COMPONENT_THEME: Record<string, WorldThemeId> = {
  // ---- EMBERFALL CALDERA (volcanic) ----
  MagmaRun: 'fire',
  EmberWings: 'fire',
  EmberWingsHanger: 'fire',
  LavaTubeRun: 'fire',
  Volcano: 'fire',
  EmberRoast: 'fire',
  Fumarole: 'fire',
  ObsidianShards: 'fire',
  BasaltColumns: 'fire',
  LavaFissure: 'fire',
  CharredSnag: 'fire',
  // ---- TIDEWATER HOLLOW (shipwreck cove) ----
  ReefRacer: 'pirateBeach',
  DeepDrift: 'pirateBeach',
  OceanTunnelSlide: 'pirateBeach',
  SushiStall: 'pirateBeach',
  WreckedHull: 'pirateBeach',
  CoralCluster: 'pirateBeach',
  AnchorPile: 'pirateBeach',
  TidePool: 'pirateBeach',
  DockPilings: 'pirateBeach',
  // ---- BRASSWORK FOUNDRY (steampunk) ----
  GearworksExpress: 'steampunk',
  AetherBalloons: 'steampunk',
  BoilerBurst: 'steampunk',
  GoggleWorks: 'steampunk',
  GiantGear: 'steampunk',
  SteamPipes: 'steampunk',
  ClockTower: 'steampunk',
  BoilerTank: 'steampunk',
  CoalCart: 'steampunk',
  // ---- THORNWICK GLADE (enchanted forest) ----
  // Chairlift CLAIMED FOR ENCHANTEDFOREST 2026-07-28 — a canopy ride over the
  // glade. This world owned only TWO rides (`MagicMirror` is a walk-on WATCH
  // ZONE, not a registered ride: MagicMirror/index.tsx registers a watch zone,
  // never registerRide), so a park could not mount all of its theme's rides.
  // Blast radius measured first: 4 of 30 corpus parks.
  Chairlift: 'enchantedForest',
  WyrmsHollow: 'enchantedForest',
  MoonlitBarge: 'enchantedForest',
  MagicMirror: 'enchantedForest',
  Honeywitch: 'enchantedForest',
  GiantToadstools: 'enchantedForest',
  StandingStones: 'enchantedForest',
  LanternTree: 'enchantedForest',
  RuinedArch: 'enchantedForest',
  FlowerPodBed: 'enchantedForest',
  // ---- PULSE DISTRICT (disco nightclub street) ----
  // MagneticRide CLAIMED FOR NEON 2026-07-28. The note below used to say it
  // "stays neutral until a world claims it" — a sleek maglev is a neon-district
  // ride, and `neon` owned only TWO rides, so a park could never mount all of
  // its theme's rides. Blast radius measured first: 1 of 30 corpus parks.
  MagneticRide: 'neon',
  Bassline: 'neon',
  Discotron: 'neon',
  BigPiano: 'neon',
  NeonSlush: 'neon',
  NeonArch: 'neon',
  SpeakerStack: 'neon',
  MirrorBallPylon: 'neon',
  LaserTruss: 'neon',
  LightTiles: 'neon',
};

/** the world a catalog component belongs to, or `null` when it is NEUTRAL
 *  (legal anywhere — see the table's own doc comment) */
export const themeOfComponent = (kind?: string | null): WorldThemeId | null =>
  (kind && COMPONENT_THEME[kind]) || null;

/** is this component legal in every world? (the complement of the table) */
export const isNeutralComponent = (kind?: string | null): boolean => themeOfComponent(kind) === null;

/** every themed component of one world, sorted (docs + the composition lints) */
export const componentsOfWorld = (themeId: string): string[] =>
  Object.keys(COMPONENT_THEME)
    .filter((k) => COMPONENT_THEME[k] === themeId)
    .sort();

// ---------------------------------------------------------------------------
// a DECLARED WORLD
// ---------------------------------------------------------------------------

/**
 * A WORLD REGION as `<Park>` sees it: an axis-aligned rect of land dressed for
 * exactly one theme. `<World plan={W} />` registers one (from
 * `SetPieceKit.worldPlan`), and it is what every positional check measures
 * against — a themed piece's coordinates are compared with these rects, never
 * with another piece's.
 *
 * The rect is AXIS-ALIGNED on purpose. A world is a REGION OF THE PLOT, not a
 * mounted object: its member set-pieces carry their own rotated OBBs for the
 * footprint sweep, while "is this ride inside the caldera" wants the simple,
 * order-independent answer.
 */
export interface WorldRegionRec {
  /** the world's own id (`'ember'`) — unique per park */
  id: string;
  /** the THEME id (`'fire'`) — a `WORLD_THEMES` key */
  themeId: string;
  title: string;
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  /** the ids of the set-pieces this world is composed of (the five prefab land
   *  macros were REMOVED in v6.0 and can never appear here) */
  pieceIds: string[];
}

/** is `[x, z]` inside this world (optionally with a tolerance ring)? */
export const worldContains = (w: WorldRegionRec, x: number, z: number, margin = 0): boolean =>
  Math.abs(x - w.cx) <= w.hx + margin && Math.abs(z - w.cz) <= w.hz + margin;

/**
 * Which declared world does `[x, z]` stand in? The SMALLEST containing region
 * wins, so a world nested inside a bigger themed precinct resolves to the
 * inner one (and a piece on the boundary of two abutting worlds resolves to
 * the tighter fit rather than to whichever was declared first).
 */
export function worldAt(worlds: WorldRegionRec[], x: number, z: number, margin = 0): WorldRegionRec | null {
  let best: WorldRegionRec | null = null;
  let bestArea = Infinity;
  for (const w of worlds) {
    if (!worldContains(w, x, z, margin)) continue;
    const a = w.hx * w.hz;
    if (a < bestArea) {
      bestArea = a;
      best = w;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// the POSITIONAL COHERENCE AUDIT
// ---------------------------------------------------------------------------

/** the kind an audited group gets when it is recognisably a design-system piece
 *  (it carries `dsClass`) but names neither a component nor a registered ride.
 *  Such a group is REPORTED (`WorldAudit.untagged`), never silently dropped —
 *  a piece the audit cannot identify is a hole in the audit, not a non-piece. */
export const UNIDENTIFIED_KIND = '(untagged)';

/** one tagged component the audit found in the scene */
export interface ThemedPieceRec {
  /** catalog component displayName (`'LavaFissure'`), a set-piece plan kind, or
   *  — when the group carries no component tag — the REGISTERED RIDE NAME it
   *  was identified by (see `untagged`) */
  kind: string;
  /** 'ride' | 'stall' | 'scenery' | 'setPiece' */
  cls: string;
  /** the world this PIECE belongs to (`COMPONENT_THEME`, or a set-piece plan's
   *  own `theme.id`) — never `'default'`, which is treated as neutral */
  themeId: string | null;
  at: [number, number];
  /** the declared world it STANDS IN (id), or null when it is in no world */
  world: string | null;
  /** that world's theme id */
  worldTheme: string | null;
  /** set when the group carried NO `dsComponent` and was identified by its
   *  registered ride name (or not at all — `kind: UNIDENTIFIED_KIND`). Such a
   *  piece is counted for build-out but can never resolve a THEME, because a
   *  ride NAME is an author's word, not a catalog key. */
  untagged?: true;
}

/** a themed piece standing inside a world of a different theme */
export interface CrossThemeFinding {
  piece: string;
  cls: string;
  pieceTheme: string;
  at: [number, number];
  world: string;
  worldTheme: string;
  detail: string;
}

/** per-world build-out — is this world a real district or an empty rect? */
export interface WorldBuildOut extends WorldRegionRec {
  area: number;
  rideCount: number;
  rideKinds: string[];
  stallCount: number;
  sceneryCount: number;
  setPieceCount: number;
  themedPieceCount: number;
  foreignPieceCount: number;
  /** of this world's OWN theme, split by class (2026-07-28). `themedPieceCount`
   *  lumps them together, which cannot distinguish a land with its own two
   *  coasters from a land with ten of its own shrubs and a stock Carousel. */
  themedRideCount: number;
  themedRideKinds: string[];
  themedStallCount: number;
  themedSceneryCount: number;
  /** ≥ 1 ride AND ≥ 1 stall AND ≥ 1 scenery/set-piece — a self-contained
   *  district rather than a declared rect with one ride dropped in it.
   *  DELIBERATELY THEME-BLIND: this is the gate's `worldNotBuiltOut` test and
   *  every corpus park was scored against it. The themed floor is reported
   *  separately as `underThemed`. */
  built: boolean;
  /** the THEMED-CONTENT floor: 2 of its own rides + its own stall + ≥ 10 of its
   *  own scenery placements. NON-FATAL — a shortfall is a warning, never a
   *  failure, because tightening `built` would move a settled yardstick. */
  underThemed: string[];
  /**
   * REGISTERED pieces that stand in NO declared world but fall just outside
   * THIS one (wave-11 P1). Round 10 bounded its Pulse world at x ≤ 15.6 while
   * its three rides sat at x = 18.0, and `worldNotBuiltOut` only said the
   * world was not built out — never that the rides were 2.4 u over the line.
   * `need` is the extra `margin` (u) that would have taken this piece in.
   */
  nearMisses: { kind: string; cls: string; at: [number, number]; need: number }[];
  /** the extra `worldPlan({ margin })` that would absorb every near miss */
  marginNeeded: number | null;
}

export interface WorldAudit {
  /** how many `<World>` regions were registered */
  declared: number;
  /** the distinct PRESET theme ids in use (excludes `'default'`) */
  presets: string[];
  presetCount: number;
  /** presets the catalog ships that this park did not use */
  unusedPresets: string[];
  worlds: WorldBuildOut[];
  /** every piece the sweep classified — tagged components plus the registered
   *  rides it had to identify by name (see `untagged`) */
  pieces: ThemedPieceRec[];
  /** THE COHERENCE DEFECT: themed pieces inside a foreign world */
  crossTheme: CrossThemeFinding[];
  crossThemeCount: number;
  /** themed pieces standing in NO declared world (advisory, not a defect —
   *  a world's rides legitimately spill past the region an author drew) */
  unplacedThemed: ThemedPieceRec[];
  /**
   * Pieces the sweep found WITHOUT a `dsComponent` tag — identified by their
   * registered ride name, or (`kind: UNIDENTIFIED_KIND`) not identified at all.
   * They are counted for build-out and listed HERE so a tagging hole is
   * VISIBLE: before wave 16B such a group was dropped by `return`, which is how
   * a world holding a real ride reported `rideCount: 0`.
   */
  untagged: ThemedPieceRec[];
  untaggedCount: number;
  /** how many tagged pieces were NEUTRAL (allowed everywhere) */
  neutralCount: number;
  /** world-centre separations (the district test) */
  separation: {
    pairs: { a: string; b: string; centre: number; gap: number }[];
    maxCentre: number | null;
    minCentre: number | null;
    minGap: number | null;
  };
}

/** the design-system userData keys the audit reads (also the names the eval
 *  harness's probe looks for — one vocabulary, two consumers) */
export interface DsTag {
  /** catalog component displayName, set by `composable`/`composableRide`/
   *  `composableStall`/`setPiece` */
  dsComponent?: string;
  /** 'ride' | 'stall' | 'scenery' | 'setPiece' */
  dsClass?: string;
  /** an EXPLICIT theme id — set by `setPiece()` from `plan.theme.id`, so a
   *  generic `<Bazaar theme={PULSE_DISTRICT}>` is classified by the dress it
   *  actually wears rather than by its (neutral) component name */
  dsWorldTheme?: string;
  /** an EXPLICIT `[x, z]` that overrides the group's world transform. Set by
   *  `setPiece()`, whose build runs in WORLD coordinates with the group mounted
   *  at the ORIGIN — without it every set-piece resolves to the cell [0, 0]. */
  dsAt?: [number, number];
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Sweep a composed park for tagged components, resolve each one against the
 * DECLARED worlds and report theme coherence + per-world build-out.
 *
 * The rule it enforces, and nothing more: **a THEMED piece may not stand
 * inside a world of a different theme.** Neutral pieces (everything absent
 * from `COMPONENT_THEME`, plus anything dressed for `DEFAULT_THEME`) are legal
 * everywhere; a themed piece OUTSIDE every declared world is reported as
 * `unplacedThemed` and is not a defect (a caldera's flume circuit legitimately
 * sprawls past the rect an author drew around the land).
 *
 * With no worlds declared the audit returns zeroes and finds nothing — every
 * park that predates the world layer is untouched by it.
 */
export function auditWorldThemes(root: THREE.Object3D | null, worlds: WorldRegionRec[]): WorldAudit {
  const pieces: ThemedPieceRec[] = [];
  const crossTheme: CrossThemeFinding[] = [];
  const unplacedThemed: ThemedPieceRec[] = [];
  const untagged: ThemedPieceRec[] = [];
  let neutralCount = 0;

  const counts = new Map<string, { rides: Set<string>; stalls: number; scenery: number; setPieces: number;
    themed: number; foreign: number; themedRides: Set<string>; themedStalls: number; themedScenery: number }>();
  worlds.forEach((w) => counts.set(w.id, { rides: new Set(), stalls: 0, scenery: 0, setPieces: 0,
    themed: 0, foreign: 0, themedRides: new Set(), themedStalls: 0, themedScenery: 0 }));

  if (root) {
    root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    root.traverse((o) => {
      const ud = (o.userData ?? {}) as DsTag & { rideRef?: { name?: string; boardPoint?: () => [number, number, number] } };
      // ---- WHAT COUNTS AS A DESIGN-SYSTEM PIECE (fixed wave 16B) -----------
      // This used to be `const kind = ud.dsComponent; if (!kind) return;` — "no
      // catalog tag, no piece". But `dsComponent` is stamped by the FACTORIES
      // (`composable`/`composableRide`/`composableStall`/`setPiece`), and a ride
      // component that rendered `<ConfigurableRide>` directly had none, so the
      // audit DROPPED a fully registered ride and its world reported
      // `rideCount: 0`. Measured on wave 16B: Thornwood Twist stood at
      // [55.66, −19.2], inside thornwick's rect x[40.8, 64.8] × z[−25.2, −4.8],
      // and the park was still told the world was not built out
      // (`worldNotBuiltOut`, axis 16 buildOut 0.67/1). Skyward Wheel was missing
      // from brasswork's `rideKinds` the same way.
      //
      // The chassis now tags itself (`Park/configurableRide.tsx`), and THIS is
      // the backstop for everything that registers a ride WITHOUT going through
      // either factory or the chassis — `<Coaster>` and `<FlatRide>`, which set
      // `userData.rideRef` and nothing else. A group holding a ride handle IS a
      // ride, and the handle NAMES it. Falling back beats returning: an
      // unidentified piece is a hole in the audit, so it is reported
      // (`untagged`) rather than deleted from the measurement.
      const rideRef = ud.rideRef;
      const kind = ud.dsComponent || rideRef?.name || (ud.dsClass ? UNIDENTIFIED_KIND : null);
      if (!kind) return; // an ordinary mesh — nearly the whole scene graph
      const isUntagged = !ud.dsComponent;
      const cls = ud.dsClass ?? (rideRef ? 'ride' : 'scenery');
      // an EXPLICIT plan theme wins over the component table: a structural
      // set-piece is whatever world it was dressed for. An UNTAGGED piece is
      // identified by a ride NAME (an author's words), which is never a
      // COMPONENT_THEME key — so it stays NEUTRAL and can never invent a
      // cross-theme finding out of a name that happens to read like one.
      const explicit = ud.dsWorldTheme && ud.dsWorldTheme !== 'default' ? ud.dsWorldTheme : null;
      const themeId = explicit ?? (isUntagged ? null : themeOfComponent(kind));
      // an EXPLICIT `dsAt` wins: a set-piece's group mounts at the origin
      let at: [number, number] | null = null;
      if (Array.isArray(ud.dsAt) && ud.dsAt.length === 2) at = [r2(ud.dsAt[0]), r2(ud.dsAt[1])];
      // …and an untagged RIDE is located by its STATION, not by its group. A
      // `<Coaster>` compiles its circuit in PARK coordinates and mounts the
      // group at the ORIGIN, so `getWorldPosition` reads [0, 0] for a circuit
      // standing 40 u away — the same defect `dsAt` exists to fix for
      // set-pieces, and `boardPoint()` is the handle's answer to it.
      if (!at && isUntagged && cls === 'ride' && typeof rideRef?.boardPoint === 'function')
        try {
          const b = rideRef.boardPoint();
          if (Array.isArray(b) && b.length === 3) at = [r2(b[0]), r2(b[2])];
        } catch {
          /* a handle without a usable boardPoint — fall through to the group */
        }
      if (!at) {
        o.getWorldPosition(v);
        at = [r2(v.x), r2(v.z)];
      }
      const w = worldAt(worlds, at[0], at[1]);
      const rec: ThemedPieceRec = {
        kind,
        cls,
        themeId,
        at,
        world: w ? w.id : null,
        worldTheme: w ? w.themeId : null,
        ...(isUntagged ? { untagged: true as const } : {}),
      };
      pieces.push(rec);
      if (isUntagged) untagged.push(rec);
      if (!themeId) neutralCount += 1;
      // per-world build-out
      if (w) {
        const c = counts.get(w.id)!;
        if (cls === 'ride') c.rides.add(ud.rideRef?.name ?? kind);
        else if (cls === 'stall') c.stalls += 1;
        else if (cls === 'setPiece') c.setPieces += 1;
        else c.scenery += 1;
        if (themeId) {
          if (themeId === w.themeId) {
            c.themed += 1;
            // SPLIT BY CLASS (2026-07-28) — `themed` alone cannot tell "a land with
            // its own two coasters" from "a land with ten of its own shrubs and a
            // stock Carousel", and that is exactly the distinction the themed-world
            // floor is about. See `worldUnderThemed` below.
            if (cls === 'ride') c.themedRides.add(ud.rideRef?.name ?? kind);
            else if (cls === 'stall') c.themedStalls += 1;
            else c.themedScenery += 1;
          } else c.foreign += 1;
        }
      }
      // THE COHERENCE RULE
      if (themeId && w && themeId !== w.themeId) {
        crossTheme.push({
          piece: kind,
          cls,
          pieceTheme: themeId,
          at,
          world: w.id,
          worldTheme: w.themeId,
          detail:
            `<${kind}> is a ${themeId.toUpperCase()} piece but stands at [${at[0]}, ${at[1]}], inside the ` +
            `${w.themeId.toUpperCase()} world "${w.id}" (${w.title}) — a themed piece belongs to its OWN world. ` +
            `Move it into a ${themeId} world, or dress this spot with one of ${w.themeId}'s own pieces ` +
            `(${componentsOfWorld(w.themeId).slice(0, 5).join(', ') || 'see COMPONENT_THEME'}) or a NEUTRAL piece ` +
            `(benches, bins, generic trees, the plaza/bazaar/boulevard set-pieces, stock flat rides)`,
        });
      } else if (themeId && !w) unplacedThemed.push(rec);
    });
  }

  // wave-11 P1: a piece in NO world that only just missed THIS one. Reported
  // so `worldNotBuiltOut` can NAME the rides that fell outside and the extra
  // margin that would take them in, instead of only saying the world is empty.
  const NEAR_SLACK = 14;
  const nearMissesOf = (w: WorldRegionRec) =>
    pieces
      .filter((p) => p.world === null && (p.cls === 'ride' || p.cls === 'stall'))
      .map((p) => {
        const need = r2(Math.max(Math.abs(p.at[0] - w.cx) - w.hx, Math.abs(p.at[1] - w.cz) - w.hz));
        return { kind: p.kind, cls: p.cls, at: p.at, need };
      })
      .filter((m) => m.need > 0 && m.need <= NEAR_SLACK)
      .sort((a, b) => a.need - b.need);

  /**
   * WHAT EACH WORLD OWES, by name where a count will not do.
   *
   * `fire` takes `EmberWings` and the lava flume `MagmaRun` and stops there —
   * `LavaTubeRun`, the lava tunnel COASTER, is optional, because three tracked
   * rides in one caldera is one too many and two of the three were coasters.
   * `enchantedForest` owes `WyrmsHollow` BY NAME — the glade is not the glade
   * without the wyrm, and it was the ride parks dropped when they mounted two of
   * its three. Everyone else owes all three of their own.
   *
   * Mirrors `harness/park-eval/themes.mjs`'s WORLD_REQUIREMENT; the two are
   * checked against each other by that file's `verifyAgainstSource()`.
   */
  const DEFAULT_WORLD_REQUIREMENT = { min: 3, must: [] as string[] };
  const WORLD_REQUIREMENT: Record<string, { min: number; must: string[] }> = {
    // both spellings, because a world may be declared with either
    fire: { min: 2, must: ['EmberWings', 'MagmaRun'] },
    emberfall: { min: 2, must: ['EmberWings', 'MagmaRun'] },
    pirateBeach: DEFAULT_WORLD_REQUIREMENT,
    tidewater: DEFAULT_WORLD_REQUIREMENT,
    steampunk: DEFAULT_WORLD_REQUIREMENT,
    brasswork: DEFAULT_WORLD_REQUIREMENT,
    enchantedForest: { min: 3, must: ['WyrmsHollow'] },
    thornwick: { min: 3, must: ['WyrmsHollow'] },
    neon: DEFAULT_WORLD_REQUIREMENT,
    pulse: DEFAULT_WORLD_REQUIREMENT,
  };

  /**
   * THE THEMED-CONTENT FLOOR (2026-07-28). `built` asks "is there a ride, a
   * stall and a prop in this rect?" and is theme-blind, so three worlds could
   * pass it while being one park three times in different shrubbery — measured:
   * a park declared three themed worlds and shipped ZERO themed rides and ZERO
   * themed scenery, its own header noting "all scatter is NEUTRAL".
   *
   * This reports the gap instead. NON-FATAL by design: `built` is what the gate
   * and every scored corpus park were measured against, and tightening it here
   * would silently re-score all of them.
   */
  function themedShortfall(
    w: WorldRegionRec,
    c: { themedRides: Set<string>; themedStalls: number; themedScenery: number },
  ): string[] {
    if (!w.themeId || w.themeId === 'default') return []; // the Original dress owns nothing
    const gaps: string[] = [];
    const own = componentsOfWorld(w.themeId);
    const req = WORLD_REQUIREMENT[w.themeId] ?? DEFAULT_WORLD_REQUIREMENT;
    for (const k of req.must)
      if (!c.themedRides.has(k)) gaps.push(`<${k}> is REQUIRED in this world and is not mounted`);
    if (c.themedRides.size < req.min)
      gaps.push(
        `${c.themedRides.size} of ${req.min} rides of its own theme` +
          (own.length ? ` (pick from ${own.slice(0, 6).join(', ')})` : '') +
          (c.themedRides.size === 1 ? ' — and two rides sharing a register.name count as ONE' : ''),
      );
    if (c.themedStalls < 1) gaps.push('no stall of its own theme (bazaarPlan stocks it for free)');
    if (c.themedScenery < 25)
      gaps.push(
        `${c.themedScenery} of 25 scenery placements of its own theme — REPEAT the pack's pieces ` +
          'with different seed/rotation; instances count, distinct kinds are not required',
      );
    return gaps;
  }

  const built: WorldBuildOut[] = worlds.map((w) => {
    const c = counts.get(w.id)!;
    const nearMisses = nearMissesOf(w);
    return {
      ...w,
      nearMisses,
      marginNeeded: nearMisses.length ? Math.max(...nearMisses.map((m) => m.need)) : null,
      area: r2(4 * w.hx * w.hz),
      rideCount: c.rides.size,
      rideKinds: [...c.rides].sort(),
      stallCount: c.stalls,
      sceneryCount: c.scenery,
      setPieceCount: c.setPieces,
      themedPieceCount: c.themed,
      foreignPieceCount: c.foreign,
      themedRideCount: c.themedRides.size,
      themedRideKinds: [...c.themedRides].sort(),
      themedStallCount: c.themedStalls,
      themedSceneryCount: c.themedScenery,
      underThemed: themedShortfall(w, c),
      // `built` is DELIBERATELY UNCHANGED and theme-blind. It is the gate's own
      // `worldNotBuiltOut` test and every scored park in the corpus was measured
      // against it; tightening it here would silently move the yardstick under
      // all of them. The themed-content FLOOR is reported separately, as the
      // non-fatal `worldUnderThemed` finding below.
      built: c.rides.size >= 1 && c.stalls >= 1 && c.scenery + c.setPieces >= 1,
    };
  });

  const pairs: { a: string; b: string; centre: number; gap: number }[] = [];
  for (let i = 0; i < worlds.length; i += 1)
    for (let j = i + 1; j < worlds.length; j += 1) {
      const A = worlds[i];
      const B = worlds[j];
      const centre = Math.hypot(A.cx - B.cx, A.cz - B.cz);
      const gx = Math.max(0, Math.abs(A.cx - B.cx) - A.hx - B.hx);
      const gz = Math.max(0, Math.abs(A.cz - B.cz) - A.hz - B.hz);
      pairs.push({ a: A.id, b: B.id, centre: r2(centre), gap: r2(Math.hypot(gx, gz)) });
    }
  pairs.sort((p, q) => p.centre - q.centre);

  const presets = [...new Set(worlds.map((w) => w.themeId).filter((t) => t && t !== 'default'))].sort();
  return {
    declared: worlds.length,
    presets,
    presetCount: presets.length,
    unusedPresets: WORLD_PRESET_IDS.filter((p) => !presets.includes(p)),
    worlds: built,
    pieces,
    crossTheme,
    crossThemeCount: crossTheme.length,
    unplacedThemed,
    untagged,
    untaggedCount: untagged.length,
    neutralCount,
    separation: {
      pairs,
      maxCentre: pairs.length ? pairs[pairs.length - 1].centre : null,
      minCentre: pairs.length ? pairs[0].centre : null,
      minGap: pairs.length ? Math.min(...pairs.map((p) => p.gap)) : null,
    },
  };
}
