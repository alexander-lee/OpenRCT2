// ---------------------------------------------------------------------------
// ParkBuilder — park COMPOSITION UTILITIES + the validatePark ACCEPTANCE GATE.
//
// This module does NOT generate parks. YOU (the agent) design every park —
// rules/park-generation.md is the recipe book, and the ParkBuilder preview
// (ParkBuilder.previews.tsx) is a compact worked example of the whole
// compose-then-validate workflow. What ships here:
//
//   - parkComposition(t, seed, size, climate?, guards?) — RCT2-scenario-style
//     TERRAIN + CLIMATE seeding: authored hill clusters, ONE flood-filled
//     water body, a beach flank, a flat entrance apron — PROBED over
//     deterministic terrain-noise seeds until the rules hold.
//   - climateOf / CLIMATES / CLIMATE_SPECS / PARK_THEMES — the climate layer
//     (temperate | desert | alpine | coastal) that re-seeds palette, water
//     story, species mix and zone names.
//   - tintTerrainForClimate — the climate vertex-palette bias + (given the
//     composition) the terrain-SECTION zone paint (sand/meadow/rock/forest).
//   - dressTerrain — deterministic auto-dressing of the sections: forest
//     tree clusters, mountain rock outcrops + scree, beach dunes/palms
//     (<Terrain> mounts it automatically for every composed park).
//   - placement helpers: terrainLint (isDry/slope/in-bounds), planRideAccess
//     + laneLenOf (GameManager-compatible queue/hut/exit planning),
//     bermNetToGround / plinthUnder / groundRideAccess (settle structures to
//     terrain so nothing ever floats).
//   - validatePark — the acceptance gate EVERY park must pass before it
//     "opens": accessibility, terrain vibe, footprint sweep, coaster
//     legality + crash-free margin, GameManager sim smoke, budget +
//     determinism.
//
// THE RCT2 PARK VIBE (research: the original scenario roster in
// scenario/ScenarioSources.cpp — Forest Frontiers, Dynamite Dunes, Leafy
// Lake, Diamond Heights, Evergreen Gardens, Bumbly Beach, Trinity Islands,
// Katie's Dreamland... — plus the canonical layouts of those classic parks):
//   - MOSTLY GENTLE, BUILDABLE TERRAIN: rolling lawns you could put a ride
//     on almost anywhere. Relief is never uniform noise-everywhere.
//   - DELIBERATE MOUNTAIN RANGES (a per-seed archetype: one alpine ridge /
//     rolling hills / a lone sentinel peak / twin ranges) pushed to the
//     edges and corners — the coaster hugs them, guests don't climb, and
//     the front apron/gate is never buried.
//   - ONE DOMINANT WATER BODY, never a scatter of ponds — its character
//     varies per seed: a big central lake, a corner lagoon with a beach, a
//     winding river inlet or the classic flank lake.
//   - A SAND/BEACH FLANK adjoining the water on one side.
//   - A FLAT FRONT APRON with the park entrance CENTRED on it.
//   - RIDES GROUPED IN RECOGNIZABLE THEMED LANDS, hub-and-spoke.
// Fully deterministic: same seed → same composition (hashed-sine only).
// ---------------------------------------------------------------------------


// SPLIT LAYOUT (this file is the PUBLIC API — always import from
// '../ParkBuilder'; the sibling modules are implementation detail):
//   climate.ts     — constants, deterministic helpers, PARK_THEMES, climates
//   composition.ts — parkComposition + composition types + clamp/reclamp
//   dressing.ts    — tintTerrainForClimate + dressTerrain
//   placement.ts   — terrainLint / access planning / settle helpers / obbOverlap
//   validate.ts    — validatePark + its types
// ---------------------------------------------------------------------------

export {
  WATER_LEVEL,
  TILE,
  TERRAIN_BASE,
  PARK_THEMES,
  CLIMATES,
  climateOf,
  CLIMATE_SPECS,
  waterGridStep,
  TERRAIN_STYLES,
  TERRAIN_STYLE_MIN_SIZE,
  CLIMATE_TERRAIN_STYLES,
  landformAmplitudeK,
} from './climate';
export type { ParkTheme, ParkClimate, TreeSpecies, ParkZone, ClimateSpec, TerrainStyle, TerrainStyleSpec } from './climate';

export { parkComposition, reclampTerrain } from './composition';
export type {
  HillCluster,
  TerrainZoneKind,
  TerrainZone,
  WaterStyle,
  MountainStyle,
  CompositionGuards,
  ParkComposition,
  ParkLandform,
  ReclampReport,
} from './composition';

export { tintTerrainForClimate, dressTerrain, surroundPalette } from './dressing';
export type { DressCounts, DressResult } from './dressing';

export {
  terrainLint,
  laneLenOf,
  planRideAccess,
  bermNetToGround,
  plinthUnder,
  groundRideAccess,
  obbOverlap,
  // round-7 placement SUGGESTION API (rules §0.14) — ask instead of guessing
  pathClearance,
  offPathCell,
} from './placement';
export type { RideAccess, ParkFootRect, StreetLattice, PathClearance, OffPathCellOpts } from './placement';

export { SIM_SMOKE_SECONDS, validatePark } from './validate';
export type {
  ParkValidationFailure,
  ParkValidationWarning,
  ParkValidationReport,
  ValidateParkManager,
  ValidateParkInput,
} from './validate';
