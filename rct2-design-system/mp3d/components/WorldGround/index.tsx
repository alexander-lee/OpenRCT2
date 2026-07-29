// ---------------------------------------------------------------------------
// WorldGround — LAY A WORLD'S OWN FLOOR.
//
// `<World>` registers a REGION and builds nothing; `theme.pathSurface` re-skins
// only the STREETS. Everything either side of them stayed the climate's default
// grass, so a volcanic caldera and an enchanted glade were the same green field
// with different props on it — the single biggest reason five declared worlds
// still read as one place from any distance.
//
// This lays the theme's `ground` dress over the world's rect: a base soil tone
// plus a deterministic scatter of a second tone so the floor is never one flat
// slab, every tile settled onto the terrain through `park.floorAt` and sunk a
// hair so path slabs, plaza tiles and ride pads always win the depth test.
//
// WHY IT HAS ITS OWN FOLDER (2026-07-28). It used to live inside `SetPieceKit`,
// where it WAS exported and published — and no generated park ever used it.
// `install_code_component` surfaces components by FOLDER, so a component buried
// in a kit is invisible to the agent installing pieces by name. The first
// five-world park mounted `<WorldLandmark>` on all five worlds and
// `<WorldGround>` zero times, for exactly that reason. `SetPieceKit` still
// re-exports it, so existing imports keep working.
// ---------------------------------------------------------------------------

import React from 'react';
import * as THREE from 'three';
import { mergedBoxes } from '../Stage';
import { useComposable } from '../Park';
import { hash01 } from '../PathNetwork/core';

// NO IMPORT FROM '../SetPieceKit' — it re-exports this component, and importing
// a VALUE back out of it (DEFAULT_THEME) would make a real runtime cycle. The
// two things needed from it are declared structurally instead: a fallback dress
// and the shape of the plan this reads.
const FALLBACK_GROUND = { soil: 0x6f9e54, patch: 0x7fae61, tex: 'grass', patchiness: 0.30 };

type GroundDress = { soil: number; patch: number; tex: string; patchiness?: number };
type WorldPlan = {
  key: string;
  theme: { id: string; seedOffset?: number; ground?: GroundDress };
  region: { cx: number; cz: number; hx: number; hz: number };
};

/** local mirror of Stage's MergedBoxSpec (a second `import type` line from the
 *  same module tripped the design-system resolver) */
type MergedBoxSpec = {
  dims: [number, number, number];
  pos?: [number, number, number];
  rotX?: number; rotY?: number; rotZ?: number;
  matrix?: THREE.Matrix4;
  repeat?: [number, number];
};

/**
 * SMOOTH value noise over world xz — the whole reason this floor reads as ground.
 *
 * The first version picked each tile's tone with an independent `hash01` per
 * tile, and an independent draw per cell on a lattice IS a chequerboard: about
 * two thirds of neighbours differ, so the eye sees the grid and nothing else.
 * No amount of extra tones fixes that — four random tones is a busier
 * chequerboard than two. Tone has to be spatially CORRELATED, so patches come
 * out as blobs several tiles across, the way soil actually varies.
 *
 * Hash the integer lattice, smoothstep between corners, and add a second
 * octave at half the wavelength for a broken edge. Deterministic: no
 * `Math.random`, so a remount is identical.
 */
function noise2(x: number, z: number, seed: number): number {
  const at = (ix: number, iz: number) => hash01(ix * 3079 + iz * 6151 + seed * 97 + 11);
  const oct = (s: number) => {
    const fx = x / s;
    const fz = z / s;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    let u = fx - ix;
    let v = fz - iz;
    u = u * u * (3 - 2 * u); // smoothstep — a linear ramp still shows the lattice
    v = v * v * (3 - 2 * v);
    const a = at(ix, iz);
    const b = at(ix + 1, iz);
    const c = at(ix, iz + 1);
    const d = at(ix + 1, iz + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  // wavelengths in WORLD units, not tiles, so the look survives a `tile` change
  return oct(7.5) * 0.62 + oct(3.1) * 0.38;
}

/** shift a hex toward black/white without touching its hue balance */
function tint(hex: number, amt: number): number {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (hex & 255) + amt));
  return (r << 16) | (g << 8) | b;
}

