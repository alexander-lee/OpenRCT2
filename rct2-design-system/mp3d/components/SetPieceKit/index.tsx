import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf, mergedBoxes } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { reportPlanLint, TILE, worldContains } from '../ParkBuilder';
import type { ParkFootRect, WorldRegionRec } from '../ParkBuilder';
import { useComposable, usePark, tagComponent } from '../Park';
import type { ComposableBuilt, ParkContextValue } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { hash01 } from '../PathNetwork/core';
// the surface PRESETS come from the LEAF module, never from '../PathNetwork':
// WORLD_THEMES below evaluates them at MODULE SCOPE, and
// SetPieceKit -> PathNetwork -> Park -> SetPieceKit is a real import cycle, so
// importing the barrel here can leave a preset `void 0` when a theme is built.
// ../PathNetwork/surfaces has no imports and therefore cannot be in a cycle.
import {
  SURFACE_TARMAC,
  SURFACE_BASALT,
  SURFACE_BOARDWALK,
  SURFACE_IRONPLATE,
  SURFACE_MOSSFLAG,
  SURFACE_NIGHTGLASS,
} from '../PathNetwork/surfaces';
import { DEFAULT_FURNITURE as DEF_FURN } from '../PathNetwork/surfaces';
import type { PathFurniture } from '../PathNetwork/surfaces';
import type { PathSurface } from '../PathNetwork/surfaces';
import { buildStringLights } from '../StringLights';
import { bench as kitBench, bin as kitBin } from '../Kit';
import type { RidePresetType } from '../ColorKit';

// ---------------------------------------------------------------------------
// SetPieceKit — the PORTS + FOOTPRINT contract every MACRO SET-PIECE speaks.
//
// A set-piece (<FountainPlaza>, <Bazaar>, <Boulevard>, …) is a composite park
// object: several primitives, their interior paths, their stalls and their
// GameManager registrations bundled into ONE correct-by-construction unit.
// The composing agent never hand-computes a set-piece's interior geometry; it
// only wires PORTS.
//
// THE CONTRACT — plan first, mount second:
//
//   1. A PURE PLANNER returns the whole piece as data, BEFORE anything
//      mounts: `fountainPlazaPlan({ id: 'hub', position: [0, 12] })`. The
//      plan carries
//        - `ports`      named connector cells in WORLD coords, already
//                       lattice-snapped, each one lattice cell OUTSIDE the
//                       piece's footprint (so a street/queue lane can meet it
//                       without ever overlapping the piece),
//        - `nodes`/`edges`  the piece's INTERIOR path sub-net in world coords
//                       (cardinal, on the 1.2 lattice) — it becomes part of
//                       the park's ONE shared graph, so guests really walk it
//                       and queue tails may land on it,
//        - `plazas`/`bins`  the paving rects and bin spots <Paths> renders,
//        - `cells`      every cell the piece paves or places on (<Terrain
//                       keepDry>),
//        - `footprint`  ONE OBB (ParkFootRect) covering the whole piece, for
//                       validatePark's footprint sweep + the coaster-corridor
//                       SAT sweep.
//      Because the plan exists before mount, the agent can lay the street
//      skeleton, the keepDry list and the ride queue tails AROUND the piece —
//      the class of defect that used to appear only at settle time.
//
//   2. `buildParkNet({ nodes, edges, pieces })` FUSES the agent's own street
//      nodes with every piece's sub-net into the single `{nodes, edges}`
//      object <Paths> renders and the GameManager routes over. Edges may
//      reference ports BY NAME (`['hub:W', 'ave:A']`), the agent's own node
//      indices are PRESERVED (so `queueTailNode={7}` keeps meaning node 7),
//      long edges are split at any node lying on them (no crossing without a
//      junction), and unconnected port stubs are PRUNED instead of
//      dead-ending in open grass.
//
//   3. The COMPONENT takes the plan and nothing else: `<FountainPlaza
//      plan={HUB} />`. Ports, footprint, keepDry cells, stall anchors and the
//      mounted visual are therefore all derived from the SAME numbers — they
//      cannot disagree.
//
// Everything here is deterministic (hashed sine only — no Math.random /
// Date.now), grounded through `park.floorAt` (plaza level inside a plaza rect,
// terrain outside), and built from catalog builders only.
// ---------------------------------------------------------------------------

export type XZ = [number, number];

/** the RCT2 path lattice cell (1.2) — every port/node coordinate is a multiple */
export const CELL = TILE;

/** snap to the path lattice */
export const snapCell = (v: number, cell = CELL): number => Math.round(v / cell) * cell;
/** snap an `[x, z]` pair to the path lattice */
export const snapXZ = (p: XZ, cell = CELL): XZ => [snapCell(p[0], cell), snapCell(p[1], cell)];

/** quarter turns (0..3) of a yaw — set-piece rotations are always axis-aligned */
export const quarterTurns = (rot: number): number => ((Math.round(rot / (Math.PI / 2)) % 4) + 4) % 4;
/** the quantized yaw a set-piece actually mounts at */
export const quantYaw = (rot: number): number => quarterTurns(rot) * (Math.PI / 2);

// exact quarter-turn cos/sin — keeps rotated lattice coordinates EXACT
const QC = [1, 0, -1, 0];
const QS = [0, 1, 0, -1];

/** rotate a local `[x, z]` by a quarter-turn yaw (three.js Y rotation) */
export function rotateXZ(rot: number, p: XZ): XZ {
  const q = quarterTurns(rot);
  const c = QC[q];
  const s = QS[q];
  return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
}

const key2 = (p: XZ): string => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;

/** deterministic 0..1 from an integer key (hashed sine — the fleet PRNG) */
export const hash01 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// ---- the THEME LAYER — one set-piece, any WORLD ----------------------------
//
// A set-piece describes STRUCTURE (where the paving, the ports, the sub-net,
// the lamp stations and the prop slots are). A `WorldTheme` describes the
// DRESS those slots wear: the palette, which species get planted, what the
// lanterns are (bulb / cold light / flame), which ColorKit preset family the
// rides in that world roll from, and a seed offset so two worlds built from
// the same planner never repeat each other's seeded variation.
//
// The layer is purely ADDITIVE: `theme` is optional everywhere and defaults to
// `DEFAULT_THEME`, whose values ARE the consts that used to be hard-coded in
// SetPieceKit / Bazaar / FountainPlaza / Boulevard — so every existing preview
// and the DistrictPark example are unchanged.
//
// `WorldTheme` ITSELF is DATA ONLY (numbers + names). That is NOT the whole theme
// layer any more — data alone made two themed pieces one object in different
// paint (`probe-setpiece-theme.mjs` hashed the enchantedForest and neon plazas to
// the same geometry print as default). The STRUCTURAL half is `dressOf(theme)` in
// the sibling module `SetPieceKit/dress.ts`: per-world lamp, bench, span, kerb,
// plaza paving, parapet and fountain armature. It returns null for DEFAULT_THEME
// and for any unknown id, and it adds NO plan fields — so a plan's footprint,
// sub-net, keepDry cells, solids, `key` and validatePark verdict are identical
// for every theme, and the un-themed piece runs the code it always ran.

/** every colour a set-piece used to bake in as a module const */
export interface WorldPalette {
  /** paving accent field — the fountain apron rosette (was 0xc6c5bc) */
  pavingLight: number;
  /** paving accent course — inner apron ring + border course (was 0x8a8a83) */
  pavingDark: number;
  /** canopy / awning field — Bazaar's CANOPY_CREAM (was 0xe8dfc8) */
  canopyPrimary: number;
  /** canopy edge courses, hem and scallops — CANOPY_RED (was 0xa8443c) */
  canopySecondary: number;
  /** third pennant colour in a bunting run — BUNT_NAVY (was 0x2f4a6d) */
  bunting: number;
  /** fourth pennant colour — Bazaar's gold (was 0xd8b54a) */
  buntingAccent: number;
  /** cable, rope, wire, cleat — Bazaar's CABLE (was 0x26262c) */
  cable: number;
  /** ironwork: lamp posts, lantern cages, finials — IRON (was 0x2f2f34) */
  iron: number;
  /** lantern glass (was LAMP_GLASS 0xfff2c0) */
  lampGlass: number;
  /** lantern glow + its PointLight colour (was LAMP_GLOW 0xffc85a) */
  lampGlow: number;
  /** festival-span bulb colours. A piece that wants only TWO colours takes
   *  the first and the last, so the default list reproduces both of today's
   *  bulb sets exactly (plaza/bazaar: all three; boulevard: first + last). */
  spanBulbs: number[];
}

/** which catalog species/pieces a world plants in each dressing slot.
 *  Names are `Kit.tree` shapes and `SceneryPack` piece names. */
export interface WorldPlanting {
  /** the world's street trees, weighted — `pickTreeShape` walks the weights
   *  with the SAME hashed-sine roll a piece already used */
  trees: { shape: 'round' | 'pine' | 'palm' | 'willow'; weight: number }[];
  /** the verge planter slot (Boulevard alternates through this list) */
  planters: string[];
  /** flanking prop each side of an OPEN entrance (plaza port cheeks) */
  flanker: string;
  /** the low mass on a CLOSED side (plaza planter course) */
  hedge: string;
  /** the piece that CLOSES a side with no port (plaza's marble statue) */
  monument: string;
  /** entrance markers on a bazaar's two verges */
  markers: [string, string];
}

/** what a lantern IS in this world: a warm bulb, a cold/gas light, or a live
 *  flame. Only the emissive curve + the PointLight change — the lamp geometry
 *  is identical, and night gating stays `nightKOf` exactly as today. */
export type LampCharacter = 'warm' | 'cold' | 'flame';

export interface LampCharacterSpec {
  /** daylight emissive floor */
  base: number;
  /** night emissive gain */
  gain: number;
  /** flicker depth (0 = dead steady) */
  flickerAmp: number;
  /** flicker rate */
  flickerSpeed: number;
  /** PointLight intensity at full night */
  lightGain: number;
  /** PointLight range */
  distance: number;
}

/** `warm` reproduces today's lamp numbers EXACTLY (0.1 + 1.55·ease·flicker,
 *  0.9 intensity, 5.2 range, 3 % flicker at 5.3 rad/s) */
export const LAMP_CHARACTER: Record<LampCharacter, LampCharacterSpec> = {
  warm: { base: 0.1, gain: 1.55, flickerAmp: 0.03, flickerSpeed: 5.3, lightGain: 0.9, distance: 5.2 },
  cold: { base: 0.08, gain: 1.4, flickerAmp: 0.006, flickerSpeed: 1.9, lightGain: 0.85, distance: 5.8 },
  flame: { base: 0.12, gain: 1.85, flickerAmp: 0.17, flickerSpeed: 11.7, lightGain: 1.05, distance: 4.6 },
};

/** a world's furniture tones. The shape and its defaults live in
 *  `PathNetwork/surfaces` (a leaf module) so `PathNetwork/build.ts` can consume
 *  them without importing a value out of this file — see the cycle note there.
 *  `WorldFurniture` is the name themes use for it. */
export type WorldFurniture = PathFurniture;
export { DEFAULT_FURNITURE } from '../PathNetwork/surfaces';

/** a WORLD's dress — hand it to any set-piece planner as `theme` */
/** the themed GROUND a world stands on — see `WorldTheme.ground` */
export interface WorldGroundDress {
  /** the land's base colour under and around the world */
  soil: number;
  /** a second tone, scattered as patches so the floor is never one flat slab */
  patch: number;
  /** the Stage texture key ('grass' | 'sand' | 'concrete' | 'asphalt' | 'wood' | 'metal') */
  tex: string;
  /** 0..1 — how much of the rect the patch tone covers (default 0.35) */
  patchiness?: number;
}

