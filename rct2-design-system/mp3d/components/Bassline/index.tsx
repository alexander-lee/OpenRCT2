import React from 'react';
import * as THREE from 'three';
import { box, cyl, mat, mtx, mergedBoxes, mergedParts, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildRideSpline, compileTrackPieces, rateCoaster } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { computeSplineFrames } from '../SplineCoaster';
import type { SplineFrame } from '../SplineCoaster';
import { buildCoasterCar, COASTER_CAR_SEATS, gateCarLights } from '../CoasterCar';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { buildEmitter } from '../ParticleKit';
import { buildNeonSign } from '../NeonSign';
import { DISCO_PALETTE } from '../DanceFloor';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// ---------------------------------------------------------------------------
// Bassline — the PULSE DISTRICT's neon COASTER. A compact steel circuit that
// spends most of its lap inside PULSING LIGHT TUNNELS: black-gloss box tunnels
// lined with neon hoops that chase on the district's beat and FLARE as the
// train punches through them, plus free-standing hoop gates strung along the
// open track. The station is a club front — gloss platform, neon canopy,
// speaker stacks and a BASSLINE marquee.
//
// Built on the shared spline machinery, like every tracked ride in the fleet:
// `compileTrackPieces` walks the piece list, `buildRideSpline({ profile:
// 'coaster', type: 'steel' })` sweeps it, and the hoops/tunnels are placed off
// `computeSplineFrames` sampled with the SAME bank so they sit exactly on the
// rails. Callers can replace the circuit with a `pieces` array or piece
// children (`<Station/><Lift/><HelixR/>…`) — a FATAL compile marks the build
// `invalid` and it never registers as a working ride.
//
// THE BEAT: the same ~2.2 Hz clock <DanceFloor> flashes its tiles to and
// <Discotron>'s mirror ball scintillates on, over the same cool palette subset
// (magenta / cyan / violet / blue). Every hoop steps a palette colour on the
// beat; inside a tunnel the hoops fire in SEQUENCE, one hoop per beat, so the
// light visibly runs down the bore. The tunnel base strips, the station canopy
// and the marquee all breathe on the same beat. The LIGHTING clock is absolute
// (the club never stops); only the TRAIN runs on the `createMotionGate` clock,
// so it sits parked in the station while guests board.
//
// THE DEFAULT CIRCUIT — "Sub Bass Circuit". Iterated with a COMPILE-ONLY probe
// (never renders), final numbers: closed with ZERO synthesized pieces, design
// ok, worst clearance 2.91, worst effective lateral 1.10 g (guard margin 1.27),
// vertical +2.68/−0.27 g, 48.3 u lap in 12.9 s, extent 20.1 × 6.8 u, crest
// 2.15 u, E 2.30 / I 2.36 / N 0.78. Two hard-won rules shaped it:
//   * the list must END FACING THE STATION or the compiler synthesizes a
//     closing U-turn straight through the track — so leg B is exactly leg A
//     + 1.5 u and the layout finishes with a 1.2 u brake tail on the station
//     axis, landing 0.3 u short of the start;
//   * `lift`/`drop` runs AUTO-EXTEND (rampPoints holds the pitch-rate rule at
//     ~0.5 rad/unit, which forces b = π·g), so a modest 1.6 u lift eats 7.82 u
//     of ground. Plan against the real advance, not the requested `length`.
// The elevated turnaround is a DESCENDING BANKED HELIX rather than a flat turn:
// it costs the cursor exactly what a flat 180° costs but buys a second drop.
//
// Deterministic (hashed sine only), absolute-time updaters, THREE real
// PointLights (lead-car headlamp, station canopy, marquee), 120/300 particles.
// ---------------------------------------------------------------------------

/** the district beat — shared with <DanceFloor> and <Discotron> */
const BEAT_HZ = 2.2;
const beatStep = (time: number, off = 0) => Math.floor(time * BEAT_HZ + off);
const beatPulse = (time: number, ph = 0) => 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * (time * BEAT_HZ + ph)));
const beatKick = (time: number, ph = 0) => {
  const f = (((time * BEAT_HZ + ph) % 1) + 1) % 1;
  return Math.exp(-7 * f);
};
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (k: number) => k * k * (3 - 2 * k);

/** the district's cool subset of <DanceFloor>'s DISCO_PALETTE — the same one
 *  <Discotron> exports as PULSE_PALETTE (magenta / cyan / violet / blue) */
const PULSE = [DISCO_PALETTE[0], DISCO_PALETTE[1], 0x7b3fe4, DISCO_PALETTE[4]];
const paletteAt = (i: number) => PULSE[((i % PULSE.length) + PULSE.length) % PULSE.length];

// ---- palette ---------------------------------------------------------------
const GLOSS = 0x16171c; // black-gloss tunnel skin, platform face, cabinets
const GRAPHITE = 0x3a3d45; // tunnel ribs, hoop collars, station frame
const GRAPHITE_D = 0x2a2d34; // shadow-side graphite
const STEEL = 0x6e737d; // structural steel (canopy masts) — see Discotron's note
const CHROME = 0xa6adb6; // brushed chrome trims (metalness ≤0.35)
const CONCRETE = 0x9b9a96; // platform slab, footings
const MAGENTA = 0xd815b8;
const CYAN = 0x18c8d8;

/** RCT2 TrackColour for a neon steel coaster: bright steel rail, graphite ties,
 *  graphite supports (SteelTwister-style ColourPresets, cooled to the world) */
const TRACK_COLOURS: TrackScheme = { main: 0x9aa2ab, additional: 0x2e3138, supports: 0x3c4048 };
/** train livery: black-gloss tub, chrome waist trim, magenta nose/tail fairing */
const CAR_LIVERY: VehicleScheme = { body: 0x1b1c22, trim: CHROME, tertiary: MAGENTA };

/** auto-banking cap the geometry, the design frames and the ratings all share
 *  (0.26 is the practical steel maximum before bankLimit trips on curvature) */
const BANK = 0.24;
/** the compiled station straight runs along the local −x, which leaves the
 *  local +z face (queue lane + huts) completely clear of the circuit */
const HEADING = -Math.PI / 2;

/** the boarding anchor, in the SCENE builder's own local frame — the platform
 *  at station rail level. Declared here (not only in the composable layout
 *  below) because the STATION LOCK derives the train's parked pose from it:
 *  a train has to brake to a stop where the guests are standing. */
const BOARD: [number, number, number] = [-1.3, 0.6, 0];
/** run() car spacing — also the arithmetic the seat band's mean offset uses */
const CAR_SPACING = 1.15;