/** world units of ground per ONE copy of the 128 px texture canvas.
 *
 *  This is the number that decides whether the floor reads as GROUND or as flat
 *  coloured squares, and it used to be wrong by 2×: `WorldGround` passed
 *  `repeat: [2, 2]` to `mergedBoxes`, which OVERRIDES the material repeat to
 *  [1, 1] on purpose ("per-part repeats live in the baked UVs"). So the request
 *  was silently dropped and every 2.4 u tile stretched a single copy of the
 *  canvas across itself. 1.2 puts grass blades and sand grain at roughly the
 *  size they are drawn at. */
const TEXEL = 1.2;

/** slab thickness of one ground tile */
const THICK = 0.05;

/**
 * How far the tile's TOP FACE sits below `floorAt`.
 *
 * NOTHING ELSE IN THE PARK MAY EVER Z-FIGHT WITH THE FLOOR. Paths, plaza tiles,
 * ride pads and queue slabs all sit AT `floorAt`, so the floor has to be
 * strictly under them with a margin wider than any depth-buffer error at park
 * camera range. 0.04 is comfortably clear and still far too small to see as a
 * step at the world's edge.
 */
const TOP_CLEARANCE = 0.04;

/** micro height variation. MUST stay under TOP_CLEARANCE or the jitter lifts a
 *  tile back through the paths — the exact bug this constant pair prevents. */
const JITTER = 0.016;
if (JITTER / 2 >= TOP_CLEARANCE)
  console.error('<WorldGround>: JITTER exceeds TOP_CLEARANCE — tiles will z-fight the paths');

/**
 * `<WorldGround plan={W} />` — the world's floor.
 *
 * The partner of `<WorldLandmark>`: the ground says what the land is MADE OF,
 * the landmark says what it IS. Mount it AFTER `<Paths>` (it reads the settled
 * ground) and BEFORE the world's props (it is a floor). It registers no
 * footprint and blocks nothing.
 *
 * FOUR TONES, NOT TWO. A soil/patch split is a coin flip per tile, and a coin
 * flip reads as noise rather than as ground. Two further tones derived from the
 * dress — a shadowed one and a sun-bleached one — give the floor depth without
 * asking any theme to declare more colour. Still one draw call per tone.
 */
export const WorldGround: React.FC<{ plan: WorldPlan; tile?: number; detail?: number }> = ({
  plan, tile = 2.4, detail = TEXEL,
}) => {
  const inScene = useComposable(
    (t, park) => buildWorldGroundScene(t, plan, park, { tile, detail }),
    { position: [plan.region.cx, plan.region.cz], rotation: 0, deps: `${plan.key}|${tile}|${detail}` },
  );
  if (!inScene) console.warn('<WorldGround> must be rendered inside a <Park> — no floor was laid');
  return null;
};

WorldGround.displayName = 'WorldGround';

/** minimal shape of the host this needs — only the terrain query */
type GroundHost = { floorAt?: (x: number, z: number) => number };

/**
 * The floor, as a plain builder.
 *
 * Split out of the component (2026-07-28) for the same reason `Boulevard` and
 * `FountainPlaza` expose theirs: a builder can be mounted by
 * `harness/mp3d-render/shot-world-ground.mjs` and photographed from fixed
 * orthographic angles, and a body living inside `useComposable` cannot. The
 * texel-density bug below shipped precisely because nothing could look at it.
 */
