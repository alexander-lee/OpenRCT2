// ---------------------------------------------------------------------------
// RIDE ACCESS RIGS — the queue lane mesh + its railing blockers, the queue
// slot geometry, the RCT2 EXIT PATH (`planExitLane` / `buildExitLane`), the
// deterministic placement audit (placeAccess), the RCT2 status line /
// breakdown schedule, the NaN-guarded routing attach, and the settle-time
// RELOCATION tooling (moveRide / moveRideExit / resizeRideLane / moveStall)
// plus the coaster-corridor cell sweep.
//
// No randomness anywhere: every collision fix walks a fixed offset ladder and
// every reliability figure is a hashed constant. Implementation detail of
// createGameManager.
// ---------------------------------------------------------------------------

import type * as THREE from 'three';
import { mergedBoxes } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildFenceRuns } from '../Fence';
import { SURFACE_TARMAC } from '../PathNetwork/surfaces';
// THE PATH CROSS-SECTION, shared with the street renderer. A ride's queue lane
// and its exit footpath are PAVEMENT — the same three courses (slab + kerbs +
// seams) on the same datum as every street — so they are emitted by the same
// `pathRibbon` the network uses instead of by their own inline slab code. See
// ../PathNetwork/ribbon.ts for the constants and for why PATH_PAD_LIP exists.
import {
  PATH_H,
  PATH_MAX_GRADE,
  newRibbonSpecs,
  pathRibbon,
} from '../PathNetwork/ribbon';
import { hash01, SPACING, BREAK_DOWN_SECS } from './types';
import type { BlockerRectSpec, RideStatus, RideRec, RideStationRec, WayPt, QueueSurface } from './types';
import type { Sim } from './sim';

// ---- queue lane in the QueuePath aesthetic: narrow red slab + FENCED sides -
// The lane is RAILED down both long sides with the Fence 'metal' style (the
// RCT2 queue railing), batched into two merged meshes instead of ~18 loose
// posts/rails. The railings are part of the ride's access rig, so they move
// and rebuild with the lane (moveRide / resizeRideLane), and both sides are
// registered as BLOCKERS — a queue is only enterable at its open TAIL, so
// guests must path to the tail node instead of stepping in sideways.
export const LANE_W = 0.55;
export const LANE_RAIL_X = LANE_W / 2 + 0.05;
/** the railings stop this far short of the TAIL — the queue's open mouth */
export const LANE_MOUTH = 0.14;

/** RCT2's own red queue pavement — the unchanged default */
export const QUEUE_RCT2: QueueSurface = { pave: 0x9e3a34, paveTex: 'asphalt' };

/** RCT2's sloped-path limit: one 0.5 height step per 1.2 tile. An access run
 *  steeper than this is a defect in the LAYOUT (a ride pad hoisted far above
 *  the street it queues off), not something a ramp can fix — but a ramp still
 *  beats a flat slab with a step in it, so it is built and warned about.
 *  Shared with the street renderer (PathNetwork/ribbon.ts) — a queue that a
 *  guest cannot climb and a street span they cannot climb are one rule. */
const MAX_ACCESS_GRADE = PATH_MAX_GRADE;

export const buildQueueLane = (
  t: typeof THREE,
  anchor: [number, number, number],
  dir: [number, number],
  len: number,
  surface: QueueSurface = QUEUE_RCT2,
  /**
   * The RENDERED WALKING SURFACE at the lane's TAIL — the top of the pavement
   * the queue joins.
   *
   * A queue lane is pinned at BOTH ends and they are rarely level with each
   * other: the HEAD stands at the ride's own pad (`groundAt(ride) + 0.22`, and
   * higher again on an elevated deck) while the TAIL has to land on a street.
   * The lane used to be one flat slab at the head's level, so the whole
   * difference collected as a STEP where the tail met the pavement — visibly a
   * floating or buried slab end, and queuing guests teleporting up it because
   * `slotPos` handed out one flat `laneY` too. It is an RCT2 SLOPED PATH now:
   * the slab is an inclined ribbon, the railings walk the grade with it
   * (buildFenceRuns pitches each bay), and `slotPos` interpolates the slots.
   *
   * UNITS. This is a SURFACE, and specifically the RENDERED one. `anchor[1]` is
   * a BASE (the head's surface is `anchor[1] + PATH_H`), and the street's drawn
   * top is higher than what `walkYAt` reports (`PathNetwork`'s pads and ramp
   * ribbons finish at `PATH_PAD_TOP`, and a knuckle pad bevels toward its
   * slopes) — so the caller passes `paths.surfaceYAt(laneEnd)`, the RENDERED
   * pavement top where the slab physically ends, not `walkYAt(tail)`. Handing
   * this the bare `walkYAt` value left every lane ending 5-12 mm UNDER the
   * pavement it joined (measured across six rides, probe-lane-joins.mjs).
   *
   * Omitted — or level with the head — keeps a flat lane.
   */
  tailY?: number,
) => {
  const lane = new t.Group();
  // NAMED parts. Stage's `mat()` puts the colour in the TEXTURE and leaves
  // `material.color` white, so a probe cannot tell a queue slab from a street
  // slab from a kerb by colour — the only reliable discriminator is the object
  // graph. Naming the rig costs nothing and makes every join measurable
  // (harness/mp3d-render/probe-lane-joins.mjs).
  lane.name = 'queueLane';
  lane.position.set(anchor[0], anchor[1], anchor[2]);
  lane.rotation.y = Math.atan2(dir[0], dir[1]); // local +z runs head -> tail
  // LANE-LOCAL: y 0 is the anchor, so the head's walked surface is PATH_H
  const headSurf = PATH_H;
  const tailSurf = tailY === undefined ? PATH_H : tailY - anchor[1];
  const grade = len > 1e-6 ? (tailSurf - headSurf) / len : 0;
  if (Math.abs(grade) > MAX_ACCESS_GRADE)
    console.warn(
      `[GameManager] queue lane: the lane climbs ${(tailSurf - headSurf).toFixed(2)} u over ${len.toFixed(
        2,
      )} u (grade ${Math.abs(grade).toFixed(2)}) — steeper than RCT2's one-step-per-tile limit of ${MAX_ACCESS_GRADE.toFixed(
        2,
      )}. The ramp is built anyway, but the ride pad and the street its queue comes off are too far apart in height: level the pad, or plant the tail node on closer paving`,
    );
  // ---- THE PAVEMENT, from the shared cross-section ------------------------
  // Identical slab thickness, seam pitch and inclined-frame maths as a street
  // span. KERBS are opt-in: an RCT2 queue is edged by its RAILING, not by a
  // concrete kerb, so the stock red lane lays none — a themed `QueueSurface`
  // that declares a `kerb` colour gets the street's kerb strips as well.
  const specs = newRibbonSpecs();
  pathRibbon(
    t,
    specs,
    { from: [0, 0], dir: [0, 1], len, surfFrom: headSurf, surfTo: tailSurf },
    {
      width: LANE_W,
      kerbs: surface.kerb !== undefined,
      kerbTrim: 0.02,
      paveRepeatX: 2,
      seamInset: 0.3,
    },
  );
  const named = (m: THREE.Mesh, n: string) => {
    m.name = n;
    return m;
  };
  lane.add(
    named(
      mergedBoxes(t, specs.pave, surface.pave, {
        tex: (surface.paveTex as 'asphalt') ?? 'asphalt',
        rough: 0.95,
        bump: 0.02,
      }),
      'queuePave',
    ),
  );
  if (specs.kerb.length && surface.kerb !== undefined)
    lane.add(named(mergedBoxes(t, specs.kerb, surface.kerb, { tex: 'concrete', rough: 0.9 }), 'queueKerb'));
  if (specs.seam.length)
    lane.add(named(mergedBoxes(t, specs.seam, surface.seam ?? SURFACE_TARMAC.seam, { rough: 1 }), 'queueSeam'));
  const rl = Math.max(0.3, len - LANE_MOUTH);
  const rails = buildFenceRuns(
    t,
    [
      { from: [-LANE_RAIL_X, 0], to: [-LANE_RAIL_X, rl] },
      { from: [LANE_RAIL_X, 0], to: [LANE_RAIL_X, rl] },
    ],
    // `surface.rail` was declared and then never read — the railing was always
    // the stock metal fence. A themed lane needs its rail themed too, or the
    // pavement changes and the brightest lines in the frame do not.
    // groundAt is LANE-LOCAL (the run coords are lane space): the slab top,
    // following the grade so the railings climb the ramp with the pavement.
    { style: 'metal', height: 0.5, groundAt: (_x, z) => headSurf + grade * z, color: surface.rail },
  );
  rails.group.name = 'queueRail';
  lane.add(rails.group);
  return lane;
};

