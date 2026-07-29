import * as THREE from 'three';
import { alongDir, cyl, mat, mergedBoxes, mergedParts, mtx, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { LAMP_CHARACTER } from './index';
import type { WorldTheme } from './index';
import { buildBasaltColumns } from '../EmberfallScenery';
import { buildDockPilings } from '../TidewaterScenery';
import { buildGiantGear } from '../BrassworkScenery';
import { buildGiantToadstools } from '../ThornwickScenery';
import { buildSpeakerStack } from '../PulseScenery';

// ---------------------------------------------------------------------------
// STREET DRESS — the STRUCTURAL half of the theme layer.
//
// `SetPieceKit`'s `WorldTheme` is DATA ONLY by design: a palette, a species
// list per dressing slot, a lamp emissive curve, a seed offset. That was the
// right first cut — it is provably additive and it left every existing park
// byte-identical — but it means a themed set-piece is the DEFAULT set-piece in
// different paint. `probe-setpiece-theme.mjs` says so numerically: on the
// 7-tile plaza the `enchantedForest` and `neon` dressings hashed to the SAME
// geometry fingerprint as `default` (a7edf3aa9a), because those two themes
// happen to plant the same SceneryPack species in every slot. Two worlds you
// cannot tell apart in silhouette are not two worlds.
//
// This module is where a theme gets a SHAPE. For each of the five shipped
// worlds it supplies:
//
//   lamp        the world's LIGHT STANDARD — a different object, not a recolour
//               (a basalt brazier, a leaning ship's mast, a gaslight column, a
//               forked branch with hanging globes, a neon totem with a halo)
//   bench       the world's seat (stone slab / plank-on-casks / iron scroll
//               frame / felled log / cantilevered lit slab)
//   span        what crosses overhead — and crucially whether it SAGS: two of
//               the five are rigid, which is the difference an ortho elevation
//               shows most clearly
//   kerb        the avenue's EDGE TREATMENT, one merged run per verge
//   paving      the plaza's floor PATTERN (radiating spokes / deck boards /
//               riveted plate / flagstone spiral / concentric light rings)
//   parapet     the plaza's rim, broken at its open ports
//   centrepiece a four-legged armature straddling the fountain — the single
//               biggest silhouette difference between two plazas
//   landmark    a real prop from THAT WORLD'S OWN scenery component, dropped
//               into a slot the pure planner already vetted
//
// THREE RULES THIS FILE IS BUILT AROUND
//
// 1. THE DEFAULT PATH IS NOT ROUTED THROUGH HERE AT ALL. `dressOf()` returns
//    null for `DEFAULT_THEME` and for any theme id it does not know, so an
//    un-themed piece — and a hand-rolled inline theme — runs exactly the code
//    it ran before. That is what makes "identical with no theme" a property of
//    the control flow rather than a claim to be re-tested.
//
// 2. NO PLAN FIELDS. Everything here is derived at MOUNT time from `plan.theme`
//    plus anchors the planner already published, so a plan's ports, sub-net,
//    footprint, keepDry cells, solids and `key` are bit-identical for every
//    theme. Park layouts and seed tables read the plan, so the plan is the
//    thing that must not move.
//
// 3. DRAW CALLS ARE THE BUDGET. Set-piece dressing is scattered many times per
//    park; detailing all 20 SceneryPack pieces with loose primitives once took
//    a measured park from 1148 to 3374 draws, past the Stage's ~3000. So every
//    themed part here is BATCHED through `mergedBoxes` / `mergedParts`, and the
//    themed lamp (3-4 meshes) and bench (1-2 meshes) come in UNDER the default
//    iron lamp (9) and Kit bench (15) they replace. Theming these pieces
//    REDUCES the draw count; see `probe-setpiece-theme.mjs` for the per-theme
//    numbers.
//
// SPLIT NOTE — this module is `dressShared` + five world modules + a registry,
// not one file. `write_design_system_files` replaces WHOLE files and a file's
// entire contents must fit in ONE tool call's output, so ~55 KB per module is
// the practical ceiling and >90 KB cannot be pushed at all. The single file
// reached 83 KB, which is inside the range where a truncated write silently
// corrupts a live shared component. The seams are the world banners, cut AT the
// banner so no section header ends up orphaned at the foot of the wrong module.
// ---------------------------------------------------------------------------

export type T = typeof THREE;
export type V3 = [number, number, number];

/** the fleet PRNG — hashed sine, never `Math.random` (a park must rebuild the
 *  same avenue on every reload) */
export const h01 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * A night-gated emissive material plus its update, following the theme's own
 * lamp CHARACTER so a flame breathes and a gas light barely moves. `dayFloor`
 * lifts the daylight emissive above the character's base for the one case that
 * needs it: molten rock and neon read as LIT at noon (the Volcano lesson — a
 * glow gated to zero by day is a black hole in the middle of a bright park).
 */
export function glow(t: T, theme: WorldTheme, color: number, dayFloor = 0): { m: THREE.MeshStandardMaterial; update: (time: number, at: V3, root: THREE.Object3D) => void } {
  const ch = LAMP_CHARACTER[theme.lamp] ?? LAMP_CHARACTER.warm;
  const m = new t.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: Math.max(ch.base, dayFloor), roughness: 0.36 });
  return {
    m,
    update: (time, at, root) => {
      const k = nightKOf(root);
      const ease = k * k * (3 - 2 * k);
      const flicker = 1 + ch.flickerAmp * Math.sin(time * ch.flickerSpeed + at[0] * 1.7 + at[2] * 2.3);
      m.emissiveIntensity = Math.max(ch.base, dayFloor) + ch.gain * ease * flicker;
    },
  };
}

