// ---------------------------------------------------------------------------
// SceneryPack — 20 classic RCT2 base-game scenery objects (gardens / walls /
// statues tabs) that the Kit does NOT already cover. Every piece is grounded
// at y=0 on its own origin, deterministic (hashed-sine scatter, never
// Math.random), textured + bump-mapped on large faces, and contact-audited:
// each part's bottom meets (or embeds into) its support — comments carry the
// arithmetic. Animated pieces (TV static, clock hands, pennant, balloon)
// return an optional per-piece `update(time)`.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { composable } from '../Park';
import { cyl } from './shared';
import type { T, Builder } from './shared';
import { marbleStatue, birdbath, picnicTable, planterBox, topiarySpiral, topiaryElephant, signpost, tvMonitorPost, parkClock, flagpole, ironArchway } from './piecesA';
import { brickWall, picketFence, lionStatue, cactusCluster, fallenLog, mushroomCluster, wishingWell, gazebo, hotAirBalloon } from './piecesB';

// The public surface is UNCHANGED by the split: re-export only `T`, which the
// old single-file index.tsx exported. A blanket `export *` would newly leak
// Stage's box/cyl/mat and all 20 builder functions out of SceneryPack.
export type { T };

// ---------------------------------------------------------------------------
// registry + public API
// ---------------------------------------------------------------------------
const BUILDERS: Record<string, Builder> = {
  marbleStatue: (t) => marbleStatue(t),
  birdbath: (t) => birdbath(t),
  picnicTable: (t) => picnicTable(t),
  planterBox,
  topiarySpiral: (t) => topiarySpiral(t),
  topiaryElephant: (t) => topiaryElephant(t),
  signpost: (t) => signpost(t),
  tvMonitorPost: (t) => tvMonitorPost(t),
  parkClock: (t) => parkClock(t),
  flagpole: (t) => flagpole(t),
  ironArchway: (t) => ironArchway(t),
  brickWall: (t) => brickWall(t),
  picketFence: (t) => picketFence(t),
  lionStatue: (t) => lionStatue(t),
  cactusCluster: (t) => cactusCluster(t),
  fallenLog: (t) => fallenLog(t),
  mushroomCluster,
  wishingWell: (t) => wishingWell(t),
  gazebo: (t) => gazebo(t),
  hotAirBalloon: (t) => hotAirBalloon(t),
};

export const SCENERY_NAMES: string[] = Object.keys(BUILDERS);

export interface SceneryOpts {
  scale?: number;
  seed?: number;
}

/** build a scenery piece with its optional per-frame updater (flag wave, clock hands, TV static, balloon sway) */
export function buildSceneryAnimated(t: T, name: string, opts: SceneryOpts = {}): { group: THREE.Group; update?: (time: number) => void } {
  const builder = BUILDERS[name];
  if (!builder) throw new Error(`SceneryPack: unknown piece "${name}" — valid: ${SCENERY_NAMES.join(', ')}`);
  const built = builder(t, opts.seed ?? 0);
  if (opts.scale) built.group.scale.setScalar(opts.scale); // uniform scale keeps the y=0 ground contact
  return built;
}

/** static build — wraps buildSceneryAnimated and drops the updater */
export function buildScenery(t: T, name: string, opts: SceneryOpts = {}): THREE.Group {
  return buildSceneryAnimated(t, name, opts).group;
}

// ---------------------------------------------------------------------------
// preview: a 5×4 museum of all 20 pieces on a lawn — each on its own concrete
// pad (r 1.2, 3.0-unit grid spacing → 0.6 clearance between pads; widest piece
// is the gazebo eave at r 1.39, still inside its cell)
// ---------------------------------------------------------------------------
export function buildSceneryPackScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
      const updates: ((time: number) => void)[] = [];
      // curated grid: tall centrepieces (balloon, gazebo, arch, flagpole) inboard,
      // low pieces along the edges so nothing hides behind them
      const LAYOUT = [
        'picketFence', 'lionStatue', 'ironArchway', 'brickWall', 'topiarySpiral',
        'mushroomCluster', 'birdbath', 'flagpole', 'marbleStatue', 'cactusCluster',
        'fallenLog', 'wishingWell', 'hotAirBalloon', 'gazebo', 'parkClock',
        'signpost', 'planterBox', 'picnicTable', 'topiaryElephant', 'tvMonitorPost',
      ];
      LAYOUT.forEach((name, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const x = (col - 2) * 3;
        const z = (row - 1.5) * 3;
        g.add(cyl(t, 1.2, 1.25, 0.06, 0xb6b0a2, [x, 0.03, z], { tex: 'concrete', repeat: [8, 1], rough: 0.95, seg: 24 })); // pad 0→0.06
        const { group: piece, update } = buildSceneryAnimated(t, name);
        piece.position.set(x, 0.06, z); // piece sits ON its pad top
        g.add(piece);
        if (update) updates.push(update);
      });
      return (time: number) => updates.forEach((u) => u(time));
    })(three, group) || undefined;
  return { group, update };
}

/** <SceneryPack> — composable (components/Park/Context.md): the 5x4 museum
 *  grid of all 20 pieces. For ONE piece in a park use <Scenery name> (Park)
 *  or buildScenery/buildSceneryAnimated. */
export const SceneryPack = composable('SceneryPack', (t) => buildSceneryPackScene(t));
