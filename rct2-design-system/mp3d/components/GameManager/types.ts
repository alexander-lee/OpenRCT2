// ---------------------------------------------------------------------------
// GameManager/types.ts — the SIM's shared vocabulary: the RCT2 tick scale,
// deterministic helpers, ride/guest state unions, every public config +
// record interface, the tuning constants ported from OpenRCT2, the thought
// table, and the two standalone ride-visual helpers (createMotionGate,
// makeSeatWorld).
//
// createGameManager itself lives in ./index.tsx (one closure). Everything
// public here is re-exported by ../GameManager — import from '../GameManager',
// never from this file directly.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import type { buildPeep } from '../Guest';
import type { buildRouting } from '../PathNetwork';

// ---------------------------------------------------------------------------
// GameManager — the park SIMULATION brain, modelled on REAL OpenRCT2 guest
// logic (source refs in Context.md). Guests carry RCT2's 0–255 needs
// (happiness / hunger / thirst / energy / nausea / toilet, Guest.cpp:769-921),
// walk ONLY on a PathNetwork routing graph when one is provided, queue with
// RCT2's time-in-queue unhappiness curve (Guest.cpp:7535), buy food/drink with
// RCT2's purchase checks (Guest.cpp:1529), drop litter or use bins
// (Guest.cpp:5534-6256) and leave the park when worn out (Guest.cpp:3106).
// Rides run RCT2's vehicle status cycle (Vehicle.h:123) and board guests via
// RCT2's PeepRideSubState (Peep.h:81): into the entrance hut, SEATED on the
// vehicle (visible occupancy — occupancy() / seatWorld), out via the exit
// hut. Guests never walk on the ride. NO mood orb — RCT2
// draws nothing overhead (Paint.Guest.cpp:60); mood is conveyed by POSTURE.
// GUEST EVENT ANIMATIONS: littering plays a visible armR fling and the scraps
// ARC from the hand to the ground (parabolic tween); nausea ≥ 200 guests stop,
// hunch, turn GREEN (Guest setSick face swap), spray a ParticleKit droplet
// burst and leave a splat decal (nausea −130, happiness −12, face restored
// ~4 s later); the no-restroom poop fallback now SQUATS for 0.8 s (leg-fold
// crouch, skirt flare) before the mesh appears and the embarrassed walk-off.
// Bought items live in a TWO-HAND registry (one item per hand, purchases
// refuse "my hands are full" when both are taken): food/drink is a visible
// CONSUMABLE on the right hand (preferred) with eat/drink arm cycles — and a
// stall can supply its OWN 3D item for buyers to carry (StallConfig.heldItem:
// a mini hot dog, a floss cone, a soda can), the mesh being cloned onto the
// same tuned hand hold spot the generic burger/cup use and handed back to the
// generic crumpled CONTAINER when the meal runs out, so the bin/litter
// lifecycle is unchanged. Beside the two hands there is a HEAD slot
// (buildPeep's `headSlot`) for 'wearable' stall items — bought like any other,
// but WORN: no eat cycle, no container, no litter, kept for the rest of the
// visit and carried through rides. While
// ACCESSORIES — balloons (StallConfig.item 'balloon') — sway on a string
// above a relaxed hand (RCT2 PeepAnimationGroup::balloon, Guest.cpp:6939;
// colour picked at purchase, Guest.cpp:1682), persist ~60–120 hashed sim-s
// and then FLY AWAY (Guest.cpp:6951 blow-away; Balloon.cpp:33 rise-and-pop):
// the balloon detaches, rises with accelerating buoyancy + wind sway, fades
// out above ~8 u (pooled, cap 10) while the guest glances up sadly (−4
// happiness); registerRestroom adds toilets (with a discreet poop fallback
// when none is reachable); registerParkEntrance makes the park gate the SOLE
// spawn/despawn point — arrivals stream in through the archway.
// Time scale: 1 RCT2 tick = 1/160 s of sim time — see TICKS_PER_SEC / T().
// Fully deterministic: hashed-sine randomness only; dt is clamped.
// ---------------------------------------------------------------------------

// ---- THE TWO CLOCKS --------------------------------------------------------
// This sim runs OpenRCT2's tick clock at 160 ticks per sim-second, i.e. FOUR
// TIMES RCT2's own 40 ticks/s. That is deliberate: an RCT2 guest visits for
// hours of wall time, ours for minutes, so every APPETITE (hunger, thirst,
// tiredness) has to move on a compressed clock or it would never move at all.
//   T(ticks)  — the compressed clock: RCT2 tick count -> sim seconds at 4x.
//               Use it for RATES (how fast a need decays).
//   TR(ticks) — the SAME tick count read at RCT2's real 40 ticks/s, i.e. the
//               seconds a player would count on a stopwatch. Use it for
//               DURATIONS a guest measures against events that are authored in
//               real seconds — above all a QUEUE, whose length in seconds is
//               set by ride cycles (rideDuration is authored in real seconds:
//               13-47 s across this fleet, never compressed).
// Mixing the two was the bug behind "they get angry too quickly": RCT2's
// 2000-tick queue-patience threshold was read on the compressed clock (12.5 s)
// and compared against ride cycles running at 1x, so a guest soured before the
// train they were queuing for had even come back.
/** 1 RCT2 game tick = 1/160 s of sim time (the compressed clock). */
export const TICKS_PER_SEC = 160;
/** Convert an OpenRCT2 tick count into sim seconds (compressed 4x). */
export const T = (ticks: number) => ticks / TICKS_PER_SEC;
/** RCT2's own tick rate — 40 ticks per second of real play. */
export const RCT2_TICKS_PER_SEC = 40;
/** An OpenRCT2 tick count in REAL seconds (RCT2's own rate) — for durations
 *  compared against ride cycles / walking, which run at 1x. */
export const TR = (ticks: number) => ticks / RCT2_TICKS_PER_SEC;

export const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
export const clamp255 = (v: number) => Math.max(0, Math.min(255, v));
export const smoothK = (u: number) => {
  const v = Math.max(0, Math.min(1, u));
  return v * v * (3 - 2 * v);
};
export const chase = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

export type Routing = ReturnType<typeof buildRouting>;

// ---- ride states — OpenRCT2 Vehicle::Status subset (Vehicle.h:123) ---------
export type RideState =
  | 'movingToEndOfStation'
  | 'waitingForPassengers'
  | 'waitingToDepart'
  | 'departing'
  | 'travelling'
  | 'arriving'
  | 'unloadingPassengers'
  | 'crashed';

// ---- ride status — the RCT2 ride-window status line (Ride::formatStatusTo,
// src/openrct2/ride/Ride.cpp:528-564: Crashed / Broken down / Closed / Open;
// 'being repaired' is the mechanic-fixing tail of a breakdown) ---------------
export type RideStatus = 'open' | 'closed' | 'brokenDown' | 'beingRepaired';

// ---- motion gate: RCT2 station behaviour for ride VISUALS ------------------
// Real RCT2 vehicles WAIT in the station while guests board and stop again to
// unload (Vehicle.cpp status cycle: WaitingForPassengers → Departing →
// Travelling → Arriving → UnloadingPassengers) — but the catalog ride visuals
// animate on an absolute clock. createMotionGate wraps such an updater with an
// internal gated clock that ONLY advances while the FSM says the vehicle is in
// motion: speed eases 0→1 over ~`spinUp` (0.8 s) on 'departing'/'travelling',
// eases 1→0 over ~`spinDown` (1.2 s) into 'arriving' (and
// 'movingToEndOfStation' / 'brokenDown' / 'beingRepaired' / 'crashed' — the
// graceful breakdown spin-down), and is a HARD 0 in 'waitingForPassengers' /
// 'waitingToDepart' / 'unloadingPassengers' so riders board/leave a PARKED
// vehicle. CRITICAL: the gate starts UNGATED — until the first onStateChange
// arrives the raw time is passed straight through, so an UN-registered
// preview animates byte-identically to a gateless build. dt is clamped ≤ 0.1
// like every internal sim clock. The wrapped updater also receives the eased
// speed (0..1) as a second argument — oscillating rides (PirateShip, TopSpin,
// tower cars…) use it as an amplitude envelope so they SETTLE level/at the
// station instead of freezing mid-swing.
export interface MotionGate {
  /** wrapped updater — drop-in replacement for the built result's `update` */
  update: (time: number) => void;
  /** feed the manager's ride FSM here (chain BEFORE the ride's own handler) */
  onStateChange: (state: RideState | RideStatus | string) => void;
  /** current eased motion factor 0..1 (1 while ungated) */
  speed: () => number;
  /** current gated clock value (rides key cycle phases off it) */
  clock: () => number;
}