/**
 * "Sub Bass Circuit" — the shipped default. See the header for the measured
 * compile numbers. `lift`/`drop` lengths are written as their REAL auto-extended
 * advance (7.82 / 3.94) so the closure arithmetic in the comments is checkable:
 * leg A = 2.6 + 0.6 + 7.82 + 0.8 = 11.82, leg B = 1.4 + 3.94 + 6.38 + 1.6 =
 * 13.32 = leg A + 1.5, then a 1.2 u brake tail lands 0.3 u short of the start.
 */
const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.6 },
  { type: 'lift', height: 1.6, length: 7.82 }, // chain lift, 11.6° — the pitch-rate rule's ceiling for this run
  { type: 'straight', length: 0.8 }, // level crest
  { type: 'helixR', angle: 180, radius: 3.4, height: -1.0 }, // DESCENDING BANKED turnaround
  { type: 'straight', length: 1.4 }, // tunnel entry
  { type: 'drop', height: 0.6, length: 3.94 }, // the plunge into the long tunnel
  { type: 'straight', length: 6.38 }, // TUNNEL: the long low straight
  { type: 'straight', length: 1.6 }, // tunnel exit
  { type: 'turnR', angle: 180, radius: 3.4 }, // bottom turnaround
  { type: 'straight', length: 1.2 }, // brake tail, on the station axis
];

// ---- ⚠️ THE BORE, AND THE TRAIN THAT HAS TO GO THROUGH IT -------------------
//
// This shipped as `HOOP_R 0.9` with the arch laid at `basisOf(f, -0.1)` — its
// centre 0.1 BELOW the rail line — on the written claim that a 0.9 bore "clears
// the train (half-width 0.33, roof 0.72 over the rails)". THE TRAIN DID NOT FIT.
// Two errors compounded:
//
//   * the roof figure was measured in the CAR's own frame, but `run()` seats each
//     car `wheelOffset` **0.195** ABOVE the frame point, and
//   * it ignored the RIDERS, who are the tallest thing on the train.
//
// Measured (`/tmp/mp3d-render/aud-pd-bore.tsx`, every vertex of every car walked
// into each hoop's own basis) the real envelope above the RAIL LINE is
//
//     y 0.00-0.30  halfW 0.335   |  y 0.60-0.78  halfW 0.23
//     y 0.30-0.42  halfW 0.32    |  y 0.78-0.84  halfW 0.12
//     y 0.42-0.60  halfW 0.33    |  y 0.84-0.96  halfW 0.23   <- shoulders
//                                |  y 0.96-1.02  halfW 0.12   <- HEADS, top 1.017
//
// so the worst car vertex sat at radius **1.121** about an arch centre 0.1 below
// the rail, against a clear bore of 0.83 — **0.291 u outside it**. The exact
// torus-tube test (distance to the tube's centre circle, not an AABB) counted
// **234 836 vertex-samples inside the tube, worst penetration 0.069 of a 0.07
// tube** — i.e. dead centre through the neon: the riders' heads went through
// every one of the 39 hoops, once a lap. A ray-parity sweep against the static
// geometry (`aud-pd-tunnel.tsx`) found the same for the tunnels' own roof ribs
// and portal headers, which were placed at TUN_H + 0.035 = 0.655 and at 1.08.
//
// THE FIX IS DERIVED FROM THAT PROFILE, not guessed. Raising the arch CENTRE is
// worth far more than widening it, because the binding vertex is nearly on the
// bore's axis: the worst radius falls 1.121 -> 0.823 as the centre goes from
// -0.10 to +0.20. So the arch centre is lifted to +0.22 and the radius opened a
// little to 0.98 (which also lands its feet 0.04 INSIDE the valance walls
// instead of on them, so the tube never grazes the wall plane):
//     clear bore 0.91  -  worst vertex radius 0.803  =  0.107 of clearance,
// re-measured over the whole lap at 0 vertices inside any solid.
// The visible consequence is deliberate and better: the crowns now stand 0.58
// proud of the low walls instead of 0.18, so the hoops read as rings the train
// goes THROUGH rather than as rings buried in the trough.
/** neon hoop bore radius. Tube 0.07, so the clear bore is 0.91. */
const HOOP_R = 0.98;
/** the arch CENTRE, above the rail line. Was −0.10 — see the note above. */
const HOOP_Y = 0.22;
/** the measured train envelope, above the RAIL LINE, riders included — every
 *  aperture in this file is checked against these two numbers. */
const TRAIN_TOP = 1.017;
const TRAIN_HALF_W = 0.335;
/** tunnel half-width, and the height of its VALANCE walls above the rail line.
 *  The first cut roofed the tunnels solid and the night hero shot came back with
 *  two black voids where the whole point of the ride was: from a park camera you
 *  cannot see into a closed bore. The tunnels are OPEN-TOPPED — low gloss
 *  valance walls (deliberately BELOW the train, so the cars and their riders show
 *  above them from a park camera), roof ribs that reach in from each wall top and
 *  STOP SHORT of the train's slot, and hoop crowns 0.58 proud of the walls. */
const TUN_W = 1.02;
const TUN_H = 0.62;
/** how far in from each wall a roof rib may reach. The train is 0.23 half-wide
 *  through the ribs' 0.62-0.69 height band (see the envelope table above), so
 *  0.36 leaves 0.13 of clearance and a 0.72-wide open slot down the bore. */
const RIB_IN = 0.36;

export interface BasslineOpts {
  /** RCT2 track pieces (compileTrackPieces vocabulary) — replaces the stock
   *  Sub Bass Circuit. Compiled `profile: 'coaster'`, `type: 'steel'`,
   *  bank 0.24, heading −90°. */
  pieces?: TrackPiece[];
  /** raw control points — an escape hatch past the piece compiler (`pieces` wins) */
  points?: [number, number, number][];
  /** cars in the train (default 3 → 6 seats) */
  cars?: number;
  /** decorative riders (default true; <Bassline register> turns them OFF so
   *  REAL GameManager guests fill the cars through seatWorld) */
  riders?: boolean;
  /** terrain sampler so supports and footings land on the ground (default flat) */
  groundAt?: (x: number, z: number) => number;
  /** THE RIDE IS SIM-OWNED (`<Bassline register>` sets it). A registered train
   *  starts HELD on its platform: `registerRide` builds the rec already in
   *  `movingToEndOfStation` WITHOUT calling `setState`, so the motion gate stays
   *  UNGATED — and therefore free-running — until that timer expires, which
   *  walked the first parked pose 2.6 u off the platform. A preview has no FSM
   *  and must keep running, so this cannot be inferred inside the builder.
   *  See §8b THE STATION LOCK. */
  registered?: boolean;
}

