import React from 'react';
import * as THREE from 'three';
import { box, mat } from '../Stage';
import { buildWater } from '../WaterTile';
import { buildRock } from '../Rock';
import { composable } from '../Park';

// Sculpted terrain heightfield ported from the reference park kit: a displaced
// PlaneGeometry driven by deterministic FBM value-noise (hashed sines — no
// Math.random), plus authored peaks (hills) and basins (lake bowls carved
// below the water level). `heightAt` is the single source of ground truth so
// rocks, trees and rides can conform to the same surface the mesh renders.
// Colouring follows the reference shoreline gradient — mud under water, a
// foam-lapped waterline, dry sand easing into grass over the first rise, and
// grey rock strata on steep slopes — realised as smoothed vertex colours over
// our procedural grass bump texture.

// ---- deterministic noise (ported from the reference heightfield) -----------

function vnoise(x: number, z: number, seed: number): number {
  const a = Math.sin(x * 0.42 + seed * 1.73) * Math.cos(z * 0.37 - seed * 0.91);
  const b = Math.sin((x + z) * 0.83 + seed * 2.11) * 0.45;
  const c = Math.cos(x * 1.47 - z * 1.13 + seed) * 0.18;
  return (a + b + c) / 1.63;
}

function fbm(x: number, z: number, seed: number, octaves: number, roughness: number): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += vnoise(x * freq + o * 13.7, z * freq - o * 7.3, seed + o * 17) * amp;
    norm += amp;
    amp *= roughness;
    freq *= 2.13;
  }
  return norm > 0 ? sum / norm : 0;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoother = (v: number) => {
  const c = clamp01(v);
  return c * c * c * (c * (c * 6 - 15) + 10);
};

type RGB = [number, number, number];
/** sRGB → linear-sRGB transfer function (three.js's own `SRGBToLinear`) */
const srgbToLinear = (c: number) => (c < 0.04045 ? c * 0.0773993808 : ((c + 0.055) / 1.055) ** 2.4);
/**
 * A PALETTE HEX AS A VERTEX COLOUR — decoded to the renderer's LINEAR working
 * space (2026-07 fix).
 *
 * This used to be a plain `byte / 255`, which fed sRGB numbers into a buffer
 * three.js treats as already-linear. `three.ColorManagement` is enabled by
 * default in r152+, so every OTHER surface in a park — every `mat()` material,
 * every `new Color(hex)` — IS decoded, and the terrain was the one thing in the
 * scene rendering its palette uncorrected. The visible effect is exactly the
 * complaint that started this work: 0x5f7a3e ("grass green", rgb 95/122/62)
 * came out of the pipeline at rgb 166/184/135 — a pale sage — so the lawn read
 * as a bleached clay slab while the trees standing on it read as proper greens.
 * Decoding here makes the ground match the rest of the park, and the palette
 * hexes now mean what they say.
 */
const col = (hex: number): RGB => [
  srgbToLinear(((hex >> 16) & 255) / 255),
  srgbToLinear(((hex >> 8) & 255) / 255),
  srgbToLinear((hex & 255) / 255),
];
/** the same decode, exported for the climate TINT layer (ParkBuilder/dressing)
 *  — it mixes its own palette INTO these vertex colours, so the two must agree
 *  on the colour space or the tint drags the ground back toward pale */
