// ---------------------------------------------------------------------------
// GameManager — the SHARED SIM CONTEXT (`Sim`).
//
// `createGameManager` is ONE closure by design: the ride FSM, the guest needs
// clock, locomotion, routing glue, purchases and the fx pools all read the
// same mutable park state. To split the file WITHOUT changing a single
// behaviour, that closure now builds exactly one `Sim` object holding
//   - the immutable wiring (THREE, opts, the ground/walk samplers, the path
//     net, the scene group, the routing graph),
//   - every shared COLLECTION (rides / stalls / bins / guests / attach maps /
//     restrooms / attention zones), and
//   - every shared MUTABLE SCALAR (simTime, riddenTotal, the spawn point, the
//     park entrance, the balloon counters) — these MUST stay properties, never
//     destructured locals, or a subsystem would read a stale copy.
// …and then installs each subsystem factory onto it (`s.fx`, `s.access`,
// `s.registry`, `s.loco`, `s.needs`, `s.nav`, `s.rideFsm`, `s.guestPass`,
// `s.queries`). Subsystems call each other LATE-BOUND through `s`, so the
// mutually recursive seams (needs ↔ navigation, ride FSM ↔ queue drain,
// registration ↔ occupancy) survive the split untouched and the module import
// graph stays a clean DAG.
//
// This module is IMPLEMENTATION DETAIL — nothing here is part of the public
// API of '../GameManager'.
// ---------------------------------------------------------------------------

import type * as THREE from 'three';
import type {
  Routing,
  GameManagerOpts,
  WayPt,
  SimGuest,
  RideRec,
  RideStationRec,
  StallRec,
  BinRec,
  BenchRec,
  RestroomRec,
} from './types';
import type { createBlockerRegistry } from './blockers';
import type { createGuestFx } from './guestFx';
import type { createAccess } from './access';
import type { createRegistry, DanceZoneRec } from './registry';
import type { createSpawn } from './spawn';
import type { createArrivals } from './arrivals';
import type { createLocomotion } from './locomotion';
import type { createNeeds } from './needs';
import type { createNavigation } from './navigation';
import type { createRideFsm } from './rideFsm';
import type { createGuestPass } from './guestPass';
import type { createQueries } from './queries';

/** the path graph <Park>/PathNetwork hands the manager (`opts.net`) */
export type SimNet = NonNullable<GameManagerOpts['net']>;

/** resolved WORLD park-gate points + its routing spur (the sole spawn point) */
export interface ParkEntranceRec {
  spawn: WayPt;
  arch: WayPt;
  attach: { node: number; x: number; z: number } | null;
}

export interface Sim {
  // ---- immutable wiring ----------------------------------------------------
  t: typeof THREE;
  opts: GameManagerOpts;
  groundAt: (x: number, z: number) => number;
  walkY: (x: number, z: number) => number;
  /** the RENDERED pavement top (GameManagerOpts.surfaceYAt) — what a ride
   *  ACCESS RUN's slab has to reach. Falls back to `walkY`. Never a guest
   *  height: see the note on GameManagerOpts.surfaceYAt. */
  surfY: (x: number, z: number) => number;
  net: SimNet | null;
  coreEdgeCount: number;
  /** node count of the RENDERED street lattice, snapshotted before any
   *  `routing.attach` spur was pushed — so the exit-path ray-cast (access.ts
   *  `planExitLane`) can tell a real paved street from a logical access spur */
  coreNodeCount: number;
  nodeXZ: (n: number) => [number, number];
  group: THREE.Group;
  routing: Routing | null;

  // ---- shared collections --------------------------------------------------
  rides: RideRec[];
  stalls: StallRec[];
  bins: BinRec[];
  /** every registered BENCH SEAT (`opts.benches`) — one entry per seat, each
   *  holding at most one guest. Empty when the park passed none, which is what
   *  keeps the in-place rest stop as the fallback. */
  benches: BenchRec[];
  guests: SimGuest[];
  rideAt: Map<number, RideRec>;
  /** ADDITIVE (multi-station): queue-tail attach node -> the PLATFORM whose
   *  queue that tail feeds. `rideAt` gives the ride, this gives the station —
   *  RCT2's peep reads its station index off the entrance tile it walks into
   *  (`tile_element->asEntrance()->GetStationIndex()`, entity/Peep.cpp:1729). */
  stationAt: Map<number, RideStationRec>;
  stallAt: Map<number, StallRec>;
  restrooms: RestroomRec[];
  restroomAt: Map<number, RestroomRec>;
  /** every registered ATTENTION ZONE, both kinds — `registerDanceZone` and
   *  `registerWatchZone` push into this ONE list and each record carries its own
   *  `mode` (see registry.ts). The name predates the watch zone and is kept so
   *  the collection stays a stable identity across the subsystems that read it. */
  danceZones: DanceZoneRec[];

  // ---- shared mutable scalars (NEVER destructure these) --------------------
  simTime: number;
  /**
   * THE CLAMPED CLOCK — the sum of the per-frame `dt` AFTER the 1/15 clamp,
   * i.e. the clock that anything driven by `g.timer` actually experiences.
   *
   * It exists because `simTime` and this DIVERGE on a slow page, and mixing
   * them silently corrupts any duration that is set on one and tested on the
   * other. Measured on the Pulse District probe: attention-zone cooldowns were
   * stored on `simTime` while the watch dwell counts down on `g.timer`, so on a
   * SwiftShader page (~1.3 fps) the cooldown expired roughly **12× early** and
   * the bar that stops a guest being re-latched barely applied.
   *
   * Rule: a deadline must be set and compared on the SAME clock as the thing it
   * bounds. `action.until` is simTime-based; `g.timer` is clamped-based.
   */
  walkClock: number;
  riddenTotal: number;
  spawnNode: number;
  spawnPt: { x: number; z: number };
  parkEntrance: ParkEntranceRec | null;
  balloonsSold: number;
  balloonsFlown: number;

  // ---- subsystems (installed by createGameManager, called late-bound) ------
  blockers: ReturnType<typeof createBlockerRegistry>;
  fx: ReturnType<typeof createGuestFx>;
  access: ReturnType<typeof createAccess>;
  registry: ReturnType<typeof createRegistry>;
  spawn: ReturnType<typeof createSpawn>;
  /** the GATE STREAM: RCT2's guest generation, rolled per RCT2 tick off the
   *  park rating (arrivals.ts). Installed after `spawn` — it calls it. */
  arrivals: ReturnType<typeof createArrivals>;
  loco: ReturnType<typeof createLocomotion>;
  needs: ReturnType<typeof createNeeds>;
  nav: ReturnType<typeof createNavigation>;
  rideFsm: ReturnType<typeof createRideFsm>;
  guestPass: ReturnType<typeof createGuestPass>;
  queries: ReturnType<typeof createQueries>;
}