export function createMotionGate(
  update: (clock: number, speed: number) => void,
  opts: { spinUp?: number; spinDown?: number } = {},
): MotionGate {
  const up = 1 / Math.max(0.05, opts.spinUp ?? 0.8);
  const down = 1 / Math.max(0.05, opts.spinDown ?? 1.2);
  let gated = false;
  let speed = 1;
  let target = 1;
  let hard = false;
  let clock = 0;
  let last: number | null = null;
  const onStateChange = (state: string) => {
    gated = true;
    if (state === 'departing' || state === 'travelling') {
      target = 1;
      hard = false;
    } else if (
      state === 'arriving' ||
      state === 'movingToEndOfStation' ||
      state === 'brokenDown' ||
      state === 'beingRepaired' ||
      state === 'crashed'
    ) {
      target = 0;
      hard = false; // eased stop — arrivals brake, breakdowns spin down
    } else {
      // waitingForPassengers / waitingToDepart / unloadingPassengers / unknown
      target = 0;
      hard = true; // parked: riders board a stationary vehicle
    }
  };
  const gatedUpdate = (time: number) => {
    if (!gated) {
      // ungated pass-through — previews stay byte-identical
      clock = time;
      last = time;
      update(time, 1);
      return;
    }
    const dt = Math.min(Math.max(time - (last ?? time), 0), 0.1); // clamped like the manager
    last = time;
    if (hard) speed = 0;
    else speed = speed < target ? Math.min(target, speed + dt * up) : Math.max(target, speed - dt * down);
    clock += dt * speed;
    update(clock, speed);
  };
  return { update: gatedUpdate, onStateChange, speed: () => speed, clock: () => clock };
}

/** Standard seatWorld factory: seat index → the live world transform
 *  `[x, y, z, yaw]` of one anchor Group (parent anchors into the MOVING part
 *  so seated guests ride along). Distinct riders always land in distinct
 *  anchors — register the ride with `capacity === seats.length` so the modulo
 *  never doubles anyone up. */
export function makeSeatWorld(t: typeof THREE, seats: THREE.Object3D[]): (seat: number) => [number, number, number, number] {
  const _v = new t.Vector3();
  const _q = new t.Quaternion();
  const _e = new t.Euler();
  return (seat: number) => {
    const s = seats[seat % seats.length];
    s.updateWorldMatrix(true, false);
    _v.set(0, 0, 0).applyMatrix4(s.matrixWorld);
    s.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ');
    return [_v.x, _v.y, _v.z, _e.y];
  };
}

// ---- guest states — OpenRCT2 PeepState subset (entity/Peep.h:47) -----------
// Balking is a TRANSITION (queuing -> walking); dancing / resting are idle
// ACTIONS inside walking / sitting, not states.
export type GuestState =
  | 'walking'
  | 'queuing'
  | 'queuingFront'
  | 'enteringRide'
  | 'onRide'
  | 'leavingRide'
  | 'buying'
  | 'sitting'
  | 'watching'
  | 'usingBin'
  | 'usingRestroom'
  | 'leavingPark';

/**
 * A QUEUE LANE'S SURFACE. RCT2 red (`0x9e3a34`) is the default and stays the
 * default — but a queue lane IS a path, and from the park's overhead camera it
 * is often the loudest thing in a themed land: Thornwick's audit named the red
 * lanes as the single worst colour note in an enchanted forest and had no hook
 * to fix it. Worlds pass their own the way streets take `theme.pathSurface`.
 */
export interface QueueSurface {
  pave: number;
  rail?: number;
  paveTex?: 'asphalt' | 'concrete' | 'sand' | 'wood' | 'metal' | 'grass';
  /** half-tile EXPANSION-JOINT colour — the lane is laid by the same
   *  `pathRibbon` as the streets, so it carries their seams (default tarmac's) */
  seam?: number;
  /** KERB colour, OPT-IN: RCT2's queue is edged by its RAILING, so no kerb
   *  course is laid unless a theme asks for one (PathNetwork/ribbon.ts) */
  kerb?: number;
}

