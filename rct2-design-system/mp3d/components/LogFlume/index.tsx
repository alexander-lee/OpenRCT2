import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { buildRideSpline, compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildWaterRibbon } from '../WaterTile';
import { buildEmitter } from '../ParticleKit';
import { VehicleScheme, rideColourPreset } from '../ColorKit';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// ---------------------------------------------------------------------------
// LogFlume — the RCT2 water ride rebuilt on SplineRideKit: a closed lazy-loop
// spline swept as a wooden U-channel trough ('flume' profile — water strip,
// gentle banking, trestle supports), with a belt lift up the tall side and a
// steep drop into a flared splash run-out. A FLEET of hollowed logs drifts the
// circuit at fixed spacing, plunges down the drop and kicks up a spray of foam
// as it hits the run-out. Deterministic, driven by the Stage clock.
//
// THE THREE STRUCTURES THIS COMPONENT OWNS (everything else is the compiled
// SplineRideKit circuit, which it must not and does not touch):
//
//  1. THE TRESTLE VIADUCT.  `addSplineSupports` builds one splayed timber BENT
//     every 10 frames and nothing between them, so a tall flume read as a row
//     of separate, unconnected towers — the single biggest defect in the noon
//     render. `trestleBays()` below re-derives the bents' own leg geometry
//     (same stride, same skip rules, same splay law) and laces adjacent bents
//     together with stringers under the trough, horizontal ledgers and
//     alternating sway diagonals. Every member is placed FROM ITS TWO
//     ENDPOINTS (`strut()` → `quaternion.setFromUnitVectors` → a baked
//     `matrix` on a MergedBoxSpec) because rotX/rotY/rotZ cannot express the
//     direction of a diagonal between two arbitrary leg points. Two merged
//     meshes carry the whole viaduct.
//  2. THE STATION HOUSE.  Was a 0.7 × 1.9 plank and two posts. Now a boarding
//     platform with plank seams, skirt, knee-braced posts, a railed edge, a
//     shingled canopy on four posts over BOTH the deck and the boarding
//     channel, valanced gables, an operator booth and hanging lanterns —
//     authored in a frame-aligned local basis (local +x = frame side, +z =
//     frame forward) so it lands correctly on any circuit.
//  3. THE SPLASH BASIN.  The drop run-out now lands in a raised masonry basin
//     the trestle stands in: a lofted GRADED BED (the depth gradient has to
//     come from the bed read through the sheet — `WaterTile`'s alpha is driven
//     by wave height, not depth), a wet band at the shoreline instead of a
//     hard clip edge, and a real animated `buildWaterRibbon` sheet across it.
//     It is RAISED (rim above the host ground, bed above y=0) because a bed
//     seated below the host's opaque surface is invisible — `groundAt` is a
//     sampler, not a knife, and a component cannot dig.
// ---------------------------------------------------------------------------

// lazy loop: station straight on the west, belt lift up the east side, crest
// turn, then the big drop into the splash pool and a slow drift home. The
// drop is taken in TWO stages (mid-drop + eased valley) so the rigid log's
// nose never ploughs through the trough floor at the pull-out (worst floor
// contact verified ≤ 0.027 along the whole loop).
const LAYOUT: [number, number, number][] = [
  [-3.2, 0.6, -1.6], // station straight
  [-1.0, 0.62, -2.7],
  [1.8, 0.7, -2.5], // approach the lift
  [3.5, 2.1, -0.9], // belt lift climbs...
  [3.7, 2.3, 1.0], // ...to the crest turn
  [3.1, 1.58, 1.8], // THE DROP...
  [1.9, 0.62, 2.75], // ...eases into the splash-pool valley
  [0.1, 0.6, 3.05], // splash run-out
  [-2.3, 0.6, 2.4], // lazy bend home
  [-3.7, 0.6, 0.4],
];

// SplineCoaster's own sampling constants, restated here because the trestle
// bracing has to land on EXACTLY the frames `addSplineSupports` used. Both are
// structural, not tunable: `computeSplineFrames` fixes `SAMPLES = 320` and
// `buildRideSpline` passes `supportEvery: 10` for the water profiles.
const FRAMES_N = 320;
const SUPPORT_EVERY = 10;

