import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildRideSpline, compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildWater, buildWaterRibbon } from '../WaterTile';
import { buildEmitter } from '../ParticleKit';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { rideColourPreset } from '../ColorKit';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// River rapids matched to the RCT2 RAPBOAT sprite, rebuilt on SplineRideKit:
// RCT2 rapids are a TRACKED ride built from channel pieces, so the course is a
// closed meandering loop — the 'rapids' profile sweeps the rocky boulder-lined
// channel with its water strip, a conveyor lift climbs out of the low pool
// straight, a high meander winds along the back and a small drop falls back to
// a splash pond. The round raft is placed by run(); its spin and bob are
// layered ON TOP of that placement each frame.
//
// THE STRUCTURES THIS COMPONENT OWNS (the channel itself is the compiled
// SplineRideKit circuit, which it must not and does not touch):
//
//  1. THE RAFT.  Was a `TorusGeometry` ring with two cylinders threaded on it
//     — one perfectly uniform doughnut, which is why the boat read as a rubber
//     ring with a lid rather than as an inflatable. `buildRapidsRaft()` now
//     LOFTS the tube as a surface whose radius PULSES six times round the ring
//     (the six air chambers of a real rapids boat), lofts a fabric FLOOR that
//     SAGS under the riders instead of being a flat disc, and hangs a scalloped
//     grab handline off twelve D-rings. Every small part — chamber seams,
//     rubbing strake, handline, seat pans — is placed FROM ITS TWO ENDPOINTS
//     and merged, so the whole boat is 12 draws for 6 riders.
//  2. THE ROCK BANK.  The kit lines the channel with one flattened grey sphere
//     every 7 frames, all the same size and the same two tones: at any
//     distance that is the same pebble repeated 46 times. A second, coarser
//     bank is added OUTSIDE it — boulders across a 3× size range in five
//     tones, seated on the GROUND rather than on the track, so the low reaches
//     get a real gorge bank and the trestled high reaches stay clean — plus
//     gravel, grass tufts and driftwood.
//  3. THE STATION HOUSE and TWO BANK CASCADES (lofted falling sheets that
//     spill over the channel wall into the flow, with foam piles where they
//     land) — the two things that turned "a channel in a lawn" into a ride.
// ---------------------------------------------------------------------------

// SplineCoaster's own sampling constants, restated because the bank dressing
// has to be able to land on the SAME frames the kit's own supports used.
const FRAMES_N = 320;

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
 * ENDPOINT PLACEMENT — a box of section `th × tw` spanning a → b. The rotation
 * that carries local +x onto (b − a) is not expressible as an rotX/rotY/rotZ
 * triple, so it is built as a quaternion and baked into the spec's `matrix`.
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
 * THE RAPIDS BOAT — a lofted inflatable, not a torus.
 *
 * A `TorusGeometry` is a surface of revolution with a CONSTANT tube radius, so
 * whatever colour it is painted it reads as one smooth doughnut; the six
 * "seats" were the only thing breaking its symmetry. A real rapids boat is
 * six SEPARATE AIR CHAMBERS welded into a ring, and that scallop — a bulge per
 * chamber with a seam pinched between — is its entire silhouette.
 *
 * So the tube is lofted from a radius that pulses six times round the ring
 * (`tubeR`), the floor is lofted as a surface that SAGS toward the middle
 * (a taut disc is a lid; a boat floor bows under its riders), and the handline
 * hangs in twelve catenary scallops off D-rings on the outer shoulder. The
 * envelope is TIGHTER than the ring it replaces — outer radius 0.452 against
 * the old 0.455, with the channel walls' inner faces at 0.48 — so every
 * clearance the course was verified against still holds.
 *
 * Faces +z; `body`/`trim` take the RCT2 VehicleColour pair.
 */
