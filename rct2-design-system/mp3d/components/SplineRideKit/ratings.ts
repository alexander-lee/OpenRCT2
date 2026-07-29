// ---------------------------------------------------------------------------
// SplineRideKit / ratings.ts — RCT2 ride-TEST replay + EXCITEMENT/INTENSITY/
// NAUSEA ratings. Split out of ./index.tsx for file size only; index.tsx
// re-exports every public name here.
// `inversionWindow` is shared with ./design (which owns it) — the same single
// implementation the runner and the design check use.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { computeSplineFrames, detectLiftHill, SplineFrames } from '../SplineCoaster';
import { CoasterType, coasterBankCap, inversionWindow } from './design';

// ---------------------------------------------------------------------------
// RCT2 RIDE RATINGS — measure a compiled circuit the way OpenRCT2's ride TEST
// does (Vehicle.cpp:470-520,658-700 UpdateMeasurements: max/average speed,
// per-frame G-forces, air time, drop count + highest drop, turn counts), then
// run RideRatings.cpp's modifier pipeline over the result to get RCT2's
// EXCITEMENT / INTENSITY / NAUSEA triple.
//
// The measurement pass is the SAME energy-paced replay the runner and
// validatePark's crash gate use — `replayCoasterForces` below is that replay,
// factored out so there is exactly ONE physics model in the kit: speed
// v = √(2·(g·(maxY + 0.55) − g·y)) clamped to vMin 1.4 (lift 1.5, station
// brake run 1.6), and the guard's effective lateral acceleration
// v²·κ_h·(1 − min(1, |roll|/0.6)) (Vehicle.TrackMotion.cpp:58-122). Vertical G
// is the same replay state read along the frame's up axis — gravity component
// + centripetal, exactly the shape of RCT2's Vehicle::GetGForces
// (Vehicle.cpp:1173-1199: pitch/roll gravity term plus |velocity|·98/factor).
//
// UNIT MAPPING (documented simplification): the kit authors its pieces roughly
// ONE PER RCT2 TILE (straight 1.3, turn radius 1.5, station 2.6 world units
// against RCT2's 1-3-tile equivalents), so ONE WORLD UNIT IS READ AS ONE RCT2
// TILE. Everything else follows from RCT2's own arithmetic:
//   • ride length  — a flat tile is 32 subposition steps of 0x368A distance
//     each (Vehicle.MiniGolf.cpp:49; Ride.cpp:3490), and ToHumanReadableRideLength
//     is `>> 16` (UnitConversion.cpp:74) → 446784/65536 = 6.8175 length units/tile
//   • speed        — distance/tick is (velocity >> 10)·42 at 40 ticks/s
//     (Vehicle.cpp:497) and mph is (velocity·9) >> 18 (UnitConversion.cpp:62)
//     → 1 tile/s = 9.3495 mph
//   • height       — kCoordsZStep 8 against a 32-coord tile → 4 z-steps/tile,
//     which is what highestDropHeight counts (Vehicle.cpp:664-673)
//   • duration     — SegmentTime ticks once per 32 game ticks (Vehicle.cpp:481-494)
//     → 0.8 s per RCT2 duration unit
// G-forces are DIMENSIONLESS and pass through 1:1 — the kit's replay is already
// calibrated against RCT2's own g thresholds (the 1.5 g no-upstop derail).
// ---------------------------------------------------------------------------

/** length units per RCT2 tile: (32 × 0x368A) >> 16 — Vehicle.cpp:497, UnitConversion.cpp:74 */
const RCT2_LENGTH_PER_TILE = (32 * 0x368a) / 65536;
/** mph per tile/second — Vehicle.cpp:497 distance/tick vs UnitConversion.cpp:62 */
const RCT2_MPH_PER_TILE_PER_SEC = 9.3495;
/** height steps per tile: kCoordsZStep 8 vs a 32-coord tile (Vehicle.cpp:664) */
const RCT2_ZSTEPS_PER_TILE = 4;
/** seconds per RCT2 duration unit: SegmentTime++ every 32 of 40 ticks/s */
const RCT2_SEC_PER_DURATION = 0.8;
/** RCT2 sim ticks per second — totalAirTime counts ticks (Vehicle.cpp:512-515) */
const RCT2_TICKS_PER_SEC = 40;
/** mph → the fixed-point `Ride::maxSpeed` field (mph = (v·9) >> 18) */
const RCT2_VELOCITY_PER_MPH = 262144 / 9;

