// ---------------------------------------------------------------------------
// ParkBuilder/climate.ts — the shared FOUNDATION layer: deterministic
// randomness (hashed sine), the park constants (WATER_LEVEL / TILE /
// TERRAIN_BASE), the realistic PARK_THEMES palette and the CLIMATE layer
// (temperate | desert | alpine | coastal) that re-seeds palette, water story,
// species mix and zone names.
//
// Everything here is re-exported by ../ParkBuilder — import from
// '../ParkBuilder', never from this file directly.
// ---------------------------------------------------------------------------

// ---- deterministic randomness (hashed sine, as everywhere in this system) --
export const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
export function seeded(seed: number) {
  let i = 0;
  return () => hash01(seed * 91.17 + (i += 1) * 7.13);
}
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** water table height every composed park uses */
export const WATER_LEVEL = -0.26;
/** the RCT2 tile edge — street nodes sit on multiples of it, edges N/S/E/W */
export const TILE = 1.2;
/** base landform for COMPACT plots (size < TERRAIN_STYLE_MIN_SIZE): GENTLE
 *  rolling lawns — the drama comes from the authored hill clusters + water
 *  body. Bigger plots draw a per-seed LANDFORM ARCHETYPE instead
 *  (TERRAIN_STYLES) because one constant base made every large park's lawn
 *  identical. `parkComposition` publishes whichever it used as
 *  `comp.landform`; pass THAT to buildTerrain, not these constants. */
export const TERRAIN_BASE = { amplitude: 0.38, scaleK: 0.52, octaves: 3, roughness: 0.45 };

export const WL = WATER_LEVEL;
export const G = TILE;

/** flood-fill / composition-probe grid pitch for a size-S plot. 0.45 u on the
 *  classic ≤57-u plots (bit-identical), easing to 1.2 u on a 192-u plot: the
 *  probe stays ~25 k samples instead of 180 k, and every composed water body
 *  on a big plot is ≥ 20 u across so a 1.2-u grid still resolves it. The
 *  composition, the guard clamps and validatePark ALL read this — they must
 *  agree on the sampling or the one-water-body rule stops being one rule. */
export const waterGridStep = (S: number) => clamp(S / 128, 0.45, 1.2);

// ---------------------------------------------------------------------------
// LANDFORM ARCHETYPES — the fix for "every park's terrain looks the same".
//
// The base landform used to be ONE constant (TERRAIN_BASE) whose noise
// wavelength scaled WITH the plot (`scale = size * 0.52`), so the fbm term
// spanned barely half a period across any plot at any size: measured over 24
// seeds at size 48 the base field's total relief was 0.08-0.21 u across a
// 48-u plot (σ 0.018-0.037 u) — a dead-flat billiard table in EVERY park,
// with all differentiation coming from a handful of authored hill discs on 7
// fixed slots. These archetypes give each seed its own amplitude, wavelength,
// octave count and roughness, so the ground itself differs park to park.
//
// `scaleK` is the noise wavelength as a FRACTION of the plot, so relief is
// size-invariant in world units (a 192 plot gets the same metres of relief
// spread over 4× the distance — `amplitudeK` below adds it back). Numbers
// come from a measured parameter sweep (`relief` = p100 − p0 over a 64² grid,
// `lobes` = local maxima), not from taste:
//
//   style     amp  scaleK oct rough  relief  lobes  reads as
//   plains    0.38  0.52   3   0.45    0.16    0    the classic flat lawn
//   downs     0.95  0.30   4   0.50    0.67    3    broad rolling hills
//   hollows   1.40  0.30   2   0.35    1.15    1    big open swells + dells
//   ridges    1.80  0.12   3   0.35    2.20    7    corrugated ridge country
//   steppe    1.00  0.08   5   0.62    1.10   28    busy fine-grained upland
//   badlands  1.40  0.05   4   0.62    1.75   38    crinkled arid badlands
// ---------------------------------------------------------------------------

export type TerrainStyle = 'plains' | 'downs' | 'hollows' | 'ridges' | 'steppe' | 'badlands';

export interface TerrainStyleSpec {
  amplitude: number;
  /** noise wavelength as a fraction of the plot edge */
  scaleK: number;
  octaves: number;
  roughness: number;
  /** one-line description (surfaced in the composition log) */
  label: string;
}

export const TERRAIN_STYLES: Record<TerrainStyle, TerrainStyleSpec> = {
  plains: { amplitude: 0.38, scaleK: 0.52, octaves: 3, roughness: 0.45, label: 'flat open plains' },
  downs: { amplitude: 0.95, scaleK: 0.3, octaves: 4, roughness: 0.5, label: 'broad rolling downs' },
  hollows: { amplitude: 1.4, scaleK: 0.3, octaves: 2, roughness: 0.35, label: 'open swells and hollows' },
  ridges: { amplitude: 1.8, scaleK: 0.12, octaves: 3, roughness: 0.35, label: 'corrugated ridge country' },
  steppe: { amplitude: 1.0, scaleK: 0.08, octaves: 5, roughness: 0.62, label: 'fine-grained upland steppe' },
  badlands: { amplitude: 1.4, scaleK: 0.05, octaves: 4, roughness: 0.62, label: 'crinkled arid badlands' },
};

