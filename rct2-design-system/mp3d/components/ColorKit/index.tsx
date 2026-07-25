import React from 'react';
import * as THREE from 'three';
import { box, cyl } from '../Stage';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// ColorKit — RCT2's ride colour system for the 3D rigs. OpenRCT2 models ride
// colours as two little structs:
//   TrackColour  { main, additional, supports }   — ride/RideColour.h:19-24
//   VehicleColour{ Body, Trim, Tertiary }         — ride/VehicleColour.h:19-24
// picked from per-ride-type preset lists declared with the
// TRACK_COLOUR_PRESETS macro (ride/RideData.h:12-18, TrackColourPresetList in
// ride/RideEntry.h:30-33). The colour VALUES are ids into the game palette —
// the 54-entry dropdown enum in drawing/Colour.h:22-83 (kColourNumNormal = 54,
// Colour.h:85). This kit exports that palette as hex RGBs, the two scheme
// shapes, and rideColourPreset() — a deterministic seeded pick from per-type
// preset lists transcribed from the real ride-type tables (cited below).
// ---------------------------------------------------------------------------

/**
 * The RCT2 colour dropdown palette, in drawing/Colour.h:22-83 order (32
 * original + 22 extended = kColourNumNormal 54). The enum in source carries no
 * RGB values (those live in the g1.dat game palette), so these are faithful
 * hex approximations of each palette ramp's mid tone.
 */
export const RCT2_COLOURS: Record<string, number> = {
  // Original colours — drawing/Colour.h:24-56
  black: 0x232425,
  grey: 0x8f8f8f,
  white: 0xebebeb,
  darkPurple: 0x712b7c,
  lightPurple: 0xa878c0,
  brightPurple: 0xb43fb4,
  darkBlue: 0x1c3f8f,
  lightBlue: 0x66a8d3,
  icyBlue: 0xa8d8e4,
  darkWater: 0x1c6480,
  lightWater: 0x4c93b4,
  saturatedGreen: 0x1c8434,
  darkGreen: 0x175424,
  mossGreen: 0x5c8f4c,
  brightGreen: 0x40c020,
  oliveGreen: 0x6f7834,
  darkOliveGreen: 0x4a5024,
  brightYellow: 0xf4e720,
  yellow: 0xe4c716,
  darkYellow: 0xa88c14,
  lightOrange: 0xf49414,
  darkOrange: 0xc46414,
  lightBrown: 0xa87444,
  saturatedBrown: 0x8f5836,
  darkBrown: 0x5f4023,
  salmonPink: 0xe89ca0,
  bordeauxRed: 0x7c1c2c,
  saturatedRed: 0xa82430,
  brightRed: 0xd42c24,
  darkPink: 0xc44880,
  brightPink: 0xf460a0,
  lightPink: 0xf4a8c8,
  // Extended colour set — drawing/Colour.h:58-80
  armyGreen: 0x54542c,
  honeyDew: 0xe0ecc8,
  tan: 0xc8a878,
  maroon: 0x701c1c,
  coralPink: 0xe87464,
  forestGreen: 0x1f5c2c,
  chartreuse: 0x9cc41c,
  hunterGreen: 0x2c4c34,
  celadon: 0xa8c8a0,
  limeGreen: 0x70dc40,
  sepia: 0x6c5844,
  peach: 0xf4c898,
  periwinkle: 0x8890d8,
  viridian: 0x348c74,
  seafoamGreen: 0x70c4a8,
  violet: 0x6c34a8,
  lavender: 0xb49cd8,
  pastelOrange: 0xf4b46c,
  deepWater: 0x14384c,
  pastelPink: 0xf0c4d0,
  umber: 0x7c5c34,
  beige: 0xd8ccb4,
};

/** RCT2 TrackColour — ride/RideColour.h:19-24 (main/additional/supports). */
export interface TrackScheme {
  main: number;
  additional: number;
  supports: number;
}

