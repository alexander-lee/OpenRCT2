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
 * How far the draped surface sits below the TERRAIN, measured vertically.
 *
 * NOTHING ELSE IN THE PARK MAY EVER Z-FIGHT WITH THE FLOOR. Everything walkable
 * is solved to stand PROUD of the ground it crosses — `PathNetwork` settles a
 * node at `corridorGroundMax + 0.03` and then renders its pavement top a further
 * `PATH_H + 0.006` up, so a street's surface is +0.126 over the highest ground
 * inside its own corridor and its slab UNDERSIDE is only +0.016. The floor has
 * to stay under that underside, not merely under the top.
 *
 * Because the surface FOLLOWS the terrain, this one constant holds on flat ground
 * and on a mountainside alike — there is no gradient at which it can be exceeded,
 * which is exactly what the flat-slab versions could not promise. 0.04 is
 * comfortably clear of depth-buffer error at park camera range and far too small
 * to read as a step at the world's edge.
 *
 * IT IS NOT THE THING TO WIDEN. Every time this floor has come out over a path
 * the cause has been a DATUM error — a lift added twice, or the wrong sampler —
 * and 40 mm against a 16 mm slab underside is already the right order. Measure
 * where the floor actually landed (`probe-world-ground-datum.mjs`) before
 * touching it.
 */
const TOP_CLEARANCE = 0.04;

/** micro height variation, applied PER VERTEX off its grid index so the surface
 *  stays continuous. MUST stay under TOP_CLEARANCE or the jitter lifts the
 *  surface back through the paths — the exact bug this constant pair prevents. */
const JITTER = 0.016;
if (JITTER / 2 >= TOP_CLEARANCE)
  console.error('<WorldGround>: JITTER exceeds TOP_CLEARANCE — the floor will z-fight the paths');

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
  // at `groundAt` minus a constant vertical drop, so the surface is parallel to
  // the terrain everywhere and always the same distance under the path slabs
  // laid on it — flat ground, hillside or summit, no special case.
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
  const vy = (i: number, j: number) => {
    const x = cx - hx + tw * i;
    const z = cz - hz + td * j;
    // per-VERTEX jitter (not per tile) so the surface stays continuous
    const h = hash01(i * 17 + j * 251 + seedOff + 9001);
    return fl(x, z) - TOP_CLEARANCE + (h - 0.5) * JITTER;
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