export interface WorldTheme {
  /** stable id (labels + the remount fingerprint) */
  id: string;
  title: string;
  palette: WorldPalette;
  planting: WorldPlanting;
  lamp: LampCharacter;
  /** the ColorKit preset family rides placed in this world roll from
   *  (`rideColourPreset(seed, theme.ridePreset)`) */
  ridePreset: RidePresetType;
  /** added to every piece seed, so the same planner dressed for two worlds
   *  never repeats the same seeded variation */
  seedOffset: number;
  /**
   * What the WALKED STREET through this world is made of — pass it to
   * `<Paths surface={theme.pathSurface}>`.
   *
   * A land already re-skins its own paved court, but before this the streets
   * stayed municipal grey, so a themed world was a costume laid over municipal
   * infrastructure — grey concrete running through a volcanic caldera and a
   * nightclub alike. The surface lives on the theme so a land cannot forget to
   * set one.
   *
   * Pick it against the LAND'S OWN GROUND, not in the abstract: the recurring
   * failure has been a surface landing on the same VALUE as the terrain under
   * it and the court losing its edge (Tidewater's boardwalk), or a pale course
   * reading as municipal concrete in a wood (Thornwick). Both directions are
   * live — a dark-floored world needs the opposite answer to a pale one.
   */
  pathSurface: PathSurface;
  /**
   * THE LAND ITSELF — the themed GROUND this world stands on (2026-07-28).
   *
   * `pathSurface` only re-skins the STREETS. Everything either side of them
   * stayed the climate's default grass, so a volcanic caldera and an enchanted
   * glade were the same green field with different props on it — the single
   * biggest reason three declared worlds still read as one place.
   *
   * `<WorldGround plan={W} />` lays this over the world's rect and settles it
   * onto the terrain, so the land reads as basalt / wet sand / soot / moss /
   * black glass before a single prop is placed.
   */
  ground: WorldGroundDress;
  /**
   * The COMMON FURNITURE this world is dressed with — benches, bins, lamps,
   * fountains, stalls (see WorldFurniture). Optional: omitted falls back to
   * DEFAULT_FURNITURE, which is exactly what every builder baked in before,
   * so an existing theme keeps rendering unchanged until it declares one.
   *
   * This is what a THEME REGION applies automatically (Park's `themeAt`): the
   * roads through it take `pathSurface` and the furniture ON those roads takes
   * these, without the author restating either per call.
   */
  furniture?: WorldFurniture;
}

/**
 * The DEFAULT theme — its values are EXACTLY the consts the pieces used to
 * bake in (`IRON`, `LAMP_GLASS`, `LAMP_GLOW`, `CANOPY_CREAM`, `CANOPY_RED`,
 * `BUNT_NAVY`, `CABLE`, the plaza's two concrete greys, the bulb lists, the
 * topiary/planter/statue/signpost/flagpole species and the boulevard's
 * pine/round/willow weights). Omitting `theme` is therefore a NO-OP.
 */
export const DEFAULT_THEME: WorldTheme = {
  id: 'default',
  title: 'Classic Park',
  palette: {
    pavingLight: 0xc6c5bc,
    pavingDark: 0x8a8a83,
    canopyPrimary: 0xe8dfc8,
    canopySecondary: 0xa8443c,
    bunting: 0x2f4a6d,
    buntingAccent: 0xd8b54a,
    cable: 0x26262c,
    iron: 0x2f2f34,
    lampGlass: 0xfff2c0,
    lampGlow: 0xffc85a,
    spanBulbs: [0xffd9a0, 0xffb46c, 0xfff0c8],
  },
  planting: {
    // the boulevard's historic roll: h < 0.3 pine, h < 0.85 round, else willow
    trees: [
      { shape: 'pine', weight: 0.3 },
      { shape: 'round', weight: 0.55 },
      { shape: 'willow', weight: 0.15 },
    ],
    planters: ['topiarySpiral', 'planterBox'],
    flanker: 'topiarySpiral',
    hedge: 'planterBox',
    monument: 'marbleStatue',
    markers: ['signpost', 'flagpole'],
  },
  lamp: 'warm',
  ridePreset: 'steel',
  seedOffset: 0,
  pathSurface: SURFACE_TARMAC,
  ground: { soil: 0x6f9e54, patch: 0x7fae61, tex: 'grass', patchiness: 0.30 },      // Original: mown park lawn
};

/** EMBERFALL CALDERA — a volcanic land: basalt paving, ember canvas, obsidian
 *  ironwork and LIVE FLAME lanterns; charred pines and lava-field succulents */
export const FIRE: WorldTheme = {
  id: 'fire',
  title: 'Fire',
  palette: {
    pavingLight: 0x6b5f58,
    pavingDark: 0x3a3230,
    canopyPrimary: 0xd87a3c,
    canopySecondary: 0x8f2418,
    bunting: 0x3c2018,
    buntingAccent: 0xf0b23c,
    cable: 0x1c1614,
    iron: 0x241d1b,
    lampGlass: 0xffd08a,
    lampGlow: 0xff6a1e,
    spanBulbs: [0xff8c3c, 0xff4c14, 0xffc06a],
  },
  planting: {
    trees: [
      { shape: 'pine', weight: 0.72 },
      { shape: 'round', weight: 0.28 },
    ],
    planters: ['cactusCluster', 'fallenLog'],
    flanker: 'cactusCluster',
    hedge: 'fallenLog',
    monument: 'lionStatue',
    markers: ['signpost', 'flagpole'],
  },
  lamp: 'flame',
  ridePreset: 'steel',
  seedOffset: 101,
  pathSurface: SURFACE_BASALT,
  ground: { soil: 0x3b332f, patch: 0x5a4a40, tex: 'concrete', patchiness: 0.40 },  // fire: cooled basalt + ash
  // EMBERFALL — scorched cast iron, charred timber, lava-lit lanterns. The
  // fountain runs hot: a copper basin with molten-orange water, which is the
  // one place a caldera should NOT look like a municipal park.
  furniture: {
    benchFrame: 0x2a201c,
    benchSlat: 0x4a2f22,
    binBody: 0x2a201c,
    binLid: 0x6b4128,
    lampPost: 0x241a16,
    lantern: 0xffb15a,
    lanternGlow: 0xa8400c,
    basin: 0x6b4a3a,
    water: 0xd4541c,
    spray: 0xffb27a,
    stallCanopy: 0xa8342a,
    stallTrim: 0xe0902a,
    stallPost: 0x4a2f22,
  },
};

/** TIDEWATER HOLLOW — a shipwreck cove: bleached sand paving, sailcloth and
 *  brine-green canvas, tarred rope, driftwood planting, ship-lantern light */
export const PIRATE_BEACH: WorldTheme = {
  id: 'pirateBeach',
  title: 'Pirate Beach',
  palette: {
    pavingLight: 0xd8cfae,
    pavingDark: 0x8f8460,
    canopyPrimary: 0xe4e0cc,
    canopySecondary: 0x1f6b6a,
    bunting: 0x123c55,
    buntingAccent: 0xc8a04c,
    cable: 0x3b2f22,
    iron: 0x3a4a48,
    lampGlass: 0xfff4d2,
    lampGlow: 0xffb84c,
    spanBulbs: [0xffe0a8, 0x7fd8cc, 0xfff2d8],
  },
  planting: {
    trees: [
      { shape: 'palm', weight: 0.62 },
      { shape: 'willow', weight: 0.38 },
    ],
    planters: ['planterBox', 'fallenLog'],
    flanker: 'planterBox',
    hedge: 'fallenLog',
    monument: 'wishingWell',
    markers: ['signpost', 'flagpole'],
  },
  lamp: 'warm',
  ridePreset: 'water',
  seedOffset: 202,
  pathSurface: SURFACE_BOARDWALK,
  ground: { soil: 0xc9b184, patch: 0xa88f63, tex: 'sand', patchiness: 0.42 },      // pirateBeach: wet tide sand
  // TIDEWATER — salt-bleached driftwood and verdigris brass, harbour-lamp glass,
  // a pale shell basin with green sea water.
  furniture: {
    benchFrame: 0x4a7068,
    benchSlat: 0xb59a74,
    binBody: 0x4a7068,
    binLid: 0x9a8a6a,
    lampPost: 0x3d5f58,
    lantern: 0xdff2e8,
    lanternGlow: 0x3f8a86,
    basin: 0xc4b8a0,
    water: 0x1f9a90,
    spray: 0xbdeee6,
    stallCanopy: 0xe4ded0,
    stallTrim: 0x2f7a72,
    stallPost: 0xb59a74,
  },
};

/** BRASSWORK FOUNDRY — steampunk: soot-grey flag paving, oiled canvas, brass
 *  and copper trim, gaslight lanterns, clipped municipal planting */
export const STEAMPUNK: WorldTheme = {
  id: 'steampunk',
  title: 'Steampunk',
  palette: {
    pavingLight: 0x8e8880,
    pavingDark: 0x4e4842,
    canopyPrimary: 0xcbb894,
    canopySecondary: 0x7a4a20,
    bunting: 0x2c3038,
    buntingAccent: 0xd8a83c,
    cable: 0x2a2420,
    iron: 0x4a3c2c,
    lampGlass: 0xfff0cc,
    lampGlow: 0xffb050,
    spanBulbs: [0xffd28a, 0xffa73c, 0xffe8c0],
  },
  planting: {
    trees: [
      { shape: 'pine', weight: 0.45 },
      { shape: 'round', weight: 0.55 },
    ],
    planters: ['planterBox', 'picketFence'],
    flanker: 'planterBox',
    hedge: 'brickWall',
    monument: 'parkClock',
    markers: ['signpost', 'flagpole'],
  },
  lamp: 'warm',
  ridePreset: 'steel',
  seedOffset: 303,
  pathSurface: SURFACE_IRONPLATE,
  ground: { soil: 0x584f45, patch: 0x6d6154, tex: 'concrete', patchiness: 0.35 },  // steampunk: soot-stained yard
  // BRASSWORK — riveted iron and polished brass, gaslight, an oiled-copper basin.
  furniture: {
    benchFrame: 0x3a3228,
    benchSlat: 0x6a4a2a,
    binBody: 0x3a3228,
    binLid: 0xa07a34,
    lampPost: 0x2e2820,
    lantern: 0xffe0a0,
    lanternGlow: 0xa8761c,
    basin: 0x8a6a3a,
    water: 0x3a6a72,
    spray: 0xa8ccd2,
    stallCanopy: 0xcbb992,
    stallTrim: 0xa07a34,
    stallPost: 0x6a4a2a,
  },
};

/** THORNWICK GLADE — an enchanted forest: mossy stone, deep-green canvas,
 *  faerie-cold lanterns, willows, toadstools and a birdbath shrine */
export const ENCHANTED_FOREST: WorldTheme = {
  id: 'enchantedForest',
  title: 'Enchanted Forest',
  palette: {
    pavingLight: 0x9aa484,
    pavingDark: 0x5c6a4a,
    canopyPrimary: 0xdfe6c4,
    canopySecondary: 0x2f6a34,
    bunting: 0x4a2f6a,
    buntingAccent: 0xc8d84c,
    cable: 0x2a2a1e,
    iron: 0x33422f,
    lampGlass: 0xe4fff0,
    lampGlow: 0x8cf0c0,
    spanBulbs: [0xa8f0d0, 0xd8f08c, 0xe8fff4],
  },
  planting: {
    trees: [
      { shape: 'willow', weight: 0.5 },
      { shape: 'round', weight: 0.35 },
      { shape: 'pine', weight: 0.15 },
    ],
    planters: ['mushroomCluster', 'topiarySpiral'],
    flanker: 'topiarySpiral',
    hedge: 'mushroomCluster',
    monument: 'birdbath',
    markers: ['signpost', 'flagpole'],
  },
  lamp: 'cold',
  ridePreset: 'wooden',
  seedOffset: 404,
  pathSurface: SURFACE_MOSSFLAG,
  ground: { soil: 0x46613a, patch: 0x2f4a2c, tex: 'grass', patchiness: 0.45 },      // enchantedForest: deep moss
  // THORNWICK — mossed wrought iron and green oak, a cold witch-light lantern,
  // a mossy stone basin over dark forest water.
  furniture: {
    benchFrame: 0x2b3a2a,
    benchSlat: 0x5c4a30,
    binBody: 0x2b3a2a,
    binLid: 0x3f5330,
    lampPost: 0x233021,
    lantern: 0xd8f0c0,
    lanternGlow: 0x4a8a3a,
    basin: 0x7a8068,
    water: 0x2a5a48,
    spray: 0xb8dcc4,
    stallCanopy: 0xd8d2b8,
    stallTrim: 0x4a6a34,
    stallPost: 0x5c4a30,
  },
};

