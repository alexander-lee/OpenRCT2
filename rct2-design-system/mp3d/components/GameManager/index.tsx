import * as THREE from 'three';
import { buildRouting } from '../PathNetwork';
import type { Routing, GameManagerOpts, RideRec, RideStationRec, StallRec, BinRec, BenchRec, RestroomRec, SimGuest } from './types';
import type { Sim } from './sim';
import type { DanceZoneRec } from './registry';
import { createBlockerRegistry } from './blockers';
import { createGuestFx } from './guestFx';
import { createAccess } from './access';
import { createRegistry } from './registry';
import { createSpawn } from './spawn';
import { createArrivals } from './arrivals';
import { createLocomotion } from './locomotion';
import { createNeeds } from './needs';
import { createNavigation } from './navigation';
import { createRideFsm } from './rideFsm';
import { createGuestPass } from './guestPass';
import { createQueries } from './queries';

// ---------------------------------------------------------------------------
// GameManager — the RCT2-faithful park SIMULATION (createGameManager, one
// closure). The shared vocabulary it is built on — the tick scale, state
// unions, config/record interfaces, tuning constants, thought table and the
// standalone ride-visual helpers createMotionGate / makeSeatWorld — lives in
// ./types.ts and is re-exported below, so the PUBLIC API of '../GameManager'
// is unchanged.
//
// SPLIT LAYOUT (this file is the PUBLIC API — always import from
// '../GameManager'; the sibling modules are implementation detail):
//   types.ts      — the shared vocabulary + createMotionGate / makeSeatWorld
//   sim.ts        — the `Sim` shared-context type (state + subsystem slots)
//   blockers.ts   — the blocker registry + the routing edge gate
//   guestFx.ts    — thoughts, hashed draws, litter/vomit/poop pools, hands,
//                   held items, held + flown balloons and their tweens
//   access.ts     — queue lane / slot geometry, the placement audit, the RCT2
//                   status line, breakdown schedule, relocation + corridors
//   registry.ts   — register{Ride,Stall,Bin,Restroom,DanceZone,WatchZone,
//                   ParkEntrance}
//   spawn.ts      — spawnGuests (rig build + fresh-arrival RCT2 stat block)
//   arrivals.ts   — THE GATE STREAM: RCT2's park rating + guest-generation
//                   probability, rolled per RCT2 tick, admitting new guests
//                   through the registered entrance up to a hard cap
//   locomotion.ts — blocker-aware moveToward / speed model / waypoint runner
//   needs.ts      — the Tick128 needs clock, queue joins, the shop counter
//   navigation.ts — network walk, node arrival decisions, direct-walk fallback
//   rideFsm.ts    — the ride state machine + exit unload + queue drain
//   guestPass.ts  — the per-frame guest pass (state dispatch + pose overlays)
//   queries.ts    — stats / guest records / ride roster / validation accessors
//
// The whole sim still runs in ONE closure: `createGameManager` builds a single
// `Sim` object and installs each subsystem onto it, so the mutually recursive
// seams stay intact and behaviour is bit-for-bit unchanged.
// ---------------------------------------------------------------------------

export { TICKS_PER_SEC, T, createMotionGate, makeSeatWorld, BLOCKER_PAD } from './types';
export type {
  MotionGate,
  RideState,
  RideStatus,
  GuestState,
  RideConfig,
  // ADDITIVE: multi-station transport rides (RCT2 Ride owns a station ARRAY)
  RideStationConfig,
  RideOccupancy,
  StallItemKind,
  StallItemBuilder,
  QueueSurface,
  HandSlot,
  HeldItemKind,
  WornItem,
  StallConfig,
  GameManagerOpts,
  ThoughtType,
  BlockerKind,
  BlockerSpec,
  BlockerRectSpec,
  BlockerCircleSpec,
  BlockerHandle,
  BlockerInfo,
  // ADDITIVE (round 8): the attention-zone config shape shared by
  // registerDanceZone / registerWatchZone
  AttentionZoneConfig,
  DanceZoneConfig,
  WatchZoneConfig,
  // ADDITIVE (round 9): spawnGuests' optional third argument — staged
  // starting needs for a cohort (previews that must SHOW a stall trading)
  GuestSpawnStats,
} from './types';