/** RCT2 VehicleColour — ride/VehicleColour.h:19-24 (Body/Trim/Tertiary). */
export interface VehicleScheme {
  body: number;
  trim: number;
  tertiary: number;
}

export interface RideColourScheme {
  track: TrackScheme;
  vehicles: VehicleScheme[];
}

/** Multiply a hex colour by `f` — derives skirt/shadow tones from a scheme. */
export function shade(c: number, f: number): number {
  const ch = (x: number) => Math.max(0, Math.min(255, Math.round(x * f)));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

// deterministic seed hash — same recipe as SplineRideKit's hashN
const fract = (x: number) => x - Math.floor(x);
export function hash01(seed: number): number {
  return fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453);
}

export type RidePresetType = 'wooden' | 'steel' | 'water' | 'kart';

const C = RCT2_COLOURS;
const T = (main: number, additional: number, supports: number): TrackScheme => ({ main, additional, supports });
const V = (body: number, trim: number, tertiary: number): VehicleScheme => ({ body, trim, tertiary });

/**
 * Per-type preset lists, transcribed from the real ride-type tables. Track
 * triples are verbatim RCT2 presets; the paired vehicle schemes are tasteful
 * realistic liveries in the same key (RCT2 keeps vehicle presets in the
 * separate ride-entry .DAT objects, which aren't in the source tree).
 */
