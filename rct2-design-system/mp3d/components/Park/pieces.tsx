import React, { useEffect } from 'react';
import * as THREE from 'three';
import { box } from '../Stage';
import {
  buildRideSpline,
  compileTrackPieces,
  buildMiniLog,
  buildMiniSled,
  checkCoasterDesign,
  validateSpline,
  coasterBankCap,
  rateCoaster,
  replayCoasterForces,
} from '../SplineRideKit';
import type { CoasterType, RideProfile, RideRunOpts, TrackPiece, TrackPieceType } from '../SplineRideKit';
import { computeSplineFrames } from '../SplineCoaster';
import { buildCoasterCar, COASTER_CAR_SEATS } from '../CoasterCar';
import { rideColourPreset } from '../ColorKit';
import type { RideColourScheme } from '../ColorKit';
import { planRideAccess, laneLenOf, groundRideAccess } from '../ParkBuilder';
import type { ParkFootRect } from '../ParkBuilder';
import { usePark, isXZ, xzOf, yOf } from './parkContext';
import type { ParkPathsInfo, V3, XZ } from './parkContext';
import {
  ConfigurableRide,
  resolveQueueOrientation,
  adjacentExitCells,
  pickAdjacentExitCell,
  exitIsAdjacentOutward,
  exitAdjacencyLintDetail,
} from './configurableRide';
import type { ComposableRideBuilt, ComposableRideProps, RideRegisterProps } from './configurableRide';

// ---- track pieces — the declarative TRACK vocabulary --------------------------------
//
// Track-based rides compose from PIECES, RCT2-style: either a `pieces` array
// prop (`pieces={['station', { type: 'lift', height: 2 }, 'turnR', 'drop']}`)
// or these JSX piece children (`<Station/><Lift height={2}/><TurnR/><Drop/>`
// — children WIN when both are given). Piece components are pure descriptors:
// they render null and never mount anything — <Coaster>/<TrackRide> (and the
// LogFlume/RiverRapids/Bobsleigh/Monorail components) read them from their
// children at render time and compile them with SplineRideKit's
// compileTrackPieces (which auto-closes the circuit and always runs
// checkCoasterDesign + validateSpline — see the report in the console).

export interface TrackPieceProps {
  /** straight/hill/sbend run; lift/drop horizontal run override */
  length?: number;
  /** lift/drop/hill/helix elevation change */
  height?: number;
  /** turn/helix radius; sbend lateral offset; corkscrew barrel radius;
   *  vertical-loop HALF-HEIGHT (default 1.1, clamped 0.7-1.35) */
  radius?: number;
  /** turn/helix sweep in degrees */
  angle?: number;
  /** vertical loop: the LATERAL step the element makes (default 1.2 = one
   *  RCT2 tile, floored at 1.0 — it is what keeps the loop's two legs apart
   *  where they cross underneath it) */
  offset?: number;
}

type PieceMarked = React.FC<TrackPieceProps> & { trackPiece: (props: TrackPieceProps) => TrackPiece };

function pieceComponent(displayName: string, type: TrackPieceType): PieceMarked {
  const C: PieceMarked = () => null;
  C.displayName = displayName;
  C.trackPiece = (props) => ({ type, ...props });
  return C;
}

/** flat straight that marks boarding — make it the FIRST piece */
export const Station = pieceComponent('Station', 'station');
/** level run (`length`, default 1.3) */
export const Straight = pieceComponent('Straight', 'straight');
/** eased RCT2-legal climb (`height`, default 1.5) */
export const Lift = pieceComponent('Lift', 'lift');
/** eased descent (`height` — default: back down to station level) */
export const Drop = pieceComponent('Drop', 'drop');
/** camelback bump, level entry/exit (`height`, `length`) */
export const Hill = pieceComponent('Hill', 'hill');
/** flat arc (`angle` degrees, default 90; `radius`, default 1.5) */
export const TurnL = pieceComponent('TurnL', 'turnL');
export const TurnR = pieceComponent('TurnR', 'turnR');
/** long arc with an eased elevation change (`angle` 360, `height`) */
export const HelixL = pieceComponent('HelixL', 'helixL');
export const HelixR = pieceComponent('HelixR', 'helixR');
/** lateral shift, heading preserved (`length`; `radius` = offset, +ve left) */
export const SBend = pieceComponent('SBend', 'sbend');

/** inverting corkscrew loop — STEEL coasters only (`dir` 'L' | 'R') */
export const Corkscrew: React.FC<TrackPieceProps & { dir?: 'L' | 'R' }> & {
  trackPiece: (props: TrackPieceProps & { dir?: 'L' | 'R' }) => TrackPiece;
} = () => null;
Corkscrew.displayName = 'Corkscrew';
Corkscrew.trackPiece = ({ dir = 'R', ...rest }) => ({ type: dir === 'L' ? 'corkscrewL' : 'corkscrewR', ...rest });

/** 360° VERTICAL LOOP — STEEL coasters only. `radius` is the loop's
 *  HALF-HEIGHT (default 1.1), `length` its forward advance, `offset` the
 *  one-tile LATERAL step it makes; `dir` picks which way it steps ('R'
 *  default, RCT2's Left/RightVerticalLoop). Enters and exits LEVEL. */