/** PULSE DISTRICT — a disco nightclub street: black glass paving, magenta and
 *  cyan canvas, chrome cable, cold neon lanterns, uplit palms */
export const NEON_CITY: WorldTheme = {
  id: 'neon',
  title: 'Neon City',
  palette: {
    pavingLight: 0x3a3450,
    pavingDark: 0x1e1a2c,
    canopyPrimary: 0x2a2440,
    canopySecondary: 0xe0308c,
    bunting: 0x1ec8d8,
    buntingAccent: 0xd8e030,
    cable: 0xb0b4bc,
    iron: 0x2a2a34,
    lampGlass: 0xf0d8ff,
    lampGlow: 0xc040ff,
    spanBulbs: [0xff40a0, 0x40e0ff, 0xd8ff40],
  },
  planting: {
    trees: [
      { shape: 'palm', weight: 0.7 },
      { shape: 'round', weight: 0.3 },
    ],
    planters: ['topiarySpiral', 'planterBox'],
    flanker: 'topiarySpiral',
    hedge: 'planterBox',
    monument: 'tvMonitorPost',
    markers: ['signpost', 'tvMonitorPost'],
  },
  lamp: 'cold',
  ridePreset: 'kart',
  seedOffset: 505,
  pathSurface: SURFACE_NIGHTGLASS,
  ground: { soil: 0x1b1b22, patch: 0x26262f, tex: 'asphalt', patchiness: 0.35 },   // neon: black glass street
  // PULSE — matte black steel, magenta neon tube instead of a warm bulb, a
  // black basin lit cyan from below. The one theme whose lantern is a COLOUR,
  // not a temperature.
  furniture: {
    benchFrame: 0x1c1c22,
    benchSlat: 0x2a2a34,
    binBody: 0x1c1c22,
    binLid: 0xd6338c,
    lampPost: 0x16161a,
    lantern: 0xff6ad5,
    lanternGlow: 0xc41c8a,
    basin: 0x1a1a20,
    water: 0x18c4d8,
    spray: 0x9ff0fa,
    stallCanopy: 0x24243a,
    stallTrim: 0x18c4d8,
    stallPost: 0x2a2a34,
  },
};

/** every shipped theme, by id (`WORLD_THEMES.emberfall`) */
export const WORLD_THEMES: Record<string, WorldTheme> = {
  default: DEFAULT_THEME,
  fire: FIRE,
  steampunk: STEAMPUNK,
  pirateBeach: PIRATE_BEACH,
  enchantedForest: ENCHANTED_FOREST,
  neon: NEON_CITY,
  // ---- LEGACY IDS, still resolvable -------------------------------------
  // The themes were originally named after five INVENTED PLACES — Emberfall
  // Caldera, Tidewater Hollow, Brasswork Foundry, Thornwick Glade, Pulse
  // District. That was the wrong surface to expose to a generator: a proper
  // noun invites it to invent matching lore ("the Emberfall Ashworks", a
  // backstory, place names for every stall) instead of just picking the LOOK it
  // wants, and it has to remember which made-up name means "volcanic". The
  // canonical ids above are plain genres. These aliases keep every park that
  // already names a world building.
  emberfall: FIRE,
  tidewater: PIRATE_BEACH,
  brasswork: STEAMPUNK,
  thornwick: ENCHANTED_FOREST,
  pulse: NEON_CITY,
};

/** the CANONICAL ids, in a stable order — what a generator should choose from
 *  (`WORLD_THEMES` additionally answers to the five legacy place names) */
export const THEME_IDS = ['fire', 'steampunk', 'pirateBeach', 'enchantedForest', 'neon'] as const;

// ---- deprecated const aliases ------------------------------------------------
// The old exported names, kept so existing imports keep compiling. Prefer the
// generic ones (FIRE / STEAMPUNK / PIRATE_BEACH / ENCHANTED_FOREST / NEON_CITY).
/** @deprecated use `FIRE` */
export const EMBERFALL_CALDERA = FIRE;
/** @deprecated use `PIRATE_BEACH` */
export const TIDEWATER_HOLLOW = PIRATE_BEACH;
/** @deprecated use `STEAMPUNK` */
export const BRASSWORK_FOUNDRY = STEAMPUNK;
/** @deprecated use `ENCHANTED_FOREST` */
export const THORNWICK_GLADE = ENCHANTED_FOREST;
/** @deprecated use `NEON_CITY` */
export const PULSE_DISTRICT = NEON_CITY;

/** resolve an optional theme (every planner and builder calls this) */
export const themeOf = (theme?: WorldTheme): WorldTheme => theme ?? DEFAULT_THEME;

/** resolve a theme's FURNITURE, falling back token-by-token to the defaults so a
 *  theme may override just the two colours it cares about */
export const furnitureOf = (theme?: WorldTheme): WorldFurniture => ({ ...DEF_FURN, ...(theme?.furniture ?? {}) });

/** a theme's REMOUNT fingerprint — it goes into every plan's `keyData`, so
 *  swapping a theme (even an inline one that reuses an id) rebuilds the piece */
export const themeKey = (theme?: WorldTheme): string => {
  const th = themeOf(theme);
  return JSON.stringify([th.id, th.palette, th.planting, th.lamp, th.ridePreset, th.seedOffset]);
};

/** a world's seed for a piece — the piece's own seed plus the world offset */
export const themedSeed = (theme: WorldTheme | undefined, seed: number): number => seed + themeOf(theme).seedOffset;

/** pick from a theme species list with an existing 0..1 hashed-sine roll */
export const pickSpecies = <T,>(list: readonly T[], h: number, fallback: T): T =>
  list.length ? list[Math.min(list.length - 1, Math.max(0, Math.floor(h * list.length)))] : fallback;

/**
 * Pick a world's street-tree shape from a 0..1 roll, walking the theme's
 * weights. With `DEFAULT_THEME` this is exactly the boulevard's historic
 * `h < 0.3 ? 'pine' : h < 0.85 ? 'round' : 'willow'`.
 */
export function pickTreeShape(theme: WorldTheme | undefined, h: number): 'round' | 'pine' | 'palm' | 'willow' {
  const list = themeOf(theme).planting.trees;
  if (!list.length) return 'round';
  const total = list.reduce((s, e) => s + Math.max(0, e.weight), 0);
  if (total <= 0) return list[0].shape;
  let acc = 0;
  for (const e of list) {
    acc += Math.max(0, e.weight) / total;
    if (h < acc) return e.shape;
  }
  return list[list.length - 1].shape;
}

// ---- the plan --------------------------------------------------------------

/** a named connector cell: WORLD coords, lattice-snapped, one cell OUTSIDE
 *  the piece footprint, with the outward direction it faces */
export interface SetPiecePort {
  name: string;
  at: XZ;
  dir: XZ;
  /** index into the plan's own `nodes` */
  node: number;
  /** may buildParkNet DROP this port when nothing is wired to it? True for a
   *  dedicated stub (a plaza/bazaar entrance that would otherwise dead-end in
   *  open grass); FALSE for a structural chain END (a boulevard terminus is
   *  part of the carriageway — dropping it would shorten the avenue). */
  prunable: boolean;
}

/**
 * A SOLID the piece will register as a GameManager blocker when it mounts, in
 * WORLD coords — published on the PLAN so `buildParkNet` can refuse a street
 * laid through it BEFORE anything is built (wave-11 P0).
 *
 * A circle when `r` is set (a fountain basin), otherwise a rect of half
 * extents `half` rotated by `yaw`. Keep it identical to what the piece's mount
 * hands `reg.blockCircle` / `reg.blockRect`: the two must not drift, or the
 * fuse-time refusal and the settle-time `blockers` gate disagree.
 */
export interface SetPieceSolid {
  label: string;
  at: XZ;
  r?: number;
  half?: XZ;
  yaw?: number;
}

/** is `[x, z]` inside this solid? */
export const solidContains = (s: SetPieceSolid, x: number, z: number): boolean => {
  if (s.r !== undefined) return Math.hypot(x - s.at[0], z - s.at[1]) < s.r;
  if (!s.half) return false;
  const dx = x - s.at[0];
  const dz = z - s.at[1];
  const c = Math.cos(s.yaw ?? 0);
  const sn = Math.sin(s.yaw ?? 0);
  return Math.abs(dx * c - dz * sn) < s.half[0] && Math.abs(dx * sn + dz * c) < s.half[1];
};

/** the shape EVERY set-piece plan shares (each piece extends it with its own
 *  resolved dressing anchors — see FountainPlaza/Bazaar/Boulevard) */
export interface SetPiecePlan {
  kind: string;
  id: string;
  title: string;
  /** the piece's origin cell (lattice-snapped) */
  position: XZ;
  /** quantized yaw (multiple of π/2) */
  rotation: number;
  /** interior path sub-net, WORLD coords (feed through buildParkNet) */
  nodes: XZ[];
  edges: [number, number][];
  ports: SetPiecePort[];
  /** paving rects `[cx, cz, w, d]` for <Paths plazas> */
  plazas: [number, number, number, number][];
  /** litter-bin spots for <Paths bins> (mesh + manager registration) */
  bins: XZ[];
  /** every cell the piece paves or places on — <Terrain keepDry> */
  cells: XZ[];
  /** ONE OBB covering the piece (validatePark footprint + corridor sweeps) */
  footprint: ParkFootRect;
  /** the SOLIDS this piece blocks with at mount, WORLD coords (wave-11 P0 —
   *  `buildParkNet` refuses an authored street edge that crosses one) */
  solids: SetPieceSolid[];
  /** register `footprint` with the park? (street-like pieces don't reserve) */
  reserve: boolean;
  /** the WORLD this piece is dressed for (`DEFAULT_THEME` when none was
   *  given). Its fingerprint is part of `key`, so a theme swap REMOUNTS. */
  theme: WorldTheme;
  /** remount key */
  key: string;
  /** a port's world cell (throws on an unknown name) */
  port(name: string): XZ;
  /** a port's outward unit direction */
  portDir(name: string): XZ;
  /** local → world */
  toWorld(local: XZ): XZ;
  /** local yaw → world yaw */
  toWorldYaw(localYaw: number): number;
}

export interface SetPieceSpec {
  kind: string;
  id: string;
  title: string;
  position: XZ;
  rotation: number;
  /** sub-net nodes in LOCAL coords (lattice multiples) */
  localNodes: XZ[];
  localEdges: [number, number][];
  /** ports by name → index into `localNodes`, with the LOCAL outward dir.
   *  `prunable: false` marks a structural chain end (never dropped). */
  localPorts: { name: string; node: number; dir: XZ; prunable?: boolean }[];
  /** paving rects in LOCAL coords `[cx, cz, w, d]` */
  localPlazas?: [number, number, number, number][];
  localBins?: XZ[];
  /** LOCAL half-extents of the reserved footprint */
  half: XZ;
  /** LOCAL offset of the footprint centre from `position` (default [0, 0] —
   *  pieces whose origin is an END, like a boulevard's port A, use it) */
  footOffset?: XZ;
  reserve?: boolean;
  /** extra LOCAL cells to keep dry (prop/stall/verge spots) */
  localCells?: XZ[];
  /** LOCAL solids the piece registers as blockers at mount (fountain basin,
   *  market hall body). Published on the plan as `solids`, and `buildParkNet`
   *  REFUSES any authored street edge that crosses one (wave-11 P0). */
  localSolids?: { label: string; at: XZ; r?: number; half?: XZ }[];
  /** the world this piece dresses for (default `DEFAULT_THEME`) */
  theme?: WorldTheme;
  /** remount key payload */
  keyData?: unknown;
}