export function buildWorldGroundScene(
  t: typeof THREE,
  plan: WorldPlan,
  park: GroundHost,
  opts: { tile?: number; detail?: number } = {},
): { group: THREE.Group } {
  // 1.2 u, not 2.4. The tile is the resolution the tone field is sampled at, so
  // a coarse tile stair-steps every blob edge back into a visible grid. These
  // are merged, and on a real GPU the cost is DRAW CALLS (still four) rather
  // than triangles, so the finer grid is close to free.
  const tile = opts.tile ?? 1.2;
  const detail = opts.detail ?? TEXEL;
  const g = new t.Group();
  const dress = plan.theme.ground ?? FALLBACK_GROUND;
  const { cx, cz, hx, hz } = plan.region;
  const cols = Math.max(1, Math.round((hx * 2) / tile));
  const rows = Math.max(1, Math.round((hz * 2) / tile));
  const tw = (hx * 2) / cols;
  const td = (hz * 2) / rows;
  const patchiness = dress.patchiness ?? 0.35;
  const seedOff = plan.theme.seedOffset ?? 0;

  // THE TONE RAMP. Four discrete tones cut from a smooth field still read as
  // camouflage — four flat regions with hard edges. A ramp of BANDS with small
  // steps between them reads as one material lit unevenly, which is what ground
  // actually looks like. Stops run shadow -> patch -> soil -> sun-bleached; the
  // theme only has to declare the middle two.
  const RAMP: Array<[number, number]> = [
    [0.00, tint(dress.soil, -17)],
    [0.30, dress.patch],
    [0.64, dress.soil],
    [1.00, tint(dress.patch, 15)],
  ];
  const rampAt = (u: number): number => {
    let k = 0;
    while (k < RAMP.length - 2 && u > RAMP[k + 1][0]) k += 1;
    const [u0, c0] = RAMP[k];
    const [u1, c1] = RAMP[k + 1];
    const f = u1 === u0 ? 0 : Math.max(0, Math.min(1, (u - u0) / (u1 - u0)));
    const mix = (sh: number) => Math.round(((c0 >> sh) & 255) * (1 - f) + ((c1 >> sh) & 255) * f);
    return (mix(16) << 16) | (mix(8) << 8) | mix(0);
  };

  // one merged mesh per band, so this is BANDS draw calls per world, not per
  // tile. Eight is enough that the steps stop being individually legible.
  const BANDS = 8;
  const buckets: MergedBoxSpec[][] = Array.from({ length: BANDS }, () => []);

  // a box rotated a quarter turn swaps its x/z extents, so the 4-way UV
  // shuffle that breaks up the grid is only safe on square-ish tiles
  const square = Math.abs(tw - td) < 1e-6;
  const uv: [number, number] = [Math.max(1, tw / detail), Math.max(1, td / detail)];

  for (let i = 0; i < cols; i += 1)
    for (let j = 0; j < rows; j += 1) {
      const x = cx - hx + tw * (i + 0.5);
      const z = cz - hz + td * (j + 0.5);
      // the TONE FIELD is smooth in world space, so variation comes out as
      // blobs several tiles wide instead of per-tile confetti
      const n = noise2(x, z, seedOff);
      // `patchiness` now sets how far the field swings along the ramp rather
      // than gating a coin flip — a high-patchiness theme spans more of it
      const u = Math.max(0, Math.min(1, 0.5 + (n - 0.5) * (0.6 + patchiness * 1.4)));
      // per-tile hash is still fine for things the eye reads as grain rather
      // than as pattern — micro height and the UV shuffle
      const h2 = hash01(i * 17 + j * 251 + seedOff + 9001);
      // Settle on the real ground and sink the tile's TOP FACE clear of it.
      // `pos` is the box CENTRE, so subtracting the sink alone put the top back
      // at exactly `floorAt` — coplanar with every path slab, plaza tile and
      // ride pad, which is z-FIGHTING, not depth ordering. It read as paths
      // flickering and clipping into the floor. Sink must clear half the
      // thickness as well.
      const y = (park.floorAt ? park.floorAt(x, z) : 0)
        - TOP_CLEARANCE - THICK / 2 + (h2 - 0.5) * JITTER;
      // every tile takes one of four quarter turns, so the texture canvas
      // does not repeat in lockstep across the rect and read as wallpaper
      const rotY = square ? Math.floor(h2 * 4) * (Math.PI / 2) : (h2 < 0.5 ? 0 : Math.PI);
      // dither the band choice by a hair so band boundaries are ragged instead
      // of drawing a clean contour line across the floor
      const b = Math.max(0, Math.min(BANDS - 1,
        Math.floor(u * BANDS + (h2 - 0.5) * 0.9)));
      buckets[b].push({
        dims: [tw + 0.02, THICK, td + 0.02],
        pos: [x - cx, y, z - cz],
        rotY,
        repeat: uv,
      });
    }

  for (let b = 0; b < BANDS; b += 1) {
    if (!buckets[b].length) continue;
    const u = (b + 0.5) / BANDS;
    // rougher in the shadowed bands, slightly polished at the bleached end, so
    // the ramp reads in the specular as well as in the albedo
    g.add(mergedBoxes(t, buckets[b], rampAt(u), { tex: dress.tex, rough: 1 - u * 0.16 }));
  }
  return { group: g };
}
