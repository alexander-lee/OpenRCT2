// ---------------------------------------------------------------------------
// WorldGround — LAY A WORLD'S OWN FLOOR.
//
// `<World>` registers a REGION and builds nothing; `theme.pathSurface` re-skins
// only the STREETS. Everything either side of them stayed the climate's default
// grass, so a volcanic caldera and an enchanted glade were the same green field
// with different props on it — the single biggest reason five declared worlds
// still read as one place from any distance.
//
// This drapes the theme's `ground` dress over the world's rect as a HEIGHTFIELD
// that follows the terrain — every vertex at `park.groundAt` minus a constant
// 0.04, so path slabs, plaza tiles and ride pads sit proud of it on flat ground
// and on a mountainside alike. Tone comes from smooth value noise quantised into
// an eight-step ramp, which is what stops it reading as a chequerboard.
//
// It was flat box slabs twice before this, and both were wrong for the same
// reason: a flat slab cannot sit on a hill. Settled at its centre its uphill
// corners erupt through the paths; settled under its lowest corner it sinks out
// of sight and leaves bare terrain on every gradient.
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
import { mat, type TexName } from '../Stage';
import { useComposable } from '../Park';
import { hash01 } from '../PathNetwork/core';

// NO IMPORT FROM '../SetPieceKit' — it re-exports this component, and importing
// a VALUE back out of it (DEFAULT_THEME) would make a real runtime cycle. The
// two things needed from it are declared structurally instead: a fallback dress
// and the shape of the plan this reads.
const FALLBACK_GROUND = { soil: 0x6f9e54, patch: 0x7fae61, tex: 'grass' as TexName, patchiness: 0.30 };

