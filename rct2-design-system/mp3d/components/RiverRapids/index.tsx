import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, nightKOf } from '../Stage';
import { buildRideSpline, compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildWater, buildWaterRibbon } from '../WaterTile';
import { buildEmitter } from '../ParticleKit';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { rideColourPreset } from '../ColorKit';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// River rapids matched to the RCT2 RAPBOAT sprite, rebuilt on SplineRideKit:
// RCT2 rapids are a TRACKED ride built from channel pieces, so the old
// straight 7-unit channel is now a closed meandering loop — the 'rapids'
// profile sweeps the rocky boulder-lined channel with its water strip, a
// conveyor lift climbs out of the low pool straight, a high meander winds
// along the back and a small drop falls back to a splash pond. The round navy
// raft (tyre tube, SIX yellow-backed seats, buildPeep riders) is placed by
// run(); its spin and bob are layered ON TOP of that placement each frame.
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
        // preset (RiverRapids.h:54) — whitewashed stonework, dark-brown
        // supports, and a classic bright-red raft with yellow seat backs
        // (was navy/safety-yellow before seeding)
        const scheme = rideColourPreset(22, 'water');
        const RAFT = scheme.vehicles[0].body; // raft deck + hub
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

        // channel edge markers: emissive-only amber beads on the wall tops
        // (walls at side ±0.48, top +0.22 → beads at up +0.25), alternating
        // sides around the loop like navigation lights. No real lights here.
        const markerMats: THREE.MeshStandardMaterial[] = [];
        for (let i = 0; i < 16; i++) {
          const f = ride.frameAt(i / 16);
          const s = i % 2 ? 1 : -1;
          const m = ball(t, 0.028, 0xffe9b0, [0, 0, 0], { emissive: 0xffb45e, rough: 0.35 });
          m.position.copy(f.p).addScaledVector(f.side, s * 0.48).addScaledVector(f.up, 0.25);
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12; // faint by day
          g.add(m);
          markerMats.push(m.material as THREE.MeshStandardMaterial);
        }

        // REAL shader water through the channel: ONE continuous water ribbon
        // following the spline (the old 16 overlapping buildWater sheets read
        // as seamed patchwork). Positions come from frameAt samples riding
        // 0.055 above the profile's flat strip (which stays beneath as the
        // opaque backing — the shader water is transparent, depthWrite off);
        // width 0.8 stays just inside the walls (inner faces ±0.48). The
        // ribbon's local coords are (across, alongArc), so the waves flow
        // continuously along the whole loop — the closing sample reuses
        // sample 0's position, and the shader's quantized along-arc wave
        // frequencies make the seam invisible. amp 0.16 calms open-water
        // swell to channel chop: crests (+0.063) stay under the wall tops
        // (+0.22), troughs (-0.033) stay above the backing strip (-0.04).
        const RIBBON_N = 220;
        const ribbonPts: { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[] = [];
        for (let k = 0; k < RIBBON_N; k++) {
          const f = ride.frameAt(k / RIBBON_N);
          ribbonPts.push({ p: f.p.clone().addScaledVector(f.up, WATER_Y + 0.055), side: f.side.clone(), up: f.up.clone() });
        }
        ribbonPts.push({ ...ribbonPts[0] }); // close the loop watertight
        const channelWater = buildWaterRibbon(t, ribbonPts, 0.8, { amp: 0.16 });
        g.add(channelWater.mesh);

        // white-water foam: SUBTLE now — fewer, thinner patches straddling
        // the shader water, skipped on the conveyor climb, with only a mild
        // swell at the drop (all corners stay on the 0.76-wide strip)
        for (let i = 0; i < 16; i++) {
          const f = ride.frameAt(i / 16 + 0.03);
          if (f.fwd.y > 0.15) continue; // no churn riding the lift belt
          const foam = box(t, [0.34, 0.012, 0.15], 0xe4f4f9, [0, 0, 0], { rough: 0.4, opacity: 0.5 });
          foam.castShadow = false;
          foam.position.copy(f.p).addScaledVector(f.up, WATER_Y + 0.045).addScaledVector(f.side, Math.sin(i * 3.9) * 0.1);
          foam.setRotationFromMatrix(new t.Matrix4().makeBasis(f.side, f.up, f.fwd));
          foam.rotateY(Math.sin(i * 7.3) * 0.35);
          if (f.fwd.y < -0.05) foam.scale.set(1.15, 1, 1.15); // gentle churn at the drop
          g.add(foam);
        }

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

        // station deck beside the pool straight: wooden boarding platform on
        // the OUTER (south) bank — inner edge 0.85 from the centreline, clear
        // of the bank boulders (outer reach 0.84) and 1.9+ clear of the pond
        // basin — with posts to the ground
        const st = ride.frameAt(0);
        const yaw = Math.atan2(st.fwd.x, st.fwd.z);
        const sideH = new t.Vector3(st.side.x, 0, st.side.z).normalize();
        const deck = box(t, [0.7, 0.07, 1.9], 0x6b4626, [0, 0, 0], { tex: 'wood', repeat: [2, 6], rough: 0.9, rotY: yaw });
        deck.position.copy(st.p).addScaledVector(sideH, -1.2).setY(st.p.y + 0.2);
        g.add(deck);
        [-0.7, 0.7].forEach((dz) => {
          const post = new t.Vector3().copy(st.p).addScaledVector(sideH, -1.2).addScaledVector(st.fwd, dz);
          g.add(cyl(t, 0.05, 0.06, st.p.y + 0.17, 0x5a3d22, [post.x, (st.p.y + 0.17) / 2, post.z], { tex: 'wood', rough: 1, seg: 8 }));
        });
        // boarding gangway: a plank bridging the deck to the channel wall —
        // top a 5 mm step below the deck top (no coplanar overlap), outer
        // edge tucked under the deck lip, inner edge seated ON the wall top
        // (+0.22, plank bottom +0.18); it stops at side -0.48, 0.025 clear
        // of the raft envelope (0.455)
        const gang = box(t, [0.4, 0.05, 1.5], 0x7a5230, [0, 0, 0], { tex: 'wood', repeat: [1, 5], rough: 0.9, rotY: yaw });
        gang.position.copy(st.p).addScaledVector(sideH, -0.68).setY(st.p.y + 0.205);
        g.add(gang);

        // station lamp: a lantern pole at one deck end (deck top st.p.y +
        // 0.235; pole above the −0.7 post) — emissive bulb + the component's
        // ONE real PointLight over the boarding deck
        const lampBase = new t.Vector3().copy(st.p).addScaledVector(sideH, -1.2).addScaledVector(st.fwd, -0.7);
        const rrDeckTop = st.p.y + 0.235;
        g.add(cyl(t, 0.02, 0.025, 0.45, 0x4a3018, [lampBase.x, rrDeckTop + 0.225, lampBase.z], { tex: 'wood', rough: 0.9, seg: 8 }));
        const stBulb = ball(t, 0.045, 0xfff0c8, [lampBase.x, rrDeckTop + 0.48, lampBase.z], { emissive: 0xffb45e, rough: 0.35 });
        (stBulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
        g.add(stBulb);
        const stLamp = new t.PointLight(0xffb45e, 0, 4, 2);
        stLamp.position.set(lampBase.x, rrDeckTop + 0.55, lampBase.z);
        g.add(stLamp);

        // round raft SIZED TO THE CHANNEL: outer radius 0.455 vs the walls'
        // inner faces at 0.48 — it fits (with spin and bob) everywhere on the
        // loop, verified point-by-point, instead of shearing through both walls
        const raft = new t.Group();
        // tyre tube (textured rubber) + navy deck + hub
        const tube = new t.Mesh(new t.TorusGeometry(0.37, 0.085, 10, 24), mat(t, 0x1c1c20, { tex: 'plastic', repeat: [8, 2], rough: 0.85 }));
        tube.rotation.x = -Math.PI / 2;
        tube.position.y = 0.085; // tube bottom at the raft origin
        tube.castShadow = true;
        raft.add(tube);
        raft.add(cyl(t, 0.37, 0.37, 0.09, RAFT, [0, 0.155, 0], { tex: 'plastic', repeat: [8, 1], rough: 0.5, seg: 22 })); // deck merges into the tube
        raft.add(cyl(t, 0.14, 0.18, 0.22, RAFT, [0, 0.3, 0], { tex: 'plastic', rough: 0.5, seg: 14 })); // hub console meets the seat backs
        // six outward-facing seats with yellow backs
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const seat = new t.Group();
          seat.position.set(Math.cos(a) * 0.26, 0.2, Math.sin(a) * 0.26);
          seat.rotation.y = -a - Math.PI / 2;
          seat.add(box(t, [0.22, 0.16, 0.045], SEATC, [0, 0.06, -0.095], { rough: 0.55 })); // shoulder-high backrest footed in the deck
          const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[i % SHIRTS.length], seated: true, expression: i % 2 ? 'happy' : 'surprised' });
          p.group.scale.setScalar(0.26);
          p.group.position.set(0, -0.13, -0.03); // hips on the deck, back on the backrest, feet on the tube
          seat.add(p.group);
          raft.add(seat);
        }

        // run() drifts the raft down the channel (plunging on the drop);
        // wheelOffset -0.075 + the 0.01..0.035 bob keeps the tube bottom
        // between -0.065 and -0.04: always kissing the water strip (-0.04)
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
          // station lamp + channel markers only after dark
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          stLamp.intensity = 0.8 * ease;
          (stBulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + 1.05 * ease;
          markerMats.forEach((m) => (m.emissiveIntensity = 0.12 + 1.1 * ease));
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