export const Loop: React.FC<TrackPieceProps & { dir?: 'L' | 'R' }> & {
  trackPiece: (props: TrackPieceProps & { dir?: 'L' | 'R' }) => TrackPiece;
} = () => null;
Loop.displayName = 'Loop';
Loop.trackPiece = ({ dir = 'R', ...rest }) => ({ type: dir === 'L' ? 'loopL' : 'loopR', ...rest });

/**
 * Read the track-piece descriptors out of a children tree (fragments and
 * arrays are flattened; wrapper ELEMENTS are dived through, but pieces must
 * not hide inside custom components' render output). Returns null when the
 * children carry no pieces — callers fall back to their `pieces` prop.
 */
export function collectTrackPieces(children: React.ReactNode): TrackPiece[] | null {
  if (children === null || children === undefined) return null;
  const out: TrackPiece[] = [];
  const walk = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      const ty = child.type as { trackPiece?: (p: unknown) => TrackPiece };
      if (typeof ty !== 'string' && typeof ty?.trackPiece === 'function') out.push(ty.trackPiece(child.props));
      else walk((child.props as { children?: React.ReactNode })?.children);
    });
  };
  walk(children);
  return out.length ? out : null;
}

/** seatWorld over a live coaster train: seat i rides car ⌊i/2⌋ at the
 *  COASTER_CAR_SEATS anchors, so REAL boarded guests fill the cars seat by
 *  seat and every unfilled seat reads visibly EMPTY (registered trains build
 *  their cars with `riders: false`). */
function trainSeatWorld(t: typeof THREE, cars: THREE.Group[]): (seat: number) => [number, number, number, number] {
  const p = new t.Vector3();
  const q = new t.Quaternion();
  const s = new t.Vector3();
  const e = new t.Euler();
  const off = new t.Vector3();
  return (seat) => {
    const per = COASTER_CAR_SEATS.length;
    const car = cars[Math.min(cars.length - 1, Math.floor(seat / per))];
    const sp = COASTER_CAR_SEATS[seat % per];
    car.updateWorldMatrix(true, false);
    car.matrixWorld.decompose(p, q, s);
    e.setFromQuaternion(q, 'YXZ');
    off.set(0, sp.y, sp.z).applyQuaternion(q);
    return [p.x + off.x, p.y + off.y, p.z + off.z, e.y];
  };
}

// ---- <Coaster> --------------------------------------------------------------------

export interface CoasterProps {
  /** control points `[x, yAboveRef, z]` — y is height above the circuit's
   *  ground REFERENCE plane (the 80th-percentile trick, recipe §4).
   *  points[0..2] must be the station straight (they are levelled flat).
   *  Optional when `pieces`/piece children are given instead. */
  points?: V3[];
  /** track pieces compiled via compileTrackPieces (beats `points`; the
   *  station straight sits at `start` heading `heading`) */
  pieces?: TrackPiece[];
  /** piece children — <Station/><Lift/>… — WIN over `pieces` */
  children?: React.ReactNode;
  /** pieces mode: world cell of the station start (default [0, 0]).
   *  Accepts `[x, z]` OR the same `[x, y, z]` tuple you passed to
   *  compileTrackPieces (the docs say "give <Coaster> the SAME
   *  pieces/start/heading" — the y is ignored, rails sit at 0.55). */
  start?: XZ | V3;
  /** pieces mode: initial heading yaw in radians, 0 = +z (default 0) */
  heading?: number;
  type?: CoasterType;
  /** max curvature bank in radians — saturated at the type's bankLimit
   *  (wooden 25°, steel 55°) so auto-banking never fails checkCoasterDesign */
  bank?: number;
  name?: string;
  capacity?: number;
  rideDuration?: number;
  loadTime?: number;
  intensity?: number;
  price?: number;
  /** train length (default 3: front/middle/end cars) */
  cars?: number;
  spacing?: number;
  speed?: number;
  /** ColorKit scheme override (default `rideColourPreset(seed + 2, type)`) */
  colours?: RideColourScheme;
  /** queue tail = THIS street-node index (planRideAccess wires the lane) */
  queueTailNode: number;
  /** lane axis, unit, hut → tail */
  queueDir: XZ;
  /**
   * exit hut cell + its OUTWARD doorway facing.
   *
   * THE RCT2 SHAPE: one tile (1.2 u) along the station face from the ENTRANCE
   * hut, `exitDir` equal to `queueDir` — so the queue runs IN beside the exit and
   * the exit's own ordinary footpath runs OUT alongside the lane. The entrance hut
   * sits at `tail − queueDir·(laneLenOf(capacity) + 0.35 + 0.62)`, so the exit cell
   * is that point ± `1.2·[−queueDir.z, queueDir.x]`. A choice that is not
   * adjacent-and-outward is HONOURED and reported as an `exitNotAdjacent` lint —
   * RCT2 does not forbid it (nothing relates station.Entrance to station.Exit,
   * Ride.h:172-173) but the exit PATH is cast along `exitDir`, so a facing that
   * points into a meadow gets no path (RCT2's STR_EXIT_NOT_CONNECTED, Ride.cpp:2076).
   */
  exit?: XZ;
  exitDir?: XZ;
  /** station platform deck cell (boardPoint default; omit for a bare rail) */
  deck?: XZ;
  supportEvery?: number;
}

