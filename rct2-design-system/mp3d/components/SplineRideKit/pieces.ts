// ---------------------------------------------------------------------------
// SplineRideKit / pieces.ts — the RCT2 TRACK-PIECE COMPILER.
// Split out of ./index.tsx for file size only; index.tsx re-exports every
// public name here, so the kit's import surface is unchanged.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { computeSplineFrames } from '../SplineCoaster';
import {
  CoasterDesignReport,
  CoasterType,
  DEG,
  RideProfile,
  SplineValidation,
  TYPE_RULES,
  checkCoasterDesign,
  coasterBankCap,
  rampPoints,
  validateSpline,
} from './design';

// ---------------------------------------------------------------------------
// TRACK-PIECE COMPILER — RCT2 authors coasters from a fixed vocabulary of
// track PIECES, never freeform curves. compileTrackPieces walks a heading +
// position cursor through a piece list — a SUPERSET of TrackKit's grid
// vocabulary with smooth-spline semantics: lifts/drops are rampPoints-eased
// climbs that obey the pitchRate rule BY CONSTRUCTION, turns/helixes are
// chorded arcs, corkscrews real inverting barrels — and emits control points
// ready for buildRideSpline / <Coaster> / <TrackRide>. The cursor finishes
// wherever the pieces leave it, so the compiler then CLOSES the circuit
// legally (RCT2 refuses to open an unclosed circuit — Ride.cpp:5648): first
// an eased ramp back to station height along the current heading, then the
// shortest Dubins arc–straight–arc path (turn radius 1.5) onto the start
// point and heading. checkCoasterDesign + validateSpline always run on the
// result; both land in `report`, with closure details and warnings.
// ---------------------------------------------------------------------------

export type TrackPieceType =
  | 'station'   // flat straight that marks boarding (put it FIRST)
  | 'flat'      // alias of 'straight'
  | 'straight'  // level run (length)
  | 'lift'      // eased climb (height, optional length) — rampPoints grammar
  | 'drop'      // eased descent (height defaults to "back to station level")
  | 'hill'      // camelback bump (height, length) — starts and ends level
  | 'turnL' | 'turnR'   // flat arc (angle in degrees, default 90; radius 1.5)
  | 'helixL' | 'helixR' // long arc with an eased elevation change (angle 360, height)
  | 'corkscrewL' | 'corkscrewR' // inverting barrel — STEEL coasters only
  | 'loop' | 'loopL' | 'loopR' // 360° VERTICAL LOOP — STEEL coasters only ('loop' = 'loopR')
  | 'sbend';    // lateral shift, heading preserved (length; radius = offset)

export interface TrackPieceDef {
  type: TrackPieceType;
  /** straight/hill/sbend run; lift/drop horizontal run override;
   *  loop forward advance (default 1.57·radius) */
  length?: number;
  /** lift/drop/hill/helix elevation change (drop default: back to station level);
   *  loop TOTAL height (an alternative spelling of 2·radius) */
  height?: number;
  /** turn/helix radius (default 1.5); sbend lateral offset (default 1.2, +ve left);
   *  corkscrew barrel radius; loop HALF-HEIGHT (default 1.1, clamped 0.7-1.35) */
  radius?: number;
  /** turn/helix sweep in DEGREES (turn default 90, helix default 360) */
  angle?: number;
  /** loop: the LATERAL step the element makes (magnitude; default 1.2 = one
   *  RCT2 tile, floored at 1.0). Direction comes from the piece name
   *  (`loopL` steps left, `loop`/`loopR` step right). This is what keeps the
   *  two legs apart where they cross under the loop — see the `vloop` note. */
  offset?: number;
}

/** a piece is its bare name (all defaults) or a parameterised descriptor */
export type TrackPiece = TrackPieceType | TrackPieceDef;

export interface TrackClosure {
  /** true when the synthesized return path lands on the start point+heading */
  closed: boolean;
  /** residual 3D gap to the start after closure (should be ~0) */
  gap: number;
  /** human-readable list of the auto-synthesized closing pieces */
  synthesized: string[];
}

/** ONE compiled `station` piece — its deck, in the compiled world frame.
 *
 *  A tracked ride may declare SEVERAL. That is not a liberty: an RCT2 `Ride`
 *  owns a whole ARRAY of stations
 *  (`std::array<RideStation, Limits::kMaxStationsPerRide> stations`,
 *  ride/Ride.h:404, `kMaxStationsPerRide = 255`, Limits.h:19 — the legacy
 *  RCT1/RCT2 save format caps it at 4, rct12/Limits.h:21), and the transport
 *  rides are exactly why: `ride/rtd/transport/Monorail.h:19-84` sets neither
 *  `RtdFlag::hasOneStation` nor `hasSinglePieceStation`, so a monorail's
 *  station count is unlimited. Only GoKarts and MiniGolf carry `hasOneStation`
 *  (ride/RideData.h:437, enforced ride/Ride.cpp:2333-2334).
 */
export interface TrackStationPose {
  /** RCT2 StationIndex — the order the train visits them in */
  idx: number;
  /** the piece index in the authored list */
  piece: number;
  /** deck START (where the train enters the platform) */
  start: [number, number, number];
  /** deck CENTRE — the boarding anchor */
  center: [number, number, number];
  /** deck END (where the train leaves) */
  end: [number, number, number];
  /** deck length along the heading */
  length: number;
  /** heading yaw in radians (0 = +z), constant across a station (it is flat) */
  yaw: number;
  /** unit xz heading, and the unit LEFT normal — the two axes a caller needs to
   *  place a platform, a queue and an exit beside the deck */
  dir: [number, number];
  left: [number, number];
}