/** the lane railings' WORLD blocker rects (both long sides) */
export const laneFenceRects = (anchor: [number, number, number], dir: [number, number], len: number): BlockerRectSpec[] => {
  const yaw = Math.atan2(dir[0], dir[1]);
  const px = dir[1]; // local +x in world = [cos yaw, −sin yaw] = [dir.z, −dir.x]
  const pz = -dir[0];
  const rl = Math.max(0.3, len - LANE_MOUTH);
  return [-1, 1].map((s) => ({
    cx: anchor[0] + px * s * LANE_RAIL_X + dir[0] * (rl / 2),
    cz: anchor[2] + pz * s * LANE_RAIL_X + dir[1] * (rl / 2),
    hx: 0.07,
    hz: rl / 2 + 0.07,
    yaw,
  }));
};

// ---------------------------------------------------------------------------
// THE EXIT PATH — RCT2's "construct a path FROM the ride exit"
// ---------------------------------------------------------------------------
// RCT2 hands a ride TWO path connections, not one, and they are DIFFERENT
// kinds of path:
//
//   * the ENTRANCE takes a QUEUE. `FootpathChainRideQueue` walks outward from
//     the entrance tile (`DirectionReverse(element->getDirection())`,
//     Footpath.cpp:974-976) stamping ride id + station on every queue tile and
//     hanging the ride sign on the last one (Footpath.cpp:884-919).
//   * the EXIT takes an ORDINARY FOOTPATH. A guest finishing a ride is put
//     down on the tile IMMEDIATELY OUTSIDE the exit — `updateRidePrepareForExit`
//     walks them to `exitTileCentre − DirectionOffsets[exit.direction]·20`,
//     i.e. 20 units OUTWARD of the centre (Guest.cpp:4412-4452, and
//     `exit.direction` points INWARD at the station) — and
//     `updateRideLeaveExit` then puts them in `PeepState::falling` and looks
//     for a PathElement on that tile (Guest.cpp:5092-5140). With no path
//     there, `Peep::UpdateFalling` (Peep.cpp:781-890) drops them onto the bare
//     TERRAIN (they walk on, lost and unhappy) — or DROWNS them if the tile is
//     water (Peep.cpp:831-854). And for as long as the ride is open the park
//     gets a recurring red news item, `STR_EXIT_NOT_CONNECTED`: "<ride> has no
//     path leading from its exit! Construct a path from the ride exit"
//     (Ride.cpp:2076, reachability test `RideEntranceExitIsReachable`
//     Ride.cpp:2035 → `MapCoordIsConnected` Map.cpp:707-741).
//
// So an exit standing on grass is LEGAL in RCT2 and permanently flagged. This
// is the mirror of `buildQueueLane`: an ordinary (grey, UNFENCED — a footpath,
// not a queue) run from the exit hut's doorway apron out to the street.
// UNFENCED is deliberate: a queue must only be enterable at its open tail, so
// its sides are railed and blocker-registered, whereas a footpath is walkable
// from any side — which is exactly what the leaving guest needs.

/** width of the exit path slab — the queue lane's width, so the pair reads as
 *  one assembly from the park camera */
export const EXIT_LANE_W = LANE_W;
/** the exit path's near end sits this far out from the exit hut CENTRE (hut
 *  half-depth 0.50 + a 0.12 apron), mirroring the entrance hut's 0.62 */
export const EXIT_LANE_BACK = 0.62;
/** how far out an exit path will reach for a street before giving up */
export const EXIT_LANE_MAX = 9;

/** an exit path is at most two legs, so at most two audited rects — one label
 *  each, both stripped by validatePark's `rideOf` */
export const exitLaneLabels = (name: string): [string, string] => [`${name} exit lane`, `${name} exit lane join`];

/** one straight cardinal leg of an exit path */
export interface ExitLaneLeg {
  /** near end, world xz */
  from: [number, number];
  /** unit cardinal direction */
  dir: [number, number];
  len: number;
}
export interface ExitLanePlan {
  legs: ExitLaneLeg[];
  /** where the run meets the street — the guest's re-entry point */
  end: [number, number];
  /** total paved length */
  len: number;
  /** 'ray' = the outward ray met the street; 'join' = it ran on past the
   *  queue's own tail, so the path turns one tile and joins THAT node instead */
  hit: 'ray' | 'join';
}


/** what the exit path is PAVED with. The full street palette, not just the
 *  wearing course: an exit path is a ROAD (see `buildExitLane`) and a road that
 *  keeps its kerbs and seams from a themed land's surface is the whole point of
 *  threading `theme.pathSurface` down here. `kerb`/`seam` fall back to the
 *  stock tarmac's, so the narrower `{ pave }` shape older callers pass still
 *  produces a municipal grey road. */