/** the optional PointLight every themed standard may carry, on the same curve
 *  and the same budget as `setPieceLamp`'s */
export function lampLight(t: T, theme: WorldTheme, at: V3): { light: THREE.PointLight; update: (time: number, root: THREE.Object3D) => void } {
  const ch = LAMP_CHARACTER[theme.lamp] ?? LAMP_CHARACTER.warm;
  const light = new t.PointLight(theme.palette.lampGlow, 0, ch.distance, 2);
  light.position.set(at[0], at[1], at[2]);
  return {
    light,
    update: (time, root) => {
      const k = nightKOf(root);
      const ease = k * k * (3 - 2 * k);
      light.intensity = ch.lightGain * ease * (1 + ch.flickerAmp * Math.sin(time * ch.flickerSpeed + at[0] * 1.7 + at[2] * 2.3));
    },
  };
}

export const V = (t: T, x: number, y: number, z: number) => new t.Vector3(x, y, z);

/**
 * ONE night-gated PointLight at a themed span's midpoint.
 *
 * The default span is `buildStringLights`, which plants TWO real PointLights per
 * run; the themed spans are emissive-only geometry, so without this a themed
 * boulevard measured 4 lights where the default measured 6 and a themed plaza 8
 * against 12 — the overhead run stopped contributing to the night at all. One
 * per span restores the effect at half the default's cost, which is the right
 * side of that trade (PointLights cost per-fragment shader work, not draws, and
 * the park admits only the nearest `budgets.lights` anyway).
 */
export function spanLight(t: T, theme: WorldTheme, from: V3, to: V3, sag: number): { light: THREE.PointLight; update: (time: number, root: THREE.Object3D) => void } {
  const at: V3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - sag, (from[2] + to[2]) / 2];
  return lampLight(t, theme, at);
}

// ---- the contract every world's dress satisfies ---------------------------

export interface ThemedLamp {
  group: THREE.Group;
  /** the span anchor — spans hang hook-to-hook between REAL standards */
  hook: V3;
  update: (time: number) => void;
}

/** one kerb station: a world point on the verge with the run's local yaw */
export interface KerbStation {
  at: V3;
  yaw: number;
}

export interface PlazaCtx {
  /** pad half-extent in units */
  half: number;
  /** the fountain apron radius the paving is laid around */
  apron: number;
  /** LOCAL outward unit dirs of the sides that carry a street port */
  openDirs: [number, number][];
  seed: number;
}