/** a tracked coaster: `buildRideSpline` circuit + coaster train + station
 *  deck + the full GameManager queue/hut assembly via `planRideAccess` /
 *  `groundRideAccess`. Registers the circuit for validatePark's legality +
 *  crash checks and tags `userData.rideRef`/`rideVehicle` for clickability. */
export function Coaster(props: CoasterProps) {
  const park = usePark('Coaster');
  // pieces: JSX children win over the `pieces` prop; either beats `points`
  const pieces = collectTrackPieces(props.children) ?? props.pieces ?? null;
  const key = JSON.stringify({ ...props, children: 0, pieces, colours: props.colours ? 1 : 0 });
  useEffect(() => {
    // TIME-SLICED MOUNT, and it MUST be queued like the rest. Queueing
    // only SOME components silently inverts their order: everything not
    // queued runs during the commit while the queued ones drain after it,
    // so a synchronous <Coaster> would register before a queued <Gate>
    // planted the park entrance. That reordering cost a real regression
    // (validatePark "no guest completed a ride cycle in 60 sim-s"), so
    // every content component goes through the ONE FIFO queue.
    let disposeBuilt: (() => void) | undefined;
    const buildNow = () => {
      if (!park.ground || !park.paths) throw new Error('<Coaster> needs <Terrain> and <Paths> mounted first');
      const t = park.three;
      // ---- required-prop validation (round-2 safeguard): named errors, never
      // an `undefined[0]` TypeError from deep inside the registration math ----
      {
        const label = `<Coaster> '${props.name ?? 'Coaster'}'`;
        const nNodes = park.paths.net.nodes.length;
        if (!Number.isInteger(props.queueTailNode) || props.queueTailNode < 0 || props.queueTailNode >= nNodes)
          throw new Error(`${label}: queueTailNode must be a street-node index 0..${nNodes - 1} (got ${String(props.queueTailNode)})`);
        if (!isXZ(props.queueDir) || (props.queueDir[0] === 0 && props.queueDir[1] === 0))
          throw new Error(`${label}: queueDir must be a non-zero [x, z] lane direction (hut → tail)`);
        if (props.exit !== undefined && !isXZ(props.exit))
          throw new Error(`${label}: exit must be [x, z] — the exit hut cell (OMIT it to take the RCT2 cell beside the entrance)`);
        if (props.exitDir !== undefined && !isXZ(props.exitDir))
          throw new Error(`${label}: exitDir must be [x, z] — the exit doorway's OUTWARD facing (omit it: it defaults to queueDir)`);
        if (props.deck !== undefined && !isXZ(props.deck)) throw new Error(`${label}: deck must be [x, z] — the station platform cell`);
      }
      const groundAt = park.ground.heightAt;
      const wl = park.ground.waterLevel;
      const type = props.type ?? 'wooden';
      // pieces mode banks to the type's limit by default (wooden 24°, steel
      // 40°) — compiled turns are tighter than hand-laid ones and auto-banking
      // is what soaks the lateral G under the 1.5 g derail guard. Whatever the
      // author asks, the bank SATURATES at the type's bankLimit (round-3
      // safeguard: 36-40° auto-bank on wooden failed 'bankLimit' at documented
      // archetype params) — the registered bank matches what is built.
      const bank = coasterBankCap(type, props.bank ?? (pieces ? (type === 'wooden' ? 0.42 : 0.7) : 0.2));
      let basePts = props.points;
      let fatalReason: string | null = null;
      if (pieces) {
        // start accepts [x, z] or the compileTrackPieces-shaped [x, y, z]
        // (round-3 safeguard: docs say "the SAME start" — a V3 start used to be
        // read as [x, z=y], shifting the whole circuit out of bounds)
        const st = (props.start ?? [0, 0]) as number[];
        const sx = st[0];
        const sz = st.length >= 3 ? st[2] : st[1];
        const compiled = compileTrackPieces(pieces, {
          profile: 'coaster',
          type,
          bank,
          start: [sx, 0.55, sz],
          heading: props.heading ?? 0,
          bounds: park.size, // park bounds forwarded automatically
        });
        basePts = compiled.points;
        if (compiled.report.fatal) fatalReason = compiled.report.fatalReason ?? 'compiled track is fatally invalid';
        console.log(
          `[Coaster] compiled ${pieces.length} pieces → ${basePts.length} points (ok: ${compiled.report.ok}${
            compiled.report.closure.synthesized.length ? `; closed with ${compiled.report.closure.synthesized.join(', ')}` : ''
          }${compiled.report.fatal ? '; FATAL' : ''})`,
        );
        // round-6: the compiler's stat-gate warnings (shortDrop / shortLength)
        // reach the acceptance gate as report.warnings instead of scrolling past
        // in the console — see validate.ts §0
        compiled.report.design.violations
          .filter((v) => v.warning)
          .forEach((v) =>
            park.reportLint(
              `coaster:${v.kind}`,
              `<Coaster> "${props.name ?? 'Coaster'}" stat-gate warning [${v.kind}] at u=${v.at.toFixed(2)} — ${v.detail}`,
              false,
            ),
          );
      }
      if (!basePts) throw new Error('<Coaster> needs `points`, `pieces` or piece children');
      const scheme = props.colours ?? rideColourPreset(park.seed + 2, type === 'wooden' ? 'wooden' : 'steel');
      // ONE ground reference plane (80th percentile along the circuit)
      const gs = basePts.map(([x, , z]) => groundAt(x, z)).sort((a, b) => a - b);
      const gRef = gs[Math.floor(gs.length * 0.8)];
      const pts: V3[] = basePts.map(([x, y, z]) => [x, Math.max(y + gRef + 0.05, groundAt(x, z) + 0.22, wl + 0.5), z]);
      const stY = Math.max(pts[0][1], pts[1][1], pts[2][1]); // level the station flat
      pts[0][1] = stY;
      pts[1][1] = stY;
      pts[2][1] = stY;
      // ---- POINTS-MODE fatal gate (round-2 safeguard) ------------------------
      // `points` used to bypass the pieces-mode guards entirely: a generated
      // park could run an out-of-bounds, self-intersecting circuit as a LIVE
      // ride and only validatePark (after the fact) complained. Points mode now
      // runs the SAME gate compileTrackPieces applies — checkCoasterDesign +
      // validateSpline + park bounds on the as-built world points — and any
      // hard failure renders the translucent red invalid track, skipping the
      // GameManager registration exactly like a fatal compiled track.
      if (!pieces && !fatalReason) {
        const fb = computeSplineFrames(t, pts, { bank });
        let worstExt = 0;
        for (const p of fb.P) worstExt = Math.max(worstExt, Math.abs(p.x), Math.abs(p.z));
        const design = checkCoasterDesign(t, pts, { type, frames: fb, bank });
        const hard = design.violations.filter((v) => !v.warning);
        const sv = validateSpline(t, fb.curve);
        if (worstExt > park.size / 2 + 0.4)
          fatalReason = `the track reaches ±${worstExt.toFixed(2)} u — outside the ±${(park.size / 2).toFixed(1)} u park bounds`;
        else if (hard.length)
          fatalReason = `design violation [${hard[0].kind}] ${hard[0].detail}${hard.length > 1 ? ` (+${hard.length - 1} more)` : ''}`;
        else if (!sv.ok) fatalReason = `spline clearance ${sv.worst.toFixed(2)} < 0.9 (self-intersection risk)`;
        console.log(
          `[Coaster] points-mode checks → design ok: ${design.ok}, clearance ${sv.worst.toFixed(2)}, extent ±${worstExt.toFixed(1)} u${
            fatalReason ? '; FATAL' : ''
          }`,
        );
        design.violations
          .filter((v) => v.warning)
          .forEach((v) =>
            park.reportLint(
              `coaster:${v.kind}`,
              `<Coaster> "${props.name ?? 'Coaster'}" (points mode) stat-gate warning [${v.kind}] at u=${v.at.toFixed(2)} — ${v.detail}`,
              false,
            ),
          );
      }
      // ---- CRASH GATE (round-6 safeguard) -------------------------------------
      // The points-mode gate ran checkCoasterDesign + validateSpline + bounds but
      // NOT the crash replay — a 1.46 g circuit printed "points-mode checks →
      // design ok: true" and SHIPPED as a live registered ride carrying guests;
      // only validatePark objected, after the fact. Neither did the pieces-mode
      // fatal guard. Run the SAME energy-paced force replay validatePark's crash
      // check uses (SplineRideKit's replayCoasterForces — one physics, one
      // verdict) on the as-built WORLD points in BOTH modes: a circuit that
      // breaches the 1.5 g no-upstop derail guard (with the gate's 15% margin) is
      // FATAL, so it renders as translucent red invalid track and is NEVER
      // registered with the GameManager.
      if (!fatalReason) {
        const replay = replayCoasterForces(t, pts, { bank });
        const CRASH_LIMIT = 1.5 * 9.8 * 0.85; // == validate.ts CRASH_MARGIN
        if (replay.worstLatAccel > CRASH_LIMIT)
          fatalReason = `worst lateral ${(replay.worstLatAccel / 9.8).toFixed(2)} g at u=${replay.worstLatAt.toFixed(
            2,
          )} breaches the 1.5 g no-upstop derail guard margin (must stay under ${(CRASH_LIMIT / 9.8).toFixed(
            2,
          )} g) — the train would CRASH; bank the curve harder, widen its radius, or lower the drop feeding it`;
      }
      const coaster = buildRideSpline(t, pts, {
        profile: 'coaster',
        type,
        bank,
        supportEvery: props.supportEvery ?? 9,
        groundAt,
        colours: scheme.track,
        vehicleSchemes: scheme.vehicles,
      });
      const g = new t.Group();
      g.add(coaster.group);
      if (fatalReason) {
        // FATAL track (round-1 safeguard): a broken generated park must be
        // VISIBLY broken — translucent red rails, no train, and NO GameManager
        // registration (guests must never queue for a dangerous circuit). The
        // circuit is still registered for validatePark, which fails hard on it.
        console.error(
          `[Coaster] "${props.name ?? 'Coaster'}" has a FATAL track — ${fatalReason}. The ride was NOT registered with the GameManager and renders as a translucent red invalid track. ${
            pieces
              ? 'Fix the piece layout: end it FACING the station (aim the last authored piece back at the station straight) and keep every piece inside'
              : 'Fix the control points: keep the circuit legal (checkCoasterDesign), clear of itself (≥0.9 clearance) and inside'
          } the ±${(park.size / 2).toFixed(1)} u park bounds.`,
        );
        const invalidMat = new t.MeshStandardMaterial({
          color: 0xc22a22,
          emissive: 0x581010,
          transparent: true,
          opacity: 0.45,
          roughness: 0.6,
        });
        coaster.group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
            m.material = invalidMat;
            m.castShadow = false;
          }
        });
        const unregF = park.registerCoaster({ points: pts, type, bank, fatal: fatalReason, name: props.name ?? 'Coaster' });
        const cleanupF = park.addObject(g);
        return () => {
          cleanupF();
          unregF();
        };
      }
      const nCars = Math.max(1, props.cars ?? 3);
      // registered trains carry REAL guests: no decorative riders — the manager
      // seats boarded guests at the COASTER_CAR_SEATS anchors via seatWorld and
      // unfilled seats stay visibly empty (RCT2 trains)
      const carsArr = Array.from({ length: nCars }, (_, i) =>
        buildCoasterCar(t, i === 0 ? 'front' : i === nCars - 1 ? 'end' : 'middle', scheme.vehicles[0], { riders: false }),
      );
      const seats = nCars * COASTER_CAR_SEATS.length;
      const run = coaster.run(carsArr, { spacing: props.spacing ?? 1.2, speed: props.speed ?? 0.95 });
      // station platform deck: boarding height, legs grounded, long axis on the station line
      const deckTop = stY - 0.05;
      let boardPoint: V3 = [pts[1][0], stY - 0.02, pts[1][2]];
      if (props.deck) {
        const [dx, dz] = props.deck;
        const yaw = Math.atan2(pts[2][0] - pts[0][0], pts[2][2] - pts[0][2]);
        const gy = Math.max(groundAt(dx, dz), wl + 0.2);
        const deck = new t.Group();
        deck.position.set(dx, 0, dz);
        deck.rotation.y = yaw;
        deck.add(box(t, [1.1, 0.16, 2.2], 0x5b432c, [0, stY - 0.13, 0], { tex: 'wood', repeat: [3, 6], rough: 0.9 }));
        [-0.9, 0.9].forEach((sz) => {
          const hp = stY - 0.19 - (gy - 0.3);
          deck.add(box(t, [0.12, hp, 0.12], 0x5b432c, [0, gy - 0.3 + hp / 2, sz], { tex: 'wood', rough: 0.95 }));
        });
        g.add(deck);
        boardPoint = [dx, stY - 0.02, dz];
      }
      const mgr = park.manager();
      const qm = Math.hypot(props.queueDir[0], props.queueDir[1]) || 1;
      const qd: XZ = [props.queueDir[0] / qm, props.queueDir[1] / qm];
      // capacity caps at the train's REAL seat count — RCT2 rides never admit
      // more riders than seats; boarded guests fill the cars via seatWorld
      const capacity = Math.min(props.capacity ?? seats, seats);
      // queue-lane orientation safeguard (round-4): the lane hangs off the FIXED
      // tail node, so an authored queueDir aimed along the station row spears
      // the ride's own pad/deck — auto-flip to the first clean orientation and
      // relocate the exit if the new lane runs over its cell (warned; audited)
      const stYaw = Math.atan2(pts[2][0] - pts[0][0], pts[2][2] - pts[0][2]);
      const stLen = Math.hypot(pts[2][0] - pts[0][0], pts[2][2] - pts[0][2]);
      const ownRects: ParkFootRect[] = [
        { cx: boardPoint[0], cz: boardPoint[2], hx: 0.45, hz: 0.45, yaw: 0, label: 'boardPoint pad' },
        { cx: (pts[0][0] + pts[2][0]) / 2, cz: (pts[0][2] + pts[2][2]) / 2, hx: 0.55, hz: stLen / 2 + 0.3, yaw: stYaw, label: 'station straight' },
      ];
      if (props.deck) ownRects.push({ cx: props.deck[0], cz: props.deck[1], hx: 0.55, hz: 1.1, yaw: stYaw, label: 'station deck' });
      const laneLen = laneLenOf(capacity);
      const [tailX, tailZ] = park.paths.net.nodes[props.queueTailNode];
      // ---- THE RCT2 EXIT CELL (exit/exitDir are now OPTIONAL) ------------------
      // A circuit's station is the author's geometry, so these used to be REQUIRED
      // props and every §4.0 archetype published a hand-computed cell. That cell
      // could not know which SIDE of the station face has a street the exit path
      // can reach — the published `[start.x + 2.4, start.z + 2.4]` picked the wrong
      // one on the reference parks and the exit had no path out at all. Omit them
      // and the chassis takes the cell ONE TILE along the face from the entrance
      // hut, on whichever side its exit path reaches the street soonest, facing the
      // same way out. `anchor0` is the entrance-hut end of the AUTHORED lane; the
      // orientation resolver may flip the lane below, and the exit is re-derived
      // with it (a flipped lane used to leave a stale exit cell behind).
      const anchor0: XZ = [tailX - qd[0] * (laneLen + 0.35), tailZ - qd[1] * (laneLen + 0.35)];
      const derived0 = pickAdjacentExitCell({ anchor: anchor0, dir: qd, net: park.paths.net, streetNodes: park.paths.streetNodes, tail: [tailX, tailZ] });
      const exitIn: XZ = props.exit ?? derived0.cell;
      const exitDirIn: XZ = props.exitDir ?? qd;
      const resolved = resolveQueueOrientation({
        label: `[Coaster] '${props.name ?? 'Coaster'}'`,
        half: park.size / 2,
        laneLen,
        dir: qd,
        anchorOf: (d) => [tailX - d[0] * (laneLen + 0.35), tailZ - d[1] * (laneLen + 0.35)],
        own: ownRects,
        exit: exitIn,
        exitDir: exitDirIn,
        exitYawOf: () => Math.atan2(exitDirIn[0], exitDirIn[1]),
        onLint: (kind, detail, fatal) => park.reportLint(kind, detail, fatal),
      });
      // a FLIPPED lane moves the face the huts stand on — re-derive the auto exit
      const flipped = resolved.dir[0] !== qd[0] || resolved.dir[1] !== qd[1];
      const anchorR: XZ = [tailX - resolved.dir[0] * (laneLen + 0.35), tailZ - resolved.dir[1] * (laneLen + 0.35)];
      const exitFinal: XZ =
        props.exit ??
        (flipped
          ? pickAdjacentExitCell({ anchor: anchorR, dir: resolved.dir, net: park.paths.net, streetNodes: park.paths.streetNodes, tail: [tailX, tailZ] }).cell
          : resolved.exit);
      const exitDirFinal: XZ = props.exitDir ?? resolved.dir;
      const acc = planRideAccess(park.paths.net.nodes, props.queueTailNode, resolved.dir, capacity, exitFinal, exitDirFinal);
      // ---- RCT2 entrance/exit ADJACENCY lint ----------------------------------
      // <Coaster>'s exit/exitDir are REQUIRED props (a circuit's station is the
      // author's geometry, not something the chassis can derive), so they are always
      // honoured — but a pair that is not adjacent-and-outward is not the RCT2
      // station shape and, worse, cannot be reached: the exit PATH is cast along
      // `exitDir`. Report it with the cell that WOULD work.
      {
        const m = exitIsAdjacentOutward(acc.anchor, acc.dir, acc.exit, acc.exitDir);
        if (!m.ok && (props.exit || props.exitDir))
          park.reportLint(
            'exitNotAdjacent',
            exitAdjacencyLintDetail(
              `[Coaster] '${props.name ?? 'Coaster'}'`,
              m,
              acc.exit,
              adjacentExitCells(acc.anchor, acc.dir, -1)[0].cell,
              acc.dir,
            ),
            false,
          );
      }
      // elevated queue tail: when the tail street node carries a nodeY lift the
      // whole hut/lane assembly rides the deck (groundRideAccess scaffolds it)
      const coTailLift = (park.paths as ParkPathsInfo & { nodeY?: number[] }).nodeY?.[props.queueTailNode] ?? 0;
      const coAccY = coTailLift > 0 ? Math.max(deckTop, park.paths.pathY + coTailLift + 0.19) : deckTop;
      // ADDITIVE: the RCT2 rating triple for the as-built circuit — rides along
      // on the handle so the ride window can show Excitement/Intensity/Nausea
      // (openrct2-ui/windows/Ride.cpp:5936-5954). Informational: the sim still
      // gates guests on `intensity`.
      const ratings = rateCoaster(pts, { type, bank, cars: nCars });
      const handle = mgr.registerRide({
        name: props.name ?? 'Coaster',
        capacity,
        rideDuration: props.rideDuration ?? 9,
        loadTime: props.loadTime ?? 2,
        intensity: props.intensity ?? 6,
        price: props.price ?? 5,
        ratings,
        seatWorld: trainSeatWorld(t, carsArr),
        vehicleHandle: { crashed: () => coaster.crashed() },
        queueAnchor: [acc.anchor[0], coAccY, acc.anchor[1]],
        queueDir: acc.dir,
        boardPoint,
        exitPoint: [acc.exit[0], coAccY, acc.exit[1]],
        exitDir: acc.exitDir, // the OUTWARD facing — the exit path is cast along it
      });
      // graded berm under a graded lane — see <FlatRide>
      const coTailY =
        (park.paths as ParkPathsInfo & { walkYAt?: (x: number, z: number) => number }).walkYAt?.(acc.tail[0], acc.tail[1]) ?? coAccY;
      groundRideAccess(t, g, groundAt, acc, coAccY, [handle.exitPoint()[0], handle.exitPoint()[2]], coTailY);
      coaster.group.userData.rideRef = handle; // clickability (rules/ui.md)
      coaster.group.userData.rideVehicle = carsArr[0];
      const unreg = park.registerCoaster({ points: pts, type, bank, name: props.name ?? 'Coaster' });
      const cleanup = park.addObject(g, run);
      return () => {
        cleanup();
        unreg();
      };
    };
    const cancel = park.enqueueBuild(() => {
      disposeBuilt = buildNow();
    }, 'Coaster');
    return () => {
      cancel();
      disposeBuilt?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return null;
}