export interface RideConfig {
  name: string;
  /** guests admitted per cycle (train size) */
  capacity: number;
  /** seconds the TRAVELLING phase lasts */
  rideDuration: number;
  /** seconds the DEPARTING phase lasts (kept from v1; default 1.0) */
  loadTime?: number;
  /** world position of the queue HEAD (the entrance hut stands just beyond it) */
  queueAnchor: [number, number, number];
  /** unit xz direction the lane extends in — guests join at the far end */
  queueDir: [number, number];
  /** what the QUEUE LANE is paved with (default: RCT2 red, `QUEUE_RCT2`).
   *  A queue lane is a path, and from the park's overhead camera it is often
   *  the loudest colour in a themed land — Thornwick's audit named the red
   *  lanes as the worst note in an enchanted forest. Worlds pass
   *  `theme.queueSurface` here, the way streets take `theme.pathSurface`. */
  queueSurface?: QueueSurface;
  /** optional pre-built entrance hut (buildRideEntrance) — else one is built */
  entrance?: THREE.Group;
  /** the vehicle/seat anchor ON the ride. Guests never WALK here — the ride
   *  SEATS them (RCT2 PeepRideSubState: inEntrance -> onRide, Peep.h:81):
   *  boarded guests re-appear seated in a compact ring around this point
   *  unless `seatWorld` supplies real per-seat transforms. */
  boardPoint: [number, number, number];
  /** where the exit hut stands — riders re-appear walking OUT through it
   *  (may be auto-shifted along the pad edge by the placement audit) */
  exitPoint: [number, number, number];
  /**
   * ADDITIVE: the exit hut's OUTWARD doorway facing, unit and AXIS-ALIGNED.
   *
   * RCT2 stores the entrance/exit element's `direction` pointing INWARD, at the
   * station (`Ride::validateStations` looks for the station track at
   * `location + CoordsDirectionDelta[direction]`, RideConstruction.cpp:1557-1559),
   * and every path — the queue in, the footpath out — attaches on the reverse
   * side (`kEntranceDirections` = 4, i.e. relative direction 2 only,
   * EntranceElement.cpp:22-26 + Footpath.cpp:118-121). This field is that
   * REVERSE, the outward side, matching the UI's own `gRideEntranceExitPlaceDirection`
   * ("faces away from the station", openrct2-ui/ride/Construction.cpp:479-483).
   *
   * Omitted, the facing is derived from `boardPoint → exitPoint` as before —
   * which is only axis-aligned when the exit sits square off the pad. The RCT2
   * layout puts the exit ADJACENT to the entrance on the SAME face, so that
   * vector is DIAGONAL and the derived yaw skews the hut: pass this instead.
   */
  exitDir?: [number, number];
  /** what the EXIT PATH is paved with (default: `SURFACE_TARMAC`, municipal
   *  grey). The exit path is an ORDINARY footpath, never the red queue — a
   *  themed land passes its own `theme.pathSurface` here, the way the queue
   *  lane takes `queueSurface`. */
  exitSurface?: { pave: number; kerb?: number; seam?: number; paveTex?: string; kerbTex?: string; rough?: number };
  /** optional per-seat transform: seat index -> [x, y, z, yaw] for the seated
   *  guest's group origin (feet). Lets a spinning vehicle carry its riders.
   *  Called every frame while riders are aboard — must be deterministic. */
  seatWorld?: (seat: number) => [number, number, number, number];
  /** second arg is ADDITIVE — existing single-arg callbacks keep working */
  onStateChange?: (state: RideState, occupancy?: RideOccupancy) => void;
  /** ride intensity 1–10 (RCT2 intensity rating /10); default 4 */
  intensity?: number;
  /** ride price, deducted from guest cash on entry; default 0 */
  price?: number;
  /** min seconds waitingForPassengers holds with riders aboard (default T(320)) */
  minWait?: number;
  /**
   * max seconds a LADEN dwell lasts, measured from the FIRST boarding — the
   * ceiling on `quietWait` re-arming forever behind a queue that keeps feeding
   * it (default T(1920) = 12 s).
   *
   * It used to be measured from the train's ARRIVAL at the platform, which is
   * RCT2's own anchor (`Vehicle::time_waiting`) but produced a measured
   * pathology here: behind a long queue the first guest needs ~60 s to shuffle
   * up the lane, so the ceiling had already expired before anybody sat down and
   * the train left with ONE rider and 43 guests still queuing (measured
   * 2026-07-28, `harness/park-eval/probe-board-quiet.mjs` `flat-longqueue`:
   * 2.17 riders/departure, 0.80 riders served per sim-minute). A ceiling on a
   * dwell is only meaningful once the dwell is productive.
   */
  maxWait?: number;
  /**
   * ADDITIVE: the BOARDING-QUIET WINDOW in seconds (default `BOARD_QUIET_SECS`
   * = 10). Once the first guest is seated the ride waits this long for another
   * one; every boarding restarts it; when it expires with anyone aboard the
   * ride leaves. This — not `capacity` — is what normally ends a dwell.
   */
  quietWait?: number;
  /** external vehicle handle — crashed() true puts the ride into 'crashed' */
  vehicleHandle?: { crashed?(): boolean };
  /** ADDITIVE: mean seconds between deterministic breakdowns.
   *
   *  **Omit it and the ride NEVER breaks down — that is the default.** It used
   *  to default to a hashed 40–95 s, which held every ride out of service
   *  16–31% of the time and cost 8–23% of all boarded riders (a breakdown
   *  drains the vehicle as `notSafe` and credits nobody). These parks are
   *  looked at, not managed, and nothing dispatches a mechanic.
   *
   *  Set it to opt a ride back in; the value is then the exact mean, ±25%
   *  jitter. Each breakdown lasts ~18 s (`brokenDown` then `beingRepaired`),
   *  then the ride reopens. See `breakIntervalOf`. */
  breakdownEvery?: number;
  /** ADDITIVE (round-2): explicit queue-lane length in world units (min 1.2).
   *  Default: the capacity formula `max(2.2, 0.6 + capacity·2·0.28 + 0.5)`.
   *  The registered tail spur always sits at `queueAnchor + (laneLen+0.35)·queueDir`
   *  — Park's register wrappers pass a TRIMMED laneLen so the tail lands on
   *  the street node the layout planned instead of overshooting it. */
  laneLen?: number;
  /** ADDITIVE: the ride's measured RCT2 rating triple (SplineRideKit's
   *  `rateCoaster`). PURELY INFORMATIONAL — the sim still gates guests on
   *  `intensity` — it rides along so the ride window can show the real
   *  Excitement/Intensity/Nausea lines (openrct2-ui/windows/Ride.cpp:5936-5954).
   *  Read it back off the handle with `ratings()`. */
  ratings?: RideRatingTriple;
  /**
   * ADDITIVE — MULTI-STATION TRANSPORT RIDES (RCT2 `Ride` owns an ARRAY of
   * stations: `Ride::GetStation(StationIndex)` / `NumStations`, Ride.h; a
   * monorail/chairlift/miniature-railway is the whole point of that array).
   *
   * The fields above (`queueAnchor`/`queueDir`/`boardPoint`/`exitPoint`/…)
   * describe station 0 — UNCHANGED, so every single-station ride in the
   * catalogue registers exactly as before. Each entry here adds ANOTHER
   * platform on the same circuit, with its OWN queue lane, entrance hut, exit
   * hut and exit footpath, gated individually by validatePark.
   *
   * The train visits them in ARRAY ORDER (station 0 → 1 → … → 0) and STOPS AT
   * EVERY ONE — that is not a choice, it is what RCT2 does: any track piece
   * carrying a station index raises `VEHICLE_UPDATE_MOTION_TRACK_FLAG_3`
   * (ride/Vehicle.TrackMotion.cpp:433), `UpdateTravelling` turns that
   * unconditionally into `Status::arriving` (ride/Vehicle.Station.cpp:1503-1511),
   * and `UpdateUnloadingPassengers` pushes EVERY guest off
   * (ride/Vehicle.Station.cpp:974-981) before the cycle restarts at
   * `waitingForPassengers` (:449). So a rider boards at station i and gets off
   * at station i+1 — a real transfer across the park, not a scenic loop.
   */
  stations?: RideStationConfig[];
}

/** ADDITIVE: one EXTRA platform on a multi-station ride (see RideConfig.stations).
 *  Same vocabulary as the ride's own station-0 fields. */
export interface RideStationConfig {
  /** world position of this platform's queue HEAD (entrance hut just beyond) */
  queueAnchor: [number, number, number];
  /** unit xz direction this platform's lane extends in */
  queueDir: [number, number];
  /** the seat anchor ON the vehicle when it is stopped at this platform */
  boardPoint: [number, number, number];
  /** where this platform's exit hut stands */
  exitPoint: [number, number, number];
  /** the exit hut's OUTWARD doorway facing (unit, axis-aligned) */
  exitDir?: [number, number];
  /** explicit lane length (default: the capacity formula, as station 0) */
  laneLen?: number;
  /** human name for this platform — appears in every footprint/warning label
   *  and in the ride handle's `stations()[i].label` /
   *  `accessPoints().rides[i].stations[i].label` (default
   *  `"<ride> station <i>"`; a given label reads `"<ride> · <label>"`) */
  label?: string;
}

/** the RCT2 ride-window rating triple (SplineRideKit `rateCoaster` output,
 *  structurally typed here so GameManager stays independent of the kit) */
export interface RideRatingTriple {
  excitement: number;
  intensity: number;
  nausea: number;
  /** 'gentle' | 'moderate' | 'thrilling' | 'intense' | 'extreme' */
  ratingBand?: string;
  /** nausea past the average guest's tolerance (Guest.cpp:193-198) */
  nauseaExtreme?: boolean;
}

export interface RideOccupancy {
  /** guests seated aboard the vehicle right now */
  riders: number;
  capacity: number;
  occupied: boolean;
}

// ---- BLOCKERS: solid things guests must walk AROUND ------------------------
// RCT2 peeps only ever occupy path tiles, so a fountain, a ride body or a
// fence simply cannot be walked through. This sim walks a graph plus
// off-network waypoint hops, so solidity has to be modelled explicitly: every
// solid object registers a world-space OBB (rotated rect) or circle, guest
// locomotion refuses to step inside one (path edges through a blocker are
// rejected by the routing layer, off-network hops SLIDE along the edge) and
// validatePark fails a layout whose streets run through one.

/** what kind of thing a blocker is (informational — every kind blocks) */
export type BlockerKind = 'ride' | 'stall' | 'fence' | 'queue' | 'building' | 'water' | 'scenery' | (string & {});

/** rotated rect (OBB) in world space — `yaw` matches the ParkFootRect
 *  convention (local +z = [sin yaw, cos yaw], local +x = [cos yaw, −sin yaw]) */
