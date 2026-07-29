import React from 'react';
import * as THREE from 'three';
import { box, mergedBoxes } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { composable } from '../Park';

// Path NETWORK — a graph of footpath nodes + edges rendered in our RCT2
// tarmac-with-kerbs style (grey 0x9a9a96 asphalt slab, pale concrete kerbs,
// expansion-joint seams). Uniform tile language, like RCT2's footpath
// configurations: every edge slab and junction pad is the SAME width, and
// kerb trim appears ONLY where no neighbouring path continues — a node pad
// grows a kerb strip on each FREE cardinal side (none where an edge
// connects) plus the four kerb corners, so a 4-way node reads as an RCT2
// cross tile, a 3-way as a T, a bend as a corner tile. Junctions (degree
// >= 3) get a lamp post and dead ends a litter bin, both planted in the
// widest angular gap between the approaches (never on a slab).
//
// RCT2 paths live on a TILE GRID: tiles connect only N/S/E/W (no diagonals),
// wide open areas are full "center" tiles (kerb only around the outside), and
// sloped path tiles ramp exactly one height step per tile. `grid` validates
// axis-alignment, `plazas` renders center-tile rectangles, and per-node
// heights (`nodeY`, or `[x, z, elevation]` node triples) turn edges between
// levels into RAMPS: flat inclined RIBBONS at constant grade (path width,
// kerbs and seams following the slope) joined flush at both knuckles — the
// pads at a ramp's ends bevel toward the grade so there is never a step,
// gap or overhang where a slope meets a level span (Paint.Path.cpp's sloped
// path elements). Deterministic — no Math.random.

// ---------------------------------------------------------------------------
// SIBLING MODULES — ./core, ./heights, ./scaffold, ./build, ./routing and
// ./surfaces exist ONLY because Magic Patterns writes WHOLE files and this
// network no longer fits a single write. Nothing about the network changed and
// the public surface below is exactly what index.tsx exported before, name for
// name. buildPathNetwork and friends are plain FUNCTIONS, so they are
// re-exported as-is; the <PathNetwork>/<ElevatedWalkway> components stay
// DECLARED in this file (the prop extractor reads only index.tsx and cannot
// see through `export { X } from './y'`).
// ---------------------------------------------------------------------------
export { snapNetToGrid } from './core';
export type { PathNode, PathNet, PathNetworkOpts, BenchSeat } from './core';
export { CROSS_SLOPE_CAP, solvePathHeights } from './heights';
export type { PathHeightOpts, PathHeightSolution } from './heights';
export { SCAFFOLD_LIFT, SCAFFOLD_WOOD, scaffoldBay, scaffoldTower } from './scaffold';
export { buildPathNetwork } from './build';
export { posOnPath, buildRouting } from './routing';
export type { RouteNet, RoutingOpts, Routing } from './routing';

// ---- THE PATH CROSS-SECTION ----------------------------------------------
// One definition of what a straight run of pavement IS (slab + kerbs + seams,
// and the datum/lip constants), shared by the street renderer and by the RIDE
// ACCESS runs in `GameManager/access.ts`. See ./ribbon.ts for why.
export {
  PATH_H,
  PATH_SLAB,
  PATH_KERB_W,
  PATH_KERB_PROUD,
  PATH_SEAM_EVERY,
  PATH_SEAM_PROUD,
  PATH_WIDTH,
  PATH_PAD_LIP,
  PATH_PAD_TOP,
  PATH_MAX_GRADE,
  kerbOffsetFor,
  newRibbonSpecs,
  pathRibbon,
} from './ribbon';
export type { RibbonRun, RibbonOpts, RibbonSpecs } from './ribbon';

// ---- PATH SURFACES -------------------------------------------------------
// The palettes themselves live in ./surfaces.ts — a LEAF module with no
// imports — and are re-exported here so `from '../PathNetwork'` keeps working.
// The split is not cosmetic: `SetPieceKit`'s WORLD_THEMES evaluates a preset at
// MODULE SCOPE, and SetPieceKit -> PathNetwork -> Park -> SetPieceKit is a real
// cycle, so a preset defined in THIS file could still be `void 0` when a theme
// object is built, depending on which module the bundler starts with. See
// ./surfaces.ts for the full note.
export type { PathSurface, PathSurfaceZone } from './surfaces';
export {
  SURFACE_TARMAC,
  SURFACE_DIRT,
  SURFACE_BASALT,
  SURFACE_BOARDWALK,
  SURFACE_IRONPLATE,
  SURFACE_MOSSFLAG,
  SURFACE_NIGHTGLASS,
} from './surfaces';

// values the demo scenes below use
import type { PathNet } from './core';
import { SCAFFOLD_WOOD, scaffoldTower } from './scaffold';
import { buildPathNetwork } from './build';