/** build the shared half of a set-piece plan (each planner calls this) */
export function makeSetPiecePlan(spec: SetPieceSpec): SetPiecePlan {
  const theme = themeOf(spec.theme);
  const position = snapXZ(spec.position);
  // ---- OFF-LATTICE POSITION LINT (2026-07-27) -----------------------------
  // The snap above is CORRECT — a set-piece must sit on the 1.2 lattice — but
  // until now it was SILENT, and a silent move of up to 0.6 u in each axis is
  // enough to invalidate every clearance the author computed against the
  // position they WROTE.
  //
  // MEASURED, wave 25B: the park planned `bazaarPlan({ position: [-12, -60.6] })`
  // (-60.6 / 1.2 = -50.5, exactly half a cell off). The footprint centre landed
  // at -60.0 — 0.6 u north of where the park believed it was — which ate the
  // clearance for an authored street node at [-12, -57.6] and tripped the
  // park's own STRUCTURAL `nodeInSolid` assertion. That throw happens at module
  // scope, so React never mounted: no Stage, no validatePark verdict, 0
  // registered rides, all 16 axes forfeit. The park was told nothing about the
  // move; the only hint was a DIAGONAL-edge advisory downstream, on a channel
  // that does not block.
  //
  // A generator cannot correct a shift it is never told about, so say it.
  {
    const dx = Math.abs(position[0] - spec.position[0]);
    const dz = Math.abs(position[1] - spec.position[1]);
    if (Math.max(dx, dz) > 1e-6)
      reportPlanLint(
        'offLattice',
        `${spec.kind}(${spec.id}): position [${spec.position[0]}, ${spec.position[1]}] is OFF the ${CELL} lattice and was ` +
          `snapped to [${position[0]}, ${position[1]}] — moved ${dx ? `${dx.toFixed(2)} u in x` : ''}${dx && dz ? ' and ' : ''}${
            dz ? `${dz.toFixed(2)} u in z` : ''
          }. Every port, footprint edge and clearance now measures from the SNAPPED centre, not the one you wrote, ` +
          `so any node you spaced against the authored position may now be short. Author positions as multiples of ${CELL}.`,
        false,
      );
  }
  const rotation = quantYaw(spec.rotation);
  const q = quarterTurns(rotation);
  const toWorld = (local: XZ): XZ => {
    const r = rotateXZ(rotation, local);
    return [position[0] + r[0], position[1] + r[1]];
  };
  const nodes = spec.localNodes.map((n) => snapXZ(toWorld(n)));
  const ports: SetPiecePort[] = spec.localPorts.map((p) => ({
    name: p.name,
    at: nodes[p.node],
    dir: rotateXZ(rotation, p.dir),
    node: p.node,
    prunable: p.prunable ?? true,
  }));
  const plazas = (spec.localPlazas ?? []).map(([cx, cz, w, d]) => {
    const c = toWorld([cx, cz]);
    const swap = q === 1 || q === 3;
    return [c[0], c[1], swap ? d : w, swap ? w : d] as [number, number, number, number];
  });
  const bins = (spec.localBins ?? []).map((b) => toWorld(b));
  // keepDry: every sub-net node, every 1.2 step along every sub-net edge,
  // every paved plaza tile centre and every prop/stall cell the piece owns
  const cells: XZ[] = [];
  const seen = new Set<string>();
  const push = (p: XZ) => {
    const k = key2(p);
    if (seen.has(k)) return;
    seen.add(k);
    cells.push(p);
  };
  nodes.forEach(push);
  spec.localEdges.forEach(([a, b]) => {
    const [ax, az] = nodes[a];
    const [bx, bz] = nodes[b];
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / CELL));
    for (let i = 1; i < steps; i += 1) push([ax + ((bx - ax) * i) / steps, az + ((bz - az) * i) / steps]);
  });
  plazas.forEach(([cx, cz, w, d]) => {
    const nx = Math.max(1, Math.round(w / CELL));
    const nz = Math.max(1, Math.round(d / CELL));
    for (let i = 0; i < nx; i += 1)
      for (let j = 0; j < nz; j += 1) push([cx - w / 2 + (i + 0.5) * CELL, cz - d / 2 + (j + 0.5) * CELL]);
  });
  (spec.localCells ?? []).forEach((c) => push(snapXZ(toWorld(c))));
  const footCentre = toWorld(spec.footOffset ?? [0, 0]);
  const footprint: ParkFootRect = {
    cx: footCentre[0],
    cz: footCentre[1],
    hx: spec.half[0],
    hz: spec.half[1],
    yaw: rotation,
    label: `${spec.title} ${spec.kind}`,
  };
  const portMap = new Map(ports.map((p) => [p.name, p]));
  // P0-A: a plan is read at MODULE SCOPE (`from: HUB.port('S')`), so asking for
  // a port this piece does not have must NOT throw — a throw there black-frames
  // the whole page. Fall back to the piece's FIRST port (or its origin cell when
  // it has none) and record a §0-FATAL plan lint naming the real port list.
  const at = (name: string): SetPiecePort => {
    const p = portMap.get(name);
    if (p) return p;
    const have = ports.map((pp) => pp.name).join(', ') || 'none';
    reportPlanLint(
      'unknownPort',
      `<${spec.kind} ${spec.id}>: no port "${name}" — this piece has [${have}]. Fell back to ${
        ports.length ? `port "${ports[0].name}"` : 'the piece origin'
      } so the park still renders; ask the plan for a port it really exposes (plan.ports / plan.portDir) instead of assuming a compass name`,
      true,
    );
    return ports[0] ?? { name, at: position, dir: [0, 1] as XZ, node: 0, prunable: true };
  };
  return {
    kind: spec.kind,
    id: spec.id,
    title: spec.title,
    position,
    rotation,
    nodes,
    edges: spec.localEdges.map((e) => [e[0], e[1]] as [number, number]),
    ports,
    plazas,
    bins,
    cells,
    footprint,
    solids: (spec.localSolids ?? []).map((s) => ({
      label: s.label,
      at: toWorld(s.at),
      r: s.r,
      half: s.half,
      yaw: rotation,
    })),
    reserve: spec.reserve ?? true,
    theme,
    // the THEME lives in the keyData half of the remount key: `key` is what
    // `setPiece` deps on, so dressing the same piece for another world really
    // rebuilds it instead of keeping the old palette on screen
    key: JSON.stringify([spec.kind, spec.id, position, rotation, spec.keyData ?? null, themeKey(theme)]),
    port: (name) => at(name).at,
    portDir: (name) => at(name).dir,
    toWorld,
    toWorldYaw: (localYaw) => localYaw + rotation,
  };
}

// ---- buildParkNet — fuse the agent's streets with every piece's sub-net ----

/** an edge endpoint: an index into YOUR `nodes`, or `'pieceId:PORT'` */
export type NetRef = number | string;

export interface ParkNetInput {
  /** YOUR street nodes — indices are PRESERVED in the result */
  nodes?: XZ[];
  /** street edges; endpoints may be your node indices or `'pieceId:PORT'` */
  edges?: [NetRef, NetRef][];
  pieces?: SetPiecePlan[];
  /** THE WORLDS-FIRST spelling (§3): pass the world plans and every piece they
   *  are composed of joins `pieces` automatically, in declaration order. Wire
   *  the streets to `world.gateway(toward)` refs. Mixing `worlds` and `pieces`
   *  is fine — a piece listed twice is merged by cell, not duplicated. */
  worlds?: { pieces: SetPiecePlan[] }[];
  /** SOLIDS the pieces cannot publish themselves — a restroom hut, a stall
   *  body, a `<Fence>` run you mount by hand. Authored edges are refused
   *  through these exactly as they are through a piece's own `solids`
   *  (wave-11 P0). World coords. */
  solids?: SetPieceSolid[];
  /** extra bins / plazas / keepDry cells of your own */
  bins?: XZ[];
  plazas?: [number, number, number, number][];
  keepDry?: XZ[];
  /** drop port stubs nobody connected to (default true — a dangling port is
   *  exactly the "spur dead-ending in open grass" defect) */
  prunePorts?: boolean;
  /** suppress the console lint (previews) */
  quiet?: boolean;
}

export interface ParkNetResult {
  /** the shared graph for `<Paths nodes edges>` — already lattice-snapped,
   *  deduped and cardinal, so <Paths>' own snapNetToGrid is a no-op and node
   *  indices stay stable */
  nodes: XZ[];
  edges: [number, number][];
  plazas: [number, number, number, number][];
  bins: XZ[];
  /** `<Terrain keepDry>` — streets, plaza tiles and every piece cell */
  keepDry: XZ[];
  /** node index of a world cell */
  node(at: XZ): number;
  /** node index of `'pieceId:PORT'` */
  port(ref: string): number;
  /** pruned port refs (unconnected stubs) */
  pruned: string[];
  /** lint findings (also console.warn'ed unless `quiet`) */
  warnings: string[];
}

/**
 * Fuse YOUR street lattice with every set-piece's interior sub-net into the
 * ONE `{nodes, edges}` graph `<Paths>` renders and the GameManager routes
 * over. Your node indices are preserved (piece nodes are appended), so
 * `queueTailNode` indices you computed against your own list stay valid.
 * Guarantees, by construction: everything snapped to the 1.2 lattice, no
 * duplicate cells, no duplicate/degenerate edges, every long edge SPLIT at
 * any node lying on it (no crossing without a junction), unconnected port
 * stubs pruned, and a lint pass for diagonal edges + disconnected islands.
 */