const PRESETS: Record<RidePresetType, RideColourScheme[]> = {
  // Wooden coaster — ride/rtd/coaster/WoodenRollerCoaster.h:52-59
  wooden: [
    { track: T(C.bordeauxRed, C.black, C.white), vehicles: [V(C.bordeauxRed, C.white, C.black)] },
    { track: T(C.brightRed, C.black, C.grey), vehicles: [V(C.brightRed, C.grey, C.black)] },
    { track: T(C.yellow, C.darkBrown, C.darkBrown), vehicles: [V(C.yellow, C.darkBrown, C.black)] },
    { track: T(C.darkWater, C.bordeauxRed, C.white), vehicles: [V(C.darkWater, C.white, C.bordeauxRed)] },
    { track: T(C.lightBlue, C.black, C.black), vehicles: [V(C.lightBlue, C.white, C.black)] },
    { track: T(C.lightBlue, C.black, C.darkBrown), vehicles: [V(C.lightBlue, C.darkBrown, C.black)] },
    { track: T(C.tan, C.sepia, C.lightBrown), vehicles: [V(C.sepia, C.tan, C.umber)] }, // "Generic GCI"
    { track: T(C.sepia, C.umber, C.grey), vehicles: [V(C.sepia, C.beige, C.umber)] }, // "The Voyage"
  ],
  // Steel — Twister ride/rtd/coaster/TwisterRollerCoaster.h:53-59 (incl. the
  // named "Scream" / "Rougarou" schemes) + Bobsleigh coaster
  // ride/rtd/coaster/BobsleighCoaster.h:50-53 (incl. "Reptilian")
  steel: [
    { track: T(C.yellow, C.yellow, C.bordeauxRed), vehicles: [V(C.bordeauxRed, C.yellow, C.black)] },
    { track: T(C.lightWater, C.lightWater, C.darkPurple), vehicles: [V(C.darkPurple, C.lightWater, C.white)] },
    { track: T(C.white, C.white, C.lightBlue), vehicles: [V(C.lightBlue, C.white, C.darkBlue)] },
    { track: T(C.darkGreen, C.mossGreen, C.darkBrown), vehicles: [V(C.darkGreen, C.mossGreen, C.black)] },
    { track: T(C.bordeauxRed, C.lightOrange, C.white), vehicles: [V(C.bordeauxRed, C.lightOrange, C.white)] },
    { track: T(C.lightBlue, C.yellow, C.darkPink), vehicles: [V(C.lightBlue, C.yellow, C.black)] }, // "Scream"
    { track: T(C.darkOrange, C.darkOrange, C.black), vehicles: [V(C.darkOrange, C.black, C.grey)] }, // "Rougarou"
    { track: T(C.white, C.brightRed, C.white), vehicles: [V(C.white, C.brightRed, C.black)] }, // bobsleigh
    { track: T(C.lightBlue, C.white, C.black), vehicles: [V(C.lightBlue, C.white, C.black)] }, // bobsleigh
    { track: T(C.sepia, C.darkOrange, C.beige), vehicles: [V(C.sepia, C.darkOrange, C.beige)] }, // "Reptilian"
  ],
  // Water — Log Flume ride/rtd/water/LogFlume.h:53-54 + River Rapids
  // ride/rtd/water/RiverRapids.h:54, padded with naturals in the same spirit
  water: [
    { track: T(C.darkBrown, C.darkBrown, C.grey), vehicles: [V(C.saturatedBrown, C.beige, C.darkBrown)] },
    { track: T(C.oliveGreen, C.black, C.grey), vehicles: [V(C.saturatedBrown, C.beige, C.black)] },
    { track: T(C.white, C.black, C.darkBrown), vehicles: [V(C.brightRed, C.yellow, C.black)] },
    { track: T(C.darkWater, C.grey, C.darkBrown), vehicles: [V(C.darkWater, C.white, C.grey)] },
    { track: T(C.darkGreen, C.darkBrown, C.darkBrown), vehicles: [V(C.oliveGreen, C.tan, C.darkBrown)] },
    { track: T(C.saturatedBrown, C.darkBrown, C.grey), vehicles: [V(C.saturatedBrown, C.tan, C.darkBrown)] },
  ],
  // Karts — ride/rtd/thrill/GoKarts.h:51-54: the four track presets double as
  // the classic fleet liveries, so every kart preset carries a 4-kart fleet
  kart: [
    {
      track: T(C.bordeauxRed, C.bordeauxRed, C.darkBrown), // classic RCT2 fleet
      vehicles: [V(C.bordeauxRed, C.white, C.black), V(C.yellow, C.black, C.bordeauxRed), V(C.darkGreen, C.white, C.black), V(C.darkBrown, C.tan, C.black)],
    },
    {
      track: T(C.yellow, C.yellow, C.bordeauxRed),
      vehicles: [V(C.yellow, C.black, C.bordeauxRed), V(C.brightRed, C.white, C.black), V(C.lightBlue, C.white, C.darkBlue), V(C.white, C.brightRed, C.black)],
    },
    {
      track: T(C.darkGreen, C.darkGreen, C.darkGreen),
      vehicles: [V(C.darkGreen, C.white, C.black), V(C.mossGreen, C.black, C.darkGreen), V(C.white, C.darkGreen, C.black), V(C.yellow, C.darkGreen, C.black)],
    },
    {
      track: T(C.darkBrown, C.darkBrown, C.black),
      vehicles: [V(C.darkBrown, C.tan, C.black), V(C.saturatedBrown, C.beige, C.black), V(C.sepia, C.tan, C.umber), V(C.umber, C.beige, C.black)],
    },
    {
      track: T(C.grey, C.brightRed, C.black), // race-day brights
      vehicles: [V(C.brightRed, C.white, C.black), V(C.darkBlue, C.white, C.black), V(C.yellow, C.black, C.grey), V(C.white, C.black, C.brightRed)],
    },
    {
      track: T(C.black, C.white, C.grey), // monochrome circuit
      vehicles: [V(C.white, C.black, C.grey), V(C.grey, C.white, C.black), V(C.black, C.white, C.grey), V(C.saturatedRed, C.white, C.black)],
    },
  ],
};

/**
 * Deterministic seeded pick from the per-type preset lists — the 3D analogue
 * of RCT2 rolling a scheme from a ride type's TRACK_COLOUR_PRESETS table
 * (ride/RideData.h:12-18) when a ride is built. Same seed + type always
 * returns the same scheme; the result is a fresh copy, safe to mutate.
 */