export interface BasslineBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  crashed?: () => boolean;
  /** FATAL pieces compile — <ConfigurableRide> skips the registration */
  invalid?: boolean;
  ratings?: { excitement: number; intensity: number; nausea: number; ratingBand?: string; nauseaExtreme?: boolean };
}

/**
 * An OPEN quad-strip swept between two frame-local side/height offsets.
 * SplineRideKit's `ribbon` closes the loop (`frames[i % n]`), which is right
 * for a full-circuit trough but wrong for a tunnel over a SUB-RANGE of frames:
 * it welds the tunnel's last rib back to its first and drags one enormous quad
 * across the park. This is the same sweep without the wrap.
 */
function openRibbon(
  t: typeof THREE,
  frames: SplineFrame[],
  sA: number,
  hA: number,
  sB: number,
  hB: number,
  material: THREE.Material,
  vRep = 0.35,
): THREE.Mesh {
  const n = frames.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const f = frames[i];
    const a = f.p.clone().addScaledVector(f.side, sA).addScaledVector(f.up, hA);
    const b = f.p.clone().addScaledVector(f.side, sB).addScaledVector(f.up, hB);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, i * vRep, 1, i * vRep);
  }
  for (let i = 0; i < n - 1; i += 1) {
    const k = i * 2;
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const geo = new t.BufferGeometry();
  geo.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new t.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** one neon hoop: a half-torus arch across the track with two struts down to
 *  the tie line, plus its own material so it can chase and flare */
interface Hoop {
  m: THREE.MeshStandardMaterial;
  /** world position of the arch crown — the train-proximity test */
  p: THREE.Vector3;
  /** index WITHIN its tunnel (sequence chase), or −1 for a free-standing gate */
  seq: number;
  /** hashed phase so free-standing gates don't all breathe in lockstep */
  ph: number;
}

export function buildBasslineScene(three: typeof THREE, opts: BasslineOpts = {}): BasslineBuilt {
  const t = three;
  const g = new t.Group();
  const withRiders = opts.riders ?? true;
  const groundAt = opts.groundAt ?? (() => 0);
  const carCount = Math.max(1, Math.min(6, opts.cars ?? 3));
  const extras: { vehicle?: THREE.Object3D; crashed?: () => boolean; invalid?: boolean; ratings?: BasslineBuilt['ratings'] } = {};
  const seatAnchors: THREE.Object3D[] = [];

  // =========================================================================
  // 1. THE CIRCUIT — the shared compiler + the shared spline sweeper
  // =========================================================================
  let pts = opts.points;
  if (!pts) {
    const compiled = compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, {
      profile: 'coaster',
      type: 'steel',
      bank: BANK,
      start: [0, 0.55, 0],
      heading: HEADING,
    });
    pts = compiled.points;
    g.userData.trackReport = compiled.report; // harness/agent introspection
    if (compiled.report.fatal) extras.invalid = true;
  }
  const ride = buildRideSpline(t, pts, {
    profile: 'coaster',
    type: 'steel',
    wood: false,
    bank: BANK,
    groundAt,
    colours: TRACK_COLOURS,
    vehicleSchemes: [CAR_LIVERY],
  });
  g.add(ride.group);
  extras.crashed = () => ride.crashed();
  extras.ratings = rateCoaster(pts, { type: 'steel', bank: BANK, cars: carCount });
  // the SAME frames buildRideSpline swept with, so hoops sit exactly on the rails
  const fb = computeSplineFrames(t, pts, { bank: BANK });
  const basisOf = (f: SplineFrame, h = 0) =>
    new t.Matrix4().makeBasis(f.side, f.up, f.fwd).setPosition(f.p.clone().addScaledVector(f.up, h));

  // =========================================================================
  // 2. WHERE THE TUNNELS GO — auto-detected straight, level spans
  // =========================================================================
  // Hardcoding u ranges would break the moment a caller passes their own
  // `pieces`, so the tunnels are FOUND: the longest runs of frames that are
  // both straight in plan and near-level, outside the station and brake tail.
  const N = fb.N;
  const bendAt = (i: number) => {
    const a = fb.frames[(i - 3 + N) % N].fwd;
    const b = fb.frames[(i + 3) % N].fwd;
    const ah = Math.hypot(a.x, a.z) || 1;
    const bh = Math.hypot(b.x, b.z) || 1;
    return 1 - (a.x * b.x + a.z * b.z) / (ah * bh); // 0 = dead straight
  };
  const straightIdx = (i: number) => bendAt(i) < 0.004 && Math.abs(fb.frames[i].fwd.y) < 0.3;
  const spans: [number, number][] = [];
  {
    let run = -1;
    for (let i = 0; i < N; i += 1) {
      const inStation = i / N < 0.075 || i / N > 0.965; // station + brake tail stay open
      const ok = straightIdx(i) && !inStation;
      if (ok && run < 0) run = i;
      if ((!ok || i === N - 1) && run >= 0) {
        if (i - run >= 10) spans.push([run, i]);
        run = -1;
      }
    }
  }
  // a single kinked frame splits one run in two — stitch spans back together
  const merged: [number, number][] = [];
  spans
    .slice()
    .sort((a, b) => a[0] - b[0])
    .forEach((s) => {
      const last = merged[merged.length - 1];
      if (last && s[0] - last[1] <= 3) last[1] = s[1];
      else merged.push([s[0], s[1]]);
    });
  merged.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
  const tunnels = merged.slice(0, 2); // the two longest — the light tunnels
  const inTunnel = (i: number) => tunnels.some(([a, b]) => i >= a && i <= b);

  // =========================================================================
  // 3. THE TUNNELS — black-gloss box skin + a pulsing base strip
  // =========================================================================
  const stripMats: THREE.MeshStandardMaterial[] = [];
  const tunnelRibs: PartSpec[] = [];
  tunnels.forEach(([a, b], ti) => {
    const sub = fb.frames.slice(a, b + 1);
    if (sub.length < 4) return;
    const skin = mat(t, GLOSS, { tex: 'plastic', repeat: [2, Math.max(2, Math.round((b - a) / 4))], rough: 0.2 });
    skin.side = t.DoubleSide;
    g.add(openRibbon(t, sub, -TUN_W, -0.12, -TUN_W, TUN_H, skin)); // left valance wall
    g.add(openRibbon(t, sub, TUN_W, TUN_H, TUN_W, -0.12, skin)); // right valance wall
    // ROOF RIBS with sky between them (never a solid roof) + a graphite capping
    // bar down each wall top. ⚠️ These used to be ONE bar spanning the full
    // 2.20 u of bore at 0.655 above the rail — and the train's riders reach
    // 1.017, so every rib went straight through them (ray-parity probe:
    // `aud-pd-tunnel.tsx` counted 2088 vertex-samples inside this merged solid,
    // worst depth 0.221). Each rib is now a PAIR cantilevered in from the wall
    // tops that stops at RIB_IN, leaving a 0.72-u slot for the train — which is
    // what an open-topped bore is anyway, and it reads as bracing rather than as
    // a lid the cars drive through.
    for (let i = a + 2; i <= b - 2; i += 5) {
      [-1, 1].forEach((s) =>
        tunnelRibs.push({
          geo: new t.BoxGeometry(TUN_W + 0.08 - RIB_IN, 0.07, 0.13),
          matrix: basisOf(fb.frames[i], TUN_H + 0.035).multiply(
            new t.Matrix4().makeTranslation((s * (TUN_W + 0.08 + RIB_IN)) / 2, 0, 0),
          ),
        }),
      );
    }
    [-1, 1].forEach((s) => {
      const cap = mat(t, GRAPHITE, { tex: 'metal', metal: 0.28, rough: 0.45 });
      cap.side = t.DoubleSide;
      g.add(openRibbon(t, sub, s * (TUN_W + 0.06), TUN_H, s * (TUN_W - 0.06), TUN_H, cap));
    });
    // a taller fascia frame round each mouth so the bore reads as a PORTAL.
    // ⚠️ The header used to sit at a bare `HOOP_R + 0.18` = 1.08 with a 0.22
    // depth, i.e. spanning 0.97-1.19 — straight through the riders' 1.017 heads.
    // It now tracks the arch (HOOP_Y + HOOP_R + 0.18 = 1.38, bottom 1.27) and the
    // jambs are solved to meet it, so the whole frame stands clear of TRAIN_TOP.
    const PORT_TOP = HOOP_Y + HOOP_R + 0.18;
    const PORT_BOT = -0.24;
    [a, b].forEach((k, end) => {
      const m = basisOf(fb.frames[k], 0);
      const dz = end === 0 ? -0.09 : 0.09;
      ([
        [0, PORT_TOP, TUN_W * 2 + 0.5, 0.22],
        [0, PORT_BOT + 0.02, TUN_W * 2 + 0.5, 0.16],
        [-TUN_W - 0.13, (PORT_TOP + PORT_BOT) / 2, 0.22, PORT_TOP - PORT_BOT],
        [TUN_W + 0.13, (PORT_TOP + PORT_BOT) / 2, 0.22, PORT_TOP - PORT_BOT],
      ] as [number, number, number, number][]).forEach(([lx, ly, w, h]) => {
        tunnelRibs.push({
          geo: new t.BoxGeometry(w, h, 0.15),
          matrix: m.clone().multiply(new t.Matrix4().makeTranslation(lx, ly, dz)),
        });
      });
    });
    // pulsing strips: one down each wall base INSIDE the bore, one along each
    // wall top OUTSIDE it (so the tunnel glows from the park side too)
    const sm = new t.MeshStandardMaterial({
      color: paletteAt(ti),
      emissive: paletteAt(ti),
      emissiveIntensity: 0.2,
      roughness: 0.4,
      side: t.DoubleSide,
    });
    g.add(openRibbon(t, sub, -TUN_W + 0.03, 0.02, -TUN_W + 0.03, 0.14, sm));
    g.add(openRibbon(t, sub, TUN_W - 0.03, 0.14, TUN_W - 0.03, 0.02, sm));
    [-1, 1].forEach((s) => g.add(openRibbon(t, sub, s * (TUN_W + 0.05), TUN_H - 0.14, s * (TUN_W + 0.05), TUN_H - 0.02, sm)));
    stripMats.push(sm);
  });
  if (tunnelRibs.length) g.add(mergedParts(t, tunnelRibs, mat(t, GRAPHITE, { tex: 'metal', metal: 0.28, rough: 0.45 })));

  // =========================================================================
  // 4. THE NEON HOOPS — dense inside the tunnels, gates along the open track
  // =========================================================================
  const hoops: Hoop[] = [];
  const hoopGeo = new t.TorusGeometry(HOOP_R, 0.07, 6, 20, Math.PI);
  const collarParts: PartSpec[] = [];
  const addHoop = (i: number, seq: number, colour: number) => {
    const f = fb.frames[i];
    const m = new t.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.2, roughness: 0.35 });
    const arch = new t.Mesh(hoopGeo, m);
    arch.applyMatrix4(basisOf(f, HOOP_Y));
    arch.castShadow = false;
    g.add(arch);
    // two struts from the arch feet down PAST the rail onto the tie line, so
    // nothing floats. The feet now spring 0.22 ABOVE the rail (see HOOP_Y), so
    // the strut is the full drop to −0.26, not the old stub of 0.16.
    const STRUT = HOOP_Y + 0.26;
    [-1, 1].forEach((s) =>
      collarParts.push({
        geo: new t.BoxGeometry(0.08, STRUT, 0.08),
        matrix: basisOf(f, HOOP_Y).multiply(new t.Matrix4().makeTranslation(s * HOOP_R, -STRUT / 2, 0)),
      }),
    );
    // `p` is the TRAIN-PROXIMITY reference, deliberately NOT the crown: the flare
    // curve `exp(−1.6·d²)` was tuned against a d of ~0.6 from the car ORIGIN
    // (which rides 0.195 above the rail), and hanging it on the crown at 1.20
    // would have quietly halved the blaze the ride is named for.
    hoops.push({ m, p: f.p.clone().addScaledVector(f.up, 0.8), seq, ph: hash01(i * 7 + 3) });
  };
  // inside each tunnel: a rib every 4 frames (~0.6 u), NUMBERED so they chase
  tunnels.forEach(([a, b], ti) => {
    let seq = 0;
    for (let i = a + 2; i <= b - 2; i += 4) {
      addHoop(i, seq, paletteAt(ti + seq));
      seq += 1;
    }
  });
  // free-standing gates elsewhere, spaced ~4.5 u apart and never on a mouth
  {
    let since = 1e9;
    for (let i = 0; i < N; i += 1) {
      since += fb.total / N;
      const nearMouth = tunnels.some(([a, b]) => Math.abs(i - a) < 6 || Math.abs(i - b) < 6);
      if (inTunnel(i) || nearMouth || i / N < 0.05) continue;
      if (since < 4.5) continue;
      addHoop(i, -1, paletteAt(i));
      since = 0;
    }
  }
  if (collarParts.length) g.add(mergedParts(t, collarParts, mat(t, GRAPHITE_D, { tex: 'metal', metal: 0.3, rough: 0.45 })));

  // =========================================================================
  // 5. THE STATION — a club front beside the station straight
  // =========================================================================
  const canopyMats: THREE.MeshStandardMaterial[] = [];
  const wooferGroups: THREE.Group[] = [];
  const lights: THREE.PointLight[] = [];
  let sign: { group: THREE.Group; update: (time: number) => void } | null = null;
  {
    const st = fb.frames[0];
    const yard = new t.Group();
    yard.position.set(st.p.x, 0, st.p.z);
    yard.rotation.y = Math.atan2(st.fwd.x, st.fwd.z);
    g.add(yard);
    // yard-local: +z runs along the station straight, +x is the BOARDING side
    // (world +z — the face the queue lane and the huts come in on)
    const deckTop = st.p.y + 0.02; // just under the rail tops
    const DX = 1.05; // platform centre: inner edge 0.55 clears the tie ends
    yard.add(box(t, [1.0, 0.1, 3.0], CONCRETE, [DX, deckTop - 0.05, 1.3], { tex: 'concrete', repeat: [3, 8], rough: 0.94 }));
    const deck: MergedBoxSpec[] = [];
    deck.push({ dims: [1.04, 0.06, 3.04], pos: [DX, deckTop + 0.01, 1.3], repeat: [3, 8] }); // gloss deck plate
    [0.55, 1.55].forEach((x) => deck.push({ dims: [0.06, 0.16, 3.04], pos: [x, deckTop - 0.08, 1.3], repeat: [1, 8] })); // kerbs
    [0.2, 1.3, 2.4].forEach((z) =>
      [0.62, 1.48].forEach((x) => {
        deck.push({ dims: [0.12, deckTop - 0.12, 0.12], pos: [x, (deckTop - 0.12) / 2, z] }); // legs
        deck.push({ dims: [0.26, 0.05, 0.26], pos: [x, 0.025, z] }); // footings
      }),
    );
    [0, 1, 2].forEach((k) => deck.push({ dims: [0.8, 0.06, 0.26], pos: [1.15, 0.1 + k * 0.13, -0.5 + k * 0.13], repeat: [2, 1] })); // steps from the queue
    // GRAPHITE_D, not GLOSS: at night a pure-gloss deck under one PointLight
    // read as a hole in the ground and the platform vanished
    yard.add(mergedBoxes(t, deck, GRAPHITE_D, { tex: 'plastic', rough: 0.35 }));
    // chrome hand rail down the outer edge
    const rails: MergedBoxSpec[] = [];
    for (let k = 0; k < 7; k += 1) rails.push({ dims: [0.05, 0.5, 0.05], pos: [1.56, deckTop + 0.25, -0.1 + k * 0.48] });
    [0.34, 0.5].forEach((ry) => rails.push({ dims: [0.04, 0.04, 3.0], pos: [1.56, deckTop + ry, 1.3], repeat: [1, 8] }));
    yard.add(mergedBoxes(t, rails, CHROME, { tex: 'metal', metal: 0.32, rough: 0.3 }));
    // canopy: two steel masts, a chorded beam and a neon lip over the platform
    [0.35, 2.25].forEach((z) => {
      yard.add(cyl(t, 0.055, 0.075, 1.5, STEEL, [1.5, deckTop + 0.75, z], { tex: 'metal', repeat: [1, 4], metal: 0.24, rough: 0.42, seg: 12 }));
      yard.add(cyl(t, 0.09, 0.09, 0.05, CHROME, [1.5, deckTop + 1.0, z], { tex: 'metal', metal: 0.32, rough: 0.28, seg: 12 }));
    });
    // SLATTED canopy over the OUTER half of the deck only. A solid roof over the
    // whole platform hid the deck, the downlights and the parked train from
    // every park camera (the same lesson MagneticRide's station learned) — the
    // boarding edge stays open to the sky.
    const roof: MergedBoxSpec[] = [];
    [1.06, 1.64].forEach((x) => roof.push({ dims: [0.09, 0.11, 3.24], pos: [x, deckTop + 1.46, 1.3], repeat: [1, 9] })); // longitudinal beams
    for (let k = 0; k < 8; k += 1) roof.push({ dims: [0.66, 0.05, 0.12], pos: [1.35, deckTop + 1.53, -0.1 + k * 0.4], repeat: [2, 1] }); // slats
    yard.add(mergedBoxes(t, roof, STEEL, { tex: 'metal', metal: 0.24, rough: 0.42 }));
    const lipMat = new t.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 0.2, roughness: 0.4 });
    const lip = new t.Mesh(new t.BoxGeometry(0.06, 0.06, 3.2), lipMat);
    lip.position.set(1.0, deckTop + 1.45, 1.3);
    lip.castShadow = false;
    yard.add(lip);
    canopyMats.push(lipMat);
    // platform-edge light strip marking the car line
    const edgeMat = new t.MeshStandardMaterial({ color: MAGENTA, emissive: MAGENTA, emissiveIntensity: 0.22, roughness: 0.4 });
    const edge = new t.Mesh(new t.BoxGeometry(0.08, 0.02, 2.96), edgeMat);
    edge.position.set(0.6, deckTop + 0.05, 1.3);
    edge.castShadow = false;
    yard.add(edge);
    canopyMats.push(edgeMat);
    // two speaker stacks on the platform end (the district's own vocabulary)
    ([[0.95, -0.5], [0.95, 3.1]] as [number, number][]).forEach(([sx, sz], i) => {
      const st2 = new t.Group();
      st2.position.set(sx, deckTop + 0.04, sz);
      st2.rotation.y = Math.PI / 2; // cones face the platform
      yard.add(st2);
      st2.add(box(t, [0.44, 0.86, 0.38], GLOSS, [0, 0.47, 0], { tex: 'plastic', repeat: [2, 4], rough: 0.2 }));
      st2.add(box(t, [0.46, 0.05, 0.4], CHROME, [0, 0.92, 0], { tex: 'metal', metal: 0.32, rough: 0.28 }));
      st2.add(box(t, [0.36, 0.04, 0.03], i ? CYAN : MAGENTA, [0, 0.14, 0.195], { rough: 0.45 }));
      const wf = new t.Group();
      st2.add(wf);
      const cones: PartSpec[] = [];
      const caps: PartSpec[] = [];
      [0.38, 0.68].forEach((wy) => {
        cones.push({ geo: new t.CylinderGeometry(0.13, 0.075, 0.06, 16), matrix: mtx(t, [0, wy, 0.18], [Math.PI / 2, 0, 0]) });
        cones.push({ geo: new t.TorusGeometry(0.135, 0.014, 6, 18), matrix: mtx(t, [0, wy, 0.175]) });
        caps.push({ geo: new t.SphereGeometry(0.032, 10, 8), matrix: mtx(t, [0, wy, 0.192]) });
      });
      wf.add(mergedParts(t, cones, mat(t, 0x0b0b0e, { rough: 0.85 })));
      wf.add(mergedParts(t, caps, mat(t, 0x3c3f47, { rough: 0.5, metal: 0.3 })));
      wooferGroups.push(wf);
    });
    // three under-canopy downlights: emissive glass discs pooling on the deck
    // (the platform is all black gloss — without them the station reads unlit)
    [0.5, 1.3, 2.1].forEach((z) => {
      const dm = new t.MeshStandardMaterial({ color: 0xdfe6ff, emissive: 0x9fbcd8, emissiveIntensity: 0.2, roughness: 0.35 });
      yard.add(box(t, [0.16, 0.06, 0.16], GRAPHITE, [1.06, deckTop + 1.38, z], { tex: 'metal', metal: 0.28, rough: 0.45 }));
      const glass = new t.Mesh(new t.CylinderGeometry(0.075, 0.075, 0.03, 12), dm);
      glass.position.set(1.06, deckTop + 1.33, z);
      glass.castShadow = false;
      yard.add(glass);
      canopyMats.push(dm);
    });
    // compact control cabin ON the deck at the brake end (the first cut put a
    // 0.78 × 1.05 box on the grass beside the platform and it read as a crate)
    const cab = new t.Group();
    cab.position.set(1.18, deckTop + 0.04, 2.86);
    cab.rotation.y = -0.35;
    yard.add(cab);
    cab.add(box(t, [0.56, 0.78, 0.5], GLOSS, [0, 0.39, 0], { tex: 'plastic', repeat: [2, 3], rough: 0.2 }));
    cab.add(box(t, [0.62, 0.05, 0.56], CHROME, [0, 0.8, 0], { tex: 'metal', metal: 0.32, rough: 0.28 }));
    const winMat = new t.MeshStandardMaterial({ color: CYAN, emissive: 0x1f8fa3, emissiveIntensity: 0.2, roughness: 0.25, transparent: true, opacity: 0.6 });
    const win = new t.Mesh(new t.BoxGeometry(0.02, 0.28, 0.38), winMat);
    win.position.set(-0.29, 0.56, 0);
    cab.add(win);
    canopyMats.push(winMat);
    // the ONE station PointLight, under the canopy
    const stLight = new t.PointLight(0xdfe6ff, 0, 5, 2);
    stLight.position.set(1.0, deckTop + 1.35, 1.3);
    yard.add(stLight);
    lights.push(stLight);
    // the BASSLINE marquee on the canopy fascia, facing the queue (+x local)
    sign = buildNeonSign(t, { text: 'BASSLINE', color: CYAN, secondary: MAGENTA, scale: 0.3, backboard: true });
    sign.group.position.set(1.7, deckTop + 0.98, 1.3);
    sign.group.rotation.y = Math.PI / 2;
    yard.add(sign.group);
  }

  // =========================================================================
  // 6. HAZE at the tunnel mouths, so the hoop light has something to bite on
  // =========================================================================
  const hazes = tunnels.slice(0, 2).map(([a, b]) => {
    const f = fb.frames[Math.round((a + b) / 2)];
    const e = buildEmitter(t, {
      max: 60,
      rate: 7,
      life: 2.6,
      lifeVar: 0.7,
      velocity: [0, 0.12, 0],
      spread: 0.2,
      gravity: -0.01,
      size: 0.11,
      sizeEnd: 0.42,
      color: 0xd6ccff,
      colorEnd: 0x33265e,
      opacity: 0.18,
      additive: true,
    });
    e.setOrigin(f.p.x, f.p.y - 0.05, f.p.z);
    g.add(e.points);
    return e;
  });

  // =========================================================================
  // 7. THE TRAIN — 3 CoasterCars, real seats, real riders via seatWorld
  // =========================================================================
  const cars = Array.from({ length: carCount }, (_, i) =>
    buildCoasterCar(t, carCount === 1 || i === 0 ? 'front' : i === carCount - 1 ? 'end' : 'middle', CAR_LIVERY, { riders: withRiders }),
  );
  cars.forEach((car) =>
    COASTER_CAR_SEATS.forEach((sp) => {
      // anchors ride WITH the car, so real guests ride the train
      const anchor = new t.Group();
      anchor.position.set(0, sp.y, sp.z);
      car.add(anchor);
      seatAnchors.push(anchor);
    }),
  );
  extras.vehicle = cars[0]; // lead car — RideViewer onboard/follow cam
  const run = ride.run(cars, { spacing: CAR_SPACING, wheelOffset: 0.195 });

  // =========================================================================
  // 8. UPDATERS — lighting on the ABSOLUTE beat clock, the train on the gate
  // =========================================================================
  const WHITE = new t.Color(0xffffff);
  const carPos = new t.Vector3();
  const lighting = (time: number) => {
    const nk = smooth(nightKOf(g));
    const gain = 0.35 + 1.25 * nk;
    const step = beatStep(time);
    cars[0].getWorldPosition(carPos);
    hoops.forEach((h, i) => {
      // colour STEPS on the beat; inside a tunnel the hoops fire in SEQUENCE
      // (one per beat) so the light visibly runs down the bore
      const lit = h.seq >= 0 ? ((step - h.seq) % 4 + 4) % 4 === 0 : true;
      const col = paletteAt(h.seq >= 0 ? step + h.seq : step + i);
      // the train's own flare: a hoop blazes white as the train punches it
      const d = h.p.distanceTo(carPos);
      const flare = Math.exp(-1.6 * d * d);
      h.m.emissive.setHex(col).lerp(WHITE, 0.75 * flare);
      h.m.emissiveIntensity =
        (h.seq >= 0 ? (lit ? 0.28 + 1.9 * gain : 0.1 + 0.3 * gain) : 0.14 + 1.1 * gain * beatPulse(time, h.ph)) + 2.6 * flare * (0.35 + gain);
    });
    stripMats.forEach((m, i) => {
      const col = paletteAt(step + i * 2);
      m.color.setHex(col);
      m.emissive.setHex(col);
      m.emissiveIntensity = 0.18 + 1.15 * gain * beatPulse(time, i * 0.3);
    });
    canopyMats.forEach((m, i) => (m.emissiveIntensity = 0.18 + 0.85 * gain * beatPulse(time, 0.2 + i * 0.15)));
    wooferGroups.forEach((wf, i) => {
      wf.position.z = 0.014 * beatKick(time, i * 0.05) - 0.004;
    });
    lights.forEach((l) => (l.intensity = nk * 0.85));
    cars.forEach((c) => gateCarLights(c, nk));
    sign?.update(time);
    hazes.forEach((h) => h.update(time));
  };

  // =========================================================================
  // 8b. THE STATION LOCK — ⚠️ `rideDuration` IS NOT THE LAP
  // =========================================================================
  // This shipped as `createMotionGate((clock) => run(clock))` with
  // `rideDuration: 13` against a "12.9 s" lap, on the reasoning that one
  // dispatch should be one circuit. It is not, and the train parked somewhere
  // new every single time. TWO independent errors, both measured
  // (`/tmp/mp3d-render/aud-pd-cycle.tsx`):
  //
  // 1. THE GATE CLOCK ADVANCES MORE THAN `rideDuration`. createMotionGate keeps
  //    integrating through the spin-UP of `departing` — whose length is
  //    `loadTime`, which configurableRide.tsx:907 defaults to **1.6**, not the
  //    FSM's bare 1.0 — and through the eased brake of `arriving` (1.0 s) AND
  //    of `movingToEndOfStation` (1.0 s), which is also a target-0 EASED state.
  //    Measured advance per dispatch at `rideDuration` 13: **14.891 (dt 1/60) /
  //    14.894 (1/30) / 14.897 (1/20) / 14.906 (1/10)** — i.e.
  //    rideDuration + 1.894 — against a true lap of **12.742 s** (measured by
  //    running ungated until the lead seat returns, not read off the compile
  //    report's 12.9). That is 2.15 s = **8.2 u of track of overshoot EVERY
  //    dispatch.** The nearest seat's distance from the ride's own `board`
  //    point over 9 cycles at dt = 1/30 was
  //        1.04 · 3.97 · 7.14 · 14.07 · 7.14 · 5.03 · 0.38 · 3.14 · 6.16 u
  //    so guests boarded a train that was up to 14 u away, out in the tunnels.
  //
  // 2. THE ERROR IS FRAME-RATE DEPENDENT. `makeGuardedRun` clamps its OWN dt to
  //    0.06, so handing it one 0.1-s frame advances the train 0.06 — under
  //    swiftshader (the manager clamps dt to 0.1) the train covers ~60 % of
  //    what the clock says. At dt = 1/10 the same 9 cycles came back as
  //        0.83 · 6.82 · 10.95 · 3.31 · 1.89 · 11.25 · 6.16 · 1.11 · 6.96 u
  //    — a completely different sequence, so any `rideDuration` tuned at one
  //    frame time is an artefact of that frame time. (`WyrmsHollow` §8b found
  //    both halves of this first; this is the same fix, and the same reason
  //    correcting `rideDuration` ALONE is not one.)
  //
  // THE FIX, three parts:
  //   * SUBSTEP THE RUNNER — rail time reaches `run()` in ≤ 50 ms slices, so
  //     the integration is identical at every frame time.
  //   * THE TRAIN BRAKES INTO ITS STATION AND HOLDS — rail time stops
  //     advancing on the frame AFTER the lead car passes closest approach to
  //     the parked pose (holding on first contact with a threshold ball would
  //     stop it a whole car short), and resumes only on dispatch. The TUNNELS
  //     and every other emissive keep running on absolute time, so a held
  //     train reads as a train that has arrived, not as a dropped frame.
  //   * `rideDuration` 13 → **11.5**, so the dispatch lands just PAST the
  //     parked pose (11.5 + 1.894 = 13.39 vs a 12.742 s lap = 0.65 s of
  //     overshoot) and the brake has something to absorb. Do NOT raise it back
  //     toward the lap: the lock needs that overshoot at every dt.
  //
  // The parked pose is DERIVED, not guessed: scan the circuit for the arc
  // nearest the `board` the composable publishes, then LEAD it by the seat
  // band's mean offset behind the lead car ((cars−1)/2 · spacing − mean seat z)
  // so the whole train straddles the platform instead of the head alone
  // sitting on it.
  const boardLocal = new t.Vector3(...BOARD);
  let sBoard = 0;
  let sBoardD = Infinity;
  for (let i = 0; i < 720; i += 1) {
    const d = ride.frameAt(i / 720).p.distanceTo(boardLocal);
    if (d < sBoardD) {
      sBoardD = d;
      sBoard = (i / 720) * fb.total;
    }
  }
  // mean COASTER_CAR_SEATS z is +0.02 (seats at +0.24 / −0.20), i.e. a hair
  // AHEAD of each car's origin, so it comes off the lead distance
  const meanSeatZ = COASTER_CAR_SEATS.reduce((a, s) => a + s.z, 0) / COASTER_CAR_SEATS.length;
  const trainMid = ((carCount - 1) / 2) * CAR_SPACING - meanSeatZ;
  const stopU = ((((sBoard + trainMid) / fb.total) % 1) + 1) % 1;
  const stopP = ride.frameAt(stopU).p.clone();
  g.userData.stationStop = { u: stopU, at: [stopP.x, stopP.y, stopP.z] }; // probes assert on the real value

  // RCT2 station behaviour: the train WAITS in the station while guests board
  // and brakes to a stop on arrival (Vehicle.cpp status cycle). Only the TRAIN
  // is gated — the district's light show runs on absolute time, so the tunnels
  // keep pulsing while the ride is parked (and previews stay ungated).
  // PRIME THE POSE. `makeGuardedRun` starts the train at the CHAIN-LIFT base
  // when the lift is long enough (`u0 = liftStart/N`), which on this circuit is
  // not the platform: unprimed, the FIRST dispatch's parked pose measured
  // 1.05 u / mean 2.37 from `board` where every later one measures 0.42 / 0.95.
  // So walk the same substepped runner forward at build time until the lead car
  // passes closest approach to `stopP` — the identical arithmetic the lock uses
  // below, so cycle 1 and cycle 9 are the same pose. Cars are placed in the
  // SPLINE's local frame (`place()` writes `c.position` straight from
  // `frameAt`), so `cars[0].position` is directly comparable to `stopP` with no
  // matrixWorld update anywhere.
  let railT = 0; // rail time: the gate clock MINUS every held second
  let primedT = 0; // …the value of it at the parked pose
  {
    let prime = 0;
    let dPrev = Infinity;
    let armedP = false;
    let leftP = false; // the runner STARTS 0.77 u from stopP (u0 is the lift
    // base, which on this circuit is 0.6 u past the station) — without this
    // latch the loop armed and broke on its second slice, primedT came out at
    // 0.10 and the first parked pose measured mean 1.571 instead of 0.948
    for (let i = 0; i < 1600; i += 1) {
      prime += 0.05;
      run(prime);
      const d = cars[0].position.distanceTo(stopP);
      if (!leftP && d > 4) leftP = true;
      if (leftP) {
        if (armedP && d > dPrev) break;
        if (d < 1.6) armedP = true;
      }
      dPrev = d;
    }
    railT = prime;
    primedT = prime;
    g.userData.stationPrimedT = primedT;
  }
  let fedT = railT; // rail time already handed to the runner
  let lastClock: number | null = null;
  let gated = false; // only a REGISTERED ride parks — a preview runs free
  // a registered train is HELD on its platform from the first frame: see
  // `registered` in BasslineOpts for why the gate cannot tell us this itself
  let holding = opts.registered ?? false;
  let armed = false;
  let prevD = Infinity;
  let sinceDispatch = 0;
  const gate = createMotionGate(
    (clock) => {
      const dc = lastClock === null ? 0 : Math.max(0, clock - lastClock);
      lastClock = clock;
      if (!holding) {
        railT += dc;
        sinceDispatch += dc;
      }
      // ⚠️ SUBSTEP. makeGuardedRun integrates with its OWN dt = min(0.06,
      // time − last), so any frame longer than 60 ms silently advances the
      // train less than the clock it was handed. ≤ 50 ms slices are the same
      // integration at any frame rate. run() is still called once per frame
      // while holding, which simply re-writes the parked pose.
      const steps = Math.max(1, Math.ceil((railT - fedT) / 0.05));
      for (let i = 1; i <= steps; i += 1) run(fedT + ((railT - fedT) * i) / steps);
      fedT = railT;
      // the brake: hold the frame AFTER closest approach. `sinceDispatch > 6`
      // keeps the arm from firing on the station straight the train is still
      // leaving, and 1.6 is under half the 3.4-u radius of the nearest turn, so
      // nothing else on this circuit can arm it.
      if (gated && !holding && sinceDispatch > 6) {
        const d = cars[0].position.distanceTo(stopP);
        if (armed && d > prevD) holding = true;
        if (d < 1.6) armed = true;
        prevD = d;
      }
      g.userData.stationHold = holding;
      g.userData.railT = railT;
    },
    { spinDown: 1.6 },
  );
  let everDispatched = false;
  const onStateChange = (state: string) => {
    if (state === 'departing' || state === 'travelling') {
      everDispatched = true;
      holding = false;
      armed = false;
      prevD = Infinity;
      sinceDispatch = 0;
    } else if (!everDispatched) {
      // BEFORE THE FIRST DISPATCH the train stays where the build primed it —
      // `registerRide` constructs the rec already in `movingToEndOfStation`
      // WITHOUT calling `setState`, so this handler does not even run until that
      // timer expires, and an eased `movingToEndOfStation` would otherwise walk
      // the train 2.6 u off its platform before anybody boards. (Measured
      // unheld: first parked pose 1.18 u / mean 2.49 from `board`, against
      // 0.42 / 0.95 for every later cycle.) `makeGuardedRun`'s internal clock
      // is MONOTONIC — it cannot be rewound — so this is a hold, not a reset.
      holding = true;
    }
    gated = true;
    gate.onStateChange(state);
  };
  const update = (time: number) => {
    gate.update(time); // train first: the hoop flare reads its live position
    lighting(time);
  };

  return { group: g, update, seatWorld: makeSeatWorld(t, seatAnchors), onStateChange, ...extras };
}