export function buildParkNet(input: ParkNetInput): ParkNetResult {
  const warnings: string[] = [];
  const nodes: XZ[] = [];
  const index = new Map<string, number>();
  const add = (p: XZ, label: string, forceNew = false): number => {
    const s = snapXZ(p);
    const k = key2(s);
    const hit = index.get(k);
    if (hit !== undefined && !forceNew) return hit;
    if (hit !== undefined) {
      warnings.push(`${label} lands on the same cell [${s[0]}, ${s[1]}] as node ${hit} — merged`);
      return hit;
    }
    const i = nodes.length;
    nodes.push(s);
    index.set(k, i);
    return i;
  };
  // 1. YOUR nodes first — indices 0..n-1 are preserved exactly
  const own = input.nodes ?? [];
  own.forEach((n, i) => {
    const before = nodes.length;
    const at = add(n, `street node ${i}`);
    if (at !== before) warnings.push(`street node ${i} duplicates node ${at} — your indices past ${i} would shift; give each street node its own cell`);
  });
  // 2. every piece's sub-net, merged by cell. The WORLDS-FIRST spelling (§3)
  //    hands whole worlds instead of loose pieces; a piece listed both ways is
  //    deduped here, so `worlds` and `pieces` compose freely.
  const portIndex = new Map<string, number>();
  const prunable = new Set<string>();
  const pieceEdges: [number, number][] = [];
  const allPieces: SetPiecePlan[] = [];
  const seenPiece = new Set<SetPiecePlan>();
  [...(input.worlds ?? []).flatMap((w) => w.pieces ?? []), ...(input.pieces ?? [])].forEach((pc) => {
    if (seenPiece.has(pc)) return;
    seenPiece.add(pc);
    allPieces.push(pc);
  });
  allPieces.forEach((pc) => {
    const map = pc.nodes.map((n, i) => add(n, `${pc.id} node ${i}`));
    pc.edges.forEach(([a, b]) => pieceEdges.push([map[a], map[b]]));
    pc.ports.forEach((p) => {
      portIndex.set(`${pc.id}:${p.name}`, map[p.node]);
      if (p.prunable) prunable.add(`${pc.id}:${p.name}`);
    });
  });
  // P0-A: `buildParkNet` runs at MODULE SCOPE too, so a bad ref DEGRADES —
  // the offending edge is dropped, a §0-FATAL plan lint is recorded, and the
  // park still renders (a throw here cost round 8 the entire page).
  const port = (ref: string): number => {
    const hit = portIndex.get(ref);
    if (hit !== undefined) return hit;
    reportPlanLint(
      'unknownPort',
      `buildParkNet: unknown port "${ref}" — known ports: [${[...portIndex.keys()].join(', ') || 'none'}]${
        ref.includes(':') ? '' : " (refs look like 'pieceId:PORT')"
      }. Every edge using it was DROPPED (expect an accessibility/island failure until you wire a real port)`,
      true,
    );
    return -1;
  };
  const resolve = (r: NetRef): number => {
    if (typeof r === 'number') {
      if (!Number.isInteger(r) || r < 0 || r >= own.length) {
        reportPlanLint(
          'badEdgeEndpoint',
          `buildParkNet: edge endpoint ${r} is not one of your street nodes (0..${own.length - 1}) — the edge was DROPPED`,
          true,
        );
        return -1;
      }
      return index.get(key2(snapXZ(own[r])))!;
    }
    return port(r);
  };
  // ---- P0 (wave-11): AN AUTHORED EDGE MAY NOT CROSS A PIECE'S SOLID --------
  // Round 10's park wired its spine into the plaza CENTRES (`emberHub`,
  // `foundryHub`, `pulseHub`) instead of into their PORTS, so streets ran
  // straight through three fountain basins: 6 `blockers` FAILs and Paths
  // 2.5/8, reported a whole build LATER by the settle-time gate. A wiring
  // mistake of that shape must be impossible at FUSE TIME, so every edge YOU
  // author is swept against every solid the member pieces will register when
  // they mount, and a crossing edge is REROUTED onto the offending piece's
  // nearest usable PORT — or DROPPED when no port clears it — with a §0-FATAL
  // plan lint either way (an auto-fix never silently rescues a §0 defect).
  // A piece's OWN sub-net is exempt: a plaza's ring is planned around its
  // basin by construction (that is why the sub-net is a ring, not a cross).
  const solidList: { owner: string; s: SetPieceSolid }[] = [
    ...allPieces.flatMap((pc) => (pc.solids ?? []).map((s) => ({ owner: pc.id, s }))),
    ...(input.solids ?? []).map((s) => ({ owner: '(park)', s })),
  ];
  const solidAcross = (a: XZ, b: XZ): { owner: string; s: SetPieceSolid; at: XZ } | null => {
    if (!solidList.length) return null;
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.3));
    for (let k = 0; k <= steps; k += 1) {
      const u = k / steps;
      const x = a[0] + (b[0] - a[0]) * u;
      const z = a[1] + (b[1] - a[1]) * u;
      for (const e of solidList) if (solidContains(e.s, x, z)) return { owner: e.owner, s: e.s, at: [x, z] as XZ };
    }
    return null;
  };
  /** `pieceId`'s ports, nearest `toward` first */
  const portsOf = (pieceId: string, toward: XZ): { ref: string; node: number }[] =>
    [...portIndex.entries()]
      .filter(([ref]) => ref.slice(0, ref.indexOf(':')) === pieceId)
      .map(([ref, node]) => ({ ref, node, d: Math.hypot(nodes[node][0] - toward[0], nodes[node][1] - toward[1]) }))
      .sort((p, q) => p.d - q.d)
      .map(({ ref, node }) => ({ ref, node }));
  const authoredEdges: [number, number][] = [];
  const show = (r: NetRef, n: number) => (typeof r === 'string' ? `'${r}'` : `node ${r} [${nodes[n].join(', ')}]`);
  // ---- P1 (wave-11): A DIAGONAL AUTHORED EDGE IS AUTO-ELBOWED --------------
  // RCT2 paths run N/S/E/W only. Round 10's park A authored two diagonals
  // straight into `edges` ([0, 46.8] → [30, 39.6] and [-24, -9.6] → [6, -34.8])
  // and paid 2 `paths` + 2 `corridor` + 2 `blockers` FAILs for them — the lint
  // said "DIAGONAL" and the diagonal shipped. It is now CUT into two cardinal
  // legs through a synthesised corner node, choosing the corner that stays out
  // of every piece's solids. The corner and both legs join the net, so they are
  // in `keepDry` and the auto-dressing keeps out of the new kerb by the same
  // rule it keeps out of every other street.
  const elbow = (a: number, b: number, ei: number, ra: NetRef, rb: NetRef): [number, number][] => {
    const [ax, az] = nodes[a];
    const [bx, bz] = nodes[b];
    if (Math.abs(bx - ax) < 0.01 || Math.abs(bz - az) < 0.01) return [[a, b]];
    const cands: XZ[] = [
      [ax, bz],
      [bx, az],
    ];
    const clean = cands.find((c) => !solidAcross(nodes[a], c) && !solidAcross(c, nodes[b]));
    const corner = clean ?? cands[0];
    const ci = add(corner, `elbow corner for edge ${ei}`);
    reportPlanLint(
      'edgeDiagonal',
      `buildParkNet: your edge ${ei} ${show(ra, a)} → ${show(rb, b)} is DIAGONAL — RCT2 paths run N/S/E/W only (a diagonal street is a \`paths\` FAIL, and it clips whatever it passes: round-10 paid 2 \`paths\` + 2 \`corridor\` + 2 \`blockers\` for two of them). It was ELBOWED through a corner node at [${nodes[
        ci
      ].join(', ')}]${clean ? '' : ' (NEITHER corner clears every solid — check the result)'}. Author the two cardinal legs yourself: [${nodes[a].join(
        ', ',
      )}] → [${nodes[ci].join(', ')}] → [${nodes[b].join(', ')}]`,
      true,
    );
    return [
      [a, ci],
      [ci, b],
    ];
  };
  const takeEdge = (a: number, b: number, ei: number, ra: NetRef, rb: NetRef) => {
    const hit = solidAcross(nodes[a], nodes[b]);
    if (!hit) {
      authoredEdges.push([a, b]);
      return;
    }
    // THE REROUTE IS A SPLIT, NOT A MOVE. An edge driven through a plaza has
    // TWO legitimate ends (the spine north of it and the spine south of it) —
    // moving one end onto a port strands the other. Each end is instead tied
    // to the nearest port that IT can see, and the piece's own sub-net (a
    // plaza's ring is a ring precisely so guests can walk around its basin)
    // carries the route between them. An end that is ITSELF inside the solid
    // is the "wired to the centre" mistake: it is simply dropped, and the
    // island lint below exempts the cell it orphans.
    const endInSolid = (n: number) => solidList.some((e) => solidContains(e.s, nodes[n][0], nodes[n][1]));
    const nearestClearPort = (n: number) =>
      portsOf(hit.owner, nodes[n]).find((c) => c.node !== n && !solidAcross(nodes[n], nodes[c.node]));
    const legs: [number, number][] = [];
    const vias: string[] = [];
    ([a, b] as const).forEach((n) => {
      if (endInSolid(n)) return;
      const c = nearestClearPort(n);
      if (!c) return;
      legs.push([n, c.node]);
      vias.push(c.ref);
    });
    const where = `(${hit.at[0].toFixed(1)}, ${hit.at[1].toFixed(1)})`;
    if (legs.length) {
      legs.forEach((l) => authoredEdges.push(l));
      reportPlanLint(
        'edgeThroughSolid',
        `buildParkNet: your edge ${ei} ${show(ra, a)} → ${show(rb, b)} runs THROUGH "${hit.s.label}" (${hit.owner}) at ${where} — guests cannot walk through solid objects, and a street driven across a piece's CENTRE is the round-10 defect that cost 6 \`blockers\` FAILs and 5.5 points of Paths. It was CUT AND RETIED to ${vias
          .map((v) => `'${v}'`)
          .join(' + ')}, so the route now goes AROUND through the piece's own sub-net. WIRE PORTS, NOT CENTRES: a piece's ports are one cell OUTSIDE its footprint (\`PLAZA.port('S')\` / \`WORLD.gateway(toward)\`), never \`PLAZA.position\` and never straight across it. Write the corrected refs into the park`,
        true,
      );
    } else {
      reportPlanLint(
        'edgeThroughSolid',
        `buildParkNet: your edge ${ei} ${show(ra, a)} → ${show(rb, b)} runs THROUGH "${hit.s.label}" (${hit.owner}) at ${where} and NO port of ${hit.owner} clears it, so the edge was DROPPED (expect an accessibility failure until you rewire it). Wire the street to a PORT — ${
          portsOf(hit.owner, nodes[a]).map((c) => `'${c.ref}'`).join(', ') || 'this piece exposes no ports at all'
        } — instead of into the piece's interior`,
        true,
      );
    }
  };
  (input.edges ?? []).forEach(([ra, rb], ei) => {
    const a = resolve(ra);
    const b = resolve(rb);
    if (a < 0 || b < 0) return;
    // cardinal FIRST (an elbow may itself need a solid split), solids SECOND
    elbow(a, b, ei, ra, rb).forEach(([p, q]) => takeEdge(p, q, ei, ra, rb));
  });
  const edges: [number, number][] = [...authoredEdges, ...pieceEdges];

  // 3. prune port stubs nobody connected to (a dangling port = a spur
  //    dead-ending in open grass). Piece nodes come AFTER your nodes, so
  //    removing one never shifts a street index.
  const pruned: string[] = [];
  if (input.prunePorts !== false) {
    const drop = new Set<number>();
    portIndex.forEach((ni, ref) => {
      if (!prunable.has(ref)) return; // structural chain end — never dropped
      const deg = edges.filter(([a, b]) => a === ni || b === ni).length;
      if (deg <= 1) {
        drop.add(ni);
        pruned.push(ref);
      }
    });
    if (drop.size) {
      const keep = nodes.map((_, i) => !drop.has(i));
      const remap: number[] = [];
      const kept: XZ[] = [];
      nodes.forEach((n, i) => {
        if (keep[i]) {
          remap[i] = kept.length;
          kept.push(n);
        } else remap[i] = -1;
      });
      const keptEdges = edges.filter(([a, b]) => keep[a] && keep[b]).map(([a, b]) => [remap[a], remap[b]] as [number, number]);
      nodes.length = 0;
      nodes.push(...kept);
      edges.length = 0;
      edges.push(...keptEdges);
      index.clear();
      nodes.forEach((n, i) => index.set(key2(n), i));
      portIndex.forEach((ni, ref) => {
        if (remap[ni] >= 0) portIndex.set(ref, remap[ni]);
        else portIndex.delete(ref);
      });
      if (!input.quiet)
        console.info(
          `[SetPieceKit] buildParkNet pruned ${pruned.length} unconnected port stub(s) — ${pruned.join(', ')} (nothing was wired to them; they would have dead-ended in open grass)`,
        );
    }
  }

  // 4. split every edge at any node lying ON it (a crossing without a
  //    junction is a routing dead end guests can never turn at)
  const split: [number, number][] = [];
  edges.forEach(([a, b]) => {
    const [ax, az] = nodes[a];
    const [bx, bz] = nodes[b];
    const along: { t: number; i: number }[] = [];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    if (len2 > 1e-9) {
      nodes.forEach((n, i) => {
        if (i === a || i === b) return;
        const tt = ((n[0] - ax) * dx + (n[1] - az) * dz) / len2;
        if (tt <= 1e-6 || tt >= 1 - 1e-6) return;
        const px = ax + dx * tt;
        const pz = az + dz * tt;
        if (Math.hypot(n[0] - px, n[1] - pz) > 1e-3) return;
        along.push({ t: tt, i });
      });
    }
    if (!along.length) {
      split.push([a, b]);
      return;
    }
    along.sort((p, q) => p.t - q.t);
    let prev = a;
    along.forEach(({ i }) => {
      split.push([prev, i]);
      prev = i;
    });
    split.push([prev, b]);
  });
  // 5. dedupe + drop degenerates
  const finalEdges: [number, number][] = [];
  const seenE = new Set<string>();
  split.forEach(([a, b]) => {
    if (a === b) return;
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seenE.has(k)) return;
    seenE.add(k);
    finalEdges.push([a, b]);
  });

  // 6. lint: cardinal edges + one connected street network
  finalEdges.forEach(([a, b], ei) => {
    const adx = Math.abs(nodes[b][0] - nodes[a][0]);
    const adz = Math.abs(nodes[b][1] - nodes[a][1]);
    if (adx >= 0.01 && adz >= 0.01)
      warnings.push(
        `edge ${ei} (${a}→${b}: [${nodes[a]}]→[${nodes[b]}]) is DIAGONAL — RCT2 paths run N/S/E/W only (validatePark fails 'paths')`,
      );
  });
  if (nodes.length) {
    const adj: number[][] = nodes.map(() => []);
    finalEdges.forEach(([a, b]) => {
      adj[a].push(b);
      adj[b].push(a);
    });
    const seenN = new Uint8Array(nodes.length);
    let islands = 0;
    // a node the P0 sweep ORPHANED (an authored "hub" cell inside a piece's
    // solid, whose every edge was rerouted onto a real port) is not an island
    // the author has to fix — it is the mistake the reroute already corrected
    const orphanedIntoSolid = (i: number) =>
      !adj[i].length && solidList.some((e) => solidContains(e.s, nodes[i][0], nodes[i][1]));
    for (let s = 0; s < nodes.length; s += 1) {
      if (seenN[s]) continue;
      if (orphanedIntoSolid(s)) {
        seenN[s] = 1;
        continue;
      }
      islands += 1;
      if (islands > 1) warnings.push(`node ${s} at [${nodes[s]}] is in a SEPARATE island — no walkable route from the gate street (validatePark fails 'accessibility')`);
      const stack = [s];
      seenN[s] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        adj[c].forEach((n) => {
          if (!seenN[n]) {
            seenN[n] = 1;
            stack.push(n);
          }
        });
      }
    }
  }
  if (warnings.length && !input.quiet) warnings.forEach((w) => console.warn(`[SetPieceKit] buildParkNet: ${w}`));
  // ---- P2: NET.warnings REFUSE THE BUILD ------------------------------------
  // rules §3.1 has always said "`NET.warnings` … are FATAL under §0's warnings
  // policy", and round 8 shipped two diagonal street edges anyway (2 `paths`
  // FAILs) because a warning that only reaches the console reaches nobody. Each
  // one is now a §0-FATAL plan lint, so `validatePark` cannot return ok on it.
  // (It is a LINT, not a throw: the park must still render to be diagnosable.)
  if (!input.quiet)
    warnings.forEach((w) =>
      reportPlanLint('netWarnings', `buildParkNet: ${w}`, true),
    );

  // 7. plazas / bins / keepDry
  const plazas = [...(input.plazas ?? []), ...allPieces.flatMap((p) => p.plazas)];
  const bins = [...(input.bins ?? []), ...allPieces.flatMap((p) => p.bins)];
  const keepDry: XZ[] = [];
  const seenK = new Set<string>();
  const pushK = (p: XZ) => {
    const k = key2(p);
    if (seenK.has(k)) return;
    seenK.add(k);
    keepDry.push(p);
  };
  nodes.forEach(pushK);
  finalEdges.forEach(([a, b]) => {
    const [ax, az] = nodes[a];
    const [bx, bz] = nodes[b];
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / CELL));
    for (let i = 1; i < steps; i += 1) pushK([ax + ((bx - ax) * i) / steps, az + ((bz - az) * i) / steps]);
  });
  allPieces.forEach((p) => p.cells.forEach(pushK));
  (input.keepDry ?? []).forEach(pushK);

  return {
    nodes,
    edges: finalEdges,
    plazas,
    bins,
    keepDry,
    // P0-A: parks call `NET.node(TAIL)` at module scope, so a miss DEGRADES to
    // the NEAREST node (+ a §0-FATAL lint) instead of throwing the page away.
    node: (at: XZ) => {
      const s = snapXZ(at);
      const i = index.get(key2(s));
      if (i !== undefined) return i;
      let best = -1;
      let bd = Infinity;
      nodes.forEach((n, k) => {
        const d = Math.hypot(n[0] - s[0], n[1] - s[1]);
        if (d < bd) {
          bd = d;
          best = k;
        }
      });
      reportPlanLint(
        'noNodeOnCell',
        `buildParkNet: no street node on cell [${s.join(', ')}]${
          best >= 0 ? ` — using the NEAREST node ${best} at [${nodes[best].join(', ')}], ${bd.toFixed(2)} u away` : ' — and the net has no nodes at all'
        }. Put a spine node on that cell (or read the cell back off the net) instead of guessing it`,
        true,
      );
      return best < 0 ? 0 : best;
    },
    port,
    pruned,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// WORLDS — the unit a park is COMPOSED OF (rules §3)
// ---------------------------------------------------------------------------
//
// A park is not "terrain, then paths, then rides, with themed lands as advice".
// It is THREE OR MORE WORLDS, each built out as a self-contained district, then
// connected. `worldPlan` is the planner for that top level, and it follows the
// same PURE-PLANNER contract as every set-piece: it returns the world as DATA —
// its region, its ports, its ride/stall slots and its theme handle — BEFORE
// anything mounts, so `<Terrain keepDry>` / `<Paths>` can be declared first.
//
// It is deliberately THIN: it COMPOSES member plans into one named place.
// NOTE (v6.0) — the five one-call LAND MACROS that used to plan a whole
// district each (`emberfallCalderaPlan` … `pulseDistrictPlan`) were REMOVED
// from the design system. A world is now assembled from the generic set-pieces
// (`fountainPlazaPlan`, `bazaarPlan`, `boulevardPlan` — all of which take the
// world's `theme`) plus that world's own themed rides, stall and scenery,
// mounted by hand with their cells listed in `include`.
//
//   * it unions their extents into the world's REGION, which `<World>`
//     registers with `<Park>` and which every positional theme check measures
//     against (a themed piece inside a foreign region is a `crossTheme`
//     warning — ParkBuilder/worlds.ts);
//   * it collects their PORTS under one name, so an author wires WORLDS
//     (`world.gateway(HUB.port('N'))`) instead of remembering which land
//     exposes `'NE'`;
//   * it collects their RIDE and STALL SLOTS, so the world's attractions are
//     read off the plan rather than hand-computed;
//   * it collects their `cells` for one `keepDry` list.
//
// A world's REGION IS NOT A FOOTPRINT and is never registered for the OBB
// sweep: it CONTAINS pieces that reserve their own land and rides that register
// their own pads/huts/lanes (the same reason a set-piece's `extent` is
// planning-only). It exists so code can answer "which world is this cell in".

/** a ride slot a world's pieces published (a themed set-piece plan's `rides[]`) */
export interface WorldRideSlot {
  /** the piece id that published it */
  piece: string;
  kind: string;
  name: string;
  at: XZ;
  yaw: number;
  /** the queue tail cell, when the piece planned one */
  tailAt?: XZ;
}

/** a stall slot a world's pieces published (a bazaar row, a land's held-item
 *  slot) — mount a catalog stall here and it stands on the world's own paving */
export interface WorldStallSlot {
  piece: string;
  kind?: string;
  name?: string;
  at: XZ;
  yaw: number;
}

export interface WorldPlanInput {
  /** unique world id — it is what `crossTheme` findings and `probe.worlds`
   *  name, and what `<World>` registers (`'ember'`, `'cove'`, `'pulse'`) */
  id: string;
  /** display title (default derived from `id`) */
  title?: string;
  /** the world's DRESS — one of the five presets (`EMBERFALL_CALDERA`,
   *  `TIDEWATER_HOLLOW`, `BRASSWORK_FOUNDRY`, `THORNWICK_GLADE`,
   *  `PULSE_DISTRICT`). Hand the SAME object to every piece in the world. */
  theme: WorldTheme;
  /** REMOVED IN v6.0 — the five prefab LAND MACROS (BrassworkFoundry,
   *  PulseDistrict, ThornwickGlade, EmberfallCaldera, TidewaterHollow) NO
   *  LONGER EXIST. Importing any of them makes esbuild refuse the whole
   *  bundle. Build a world from a THEMED structural set-piece
   *  (fountainPlazaPlan/bazaarPlan/boulevardPlan with `theme`) plus that
   *  world's own rides, stalls and scenery pack.
   *
   *  the plans this world is built from, in declaration order: a themed set-piece
   *  and any generic set-pieces dressed for it. A plan's `extent` (the whole
   *  district including its circuits) is used when it has one, otherwise
   *  the piece's reserved `footprint`. */
  pieces: SetPiecePlan[];
  /**
   * extra world cells the region must cover: hand-placed ride pads, the
   * world's planting ring, a stall cell off the promenade.
   *
   * THESE MUST BE PAD CENTRES, NOT QUEUE TAILS (wave-11 P1). Round 10 listed
   * its Pulse world's queue TAIL cells here; the tails sat at x ≤ 15.6 while
   * the three rides' pads sat at x = 18.0, so the region stopped short of its
   * own attractions, the audit read `rideCount: 0` and the world scored as
   * `worldNotBuiltOut`. A tail is 3-7 u UPSTREAM of the pad it serves — list
   * the pad, or better, list the ride in `rides` and let the planner add the
   * pad apron for you.
   */
  include?: XZ[];
  /**
   * THE WORLD'S HAND-MOUNTED RIDES AND STALLS — pad centres, with an optional
   * name and pad half-extent. Unioned into the region with an apron, so a
   * world's bounds are derived from the attractions it is built out of rather
   * than from whichever cells the author remembered to list (wave-11 P1).
   * Rides a member set-piece PUBLISHES (`plan.rides[]`) are already covered.
   */
  rides?: { at: XZ; name?: string; half?: number }[];
  /** apron around the union, in units (default 2.4 — two lattice cells, so a
   *  ride's queue lane and exit hut on the world's edge resolve INSIDE it) */
  margin?: number;
}

export interface WorldPlan {
  kind: 'World';
  id: string;
  title: string;
  theme: WorldTheme;
  /** the theme's id — the string every positional check compares */
  themeId: string;
  /** the pieces this world is composed of (feed to `buildParkNet`, or pass the
   *  world itself as `worlds: [...]` and it does this for you) */
  pieces: SetPiecePlan[];
  centre: XZ;
  half: XZ;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** the region `<World>` registers with `<Park>` */
  region: WorldRegionRec;
  /** every port of every piece, as a `buildParkNet` ref (`'ember:S'`) */
  ports: string[];
  rideSlots: WorldRideSlot[];
  stallSlots: WorldStallSlot[];
  /** every cell the world's pieces pave or place on — `<Terrain keepDry>` */
  cells: XZ[];
  /** is this cell inside the world? */
  contains(at: XZ): boolean;
  /**
   * THE WORLD'S GATEWAY toward a point: the `'pieceId:PORT'` ref of the port
   * whose cell is nearest `toward` AND whose outward direction actually points
   * that way. This is how worlds are connected — `boulevardPlan({ from:
   * HUB.port('S'), to: NET_REF_CELL })` needs a cell, so `gatewayCell` gives
   * the cell and `gateway` gives the ref for `buildParkNet`'s `edges`.
   * Never infer a compass name (§3.1's round-8 lesson): ask.
   */
  gateway(toward: XZ): string;
  /** the world cell of `gateway(toward)` */
  gatewayCell(toward: XZ): XZ;
  key: string;
}

/**
 * Plan a WORLD — PURE, returns before anything mounts (§3/§3.1's contract).
 *
 * ```ts
 * const EMBER = worldPlan({
 *   id: 'ember', theme: EMBERFALL_CALDERA,
 *   pieces: [bazaarPlan({ id: 'caldera', position: [-30, -14], theme: EMBERFALL_CALDERA, seed: 3 })],
 *   include: [[-30, -4], [-24, -4]],   // hand-placed ride pad + scenery cells
 * });
 * const NET = buildParkNet({ nodes: SPINE, edges: [[0, EMBER.gateway(HUB.port('W'))]], worlds: [EMBER, ...] });
 * // …then, after <Paths>:  <World plan={EMBER} /> <Bazaar plan={EMBER.pieces[0]} /> <MagmaRun … />
 * ```
 */
export function worldPlan(input: WorldPlanInput): WorldPlan {
  const id = input.id;
  const title =
    input.title ?? input.theme.title ?? id.replace(/(^|[\s-_])(\w)/g, (_m, a, b) => `${a ? ' ' : ''}${b.toUpperCase()}`).trim();
  const theme = themeOf(input.theme);
  const margin = input.margin ?? 2 * CELL;
  const pieces = input.pieces ?? [];
  if (!pieces.length)
    reportPlanLint(
      'worldEmpty',
      `worldPlan(${id}): no pieces — a world is composed of its set-pieces (§3). An empty world has no region to audit and scores nothing on the rubric's Worlds axis`,
      true,
    );
  if (theme.id === 'default')
    reportPlanLint(
      'worldUnthemed',
      `worldPlan(${id}): \`theme\` is DEFAULT_THEME — a world IS its theme. Pass one of EMBERFALL_CALDERA / TIDEWATER_HOLLOW / BRASSWORK_FOUNDRY / THORNWICK_GLADE / PULSE_DISTRICT`,
      true,
    );

  // ---- the region: the union of every piece's extent (or footprint) --------
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const eat = (x: number, z: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  };
  const eatRect = (r: ParkFootRect) => {
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => {
        const w = rotateXZ(r.yaw, [sx * r.hx, sz * r.hz]);
        eat(r.cx + w[0], r.cz + w[1]);
      }),
    );
  };
  pieces.forEach((p) => {
    // a themed district plan publishes `extent` (court + every circuit); a generic piece
    // only reserves its own `footprint`
    const ext = (p as SetPiecePlan & { extent?: ParkFootRect }).extent;
    eatRect(ext ?? p.footprint);
    p.ports.forEach((pt) => eat(pt.at[0], pt.at[1]));
    // a piece that PUBLISHES ride slots puts its rides inside the world too
    ((p as SetPiecePlan & { rides?: { at: XZ }[] }).rides ?? []).forEach((r) => {
      eat(r.at[0] - 2.4, r.at[1] - 2.4);
      eat(r.at[0] + 2.4, r.at[1] + 2.4);
    });
  });
  // wave-11 P1: the world's bounds are derived from its RIDE PADS, with a pad
  // apron, so a world can never read `rideCount: 0` because its author listed
  // queue tails instead of pads
  (input.rides ?? []).forEach((r) => {
    const h = r.half ?? 2.4;
    eat(r.at[0] - h, r.at[1] - h);
    eat(r.at[0] + h, r.at[1] + h);
  });
  (input.include ?? []).forEach(([x, z]) => eat(x, z));
  if (!Number.isFinite(minX)) {
    minX = maxX = minZ = maxZ = 0;
  }
  minX -= margin;
  maxX += margin;
  minZ -= margin;
  maxZ += margin;
  const centre: XZ = [(minX + maxX) / 2, (minZ + maxZ) / 2];
  const half: XZ = [(maxX - minX) / 2, (maxZ - minZ) / 2];

  const ports = pieces.flatMap((p) => p.ports.map((pt) => `${p.id}:${pt.name}`));
  const portCells = new Map<string, { at: XZ; dir: XZ }>();
  pieces.forEach((p) => p.ports.forEach((pt) => portCells.set(`${p.id}:${pt.name}`, { at: pt.at, dir: pt.dir })));

  // ---- ride / stall slots the pieces published (duck-typed: a district plan's
  //      `rides[]`, a bazaar's `stalls[]`, a land's single `stallSlot`) ------
  const rideSlots: WorldRideSlot[] = [];
  const stallSlots: WorldStallSlot[] = [];
  pieces.forEach((p) => {
    const any = p as SetPiecePlan & {
      rides?: { kind?: string; name?: string; at: XZ; yaw: number; tailAt?: XZ }[];
      stalls?: { kind?: string; name?: string; at: XZ; yaw: number }[];
      stallSlot?: { kind?: string; name?: string; at: XZ; yaw: number };
    };
    (any.rides ?? []).forEach((r) =>
      rideSlots.push({ piece: p.id, kind: r.kind ?? p.kind, name: r.name ?? `${p.title} ride`, at: r.at, yaw: r.yaw, tailAt: r.tailAt }),
    );
    (any.stalls ?? []).forEach((s) => stallSlots.push({ piece: p.id, kind: s.kind, name: s.name, at: s.at, yaw: s.yaw }));
    if (any.stallSlot) stallSlots.push({ piece: p.id, kind: any.stallSlot.kind, name: any.stallSlot.name, at: any.stallSlot.at, yaw: any.stallSlot.yaw });
  });

  const cells: XZ[] = [];
  const seen = new Set<string>();
  pieces.forEach((p) =>
    p.cells.forEach((c) => {
      const k = key2(c);
      if (seen.has(k)) return;
      seen.add(k);
      cells.push(c);
    }),
  );
  (input.include ?? []).forEach((c) => {
    const s = snapXZ(c);
    const k = key2(s);
    if (seen.has(k)) return;
    seen.add(k);
    cells.push(s);
  });

  const region: WorldRegionRec = {
    id,
    themeId: theme.id,
    title,
    cx: centre[0],
    cz: centre[1],
    hx: half[0],
    hz: half[1],
    pieceIds: pieces.map((p) => p.id),
  };
  const contains = (at: XZ) => worldContains(region, at[0], at[1]);

  /** the port whose cell is nearest `toward`, preferring one facing it */
  const bestPort = (toward: XZ): string | null => {
    let best: string | null = null;
    let bestScore = Infinity;
    portCells.forEach(({ at, dir }, ref) => {
      const dx = toward[0] - at[0];
      const dz = toward[1] - at[1];
      const d = Math.hypot(dx, dz);
      // a port pointing AWAY from the target pays a penalty rather than being
      // excluded: a one-port world must still answer
      const facing = d > 1e-6 ? (dx / d) * dir[0] + (dz / d) * dir[1] : 1;
      const score = d * (facing >= 0 ? 1 : 1.75);
      if (score < bestScore) {
        bestScore = score;
        best = ref;
      }
    });
    return best;
  };
  const gateway = (toward: XZ): string => {
    const ref = bestPort(toward);
    if (ref) return ref;
    reportPlanLint(
      'worldNoPorts',
      `worldPlan(${id}).gateway(): this world's pieces expose no ports, so nothing can be wired to it (it would be an island — validatePark fails 'accessibility'). Ask its set-piece for ports (\`ports: ['S', 'W']\`)`,
      true,
    );
    return `${id}:NONE`;
  };

  return {
    kind: 'World',
    id,
    title,
    theme,
    themeId: theme.id,
    pieces,
    centre,
    half,
    bounds: { minX, maxX, minZ, maxZ },
    region,
    ports,
    rideSlots,
    stallSlots,
    cells,
    contains,
    gateway,
    gatewayCell: (toward: XZ) => {
      const ref = bestPort(toward);
      return ref ? portCells.get(ref)!.at : centre;
    },
    key: JSON.stringify([id, theme.id, centre, half, pieces.map((p) => p.key)]),
  };
}