export interface CoasterForceSample {
  /** loop parameter of the sample */
  u: number;
  /** rail height (world units) */
  y: number;
  /** energy-paced speed, units/s */
  v: number;
  /** horizontal curvature, 1/units */
  kH: number;
  /** signed bank angle, radians */
  roll: number;
  /** the GUARD's effective lateral acceleration in units/s² (= m/s²): the
   *  number validatePark tests against 1.5 g × 0.85 */
  latAccel: number;
  /** vertical G along the car's up axis (g): gravity term + centripetal */
  vertG: number;
}

export interface CoasterForceReplay {
  /** the frames the replay ran over (reuse them, don't resample) */
  frames: SplineFrames;
  samples: CoasterForceSample[];
  /** worst effective lateral acceleration, units/s² — validatePark's gate */
  worstLatAccel: number;
  /** loop parameter of `worstLatAccel` */
  worstLatAt: number;
  /** highest rail point (the replay's energy budget datum) */
  maxY: number;
  /** per-sample lift-hill mask (detectLiftHill) */
  onLift: boolean[];
  /** per-sample INVERSION-ELEMENT mask (`inversionWindow`) — these samples'
   *  `latAccel` is reported as 0 and excluded from `worstLatAccel`; reuse it
   *  instead of recomputing (rateCoaster does) */
  inInversion: boolean[];
  /** lap time in seconds at the paced speed */
  duration: number;
}

/**
 * THE energy-paced force replay (factored out of validatePark's crash gate so
 * rateCoaster and the gate cannot drift apart). Reproduces makeGuardedRun's
 * pacing sample-for-sample: energy speed off the highest rail point, lift
 * crawl at `liftV`, the pre-station brake run, and the bank-discounted
 * effective lateral acceleration of the no-upstop derail check
 * (Vehicle.TrackMotion.cpp:58-122). Vertical G is read off the same state
 * (Vehicle.cpp:1173-1199). Pure and deterministic.
 */
export function replayCoasterForces(
  t: typeof THREE,
  points: [number, number, number][],
  opts: { bank?: number; frames?: SplineFrames; liftV?: number } = {},
): CoasterForceReplay {
  const fb = opts.frames ?? computeSplineFrames(t, points, { bank: opts.bank ?? 0.7 });
  const { frames, total, N, P } = fb;
  const ds = total / N;
  const liftV = opts.liftV ?? 1.5;
  let maxY = 0;
  for (const p of P) maxY = Math.max(maxY, p.y);
  const energy = 9.8 * (maxY + 0.55);
  const { liftStart, liftLen, onLift } = detectLiftHill(P);
  const u0 = liftLen >= 8 ? liftStart / N : 0;
  // INVERSION ELEMENTS read no lateral G (see `inversionWindow`): a vertical
  // loop's tangent sweeps through the vertical, where the HORIZONTAL curvature
  // κ_h this guard is written in terms of is a singular proxy — the heading
  // formally flips through 180° over a fraction of a unit — while the actual
  // acceleration is entirely along the car's UP axis, which `vertG` already
  // reads. RCT2 takes the same position from the other end: loop TrackElemTypes
  // carry a baked lateralFactor of zero. Nothing outside the windows changes.
  const inInversion = inversionWindow(frames, N, ds);
  const samples: CoasterForceSample[] = [];
  let worstLatAccel = 0;
  let worstLatAt = 0;
  let duration = 0;
  for (let i = 0; i < N; i += 1) {
    const a = frames[(i - 1 + N) % N].fwd;
    const b = frames[(i + 1) % N].fwd;
    const ah = Math.hypot(a.x, a.z);
    const bh = Math.hypot(b.x, b.z);
    let kH = 0;
    if (ah > 1e-3 && bh > 1e-3) {
      const dot = Math.max(-1, Math.min(1, (a.x * b.x + a.z * b.z) / (ah * bh)));
      kH = Math.acos(dot) / (2 * ds);
    }
    const f = frames[i];
    const roll = Math.abs(f.fwd.y) > 0.97 ? 0 : Math.atan2(f.side.y, f.up.y);
    let v = onLift[i] ? liftV : Math.sqrt(Math.max(1.4 * 1.4, 2 * (energy - 9.8 * f.p.y)));
    const dAhead = ((((u0 - i / N) % 1) + 1) % 1) * total; // station brake run
    if (!onLift[i] && dAhead > 0.05 && dAhead < 1.8) v = Math.min(v, 1.6);
    const latAccel = inInversion[i] ? 0 : v * v * kH * (1 - Math.min(1, Math.abs(roll) / 0.6));
    if (latAccel > worstLatAccel) {
      worstLatAccel = latAccel;
      worstLatAt = i / N;
    }
    // vertical G along the car's up axis: the gravity term (up · world-up) plus
    // the centripetal component of the curvature vector dT/ds along that axis
    const kx = (b.x - a.x) / (2 * ds);
    const ky = (b.y - a.y) / (2 * ds);
    const kz = (b.z - a.z) / (2 * ds);
    const kUp = kx * f.up.x + ky * f.up.y + kz * f.up.z;
    const vertG = f.up.y + (v * v * kUp) / 9.8;
    samples.push({ u: i / N, y: f.p.y, v, kH, roll, latAccel, vertG });
    duration += ds / Math.max(0.2, v);
  }
  return { frames: fb, samples, worstLatAccel, worstLatAt, maxY, onLift, inInversion, duration };
}