export interface StreetDress {
  id: string;
  /** the world's light standard, built in WORLD coords at `at` */
  lamp: (t: T, at: V3, opts: { light?: boolean; height?: number; yaw?: number }) => ThemedLamp;
  /** the world's seat; the group is positioned + yawed like `setPieceBench` */
  bench: (t: T, at: V3, yaw: number) => { group: THREE.Group; update?: (time: number) => void };
  /** what crosses overhead between two standards' hooks */
  span: (t: T, from: V3, to: V3) => { group: THREE.Group; update: (time: number) => void };
  /** the avenue's edge run along ONE verge (world coords, floor-sampled) */
  kerb: (t: T, stations: KerbStation[], seed: number) => { group: THREE.Group; update?: (time: number) => void };
  /** the plaza floor pattern, in the plaza's own LOCAL frame */
  paving: (t: T, c: PlazaCtx) => { group: THREE.Group; update?: (time: number) => void };
  /** the plaza rim, LOCAL frame, broken at every open port */
  parapet: (t: T, c: PlazaCtx) => { group: THREE.Group; update?: (time: number) => void };
  /** the armature straddling the fountain, LOCAL frame, rooted on the paving */
  centrepiece: (t: T, c: PlazaCtx) => { group: THREE.Group; update?: (time: number) => void };
  /** a prop from this world's OWN scenery component. `name` is the catalog
   *  builder's piece name — it goes into the `registerPlanted` label, so a
   *  scenery-gate failure names the actual object instead of "landmark". */
  landmark: (t: T, seed: number) => { group: THREE.Group; update?: (time: number) => void; radius: number; name: string };
}

// ---- shared construction helpers ------------------------------------------

/** a run of blocks along a station list, each settled on its own floor sample —
 *  ONE draw call for the whole verge however long the avenue is */
export function blockRun(
  t: T,
  stations: KerbStation[],
  color: number,
  dims: (i: number) => [number, number, number],
  lift: (i: number) => number,
  o: Parameters<typeof mergedBoxes>[3] = {},
  skip: (i: number) => boolean = () => false,
): THREE.Mesh {
  const parts: MergedBoxSpec[] = [];
  stations.forEach((s, i) => {
    if (skip(i)) return;
    const d = dims(i);
    parts.push({ dims: d, pos: [s.at[0], s.at[1] + lift(i) + d[1] / 2, s.at[2]], rotY: s.yaw });
  });
  return mergedBoxes(t, parts.length ? parts : [{ dims: [0.001, 0.001, 0.001], pos: [0, -9, 0] }], color, o);
}

/** the sagging catenary a span hangs on, sampled — `sag 0` gives a rigid run,
 *  which is a structural difference an ortho elevation shows immediately */
export function spanPoints(t: T, from: V3, to: V3, n: number, sag: number): THREE.Vector3[] {
  const a = V(t, from[0], from[1], from[2]);
  const b = V(t, to[0], to[1], to[2]);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i += 1) {
    const u = i / n;
    const p = new t.Vector3().lerpVectors(a, b, u);
    p.y -= sag * 4 * u * (1 - u);
    pts.push(p);
  }
  return pts;
}

/** chain the sampled points into one merged run of cylinders (rope, chain,
 *  vine, pipe) — `alongDir` orients each link from its two endpoints, never
 *  from an azimuth plus a tilt */
export function chainOf(t: T, pts: THREE.Vector3[], r: number, seg: number, material: THREE.Material): THREE.Mesh {
  const geo = new t.CylinderGeometry(r, r, 1, seg, 1, true);
  const parts: PartSpec[] = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const d = pts[i + 1].clone().sub(pts[i]);
    const len = d.length();
    if (len < 1e-6) continue;
    const m = alongDir(t, pts[i], d, len);
    m.multiply(new t.Matrix4().makeScale(1, len, 1));
    parts.push({ geo, matrix: m });
  }
  return mergedParts(t, parts, material, false);
}