/**
 * Declare a WORLD to the park: registers its REGION so the acceptance gate can
 * audit theme coherence by position and the eval harness can report world
 * variety. It builds NO geometry — the world's visuals are its pieces, mounted
 * from the same plans (`<Bazaar plan={EMBER.pieces[0]} />`), plus the world's
 * own themed rides / stall / scenery placed inside its region.
 *
 * Declare it right after `<Paths>`, alongside the pieces it contains.
 */
export const World: React.FC<{ plan: WorldPlan }> = ({ plan }) => {
  const park = usePark('World');
  React.useEffect(() => park.registerWorld(plan.region), [park, plan.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

/**
 * `<WorldGround plan={W} />` — LAY THE WORLD'S OWN FLOOR.
 *
 * `<World>` registers a REGION and builds nothing; `theme.pathSurface` re-skins
 * only the STREETS. Everything either side of them stayed the climate's default
 * grass, so a volcanic caldera and an enchanted glade were the same green field
 * with different props on it. That is the single biggest reason three declared
 * worlds still read as one place from any distance.
 *
 * This lays the theme's `ground` dress over the world's rect: a base soil tone
 * plus a deterministic scatter of a second tone so the floor is never one flat
 * slab, every tile settled onto the terrain through `park.floorAt` and sunk a
 * hair so path slabs and pads always win the z-fight.
 *
 * Mount it BEFORE the world's props (it is a floor) and AFTER `<Paths>` (it
 * reads the settled ground). It registers no footprint and blocks nothing.
 */
// `<WorldGround>` MOVED to its own component folder (2026-07-28) so
// `install_code_component` can surface it by name — buried in this kit it was
// published but invisible, and no generated park ever mounted one. Re-exported
// here so existing `from './components/SetPieceKit'` imports keep working.
export { WorldGround } from '../WorldGround';

/** declare several worlds at once: `<Worlds plans={[EMBER, COVE, PULSE]} />` */
export const Worlds: React.FC<{ plans: WorldPlan[] }> = ({ plans }) => (
  <>
    {plans.map((p) => (
      <World key={p.id} plan={p} />
    ))}
  </>
);

// ---- the mount side -------------------------------------------------------

/** props EVERY set-piece component takes — the plan, and nothing else */
export interface SetPieceProps<P extends SetPiecePlan = SetPiecePlan> {
  /** the plan its pure planner returned (the single source of geometry) */
  plan: P;
  /** override `plan.reserve`: register the piece footprint for validatePark's
   *  footprint + corridor sweeps (land-owning pieces default ON) */
  reserve?: boolean;
}

const isPreview = (park: ParkContextValue): boolean => !!(park as { _previewHost?: boolean })._previewHost;

/**
 * Set-piece component factory. The build runs in WORLD coordinates (the group
 * mounts at the origin) so every item can settle on its own surface through
 * `park.floorAt` — plaza level inside the piece's paving, terrain outside.
 * Inside a real <Park> the plan's footprint is registered (unless
 * `reserve: false`), which puts the WHOLE piece into validatePark's footprint
 * sweep + the coaster-corridor sweep and pulls the terrain guard clamp under
 * it (AUTO-keepDry), so a set-piece can never sit in water or on a bulge.
 */
export function setPiece<P extends SetPiecePlan>(
  displayName: string,
  build: (t: typeof THREE, plan: P, park: ParkContextValue) => THREE.Group | ComposableBuilt,
): React.FC<SetPieceProps<P>> {
  const Component: React.FC<SetPieceProps<P>> = ({ plan, reserve }) => {
    const inScene = useComposable(
      (t, park) => {
        const res = build(t, plan, park);
        const built: ComposableBuilt = (res as THREE.Object3D).isObject3D
          ? { group: res as THREE.Group }
          : (res as ComposableBuilt);
        // THE COMPONENT TAG + the piece's EXPLICIT world. A set-piece is
        // STRUCTURE, so `COMPONENT_THEME` cannot classify it — a <Bazaar> is
        // whichever world it was DRESSED for. Publishing `plan.theme.id` here is
        // what lets the coherence audit catch a plaza dressed for Emberfall
        // standing inside the Pulse District (`DEFAULT_THEME` is neutral).
        // `[cx, cz]` is the piece's FOOTPRINT CENTRE: the build runs in world
        // coordinates and this group mounts at the ORIGIN, so its world
        // transform is [0, 0] and would resolve to the wrong world (or none).
        tagComponent(built, plan.kind || displayName, 'setPiece', plan.theme.id, [plan.footprint.cx, plan.footprint.cz]);
        if ((reserve ?? plan.reserve) && !isPreview(park)) {
          const unregister = park.registerFootprint(plan.footprint);
          const prev = built.dispose;
          built.dispose = () => {
            prev?.();
            unregister();
          };
        }
        return built;
      },
      { position: [0, 0, 0], rotation: 0, deps: [plan.key, reserve] },
    );
    if (!inScene) console.warn(`<${displayName}> must be rendered inside a <Park> or <ScenePreview> — nothing mounted`);
    return null;
  };
  Component.displayName = displayName;
  return Component;
}

// ---- shared dressing builders (one lighting/furniture language) ------------

export interface SetPieceLampOpts {
  /** post height (default 2.4) */
  height?: number;
  /** give this lamp a real PointLight (keep 2-4 per piece — the park runtime
   *  admits the nearest `budgets.lights` globally) */
  light?: boolean;
  /** the world this lamp belongs to: its ironwork, glass and glow colours and
   *  its lamp CHARACTER (warm bulb / cold light / flame). Default
   *  `DEFAULT_THEME` = today's iron + warm bulb, unchanged. */
  theme?: WorldTheme;
}

/**
 * The family's park lamp: iron post, night-gated lantern head and an optional
 * small PointLight. `hook` is the string-light anchor (RCT2 rule: spans hang
 * hook-to-hook between REAL poles, never in mid-air). The geometry is the same
 * in every world — only the palette and the emissive curve are themed, so a
 * themed piece keeps the default one's silhouette and footprint.
 */
export function setPieceLamp(
  t: typeof THREE,
  at: [number, number, number],
  opts: SetPieceLampOpts = {},
): { group: THREE.Group; hook: [number, number, number]; update: (time: number) => void } {
  const theme = themeOf(opts.theme);
  const IRON = theme.palette.iron;
  const character = LAMP_CHARACTER[theme.lamp] ?? LAMP_CHARACTER.warm;
  const h = opts.height ?? 2.4;
  const g = new t.Group();
  const [x, y, z] = at;
  g.add(cyl(t, 0.13, 0.17, 0.14, IRON, [x, y + 0.07, z], { tex: 'metal', rough: 0.6, metal: 0.5, seg: 12 }));
  g.add(cyl(t, 0.045, 0.06, h, IRON, [x, y + h / 2, z], { tex: 'metal', repeat: [1, 4], rough: 0.55, metal: 0.55, seg: 12 }));
  const glass = new t.MeshStandardMaterial({ color: theme.palette.lampGlass, emissive: theme.palette.lampGlow, emissiveIntensity: 0.12, roughness: 0.35 });
  const lantern = new t.Mesh(new t.BoxGeometry(0.24, 0.3, 0.24), glass);
  lantern.position.set(x, y + h + 0.14, z);
  lantern.castShadow = true;
  g.add(lantern);
  // iron cage: four corner ribs + a pyramidal cap
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) =>
      g.add(box(t, [0.024, 0.32, 0.024], IRON, [x + sx * 0.12, y + h + 0.14, z + sz * 0.12], { tex: 'metal', metal: 0.5, rough: 0.5 })),
    ),
  );
  g.add(cyl(t, 0.02, 0.22, 0.12, IRON, [x, y + h + 0.36, z], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 4 }));
  g.add(ball(t, 0.038, IRON, [x, y + h + 0.45, z], { metal: 0.6, rough: 0.45 }));
  let light: THREE.PointLight | null = null;
  if (opts.light) {
    light = new t.PointLight(theme.palette.lampGlow, 0, character.distance, 2);
    light.position.set(x, y + h + 0.05, z);
    g.add(light);
  }
  // night gating is `nightKOf` exactly as before — the theme only shapes the
  // curve (a flame breathes hard, a cold gas light barely moves)
  const update = (time: number) => {
    const k = nightKOf(g);
    const ease = k * k * (3 - 2 * k);
    const flicker = 1 + character.flickerAmp * Math.sin(time * character.flickerSpeed + x * 1.7 + z * 2.3);
    glass.emissiveIntensity = character.base + character.gain * ease * flicker;
    if (light) light.intensity = character.lightGain * ease * flicker;
  };
  return { group: g, hook: [x, y + h + 0.02, z], update };
}