export interface BlockerRectSpec {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  yaw?: number;
}

/** circle in world space (fountain basins, round planters, tower bases) */
export interface BlockerCircleSpec {
  cx: number;
  cz: number;
  r: number;
}

export interface BlockerSpec {
  /** rotated-rect footprint (give exactly one of rect / circle) */
  rect?: BlockerRectSpec;
  /** circular footprint */
  circle?: BlockerCircleSpec;
  /** report/lint label */
  label: string;
  kind?: BlockerKind;
  /** owning ride/stall/restroom name — a guest whose CURRENT interaction is
   *  with that owner ignores its blockers (a deadlock safety valve for the
   *  owner's own sanctioned access walk; every other guest is still blocked) */
  owner?: string;
  /** shape inflation for the walk test (default BLOCKER_PAD — a guest's body
   *  half-width at GUEST_SCALE, so nobody clips a fence with their shoulder) */
  pad?: number;
  /** obstacle height above the walking surface (default 1) — informational
   *  today, reserved for future step-over/underpass rules */
  height?: number;
}

/** live handle over one registered blocker (registrations are relocatable —
 *  the corridor auto-resolver moves rides/stalls after they registered) */
export interface BlockerHandle {
  label: string;
  /** unregister */
  remove(): void;
  /** translate the shape by [dx, dz] */
  move(dx: number, dz: number): void;
  /** replace the shape in place (keeps label/kind/owner/pad) */
  set(shape: { rect?: BlockerRectSpec; circle?: BlockerCircleSpec }): void;
}

/** read-only view of a registered blocker (`manager.blockers()`) */
export interface BlockerInfo {
  label: string;
  kind: BlockerKind;
  owner: string | null;
  height: number;
  pad: number;
  rect?: { cx: number; cz: number; hx: number; hz: number; yaw: number };
  circle?: { cx: number; cz: number; r: number };
}

/** default blocker inflation: a 0.5-scaled peep's body half-width */
export const BLOCKER_PAD = 0.13;

// ---- stall items: consumables (food/drink) + accessories (balloon, wearable) -
// The union stays OPEN (string & {}) so future accessory kinds (RCT2 ShopItem/
// PeepAnimationGroup, Guest.cpp:6928-6941) slot in without a breaking change.
// Anything that is not food/drink is an ACCESSORY: never consumed, never
// littered — 'balloon' is HELD in a hand (and eventually flies away),
// 'wearable' is WORN on the head slot and kept for the rest of the visit.
export type StallItemKind = 'food' | 'drink' | 'balloon' | 'wearable' | (string & {});
/** which hand a held item occupies */
export type HandSlot = 'left' | 'right';
/** what a hand can carry (recordOf().hands reports these) */
export type HeldItemKind = 'food' | 'drink' | 'container' | 'balloon';

/** PER-STALL 3D ITEM BUILDER (the `heldItem` / wearable hook).
 *
 *  Returns a FRESH group, built around ITS OWN origin in PEEP-LOCAL units
 *  (head radius 0.12, fist ball radius 0.05 — the park's 0.5 GUEST_SCALE is
 *  applied by the guest rig, so never pre-scale for it). The manager parents
 *  it under an anchor group that already carries the tuned attach transform:
 *
 *   - consumables ('food' / 'drink'): the HAND hold spot, arm-local
 *     (±0.03, −0.37, 0.15) — 0.115 in z for drinks, slightly nearer the fist —
 *     with the carry-bend arm clamp and the bite/sip lift cycle;
 *   - 'wearable': the peep's `headSlot`, on the crown of the skull, +z facing.
 *
 *  Any position/rotation the builder sets on the group it returns is an
 *  OFFSET from that anchor (a floss cone tips itself forward, goggles drop to
 *  the brow line), so a recipe can fine-tune without touching sim geometry.
 *  Called ONCE per stall (the manager clones the result per purchase), so it
 *  must be deterministic and allocation-light. */
export type StallItemBuilder = (t: typeof THREE) => THREE.Group;

export interface StallConfig {
  name: string;
  item: StallItemKind;
  /** asking price */
  price: number;
  /** perceived value — RCT2 good-value bonus is 4·(value − price) happiness */
  value: number;
  /** world position of the stall body (the shop mesh is placed by the caller) */
  anchor: [number, number, number];
  /** unit xz facing — the serving front / attach point sits 0.72 u this way */
  dir: [number, number];
  /** OPTIONAL themed 3D item the BUYER carries away — a mini hot dog, a floss
   *  cone, a pair of goggles (see StallItemBuilder for the frame). Omit and
   *  consumable stalls fall back to the manager's generic burger / cup;
   *  a 'wearable' stall without one sells nothing visible. */
  heldItem?: StallItemBuilder;
}

// ---- attention zones (registerDanceZone / registerWatchZone) ---------------
// ONE rectangle shape with two sets of defaults. A wandering guest whose walk
// crosses the rectangle takes a hashed per-second chance to STOP and do
// something there — beat-dance on a dance floor, stand and LOOK at a piece of
// scenery in a watch zone — then walks on and is barred from re-latching THAT
// zone until its `cooldown` has passed. See registry.ts / guestPass.ts.
export interface AttentionZoneConfig {
  /** world xz centre of the rectangle */
  center: [number, number];
  /** half-extent across the zone's local x (before `rotation`) */
  halfW: number;
  /** half-extent along the zone's local z (before `rotation`) */
  halfD: number;
  /** zone yaw, matching <Park>'s local frame (default 0) */
  rotation?: number;
  /** world xz point the guest TURNS TO FACE while latched (the thing being
   *  watched). Omit and the guest keeps whatever heading they arrived on —
   *  the dance-zone behaviour. */
  faceAt?: [number, number];
  /** hashed dwell in seconds, [min, max] (dance default [10, 30]; watch
   *  default [4, 10] — a glance, not a residency) */
  linger?: [number, number];
  /** PER-GUEST seconds, counted from the END of a dwell, before this zone may
   *  latch that same guest AGAIN. Without one a guest whose dwell expires while
   *  still inside the rectangle simply re-latches, so any zone laid across
   *  circulation becomes a permanent stop (see registry.ts for the defaults and
   *  the measurement behind them). */
  cooldown?: number;
  /** need floors a guest must clear to latch. Dance default { happiness: 160,
   *  energy: 129 } (only a happy, energetic guest dances); watch default none
   *  — anybody may look at a thing. */
  gate?: { happiness?: number; energy?: number };
}

/** `registerDanceZone` config — beat-dance defaults (see AttentionZoneConfig) */
export type DanceZoneConfig = AttentionZoneConfig;
/** `registerWatchZone` config — stand-and-look defaults (AttentionZoneConfig) */
export type WatchZoneConfig = AttentionZoneConfig;

export interface GameManagerOpts {
  /** ground sampler so guests walk on real terrain off-path (default: y = 0) */
  groundAt?: (x: number, z: number) => number;
  /** path graph — when given, ALL guest locomotion happens ON the network */
  net?: { nodes: [number, number][]; edges: [number, number][] };
  /** walking-surface height on network path slabs (default 0.09, the slab top) */
  laneY?: number;
  /** per-position walking-surface sampler (PathNetwork's `walkYAt`) — with it
   *  guests follow ELEVATED paths and climb ramps instead of walking at one
   *  flat lane level; falls back to `laneY` everywhere when omitted */
  walkYAt?: (x: number, z: number) => number;
  /** the RENDERED pavement top (PathNetwork's `surfaceYAt`), which sits a few mm
   *  above `walkYAt`'s sim datum. A ride's queue lane / exit footpath grades to
   *  THIS so its slab meets the street flush; guests keep walking at `walkYAt`.
   *  Omitted ⇒ falls back to it. See PathNetwork/ribbon.ts `PATH_PAD_LIP`. */
  surfaceYAt?: (x: number, z: number) => number;
  /** litter bins to auto-register (logic only; meshes are the caller's job) */
  bins?: [number, number][];
  /** BENCH SEATS to auto-register — `buildPathNetwork`'s `benches` (logic only;
   *  the meshes are the network's). With them a tired guest walks to a real
   *  bench and sits ON it (RCT2 `PeepState::Sitting`); without them the rest
   *  stop stays the in-place pause it has always been. */
  benches?: { x: number; y: number; z: number; yaw: number }[];
  /** live accessor over the registered coaster circuits (as-built world
   *  points) — powers `corridorCells()`; <Park> wires it automatically */
  circuits?: () => { name?: string; points: [number, number, number][]; fatal?: string }[];
  /** THE GATE STREAM — guests keep ARRIVING through the registered park
   *  entrance while the park is doing well (see arrivals.ts for the RCT2
   *  sources). On by default whenever a park entrance is registered; `<Park>`
   *  wires the size-scaled `cap`. */
  arrivals?: ArrivalsOpts;
}