export interface TrackPieceReport {
  /** valid.ok && closure.closed && (coaster profile: design.ok) && !fatal */
  ok: boolean;
  /** RCT2 construction-rule report (informational for water/monorail profiles) */
  design: CoasterDesignReport;
  /** clearance / self-intersection report */
  valid: SplineValidation;
  closure: TrackClosure;
  /** every compiled `station` piece, in visit order (see TrackStationPose).
   *  Length 1 for an ordinary ride; a multi-station transport circuit lists
   *  each platform so the consumer can register one GameManager station per
   *  deck instead of guessing where the platforms are. */
  stations: TrackStationPose[];
  warnings: string[];
  /** FATAL guard: set when the checks fail, the synthesized closure exceeds
   *  40% of the authored arc length, or (with `opts.bounds`) the track leaves
   *  the park. Consumers (<Coaster>/<TrackRide>) must NOT register a fatal
   *  ride with the GameManager — they render it as a translucent red
   *  "invalid" track instead. */
  fatal?: boolean;
  /** human-readable reason `fatal` was set */
  fatalReason?: string;
}

export interface CompiledTrackPieces {
  /** control points for buildRideSpline / computeSplineFrames (closed loop) */
  points: [number, number, number][];
  report: TrackPieceReport;
}

export interface CompileTrackOpts {
  /** semantics + design-check defaults (default 'coaster'; 'monorail' allowed) */
  profile?: RideProfile | 'monorail';
  /** coaster rule set — gates corkscrews (default: coaster/bobsled 'steel', else 'wooden') */
  type?: CoasterType;
  /** cursor origin (default [0, 0.55, 0] — station rail height above local ground) */
  start?: [number, number, number];
  /** initial heading yaw in radians, 0 = +z (default 0) */
  heading?: number;
  /** bank forwarded to the design-check frames — match your buildRideSpline call */
  bank?: number;
  /** park bounds guard: the terrain edge length (points must stay within
   *  ±size/2 + margin) or `{ half, margin? }`. Points that leave the bounds
   *  set `report.fatal`. <Coaster>/<TrackRide> pass the park size for you.
   *  NOTE: closure-synthesized pieces COUNT toward the bounds — the Dubins
   *  return arcs sweep up to ~2·2.2 u past the cursor, so end the authored
   *  layout slightly SHORT of the start (~0.3 u) rather than past it. */
  bounds?: number | { half: number; margin?: number };
}

const TURN_RADIUS = 1.5;
const mod2pi = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

/**
 * Compile a track-piece list into spline control points + a full legality
 * report. Vocabulary above (TrackPieceType); every piece starts and ends
 * LEVEL (like RCT2's transition grammar), so pieces chain freely. Corkscrews
 * warn on non-steel coasters (TRACK_WHITELIST semantics — the piece still
 * compiles so the author can see it) and are replaced by an sbend on water/
 * monorail profiles (an inverted water channel cannot exist). The circuit is
 * auto-closed: eased ramp to station height, then the shortest Dubins
 * arc–straight–arc back to the start pose; the closure is reported (and
 * warned about when it had to synthesize a suspiciously long return leg).
 * The synthesized closure pieces COUNT toward `opts.bounds` — land the last
 * authored piece ~0.3 u short of the start so the return arcs stay inside.
 * Coaster banking saturates at the type's bankLimit (coasterBankCap).
 * Pure and deterministic.
 */