/** the RCT2 ride-window rating word for a rating, mapped onto the kit's five
 *  bands — RatingNames + GetRatingName (openrct2-ui/windows/Ride.cpp:501-509,
 *  5628-5632: index = rating >> 8, low / medium / high / very high / extreme /
 *  ultra-extreme) */
export type RatingBand = 'gentle' | 'moderate' | 'thrilling' | 'intense' | 'extreme';

const BAND_OF: RatingBand[] = ['gentle', 'moderate', 'thrilling', 'intense', 'extreme', 'extreme'];
const bandOfRating = (rating2dp: number): RatingBand =>
  BAND_OF[Math.max(0, Math.min(5, Math.floor(rating2dp / 256)))];

/** turn tally in RCT2's buckets (turn length in track ELEMENTS ≈ tiles) —
 *  Ride.cpp:4249-4328 GetTurnCount{1,2,3,4Plus}Elements */
export interface CoasterTurnCounts {
  flat: [number, number, number];
  banked: [number, number, number];
  /** sloped turns bucket 4+ separately (Ride.cpp:4312) */
  sloped: [number, number, number, number];
}

export interface CoasterRatings {
  /** RCT2 excitement rating (RideRatings.cpp) */
  excitement: number;
  /** RCT2 intensity rating */
  intensity: number;
  /** RCT2 nausea rating */
  nausea: number;
  /** peak / mean paced speed, world units per second */
  maxSpeed: number;
  avgSpeed: number;
  /** peak positive vertical G along the car's up axis */
  maxPosVertG: number;
  /** most NEGATIVE vertical G (airtime; ≤ 0 on any coaster with a crest) */
  maxNegVertG: number;
  /** worst effective lateral G — the SAME number validatePark's crash gate
   *  tests against its 1.27 g margin (1.5 g × 0.85) */
  maxLatG: number;
  /** biggest single descent, world units */
  highestDrop: number;
  /** summed descent over the lap, world units */
  totalDrop: number;
  dropCount: number;
  /** seconds of the lap ridden at vertical G ≤ 0 (Vehicle.cpp:512-515) */
  airtimeSeconds: number;
  inversions: number;
  /** circuit arc length, world units */
  length: number;
  /** lap time in seconds at the paced speed */
  duration: number;
  /** the RCT2 rating word for INTENSITY, in the kit's five bands */
  ratingBand: RatingBand;
  /** the rating word for NAUSEA (same table) */
  nauseaBand: RatingBand;
  /** nausea past the AVERAGE guest's tolerance (RideRating 8.00 —
   *  Guest.cpp:193-198 NauseaMaximumThresholds): a sick-making ride */
  nauseaExtreme: boolean;
  /** the construction-rule set the ratings table came from */
  type: CoasterType;
  /** RCT2 turn tally the BonusTurns modifier ran over */
  turns: CoasterTurnCounts;
}