/** quads between consecutive rows of equal length → ONE indexed geometry */
function loftRows(t: typeof THREE, rows: THREE.Vector3[][]): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const cols = rows[0].length;
  rows.forEach((r) => r.forEach((p) => pos.push(p.x, p.y, p.z)));
  for (let i = 0; i < rows.length - 1; i += 1)
    for (let j = 0; j < cols - 1; j += 1) {
      const a = i * cols + j;
      idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  const geo = new t.BufferGeometry();
  geo.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * ENDPOINT PLACEMENT — a box of section `th × tw` spanning a → b. The
 * rotation that carries local +x onto (b − a) cannot be written as an
 * rotX/rotY/rotZ triple, so it is built as a quaternion and baked into the
 * spec's `matrix`; every member of a trestle bay, a bark ring or a knee brace
 * is placed this way, and they all land in one merged mesh.
 */
function strutSpec(
  t: typeof THREE,
  a: THREE.Vector3,
  b: THREE.Vector3,
  th: number,
  tw: number,
  repeat?: [number, number],
): MergedBoxSpec | null {
  const d = new t.Vector3().subVectors(b, a);
  const len = d.length();
  if (len < 1e-4) return null;
  const q = new t.Quaternion().setFromUnitVectors(new t.Vector3(1, 0, 0), d.normalize());
  const m = new t.Matrix4().makeRotationFromQuaternion(q);
  m.setPosition(new t.Vector3().addVectors(a, b).multiplyScalar(0.5));
  return { dims: [len, th, tw], matrix: m, ...(repeat ? { repeat } : {}) };
}

/**
 * CARVED log boat with riders — a real LOFTED SURFACE, not a lathe.
 *
 * It was a `LatheGeometry` barrel: a circular section revolved with a
 * CONSTANT-angle slot cut out of the top, which meant the scoop ran the whole
 * length of the log and the bow and stern had to be patched shut afterwards
 * with two more lathe bands and two ball plugs. Five meshes and two seams to
 * fake one shape.
 *
 * A hollowed log is a SURFACE, so this builds the surface. Three fair curves
 * against the length — the outer radius `rad`, the scoop half-angle `gap` and
 * the bore radius `bore` — define a station; `shell()` walks a station round
 * the section; and three lofts triangulate the grid: the OUTER hull, the BORE
 * (whose radius falls to zero at both ends, so the hollow closes itself into
 * rounded inboard ends and needs no caps), and one continuous RIM band that
 * traverses the port rim bow-ward and the starboard rim stern-ward, closing
 * through the degenerate quads where the scoop pinches out. The scoop is now
 * WIDE amidships and pinched at the ends because `gap` says so, which is what
 * a hollowed log actually looks like — and it is 3 draws instead of 10.
 *
 * Origin stays at the barrel centre with the keel at y = −0.30 and the bow at
 * +z, so `wheelOffset: 0.25` and every existing caller are unchanged.
 * Optional `scheme` (RCT2 VehicleColour, ride/VehicleColour.h:19-24):
 * body → bark, trim → cut gunwale. `riders` (default 3) fills the benches.
 */
export function buildLog(t: typeof THREE, scheme?: VehicleScheme, riders = 3): THREE.Group {
  const boat = new t.Group();
  const BARK = scheme?.body ?? 0x8a5a28;
  const CUT = scheme?.trim ?? 0xe8cc80;
  const LEN = 1.5;
  const R = 0.3;
  const TH = 0.052; // wall thickness at the rim
  const GAPMAX = 0.72; // scoop half-angle amidships (rad) — rim lands at y ≈ 0.23

  // ---- the three fair curves (u = 0 stern … 1 bow) ----
  /** outer radius: full amidships, falling to a POINT at both tips (so the
   *  loft closes itself — the old lathe left a hole that needed a ball plug) */
  const rad = (u: number) => R * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 3.2)), 0.28);
  /** scoop half-angle: opens at u 0.12, pinches out at 0.88 */
  const gap = (u: number) => {
    const s = (u - 0.12) / 0.76;
    return s <= 0 || s >= 1 ? 0 : GAPMAX * Math.pow(Math.sin(Math.PI * s), 0.55);
  };
  /** bore radius: the wall thickness in from the hull, bell-closed at the ends */
  const bore = (u: number) => {
    const s = (u - 0.1) / 0.8;
    if (s <= 0 || s >= 1) return 0;
    return Math.max(0, rad(u) - TH) * Math.pow(Math.sin(Math.PI * s), 0.3);
  };
  /**
   * THE BARK FLUTE. First pass put the bark on as merged strips glued to a
   * perfectly circular hull; a strip 22 mm proud on a 300 mm barrel is
   * invisible from anywhere useful, and the log read as a smooth brown loaf.
   * Bark is read off the SILHOUETTE, so the flute goes into the surface
   * itself: eleven lengthwise flutes at ±6.5 %, WINDOWED so the amplitude
   * fades to zero within 0.6 rad of the keel. The window is the whole reason
   * this is safe: the keel stays at exactly r = 0.30, so the hull's lowest
   * point is unchanged and every clearance the layout was verified against
   * (0.05 to the trough floor at `wheelOffset` 0.25, worst floor contact 0.027
   * through the drop pull-out) still holds to the millimetre. The widest ridge
   * reaches 0.3195 laterally × 1.06 = 0.339, against trough walls at ±0.45.
   * Zero extra draws: it is the same loft, sampled differently — 3.6 % was the
   * first attempt and was invisible on a matte surface under one sun.
   */
  const radAt = (u: number, phi: number) =>
    rad(u) * (1 - 0.065 * Math.min(1, Math.abs(phi) / 0.6) * Math.cos(11 * phi));
  /** a point on a station: φ = 0 keel (−y), ±π gunwale top (+y) */
  const shell = (u: number, phi: number, r: number) =>
    new t.Vector3(Math.sin(phi) * r * 1.06, -Math.cos(phi) * r, (u - 0.5) * LEN);
  /** one station's row of points, walked across the OPEN part of the section.
   *  `flute` is off for the bore (a scooped hollow is smooth inside). */
  const station = (u: number, r: (phi: number) => number, nPhi: number) => {
    const half = Math.PI - gap(u);
    const row: THREE.Vector3[] = [];
    for (let j = 0; j <= nPhi; j += 1) {
      const phi = -half + (2 * half * j) / nPhi;
      row.push(shell(u, phi, r(phi)));
    }
    return row;
  };

  // ---- 1. the outer hull ----
  const NU = 28;
  const NPHI = 44; // 4 samples a flute — fewer and the flutes alias into noise
  const hullMat = mat(t, BARK, { tex: 'wood', repeat: [7, 2], rough: 0.92, bump: 0.05 });
  hullMat.side = t.DoubleSide;
  const hull = new t.Mesh(
    loftRows(t, Array.from({ length: NU + 1 }, (_, i) => station(i / NU, (phi) => radAt(i / NU, phi), NPHI))),
    hullMat,
  );
  hull.castShadow = true;
  hull.receiveShadow = true;
  boat.add(hull);

  // ---- 2. the bore: the hollowed-out inside, dark and self-closing ----
  const boreMat = mat(t, 0x2f2015, { tex: 'wood', repeat: [5, 2], rough: 0.97 });
  boreMat.side = t.DoubleSide;
  const boreRows: THREE.Vector3[][] = [];
  for (let i = 0; i <= 24; i += 1) {
    const u = 0.1 + (i / 24) * 0.8;
    boreRows.push(station(u, () => bore(u), 16));
  }
  const hollow = new t.Mesh(loftRows(t, boreRows), boreMat);
  hollow.receiveShadow = true;
  boat.add(hollow);

  // ---- 3. the rim: ONE band, port bow-ward then starboard stern-ward ----
  const rimRows: THREE.Vector3[][] = [];
  const rimAt = (u: number, sign: number) => {
    const g = gap(u);
    const phi = sign * (Math.PI - g);
    const inner = g > 0 ? bore(u) : rad(u); // pinched out ⇒ zero-width, degenerate
    return [shell(u, phi, radAt(u, phi) + 0.002), shell(u, phi, inner)];
  };
  for (let i = 0; i <= NU; i += 1) rimRows.push(rimAt(i / NU, 1));
  for (let i = NU; i >= 0; i -= 1) rimRows.push(rimAt(i / NU, -1));
  // the rim reads DARKER than the benches on purpose: at RCT2 `beige` the
  // gunwale collar was the brightest surface anywhere on the ride and pulled
  // the eye straight off the drop
  const rimMat = mat(t, new t.Color(CUT).multiplyScalar(0.78).getHex(), { tex: 'wood', repeat: [10, 1], rough: 0.8 });
  rimMat.side = t.DoubleSide;
  const rim = new t.Mesh(loftRows(t, rimRows), rimMat);
  rim.castShadow = true;
  boat.add(rim);

  // ---- growth bands: two CHORDED rings round the section, merged -----------
  // The flute above carries the bark; these two are the cross-grain, kept low
  // in contrast (0.86 of the hull tone, 6 mm proud). At full contrast, and at
  // four of them, they read as iron barrel straps — cooperage, not timber.
  const barkP: MergedBoxSpec[] = [];
  [0.3, 0.7].forEach((u) => {
    const half = Math.PI - gap(u) - 0.06;
    const M = 14;
    for (let k = 0; k < M; k += 1) {
      const p0 = -half + (2 * half * k) / M;
      const p1 = -half + (2 * half * (k + 1)) / M;
      const sp = strutSpec(t, shell(u, p0, radAt(u, p0) + 0.006), shell(u, p1, radAt(u, p1) + 0.006), 0.016, 0.095, [1, 1]);
      if (sp) barkP.push(sp);
    }
  });
  const bark = mergedBoxes(t, barkP, new t.Color(BARK).multiplyScalar(0.86).getHex(), { tex: 'wood', rough: 0.96 });
  bark.castShadow = true;
  boat.add(bark);

  // ---- benches + back lips, merged (two tones, two draws) ----
  const benchP: MergedBoxSpec[] = [];
  const lipP: MergedBoxSpec[] = [];
  for (let i = 0; i < 3; i += 1) {
    const sz = -0.34 + i * 0.34;
    benchP.push({ dims: [0.34, 0.05, 0.15], pos: [0, 0.17, sz] });
    lipP.push({ dims: [0.34, 0.11, 0.04], pos: [0, 0.215, sz - 0.115] });
  }
  boat.add(mergedBoxes(t, benchP, CUT, { tex: 'wood', rough: 0.8 }));
  boat.add(mergedBoxes(t, lipP, 0xcbb068, { tex: 'wood', rough: 0.8 }));

  // ---- chevron bow-wave plates at the waterline (merged, one draw) ----
  const wave = mergedBoxes(
    t,
    [-1, 1].map((s) => ({ dims: [0.24, 0.03, 0.11] as [number, number, number], pos: [s * 0.12, -0.2, 0.58] as [number, number, number], rotY: s * 0.55 })),
    0xeaf6fb,
    { rough: 0.4, opacity: 0.85 },
  );
  wave.castShadow = false;
  boat.add(wave);

  for (let i = 0; i < riders; i += 1) {
    const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[(i + 3) % SHIRTS.length], seated: true, expression: i === 0 ? 'surprised' : 'happy' });
    p.group.scale.setScalar(0.42);
    p.group.position.set(0, -0.02, -0.34 + i * 0.34); // hips on the benches, torsos over the rim
    p.group.userData.lodDetail = true; // the park runtime sheds riders past NEAR
    boat.add(p.group);
  }
  return boat;
}