/** ADDITIVE (round 9): `spawnGuests`' optional THIRD argument — STARTING-STAT
 *  overrides for the cohort being spawned.
 *
 *  WHY IT EXISTS. A fresh RCT2 arrival is well fed (`hunger` spawns at
 *  177-255 on the inverted 0-255 scale where LOW = hungry) and the shop
 *  counter refuses food above `hunger > 75` (RCT2's own DecideAndBuyItem gate,
 *  Guest.cpp:1574). On the RCT2-faithful 512-tick needs clock that is ~163
 *  sim-s of walking before the first guest is even ALLOWED to buy a burger —
 *  fine for a park, useless for a PREVIEW VIGNETTE that runs for a handful of
 *  seconds and exists to show the stall trading. A preview is staged: it
 *  should seed its guests in the state it wants to demonstrate rather than
 *  wait out a day of park time (or, worse, have the needs rates re-tuned
 *  around it — those are measured and RCT2-faithful, see NEEDS_SLOW_EVERY).
 *
 *  Each field is either a FIXED value or a `[min, max]` band drawn per guest
 *  off the same hashed-index generator as every other spawn roll (so a seeded
 *  cohort is as deterministic and as varied as an unseeded one). Values are
 *  clamped to 0-255 (`cash` to >= 0). OMITTING a field — or the whole object —
 *  leaves RCT2's own fresh-arrival roll for that stat exactly as it was: a
 *  `spawnGuests(n)` call with no third argument is bit-identical to before
 *  this option existed.
 *
 *  Remember the INVERSION on the two appetites: `hunger`/`thirst` are stored
 *  RCT2-style, 255 = fully sated and 0 = starving, so "spawn them hungry" is
 *  a LOW number (`hunger: [20, 70]`), not a high one. */
export interface GuestSpawnStats {
  /** 0-255, INVERTED (255 sated / 0 starving). <= 75 buys food, <= 10 goes
   *  looking for a food stall unprompted. */
  hunger?: number | [number, number];
  /** 0-255, INVERTED (255 sated / 0 parched). <= 75 buys a drink, <= 25 goes
   *  looking for a drink stall unprompted. */
  thirst?: number | [number, number];
  /** 0-255, DIRECT (255 = bursting). >= 200 sends the guest to a restroom. */
  toilet?: number | [number, number];
  /** 0-255. Sets `energy` and its target together (they spawn equal). */
  energy?: number | [number, number];
  /** 0-255. Sets `happiness` and its target together (they spawn equal). */
  happiness?: number | [number, number];
  /** sim coins (one coin ~ £0.40; the RCT2 tiers are 100/125/150/175 and stall
   *  items cost 2-4, so this is rarely worth overriding — it is here so a
   *  preview can stage a SKINT guest and show the refusal thought). */
  cash?: number | [number, number];
  /** 0-255 ride-intensity tolerance (RCT2 rolls 2-9). */
  intensityTolerance?: number | [number, number];
}

/** `GameManagerOpts.arrivals` — the gate stream's two knobs */
export interface ArrivalsOpts {
  /** default true — set false for a fixed, closed-population park (previews
   *  that must hold an exact roster, probes that measure one cohort) */
  enabled?: boolean;
  /** HARD population ceiling: arrivals stop while `activeGuests >= cap`, and
   *  resume the moment someone leaves. A PERFORMANCE guard, not an RCT2
   *  mechanic — `<Park>` scales it with the plot (Park/parkRoot
   *  `guestCapForSize`). Default 120. */
  cap?: number;
}

// ---- thoughts (ring of kPeepMaxThoughts = 5 per guest) ----------------------
// EVERY thought is a (type, SUBJECT) pair, exactly like RCT2: its
// `insertNewThought` overloads take a RideId or a ShopItem alongside the type
// (Guest.cpp:7077-7098) and the window formatter substitutes it into the
// string's {STRINGID} slot (PeepThoughtSetFormatArgs, Guest.cpp:7050). A
// thought whose template has no `{}` slot ignores the subject — that is how
// RCT2's un-argumented thoughts ("I'm hungry", STR_1500) work.
export type ThoughtType =
  | 'hungry'
  | 'thirsty'
  | 'toilet'
  | 'tired'
  | 'queuingAges'
  | 'fedUp'
  | 'wasGreat'
  | 'notSafe'
  | 'badLitter'
  | 'notHungry'
  | 'notThirsty'
  | 'cantAfford'
  | 'spentMoney'
  | 'notWorthIt'
  | 'goodValue'
  | 'tooIntense'
  | 'moreThrilling'
  | 'cantFind'
  | 'queueFull'
  | 'sick'
  | 'embarrassed'
  | 'handsFull'
  | 'alreadyWearing'
  | 'haventFinished'
  | 'goHome';

export interface Thought {
  type: ThoughtType;
  /** the RENDERED line ("Wyrm's Hollow was great!") — what every window draws */
  text: string;
  /** the ride / stall / item this thought names, null when it names nothing.
   *  RCT2's thought argument (Guest.cpp:7098 `thoughtArguments`). */
  subject: string | null;
  t: number;
}

export interface WayPt {
  x: number;
  z: number;
  y: number;
}

export type ActionKind = 'dance' | 'wow' | 'checkTime' | 'staggerStop' | 'vomit' | 'squat';

/** in-flight thrown litter: a hand→ground parabolic tween on a litter mesh */
export interface LitterFlight {
  mesh: THREE.Group;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  t0: number;
}

/** eat-arm fling + release state while a guest throws their rubbish */
export interface FlingState {
  t: number;
  released: boolean;
  tx: number;
  tz: number;
  seed: number;
}

/** an ACCESSORY worn on the head slot (StallConfig.item 'wearable').
 *  Deliberately has NO expiry field: a wearable is kept for the REST OF THE
 *  VISIT — never consumed, never dropped, never littered — and because it
 *  hangs off the peep's own `headSlot` it survives boarding a ride, the
 *  entrance-hut hide/unhide and every pose overlay with no per-frame work. */
export interface WornItem {
  /** the anchor group parented to peep.headSlot (holds the stall's mesh) */
  group: THREE.Group;
  /** the stall that sold it (reported by recordOf().worn) */
  stall: string;
  /** simTime of the purchase */
  since: number;
}

/** a balloon held in one hand: rig on the arm pivot + its drop schedule */
export interface BalloonHold {
  pivot: THREE.Group; // at the hand ball, counter-rotated upright per frame
  ball: THREE.Mesh; // the balloon sphere (world-position sampled on release)
  col: number;
  dropAt: number; // simTime of the scheduled DROP event
}

