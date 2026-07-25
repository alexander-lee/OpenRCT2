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
// CONSUMABLE on the right hand (preferred) with eat/drink arm cycles, while
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

/** 1 RCT2 game tick = 1/160 s of sim time. */
export const TICKS_PER_SEC = 160;
/** Convert an OpenRCT2 tick count into sim seconds. */
export const T = (ticks: number) => ticks / TICKS_PER_SEC;

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
  /** max seconds waitingForPassengers holds before departing (default T(1920)) */
  maxWait?: number;
  /** external vehicle handle — crashed() true puts the ride into 'crashed' */
  vehicleHandle?: { crashed?(): boolean };
  /** ADDITIVE: mean seconds between deterministic breakdowns (default: hashed
   *  per-ride reliability, ~40–95 s). Each breakdown lasts ~18 s
   *  (brokenDown then beingRepaired), then the ride reopens. */
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

// ---- stall items: consumables (food/drink) + accessories (balloon, …) ------
// The union stays OPEN (string & {}) so future accessory kinds (hats,
// sunglasses — RCT2 ShopItem/PeepAnimationGroup, Guest.cpp:6928-6941) slot in
// without a breaking change. Anything that is not food/drink is an ACCESSORY:
// held, never consumed, never littered.
export type StallItemKind = 'food' | 'drink' | 'balloon' | (string & {});
/** which hand a held item occupies */
export type HandSlot = 'left' | 'right';
/** what a hand can carry (recordOf().hands reports these) */
export type HeldItemKind = 'food' | 'drink' | 'container' | 'balloon';

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
}

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
  /** litter bins to auto-register (logic only; meshes are the caller's job) */
  bins?: [number, number][];
  /** live accessor over the registered coaster circuits (as-built world
   *  points) — powers `corridorCells()`; <Park> wires it automatically */
  circuits?: () => { name?: string; points: [number, number, number][]; fatal?: string }[];
}

// ---- thoughts (ring of kPeepMaxThoughts = 5 per guest) ----------------------
export type ThoughtType =
  | 'hungry'
  | 'thirsty'
  | 'toilet'
  | 'queuingAges'
  | 'fedUp'
  | 'wasGreat'
  | 'notSafe'
  | 'badLitter'
  | 'notHungry'
  | 'notThirsty'
  | 'cantAfford'
  | 'notWorthIt'
  | 'goodValue'
  | 'tooIntense'
  | 'queueFull'
  | 'sick'
  | 'embarrassed'
  | 'handsFull'
  | 'haventFinished'
  | 'goHome';