export function buildLogFlumeScene(
  three: typeof THREE,
  opts: { pieces?: TrackPiece[] } = {},
): { group: THREE.Group; update?: (time: number) => void; vehicle?: THREE.Object3D; invalid?: boolean } {
  const group = new three.Group();
  // sim extras picked up by <ConfigurableRide>: `vehicle` = the lead log
  // (RideViewer onboard/follow cam), `invalid` = fatal pieces compile (the
  // chassis then skips the GameManager registration, like <TrackRide>)
  const extras: { vehicle?: THREE.Object3D; invalid?: boolean } = {};
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // the trough: wooden U-channel following the closed spline. Optional
        // `pieces` swap the LAYOUT for a compileTrackPieces circuit
        // (auto-closed + validated); all the dressing below derives from frame
        // scans, so it follows any layout.
        let layoutPts = LAYOUT;
        if (opts.pieces) {
          const compiled = compileTrackPieces(opts.pieces, { profile: 'flume', start: [0, 0.6, 0] });
          layoutPts = compiled.points;
          if (compiled.report.fatal) extras.invalid = true;
        }
        // TIMBER, not scaffolding. `rideColourPreset(12, 'water')` is the
        // second RCT2 Log Flume preset (LogFlume.h:54) — oliveGreen trough,
        // black rim, GREY supports — and in 3D that read as a near-black tube
        // on a row of grey steel towers, which is the flat, cold thing the
        // noon render showed. The trough is now RCT2 `umber` with a mid-brown
        // rim (the kit derives the wall tone at the stock 0.82 ratio) and the
        // trestle is `darkBrown`: a wooden flume's bents are timber, and a
        // grey lattice cannot read as anything but scaffolding. `additional`
        // paints the rim rails AND the cross-ribs under the floor, whose ends
        // poke 0.08 past the wall line — at RCT2 `lightBrown` they read as a
        // row of pale tabs stuck to the trough, so it is pulled down to a tone
        // only a shade off the wall. The VEHICLE livery is left exactly as the
        // preset rolled it.
        const scheme = rideColourPreset(12, 'water');
        scheme.track = { main: 0x7c5c34, additional: 0x93632f, supports: 0x5f4023 };
        const ride = buildRideSpline(t, layoutPts, { profile: 'flume', colours: scheme.track, vehicleSchemes: scheme.vehicles });
        g.add(ride.group);
        const total = ride.curve.getLength();

        // ------------------------------------------------------------------
        // THE TRESTLE VIADUCT — lace the bents together.
        // `addSplineSupports` drops one splayed bent every SUPPORT_EVERY
        // frames and nothing in between, so what it builds is a ROW OF
        // TOWERS. The bents' own geometry is re-derived here (identical
        // stride, identical skip tests, identical splay law) purely to learn
        // where their legs are, and then every bay between two consecutive
        // bents gets: a stringer under the trough per side, horizontal
        // ledgers at each bracing level, and one sway diagonal per side
        // alternating direction bay to bay. Nothing in SplineRideKit is
        // touched — this is additive structure hung off frames.
        // ------------------------------------------------------------------
        type Bent = { i: number; p: THREE.Vector3; lx: number; lz: number; topY: number; spread: number };
        const bents: Bent[] = [];
        for (let i = 0; i < FRAMES_N; i += SUPPORT_EVERY) {
          const f = ride.frameAt(i / FRAMES_N);
          const topY = f.p.y - 0.16;
          if (topY < 0.3) continue; // addSplineSupports: track is near the ground
          if (f.up.y < 0.5) continue; // ...or too banked/inverted to land a column
          const ln = Math.hypot(f.side.x, f.side.z) || 1;
          bents.push({ i, p: f.p.clone(), lx: f.side.x / ln, lz: f.side.z / ln, topY, spread: 0.5 + (f.p.y - 0.16) * 0.09 });
        }
        /** a point on bent `b`'s leg on side `s` at height `y` — the legs splay
         *  from ±spread at the footing (y −0.06) to ±0.4 at the cap */
        const legAt = (b: Bent, s: number, y: number) => {
          const k = Math.max(0, Math.min(1, (y + 0.06) / (b.topY + 0.06)));
          const w = b.spread + (0.4 - b.spread) * k;
          return new t.Vector3(b.p.x + s * w * b.lx, y, b.p.z + s * w * b.lz);
        };
        const stringP: MergedBoxSpec[] = []; // stringers + ledgers (timber)
        const swayP: MergedBoxSpec[] = []; // sway diagonals (darker timber)
        let bays = 0;
        for (let k = 0; k < bents.length; k += 1) {
          const a = bents[k];
          const b = bents[(k + 1) % bents.length];
          if (bents.length < 2) break;
          // adjacent only: a skipped bent (near-ground or banked) means there
          // is no bay to brace, and a wrap-around jump would draw a beam
          // straight across the middle of the park
          const step = (b.i - a.i + FRAMES_N) % FRAMES_N;
          if (step !== SUPPORT_EVERY) continue;
          if (Math.hypot(b.p.x - a.p.x, b.p.z - a.p.z) > 3.2) continue;
          bays += 1;
          [-1, 1].forEach((s) => {
            // the stringer: the longitudinal beam under the trough that turns
            // the towers into a viaduct. This one member does most of the work.
            const sa = legAt(a, s, a.topY - 0.02);
            const sb = legAt(b, s, b.topY - 0.02);
            const st = strutSpec(t, sa, sb, 0.11, 0.1, [3, 1]);
            if (st) stringP.push(st);
            // ledgers + one sway diagonal per bracing level
            const span = Math.min(a.topY, b.topY);
            const levels = Math.max(0, Math.min(5, Math.floor((span - 0.55) / 0.85)));
            for (let l = 1; l <= levels; l += 1) {
              const y0 = (span * l) / (levels + 1);
              const y1 = l === levels ? span - 0.1 : (span * (l + 1)) / (levels + 1);
              const led = strutSpec(t, legAt(a, s, y0), legAt(b, s, y0), 0.07, 0.075, [3, 1]);
              if (led) stringP.push(led);
              const d = (l + k) % 2 ? 1 : -1;
              const sw = d > 0
                ? strutSpec(t, legAt(a, s, y0), legAt(b, s, y1), 0.055, 0.06, [4, 1])
                : strutSpec(t, legAt(a, s, y1), legAt(b, s, y0), 0.055, 0.06, [4, 1]);
              if (sw) swayP.push(sw);
            }
          });
        }
        if (stringP.length) {
          const m = mergedBoxes(t, stringP, 0x5f4023, { tex: 'wood', rough: 0.9 });
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
        }
        if (swayP.length) g.add(mergedBoxes(t, swayP, 0x4a3018, { tex: 'wood', rough: 0.92 }));

        // BATTENS + CHINE RAIL on the trough's outer faces. The swept wall is
        // one continuous 0.3-tall plank surface, which at close range is a
        // featureless brown ribbon with no sense of scale on it. A real flume
        // trough is a stave barrel: vertical battens over the seams and a
        // chine rail along the bottom edge. Both follow the CURVE, so both are
        // placed from the frame basis (`makeBasis(side, up, fwd)`) rather than
        // from Euler angles — and both land in one merged mesh.
        const battenP: MergedBoxSpec[] = [];
        const fwdV = new t.Vector3();
        for (let i = 0; i < FRAMES_N; i += 6) {
          const f = ride.frameAt(i / FRAMES_N);
          fwdV.crossVectors(f.side, f.up);
          [-1, 1].forEach((s) => {
            const m4 = new t.Matrix4().makeBasis(f.side, f.up, fwdV);
            m4.setPosition(f.p.clone().addScaledVector(f.side, s * 0.47).addScaledVector(f.up, 0.028));
            battenP.push({ dims: [0.05, 0.3, 0.11], matrix: m4, repeat: [1, 2] });
          });
        }
        for (let i = 0; i < FRAMES_N; i += 4) {
          const f0 = ride.frameAt(i / FRAMES_N);
          const f1 = ride.frameAt(((i + 4) % FRAMES_N) / FRAMES_N);
          [-1, 1].forEach((s) => {
            const a = f0.p.clone().addScaledVector(f0.side, s * 0.47).addScaledVector(f0.up, -0.115);
            const b = f1.p.clone().addScaledVector(f1.side, s * 0.47).addScaledVector(f1.up, -0.115);
            const sp = strutSpec(t, a, b, 0.07, 0.075, [2, 1]);
            if (sp) battenP.push(sp);
          });
        }
        const battens = mergedBoxes(t, battenP, 0x6a4a28, { tex: 'wood', rough: 0.9 });
        battens.castShadow = true;
        battens.receiveShadow = true;
        g.add(battens);

        // REAL animated shader water through the trough: ONE continuous
        // buildWaterRibbon following the flume spline (same treatment as
        // RiverRapids' channel). The profile's flat strip (-0.02) stays
        // BENEATH as the opaque backing body colour — the shader water is
        // transparent, depthWrite off, riding 0.055 above it so there is no
        // z-fighting. Width 0.72 matches the strip and stays 0.09 clear of the
        // wall inner faces (±0.45). amp 0.16 × waviness 0.6 (flume water is
        // calmer than rapids chop) swells ±0.029 about the +0.035 ride height:
        // crests +0.064 stay far under the wall tops (+0.18), troughs +0.006
        // stay above the backing strip (-0.02) — and the ribbon samples the
        // SAME frames the trough is swept from, so it follows the drop exactly.
        const RIBBON_N = 220;
        const ribbonPts: { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[] = [];
        for (let k = 0; k < RIBBON_N; k++) {
          const f = ride.frameAt(k / RIBBON_N);
          ribbonPts.push({ p: f.p.clone().addScaledVector(f.up, 0.035), side: f.side.clone(), up: f.up.clone() });
        }
        ribbonPts.push({ ...ribbonPts[0] }); // close the loop watertight
        const flumeWater = buildWaterRibbon(t, ribbonPts, 0.72, { amp: 0.16, waviness: 0.6 });
        g.add(flumeWater.mesh);

        // find the drop run-out deterministically: steepest descending frame,
        // then the first frame after it that has levelled back out
        let uSteep = 0;
        let steep = 0;
        for (let i = 0; i < 400; i++) {
          const f = ride.frameAt(i / 400);
          if (f.fwd.y < steep) {
            steep = f.fwd.y;
            uSteep = i / 400;
          }
        }
        let uRun = uSteep;
        for (let i = Math.ceil(uSteep * 400); i < 400; i++) {
          if (ride.frameAt(i / 400).fwd.y > -0.14) {
            uRun = i / 400;
            break;
          }
        }
        const runF = ride.frameAt(uRun + 0.02);
        const SPLASH_AT = runF.p.clone(); // drop bottom, ON the trough itself
        const splashWaterY = runF.p.y + 0.035; // the animated ribbon's water line

        // lift-side markers: emissive-only amber beads along both rim rails of
        // the belt-lift climb (rail centre ±0.46/+0.19, r 0.045 → beads sit on
        // the rail tops at +0.26). Deterministic scan for climbing frames
        // (fwd.y > 0.18 ⇒ the belt lift), every 3rd sample of 60. No real lights.
        const markerMats: THREE.MeshStandardMaterial[] = [];
        for (let i = 0; i < 60; i += 3) {
          const f = ride.frameAt(i / 60);
          if (f.fwd.y <= 0.18) continue;
          [-1, 1].forEach((s) => {
            const m = ball(t, 0.03, 0xffe9b0, [0, 0, 0], { emissive: 0xffb45e, rough: 0.35 });
            m.position.copy(f.p).addScaledVector(f.side, s * 0.46).addScaledVector(f.up, 0.26);
            (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12; // faint by day
            g.add(m);
            markerMats.push(m.material as THREE.MeshStandardMaterial);
          });
        }

        // drop run-out: low outward-flared splash walls (chorded boards riding
        // the rim rails, like a real flume run-out), MERGED into one mesh
        const flareUp = new t.Vector3();
        const flareSide = new t.Vector3();
        const flareDir = new t.Vector3();
        const boardCol = new t.Color(scheme.track.main).multiplyScalar(0.82).getHex(); // trough-wall tone, not slab-black
        const flareP: MergedBoxSpec[] = [];
        for (let i = 0; i < 6; i++) {
          const f0 = ride.frameAt(uRun - 0.004 + i * 0.011);
          const f1 = ride.frameAt(uRun - 0.004 + (i + 1) * 0.011);
          [-1, 1].forEach((s) => {
            const a = f0.p.clone().addScaledVector(f0.side, s * 0.5).addScaledVector(f0.up, 0.17);
            const b = f1.p.clone().addScaledVector(f1.side, s * 0.5).addScaledVector(f1.up, 0.17);
            flareDir.subVectors(b, a);
            const len = flareDir.length();
            flareDir.normalize();
            // board up-vector leaned outward ~35°, re-orthogonalized to the chord
            flareUp.addVectors(f0.up, f1.up).normalize().multiplyScalar(Math.cos(0.6)).addScaledVector(f0.side, s * Math.sin(0.6)).normalize();
            flareUp.addScaledVector(flareDir, -flareUp.dot(flareDir)).normalize();
            flareSide.crossVectors(flareUp, flareDir).normalize();
            const m4 = new t.Matrix4().makeBasis(flareSide, flareUp, flareDir);
            m4.setPosition(new t.Vector3().addVectors(a, b).multiplyScalar(0.5).addScaledVector(flareUp, 0.065));
            flareP.push({ dims: [0.024, 0.17, len * 1.12], matrix: m4, repeat: [1, 2] });
          });
        }
        g.add(mergedBoxes(t, flareP, boardCol, { tex: 'wood', rough: 0.9 }));
        // widened churned water at the run-out: thin foam-white patches
        // straddling the animated ribbon surface (+0.035 ± 0.029 swell)
        const churnP: MergedBoxSpec[] = [];
        for (let i = 0; i < 5; i++) {
          const f = ride.frameAt(uRun + i * 0.016);
          const m4 = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
          m4.multiply(new t.Matrix4().makeRotationY(Math.sin(i * 9.2) * 0.2));
          m4.setPosition(f.p.clone().addScaledVector(f.up, 0.04).addScaledVector(f.side, Math.sin(i * 5.1) * 0.06));
          churnP.push({ dims: [0.6 + 0.14 * ((i * 3) % 2), 0.014, 0.42], matrix: m4 });
        }
        const churn = mergedBoxes(t, churnP, 0xe4f4f9, { rough: 0.4, opacity: 0.55 });
        churn.castShadow = false;
        g.add(churn);

        // ------------------------------------------------------------------
        // THE SPLASH BASIN — the drop lands in a plunge pool that the trestle
        // stands in (the bents' legs foot at ±0.54, well inside the ±1.10 bed,
        // so they read as pilings in the water).
        //
        // Everything is RAISED above the host ground: a bed seated BELOW the
        // host's opaque surface is invisible — `groundAt` is a sampler, not a
        // knife, and a component cannot dig. So the pool is built UP, and its
        // whole height budget is derived from the run-out's clearance
        // (`CLEAR = min(0.38, runOut.y − 0.22)`) rather than being a constant:
        // the swell has to stay under the trough's own rib line at every
        // legal layout, not just the stock one.
        //
        // The depth gradient is carried by the BED read through the sheet,
        // because WaterTile's alpha follows WAVE HEIGHT, not depth — a flat
        // bed under a shader sheet gives one flat tone everywhere however the
        // water is tuned. The shoreline is a WET BAND (a darker, glossier
        // strip straddling the waterline, following the bowl's own contour)
        // instead of the hard clip edge that makes painted water look painted.
        // The rim is BOULDERS and a timber curb rather than a masonry coping:
        // a grey concrete ring on an all-timber flume read as a bathtub bolted
        // to the side of the ride.
        //
        // Skipped when the run-out is not near the ground — a pool hanging in
        // the air under a high reach would be worse than no pool at all.
        // ------------------------------------------------------------------
        let basinWater: { mesh: THREE.Mesh; update: (time: number) => void } | null = null;
        if (runF.p.y > 0.42 && runF.p.y < 1.7) {
          const CLEAR = Math.min(0.38, runF.p.y - 0.22); // stay under the trough ribs
          const RIM = CLEAR;
          const BED_EDGE = CLEAR - 0.03;
          const SHEET = CLEAR - 0.07;
          const BED_LOW = Math.max(0.02, CLEAR - 0.3);
          const HALF_W = 1.1; // across the trough
          const ARC = 3.4; // along the run-out
          const du = ARC / total;
          const NB = 16;
          const sample = (i: number) => ride.frameAt(uRun - du * 0.28 + (i / NB) * du);
          // horizontal frame basis (the basin sits on the ground, not on the
          // banked track, so the track's up-vector must not tilt it)
          const flat = (i: number) => {
            const f = sample(i);
            const fh = new t.Vector3(f.fwd.x, 0, f.fwd.z).normalize();
            const sh = new t.Vector3(fh.z, 0, -fh.x);
            return { c: new t.Vector3(f.p.x, 0, f.p.z), sh, fh };
          };
          /** bed height at (across k ∈ −1..1, along i) — a graded bowl, deepest
           *  under the centreline just past the drop */
          const bedY = (k: number, i: number) => {
            const a = Math.abs(k);
            const along = Math.sin(Math.PI * Math.min(1, Math.max(0, (i / NB) * 1.06 + 0.02)));
            const bowl = Math.pow(1 - a * a, 1.35) * Math.pow(along, 0.7);
            return BED_EDGE - (BED_EDGE - BED_LOW) * bowl;
          };
          const NK = 12;
          const bedRows: THREE.Vector3[][] = [];
          for (let i = 0; i <= NB; i += 1) {
            const { c, sh } = flat(i);
            const row: THREE.Vector3[] = [];
            for (let j = 0; j <= NK; j += 1) {
              const k = -1 + (2 * j) / NK;
              row.push(new t.Vector3(c.x + sh.x * k * HALF_W, bedY(k, i), c.z + sh.z * k * HALF_W));
            }
            bedRows.push(row);
          }
          const bedMat = mat(t, 0x4e4436, { tex: 'concrete', repeat: [4, 8], rough: 0.97 });
          bedMat.side = t.DoubleSide;
          const bed = new t.Mesh(loftRows(t, bedRows), bedMat);
          bed.receiveShadow = true;
          g.add(bed);
          // THE WET BAND: the strip of bed straddling the waterline (from 0.03
          // above it to 0.09 below), laid 4 mm proud in a darker, glossier
          // tone. A shoreline is a band of wet stone; a hard clip edge where
          // the sheet stops is the thing that makes painted water look painted.
          // `kAt` walks IN from the coping to the first across-parameter whose
          // graded bed drops past a target height, so the band follows the
          // bowl rather than being a constant-width ring.
          const kAt = (i: number, target: number) => {
            for (let j = 0; j <= NK / 2; j += 1) {
              const k = 1 - (2 * j) / NK;
              if (bedY(k, i) < target) return k;
            }
            return 0;
          };
          // rough 0.52, not 0.34: wet stone IS glossier than dry, but a
          // MeshStandardMaterial with no envMap answers a low roughness with a
          // single blown specular lobe from the sun, and the band read as a
          // PALE grey plank laid across the shore — brighter than the dry bed
          // it was supposed to darken. Gloss without an environment to reflect
          // is just a highlight.
          const wetMat = mat(t, 0x2f2a22, { tex: 'concrete', repeat: [2, 8], rough: 0.52 });
          wetMat.side = t.DoubleSide;
          [-1, 1].forEach((sgn) => {
            const rows: THREE.Vector3[][] = [];
            for (let i = 0; i <= NB; i += 1) {
              const { c, sh } = flat(i);
              rows.push([kAt(i, SHEET + 0.03), kAt(i, SHEET - 0.09)].map((k0) => {
                const k = sgn * k0;
                return new t.Vector3(c.x + sh.x * k * HALF_W, bedY(k, i) + 0.004, c.z + sh.z * k * HALF_W);
              }));
            }
            g.add(new t.Mesh(loftRows(t, rows), wetMat));
          });
          // the curb: a low TIMBER retaining kerb round the pool, chorded from
          // the frame samples and merged, in the trestle's own tone. Both
          // flanks plus a head board at each end. (This was a grey masonry
          // coping and it read as a bathtub bolted onto a timber ride.)
          const copeP: MergedBoxSpec[] = [];
          [-1, 1].forEach((s) => {
            for (let i = 0; i < NB; i += 1) {
              const A = flat(i);
              const B = flat(i + 1);
              const a = new t.Vector3(A.c.x + A.sh.x * s * HALF_W, RIM - 0.1, A.c.z + A.sh.z * s * HALF_W);
              const b = new t.Vector3(B.c.x + B.sh.x * s * HALF_W, RIM - 0.1, B.c.z + B.sh.z * s * HALF_W);
              const sp = strutSpec(t, a, b, 0.2, 0.16, [2, 1]);
              if (sp) copeP.push(sp);
            }
          });
          [0, NB].forEach((i) => {
            const A = flat(i);
            const a = new t.Vector3(A.c.x - A.sh.x * HALF_W, RIM - 0.1, A.c.z - A.sh.z * HALF_W);
            const b = new t.Vector3(A.c.x + A.sh.x * HALF_W, RIM - 0.1, A.c.z + A.sh.z * HALF_W);
            const sp = strutSpec(t, a, b, 0.2, 0.16, [4, 1]);
            if (sp) copeP.push(sp);
          });
          const cope = mergedBoxes(t, copeP, 0x5f4023, { tex: 'wood', rough: 0.93 });
          cope.castShadow = true;
          cope.receiveShadow = true;
          g.add(cope);
          // the sheet: a real animated water ribbon across the pool, read
          // THROUGH to the graded bed below. amp 0.18 keeps the swell inside
          // the 0.07 of freeboard the clearance budget left it.
          const sheetPts: { p: THREE.Vector3; side: THREE.Vector3 }[] = [];
          for (let i = 0; i <= NB; i += 1) {
            const { c, sh } = flat(i);
            sheetPts.push({ p: new t.Vector3(c.x, SHEET, c.z), side: sh });
          }
          basinWater = buildWaterRibbon(t, sheetPts, HALF_W * 1.9, { amp: 0.18, waviness: 0.8, across: 6 });
          g.add(basinWater.mesh);
          // boulder rockwork along the rim — three tones, three sizes, seated
          // at their own radius so no two read as the same repeated blob
          for (let i = 0; i < 11; i += 1) {
            const A = flat(1 + Math.floor((i / 11) * (NB - 2)));
            const s = i % 2 ? 1 : -1;
            const r = 0.15 + 0.13 * Math.abs(Math.sin(i * 2.7));
            const tone = [0x8d887c, 0x6f6c63, 0x7d7a70][i % 3];
            const rk = ball(t, r, tone, [0, 0, 0], { tex: 'concrete', flat: true, rough: 1 });
            rk.position.set(A.c.x + A.sh.x * s * (HALF_W + r * 0.35), RIM - 0.06 + r * 0.55, A.c.z + A.sh.z * s * (HALF_W + r * 0.35));
            rk.scale.set(1 + 0.2 * Math.sin(i * 3.3), 0.7, 1);
            rk.rotation.y = i * 1.7;
            g.add(rk);
          }
          const reedP: MergedBoxSpec[] = [];
          for (let i = 0; i < 10; i += 1) {
            const A = flat(1 + Math.floor((i / 10) * (NB - 2)));
            const s = i % 2 ? -1 : 1;
            const base = new t.Vector3(A.c.x + A.sh.x * s * (HALF_W - 0.1), RIM - 0.06, A.c.z + A.sh.z * s * (HALF_W - 0.1));
            for (let b = 0; b < 4; b += 1) {
              const h = 0.2 + ((i * 7 + b * 13) % 5) * 0.05;
              const lean = 0.22 + ((i + b) % 3) * 0.13;
              const tip = base.clone().addScaledVector(A.sh, s * lean * h * 1.6).addScaledVector(A.fh, (b - 1.5) * 0.05).setY(base.y + h);
              const sp = strutSpec(t, base.clone().addScaledVector(A.fh, (b - 1.5) * 0.05), tip, 0.018, 0.018);
              if (sp) reedP.push(sp);
            }
          }
          const reeds = mergedBoxes(t, reedP, 0x5c7a3a, { tex: 'leaf', rough: 0.95 });
          reeds.castShadow = false;
          g.add(reeds);
        }

        // splash spray: foam balls that erupt as the log hits the run-out,
        // scattered ALONG the trough (across stays inside the 0.9 channel)
        const spray = new t.Group();
        spray.position.set(SPLASH_AT.x, splashWaterY + 0.05, SPLASH_AT.z);
        spray.rotation.y = Math.atan2(runF.fwd.x, runF.fwd.z);
        const foam: THREE.Mesh[] = [];
        for (let i = 0; i < 7; i++) {
          const a = i * 2.39; // golden-angle base, but jittered + elongated so it
          const rr = 0.16 + 0.5 * Math.abs(Math.sin(i * 12.9898)); // never reads as a ring
          const f = ball(t, 0.14 + 0.045 * ((i * 7) % 3), 0xeaf6fb, [Math.cos(a) * rr * 0.4, 0.08 + 0.09 * Math.abs(Math.sin(i * 4.7)), Math.sin(a) * rr * 1.1 + 0.06 * i], { rough: 0.4, opacity: 0.85 });
          f.scale.y = 0.7;
          spray.add(f);
          foam.push(f);
        }
        g.add(spray);
        // droplet spray on top of the foam: a ParticleKit emitter at the pool
        // entry — rate driven by the same proximity k each frame (0 when the
        // log is away), droplets arc up and fall under gravity
        const splashFx = buildEmitter(t, {
          max: 90,
          rate: 0,
          life: 0.65,
          lifeVar: 0.25,
          velocity: [0, 1.7, 0],
          spread: 1.15,
          gravity: 5.5,
          size: 0.075,
          sizeEnd: 0.14,
          color: 0xeaf6fb,
          colorEnd: 0xbfe0ee,
          opacity: 0.85,
        });
        splashFx.setOrigin(SPLASH_AT.x, splashWaterY + 0.1, SPLASH_AT.z);
        g.add(splashFx.points);

        // ------------------------------------------------------------------
        // THE STATION HOUSE.
        // Authored in a frame-aligned LOCAL BASIS: the group is yawed onto
        // frame 0, so inside it local +x is the frame's side vector and local
        // +z its forward — which means the whole building can be written in
        // plain axis-aligned boxes and still land square on any circuit,
        // stock or piece-composed. Deck inner edge at x 0.52 clears the
        // trough's rim rail (outer face 0.505); the canopy reaches back across
        // to x −0.35 so it roofs the boarding channel as well as the platform,
        // which is what makes a flume station read as a station.
        // ------------------------------------------------------------------
        const st = ride.frameAt(0);
        const yaw = Math.atan2(st.fwd.x, st.fwd.z);
        const sideH = new t.Vector3(st.side.x, 0, st.side.z).normalize();
        const stn = new t.Group();
        stn.position.set(st.p.x, 0, st.p.z);
        stn.rotation.y = yaw;
        g.add(stn);
        const DECK = st.p.y + 0.12; // platform top
        const XI = 0.52; // inner (channel-side) edge
        const XO = 2.0; // outer edge
        const XC = (XI + XO) / 2;
        const LZ = 1.45; // half-length along the frame

        // platform: deck slab, plank seams, skirt board, posts + knee braces
        stn.add(box(t, [XO - XI, 0.1, LZ * 2], 0x6b4626, [XC, DECK - 0.05, 0], { tex: 'wood', repeat: [3, 8], rough: 0.9 }));
        const seamP: MergedBoxSpec[] = [];
        for (let i = 0; i < 11; i += 1) seamP.push({ dims: [XO - XI - 0.04, 0.02, 0.03], pos: [XC, DECK + 0.005, -LZ + 0.12 + i * ((LZ * 2 - 0.24) / 10)] });
        stn.add(mergedBoxes(t, seamP, 0x593a1e, { tex: 'wood', rough: 0.92 }));
        const skirtP: MergedBoxSpec[] = [
          { dims: [XO - XI, 0.13, 0.05], pos: [XC, DECK - 0.15, -LZ], repeat: [4, 1] },
          { dims: [XO - XI, 0.13, 0.05], pos: [XC, DECK - 0.15, LZ], repeat: [4, 1] },
          { dims: [0.05, 0.13, LZ * 2], pos: [XO, DECK - 0.15, 0], repeat: [6, 1] },
          { dims: [0.05, 0.13, LZ * 2], pos: [XI, DECK - 0.15, 0], repeat: [6, 1] },
        ];
        stn.add(mergedBoxes(t, skirtP, 0x593a1e, { tex: 'wood', rough: 0.92 }));
        const postP: MergedBoxSpec[] = [];
        const braceP: MergedBoxSpec[] = [];
        [XI + 0.14, XO - 0.14].forEach((px) =>
          [-LZ + 0.2, 0, LZ - 0.2].forEach((pz) => {
            postP.push({ dims: [0.12, DECK - 0.1, 0.12], pos: [px, (DECK - 0.1) / 2, pz], repeat: [1, 3] });
            const top = new t.Vector3(px, DECK - 0.2, pz);
            [-1, 1].forEach((s) => {
              const sp = strutSpec(t, new t.Vector3(px, DECK * 0.42, pz), new t.Vector3(px + (px < XC ? 0.3 : -0.3), top.y, pz + s * 0.02), 0.06, 0.06);
              if (sp) braceP.push(sp);
            });
          }),
        );
        stn.add(mergedBoxes(t, postP, 0x5a3d22, { tex: 'wood', rough: 1 }));
        stn.add(mergedBoxes(t, braceP, 0x4a3018, { tex: 'wood', rough: 1 }));

        // railing: outer edge + both ends, with a boarding gap on the channel
        // side. Posts, top rail, mid rail — all merged.
        const railP: MergedBoxSpec[] = [];
        for (let i = 0; i <= 8; i += 1) railP.push({ dims: [0.07, 0.62, 0.07], pos: [XO - 0.05, DECK + 0.31, -LZ + (i / 8) * LZ * 2], repeat: [1, 2] });
        [-1, 1].forEach((s) => {
          for (let i = 0; i <= 3; i += 1) railP.push({ dims: [0.07, 0.62, 0.07], pos: [XO - 0.05 - (i / 3) * (XO - XI - 0.35), DECK + 0.31, s * (LZ - 0.05)], repeat: [1, 2] });
        });
        [0.58, 0.34].forEach((ry) => {
          railP.push({ dims: [0.05, 0.05, LZ * 2], pos: [XO - 0.05, DECK + ry, 0], repeat: [1, 8] });
          [-1, 1].forEach((s) => railP.push({ dims: [XO - XI - 0.3, 0.05, 0.05], pos: [XC + 0.1, DECK + ry, s * (LZ - 0.05)], repeat: [4, 1] }));
        });
        stn.add(mergedBoxes(t, railP, 0x7a5230, { tex: 'wood', rough: 0.88 }));

        // canopy: four posts, a beam frame and a shingled gable roof spanning
        // the deck AND the boarding channel
        const CX0 = -0.35;
        const CX1 = XO + 0.12;
        const CXC = (CX0 + CX1) / 2;
        const EAVE = DECK + 1.62;
        const RIDGE = EAVE + 0.52;
        const canP: MergedBoxSpec[] = [];
        [XI + 0.1, XO - 0.02].forEach((px) =>
          [-LZ + 0.12, LZ - 0.12].forEach((pz) => canP.push({ dims: [0.13, EAVE - DECK, 0.13], pos: [px, DECK + (EAVE - DECK) / 2, pz], repeat: [1, 5] })),
        );
        [-LZ + 0.12, LZ - 0.12].forEach((pz) => canP.push({ dims: [CX1 - CX0, 0.12, 0.14], pos: [CXC, EAVE - 0.06, pz], repeat: [5, 1] }));
        [XI + 0.1, XO - 0.02].forEach((px) => canP.push({ dims: [0.12, 0.12, LZ * 2 + 0.3], pos: [px, EAVE - 0.06, 0], repeat: [1, 8] }));
        stn.add(mergedBoxes(t, canP, 0x6b4626, { tex: 'wood', rough: 0.9 }));
        // two slopes, each a deck plus staggered courses of shingle tabs
        const slopeAng = Math.atan2(RIDGE - EAVE, (CX1 - CX0) / 2);
        const slopeLen = Math.hypot(RIDGE - EAVE, (CX1 - CX0) / 2);
        [-1, 1].forEach((s, si) => {
          const slope = new t.Group();
          slope.position.set(CXC + s * (CX1 - CX0) / 4, (EAVE + RIDGE) / 2, 0);
          slope.rotation.z = -s * slopeAng;
          slope.add(box(t, [slopeLen + 0.1, 0.05, LZ * 2 + 0.42], 0x4d3a26, [0, 0, 0], { tex: 'wood', repeat: [4, 9], rough: 0.9 }));
          const tabs: MergedBoxSpec[] = [];
          const cols = 5;
          for (let c = 0; c < cols; c += 1) {
            const lx = -slopeLen / 2 + 0.1 + c * (slopeLen / cols);
            const stag = c % 2 ? 0.13 : 0;
            for (let i = 0; i < 11; i += 1) {
              const tz = -LZ - 0.14 + stag + i * ((LZ * 2 + 0.3) / 10);
              if (tz > LZ + 0.16) continue;
              tabs.push({ dims: [slopeLen / cols + 0.03, 0.026, (LZ * 2 + 0.3) / 10 + 0.02], pos: [lx, 0.038 - ((c * 7 + i * 13 + si * 5) % 4) * 0.004, tz], rotZ: ((c + i) % 3) * 0.012 });
            }
          }
          const shg = mergedBoxes(t, tabs, 0x7d4a34, { tex: 'concrete', rough: 0.9 });
          shg.castShadow = true;
          shg.receiveShadow = true;
          slope.add(shg);
          stn.add(slope);
        });
        stn.add(box(t, [0.16, 0.11, LZ * 2 + 0.5], 0x4d3a26, [CXC, RIDGE + 0.04, 0], { tex: 'wood', repeat: [1, 9], rough: 0.9 }));
        // gable boards with a scalloped valance at each end
        const gabP: MergedBoxSpec[] = [];
        [-1, 1].forEach((s) => {
          for (let i = 0; i < 7; i += 1) {
            const f0 = (i + 0.5) / 7;
            const gx = CX0 + f0 * (CX1 - CX0);
            const gy = EAVE + (RIDGE - EAVE) * (1 - Math.abs(2 * f0 - 1));
            gabP.push({ dims: [(CX1 - CX0) / 7 + 0.02, gy - EAVE + 0.16, 0.06], pos: [gx, (gy + EAVE - 0.16) / 2, s * (LZ + 0.2)], repeat: [1, 2] });
          }
          for (let i = 0; i < 12; i += 1) {
            const gx = CX0 + ((i + 0.5) / 12) * (CX1 - CX0);
            gabP.push({ dims: [(CX1 - CX0) / 12 - 0.02, 0.16 + (i % 2) * 0.07, 0.05], pos: [gx, EAVE - 0.22 - ((i % 2) * 0.07) / 2, s * (LZ + 0.2)] });
          }
        });
        stn.add(mergedBoxes(t, gabP, 0xa87444, { tex: 'wood', rough: 0.88 }));

        // operator booth at the far end of the platform
        const booth = new t.Group();
        booth.position.set(XO - 0.42, DECK, LZ - 0.52);
        stn.add(booth);
        booth.add(box(t, [0.72, 0.98, 0.78], 0x7d4a34, [0, 0.49, 0], { tex: 'wood', repeat: [3, 4], rough: 0.9 }));
        booth.add(box(t, [0.82, 0.07, 0.88], 0x4d3a26, [0, 1.0, 0], { tex: 'wood', repeat: [3, 3], rough: 0.9 }));
        booth.add(box(t, [0.06, 0.4, 0.56], 0x18242c, [-0.36, 0.66, 0], { rough: 0.35 })); // glazed hatch
        booth.add(box(t, [0.2, 0.05, 0.62], 0xa87444, [-0.44, 0.44, 0], { tex: 'wood', rough: 0.9 })); // counter shelf
        const leverP: MergedBoxSpec[] = [
          { dims: [0.1, 0.26, 0.08], pos: [-0.3, 0.6, -0.18], rotZ: 0.3 },
          { dims: [0.1, 0.26, 0.08], pos: [-0.3, 0.6, 0.02], rotZ: -0.22 },
        ];
        booth.add(mergedBoxes(t, leverP, 0x9aa0a8, { tex: 'metal', metal: 0.5, rough: 0.45 }));

        // hanging lanterns under the canopy + the component's ONE real light
        const deckBulbMats: THREE.MeshStandardMaterial[] = [];
        [-LZ + 0.55, 0.1, LZ - 0.55].forEach((pz, i) => {
          const lx = i === 1 ? 0.55 : XC;
          stn.add(cyl(t, 0.02, 0.02, 0.2, 0x4a3018, [lx, EAVE - 0.22, pz], { tex: 'wood', rough: 0.9, seg: 6 }));
          stn.add(box(t, [0.17, 0.05, 0.17], 0x3a2b1c, [lx, EAVE - 0.35, pz], { tex: 'wood', rough: 0.9 }));
          const bulb = ball(t, 0.055, 0xfff0c8, [lx, EAVE - 0.43, pz], { emissive: 0xffb45e, rough: 0.35 });
          (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15; // faint glass by day
          stn.add(bulb);
          deckBulbMats.push(bulb.material as THREE.MeshStandardMaterial);
        });
        const deckCentre = new t.Vector3().copy(st.p).addScaledVector(sideH, XC);
        const deckLamp = new t.PointLight(0xffb45e, 0, 4.5, 2);
        deckLamp.position.set(deckCentre.x, DECK + 1.1, deckCentre.z);
        g.add(deckLamp);

        // ------------------------------------------------------------------
        // THE FLEET. `run()` places a whole train from one head parameter, so
        // handing it three logs at spacing = total/3 spreads them evenly round
        // the circuit — one climbing the belt while one shoots the drop and
        // one sits in the station, which is what a flume looks like. A single
        // boat on a long circuit read as an empty ride.
        // ------------------------------------------------------------------
        const LOGS = 3;
        const logs: THREE.Group[] = [];
        for (let i = 0; i < LOGS; i += 1) logs.push(buildLog(t, scheme.vehicles[0], i === 0 ? 3 : 2));
        const boat = logs[0];
        extras.vehicle = boat; // lead log — RideViewer onboard/follow cam
        // wheelOffset 0.25: hull keel 0.05 above the trough floor — the gap
        // hides under the water strip (-0.02) while buying clearance for the
        // hull ends through the drop's vertical curvature.
        const run = ride.run(logs, { wheelOffset: 0.25, spacing: total / LOGS });
        return (time) => {
          run(time);
          flumeWater.update(time); // wave clock + uNight moonlight dim
          basinWater?.update(time);
          // spray erupts by proximity: full burst as a log crosses the pool
          let k = 0;
          for (const l of logs) {
            const d = Math.hypot(l.position.x - SPLASH_AT.x, l.position.z - SPLASH_AT.z);
            k = Math.max(k, Math.max(0, 1 - d / 1.25));
          }
          splashFx.setRate(k * 130); // droplet spray tracks the same proximity
          splashFx.update(time);
          foam.forEach((f, i) => {
            // staggered per-ball thresholds: the plume grows outward instead of
            // one simultaneous circle of foam popping in
            const ki = Math.max(0, k - 0.14 * ((i * 5) % 4));
            const pulse = 0.75 + 0.25 * Math.sin(time * 9 + i * 2.1);
            f.scale.setScalar(Math.max(0.02, ki * pulse));
            f.scale.y = Math.max(0.02, ki * pulse * 0.7);
          });
          // station lanterns + lift markers only after dark
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          deckLamp.intensity = 1.0 * ease;
          deckBulbMats.forEach((m) => (m.emissiveIntensity = 0.15 + 1.05 * ease));
          markerMats.forEach((m) => (m.emissiveIntensity = 0.12 + 1.1 * ease));
        };
      })(three, group) || undefined;
  return { group, update, ...extras };
}

const LogFlumeBase = composableRide(
  'LogFlume',
  (t, props: { pieces?: TrackPiece[] }) => buildLogFlumeScene(t, props),
  {
    // access geometry clears the stock loop's envelope (trough reaches z 3.05
    // + rim 0.5): queue HEAD 4.4 out the local +z front (entrance hut at
    // ~3.78), exit hut beside it — both outside the circuit
    front: 4.4,
    exit: [-1.9, 4.0],
    defaults: { name: 'Log Flume', capacity: 4, rideDuration: 12, intensity: 5, price: 4 },
  },
);

/** <LogFlume> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 4.4 out the local +z
 *  front (lane extending +z, clear of the trough loop), exit hut beside it at
 *  local [-1.9, 4.0], boarding at the base. Override with top-level props /
 *  `queue`. The lead log of the three-log fleet is exposed as the ride
 *  `vehicle` (RideViewer onboard cam); a FATAL pieces compile marks the build
 *  `invalid` so the chassis never registers a broken circuit.
 *  OPTIONAL track pieces (SETUP §5.1): a `pieces` array or piece children
 *  (`<Station/><Lift height={1.2}/><TurnL/><Drop/>` — children win) replace
 *  the stock loop with a compileTrackPieces circuit on the same 'flume'
 *  profile; defaults are unchanged when neither is given. */
export const LogFlume: React.FC<ComposableRideProps & { pieces?: TrackPiece[]; children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <LogFlumeBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
