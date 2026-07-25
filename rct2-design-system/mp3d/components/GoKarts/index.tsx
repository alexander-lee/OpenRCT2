import React from 'react';
import * as THREE from 'three';
import { box, cyl, nightKOf } from '../Stage';
import { buildRideSpline, compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { rideColourPreset } from '../ColorKit';
import { buildEmitter } from '../ParticleKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// Go-karts matched to the RCT2 KART1 sprite, rebuilt on SplineRideKit: RCT2
// treats go-karts as a TRACKED ride with flat/slope track pieces, so the old
// fixed RingGeometry circuit is now a REAL COURSE — a closed 'gokart' spline
// (flat asphalt ribbon with red/white kerbs) with two straights, an S-bend of
// esses on the back straight and a tight hairpin at the west end. The orange
// kart fleet (standard buildPeep drivers, night headlights) races it via
// run(): each kart on its own lane (laneOffset) with a per-kart monotone
// time-warp so the pack surges and bunches like an RCT2 race (gaps breathe
// but never close — no clipping), plus body-roll/steer wiggle on top.
// Optional `pieces` (SETUP §5.1) swap the stock course for a compileTrackPieces
// circuit on the same 'gokart' profile — kart courses are FLAT, so vertical
// pieces (lift/drop/hill, helix carrying a height) are stripped with a warn.

/** drop the vertical vocabulary from a kart piece list: karts never ramp.
 *  lift/drop/hill are removed outright; a helix keeps its flat arc but loses
 *  any `height`. One console.warn per stripped piece, naming it. */
function stripVerticalPieces(pieces: TrackPiece[], ride: string): TrackPiece[] {
  const out: TrackPiece[] = [];
  pieces.forEach((p, i) => {
    const d = typeof p === 'string' ? { type: p } : p;
    if (d.type === 'lift' || d.type === 'drop' || d.type === 'hill') {
      console.warn(`${ride}: stripped vertical piece '${d.type}' (piece ${i}) — this ride stays flat`);
      return;
    }
    if ((d.type === 'helixL' || d.type === 'helixR') && (d.height ?? 0) !== 0) {
      console.warn(`${ride}: stripped the height off '${d.type}' (piece ${i}) — this ride stays flat (kept the flat arc)`);
      const { height: _h, ...flat } = d;
      out.push(flat);
      return;
    }
    out.push(p);
  });
  return out;
}

export function buildGoKartsScene(
  three: typeof THREE,
  opts: { pieces?: TrackPiece[]; riders?: boolean } = {},
): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
} {
  const group = new three.Group();
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests drive the karts
  const seats: THREE.Group[] = []; // one bucket-seat anchor per kart (seatWorld)
  let vehicle: THREE.Object3D | undefined; // the lead kart — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // closed kart course, all flat at y=0.02 (~6 x 4.5 footprint):
        // front straight -> wide sweeper -> back straight with esses -> hairpin.
        // Point spacing keeps the minimum turn radius at 0.63 (verified
        // numerically) — above the 0.55 ribbon half-width, so the asphalt
        // never folds on itself and the kerb strips stay clean on the hairpin.
        const LAYOUT: [number, number, number][] = [
          [-0.9, 0.02, 1.9], // start/finish on the front straight
          [1.5, 0.02, 1.95], // front straight
          [2.95, 0.02, 1.0], // wide sweeper entry (east end)
          [2.95, 0.02, -0.85], // sweeper exit
          [1.6, 0.02, -1.95], // back straight
          [0.2, 0.02, -1.66], // S-bend: weave in...
          [-1.25, 0.02, -1.95], // ...and out (the esses)
          [-2.3, 0.02, -1.4], // hairpin approach
          [-2.8, 0.02, -1.0], // hairpin entry
          [-3.0, 0.02, -0.35], // hairpin apex (west end)
          [-2.55, 0.02, 0.45], // hairpin exit back to the straight
        ];
        // custom courses: compile the (flat-stripped) pieces on the 'gokart'
        // profile at kerb height 0.02 and feed the points into the SAME
        // buildRideSpline call — closure/clearance report on g.userData
        let layoutPts: [number, number, number][] = LAYOUT;
        if (opts.pieces) {
          const compiled = compileTrackPieces(stripVerticalPieces(opts.pieces, 'GoKarts'), { profile: 'gokart', start: [0, 0.02, 0] });
          layoutPts = compiled.points;
          g.userData.trackReport = compiled.report;
        }
        const ride = buildRideSpline(t, layoutPts, { profile: 'gokart' });
        g.add(ride.group);

        // infield grass patch inside the loop so the circuit reads as a field
        // (top at 0.01, BELOW the 0.02 track surface; base on the ground disc)
        // — sized for the stock course only, so custom circuits skip it
        if (!opts.pieces) g.add(cyl(t, 0.88, 0.88, 0.03, 0x6f9e54, [0.15, -0.005, 0.15], { tex: 'grass', repeat: [5, 5], rough: 1, seg: 36 }));

        // start gantry + chequered line, planted on the spline's start frame:
        // local x = frame.side (across the ribbon), z = frame.fwd (direction)
        const f0 = ride.frameAt(0);
        const start = new t.Group();
        start.position.copy(f0.p);
        start.setRotationFromMatrix(new t.Matrix4().makeBasis(f0.side, f0.up, f0.fwd));
        // posts run from below grade (base -0.025 world) up into the beam
        [-0.85, 0.85].forEach((x) => start.add(cyl(t, 0.04, 0.04, 0.95, 0x8a8f98, [x, 0.43, 0], { tex: 'metal', metal: 0.5, rough: 0.4, seg: 10 })));
        start.add(box(t, [1.86, 0.08, 0.12], 0xdd3838, [0, 0.9, 0], { rough: 0.55 })); // red beam spanning the ribbon
        // two gantry floodlights under the beam (beam underside 0.86): dark
        // housings + emissive lenses, each with a REAL PointLight aimed at the
        // grid — off by day, gated on with the kart headlights after dark
        const floods: THREE.PointLight[] = [];
        const floodLensMats: THREE.MeshStandardMaterial[] = [];
        [-0.5, 0.5].forEach((x) => {
          start.add(box(t, [0.14, 0.07, 0.1], 0x26262b, [x, 0.82, 0], { tex: 'metal', metal: 0.5, rough: 0.5 })); // housing hung under the beam
          const lens = box(t, [0.1, 0.012, 0.07], 0xfff3c0, [x, 0.782, 0], { emissive: 0xffe9a0, rough: 0.3 }); // downward lens face
          (lens.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15; // faint glass by day
          start.add(lens);
          floodLensMats.push(lens.material as THREE.MeshStandardMaterial);
          const fl = new t.PointLight(0xffe0a0, 0, 4.5, 2);
          fl.position.set(x, 0.72, 0);
          start.add(fl);
          floods.push(fl);
        });
        // chequered squares span ±0.438 — inside the kerbs' inner faces (0.44)
        for (let row = 0; row < 2; row++)
          for (let k = 0; k < 6; k++)
            start.add(box(t, [0.146, 0.012, 0.16], (k + row) % 2 ? 0x111114 : 0xf5f5f5, [(k - 2.5) * 0.146, 0.028, 0.28 + row * 0.16], { rough: 0.6 }));
        g.add(start);

        // tyre stacks guarding the OUTSIDE of the tightest turn — the same
        // deterministic 200-sample scan for both courses. Stock course: the
        // frame nearest the hard-coded hairpin apex, outward = away from the
        // track centre (byte-identical placement). Custom pieces: the apex is
        // the maximum-curvature frame, outward the horizontal anti-curvature
        // normal (fwd turns TOWARD the centre, so its backwards difference
        // points outside) — no magic u values either way.
        let uApex = 0;
        if (!opts.pieces) {
          const apex = new t.Vector3(-3.0, 0.02, -0.35);
          let dBest = Infinity;
          for (let i = 0; i < 200; i++) {
            const d = ride.frameAt(i / 200).p.distanceTo(apex);
            if (d < dBest) {
              dBest = d;
              uApex = i / 200;
            }
          }
        } else {
          let kBest = -1;
          for (let i = 0; i < 200; i++) {
            const a = ride.frameAt(i / 200 - 0.005).fwd;
            const b = ride.frameAt(i / 200 + 0.005).fwd;
            const k = Math.hypot(b.x - a.x, b.z - a.z); // horizontal turn rate
            if (k > kBest) {
              kBest = k;
              uApex = i / 200;
            }
          }
        }
        [-0.05, 0, 0.05].forEach((du, j) => {
          const f = ride.frameAt(uApex + du);
          const out = new t.Vector3();
          if (!opts.pieces) out.set(f.p.x, 0, f.p.z).normalize(); // away from the track centre
          else {
            const a = ride.frameAt(uApex + du - 0.005).fwd;
            const b = ride.frameAt(uApex + du + 0.005).fwd;
            out.set(a.x - b.x, 0, a.z - b.z).normalize(); // away from the turn centre
          }
          const px = f.p.x + out.x * 0.95;
          const pz = f.p.z + out.z * 0.95;
          for (let s = 0; s < 2 + (j % 2); s++)
            g.add(cyl(t, 0.11, 0.11, 0.09, 0x18181c, [px, 0.025 + s * 0.09, pz], { rough: 0.9, seg: 14 })); // base ring sunk to the grass (-0.02)
        });

        // seeded RCT2 kart fleet — the classic GoKarts.h:51-54 racing colours
        // (bordeauxRed / yellow / darkGreen / darkBrown), one VehicleScheme
        // per kart: body paints the tub + front wing, trim the rear wing
        const fleet = rideColourPreset(1, 'kart').vehicles;
        const karts: THREE.Group[] = [];
        const lampMats: THREE.MeshStandardMaterial[] = [];
        const lamps: THREE.PointLight[] = [];
        for (let i = 0; i < 4; i++) {
          const livery = fleet[i % fleet.length];
          const k = new t.Group();
          k.add(box(t, [0.36, 0.1, 0.7], 0x141417, [0, 0.14, 0], { tex: 'metal', metal: 0.5, rough: 0.5 })); // chassis
          k.add(box(t, [0.38, 0.18, 0.44], livery.body, [0, 0.26, -0.02], { tex: 'plastic', rough: 0.35 })); // body
          k.add(box(t, [0.5, 0.05, 0.14], livery.body, [0, 0.2, 0.34], { tex: 'plastic', rough: 0.35 })); // front wing
          k.add(box(t, [0.44, 0.05, 0.12], livery.trim, [0, 0.3, -0.36], { tex: 'plastic', rough: 0.35 })); // rear wing (trim accent)
          // bucket seat: shell base + PADDED cushion and backrest pad so the
          // driver visibly sits on upholstery (racing-red, all four karts)
          k.add(box(t, [0.24, 0.08, 0.24], 0x101014, [0, 0.33, -0.14], { rough: 0.8 })); // seat shell base
          k.add(box(t, [0.2, 0.05, 0.2], 0x8a2430, [0, 0.385, -0.13], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // cushion (top 0.41)
          k.add(box(t, [0.22, 0.16, 0.05], 0x101014, [0, 0.44, -0.28], { rough: 0.8 })); // backrest shell
          k.add(box(t, [0.18, 0.12, 0.03], 0x8a2430, [0, 0.44, -0.245], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // back pad
          k.add(cyl(t, 0.015, 0.015, 0.17, 0x1a1a1e, [0, 0.41, 0.075], { rotX: -0.74, seg: 8 })); // steering column off the cowl
          k.add(cyl(t, 0.07, 0.07, 0.03, 0x1a1a1e, [0, 0.47, 0.02], { rotX: -0.74, seg: 12 })); // steering wheel right at the driver's hands
          // chunky wheels OUTSIDE the body so they read
          [
            [-0.24, 0.26],
            [0.24, 0.26],
            [-0.26, -0.26],
            [0.26, -0.26],
          ].forEach(([x, z]) => k.add(cyl(t, 0.11, 0.11, 0.1, 0x101013, [x, 0.11, z], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.3, rough: 0.6, seg: 14 })));
          // bucket-seat anchor — the REAL GameManager guest drives via seatWorld
          const seat = new t.Group();
          seat.position.set(0, 0.2, -0.14);
          k.add(seat);
          seats.push(seat);
          if (withRiders) {
            // driver is the standard park guest component, seated in the shell
            const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[i], seated: true });
            p.group.scale.setScalar(0.42);
            p.group.userData.lodDetail = true; // park runtime hides drivers beyond NEAR distance
            seat.add(p.group);
          }
          // headlight: emissive lamp + a real light — OFF by day, on at night
          const lampMesh = new t.Mesh(new t.SphereGeometry(0.045, 10, 8), new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.3 }));
          lampMesh.position.set(0, 0.24, 0.42);
          k.add(lampMesh);
          lampMats.push(lampMesh.material as THREE.MeshStandardMaterial);
          const lamp = new t.PointLight(0xffcc66, 0, 3, 2);
          lamp.position.set(0, 0.26, 0.5);
          k.add(lamp);
          lamps.push(lamp);
          k.scale.setScalar(1.15);
          karts.push(k);
        }
        vehicle = karts[0];

        // exhaust: one tiny ParticleKit puff emitter per kart (grey-blue,
        // buoyant, growing), living in WORLD space — each frame the origin
        // chases the kart's tailpipe and the rate syncs to the throttle
        // (the per-kart time-warp derivative). 4 × 32 = 128 particles.
        const exhausts = karts.map(() => {
          const e = buildEmitter(t, {
            max: 32, rate: 14, life: 0.9, lifeVar: 0.25,
            velocity: [0, 0.34, 0], spread: 0.12, gravity: -0.18,
            size: 0.09, sizeEnd: 0.3, color: 0xaeb4ba, colorEnd: 0xe4e8ec, opacity: 0.5,
          });
          g.add(e.points);
          return e;
        });
        const tail = new t.Vector3();

        // one runner per kart: its own lane (wheel outer extent 0.417 + up to
        // ~0.013 of steer-wiggle swing stays inside the kerbs' inner faces at
        // 0.44) and wheelOffset 0 so the wheel bottoms roll ON the asphalt
        const LANES = [-0.06, -0.02, 0.02, 0.06];
        const runners = karts.map((k, i) => ride.run([k], { laneOffset: LANES[i], wheelOffset: 0 }));
        // deterministic rolling start: spread the pack ~2.7 units apart along
        // the circuit — more than the warp amplitude + a kart length, so the
        // field breathes without ever touching
        // (run() integrates clamped dt, so a burst of pre-race ticks = head start)
        runners.forEach((run, i) => {
          for (let s = i * 32; s > 0; s--) run(-s * 0.05);
        });

        return (time) => {
          // headlights only come on as it gets dark (0 when not under a Stage)
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          karts.forEach((k, i) => {
            // per-kart monotone time-warp (|0.15·0.3·cos| < 1): the pack
            // surges, bunches and stretches but phase gaps never close to
            // zero — karts can NEVER overlap (the lanes are narrower than a
            // kart, so true side-by-side passing would clip)
            runners[i](time + 0.15 * Math.sin(time * 0.3 + i * 1.7)); // run() sets position + frame orientation...
            k.rotateZ(Math.sin(time * 3 + i * 2.1) * 0.012); // ...then body roll
            k.rotateY(Math.sin(time * 1.9 + i * 1.3) * 0.03); // ...and steer wiggle on top
            lamps[i].intensity = ease * 0.55;
            lampMats[i].emissiveIntensity = 0.15 + (1.2 - 0.15) * ease;
            // exhaust puffs off the tailpipe, throttle-synced: the time-warp
            // derivative 1 + 0.045·cos(...) is the pack's surge — surging
            // karts puff hardest (rate ~2..7.4/s)
            k.updateWorldMatrix(true, false);
            tail.set(0, 0.16, -0.42).applyMatrix4(k.matrixWorld);
            exhausts[i].setOrigin(tail.x, tail.y, tail.z);
            const throttle = 1 + 0.045 * Math.cos(time * 0.3 + i * 1.7);
            exhausts[i].setRate(6 + 160 * Math.max(0, throttle - 0.955));
            exhausts[i].update(time);
          });
          // gantry floodlights wash the start/finish grid after dark
          floods.forEach((fl) => (fl.intensity = ease * 0.9));
          floodLensMats.forEach((m) => (m.emissiveIntensity = 0.15 + (1.5 - 0.15) * ease));
        };
      })(three, group) || undefined;
  // station gate: the whole race clock is gated, so the pack sits PARKED on
  // the circuit while guests board and rolls to a stop for unloading
  const gate = createMotionGate((tt) => update?.(tt));
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange: gate.onStateChange };
}

const GoKartsBase = composableRide<{ pieces?: TrackPiece[]; riders?: boolean }>(
  'GoKarts',
  (t, props) => buildGoKartsScene(t, { pieces: props.pieces, riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Go-Karts', capacity: 4, rideDuration: 12, intensity: 5, price: 4 } },
);

/** <GoKarts> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Override with top-level props / `queue`.
 *  OPTIONAL track pieces (SETUP §5.1): a `pieces` array or piece children
 *  (`<Station/><Straight/><TurnR angle={180}/>` — children win) replace the
 *  stock circuit with a compileTrackPieces course on the same 'gokart'
 *  profile. Kart courses are FLAT: lift/drop/hill (and any helix height) are
 *  stripped with a console.warn. The start gantry, tightest-turn tyre stacks,
 *  kart fleet, exhausts and headlights all follow the custom course; defaults
 *  are unchanged when neither is given. */
export const GoKarts: React.FC<ComposableRideProps & { pieces?: TrackPiece[]; riders?: boolean; children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <GoKartsBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