export interface SimGuest {
  idx: number;
  peep: ReturnType<typeof buildPeep>;
  state: GuestState;
  gone: boolean;
  hidden: boolean;
  x: number;
  z: number;
  baseY: number;
  yaw: number;
  phase: number;
  // needs, all 0..255 (Guest.cpp:769-921)
  happiness: number;
  happinessTarget: number;
  hunger: number;
  thirst: number;
  energy: number;
  energyTarget: number;
  nausea: number;
  toilet: number;
  cash: number;
  intensityTolerance: number; // 1..10 preferred intensity
  // network locomotion: position = fromNode --(u)--> toNode
  fromNode: number;
  toNode: number; // -1 = standing at fromNode, needs a decision
  u: number;
  path: number[]; // remaining route nodes (goal-seeking)
  junctionMemory: number[]; // last 4 thin junctions (GuestPathfinding.cpp:628)
  goal: {
    kind: 'ride' | 'stall' | 'restroom' | 'exit' | 'bench';
    node: number;
    ride?: RideRec;
    stall?: StallRec;
    restroom?: RestroomRec;
    bench?: BenchRec;
  } | null;
  // off-network walking (queue lane, doorways, stall fronts, bins)
  waypoints: WayPt[];
  netReentry: number | null; // node to snap back onto when waypoints empty
  resume: { from: number; to: number; u: number } | null; // usingBin detour
  // direct-walk fallback (no net)
  target: WayPt | null;
  home: { x: number; z: number; r: number };
  // queue / ride
  ride: RideRec | null;
  /** ADDITIVE (multi-station): the PLATFORM this guest is queuing at / boarded
   *  from. Null when not attached to a ride. Single-station rides always set
   *  `ride.stations[0]`, so nothing changes for them. */
  station: RideStationRec | null;
  /** ADDITIVE: the platform index this rider BOARDED at.
   *
   *  RCT2 does not store this — `Peep::CurrentRideStation` (entity/Peep.h:343)
   *  is OVERWRITTEN with the vehicle's station the moment the guest gets off
   *  (`CurrentRideStation = ride_station;`, entity/Guest.cpp:4192 + 4226), so a
   *  RCT2 peep literally forgets where it got on. We keep the boarding index
   *  purely so a TRANSFER (`boardStation !== atStation` on unload) is countable
   *  — it changes no behaviour. */
  boardStation: number;
  lastRide: RideRec | null;
  lastRideT: number;
  /** every ride this guest has COMPLETED, by `RideRec.idx`. Drives the
   *  novelty-first ride choice in navigation.ts: a guest heads for something
   *  they have not been on yet before repeating one, which is what makes a
   *  park's whole roster get ridden rather than the two nearest attractions. */
  riddenIds: Set<number>;
  timeInQueue: number;
  ridden: number;
  exitDelay: number;
  // stall / bin / litter
  stall: StallRec | null;
  bin: BinRec | null;
  restroom: RestroomRec | null;
  /** the bench seat this guest is sitting on (state 'sitting'), or null for a
   *  rest taken standing where they stood — the fallback when a park has no
   *  benches within reach */
  bench: BenchRec | null;
  /** eased 0..1 seated envelope — folds the legs onto the bench and back off
   *  it, the same way `lapW` folds the arms onto a ride's lap bar */
  sitW: number;
  /** simTime the guest last got OFF a bench — the bar on taking another */
  benchT: number;
  holding: 'food' | 'drink' | 'container' | null;
  /** which hand carries the active consumable chain (right preferred) */
  eatHand: HandSlot;
  /** held consumable meshes per hand pivot — built ONCE on first purchase in
   *  that hand, then only shown/hidden (no per-frame allocation) */
  held: { food: THREE.Group; drink: THREE.Group; container: THREE.Group } | null; // right hand
  heldL: { food: THREE.Group; drink: THREE.Group; container: THREE.Group } | null; // left hand
  /** the PER-STALL themed consumable currently in the eat hand (StallConfig
   *  `heldItem`) — a clone of the selling stall's mesh parented to the same
   *  hand hold spot the generic food/drink meshes use. While it is set the
   *  generic pair stays hidden; it is detached when the meal reaches the
   *  CONTAINER stage (the generic crumpled container takes over) so the
   *  bin/litter lifecycle is untouched. null = the generic look. */
  heldCustom: THREE.Group | null;
  /** accessory slots: a balloon rig per hand (string + ball on the hand
   *  pivot, counter-rotated upright every frame) — null = hand free */
  balloons: { left: BalloonHold | null; right: BalloonHold | null };
  /** accessory slot: the item WORN on the head (one at a time, kept for the
   *  rest of the visit) — null = bare head */
  worn: WornItem | null;
  /** simTime until which the guest sadly glances up at a flown balloon */
  glanceUpUntil: number;
  eatN: number; // bites/sips remaining in the current meal
  containerSince: number; // simTime the meal finished (container patience cap)
  biteGap: number; // hashed seconds between bites (BITE_GAP + 0-5)
  nextBiteAt: number; // simTime of the next scheduled bite/sip
  lastBiteAt: number; // simTime the last bite STARTED — drives the arm raise
  eatK: number; // eased 0..1 envelope for the eat/drink arm overlay
  eatArm: number | null; // slew-limited eat-arm override value (null = released)
  lapW: number; // eased 0..1 envelope for the seated lap-bar arm fold
  litterUpsetT: number;
  /** active throw-trash arm fling (null = none) */
  fling: FlingState | null;
  /** seconds into the current squat / vomit action */
  squatT: number;
  vomitT: number;
  /** simTime at which the sick face reverts (-1 = not sick) */
  sickUntil: number;
  /** staggered park-gate arrival: seconds until this guest appears */
  entryDelay: number;
  /** a one-shot pose-layer 'wow' jump is queued for the exit apron */
  hopArmed: boolean;
  /** leavingPark: despawn when the current waypoint chain (arch -> gate) ends */
  despawnAtWpEnd: boolean;
  // bookkeeping
  timer: number;
  acc128: number;
  tick128N: number;
  lastSec: number;
  decN: number;
  action: { kind: ActionKind; until: number } | null;
  headTilt: number;
  slump: number;
  moving: boolean;
  thoughts: Thought[];
  /** simTime of the last thought appended — the ambient-thought cadence gate */
  lastThoughtAt: number;
}

/**
 * ONE PLATFORM of a registered ride — the RCT2 `RideStation` (Station.h): its
 * own queue, entrance hut, exit hut and exit footpath.
 *
 * `RideRec.stations[0]` is a VIEW over the ride's own legacy fields (the same
 * objects, delegated by accessor), so a single-station ride behaves exactly as
 * it always has and every existing consumer of `rec.queue` / `rec.dir` /
 * `rec.exitPos` keeps working untouched. Stations 1..n own their fields
 * outright.
 */
export interface RideStationRec {
  ride: RideRec;
  /** RCT2 StationIndex — the order the train visits them in */
  idx: number;
  label: string;
  /** the queue HEAD (station 0: `ride.cfg.queueAnchor`) */
  anchor: [number, number, number];
  /** the seat anchor while the vehicle is stopped here */
  boardPoint: [number, number, number];
  dir: [number, number];
  laneLen: number;
  maxSlots: number;
  /** walking-surface height at the queue HEAD (the ride's own level) */
  laneY: number;
  /** …and at the TAIL, where the lane meets the street. The two differ on
   *  almost every layout, which is why the lane is an RCT2 sloped path and
   *  `slotPos` interpolates between them (access.ts). */
  laneTailY: number;
  queue: SimGuest[];
  entering: SimGuest[];
  doorway: WayPt;
  hutIn: WayPt;
  exitPos: WayPt;
  exitYaw: number;
  exitDir: [number, number];
  exitDoor: WayPt;
  exitOut: WayPt;
  exitCorner: WayPt | null;
  queueAttach: { node: number; x: number; z: number } | null;
  exitAttach: { node: number; x: number; z: number } | null;
  accessG: THREE.Group;
  exitG: THREE.Group;
  laneG: THREE.Group;
  exitLaneG: THREE.Group | null;
  exitLaneLen: number;
  laneBlockers: BlockerHandle[];
}