export function compileTrackPieces(pieces: TrackPiece[], opts: CompileTrackOpts = {}): CompiledTrackPieces {
  const t = THREE; // same three namespace the bundle renders with
  const profile = opts.profile ?? 'coaster';
  const type: CoasterType = opts.type ?? (profile === 'coaster' || profile === 'bobsled' ? 'steel' : 'wooden');
  const warnings: string[] = [];
  const warn = (m: string) => {
    warnings.push(m);
    console.warn(`SplineRideKit: ${m}`);
  };
  const start: [number, number, number] = opts.start ?? [0, 0.55, 0];
  const startYaw = opts.heading ?? 0;
  const baseY = start[1];
  let yaw = startYaw;
  const pos = { x: start[0], y: start[1], z: start[2] };
  const points: [number, number, number][] = [[pos.x, pos.y, pos.z]];
  const emit = (x: number, y: number, z: number) => {
    const [lx, ly, lz] = points[points.length - 1];
    if (Math.hypot(x - lx, y - ly, z - lz) < 0.12) return; // dedupe — centripetal CR dislikes coincident points
    points.push([x, y, z]);
  };
  const setPosToLast = () => {
    const lp = points[points.length - 1];
    pos.x = lp[0];
    pos.y = lp[1];
    pos.z = lp[2];
  };
  const dir = () => [Math.sin(yaw), Math.cos(yaw)] as [number, number];

  /** level straight run along the heading */
  const straight = (len: number) => {
    const [dx, dz] = dir();
    if (len > 2.4) emit(pos.x + dx * len * 0.5, pos.y, pos.z + dz * len * 0.5);
    emit(pos.x + dx * len, pos.y, pos.z + dz * len);
    pos.x += dx * len;
    pos.z += dz * len;
  };
  /** eased RCT2 ramp via rampPoints (auto-extends its run for legality) */
  const ramp = (rise: number, run?: number) => {
    const [dx, dz] = dir();
    const r = Math.max(run ?? 0, 2.2, 1.9 * Math.abs(rise));
    const pts = rampPoints([pos.x, pos.y, pos.z], [dx, dz], { run: r, rise });
    for (const p of pts) emit(p[0], p[1], p[2]);
    const last = pts[pts.length - 1];
    pos.x = last[0];
    pos.y = last[1];
    pos.z = last[2];
  };
  /** chorded arc; s=+1 turns like TrackKit's turnL, dy is an eased total rise */
  const arc = (s: 1 | -1, angleRad: number, R: number, dy = 0) => {
    // turn centre on the inside of the turn (TrackKit convention): heading
    // (sin yaw, 0, cos yaw) has its turnL centre at +(cos yaw, 0, -sin yaw)
    const cx = pos.x + s * R * Math.cos(yaw);
    const cz = pos.z - s * R * Math.sin(yaw);
    const relX = pos.x - cx;
    const relZ = pos.z - cz;
    const y0 = pos.y;
    const steps = Math.max(2, Math.ceil(angleRad / (Math.PI / 6))); // ≤30° chords
    for (let k = 1; k <= steps; k++) {
      const a = s * (k / steps) * angleRad;
      const rx = relX * Math.cos(a) + relZ * Math.sin(a); // rotate about +Y
      const rz = -relX * Math.sin(a) + relZ * Math.cos(a);
      // eased elevation along the arc (smooth cosine — level entry and exit)
      const f = k / steps;
      emit(cx + rx, y0 + dy * 0.5 * (1 - Math.cos(Math.PI * f)), cz + rz);
    }
    yaw += s * angleRad;
    pos.x = cx + relX * Math.cos(s * angleRad) + relZ * Math.sin(s * angleRad);
    pos.z = cz - relX * Math.sin(s * angleRad) + relZ * Math.cos(s * angleRad);
    pos.y = y0 + dy;
  };
  /** lateral S-shift (level, heading preserved) */
  const sbend = (len: number, off: number) => {
    const [dx, dz] = dir();
    const lx = Math.cos(yaw); // left normal (matches the arc-centre convention)
    const lz = -Math.sin(yaw);
    for (let k = 1; k <= 4; k++) {
      const f = k / 4;
      const o = off * 0.5 * (1 - Math.cos(Math.PI * f)); // parallel entry/exit
      emit(pos.x + dx * len * f + lx * o, pos.y, pos.z + dz * len * f + lz * o);
    }
    pos.x += dx * len + lx * off;
    pos.z += dz * len + lz * off;
  };
  /** inverting corkscrew: one full loop of radius R lying in a PLANE that
   *  contains the heading, leaned s·20° off vertical (the classic inclined
   *  corkscrew loop), stretched forward by the net advance L so the entry
   *  and exit legs pass well clear of each other at the base. Because the
   *  element is exactly planar, parallel transport carries ZERO residual
   *  twist around the rest of the circuit (a non-planar barrel pollutes
   *  every other frame with distributed holonomy) — the frame flips through
   *  the top and comes back clean. Cursor: +L along the heading, level. */
  const corkscrew = (s: 1 | -1, R: number, L: number) => {
    const [dx, dz] = dir();
    const lx = Math.cos(yaw); // left normal
    const lz = -Math.sin(yaw);
    const LEAN = 0.35; // ~20° off vertical
    const ny = Math.cos(LEAN);
    const nl = Math.sin(LEAN) * s;
    const y0 = pos.y;
    for (let k = 1; k <= 10; k++) {
      const f = k / 10;
      const along = L * f + R * Math.sin(2 * Math.PI * f);
      const lift = R * (1 - Math.cos(2 * Math.PI * f));
      emit(pos.x + dx * along + lx * nl * lift, y0 + ny * lift, pos.z + dz * along + lz * nl * lift);
    }
    pos.x += dx * L;
    pos.z += dz * L;
    pos.y = y0;
  };
  /**
   * RCT2 VERTICAL LOOP — the signature steel inversion
   * (TrackElemType::LeftVerticalLoop / RightVerticalLoop). A CLOTHOID TEARDROP
   * in the vertical plane that contains the heading: the local radius eases
   * from `Rb` at the bottom to `Rt` at the top,
   *
   *     r(ψ) = A + B·cos ψ,   A = (Rb+Rt)/2 = R,   B = (Rb−Rt)/2 = L/π,
   *     along(ψ) = A·sin ψ + B·(ψ/2 + sin 2ψ/4),
   *     lift(ψ)  = A·(1 − cos ψ) + B·sin²ψ/2,        ψ: 0 → 2π
   *
   * so the element ENTERS and EXITS level and heading-preserving, tops out at
   * exactly 2R, and advances L along the heading — a real loop's wide bottom
   * (soaking the post-drop speed) and tight top (keeping the crest G positive
   * at a much lower speed), not a circle.
   *
   * THE LATERAL STEP IS NOT DECORATION. A PLANAR vertical loop is impossible
   * to build here and impossible in steel: a plane curve that leaves and
   * re-joins the same level with its tangent turned through a full 2π MUST
   * cross itself (Whitney), so its two legs meet at ZERO clearance under the
   * loop and `validateSpline`'s 0.9-unit gate can never pass. Real coasters
   * and RCT2 both answer it the same way — the loop is slightly HELICAL and
   * exits one tile to the SIDE, which is exactly why the game's piece table
   * has a LEFT and a RIGHT vertical loop rather than one symmetric element.
   * The step is applied as a smoothstep in ψ (zero lateral velocity at both
   * ends, so the heading really is preserved), and because the legs cross
   * DOWN AT THE BOTTOM — ψ ≈ 0.48 and 2π − 0.48, where the smoothstep is at
   * 0.02 and 0.98 — they separate by ~0.96·D, i.e. essentially the whole step.
   *
   * SIZE: RCT2's own vertical loop is a THREE-TILE element (3 × 1.2 = 3.6
   * units tall, R = 1.8) — that is the default here, and R is allowed up to
   * 2.6 (a 5.2-unit loop). It used to be clamped at 1.35, which was never a
   * geometric limit but a limit of the RULER: `checkCoasterDesign` exempted
   * samples within a FIXED 2.8 arc-units of an up-vector flip, while the arc
   * from a loop's level entry to its first inverted sample is πR/2 + L/π =
   * 2.07·R at the default teardrop ratio, so anything bigger pushed its own
   * lead-in outside the exemption and failed the pitchRate sweep. The window
   * is now element-sized (see `inversionWindow`) and the real ceiling is its
   * 6-unit growth cap, i.e. R ≤ 2.9; 2.6 leaves margin. What actually sizes a
   * loop now is the RIDE: crest G ≈ 4·Δh/R − 1 for a drop Δh from the lift
   * crest to the loop's top, so a bigger loop wants a taller lift to stay
   * pressed into the rails, and too tall a lift reads tens of g.
   *
   * Cursor: +L along the heading, ±D across it, level, heading unchanged.
   */
  const vloop = (s: 1 | -1, R: number, L: number, D: number) => {
    const [dx, dz] = dir();
    const lx = Math.cos(yaw); // left normal (matches the arc-centre convention)
    const lz = -Math.sin(yaw);
    const A = R;
    const B = L / Math.PI;
    const y0 = pos.y;
    const STEPS = 24; // ≥ 0.14 u of arc per point at the tight top — clear of emit()'s 0.12 dedupe
    for (let k = 1; k <= STEPS; k++) {
      const f = k / STEPS;
      const psi = 2 * Math.PI * f;
      const along = A * Math.sin(psi) + B * (psi / 2 + Math.sin(2 * psi) / 4);
      const lift = A * (1 - Math.cos(psi)) + (B * Math.sin(psi) * Math.sin(psi)) / 2;
      // the lateral step is spread by ARC LENGTH, not by ψ. σ = (Aψ + B·sinψ)/2πA
      // is the fraction of the loop's arc travelled; a smoothstep in ψ would
      // dump most of the sideways motion into the CREST, where the arc per
      // radian is shortest (r = Rt), tilting the track ~27° out of plane right
      // where it is tightest and rolling the parallel-transport frame ~43° off
      // upside-down at the top. In σ the out-of-plane angle peaks at ~15°.
      const sig = psi / (2 * Math.PI) + (B * Math.sin(psi)) / (2 * Math.PI * A);
      const lat = s * D * sig * sig * (3 - 2 * sig); // smoothstep: level, straight entry AND exit
      emit(pos.x + dx * along + lx * lat, y0 + lift, pos.z + dz * along + lz * lat);
    }
    pos.x += dx * L + lx * s * D;
    pos.z += dz * L + lz * s * D;
    pos.y = y0;
  };

  // ---- walk the pieces ----
  /** every compiled `station` deck, in visit order (report.stations) */
  const stations: TrackStationPose[] = [];
  const defs: TrackPieceDef[] = pieces.map((p) => (typeof p === 'string' ? { type: p } : p));
  const corkscrewOk = profile === 'coaster' && TYPE_RULES[type].inversions;
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    switch (d.type) {
      case 'station': {
        // MULTIPLE STATIONS are legal on a TRANSPORT profile and on nothing
        // else. RCT2 gives every ride an ARRAY of stations (ride/Ride.h:404)
        // but flags the ones that may only have one — `RtdFlag::hasOneStation`
        // (ride/RideData.h:437) on GoKarts/MiniGolf, `hasSinglePieceStation`
        // (:342) on flat rides — while the monorail RTD
        // (ride/rtd/transport/Monorail.h:19-84) sets NEITHER, so its station
        // count is capped only by `kMaxStationsPerRide`. Piece 0 must still be
        // a station on every profile: the boarding deck IS frame 0.
        if (i !== 0 && profile !== 'monorail')
          warn(`'station' (piece ${i}) is not the first piece — boarding decks assume frame 0 is the station`);
        if (i !== 0 && stations.length >= 4)
          warn(
            `'station' (piece ${i}) is the ${stations.length + 1}th platform — the RCT1/RCT2 SAVE FORMAT caps a ride at 4 (RCT12::Limits::kMaxStationsPerRide, rct12/Limits.h:21; OpenRCT2 itself allows 255, Limits.h:19). Keep a park-spanning monorail to 4 platforms so it stays representable`,
          );
        const len = d.length ?? 2.6;
        const [dx, dz] = dir();
        const [lnx, lnz] = [Math.cos(yaw), -Math.sin(yaw)]; // LEFT normal
        stations.push({
          idx: stations.length,
          piece: i,
          start: [pos.x, pos.y, pos.z],
          center: [pos.x + dx * len * 0.5, pos.y, pos.z + dz * len * 0.5],
          end: [pos.x + dx * len, pos.y, pos.z + dz * len],
          length: len,
          yaw,
          dir: [dx, dz],
          left: [lnx, lnz],
        });
        emit(pos.x + dx * len * 0.5, pos.y, pos.z + dz * len * 0.5);
        emit(pos.x + dx * len, pos.y, pos.z + dz * len);
        pos.x += dx * len;
        pos.z += dz * len;
        break;
      }
      case 'flat':
      case 'straight':
        straight(d.length ?? 1.3);
        break;
      case 'lift':
        ramp(Math.abs(d.height ?? 1.5), d.length);
        break;
      case 'drop': {
        const fall = d.height ?? Math.max(0.55, pos.y - baseY);
        ramp(-Math.abs(fall), d.length);
        break;
      }
      case 'hill': {
        const h = Math.abs(d.height ?? 0.9);
        // camelback y = h/2·(1 − cos 2πf): level entry/exit; L keeps the max
        // slope (hπ/L) under 60° and the pitch rate (2π²h/L²) under the rule
        const L = Math.max(d.length ?? 0, 3.6, 6.3 * Math.sqrt(h));
        const [dx, dz] = dir();
        const steps = Math.max(6, Math.round(L / 0.9));
        const y0 = pos.y;
        for (let k = 1; k <= steps; k++) {
          const f = k / steps;
          emit(pos.x + dx * L * f, y0 + h * 0.5 * (1 - Math.cos(2 * Math.PI * f)), pos.z + dz * L * f);
        }
        pos.x += dx * L;
        pos.z += dz * L;
        pos.y = y0;
        break;
      }
      case 'turnL':
      case 'turnR': {
        const R = Math.max(0.8, d.radius ?? TURN_RADIUS);
        if ((d.radius ?? TURN_RADIUS) < 0.8) warn(`turn radius ${d.radius} clamped to 0.8 (piece ${i}) — tighter arcs kink the spline`);
        arc(d.type === 'turnL' ? 1 : -1, Math.abs(d.angle ?? 90) * DEG, R);
        break;
      }
      case 'helixL':
      case 'helixR':
        arc(d.type === 'helixL' ? 1 : -1, Math.abs(d.angle ?? 360) * DEG, Math.max(1.0, d.radius ?? TURN_RADIUS), d.height ?? 0);
        break;
      case 'corkscrewL':
      case 'corkscrewR': {
        if (profile !== 'coaster' && profile !== 'bobsled') {
          warn(`'${d.type}' (piece ${i}) replaced by an sbend — a ${profile} channel cannot invert`);
          sbend(3.6, (d.type === 'corkscrewL' ? 1 : -1) * 1.2);
          break;
        }
        if (!corkscrewOk) warn(`'${d.type}' (piece ${i}) is not in the ${type} coaster whitelist — RCT2's ${type} track table has no corkscrew group (WoodenRollerCoaster.h:26,85)`);
        {
          // R:L = 1:4 keeps the base pass over the 0.9 clearance AND the loop
          // tight enough to genuinely invert under the spline smoothing
          // (verified numerically: R 0.5–0.7 flips to up.y ≤ −0.8, worst
          // clearance ≥ 0.98; larger radii need more advance than they get)
          const R = Math.min(0.7, Math.max(0.45, d.radius ?? 0.6));
          const L = Math.max(d.length ?? 4 * R, 4 * R);
          corkscrew(d.type === 'corkscrewL' ? 1 : -1, R, L);
        }
        break;
      }
      case 'loop':
      case 'loopL':
      case 'loopR': {
        const side: 1 | -1 = d.type === 'loopL' ? 1 : -1; // 'loop' === 'loopR' (RCT2's default hand)
        if (profile !== 'coaster' && profile !== 'bobsled') {
          warn(`'${d.type}' (piece ${i}) replaced by an sbend — a ${profile} channel cannot invert`);
          sbend(3.6, side * 1.2);
          break;
        }
        if (!corkscrewOk)
          warn(
            `'${d.type}' (piece ${i}) is not in the ${type} coaster whitelist — RCT2's ${type} track table has no vertical-loop group (WoodenRollerCoaster.h:26,85)`,
          );
        {
          // R is the loop's HALF-HEIGHT; the default 1.8 IS RCT2's three-tile
          // vertical loop and 2.6 is the ceiling the element-sized inversion
          // window can carry (see `vloop`).
          const rReq = d.height !== undefined ? Math.abs(d.height) / 2 : (d.radius ?? 1.8);
          const R = Math.min(2.6, Math.max(0.7, rReq));
          if (rReq > 2.6 + 1e-6)
            warn(
              `'${d.type}' (piece ${i}) radius ${rReq.toFixed(2)} clamped to 2.6 — a loop's lead-in arc is 2.07·R and checkCoasterDesign's inversion-element window stops growing at 6 units, so past ~2.9 the element fails its own pitchRate sweep`,
            );
          if (rReq < 0.7 - 1e-6) warn(`'${d.type}' (piece ${i}) radius ${rReq.toFixed(2)} clamped to 0.7 — tighter loops read tens of g at the crest`);
          // forward advance: default 1.571·R (bottom radius 1.5·R, top 0.5·R —
          // the classic teardrop). Held inside [0.79·R, 2.07·R] so the top
          // radius stays in [0.34·R, 0.75·R] (tighter cusps at the crest,
          // wider and it stops inverting cleanly).
          const L = Math.min(2.07 * R, Math.max(0.79 * R, d.length ?? 1.571 * R));
          // the lateral step: floored at 1.0 so the legs clear validateSpline's
          // 0.9 gate where they cross under the loop (~0.96·D there)
          const D = Math.max(1.0, Math.abs(d.offset ?? 1.2));
          if (d.offset !== undefined && Math.abs(d.offset) < 1.0)
            warn(
              `'${d.type}' (piece ${i}) offset ${d.offset} raised to 1.0 — the loop's two legs cross under it and separate by only ~0.96× the lateral step, so anything under 1.0 breaks validateSpline's 0.9 clearance gate`,
            );
          if (d.angle !== undefined)
            warn(
              `'${d.type}' (piece ${i}) ignores 'angle' — a vertical loop is a FIXED 360° element (RCT2 has no partial-loop TrackElemType) and a partial one could not end level and upright, which every piece in this vocabulary must`,
            );
          vloop(side, R, L, D);
        }
        break;
      }
      case 'sbend':
        sbend(Math.max(2.4, d.length ?? 3.6), d.radius ?? 1.2);
        break;
      default:
        warn(`unknown piece '${(d as { type: string }).type}' (piece ${i}) skipped`);
    }
  }
  setPosToLast();

  // ---- close the circuit ----
  const synthesized: string[] = [];
  let authoredLen = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, az] = points[i - 1];
    const [bx, by, bz] = points[i];
    authoredLen += Math.hypot(bx - ax, by - ay, bz - az);
  }
  const yawGapNow = () => Math.abs(mod2pi(yaw - startYaw + Math.PI) - Math.PI);
  const posGapNow = () => Math.hypot(pos.x - start[0], pos.z - start[2]) + Math.abs(pos.y - baseY);
  if (posGapNow() > 0.5 || yawGapNow() > 0.12) {
    // 1) eased ramp back to station height along the current heading
    if (Math.abs(pos.y - baseY) > 0.08) {
      const rise = baseY - pos.y;
      ramp(rise);
      synthesized.push(`${rise > 0 ? 'lift' : 'drop'} ${Math.abs(rise).toFixed(2)}`);
    }
    // 2) shortest Dubins arc–straight–arc onto the start pose. Coasters get
    // WIDER closing arcs (r 2.2): the return leg is ridden at full post-drop
    // speed, and the energy-paced lateral G through a 1.5-radius arc at the
    // banking ramp-in would graze the 1.5 g derail guard. Coasters ALSO land
    // via a straight BRAKE TAIL (round-4 safeguard): a closing arc welded
    // directly onto the station used to concentrate the spline's curvature at
    // the wrap point — the fastest, least-banked track on the circuit — and
    // validatePark's crash replay read a lateral-G spike there. The Dubins
    // path now targets a virtual pose TAIL units BEFORE the station along the
    // entry heading, then runs straight home, so the weld is always ridden on
    // dead-straight track whatever the arrival speed.
    const R = profile === 'coaster' ? 2.2 : TURN_RADIUS;
    const TAIL = profile === 'coaster' ? 1.2 : 0;
    const tx = start[0] - Math.sin(startYaw) * TAIL;
    const tz = start[2] - Math.cos(startYaw) * TAIL;
    const phiOf = (vx: number, vz: number) => Math.atan2(vx, vz);
    let best: { s1: 1 | -1; s2: 1 | -1; d1: number; d2: number; L: number; phiT: number; total: number } | null = null;
    ([[1, 1], [-1, -1], [1, -1], [-1, 1]] as [1 | -1, 1 | -1][]).forEach(([s1, s2]) => {
      const c1x = pos.x + s1 * R * Math.cos(yaw);
      const c1z = pos.z - s1 * R * Math.sin(yaw);
      const c2x = tx + s2 * R * Math.cos(startYaw);
      const c2z = tz - s2 * R * Math.sin(startYaw);
      const Dx = c2x - c1x;
      const Dz = c2z - c1z;
      const dd = Math.hypot(Dx, Dz);
      let L: number;
      let phiT: number;
      if (s1 === s2) {
        L = dd;
        phiT = dd < 1e-9 ? yaw : phiOf(Dx, Dz);
      } else {
        if (dd < 2 * R + 1e-6) return; // inner tangent doesn't exist
        L = Math.sqrt(dd * dd - 4 * R * R);
        phiT = phiOf(Dx, Dz) + (s1 === 1 ? 1 : -1) * Math.atan2(2 * R, L);
      }
      const d1 = mod2pi(s1 * (phiT - yaw));
      const d2 = mod2pi(s2 * (startYaw - phiT));
      const total = R * (d1 + d2) + L;
      if (!best || total < best.total) best = { s1, s2, d1, d2, L, phiT, total };
    });
    if (!best) {
      warn('layout cannot close cleanly — no return path found (this should not happen)');
    } else {
      const b = best as { s1: 1 | -1; s2: 1 | -1; d1: number; d2: number; L: number; phiT: number; total: number };
      if (b.d1 > 0.06) {
        arc(b.s1, b.d1, R);
        synthesized.push(`turn${b.s1 === 1 ? 'L' : 'R'} ${(b.d1 / DEG).toFixed(0)}°`);
      }
      yaw = b.phiT; // exact tangent heading (kills chord drift)
      if (b.L > 0.12) {
        straight(b.L);
        synthesized.push(`straight ${b.L.toFixed(2)}`);
      }
      if (b.d2 > 0.06) {
        arc(b.s2, b.d2, R);
        synthesized.push(`turn${b.s2 === 1 ? 'L' : 'R'} ${(b.d2 / DEG).toFixed(0)}°`);
      }
      if (TAIL > 0) {
        yaw = startYaw; // exact entry heading (kills chord drift on the tail)
        pos.x = tx;
        pos.z = tz;
        straight(TAIL);
        synthesized.push(`straight ${TAIL.toFixed(1)} (brake tail)`);
      }
      setPosToLast();
      if (b.total > Math.max(14, 1.6 * authoredLen))
        warn(`layout doesn't close cleanly — ${b.total.toFixed(1)} units of return track synthesized (${synthesized.join(', ')}); aim the last authored piece roughly back at the station`);
    }
  }
  // the closed CatmullRom wraps to points[0] automatically — points that
  // land ON the start would kink the wrap
  while (points.length > 3) {
    const [lx, ly, lz] = points[points.length - 1];
    if (Math.hypot(lx - start[0], ly - baseY, lz - start[2]) < 0.45) points.pop();
    else break;
  }
  // ---- station-weld fairness (round-4 safeguard) -----------------------------
  // The wrap segment (last point → points[0]) is ridden at full post-circuit
  // speed with the bank ramped out for the flat station — when the layout
  // lands on the station FROM A CURVE the closed spline concentrates the
  // remaining heading change right at the weld and the 1.5 g derail-guard
  // replay reads a spike there (the old L-wrap archetype replayed 1.31 g
  // against the 1.27 g crash margin at u = 1.00). Warn so authors add a trim
  // brake-run straight (the re-verified §4 archetypes end `straight g − 0.3`
  // with g ≈ 1.2 — see rules/park-generation.md).
  if (profile === 'coaster' && points.length >= 4) {
    const [lx, , lz] = points[points.length - 1];
    const ex = Math.sin(startYaw);
    const ez = Math.cos(startYaw);
    const relX = lx - start[0];
    const relZ = lz - start[2];
    const lateral = Math.abs(relX * ez - relZ * ex);
    const along = relX * ex + relZ * ez;
    if (lateral > 0.3 && along > -3.2)
      warn(
        `the circuit lands on the station from a curve (final point sits ${lateral.toFixed(2)} u off the station axis) — the station weld will read a lateral-G spike at speed; end the layout with a straight brake tail ≥ ~1.2 u along the station axis, landing ~0.3 u short of the start (see the §4 archetypes)`,
      );
  }
  const gap = (() => {
    const [lx, ly, lz] = points[points.length - 1];
    return Math.hypot(lx - start[0], ly - baseY, lz - start[2]);
  })();
  const closed = gap < TURN_RADIUS * 2.2 && yawGapNow() < 0.12;
  if (!closed) warn(`layout does not close (residual gap ${gap.toFixed(2)}, yaw off by ${(yawGapNow() / DEG).toFixed(0)}°)`);

  if (points.length < 4) {
    warn('too few pieces — a circuit needs at least ~4 control points');
    return {
      points,
      report: {
        ok: false,
        design: { ok: false, violations: [] },
        valid: { ok: false, worst: 0, at: [0, 0] },
        closure: { closed: false, gap, synthesized },
        stations,
        warnings,
        fatal: true,
        fatalReason: 'too few pieces — a circuit needs at least ~4 control points',
      },
    };
  }

  // ---- always validate the result ----
  // design-check frames use the bank each profile actually builds with, so
  // the report matches what buildRideSpline will assemble. Coaster banking is
  // SATURATED at the type's bankLimit (round-3 safeguard): auto-banking used
  // to default to 0.7 rad (40°) even on wooden track whose limit is 25°,
  // making documented archetypes fail 'bankLimit' when no bank was passed.
  if (profile === 'coaster' && opts.bank !== undefined && opts.bank > TYPE_RULES[type].maxBank + 1e-6)
    warn(
      `bank ${opts.bank.toFixed(2)} rad exceeds the ${type} bankLimit ${(TYPE_RULES[type].maxBank).toFixed(2)} rad (${(TYPE_RULES[type].maxBank / DEG).toFixed(0)}°) — clamped to the limit`,
    );
  const designBank =
    profile === 'coaster' ? coasterBankCap(type, opts.bank)
    : opts.bank ??
    (profile === 'flume' || profile === 'rapids' ? 0.25
    : profile === 'monorail' ? 0.08
    : profile === 'gokart' ? 0.02
    : profile === 'bobsled' ? 0.55
    : undefined);
  const fb = computeSplineFrames(t, points, { bank: designBank });
  const design = checkCoasterDesign(t, points, { type, frames: fb, bank: designBank });
  const valid = validateSpline(t, fb.curve);
  if (profile === 'coaster')
    design.violations.forEach((v) =>
      warnings.push(`design ${v.warning ? 'warning' : 'violation'} [${v.kind}] at u=${v.at.toFixed(2)} — ${v.detail}`),
    );
  if (!valid.ok) warn(`compiled track self-intersects (worst clearance ${valid.worst.toFixed(2)}) — spread the layout out`);
  const checksOk = valid.ok && closed && (profile === 'coaster' ? design.ok : true);

  // ---- FATAL guard (round-1 safeguard) --------------------------------------
  // A track that fails its checks, needed a return leg past 40% of the
  // authored arc length, or leaves the park bounds must never be silently
  // built as a working ride: consumers (<Coaster>/<TrackRide>) render a fatal
  // track in translucent red and skip the GameManager registration.
  let fatal = false;
  let fatalReason = '';
  const fatalize = (m: string) => {
    if (!fatal) {
      fatal = true;
      fatalReason = m;
    }
    warn(
      `FATAL: ${m} — fix the layout: end it FACING the station (aim the last authored piece back at the station straight) and keep every piece inside the park`,
    );
  };
  let finalLen = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, az] = points[i - 1];
    const [bx, by, bz] = points[i];
    finalLen += Math.hypot(bx - ax, by - ay, bz - az);
  }
  const closureLen = Math.max(0, finalLen - authoredLen);
  if (!checksOk) fatalize('the compiled track fails its design/clearance/closure checks (see report.design/valid/closure)');
  else if (closureLen > 0.4 * Math.max(authoredLen, 1e-6))
    fatalize(
      `the synthesized closure is ${closureLen.toFixed(1)} u — ${((100 * closureLen) / Math.max(authoredLen, 1e-6)).toFixed(0)}% of the ${authoredLen.toFixed(1)} u authored (limit 40%)`,
    );
  if (opts.bounds !== undefined) {
    const half = typeof opts.bounds === 'number' ? opts.bounds / 2 : opts.bounds.half;
    const margin = (typeof opts.bounds === 'number' ? undefined : opts.bounds.margin) ?? 0.3;
    let worstExt = 0;
    for (const [x, , z] of points) worstExt = Math.max(worstExt, Math.abs(x), Math.abs(z));
    if (worstExt > half + margin) {
      // SUGGEST A LEGAL START (round-10). Every point is `start + local`, so per
      // axis the legal start interval is [−lim − localMin, lim − localMax]. A
      // ring that grows −x from its start (all three §4.0 archetypes do) is
      // fatal near the −x edge and fine near the +x edge — say so, don't make
      // the author redo the arithmetic. See harness/park-eval/probe-archetype-bounds.mjs.
      const lim = half + margin;
      const range = (i: 0 | 2) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const p of points) {
          lo = Math.min(lo, p[i] - start[i]);
          hi = Math.max(hi, p[i] - start[i]);
        }
        return [-lim - lo, lim - hi] as [number, number];
      };
      // keep an already-legal axis; otherwise the nearest 1.2-u lattice point inside (parks translate on that lattice)
      const nearest = (v: number, [lo, hi]: [number, number]) => {
        if (v >= lo && v <= hi) return v;
        const snap = v < lo ? Math.ceil(lo / 1.2 - 1e-9) * 1.2 : Math.floor(hi / 1.2 + 1e-9) * 1.2;
        return snap >= lo - 1e-9 && snap <= hi + 1e-9 ? snap : v < lo ? lo : hi;
      };
      const rx = range(0);
      const rz = range(2);
      const hint =
        rx[0] > rx[1] || rz[0] > rz[1]
          ? ` — NO legal start exists: this circuit (${(2 * lim + rx[0] - rx[1]).toFixed(1)} × ${(2 * lim + rz[0] - rz[1]).toFixed(1)} u) is bigger than the ${(2 * lim).toFixed(1)} u plot, so shrink the layout or grow the park`
          : ` — legal start x ∈ [${rx[0].toFixed(1)}, ${rx[1].toFixed(1)}], z ∈ [${rz[0].toFixed(1)}, ${rz[1].toFixed(1)}]; nearest legal start is [${nearest(start[0], rx).toFixed(1)}, ${start[1].toFixed(2)}, ${nearest(start[2], rz).toFixed(1)}] (was [${start[0].toFixed(1)}, ${start[1].toFixed(2)}, ${start[2].toFixed(1)}])`;
      fatalize(`the track reaches ±${worstExt.toFixed(1)} u — outside the ±${half.toFixed(1)} u park bounds${hint}`);
    }
  }

  return {
    points,
    report: {
      ok: checksOk && !fatal,
      design,
      valid,
      closure: { closed, gap, synthesized },
      stations,
      warnings,
      ...(fatal ? { fatal: true, fatalReason } : {}),
    },
  };
}