export function buildRapidsRaft(
  t: typeof THREE,
  body: number,
  trim: number,
  opts: { riders?: number } = {},
): THREE.Group {
  const raft = new t.Group();
  const RR = 0.358; // ring centreline radius
  const TUBE = 0.0832; // mean tube radius
  const CHAMBERS = 6;
  const TY = 0.094; // ring axis height — the fattest chamber bottoms at y = 0
  /** the six-chamber scallop: fattest at a chamber's middle, pinched at a seam */
  const tubeR = (th: number) => TUBE * (1 - 0.13 * Math.cos(CHAMBERS * th));
  /** a point on the tube surface: φ = 0 outer equator, π/2 top */
  const tubePt = (th: number, ph: number, grow = 0) => {
    const rr = tubeR(th) + grow;
    const cr = RR + Math.cos(ph) * rr;
    return new t.Vector3(Math.cos(th) * cr, TY + Math.sin(ph) * rr, Math.sin(th) * cr);
  };

  // ---- 1. the tube: one lofted surface, closed both ways ----
  const NTH = 48;
  const NPH = 12;
  const tubeRows: THREE.Vector3[][] = [];
  for (let i = 0; i <= NTH; i += 1) {
    const th = (i / NTH) * Math.PI * 2;
    const row: THREE.Vector3[] = [];
    for (let j = 0; j <= NPH; j += 1) row.push(tubePt(th, (j / NPH) * Math.PI * 2));
    tubeRows.push(row);
  }
  // DoubleSide: `loftRows` winds each quad (row, row+1, col+1), so on a torus
  // walked (theta, phi) the face normal comes out as rowDir × colDir = −outward
  // and a FrontSide tube would show the inside of its far wall. DoubleSide
  // renders both and lets the shader flip the normal per fragment, so the
  // lighting is right whichever face wins the depth test.
  const tubeMat = mat(t, body, { tex: 'plastic', repeat: [10, 2], rough: 0.72 });
  tubeMat.side = t.DoubleSide;
  const tube = new t.Mesh(loftRows(t, tubeRows), tubeMat);
  tube.castShadow = true;
  tube.receiveShadow = true;
  raft.add(tube);

  // ---- 2. the floor: a SAGGING fabric disc, not a flat lid ----
  const floorY = (r: number) => 0.19 - 0.085 * (1 - Math.pow(r / RR, 2));
  const floorRows: THREE.Vector3[][] = [];
  for (let i = 0; i <= 8; i += 1) {
    const r = (i / 8) * (RR + 0.01);
    const row: THREE.Vector3[] = [];
    for (let j = 0; j <= 32; j += 1) {
      const th = (j / 32) * Math.PI * 2;
      row.push(new t.Vector3(Math.cos(th) * r, floorY(Math.min(r, RR)), Math.sin(th) * r));
    }
    floorRows.push(row);
  }
  const floorMat = mat(t, 0x2a2c31, { tex: 'fabric', repeat: [6, 6], rough: 0.95 });
  floorMat.side = t.DoubleSide;
  const floor = new t.Mesh(loftRows(t, floorRows), floorMat);
  floor.receiveShadow = true;
  raft.add(floor);

  // ---- 3. chamber seams + rubbing strake + D-rings + handline (merged) ----
  const seamP: MergedBoxSpec[] = [];
  for (let c = 0; c < CHAMBERS; c += 1) {
    const th = (Math.PI / CHAMBERS) * (2 * c + 1); // cos(6θ) = −1 → the pinch
    for (let k = 0; k < 9; k += 1) {
      const a = tubePt(th, -1.0 + (k / 9) * 3.9, 0.004);
      const b = tubePt(th, -1.0 + ((k + 1) / 9) * 3.9, 0.004);
      const sp = strutSpec(t, a, b, 0.03, 0.05);
      if (sp) seamP.push(sp);
    }
  }
  raft.add(mergedBoxes(t, seamP, new t.Color(body).multiplyScalar(0.66).getHex(), { tex: 'plastic', rough: 0.75 }));
  // black rubber rubbing strake round the outer equator
  const strakeP: MergedBoxSpec[] = [];
  for (let i = 0; i < 40; i += 1) {
    const a = tubePt((i / 40) * Math.PI * 2, 0, 0.003);
    const b = tubePt(((i + 1) / 40) * Math.PI * 2, 0, 0.003);
    const sp = strutSpec(t, a, b, 0.032, 0.03);
    if (sp) strakeP.push(sp);
  }
  raft.add(mergedBoxes(t, strakeP, 0x17171b, { tex: 'plastic', rough: 0.85 }));
  // the handline: twelve D-rings on the upper-outer shoulder with the rope
  // hanging in a scallop between each pair (three segments a span, sagging out
  // and down) — the detail that says "inflatable" from any angle
  const ringP: MergedBoxSpec[] = [];
  const ropeP: MergedBoxSpec[] = [];
  const anchor = (i: number) => tubePt((i / 12) * Math.PI * 2, 0.62, 0.006);
  for (let i = 0; i < 12; i += 1) {
    const p = anchor(i);
    ringP.push({ dims: [0.05, 0.03, 0.05], pos: [p.x, p.y, p.z] });
    const q = anchor(i + 1);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 3; k += 1) {
      const f = k / 3;
      const m = p.clone().lerp(q, f);
      const sag = Math.sin(Math.PI * f);
      const rad = Math.hypot(m.x, m.z) || 1;
      pts.push(new t.Vector3(m.x * (1 + (0.035 * sag) / rad), m.y - 0.038 * sag, m.z * (1 + (0.035 * sag) / rad)));
    }
    for (let k = 0; k < 3; k += 1) {
      const sp = strutSpec(t, pts[k], pts[k + 1], 0.018, 0.018);
      if (sp) ropeP.push(sp);
    }
  }
  raft.add(mergedBoxes(t, ringP, 0x9aa0a8, { tex: 'metal', metal: 0.55, rough: 0.4 }));
  raft.add(mergedBoxes(t, ropeP, 0xd8ccb4, { tex: 'fabric', rough: 0.95 }));

  // ---- 4. centre console: padded column, grab hoop, pennant ----
  raft.add(cyl(t, 0.13, 0.17, 0.2, body, [0, 0.29, 0], { tex: 'plastic', repeat: [6, 1], rough: 0.6, seg: 16 }));
  raft.add(cyl(t, 0.15, 0.15, 0.035, 0x17171b, [0, 0.4, 0], { tex: 'plastic', rough: 0.8, seg: 16 }));
  const hoopP: MergedBoxSpec[] = [];
  for (let i = 0; i < 14; i += 1) {
    const a0 = (i / 14) * Math.PI * 2;
    const a1 = ((i + 1) / 14) * Math.PI * 2;
    const sp = strutSpec(
      t,
      new t.Vector3(Math.cos(a0) * 0.145, 0.46, Math.sin(a0) * 0.145),
      new t.Vector3(Math.cos(a1) * 0.145, 0.46, Math.sin(a1) * 0.145),
      0.022,
      0.022,
    );
    if (sp) hoopP.push(sp);
  }
  [0, Math.PI * 0.66, Math.PI * 1.33].forEach((a) =>
    hoopP.push({ dims: [0.024, 0.07, 0.024], pos: [Math.cos(a) * 0.145, 0.425, Math.sin(a) * 0.145] }),
  );
  raft.add(mergedBoxes(t, hoopP, 0x9aa0a8, { tex: 'metal', metal: 0.55, rough: 0.4 }));

  // ---- 5. six inward-facing seats, pans and backs merged ----
  // THE BACKREST HAD TO SHRINK. Riders sit round the tube facing IN (the
  // RAPBOAT arrangement), so the backrests are on the OUTSIDE of the ring and
  // are the first thing an outside camera sees. At 0.16 tall on a 0.72-wide
  // boat, in the livery's bright trim colour, six of them formed a ring of
  // yellow billboards whose top edge landed at y 0.34 — dead level with the
  // riders' heads at 0.33. From any angle outside the boat you saw the seats
  // and none of the people in them. The panel is now 0.09 tall in dark
  // upholstery with the trim reduced to a capping rail, and the riders sit
  // 0.03 higher, so heads and shoulders clear it.
  const panP: MergedBoxSpec[] = [];
  const backP: MergedBoxSpec[] = [];
  const capP: MergedBoxSpec[] = [];
  const riders = opts.riders ?? 6;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const m = new t.Matrix4().makeRotationY(-a - Math.PI / 2);
    const seatPos = new t.Vector3(Math.cos(a) * 0.26, 0.2, Math.sin(a) * 0.26);
    const at = (dx: number, dy: number, dz: number) => {
      const mm = m.clone();
      mm.setPosition(seatPos.clone().add(new t.Vector3(dx, dy, dz).applyMatrix4(m)));
      return mm;
    };
    panP.push({ dims: [0.22, 0.035, 0.16], matrix: at(0, 0.01, 0.0) });
    backP.push({ dims: [0.21, 0.09, 0.042], matrix: at(0, 0.035, -0.098) });
    capP.push({ dims: [0.225, 0.028, 0.055], matrix: at(0, 0.094, -0.098) });
  }
  raft.add(mergedBoxes(t, panP, 0x1f2228, { tex: 'fabric', rough: 0.95 }));
  raft.add(mergedBoxes(t, backP, 0x24262b, { tex: 'fabric', repeat: [2, 1], rough: 0.9 }));
  raft.add(mergedBoxes(t, capP, trim, { rough: 0.55 }));
  for (let i = 0; i < riders; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const seat = new t.Group();
    seat.position.set(Math.cos(a) * 0.26, 0.2, Math.sin(a) * 0.26);
    seat.rotation.y = -a - Math.PI / 2;
    const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[i % SHIRTS.length], seated: true, expression: i % 2 ? 'happy' : 'surprised' });
    p.group.scale.setScalar(0.26);
    p.group.position.set(0, -0.1, -0.025); // hips on the pan, back on the rest
    p.group.userData.lodDetail = true; // the park runtime sheds riders past NEAR
    seat.add(p.group);
    raft.add(seat);
  }
  return raft;
}