export interface RideRec {
  cfg: RideConfig;
  idx: number;
  state: RideState;
  timer: number; // counts UP in waitingForPassengers, down elsewhere
  queue: SimGuest[];
  entering: SimGuest[];
  riders: SimGuest[];
  maxSlots: number;
  laneY: number;
  /** the queue lane's TAIL level — see RideStationRec.laneTailY */
  laneTailY: number;
  dir: [number, number];
  doorway: WayPt;
  hutIn: WayPt; // entrance hut INTERIOR — the boarding walk ends (and the guest vanishes) here
  exitPos: WayPt; // resolved exit hut centre (cfg.exitPoint, possibly audit-shifted)
  exitYaw: number;
  /** the exit hut's OUTWARD doorway facing (unit, axis-aligned) — the exit
   *  path is cast along it. RCT2's `DirectionReverse(exitElement->direction)`. */
  exitDir: [number, number];
  exitShift: number; // signed shift applied along the pad edge by placeAccess (0 = none)
  exitDoor: WayPt;
  /** where the exit path meets the street — the guest's first NETWORK waypoint
   *  after stepping out of the hut (the tail of the exit lane, or a bare 1.5 u
   *  out when no street lay on the outward ray) */
  exitOut: WayPt;
  /** the CORNER of an L-shaped exit path (`planExitLane`'s JOIN case), or null
   *  for a straight run. Without it a leaving guest walks the chord from the
   *  doorway to `exitOut` and cuts the corner across the grass. */
  exitCorner: WayPt | null;
  queueAttach: { node: number; x: number; z: number } | null;
  exitAttach: { node: number; x: number; z: number } | null;
  /** the ride's OWN access meshes (entrance/exit huts + queue lane) — one
   *  subgroup so moveRide() can translate the whole rig */
  accessG: THREE.Group;
  /** the exit hut mesh alone — moveRideExit() relocates just it */
  exitG: THREE.Group;
  /** the queue lane mesh — resizeRideLane() rebuilds it */
  laneG: THREE.Group;
  /** the EXIT PATH slab (ordinary footpath, hut → street) — null when no
   *  street lay on the exit's outward ray, which is RCT2's
   *  `STR_EXIT_NOT_CONNECTED` condition (Ride.cpp:2076) */
  exitLaneG: THREE.Group | null;
  /** length of that run in world units (0 = none) */
  exitLaneLen: number;
  /** current queue lane length (resizeRideLane updates it) */
  laneLen: number;
  /** the two lane-side fence railings as blockers (a queue is only enterable
   *  at its TAIL) — moved/rebuilt with the lane */
  laneBlockers: BlockerHandle[];
  /** the boardPoint pad as a blocker (the ride BODY guests can't cross) */
  padBlocker: BlockerHandle | null;
  intensity: number;
  price: number;
  minWait: number;
  maxWait: number;
  /** resolved `cfg.quietWait ?? BOARD_QUIET_SECS` — the boarding-quiet window */
  quietWait: number;
  // ---- THE BOARDING-QUIET DWELL (rideFsm.ts `waitingForPassengers`) ---------
  // All three are reset the moment the ride re-enters `waitingForPassengers`
  // and are only meaningful inside that state.
  /** riders already COUNTED in this dwell. The FSM watches `riders.length`
   *  against it, so a BOARDING is detected where it actually happens — a guest
   *  finishing the doorway walk and being pushed onto `riders` in guestPass.ts —
   *  without the guest pass having to know anything about ride timers. Queue
   *  movement is deliberately NOT a boarding: a guest admitted out of the queue
   *  is in `entering` and may still back out (drainRide). */
  boardedSeen: number;
  /** `timer` at the FIRST boarding of this dwell (-1 = nobody has boarded).
   *  `maxWait` is measured from here. */
  boardAt: number;
  /** `timer` at the MOST RECENT boarding (-1 = nobody has boarded). The
   *  boarding-quiet window is measured from here, so every new rider buys the
   *  platform another `quietWait` seconds. */
  lastBoardAt: number;
  // ---- additive: breakdown model + per-ride totals ----
  total: number; // riders served over the ride's lifetime ("total rides")
  brokenAt: number; // simTime the current breakdown began (-1 = running fine)
  breakN: number; // completed breakdowns (feeds the deterministic schedule)
  nextBreak: number; // simTime of the next scheduled breakdown
  // ---- ADDITIVE: MULTI-STATION (RCT2 Ride::GetStations(), Ride.h) ----------
  /** every platform on this ride, in visit order. Length 1 for an ordinary
   *  ride, and `stations[0]` is then just a view over the fields above. */
  stations: RideStationRec[];
  /** RCT2 `Vehicle::current_station` — the platform the train is AT (or, while
   *  travelling, the one it just left). Always 0 on a one-station ride. */
  atStation: number;
  /** transfers completed: a guest boarded at one platform and got off at a
   *  DIFFERENT one. The measurable proof a transport ride actually transports. */
  transfers: number;
}

export interface StallRec {
  cfg: StallConfig;
  front: WayPt;
  attach: { node: number; x: number; z: number } | null;
  sold: number;
  /** the shop body as a blocker (the serving front stays walkable) */
  blocker: BlockerHandle | null;
}

export interface BinRec {
  x: number;
  z: number;
  count: number; // capacity 3 (LitterBin, Guest.cpp:5534)
}

/** ONE BENCH SEAT the sim can send a tired guest to.
 *
 *  RCT2 benches are not scenery — `PeepState::Sitting` is a real state a guest
 *  enters by walking to a bench path-addition and sitting ON it
 *  (`Guest::UpdateWalking` picks a free bench tile, entity/Guest.cpp:2790-2860;
 *  `Guest::UpdateSitting` :2900-2990 runs the dwell and the energy recovery).
 *  Before this the sim's rest stop was a coin-flip that froze the guest
 *  standing wherever they happened to be, with the park's benches sitting
 *  unused a metre away — the two were never connected.
 *
 *  `x`/`y`/`z` is the seat point, `yaw` the way a guest on it looks, and
 *  `taken` the one guest currently sitting there (a seat holds ONE peep). */
export interface BenchRec {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** the walk-up point on the path in front of the seat, and its routing spur */
  attach: { node: number; x: number; z: number } | null;
  taken: SimGuest | null;
  /** lifetime sittings, for ParkInfo/queries */
  uses: number;
}

export interface RestroomRec {
  doorway: WayPt; // WORLD walk-in point at the hut front
  attach: { node: number; x: number; z: number } | null;
  uses: number;
  /** blocker owner tag shared with the hut's registered blocker, so a guest
   *  walking to THIS doorway is never blocked by its own restroom */
  owner: string | null;
}

export const SPACING = 0.28; // single-file queue slot spacing
export const GUEST_SCALE = 0.5;
/** hip-pivot height in PEEP-LOCAL units — the `limb(±0.08, 0.46, …)` legs in
 *  Guest's buildPeep hang off y = 0.46, so a SEATED guest's root has to sit
 *  this far (times GUEST_SCALE) below the seat surface for the thighs to land
 *  on the slats instead of hovering over them or sinking through. */