// An RCT2 tile-grid layout: axis-aligned streets on a 1.2 grid (grid mode
// on), a 2×2 center-tile plaza that two edges run through seamlessly, and a
// ramped edge climbing exactly one height step (0.5 over a 1.2 run) to a
// raised flat spur.
export function buildPathNetworkScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const net: PathNet = {
          nodes: [
            [-2.4, 1.2], // 0 main street, west end (dead end — bin)
            [0, 1.2], // 1 main street × plaza approach (T — lamp)
            [2.4, 1.2], // 2 main street, east — the ramp starts here
            [0, 0], // 3 inside the plaza — no pad/kerbs
            [0, -1.2], // 4 inside the plaza — no pad/kerbs
            [-2.4, -1.2], // 5 side street, west end (dead end — bin)
            [3.6, 1.2], // 6 top of the ramp (raised 0.5, bend tile)
            [3.6, 0], // 7 raised spur end (dead end — bin at +0.5)
          ],
          edges: [
            [0, 1],
            [1, 2], // main street (E–W)
            [1, 3], // enters the plaza through a kerb opening
            [3, 4], // fully inside the plaza — seamless, no kerbs
            [4, 5], // exits the plaza west
            [2, 6], // RAMP — climbs 0.5 over 1.2 (RCT2 max slope)
            [6, 7], // raised flat spur
          ],
        };
        const built = buildPathNetwork(t, net, {
          grid: true,
          plazas: [[0.6, -0.6, 2.4, 2.4]], // 2×2 center tiles
          nodeY: [0, 0, 0, 0, 0, 0, 0.5, 0.5],
          groundAt: () => 0, // verge furniture stands on the flat Stage ground
        });
        built.group.position.set(-0.7, 0, -0.5); // recentre the east-heavy layout in frame
        g.add(built.group);
        if (built.update) return built.update;
      })(three, group) || undefined;
  return { group, update };
}

/** <PathNetwork> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const PathNetwork = composable('PathNetwork', (t) => buildPathNetworkScene(t));

// An RCT2 elevated-walkway demo: ground → two sloped tiles up (one 0.5 step
// per 1.2 tile each) → an elevated straight riding on wooden scaffold bays →
// two sloped tiles back down, plus an elevated side spur to a kiosk that
// stands on its OWN four-post scaffold deck — the RCT2 rule that anything
// beside an elevated path is supported too (never floating, never a berm).
export function buildElevatedWalkwayScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const t = three;
  const group = new t.Group();
  // nodes as [x, z, elevation] TRIPLES — the elevation-API convenience form
  // (no parallel nodeY array; heights survive snapNetToGrid's merging)
  const net: PathNet = {
    nodes: [
      [-4.8, 0, 0], // 0 west ground dead end (bin)
      [-3.6, 0, 0], // 1 ramp foot (knuckle — bevelled pad)
      [-2.4, 0, 0.5], // 2 mid-ramp — NO pad, the ribbon runs straight through
      [-1.2, 0, 1], // 3 ramp head (knuckle) — elevated deck starts
      [0, 0, 1], // 4 elevated
      [1.2, 0, 1], // 5 elevated (T junction — spur to the kiosk)
      [2.4, 0, 1], // 6 ramp head (knuckle)
      [3.6, 0, 0.5], // 7 mid-ramp down
      [4.8, 0, 0], // 8 east ground dead end (bin)
      [1.2, -1.2, 1], // 9 elevated spur end, facing the kiosk deck
    ],
    edges: [
      [0, 1],
      [1, 2], // RAMP up (0 → 0.5)
      [2, 3], // RAMP up (0.5 → 1.0)
      [3, 4],
      [4, 5], // elevated straight on scaffolds
      [5, 6],
      [6, 7], // RAMP down (1.0 → 0.5)
      [7, 8], // RAMP down (0.5 → 0)
      [5, 9], // elevated side spur
    ],
  };
  const built = buildPathNetwork(t, net, { grid: true, groundAt: () => 0 });
  group.add(built.group);
  // the kiosk deck: a scaffold tower with a plank deck at walkway level,
  // butted against the spur pad (deterministic — fixed seed)
  const specs: MergedBoxSpec[] = [];
  const kx = 1.2;
  const kz = -2.35;
  const deckTop = 1 + 0.1; // walkway surface level (nodeY 1 + slab top ~0.1)
  scaffoldTower(t, specs, kx, kz, 1.35, 1.15, deckTop, 0, { deck: true, seed: 5 });
  group.add(mergedBoxes(t, specs, SCAFFOLD_WOOD, { tex: 'wood', rough: 0.85 }));
  // a hut-like stall box on the deck: body, cantilevered counter shelf and a
  // tilted canopy carried on two front posts (anchored — nothing floats)
  group.add(box(t, [1.0, 0.78, 0.85], 0xb8503c, [kx, deckTop + 0.44, kz - 0.05], { tex: 'wood', rough: 0.8 }));
  group.add(box(t, [1.08, 0.05, 0.2], 0xd9cfb8, [kx, deckTop + 0.66, kz + 0.42], { rough: 0.7 }));
  const awn = box(t, [1.14, 0.04, 0.72], 0xe8e2d2, [kx, deckTop + 0.97, kz + 0.28], { rough: 0.8 });
  awn.rotation.x = 0.3;
  group.add(awn);
  [-1, 1].forEach((s) => group.add(box(t, [0.035, 0.86, 0.035], 0x6f4a34, [kx + s * 0.53, deckTop + 0.43, kz + 0.6], { rough: 0.8 })));
  return { group, update: built.update };
}

/** <ElevatedWalkway> — composable ramped-walkway/scaffold demo scene. */
export const ElevatedWalkway = composable('ElevatedWalkway', (t) => buildElevatedWalkwayScene(t));
