import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, nightKOf } from '../Stage';
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
// steep drop into a flared splash run-out. The hollowed log boat of riders
// drifts at near-constant speed, plunges down the drop and kicks up a spray
// of foam as it hits the run-out. Deterministic, driven by the Stage clock.
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

/** CARVED log boat (hull radius 0.3, origin at barrel centre) with riders —
 *  construction ported from the reference "RC Park 3D" LogBoat: a lathe-
 *  profiled log with rounded bow AND stern, revolved with the top ~0.66 rad
 *  left OPEN, bark-ring detailing, pale cut-wood gunwale rails along the
 *  opening, a dark hollowed cockpit with bench seats and a chevron bow-wave
 *  plate at the waterline. Hull is 1.48 long nose-to-tail — the ends stay
 *  inside the 0.9-wide trough through every verified bend of the LAYOUT.
 *  Optional `scheme` (RCT2 VehicleColour, ride/VehicleColour.h:19-24):
 *  body → bark, trim → cut gunwale; omitted = today's bark/cream exactly.
 *  Exported for reuse (parks composing their own flume fleets). */
export function buildLog(t: typeof THREE, scheme?: VehicleScheme): THREE.Group {
  const boat = new t.Group();
  const BARK = scheme?.body ?? 0x8a5a28;
  const CUT = scheme?.trim ?? 0xe8cc80;
  const R = 0.3;
  const GAP = 0.66; // half-angle of the top opening (rad)
  // ---- the log itself: open-top lathe, bow at +z ----
  // profile (radius, along-length): rounded ends, full barrel amidships
  const prof = [
    [0.05, -0.74], [0.17, -0.67], [0.27, -0.52], [R, -0.32],
    [R, 0.32], [0.27, 0.52], [0.17, 0.67], [0.05, 0.74],
  ].map(([r, zz]) => new t.Vector2(r, zz));
  // lathe around +Y then rotX(π/2): axis → +z (bow), lathe φ=0 → -y, so the
  // 2π−2·GAP arc starting at φ = GAP leaves the opening centred on +y... the
  // arc must EXCLUDE φ = π (old -z → +y after the rotation): start π+GAP.
  const hullGeo = new t.LatheGeometry(prof, 16, Math.PI + GAP, Math.PI * 2 - GAP * 2);
  const hullMat = mat(t, BARK, { tex: 'wood', repeat: [6, 2], rough: 0.9 });
  hullMat.side = t.DoubleSide; // interior shows through the opening
  const hull = new t.Mesh(hullGeo, hullMat);
  hull.rotation.x = Math.PI / 2;
  hull.castShadow = true;
  hull.receiveShadow = true;
  boat.add(hull);
  // bark rings: darker growth bands proud of the barrel (reference's
  // alternating bark rings) — PARTIAL arcs sharing the hull's top opening so
  // no hoop ever crosses the open cockpit. hullROf follows the lathe profile
  // exactly (piecewise linear between its rings) so rings + gunwale lips hug
  // the hull through the end tapers.
  const hullROf = (zz: number) => {
    const a = Math.abs(zz);
    const segs: [number, number][] = [[0.32, R], [0.52, 0.27], [0.67, 0.17], [0.74, 0.05]];
    if (a <= segs[0][0]) return R;
    for (let k = 1; k < segs.length; k++) {
      if (a <= segs[k][0]) {
        const [a0, r0] = segs[k - 1];
        const [a1, r1] = segs[k];
        return r0 + ((a - a0) / (a1 - a0)) * (r1 - r0);
      }
    }
    return 0.05;
  };
  const ringMat = mat(t, 0x6b4520, { tex: 'wood', repeat: [6, 1], rough: 0.95 });
  ringMat.side = t.DoubleSide;
  [-0.38, 0.05, 0.42].forEach((zz) => {
    const rr = hullROf(zz) + 0.005;
    const ring = new t.Mesh(new t.CylinderGeometry(rr, rr, 0.05, 18, 1, true, Math.PI + GAP + 0.04, Math.PI * 2 - 2 * (GAP + 0.04)), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = zz;
    ring.castShadow = true;
    boat.add(ring);
  });
  // ---- bow + stern decks: the lathe's top opening runs the FULL hull
  // length, so beyond the cockpit floor box the bow/stern tapers were open
  // holes — low/side views looked straight into (and THROUGH) the hull.
  // Close each end with a cut-wood deck: a lathe band over the COMPLEMENTARY
  // arc (the 2·GAP opening), radius 0.97·hull so it sits just recessed
  // (no z-fighting), from past the end benches out to the tips ----
  const deckProf = [
    [0.285, 0.42],
    [0.27, 0.52],
    [0.17, 0.67],
    [0.05, 0.74],
  ].map(([r, zz]) => new t.Vector2(r * 0.97, zz));
  const deckGeo = new t.LatheGeometry(deckProf, 10, Math.PI - GAP, GAP * 2);
  const deckMat = mat(t, CUT, { tex: 'wood', repeat: [3, 2], rough: 0.85 });
  deckMat.side = t.DoubleSide;
  [1, -1].forEach((s) => {
    const deck = new t.Mesh(deckGeo, deckMat);
    deck.rotation.x = Math.PI / 2;
    deck.scale.z = s; // s=-1 mirrors the bow deck to the stern (DoubleSide handles winding)
    deck.castShadow = true;
    boat.add(deck);
  });
  // tip plugs: the lathe profile ends at r 0.05, leaving a small hole through
  // each tip — cap with bark knobs
  [-0.72, 0.72].forEach((zz) => {
    boat.add(ball(t, 0.06, BARK, [0, 0, zz], { tex: 'wood', rough: 0.9 }));
  });
  // ---- gunwale: pale cut-wood rim lips SWEPT along the opening edges ----
  // (tubes following x = ±sin(GAP)·r(z), y = cos(GAP)·r(z) — they hug the
  // hull edge through the bow/stern tapers instead of floating past them)
  const gunMat = mat(t, CUT, { tex: 'wood', repeat: [1, 6], rough: 0.8 });
  [-1, 1].forEach((s) => {
    const edge: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const zz = -0.66 + (i / 12) * 1.32;
      const rz = hullROf(zz);
      edge.push(new t.Vector3(s * Math.sin(GAP) * rz, Math.cos(GAP) * rz, zz));
    }
    const lip = new t.Mesh(new t.TubeGeometry(new t.CatmullRomCurve3(edge), 24, 0.032, 8), gunMat);
    lip.castShadow = true;
    boat.add(lip);
  });
  // ---- hollowed cockpit: dark recess (top face = the hollow floor, 0.09
  // below the rim) + 3 cut-wood bench seats with back lips ----
  boat.add(box(t, [0.36, 0.14, 1.12], 0x2a1c10, [0, 0.08, 0], { rough: 0.95 }));
  for (let i = 0; i < 3; i++) {
    const sz = -0.34 + i * 0.34;
    boat.add(box(t, [0.32, 0.05, 0.14], CUT, [0, 0.17, sz], { tex: 'wood', rough: 0.8 })); // bench, footed in the floor
    boat.add(box(t, [0.32, 0.1, 0.04], 0xcbb068, [0, 0.2, sz - 0.11], { tex: 'wood', rough: 0.8 })); // back lip, a shade darker than the benches
  }
  // ---- chevron bow-wave plates at the waterline ----
  [-1, 1].forEach((s) => {
    const wave = box(t, [0.22, 0.03, 0.1], 0xeaf6fb, [s * 0.12, -0.2, 0.6], { rough: 0.4, opacity: 0.85, rotY: s * 0.55 });
    wave.castShadow = false;
    boat.add(wave);
  });
  for (let i = 0; i < 3; i++) {
    const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[(i + 3) % SHIRTS.length], seated: true, expression: i === 0 ? 'surprised' : 'happy' });
    p.group.scale.setScalar(0.42);
    p.group.position.set(0, -0.02, -0.34 + i * 0.34); // hips on the benches, torsos over the gunwale
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
        // the trough: wooden U-channel following the closed spline, painted
        // with a seeded RCT2 water scheme — oliveGreen/black/grey, the second
        // Log Flume preset (LogFlume.h:54). Optional `pieces` swap the LAYOUT
        // for a compileTrackPieces circuit (auto-closed + validated); all the
        // dressing below derives from frame scans, so it follows any layout.
        let layoutPts = LAYOUT;
        if (opts.pieces) {
          const compiled = compileTrackPieces(opts.pieces, { profile: 'flume', start: [0, 0.6, 0] });
          layoutPts = compiled.points;
          if (compiled.report.fatal) extras.invalid = true;
        }
        const scheme = rideColourPreset(12, 'water'); // deterministic: oliveGreen trough / black rim+ribs / grey supports
        const ride = buildRideSpline(t, layoutPts, { profile: 'flume', colours: scheme.track, vehicleSchemes: scheme.vehicles });
        g.add(ride.group);

        // REAL animated shader water through the trough: ONE continuous
        // buildWaterRibbon following the flume spline (same treatment as
        // RiverRapids' channel). The profile's flat turquoise strip (-0.02)
        // stays BENEATH as the opaque backing body colour — the shader water
        // is transparent, depthWrite off, riding 0.055 above it so there is
        // no z-fighting. Width 0.72 matches the strip and stays 0.09 clear
        // of the wall inner faces (±0.45). amp 0.16 × waviness 0.6 (flume
        // water is calmer than rapids chop) swells ±0.029 about the +0.035
        // ride height: crests +0.064 stay far under the wall tops (+0.18),
        // troughs +0.006 stay above the backing strip (-0.02) — and the
        // ribbon samples the SAME frames the trough is swept from, so it
        // follows the drop exactly. update() drives uTime + uNight
        // (moonlight dim after dark), like the rapids channel.
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

        // drop run-out: NO separate splash pool any more — the trough keeps
        // its own water and instead gets low outward-flared splash walls
        // (chorded boards riding the rim rails, like a real flume run-out)
        // plus churned-foam patches on the water, so the drop still reads
        const flareUp = new t.Vector3();
        const flareSide = new t.Vector3();
        const flareDir = new t.Vector3();
        const boardCol = new t.Color(scheme.track.main).multiplyScalar(0.82).getHex(); // trough-wall olive, not slab-black
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
            const board = box(t, [0.024, 0.17, len * 1.12], boardCol, [0, 0, 0], { tex: 'wood', repeat: [1, 2], rough: 0.9 });
            board.position.addVectors(a, b).multiplyScalar(0.5).addScaledVector(flareUp, 0.065);
            board.setRotationFromMatrix(new t.Matrix4().makeBasis(flareSide, flareUp, flareDir));
            g.add(board);
          });
        }
        // widened churned water at the run-out: thin foam-white patches
        // straddling the animated ribbon surface (+0.035 ± 0.029 swell)
        // through the splash zone
        for (let i = 0; i < 5; i++) {
          const f = ride.frameAt(uRun + i * 0.016);
          const patch = box(t, [0.6 + 0.14 * ((i * 3) % 2), 0.014, 0.42], 0xe4f4f9, [0, 0, 0], { rough: 0.4, opacity: 0.55 });
          patch.castShadow = false;
          patch.position.copy(f.p).addScaledVector(f.up, 0.04).addScaledVector(f.side, Math.sin(i * 5.1) * 0.06);
          patch.setRotationFromMatrix(new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up)));
          patch.rotateY(Math.sin(i * 9.2) * 0.2);
          g.add(patch);
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

        // station deck beside the straight (frame-aligned wooden platform);
        // side offset 0.88 leaves 0.025 clear of the trough's rim rail (outer
        // face 0.505) instead of interpenetrating it
        const st = ride.frameAt(0);
        const yaw = Math.atan2(st.fwd.x, st.fwd.z);
        const sideH = new t.Vector3(st.side.x, 0, st.side.z).normalize();
        const deck = box(t, [0.7, 0.08, 1.9], 0x6b4626, [0, 0, 0], { tex: 'wood', repeat: [2, 6], rough: 0.9, rotY: yaw });
        deck.position.copy(st.p).addScaledVector(sideH, 0.88).setY(st.p.y + 0.12);
        g.add(deck);
        [-0.7, 0.7].forEach((dz) => {
          const post = new t.Vector3().copy(st.p).addScaledVector(sideH, 0.88).addScaledVector(st.fwd, dz);
          g.add(cyl(t, 0.06, 0.07, st.p.y + 0.12, 0x5a3d22, [post.x, (st.p.y + 0.12) / 2, post.z], { tex: 'wood', rough: 1, seg: 8 }));
        });

        // station deck lamps: a lantern pole above each deck post (deck top
        // st.p.y + 0.16), bulbs emissive-only, plus the component's ONE real
        // PointLight centred over the deck
        const deckBulbMats: THREE.MeshStandardMaterial[] = [];
        const deckTop = st.p.y + 0.16;
        [-0.7, 0.7].forEach((dz) => {
          const base = new t.Vector3().copy(st.p).addScaledVector(sideH, 0.88).addScaledVector(st.fwd, dz);
          g.add(cyl(t, 0.02, 0.025, 0.45, 0x4a3018, [base.x, deckTop + 0.225, base.z], { tex: 'wood', rough: 0.9, seg: 8 }));
          const bulb = ball(t, 0.045, 0xfff0c8, [base.x, deckTop + 0.48, base.z], { emissive: 0xffb45e, rough: 0.35 });
          (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15; // faint glass by day
          g.add(bulb);
          deckBulbMats.push(bulb.material as THREE.MeshStandardMaterial);
        });
        const deckCentre = new t.Vector3().copy(st.p).addScaledVector(sideH, 0.88);
        const deckLamp = new t.PointLight(0xffb45e, 0, 4, 2);
        deckLamp.position.set(deckCentre.x, deckTop + 0.55, deckCentre.z);
        g.add(deckLamp);

        // the log drifts the loop (belt-lift crawl, plunge on the drop).
        // wheelOffset 0.25: hull bottom 0.05 above the trough floor — the gap
        // hides under the water strip (-0.02) while buying clearance for the
        // hull ends through the drop's vertical curvature.
        const boat = buildLog(t, scheme.vehicles[0]);
        extras.vehicle = boat; // lead log — RideViewer onboard/follow cam
        const run = ride.run([boat], { wheelOffset: 0.25 });
        return (time) => {
          run(time);
          flumeWater.update(time); // wave clock + uNight moonlight dim
          // spray erupts by proximity: full burst as the log crosses the pool
          const d = Math.hypot(boat.position.x - SPLASH_AT.x, boat.position.z - SPLASH_AT.z);
          const k = Math.max(0, 1 - d / 1.25);
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
          // deck lamps + lift markers only after dark
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          deckLamp.intensity = 0.8 * ease;
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
 *  `queue`. The lead log is exposed as the ride `vehicle` (RideViewer
 *  onboard cam); a FATAL pieces compile marks the build `invalid` so the
 *  chassis never registers a broken circuit.
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