// ---- <TrackRide> — the generic piece-composed spline ride -----------------------------

export interface TrackRideProps extends ComposableRideProps {
  /** SplineRideKit sweep profile (default 'coaster') */
  profile?: Exclude<RideProfile, 'gokart'>;
  /** coaster construction rules — gates corkscrews (default 'steel') */
  type?: CoasterType;
  /** track pieces (compileTrackPieces vocabulary) */
  pieces?: TrackPiece[];
  /** piece children — <Station/><Lift/>… — WIN over `pieces` */
  children?: React.ReactNode;
  /** max bank in radians (profile default; coaster 0.7 — auto-banking soaks
   *  the lateral G through fast curves, keep it high) */
  bank?: number;
  /** coaster train length (default 2: front + tail cars) */
  cars?: number;
  /** vehicle override (default: coaster train / mini log / two mini sleds) */
  vehicles?: (t: typeof THREE) => THREE.Group[];
  spacing?: number;
  wheelOffset?: number;
  speed?: number;
  /** ColorKit scheme override (default seeded per profile) */
  colours?: RideColourScheme;
  // sim conveniences (same as <ConfigurableRide>)
  name?: string;
  capacity?: number;
  rideDuration?: number;
  loadTime?: number;
  intensity?: number;
  price?: number;
  queue?: { anchor?: XZ; dir?: XZ };
}