/**
 * The four legs every plaza centrepiece stands on, as LOCAL unit directions.
 *
 * They are on the AXES, not the diagonals, and that is a measurement not a
 * taste: `fountainPlazaPlan` puts its four benches on the diagonals at
 * `ring - 1.05` (r 1.91 on a 7-tile pad), and a leg at r 1.45 on the same
 * diagonal leaves 0.01 between the leg and the bench's back — they would clip.
 * On the axes the same leg is 0.63 clear of the nearest bench.
 *
 * r 1.45 is likewise bounded on both sides: the fountain's basin blocker is
 * 1.78 x scale (1.07 at the 7-tile pad's 0.6, 1.28 from 9 tiles up) and the
 * walked ring slab's inner edge is `ring - 0.55` (1.85), so 1.45 +/- a 0.15 leg
 * is the only band that is outside the water and outside the path.
 */
export const LEG_DIRS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** the two DIAGONAL cross-braces through the plaza centre, as leg-index pairs.
 *  A centrepiece that hangs something over the water needs structure AT the
 *  axis; the perimeter ring beam has nothing there, so a hub or a king post
 *  hung off it alone is a part with no support (which the attachment probe
 *  reports, and a viewer reads as a floating object). */
export const CROSS: [number, number][] = [[0, 2], [1, 3]];

/** a straight strut between two LOCAL points, for a `mergedParts` batch */
export function strut(t: T, geo: THREE.BufferGeometry, a: THREE.Vector3, b: THREE.Vector3, r = 1): PartSpec {
  const d = b.clone().sub(a);
  const m = alongDir(t, a, d, d.length());
  m.multiply(new t.Matrix4().makeScale(r, d.length(), r));
  return { geo, matrix: m };
}

// ---- plaza rim geometry, shared by the five parapets ----------------------

/** one rim station: a point on the plaza rim, its outward yaw, and whether the
 *  segment that STARTS here is part of a run (false = the gap at a port) */
export interface RimStation {
  at: [number, number, number];
  yaw: number;
  run: boolean;
}

/**
 * Walk the plaza rim at `pitch`, marking every station that falls inside a PORT
 * OPENING as not-a-run. A parapet that closed a port would fence the plaza's
 * own entrance — which is why the default's border course has the same break.
 */
export function rimStations(c: PlazaCtx, pitch: number): RimStation[] {
  const inset = c.half - 0.3;
  const GAP = 1.05; // half-width of the opening a port needs
  const out: RimStation[] = [];
  const sides: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  sides.forEach((d) => {
    const along: [number, number] = [d[1], -d[0]];
    const open = c.openDirs.some((o) => Math.abs(o[0] - d[0]) < 1e-6 && Math.abs(o[1] - d[1]) < 1e-6);
    const n = Math.max(2, Math.round((inset * 2) / pitch));
    // `i < n` so each side stops one station short of the next side's corner —
    // otherwise every corner carries two coincident posts
    for (let i = 0; i < n; i += 1) {
      const s = -inset + (i / n) * inset * 2;
      if (open && Math.abs(s) < GAP) continue; // this station stands in the opening
      const sNext = -inset + ((i + 1) / n) * inset * 2;
      // the SEGMENT starting here is only a run when the next station exists on
      // this same side and is not itself inside the opening
      const run = i + 1 < n && !(open && Math.abs(sNext) < GAP);
      out.push({ at: [d[0] * inset + along[0] * s, 0, d[1] * inset + along[1] * s], yaw: Math.atan2(d[0], d[1]), run });
    }
  });
  return out;
}

/** the boxy form of the same walk, for the block-built parapets */
export function rimBlocks(c: PlazaCtx, pitch: number, dims: (i: number) => [number, number, number]): MergedBoxSpec[] {
  return rimStations(c, pitch).map((s, i) => {
    const d = dims(i);
    return { dims: d, pos: [s.at[0], d[1] / 2, s.at[2]] as V3, rotY: s.yaw, repeat: [1, 1] as [number, number] };
  });
}