export function buildRiverRapidsScene(
  three: typeof THREE,
  opts: { pieces?: TrackPiece[] } = {},
): { group: THREE.Group; update?: (time: number) => void; vehicle?: THREE.Object3D; invalid?: boolean } {
  const group = new three.Group();
  // sim extras picked up by <ConfigurableRide>: `vehicle` = the raft
  // (RideViewer onboard/follow cam), `invalid` = fatal pieces compile
  const extras: { vehicle?: THREE.Object3D; invalid?: boolean } = {};
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // seeded RCT2 water scheme: white/black/darkBrown — THE River Rapids
        // preset (RiverRapids.h:54) — with `main` warmed off pure white to a
        // pale weathered limestone, and `supports` moved from the preset's
        // darkBrown to the same darkBrown the trestle timber uses elsewhere.
        // Pure white swept over a 40-unit channel read as a plastic gutter with
        // no material in it; too grey and it disappears into the rock bank
        // added below. `additional` is unused by the 'rapids' profile (the
        // channel takes `main` for the floor and shade(main, 0.87) for the
        // walls), so it keeps the preset's black.
        const scheme = rideColourPreset(22, 'water');
        scheme.track = { main: 0xdcd5c2, additional: 0x2b2b2b, supports: 0x5f4023 };
        const RAFT = scheme.vehicles[0].body; // raft tube + console
        const SEATC = scheme.vehicles[0].trim; // seat backs
        const WATER_Y = -0.04; // channel water strip vs the centreline

        // closed loop (~7 x 4.5 footprint), SIMPLIFIED to a clean realistic
        // course: one straight low station reach, the conveyor lift up the
        // east side, ONE broad high back sweep (no wiggly meanders), then a
        // gradual west descent and the small drop home to the pond. Constant
        // channel width comes from the profile; the wide, evenly-spaced
        // control points keep curvature smooth (validateSpline clean, no
        // kinks). The station straight rides at y 0.22+ so the channel's
        // underside (-0.12) clears the sunken splash-pond basin (top 0.06).
        const LAYOUT: [number, number, number][] = [
          [-2.4, 0.22, 2.1], // low station straight...
          [0.4, 0.22, 2.1], // ...dead straight along the south
          [2.7, 0.55, 1.4], // conveyor lift climbs...
          [3.4, 0.95, -0.3], // ...to the crest
          [2.2, 0.95, -1.9], // high back sweep begins
          [-0.6, 0.85, -2.2], // one broad meander along the back
          [-2.8, 0.7, -1.4], // west descent
          [-3.55, 0.42, 0.1], // falling home, swung wide...
          [-3.35, 0.26, 1.3], // ...so the drop eases into the pond (min bend radius 1.11)
        ];
        // optional `pieces` swap the LAYOUT for a compileTrackPieces circuit
        // (auto-closed + validated) on the same 'rapids' profile — the ribbon
        // water, foam, markers and deck all derive from frame scans below
        let layoutPts = LAYOUT;
        if (opts.pieces) {
          const compiled = compileTrackPieces(opts.pieces, { profile: 'rapids', start: [0, 0.3, 0] });
          layoutPts = compiled.points;
          if (compiled.report.fatal) extras.invalid = true;
        }
        const ride = buildRideSpline(t, layoutPts, { profile: 'rapids', waterY: WATER_Y, colours: scheme.track, vehicleSchemes: scheme.vehicles });
        g.add(ride.group);

        // MASONRY COPING on the channel wall tops. The profile's walls are two
        // swept ribbons — one continuous 0.34-tall surface a side, which reads
        // as a moulded plastic gutter however it is tinted, because nothing on
        // it has a size. A capping course of stone blocks gives the channel a
        // unit of measure: alternating long/short blocks, each seated 0.02
        // outboard and lifted 0.02 proud, placed FROM THE TWO FRAME POINTS it
        // spans so it follows the curve, plus a deterministic per-block height
        // jitter so the course is laid and not extruded. One merged mesh.
        const copeP: MergedBoxSpec[] = [];
        for (let i = 0; i < FRAMES_N; i += 5) {
          const f0 = ride.frameAt(i / FRAMES_N);
          const f1 = ride.frameAt(((i + 5) % FRAMES_N) / FRAMES_N);
          const long = (i / 5) % 3 !== 2;
          [-1, 1].forEach((s) => {
            // seated so the block's INNER face lands exactly on the wall plane
            // (|side| 0.48) and the whole course overhangs OUTWARD — nothing
            // may reach back over the channel, where the raft's 0.452 envelope
            // and its riders' shoulders pass
            const off = 0.56;
            const lift = 0.225 + ((i * 7 + (s > 0 ? 3 : 0)) % 3) * 0.006;
            const a = f0.p.clone().addScaledVector(f0.side, s * off).addScaledVector(f0.up, lift);
            const b = f1.p.clone().addScaledVector(f1.side, s * off).addScaledVector(f1.up, lift);
            const sp = strutSpec(t, a, b, long ? 0.075 : 0.095, long ? 0.15 : 0.18, [2, 1]);
            if (sp) copeP.push(sp);
          });
        }
        const coping = mergedBoxes(t, copeP, 0xb2a992, { tex: 'concrete', rough: 0.95 });
        coping.castShadow = true;
        coping.receiveShadow = true;
        g.add(coping);

        // channel edge markers: emissive-only amber beads standing on the
        // COPING (course top +0.2625, so the beads ride at +0.30 — they used to
        // sit at +0.25 on the bare wall and would now be half-buried in the
        // stone), alternating sides around the loop like navigation lights.
        // No real lights here.
        const markerMats: THREE.MeshStandardMaterial[] = [];
        for (let i = 0; i < 16; i++) {
          const f = ride.frameAt(i / 16);
          const s = i % 2 ? 1 : -1;
          const m = ball(t, 0.028, 0xffe9b0, [0, 0, 0], { emissive: 0xffb45e, rough: 0.35 });
          m.position.copy(f.p).addScaledVector(f.side, s * 0.56).addScaledVector(f.up, 0.3);
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12; // faint by day
          g.add(m);
          markerMats.push(m.material as THREE.MeshStandardMaterial);
        }

        // REAL shader water through the channel: ONE continuous water ribbon
        // following the spline (the old 16 overlapping buildWater sheets read
        // as seamed patchwork). Positions come from frameAt samples riding
        // 0.055 above the profile's flat strip (which stays beneath as the
        // opaque backing — the shader water is transparent, depthWrite off);
        // width 0.8 stays just inside the walls (inner faces ±0.48). amp 0.16
        // calms open-water swell to channel chop: crests (+0.063) stay under
        // the wall tops (+0.22), troughs (-0.033) stay above the backing strip.
        const RIBBON_N = 220;
        const ribbonPts: { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[] = [];
        for (let k = 0; k < RIBBON_N; k++) {
          const f = ride.frameAt(k / RIBBON_N);
          ribbonPts.push({ p: f.p.clone().addScaledVector(f.up, WATER_Y + 0.055), side: f.side.clone(), up: f.up.clone() });
        }
        ribbonPts.push({ ...ribbonPts[0] }); // close the loop watertight
        const channelWater = buildWaterRibbon(t, ribbonPts, 0.8, { amp: 0.16 });
        g.add(channelWater.mesh);

        // white-water foam: SUBTLE — fewer, thinner patches straddling the
        // shader water, skipped on the conveyor climb, with only a mild swell
        // at the drop (all corners stay on the 0.76-wide strip). MERGED.
        const foamP: MergedBoxSpec[] = [];
        for (let i = 0; i < 16; i++) {
          const f = ride.frameAt(i / 16 + 0.03);
          if (f.fwd.y > 0.15) continue; // no churn riding the lift belt
          const sc = f.fwd.y < -0.05 ? 1.15 : 1; // gentle churn at the drop
          const m4 = new t.Matrix4().makeBasis(f.side, f.up, f.fwd);
          m4.multiply(new t.Matrix4().makeRotationY(Math.sin(i * 7.3) * 0.35));
          m4.setPosition(f.p.clone().addScaledVector(f.up, WATER_Y + 0.045).addScaledVector(f.side, Math.sin(i * 3.9) * 0.1));
          foamP.push({ dims: [0.34 * sc, 0.012, 0.15 * sc], matrix: m4 });
        }
        const foamMesh = mergedBoxes(t, foamP, 0xe4f4f9, { rough: 0.4, opacity: 0.5 });
        foamMesh.castShadow = false;
        g.add(foamMesh);

        // churn spray at the drop: find the steepest descending frame
        // (deterministic scan) and park a ParticleKit droplet emitter on its
        // water line — a gentle constant simmer that surges as the raft
        // shoots the drop
        let dropU = 0;
        let steep = 0;
        for (let i = 0; i < 200; i++) {
          const f = ride.frameAt(i / 200);
          if (f.fwd.y < steep) {
            steep = f.fwd.y;
            dropU = i / 200;
          }
        }
        const dropF = ride.frameAt(dropU);
        const churnAt = new t.Vector3().copy(dropF.p).addScaledVector(dropF.up, WATER_Y + 0.08);
        const churnFx = buildEmitter(t, {
          max: 80,
          rate: 26,
          life: 0.55,
          lifeVar: 0.2,
          velocity: [0, 1.2, 0],
          spread: 0.8,
          gravity: 5,
          size: 0.06,
          sizeEnd: 0.11,
          color: 0xe8f5fa,
          colorEnd: 0xbcdcec,
          opacity: 0.8,
        });
        churnFx.setOrigin(churnAt.x, churnAt.y, churnAt.z);
        g.add(churnFx.points);

        // ------------------------------------------------------------------
        // THE ROCK BANK.
        // The kit's own boulder line is ONE flattened sphere every 7 frames at
        // a fixed 0.51 + r offset, in two tones a few percent apart: 46 copies
        // of the same pebble, which is exactly what the noon render showed.
        // This is a COARSER bank outside it — five tones, radii across a 3×
        // range, each boulder rotated and squashed on its own hash — seated on
        // the GROUND (y = 0) rather than on the track, so it only appears where
        // the channel actually runs near grade. On the trestled high reaches
        // there is no bank to build and none is built.
        // ------------------------------------------------------------------
        const NEAR_GRADE = 0.62; // channel centreline height that still has a bank
        // five tones spread across VALUE and HUE, not five near-identical
        // greys: warm sandstone, cold slate, mid granite, bleached and dark
        const TONES = [0x9a8f79, 0x585a5f, 0x7d7a70, 0xb0a894, 0x4a463f];
        const hash = (n: number) => {
          const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
          return x - Math.floor(x);
        };
        const bankRocks: { p: THREE.Vector3; r: number }[] = [];
        for (let i = 0; i < FRAMES_N; i += 9) {
          const f = ride.frameAt(i / FRAMES_N);
          if (f.p.y > NEAR_GRADE) continue;
          [-1, 1].forEach((s, si) => {
            const h = hash(i * 3.1 + si * 17.7);
            if (h < 0.28) return; // gaps: an unbroken rock wall is its own uniformity
            const r = 0.13 + 0.29 * h;
            const out = 0.98 + hash(i + si * 5.3) * 0.72;
            const p = new t.Vector3(f.p.x + f.side.x * s * out, r * 0.42, f.p.z + f.side.z * s * out);
            bankRocks.push({ p, r });
            const rk = ball(t, r, TONES[Math.floor(hash(i * 7.7 + si) * 5) % 5], [p.x, p.y, p.z], { tex: 'concrete', flat: true, rough: 1 });
            rk.scale.set(1 + 0.35 * hash(i + 1.3), 0.62 + 0.3 * hash(i + 2.9), 1 + 0.3 * hash(i + 4.1));
            rk.rotation.set(0, hash(i * 1.9 + si) * 6.28, 0.1 * (hash(i * 2.7) - 0.5));
            g.add(rk);
          });
        }
        // gravel + grass tufts + driftwood between the boulders, all merged
        const gravelP: MergedBoxSpec[] = [];
        const tuftP: MergedBoxSpec[] = [];
        const woodP: MergedBoxSpec[] = [];
        bankRocks.forEach((br, n) => {
          for (let k = 0; k < 3; k += 1) {
            const a = hash(n * 5.1 + k) * 6.283;
            const d = br.r + 0.08 + hash(n + k * 2.3) * 0.3;
            const gx = br.p.x + Math.cos(a) * d;
            const gz = br.p.z + Math.sin(a) * d;
            gravelP.push({ dims: [0.09 + 0.06 * hash(n + k), 0.045, 0.08 + 0.05 * hash(n * 2 + k)], pos: [gx, 0.018, gz], rotY: a });
          }
          if (hash(n * 11.3) < 0.45) {
            const bx = br.p.x + (hash(n * 3.7) - 0.5) * 0.5;
            const bz = br.p.z + (hash(n * 4.9) - 0.5) * 0.5;
            for (let k = 0; k < 5; k += 1) {
              const h = 0.14 + hash(n * 6.1 + k) * 0.16;
              const lean = 0.3 + hash(n + k * 3.3) * 0.5;
              const a = hash(n * 2.1 + k) * 6.283;
              const base = new t.Vector3(bx + Math.cos(a) * 0.04, 0.01, bz + Math.sin(a) * 0.04);
              const sp = strutSpec(t, base, new t.Vector3(base.x + Math.cos(a) * lean * h, h, base.z + Math.sin(a) * lean * h), 0.016, 0.016);
              if (sp) tuftP.push(sp);
            }
          }
          if (hash(n * 19.7) < 0.14) {
            // a bleached driftwood spar wedged against the boulder
            const a = hash(n * 8.3) * 6.283;
            const l = 0.5 + hash(n * 9.1) * 0.5;
            const p0 = new t.Vector3(br.p.x + Math.cos(a) * 0.2, 0.05, br.p.z + Math.sin(a) * 0.2);
            const p1 = new t.Vector3(p0.x + Math.cos(a + 1.1) * l, 0.05 + br.r * 0.7, p0.z + Math.sin(a + 1.1) * l);
            const sp = strutSpec(t, p0, p1, 0.07, 0.07, [3, 1]);
            if (sp) woodP.push(sp);
          }
        });
        if (gravelP.length) {
          const gr = mergedBoxes(t, gravelP, 0x8a8578, { tex: 'concrete', rough: 1 });
          gr.castShadow = false;
          g.add(gr);
        }
        if (tuftP.length) {
          const tu = mergedBoxes(t, tuftP, 0x5c7a3a, { tex: 'leaf', rough: 0.95 });
          tu.castShadow = false;
          g.add(tu);
        }
        if (woodP.length) g.add(mergedBoxes(t, woodP, 0xa39781, { tex: 'wood', rough: 0.95 }));

        // ------------------------------------------------------------------
        // TWO BANK CASCADES — water spilling over the channel wall into the
        // flow. Each is a LOFTED falling sheet (a curved surface that leaves
        // the lip almost horizontally and lands almost vertically, narrowing
        // as it accelerates — a flat translucent slab would just be a pane of
        // glass leaning on the wall), a stone spout above it, and a pile of
        // foam where it hits. Placed on the two near-grade frames furthest
        // from the station and from each other.
        // ------------------------------------------------------------------
        const cascadeMats: THREE.MeshStandardMaterial[] = [];
        [0.34, 0.66].forEach((u0, ci) => {
          // walk to the nearest near-grade frame so a cascade never hangs off
          // a trestled reach
          let u = u0;
          for (let k = 0; k < 40; k += 1) {
            const uu = u0 + (k % 2 ? 1 : -1) * Math.floor(k / 2) * 0.01;
            if (ride.frameAt(uu).p.y <= NEAR_GRADE) { u = uu; break; }
          }
          const f = ride.frameAt(u);
          if (f.p.y > NEAR_GRADE) return;
          const s = ci ? 1 : -1;
          const sh = new t.Vector3(f.side.x, 0, f.side.z).normalize();
          const along = new t.Vector3(f.fwd.x, 0, f.fwd.z).normalize();
          const lipY = f.p.y + 0.46;
          const rows: THREE.Vector3[][] = [];
          const NF = 10;
          for (let i = 0; i <= NF; i += 1) {
            const k = i / NF;
            // out: leaves the lip, then falls straight; wide at the lip,
            // pinched as it accelerates
            const outD = 0.52 - 0.30 * Math.pow(k, 0.55);
            const yy = lipY - (lipY - (f.p.y + WATER_Y + 0.04)) * Math.pow(k, 1.7);
            const halfW = 0.19 - 0.07 * k;
            const c = new t.Vector3(f.p.x + sh.x * s * outD, yy, f.p.z + sh.z * s * outD);
            rows.push([c.clone().addScaledVector(along, -halfW), c.clone().addScaledVector(along, halfW)]);
          }
          const fallMat = mat(t, 0xcfe8f2, { rough: 0.28, opacity: 0.6 });
          fallMat.side = t.DoubleSide;
          cascadeMats.push(fallMat);
          const fall = new t.Mesh(loftRows(t, rows), fallMat);
          fall.castShadow = false;
          g.add(fall);
          // the spout: a stone lip the water leaves from, plus a boulder cheek
          const lipP: MergedBoxSpec[] = [];
          const lipC = new t.Vector3(f.p.x + sh.x * s * 0.66, lipY - 0.05, f.p.z + sh.z * s * 0.66);
          lipP.push(strutSpec(t, lipC.clone().addScaledVector(along, -0.3), lipC.clone().addScaledVector(along, 0.3), 0.1, 0.34, [3, 1])!);
          g.add(mergedBoxes(t, lipP, 0x6f6c63, { tex: 'concrete', rough: 1 }));
          [-1, 1].forEach((cs) => {
            const r = 0.2 + 0.06 * cs;
            const p = lipC.clone().addScaledVector(along, cs * 0.4).addScaledVector(sh, s * 0.06);
            const rk = ball(t, r, cs > 0 ? 0x8d887c : 0x5f5c55, [p.x, p.y - 0.1, p.z], { tex: 'concrete', flat: true, rough: 1 });
            rk.scale.set(1.1, 0.9, 1);
            g.add(rk);
          });
          // foam pile where it lands
          for (let i = 0; i < 3; i += 1) {
            const p = new t.Vector3(f.p.x + sh.x * s * 0.22, f.p.y + WATER_Y + 0.06, f.p.z + sh.z * s * 0.22)
              .addScaledVector(along, (i - 1) * 0.11);
            const fb = ball(t, 0.1 + 0.03 * ((i * 5) % 3), 0xeaf6fb, [p.x, p.y, p.z], { rough: 0.4, opacity: 0.72 });
            fb.scale.y = 0.6;
            fb.castShadow = false;
            g.add(fb);
          }
        });

        // splash pond at the drop landing, SUNK below the crossing channel:
        // basin rim tops at 0.06 and the pond water at 0.05, both under the
        // channel's lowest underside (0.097 verified) — concrete basin +
        // shared WaterTile, tucked inside the drop run-out's curve. The pond
        // spot is tuned to the stock LAYOUT, so piece-composed circuits skip
        // it (their continuous channel water still churns at the drop).
        let water: ReturnType<typeof buildWater> | null = null;
        if (!opts.pieces) {
          const POND = new t.Vector3(-3.2, 0, 1.1);
          g.add(cyl(t, 1.28, 1.42, 0.14, 0x8a8578, [POND.x, -0.01, POND.z], { tex: 'concrete', rough: 0.95, seg: 36 }));
          g.add(cyl(t, 1.1, 1.1, 0.04, 0x1f8fd2, [POND.x, -0.01, POND.z], { rough: 0.35, seg: 36 })); // bright aqua pond floor (top 0.01) — read-through stays lagoon blue
          // amp 0.4 (x the 0.3 mesh squash = world swell ±0.037): crests
          // (0.087) stay under the crossing channel's underside (0.097) AND
          // troughs (0.013) stay above the pond floor top (0.01) — the old
          // full swell dipped through the floor and showed flat dead patches
          water = buildWater(t, 2.4, 70, 1.05, undefined, 0.4);
          water.mesh.position.set(POND.x, 0.05, POND.z);
          water.mesh.scale.z = 0.3;
          g.add(water.mesh);
        }

        // ------------------------------------------------------------------
        // THE STATION HOUSE.
        // Authored in a frame-aligned LOCAL BASIS (local +x = the frame's side
        // vector, +z its forward), so the whole building is plain axis-aligned
        // boxes and still lands square on any circuit. It sits on the OUTER
        // bank at x −1.25, keeping the same side and sign as the plank deck it
        // replaces, with the gangway still bridging in to the channel wall.
        // ------------------------------------------------------------------
        const st = ride.frameAt(0);
        const yaw = Math.atan2(st.fwd.x, st.fwd.z);
        const sideH = new t.Vector3(st.side.x, 0, st.side.z).normalize();
        const stn = new t.Group();
        stn.position.set(st.p.x, 0, st.p.z);
        stn.rotation.y = yaw;
        g.add(stn);
        const DECK = st.p.y + 0.2;
        const XI = -0.62; // inner (channel-side) edge — 0.14 clear of the wall
        const XO = -2.05; // outer edge
        const XC = (XI + XO) / 2;
        const LZ = 1.45;

        // stone piers under a planked deck: rapids stations are masonry
        const pierP: MergedBoxSpec[] = [];
        [XI + 0.2, XO + 0.2].forEach((px) =>
          [-LZ + 0.25, 0, LZ - 0.25].forEach((pz) => {
            pierP.push({ dims: [0.3, DECK - 0.06, 0.3], pos: [px, (DECK - 0.06) / 2, pz], repeat: [1, 3] });
            pierP.push({ dims: [0.4, 0.07, 0.4], pos: [px, 0.035, pz] });
          }),
        );
        stn.add(mergedBoxes(t, pierP, 0x9a9384, { tex: 'concrete', rough: 0.95 }));
        stn.add(box(t, [XI - XO, 0.1, LZ * 2], 0x6b4626, [XC, DECK - 0.05, 0], { tex: 'wood', repeat: [3, 8], rough: 0.9 }));
        const seamP2: MergedBoxSpec[] = [];
        for (let i = 0; i < 11; i += 1) seamP2.push({ dims: [XI - XO - 0.04, 0.02, 0.03], pos: [XC, DECK + 0.005, -LZ + 0.12 + i * ((LZ * 2 - 0.24) / 10)] });
        stn.add(mergedBoxes(t, seamP2, 0x593a1e, { tex: 'wood', rough: 0.92 }));
        // boarding gangway: a plank bridging the deck to the channel wall —
        // top a 5 mm step below the deck top (no coplanar overlap), inner edge
        // seated ON the wall top (+0.22); it stops at side -0.48, 0.025 clear
        // of the raft envelope
        stn.add(box(t, [0.42, 0.05, 1.5], 0x7a5230, [-0.54, DECK - 0.005, 0], { tex: 'wood', repeat: [1, 5], rough: 0.9 }));

        // railing along the outer edge + both ends, merged
        const railP: MergedBoxSpec[] = [];
        for (let i = 0; i <= 8; i += 1) railP.push({ dims: [0.07, 0.62, 0.07], pos: [XO + 0.05, DECK + 0.31, -LZ + (i / 8) * LZ * 2], repeat: [1, 2] });
        [-1, 1].forEach((s) => {
          for (let i = 0; i <= 3; i += 1) railP.push({ dims: [0.07, 0.62, 0.07], pos: [XO + 0.05 + (i / 3) * (XI - XO - 0.35), DECK + 0.31, s * (LZ - 0.05)], repeat: [1, 2] });
        });
        [0.58, 0.34].forEach((ry) => {
          railP.push({ dims: [0.05, 0.05, LZ * 2], pos: [XO + 0.05, DECK + ry, 0], repeat: [1, 8] });
          [-1, 1].forEach((s) => railP.push({ dims: [XI - XO - 0.3, 0.05, 0.05], pos: [XC - 0.1, DECK + ry, s * (LZ - 0.05)], repeat: [4, 1] }));
        });
        stn.add(mergedBoxes(t, railP, 0x7a5230, { tex: 'wood', rough: 0.88 }));

        // canopy: four posts, a beam frame and a shingled gable roof reaching
        // back over the boarding channel
        const CX0 = XO - 0.12;
        const CX1 = 0.4;
        const CXC = (CX0 + CX1) / 2;
        const EAVE = DECK + 1.6;
        const RIDGE = EAVE + 0.5;
        const canP: MergedBoxSpec[] = [];
        [XI - 0.06, XO + 0.02].forEach((px) =>
          [-LZ + 0.12, LZ - 0.12].forEach((pz) => canP.push({ dims: [0.13, EAVE - DECK, 0.13], pos: [px, DECK + (EAVE - DECK) / 2, pz], repeat: [1, 5] })),
        );
        [-LZ + 0.12, LZ - 0.12].forEach((pz) => canP.push({ dims: [CX1 - CX0, 0.12, 0.14], pos: [CXC, EAVE - 0.06, pz], repeat: [5, 1] }));
        [XI - 0.06, XO + 0.02].forEach((px) => canP.push({ dims: [0.12, 0.12, LZ * 2 + 0.3], pos: [px, EAVE - 0.06, 0], repeat: [1, 8] }));
        stn.add(mergedBoxes(t, canP, 0x6b4626, { tex: 'wood', rough: 0.9 }));
        const slopeAng = Math.atan2(RIDGE - EAVE, (CX1 - CX0) / 2);
        const slopeLen = Math.hypot(RIDGE - EAVE, (CX1 - CX0) / 2);
        [-1, 1].forEach((s, si) => {
          const slope = new t.Group();
          slope.position.set(CXC + (s * (CX1 - CX0)) / 4, (EAVE + RIDGE) / 2, 0);
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
          const shg = mergedBoxes(t, tabs, 0x4f6c52, { tex: 'concrete', rough: 0.9 });
          shg.castShadow = true;
          shg.receiveShadow = true;
          slope.add(shg);
          stn.add(slope);
        });
        stn.add(box(t, [0.16, 0.11, LZ * 2 + 0.5], 0x4d3a26, [CXC, RIDGE + 0.04, 0], { tex: 'wood', repeat: [1, 9], rough: 0.9 }));
        // gable boards with a scalloped valance, and a life-ring board
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
        stn.add(mergedBoxes(t, gabP, 0xc9c2b0, { tex: 'wood', rough: 0.88 }));
        const ringP2: MergedBoxSpec[] = [];
        for (let i = 0; i < 12; i += 1) {
          const a0 = (i / 12) * Math.PI * 2;
          const a1 = ((i + 1) / 12) * Math.PI * 2;
          const sp = strutSpec(
            t,
            new t.Vector3(XO + 0.14, DECK + 1.1 + Math.sin(a0) * 0.17, -LZ + 0.5 + Math.cos(a0) * 0.17),
            new t.Vector3(XO + 0.14, DECK + 1.1 + Math.sin(a1) * 0.17, -LZ + 0.5 + Math.cos(a1) * 0.17),
            0.07,
            0.07,
          );
          if (sp) ringP2.push(sp);
        }
        stn.add(mergedBoxes(t, ringP2, 0xd94b2a, { tex: 'plastic', rough: 0.7 }));

        // operator booth at the far end of the platform
        const booth = new t.Group();
        booth.position.set(XO + 0.44, DECK, LZ - 0.52);
        stn.add(booth);
        booth.add(box(t, [0.72, 0.98, 0.78], 0xa8a294, [0, 0.49, 0], { tex: 'concrete', repeat: [3, 4], rough: 0.92 }));
        booth.add(box(t, [0.84, 0.07, 0.9], 0x4d3a26, [0, 1.0, 0], { tex: 'wood', repeat: [3, 3], rough: 0.9 }));
        booth.add(box(t, [0.06, 0.4, 0.56], 0x18242c, [0.36, 0.66, 0], { rough: 0.35 })); // glazed hatch
        booth.add(box(t, [0.2, 0.05, 0.62], 0x7a5230, [0.44, 0.44, 0], { tex: 'wood', rough: 0.9 })); // counter shelf
        booth.add(mergedBoxes(t, [
          { dims: [0.1, 0.26, 0.08], pos: [0.3, 0.6, -0.18], rotZ: -0.3 },
          { dims: [0.1, 0.26, 0.08], pos: [0.3, 0.6, 0.02], rotZ: 0.22 },
        ], 0x9aa0a8, { tex: 'metal', metal: 0.5, rough: 0.45 }));

        // hanging lanterns under the canopy + the component's ONE real light
        const deckBulbMats: THREE.MeshStandardMaterial[] = [];
        [-LZ + 0.55, 0.1, LZ - 0.55].forEach((pz, i) => {
          const lx = i === 1 ? -0.5 : XC;
          stn.add(cyl(t, 0.02, 0.02, 0.2, 0x4a3018, [lx, EAVE - 0.22, pz], { tex: 'wood', rough: 0.9, seg: 6 }));
          stn.add(box(t, [0.17, 0.05, 0.17], 0x3a2b1c, [lx, EAVE - 0.35, pz], { tex: 'wood', rough: 0.9 }));
          const bulb = ball(t, 0.055, 0xfff0c8, [lx, EAVE - 0.43, pz], { emissive: 0xffb45e, rough: 0.35 });
          (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
          stn.add(bulb);
          deckBulbMats.push(bulb.material as THREE.MeshStandardMaterial);
        });
        const deckCentre = new t.Vector3().copy(st.p).addScaledVector(sideH, XC);
        const stLamp = new t.PointLight(0xffb45e, 0, 4.5, 2);
        stLamp.position.set(deckCentre.x, DECK + 1.1, deckCentre.z);
        g.add(stLamp);

        // the raft. run() drifts it down the channel (plunging on the drop);
        // wheelOffset -0.075 + the 0.01..0.035 bob keeps the tube bottom
        // between -0.065 and -0.04: always kissing the water strip (-0.04)
        const raft = buildRapidsRaft(t, RAFT, SEATC);
        extras.vehicle = raft; // the raft — RideViewer onboard/follow cam
        const runRaft = ride.run([raft], { wheelOffset: -0.075 });

        return (time) => {
          water?.update(time);
          channelWater.update(time); // the continuous channel ribbon
          runRaft(time); // run() places + orients the raft on the spline...
          // churn droplets: constant simmer, surging while the raft is on the drop
          const dRaft = Math.hypot(raft.position.x - churnAt.x, raft.position.z - churnAt.z);
          churnFx.setRate(26 + 110 * Math.max(0, 1 - dRaft / 1.1));
          churnFx.update(time);
          raft.rotateY(time * 0.9); // ...then the rapids spin
          raft.rotateZ(Math.sin(time * 4) * 0.04); // ...wallow
          raft.position.y += 0.01 + Math.abs(Math.sin(time * 5)) * 0.025; // ...and bob, never lifting off the water
          // station lamp + channel markers only after dark; the cascades lose
          // their daylight sheen so they read as moonlit water, not glass
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          stLamp.intensity = 1.0 * ease;
          deckBulbMats.forEach((m) => (m.emissiveIntensity = 0.15 + 1.05 * ease));
          markerMats.forEach((m) => (m.emissiveIntensity = 0.12 + 1.1 * ease));
          cascadeMats.forEach((m) => {
            m.roughness = 0.28 + 0.4 * ease;
            m.opacity = 0.6 - 0.16 * ease;
          });
        };
      })(three, group) || undefined;
  return { group, update, ...extras };
}