export function createGameManager(t: typeof THREE, opts: GameManagerOpts = {}) {
  const groundAt = opts.groundAt ?? (() => 0);
  const laneYNet = opts.laneY ?? 0.09; // buildPathNetwork slab top
  const walkY = opts.walkYAt ?? (() => laneYNet); // ramp-aware surface sampler
  // the RENDERED pavement top — what an access run's slab must reach (see
  // GameManagerOpts.surfaceYAt). Never used for guest heights.
  const surfY = opts.surfaceYAt ?? walkY;
  const net = opts.net ?? null;
  const coreEdgeCount = net ? net.edges.length : 0; // spawn only on real edges
  // the RENDERED lattice's node count, before any routing.attach spur is
  // pushed onto the SHARED arrays — the exit-path ray-cast needs to know
  // which nodes are real paved street (access.ts planExitLane)
  const coreNodeCount = net ? net.nodes.length : 0;

  const group = new t.Group();
  const rides: RideRec[] = [];
  const stalls: StallRec[] = [];
  const bins: BinRec[] = [];
  const benches: BenchRec[] = [];
  const guests: SimGuest[] = [];
  const rideAt = new Map<number, RideRec>(); // queue-tail attach node -> ride
  // ADDITIVE (multi-station): the same node -> the PLATFORM that tail feeds
  const stationAt = new Map<number, RideStationRec>();
  const stallAt = new Map<number, StallRec>(); // stall attach node -> stall
  const restrooms: RestroomRec[] = [];
  const restroomAt = new Map<number, RestroomRec>(); // doorway attach node -> restroom
  const danceZones: DanceZoneRec[] = [];

  (opts.bins ?? []).forEach(([x, z]) => bins.push({ x, z, count: 0 }));
  // BENCH SEATS. Logic only, like the bins: the meshes belong to whoever built
  // them (PathNetwork plants one every ~4.8 u down both verges and publishes
  // the seat points as `benches`). `attach` stays null — a bench is reached by
  // a short off-network detour with `g.resume`, not by a routing spur, because
  // a park-scale lattice publishes hundreds of them and pushing that many
  // logical nodes into the shared net would swamp the routing graph.
  (opts.benches ?? []).forEach((b) => benches.push({ ...b, attach: null, taken: null, uses: 0 }));

  const nodeXZ = (n: number): [number, number] => net!.nodes[n];

  // the blocker registry has to exist BEFORE the routing graph: buildRouting
  // takes its edge gate (path edges whose span crosses a blocker are refused)
  const blockers = createBlockerRegistry(net);
  const routing: Routing | null = net ? buildRouting(net, { edgeAllowed: blockers.edgeAllowed }) : null;

  // ---- the ONE shared sim context (see ./sim.ts) -----------------------------
  // the subsystem slots (s.fx, s.access, …) are filled in immediately below;
  // nothing reads them until the first register*/spawn/update call, so the
  // two-step build is safe — hence the widening cast on the state half
  const s = {
    t,
    opts,
    groundAt,
    walkY,
    surfY,
    net,
    coreEdgeCount,
    coreNodeCount,
    nodeXZ,
    group,
    routing,
    rides,
    stalls,
    bins,
    benches,
    guests,
    rideAt,
    stationAt,
    stallAt,
    restrooms,
    restroomAt,
    danceZones,
    simTime: 0,
    walkClock: 0,
    riddenTotal: 0,
    spawnNode: 0,
    spawnPt: { x: 0, z: 0 },
    parkEntrance: null,
    balloonsSold: 0,
    balloonsFlown: 0,
    blockers,
  } as unknown as Sim;

  // subsystem install order only matters for the few factories that read
  // stable state at creation time — every CROSS-subsystem call goes through
  // `s` and is resolved at call time, so the recursive seams are unaffected
  s.fx = createGuestFx(s);
  s.access = createAccess(s);
  s.registry = createRegistry(s);
  s.spawn = createSpawn(s);
  s.arrivals = createArrivals(s);
  s.loco = createLocomotion(s);
  s.needs = createNeeds(s);
  s.nav = createNavigation(s);
  s.rideFsm = createRideFsm(s);
  s.guestPass = createGuestPass(s);
  s.queries = createQueries(s);

  const update = (time: number, dt: number) => {
    const d = Math.min(Math.max(dt, 0), 1 / 15); // dt-robust
    s.simTime = time;
    // the CLAMPED clock (see sim.ts): the clock `g.timer` actually runs on.
    // Any deadline compared against a timer-driven duration must use this, not
    // `simTime` — on a slow page they diverge by more than 10x.
    s.walkClock += d;
    rides.forEach((r) => s.rideFsm.updateRide(r, d));
    guests.forEach((g) => s.guestPass.updateGuest(g, time, d));
    s.fx.update(time, d);
    // THE GATE STREAM last: a guest who despawned in the pass above has
    // already freed their slot, and an arrival spawned here starts its own
    // walk-in on the NEXT frame (never mid-pass, so `guests` is not mutated
    // while the forEach above is walking it)
    s.arrivals.update(d);
  };

  return {
    group,
    registerRide: s.registry.registerRide,
    registerStall: s.registry.registerStall,
    registerBin: s.registry.registerBin,
    /** REPLACE the registered bench seats. `<Paths>` rebuilds its whole network
     *  (and re-plants its verge furniture at new heights) on an AUTO-keepDry
     *  re-settle, which can land AFTER the manager exists — leaving the sim
     *  seating guests on benches that no longer stand there. Anyone currently
     *  sat is stood back up before the swap. */
    setBenches: (list: { x: number; y: number; z: number; yaw: number }[]) => {
      benches.forEach((b) => {
        if (b.taken) {
          b.taken.bench = null;
          b.taken.state = 'walking';
          b.taken = null;
        }
      });
      benches.length = 0;
      list.forEach((b) => benches.push({ ...b, attach: null, taken: null, uses: 0 }));
    },
    registerRestroom: s.registry.registerRestroom,
    registerDanceZone: s.registry.registerDanceZone,
    /** ADDITIVE (round 8): the dance zone's sibling for scenery a guest should
     *  stop and LOOK at — state 'watching', a hashed 4-10 s dwell facing
     *  `faceAt`, no need gate, and a per-guest re-latch cooldown. Both zone
     *  kinds now carry that cooldown (registry.ts documents why). */
    registerWatchZone: s.registry.registerWatchZone,
    registerParkEntrance: s.registry.registerParkEntrance,
    /** `spawnGuests(count, area?, stats?)` — the third argument (ADDITIVE,
     *  round 9) STAGES the cohort's starting needs: `{ hunger: [20, 70] }`
     *  spawns guests who are already peckish enough to clear RCT2's own
     *  counter gate, which is what a few-second stall PREVIEW needs (see
     *  GuestSpawnStats). Omit it and every guest is rolled exactly as before. */
    spawnGuests: s.spawn.spawnGuests,
    update,
    stats: s.queries.stats,
    // additive accessors — every pre-existing export/signature is unchanged
    guests: s.queries.guestRecords,
    rides: s.queries.rideList,
    accessPoints: s.queries.accessPoints,
    footprints: s.queries.footprints,
    stalls: s.queries.stallList,
    accessAudit: s.queries.accessAudit,
    entrancePoints: s.queries.entrancePoints,
    // round-5 additive: settle-time relocation + corridor tooling
    moveRide: s.access.moveRide,
    moveRideExit: s.access.moveRideExit,
    resizeRideLane: s.access.resizeRideLane,
    moveStall: s.access.moveStall,
    corridorCells: s.access.corridorCells,
    // round-6 additive: the BLOCKER registry (solid objects guests walk around)
    registerBlocker: blockers.registerBlocker,
    blockers: blockers.blockersList,
    blocked: blockers.blocked,
    blockerDepth: blockers.blockerDepth,
    /** is this path edge walkable? (false = its span crosses a blocker;
     *  access spurs are always walkable) — validatePark's street gate */
    edgeWalkable: blockers.edgeAllowed,
  };
}