// ---------------------------------------------------------------------------
// VERIFIED COASTER PRESETS
//
// WHY THESE EXIST. Hand-authored circuits die of CLOSURE, not of physics: a
// generated park lost all eight thrill points to one line — "the synthesized
// closure is 24.6 u, 46% of the 53.5 u authored (limit 40%)" — while its own
// `design.ok` read true. The standing answer was "copy the two published
// arrays verbatim", which stopped the bleeding and also meant every park in the
// corpus shipped the identical two coasters, NEITHER of which has a vertical
// loop. A preset table is the same safety with more than one answer in it.
//
// EARNING A PLACE HERE means passing `harness/park-eval/probe-coaster-design.mjs`
// on the REAL `compileTrackPieces` + `rateCoaster` + `checkCoasterDesign`:
// `report.ok`, no `fatal`, ZERO synthesized closure pieces, `maxLatG <= 1.275`
// (the derail guard, 1.5 g x 0.85), a clean design check, and — for anything
// claiming to be a thrill ride — at least one inversion. The numbers in each
// entry below are that probe's output, not estimates.
// ---------------------------------------------------------------------------

/** one entry in {@link COASTER_PRESETS} */
export interface CoasterPreset {
  /** the piece list — pass straight to `<Coaster pieces={…}>` */
  pieces: TrackPiece[];
  /** 'steel' unless stated; the presets' measured figures assume `bank` 0.7 */
  type: 'steel' | 'wooden';
  /** the pose these figures were measured at, on a size-128 plot */
  start: [number, number, number];
  /** measured by probe-coaster-design.mjs — NOT estimates */
  measured: { excitement: number; intensity: number; nausea: number; inversions: number; maxLatG: number; highestDrop: number; footprint: string };
  note: string;
}