export const SIT_DROP = 0.46 * GUEST_SCALE;
export const LITTER_CAP = 40;
export const POOP_CAP = 8; // discreet fallback meshes, oldest reused
export const TOILET_SEEK = 200; // toilet need at which a guest hunts for a restroom
// ---- RCT2 tick-derived thresholds -------------------------------------------
export const NEEDS_TICK = T(128); // 0.8 s — the Tick128 cadence (Guest.cpp:769)
// THE 512-TICK SUB-CADENCE. tick128UpdateGuest is entered every 128 ticks, but
// its first line bails to updateConsumptionMotives() unless
// (index & 0x1FF) == (currentTicks & 0x1FF) — "the effect of masking with 0x1FF
// here vs mask 0x7F ... is to reduce how often the content in this conditional
// is executed to once every four calls" (Guest.cpp:924-937). EVERYTHING below
// that gate — GuestUpdateHunger's hunger −2 / toilet +1 (:3089-3098),
// GuestDecideWhetherToLeavePark's energyTarget −2 / thirst −1 and the 5%
// leave-the-park roll (:3106-3151), updateMotivesIdle's happiness drains
// (:769-812) and the queuing happiness −4 (:1240) — therefore runs once every
// 512 ticks, NOT every 128.
// This sim used to apply all of those 512-tick steps on the 128-tick cadence:
// a 4x error that is exactly why guests went hungry in ~98 s and soured in
// seconds. NEEDS_SLOW_EVERY restores the real gate.
export const NEEDS_SLOW_EVERY = 4; // 4 needs ticks = RCT2's 512-tick cycle (3.2 s)
// QUEUE PATIENCE — RCT2's own tick thresholds, read on the REAL clock (TR):
// timeInQueue counts one per guest update tick (Guest.cpp:7537), so 2000 ticks
// is 50 s of play, not 12.5. See "THE TWO CLOCKS" above for why a queue is
// measured in real seconds while appetites are compressed.
export const QUEUE_UNHAPPY_AT = TR(2000); // 50.0 s — happiness target −4 per 512-tick cycle (Guest.cpp:1200,1240)
export const QUEUE_AGES_AT = TR(3500); // 87.5 s — "I've been queuing for X for ages" (Guest.cpp:5782)
export const QUEUE_BALK_AT = TR(4300); // 107.5 s — eligible to abandon the queue (Guest.cpp:5827)
export const LAST_RIDE_TIMEOUT = T(128 * 25); // previous-ride refusal decays (~20 s)
// consumption pacing — RCT2 guests nibble on a schedule (timeToConsume,
// Guest.cpp:815-854 updateConsumptionMotives: one +7 nibble, food also nudges
// thirst down / toilet up, PAUSED while onRide). Ours stretches a meal to
// MINUTES: 12-16 hashed bites, one every 8-12 hashed s, so an item is held
// 1.6-3.2 sim-minutes before the container is left in the hand. (Was 10-15 s
// per bite = 2-4 min; trimmed so a guest can still make a SECOND purchase
// inside one visit — a hand holding food refuses every other consumable.)
export const MEAL_BITES = 12; // bites/sips per meal, + hashed 0-4
export const BITE_GAP = 8; // seconds between bites, + hashed 0-4
// ---- starting cash (Guest::generate, Guest.cpp:7362-7381) -------------------
// RCT2: cash = guestInitialCash + ((rand & 3) · £10) − £10, so the four tiers
// are £40 / £50 / £60 / £70 around the £50 scenario default (money64 is in
// units of 10p, 1.00_GBP == 10 — core/Money.hpp:27).
// This sim's price scale: a snack is 3 and a ride 3-5, against RCT2's £1.20
// burger and £1.50-£3.00 ride — so one sim coin is ~£0.40, and RCT2's four
// tiers land on 100 / 125 / 150 / 175 coins.
export const GUEST_CASH_BASE = 100; // the £40 tier
export const GUEST_CASH_STEP = 25; // £10 in sim coins
export const GUEST_CASH_TIERS = 4; // RCT2's (rand & 3)
// breakdown phases (RideFlag::brokenDown — Ride::formatStatusTo draws
// "Broken down", src/openrct2/ride/Ride.cpp:534-537): the fault lasts 12 s,
// the mechanic's repair another 6 s (~18 s total), then the ride reopens
export const BREAK_DOWN_SECS = 12;
export const REPAIR_SECS = 6;
// BOARDING-QUIET WINDOW: how long a part-full vehicle holds the doors open
// after the LAST guest sat down. Every boarding restarts it; when it runs out
// with at least one rider aboard, the ride leaves (rideFsm.ts
// `waitingForPassengers`). It is authored in REAL seconds, NOT `T(ticks)`:
// it is compared against BOARDING, which is a walk (the guest files through the
// entrance hut at `speedOf`), and walking runs on the 1x clock — see the
// TICKS_PER_SEC note above for the bug that mixing the two clocks caused.
export const BOARD_QUIET_SECS = 10;

// ---- the thought table -----------------------------------------------------
// Each entry is RCT2's own string with its {STRINGID} argument slot written as
// `{}`. The STR_ ids are the en-GB strings shipped with OpenRCT2
// (data/language/en-GB.txt) — the ride/stall name is substituted into `{}` by
// `thoughtText` below, so a thought reads "Wyrm's Hollow was great!", not
// "That ride was great!".
//
// SUBJECTLESS entries are subjectless in RCT2 too (hungry/thirsty/toilet/tired
// carry no argument, STR_1499-1502) — those keep the same text they always had.
//
// Four entries have NO RCT2 string and are marked SIM-ONLY: `fedUp` (RCT2
// guests abandon a queue silently, Guest.cpp:5829-5838), `queueFull` (RCT2
// records RideFlag::queueFull and walks on with no thought at all,
// GuestTriedToEnterFullQueue Guest.cpp:2461), `handsFull` and `embarrassed`
// (this sim's two-hand registry and its no-restroom fallback are both additions
// to RCT2). They still name the ride/stall where there is one to name, but do
// not claim a citation.
export const THOUGHT_TEXT: Record<ThoughtType, string> = {
  hungry: "I'm hungry", // STR_1500
  thirsty: "I'm thirsty", // STR_1501
  toilet: 'I need to go to the toilet', // STR_1502
  tired: "I'm tired", // STR_1499
  queuingAges: "I've been queuing for {} for ages", // STR_1498
  fedUp: "I'm fed up of queuing for {} — I'm leaving", // SIM-ONLY (see above)
  wasGreat: '{} was great!', // STR_1497 ("{} was great" — the '!' is ours)
  notSafe: "I'm not going on {} — it isn't safe", // STR_1510
  badLitter: 'The litter here is really bad', // STR_1506
  notHungry: "I'm not hungry", // STR_1493
  notThirsty: "I'm not thirsty", // STR_1494
  cantAfford: "I can't afford {}", // STR_1480 (ride) / STR_1492 (shop item)
  spentMoney: "I've spent all my money", // STR_1481
  notWorthIt: "I'm not paying that much for the {}", // STR_1488 / ShopItem TooMuchThought
  goodValue: 'This {} is really good value', // STR_1490 / ShopItem GoodValueThought
  tooIntense: '{} looks too intense for me', // STR_1485
  moreThrilling: 'I want to go on something more thrilling than {}', // STR_1484
  cantFind: "I can't find {}", // STR_1503
  queueFull: 'The queue for {} is too long', // SIM-ONLY (see above)
  sick: 'I feel sick', // STR_1482
  embarrassed: 'Oh no... how embarrassing!', // SIM-ONLY (see above)
  handsFull: 'My hands are full', // SIM-ONLY (see above)
  alreadyWearing: "I've already got {}", // STR_1491
  haventFinished: "I haven't finished my {} yet", // STR_1486
  goHome: 'I want to go home', // STR_1489
};

/** Render one thought. `{}` is RCT2's {STRINGID} argument slot: it takes the
 *  ride / stall / item SUBJECT. A template with no slot ignores the subject
 *  (RCT2's un-argumented thoughts), and a slotted template with no subject
 *  falls back to 'that ride' so a caller can never print a raw `{}`. */
export const thoughtText = (type: ThoughtType, subject?: string | null) => {
  const tpl = THOUGHT_TEXT[type];
  if (!tpl.includes('{}')) return tpl;
  return tpl.replace('{}', subject && subject.length ? subject : 'that ride');
};

/** does this thought type name a subject? (the `{}` slot — RCT2's argument) */
export const thoughtNamesSubject = (type: ThoughtType) => THOUGHT_TEXT[type].includes('{}');