export const terrainPaletteRGB = col;
const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = clamp01(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

// realistic temperate palette (no orange/pink)
const GRASS = col(0x5f7a3e);
const DRY = col(0x87975a);
const LUSH = col(0x4e7f3a);
// ---- TURF TONES (2026-07 grass rework) ------------------------------------
// The lawn used to be ONE flat tone per altitude band, which is why it read as
// a pale clay slab: a single `GRASS` value, a ±2% index dither, and a colour
// map that was deliberately deleted (`groundMat.map = null`) to stop the green
// grass texture staining sand and rock. So the ground had NO colour variation
// above the noise floor and NO sub-vertex detail at all — at any distance it
// was a solid fill. The rework gives it four things, all realistic-green (RCT2
// palette discipline; nothing neon):
//   1. PATCHINESS — three octaves of the same deterministic value noise the
//      heightfield uses, at 2-14 u wavelengths, mixing between a pale/yellow
//      turf and a dark/blue-green turf. This is the variation you read from the
//      orbit camera.
//   2. HOLLOWS DAMP, CRESTS BLEACHED — the vertex's height relative to the
//      ground ±6 u away. Water collects in dips (darker, lusher) and drains off
//      rises (paler, drier). It is the cue that makes relief legible.
//   3. FINE GRAIN — a positional hash per vertex (0.45 u pitch on a composed
//      plot), replacing the old row-major INDEX dither, which laid a visible
//      diagonal moiré across the flats instead of grain.
//   4. A NEUTRAL-GREY TURF DETAIL MAP (`turfTexture` below) as both colour map
//      and bump map. Being grey it MULTIPLIES the vertex tone instead of
//      replacing it, so sand stays sand and rock stays rock — which is what the
//      old `map = null` was protecting, achieved without giving up the detail.
/** pale, sun-bleached turf — crests and dry patches. Deliberately a STRAW-GREEN
 *  rather than a light grey-green: the first pass used 0x7d8c50 and the render
 *  grew round whitish blotches that read as bald patches in a lawn. */
const TURF_PALE = col(0x71833f);
/** dark blue-green turf — hollows, damp ground, shaded patches. The dark end of
 *  the variation carries far more of the "this is grass" read than the pale end,
 *  so it is mixed harder. */
const TURF_DARK = col(0x47612d);
/** the damp lush green of a genuine dip */
const TURF_DAMP = col(0x44702c);
const SAND = col(0xcfb98a);
const MUD = col(0x6d5c43);
// submerged ground (2026-07 water rework): the old slate MUD basin read as
// grey dead patches through the transparent water — the lake floor now runs
// aqua-teal at depth into bright sand at the waterline (tropical shallows)
const BASIN = col(0x4fb0c2);
const FOAM: RGB = col(0xedf5ed);
const ROCK1 = col(0x7b786f);
const ROCK2 = col(0x6b675c);
const MUD_HEX = 0x6d5c43;

export interface PeakZone {
  x: number;
  z: number;
  height: number;
  radius: number;
}

export interface BasinZone {
  x: number;
  z: number;
  radius: number;
  depth: number;
}

export interface TerrainOpts {
  /** square tile size, world units (default 12) */
  size?: number;
  /** mesh segments per side (default 96) */
  seg?: number;
  seed?: number;
  /** rolling-hill amplitude (default 1.1) */
  amplitude?: number;
  /** noise wavelength — bigger = broader hills (default 4.5) */
  scale?: number;
  /** FBM octaves 1-6 (default 4) */
  octaves?: number;
  /** per-octave falloff (default 0.5) */
  roughness?: number;
  /** water table height; null = dry tile (default -0.32) */
  waterLevel?: number | null;
  /** hills added to the landform */
  peaks?: PeakZone[];
  /** lake bowls carved below the landform */
  basins?: BasinZone[];
  /** firm shore: softly FLOOR the ground just above the waterline everywhere
   *  OUTSIDE the authored basins' influence, so raw noise can never pool
   *  stray puddles on the lawns — the AUTHORED basins stay the only water
   *  (one body up to a 48-u plot, two on the composed default — see
   *  ParkBuilder's `waterBodyTarget`). Composed parks turn this on
   *  (ParkBuilder/<Terrain>); default off keeps standalone tiles bit-identical. */
  firmShore?: boolean;
  /** RELIEF BIAS — modulate the fbm landform (never the authored peaks or
   *  basins) by Chebyshev radius `max(|x|,|z|)`: scaled by `inner` inside
   *  `r0`, easing to full amplitude by `r1`. Keeps the park core gentle and
   *  buildable while the flanks carry the archetype's real drama. */
  reliefBias?: { r0: number; r1: number; inner: number };
  /** perimeter MUD SKIRT (default true): four thin walls around the plot so
   *  carved ground never reads see-through from a low camera. Pass `false`
   *  when a `buildSurround` ring continues the land past the plot — the walls
   *  then only draw a dark OUTLINE around the map, which is exactly the "the
   *  world ends here" read the surround exists to remove. */
  edgeSkirt?: boolean;
  /** FLAT POCKETS — rectangles where the fbm landform is scaled by `k`
   *  (easing out over `blend`), for ground that must stay level whatever the
   *  landform archetype: the entrance forecourt/apron above all. */
  flatSpots?: { x: number; z: number; rx: number; rz: number; k: number; blend: number }[];
}

// ---------------------------------------------------------------------------
// turfTexture — the TURF DETAIL MAP (2026-07 grass rework)
//
// A tileable NEUTRAL-GREY luminance map, generated per pixel from periodic
// value noise (no `Math.random`, no canvas 2-D drawing — the same hashed-sine
// determinism as the heightfield, and it survives the headless harness's DOM
// stub). It carries three scales at once:
//   - broad mottle (4 and 11 cycles per tile) — clumping in the turf;
//   - a STRETCHED streak field (13 × 74 cycles) — blade direction, the thing
//     that stops a ground-level shot reading as a solid fill;
//   - fine grain (61 cycles) — the last stop before the mip chain eats it.
//
// It is GREY on purpose. Applied as `map` on a `vertexColors` material it
// MULTIPLIES the vertex tone, so grass keeps its greens, sand its cream and
// rock its slate — the exact staining problem the previous code avoided by
// throwing the colour map away entirely. Its mean luminance is measured at
// build time and cancelled out in `material.color` (a Color is a plain float3
// uniform, so a value > 1 is legal), which means adding the map does not
// darken the park by the map's average — the tone stays exactly where the
// vertex colours put it, and only the VARIATION is new.
//
// Cost: ONE 512² canvas, built once per process and shared by every terrain
// (the per-repeat THREE.Texture wrappers share the same canvas), reused as the
// bump map so there is no second upload.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// HOW STRONG MAY A DETAIL MAP BE? (2026-07, the "pixelated and noisy" pass)
//
// The number that matters is NOT the map's byte range — it is the RMS of the
// multiplier the map applies to `diffuseColor` IN LINEAR SPACE, because that is
// what the eye reads as albedo variation. Measured on the previous build:
//
//   macro map  byte 66-255, sd 0.132/0.656 in sRGB  ->  linear multiplier
//              0.13 .. 2.44, sd 0.433   (sRGB decode roughly DOUBLES relative
//              contrast — a 20% sRGB swing is a 43% linear one)
//   blade map  mixed at 0.85            ->  multiplier 0.25 .. 1.85, sd 0.275
//   the two MULTIPLY                    ->  combined albedo sd 0.53
//
// A 53% RMS albedo swing per texel is not turf, it is static, and that is
// exactly what the render showed: green tweed from the nadir, camouflage at mid
// distance. The budget is now sd ≈ 0.16 combined (0.136 macro × 0.078 blade),
// with all the BROAD variation still carried by the world-keyed vertex
// patchiness — which never repeats and cannot alias, because it is per-vertex
// on a 0.45-u mesh, not per-texel.
//
// If you ever retune these, measure the multiplier sd, not the byte range: a
// 123-195 byte range looks "wasteful" and is correct here.
// ---------------------------------------------------------------------------
const TURF_TEX_S = 1024;
/** world units one turf tile spans. 12 u over a 1024² canvas puts 85 texels/u
 *  on the tile (was 43 at 512²) — at the closest camera we render, 2.6 u out,
 *  a world unit is ~500 screen pixels, so a texel covers 6 screen px instead of
 *  12, and none of the map's CONTENT is anywhere near texel scale any more.
 *  The REPEAT stays rare enough not to read. (8 u was the
 *  first choice and the nadir shot showed a faint 8-u banding lattice across the
 *  whole plot: with a 128-u plot that is 16 repeats per edge, and any residual
 *  per-tile signature lines up 16 times in a row. Fewer, larger repeats plus a
 *  streak term pulled back are what dissolved it.) */
const TURF_TILE_U = 12;
let _turfCanvas: HTMLCanvasElement | null = null;
let _turfMean = 1;
/** periodic value noise on an integer lattice of period `p` — tiles exactly */
function pnoise(u: number, v: number, p: number, seed: number): number {
  const x = u * p;
  const z = v * p;
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const at = (a: number, b: number) => {
    const wa = ((a % p) + p) % p;
    const wb = ((b % p) + p) % p;
    const s = Math.sin((wa * 127.1 + wb * 311.7 + seed * 74.7) * 0.9153) * 43758.5453;
    return s - Math.floor(s);
  };
  const n00 = at(i, j);
  const n10 = at(i + 1, j);
  const n01 = at(i, j + 1);
  const n11 = at(i + 1, j + 1);
  return (n00 + (n10 - n00) * sx) * (1 - sz) + (n01 + (n11 - n01) * sx) * sz;
}
function turfCanvas(): { canvas: HTMLCanvasElement | null; mean: number } {
  if (_turfCanvas) return { canvas: _turfCanvas, mean: _turfMean };
  if (typeof document === 'undefined') return { canvas: null, mean: 1 };
  const S = TURF_TEX_S;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x2 = c.getContext('2d');
  if (!x2) return { canvas: null, mean: 1 };
  // `getImageData`/`putImageData` (not per-pixel fillRect): 262 144 draw calls
  // would take seconds. Under the headless harness's canvas stub both are
  // no-ops on a short buffer and out-of-range typed-array writes are silently
  // dropped, so this stays safe there too.
  const img = x2.getImageData(0, 0, S, S);
  const data = img.data;
  let sum = 0;
  for (let py = 0; py < S; py += 1) {
    const v = py / S;
    for (let px = 0; px < S; px += 1) {
      const u = px / S;
      // EVERY TERM IS CENTRED (`n − 0.5`) BEFORE IT IS WEIGHTED — bilinear value
      // noise sits tightly around 0.5, so weighting the RAW noise only shifts
      // the mean and leaves no contrast at all (the first version of this map
      // measured 148-222 of 255 and rendered as a flat fill).
      //
      // DO NOT "FIX" THE BYTE RANGE. It is 123-195 by design and the temptation
      // to push it to 0-255 is what produced the render the user called noisy:
      // the map is a MULTIPLIER on an already-correct vertex colour, and after
      // the sRGB decode a 123-195 byte range is already a 0.58 .. 1.59 swing.
      // The budget note above `TURF_TEX_S` has the arithmetic.
      // NOTHING BELOW ~11 CYCLES PER TILE. Two rounds of measurement here:
      // first the raw (uncentred) noise gave no contrast at all; then a
      // 4-cycle mottle gave plenty — and the NADIR shot showed the 8-u tile as
      // an obvious repeating grid across the whole plot, because a texture's
      // LOW-frequency content is exactly what makes tiling legible. Broad
      // variation is the vertex-colour patchiness's job (world-XZ-keyed, so it
      // never repeats — see `patchAt`, which was given a fourth octave in the
      // same pass so the 1-20 u band has somewhere to live); this map only
      // carries detail finer than one tile's worth.
      const mottle = (pnoise(u, v, 17, 29) - 0.5) * 0.55 + (pnoise(u, v, 37, 31) - 0.5) * 0.45;
      // BLADES: the same noise stretched 4:1 — coarse across, fine along, so
      // the field reads as leaning grass rather than as spots. The stretch
      // factor must be an INTEGER (v spans 4 full lattice periods across the
      // tile) or the map stops tiling in v and every 12 u shows a seam.
      // (Was 19 × 6 = 114 cycles in v; at the eye-level camera that read as
      // combed horizontal SMEAR rather than as grass, so it is both coarser
      // and weaker now.)
      const streak = (pnoise(u, v * 4, 23, 53) - 0.5) * 0.45;
      // 53 cycles per 12-u tile = a 0.23-u wavelength, which is 19 texels at
      // 1024² — still SMOOTH under the ~6× magnification an eye-level camera
      // applies. The term this replaces ran at 79 cycles with the LARGEST
      // weight in the sum (0.95): 6.5 texels a cell, i.e. per-texel noise, and
      // magnifying per-texel noise is precisely what "pixelated" means.
      const fine = (pnoise(u, v, 53, 71) - 0.5) * 0.34;
      // AMPLITUDE 0.20, not 0.46. See the multiplier-budget note above the
      // TURF_TEX_S declaration: this lands the map at byte 123-195, a linear
      // multiplier of 0.58 .. 1.59 and an RMS of 0.136. The old 0.46 measured
      // 0.13 .. 2.44 / RMS 0.433 — a third of a stop of albedo swing between
      // NEIGHBOURING texels.
      const lum = Math.max(0.15, Math.min(1, 0.62 + (mottle + streak + fine) * 0.2));
      const b = Math.round(lum * 255);
      const o = (py * S + px) * 4;
      data[o] = b;
      data[o + 1] = b;
      data[o + 2] = b;
      data[o + 3] = 255;
      // MEAN IN LINEAR SPACE, not in sRGB. The texture is tagged
      // SRGBColorSpace (below) so three.js decodes it before multiplying, and
      // the whole point of the mean is to cancel what the SHADER multiplies by.
      // Averaging the sRGB bytes instead would over-brighten the park by ~18%.
      const lin = lum <= 0.04045 ? lum / 12.92 : ((lum + 0.055) / 1.055) ** 2.4;
      sum += lin;
    }
  }
  x2.putImageData(img, 0, 0);
  _turfCanvas = c;
  _turfMean = sum / (S * S);
  return { canvas: c, mean: _turfMean };
}
// ---------------------------------------------------------------------------
// turfBladeCanvas — the FINE (blade-scale) DETAIL MAP (2026-07 close-up fix)
//
// THE MEASUREMENT THAT FORCED THIS. Texel density on the lawn is
// `TURF_TEX_S / TURF_TILE_U` — 512 / 12 = 42.7 texels per world unit on every
// plot of 24 u or more — and it is INDEPENDENT of how big the plot is, because
// the repeat scales with `size`. At a 3-u camera (the pose you get after two
// scroll-wheel clicks) a 700-px canvas puts 383 screen pixels on a world unit,
// so ONE TEXEL COVERS 9 SCREEN PIXELS. The map's finest content, the 79-cycle
// grain, is 6.5 texels = 58 screen pixels across. Bilinear magnification turns
// that into exactly what the complaint said: large soft blocks. The map above
// is not broken — it is a MACRO map, correctly built for the orbit camera and
// deliberately free of anything below ~17 cycles per tile so its 12-u tile
// cannot read as a grid — but a single tiled texture cannot serve both a 40-u
// overview and a 1-u close-up, and raising ITS resolution is the wrong lever:
// 42.7 -> 341 texels/u would need a 4096² canvas (67 MB, seconds to build).
//
// So this is the standard two-scale answer: a SECOND, much finer texture with
// HIGH-FREQUENCY CONTENT ONLY, tiled 6× tighter, carried in the `bumpMap` slot
// (three.js ≥ r151 gives every map slot its own uv transform, so `map` and
// `bumpMap` can tile at different rates off the same UVs). 512² over a 2-u
// tile = 256 texels per world unit — 6× the macro map, 1.5 screen px per texel
// at that same 3-u camera — and its coarsest feature is 1/23 of a tile, which
// is why tiling it every 2 u does NOT produce the lattice an 8-u MACRO tile
// did: legible tiling comes from LOW-frequency content lining up, and there is
// none in here.
//
// WHY IT IS COMPOSITED INTO THE COLOUR AND NOT JUST DROPPED IN `bumpMap`.
// That was the first attempt, and it is in the shots: a fine map in the bump
// slot changed almost NOTHING, at 0.09 and again at 2.0. three.js differentiates
// a bump map across one screen pixel, and on a rough-1 diffuse lawn lit by a
// high sun plus a hemisphere fill, a normal wobble that small barely moves
// N·L — the eye is reading the COLOUR map, so the colour map is what has to
// carry the detail. The fine map is therefore multiplied into `diffuseColor`
// through a small `onBeforeCompile` hook (one extra texture fetch on the ground
// material only) at its own tighter tiling, with its mean divided back out
// exactly like the macro map's. The macro map keeps the `map` slot untouched,
// so the palette, the mean-cancellation and the distant read are unchanged and
// the two scales simply multiply: 12-u clumping × 2-u blade grain.
//
// Cost: ONE extra 512² canvas per process (~1.05 MB, 1.4 MB with mips), built
// once, shared by every terrain, plus one texture fetch per ground fragment.
// See the Audit note in Context.md.
// ---------------------------------------------------------------------------
const TURF_BLADE_S = 512;
/** world units one BLADE tile spans. 2 u ⇒ 256 texels/u and a 0.087-u coarsest
 *  feature. Do not raise the frequency floor of the content below ~23 cycles
 *  per tile or this starts to read as a 2-u grid. */
const TURF_BLADE_TILE_U = 2;
/** how hard the fine map modulates the colour (0 = off, 1 = full). Both scales
 *  multiply, so their contrasts COMPOUND — at 0.85 the pair reached a combined
 *  albedo RMS of 0.53 and the lawn rendered as tweed (see the budget note above
 *  TURF_TEX_S). 0.5 puts this scale at RMS 0.078, which is a texture you feel
 *  rather than one you count pixels in. */
const TURF_BLADE_MIX = 0.5;
let _turfBladeCanvas: HTMLCanvasElement | null = null;
let _turfBladeMean = 1;
let _turfBladeBuilt = false;
function turfBladeCanvas(): { canvas: HTMLCanvasElement | null; mean: number } {
  if (_turfBladeBuilt) return { canvas: _turfBladeCanvas, mean: _turfBladeMean };
  _turfBladeBuilt = true;
  if (typeof document === 'undefined') return { canvas: null, mean: 1 };
  const S = TURF_BLADE_S;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x2 = c.getContext('2d');
  if (!x2) return { canvas: null, mean: 1 };
  const img = x2.getImageData(0, 0, S, S);
  const data = img.data;
  let sum = 0;
  for (let py = 0; py < S; py += 1) {
    const v = py / S;
    for (let px = 0; px < S; px += 1) {
      const u = px / S;
      // NOTHING BELOW 23 CYCLES PER TILE (see the header): the coarsest term
      // here is 1/23 of the 2-u tile = 0.087 u, finer than the macro map's
      // FINEST term, so the two scales meet without overlapping.
      const clump = (pnoise(u, v, 23, 11) - 0.5) * 0.5;
      // BLADES: the lean. Stretched 1:4 — coarse across the blade, fine along
      // it — so the field reads as leaning grass and not as spots. Both
      // multipliers must be INTEGERS or the map stops tiling (same rule as the
      // macro map's own stretched streak term).
      const blade = (pnoise(u, v * 4, 23, 17) - 0.5) * 0.62;
      // the cross-lean, weaker, so no single direction combs the whole park
      const cross = (pnoise(u * 4, v, 23, 29) - 0.5) * 0.3;
      const grain = (pnoise(u, v, 61, 41) - 0.5) * 0.55;
      // 127 cycles per 2-u tile = 4 texels a cell, the last stop before Nyquist,
      // and the ONLY content in the whole system fine enough to read from a
      // nose-to-the-lawn camera (1.5 u out, where a world unit is ~870 screen
      // pixels and everything coarser than this has become a soft wash).
      //
      // It is safe to push here and it was NOT safe in the macro map, and the
      // reason is the texel:pixel ratio. This map is 256 texels/u, so it hits
      // 1:1 at about 5 u and is minified from every camera beyond that: measured
      // over the mip chain its relative sd falls 0.19 → 0.16 by the level a
      // 22-u camera samples. The macro map is 85 texels/u, i.e. ~1:1 at the
      // mid-distance cameras themselves — a term this fine THERE is per-pixel
      // noise with no mip level to hide in, which is exactly what the 79-cycle
      // term used to be and exactly what read as speckle.
      const micro = (pnoise(u, v, 127, 59) - 0.5) * 0.8;
      const lum = Math.max(0.05, Math.min(1, 0.5 + (clump + blade + cross + grain + micro) * 0.34));
      const b = Math.round(lum * 255);
      const o = (py * S + px) * 4;
      data[o] = b;
      data[o + 1] = b;
      data[o + 2] = b;
      data[o + 3] = 255;
      sum += lum;
    }
  }
  x2.putImageData(img, 0, 0);
  _turfBladeCanvas = c;
  // ARITHMETIC mean, not the macro map's sRGB-decoded one: this texture is
  // sampled RAW in the injected shader line (no colour-space tag, no decode),
  // so what has to be cancelled is the raw average.
  _turfBladeMean = sum / (S * S);
  return { canvas: c, mean: _turfBladeMean };
}
const _turfBladeTexCache = new Map<string, THREE.Texture>();
/** the shared blade texture at a given repeat (one THREE.Texture per repeat,
 *  all wrapping the ONE cached canvas) */
function turfBladeTexture(t: typeof THREE, rx: number, ry: number): { tex: THREE.Texture | null; mean: number } {
  const { canvas, mean } = turfBladeCanvas();
  if (!canvas) return { tex: null, mean };
  const key = `${rx.toFixed(2)}:${ry.toFixed(2)}`;
  const hit = _turfBladeTexCache.get(key);
  if (hit) return { tex: hit, mean };
  const tex = new t.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = t.RepeatWrapping;
  tex.repeat.set(rx, ry);
  // a 2-u tile is minified hard from any overview camera — without anisotropy
  // a grazing lawn shimmers, which is the trade this fix is NOT allowed to make
  // 16 (three clamps to the GPU max at upload, so this is "as much as you
  // have"): a 2-u tile is minified hard from any overview camera and without
  // anisotropy a grazing lawn shimmers
  tex.anisotropy = 16;
  // NO colour-space tag: the injected line samples this texture itself, so
  // three does no decode for it — `_turfBladeMean` cancels the RAW average and
  // the two must agree (see the mean note above).
  _turfBladeTexCache.set(key, tex);
  return { tex, mean };
}

/** Multiply a fine-grain detail map into a ground material's diffuse colour at
 *  its OWN tiling. `uvK` converts the material's `map` UVs (already scaled by
 *  the macro repeat) into the detail map's UVs, so no second UV set and no
 *  extra attribute are needed. One `texture2D` per ground fragment. */
function applyTurfBlade(m: THREE.MeshStandardMaterial, tex: THREE.Texture, uvK: number, gain: number, mixK: number) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.turfBladeMap = { value: tex };
    shader.uniforms.turfBladeUvK = { value: uvK };
    shader.uniforms.turfBladeGain = { value: gain };
    shader.uniforms.turfBladeMix = { value: mixK };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D turfBladeMap;
uniform float turfBladeUvK;
uniform float turfBladeGain;
uniform float turfBladeMix;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  float turfBlade = texture2D( turfBladeMap, vMapUv * turfBladeUvK ).r * turfBladeGain;
  diffuseColor.rgb *= mix( 1.0, turfBlade, turfBladeMix );
}`,
      );
  };
  // three's program cache does NOT hash onBeforeCompile, so without this a
  // plain MeshStandardMaterial with the same feature flags could be handed our
  // patched program (or us its unpatched one)
  m.customProgramCacheKey = () => `turf-blade:${uvK.toFixed(4)}:${mixK.toFixed(3)}`;
  // the texture lives only in a shader uniform, so a probe walking material
  // SLOTS would not see it and would under-report the park's texture memory
  m.userData.turfBladeMap = tex;
}

const _turfTexCache = new Map<string, THREE.Texture>();
/** the shared turf detail texture at a given repeat (one THREE.Texture per
 *  repeat, all wrapping the ONE cached canvas) */
function turfTexture(t: typeof THREE, rx: number, ry: number): { tex: THREE.Texture | null; mean: number } {
  const { canvas, mean } = turfCanvas();
  if (!canvas) return { tex: null, mean };
  const key = `${rx.toFixed(2)}:${ry.toFixed(2)}`;
  const hit = _turfTexCache.get(key);
  if (hit) return { tex: hit, mean };
  const tex = new t.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = t.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 16; // grazing angles are exactly where the turf has to hold up
  // COLOUR SPACE MATTERS HERE, and getting it wrong is what made the first
  // attempt at this look like pale plaster: an untagged CanvasTexture is treated
  // as LINEAR, so the map's 0.4-1.0 range came out as 0.66-1.0 after the sRGB
  // output transform — most of the contrast crushed into white. Tagged sRGB the
  // range survives intact. (Stage's own `getTex` does the same thing, via the
  // same indexed access — three.js renamed this property across versions.)
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _turfTexCache.set(key, tex);
  return { tex, mean };
}

/** firm-shore RIDGING factor. The firm shore used to lerp sub-floor ground to
 *  the CONSTANT `waterLevel + 0.34`, which turned every cell below that
 *  (>50% of a park's area once the landform has any amplitude at all) into one
 *  dead-flat plane at exactly that height — a major cause of "every park's
 *  lawn looks the same". The floor now MIRRORS the dip upward instead, so dry
 *  ground keeps its variation. Strictly ≥ the old constant floor, so every
 *  dryness guarantee the old behaviour gave still holds. */
const FIRM_SHORE_RIDGE = 0.3;
/** cap on that mirrored rise so a deep noise trough can never become a bulge
 *  past the composition probe's 0.8 gate */
const FIRM_SHORE_RIDGE_MAX = 0.5;
// ---- FIRM SHORE ON A MOUNTAINOUS PLOT (2026-07) ---------------------------
// The two constants above were fitted against the ≤48 archetypes, whose
// amplitude is ~0.4-1.8 u. On a plot with real relief they became the single
// biggest cause of "the land is nearly flat": the firm shore engages on every
// cell below `waterLevel + 0.34`, which on an 8-u-amplitude landform is close
// to HALF the plot, and it mapped all of it into a 0.5-u band — one dead-flat
// lowland plane wrapping every lake, with the archetype's whole lower half of
// relief thrown away. Past the classic 48 the mirrored rise is therefore
// AMPLITUDE-RELATIVE: 55% of the dip, capped at 0.42× the landform amplitude
// (3.4 u on a ridge-country 128 plot), so the low ground keeps its shape.
// Still ≥ the old constant floor everywhere, so every dryness guarantee the
// original firm shore gave is unchanged. ≤48 keeps the old constants exactly,
// bit-identical — the branch is on `size`, which buildTerrain already has, so
// no call site can forget to opt in and drift from the composition probe.
const FIRM_SHORE_RIDGE_BIG = 0.55;
const FIRM_SHORE_RIDGE_AMP_K = 0.42;

/**
 * Build the sculpted terrain. Returns the mesh group (heightfield + mud skirt),
 * a `heightAt(x, z)` sampler that matches the mesh exactly, and the tile size.
 * Place water yourself (see TerrainKit preview) at `waterLevel`.
 */
export function buildTerrain(t: typeof THREE, opts: TerrainOpts = {}) {
  const size = opts.size ?? 12;
  const seg = opts.seg ?? 96;
  const seed = opts.seed ?? 3;
  const amplitude = opts.amplitude ?? 1.1;
  const scale = opts.scale ?? 4.5;
  const octaves = Math.max(1, Math.min(6, Math.round(opts.octaves ?? 4)));
  const roughness = Math.max(0.2, Math.min(0.8, opts.roughness ?? 0.5));
  const wl = opts.waterLevel === undefined ? -0.32 : opts.waterLevel;
  const peaks = opts.peaks ?? [{ x: size * 0.2, z: -size * 0.18, height: 1.5, radius: size * 0.28 }];
  const basins = opts.basins ?? [{ x: -size * 0.18, z: size * 0.14, radius: size * 0.26, depth: 1.5 }];

  const rb = opts.reliefBias;
  const flats = opts.flatSpots ?? [];
  // firm-shore ridging: amplitude-relative past the classic 48 (see the
  // FIRM_SHORE_* notes), the legacy constants at or below it
  const bigLand = size > 48;
  const fsRidge = bigLand ? FIRM_SHORE_RIDGE_BIG : FIRM_SHORE_RIDGE;
  const fsRidgeMax = bigLand ? Math.max(FIRM_SHORE_RIDGE_MAX, amplitude * FIRM_SHORE_RIDGE_AMP_K) : FIRM_SHORE_RIDGE_MAX;

  /** the fbm LANDFORM term alone, with the relief bias + flat pockets applied
   *  (authored peaks/basins ride on top of it, unmodulated) */
  const landformAt = (x: number, z: number): number => {
    let n = fbm(x / scale, z / scale, seed, octaves, roughness);
    if (rb) {
      const rad = Math.max(Math.abs(x), Math.abs(z));
      n *= rb.inner + (1 - rb.inner) * smoother((rad - rb.r0) / Math.max(1e-3, rb.r1 - rb.r0));
    }
    for (const f of flats) {
      const dx = Math.max(0, Math.abs(x - f.x) - f.rx);
      const dz = Math.max(0, Math.abs(z - f.z) - f.rz);
      const k = 1 - smoother(Math.hypot(dx, dz) / Math.max(1e-3, f.blend)); // 1 inside -> 0 past blend
      if (k > 0) n *= 1 - k * (1 - f.k);
    }
    return n * amplitude;
  };

  // single source of ground height: landform + peaks - basins, edges taper to 0
  const heightAt = (x: number, z: number): number => {
    let h = landformAt(x, z);
    for (const p of peaks) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.radius) {
        const k = 1 - d / p.radius;
        h += p.height * k * k * (3 - 2 * k) * (0.82 + 0.18 * Math.abs(vnoise(x * 0.35, z * 0.35, seed + 91)));
      }
    }
    for (const b of basins) {
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < b.radius) h -= b.depth * (1 - smoother(d / b.radius));
    }
    if (opts.firmShore && wl !== null && h < wl + 0.34) {
      // firm shore: outside the basins' influence the ground never dips
      // toward the water table (no stray noise puddles); inside a basin the
      // authored bowl keeps its full depth, blending over ~0.35·radius.
      // Sub-floor ground is MIRRORED up (never flattened to the floor) so a
      // landform archetype's low ground stays varied instead of collapsing
      // into one identical plane — see FIRM_SHORE_RIDGE.
      let inf = 0;
      for (const b of basins) {
        const d = Math.hypot(x - b.x, z - b.z);
        const k = 1 - clamp01((d - b.radius) / Math.max(0.6, b.radius * 0.35));
        if (k > inf) inf = k;
      }
      const floor = wl + 0.34;
      const dry = floor + Math.min(fsRidgeMax, (floor - h) * fsRidge);
      h = h * inf + dry * (1 - inf);
    }
    const edge = clamp01(Math.min(size / 2 - Math.abs(x), size / 2 - Math.abs(z)) / 1.5);
    return h * smoother(edge);
  };

  const geo = new t.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const maxH = Math.max(0.001, amplitude + peaks.reduce((m, p) => Math.max(m, p.height), 0));
  const d = 0.35;
  let minH = Infinity;

  /** TURF PATCHINESS: four octaves of the heightfield's own value noise, in
   *  roughly [-1, 1]. Deterministic in the terrain seed, so the same park always
   *  grows the same patches, and keyed on WORLD XZ so it never repeats and — at
   *  a couple of world units per feature on a 0.45-u mesh — can never alias.
   *
   *  THE MISSING BAND (2026-07). `vnoise` is a sum of sines whose slowest term
   *  has a period of ~15 in its ARGUMENT, so `x / 13.7` is a 205-u feature, not
   *  the "2-14 u" the old comment claimed: the three original octaves ran at
   *  ~200 / ~80 / ~30 u, which across a 128-u plot is barely more than a
   *  gradient. Everything between 1 u and 20 u — the clumps-and-patches scale a
   *  lawn is actually MADE of — was being left entirely to the tiled detail
   *  maps, so the only way to get variation there was to over-drive them, and
   *  over-driven detail maps are what read as noise. This fourth octave puts
   *  ~13-u and ~3.6-u clumping back where it belongs: in the vertex colours. */
  const patchAt = (x: number, z: number): number =>
    0.41 * vnoise(x / 13.7, z / 13.7, seed + 301) +
    0.23 * vnoise(x / 5.3, z / 5.3, seed + 457) +
    0.11 * vnoise(x / 2.1, z / 2.1, seed + 613) +
    0.25 * vnoise(x / 0.85, z / 0.85, seed + 919);
  /** how far a spot sits BELOW (positive) or ABOVE (negative) the surrounding
   *  ground, sampled ±6 u along the diagonal — the moisture cue. Two extra
   *  `heightAt` calls per vertex; the slope samples above are far too local
   *  (±0.35 u) to tell a hollow from a slope. */
  const DIP_R = 6;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    if (h < minH) minH = h;
    const slope =
      Math.max(Math.abs(heightAt(x + d, z) - h), Math.abs(heightAt(x, z + d) - h)) / d;

    // grass tone: drier with altitude, lusher near the waterline
    let grass = mix(GRASS, DRY, clamp01(h / maxH) * 0.45);
    // ---- PATCHINESS: mottled turf, pale patches against dark ones ----------
    const p = patchAt(x, z);
    // mixed a little harder than before (0.40/0.46): the detail maps gave up
    // two thirds of their contrast to stop reading as static, and this is the
    // variation that replaces it — broad, smooth and non-repeating, so it
    // survives every camera distance instead of mipping away
    grass = p > 0 ? mix(grass, TURF_PALE, p * 0.55) : mix(grass, TURF_DARK, -p * 0.62);
    // ---- HOLLOWS DAMP / CRESTS SUN-BLEACHED --------------------------------
    // relative to the ground ±6 u away: water collects in the dips and drains
    // off the rises, which is the cue that makes the relief legible from above
    const rel = h - (heightAt(x + DIP_R, z + DIP_R) + heightAt(x - DIP_R, z - DIP_R)) / 2;
    if (rel < 0) grass = mix(grass, TURF_DAMP, clamp01(-rel / 1.1) * 0.55);
    else grass = mix(grass, TURF_PALE, clamp01(rel / 1.6) * 0.3);
    if (wl !== null && h < wl + 2 && slope < 0.6) {
      grass = mix(grass, LUSH, 0.45 * clamp01(1 - (h - wl) / 2));
    }
    let c: RGB;
    if (wl !== null && h < wl + 0.02) {
      // underwater: aqua basin deepening toward the lake floor, sandy at the
      // waterline — reads as bright shallows through the water, never slate
      c = mix(BASIN, SAND, clamp01((h - (wl - 1.2)) / 1.2));
    } else if (wl !== null && h < wl + 0.08) {
      // foam-lapped waterline band
      c = mix(FOAM, SAND, 0.45);
    } else if (wl !== null && h < wl + 0.18) {
      c = SAND;
    } else if (wl !== null && h < wl + 0.9 && slope <= 0.9) {
      // shoreline gradient: dry sand eases into grass, never a hard line
      c = mix(SAND, grass, smoother((h - (wl + 0.18)) / 0.72));
    } else if (slope > 0.9) {
      // steep slopes read as grey rock strata (alternating tone bands)
      c = Math.floor(h / 0.8) % 2 === 0 ? ROCK1 : ROCK2;
    } else if (h > maxH * 0.72) {
      // high ground blends toward rock
      c = mix(grass, ROCK1, clamp01((h - maxH * 0.72) / (maxH * 0.28)));
    } else {
      c = grass;
    }
    // FINE GRAIN — SPATIALLY COHERENT, not a per-vertex hash (2026-07).
    //
    // This slot held `fract(sin(x*12.9898 + z*78.233) * 43758.5453)`, a white-
    // noise hash evaluated ONCE PER VERTEX. On a 128-u plot the mesh is 284²,
    // so vertices sit 0.45 u apart, and from the orbit/nadir cameras that is
    // 5-6 screen pixels: a fully decorrelated ±3.75% value at every node of a
    // regular grid, Gouraud-interpolated between them. That is a woven pattern
    // by construction, and it is what made the top-down shot read as green
    // TWEED — the one artefact a detail map cannot hide, because it lives in
    // the vertex buffer and has no mip chain.
    //
    // Replaced by two octaves of the SMOOTH value noise the rest of the file
    // uses, at 1.1 u and 0.42 u — several vertices per feature, so it survives
    // as grain instead of aliasing against the grid — and at less than half the
    // amplitude, since the turf maps now carry the sub-vertex detail properly.
    const dk =
      1 +
      (0.62 * vnoise(x / 1.1, z / 1.1, seed + 733) + 0.38 * vnoise(x / 0.42, z / 0.42, seed + 881)) *
        (slope < 0.12 ? 0.03 : 0.02);
    colors[i * 3] = Math.min(1, c[0] * dk);
    colors[i * 3 + 1] = Math.min(1, c[1] * dk);
    colors[i * 3 + 2] = Math.min(1, c[2] * dk);
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new t.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals(); // smoothed normals

  // ---- the GROUND MATERIAL: vertex tone × the neutral turf detail map -------
  // What was here before: Stage's green `grass` texture at `repeat = size*1.4`
  // (268 repeats on a 192 plot — one tile per 0.7 u, so ~4 screen pixels per
  // 128-px tile from the orbit camera: the mip chain averaged it to a flat grey
  // and it contributed nothing), with `map` then deleted outright so the green
  // would not stain sand and rock, and a `bumpScale` of 0.04 on that same
  // sub-pixel texture. Net effect: an untextured solid fill. Replaced by the
  // TURF DETAIL MAP — grey (so it multiplies rather than tints), at ONE tile per
  // 8 world units, with its mean cancelled in `color` and a bump scale that is
  // actually visible.
  const turfRepeat = Math.max(2, size / TURF_TILE_U);
  const { tex: turf, mean: turfMean } = turfTexture(t, turfRepeat, turfRepeat);
  // the FINE scale, multiplied into the same colour: 2 u a tile = 256 texels
  // per world unit against the macro map's 42.7. This is what a close camera
  // actually reads — see the turfBladeCanvas header for the measurement.
  const bladeRepeat = size / TURF_BLADE_TILE_U;
  const { tex: blade, mean: bladeMean } = turfBladeTexture(t, bladeRepeat, bladeRepeat);
  const groundMat = mat(t, 0xffffff, { rough: 1 });
  if (turf) {
    groundMat.map = turf;
    groundMat.bumpMap = turf;
    // 0.22, down from 0.35: a bump map is DIFFERENTIATED across one screen
    // pixel, so its contribution scales with the map's local gradient — the
    // same over-driven map that made the albedo read as static was also
    // stippling the shading. With the map's contrast now a third of what it
    // was this is the relief that remains legible without speckling.
    groundMat.bumpScale = 0.22;
    // cancel the map's mean luminance so adding it does not darken the park —
    // THREE.Color is a plain float3 uniform, values above 1 are legal
    groundMat.color.setScalar(1 / Math.max(0.05, turfMean));
    // …and the fine scale on top, at its own tiling. `vMapUv` is the macro
    // map's UV (uv × turfRepeat), so bladeRepeat / turfRepeat converts it.
    if (blade) applyTurfBlade(groundMat, blade, bladeRepeat / turfRepeat, 1 / Math.max(0.05, bladeMean), TURF_BLADE_MIX);
  }
  groundMat.vertexColors = true;
  groundMat.needsUpdate = true;

  const ground = new t.Mesh(geo, groundMat);
  ground.receiveShadow = true;
  ground.castShadow = true;

  const mesh = new t.Group();
  mesh.add(ground);

  // mud skirt around the perimeter so carved ground never reads see-through
  const skirtTop = 0.02;
  const skirtBot = Math.min(minH, wl ?? 0) - 0.4;
  const sh = skirtTop - skirtBot;
  const sy = skirtBot + sh / 2;
  if (opts.edgeSkirt !== false) {
  mesh.add(box(t, [size + 0.08, sh, 0.08], MUD_HEX, [0, sy, size / 2], { tex: 'concrete', repeat: [8, 1], rough: 1 }));
  mesh.add(box(t, [size + 0.08, sh, 0.08], MUD_HEX, [0, sy, -size / 2], { tex: 'concrete', repeat: [8, 1], rough: 1 }));
  mesh.add(box(t, [0.08, sh, size + 0.08], MUD_HEX, [size / 2, sy, 0], { tex: 'concrete', repeat: [1, 8], rough: 1 }));
  mesh.add(box(t, [0.08, sh, size + 0.08], MUD_HEX, [-size / 2, sy, 0], { tex: 'concrete', repeat: [1, 8], rough: 1 }));
  }

  return { mesh, heightAt, size };
}

// ---------------------------------------------------------------------------
// buildSurround — the INFINITE-PLANE SKIRT. A composed park's plot edge used
// to read as a cliff into the void: the heightfield tapers to 0 at ±size/2 and
// simply stops. The surround continues the land WELL past the playable bounds
// as a low-resolution square annulus — same palette, distant ridge silhouettes
// on its far bands, aerial-perspective vertex colours hazing toward the sky —
// so from any camera the world has no end.
//
// COST: ONE merged non-indexed mesh = ONE draw call, ~3-4 k triangles, no
// texture, no shadows (cast + receive off), MeshLambertMaterial. It is pure
// backdrop: no collision, no ground sampler, no footprint, no blocker, never
// registered with the manager. Every validator bound is expressed in ±size/2
// (footprints, track points, access nodes, water flood-fill, terrainLint's
// inBounds) so nothing can be placed on it and no check sees it — it is
// tagged `userData.evalKind = 'surround'` for probes.
//
// The inner rim sits flush at y = 0 (where the heightfield's edge taper lands)
// and rises outward, so there is no seam and no gap over the terrain's mud
// skirt. Height is >= waterLevel + 0.2 everywhere, so the park's ONE water
// sheet (which spans only the plot) can never appear to leak past the rim.
// ---------------------------------------------------------------------------

export interface SurroundOpts {
  /** the plot edge length the skirt wraps — its square hole */
  size: number;
  /** outer reach from the centre, world units (>> size/2). Tune it to the
   *  scene's fog wall so the far rim is fully fog-coloured: then the skirt
   *  fades into the sky instead of ending. */
  reach: number;
  seed?: number;
  /** samples along each side of the ring (default 44) */
  along?: number;
  /** outward bands (default 9) — LOD is by construction: the whole skirt is
   *  ~4 k coarse triangles no matter how far it reaches */
  bands?: number;
  /** distant-ridge height at the far rim, world units (default 16) */
  ridge?: number;
  /** near ground colour (match the climate lawn) */
  ground?: number;
  /** far/haze colour (match the sky/background) */
  haze?: number;
  /** ridge-top rock/snow colour */
  crest?: number;
  /** the park's water table — the skirt always stays above it */
  waterLevel?: number;
}

export function buildSurround(t: typeof THREE, opts: SurroundOpts): { mesh: THREE.Mesh; heightAt: (x: number, z: number) => number; reach: number } {
  // start a hair inside the plot boundary so the ring tucks OVER the terrain's
  // own perimeter (where the heightfield's edge taper has already reached 0) —
  // no seam, no sliver of sky between plot and surround
  const half = opts.size / 2 - 0.06;
  const reach = Math.max(half * 1.35, opts.reach);
  const seed = opts.seed ?? 5;
  const along = Math.max(8, Math.round(opts.along ?? 44));
  const bands = Math.max(3, Math.round(opts.bands ?? 9));
  const ridge = opts.ridge ?? 16;
  const wl = opts.waterLevel ?? -0.26;
  const cGround = col(opts.ground ?? 0x5f7a3e);
  const cHaze = col(opts.haze ?? 0xa8cdd9);
  const cCrest = col(opts.crest ?? 0x7b786f);

  // ring r=0 hugs the plot edge, r=1 is the far rim; eased so the bands get
  // wider (coarser) with distance — cheap where it cannot be inspected
  const radAt = (f: number) => half + (reach - half) * (f * f * (3 - 2 * f)) ** 0.85;
  /** walk the square perimeter at Chebyshev radius `rad`, s in [0,1) */
  const ptAt = (rad: number, s: number): [number, number] => {
    const q = s * 4;
    const side = Math.min(3, Math.floor(q));
    const u = q - side; // 0..1 along this side
    const a = -rad + 2 * rad * u;
    return side === 0 ? [a, -rad] : side === 1 ? [rad, a] : side === 2 ? [-a, rad] : [-rad, -a];
  };
  const heightOf = (x: number, z: number, f: number): number => {
    if (f <= 0) return 0;
    // two-octave ridged noise at a distance-appropriate wavelength: broad
    // ranges near the plot, bigger massifs far out
    const w = 26 + 34 * f;
    const n = Math.abs(fbm(x / w, z / w, seed, 3, 0.5));
    const n2 = Math.abs(vnoise(x / (w * 3.1), z / (w * 3.1), seed + 13));
    // Relief holds FLAT for the first ~15% (an apron ring level with the plot,
    // so a camera dollied just past the boundary is never inside a hillside)
    // and reaches FULL height by ~45% of the way out — NOT at the far rim,
    // which sits ON the fog wall where a ridge would be 100% fog-coloured and
    // the horizon would read as a flat dark line. Real ridge silhouettes
    // therefore land in the partly-hazed middle distance, where they read.
    const shape = smoother((f - 0.15) / 0.3) ** 1.15;
    if (shape <= 0) return 0;
    // 2026-07: the coefficients were 0.16 / 0.62 / 0.42, which with |fbm|'s
    // typical 0.2-0.3 put a "distant range" at less than half the nominal
    // `ridge` height — so even a generous ridge setting produced a horizon that
    // read as a smooth wash. Raised so a typical band reaches ~0.65·ridge and a
    // strong one clears it, which is what makes a SILHOUETTE.
    return Math.max(wl + 0.2, shape * ridge * (0.22 + 0.88 * n + 0.58 * n2));
  };

  const nS = along * 4;
  const verts: number[] = [];
  const cols: number[] = [];
  const push = (x: number, y: number, z: number, f: number) => {
    verts.push(x, y, z);
    // aerial perspective: land colour receding into the haze, ridge tops rocky
    const crest = clamp01((y / Math.max(0.001, ridge)) * 1.9);
    let c = mix(cGround, cCrest, crest * 0.75);
    c = mix(c, cHaze, clamp01(f * 1.12) ** 1.25 * 0.82);
    const dk = 1 + ((((Math.round(x * 7 + z * 13) * 2654435761) >>> 16) % 5) - 2) * 0.014;
    cols.push(Math.min(1, c[0] * dk), Math.min(1, c[1] * dk), Math.min(1, c[2] * dk));
  };
  for (let b = 0; b < bands; b += 1) {
    const f0 = b / bands;
    const f1 = (b + 1) / bands;
    const r0 = radAt(f0);
    const r1 = radAt(f1);
    for (let i = 0; i < nS; i += 1) {
      const s0 = i / nS;
      const s1 = (i + 1) / nS;
      const [ax, az] = ptAt(r0, s0);
      const [bx, bz] = ptAt(r0, s1);
      const [cx, cz] = ptAt(r1, s1);
      const [dx, dz] = ptAt(r1, s0);
      const ay = heightOf(ax, az, f0);
      const by = heightOf(bx, bz, f0);
      const cy = heightOf(cx, cz, f1);
      const dy = heightOf(dx, dz, f1);
      // two triangles per quad, wound COUNTER-CLOCKWISE seen from above so the
      // computed normals point UP on all four sides (A,D,B would invert them
      // and the whole ring would render black and see-through)
      push(ax, ay, az, f0); push(bx, by, bz, f0); push(dx, dy, dz, f1);
      push(bx, by, bz, f0); push(cx, cy, cz, f1); push(dx, dy, dz, f1);
    }
  }
  const geo = new t.BufferGeometry();
  geo.setAttribute('position', new t.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new t.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  // DoubleSide is the cheap insurance policy: whatever angle the camera finds,
  // the surround is never a hole in the world.
  //
  // MeshStandardMaterial, not Lambert (2026-07): the plot's heightfield is a
  // Standard material, and two different BRDFs meeting along the plot boundary
  // drew a visible straight LINE across the horizon — precisely the "the world
  // ends here" read this whole mesh exists to remove. Matching the material
  // (roughness 1, metalness 0 — the ground's own settings) makes the two
  // surfaces respond to the sun identically, so the only difference left across
  // the seam is the aerial-perspective haze, which is the point. One extra
  // Standard-shaded 4 k-triangle mesh with no maps is not a measurable cost.
  const m = new t.MeshStandardMaterial({ vertexColors: true, side: t.DoubleSide, roughness: 1, metalness: 0 });
  const mesh = new t.Mesh(geo, m);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.name = 'surround';
  mesh.userData.evalKind = 'surround';
  mesh.userData.surroundReach = reach;
  // analytic height of the ring at any XZ (0 inside the plot) — feed it to the
  // Stage's ground sampler so the camera walks OVER the distant ridges instead
  // of through them when the user dollies out at a low elevation
  const heightAt = (x: number, z: number): number => {
    const rad = Math.max(Math.abs(x), Math.abs(z));
    if (rad <= half || rad >= reach) return 0;
    // invert radAt numerically (monotonic, 12 bisection steps is exact enough)
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 12; k += 1) {
      const mid = (lo + hi) / 2;
      if (radAt(mid) < rad) lo = mid;
      else hi = mid;
    }
    return heightOf(x, z, (lo + hi) / 2);
  };
  return { mesh, heightAt, reach };
}

export function buildTerrainKitScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const terrain = buildTerrain(t);
        g.add(terrain.mesh);

        // lake: square water sheet at the water table — visible in the basin
        const wl = -0.32;
        const water = buildWater(t, terrain.size * 0.995, 120);
        water.mesh.position.y = wl;
        g.add(water.mesh);

        // a few boulders conformed to the heightfield, partially buried
        (
          [
            [2.9, 0.9, 0.4, 7],
            [-0.8, -2.9, 0.3, 2],
            [1.7, 3.4, 0.24, 12],
            [-3.6, -1.6, 0.34, 5],
          ] as const
        ).forEach(([x, z, s, seed]) => {
          const rock = buildRock(t, { scale: s, seed });
          rock.position.set(x, terrain.heightAt(x, z) - s * 0.12, z);
          g.add(rock);
        });

        return (time) => water.update(time);
      })(three, group) || undefined;
  return { group, update };
}

/** <TerrainKit> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const TerrainKit = composable('TerrainKit', (t) => buildTerrainKitScene(t));