export function rideColourPreset(seed: number, type: RidePresetType = 'steel'): RideColourScheme {
  const list = PRESETS[type];
  const p = list[Math.floor(hash01(seed) * list.length) % list.length];
  return { track: { ...p.track }, vehicles: p.vehicles.map((v) => ({ ...v })) };
}

// ---------------------------------------------------------------------------
// Preview — a swatch wall: the 54-colour dropdown palette as painted cubes,
// plus four seeded scheme cards (wooden/steel/water/kart) rendered as track
// stubs (rails=main, ties=additional, posts=supports) with body/trim/tertiary
// vehicle cubes in front.
// ---------------------------------------------------------------------------
export function buildColorKitScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // palette wall: 54 cubes, 9 per row, in Colour.h:22-83 order
        const names = Object.keys(RCT2_COLOURS);
        const COLS = 9;
        const S = 0.42;
        names.forEach((name, i) => {
          const cx = ((i % COLS) - (COLS - 1) / 2) * (S + 0.1);
          const cy = 0.55 + (Math.floor(names.length / COLS) - 1 - Math.floor(i / COLS)) * (S + 0.1);
          g.add(box(t, [S, S, 0.16], RCT2_COLOURS[name], [cx, cy, -1.6], { tex: 'plastic', rough: 0.45 }));
        });
        // wall backboard + posts so the swatches read as a display
        g.add(box(t, [COLS * (S + 0.1) + 0.3, 6 * (S + 0.1) + 0.3, 0.06], 0x4a4e55, [0, 0.55 + 2.5 * (S + 0.1), -1.72], { tex: 'metal', metal: 0.4, rough: 0.6 }));
        [-1, 1].forEach((s) => g.add(cyl(t, 0.05, 0.06, 1.9, 0x6b7078, [s * (COLS * (S + 0.1)) * 0.5, 0.95, -1.72], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 10 })));

        // four seeded scheme cards: track stub + vehicle swatch trio
        const types: RidePresetType[] = ['wooden', 'steel', 'water', 'kart'];
        types.forEach((type, i) => {
          const scheme = rideColourPreset(i + 1, type);
          const card = new t.Group();
          card.position.set((i - 1.5) * 2.2, 0, 0.9);
          // concrete plinth
          card.add(box(t, [1.9, 0.08, 1.3], 0x8a8578, [0, 0.04, 0], { tex: 'concrete', rough: 0.95 }));
          // track stub: two support posts, ties, twin rails
          [-0.45, 0.45].forEach((z) =>
            card.add(cyl(t, 0.05, 0.06, 0.5, scheme.track.supports, [0, 0.33, z], { tex: 'metal', metal: 0.4, rough: 0.5, seg: 10 })),
          );
          for (let k = 0; k < 5; k++)
            card.add(box(t, [0.96, 0.05, 0.12], scheme.track.additional, [0, 0.6, -0.5 + k * 0.25], { tex: 'wood', repeat: [3, 1], rough: 0.85 }));
          [-0.34, 0.34].forEach((x) => card.add(box(t, [0.07, 0.07, 1.24], scheme.track.main, [x, 0.66, 0], { tex: 'metal', repeat: [1, 8], metal: 0.7, rough: 0.35 })));
          // vehicle scheme: body/trim/tertiary cubes on the plinth front
          const v = scheme.vehicles[0];
          [v.body, v.trim, v.tertiary].forEach((c, k) =>
            card.add(box(t, [0.3, 0.3, 0.3], c, [(k - 1) * 0.42, 0.23, 0.42], { tex: 'plastic', rough: 0.4 })),
          );
          g.add(card);
        });
      })(three, group) || undefined;
  return { group, update };
}

/** <ColorKit> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const ColorKit = composable('ColorKit', (t) => buildColorKitScene(t));