/** plots smaller than this keep TERRAIN_BASE exactly — compact parks were
 *  authored against the flat baseline and stay BIT-IDENTICAL (DemoPark's
 *  size-16 plot, every pinned 16-u park). Archetypes engage from here up. */
export const TERRAIN_STYLE_MIN_SIZE = 24;

/** each climate's 6-slot archetype weighting (a seeded roll indexes it): the
 *  climate biases WHICH landforms it draws, never removes the variety */
export const CLIMATE_TERRAIN_STYLES: Record<ParkClimate, TerrainStyle[]> = {
  temperate: ['downs', 'hollows', 'downs', 'ridges', 'steppe', 'plains'],
  desert: ['badlands', 'steppe', 'plains', 'badlands', 'hollows', 'steppe'],
  alpine: ['ridges', 'ridges', 'downs', 'badlands', 'hollows', 'steppe'],
  coastal: ['hollows', 'downs', 'plains', 'downs', 'hollows', 'steppe'],
};

/** landform amplitude multiplier for the plot size: 1 at the classic 48
 *  (bit-identical), up to 1.9 on a 192 plot so 4× the ground does not read as
 *  4× flatter (relief is otherwise size-invariant in world units) */
export const landformAmplitudeK = (S: number) => clamp(0.55 + 0.45 * (S / 48), 0.55, 1.9);

// ---- themes (realistic palette — muted brick reds, forest greens, navy; no
// orange/pink plastic) --------------------------------------------------------
export interface ParkTheme {
  /** awning + canopy stripe colour */
  stripe: number;
  /** pale canvas colour */
  canvas: number;
  kioskWood: number;
  /** string-light bulb mix (warm by default) */
  lightColors: number[];
  treeMix: ('pine' | 'round')[];
}

export const PARK_THEMES: Record<string, ParkTheme> = {
  temperate: {
    stripe: 0x7d2e28,
    canvas: 0xe8e2d2,
    kioskWood: 0x5b432c,
    lightColors: [0xffd9a0, 0xf2d98c, 0xd8b46a],
    treeMix: ['round', 'pine', 'round'],
  },
  alpine: {
    stripe: 0x2f5d3a,
    canvas: 0xe4ddc8,
    kioskWood: 0x4e3a26,
    lightColors: [0xffd9a0],
    treeMix: ['pine', 'pine', 'round'],
  },
  seaside: {
    stripe: 0x2c4a66,
    canvas: 0xefe9d8,
    kioskWood: 0x54402c,
    lightColors: [0xffd9a0, 0xcfe0e8],
    treeMix: ['round', 'round', 'pine'],
  },
  desert: {
    stripe: 0x8a4a26,
    canvas: 0xe9dfc2,
    kioskWood: 0x6b4a2c,
    lightColors: [0xffd9a0, 0xf2c98c],
    treeMix: ['round', 'round', 'round'],
  },
};

// ---------------------------------------------------------------------------
// CLIMATES — one word that re-seeds the whole composition (hashed from the
// seed when the caller doesn't pick one). A climate biases the terrain
// palette, the ONE water body's kind/size, sand coverage, the scenery species
// mix per zone and the zone NAMES — while the hard composition rules (one
// flood-filled water body, flat entrance apron, authored hill clusters) stay
// enforced by the probe for every climate.
// ---------------------------------------------------------------------------

export type ParkClimate = 'temperate' | 'desert' | 'alpine' | 'coastal';
export const CLIMATES: ParkClimate[] = ['temperate', 'desert', 'alpine', 'coastal'];
/** deterministic climate pick when the composer doesn't choose one */
export const climateOf = (seed: number): ParkClimate => CLIMATES[Math.floor(hash01(seed * 17.77 + 2.9) * 4) % 4];

/** species the climate mixes draw from — 'cactus' means a SceneryPack
 *  `cactusCluster`, the rest are Kit `tree` shapes */
export type TreeSpecies = 'pine' | 'round' | 'palm' | 'cactus';
/** the four themed-land flavours a climate mixes species for */
export type ParkZone = 'mainstreet' | 'lakeside' | 'alpine' | 'fairground';