export type ExitSurface = {
  pave: number;
  kerb?: number;
  seam?: number;
  paveTex?: string;
  kerbTex?: string;
  rough?: number;
};

/**
 * The path out of a ride, built from the SAME pavement the streets are.
 *
 * RCT2 hands the exit an ORDINARY FOOTPATH — the same tile the streets are made
 * of, not the red queue — and in this design system a street is not just its
 * wearing course: a pave slab carried 0.02 below grade, pale KERB strips
 * straddling both free sides 0.01 proud of the slab top, and EXPANSION-JOINT
 * SEAMS every half tile. That trim is what makes pavement read as pavement from
 * the park camera. This run lays exactly those three courses through
 * `pathRibbon` — the very function `buildPathNetwork` lays its own spans with —
 * so there is ONE definition of the cross-section and a change to it reaches the
 * streets and the ride access runs together. (It used to be a second, hand-kept
 * copy of the numbers, and it had drifted: the slab was 0.09 thick where the
 * network's is 0.11, so its edge showed an air gap the street's never does.)
 *
 * It RAMPS. `endY` is the RENDERED walking surface where the run meets the
 * street; the legs are then inclined ribbons carrying the hut's apron level down
 * (or up) to the pavement, with kerbs and seams on the inclined plane. Omitted,
 * the run stays dead level.
 *
 * One group, THREE merged meshes (pave / kerb / seam) plus at most one berm mesh
 * — a two-leg run used to cost ~26 draw calls of loose boxes.
 */
export const buildExitLane = (
  t: typeof THREE,
  plan: ExitLanePlan,
  y: number,
  surface: ExitSurface = SURFACE_TARMAC,
  /** WORLD ground sampler — with it each leg gets the same earth berm
   *  `groundRideAccess` puts under the queue lane, so the run never floats over
   *  a dip. */
  groundAt?: (x: number, z: number) => number,
  /** the parent group's world offset, when it carries a moveRide shift: the
   *  plan is in the GROUP's frame, the ground sampler is in the WORLD's */
  origin: [number, number, number] = [0, 0, 0],
  /**
   * THE RENDERED WALKING SURFACE where the run meets the street — the top of the
   * pavement, not its base and not the sim's datum.
   *
   * TWO unit traps live on this one argument, and both have been paid for:
   *
   *  1. `y` is a BASE (this run's near end surfaces at `y + PATH_H`) while this
   *     is a SURFACE. Confusing them left every exit path ending exactly
   *     PATH_H (0.09 u) proud of the street it joined — a uniform step across
   *     every ride, which is the signature of a datum error, not a layout one.
   *  2. `paths.walkYAt` is the SIM's datum and reports `node + PATH_H`, but the
   *     pavement DRAWN there is higher: junction pads and ramp ribbons finish at
   *     `PATH_PAD_TOP`, and a knuckle pad bevels toward each of its sloped
   *     edges. Passing the bare `walkYAt` value left every run ending 5-12 mm
   *     UNDER the street — measured across six rides. Callers pass
   *     `paths.surfaceYAt(plan.end)`, the RENDERED top at the run's far end.
   *
   * Omitted ⇒ a level run.
   */
  endY?: number,
  /** for the over-grade warning only */
  label = 'exit path',
) => {
  const g = new t.Group();
  g.name = 'exitLane'; // see buildQueueLane's note on why the rig is named
  const KERB = surface.kerb ?? SURFACE_TARMAC.kerb;
  const SEAM = surface.seam ?? SURFACE_TARMAC.seam;
  const total = Math.max(1e-6, plan.len);
  /** the run's near-end walked surface — `y` is the exit hut's base level and
   *  its apron finishes at PATH_H, the shared path course */
  const surf0 = y + PATH_H;
  const rise = endY === undefined ? 0 : endY - surf0;
  if (Math.abs(rise) / total > MAX_ACCESS_GRADE)
    console.warn(
      `[GameManager] ${label}: the run climbs ${rise.toFixed(2)} u over ${total.toFixed(2)} u (grade ${(Math.abs(rise) / total).toFixed(
        2,
      )}) — steeper than RCT2's one-step-per-tile limit of ${MAX_ACCESS_GRADE.toFixed(
        2,
      )}. The ramp is built anyway (a steep ramp still beats a step), but the ride pad and the street it exits onto are too far apart in height: level the pad, or put the exit on a face that meets closer paving`,
    );
  /** walked surface `d` plan-units along the whole run */
  const surfAt = (d: number) => surf0 + rise * Math.max(0, Math.min(1, d / total));
  const specs = newRibbonSpecs();
  const bermSpecs: MergedBoxSpec[] = [];
  let along = 0;
  plan.legs.forEach((leg, i) => {
    const last = i === plan.legs.length - 1;
    const len = leg.len + (last ? 0 : EXIT_LANE_W / 2); // fill the corner
    const s0 = surfAt(along);
    const s1 = surfAt(along + len);
    along += leg.len;
    // the three courses, in the leg's own inclined frame — one shared emitter
    const run = pathRibbon(
      t,
      specs,
      { from: leg.from, dir: leg.dir, len, surfFrom: s0, surfTo: s1 },
      {
        width: EXIT_LANE_W,
        // an L's corner: pull both kerbs back half a slab width so the two
        // legs' strips meet instead of crossing
        kerbTrim: plan.legs.length > 1 ? EXIT_LANE_W / 2 : 0.02,
        paveRepeatX: 2,
      },
    );
    if (!groundAt) return;
    // THE BERM: lowest ground sampled along the leg, in WORLD coords
    let minG = Infinity;
    for (let k = 0; k <= 5; k += 1) {
      const u = k / 5;
      minG = Math.min(
        minG,
        groundAt(origin[0] + leg.from[0] + leg.dir[0] * len * u, origin[2] + leg.from[1] + leg.dir[1] * len * u),
      );
    }
    // sized off the HIGH end so an inclined berm still reaches ground at the low
    // one; the run's underside is PATH_H below its surface plus the 0.02 the
    // slab is carried under grade, so measure the lift from THERE
    const lift = Math.max(s0, s1) - PATH_H + origin[1] - minG;
    if (lift <= 0.05) return;
    const h = lift + 0.3;
    const yaw = Math.atan2(leg.dir[0], leg.dir[1]);
    const pitch = -Math.atan2(s1 - s0, len);
    const eul = new t.Euler(pitch, yaw, 0, 'YXZ');
    const m = new t.Matrix4().makeRotationFromEuler(eul);
    const n = new t.Vector3(0, 1, 0).applyMatrix4(m);
    const cx = leg.from[0] + leg.dir[0] * (len / 2);
    const cz = leg.from[1] + leg.dir[1] * (len / 2);
    const cy = (s0 + s1) / 2;
    // the berm's TOP sits 0.01 above the slab's nominal base (surface − PATH_H),
    // exactly where `groundRideAccess` puts the queue lane's own berm
    const off = -h / 2 - PATH_H + 0.01;
    m.setPosition(cx + n.x * off, cy + n.y * off, cz + n.z * off);
    bermSpecs.push({ dims: [EXIT_LANE_W + 0.05, h, run], matrix: m, repeat: [2, 6] });
  });
  const named = (mesh: THREE.Mesh, n: string) => {
    mesh.name = n;
    return mesh;
  };
  if (specs.pave.length)
    g.add(
      named(
        mergedBoxes(t, specs.pave, surface.pave, {
          tex: (surface.paveTex as 'asphalt') ?? 'asphalt',
          rough: surface.rough ?? 0.95,
          bump: 0.02,
        }),
        'exitPave',
      ),
    );
  if (specs.kerb.length)
    g.add(named(mergedBoxes(t, specs.kerb, KERB, { tex: (surface.kerbTex as 'concrete') ?? 'concrete', rough: 0.9 }), 'exitKerb'));
  if (specs.seam.length) g.add(named(mergedBoxes(t, specs.seam, SEAM, { rough: 1 }), 'exitSeam'));
  if (bermSpecs.length) g.add(named(mergedBoxes(t, bermSpecs, EXIT_BERM_EARTH, { tex: 'concrete', rough: 1 }), 'exitBerm'));
  return g;
};
/** the earth colour `ParkBuilder/placement.ts` berms every other access run in */
const EXIT_BERM_EARTH = 0x6d5c43;