const TRACK_RIDE_DEFAULTS: Record<Exclude<RideProfile, 'gokart'>, RideRegisterProps> = {
  coaster: { name: 'Coaster', capacity: 4, rideDuration: 9, intensity: 6, price: 5 },
  flume: { name: 'Log Flume', capacity: 4, rideDuration: 12, intensity: 5, price: 4 },
  rapids: { name: 'River Rapids', capacity: 6, rideDuration: 12, intensity: 5, price: 4 },
  bobsled: { name: 'Bobsleigh', capacity: 4, rideDuration: 10, intensity: 6, price: 4 },
};

/**
 * <TrackRide> — a whole tracked ride from PIECES on the <ConfigurableRide>
 * chassis: compiles the pieces (children win over the `pieces` prop) with
 * compileTrackPieces — auto-closed circuit, checkCoasterDesign +
 * validateSpline in the console report — sweeps it with buildRideSpline
 * (coaster rails / flume trough / rapids channel / bobsled chute), runs a
 * default vehicle set, and registers with the GameManager when `register`
 * is set inside a real <Park> (queue/huts derived from position+rotation,
 * crash wiring + clickability included). Works standalone in <ScenePreview>
 * too. The station piece sits at the LOCAL origin heading +z — `position`/
 * `rotation` place the whole circuit.
 */