/**
 * THE PLUNGE — the big drop AND a loop, which no earlier preset managed.
 *
 * The two published arrays have a 5.47-u drop with corkscrews (§4.0-C) or no
 * inversion at all (§4.0-B); the one looper that passed (§4.0-L) bought its
 * legality by shrinking the drop to 4.19. Every attempt at both — §4.0-D's twin
 * loops, §4.0-H's helix finale — failed the derail guard at 3.23 g and 3.40 g.
 *
 * THE REASON, straight out of `ratings.ts` `replayCoasterForces`:
 *
 *     v    = sqrt(2 · (energy − 9.8 · y))          energy is fixed by maxY
 *     latG = v² · κ_h · (1 − |roll| / 0.6) / 9.8
 *
 * A turn's lateral load is set by how far it sits BELOW THE HIGHEST POINT ON
 * THE CIRCUIT, not by the drop as such. The published idiom — lift, straight,
 * turn, drop, four times round — puts every turn at its own local crest, and
 * those crests DESCEND, so the last turn in a big-drop layout sits nearly the
 * whole height under maxY and eats the entire budget.
 *
 * So this one CLIMBS ONCE and turns three times on the top deck, where v is at
 * its 1.4 floor, then spends the whole height on ONE drop into a loop pair on
 * the final side. And the loops are a PAIR on purpose: a single `loop` steps one
 * RCT2 tile sideways (`offset`) so its legs clear each other underneath, which
 * leaves the circuit on a parallel line and forces the compiler to invent a jog
 * — `loopL` after `loopR` cancels that exactly, and buys a second inversion
 * instead of a correction.
 */
