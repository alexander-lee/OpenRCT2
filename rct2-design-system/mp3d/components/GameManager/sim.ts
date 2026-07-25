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
//     restrooms / dance zones), and
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
import type { Routing, GameManagerOpts, WayPt, SimGuest, RideRec, StallRec, BinRec, RestroomRec } from './types';
import type { createBlockerRegistry } from './blockers';
import type { createGuestFx } from './guestFx';
import type { createAccess } from './access';
import type { createRegistry, DanceZoneRec } from './registry';
import type { createSpawn } from './spawn';
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
  net: SimNet | null;
  coreEdgeCount: number;
  nodeXZ: (n: number) => [number, number];
  group: THREE.Group;
  routing: Routing | null;

  // ---- shared collections --------------------------------------------------
  rides: RideRec[];
  stalls: StallRec[];
  bins: BinRec[];
  guests: SimGuest[];
  rideAt: Map<number, RideRec>;
  stallAt: Map<number, StallRec>;
  restrooms: RestroomRec[];
  restroomAt: Map<number, RestroomRec>;
  danceZones: DanceZoneRec[];

  // ---- shared mutable scalars (NEVER destructure these) --------------------
  simTime: number;
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
  loco: ReturnType<typeof createLocomotion>;
  needs: ReturnType<typeof createNeeds>;
  nav: ReturnType<typeof createNavigation>;
  rideFsm: ReturnType<typeof createRideFsm>;
  guestPass: ReturnType<typeof createGuestPass>;
  queries: ReturnType<typeof createQueries>;
}