/** one leg's audited footprint (thin, so a parallel queue lane one tile over
 *  clears it: 0.30 + the lane's 0.36 = 0.66 < 1.2) */
export const exitLaneRect = (leg: ExitLaneLeg, label: string): FootRect => ({
  cx: leg.from[0] + leg.dir[0] * (leg.len / 2),
  cz: leg.from[1] + leg.dir[1] * (leg.len / 2),
  hx: 0.3,
  hz: leg.len / 2,
  yaw: Math.atan2(leg.dir[0], leg.dir[1]),
  label,
});

/**
 * Plan the exit path. Cardinal only, RCT2-style, in at most two legs:
 *
 *  1. THE RAY. Cast the exit hut's OUTWARD ray at the street lattice and stop at
 *     the first street it meets — a node sitting on the ray, or an edge it
 *     crosses. With the RCT2 layout (entrance and exit adjacent on one face,
 *     both facing out) that ray runs PARALLEL to the queue lane one tile over,
 *     and the street it meets is the CROSS-STREET through the queue's own tail
 *     node. Its far end lands on the street centreline, where the slabs meet.
 *
 *  2. THE JOIN. A tail node that is a DEAD-END SPUR (a street poked into a
 *     themed court to serve one ride) has no cross-street, so the ray sails past
 *     it and on to whatever street it meets next — measured on the worlds
 *     reference park: 6.1-8.3 u runs cutting across three set-piece quarters, and
 *     twice nothing at all inside 9 u. That is not what a player builds. Given
 *     the queue's `tail`, the path instead runs out LEVEL with it and turns one
 *     tile to join it — which is the actual RCT2 move: the exit path runs
 *     alongside the queue and meets the same footpath at its end.
 *
 * Whichever is SHORTER wins, so a real cross-street still beats the join. Returns
 * `null` when neither is available: a real layout defect (the exit faces a
 * meadow and the queue has no tail either), which `registerRide` reports rather
 * than paving into nowhere.
 */
export const planExitLane = (
  start: [number, number],
  dir: [number, number],
  net: { nodes: [number, number][]; edges: [number, number][] } | null,
  streetNodes: number,
  maxReach = EXIT_LANE_MAX,
  tail?: [number, number],
): ExitLanePlan | null => {
  if (!net || !Number.isFinite(start[0]) || !Number.isFinite(start[1])) return null;
  const n0 = Math.max(0, Math.min(streetNodes, net.nodes.length));
  const px = -dir[1]; // the ray's lateral axis
  const pz = dir[0];
  // ---- 1. the straight ray -------------------------------------------------
  let ray = Infinity;
  for (let i = 0; i < n0; i += 1) {
    const dx = net.nodes[i][0] - start[0];
    const dz = net.nodes[i][1] - start[1];
    const along = dx * dir[0] + dz * dir[1];
    if (along < 0.35 || along > maxReach) continue;
    if (Math.abs(dx * px + dz * pz) > 0.45) continue; // off the ray
    ray = Math.min(ray, along);
  }
  for (const [a, b] of net.edges) {
    if (a >= n0 || b >= n0) continue; // logical spur, not a rendered street
    const A = net.nodes[a];
    const B = net.nodes[b];
    const ex = B[0] - A[0];
    const ez = B[1] - A[1];
    // start + t·dir = A + u·e  ⇒  t = (r × e)/(dir × e), u = (r × dir)/(dir × e)
    const den = dir[0] * ez - dir[1] * ex;
    if (Math.abs(den) < 1e-6) continue; // parallel — never crossed
    const rx = A[0] - start[0];
    const rz = A[1] - start[1];
    const t = (rx * ez - rz * ex) / den;
    const u = (rx * dir[1] - rz * dir[0]) / den;
    if (u < -0.02 || u > 1.02) continue; // misses the segment
    if (t < 0.35 || t > maxReach) continue;
    ray = Math.min(ray, t);
  }
  // ---- 2. the join onto the queue's own tail node ---------------------------
  let join: { alongT: number; lat: number } | null = null;
  if (tail) {
    const dx = tail[0] - start[0];
    const dz = tail[1] - start[1];
    const alongT = dx * dir[0] + dz * dir[1];
    const lat = dx * px + dz * pz;
    // the RCT2 shape is exactly one tile of lateral offset; allow a cell of slack
    if (alongT >= 0.35 && Math.abs(lat) >= 0.6 && Math.abs(lat) <= 1.85) join = { alongT, lat };
  }
  const rayLen = ray;
  const joinLen = join ? join.alongT + Math.abs(join.lat) : Infinity;
  if (!Number.isFinite(rayLen) && !Number.isFinite(joinLen)) return null;
  if (rayLen <= joinLen) {
    const end: [number, number] = [start[0] + dir[0] * rayLen, start[1] + dir[1] * rayLen];
    return { legs: [{ from: start, dir, len: rayLen }], end, len: rayLen, hit: 'ray' };
  }
  const j = join!;
  const corner: [number, number] = [start[0] + dir[0] * j.alongT, start[1] + dir[1] * j.alongT];
  const side = j.lat >= 0 ? 1 : -1;
  const bDir: [number, number] = [px * side, pz * side];
  const end: [number, number] = [corner[0] + bDir[0] * Math.abs(j.lat), corner[1] + bDir[1] * Math.abs(j.lat)];
  return {
    legs: [
      { from: start, dir, len: j.alongT },
      { from: corner, dir: bDir, len: Math.abs(j.lat) },
    ],
    end,
    len: joinLen,
    hit: 'join',
  };
};