export interface ClimateSpec {
  /** PARK_THEMES key that matches this climate */
  theme: string;
  /** scales the lake/tarn/oasis radius (rivers scale their bowl radii) */
  lakeScale: number;
  /** probability the water body is a river/lagoon chain instead of a lake */
  riverChance: number;
  /** minimum connected water area, in (S/16)²-scaled u² */
  minWaterU2: number;
  /** add the shallow beach-shelf basin that widens the walkable sand */
  shelf: boolean;
  /** angular beach-ray offsets — more rays = a wider dune/palm flank */
  beachRays: number[];
  /** extra dune discs scattered over open ground (desert) */
  extraDunes: number;
  /** an extra rock outcrop on the hill cluster reads right (alpine/desert) */
  extraRocks: boolean;
  /** taller hills (alpine ridge drama; the coaster guard still caps them) */
  hillBoost: number;
  /** tree count target for a rejection sampler */
  treeTarget: number;
  /** species mix per zone (draw uniformly from the list) */
  mix: Record<ParkZone, TreeSpecies[]>;
  /** themed-land names, hub-and-spoke order */
  zoneNames: { hub: string; water: string; hills: string; fair: string };
  /** vertex-colour bias painted over the terrain (null = stock palette).
   *  `fade: true` eases the tint out toward the waterline so beaches stay
   *  sandy while the lawns re-green (TerrainKit's stock shoreline gradient
   *  sands everything within ~0.9 of the water table — the tint pulls the
   *  upland back to the climate's grass). */
  tint: { grass?: { color: number; k: number; fade?: boolean }; snowAbove?: number } | null;
}

export const CLIMATE_SPECS: Record<ParkClimate, ClimateSpec> = {
  temperate: {
    theme: 'temperate',
    lakeScale: 1,
    riverChance: 0.38,
    minWaterU2: 7,
    shelf: true,
    beachRays: [-0.5, 0, 0.5],
    extraDunes: 0,
    extraRocks: false,
    hillBoost: 0,
    treeTarget: 42,
    mix: {
      mainstreet: ['round', 'pine', 'round'],
      lakeside: ['palm', 'round', 'palm'],
      alpine: ['pine', 'pine', 'round'],
      fairground: ['round', 'round', 'pine'],
    },
    zoneNames: { hub: 'Main Street hub', water: 'Lakeside Boardwalk', hills: 'Alpine Frontier', fair: 'Fairground' },
    tint: { grass: { color: 0x5f7a3e, k: 0.5, fade: true } },
  },
  desert: {
    // Dynamite Dunes: ONE oasis, sand almost everywhere, palms only at the
    // water, cacti and rock out on the flats
    theme: 'desert',
    lakeScale: 0.62,
    riverChance: 0,
    minWaterU2: 2.2,
    shelf: true,
    beachRays: [-0.7, 0, 0.7],
    extraDunes: 10,
    extraRocks: true,
    hillBoost: 0,
    treeTarget: 26,
    mix: {
      mainstreet: ['palm', 'cactus', 'round'],
      lakeside: ['palm', 'palm', 'round'],
      alpine: ['cactus', 'cactus', 'pine'],
      fairground: ['cactus', 'round', 'cactus'],
    },
    zoneNames: { hub: 'Main Street hub', water: 'Oasis Boardwalk', hills: 'Mesa Frontier', fair: 'Dune Fairground' },
    tint: { grass: { color: 0xc2a878, k: 0.6 } },
  },
  alpine: {
    // Diamond Heights: a small dark tarn, no beach, pine forest, rock
    // outcrops and snow dusting the summits
    theme: 'alpine',
    lakeScale: 0.7,
    riverChance: 0,
    minWaterU2: 3.2,
    shelf: false,
    beachRays: [],
    extraDunes: 0,
    extraRocks: true,
    hillBoost: 0.5,
    treeTarget: 46,
    mix: {
      mainstreet: ['pine', 'pine', 'round'],
      lakeside: ['pine', 'round', 'pine'],
      alpine: ['pine', 'pine', 'pine'],
      fairground: ['pine', 'round', 'pine'],
    },
    zoneNames: { hub: 'Main Street hub', water: 'Tarn Promenade', hills: 'Summit Frontier', fair: 'Meadow Fairground' },
    tint: { grass: { color: 0x54683f, k: 0.6, fade: true }, snowAbove: 1.35 },
  },
  coastal: {
    // Bumbly Beach: the water dominates one flank (often a lagoon chain),
    // a wide palm-lined beach, lush lawns behind it
    theme: 'seaside',
    lakeScale: 1.12,
    riverChance: 0.55,
    minWaterU2: 8,
    shelf: true,
    beachRays: [-0.9, -0.45, 0, 0.45, 0.9],
    extraDunes: 0,
    extraRocks: false,
    hillBoost: 0,
    treeTarget: 40,
    mix: {
      mainstreet: ['round', 'palm', 'round'],
      lakeside: ['palm', 'palm', 'round'],
      alpine: ['pine', 'round', 'pine'],
      fairground: ['round', 'palm', 'round'],
    },
    zoneNames: { hub: 'Main Street hub', water: 'Boardwalk Bay', hills: 'Headland Frontier', fair: 'Seaside Fairground' },
    tint: { grass: { color: 0x4e7f3a, k: 0.55, fade: true } },
  },
};

// ---- small geometry helpers -------------------------------------------------
export function segDist(ax: number, az: number, bx: number, bz: number, x: number, z: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  let u = ((x - ax) * dx + (z - az) * dz) / len2;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(ax + dx * u - x, az + dz * u - z);
}
