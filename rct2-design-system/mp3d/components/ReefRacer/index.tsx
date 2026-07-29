import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { buildRideSpline, compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildWater, buildWaterRibbon } from '../WaterTile';
import { buildEmitter } from '../ParticleKit';
import { buildRock } from '../Rock';
import { hash01 } from '../ColorKit';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// ---------------------------------------------------------------------------
// ReefRacer — "Reef Racer", the flagship of TIDEWATER HOLLOW: an RCT2 WATER
// COASTER whose boats climb a chain lift out of a shallow reef lagoon, plunge
// 5.6 units back into it, and run home THROUGH a broken sailing ship that went
// aground on the reef.
//
// SAME SPLINE MACHINERY as every other tracked ride: `compileTrackPieces`
// compiles the circuit, `buildRideSpline` sweeps the channel and `run` drifts
// the boat and plunges it down the chute. Everything else here is THEMING
// derived from frame scans, so the wreck, the lagoon, the reef and the station
// all re-place themselves around ANY layout passed in `pieces` / piece
// children.
//
// WHY THE 'flume' PROFILE FOR A WATER COASTER. `ride/rtd/coaster/WaterCoaster.h`
// gives the ride type TWO track drawers: `TrackStyle::waterCoaster` on metal
// fork supports for the dry sections, and `TrackStyle::splashBoats` on
// `WoodenSupportType::truss` for the FLOODED sections (the second construction
// tab, STR_RIDE_CONSTRUCTION_WATER_CHANNEL_TIP). The kit's `'flume'` profile is
// exactly that second drawer — a wooden U-channel trough carrying a water strip
// on trestle supports — and its `.NameConvention` first component is
// `RideComponentType::Boat`. The kit's `'coaster'` profile draws bare RAILS and
// runs the energy-paced train physics with the 1.5 g derail guard: at DS camera
// distance that reads as "a coaster train has lost its track", not as boats
// racing over water. So: flooded channel throughout, `'flume'` pacing (drift,
// plunging on the drops — how a boat actually behaves), wooden truss supports.
// The layout, though, is a WATER COASTER's and not a log flume's: WaterCoaster.h
// enables `TrackGroup::liftHill`, `slopeSteepUp` AND `slopeSteepDown`, where
// `water/LogFlume.h:26` and `water/SplashBoats.h:27` only have `slopeSteepDown`
// — so Reef Racer gets ONE steep 34.8° CHAIN LIFT instead of a log flume's long
// gentle conveyor, and gives the whole 5.6 units back in ONE 34.8° plunge.
//
// WHAT MAKES IT REEF RACER: a **broken sailing ship** in two pieces on the
// reef. The main hull lies across the home stretch, listing 9°, its side stove
// in below the waterline — and the boats run STRAIGHT THROUGH the breach, under
// broken deck beams and a hanging ship's lantern, past exposed frames and a
// snapped mainmast with tattered rigging. Her severed BOW SECTION is reared up
// on a coral head at the foot of the plunge with the bowsprit spearing right
// across the channel, so the boats shoot UNDER it seconds after splashdown.
// Around all of it: a shallow reef LAGOON (one `buildWater` sheet on the
// component's own pale coral-sand bed — the palette is WaterTile's own
// desaturated blue-grey, and the turquoise read comes from the sand showing
// through 0.15 of water, not from a re-saturated shader), coral heads, sand
// banks breaking the surface, scattered reef rock, wreck debris and a sand SPIT
// the station jetty stands on.
//
// Budget: 4 real PointLights, ALL night-gated (station jetty, the wreck's
// hanging lantern over the passage, the bowsprit lantern, the summit channel
// marker); 2 ParticleKit emitters / 150 particles; every static repeat (sand
// apron, reef, hull ironwork, rigging blocks, deck fittings, station) batched
// through `mergedBoxes`; fine litter tagged `userData.lodDetail`.
// Deterministic — hashed sines only, absolute-time updater.
// ---------------------------------------------------------------------------

/** the compiled station straight runs along the local −x, which leaves the
 *  local +z face (where <ConfigurableRide> puts the queue lane and the huts)
 *  clear of the circuit — every turn in the stock layout is a RIGHT turn, so
 *  the whole loop lives in the local −z half-plane. */
const HEADING = -Math.PI / 2;
/** station rail height above the local ground */
const START: [number, number, number] = [0, 0.6, 0];

/**
 * "Wreck Reef Run" — the shipped layout. Four legs of a rectangle:
 *   A (−x)  station · lead-in · the CHAIN LIFT (5.6 u in one flight, 34.8°)
 *   B (−z)  the level SUMMIT RUN along the reef crest
 *   C (+x)  THE PLUNGE — all 5.6 units back in one 34.8° drop — · splashdown
 *           run-out, which passes UNDER the wreck's bowsprit
 *   D (+z)  the low home stretch, which the BROKEN HULL straddles
 *   → a 1.2-u brake tail landing back on the station axis.
 *
 * ONE lift and ONE drop is deliberate: `rampPoints` spends ~11.9 u of run on a
 * 5.6-u grade change whatever you split it into (the pitch-rate ceiling
 * stretches the eased transitions), so two smaller drops cost 40 % MORE
 * footprint than one big one — and a water coaster wants the single plunge
 * anyway.
 *
 * ⚠️ WHY 5.6 AND NOT MORE (the "make it dangerous" pass). Both legs A and C
 * carry exactly ONE ramp of the same height, so raising the pair leaves the
 * x-closure untouched and the circuit still shuts with ZERO synthesized track —
 * the height is free to tune. It is capped by RideRatings, not by the geometry:
 * swept 4.4 → 7.4 on the kit's own checks, the plunge steepens 32.0° → 37.4°
 * and `rateCoaster` intensity climbs 4.9 → 7.6 → 12.5, but EXCITEMENT falls off
 * a cliff between 5.6 and 6.2 (3.13 → 1.14) because the energy replay's
 * maxLatG crosses RideRatings.cpp's 3.10 g penalty step there (2.86 → 3.16).
 * 5.6 is the last rung before that cliff: +27 % of drop and +2.8° of pitch for
 * a footprint that grows 19.2 → 20.8 in x and nothing else. Compile numbers at
 * 5.6: design clean, worst clearance 3.56, closure closed, zero synthesized.
 * A camelback spliced into the summit was tried and REVERTED — it compiles
 * clean but the flume drift is too slow at the crest to produce any airtime
 * (vertical G unchanged at 0.82…1.92) and it cost 1.6 points of excitement.
 */
const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.5 },
  { type: 'lift', height: 5.6 }, // THE CHAIN LIFT — 34.8°, advance 11.87
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'straight', length: 9.0 }, // the summit run along the reef crest
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'drop', height: 5.6 }, // THE PLUNGE — 34.8°, advance 11.87
  { type: 'straight', length: 4.6 }, // splashdown run-out (under the bowsprit)
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'straight', length: 9.0 }, // the home stretch — THROUGH the wreck
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'straight', length: 1.2 }, // brake tail onto the station axis
];

// ---- palette (Tidewater Hollow) --------------------------------------------
/** RCT2 TrackColour for the flooded channel. WaterCoaster.h's first
 *  ColourPreset is darkGreen / darkGreen / black: a brine-stained green trough
 *  with bleached driftwood rim rails on tarred timber trestles. */
const TRACK_COLOURS: TrackScheme = { main: 0x47624f, additional: 0x8a7c66, supports: 0x6a5a44 };
/** the boat: brine-green topsides, weathered cream sheer stripe, brass */
const BOAT_LIVERY: VehicleScheme = { body: 0x2f6f68, trim: 0xc4bda2, tertiary: 0x9c7a3c };

/**
 * The boat's speed multiplier on the kit's flume pace, set so ONE LAP OF THE
 * STOCK CIRCUIT TAKES EXACTLY ONE FSM CYCLE — which is NOT the same as taking
 * `rideDuration`, and that difference is the whole reason this constant is
 * derived rather than guessed.
 *
 * `createMotionGate` advances the runner's clock by `dt · speed`. `travelling`
 * runs at speed 1 for `rideDuration`, but `departing` (eased 0→1 over spinUp
 * 0.8) and `arriving` (eased 1→0 over spinDown 1.6) advance it too, and the ride
 * FSM counts neither as ride time. Measured against a bare gate driven through
 * the real state sequence (rideFsm.ts:124-195), one cycle hands the runner
 * **23.291 s** of clock for a `rideDuration` of 22 — a surplus of **1.291 s**.
 *
 * So the cycle-true lap is `rideDuration + GATE_SURPLUS`, and the unscaled drift
 * pace closes this loop in 57.22 s (probe: tw-lap.tsx). Tuning to 22 instead
 * leaves the boat creeping ~2.9 u further round the circuit every cycle; tuning
 * to 23.291 parks it back on the jetty every time (probe: tw-cycletrue.tsx).
 *
 * Re-measure both numbers if `DEFAULT_PIECES` changes. A caller passing custom
 * `pieces` keeps this scale and will read a different lap — that is a known
 * limitation of a single constant, and the reason it is named.
 */
const GATE_SURPLUS = 1.89;
/** the stock circuit's lap at `speedScale` 1, measured by running the ungated
 *  build at dt 1/200 until the boat comes back to where it started */
const LAP_UNSCALED = 60.1;
/** how far PAST the parked pose one dispatch is aimed, in seconds of rail
 *  time. The station lock brakes the boat on closest approach, so it needs
 *  overshoot to absorb — tuned to land exactly, the boat stops SHORT. */
const LAP_OVERSHOOT = 0.7;
const LAP_SCALE = LAP_UNSCALED / (22 + GATE_SURPLUS - LAP_OVERSHOOT);
/** the boarding point <ConfigurableRide> publishes — the station lock derives
 *  the parked pose from it rather than from a hand-picked `u` */
const BOARD: [number, number, number] = [-1.3, 0.6, 0];

const SAND = 0xd6cca6; // dry coral sand
const SAND_2 = 0xc2b68d; // the second sand tone — mottling, so the apron never
const SAND_WET = 0xb3a681; // reads as paving; the awash band at the waterline
const SAND_BED = 0xcfc49c; // the lagoon bed (pale — this is the turquoise read)
const REEF = 0x8f846c; // reef rock — sun-bleached, NOT basalt grey
const REEF_D = 0x776a54;
const TIMBER = 0x8a7d66; // bleached, salt-weathered ship timber
const TIMBER_D = 0x6d6152; // older / shadowed planking
const TAR = 0x2b2622; // tarred bottom planking, tarred rope
const IRON = 0x3a4a48; // Tidewater ironwork
const RUST = 0x7a4a2c; // rusted straps, chain, pintles
const BRASS = 0x9c7a3c;
const CANVAS = 0xd7d0b8; // sailcloth
const ROPE = 0x8a7a58;
const WEED = 0x434b3b; // dark weed at the waterline
const BARNACLE = 0xc6bda6;
const LAMP_GLASS = 0xfff4d2;
const LAMP_GLOW = 0xffb84c;
/** desaturated coral tones — brain, fire, sea-fan, soft purple */
const CORAL: number[] = [0xa8805f, 0x99655a, 0x7d8f99, 0x896f76, 0xb09a72];

// ---------------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------------

/** one merged box spanning A → B (its Y axis runs along the bar) — spars,
 *  raking timbers, beams: the same trick SplineCoaster's trestles use */
function barSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, thick: number, repeat?: [number, number]): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  const m = new t.Matrix4().makeRotationFromQuaternion(
    new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
  );
  m.setPosition(a.clone().addScaledVector(dir, 0.5));
  return { dims: [thick, len, thick], matrix: m, ...(repeat ? { repeat } : {}) };
}

/** a FLAT blade spanning A → B (palm fronds): its width axis is kept
 *  horizontal, so a frond reads as a leaf and not as a green joist */
function bladeSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, w: number, thick: number): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  dir.normalize();
  const side = new t.Vector3().crossVectors(new t.Vector3(0, 1, 0), dir);
  if (side.lengthSq() < 1e-5) side.set(1, 0, 0);
  side.normalize();
  const up2 = new t.Vector3().crossVectors(dir, side).normalize();
  const m = new t.Matrix4().makeBasis(side, dir, up2);
  m.setPosition(a.clone().addScaledVector(dir, len * 0.5));
  return { dims: [w, len, thick], matrix: m, repeat: [1, 2] };
}

/** a TAPERED round spar between two points (masts, bowsprits, yards) */
function spar(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, colour: number): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = Math.max(0.05, dir.length());
  const m = cyl(t, r1, r0, len, colour, [0, 0, 0], { tex: 'wood', repeat: [3, Math.max(1, Math.round(len * 1.6))], rough: 0.9, seg: 10 });
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}

/** a SAGGING line (shroud, stay, chain, mooring rope) between two points */
function line(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, sag: number, r: number, material: THREE.Material): THREE.Mesh {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y -= sag;
  const m = new t.Mesh(new t.TubeGeometry(new t.CatmullRomCurve3([a, mid, b]), 12, r, 5, false), material);
  m.castShadow = true;
  return m;
}

/**
 * Loft a hull-style surface from a list of cross-SECTIONS (each a list of
 * local `[x, y]` points at its own z), over the section index range `i0…i1`.
 * UVs are (girth, along-z) in WORLD units × `uvScale`, so a 'wood' texture's
 * grain runs FORE-AND-AFT — i.e. it reads as PLANKING.
 */