/** the RatingsData block of one coaster RTD (ride/rtd/coaster/*.h) */
interface RatingsTable {
  /** RatingsData.BaseRatings */
  base: [number, number, number];
  /** BonusLength excitement multiplier (threshold 6000 length units) */
  length: number;
  /** BonusMaxSpeed [exc, int, nau] */
  maxSpeed: [number, number, number];
  /** BonusAverageSpeed [exc, int] */
  avgSpeed: [number, number];
  /** BonusGForces / PenaltyLateralGs [exc, int, nau] */
  gForces: [number, number, number];
  /** BonusTurns [exc, int, nau] */
  turns: [number, number, number];
  /** BonusDrops [exc, int, nau] */
  drops: [number, number, number];
  /** RequirementDropHeight threshold, z-steps */
  reqDropHeight: number;
  /** RequirementNegativeGs threshold, 2dp fixed */
  reqNegativeGs: number;
  /** RequirementLength threshold in length units (null = no such modifier) */
  reqLength: number | null;
  /** RequirementNumDrops threshold (null = no such modifier) */
  reqNumDrops: number | null;
  /** RatingsData.RelaxRequirementsIfInversions */
  relaxIfInversions: boolean;
}

// Ported verbatim from the RTD RatingsData blocks. Shared across all three:
// BonusTrainLength 187245, BonusMaxSpeed { 44281, 88562, 35424 },
// BonusDuration 26214 (threshold 150), RequirementMaxSpeed 0xA0000 (22.5 mph),
// RequirementNumDrops/DropHeight per type.
const RATINGS_TABLES: Record<CoasterType, RatingsTable> = {
  // ride/rtd/coaster/WoodenRollerCoaster.h:63-92
  wooden: {
    base: [320, 260, 200],
    length: 873,
    maxSpeed: [44281, 88562, 35424],
    avgSpeed: [364088, 655360],
    gForces: [40960, 34555, 49648],
    turns: [26749, 43458, 45749],
    drops: [40777, 46811, 49152],
    reqDropHeight: 12,
    reqNegativeGs: 10,
    reqLength: 0x1720000 >> 16,
    reqNumDrops: 2,
    relaxIfInversions: false,
  },
  // ride/rtd/coaster/LoopingRollerCoaster.h:64-91
  steel: {
    base: [300, 50, 20],
    length: 764,
    maxSpeed: [44281, 88562, 35424],
    avgSpeed: [291271, 436906],
    gForces: [24576, 35746, 49648],
    turns: [26749, 34767, 45749],
    drops: [29127, 46811, 49152],
    reqDropHeight: 14,
    reqNegativeGs: 10,
    reqLength: null,
    reqNumDrops: 2,
    relaxIfInversions: true,
  },
  // ride/rtd/coaster/InvertedRollerCoaster.h:65-91
  inverted: {
    base: [360, 280, 320],
    length: 764,
    maxSpeed: [44281, 88562, 35424],
    avgSpeed: [291271, 436906],
    gForces: [24576, 29789, 55606],
    turns: [26749, 29552, 57186],
    drops: [29127, 39009, 49152],
    reqDropHeight: 12,
    reqNegativeGs: 30,
    reqLength: null,
    reqNumDrops: null,
    relaxIfInversions: true,
  },
};

const TRAIN_LENGTH_BONUS = 187245; // BonusTrainLength, all coaster RTDs
const DURATION_BONUS = 26214; // BonusDuration excitement, threshold 150
const DURATION_THRESHOLD = 150;
const LENGTH_THRESHOLD = 6000; // BonusLength threshold, all coaster RTDs
const REQ_MAX_SPEED_MPH = 0xa0000 / RCT2_VELOCITY_PER_MPH; // 22.5 mph