/** slot `i` of a PLATFORM's queue lane. Takes the station, not the ride: a
 *  multi-station transport ride has one lane per platform (RCT2 `RideStation`,
 *  ride/Ride.h:163-183). `ride.stations[0]` is a view over the ride's own
 *  fields, so a one-station ride is unchanged. */
export const slotPos = (st: RideStationRec, i: number): WayPt => {
  const along = 0.45 + i * SPACING;
  // the lane is a RAMP whenever its tail meets a street at a different level
  // (buildQueueLane), so a slot's height is the interpolation along it — a
  // single flat `laneY` had guests standing in the air at the tail end of an
  // elevated ride's queue, or knee-deep in the slab at the head of a sunken one
  const k = st.laneLen > 1e-6 ? Math.max(0, Math.min(1, along / st.laneLen)) : 0;
  return {
    x: st.anchor[0] + st.dir[0] * along,
    z: st.anchor[2] + st.dir[1] * along,
    y: st.laneY + (st.laneTailY - st.laneY) * k,
  };
};

// ---- placeAccess: deterministic entrance/exit/queue placement audit -------
// Conservative oriented-rectangle footprints (2D SAT) for the entrance hut,
// exit hut, queue lane and boardPoint pad. registerRide checks this ride's
// footprints against each other AND every previously registered ride's; any
// collision is console.warn'ed with specifics, and an EXIT collision is
// auto-fixed by shifting the exit hut along its pad edge (first non-
// colliding offset in 0, ±0.1 … ±0.8). No randomness anywhere.
export interface FootRect {
  cx: number;
  cz: number;
  hx: number; // half-extent along local x
  hz: number; // half-extent along local z (yaw facing)
  yaw: number;
  label: string;
}

export const rectsOverlap = (a: FootRect, b: FootRect): boolean => {
  // 2D OBB SAT: 4 candidate axes (each rect's local x and z)
  const axes: [number, number][] = [
    [Math.cos(a.yaw), -Math.sin(a.yaw)],
    [Math.sin(a.yaw), Math.cos(a.yaw)],
    [Math.cos(b.yaw), -Math.sin(b.yaw)],
    [Math.sin(b.yaw), Math.cos(b.yaw)],
  ];
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  for (const [ux, uz] of axes) {
    const ra =
      a.hx * Math.abs(Math.cos(a.yaw) * ux - Math.sin(a.yaw) * uz) + a.hz * Math.abs(Math.sin(a.yaw) * ux + Math.cos(a.yaw) * uz);
    const rb =
      b.hx * Math.abs(Math.cos(b.yaw) * ux - Math.sin(b.yaw) * uz) + b.hz * Math.abs(Math.sin(b.yaw) * ux + Math.cos(b.yaw) * uz);
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false; // separating axis
  }
  return true;
};

export const hutRect = (x: number, z: number, yaw: number, label: string): FootRect =>
  ({ cx: x, cz: z, hx: 0.55, hz: 0.5, yaw, label }); // base slab 1.09×0.94 + margin

// ---- breakdowns: OFF BY DEFAULT ------------------------------------------
// Rides used to break down on a hashed per-ride schedule — a mean time between
// failures of 40–95 s against 18 s of downtime (BREAK_DOWN_SECS 12 +
// REPAIR_SECS 6), which put every ride OUT OF SERVICE 16–31% of the time. That
// is faithful to RCT2 and it is not what this design system is for: these parks
// are looked at, not managed, and there is no mechanic to dispatch. Measured on
// a 1800 sim-s run it also cost 8–23% of all boarded riders — `breakDown` calls
// `drainRide`, which unloads everyone aboard as `notSafe` and credits nobody —
// and it froze the monorail fleet for 14% of the clock.
//
// TURNED OFF AT THE SCHEDULE, not by deleting the machinery. `Infinity` here
// means `s.simTime >= r.nextBreak` is never true, so no ride ever breaks and
// every downstream consumer keeps working unchanged rather than being ripped
// out and half-restored later: `handle.status()` still answers (always
// open/closed), `RideStatus` still types the mechanic states, the FSM's repair
// path is still there, and `<Monorail>`'s breakdown brake still exists for a
// ride that opts back in.
//
// A ride CAN opt back in with `breakdownEvery` — that is now the only way to
// get one, and it is exact rather than hashed.
export const breakIntervalOf = (r: RideRec): number => {
  if (r.cfg.breakdownEvery === undefined) return Infinity; // never
  const base = r.cfg.breakdownEvery;
  return base + hash01(r.idx * 13.1 + r.breakN * 29.7) * base * 0.25;
};