// `tex` is Stage's TexName union, pulled in on the SAME import line as `mat` —
// a separate `import type` statement from this module trips the design-system
// resolver, which is why the rest of this block is a local mirror.
type GroundDress = { soil: number; patch: number; tex: string; patchiness?: number };
// Only the fields this component READS. Deliberately a narrow structural type,
// not `import type { WorldPlan } from '../SetPieceKit'` — that kit re-exports
// this component, and a second `import type` line from it has tripped the design
// system's module resolver before. `theme.id` is intentionally absent: it is not
// read here, and requiring it made the real WorldTheme fail to assign.
type WorldPlan = {
  key: string;
  theme: { seedOffset?: number; ground?: GroundDress };
  region: { cx: number; cz: number; hx: number; hz: number };
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
 *  UVs are taken straight off WORLD x/z divided by this, so texel density is
 *  uniform across the whole world and there is no per-tile seam. (In the old
 *  slab build this was passed as `repeat` to `mergedBoxes`, which overrides the
 *  material repeat to [1, 1] on purpose — "per-part repeats live in the baked
 *  UVs" — so the request was silently dropped and every tile stretched one copy
 *  of the canvas across itself.) 1.2 puts grass blades and sand grain at roughly
 *  the size they are drawn at. */
const TEXEL = 1.2;

/**
 * How far the soil layer stands ABOVE the terrain surface. A LAYER OF SOIL LAID
 * ON THE GROUND — that is the whole physical idea, and the sign of this number is
 * the single most load-bearing thing in the file.
 *
 * ⛔ IT WAS NEGATIVE (a 0.04 SINK) FOR THREE SHIPPED VERSIONS, AND A FLOOR UNDER
 * THE TERRAIN RENDERS NOTHING. `<Terrain>` is a solid 0.45 u heightfield mesh
 * across the whole plot; anything draped beneath its surface is simply occluded by
 * it. MEASURED on `samples/w33a.tsx` with the sink at 0.04 and the mount datum
 * corrected: 1805 of 1805 raycast samples across all five world rects came back
 * with the floor BELOW the terrain mesh (probe-world-ground-datum.mjs — median
 * floor − terrain = −0.0399, i.e. exactly the sink). The only reason the floor was
 * ever visible at all was the mount-datum bug lifting it back out by +0.087…0.128,
 * which is also what buried the paths. Fix the datum without fixing this sign and
 * the component does nothing whatsoever.
 *
 * THE WINDOW, both ends measured rather than assumed:
 *
 *   FLOOR (must clear the terrain). The drape interpolates `heightAt` on a 1.2 u
 *   grid, the terrain mesh on a 0.45 u one, so the two chord approximations
 *   disagree by the difference of their sags. Measured against the terrain mesh
 *   over 1805 samples, the drape sits between 0.036 BELOW and 0.038 ABOVE its own
 *   nominal offset (p05 −0.006, p95 +0.006 — the tails are ridge crests and the
 *   kinks `keepDry` cuts into a range). So the lift must beat ~0.036.
 *
 *   CEILING (must stay under the pavement). `PathNetwork` settles a node at
 *   `corridorGroundMax + 0.03` and renders its pavement top a further
 *   `PATH_H + 0.006` up: a street's surface is +0.126 over the highest ground in
 *   its own corridor. Flat-ride pads are far easier at `groundAt + 0.22`. So the
 *   lift plus the worst upward excursion must stay under 0.126.
 *
 * 0.05 sits in the middle of (0.036, 0.088): ≥95% of the floor clears the terrain
 * by ~44 mm, the worst measured spot by 14 mm — some 26 depth-buffer steps at this
 * stage's 0.1 near plane, so no z-fight — while the closest it can come to a
 * pavement top is 0.088, leaving 38 mm even if the two extremes coincided. They
 * cannot: a street is tightest where its corridor ground is at a local MAXIMUM,
 * and a local maximum is convex, which is where this surface SAGS.
 *
 * DO NOT retune this to fix a floor that is over a path. Every time that has
 * happened the cause was a DATUM error — a lift counted twice, or `floorAt` used
 * where `groundAt` was meant. Measure where the floor actually landed first.
 */
const SOIL_LIFT = 0.05;

/**
 * The rect's edge, feathered.
 *
 * A constant lift makes the rect's boundary a hard rectangular step, and a hard
 * rectangular step is the "large hard-edged rectangular patches of slightly
 * different green lying over the grass" that got reported alongside the buried
 * paths — the drape has no side walls, so its hem reads as a plate floating over
 * the terrain. Instead, taper the lift across the outermost rings from
 * `SOIL_LIFT` down THROUGH zero to `-EDGE_SINK`: the outer ring is under the
 * terrain and invisible, and the floor's apparent boundary is the contour where
 * it crosses the ground — an irregular, terrain-following, jitter-broken line
 * instead of a drawn rectangle. Costs nothing: same vertices, same draw calls.
 */
const EDGE_RINGS = 3;
const EDGE_SINK = 0.05;

/** micro height variation, applied PER VERTEX off its grid index so the surface
 *  stays continuous. MUST stay under SOIL_LIFT, or the jitter dips the floor back
 *  under the terrain and punches holes in it. */
const JITTER = 0.016;
if (JITTER / 2 >= SOIL_LIFT)
  console.error('<WorldGround>: JITTER exceeds SOIL_LIFT — the floor will z-fight the terrain');

/**
 * `<WorldGround plan={W} />` — the world's floor.
 *
 * The partner of `<WorldLandmark>`: the ground says what the land is MADE OF,
 * the landmark says what it IS. Mount it AFTER `<Paths>` (it reads the settled
 * ground) and BEFORE the world's props (it is a floor). It registers no
 * footprint and blocks nothing.
 *
 * EIGHT TONE BANDS, NOT A TWO-WAY SPLIT. A soil/patch split is a coin flip per
 * tile, and a coin flip on a lattice reads as a chequerboard rather than as
 * ground. The bands are cut from one smooth field with small steps between them,
 * so the floor reads as a single material lit unevenly. One draw call per band.
 */
export const WorldGround: React.FC<{ plan: WorldPlan; tile?: number; detail?: number }> = ({
  plan, tile, detail,
}) => {
  // pass through UNSET, so the builder's own defaults apply. Naming defaults
  // here as well silently overrode them — the component said 2.4 while the
  // builder said 1.2, so every park got the coarse grid.
  //
  // ⛔ THE `y` IN THIS POSITION IS LOAD-BEARING — AND IT MUST BE AN EXPLICIT 0.
  //
  // This was a 2-TUPLE `[cx, cz]` for three shipped versions, and it is the whole
  // reason the floor kept burying the paths. `useComposable` does
  //
  //     const y = yOf(pos) ?? park.floorAt(x, z);   // 2-tuple -> yOf is null
  //     g.position.set(x, y, z);
  //
  // so a 2-tuple SETTLES the group onto the terrain at the rect's centre — while
  // the builder below already emits every vertex y as an ABSOLUTE world height
  // (`groundAt(x, z) - TOP_CLEARANCE`). The two are added, so the whole floor was
  // lifted by `floorAt(cx, cz)`: MEASURED in `samples/w33a.tsx` at +0.087 to
  // +0.128 u across its five worlds (probe-world-ground-datum.mjs), against a
  // path slab whose top stands only 0.126 u proud of the ground it crosses. The
  // floor came out ABOVE the pavement and the street vanished under the grass.
  // On a world centred on real relief — this sample's ranges are 2.1–4.4 u tall —
  // the lift is metres and the rect reads as a hard-edged plateau of turf.
  //
  // Why the harness never caught it: `shot-world-ground.mjs` mounts the BUILDER
  // and does `scene.add(built.group)`, i.e. at y = 0. Passing an explicit 0 here
  // makes the real mount agree with that, so the builder has ONE frame — x/z
  // relative to the rect centre, y absolute — and the photograph is the truth.
  const inScene = useComposable(
    (t, park) => buildWorldGroundScene(t, plan, park, { tile, detail }),
    { position: [plan.region.cx, 0, plan.region.cz], rotation: 0, deps: `${plan.key}|${tile ?? 'd'}|${detail ?? 'd'}` },
  );
  if (!inScene) console.warn('<WorldGround> must be rendered inside a <Park> — no floor was laid');
  return null;
};

WorldGround.displayName = 'WorldGround';

/** minimal shape of the host this needs — the terrain query, and the PAVED
 *  query only as a fallback for hosts that predate it (see `sample` below) */
type GroundHost = {
  groundAt?: (x: number, z: number) => number;
  floorAt?: (x: number, z: number) => number;
};

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
  // probe tag (the fleet convention — see Park/composable tagComponent). The
  // datum bug below shipped three times running because nothing in the scene
  // graph could NAME the floor, so no probe could measure where it landed.
  g.userData.dsComponent = 'WorldGround';
  g.userData.dsWorldKey = plan.key;
  const dress = plan.theme.ground ?? FALLBACK_GROUND;
  const { cx, cz, hx, hz } = plan.region;
  const cols = Math.max(1, Math.round((hx * 2) / tile));
  const rows = Math.max(1, Math.round((hz * 2) / tile));
  const tw = (hx * 2) / cols;
  const td = (hz * 2) / rows;
  const patchiness = dress.patchiness ?? 0.35;
  const seedOff = plan.theme.seedOffset ?? 0;
  // ⛔ `groundAt`, NOT `floorAt`. They are different datums and only one of them
  // is the LAND:
  //
  //   groundAt(x, z) = terrain.heightAt(x, z)              — the bare heightfield
  //   floorAt(x, z)  = the PAVED level where one exists     — inside a plaza it
  //                    returns `plazaBase + 0.096`, i.e. that plaza's finished
  //                    pavement TOP, which is `corridorGroundMax + 0.126`
  //
  // A world's floor is made of soil, so it follows the terrain; the paths, plazas
  // and pads stand ON it. Draping off `floorAt` instead made the floor climb to
  // the pavement inside every plaza — a mesa exactly the shape of the plaza rect,
  // standing the plaza's whole lift above the surrounding turf, with a hard step
  // all the way round it. `groundAt <= floorAt` everywhere (a plaza is solved at
  // or above the ground it covers), so this can only ever LOWER the floor, and it
  // is one less thing that has to be true for the clearance below to hold.
  //
  // `floorAt` stays as the fallback: `shot-world-ground.mjs`'s park stub declares
  // only that, and so may other callers of this builder.
  const fl = park.groundAt ?? park.floorAt ?? (() => 0);

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

  // ---- the DRAPE ---------------------------------------------------------
  //
  // This used to be flat box slabs, one per tile, settled under the terrain.
  // A flat slab cannot sit on a mountain: settle it at its centre and its
  // uphill corners erupt through the paths, settle it under its lowest corner
  // and it sinks out of sight leaving bare terrain on every gradient. Both were
  // shipped and both were wrong, because the shape was wrong.
  //
  // So the floor is now a HEIGHTFIELD that follows the ground. Every vertex sits
  // at `groundAt` plus a constant `SOIL_LIFT`, so the surface is parallel to the
  // terrain everywhere: always clear OF it, and always the same distance under the
  // path slabs laid on it — flat ground, hillside or summit, no special case.
  //
  // `vy` returns an ABSOLUTE world height, while the x/z pushed alongside it are
  // RELATIVE to the rect centre. That mixed frame is deliberate and it is why the
  // component above must mount this group at an EXPLICIT y of 0 — read that note
  // before changing either.
  //
  // WATERTIGHT ACROSS BANDS: a vertex's height and jitter are functions of its
  // GRID INDEX alone, so two neighbouring quads in different tone bands compute
  // bit-identical positions on their shared edge and no crack can open between
  // them.
  //
  // The feather band is capped at a quarter of the SHORTER side, so a small rect
  // still gets a lifted middle instead of being feathered away entirely.
  const rings = Math.min(EDGE_RINGS, Math.floor(Math.min(cols, rows) / 4));
  const liftAt = (i: number, j: number) => {
    if (rings < 1) return SOIL_LIFT;
    const e = Math.min(1, Math.min(i, cols - i, j, rows - j) / rings);
    // smoothstep, so the band meets the lifted interior without a crease
    const s = e * e * (3 - 2 * e);
    return SOIL_LIFT * s - EDGE_SINK * (1 - s);
  };
  const vy = (i: number, j: number) => {
    const x = cx - hx + tw * i;
    const z = cz - hz + td * j;
    // per-VERTEX jitter (not per tile) so the surface stays continuous
    const h = hash01(i * 17 + j * 251 + seedOff + 9001);
    return fl(x, z) + liftAt(i, j) + (h - 0.5) * JITTER;
  };

  const BANDS = 8;
  type Buf = { pos: number[]; uv: number[]; idx: number[] };
  const bufs: Buf[] = Array.from({ length: BANDS }, () => ({ pos: [], uv: [], idx: [] }));

  for (let i = 0; i < cols; i += 1)
    for (let j = 0; j < rows; j += 1) {
      const xc = cx - hx + tw * (i + 0.5);
      const zc = cz - hz + td * (j + 0.5);
      // the TONE FIELD is smooth in world space, so variation comes out as
      // blobs several tiles wide instead of per-tile confetti
      const n = noise2(xc, zc, seedOff);
      // `patchiness` sets how far the field swings along the ramp rather than
      // gating a coin flip — a high-patchiness theme spans more of it
      const u = Math.max(0, Math.min(1, 0.5 + (n - 0.5) * (0.6 + patchiness * 1.4)));
      const hq = hash01(i * 73 + j * 131 + seedOff);
      // dither the band choice by a hair so band boundaries are ragged instead
      // of drawing a clean contour line across the floor
      const b = Math.max(0, Math.min(BANDS - 1, Math.floor(u * BANDS + (hq - 0.5) * 0.9)));
      const buf = bufs[b];
      const base = buf.pos.length / 3;
      // the quad's four corners, in GRID space so neighbours agree exactly
      for (const [di, dj] of [[0, 0], [1, 0], [1, 1], [0, 1]] as Array<[number, number]>) {
        const x = cx - hx + tw * (i + di);
        const z = cz - hz + td * (j + dj);
        buf.pos.push(x - cx, vy(i + di, j + dj), z - cz);
        // UV off WORLD position, so texel density is uniform and there is no
        // per-tile seam to give the grid away
        buf.uv.push(x / detail, z / detail);
      }
      buf.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }

  for (let b = 0; b < BANDS; b += 1) {
    const buf = bufs[b];
    if (!buf.idx.length) continue;
    const geo = new t.BufferGeometry();
    geo.setAttribute('position', new t.Float32BufferAttribute(buf.pos, 3));
    geo.setAttribute('uv', new t.Float32BufferAttribute(buf.uv, 2));
    geo.setIndex(buf.idx);
    // real normals, so the floor SHADES with the hillside it is draped over
    geo.computeVertexNormals();
    const uu = (b + 0.5) / BANDS;
    // rougher in the shadowed bands, slightly polished at the bleached end, so
    // the ramp reads in the specular as well as in the albedo
    // `GroundDress.tex` is mirrored as `string` on purpose (see the type note at
    // the top — a second `import type` from SetPieceKit trips the resolver), so
    // the cast is the seam between the mirror and Stage's real union.
    const m = mat(t, rampAt(uu), { tex: dress.tex as TexName, rough: 1 - uu * 0.16 });
    const mesh = new t.Mesh(geo, m);
    mesh.receiveShadow = true;
    g.add(mesh);
  }

  return { group: g };
}