const RiverRapidsBase = composableRide(
  'RiverRapids',
  (t, props: { pieces?: TrackPiece[] }) => buildRiverRapidsScene(t, props),
  {
    // access geometry clears the stock course (station straight at z 2.1,
    // boarding deck out to z ~3.65): queue HEAD 4.4 out the local +z front,
    // exit hut beside it — both past the deck and channel walls
    front: 4.4,
    exit: [-1.7, 4.2],
    defaults: { name: 'River Rapids', capacity: 6, rideDuration: 12, intensity: 5, price: 4 },
  },
);

/** <RiverRapids> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 4.4 out the local +z
 *  front (lane extending +z, clear of the channel + boarding deck), exit hut
 *  beside it at local [-1.7, 4.2], boarding at the base. Override with
 *  top-level props / `queue`. The raft is exposed as the ride `vehicle`
 *  (RideViewer onboard cam); a FATAL pieces compile marks the build
 *  `invalid` so the chassis never registers a broken circuit.
 *  OPTIONAL track pieces (SETUP §5.1): a `pieces` array or piece children
 *  (children win) replace the stock course with a compileTrackPieces circuit
 *  on the same 'rapids' profile (the tuned splash pond is skipped — the
 *  channel churn still surges at the drop); defaults unchanged otherwise. */
export const RiverRapids: React.FC<ComposableRideProps & { pieces?: TrackPiece[]; children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <RiverRapidsBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