export function createAccess(s: Sim) {
  const { t, opts, net, routing, groundAt, rides, stalls } = s;

  const allFootprints: FootRect[] = [];
  // RESIDUAL access collisions (no safe auto-fix / auto-fix exhausted) —
  // recorded so validatePark can promote them to hard failures (round-1
  // safeguard: an overlap must never stay a console-only warn)
  const accessAuditRecs: { a: string; b: string; msg: string }[] = [];
  const placeAccess = (
    name: string,
    entRect: FootRect,
    laneRect: FootRect,
    padRect: FootRect,
    exitXZ: [number, number],
    exitYaw: number,
  ): { exit: [number, number]; shift: number } => {
    const warn = (msg: string) => console.warn(`[GameManager] placeAccess(${name}): ${msg}`);
    // entrance hut / queue lane vs own pad and vs every earlier ride — these
    // have no safe auto-fix, so report them for the caller to re-plan
    const fixed: [FootRect, FootRect[]][] = [
      [entRect, [padRect, ...allFootprints]], // ent×lane skipped: they abut by design
      [laneRect, [padRect, ...allFootprints]],
    ];
    for (const [rect, others] of fixed) {
      for (const o of others)
        if (rectsOverlap(rect, o)) {
          warn(`${rect.label} intersects ${o.label} — adjust queueAnchor/queueDir`);
          accessAuditRecs.push({ a: rect.label, b: o.label, msg: `${rect.label} intersects ${o.label} — adjust queueAnchor/queueDir` });
        }
    }
    // exit hut: try pad-edge tangent offsets deterministically until clear
    const tan: [number, number] = [Math.cos(exitYaw), -Math.sin(exitYaw)]; // ⟂ to the exit's outward facing
    const exitBlockers = [entRect, laneRect, padRect, ...allFootprints];
    const shifts = [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.4, -0.4, 0.5, -0.5, 0.6, -0.6, 0.7, -0.7, 0.8, -0.8];
    for (const sh of shifts) {
      const ex = hutRect(exitXZ[0] + tan[0] * sh, exitXZ[1] + tan[1] * sh, exitYaw, `${name} exit hut`);
      const hit = exitBlockers.find((o) => rectsOverlap(ex, o));
      if (!hit) {
        if (sh !== 0) warn(`exit hut collided at its configured spot — auto-shifted ${sh > 0 ? '+' : ''}${sh.toFixed(1)} along its pad edge`);
        return { exit: [ex.cx, ex.cz], shift: sh };
      }
      if (sh === 0) warn(`exit hut intersects ${hit.label} — searching along the pad edge`);
    }
    warn('exit hut still collides after ±0.8 pad-edge search — keeping the configured spot');
    accessAuditRecs.push({
      a: `${name} exit hut`,
      b: 'multiple obstacles',
      msg: `${name} exit hut still collides after the ±0.8 pad-edge search — re-plan the exit cell`,
    });
    return { exit: exitXZ, shift: 0 };
  };

  // ---- the EXIT PATH audit -------------------------------------------------
  // The same treatment the queue lane gets in placeAccess: no safe auto-fix
  // (the run is pinned at both ends — the exit hut and the street it meets), so
  // a collision is warned AND recorded for validatePark to fail on. The ride's
  // OWN exit hut is exempt: the path abuts its doorway apron by design, exactly
  // as the entrance hut abuts the head of its queue lane.
  const auditExitLane = (name: string, laneRects: FootRect[], exempt: string[]): void => {
    const skip = new Set(exempt);
    for (const laneRect of laneRects)
      for (const o of allFootprints) {
        if (skip.has(o.label)) continue;
        if (!rectsOverlap(laneRect, o)) continue;
        const msg = `${laneRect.label} crosses ${o.label} — the exit path must reach the street without cutting the ride's own rig, a coaster corridor or another ride; re-plan the exit cell/exitDir`;
        console.warn(`[GameManager] placeAccess(${name}): ${msg}`);
        accessAuditRecs.push({ a: laneRect.label, b: o.label, msg });
      }
  };

  // the RCT2 ride-window status line (Ride::formatStatusTo, Ride.cpp:528-564)
  const statusOf = (r: RideRec): RideStatus => {
    if (r.state === 'crashed') return 'closed'; // wreck: not operating
    if (r.brokenAt >= 0) return s.simTime - r.brokenAt < BREAK_DOWN_SECS ? 'brokenDown' : 'beingRepaired';
    return 'open';
  };

  // ---- NaN guard for the routing-attach math ---------------------------------
  // A registration built from a bad anchor (e.g. a 2-element anchor where
  // [x, y, z] is expected, or a doorway derived from a failed hut placement)
  // used to push a NaN node into the SHARED path net — silently corrupting
  // the whole graph (paths.totalLength → NaN). Skip + warn instead.
  const safeAttach = (label: string, x: number, z: number): { node: number; x: number; z: number } | null => {
    if (!routing) return null;
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      console.warn(
        `[GameManager] ${label}: attach point [${x}, ${z}] is not finite — check the registration's anchor/exit/doorway (world [x, y, z] points); NOT attached to the path graph`,
      );
      return null;
    }
    return routing.attach(x, z);
  };

  // ---- runtime relocation + corridor accessors (round-5 safeguard) ----------
  // <Park>'s settle-time corridor auto-resolver moves a flat ride/stall whose
  // registered footprint landed inside a coaster's 1.6-u track corridor. These
  // keep the SIM in lockstep with the moved visual: every registered point,
  // audited footprint rect, hut/lane mesh and routing attach node translates
  // by the same [dx, dz]. Call BEFORE guests spawn (the <Park> settle pass
  // does) — waypoints already handed to walking guests are not rewritten.
  const shiftWayPt = (p: WayPt, dx: number, dz: number) => {
    p.x += dx;
    p.z += dz;
  };
  // a relocation can RESOLVE a registration-time placeAccess collision — drop
  // every recorded residual whose rects no longer overlap, so validatePark
  // doesn't fail a collision that no longer exists
  const reauditAccess = () => {
    for (let i = accessAuditRecs.length - 1; i >= 0; i -= 1) {
      const rec = accessAuditRecs[i];
      const ra = allFootprints.find((f) => f.label === rec.a);
      if (!ra) continue;
      if (rec.b === 'multiple obstacles') {
        const rideName = rec.a.replace(/ exit hut$/, '');
        if (allFootprints.every((f) => f === ra || f.label.startsWith(`${rideName} `) || !rectsOverlap(ra, f))) accessAuditRecs.splice(i, 1);
        continue;
      }
      const rb = allFootprints.find((f) => f.label === rec.b);
      if (rb && !rectsOverlap(ra, rb)) accessAuditRecs.splice(i, 1);
    }
  };
  /** the ride's queue TAIL cell — the exit path's fallback join target */
  const queueTailOf = (r: RideRec): [number, number] => [
    r.cfg.queueAnchor[0] + r.dir[0] * (r.laneLen + 0.35),
    r.cfg.queueAnchor[2] + r.dir[1] * (r.laneLen + 0.35),
  ];
  /** dispose one lane subgroup's geometry/materials (shared geometry spared) */
  const disposeLane = (g: THREE.Group) => {
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !m.geometry.userData?.shared) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
    });
  };
  /**
   * RE-PLAN a ride's EXIT PATH in place. The run is pinned at BOTH ends — the
   * exit hut and the street it meets — so unlike the queue lane (pinned only at
   * its head) it cannot simply travel with a relocated rig: after a corridor
   * shift or a pad-edge exit slide its far end no longer touches the paving.
   * Re-casts the outward ray, rebuilds the slab at the new length, and pulls the
   * routing spur onto the new end. Records the RCT2 `STR_EXIT_NOT_CONNECTED`
   * condition when the moved exit no longer faces a street at all.
   */
  const replanExitLane = (r: RideRec): void => {
    if (r.exitLaneG) {
      r.accessG.remove(r.exitLaneG);
      disposeLane(r.exitLaneG);
      r.exitLaneG = null;
    }
    for (let i = allFootprints.length - 1; i >= 0; i -= 1)
      if (exitLaneLabels(r.cfg.name).includes(allFootprints[i].label)) allFootprints.splice(i, 1);
    const startX = r.exitPos.x + r.exitDir[0] * EXIT_LANE_BACK;
    const startZ = r.exitPos.z + r.exitDir[1] * EXIT_LANE_BACK;
    const plan = planExitLane([startX, startZ], r.exitDir, net, s.coreNodeCount, EXIT_LANE_MAX, queueTailOf(r));
    if (!plan) {
      r.exitLaneLen = 0;
      r.exitCorner = null;
      r.exitOut.x = r.exitPos.x + r.exitDir[0] * 1.5;
      r.exitOut.z = r.exitPos.z + r.exitDir[1] * 1.5;
      return;
    }
    // the STREET level at the far end, in WORLD y — the run ramps to it.
    // `walkY` is the SIM datum; `surfY` is the pavement actually DRAWN there
    // (PathNetwork/build.ts `surfaceYAt`), and the slab has to reach what is
    // drawn or it ends in a step. `exitCorner`/`exitOut` keep the SIM datum.
    const endY = net ? s.walkY(plan.end[0], plan.end[1]) : undefined;
    const endRenderY = net ? s.surfY(plan.end[0], plan.end[1]) : undefined;
    r.exitCorner =
      plan.legs.length > 1
        ? {
            x: plan.legs[1].from[0],
            z: plan.legs[1].from[1],
            // WALKING SURFACES at both ends (see registry.ts) — the apron is
            // the exit hut's slab top, not its base
            y:
              r.exitPos.y +
              0.09 +
              ((endY ?? r.exitPos.y + 0.09) - (r.exitPos.y + 0.09)) * (plan.legs[0].len / Math.max(1e-6, plan.len)),
          }
        : null;
    r.exitLaneLen = plan.len;
    // accessG may carry a moveRide offset — the plan is in WORLD coords
    const local: ExitLanePlan = {
      ...plan,
      legs: plan.legs.map((l) => ({ ...l, from: [l.from[0] - r.accessG.position.x, l.from[1] - r.accessG.position.z] as [number, number] })),
    };
    r.exitLaneG = buildExitLane(
      t,
      local,
      r.exitPos.y - r.accessG.position.y,
      r.cfg.exitSurface,
      groundAt,
      [r.accessG.position.x, r.accessG.position.y, r.accessG.position.z],
      endRenderY === undefined ? undefined : endRenderY - r.accessG.position.y, // same (group) frame as `y`
      `${r.cfg.name} exit path`,
    );
    r.accessG.add(r.exitLaneG);
    exitLaneLabels(r.cfg.name).forEach((label, i) => {
      if (plan.legs[i]) allFootprints.push(exitLaneRect(plan.legs[i], label));
    });
    r.exitOut.x = plan.end[0];
    r.exitOut.z = plan.end[1];
    r.exitOut.y = endY ?? r.exitOut.y;
    if (r.exitAttach) {
      r.exitAttach.x = plan.end[0];
      r.exitAttach.z = plan.end[1];
      if (net && net.nodes[r.exitAttach.node]) net.nodes[r.exitAttach.node] = [plan.end[0], plan.end[1]];
    }
  };
  const shiftAttach = (a: { node: number; x: number; z: number } | null, dx: number, dz: number) => {
    if (!a) return;
    a.x += dx;
    a.z += dz;
    if (net && net.nodes[a.node]) net.nodes[a.node] = [a.x, a.z]; // logical spur node — routing reads coords live
  };
  /** translate a registered ride (queue anchor, boarding/exit points, hut +
   *  lane meshes, footprints, routing spurs) by [dx, dz]. The ride's MAIN
   *  visual is the caller's — move it by the same delta. */
  const moveRide = (name: string, dx: number, dz: number): boolean => {
    const r = rides.find((rr) => rr.cfg.name === name);
    if (!r) return false;
    r.cfg.queueAnchor = [r.cfg.queueAnchor[0] + dx, r.cfg.queueAnchor[1], r.cfg.queueAnchor[2] + dz];
    r.cfg.boardPoint = [r.cfg.boardPoint[0] + dx, r.cfg.boardPoint[1], r.cfg.boardPoint[2] + dz];
    r.cfg.exitPoint = [r.cfg.exitPoint[0] + dx, r.cfg.exitPoint[1], r.cfg.exitPoint[2] + dz];
    [r.doorway, r.hutIn, r.exitPos, r.exitDoor, r.exitOut, ...(r.exitCorner ? [r.exitCorner] : [])].forEach((p) => shiftWayPt(p, dx, dz));
    shiftAttach(r.queueAttach, dx, dz);
    shiftAttach(r.exitAttach, dx, dz);
    r.accessG.position.x += dx;
    r.accessG.position.z += dz;
    // the EXIT PATH is pinned at BOTH ends (hut + street), so a whole-rig shift
    // leaves it hanging off the street it was planned onto — re-plan it in place
    replanExitLane(r);
    allFootprints.forEach((f) => {
      if (f.label.startsWith(`${name} `)) {
        f.cx += dx;
        f.cz += dz;
      }
    });
    // the pad + queue-railing blockers travel with the rig
    r.padBlocker?.move(dx, dz);
    r.laneBlockers.forEach((b) => b.move(dx, dz));
    reauditAccess();
    return true;
  };
  /** relocate ONLY a ride's exit hut (mesh, exit points, routing spur,
   *  footprint) by [dx, dz] — the corridor auto-resolver's small fix when the
   *  exit hut alone landed inside a coaster corridor (same spirit as
   *  placeAccess' pad-edge exit shift). */
  const moveRideExit = (name: string, dx: number, dz: number): boolean => {
    const r = rides.find((rr) => rr.cfg.name === name);
    if (!r) return false;
    r.cfg.exitPoint = [r.cfg.exitPoint[0] + dx, r.cfg.exitPoint[1], r.cfg.exitPoint[2] + dz];
    [r.exitPos, r.exitDoor, r.exitOut, ...(r.exitCorner ? [r.exitCorner] : [])].forEach((p) => shiftWayPt(p, dx, dz));
    r.exitG.position.x += dx;
    r.exitG.position.z += dz;
    allFootprints.forEach((f) => {
      if (f.label === `${name} exit hut`) {
        f.cx += dx;
        f.cz += dz;
      }
    });
    replanExitLane(r); // the path back to the street follows the hut, re-cast
    reauditAccess();
    return true;
  };
  /** SHORTEN a ride's queue lane to `newLen` (≥ 1.2): rebuilds the lane
   *  mesh, shrinks the audited footprint, recomputes the slot count and pulls
   *  the tail spur in. The corridor auto-resolver's last-resort tier for
   *  rigs whose derived lane is too long to fit anywhere. Call before guests
   *  spawn (the queue must be empty). */
  const resizeRideLane = (name: string, newLen: number): boolean => {
    const r = rides.find((rr) => rr.cfg.name === name);
    if (!r) return false;
    const len = Math.max(1.2, newLen);
    if (len >= r.laneLen) return false;
    r.laneLen = len;
    r.maxSlots = Math.max(2, Math.floor((len - 0.45) / SPACING));
    // rebuild the lane mesh (accessG may already carry a moveRide offset)
    r.accessG.remove(r.laneG);
    disposeLane(r.laneG);
    // the tail moves with the resize, so re-sample the street it now lands on
    // and re-grade the lane to it (buildQueueLane's `tailY`), in the SAME
    // group-local frame the anchor is passed in
    const newTailX = r.cfg.queueAnchor[0] + r.dir[0] * (len + 0.35);
    const newTailZ = r.cfg.queueAnchor[2] + r.dir[1] * (len + 0.35);
    r.laneTailY = net ? s.walkY(newTailX, newTailZ) : r.laneY;
    r.laneG = buildQueueLane(
      t,
      [r.cfg.queueAnchor[0] - r.accessG.position.x, r.cfg.queueAnchor[1] - r.accessG.position.y, r.cfg.queueAnchor[2] - r.accessG.position.z],
      r.dir,
      len,
      r.cfg.queueSurface, // keep the world's theme through a resize/relocate
      // RENDER target: the drawn pavement is higher than the sim's `laneTailY`
      // datum (PathNetwork/ribbon.ts, and see registry.ts), so the slab ramps to
      // what is DRAWN where it physically ends
      (net ? s.surfY(newTailX - r.dir[0] * 0.35, newTailZ - r.dir[1] * 0.35) : r.laneTailY) - r.accessG.position.y,
    );
    r.accessG.add(r.laneG);
    // audited footprint follows
    allFootprints.forEach((f) => {
      if (f.label === `${name} queue lane`) {
        f.cx = r.cfg.queueAnchor[0] + r.dir[0] * (len / 2);
        f.cz = r.cfg.queueAnchor[2] + r.dir[1] * (len / 2);
        f.hz = len / 2;
      }
    });
    // …and so do the lane's fence-railing blockers (rebuilt at the new length)
    laneFenceRects(r.cfg.queueAnchor, r.dir, len).forEach((rect, i) => r.laneBlockers[i]?.set({ rect }));
    replanExitLane(r); // the exit path's JOIN target is that tail — re-cast it
    // tail spur pulls in with the lane
    if (r.queueAttach) {
      r.queueAttach.x = r.cfg.queueAnchor[0] + r.dir[0] * (len + 0.35);
      r.queueAttach.z = r.cfg.queueAnchor[2] + r.dir[1] * (len + 0.35);
      if (net && net.nodes[r.queueAttach.node]) net.nodes[r.queueAttach.node] = [r.queueAttach.x, r.queueAttach.z];
    }
    reauditAccess();
    return true;
  };
  /** translate a registered stall (anchor, serving front, routing spur) by
   *  [dx, dz]. The stall's visual mesh is the caller's — move it too. */
  const moveStall = (name: string, dx: number, dz: number): boolean => {
    const st = stalls.find((ss) => ss.cfg.name === name);
    if (!st) return false;
    st.cfg.anchor = [st.cfg.anchor[0] + dx, st.cfg.anchor[1], st.cfg.anchor[2] + dz];
    shiftWayPt(st.front, dx, dz);
    shiftAttach(st.attach, dx, dz);
    st.blocker?.move(dx, dz); // the shop body travels with the registration
    return true;
  };
  /** COASTER-CORRIDOR CELLS: 1.2-grid cells (cell centres, street-lattice
   *  aligned) within 1.6 u laterally of a registered circuit's sampled
   *  polyline where the rails run LOW (< 2.2 u of clearance over the cell
   *  ground — flying over higher is legal). Street layouts and stall/pad
   *  placements should avoid these cells BY CONSTRUCTION; `name` filters to
   *  one registered circuit. Requires the `circuits` opt (<Park> wires it). */
  const corridorCells = (name?: string): [number, number][] => {
    const segD = (ax: number, az: number, bx: number, bz: number, x: number, z: number): number => {
      const vx = bx - ax;
      const vz = bz - az;
      const L2 = vx * vx + vz * vz;
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)) : 0;
      return Math.hypot(x - (ax + u * vx), z - (az + u * vz));
    };
    const CORR = 1.6;
    const CLEAR = 2.2;
    const list = (opts.circuits?.() ?? []).filter((c) => (!name || c.name === name) && !c.fatal && c.points.length >= 4);
    const out: [number, number][] = [];
    const seen = new Set<string>();
    for (const c of list) {
      const curve = new t.CatmullRomCurve3(
        c.points.map(([x, y, z]) => new t.Vector3(x, y, z)),
        true,
      );
      const P = curve.getPoints(Math.max(64, Math.ceil(curve.getLength() * 2)));
      for (let i = 0; i < P.length - 1; i += 1) {
        const a = P[i];
        const b = P[i + 1];
        const minY = Math.min(a.y, b.y);
        const i0 = Math.floor((Math.min(a.x, b.x) - CORR) / 1.2);
        const i1 = Math.ceil((Math.max(a.x, b.x) + CORR) / 1.2);
        const j0 = Math.floor((Math.min(a.z, b.z) - CORR) / 1.2);
        const j1 = Math.ceil((Math.max(a.z, b.z) + CORR) / 1.2);
        for (let ci = i0; ci <= i1; ci += 1)
          for (let cj = j0; cj <= j1; cj += 1) {
            const key = `${ci},${cj}`;
            if (seen.has(key)) continue;
            const cx = ci * 1.2;
            const cz = cj * 1.2;
            if (segD(a.x, a.z, b.x, b.z, cx, cz) > CORR) continue;
            if (minY - groundAt(cx, cz) >= CLEAR) continue; // soaring over — legal
            seen.add(key);
            out.push([cx, cz]);
          }
      }
    }
    out.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    return out;
  };

  return {
    allFootprints,
    accessAuditRecs,
    placeAccess,
    auditExitLane,
    statusOf,
    safeAttach,
    shiftWayPt,
    reauditAccess,
    shiftAttach,
    replanExitLane,
    moveRide,
    moveRideExit,
    resizeRideLane,
    moveStall,
    corridorCells,
  };
}