/** a night-gated festival span between two REAL lamp hooks; the bulb count is
 *  capped so one piece never eats the park's whole light budget. `colors` wins;
 *  otherwise the span takes the theme's `palette.spanBulbs`. */
export function setPieceSpan(
  t: typeof THREE,
  from: [number, number, number],
  to: [number, number, number],
  opts: { colors?: number[]; sag?: number; bulbs?: number; theme?: WorldTheme } = {},
): { group: THREE.Group; update: (time: number) => void } {
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const bulbs = opts.bulbs ?? Math.max(5, Math.min(9, Math.round(dist / 0.75)));
  const colors = opts.colors ?? themeOf(opts.theme).palette.spanBulbs;
  return buildStringLights(t, from, to, { bulbs, sag: opts.sag ?? 0.3 + dist * 0.03, colors });
}

/** a park bench facing `yaw` (its seat looks down local +z, like Kit's) */
export function setPieceBench(t: typeof THREE, at: [number, number, number], yaw: number): THREE.Group {
  const g = kitBench(t);
  g.position.set(at[0], at[1], at[2]);
  g.rotation.y = yaw;
  return g;
}

/** the yaw that makes a prop's local +z look at `target` */
export const yawToward = (from: XZ, target: XZ): number => Math.atan2(target[0] - from[0], target[1] - from[1]);