export const COASTER_PRESET_PLUNGE: CoasterPreset = {
  type: 'steel',
  start: [16.8, 0.55, -3.6],
  measured: { excitement: 5.5, intensity: 7.55, nausea: 2.72, inversions: 2, maxLatG: 1.23, highestDrop: 5.99, footprint: '27.5 × 20.1 u, maxY 6.55' },
  note: 'big drop + two vertical loops. The straights are SOLVED closure lengths — nudge one and the compiler starts synthesizing.',
  pieces: [
    'station',
    { type: 'lift', height: 6 },
    { type: 'turnR', angle: 90, radius: 2.5 },
    { type: 'straight', length: 22.5 }, // side B — matched to the plunge side
    { type: 'turnR', angle: 90, radius: 2.5 },
    { type: 'straight', length: 15.1 }, // side C — matched to station + lift
    { type: 'turnR', angle: 90, radius: 2.5 },
    { type: 'drop', height: 6 }, // THE plunge, the full height in one go
    { type: 'loopR', radius: 1.6 },
    { type: 'straight', length: 2 },
    { type: 'loopL', radius: 1.6 }, // cancels loopR's lateral step exactly
    { type: 'straight', length: 3 },
    { type: 'turnR', angle: 90, radius: 2.5 },
  ],
};

/** the verified preset table — see {@link CoasterPreset} for what "verified" means */
export const COASTER_PRESETS: Record<string, CoasterPreset> = {
  plunge: COASTER_PRESET_PLUNGE,
};