export interface RateCoasterOpts {
  /** which RTD ratings table to use (default 'wooden' — <Coaster>'s default) */
  type?: CoasterType;
  /** bank forwarded to the replay frames — pass what you BUILT with
   *  (coasterBankCap(type, bank)) so the forces match the ride */
  bank?: number;
  /** pre-computed frames (skips the resample) */
  frames?: SplineFrames;
  /** cars per train — BonusTrainLength (default 3, <Coaster>'s default) */
  cars?: number;
  /** BonusScenery sub-score, 0-40 (default 0 — the DS has no tile scenery map) */
  sceneryScore?: number;
  /** world units per RCT2 TILE for the unit mapping (default 1 — see the
   *  header: the kit authors its pieces roughly one per tile). Raise it to read
   *  a layout as a smaller model, lower it to read it as a bigger one. */
  tileUnits?: number;
}

/**
 * RCT2-style ride ratings for a compiled spline circuit (`compileTrackPieces`
 * points, or any closed control-point list). Runs the shared energy-paced
 * force replay (`replayCoasterForces` — the SAME physics as `run()` and
 * validatePark's crash gate), measures the circuit the way OpenRCT2's ride
 * test does, then applies the type's RatingsData modifier chain from
 * RideRatings.cpp:876-1051 in order: BonusLength/TrainLength/MaxSpeed/
 * AverageSpeed/Duration/GForces/Turns/Drops, the Requirement* halvings
 * (drop height, max speed, negative Gs, length, drop count), the air-time
 * adjustment (RideRatings.cpp:1293-1310), PenaltyLateralGs
 * (RideRatings.cpp:2215-2245) and finally the universal intensity penalty
 * (RideRatings.cpp:1318-1330 — excitement loses a quarter per intensity band
 * over 10.00). See the unit-mapping header above for the world-unit → RCT2
 * conversions and `SIMPLIFIED` below for what is deliberately left out.
 *
 * SIMPLIFIED vs RideRatings.cpp: no BonusSheltered / BonusProximity (DS
 * circuits are open-air and there is no tile map to score against —
 * `sceneryScore` covers BonusScenery by hand), no BonusSynchronisation /
 * BonusReversedTrains / helices / water-splash special elements, and no
 * rideEntry excitement/intensity/nausea multipliers (those live on the vehicle
 * OBJECT, which the DS has no analogue for). Pure and deterministic.
 */