// ---- round-6 channels: planted footprints + solid blockers ------------------
//
// Set-pieces speak the SAME safeguard channels as the rest of the catalog
// instead of carrying private machinery: `park.registerPlanted` (validatePark's
// `scenery` gate — dryness + never standing in a walked slab; plaza dressing is
// exempt) and `park.registerBlocker` (the GameManager's routing registry +
// validatePark's `blockers` gate — guests walk AROUND solid things). Thin posts
// (lamp columns, flagpoles) are planted but NOT blockers: RCT2 lets guests brush
// past a lamp, and a blocker per lamp would fence a boulevard in.

/** ground-contact radius of the catalog dressing a set-piece plants */
export const PLANTED_RADIUS: Record<string, number> = {
  bench: 0.5,
  lamp: 0.2,
  tree: 0.7,
  planterBox: 0.72,
  topiarySpiral: 0.4,
  topiaryElephant: 0.55,
  marbleStatue: 0.55,
  birdbath: 0.4,
  parkClock: 0.28,
  signpost: 0.3,
  flagpole: 0.22,
  picnicTable: 0.8,
  gazebo: 1.35,
  wishingWell: 0.5,
  // species the WORLD THEMES plant (a themed piece registers the same channels
  // as a default one, so validatePark's `scenery` gate audits them identically)
  lionStatue: 0.55,
  cactusCluster: 0.5,
  fallenLog: 0.6,
  mushroomCluster: 0.45,
  tvMonitorPost: 0.3,
  brickWall: 0.6,
  picketFence: 0.6,
  ironArchway: 0.9,
  hotAirBalloon: 1.1,
};
export const plantedRadius = (name: string): number => PLANTED_RADIUS[name] ?? 0.5;

/** collects a set-piece's `registerPlanted` / `registerBlocker` unregisters so
 *  the component can hand ONE `dispose` back to `setPiece` */
export function setPieceRegistry(park: ParkContextValue, plan: SetPiecePlan) {
  const undo: (() => void)[] = [];
  return {
    /** a planted prop (scenery/tree/bench/lamp) with its ground radius */
    plant(name: string, at: XZ, r = plantedRadius(name)) {
      undo.push(park.registerPlanted({ label: `<${plan.kind} ${plan.id}> ${name} at [${at[0].toFixed(1)}, ${at[1].toFixed(1)}]`, x: at[0], z: at[1], r }));
    },
    /** a SOLID circle guests must walk around (fountain basins, planters that
     *  really are walls) — keep the piece's own path nodes clear of it */
    blockCircle(name: string, at: XZ, r: number, kind = 'scenery', height = 1) {
      undo.push(
        park.registerBlocker({
          circle: { cx: at[0], cz: at[1], r },
          label: `<${plan.kind} ${plan.id}> ${name}`,
          kind,
          height,
        }),
      );
    },
    dispose: () => undo.forEach((u) => u()),
  };
}

// ---- preview staging ------------------------------------------------------

/**
 * PREVIEW ONLY: render the paving a real park's `<Paths>` would render for
 * these plans (interior sub-nets, port stubs and plaza rects), so a
 * *.previews.tsx file shows the piece as it composes. Pass the result as
 * `<ScenePreview dress={...}>`. Never use this inside a real <Park> — there
 * `<Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas}>` owns every
 * path surface.
 */
export function setPiecePaving(
  plans: SetPiecePlan[],
  opts: { y?: number; width?: number; bins?: boolean; extraNodes?: XZ[]; extraEdges?: [NetRef, NetRef][] } = {},
): (t: typeof THREE, g: THREE.Group) => (time: number) => void {
  return (t, g) => {
    const net = buildParkNet({
      nodes: opts.extraNodes,
      edges: opts.extraEdges,
      pieces: plans,
      prunePorts: false, // previews SHOW the port stubs
      quiet: true,
    });
    const built = buildPathNetwork(
      t,
      { nodes: net.nodes.map((n) => [n[0], n[1]] as XZ), edges: net.edges.map((e) => [e[0], e[1]] as [number, number]) },
      { width: opts.width ?? 1.1, y: opts.y ?? -0.096, plazas: net.plazas, grid: false },
    );
    g.add(built.group);
    if (opts.bins !== false)
      net.bins.forEach(([x, z]) => {
        const b = kitBin(t);
        b.position.set(x, 0, z);
        g.add(b);
      });
    return built.update;
  };
}

/** PREVIEW/DEBUG: low markers on every port (+ its outward arrow) and posts
 *  at the piece footprint corners — the contract made visible */
export function buildPortMarkers(t: typeof THREE, plans: SetPiecePlan[]): THREE.Group {
  const g = new t.Group();
  const MARK = 0xd8b54a;
  plans.forEach((plan) => {
    plan.ports.forEach((p) => {
      g.add(cyl(t, 0.075, 0.1, 1.1, MARK, [p.at[0], 0.55, p.at[1]], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 10 }));
      g.add(ball(t, 0.16, MARK, [p.at[0], 1.2, p.at[1]], { metal: 0.6, rough: 0.4 }));
      g.add(
        box(t, [0.09, 0.09, 0.8], MARK, [p.at[0] + p.dir[0] * 0.55, 1.0, p.at[1] + p.dir[1] * 0.55], {
          tex: 'metal',
          metal: 0.5,
          rough: 0.5,
          rotY: Math.atan2(p.dir[0], p.dir[1]),
        }),
      );
    });
    const { cx, cz, hx, hz, yaw } = plan.footprint;
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => {
        const w = rotateXZ(yaw, [sx * hx, sz * hz]);
        g.add(cyl(t, 0.05, 0.05, 1.5, 0xb03a30, [cx + w[0], 0.75, cz + w[1]], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 8 }));
      }),
    );
  });
  return g;
}

/** DEBUG composable: `<PortMarkers plans={[...]} />` inside a <ScenePreview> */
export const PortMarkers: React.FC<{ plans: SetPiecePlan[] }> = ({ plans }) => {
  const inScene = useComposable((t) => buildPortMarkers(t, plans), {
    position: [0, 0, 0],
    rotation: 0,
    deps: plans.map((p) => p.key).join('|'),
  });
  if (!inScene) console.warn('<PortMarkers> must be rendered inside a <Park> or <ScenePreview> — nothing mounted');
  return null;
};