const BasslineBase = composableRide<BasslineOpts & { register?: boolean }>(
  'Bassline',
  (t, props) =>
    buildBasslineScene(t, {
      pieces: props.pieces,
      points: props.points,
      cars: props.cars,
      groundAt: props.groundAt,
      riders: props.riders ?? !props.register,
      registered: !!props.register,
    }),
  {
    // the circuit's station straight runs along the local −x and the whole loop
    // hangs off local −z, so the +z face is free: queue HEAD 2.2 out the front,
    // exit hut beside the brake tail, boarding on the platform at rail level
    front: 2.2,
    exit: [1.7, 1.9],
    board: BOARD,
    // ⚠️ rideDuration 11.5, NOT the 12.742 s lap — see §8b THE STATION LOCK in
    // buildBasslineScene. The gate clock advances rideDuration + 1.894 per
    // dispatch, so 11.5 puts the train 0.65 s PAST its parked pose and the
    // brake absorbs the rest. Raising it back toward the lap re-breaks it.
    defaults: { name: 'Bassline', capacity: 6, rideDuration: 11.5, intensity: 5, price: 5 },
  },
);

/** <Bassline> — the Pulse District's neon coaster as a composable ride
 *  (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride via <ConfigurableRide> —
 *  queue HEAD 2.2 out the local +z front (the face the circuit deliberately
 *  keeps clear), exit hut at local [1.7, 1.9], boarding on the gloss platform.
 *  Capacity 6 = 3 cars × 2 REAL CoasterCar seats: guests ride via `seatWorld`
 *  (decorative riders off when registered), the lead car is the ride `vehicle`
 *  (onboard cam) and `crashed` reports the live 1.5 g derail guard.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Lift/><HelixR/>…` — children win) are compiled by
 *  `compileTrackPieces` (`profile: 'coaster'`, `type: 'steel'`, bank 0.24) and
 *  swept by `buildRideSpline`; `points` is the raw-control-point escape hatch.
 *  No pieces = the stock "Sub Bass Circuit" (zero synthesized closure, worst
 *  clearance 2.91, lateral 1.10 g, 48.3 u lap in 12.9 s). A FATAL compile marks
 *  the build `invalid` (no registration). The light TUNNELS are auto-placed on
 *  the two longest straight, level spans of whatever circuit is compiled, so a
 *  custom layout gets its own tunnels; every hoop pulses on the district's
 *  shared ~2.2 Hz beat and flares as the train punches through it. */
export const Bassline: React.FC<ComposableRideProps & BasslineOpts & { children?: React.ReactNode }> = ({ children, pieces, ...rest }) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <BasslineBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