export interface Thought {
  type: ThoughtType;
  text: string;
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
  goal: { kind: 'ride' | 'stall' | 'restroom' | 'exit'; node: number; ride?: RideRec; stall?: StallRec; restroom?: RestroomRec } | null;
  // off-network walking (queue lane, doorways, stall fronts, bins)
  waypoints: WayPt[];
  netReentry: number | null; // node to snap back onto when waypoints empty
  resume: { from: number; to: number; u: number } | null; // usingBin detour
  // direct-walk fallback (no net)
  target: WayPt | null;
  home: { x: number; z: number; r: number };
  // queue / ride
  ride: RideRec | null;
  lastRide: RideRec | null;
  lastRideT: number;
  timeInQueue: number;
  ridden: number;
  exitDelay: number;
  // stall / bin / litter
  stall: StallRec | null;
  bin: BinRec | null;
  restroom: RestroomRec | null;
  holding: 'food' | 'drink' | 'container' | null;
  /** which hand carries the active consumable chain (right preferred) */
  eatHand: HandSlot;
  /** held consumable meshes per hand pivot — built ONCE on first purchase in
   *  that hand, then only shown/hidden (no per-frame allocation) */
  held: { food: THREE.Group; drink: THREE.Group; container: THREE.Group } | null; // right hand
  heldL: { food: THREE.Group; drink: THREE.Group; container: THREE.Group } | null; // left hand
  /** accessory slots: a balloon rig per hand (string + ball on the hand
   *  pivot, counter-rotated upright every frame) — null = hand free */
  balloons: { left: BalloonHold | null; right: BalloonHold | null };
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
  dir: [number, number];
  doorway: WayPt;
  hutIn: WayPt; // entrance hut INTERIOR — the boarding walk ends (and the guest vanishes) here
  exitPos: WayPt; // resolved exit hut centre (cfg.exitPoint, possibly audit-shifted)
  exitYaw: number;
  exitShift: number; // signed shift applied along the pad edge by placeAccess (0 = none)
  exitDoor: WayPt;
  exitOut: WayPt;
  queueAttach: { node: number; x: number; z: number } | null;
  exitAttach: { node: number; x: number; z: number } | null;
  /** the ride's OWN access meshes (entrance/exit huts + queue lane) — one
   *  subgroup so moveRide() can translate the whole rig */
  accessG: THREE.Group;
  /** the exit hut mesh alone — moveRideExit() relocates just it */
  exitG: THREE.Group;
  /** the queue lane mesh — resizeRideLane() rebuilds it */
  laneG: THREE.Group;
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
  // ---- additive: breakdown model + per-ride totals ----
  total: number; // riders served over the ride's lifetime ("total rides")
  brokenAt: number; // simTime the current breakdown began (-1 = running fine)
  breakN: number; // completed breakdowns (feeds the deterministic schedule)
  nextBreak: number; // simTime of the next scheduled breakdown
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
export const LITTER_CAP = 40;
export const POOP_CAP = 8; // discreet fallback meshes, oldest reused
export const TOILET_SEEK = 200; // toilet need at which a guest hunts for a restroom
// RCT2 tick-derived thresholds
export const NEEDS_TICK = T(128); // 0.8 s — the Tick128 cadence (Guest.cpp:769)
export const QUEUE_UNHAPPY_AT = T(2000); // happiness target −4 per Tick128 (Guest.cpp:7535)
export const QUEUE_AGES_AT = T(3500); // "I've been queuing for ages" thought
export const QUEUE_BALK_AT = T(4300); // eligible to abandon the queue
export const LAST_RIDE_TIMEOUT = T(128 * 25); // previous-ride refusal decays (~20 s)
// consumption pacing — RCT2 guests nibble on a schedule (timeToConsume,
// Guest.cpp:815-854 updateConsumptionMotives: one +7 nibble per needs tick,
// food also nudges thirst down / toilet up, PAUSED while onRide). Ours
// stretches a meal to MINUTES: 12-16 hashed bites, one every 10-15 hashed s,
// so an item is held 2-4 sim-minutes before the container is left in the hand
export const MEAL_BITES = 12; // bites/sips per meal, + hashed 0-4
export const BITE_GAP = 10; // seconds between bites, + hashed 0-5
// breakdown phases (RideFlag::brokenDown — Ride::formatStatusTo draws
// "Broken down", src/openrct2/ride/Ride.cpp:534-537): the fault lasts 12 s,
// the mechanic's repair another 6 s (~18 s total), then the ride reopens
export const BREAK_DOWN_SECS = 12;
export const REPAIR_SECS = 6;

export const THOUGHT_TEXT: Record<ThoughtType, string> = {
  hungry: "I'm hungry",
  thirsty: "I'm thirsty",
  toilet: 'I need the toilet',
  queuingAges: "I've been queuing for ages",
  fedUp: "I'm fed up of waiting — I'm leaving this queue",
  wasGreat: 'That ride was great!',
  notSafe: "I'm not going on that — it isn't safe",
  badLitter: 'The litter here is really bad',
  notHungry: "I'm not hungry",
  notThirsty: "I'm not thirsty",
  cantAfford: "I can't afford that",
  notWorthIt: "I'm not paying that much",
  goodValue: 'What good value!',
  tooIntense: "That ride doesn't look right for me",
  queueFull: 'The queue is too long',
  sick: "I feel sick",
  embarrassed: 'Oh no... how embarrassing!',
  handsFull: 'My hands are full',
  haventFinished: "I haven't finished yet",
  goHome: 'I want to go home',
};