export function rateCoaster(points: [number, number, number][], opts: RateCoasterOpts = {}): CoasterRatings {
  const t = THREE; // same three namespace the bundle renders with
  const type = opts.type ?? 'wooden';
  const tab = RATINGS_TABLES[type];
  const bank = coasterBankCap(type, opts.bank);
  const rep = replayCoasterForces(t, points, { bank, frames: opts.frames });
  const { frames, total, N } = rep.frames;
  const ds = total / N;

  // ---- inversion-element windows (THE shared mask — `inversionWindow`, which
  // the replay above already computed). RCT2 corkscrews/loops are FIXED
  // multi-tile TrackElemTypes with pre-baked verticalFactor tables, not
  // free-form curves; the kit's stand-ins are real curves whose raw curvature
  // (a corkscrew barrel at R ≈ 0.6 u, a vertical loop's 0.55-u crest) would
  // read tens of g. So — exactly as checkCoasterDesign exempts these windows
  // from its slope/bank sweeps and replayCoasterForces from its lateral read —
  // samples within ~2.8 arc-units of an up-vector flip are excluded from the
  // vertical-G peak, the air-time tally and the drop scan; RCT2 pays for
  // inversions through getInversionsRatings (RideRatings.cpp:1520-1531)
  // instead, which is what runs below. SIMPLIFIED.
  const inInversion = rep.inInversion;

  // ---- measurement pass (Vehicle.cpp:470-520 UpdateMeasurements) ----------
  let maxSpeed = 0;
  let speedSum = 0;
  let maxPosVertG = 0;
  let maxNegVertG = 0;
  let airtimeSeconds = 0;
  rep.samples.forEach((s, i) => {
    if (s.v > maxSpeed) maxSpeed = s.v;
    speedSum += s.v;
    if (inInversion[i]) return;
    if (s.vertG > maxPosVertG) maxPosVertG = s.vertG;
    if (s.vertG < maxNegVertG) maxNegVertG = s.vertG;
    if (s.vertG <= 0) airtimeSeconds += ds / Math.max(0.2, s.v);
  });
  const avgSpeed = speedSum / N;
  const maxLatG = rep.worstLatAccel / 9.8;

  // ---- drops (Vehicle.cpp:658-700: a drop opens on entering DOWN track and
  // closes with |Δz| when it levels out; sub-0.12 u ripples are spline noise,
  // not RCT2 track pieces, so they are discarded again) ---------------------
  const DOWN_EPS = 0.04; // ≈2.3° — below this the spline is level track
  const MIN_DROP = 0.12;
  let dropCount = 0;
  let highestDrop = 0;
  let totalDrop = 0;
  let falling = false;
  let dropTop = 0;
  for (let k = 0; k <= N; k += 1) {
    const f = frames[k % N];
    const goingDown = f.fwd.y < -DOWN_EPS && !inInversion[k % N];
    if (!falling && goingDown) {
      falling = true;
      dropTop = f.p.y;
    } else if (falling && !goingDown) {
      falling = false;
      const d = dropTop - f.p.y;
      if (d >= MIN_DROP) {
        dropCount += 1;
        totalDrop += d;
        if (d > highestDrop) highestDrop = d;
      }
    }
  }

  // ---- inversions: maximal runs with the up-vector flipped ----------------
  let inversions = 0;
  let inverted = false;
  for (let k = 0; k <= N; k += 1) {
    const up = frames[k % N].up.y;
    if (!inverted && up < -0.3) inverted = true;
    else if (inverted && up > 0) {
      inverted = false;
      inversions += 1;
    }
  }

  // ---- turns bucketed like RCT2 (Ride.cpp:4249-4328). A turn is a maximal
  // same-signed run of curvature tight enough to be a track curve; its length
  // in track ELEMENTS is its arc length in world units (1 u = 1 tile). RCT2
  // flags a piece banked AND sloped independently; here each turn lands in
  // exactly ONE bucket, sloped taking precedence over banked (SIMPLIFIED).
  const turns: CoasterTurnCounts = { flat: [0, 0, 0], banked: [0, 0, 0], sloped: [0, 0, 0, 0] };
  const perTileT = Math.max(0.01, opts.tileUnits ?? 1);
  {
    const K_MIN = 0.12; // radius under ~8 u — anything wider is a straight
    let runLen = 0;
    let runSign = 0;
    let rollSum = 0;
    let pitchSum = 0;
    let n = 0;
    const flush = () => {
      if (!n || runLen < 0.5) {
        runLen = 0;
        runSign = 0;
        rollSum = 0;
        pitchSum = 0;
        n = 0;
        return;
      }
      const elements = Math.max(1, Math.round(runLen / perTileT));
      const sloped = pitchSum / n > 0.17; // ≈10° mean pitch
      const banked = rollSum / n > 0.09; // ≈5° mean bank
      if (sloped) turns.sloped[Math.min(4, elements) - 1] += 1;
      else {
        const bucket = Math.min(3, elements) - 1;
        (banked ? turns.banked : turns.flat)[bucket] += 1;
      }
      runLen = 0;
      runSign = 0;
      rollSum = 0;
      pitchSum = 0;
      n = 0;
    };
    for (let k = 0; k <= N; k += 1) {
      const i = k % N;
      const s = rep.samples[i];
      const f = frames[i];
      // signed turn direction from the horizontal cross product of neighbours
      const a = frames[(i - 1 + N) % N].fwd;
      const b = frames[(i + 1) % N].fwd;
      const sign = Math.sign(a.z * b.x - a.x * b.z) || runSign;
      if (s.kH >= K_MIN && (runSign === 0 || sign === runSign)) {
        runSign = sign;
        runLen += ds;
        rollSum += Math.abs(s.roll);
        pitchSum += Math.abs(f.fwd.y);
        n += 1;
      } else if (s.kH >= K_MIN) {
        flush(); // curvature reversed — a new turn starts here
        runSign = sign;
        runLen = ds;
        rollSum = Math.abs(s.roll);
        pitchSum = Math.abs(f.fwd.y);
        n = 1;
      } else flush();
    }
    flush();
  }

  // ---- RCT2 units --------------------------------------------------------
  const perTile = Math.max(0.01, opts.tileUnits ?? 1);
  const rctLength = Math.round((total / perTile) * RCT2_LENGTH_PER_TILE);
  const maxMph = (maxSpeed / perTile) * RCT2_MPH_PER_TILE_PER_SEC;
  const avgMph = (avgSpeed / perTile) * RCT2_MPH_PER_TILE_PER_SEC;
  const maxSpeedMod = Math.floor((maxMph * 4) / 9); // ride.maxSpeed >> 16
  const avgSpeedMod = Math.floor((avgMph * 4) / 9);
  const rctDropHeight = Math.floor((highestDrop / perTile) * RCT2_ZSTEPS_PER_TILE);
  const rctDuration = Math.round(rep.duration / RCT2_SEC_PER_DURATION);
  const airTimeTicks = Math.round(airtimeSeconds * RCT2_TICKS_PER_SEC);
  const posG = Math.round(maxPosVertG * 100); // fixed16_2dp
  const negG = Math.round(maxNegVertG * 100);
  const latG = Math.round(maxLatG * 100);

  // ---- the modifier chain (RideRatings.cpp:876-1051) ---------------------
  const S16 = 32767;
  let exc = tab.base[0];
  let inten = tab.base[1];
  let naus = tab.base[2];
  /** RideRatingsAdd — overflow-protected add (RideRatings.cpp:1815-1823) */
  const add = (de: number, di: number, dn: number) => {
    exc = Math.max(0, Math.min(S16, exc + de));
    inten = Math.max(0, Math.min(S16, inten + di));
    naus = Math.max(0, Math.min(S16, naus + dn));
  };
  const sh = (x: number, m: number) => (x * m) >> 16;

  // BonusLength / BonusTrainLength / BonusMaxSpeed / BonusAverageSpeed / BonusDuration
  add(sh(Math.min(rctLength, LENGTH_THRESHOLD), tab.length), 0, 0);
  add(sh(Math.max(0, (opts.cars ?? 3) - 1), TRAIN_LENGTH_BONUS), 0, 0);
  add(sh(maxSpeedMod, tab.maxSpeed[0]), sh(maxSpeedMod, tab.maxSpeed[1]), sh(maxSpeedMod, tab.maxSpeed[2]));
  add(sh(avgSpeedMod, tab.avgSpeed[0]), sh(avgSpeedMod, tab.avgSpeed[1]), 0);
  add(sh(Math.min(rctDuration, DURATION_THRESHOLD), DURATION_BONUS), 0, 0);

  // BonusGForces — ride_ratings_get_gforce_ratings (RideRatings.cpp:1675-1715)
  const gforceSub = (): [number, number, number] => {
    let e = sh(posG, 5242);
    let i = sh(posG, 52428);
    let n = sh(posG, 17039);
    e += sh(Math.max(-250, Math.min(0, negG)), -15728);
    i += sh(negG - 100, -52428);
    n += sh(negG - 100, -14563);
    e += sh(Math.min(150, latG), 26214);
    i += latG;
    n += sh(latG, 21845);
    return [e, i, n];
  };
  {
    const [e, i, n] = gforceSub();
    add(sh(e, tab.gForces[0]), sh(i, tab.gForces[1]), sh(n, tab.gForces[2]));
  }

  // BonusTurns — ride_ratings_get_turns_ratings (RideRatings.cpp:1598-1630):
  // flat + banked + sloped turn ratings + the inversions rating
  {
    const [f1, f2, f3] = turns.flat;
    const [b1, b2, b3] = turns.banked;
    const [s1, s2, s3, s4] = turns.sloped;
    let e = sh(f3, 0x28000) + sh(f2, 0x30000) + sh(f1, 63421); // get_flat_turns_rating
    let i = sh(f3, 81920) + sh(f2, 49152) + sh(f1, 21140);
    let n = sh(f3, 0x50000) + sh(f2, 0x32000) + sh(f1, 42281);
    e += sh(b3, 0x3c000) + sh(b2, 0x3c000) + sh(b1, 73992); // get_banked_turns_rating
    i += sh(b3, 0x14000) + sh(b2, 49152) + sh(b1, 21140);
    n += sh(b3, 0x50000) + sh(b2, 0x32000) + sh(b1, 48623);
    e += sh(Math.min(s4, 4), 0x78000) + sh(Math.min(s3, 6), 273066); // get_sloped_turns_rating
    e += sh(Math.min(s2, 6), 0x3aaaa) + sh(Math.min(s1, 7), 187245);
    n += sh(Math.min(s4, 8), 0x78000);
    e += sh(Math.min(inversions, 6), 0x1aaaaa); // getInversionsRatings
    i += sh(inversions, 0x320000);
    n += sh(inversions, 0x15aaaa);
    add(sh(e, tab.turns[0]), sh(i, tab.turns[1]), sh(n, tab.turns[2]));
  }

  // BonusDrops — ride_ratings_get_drop_ratings (RideRatings.cpp:1721-1740)
  {
    let e = sh(Math.min(9, dropCount), 728177);
    let i = sh(dropCount, 928426);
    let n = sh(dropCount, 655360);
    e += sh(rctDropHeight * 2, 16000);
    i += sh(rctDropHeight * 2, 32000);
    n += sh(rctDropHeight * 2, 10240);
    add(sh(e, tab.drops[0]), sh(i, tab.drops[1]), sh(n, tab.drops[2]));
  }

  // BonusScenery (RideRatings.cpp:2085-2088) — hand-fed, 0 by default
  if (opts.sceneryScore) add(sh(Math.max(0, Math.min(40, opts.sceneryScore)), type === 'wooden' ? 11155 : 6693), 0, 0);

  // Requirement* halvings (RideRatings.cpp:2091-2140). RelaxRequirementsIfInversions
  // exempts the drop-height / drop-count / negative-G gates on inverting layouts.
  const halve = () => {
    exc = Math.floor(exc / 2);
    inten = Math.floor(inten / 2);
    naus = Math.floor(naus / 2);
  };
  if (tab.reqLength !== null && rctLength < tab.reqLength) halve();
  if (maxMph < REQ_MAX_SPEED_MPH) halve();
  if (!(inversions > 0 && tab.relaxIfInversions)) {
    if (rctDropHeight < tab.reqDropHeight) halve();
    if (tab.reqNumDrops !== null && dropCount < tab.reqNumDrops) halve();
    if (negG >= tab.reqNegativeGs) halve(); // no airtime at all
  }

  // PenaltyLateralGs — ride_ratings_get_excessive_lateral_g_penalty
  // (RideRatings.cpp:2215-2245). Unreachable in practice: validatePark fails
  // any circuit past 1.27 g, but a hand-built layout can still get here.
  if (latG > 280) {
    let pe = 0;
    let pi = 375;
    let pn = 200;
    if (latG > 310) {
      pe = sh(posG, 5242) + sh(Math.max(-250, Math.min(0, negG)), -15728) + sh(Math.min(150, latG), 26214);
      pe = -Math.floor(pe / 2);
      pi = 1225;
      pn = 600;
    }
    add(sh(pe, tab.gForces[0]), sh(pi, tab.gForces[1]), sh(pn, tab.gForces[2]));
  }

  // air-time adjustment (RideRatings.cpp:1293-1310, RtdFlag::hasAirTime)
  add(Math.floor(Math.min(airTimeTicks, 200) / 8), 0, Math.floor(airTimeTicks / 16));

  // universal intensity penalty (RideRatings.cpp:1318-1330)
  for (const bound of [1000, 1100, 1200, 1320, 1450]) if (inten >= bound) exc -= Math.floor(exc / 4);
  exc = Math.max(0, exc);

  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    excitement: r2(exc / 100),
    intensity: r2(inten / 100),
    nausea: r2(naus / 100),
    maxSpeed: r2(maxSpeed),
    avgSpeed: r2(avgSpeed),
    maxPosVertG: r2(maxPosVertG),
    maxNegVertG: r2(maxNegVertG),
    maxLatG: r2(maxLatG),
    highestDrop: r2(highestDrop),
    totalDrop: r2(totalDrop),
    dropCount,
    airtimeSeconds: r2(airtimeSeconds),
    inversions,
    length: r2(total),
    duration: r2(rep.duration),
    ratingBand: bandOfRating(inten),
    nauseaBand: bandOfRating(naus),
    nauseaExtreme: naus >= 800,
    type,
    turns,
  };
}