function loft(
  t: typeof THREE,
  stations: { z: number; pts: [number, number][] }[],
  i0: number,
  i1: number,
  material: THREE.Material,
  uvScale: number,
): THREE.Mesh {
  const rows = stations.length;
  const cols = i1 - i0 + 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const zArc: number[] = [0];
  for (let r = 1; r < rows; r += 1) zArc.push(zArc[r - 1] + Math.abs(stations[r].z - stations[r - 1].z));
  for (let r = 0; r < rows; r += 1) {
    const st = stations[r];
    let girth = 0;
    for (let c = i0; c <= i1; c += 1) {
      const [x, y] = st.pts[c];
      if (c > i0) {
        const [px, py] = st.pts[c - 1];
        girth += Math.hypot(x - px, y - py);
      }
      pos.push(x, y, st.z);
      uv.push(girth * uvScale, zArc[r] * uvScale);
    }
  }
  for (let r = 0; r < rows - 1; r += 1)
    for (let c = 0; c < cols - 1; c += 1) {
      const a = r * cols + c;
      idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  const g = new t.BufferGeometry();
  g.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new t.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * A TATTERED canvas panel hanging from a yard: a grid whose bottom edge is
 * torn away per column (hashed) and which billows out along its span, so it
 * reads as a shredded sail rather than a flat rectangle. Local origin is the
 * top centre; the panel hangs down −y and billows along +z.
 */
function raggedSail(t: typeof THREE, w: number, h: number, seed: number, material: THREE.Material): THREE.Mesh {
  const COLS = 7;
  const ROWS = 5;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const tear: number[] = [];
  for (let i = 0; i <= COLS; i += 1) tear.push(h * (0.28 + 0.72 * hash01(seed * 3.1 + i * 7.7)));
  for (let i = 0; i <= COLS; i += 1) {
    const fx = i / COLS;
    const x = -w / 2 + w * fx;
    for (let j = 0; j <= ROWS; j += 1) {
      const fy = j / ROWS;
      // billow: a half-sine across the span growing toward the free foot, plus
      // a hashed flutter so no two panels hang alike
      const bill = 0.26 * h * Math.sin(Math.PI * fx) * fy + 0.05 * h * Math.sin(fx * 9.1 + seed) * fy;
      pos.push(x, -tear[i] * fy, bill);
      uv.push(fx * 2, fy * 2);
    }
  }
  for (let i = 0; i < COLS; i += 1)
    for (let j = 0; j < ROWS; j += 1) {
      const a = i * (ROWS + 1) + j;
      const b = a + ROWS + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new t.BufferGeometry();
  g.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new t.Mesh(g, material);
  m.castShadow = true;
  return m;
}

/** a small brass-caged ship's LANTERN: cage, glass globe, ring — the glass
 *  material is returned so the caller can night-gate it */
function shipLantern(t: typeof THREE, scale = 1): { group: THREE.Group; glass: THREE.MeshStandardMaterial } {
  const grp = new t.Group();
  const s = scale;
  grp.add(cyl(t, 0.07 * s, 0.05 * s, 0.05 * s, BRASS, [0, 0.16 * s, 0], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 8 })); // cap
  grp.add(cyl(t, 0.055 * s, 0.07 * s, 0.04 * s, BRASS, [0, -0.14 * s, 0], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 8 })); // base
  const cage: MergedBoxSpec[] = [];
  for (let k = 0; k < 4; k += 1) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    cage.push({ dims: [0.014 * s, 0.28 * s, 0.014 * s], pos: [Math.cos(a) * 0.055 * s, 0, Math.sin(a) * 0.055 * s] });
  }
  cage.push({ dims: [0.016 * s, 0.09 * s, 0.016 * s], pos: [0, 0.22 * s, 0] }); // hanger
  grp.add(mergedBoxes(t, cage, BRASS, { tex: 'metal', metal: 0.65, rough: 0.45 }));
  const globe = ball(t, 0.058 * s, LAMP_GLASS, [0, 0, 0], { emissive: LAMP_GLOW, rough: 0.3 });
  (globe.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
  grp.add(globe);
  return { group: grp, glass: globe.material as THREE.MeshStandardMaterial };
}

/** a lashed HAZARD BOARD — RCT2 parks warn you, and a warning is the cheapest
 *  menace there is. Bleached plank, a red diagonal stripe across it and a crude
 *  painted SKULL over two crossed bones, all box geometry (no glyph rendering:
 *  the design system has no text pipeline and a blurred texture reads worse
 *  than a symbol). `w` scales the whole board. */
function hazardBoard(t: typeof THREE, w = 1): THREE.Group {
  const grp = new t.Group();
  const W = 0.95 * w;
  const H = 0.5 * w;
  grp.add(box(t, [W, H, 0.05 * w], 0xcfc4a4, [0, 0, 0], { tex: 'wood', repeat: [4, 2], rough: 0.94, bump: 0.04 }));
  // the diagonal warning stripe
  const stripe: MergedBoxSpec[] = [];
  for (let k = -2; k <= 2; k += 1)
    stripe.push({ dims: [0.1 * w, H * 1.02, 0.012 * w], pos: [k * 0.19 * w, 0, -0.032 * w], rotZ: 0.55 });
  grp.add(mergedBoxes(t, stripe, 0x8e2f22, { tex: 'plastic', rough: 0.9 }));
  // skull + crossbones, in front of the stripe
  const bone: MergedBoxSpec[] = [
    { dims: [0.44 * w, 0.07 * w, 0.012 * w], pos: [0, -0.02 * w, -0.045 * w], rotZ: 0.42 },
    { dims: [0.44 * w, 0.07 * w, 0.012 * w], pos: [0, -0.02 * w, -0.045 * w], rotZ: -0.42 },
    { dims: [0.2 * w, 0.19 * w, 0.014 * w], pos: [0, 0.05 * w, -0.05 * w] }, // cranium
    { dims: [0.12 * w, 0.07 * w, 0.014 * w], pos: [0, -0.08 * w, -0.05 * w] }, // jaw
  ];
  grp.add(mergedBoxes(t, bone, 0xf0ead6, { tex: 'concrete', rough: 0.9 }));
  const eyes: MergedBoxSpec[] = [
    { dims: [0.05 * w, 0.055 * w, 0.01 * w], pos: [-0.045 * w, 0.07 * w, -0.058 * w] },
    { dims: [0.05 * w, 0.055 * w, 0.01 * w], pos: [0.045 * w, 0.07 * w, -0.058 * w] },
    { dims: [0.03 * w, 0.035 * w, 0.01 * w], pos: [0, 0.005 * w, -0.058 * w] },
  ];
  grp.add(mergedBoxes(t, eyes, 0x241f1c, { tex: 'plastic', rough: 0.95 }));
  return grp;
}

/** a SHARK: dorsal fin, a slice of back and the tip of the tail — everything a
 *  shark shows above water and nothing it does not. Cruises the lagoon off the
 *  splashdown on the SEA clock, so it keeps circling while the ride is parked. */
function buildSharkFin(t: typeof THREE): THREE.Group {
  const grp = new t.Group();
  const skin = { tex: 'plastic' as const, rough: 0.72 };
  // the back: a long low wedge just breaking the surface
  const back: MergedBoxSpec[] = [];
  for (let k = 0; k < 7; k += 1) {
    const f = k / 6;
    const w = 0.34 * Math.sin(Math.PI * (0.18 + 0.72 * f));
    back.push({ dims: [w, 0.09, 0.34], pos: [0, -0.02 - 0.012 * Math.abs(f - 0.5) * 2, 0.95 - f * 1.9], rotY: 0 });
  }
  grp.add(mergedBoxes(t, back, 0x4a5359, skin));
  // the dorsal fin — a raked triangle, built as a stack of narrowing slabs
  const fin: MergedBoxSpec[] = [];
  for (let k = 0; k < 9; k += 1) {
    const f = k / 8;
    fin.push({ dims: [0.05, 0.062, 0.4 * (1 - f) + 0.04], pos: [0, 0.035 + f * 0.42, 0.09 - f * 0.2] });
  }
  // the tail tip, well aft and canted the way a caudal fin sits
  for (let k = 0; k < 6; k += 1) {
    const f = k / 5;
    fin.push({ dims: [0.045, 0.055, 0.26 * (1 - f) + 0.03], pos: [0, 0.02 + f * 0.3, -1.02 - f * 0.12], rotX: -0.25 });
  }
  grp.add(mergedBoxes(t, fin, 0x3d464c, skin));
  grp.add(mergedBoxes(t, [{ dims: [0.05, 0.05, 0.16], pos: [0, 0.1, 0.86], rotX: 0.3 }], 0x9aa39f, skin)); // the pale wake off the fin's root
  return grp;
}

// ---------------------------------------------------------------------------
// THE BOAT — a clinker-built reef skiff, four abreast on hewn thwarts.
//
// The lofted-hull recipe (and the exact rocker/section maths) is the one
// verified for the flume profile: 15 cross-sections from a canoe stern
// (z −0.74) to a raked stem (z +0.76), each 9 points from the sheer down over
// the turn of the bilge to a slight keel vee, with ROCKER (the bottom rises
// 0.135 toward each end — this is what clears the plunge's pull-out) and SHEER
// (the gunwale rises toward the bow). Three lofts share those sections so the
// hull carries a hard boot-top line at the waterline: brine-green painted
// topsides above TARRED near-black planking below. Origin y = 0 is the thwart
// datum; the hull rides at `wheelOffset 0.25`, which puts the keel 0.05 above
// the trough floor and the waterline 0.11 up the tarred band.
// ---------------------------------------------------------------------------
const BOW = 0.76;
const STERN = -0.74;
const SEAT_Z = [-0.44, -0.15, 0.14, 0.43];
/** hips sit 0.45 × scale above a seated buildPeep's group origin (Teacups) */
const HIP_RISE = 0.45 * 0.42;
const THWART_TOP = 0.02;

const hwOf = (z: number) => Math.max(0.05, 0.255 * (1 - Math.min(1, Math.abs(z) / 0.85) ** 2.4));
const botOf = (z: number) => -0.3 + 0.135 * Math.min(1, Math.abs(z) / 0.78) ** 2;
const shrOf = (z: number) => 0.14 + (z > 0 ? 0.15 : 0.09) * Math.min(1, Math.abs(z) / 0.78) ** 2;
/** the 9-point cross-section at z: [sheer, mid, bilge, garboard, keel, …] */
function sectionAt(z: number): [number, number][] {
  const hw = hwOf(z);
  const b = botOf(z);
  const s = shrOf(z);
  const d = s - b;
  return [
    [-hw, s],
    [-hw * 0.93, b + 0.45 * d],
    [-hw * 0.78, b + 0.14 * d],
    [-hw * 0.5, b],
    [0, b - 0.02],
    [hw * 0.5, b],
    [hw * 0.78, b + 0.14 * d],
    [hw * 0.93, b + 0.45 * d],
    [hw, s],
  ];
}

export interface ReefBoatOpts {
  /** decorative seated riders (default true — <ReefRacer register> turns them
   *  OFF so REAL GameManager guests fill the thwarts through seatWorld) */
  riders?: boolean;
  /** seat anchors are pushed here in thwart order (bow-last), for seatWorld */
  seats?: THREE.Object3D[];
}

/** The reef skiff. Exported for parks composing their own fleets. */
export function buildReefBoat(t: typeof THREE, scheme?: VehicleScheme, opts: ReefBoatOpts = {}): THREE.Group {
  const boat = new t.Group();
  const PAINT = scheme?.body ?? BOAT_LIVERY.body!;
  const CUT = scheme?.trim ?? BOAT_LIVERY.trim!;
  const METAL = scheme?.tertiary ?? BRASS;
  const stations: { z: number; pts: [number, number][] }[] = [];
  for (let k = 0; k <= 14; k += 1) {
    const z = STERN + ((BOW - STERN) * k) / 14;
    stations.push({ z, pts: sectionAt(z) });
  }

  // ---- the hull: tarred bottom, painted topsides ----
  const tarMat = mat(t, TAR, { tex: 'wood', rough: 0.95, bump: 0.035 });
  tarMat.side = t.DoubleSide;
  boat.add(loft(t, stations, 1, 7, tarMat, 5));
  [
    [0, 1],
    [7, 8],
  ].forEach(([a, b]) => {
    const m = mat(t, PAINT, { tex: 'wood', rough: 0.7, bump: 0.026 });
    m.side = t.DoubleSide;
    boat.add(loft(t, stations, a, b, m, 5));
  });

  // ---- swept rails: cut-wood gunwale caps (section 0 / 8) and the tarred
  // boot-top batten (section 1 / 7) — tubes that HUG the hull through the tapers
  ([
    [0, 0.028, CUT],
    [8, 0.028, CUT],
    [1, 0.015, TAR],
    [7, 0.015, TAR],
  ] as [number, number, number][]).forEach(([ci, r, col]) => {
    const pathPts = stations.map((st) => new t.Vector3(st.pts[ci][0], st.pts[ci][1], st.z));
    const tube = new t.Mesh(
      new t.TubeGeometry(new t.CatmullRomCurve3(pathPts), 26, r, 6),
      mat(t, col, { tex: 'wood', repeat: [1, 8], rough: 0.85 }),
    );
    tube.castShadow = true;
    boat.add(tube);
  });

  // ---- two bronze bands chorded round the LOWER hull (one merged mesh — the
  // sheer chords are deliberately skipped: a strap crossing the painted
  // topsides right under the gunwale read as sticking plaster) ----
  const bandSpecs: MergedBoxSpec[] = [];
  [-0.4, 0.4].forEach((bz) => {
    const sec = sectionAt(bz);
    for (let c = 2; c < sec.length - 3; c += 1) {
      const [ax, ay] = sec[c];
      const [bx, by] = sec[c + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 0.01;
      const ux = dx / len;
      const uy = dy / len;
      const nx = uy;
      const ny = -ux;
      const outward = ax * nx + ay * ny > 0 ? 1 : -1;
      const m = new t.Matrix4().makeBasis(
        new t.Vector3(nx * outward, ny * outward, 0),
        new t.Vector3(ux, uy, 0),
        new t.Vector3(0, 0, 1),
      );
      m.setPosition((ax + bx) / 2 + nx * outward * 0.013, (ay + by) / 2 + ny * outward * 0.013, bz);
      bandSpecs.push({ dims: [0.016, len * 1.05, 0.042], matrix: m, repeat: [1, 2] });
    }
  });
  boat.add(mergedBoxes(t, bandSpecs, 0x6b5027, { tex: 'metal', metal: 0.3, rough: 0.7 }));

  // ---- raked stem + a carved MARLIN prow, and the stern post ----
  // Every carved piece leans the SAME way, forward over the water: a long stem
  // crossed by a tall fin reads as a signpost, not a carving.
  const woodSpecs: MergedBoxSpec[] = [
    barSpec(t, new t.Vector3(0, botOf(BOW) - 0.01, BOW - 0.08), new t.Vector3(0, 0.26, 0.84), 0.075, [1, 3]), // stem
    barSpec(t, new t.Vector3(0, botOf(STERN) - 0.01, STERN + 0.06), new t.Vector3(0, 0.22, -0.81), 0.07, [1, 3]), // stern post
    { dims: [0.07, 0.08, 0.1], pos: [0, 0.25, -0.82], rotX: 0.28, repeat: [1, 1] }, // stern knob
  ];
  // The carving is deliberately SMALL and low, and every piece rakes forward:
  // the first pass gave it a long bill crossed by broad pectorals and the two
  // read as a white crucifix bolted to the bow at any distance.
  const carveSpecs: MergedBoxSpec[] = [
    { dims: [0.075, 0.085, 0.14], pos: [0, 0.23, 0.85], rotX: -0.22, repeat: [1, 1] }, // head block
    { dims: [0.032, 0.032, 0.19], pos: [0, 0.26, 0.97], rotX: -0.24 }, // the bill
    { dims: [0.018, 0.07, 0.075], pos: [0, 0.3, 0.79], rotX: -0.15 }, // dorsal fin
    { dims: [0.028, 0.05, 0.09], pos: [0, 0.19, 0.87], rotX: -0.3 }, // the lower jaw
  ];
  boat.add(mergedBoxes(t, woodSpecs, CUT, { tex: 'wood', rough: 0.86, bump: 0.03 }));
  boat.add(mergedBoxes(t, carveSpecs, 0x8a7a5e, { tex: 'wood', rough: 0.82, bump: 0.03 }));
  // brass stem cap + a mooring ring on the foredeck
  boat.add(box(t, [0.09, 0.042, 0.09], METAL, [0, 0.15, 0.78], { tex: 'metal', metal: 0.6, rough: 0.5, rotX: -0.2 }));
  const ring = new t.Mesh(new t.TorusGeometry(0.033, 0.01, 6, 12), mat(t, METAL, { tex: 'metal', metal: 0.65, rough: 0.45 }));
  ring.position.set(0, 0.13, 0.7);
  ring.rotation.x = Math.PI / 2;
  boat.add(ring);

  // ---- interior: sole boards + four hewn thwarts ----
  const soleSpecs: MergedBoxSpec[] = [];
  for (let k = 0; k < 7; k += 1) {
    const z = -0.58 + k * 0.2;
    soleSpecs.push({ dims: [Math.max(0.12, hwOf(z) * 1.5), 0.032, 0.185], pos: [0, -0.195, z], repeat: [2, 1] });
  }
  boat.add(mergedBoxes(t, soleSpecs, TAR, { tex: 'wood', rough: 0.96, bump: 0.03 }));
  const thwartSpecs: MergedBoxSpec[] = [];
  SEAT_Z.forEach((sz) => {
    const w = hwOf(sz) * 1.70;
    thwartSpecs.push({ dims: [w, 0.045, 0.15], pos: [0, THWART_TOP - 0.022, sz], repeat: [2, 1] }); // the seat
    thwartSpecs.push({ dims: [w * 0.94, 0.085, 0.03], pos: [0, THWART_TOP + 0.038, sz - 0.09], repeat: [2, 1] }); // back lip
    thwartSpecs.push({ dims: [w * 0.9, 0.028, 0.05], pos: [0, THWART_TOP - 0.062, sz], repeat: [2, 1] }); // bearer
  });
  boat.add(mergedBoxes(t, thwartSpecs, 0xb9ab84, { tex: 'wood', rough: 0.84, bump: 0.03 }));

  // ---- a brass stern lantern on a short jackstaff (night-gated) ----
  const lamp = shipLantern(t, 0.62);
  lamp.group.position.set(0, 0.31, -0.62);
  boat.add(lamp.group);
  boat.add(cyl(t, 0.014, 0.018, 0.2, TIMBER, [0, 0.14, -0.62], { tex: 'wood', rough: 0.9, seg: 6 }));
  boat.userData.lamps = [lamp.glass];

  // ---- seat anchors ride WITH the boat, so REAL guests ride the coaster ----
  SEAT_Z.forEach((sz, i) => {
    const anchor = new t.Group();
    anchor.position.set(0, THWART_TOP - HIP_RISE, sz);
    boat.add(anchor);
    opts.seats?.push(anchor);
    if (opts.riders ?? true) {
      const p = buildPeep(t, {
        skin: SKIN_TONES[(i + 1) % SKIN_TONES.length],
        shirt: SHIRTS[(i + 6) % SHIRTS.length],
        seated: true,
        expression: i >= 2 ? 'surprised' : 'happy',
      });
      p.group.scale.setScalar(0.42);
      p.group.position.copy(anchor.position);
      boat.add(p.group);
    }
  });

  // ---- a coil of rope wedged in the bow (close-up detail) ----
  const coil = new t.Mesh(new t.TorusGeometry(0.05, 0.017, 5, 12), mat(t, ROPE, { tex: 'fabric', rough: 0.95 }));
  coil.position.set(0.05, -0.16, 0.6);
  coil.rotation.x = Math.PI / 2;
  coil.userData.lodDetail = true;
  boat.add(coil);
  return boat;
}

// ---------------------------------------------------------------------------
// THE WRECK, part 1 — THE BROKEN HULL.
//
// Local frame: +z is the keel (bow at +z), +x is starboard, and **y = 0 is the
// LAGOON SURFACE**, so the hull is placed simply by dropping its origin on the
// water at the point the channel crosses it. The channel runs along the local
// ±X axis through a gash amidships (|z| < BREACH), so the ship is set across
// the track and the boats pass right through her.
//
// The gash starts BELOW the waterline (y = −0.30, which is why she sank) and
// runs up to the deck line, and the hull is lofted in Z BANDS so the hole is a
// real absence of surface rather than a decal: the bottom shell (girth 2…6)
// spans every station, while the topsides (0…2 and 6…8), the deck and the
// bulwarks are lofted only AFT of the gash and FORWARD of it. What is left in
// between is a flooded hold with broken deck beams overhead, full frames
// standing at the two edges of the hole and snapped frame stubs between them.
// ---------------------------------------------------------------------------

/** [z, half-beam] — stations 5 and 8 are the EDGES of the gash, so the bands
 *  cut exactly on a station and the hole has clean vertical edges. The hull runs
 *  3.55 units AFT of the gash and 3.05 FORWARD of it on purpose: the first pass
 *  broke her off only 0.55 forward of the hole and, seen down the channel, she
 *  read as a ship cut in two with the track threading the gap rather than as a
 *  hole punched through her flank. */
const HULL_ST: [number, number][] = [
  [-4.9, 0.62], // transom
  [-4.3, 0.98],
  [-3.5, 1.3],
  [-2.6, 1.52],
  [-1.9, 1.63],
  [-1.35, 1.68], // ← aft edge of the gash
  [-0.6, 1.72], // max beam
  [0.4, 1.7],
  [1.35, 1.55], // ← forward edge of the gash
  [2.4, 1.36],
  [3.4, 1.14],
  [4.4, 0.9], // the ragged break where the bow tore off
];
const BREACH_A = 5;
const BREACH_F = 8;
/** the deck line rises toward the bow */
const deckOf = (z: number) => 2.0 + 0.16 * Math.min(1, Math.max(0, (z + 0.6) / 2.5)) ** 2;
/** the keel rises toward both ends (rocker) */
const keelOf = (z: number) => -1.35 + 0.55 * Math.min(1, Math.abs(z + 0.6) / 4.3) ** 2;
/** the gash sill — the hull side survives only BELOW this */
const SILL = -0.3;

/** the 9-point hull section at a station: sheer → tumblehome → bilge → keel */
function hullSection(z: number, hw: number): [number, number][] {
  const k = keelOf(z);
  const d = deckOf(z);
  return [
    [-hw, d],
    [-hw * 1.02, d - 0.75],
    [-hw * 0.96, SILL],
    [-hw * 0.62, k + 0.28],
    [0, k],
    [hw * 0.62, k + 0.28],
    [hw * 0.96, SILL],
    [hw * 1.02, d - 0.75],
    [hw, d],
  ];
}

export interface WreckHullOpts {
  /** ship's-lantern glass materials are pushed here for night gating */
  lamps?: THREE.MeshStandardMaterial[];
  /** the hanging passage lantern's real PointLight is added at this local spot
   *  by the caller — its position lands in `group.userData.lampAt` */
  lodTag?: boolean;
}

/** The broken hull the ride threads. Exported for parks dressing their own
 *  wreck coves. Local y = 0 is the waterline; the passage runs along ±X. */
export function buildWreckHull(t: typeof THREE, opts: WreckHullOpts = {}): THREE.Group {
  const hull = new t.Group();
  const lamps = opts.lamps ?? [];
  const stations = HULL_ST.map(([z, hw]) => ({ z, pts: hullSection(z, hw) }));
  const aft = stations.slice(0, BREACH_A + 1);
  const fore = stations.slice(BREACH_F);

  const plankMat = (col: number, rough = 0.95) => {
    const m = mat(t, col, { tex: 'wood', rough, bump: 0.05 });
    m.side = t.DoubleSide;
    return m;
  };

  // ---- the submerged bottom shell: every station, girth bilge → bilge ----
  hull.add(loft(t, stations, 2, 6, plankMat(TAR, 0.98), 2.2));
  // ---- topsides, aft of the gash and forward of it ----
  [aft, fore].forEach((band, bi) => {
    if (band.length < 2) return;
    hull.add(loft(t, band, 0, 2, plankMat(bi === 0 ? TIMBER : TIMBER_D), 2.4));
    hull.add(loft(t, band, 6, 8, plankMat(bi === 0 ? TIMBER_D : TIMBER), 2.4));
    // a faded green sheer strake just under the deck edge — the last of her paint
    const strake = band.map((st) => ({
      z: st.z,
      pts: [
        [st.pts[0][0], st.pts[0][1] - 0.06] as [number, number],
        [st.pts[1][0], st.pts[1][1] + 0.16] as [number, number],
        [st.pts[7][0], st.pts[7][1] + 0.16] as [number, number],
        [st.pts[8][0], st.pts[8][1] - 0.06] as [number, number],
      ],
    }));
    hull.add(loft(t, strake, 0, 1, plankMat(0x40615a, 0.9), 2.4));
    hull.add(loft(t, strake, 2, 3, plankMat(0x40615a, 0.9), 2.4));
  });
  // ---- the DECK (cambered) + bulwarks. These run FURTHER over the gash than
  // the planking does — the deck is only torn open across the 1.0 unit directly
  // over the channel (z −0.6…0.4), so the two ends of the ship stay joined in
  // silhouette. With the gash stopping at the deck line as well, she read as a
  // ship cut clean in two with the track threading the gap. Deck undersides are
  // 2.0 above the waterline, well clear of the boat either way.
  [stations.slice(0, 7), stations.slice(7)].forEach((band) => {
    if (band.length < 2) return;
    const deck = band.map((st) => {
      const hw = Math.abs(st.pts[0][0]);
      const d = deckOf(st.z);
      return { z: st.z, pts: [[-hw * 0.99, d - 0.04], [0, d], [hw * 0.99, d - 0.04]] as [number, number][] };
    });
    hull.add(loft(t, deck, 0, 2, plankMat(TIMBER_D, 0.96), 3.0));
    const bul = band.map((st) => {
      const hw = Math.abs(st.pts[0][0]);
      const d = deckOf(st.z);
      return {
        z: st.z,
        pts: [[-hw, d], [-hw * 0.985, d + 0.4], [hw * 0.985, d + 0.4], [hw, d]] as [number, number][],
      };
    });
    hull.add(loft(t, bul, 0, 1, plankMat(TIMBER, 0.95), 2.6));
    hull.add(loft(t, bul, 2, 3, plankMat(TIMBER, 0.95), 2.6));
    // rail caps along the bulwark tops
    [-1, 1].forEach((s) => {
      const pathPts = band.map((st) => {
        const hw = Math.abs(st.pts[0][0]);
        return new t.Vector3(s * hw * 0.985, deckOf(st.z) + 0.41, st.z);
      });
      const cap = new t.Mesh(
        new t.TubeGeometry(new t.CatmullRomCurve3(pathPts), 18, 0.05, 6),
        mat(t, TIMBER_D, { tex: 'wood', repeat: [1, 6], rough: 0.92 }),
      );
      cap.castShadow = true;
      hull.add(cap);
    });
  });

  // ---- the TRANSOM: a flat stern with quarter windows + the rudder ----
  {
    const z = HULL_ST[0][0];
    const hw = HULL_ST[0][1];
    const d = deckOf(z);
    const k = keelOf(z);
    hull.add(box(t, [hw * 2.02, d - k, 0.14], TIMBER_D, [0, (d + k) / 2, z - 0.05], { tex: 'wood', repeat: [3, 4], rough: 0.95, bump: 0.05 }));
    const stern: MergedBoxSpec[] = [
      { dims: [0.14, d - k + 0.3, 0.2], pos: [0, (d + k) / 2, z - 0.12], repeat: [1, 5] }, // stern post
      { dims: [hw * 2.1, 0.11, 0.24], pos: [0, d + 0.42, z - 0.06], repeat: [4, 1] }, // taffrail
      { dims: [hw * 2.1, 0.09, 0.2], pos: [0, d - 0.62, z - 0.08], repeat: [4, 1] }, // moulding
    ];
    hull.add(mergedBoxes(t, stern, TIMBER, { tex: 'wood', rough: 0.92, bump: 0.04 }));
    // three quarter windows: dark panes in brass frames — the captain's cabin
    // still shows a light after dark
    const frames: MergedBoxSpec[] = [];
    [-0.34, 0, 0.34].forEach((fx) => {
      frames.push({ dims: [0.22, 0.28, 0.05], pos: [fx, d - 0.34, z - 0.13] });
      const pane = box(t, [0.16, 0.21, 0.03], 0x6b5f3a, [fx, d - 0.34, z - 0.16], { emissive: 0xffbe62, rough: 0.35 });
      (pane.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.06;
      lamps.push(pane.material as THREE.MeshStandardMaterial);
      hull.add(pane);
    });
    hull.add(mergedBoxes(t, frames, BRASS, { tex: 'metal', metal: 0.55, rough: 0.5 }));
    // the rudder, hanging askew off two rusted pintles
    const rud = new t.Group();
    rud.position.set(0, k + 0.55, z - 0.2);
    rud.rotation.set(0.18, 0.34, 0.06);
    rud.add(box(t, [0.11, 1.5, 0.52], TIMBER_D, [0, -0.2, -0.2], { tex: 'wood', repeat: [1, 4], rough: 0.96, bump: 0.05 }));
    rud.add(mergedBoxes(t, [
      { dims: [0.17, 0.11, 0.3], pos: [0, 0.32, -0.08] },
      { dims: [0.17, 0.11, 0.3], pos: [0, -0.5, -0.08] },
    ], RUST, { tex: 'metal', metal: 0.35, rough: 0.9 }));
    hull.add(rud);
    // her name board, the letters long gone
    hull.add(box(t, [1.16, 0.22, 0.06], TIMBER, [0, d - 0.06, z - 0.19], { tex: 'wood', repeat: [4, 1], rough: 0.95 }));
  }

  // ---- the RAGGED BREAK where the bow tore away: frames + snapped planks ----
  {
    const z = HULL_ST[HULL_ST.length - 1][0];
    const hw = HULL_ST[HULL_ST.length - 1][1];
    const sec = hullSection(z, hw);
    const ribs: MergedBoxSpec[] = [];
    for (let c = 0; c < sec.length - 1; c += 1) {
      const a = new t.Vector3(sec[c][0], sec[c][1], z);
      const b = new t.Vector3(sec[c + 1][0], sec[c + 1][1], z);
      ribs.push(barSpec(t, a, b, 0.11, [1, 2]));
    }
    // splintered plank ends jutting forward off the break
    for (let k = 0; k < 9; k += 1) {
      const h1 = hash01(k * 4.7 + 2.1);
      const h2 = hash01(k * 9.3 + 5.5);
      const s = k % 2 ? 1 : -1;
      const y = SILL + 0.2 + h1 * 2.0;
      const x = s * hw * (0.55 + 0.42 * h2);
      ribs.push({ dims: [0.07, 0.06, 0.3 + h2 * 0.5], pos: [x, y, z + 0.2 + h1 * 0.34], rotY: (h2 - 0.5) * 0.5, rotX: (h1 - 0.5) * 0.4, repeat: [1, 2] });
    }
    hull.add(mergedBoxes(t, ribs, TIMBER_D, { tex: 'wood', rough: 0.96, bump: 0.05 }));
  }

  // ---- THE GASH: framing ribs at both edges, snapped stubs between, and
  // broken DECK BEAMS bridging the passage overhead ----
  {
    const ribs: MergedBoxSpec[] = [];
    [BREACH_A, BREACH_F].forEach((si) => {
      const [z, hw] = HULL_ST[si];
      const sec = hullSection(z, hw);
      for (let c = 0; c < sec.length - 1; c += 1)
        ribs.push(
          barSpec(t, new t.Vector3(sec[c][0] * 1.03, sec[c][1], z), new t.Vector3(sec[c + 1][0] * 1.03, sec[c + 1][1], z), 0.1, [1, 2]),
        );
    });
    // snapped frame stubs standing out of the flooded hold — kept OUT of the
    // |z| < 0.85 corridor the channel actually crosses
    [-1.2, -1.0, 0.95, 1.2].forEach((z, i) => {
      const hw = 1.7;
      const h = 0.22 + 0.34 * hash01(i * 6.1 + 1.7);
      [-1, 1].forEach((s) => {
        ribs.push({ dims: [0.1, h, 0.11], pos: [s * hw * 0.96, SILL + h / 2, z], rotZ: s * (0.1 + 0.16 * hash01(i * 3.3 + s)), repeat: [1, 1] });
      });
    });
    hull.add(mergedBoxes(t, ribs, TIMBER_D, { tex: 'wood', rough: 0.96, bump: 0.05 }));
    // deck beams over the passage: the planking is gone, the beams are not.
    // Underside stays 2.0 above the waterline, so with the 9° list the lowest
    // corner still clears the boat's carved prow by half a unit.
    // FOUR beams, two of them snapped short: five full-span beams at even
    // spacing read as a pergola bolted over the hole rather than as a deck torn
    // open. Undersides stay 2.0 above the waterline whatever the list.
    const beams: MergedBoxSpec[] = [];
    ([
      [-1.15, 1.0],
      [-0.4, 0.62],
      [0.5, 1.0],
      [1.2, 0.78],
    ] as [number, number][]).forEach(([z, frac], i) => {
      const hw = 1.72;
      const w = hw * 2.02 * frac;
      // a snapped beam keeps the end it is still fastened to
      const off = frac < 0.99 ? (i % 2 ? 1 : -1) * hw * 1.01 * (1 - frac) : 0;
      beams.push({ dims: [w, 0.14, 0.17], pos: [off, 2.06, z], rotZ: (hash01(i * 5.9) - 0.5) * 0.09, repeat: [5, 1] });
    });
    // deck planking still fastened along both edges of the hole, hanging into it
    for (let k = 0; k < 10; k += 1) {
      const h1 = hash01(k * 7.7 + 0.9);
      const h2 = hash01(k * 2.3 + 4.4);
      const s = k % 2 ? 1 : -1;
      // rotZ signed so the INBOARD end lifts: a plank drooping into the hole
      // eats the boat's headroom, and 2.04 local is the floor for anything
      // over the passage (world 1.83 after the list — half a unit clear)
      beams.push({
        dims: [0.34 + h1 * 0.4, 0.05, 0.24 + h2 * 0.16],
        pos: [s * (1.7 - (0.2 + h1 * 0.5)), 2.04 + h2 * 0.05, -1.3 + k * 0.28],
        rotZ: -s * (0.12 + h1 * 0.42),
        rotY: (h2 - 0.5) * 0.3,
        repeat: [2, 1],
      });
    }
    hull.add(mergedBoxes(t, beams, TIMBER_D, { tex: 'wood', rough: 0.96, bump: 0.05 }));
  }

  // ---- the SNAPPED MAINMAST, a mizzen stump and the fallen topmast ----
  const MAST_Z = -1.9;
  hull.add(spar(t, new t.Vector3(0, 1.1, MAST_Z), new t.Vector3(0.1, 5.0, MAST_Z - 0.12), 0.15, 0.1, TIMBER));
  hull.add(spar(t, new t.Vector3(0, 1.4, -3.9), new t.Vector3(-0.05, 2.75, -3.95), 0.11, 0.085, TIMBER)); // mizzen stump
  hull.add(spar(t, new t.Vector3(0, 1.3, 2.7), new t.Vector3(-0.06, 3.62, 2.62), 0.13, 0.095, TIMBER)); // foremast stump, forward of the gash
  {
    // splintered crown on the mainmast
    const shards: MergedBoxSpec[] = [];
    for (let k = 0; k < 5; k += 1) {
      const h1 = hash01(k * 3.7 + 9.1);
      const a = (k / 5) * Math.PI * 2;
      shards.push({
        dims: [0.045, 0.24 + h1 * 0.3, 0.045],
        pos: [0.1 + Math.cos(a) * 0.055, 5.06 + h1 * 0.14, MAST_Z - 0.12 + Math.sin(a) * 0.055],
        rotX: Math.sin(a) * 0.3,
        rotZ: -Math.cos(a) * 0.3,
      });
    }
    for (let k = 0; k < 4; k += 1) {
      const h1 = hash01(k * 8.3 + 2.7);
      shards.push({ dims: [0.04, 0.2 + h1 * 0.2, 0.04], pos: [-0.02, 2.82 + h1 * 0.1, -3.95 + (h1 - 0.5) * 0.1], rotZ: (h1 - 0.5) * 0.5 });
    }
    hull.add(mergedBoxes(t, shards, TIMBER, { tex: 'wood', rough: 0.95 }));
  }
  // the fallen topmast, down across the starboard quarter into the water
  hull.add(spar(t, new t.Vector3(0.35, 4.5, MAST_Z - 0.2), new t.Vector3(3.3, -0.1, -3.5), 0.095, 0.06, TIMBER_D));
  // the yard she carried, hanging by one lift
  const YARD_A = new t.Vector3(-1.55, 3.5, MAST_Z + 0.5);
  const YARD_B = new t.Vector3(1.5, 2.6, MAST_Z - 0.55);
  hull.add(spar(t, YARD_A, YARD_B, 0.06, 0.075, TIMBER_D));

  // ---- RIGGING: shrouds to the channels, stays, and lines gone slack ----
  {
    const ropeMat = mat(t, TAR, { tex: 'fabric', rough: 0.98 });
    const mastHead = new t.Vector3(0.07, 4.3, MAST_Z - 0.09);
    const chan: MergedBoxSpec[] = [];
    [-1, 1].forEach((s) => {
      for (let k = 0; k < 3; k += 1) {
        const cz = MAST_Z + 0.55 - k * 0.5;
        const hw = 1.7;
        hull.add(line(t, mastHead.clone(), new t.Vector3(s * hw * 1.06, 2.16, cz), 0.05 + k * 0.02, 0.017, ropeMat));
        // channel + deadeye block
        chan.push({ dims: [0.3, 0.07, 0.16], pos: [s * hw * 1.02, 2.12, cz] });
        chan.push({ dims: [0.1, 0.13, 0.1], pos: [s * hw * 1.06, 2.2, cz] });
      }
    });
    hull.add(mergedBoxes(t, chan, TIMBER_D, { tex: 'wood', rough: 0.94 }));
    // yard lifts + two lines trailing into the sea
    hull.add(line(t, mastHead.clone(), YARD_A.clone(), 0.06, 0.015, ropeMat));
    hull.add(line(t, new t.Vector3(0.09, 3.9, MAST_Z - 0.1), YARD_B.clone(), 0.3, 0.015, ropeMat));
    // two lines gone slack over the side — both trailed AFT, clear of the
    // channel corridor (a line drooping forward crossed it at only 0.26 of
    // headroom over the boat)
    hull.add(line(t, new t.Vector3(0.05, 4.6, MAST_Z - 0.14), new t.Vector3(-2.4, 0.02, -3.6), 0.5, 0.016, ropeMat));
    hull.add(line(t, new t.Vector3(-1.3, 3.3, MAST_Z + 0.4), new t.Vector3(-2.9, 0.02, -3.1), 0.45, 0.014, ropeMat));
    // the forestay, still made up to the foremast stump forward of the gash
    hull.add(line(t, new t.Vector3(0.06, 4.15, MAST_Z - 0.08), new t.Vector3(-0.06, 3.5, 2.7), 0.35, 0.016, ropeMat));
  }

  // ---- TATTERED SAILS hanging off the yard ----
  {
    const canvas = mat(t, CANVAS, { tex: 'fabric', repeat: [2, 2], rough: 0.95 });
    canvas.side = t.DoubleSide;
    for (let k = 0; k < 3; k += 1) {
      const f = (k + 0.5) / 3;
      const at = YARD_A.clone().lerp(YARD_B, f);
      const sail = raggedSail(t, 1.0, 1.35 + 0.3 * hash01(k * 5.3), 11 + k * 3, canvas);
      sail.position.copy(at);
      sail.rotation.y = Math.atan2(YARD_B.x - YARD_A.x, YARD_B.z - YARD_A.z) + Math.PI / 2;
      hull.add(sail);
    }
    // a shred still lashed to the mizzen stump
    const rag = raggedSail(t, 0.55, 0.8, 27, canvas);
    rag.position.set(-0.05, 2.6, -3.95);
    rag.rotation.y = 0.6;
    hull.add(rag);
  }

  // ---- DECK FITTINGS on the surviving after deck ----
  {
    const fit: MergedBoxSpec[] = [
      { dims: [0.9, 0.24, 0.86], pos: [0, 2.06, -2.95], repeat: [3, 1] }, // hatch coaming
      { dims: [0.62, 0.07, 0.6], pos: [0.28, 2.2, -2.86], rotZ: 0.22, rotX: 0.1, repeat: [2, 2] }, // its cover, off its seat
      { dims: [0.17, 0.5, 0.17], pos: [-0.62, 2.35, -1.75], repeat: [1, 2] }, // bitts
      { dims: [0.17, 0.5, 0.17], pos: [0.62, 2.35, -1.75], repeat: [1, 2] },
      { dims: [1.6, 0.11, 0.16], pos: [0, 2.55, -1.75], repeat: [4, 1] }, // their cross-piece
      { dims: [0.66, 0.14, 0.5], pos: [-0.8, 2.15, -4.1], rotY: 0.3, repeat: [2, 1] }, // a smashed grating
      { dims: [1.5, 0.62, 1.0], pos: [0, 2.44, -2.05], repeat: [4, 2] }, // the companionway
      { dims: [1.6, 0.09, 1.08], pos: [0.08, 2.72, -2.02], rotZ: 0.09, repeat: [4, 2] }, // its roof, shoved off
      { dims: [0.5, 0.06, 0.44], pos: [-0.5, 2.86, -2.5], rotZ: -0.5, rotY: 0.4, repeat: [2, 1] }, // a torn-off panel
      // the FORWARD deck, past the gash: a windlass bed and a fore hatch
      { dims: [1.5, 0.2, 0.34], pos: [0, 2.16, 3.5], repeat: [4, 1] },
      { dims: [0.24, 0.44, 0.24], pos: [-0.62, 2.36, 3.5], repeat: [1, 2] },
      { dims: [0.24, 0.44, 0.24], pos: [0.62, 2.36, 3.5], repeat: [1, 2] },
      { dims: [0.72, 0.22, 0.7], pos: [0, 2.12, 1.85], repeat: [2, 1] }, // fore hatch coaming
      { dims: [0.56, 0.06, 0.5], pos: [-0.2, 2.26, 1.78], rotZ: -0.18, repeat: [2, 2] },
    ];
    hull.add(mergedBoxes(t, fit, TIMBER_D, { tex: 'wood', rough: 0.94, bump: 0.04 }));
    // the windlass barrel itself, lying in its bed
    const barrel = cyl(t, 0.14, 0.14, 1.2, TIMBER, [0, 2.4, 3.5], { tex: 'wood', repeat: [4, 1], rough: 0.9, seg: 8 });
    barrel.rotation.z = Math.PI / 2;
    hull.add(barrel);
    // the capstan
    hull.add(cyl(t, 0.2, 0.26, 0.52, TIMBER, [0, 2.28, -4.35], { tex: 'wood', repeat: [6, 1], rough: 0.9, seg: 10 }));
    hull.add(cyl(t, 0.3, 0.3, 0.07, TIMBER_D, [0, 2.56, -4.35], { tex: 'wood', repeat: [6, 1], rough: 0.9, seg: 10 }));
    const whelps: MergedBoxSpec[] = [];
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2;
      whelps.push({ dims: [0.05, 0.44, 0.11], pos: [Math.cos(a) * 0.22, 2.28, -4.35 + Math.sin(a) * 0.22], rotY: -a });
    }
    whelps.push({ dims: [0.06, 0.06, 0.8], pos: [0.26, 2.5, -4.05], rotY: 0.5, rotZ: 0.12 }); // a capstan bar left in
    hull.add(mergedBoxes(t, whelps, TIMBER_D, { tex: 'wood', rough: 0.92 }));
    // two barrels, one stove in
    hull.add(cyl(t, 0.19, 0.21, 0.42, TIMBER, [0.72, 2.21, -3.5], { tex: 'wood', repeat: [5, 1], rough: 0.92, seg: 10 }));
    const cask = cyl(t, 0.2, 0.17, 0.4, TIMBER_D, [-0.85, 2.14, -2.1], { tex: 'wood', repeat: [5, 1], rough: 0.94, seg: 10 });
    cask.rotation.z = 1.35;
    hull.add(cask);
    // a rope coil on deck
    const coil = new t.Mesh(new t.TorusGeometry(0.17, 0.05, 5, 12), mat(t, ROPE, { tex: 'fabric', rough: 0.96 }));
    coil.position.set(-0.55, 2.11, -3.45);
    coil.rotation.x = Math.PI / 2;
    coil.userData.lodDetail = true;
    hull.add(coil);
  }

  // ---- the HANGING LANTERN over the passage (the caller adds the light) ----
  const lampAt = new t.Vector3(0.15, 1.5, 1.15);
  {
    const davit = barSpec(t, new t.Vector3(0.15, 2.02, 1.3), new t.Vector3(0.15, 1.72, 1.15), 0.06);
    hull.add(mergedBoxes(t, [davit], IRON, { tex: 'metal', metal: 0.5, rough: 0.6 }));
    const lamp = shipLantern(t, 1.0);
    lamp.group.position.copy(lampAt);
    hull.add(lamp.group);
    lamps.push(lamp.glass);
    hull.add(line(t, new t.Vector3(0.15, 1.72, 1.15), lampAt.clone().add(new t.Vector3(0, 0.2, 0)), 0, 0.008, mat(t, IRON, { tex: 'metal', metal: 0.6, rough: 0.5 })));
  }
  hull.userData.lampAt = [lampAt.x, lampAt.y, lampAt.z];

  // ---- RUSTED IRONWORK: hull straps, chainplates, the anchor chain ----
  {
    const iron: MergedBoxSpec[] = [];
    [-3.6, -2.4, 1.6].forEach((z) => {
      const hw = 1.7;
      [-1, 1].forEach((s) => {
        iron.push({ dims: [0.06, 1.5, 0.2], pos: [s * hw * 1.0, 1.0, z], rotZ: s * 0.06, repeat: [1, 3] });
      });
    });
    hull.add(mergedBoxes(t, iron, RUST, { tex: 'metal', metal: 0.3, rough: 0.95 }));
    // the anchor chain, out of the hawse and down into the water
    const chainMat = mat(t, RUST, { tex: 'metal', metal: 0.35, rough: 0.9 });
    hull.add(line(t, new t.Vector3(-1.4, 1.55, 1.7), new t.Vector3(-2.9, -0.15, 2.5), 0.55, 0.035, chainMat));
  }

  // ---- BARNACLES + WEED in a band along the waterline ----
  // ⚠️ NOT ACROSS THE GASH. Barnacles grow on planking and there is none there —
  // and the crust is the one part of this hull that reaches into the boats'
  // corridor: it sits at |x| ≈ hw with its top at ship y +0.16 + half its own
  // size, which the 9.2° list carries up to a measured +0.562 in the heeled
  // frame. That is 2 mm INSIDE the skiff's keel line where the channel crosses
  // (probe: rr2-strict.tsx found 126 vertices of this one mesh inside the
  // hull's own analytic section, and nothing else in the whole cove). Skipping
  // the gash band removes the only real clip on the circuit and models the
  // hole correctly at the same time.
  {
    const crust: MergedBoxSpec[] = [];
    const weed: MergedBoxSpec[] = [];
    for (let si = 0; si < HULL_ST.length; si += 1) {
      const [z, hw] = HULL_ST[si];
      for (let k = 0; k < 6; k += 1) {
        const h1 = hash01(si * 5.1 + k * 2.7);
        const h2 = hash01(si * 3.3 + k * 8.1);
        const s = k % 2 ? 1 : -1;
        const y = -0.42 + h1 * 0.58;
        const x = s * hw * (0.95 + 0.05 * h2);
        const sz = 0.1 + h2 * 0.16;
        const zj = z + (h1 - 0.5) * 0.5;
        if (Math.abs(zj) < 1.5) continue; // the gash — no planking, no barnacles
        crust.push({ dims: [0.05, sz, sz * 1.5], pos: [x, y, zj], rotZ: (h2 - 0.5) * 0.4 });
        if (h2 > 0.7)
          weed.push({ dims: [0.04, 0.2 + h1 * 0.3, sz * 1.3], pos: [x + s * 0.04, y - 0.16, zj], rotZ: s * (0.3 + h1 * 0.5) });
      }
    }
    const crustMesh = mergedBoxes(t, crust, BARNACLE, { tex: 'concrete', rough: 1, bump: 0.06, flat: true });
    crustMesh.userData.lodDetail = true;
    hull.add(crustMesh);
    hull.add(mergedBoxes(t, weed, WEED, { tex: 'fabric', rough: 0.95 }));
  }
  return hull;
}

// ---------------------------------------------------------------------------
// THE WRECK, part 2 — THE SEVERED BOW SECTION, reared up on a coral head with
// her bowsprit spearing across the channel. Local frame matches the hull's:
// +z toward the stem, y = 0 at the waterline of an UPRIGHT hull (the caller
// tips and heels the group, then reads `userData.stemHead` back out through
// the same transform to aim the bowsprit).
// ---------------------------------------------------------------------------
const BOW_ST: [number, number][] = [
  [-2.7, 1.34], // the ragged break
  [-1.9, 1.28],
  [-1.0, 1.16],
  [0.0, 0.98],
  [1.0, 0.72],
  [1.9, 0.4],
  [2.55, 0.13],
];
const bowDeckOf = (z: number) => 0.62 + 0.34 * Math.min(1, Math.max(0, (z + 0.9) / 3.4)) ** 1.6;
const bowKeelOf = (z: number) => -1.3 + 0.85 * Math.min(1, Math.max(0, (z + 0.9) / 3.4)) ** 1.7;
function bowSection(z: number, hw: number): [number, number][] {
  const k = bowKeelOf(z);
  const d = bowDeckOf(z);
  return [
    [-hw, d],
    [-hw * 1.02, d - 0.5],
    [-hw * 0.95, -0.28],
    [-hw * 0.6, k + 0.2],
    [0, k],
    [hw * 0.6, k + 0.2],
    [hw * 0.95, -0.28],
    [hw * 1.02, d - 0.5],
    [hw, d],
  ];
}

/** The detached bow section. `userData.stemHead` is the local point the
 *  bowsprit springs from. */
export function buildWreckBow(t: typeof THREE): THREE.Group {
  const grp = new t.Group();
  const stations = BOW_ST.map(([z, hw]) => ({ z, pts: bowSection(z, hw) }));
  const plankMat = (col: number, rough = 0.95) => {
    const m = mat(t, col, { tex: 'wood', rough, bump: 0.05 });
    m.side = t.DoubleSide;
    return m;
  };
  grp.add(loft(t, stations, 2, 6, plankMat(TAR, 0.98), 2.2));
  grp.add(loft(t, stations, 0, 2, plankMat(TIMBER), 2.4));
  grp.add(loft(t, stations, 6, 8, plankMat(TIMBER_D), 2.4));
  // deck + bulwarks
  const deck = stations.map((st) => {
    const hw = Math.abs(st.pts[0][0]);
    const d = bowDeckOf(st.z);
    return { z: st.z, pts: [[-hw * 0.99, d - 0.03], [0, d], [hw * 0.99, d - 0.03]] as [number, number][] };
  });
  grp.add(loft(t, deck, 0, 2, plankMat(TIMBER_D, 0.96), 3.0));
  const bul = stations.map((st) => {
    const hw = Math.abs(st.pts[0][0]);
    const d = bowDeckOf(st.z);
    return { z: st.z, pts: [[-hw, d], [-hw * 0.985, d + 0.34], [hw * 0.985, d + 0.34], [hw, d]] as [number, number][] };
  });
  grp.add(loft(t, bul, 0, 1, plankMat(TIMBER, 0.95), 2.6));
  grp.add(loft(t, bul, 2, 3, plankMat(TIMBER, 0.95), 2.6));
  // rail caps: without them the piece read as a bare wedge of planking
  [-1, 1].forEach((s) => {
    const pathPts = stations.map((st) => {
      const hw = Math.abs(st.pts[0][0]);
      return new t.Vector3(s * hw * 0.985, bowDeckOf(st.z) + 0.35, st.z);
    });
    const cap = new t.Mesh(
      new t.TubeGeometry(new t.CatmullRomCurve3(pathPts), 16, 0.05, 6),
      mat(t, TIMBER_D, { tex: 'wood', repeat: [1, 6], rough: 0.92 }),
    );
    cap.castShadow = true;
    grp.add(cap);
  });
  // a faded green sheer strake, the same paint the main hull still carries
  {
    const strake = stations.map((st) => ({
      z: st.z,
      pts: [
        [st.pts[0][0], st.pts[0][1] - 0.05] as [number, number],
        [st.pts[1][0], st.pts[1][1] + 0.12] as [number, number],
        [st.pts[7][0], st.pts[7][1] + 0.12] as [number, number],
        [st.pts[8][0], st.pts[8][1] - 0.05] as [number, number],
      ],
    }));
    grp.add(loft(t, strake, 0, 1, plankMat(0x40615a, 0.9), 2.4));
    grp.add(loft(t, strake, 2, 3, plankMat(0x40615a, 0.9), 2.4));
  }

  // ---- the raked STEM + a weathered figurehead + catheads ----
  const stemHead = new t.Vector3(0, 1.45, 2.62);
  const wood: MergedBoxSpec[] = [
    barSpec(t, new t.Vector3(0, bowKeelOf(2.1), 2.1), stemHead.clone(), 0.17, [1, 4]), // stem
    { dims: [0.54, 0.14, 0.46], pos: [-0.66, 0.94, 1.3], rotY: 0.4, repeat: [2, 1] }, // catheads
    { dims: [0.54, 0.14, 0.46], pos: [0.66, 0.94, 1.3], rotY: -0.4, repeat: [2, 1] },
    { dims: [0.14, 0.44, 0.14], pos: [-0.56, 1.16, 0.5], repeat: [1, 2] }, // bow bitts
    { dims: [0.14, 0.44, 0.14], pos: [0.56, 1.16, 0.5], repeat: [1, 2] },
  ];
  grp.add(mergedBoxes(t, wood, TIMBER, { tex: 'wood', rough: 0.92, bump: 0.04 }));
  // the figurehead: a weathered carved sea-figure under the bowsprit, all of
  // it leaning the same way — forward over the water
  const fig: MergedBoxSpec[] = [
    { dims: [0.22, 0.46, 0.26], pos: [0, 1.1, 2.6], rotX: -0.36 }, // torso
    { dims: [0.17, 0.19, 0.18], pos: [0, 1.38, 2.8], rotX: -0.3 }, // head
    { dims: [0.09, 0.33, 0.1], pos: [-0.14, 1.16, 2.74], rotZ: 0.5, rotX: -0.4 }, // arms
    { dims: [0.09, 0.33, 0.1], pos: [0.14, 1.16, 2.74], rotZ: -0.5, rotX: -0.4 },
    { dims: [0.18, 0.44, 0.15], pos: [0, 0.78, 2.46], rotX: 0.35 }, // tail
    { dims: [0.3, 0.11, 0.17], pos: [0, 0.56, 2.4], rotX: 0.6 }, // fluke
  ];
  grp.add(mergedBoxes(t, fig, TIMBER_D, { tex: 'wood', rough: 0.86, bump: 0.04 }));

  // ---- the FOREMAST stump, snapped just above the deck ----
  grp.add(spar(t, new t.Vector3(0, 0.45, -0.9), new t.Vector3(-0.09, 2.35, -1.02), 0.15, 0.11, TIMBER));
  {
    const shards: MergedBoxSpec[] = [];
    for (let k = 0; k < 4; k += 1) {
      const h1 = hash01(k * 6.3 + 3.9);
      shards.push({ dims: [0.045, 0.22 + h1 * 0.26, 0.045], pos: [-0.09 + (h1 - 0.5) * 0.1, 2.42 + h1 * 0.14, -1.02], rotZ: (h1 - 0.5) * 0.6 });
    }
    grp.add(mergedBoxes(t, shards, TIMBER, { tex: 'wood', rough: 0.95 }));
  }

  // ---- the RAGGED BREAK aft: full frames + splintered planking ----
  {
    const z = BOW_ST[0][0];
    const hw = BOW_ST[0][1];
    const sec = bowSection(z, hw);
    const ribs: MergedBoxSpec[] = [];
    for (let c = 0; c < sec.length - 1; c += 1)
      ribs.push(barSpec(t, new t.Vector3(sec[c][0], sec[c][1], z), new t.Vector3(sec[c + 1][0], sec[c + 1][1], z), 0.1, [1, 2]));
    for (let k = 0; k < 8; k += 1) {
      const h1 = hash01(k * 3.1 + 7.3);
      const h2 = hash01(k * 8.7 + 1.1);
      const s = k % 2 ? 1 : -1;
      ribs.push({
        dims: [0.07, 0.055, 0.28 + h2 * 0.42],
        pos: [s * hw * (0.5 + 0.45 * h2), -0.2 + h1 * 1.1, z - 0.18 - h1 * 0.3],
        rotY: (h2 - 0.5) * 0.5,
        rotX: (h1 - 0.5) * 0.4,
        repeat: [1, 2],
      });
    }
    grp.add(mergedBoxes(t, ribs, TIMBER_D, { tex: 'wood', rough: 0.96, bump: 0.05 }));
  }

  // ---- barnacles + weed along her waterline ----
  {
    const crust: MergedBoxSpec[] = [];
    const weed: MergedBoxSpec[] = [];
    for (let si = 0; si < BOW_ST.length; si += 1) {
      const [z, hw] = BOW_ST[si];
      for (let k = 0; k < 5; k += 1) {
        const h1 = hash01(si * 7.3 + k * 1.9 + 4);
        const h2 = hash01(si * 2.1 + k * 6.7 + 9);
        const s = k % 2 ? 1 : -1;
        const y = -0.4 + h1 * 0.5;
        const sz = 0.09 + h2 * 0.14;
        crust.push({ dims: [0.05, sz, sz * 1.5], pos: [s * hw * 0.95, y, z + (h1 - 0.5) * 0.4], rotZ: (h2 - 0.5) * 0.4 });
        if (h2 > 0.72) weed.push({ dims: [0.04, 0.18 + h1 * 0.26, sz * 1.2], pos: [s * hw * 0.99, y - 0.14, z], rotZ: s * (0.3 + h1 * 0.4) });
      }
    }
    const crustMesh = mergedBoxes(t, crust, BARNACLE, { tex: 'concrete', rough: 1, bump: 0.06, flat: true });
    crustMesh.userData.lodDetail = true;
    grp.add(crustMesh);
    grp.add(mergedBoxes(t, weed, WEED, { tex: 'fabric', rough: 0.95 }));
  }
  grp.userData.stemHead = [stemHead.x, stemHead.y, stemHead.z];
  return grp;
}

// ---------------------------------------------------------------------------
// THE REEF — a coral head: a knuckle of faceted rock crusted with branching
// coral and a couple of sea fans, all deterministic from `seed`. Group origin
// sits at the sea bed.
// ---------------------------------------------------------------------------
export function buildCoralHead(t: typeof THREE, seed: number, scale = 1): THREE.Group {
  const grp = new t.Group();
  const h = (k: number) => hash01(seed * 1.7 + k * 3.9 + 0.3);
  // the rock base is deliberately SMALL and mostly buried: the first pass gave
  // coral a full-size boulder to sit on and the whole lagoon read as a rockery
  const base = buildRock(t, { scale: scale * 0.62, seed: seed * 3 + 11, tint: h(1) > 0.5 ? REEF : REEF_D });
  base.position.y = -scale * 0.22;
  grp.add(base);
  // branching coral: a real bushy colony — chorded stems fanning up off the
  // rock in TWO tints (a monotone colony still read as painted rock)
  const tA = CORAL[Math.floor(h(5) * CORAL.length) % CORAL.length];
  const tB = CORAL[(Math.floor(h(5) * CORAL.length) + 2) % CORAL.length];
  const brA: MergedBoxSpec[] = [];
  const brB: MergedBoxSpec[] = [];
  const N = 8 + Math.floor(h(6) * 5);
  for (let k = 0; k < N; k += 1) {
    const a = (k / N) * Math.PI * 2 + h(7) * 3;
    const r = scale * (0.1 + 0.34 * h(k + 8));
    const len = scale * (0.3 + 0.36 * h(k + 20));
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = scale * (0.02 + 0.18 * h(k + 30));
    const into = h(k + 55) > 0.5 ? brA : brB;
    const th = scale * (0.13 + 0.06 * h(k + 45));
    into.push({ dims: [th, len, th], pos: [x, y + len / 2, z], rotX: (h(k + 40) - 0.5) * 0.6, rotZ: (h(k + 50) - 0.5) * 0.6 });
    // two forks off the top, so a stem reads as coral and not as a spike
    for (let j = 0; j < 2; j += 1) {
      const hj = h(k * 3 + j + 60);
      into.push({
        dims: [th * 0.72, len * (0.45 + hj * 0.3), th * 0.72],
        pos: [x + Math.cos(a + j * 2.1) * th * 1.3, y + len * (0.92 + hj * 0.2), z + Math.sin(a + j * 2.1) * th * 1.3],
        rotX: (h(k + j + 70) - 0.5) * 1.3,
        rotZ: (h(k + j + 80) - 0.5) * 1.3,
      });
    }
  }
  const cOpt = { tex: 'concrete' as const, rough: 0.92, bump: 0.06, flat: true };
  if (scale < 0.5) {
    grp.add(mergedBoxes(t, brA.concat(brB), tA, cOpt));
  } else {
    grp.add(mergedBoxes(t, brA, tA, cOpt));
    grp.add(mergedBoxes(t, brB, tB, cOpt));
  }
  // a sea fan or two — thin vertical plates (big colonies only)
  if (scale >= 0.5 && h(80) > 0.3) {
    // never the green-blue tone: a sea fan of it read as a patch of lawn
    // floating in the lagoon at park distance
    const fanMat = mat(t, [CORAL[0], CORAL[1], CORAL[4]][Math.floor(h(81) * 3) % 3], { tex: 'fabric', repeat: [2, 2], rough: 0.95 });
    fanMat.side = t.DoubleSide;
    for (let k = 0; k < 2; k += 1) {
      const fan = new t.Mesh(new t.PlaneGeometry(scale * (0.5 + 0.3 * h(k + 90)), scale * (0.45 + 0.3 * h(k + 95)), 3, 3), fanMat);
      fan.position.set((h(k + 100) - 0.5) * scale * 1.1, scale * (0.34 + 0.2 * h(k + 105)), (h(k + 110) - 0.5) * scale * 1.1);
      fan.rotation.set((h(k + 115) - 0.5) * 0.4, h(k + 120) * Math.PI, (h(k + 125) - 0.5) * 0.4);
      grp.add(fan);
    }
  }
  if (scale < 0.55) grp.userData.lodDetail = true;
  return grp;
}

// ---------------------------------------------------------------------------
export interface ReefRacerOpts {
  /** RCT2 track pieces (compileTrackPieces vocabulary) — replaces the stock
   *  Wreck Reef Run. Compiled on the 'flume' profile, heading −90°. */
  pieces?: TrackPiece[];
  /** decorative riders (default true; `register` turns them OFF so REAL
   *  GameManager guests fill the four thwarts through seatWorld) */
  riders?: boolean;
  /** terrain sampler so supports / reef / wreck land on the ground */
  groundAt?: (x: number, z: number) => number;
  /** loop parameter of the WRECK's breach (default: auto — the lowest,
   *  straightest, most level stretch of the home stretch) */
  wreckU?: number;
  /** the ride is registered with the GameManager, so the boat is HELD on its
   *  jetty from the first frame (§15 THE STATION LOCK). `registerRide`
   *  constructs the record already in `movingToEndOfStation` WITHOUT calling
   *  `setState`, so the gate's own handler cannot tell us this in time — an
   *  eased `movingToEndOfStation` would walk the boat off the jetty before
   *  anybody boards. Previews leave it false and run free. */
  registered?: boolean;
}

export interface ReefRacerBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  /** FATAL pieces compile — <ConfigurableRide> skips the registration */
  invalid?: boolean;
}

/**
 * The whole ride: the flooded water-coaster channel + the reef lagoon + the
 * broken ship in two pieces + the jetty station, and the reef skiff. `update`
 * is motion-gated (the boat parks in the station while guests board — RCT2
 * Vehicle.cpp status cycle) while the SEA keeps moving; `seatWorld` seats real
 * guests on the four thwarts and `vehicle` is the boat for the RideViewer
 * follow cam.
 */
export function buildReefRacerScene(three: typeof THREE, opts: ReefRacerOpts = {}): ReefRacerBuilt {
  const group = new three.Group();
  const extras: { vehicle?: THREE.Object3D; invalid?: boolean } = {};
  const seatAnchors: THREE.Object3D[] = [];
  let onStateChange: (state: string) => void = () => {};
  let seatWorld: (seat: number) => [number, number, number, number] = () => [0, 0, 0, 0];

  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const groundAt = opts.groundAt ?? (() => 0);

        // ---- 1. LAYOUT: the shared spline machinery ------------------------
        const compiled = compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, { profile: 'flume', start: START, heading: HEADING });
        g.userData.trackReport = compiled.report; // harness/agent introspection
        if (compiled.report.fatal) extras.invalid = true; // never registers as a working ride
        const ride = buildRideSpline(t, compiled.points, {
          profile: 'flume',
          colours: TRACK_COLOURS,
          groundAt,
          wood: true,
        });
        g.add(ride.group);
        const total = ride.curve.getLength();
        const yawOf = (f: { fwd: THREE.Vector3 }) => Math.atan2(f.fwd.x, f.fwd.z);
        const sideH = (f: { side: THREE.Vector3 }, out: THREE.Vector3) => out.set(f.side.x, 0, f.side.z).normalize();

        // frame scan: footprint, centroid and height above ground — every
        // "inside / outside" decision below is taken against them, so the
        // dressing follows ANY layout
        const M = 176;
        const railH: number[] = [];
        const cen = new t.Vector3();
        let x0 = Infinity;
        let x1 = -Infinity;
        let z0 = Infinity;
        let z1 = -Infinity;
        const poly: [number, number][] = [];
        for (let i = 0; i < M; i += 1) {
          const f = ride.frameAt(i / M);
          railH.push(f.p.y - groundAt(f.p.x, f.p.z));
          cen.add(f.p);
          x0 = Math.min(x0, f.p.x);
          x1 = Math.max(x1, f.p.x);
          z0 = Math.min(z0, f.p.z);
          z1 = Math.max(z1, f.p.z);
          poly.push([f.p.x, f.p.z]);
        }
        cen.multiplyScalar(1 / M).setY(0);
        const outSign = (u: number) => {
          const f = ride.frameAt(u);
          const s = sideH(f, new t.Vector3());
          return s.x * (f.p.x - cen.x) + s.z * (f.p.z - cen.z) >= 0 ? 1 : -1;
        };
        /** shortest horizontal distance from (x, z) to the track centreline */
        const distToTrack = (x: number, z: number) => {
          let d = Infinity;
          for (const [px, pz] of poly) d = Math.min(d, Math.hypot(px - x, pz - z));
          return d;
        };

        // ---- 2. THE COVE'S PLAN --------------------------------------------
        // ONE shoreline definition, shared by the water sheet AND the sand.
        // The lagoon is ONE `buildWater` sheet (WaterTile's palette untouched)
        // whose own shader discards outside `length(vLocal) > uRadius`; with
        // the mesh scaled LA/LB in x, that clip is exactly the UNWOBBLED
        // ellipse `sheetR < 1`. The turquoise read comes from a PALE CORAL-SAND
        // BED 0.10 under the surface, not from a re-saturated shader.
        const LX = (x0 + x1) / 2;
        const LZ = (z0 + z1) / 2;
        // padded generously OUTBOARD of the footprint: the wreck's outboard end
        // reaches ~2.5 past the track, and a shoreline that close made her look
        // beached on a beach instead of aground in a lagoon
        const LA = (x1 - x0) / 2 + 5.4; // semi-axis, x
        const LB = (z1 - z0) / 2 + 3.2; // semi-axis, z
        // ---- 2a. THE WATERLINE, AND WHY EVERY SAND LEVEL HANGS OFF IT ------
        // ⚠️ THE LAGOON FLOOR CAN NEVER GO BELOW THE HOST'S GROUND. This is the
        // constraint the first two passes at this cove both missed, and it is
        // what made it read as a drained pond. `groundAt` is a SAMPLER, not a
        // knife: the host's surface (Stage's grass disc at y = −0.02 in a
        // preview, the <Terrain> mesh in a park) is still drawn, and it OCCLUDES
        // anything this component puts under it. The bed plates used to sit at
        // `groundAt − 0.10` (top −0.065), i.e. 45 mm UNDER the preview's grass —
        // so the "pale coral-sand bed 0.10 under the surface, which is what
        // makes the water read turquoise" was never visible at all. Probed
        // (harness/mp3d-render/probe-reef-water.mjs, 6221 raycast cells inside
        // the sheet): the middle of the pool was the HOST'S GRASS seen through
        // 95 mm of water, and 22.6 % of the sheet's own footprint had sand
        // standing ABOVE the water surface — a wide grey-brown ring of bare
        // SAND_WET between the waterline and the apron.
        //
        // So depth cannot be dug; it can only be BUILT UP. Every sand level is
        // therefore expressed as an offset from the WATERLINE and floored at
        // `groundAt + …` so it can never sink under the host again:
        //
        //     dry apron crest   waterY + 0.055   <- the LIP. narrow wet shore
        //     station spit      waterY + 0.050   <- always dry, always walkable
        //     awash wet band    waterY − 0.090   <- the shore strip, submerged
        //     lagoon bed        waterY − 0.290   <- PALE SAND, now above the host
        //
        // and the waterline itself goes to `groundAt + 0.30` (was + 0.030), i.e.
        // the cove's apron stands exactly ONE RCT2 LAND STEP above the ground
        // around it — 1/4 tile, which on this kit's 1.2-u tile is 0.3 — which is
        // precisely how a player digs a pond in RCT2: you don't lower the water,
        // you raise the land around it (`world/tile_element/SurfaceElement`
        // heights step in quarter-tiles; `WATER_LEVEL` sits between two of them).
        //
        // The CEILING on that number is the STATION SPIT, not the trough: the
        // queue lane and the exit hut stand on the spit, so the spit has to
        // out-climb the waterline and everything the park attaches there rides up
        // with it. One land step is the most that can be spent on that without
        // the queue needing more than the path solver's ordinary ramp; §13's step
        // ladder up to the jetty deck is seated off `spitTopY` now, so the sand
        // and the steps can never drift apart again.
        // The trough is nowhere near: the flume floor's lowest point is
        // groundAt + 0.48 (measured), 0.18 clear of the new surface.
        const waterY = groundAt(LX, LZ) + 0.3;
        /** the LAGOON BED's top surface, and it is a DISH: pale coral sand 0.29
         *  under the waterline in the middle, shelving up to the shore's 0.09 by
         *  `lagoonR` 0.90 where the awash WET band takes over. Floored at
         *  `groundAt + 0.012` so the pale sand is always ABOVE the host's own
         *  surface and therefore actually visible (see 2a). This is what the reef,
         *  the wreck debris and the ripple ridges all stand on. */
        const bedTopAt = (x: number, z: number) => {
          const floor = Math.max(groundAt(x, z) + 0.012, waterY - 0.29);
          const shelf = waterY - 0.09;
          const f = Math.min(1, Math.max(0, (lagoonR(x, z) - 0.55) / 0.35));
          return floor + (shelf - floor) * f * f * (3 - 2 * f);
        };
        /** the DRY APRON's crest — the basin LIP the waterline sits just under.
         *  Only the RIM is raised: outside `lagoonR` 1.15 the lift eases back to
         *  the apron's original `groundAt + 0.105` by 1.55, so the cove is ringed
         *  by a beach berm and not by a 0.2-high sand kerb running to the fog.
         *  (Reads `lagoonR`, declared just below — a const closure, and nothing
         *  calls this before §3.) */
        const lipTopAt = (x: number, z: number) => {
          const base = groundAt(x, z) + 0.105;
          const crest = Math.max(base, waterY + 0.055);
          const f = Math.min(1, Math.max(0, (1.55 - lagoonR(x, z)) / 0.4));
          return base + (crest - base) * f * f * (3 - 2 * f);
        };
        /** the STATION SPIT's top: always above the waterline, because the queue
         *  lane and the exit hut stand on it */
        const spitTopY = Math.max(groundAt(LX, LZ) + 0.083, waterY + 0.05);
        /** the DRY SAND SPIT the station and its queue lane stand on — the one
         *  place the lagoon is not allowed to reach (paths need dry ground) */
        const inSpit = (x: number, z: number) => x > -4.8 && x < 2.6 && z > -2.7 && z < 7.4;
        /** THE WATER SHEET'S OWN PLAN-FORM (< 1 = the shader draws water here).
         *  Everything that must not stand through the sheet is tested against
         *  THIS, never against the wobbled `lagoonR`. */
        const sheetR = (x: number, z: number) => Math.hypot((x - LX) / LA, (z - LZ) / LB);
        /** < 1 inside the lagoon; the shoreline is wobbled so it never reads
         *  as a drawn ellipse. Only ever moves the SAND classes about — the
         *  sheet itself is `sheetR`. */
        const lagoonR = (x: number, z: number) => {
          const dx = (x - LX) / LA;
          const dz = (z - LZ) / LB;
          const az = Math.atan2(dz, dx);
          const wob = 1 + 0.06 * Math.sin(az * 3 + 1.1) + 0.035 * Math.sin(az * 5 - 2.3) + 0.02 * Math.sin(az * 8 + 0.4);
          return Math.hypot(dx, dz) / wob;
        };
        const isWater = (x: number, z: number) => lagoonR(x, z) < 1 && !inSpit(x, z);

        // ---- 3. THE SAND: the ride brings its own ground -------------------
        // Built BEFORE the water, because the water is now CUT TO IT.
        //
        // A lattice of overlapping sand plates over the WHOLE footprint, each
        // seated by its TOP off the WATERLINE (§2a) so the cove is a basin
        // whatever the host's ground does, at one of four heights:
        // the lagoon BED (0.10 under the surface — pale, this is what makes
        // the water read turquoise), a WET band right at the waterline, the
        // flat station SPIT above it, and a raised dry BERM everywhere
        // else, which is what gives the cove a shoreline.
        //
        // ⚠️ EVERY PLATE IS A SLAB, NOT A TILE. `THK` was 0.07, which was fine
        // only while every plate was seated ON `groundAt`. Now that the bed and
        // the apron stand 0.01–0.36 ABOVE the host's surface, a 0.07 tile would
        // float with daylight under its edges (the old dry berm already did:
        // top groundAt + 0.113, bottom + 0.035, over a grass disc at −0.02). At
        // 0.55 every plate's underside is buried in the host ground and the
        // lattice reads as a solid sand body. It costs nothing — a box is 12
        // triangles whatever its height, and they are all in one merged mesh.
        //
        // ⚠️ THE PLATES OVERLAP, AND THAT IS WHAT USED TO PUT SAND THROUGH THE
        // WATER. dims are STEP + 0.52…0.74 on a STEP 1.15 lattice and every
        // plate is rotated, so a plate reaches up to 1.29 u past its own
        // centre. Classified by CENTRE, the DRY BERM (top groundAt + 0.113)
        // therefore bled ~0.9 u INSIDE a sheet whose surface is groundAt +
        // 0.005: probed, the sheet's own rim was buried in proud sand in 32 of
        // 72 azimuths and 9.4 % of the sheet had ground standing above its wave
        // crest. So a plate is DRY only when ALL FOUR of its rotated corners
        // clear both the sheet ellipse and the wobbled shoreline, and the BED /
        // WET plates are additionally CLAMPED under `waterY` so a sloping plot
        // cannot lift the basin through a level pond.
        const PAD = 7.2;
        const STEP = 1.15;
        const THK = 0.55; // plate thickness — a slab with a skirt, see above
        const GX = x0 - PAD;
        const GZ = z0 - PAD;
        const NX = Math.floor((x1 + PAD - GX) / STEP) + 1;
        const NZ = Math.floor((z1 + PAD - GZ) / STEP) + 1;
        // per-cell plate geometry, kept so the water sheet can be tucked under
        // whatever the lattice actually put there
        const pTop = new Float32Array(NX * NZ);
        const pRot = new Float32Array(NX * NZ);
        const pHX = new Float32Array(NX * NZ);
        const pHZ = new Float32Array(NX * NZ);
        {
          const bed: MergedBoxSpec[] = [];
          const wet: MergedBoxSpec[] = [];
          const dry: MergedBoxSpec[] = [];
          const dry2: MergedBoxSpec[] = [];
          const spit: MergedBoxSpec[] = [];
          const dunes: MergedBoxSpec[] = [];
          for (let ix = 0; ix < NX; ix += 1)
            for (let iz = 0; iz < NZ; iz += 1) {
              const x = GX + ix * STEP;
              const z = GZ + iz * STEP;
              const h1 = hash01(x * 1.7 + z * 3.1);
              const h2 = hash01(x * 5.3 + z * 0.9);
              const h3 = hash01(x * 2.3 + z * 6.7);
              const gy = groundAt(x, z);
              // plates are rotated hard and sized unevenly: at 0.3 rad the
              // lattice still read as a paved courtyard from the DS camera
              const dimX = STEP + 0.52 + h3 * 0.22;
              const dimZ = STEP + 0.52 + h1 * 0.22;
              const rot = (h1 - 0.5) * 0.5;
              const spec: MergedBoxSpec = { dims: [dimX, THK, dimZ], pos: [x, gy, z], rotY: rot, repeat: [2, 2] };
              /** seat a plate by its TOP surface (every level below is quoted as
               *  a top, because what matters is where it meets the water) */
              const seatTop = (top: number) => {
                spec.pos = [x, top - THK / 2, z];
              };
              // the plate's four rotated corners: a plate only counts as DRY
              // when every one of them is clear of the water
              const cs = Math.cos(rot);
              const sn = Math.sin(rot);
              let cornerSheet = Infinity;
              let cornerLagoon = Infinity;
              for (const sx of [-1, 1] as const)
                for (const sz of [-1, 1] as const) {
                  const wx = x + cs * (sx * dimX * 0.5) + sn * (sz * dimZ * 0.5);
                  const wz = z - sn * (sx * dimX * 0.5) + cs * (sz * dimZ * 0.5);
                  cornerSheet = Math.min(cornerSheet, sheetR(wx, wz));
                  cornerLagoon = Math.min(cornerLagoon, lagoonR(wx, wz));
                }
              const r = lagoonR(x, z);
              if (inSpit(x, z)) {
                // the station apron is BUILT-UP ground, not terrain: seated on
                // `spitTopY` (= waterY + 0.05, floored at the host's own path
                // level) so a plot that dips below the waterline gets a raised
                // sand spit rather than a drowned queue lane (probed on a ±0.35
                // plot: 170 of 633 apron samples had water over them before this
                // clamp, 0 after)
                seatTop(spitTopY + h2 * 0.006);
                spit.push(spec);
              } else if (r < 0.9) {
                // the BED. `bedTopAt` is waterY − 0.10, floored at groundAt +
                // 0.012 so the pale sand is always ABOVE the host's surface and
                // therefore actually VISIBLE (§2a) — this used to be groundAt −
                // 0.10, buried under the host's own ground, which is why the
                // pool read as dark grass-green rather than coral turquoise.
                seatTop(bedTopAt(x, z) - h2 * 0.008);
                bed.push(spec);
              } else if (cornerSheet < 1 || cornerLagoon < 1.03) {
                // the awash WET band: top 0.090–0.096 UNDER the waterline, so it
                // is a submerged shore strip rather than the wide DRY shelf it had
                // become — and 0.05 under the swell's own trough (±0.040), which
                // is the clearance that stops the sheet clipping through to bare
                // sand at the shore. Same level the bed's dish shelves up to, so
                // bed and band meet flush at `lagoonR` 0.90.
                seatTop(waterY - 0.09 - h2 * 0.006);
                wet.push(spec);
              } else {
                // the DRY APRON — the basin LIP. 0.055 over the waterline: the
                // narrowest shore that still keeps the swell off the berm.
                seatTop(lipTopAt(x, z) + h2 * 0.008);
                (h3 > 0.5 ? dry : dry2).push(spec);
                // low DUNES on the outer berm — three stacked slabs, so the
                // shoreline has a back to it instead of running flat to the fog
                if (r > 1.18 && h3 > 0.78)
                  for (let k = 0; k < 2; k += 1)
                    dunes.push({
                      dims: [(1.7 - k * 0.4) * (0.85 + h1 * 0.5), 0.14, (1.7 - k * 0.4) * (0.85 + h2 * 0.5)],
                      pos: [x + (h1 - 0.5) * 0.4, lipTopAt(x, z) + 0.025 + k * 0.1, z + (h2 - 0.5) * 0.4],
                      rotY: h3 * 2.4 + k,
                      repeat: [2, 2],
                    });
              }
              const k = ix * NZ + iz;
              pTop[k] = (spec.pos as [number, number, number])[1] + THK / 2;
              pRot[k] = rot;
              pHX[k] = dimX * 0.5;
              pHZ[k] = dimZ * 0.5;
            }
          const opt = { tex: 'sand' as const, rough: 1, bump: 0.05, flat: true };
          // every lattice mesh is TAGGED with the level it carries. The four sand
          // classes are all the same `mat()` white-with-a-texture material, so a
          // probe cannot tell them apart by colour — and "which of these is the
          // apron lip" is exactly the question a waterline has to be checked
          // against (harness/mp3d-render/probe-reef-water.mjs).
          const tag = (m: THREE.Object3D, sand: string) => {
            m.userData.sand = sand;
            return m;
          };
          const bedMesh = tag(mergedBoxes(t, bed, SAND_BED, opt), 'bed');
          bedMesh.castShadow = false;
          g.add(bedMesh);
          const wetMesh = tag(mergedBoxes(t, wet, SAND_WET, opt), 'wet');
          wetMesh.castShadow = false;
          g.add(wetMesh);
          g.add(tag(mergedBoxes(t, dry, SAND, opt), 'dry'));
          g.add(tag(mergedBoxes(t, dry2, SAND_2, opt), 'dry'));
          g.add(tag(mergedBoxes(t, spit, SAND, opt), 'spit'));
          g.add(tag(mergedBoxes(t, dunes, SAND_2, opt), 'dune'));
          // shell + coral-rubble litter strewn over the berm: the plate lattice
          // still showed its rectangles from the DS camera, and a scatter of
          // small pale chips breaks every straight edge it draws. `rr` starts
          // at 1.04, not 1.0 — chips ON the sheet's rim stood 0.137 proud of it.
          const litter: MergedBoxSpec[] = [];
          for (let k = 0; k < 260; k += 1) {
            const h1 = hash01(k * 1.7 + 11);
            const h2 = hash01(k * 3.9 + 29);
            const h3 = hash01(k * 6.3 + 47);
            const ang = h1 * Math.PI * 2;
            const rr = 1.04 + 0.34 * h2;
            const cx = LX + Math.cos(ang) * LA * rr;
            const cz = LZ + Math.sin(ang) * LB * rr;
            if (inSpit(cx, cz)) continue;
            const sz = 0.09 + h3 * 0.16;
            litter.push({
              dims: [sz, 0.045 + h1 * 0.03, sz * (0.6 + h2 * 0.7)],
              // ON the apron, not on the host's ground — the apron's crest moved
              // up with the waterline (§2a) and chips left at `groundAt + 0.11`
              // would have sunk inside it
              pos: [cx, lipTopAt(cx, cz) + 0.005, cz],
              rotY: h2 * 3.1,
              rotZ: (h3 - 0.5) * 0.4,
            });
          }
          const litterMesh = mergedBoxes(t, litter, 0xe4dcc0, { tex: 'concrete', rough: 0.95, bump: 0.05, flat: true });
          litterMesh.userData.lodDetail = true;
          g.add(litterMesh);
        }

        /** the TOP of the sand at (x, z): the max over every plate that really
         *  covers the point. Plates overlap by design, so this is a max over
         *  the ±2 lattice cells a 1.89-wide plate on a 1.15 lattice can reach
         *  from — not a lookup of the nearest cell. */
        const sandTopAt = (px: number, pz: number) => {
          const fx = Math.round((px - GX) / STEP);
          const fz = Math.round((pz - GZ) / STEP);
          let best = -Infinity;
          for (let ix = fx - 2; ix <= fx + 2; ix += 1) {
            if (ix < 0 || ix >= NX) continue;
            for (let iz = fz - 2; iz <= fz + 2; iz += 1) {
              if (iz < 0 || iz >= NZ) continue;
              const k = ix * NZ + iz;
              if (pTop[k] <= best) continue;
              const dx = px - (GX + ix * STEP);
              const dz = pz - (GZ + iz * STEP);
              const cs = Math.cos(pRot[k]);
              const sn = Math.sin(pRot[k]);
              if (Math.abs(cs * dx - sn * dz) > pHX[k]) continue;
              if (Math.abs(sn * dx + cs * dz) > pHZ[k]) continue;
              best = pTop[k];
            }
          }
          return best;
        };

        // ---- 3b. THE LAGOON SHEET, TUCKED INTO ITS OWN BASIN ---------------
        // amp 0.22 x waviness 0.6 swells ±0.040 about y = waterY: the troughs
        // stay 0.10 clear of the bed, so the sheet never clips through to bare
        // sand (the old full-amp troughs punched holes in shallow basins).
        //
        // ⚠️ THE SHEET IS A DISC AND THE COVE IS NOT. buildWater's shader
        // clips a plain ellipse; the station SPIT, the dry berm's plate
        // overrun, and ANY terrain the caller passes all stand inside that
        // ellipse. Probed before this pass: 9.4 % of the sheet had ground above
        // its wave crest on FLAT ground (56.5 % on a ±0.35 plot), 99.8 % of the
        // station apron under the sheet stood proud of it, and the water plane
        // ran 6.27 u inside its own rim across the dry apron and the jetty.
        //
        // The fix is not to raise the sheet (that floods the apron — a sibling
        // land learned that at `groundAt + 0.002…0.012` against a surface at
        // `groundAt + 0.005`) and not to punch a hole in it (that loses the
        // shader's shore foam and edge alpha-fade, which live on `uRadius`).
        // It is to BAKE A DIVE into the plane's own vertices: wherever the sand
        // stands above the water plane, the sheet slides 0.05 UNDER the sand
        // and is hidden by it. `vLocal` is `position.xy`, which a height-only
        // displacement does not touch, so the rim fade and the foam ring are
        // untouched — and the visible waterline becomes the real sand surface
        // instead of a drawn ellipse.
        //
        // ⚠️ AND THE SHEET MUST BE BIGGER THAN THE COVE, NOT THE SAME SIZE. The
        // sand's shoreline is the WOBBLED `lagoonR`, whose wobble reaches 1.115,
        // but the shader clips the UNWOBBLED ellipse at `sheetR` 1 — so on every
        // azimuth where the wobble pushed the sand out past 1.0 there was WET
        // BAND with no water on it. That is the grey-brown ring: measured at 22.6
        // % of the sheet's own footprint, ~1.5 u wide, and no amount of raising
        // the plane could reach it. `uRadius` therefore goes to LB · 1.16, past
        // the wobble's own maximum, and the DIVE above does the rest: the sheet
        // runs under the apron and the visible waterline is the real sand
        // contour. Plane size grows with it (2.06 → 2.39 = 1.16 · 2.06) so the
        // clip circle still falls inside the plane's own rim.
        const lagoon = buildWater(t, LB * 2.39, 128, LB * 1.16, false, 0.22, 0.6);
        lagoon.mesh.position.set(LX, waterY, LZ);
        lagoon.mesh.scale.set(LA / LB, 1, 1); // local circle -> world ellipse
        {
          const HIDE = 0.05; // how far under proud sand the sheet is tucked
          const SLOPE = 0.3; // the dive's own gradient — a 17° water surface
          const RAD = 3; // cone-dilation radius, in vertices
          const attr = lagoon.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
          const SEG = 128;
          const W = SEG + 1;
          const kx = LA / LB; // the mesh's x scale: local x -> world x
          const raw = new Float32Array(W * W);
          for (let i = 0; i < attr.count; i += 1) {
            // mesh.rotation.x = −π/2, so local (x, y, z) lands at world
            // (LX + kx·x, waterY + z, LZ − y)
            const wx = LX + kx * attr.getX(i);
            const wz = LZ - attr.getY(i);
            const over = sandTopAt(wx, wz) - waterY;
            raw[i] = over > 0 ? over + HIDE : 0;
          }
          // MAX-PLUS (cone) dilation: smooths the plate rectangles into a
          // shoreline and can only ever dive DEEPER, so nothing the raw pass
          // caught can resurface. Spacing differs per axis because of the scale.
          const sx = (kx * LB * 2.39) / SEG; // = the plane size passed to buildWater
          const sz = (LB * 2.39) / SEG;
          const dive = new Float32Array(W * W);
          for (let iy = 0; iy < W; iy += 1)
            for (let ix = 0; ix < W; ix += 1) {
              let best = 0;
              for (let dy = -RAD; dy <= RAD; dy += 1) {
                const jy = iy + dy;
                if (jy < 0 || jy >= W) continue;
                for (let dx = -RAD; dx <= RAD; dx += 1) {
                  const jx = ix + dx;
                  if (jx < 0 || jx >= W) continue;
                  const v = raw[jy * W + jx] - SLOPE * Math.hypot(dx * sx, dy * sz);
                  if (v > best) best = v;
                }
              }
              dive[iy * W + ix] = best;
            }
          for (let i = 0; i < attr.count; i += 1) attr.setZ(i, -dive[i]);
          attr.needsUpdate = true;
          lagoon.mesh.geometry.computeBoundingSphere();
        }
        lagoon.mesh.userData.lagoonSheet = true;
        g.add(lagoon.mesh);
        // THE COVE'S NUMBERS, published for probes/agents exactly like
        // `trackReport` / `wreckAt` / `sharkPath` above — the waterline and the
        // four sand levels it is defined against, so "is the water above the reef
        // and below the lip" is a read rather than a re-derivation.
        g.userData.lagoon = {
          x: LX,
          z: LZ,
          a: LA,
          b: LB,
          waterY,
          bedFloorY: bedTopAt(LX, LZ),
          bedShelfY: waterY - 0.09,
          lipY: lipTopAt(LX + LA, LZ),
          spitY: spitTopY,
          sheetRadius: LB * 1.16,
        };

        // ---- 4. the CHUTE + its splashdown (deterministic, no hard-coded u)
        let uSteep = 0;
        let steep = 0;
        for (let i = 0; i < 480; i += 1) {
          const f = ride.frameAt(i / 480);
          if (f.fwd.y < steep) {
            steep = f.fwd.y;
            uSteep = i / 480;
          }
        }
        let uRun = uSteep;
        for (let i = Math.ceil(uSteep * 480); i < 480; i += 1)
          if (ride.frameAt(i / 480).fwd.y > -0.14) {
            uRun = i / 480;
            break;
          }
        const runF = ride.frameAt(uRun + 0.012);
        const SPLASH_AT = runF.p.clone();
        const splashY = runF.p.y + 0.035;

        // ---- 5. WHERE THE WRECK LIES --------------------------------------
        // The BREACH goes on the lowest, straightest, most level stretch of
        // the HOME STRETCH (the |u − 0.86| term keeps it off the splash
        // run-out; override with `wreckU`); the BOWSPRIT crosses just past the
        // splashdown, so the boats shoot under it while they are still wet.
        const wreckU = (() => {
          if (opts.wreckU !== undefined) return opts.wreckU;
          let best = 0.86;
          let bestScore = Infinity;
          const d = 1.7 / total;
          for (let i = 0; i < 300; i += 1) {
            const u = i / 300;
            if (u < 0.72 || u > 0.95) continue;
            const f = ride.frameAt(u);
            const a = ride.frameAt(u - d).fwd;
            const b = ride.frameAt(u + d).fwd;
            const bend = 1 - (a.x * b.x + a.z * b.z) / ((Math.hypot(a.x, a.z) || 1) * (Math.hypot(b.x, b.z) || 1));
            const score = (f.p.y - groundAt(f.p.x, f.p.z)) * 0.8 + bend * 34 + Math.abs(f.fwd.y) * 10 + Math.abs(u - 0.86) * 5;
            if (score < bestScore) {
              bestScore = score;
              best = u;
            }
          }
          return best;
        })();
        const bowU = Math.min(0.999, uRun + 1.7 / total);
        const wreckF = ride.frameAt(wreckU);
        const bowF = ride.frameAt(bowU);
        g.userData.wreckAt = [wreckF.p.x, wreckF.p.y, wreckF.p.z];
        g.userData.bowspritAt = [bowF.p.x, bowF.p.y, bowF.p.z];

        const lampMats: THREE.MeshStandardMaterial[] = [];
        const wreckLight = new t.PointLight(LAMP_GLOW, 0, 7.2, 2);
        const bowLight = new t.PointLight(LAMP_GLOW, 0, 5.4, 2);

        // ---- 5a. THE BROKEN HULL, set across the home stretch -------------
        const LIST = -0.16; // 9.2° to starboard
        {
          const yard = new t.Group();
          // origin ON the channel centreline, AT the lagoon surface: the ship
          // is simply dropped on the water where the track crosses her
          yard.position.set(wreckF.p.x, waterY, wreckF.p.z);
          // ship's local +x runs along the track, skewed 16° so she reads as
          // driven aground rather than parked; local +z (the keel) therefore
          // points INBOARD, and her sunken stern half fills the lagoon inside
          // the loop
          yard.rotation.y = yawOf(wreckF) - Math.PI / 2 + 0.28 * outSign(wreckU);
          g.add(yard);
          const heel = new t.Group();
          heel.rotation.set(0.05, 0, LIST, 'YXZ'); // list to starboard + a touch by the stern
          yard.add(heel);
          const hull = buildWreckHull(t, { lamps: lampMats });
          heel.add(hull);
          // the hanging passage lantern's real light
          const la = hull.userData.lampAt as [number, number, number];
          wreckLight.position.set(la[0], la[1] - 0.1, la[2]);
          heel.add(wreckLight);
          // the reef she is impaled on: coral and rock crowding her bilges,
          // kept clear of the channel envelope
          for (let k = 0; k < 14; k += 1) {
            const h1 = hash01(k * 5.9 + 21);
            const h2 = hash01(k * 2.3 + 37);
            const s = k % 2 ? 1 : -1;
            const lx = s * (1.5 + h1 * 1.5);
            const lz = -4.6 + h2 * 6.6;
            // skip anything that would stand in the boats' way (the channel
            // crosses the hull along local x at |z| < 0.9)
            if (Math.abs(lz) < 1.5) continue;
            const wx = yard.position.x + Math.sin(yard.rotation.y) * lz + Math.cos(yard.rotation.y) * lx;
            const wz = yard.position.z + Math.cos(yard.rotation.y) * lz - Math.sin(yard.rotation.y) * lx;
            if (distToTrack(wx, wz) < 1.35) continue;
            const head = buildCoralHead(t, 40 + k * 7, 0.32 + h1 * 0.5);
            head.position.set(wx, bedTopAt(wx, wz) - 0.08, wz); // the BED, not the host's ground
            g.add(head);
          }
        }

        // ---- 5b. THE SEVERED BOW SECTION + the BOWSPRIT over the channel ---
        {
          // INBOARD (into the lagoon): the splashdown run-out hugs the far
          // edge of the cove, so 3.3 units OUTBOARD of it landed her on the dry
          // berm — a shipwreck beached on a beach
          const sOut = -outSign(bowU);
          const side = sideH(bowF, new t.Vector3());
          const fwdH = new t.Vector3(bowF.fwd.x, 0, bowF.fwd.z).normalize();
          const OFF = 3.4;
          const px = bowF.p.x + side.x * sOut * OFF - fwdH.x * 0.5;
          const pz = bowF.p.z + side.z * sOut * OFF - fwdH.z * 0.5;
          const bowYaw = Math.atan2(-side.x * sOut, -side.z * sOut) + 0.42; // stem toward the channel, skewed
          const PITCH = -0.3; // reared up: the stem lifts, the break digs in
          const HEEL = 0.2;
          const bowGrp = new t.Group();
          // ⚠️ SEATED OFF THE WATERLINE, NOT OFF THE GROUND. What makes her read
          // as a wreck is how much of her is out of the WATER, so she hangs off
          // `waterY` exactly as the broken hull does (§5a) — `waterY − 0.33` is
          // the same offset the old `groundAt − 0.30` had against the old
          // `groundAt + 0.03` surface, so the measured read is preserved
          // unchanged: stem head 1.63 above the lagoon, ~2.4 units of deck out of
          // the water. (Deeper than that and she read as a buried wedge; the
          // deeper basin does not sink her, it only puts more water under her
          // keel — and her own hull runs 2.5 below this origin, so she is still
          // dug into the reef, not floating on it.)
          bowGrp.position.set(px, waterY - 0.33, pz);
          bowGrp.rotation.set(0, bowYaw, 0);
          g.add(bowGrp);
          g.userData.bowAt = [px, waterY - 0.03, pz];
          const tip = new t.Group();
          tip.rotation.set(PITCH, 0, HEEL, 'YXZ');
          bowGrp.add(tip);
          const bow = buildWreckBow(t);
          tip.add(bow);
          // the coral head she is impaled on
          for (let k = 0; k < 7; k += 1) {
            const h1 = hash01(k * 8.1 + 63);
            const h2 = hash01(k * 3.7 + 71);
            const lx = (h1 - 0.5) * 2.4;
            const lz = -1.9 + h2 * 3.4;
            const wx = px + Math.sin(bowYaw) * lz + Math.cos(bowYaw) * lx;
            const wz = pz + Math.cos(bowYaw) * lz - Math.sin(bowYaw) * lx;
            if (distToTrack(wx, wz) < 1.3) continue;
            const head = buildCoralHead(t, 120 + k * 5, 0.38 + h1 * 0.55);
            head.position.set(wx, bedTopAt(wx, wz) - 0.06, wz); // the BED, not the host's ground
            g.add(head);
          }

          // THE BOWSPRIT is built in RIDE-LOCAL space, not on the hull, so its
          // clearance over the channel is exact by construction: the spar runs
          // from her stem head THROUGH a point 1.55 above the channel
          // centreline (the boat's true high point, the stern lantern, tops out
          // at 0.724 above the rail — measured, see §10b) and 1.4 units
          // past it.
          const stemLocal = new t.Vector3(...(bow.userData.stemHead as [number, number, number]));
          const mTip = new t.Matrix4().makeRotationFromEuler(new t.Euler(PITCH, 0, HEEL, 'YXZ'));
          const mGrp = new t.Matrix4().makeRotationFromEuler(new t.Euler(0, bowYaw, 0));
          mGrp.setPosition(bowGrp.position);
          const stemW = stemLocal.clone().applyMatrix4(mTip).applyMatrix4(mGrp);
          const cross = bowF.p.clone().addScaledVector(bowF.up, 1.55);
          const dir = cross.clone().sub(stemW).normalize();
          const tipW = stemW.clone().addScaledVector(dir, stemW.distanceTo(cross) + 1.4);
          const bowsprit = spar(t, stemW.clone(), tipW.clone(), 0.115, 0.05, TIMBER);
          bowsprit.userData.nearMiss = 'bowsprit';
          g.add(bowsprit);
          // a jibboom lashed on beyond the tip, iron bands, a bobstay chain
          // sagging back to the stem, and a footrope
          const jib = tipW.clone().addScaledVector(dir, 0.9).addScaledVector(new t.Vector3(0, 1, 0), 0.12);
          g.add(spar(t, tipW.clone().addScaledVector(dir, -0.5), jib, 0.05, 0.028, TIMBER_D));
          const bands: MergedBoxSpec[] = [];
          for (let k = 1; k <= 4; k += 1) {
            const at = stemW.clone().addScaledVector(dir, (k / 5) * stemW.distanceTo(tipW));
            const m = new t.Matrix4().makeRotationFromQuaternion(
              new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir),
            );
            m.setPosition(at);
            bands.push({ dims: [0.2, 0.07, 0.2], matrix: m });
          }
          g.add(mergedBoxes(t, bands, RUST, { tex: 'metal', metal: 0.3, rough: 0.94 }));
          const chainMat = mat(t, RUST, { tex: 'metal', metal: 0.35, rough: 0.9 });
          g.add(line(t, stemW.clone().addScaledVector(dir, 1.4), stemW.clone().addScaledVector(new t.Vector3(0, -1, 0), 0.95), 0.2, 0.03, chainMat));
          const ropeMat = mat(t, TAR, { tex: 'fabric', rough: 0.98 });
          g.add(line(t, stemW.clone(), tipW.clone(), 0.34, 0.014, ropeMat));
          // a shred of jib canvas still hanging off the spar
          {
            const canvas = mat(t, CANVAS, { tex: 'fabric', repeat: [2, 2], rough: 0.95 });
            canvas.side = t.DoubleSide;
            const rag = raggedSail(t, 0.8, 0.75, 41, canvas);
            const at = stemW.clone().addScaledVector(dir, stemW.distanceTo(tipW) * 0.42);
            rag.position.copy(at);
            rag.rotation.y = Math.atan2(dir.x, dir.z);
            g.add(rag);
          }
          // THE LANTERN hanging off the spar right over the channel
          {
            const hangAt = cross.clone().addScaledVector(dir, 0.45);
            const lamp = shipLantern(t, 1.05);
            lamp.group.position.copy(hangAt).add(new t.Vector3(0, -0.36, 0));
            g.add(lamp.group);
            lampMats.push(lamp.glass);
            g.add(line(t, hangAt.clone(), hangAt.clone().add(new t.Vector3(0, -0.2, 0)), 0, 0.009, chainMat));
            bowLight.position.copy(lamp.group.position).add(new t.Vector3(0, -0.15, 0));
            g.add(bowLight);
          }
        }

        // ---- 6. THE REEF: coral heads, sand banks and scattered rock ------
        {
          const banks: MergedBoxSpec[] = [];
          const ripples: MergedBoxSpec[] = [];
          const STEP = 1.95;
          let placed = 0;
          for (let x = x0 - 4.4; x <= x1 + 4.4; x += STEP)
            for (let z = z0 - 4.4; z <= z1 + 4.4; z += STEP) {
              const h1 = hash01(x * 2.9 + z * 1.3 + 7);
              const h2 = hash01(x * 0.7 + z * 4.1 + 13);
              const h3 = hash01(x * 3.7 + z * 2.3 + 29);
              const cx = x + (h1 - 0.5) * STEP * 0.7;
              const cz = z + (h2 - 0.5) * STEP * 0.7;
              if (!isWater(cx, cz)) continue;
              const dT = distToTrack(cx, cz);
              if (dT < 1.15) continue; // never in the boats' way
              // ⚠️ ON THE BED, NOT ON `groundAt`. The reef used to be seated on
              // the HOST's ground, 0.15 above a bed that was itself buried under
              // it, so every head stood 0.2–0.8 clear of a 0.095-deep waterline:
              // probed, 58 of 58 scatter items were PROUD of the water and the
              // lagoon read as a rockery someone had hosed down. `bedTopAt` is
              // the dish (§2a), so a head near the middle now has 0.29 of water
              // over the sand it grows out of and one at the rim has 0.09.
              const by = bedTopAt(cx, cz);
              if (h3 < 0.42) {
                // a CORAL HEAD, the tallest ones breaking the surface — coral
                // outnumbers bare rock 2:1, or the lagoon reads as a boulder
                // field rather than a reef. A head is ~0.96·scale tall, so the
                // scale range is what decides whether the reef is UNDER the
                // water: 0.32…0.98 could not be (0.31…0.94 tall against 0.29 of
                // water), 0.26…0.70 can. `− 0.16·h2` sinks each head a little
                // further so the tops STRADDLE the waterline instead of all
                // landing on it.
                // ...AND CAPPED BY THE WATER IT HAS TO GROW IN. A head is
                // 0.957·scale tall (measured off the built group, not assumed),
                // so on the dish's 0.09-deep rim shelf a scale-0.70 head is 0.58
                // of coral in 0.09 of water — which is the "high and dry" read
                // however high the sheet goes. Coral grows TO the surface, not
                // through it: the cap is the local depth plus a small overshoot,
                // and one head in seven (`h2 > 0.86`) gets a big enough overshoot
                // to stand clear as a hero head, so "the tallest ones breaking the
                // surface" is finally true instead of "all of them".
                const over = h2 > 0.86 ? 0.34 : 0.04;
                const sc = Math.min(0.26 + h1 * (dT > 2.4 ? 0.44 : 0.22), (waterY - by + over + 0.16 * h2) / 0.957);
                const head = buildCoralHead(t, 200 + placed * 11, sc);
                head.position.set(cx, by - 0.08 - 0.16 * h2, cz);
                head.userData.reef = 'coral'; // tagged so probes can measure it
                g.add(head);
                placed += 1;
              } else if (h3 < 0.62) {
                // a REEF ROCK — bare rock reads DRY the moment it breaks the
                // surface, so these sit lower than the coral and stay under
                // a reef rock is 0.90·scale tall (measured), and it is capped
                // to stay ENTIRELY under the surface — bare grey rock is what
                // read as "drained pond" more than anything else in the cove
                const sc = Math.min(0.2 + h2 * (dT > 2.2 ? 0.34 : 0.14), (waterY - by + 0.02 + 0.12 * h1) / 0.9);
                const rock = buildRock(t, { scale: sc, seed: 300 + placed * 7, tint: h1 > 0.5 ? REEF : REEF_D });
                rock.position.set(cx, by - 0.14 - 0.12 * h1, cz);
                rock.userData.reef = 'rock'; // tagged so probes can measure it
                if (sc < 0.42) rock.userData.lodDetail = true;
                g.add(rock);
                placed += 1;
              } else if (h3 < 0.72 && dT > 2.8) {
                // a SAND BANK just breaking the surface: overlapping slabs in
                // the WET tone, so it reads as a submerged bar and not as a
                // sheet of paper floating on the lagoon. Seated off `waterY`,
                // NOT off `groundAt` — the whole point is where they sit
                // relative to the WATERLINE, and every slab's top now lands in
                // the ±0.040 swell band (waterY − 0.050 … + 0.018) so the
                // crests wash over them instead of them floating on the sheet.
                // These are the ONE part of the reef that is meant to break the
                // surface, so they were right all along and are untouched.
                const n = 2 + Math.floor(h1 * 3);
                for (let k = 0; k < n; k += 1) {
                  const hk = hash01(placed * 3.1 + k * 5.7);
                  const w = 0.9 + hk * 1.3;
                  const th = 0.09 + hk * 0.05;
                  banks.push({
                    dims: [w, th, w * (0.6 + hk * 0.5)],
                    pos: [cx + (hk - 0.5) * 1.0, waterY - 0.05 - th / 2 + k * 0.028 + hk * 0.012, cz + (hash01(placed * 7.7 + k) - 0.5) * 1.0],
                    rotY: hk * 2.2,
                    repeat: [2, 2],
                  });
                }
                placed += 1;
              } else if (h3 < 0.86) {
                // ripple ridges ON the bed — `bedTopAt`, not `groundAt`: seated
                // off the host's ground they floated up to 0.29 over the dish
                ripples.push({
                  dims: [0.28 + h1 * 0.5, 0.05, 1.1 + h2 * 0.8],
                  pos: [cx, by - 0.005, cz],
                  rotY: h1 * 3.1,
                  repeat: [1, 2],
                });
              }
            }
          const bankMesh = mergedBoxes(t, banks, SAND_WET, { tex: 'sand', rough: 1, bump: 0.05, flat: true });
          bankMesh.castShadow = false;
          g.add(bankMesh);
          const rip = mergedBoxes(t, ripples, SAND_WET, { tex: 'sand', rough: 1, bump: 0.05, flat: true });
          rip.castShadow = false;
          rip.userData.lodDetail = true;
          g.add(rip);
        }

        // ---- 7. WRECK DEBRIS strewn through the shallows -------------------
        {
          const debris: MergedBoxSpec[] = [];
          const spars: THREE.Vector3[][] = [];
          for (let k = 0; k < 22; k += 1) {
            const h1 = hash01(k * 4.3 + 51);
            const h2 = hash01(k * 9.1 + 67);
            const h3 = hash01(k * 2.7 + 83);
            const ang = h1 * Math.PI * 2;
            const rr = 0.45 + 0.5 * h2;
            const cx = LX + Math.cos(ang) * LA * rr;
            const cz = LZ + Math.sin(ang) * LB * rr;
            if (inSpit(cx, cz) || distToTrack(cx, cz) < 1.2) continue;
            // ON THE BED (§2a). Debris seated on the host's ground floated up to
            // 0.29 over the dished floor and sat proud of a 0.095 waterline; on
            // the bed it is what the section title says — strewn through the
            // SHALLOWS, under 0.09–0.29 of water.
            const gy = bedTopAt(cx, cz);
            if (h3 < 0.42) {
              // broken planking, half-buried
              const n = 2 + Math.floor(h1 * 3);
              for (let j = 0; j < n; j += 1) {
                const hj = hash01(k * 3.3 + j * 6.1);
                debris.push({
                  dims: [0.2 + hj * 0.14, 0.07, 1.0 + hj * 1.1],
                  pos: [cx + (hj - 0.5) * 0.7, gy + 0.02 + j * 0.05, cz + (hash01(k + j * 2.2) - 0.5) * 0.7],
                  rotY: hj * 3.0,
                  rotZ: (hj - 0.5) * 0.14,
                  repeat: [1, 3],
                });
              }
            } else if (h3 < 0.62) {
              // a barrel, staved
              const cask = cyl(t, 0.19, 0.16, 0.42, TIMBER_D, [cx, gy + 0.12, cz], { tex: 'wood', repeat: [5, 1], rough: 0.95, seg: 9 });
              cask.rotation.set(1.45, h1 * 3, (h2 - 0.5) * 0.4);
              g.add(cask);
            } else if (h3 < 0.8) {
              // a fallen spar with a scrap of rigging
              const a = new t.Vector3(cx - Math.cos(ang) * 1.1, gy + 0.1, cz - Math.sin(ang) * 1.1);
              const b = new t.Vector3(cx + Math.cos(ang) * 1.2, gy + 0.16 + h2 * 0.2, cz + Math.sin(ang) * 1.2);
              spars.push([a, b]);
            } else {
              // a rusted anchor, one fluke in the air
              const grp2 = new t.Group();
              grp2.position.set(cx, gy + 0.06, cz);
              grp2.rotation.set(1.25, h1 * 3.1, 0.3);
              grp2.add(mergedBoxes(t, [
                { dims: [0.09, 1.25, 0.09], pos: [0, 0, 0], repeat: [1, 3] },
                { dims: [1.0, 0.12, 0.1], pos: [0, -0.5, 0], rotZ: 0.34 },
                { dims: [0.24, 0.16, 0.14], pos: [-0.45, -0.66, 0], rotZ: 0.6 },
                { dims: [0.24, 0.16, 0.14], pos: [0.45, -0.34, 0], rotZ: 0.6 },
                { dims: [0.5, 0.1, 0.1], pos: [0, 0.55, 0] },
              ], RUST, { tex: 'metal', metal: 0.28, rough: 0.96 }));
              g.add(grp2);
            }
          }
          g.add(mergedBoxes(t, debris, TIMBER_D, { tex: 'wood', rough: 0.96, bump: 0.05 }));
          spars.forEach(([a, b], i) => g.add(spar(t, a, b, 0.075 + hash01(i * 5.5) * 0.03, 0.05, TIMBER)));
        }

        // ---- 7b. THE BERM: living palms, bleached driftwood and salt-dead
        // palms, so the dry shoreline has something standing on it ----------
        {
          // a handful of LIVING palms — a cove ringed by nothing but bare sand
          // read as a quarry, and Tidewater Hollow's planting is palms
          for (let k = 0; k < 8; k += 1) {
            const h1 = hash01(k * 4.9 + 131);
            const h2 = hash01(k * 7.3 + 149);
            const ang = (k / 8) * Math.PI * 2 + h1 * 0.7;
            const rr = 1.1 + 0.16 * h2;
            const cx = LX + Math.cos(ang) * LA * rr;
            const cz = LZ + Math.sin(ang) * LB * rr;
            if (inSpit(cx, cz) || distToTrack(cx, cz) < 3.2) continue;
            const gy = groundAt(cx, cz) + 0.14;
            const lean = 0.14 + h1 * 0.22;
            const H = 3.0 + h2 * 1.5;
            const lx = Math.sin(ang * 2.3);
            const lz = Math.cos(ang * 2.3);
            const top = new t.Vector3(cx + lx * H * lean, gy + H, cz + lz * H * lean);
            g.add(spar(t, new t.Vector3(cx, gy - 0.12, cz), top, 0.2, 0.11, 0x7e6f52));
            const fronds: MergedBoxSpec[] = [];
            for (let j = 0; j < 7; j += 1) {
              const a2 = (j / 7) * Math.PI * 2 + h2 * 3;
              const L = 1.0 + hash01(k * 3.9 + j) * 0.5;
              const droop = -0.34 - hash01(j * 2.7 + k) * 0.42;
              const mid = top.clone().add(new t.Vector3(Math.cos(a2) * L * 0.5, 0.14, Math.sin(a2) * L * 0.5));
              // FLAT blades: square-section fronds read as green joists
              fronds.push(bladeSpec(t, top.clone(), mid, 0.16, 0.035));
              fronds.push(bladeSpec(t, mid, mid.clone().add(new t.Vector3(Math.cos(a2) * L * 0.62, droop, Math.sin(a2) * L * 0.62)), 0.34, 0.03));
            }
            g.add(mergedBoxes(t, fronds, 0x516b3e, { tex: 'fabric', rough: 0.92, bump: 0.03 }));
          }
          for (let k = 0; k < 9; k += 1) {
            const h1 = hash01(k * 6.1 + 91);
            const h2 = hash01(k * 2.9 + 103);
            const h3 = hash01(k * 8.7 + 117);
            const ang = h1 * Math.PI * 2;
            const rr = 1.1 + 0.22 * h2;
            const cx = LX + Math.cos(ang) * LA * rr;
            const cz = LZ + Math.sin(ang) * LB * rr;
            if (inSpit(cx, cz) || distToTrack(cx, cz) < 1.6) continue;
            const gy = groundAt(cx, cz) + 0.14;
            if (h3 < 1.0) {
              // a bleached driftwood trunk, half-drifted into the sand
              const a = new t.Vector3(cx - Math.cos(ang + 1.1) * (0.9 + h2), gy + 0.1, cz - Math.sin(ang + 1.1) * (0.9 + h2));
              const b = new t.Vector3(cx + Math.cos(ang + 1.1) * (0.9 + h3), gy + 0.06 + h1 * 0.2, cz + Math.sin(ang + 1.1) * (0.9 + h3));
              g.add(spar(t, a, b, 0.15 + h2 * 0.07, 0.09, 0xa79a80));
              // TWO stubs, both raking UP off the trunk: three long limbs
              // splayed flat on the sand read as a grey starfish
              const limbs: MergedBoxSpec[] = [];
              for (let j = 0; j < 2; j += 1) {
                const hj = hash01(k * 3.3 + j * 7.1);
                const at = a.clone().lerp(b, 0.32 + j * 0.34);
                limbs.push(
                  barSpec(
                    t,
                    at,
                    at.clone().add(new t.Vector3((hj - 0.5) * 0.55, 0.42 + hj * 0.42, (hash01(k + j) - 0.5) * 0.55)),
                    0.08,
                    [1, 2],
                  ),
                );
              }
              g.add(mergedBoxes(t, limbs, 0x9c9078, { tex: 'wood', rough: 0.96, bump: 0.04 }));
            } else {
              // a salt-killed palm, leaning hard: ONE stub crown of dead
              // fronds, all drooping the same way — a radial starburst of
              // fronds read as a dead spider on the beach
              const lean = 0.3 + h2 * 0.24;
              const H = 2.3 + h1 * 1.2;
              const lx = Math.sin(ang);
              const lz = Math.cos(ang);
              const top = new t.Vector3(cx + lx * H * lean, gy + H, cz + lz * H * lean);
              g.add(spar(t, new t.Vector3(cx, gy - 0.1, cz), top, 0.19, 0.11, 0x8a7c60));
              const fronds: MergedBoxSpec[] = [];
              for (let j = 0; j < 4; j += 1) {
                const spread = (j - 1.5) * 0.5;
                const L = 0.95 + hash01(k * 5.7 + j) * 0.5;
                fronds.push(
                  bladeSpec(
                    t,
                    top.clone(),
                    top
                      .clone()
                      .add(new t.Vector3(lx * L * Math.cos(spread) - lz * L * Math.sin(spread), -0.75 - hash01(j + k) * 0.35, lz * L * Math.cos(spread) + lx * L * Math.sin(spread))),
                    0.2,
                    0.03,
                  ),
                );
              }
              g.add(mergedBoxes(t, fronds, 0x7d6f4e, { tex: 'wood', rough: 0.96 }));
            }
          }
        }

        // ---- 8. WATER IN THE CHANNEL: one continuous animated ribbon -------
        // the same treatment as LogFlume/MagmaRun — the profile's flat
        // blue-grey strip (−0.02) stays beneath as the opaque backing body
        // colour, the shader water rides +0.035 above the centreline
        const RIBBON_N = 260;
        const ribbonPts: { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[] = [];
        for (let k = 0; k < RIBBON_N; k += 1) {
          const f = ride.frameAt(k / RIBBON_N);
          ribbonPts.push({ p: f.p.clone().addScaledVector(f.up, 0.035), side: f.side.clone(), up: f.up.clone() });
        }
        ribbonPts.push({ ...ribbonPts[0] }); // close the loop watertight
        const flumeWater = buildWaterRibbon(t, ribbonPts, 0.72, { amp: 0.16, waviness: 0.6 });
        g.add(flumeWater.mesh);

        // ---- 9. THE CHAIN LIFT: cleated belt + anti-rollbacks up the climb --
        {
          const cleats: MergedBoxSpec[] = [];
          const dogs: MergedBoxSpec[] = [];
          const CN = 260;
          for (let i = 0; i < CN; i += 1) {
            const f = ride.frameAt(i / CN);
            if (f.fwd.y <= 0.13) continue;
            const basis = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
            for (const s of [-1, 1] as const) {
              const m = basis.clone();
              m.setPosition(f.p.clone().addScaledVector(f.side, s * 0.3).addScaledVector(f.up, -0.02));
              cleats.push({ dims: [0.1, 0.05, 0.075], matrix: m });
            }
            // anti-rollback dogs on the outboard rim rail, every 9th sample
            if (i % 9 === 0) {
              const m = basis.clone();
              m.setPosition(f.p.clone().addScaledVector(f.side, 0.47).addScaledVector(f.up, 0.24));
              dogs.push({ dims: [0.05, 0.09, 0.16], matrix: m });
            }
          }
          if (cleats.length) g.add(mergedBoxes(t, cleats, 0x1d1b1a, { tex: 'plastic', rough: 0.8 }));
          if (dogs.length) g.add(mergedBoxes(t, dogs, RUST, { tex: 'metal', metal: 0.35, rough: 0.9 }));
        }

        // ---- 10. THE SUMMIT: a reef CHANNEL MARKER beside the crest --------
        // (a real navigation beacon: the ride's fourth and last PointLight)
        const markerLight = new t.PointLight(LAMP_GLOW, 0, 5.0, 2);
        {
          // the crest = the highest frame; stand the marker outboard of it
          let uTop = 0;
          let top = -Infinity;
          for (let i = 0; i < 240; i += 1) {
            const f = ride.frameAt(i / 240);
            if (f.p.y > top) {
              top = f.p.y;
              uTop = i / 240;
            }
          }
          const f = ride.frameAt(uTop);
          const side = sideH(f, new t.Vector3());
          const s = outSign(uTop);
          const mx = f.p.x + side.x * s * 2.5;
          const mz = f.p.z + side.z * s * 2.5;
          // its three lashed poles stand IN the lagoon, so they are footed on the
          // bed — on the host's ground they would have ended 0.29 short of it
          const gy = bedTopAt(mx, mz);
          const post = new t.Group();
          post.position.set(mx, gy, mz);
          post.rotation.set(0.05, hash01(3.3) * 3, -0.06);
          g.add(post);
          // three lashed poles standing in the shallows, a cage top and a bell
          const poles: MergedBoxSpec[] = [];
          for (let k = 0; k < 3; k += 1) {
            const a = (k / 3) * Math.PI * 2;
            poles.push(
              barSpec(t, new t.Vector3(Math.cos(a) * 0.42, -0.2, Math.sin(a) * 0.42), new t.Vector3(0, 2.5, 0), 0.1, [1, 5]),
            );
          }
          poles.push({ dims: [0.62, 0.09, 0.62], pos: [0, 1.3, 0], repeat: [2, 1] });
          poles.push({ dims: [0.5, 0.09, 0.5], pos: [0, 2.5, 0], repeat: [2, 1] });
          post.add(mergedBoxes(t, poles, TIMBER, { tex: 'wood', rough: 0.94, bump: 0.04 }));
          const cage: MergedBoxSpec[] = [];
          for (let k = 0; k < 4; k += 1) {
            const a = (k / 4) * Math.PI * 2 + 0.5;
            cage.push({ dims: [0.03, 0.5, 0.03], pos: [Math.cos(a) * 0.17, 2.78, Math.sin(a) * 0.17] });
          }
          cage.push({ dims: [0.44, 0.06, 0.44], pos: [0, 3.05, 0] });
          post.add(mergedBoxes(t, cage, IRON, { tex: 'metal', metal: 0.55, rough: 0.55 }));
          const beacon = ball(t, 0.15, LAMP_GLASS, [0, 2.78, 0], { emissive: LAMP_GLOW, rough: 0.3 });
          (beacon.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.1;
          lampMats.push(beacon.material as THREE.MeshStandardMaterial);
          post.add(beacon);
          markerLight.position.set(0, 2.6, 0);
          post.add(markerLight);
          // a weed-fouled bell hanging under the platform
          post.add(cyl(t, 0.09, 0.15, 0.2, BRASS, [0.22, 1.14, 0], { tex: 'metal', metal: 0.6, rough: 0.55, seg: 10 }));
        }

        // ---- 10b. THE NEAR MISSES ------------------------------------------
        // Danger on a water coaster is not speed — the drift pace tops out
        // around 7 u/s and the guarded G limits are nowhere near — it is what
        // the boats pass THROUGH and how close. Everything here is built in
        // RIDE-LOCAL space off the frames, exactly like the bowsprit, so the
        // clearance is exact by construction rather than eyeballed, and every
        // number below was then re-measured against the boat's real swept
        // envelope (probe: /tmp/mp3d-render/rr2-clear.tsx).
        //
        // The boat's envelope, measured, NOT assumed: half-beam 0.280 and a
        // highest point of 0.474 above its own origin — the STERN LANTERN on
        // its jackstaff, not the carved prow (0.42). At `wheelOffset 0.25`
        // that is 0.724 above the rail, and every overhead crossing here is
        // placed against 0.724.
        const sharkParts: { grp: THREE.Group; cx: number; cz: number; r: number; y: number; w: number; ph: number }[] = [];
        {
          /** the LIP of the plunge: the last still-level frame before the
           *  track tips over, found by walking back from the steepest sample */
          let uLip = uSteep;
          for (let i = Math.floor(uSteep * 480); i >= 0; i -= 1) {
            if (ride.frameAt(i / 480).fwd.y > -0.05) { uLip = i / 480; break; }
          }
          // ---- the LEANING MAST over the summit crest ---------------------
          // A second, older wreck the reef swallowed whole: nothing left but
          // her mainmast, still standing out of the lagoon and leaning over
          // the summit run — and her YARD, hanging by one lift, slung right
          // across the channel 0.6 u before the boats tip into the plunge.
          //
          // The yard is HORIZONTAL on purpose. A raked mast crossing overhead
          // gives a perpendicular clearance of only `vertical · cos(rake)` —
          // at the 64° a mast standing this far out has to take, a 0.48
          // vertical gap measures 0.11 to the spar's surface, which is a hit,
          // not a miss. A level yard's perpendicular distance IS its vertical
          // distance, so the gap you place is the gap you get.
          const uYard = Math.max(0, uLip - 0.6 / total);
          const yF = ride.frameAt(uYard);
          const ySide = sideH(yF, new t.Vector3());
          const sOut = outSign(uYard);
          const YARD_Y = 1.1; // yard AXIS above the rail; radius 0.075 → 0.30 of daylight over the boat
          const cross = yF.p.clone().addScaledVector(new t.Vector3(0, 1, 0), YARD_Y);
          const footX = yF.p.x + ySide.x * sOut * 2.9;
          const footZ = yF.p.z + ySide.z * sOut * 2.9;
          const footY = bedTopAt(footX, footZ) - 0.25; // her stump is IN the lagoon
          const mastTop = new t.Vector3(
            yF.p.x + ySide.x * sOut * 2.35,
            yF.p.y + 2.95,
            yF.p.z + ySide.z * sOut * 2.35,
          );
          const foot = new t.Vector3(footX, footY, footZ);
          g.add(spar(t, foot, mastTop, 0.22, 0.085, TIMBER_D));
          // the splintered crown
          {
            const splinters: MergedBoxSpec[] = [];
            const up = mastTop.clone().sub(foot).normalize();
            for (let k = 0; k < 5; k += 1) {
              const h1 = hash01(k * 3.1 + 211);
              splinters.push(
                barSpec(
                  t,
                  mastTop.clone().addScaledVector(up, -0.12),
                  mastTop.clone().addScaledVector(up, 0.26 + h1 * 0.5).add(new t.Vector3((h1 - 0.5) * 0.24, 0, (hash01(k + 5) - 0.5) * 0.24)),
                  0.05,
                  [1, 2],
                ),
              );
            }
            g.add(mergedBoxes(t, splinters, TIMBER_D, { tex: 'wood', rough: 0.96, bump: 0.05 }));
          }
          // THE YARD, level, crossing the channel — inboard end 1.7 past the
          // centreline, outboard end lashed to the mast
          const yardIn = cross.clone().addScaledVector(ySide, -sOut * 1.7);
          const yardOut = cross.clone().addScaledVector(ySide, sOut * 2.5);
          const yardSpar = spar(t, yardIn, yardOut, 0.06, 0.075, TIMBER);
          yardSpar.userData.nearMiss = 'yard'; // tagged so probes can measure it
          g.add(yardSpar);
          const rustMat = mat(t, RUST, { tex: 'metal', metal: 0.35, rough: 0.9 });
          // the ONE lift still holding it, and the parted one hanging slack
          g.add(line(t, yardOut.clone(), mastTop.clone().addScaledVector(new t.Vector3(0, -1, 0), 0.5), 0.06, 0.018, rustMat));
          g.add(line(t, yardIn.clone().addScaledVector(ySide, sOut * 0.5), yardIn.clone().addScaledVector(new t.Vector3(0, -1, 0), 1.9), 0.5, 0.015, mat(t, ROPE, { tex: 'fabric', rough: 0.97 })));
          // the torn topsail, hung OUTBOARD of the channel corridor: a curtain
          // of canvas beside the crest, never over the boats
          {
            const canvas = mat(t, CANVAS, { tex: 'fabric', repeat: [3, 3], rough: 0.95 });
            canvas.side = t.DoubleSide;
            for (const [off, w, h] of [[1.15, 1.5, 1.9], [2.05, 1.0, 1.25]] as const) {
              const rag = raggedSail(t, w, h, 77 + off * 13, canvas);
              rag.position.copy(cross).addScaledVector(ySide, sOut * off).add(new t.Vector3(0, -h * 0.5 - 0.1, 0));
              rag.rotation.y = Math.atan2(ySide.x, ySide.z) + Math.PI / 2;
              g.add(rag);
            }
          }
          // shrouds from the masthead down to deadeyes on the reef
          {
            const ropeMat = mat(t, ROPE, { tex: 'fabric', rough: 0.97 });
            for (let k = 0; k < 4; k += 1) {
              const a = 0.5 + k * 0.42;
              const bx = footX + Math.cos(a) * (1.1 + k * 0.3);
              const bz = footZ + Math.sin(a) * (1.1 + k * 0.3);
              if (distToTrack(bx, bz) < 1.3) continue;
              g.add(line(t, mastTop.clone().addScaledVector(new t.Vector3(0, -1, 0), 0.8), new t.Vector3(bx, bedTopAt(bx, bz) + 0.05, bz), 0.12, 0.012, ropeMat));
            }
          }
          // THE WARNING, lashed to the mast at eye level from the summit and
          // squared to the boats coming along the crest
          {
            const bd = hazardBoard(t, 1.25);
            bd.position.copy(mastTop).lerp(foot, 0.42).addScaledVector(ySide, -sOut * 0.26);
            bd.rotation.y = yawOf(yF) + Math.PI;
            g.add(bd);
          }

          // ---- the REEF FANGS flanking the splashdown run-out --------------
          // Two coral spikes standing out of the water either side of the
          // channel at the foot of the plunge, leaning IN. The boat is at its
          // fastest here (~7 u/s), which is the whole point: the tips are the
          // closest solid thing to the hull anywhere on the circuit.
          for (const [du, s, sc] of [[0.5, 1, 1.0], [1.7, -1, 0.86], [3.0, 1, 0.72]] as const) {
            const uf = Math.min(0.999, uRun + du / total);
            const f = ride.frameAt(uf);
            const side = sideH(f, new t.Vector3());
            const baseOff = 1.12 * s;
            const tipOff = 0.75 * s; // the fang's TIP, 0.75 off the centreline
            const bx = f.p.x + side.x * baseOff;
            const bz = f.p.z + side.z * baseOff;
            // rooted in the BED. The fang rises 1.42·sc from here, so a deeper
            // basin shows LESS of it above the water and never less clearance to
            // the hull (the near miss is horizontal — `tipOff` 0.75 off the
            // centreline — and lowering the tip can only ever increase the gap).
            const gy = bedTopAt(bx, bz);
            const fang: MergedBoxSpec[] = [];
            const N = 9;
            for (let k = 0; k < N; k += 1) {
              const q = k / (N - 1);
              const h1 = hash01(k * 4.7 + 300 + du * 17);
              const off = baseOff + (tipOff - baseOff) * q * q;
              const wdt = (0.46 - 0.4 * q) * sc * (0.8 + h1 * 0.45);
              fang.push({
                dims: [wdt, 0.22 * sc, wdt * (0.75 + h1 * 0.5)],
                pos: [
                  f.p.x + side.x * off + (h1 - 0.5) * 0.05,
                  gy - 0.18 + q * (1.42 * sc) + h1 * 0.02,
                  f.p.z + side.z * off + (hash01(k + 9) - 0.5) * 0.05,
                ],
                rotY: h1 * 2.6,
                rotZ: (h1 - 0.5) * 0.22,
                repeat: [1, 1],
              });
            }
            const fangMesh = mergedBoxes(t, fang, s > 0 ? REEF : REEF_D, { tex: 'concrete', rough: 0.97, bump: 0.09, flat: true });
            fangMesh.userData.nearMiss = 'fang';
            g.add(fangMesh);
            // a crust of coral round its foot, so it reads as reef and not as
            // a rock somebody stood beside the track
            const crust = buildCoralHead(t, 400 + Math.round(du * 31), 0.3 + 0.2 * sc);
            crust.position.set(bx + side.x * 0.35 * s, gy - 0.1, bz + side.z * 0.35 * s);
            g.add(crust);
          }

          // ---- the SHARK, working the splashdown pool ----------------------
          // Circles just outside the channel on the SEA clock (the lagoon is
          // not motion-gated), so a parked ride still has something in the
          // water with it.
          {
            const f = ride.frameAt(Math.min(0.999, uRun + 2.2 / total));
            const side = sideH(f, new t.Vector3());
            const s = -outSign(uRun); // inboard, into the open lagoon
            const cx = f.p.x + side.x * s * 4.15;
            const cz = f.p.z + side.z * s * 4.15;
            // THE RADIUS IS SOLVED, NOT CHOSEN. A hand-picked 2.9 put the fin
            // 0.054 u from the hull on the home stretch — a hit, not a miss, and
            // the sort of thing a "looks about right" placement gets wrong on
            // the leg you were not looking at. Shrink the circle until EVERY
            // point on it is ≥ 1.25 from the channel centreline, so the pass is
            // measured on every leg the circle crosses.
            // …and the test is against the SHARK'S WHOLE BODY, not against the
            // circle: she is 2.2 long and swims along the tangent, so the first
            // cut of this solve (circle points only) still measured 0.054 to
            // the hull — the nose and the tail tip reach a long way off the
            // path they follow.
            let R = 3.1;
            let sharkGap = 0;
            for (let it = 0; it < 32 && R > 0.8; it += 1) {
              let worst = Infinity;
              for (let a = 0; a < 96; a += 1) {
                const th = (a / 96) * Math.PI * 2;
                const px = cx + Math.cos(th) * R;
                const pz = cz + Math.sin(th) * R;
                const tx = -Math.sin(th);
                const tz = Math.cos(th);
                for (let b = -3; b <= 3; b += 1)
                  worst = Math.min(worst, distToTrack(px + tx * b * 0.4, pz + tz * b * 0.4));
              }
              sharkGap = worst;
              if (worst >= 1.25) break;
              R -= 0.1;
            }
            // the GUARANTEE, published for probes: no point of her body comes
            // within this of the channel centreline, at ANY phase — which is
            // what makes the pass a measured miss rather than a lucky one
            g.userData.sharkPath = { r: R, minDistToTrack: sharkGap };
            const shark = buildSharkFin(t);
            shark.userData.nearMiss = 'shark';
            g.add(shark);
            sharkParts.push({ grp: shark, cx, cz, r: R, y: waterY, w: 0.30, ph: 0 });
          }

          // ---- a SHALLOW-REEF warning stake standing in the lagoon ---------
          {
            const f = ride.frameAt(Math.min(0.999, uRun + 5.4 / total));
            const side = sideH(f, new t.Vector3());
            const s = -outSign(uRun);
            const sx = f.p.x + side.x * s * 2.4;
            const sz = f.p.z + side.z * s * 2.4;
            const gy = bedTopAt(sx, sz); // driven into the lagoon bed
            const stake = new t.Group();
            stake.position.set(sx, gy, sz);
            stake.rotation.set(0.09, yawOf(f) + 0.5, -0.11);
            g.add(stake);
            stake.add(mergedBoxes(t, [{ dims: [0.11, 1.7, 0.11], pos: [0, 0.7, 0], repeat: [1, 4] }], TIMBER_D, { tex: 'wood', rough: 0.95, bump: 0.04 }));
            const bd = hazardBoard(t, 0.9);
            bd.position.set(0, 1.42, 0);
            stake.add(bd);
          }
        }

        // ---- 11. THE SPLASHDOWN: flared boards, foam and spray ------------
        {
          const fUp = new t.Vector3();
          const fSide = new t.Vector3();
          const fDir = new t.Vector3();
          for (let i = 0; i < 6; i += 1) {
            const f0 = ride.frameAt(uRun - 0.004 + i * 0.011);
            const f1 = ride.frameAt(uRun - 0.004 + (i + 1) * 0.011);
            for (const s of [-1, 1] as const) {
              const a = f0.p.clone().addScaledVector(f0.side, s * 0.5).addScaledVector(f0.up, 0.17);
              const b = f1.p.clone().addScaledVector(f1.side, s * 0.5).addScaledVector(f1.up, 0.17);
              fDir.subVectors(b, a);
              const len = fDir.length();
              fDir.normalize();
              fUp.addVectors(f0.up, f1.up).normalize().multiplyScalar(Math.cos(0.6)).addScaledVector(f0.side, s * Math.sin(0.6)).normalize();
              fUp.addScaledVector(fDir, -fUp.dot(fDir)).normalize();
              fSide.crossVectors(fUp, fDir).normalize();
              const board = box(t, [0.024, 0.17, len * 1.12], TIMBER_D, [0, 0, 0], { tex: 'wood', repeat: [1, 2], rough: 0.92 });
              board.position.addVectors(a, b).multiplyScalar(0.5).addScaledVector(fUp, 0.065);
              board.setRotationFromMatrix(new t.Matrix4().makeBasis(fSide, fUp, fDir));
              g.add(board);
            }
          }
          for (let i = 0; i < 5; i += 1) {
            const f = ride.frameAt(uRun + i * 0.013);
            const patch = box(t, [0.6 + 0.14 * ((i * 3) % 2), 0.014, 0.42], 0xe4f4f9, [0, 0, 0], { rough: 0.4, opacity: 0.55 });
            patch.castShadow = false;
            patch.position.copy(f.p).addScaledVector(f.up, 0.04).addScaledVector(f.side, Math.sin(i * 5.1) * 0.06);
            patch.setRotationFromMatrix(new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up)));
            patch.rotateY(Math.sin(i * 9.2) * 0.2);
            g.add(patch);
          }
        }
        const spray = new t.Group();
        spray.position.set(SPLASH_AT.x, splashY + 0.05, SPLASH_AT.z);
        spray.rotation.y = yawOf(runF);
        const foam: THREE.Mesh[] = [];
        for (let i = 0; i < 7; i += 1) {
          const a = i * 2.39;
          const rr = 0.16 + 0.5 * Math.abs(Math.sin(i * 12.9898));
          const fb = ball(t, 0.15 + 0.045 * ((i * 7) % 3), 0xeaf6fb, [Math.cos(a) * rr * 0.4, 0.08 + 0.09 * Math.abs(Math.sin(i * 4.7)), Math.sin(a) * rr * 1.1 + 0.06 * i], { rough: 0.4, opacity: 0.85 });
          fb.scale.y = 0.7;
          spray.add(fb);
          foam.push(fb);
        }
        g.add(spray);

        // ---- 12. EFFECTS: 150 particles over 2 emitters --------------------
        const splashFx = buildEmitter(t, {
          max: 90,
          rate: 0,
          life: 0.7,
          lifeVar: 0.25,
          velocity: [0, 1.85, 0],
          spread: 1.2,
          gravity: 5.5,
          size: 0.075,
          sizeEnd: 0.15,
          color: 0xeaf6fb,
          colorEnd: 0xbfe0ee,
          opacity: 0.85,
        });
        splashFx.setOrigin(SPLASH_AT.x, splashY + 0.1, SPLASH_AT.z);
        g.add(splashFx.points);
        // a fine, slow mist drifting off the plunge's foot
        const mistFx = buildEmitter(t, {
          max: 60,
          rate: 9,
          life: 2.8,
          lifeVar: 0.8,
          velocity: [0.1, 0.5, 0.04],
          spread: 0.5,
          gravity: -0.03,
          size: 0.22,
          sizeEnd: 0.95,
          color: 0xd6e2e6,
          colorEnd: 0xeef4f6,
          opacity: 0.16,
        });
        mistFx.setOrigin(SPLASH_AT.x, splashY + 0.2, SPLASH_AT.z);
        g.add(mistFx.points);

        // ---- 13. STATION: a plank JETTY on piles under a sailcloth awning --
        const stLight = new t.PointLight(LAMP_GLOW, 0, 5.6, 2);
        {
          const st = ride.frameAt(0);
          const yard = new t.Group();
          yard.position.set(st.p.x, groundAt(st.p.x, st.p.z), st.p.z);
          yard.rotation.y = yawOf(st);
          g.add(yard);
          // local frame: +z along the station straight (the ride's local −x),
          // +x the BOARDING side (the free face the queue arrives on)
          const deckTop = st.p.y + 0.03;
          const DX = 1.02; // deck centre: inner edge 0.52 clears the 0.505 rim
          const DZ = 1.15;
          yard.add(box(t, [1.0, 0.09, 2.1], TIMBER, [DX, deckTop - 0.045, DZ], { tex: 'wood', repeat: [3, 6], rough: 0.92, bump: 0.03 }));
          const deck: MergedBoxSpec[] = [];
          [0.62, 1.42].forEach((x) => deck.push({ dims: [0.12, 0.12, 2.1], pos: [x, deckTop - 0.15, DZ], repeat: [1, 5] }));
          [0.25, 1.15, 2.05].forEach((z) =>
            [0.62, 1.42].forEach((x) => {
              deck.push({ dims: [0.15, Math.max(0.1, deckTop - 0.18), 0.15], pos: [x, Math.max(0.05, deckTop - 0.18) / 2, z], repeat: [1, 3] });
            }),
          );
          [0.34, 0.7].forEach((y) => deck.push({ dims: [0.07, 0.06, 2.1], pos: [1.54, deckTop + y, DZ], repeat: [1, 5] })); // rope rails
          [0.25, 1.15, 2.05].forEach((z) => deck.push({ dims: [0.09, 0.76, 0.09], pos: [1.54, deckTop + 0.38, z], repeat: [1, 2] }));
          // steps: the bottom riser sits ON the spit's sand (§2a), so raising the
          // waterline can never leave the ladder floating over it or buried in it
          {
            const s0 = spitTopY - groundAt(st.p.x, st.p.z); // spit top in yard-local y
            const rise = (deckTop - s0) / 4;
            [0, 1, 2].forEach((k) =>
              deck.push({ dims: [0.72, 0.06, 0.26], pos: [1.12, s0 + rise * (k + 1), 2.42 + k * 0.13], repeat: [2, 1] }),
            );
          }
          yard.add(mergedBoxes(t, deck, TIMBER, { tex: 'wood', rough: 0.92, bump: 0.03 }));
          // four spars carrying a sailcloth awning over the deck
          const posts: MergedBoxSpec[] = [];
          [0.64, 1.4].forEach((x) => [0.3, 2.0].forEach((z) => posts.push({ dims: [0.11, 1.2, 0.11], pos: [x, deckTop + 0.6, z], repeat: [1, 3] })));
          [0.3, 2.0].forEach((z) => posts.push({ dims: [1.0, 0.09, 0.11], pos: [DX, deckTop + 1.18, z], repeat: [3, 1] }));
          posts.push({ dims: [0.09, 0.09, 2.2], pos: [DX, deckTop + 1.3, DZ], repeat: [1, 6] }); // ridge spar
          yard.add(mergedBoxes(t, posts, TIMBER, { tex: 'wood', rough: 0.92, bump: 0.03 }));
          const awnMat = mat(t, CANVAS, { tex: 'fabric', repeat: [3, 6], rough: 0.94 });
          awnMat.side = t.DoubleSide;
          [-1, 1].forEach((s) => {
            const panel = new t.Mesh(new t.PlaneGeometry(0.78, 2.36, 3, 5), awnMat);
            panel.position.set(DX + s * 0.31, deckTop + 1.22, DZ);
            panel.rotation.set(Math.PI / 2, 0, 0);
            panel.rotateX(s * 0.42);
            panel.castShadow = true;
            yard.add(panel);
          });
          // a scalloped canvas valance along the seaward edge
          const val: MergedBoxSpec[] = [];
          for (let k = 0; k < 8; k += 1)
            val.push({ dims: [0.04, 0.16, 0.24], pos: [1.5, deckTop + 1.0 - 0.02 * (k % 2), 0.2 + k * 0.28], repeat: [1, 1] });
          yard.add(mergedBoxes(t, val, 0x1f6b6a, { tex: 'fabric', rough: 0.94 }));
          // a driftwood signboard on two posts beside the steps
          const sign = new t.Group();
          sign.position.set(2.15, 0, 2.55);
          sign.rotation.y = -0.3;
          yard.add(sign);
          sign.add(mergedBoxes(t, [
            { dims: [0.1, 1.1, 0.1], pos: [-0.42, 0.55, 0], repeat: [1, 3] },
            { dims: [0.1, 1.1, 0.1], pos: [0.42, 0.55, 0], repeat: [1, 3] },
            { dims: [1.1, 0.34, 0.07], pos: [0, 0.95, 0], repeat: [4, 1] },
            { dims: [0.24, 0.06, 0.09], pos: [-0.3, 0.95, -0.05], repeat: [1, 1] },
            { dims: [0.36, 0.06, 0.09], pos: [0.1, 0.95, -0.05], repeat: [1, 1] },
          ], TIMBER, { tex: 'wood', rough: 0.94, bump: 0.04 }));
          // cargo left on the sand: crates, a barrel, a net over a spar
          const cargo: MergedBoxSpec[] = [];
          for (let k = 0; k < 5; k += 1) {
            const h1 = hash01(k * 6.7 + 5);
            cargo.push({
              dims: [0.42 + h1 * 0.12, 0.34, 0.42 + h1 * 0.1],
              pos: [2.2 + (h1 - 0.5) * 0.5, 0.17 + Math.floor(k / 3) * 0.34, 0.5 + (k % 3) * 0.52],
              rotY: (h1 - 0.5) * 0.5,
              repeat: [2, 1],
            });
          }
          yard.add(mergedBoxes(t, cargo, TIMBER_D, { tex: 'wood', rough: 0.94, bump: 0.04 }));
          yard.add(cyl(t, 0.2, 0.22, 0.44, TIMBER, [1.95, 0.22, -0.35], { tex: 'wood', repeat: [5, 1], rough: 0.93, seg: 10 }));
          const netMat = mat(t, ROPE, { tex: 'fabric', repeat: [4, 4], rough: 0.96 });
          netMat.side = t.DoubleSide;
          netMat.transparent = true;
          netMat.opacity = 0.85;
          const net = new t.Mesh(new t.PlaneGeometry(1.1, 0.9, 3, 3), netMat);
          net.position.set(2.5, 0.5, -0.9);
          net.rotation.set(0.5, 0.4, 0.2);
          yard.add(net);
          // two lanterns on the ridge spar + the station's real light
          const lampY = deckTop + 1.06;
          [0.55, 1.75].forEach((z) => {
            const lamp = shipLantern(t, 0.9);
            lamp.group.position.set(DX, lampY, z);
            yard.add(lamp.group);
            lampMats.push(lamp.glass);
          });
          stLight.position.set(DX, lampY - 0.3, DZ);
          yard.add(stLight);
        }

        // ---- 14. THE BOAT --------------------------------------------------
        const boat = buildReefBoat(t, BOAT_LIVERY, { riders: opts.riders ?? true, seats: seatAnchors });
        extras.vehicle = boat; // RideViewer onboard/follow cam
        seatWorld = makeSeatWorld(t, seatAnchors);
        const boatLamps = (boat.userData.lamps ?? []) as THREE.MeshStandardMaterial[];
        // wheelOffset 0.25: keel 0.05 above the channel floor amidships, and
        // the 0.135 rocker keeps the ends clear through the plunge's pull-out.
        const run = ride.run([boat], { wheelOffset: 0.25, speedScale: LAP_SCALE });

        // =====================================================================
        // 15. THE STATION LOCK — ⚠️ `rideDuration` IS NOT THE LAP, AND A
        //     `speedScale` TUNED AT ONE FRAME TIME IS NOT A FIX
        // =====================================================================
        // This shipped as `createMotionGate((clock) => run(clock))` plus a
        // `speedScale` derived from a measured lap. That is the right INSTINCT
        // and it still creeps, for two reasons — both re-measured this pass
        // against the real FSM sequence (`rideFsm.ts:124-195`) with the real
        // `configurableRide.tsx:1141` defaults:
        //
        // 1. THE GATE SURPLUS WAS MEASURED AGAINST THE WRONG `loadTime`. The
        //    gate keeps integrating through `departing` (whose length IS
        //    `loadTime`, which defaults to **1.6**, not the FSM's bare 1.0) and
        //    through the eased brakes of `arriving` and `movingToEndOfStation`.
        //    Measured advance per dispatch at `rideDuration` 22:
        //    **23.891 (dt 1/60) / 23.894 (1/30) / 23.897 (1/20) / 23.906
        //    (1/10)** — i.e. rideDuration + 1.89, not the + 1.291 the old
        //    constant assumed. Against the 23.23 s lap that scale produced,
        //    every dispatch overshot 0.66 s ≈ 1.3 u, and the boat's distance
        //    from `board` over nine cycles at dt 1/60 walked
        //      0.44 · 1.74 · 3.09 · 4.33 · 5.62 · 6.94 · 8.28 · 9.62 · 11.01 u.
        //
        // 2. THE ERROR IS FRAME-RATE DEPENDENT. `makeGuardedRun` clamps its OWN
        //    dt to 0.06, so a single 0.1-s frame advances the boat 0.06 — under
        //    swiftshader (where the manager clamps dt to 0.1) the boat covers
        //    ~60 % of the clock it is handed. The same nine cycles at dt 1/10
        //    came back as
        //      0.25 · 13.02 · 13.98 · 5.80 · 18.46 · 6.98 · 11.39 · 16.64 · 0.29 u
        //    — a different sequence entirely, with cycle 5 boarding four guests
        //    18 u away and cycle 2 at y 5.25, the TOP OF THE CHAIN LIFT.
        //
        // THE FIX is the fleet's (Bassline §8b, WyrmsHollow §8b), three parts:
        //   * SUBSTEP THE RUNNER — rail time reaches `run()` in ≤ 50 ms slices,
        //     so the integration is identical at every frame time.
        //   * THE BOAT BRAKES INTO ITS JETTY AND HOLDS — rail time stops
        //     advancing on the frame AFTER the boat passes closest approach to
        //     the parked pose, and resumes only on dispatch. The SEA, the
        //     lamps and the shark keep running on absolute time, so a held boat
        //     reads as a boat that has arrived, not as a dropped frame.
        //   * `LAP_SCALE` targets `rideDuration + GATE_SURPLUS − 0.7`, so the
        //     dispatch lands just PAST the parked pose and the brake has
        //     something to absorb at every dt. Do NOT tune it to land exactly:
        //     an undershoot has nothing to brake into and the boat stops short.
        //
        // `rideDuration` stays 22. The world's acceptance window is
        // `max(60, 2.5·maxDur + 20)` and Deep Drift's 47 s owns it — raising
        // this ride past 47 would silently move the whole showcase park's
        // window, so the lap is brought to the registration, not the reverse.
        const boardLocal = new t.Vector3(...BOARD);
        let sBoardU = 0;
        let sBoardD = Infinity;
        for (let i = 0; i < 720; i += 1) {
          const d = ride.frameAt(i / 720).p.distanceTo(boardLocal);
          if (d < sBoardD) {
            sBoardD = d;
            sBoardU = i / 720;
          }
        }
        // the parked pose is where `place()` actually puts the boat for that u
        // (rail + up·wheelOffset), so it is directly comparable to
        // `boat.position` with no matrixWorld round-trip. One vehicle, so there
        // is no train-mid term; the four thwarts straddle the origin (mean seat
        // z −0.005) and the jetty deck is 2.1 long.
        const stopF = ride.frameAt(sBoardU);
        const stopP = stopF.p.clone().addScaledVector(stopF.up, 0.25);
        g.userData.stationStop = { u: sBoardU, at: [stopP.x, stopP.y, stopP.z] };

        // PRIME THE POSE. `makeGuardedRun` starts the vehicle at the CHAIN-LIFT
        // BASE whenever the lift is long enough (`u0 = liftStart/N`), which on
        // this circuit is 3.1 u past the jetty — unprimed, the FIRST parked
        // pose is a different place from every later one. So walk the same
        // substepped runner forward at build time until the boat passes closest
        // approach to `stopP`: identical arithmetic to the lock below, so cycle
        // 1 and cycle 9 are the same pose.
        let railT = 0; // rail time: the gate clock MINUS every held second
        {
          let prime = 0;
          let dPrev = Infinity;
          let armed = false;
          let left = false;
          for (let i = 0; i < 2400; i += 1) {
            prime += 0.05;
            run(prime);
            const d = boat.position.distanceTo(stopP);
            if (!left && d > 5) left = true;
            if (left) {
              if (armed && d > dPrev) break;
              if (d < 1.5) armed = true;
            }
            dPrev = d;
          }
          railT = prime;
          g.userData.stationPrimedT = prime;
        }
        let fedT = railT;
        let lastClock: number | null = null;
        let gated = false;
        let holding = opts.registered ?? false;
        let armed = false;
        let prevD = Infinity;
        let sinceDispatch = 0;

        // ---- 15b. the updater ----------------------------------------------
        // RCT2 station behaviour: the boat WAITS while guests board and brakes
        // to a stop on arrival. Ungated until the first onStateChange, so
        // previews run identically. THE SEA IS NOT GATED: the lagoon, the night
        // lamps and the shark run off the REAL clock outside the gate, so a
        // parked ride is not a frozen ocean.
        let rock = 0; // the plunge's after-motion, 0 at the jetty
        const rockQ = new t.Quaternion();
        const rockE = new t.Euler();
        const gate = createMotionGate((clock) => {
          const dc = lastClock === null ? 0 : Math.max(0, clock - lastClock);
          lastClock = clock;
          if (!holding) {
            railT += dc;
            sinceDispatch += dc;
          }
          // ⚠️ SUBSTEP. makeGuardedRun integrates with its OWN dt = min(0.06,
          // time − last), so any frame longer than 60 ms silently advances the
          // boat less than the clock it was handed. ≤ 50 ms slices are the same
          // integration at any frame rate. `run()` is still called once per
          // frame while holding, which simply re-writes the parked pose.
          // The brake is tested INSIDE the substep loop, not once a frame: the
          // boat drifts ~2.5 u/s, so a once-a-frame test resolves closest
          // approach only to one frame of travel and the parked pose slides
          // 0.30 → 0.45 u across a 1/10-s run. Tested per 50-ms slice it is
          // 0.12 u at any frame time. `sinceDispatch` keeps the arm from firing
          // on the jetty straight the boat is still leaving, and 1.5 is under
          // half the 2.0-u radius of the nearest turn, so nothing else on this
          // circuit can arm it.
          const target = railT;
          const steps = Math.max(1, Math.ceil((target - fedT) / 0.05));
          for (let i = 1; i <= steps; i += 1) {
            const tt = fedT + ((target - fedT) * i) / steps;
            run(tt);
            if (gated && !holding && sinceDispatch > 6) {
              const d = boat.position.distanceTo(stopP);
              if (armed && d > prevD) holding = true;
              if (d < 1.5) armed = true;
              prevD = d;
            }
            if (holding) {
              railT = tt; // rail time freezes on the slice that parked her
              break;
            }
          }
          fedT = railT;
          g.userData.stationHold = holding;
          g.userData.railT = railT;

          flumeWater.update(clock);
          // THE SPLASHDOWN: foam, droplets and the boat's own after-motion all
          // key off proximity to the landing, so they are exactly zero at the
          // jetty and the parked drift stays 0.0000.
          const d = Math.hypot(boat.position.x - SPLASH_AT.x, boat.position.z - SPLASH_AT.z);
          const k = Math.max(0, 1 - d / 1.5);
          splashFx.setRate(k * 190);
          splashFx.update(clock);
          mistFx.setRate(9 + 34 * k);
          mistFx.update(clock);
          foam.forEach((fb, i) => {
            const ki = Math.max(0, k - 0.12 * ((i * 5) % 4));
            const pulse = 0.75 + 0.25 * Math.sin(clock * 9 + i * 2.1);
            fb.scale.setScalar(Math.max(0.02, ki * pulse * 1.25));
            fb.scale.y = Math.max(0.02, ki * pulse * 0.85);
          });
          // ROCKING. The hull is kicked by the landing and rolls it off over
          // the next couple of seconds. Applied AFTER `run()` has written the
          // frame pose, and driven by `k` + a decay rather than by the clock
          // alone, so a boat sitting on the jetty is dead level (probe: parked
          // drift and parked roll both 0.0000).
          rock = Math.max(k, rock - dc * 0.55);
          if (rock > 0.002) {
            // SHE RIDES HIGHER WHILE SHE WALLOWS, and that is not decoration:
            // the skiff's keel clears the trough floor by only 0.050 sitting
            // level (0.25 wheelOffset − 0.300 of draught + 0.10 of trough), and
            // rolling her 0.14 rad drops the low bilge 0.0365 of that —
            // measured 0.0135 left at full amplitude, over a pull-out that eats
            // more. 0.06·rock of lift along the FRAME's up (applied before the
            // rock, so it is not itself tilted) puts the floor clearance BETTER
            // than level while she is rocking, and a boat sitting up on its own
            // wash is what a splashdown looks like anyway.
            boat.translateY(0.06 * rock);
            const amp = 0.14 * rock;
            rockE.set(amp * 0.55 * Math.sin(clock * 5.3 + 1.1), 0, amp * Math.sin(clock * 7.1), 'YXZ');
            boat.quaternion.multiply(rockQ.setFromEuler(rockE));
          }
        }, { spinDown: 1.6 });
        onStateChange = (state: string) => {
          if (state === 'departing' || state === 'travelling') {
            holding = false;
            armed = false;
            prevD = Infinity;
            sinceDispatch = 0;
          }
          gated = true;
          gate.onStateChange(state);
        };
        // the SHARK works the pool on absolute time — a parked ride still has
        // something in the water with it
        const sharkAt = (time: number) => {
          for (const s of sharkParts) {
            const a = time * s.w + s.ph;
            s.grp.position.set(s.cx + Math.cos(a) * s.r, s.y - 0.06 + 0.035 * Math.sin(time * 1.7 + s.ph), s.cz + Math.sin(a) * s.r);
            s.grp.rotation.y = -a + Math.PI / 2 + 0.12 * Math.sin(time * 0.9 + s.ph);
            s.grp.rotation.z = 0.09 * Math.sin(time * 1.3 + s.ph);
          }
        };
        sharkAt(0); // pose her at build time — an unposed shark sits on the jetty
        return (time: number) => {
          lagoon.update(time); // the sea keeps rolling whatever the ride does
          sharkAt(time);
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          // ship's lanterns gutter; the beacon is steady
          const flick = 1 + 0.11 * Math.sin(time * 7.3) + 0.06 * Math.sin(time * 13.1 + 1.7);
          stLight.intensity = 0.9 * ease * flick;
          wreckLight.intensity = 1.15 * ease * flick;
          bowLight.intensity = 0.8 * ease * flick;
          markerLight.intensity = 0.7 * ease;
          for (const m of lampMats) m.emissiveIntensity = 0.1 + 1.35 * ease * flick;
          for (const m of boatLamps) m.emissiveIntensity = 0.12 + 1.2 * ease;
          gate.update(time);
        };
      })(three, group) || undefined;

  return { group, update, seatWorld, onStateChange, ...extras };
}