export function TrackRide(props: TrackRideProps) {
  const {
    profile = 'coaster',
    pieces,
    children,
    bank,
    cars = 2,
    vehicles,
    spacing,
    wheelOffset,
    speed,
    colours,
    position,
    rotation = 0,
    scale,
    deps,
    register,
    queue,
    name,
    capacity,
    rideDuration,
    loadTime,
    intensity,
    price,
  } = props;
  const type = props.type ?? 'steel';
  const resolved = collectTrackPieces(children) ?? pieces ?? null;
  return (
    <ConfigurableRide
      build={(t, park) => {
        if (!resolved || !resolved.length) throw new Error('<TrackRide> needs `pieces` or piece children');
        const compiled = compileTrackPieces(resolved, {
          profile,
          type,
          bank,
          start: [0, profile === 'coaster' ? 0.55 : 0.6, 0],
        });
        console.log(
          `[TrackRide:${profile}] compiled ${resolved.length} pieces → ${compiled.points.length} points (ok: ${compiled.report.ok}${
            compiled.report.closure.synthesized.length ? `; closed with ${compiled.report.closure.synthesized.join(', ')}` : ''
          })`,
        );
        // ground sampler mapped through the mount transform (world → local)
        const pos = position ?? ([0, 0] as XZ);
        const [px, pz] = xzOf(pos);
        const mountY = yOf(pos) ?? park.floorAt(px, pz);
        const cr = Math.cos(rotation);
        const sr = Math.sin(rotation);
        const groundLocal = (x: number, z: number) => park.groundAt(px + x * cr + z * sr, pz - x * sr + z * cr) - mountY;
        const scheme =
          colours ??
          rideColourPreset(
            park.seed + 4,
            profile === 'coaster' ? (type === 'wooden' ? 'wooden' : 'steel') : profile === 'bobsled' ? 'steel' : 'water',
          );
        const ride = buildRideSpline(t, compiled.points, {
          profile,
          type,
          bank,
          groundAt: groundLocal,
          colours: scheme.track,
          vehicleSchemes: scheme.vehicles,
        });
        const group = new t.Group();
        group.add(ride.group);
        group.userData.trackReport = compiled.report; // harness/agent introspection
        // ---- FATAL guard (round-1 safeguard) — real parks only ----
        // The circuit compiles in LOCAL space; the park-bounds check maps it
        // through the mount transform. A fatal track renders translucent red,
        // never registers with the GameManager, and registers its circuit for
        // validatePark (which fails hard on it). Previews are left as-is.
        const previewHost = (park as { _previewHost?: boolean })._previewHost;
        if (!previewHost) {
          let fatalReason = compiled.report.fatal ? (compiled.report.fatalReason ?? 'compiled track is fatally invalid') : null;
          const worldPts = compiled.points.map(
            ([lx, ly, lz]) => [px + lx * cr + lz * sr, ly + mountY, pz - lx * sr + lz * cr] as V3,
          );
          if (!fatalReason) {
            let worstExt = 0;
            for (const [wx, , wz] of worldPts) worstExt = Math.max(worstExt, Math.abs(wx), Math.abs(wz));
            if (worstExt > park.size / 2 + 0.3)
              fatalReason = `the mounted track reaches ±${worstExt.toFixed(1)} u — outside the ±${(park.size / 2).toFixed(1)} u park bounds`;
          }
          if (fatalReason) {
            console.error(
              `[TrackRide:${profile}] "${name ?? TRACK_RIDE_DEFAULTS[profile].name}" has a FATAL track — ${fatalReason}. The ride was NOT registered with the GameManager and renders as a translucent red invalid track. Fix the piece layout: end it FACING the station (aim the last authored piece back at the station straight) and keep every piece inside the ±${(park.size / 2).toFixed(1)} u park bounds.`,
            );
            const invalidMat = new t.MeshStandardMaterial({
              color: 0xc22a22,
              emissive: 0x581010,
              transparent: true,
              opacity: 0.45,
              roughness: 0.6,
            });
            ride.group.traverse((o) => {
              const m = o as THREE.Mesh;
              if (m.isMesh) {
                (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
                m.material = invalidMat;
                m.castShadow = false;
              }
            });
            const unreg = park.registerCoaster({ points: worldPts, type, bank, fatal: fatalReason, name: name ?? TRACK_RIDE_DEFAULTS[profile].name });
            return { group, invalid: true, dispose: unreg } as ComposableRideBuilt;
          }
        }
        let vs: THREE.Group[];
        let seatWorld: ((seat: number) => [number, number, number, number]) | undefined;
        const runOpts: RideRunOpts = { spacing, wheelOffset, speed };
        if (vehicles) vs = vehicles(t);
        else if (profile === 'coaster') {
          const n = Math.max(1, cars);
          // registered trains carry REAL guests at the seat anchors (empty
          // seats stay empty); previews keep the decorative riders
          vs = Array.from({ length: n }, (_, i) =>
            buildCoasterCar(t, n === 1 || i === 0 ? 'front' : i === n - 1 ? 'end' : 'middle', scheme.vehicles[0], {
              riders: !register,
            }),
          );
          if (register) seatWorld = trainSeatWorld(t, vs);
          runOpts.spacing = spacing ?? 1.15;
        } else if (profile === 'bobsled') {
          vs = [buildMiniSled(t), buildMiniSled(t)];
          runOpts.spacing = spacing ?? 1.4;
        } else {
          vs = [buildMiniLog(t)];
          runOpts.wheelOffset = wheelOffset ?? 0.16;
        }
        const run = ride.run(vs, runOpts);
        return {
          group,
          update: run,
          seatWorld,
          crashed: () => ride.crashed(),
          vehicle: vs[0],
          // ADDITIVE: coaster-profile circuits carry their RCT2 rating triple
          // through to registerRide (measured on the LOCAL points — rotation
          // and translation don't change the geometry the ratings read)
          ratings: profile === 'coaster' ? rateCoaster(compiled.points, { type, bank, cars: Math.max(1, cars) }) : undefined,
        };
      }}
      layout={{ front: 1.8, board: [0, 0.6, 0], defaults: TRACK_RIDE_DEFAULTS[profile] }}
      register={register}
      queue={queue}
      name={name}
      // stock coaster trains cap capacity at the REAL seat count (2 per car)
      capacity={
        profile === 'coaster' && !vehicles
          ? Math.min(capacity ?? Math.max(1, cars) * COASTER_CAR_SEATS.length, Math.max(1, cars) * COASTER_CAR_SEATS.length)
          : capacity
      }
      rideDuration={rideDuration}
      loadTime={loadTime}
      intensity={intensity}
      price={price}
      position={position}
      rotation={rotation}
      scale={scale}
      deps={deps ?? [resolved, profile, type, bank, cars, spacing, wheelOffset, speed, register, colours ? 1 : 0]}
    />
  );
}