const ReefRacerBase = composableRide<ReefRacerOpts & { register?: boolean }>(
  'ReefRacer',
  (t, props) =>
    buildReefRacerScene(t, {
      pieces: props.pieces,
      groundAt: props.groundAt,
      wreckU: props.wreckU,
      // decorative riders standalone; OFF when registered so the GameManager's
      // real guests fill the four thwarts (capacity 4 = 4 seats)
      riders: props.riders ?? !props.register,
      registered: !!props.register,
    }),
  {
    // the station straight runs along the local −x, so the local +z face is
    // free — and the SAND SPIT the lagoon is carved around covers exactly it:
    // queue HEAD 2.1 out the front (entrance hut at ~1.48, clear of the
    // jetty), exit hut at [1.9, 2.1] beside it, boarding on the jetty deck
    front: 2.1,
    exit: [1.9, 2.1],
    board: BOARD,
    // intensity 6 → 8: the drop went 4.4 → 5.6 and the circuit now
    // threads a hanging yard, three reef fangs and a shark (§10b)
    defaults: { name: 'Reef Racer', capacity: 4, rideDuration: 22, intensity: 8, price: 5 },
  },
);

/** <ReefRacer> — Tidewater Hollow's flagship WATER COASTER as a composable
 *  ride (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride via <ConfigurableRide> —
 *  queue HEAD 2.1 out the local +z front (the dry sand spit the lagoon is
 *  carved around), exit hut at local [1.9, 2.1], boarding on the jetty deck.
 *  Override with top-level props / `queue`.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Lift/><TurnR/><Drop/>…` — children win) are compiled
 *  by `compileTrackPieces` on the 'flume' profile (the Water Coaster's own
 *  FLOODED channel drawer, `TrackStyle::splashBoats` on wooden truss supports —
 *  WaterCoaster.h) and swept by `buildRideSpline`; no pieces = the stock "Wreck
 *  Reef Run" (one 34.8° chain lift, a summit run along the reef, one 34.8°
 *  plunge, and a home stretch straight THROUGH a broken sailing ship). A FATAL
 *  compile marks the build `invalid` so a broken circuit never registers. The
 *  reef skiff is the ride `vehicle` (onboard cam) and its four thwarts are live
 *  `seatWorld` anchors, so REAL guests ride it. */
export const ReefRacer: React.FC<ComposableRideProps & ReefRacerOpts & { children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <ReefRacerBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
