import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { buildRideSpline, compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { VehicleScheme, rideColourPreset, shade } from '../ColorKit';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// ---------------------------------------------------------------------------
// Bobsleigh — the full RCT2 bobsled ride on SplineRideKit: a closed spline
// swept as an icy half-pipe chute ('bobsled' profile) that banks HARD through
// the curves, carried on a steel spine with ground columns. A 2-sled train
// (sleek pods on chrome runners, two riders each) is energy-paced: it crawls
// up the return lift, then gravity hurls it around the banked curves.
// Deterministic, driven only by the Stage clock.
//
// CRASH PHYSICS: bobsleds have no upstop wheels (Vehicle.TrackMotion.cpp:
// 98-122), so SplineRideKit's 'bobsled' runner derails the train whenever the
// effective lateral force tops 1.5 g on under-banked track. This LAYOUT is
// verified legal — the banking absorbs every fast curve (worst effective
// lateral ≈ 0.55 g, computed with the energy pacing), so it never crashes by
// itself. `ride.forceCrash()` / `ride.setBrakesFailure(true)` remain
// available for staged disasters.
// ---------------------------------------------------------------------------

// downhill run: crest station on the north-west, long sweeping descent east
// and south through banked curves to the low back straight, then a wide
// banked climb up the west side home. Every vertical transition is spread
// over 1.5+ units so the rigid sleds' runners stay on the ice (worst floor
// contact 0.05 = one runner-height, at one corner entry).
const LAYOUT: [number, number, number][] = [
  [-4.9, 2.6, -0.9], // crest station...
  [-4.55, 2.53, -1.72], // ...pinned straight (kills spline sag behind the crest)
  [-4.05, 2.44, -2.75],
  [-2.9, 2.32, -3.1], // sweeping downhill left-hander
  [-1.5, 2.2, -3.2],
  [1.5, 1.8, -2.6], // long east descent
  [3.4, 1.35, -0.8],
  [3.0, 0.95, 1.6], // hard-banked curve
  [0.9, 0.6, 2.9],
  [-1.7, 0.5, 3.2], // low back straight
  [-3.9, 0.6, 3.0],
  [-5.2, 1.05, 2.2], // banked lift climbs...
  [-5.5, 1.85, 0.6], // ...the west side home
];

/**
 * Compact bobsled pod — the classic RCT2 bobsled look in a realistic livery: steel-
 * blue hull, silver nose cowl, chrome runners whose bottoms sit 0.045 below
 * the origin, and two riders via buildPeep. Kept SHORT (0.9 runners) and
 * narrow-tracked (±0.15) so the rigid body tracks the twisting banked chute
 * without knifing through the ice. Optional `scheme` (RCT2 VehicleColour,
 * ride/VehicleColour.h:19-24): body → hull (+0.75-shaded skirt), trim → nose
 * cowl, tertiary → rim stripe; omitted = today's alternating steel blues.
 */
function buildSled(t: typeof THREE, n = 0, scheme?: VehicleScheme): THREE.Group {
  const g = new t.Group();
  const HULL = scheme?.body ?? (n % 2 ? 0x445261 : 0x2f5d8a); // steel blue / gunmetal alternating
  const SKIRT = scheme !== undefined ? shade(scheme.body, 0.75) : n % 2 ? 0x333d48 : 0x24486e;
  g.add(box(t, [0.42, 0.24, 0.88], HULL, [0, 0.17, 0], { tex: 'plastic', repeat: [1, 3], rough: 0.3 })); // hull
  g.add(box(t, [0.46, 0.1, 0.92], SKIRT, [0, 0.06, 0], { tex: 'plastic', rough: 0.3 })); // skirt
  g.add(box(t, [0.3, 0.15, 0.55], 0x2e2e34, [0, 0.225, -0.04], { rough: 0.85 })); // recessed cockpit floor for both riders
  g.add(box(t, [0.44, 0.18, 0.3], scheme?.trim ?? 0xc8d0d8, [0, 0.2, 0.34], { rotX: -0.4, tex: 'metal', metal: 0.7, rough: 0.3 })); // nose cowl (silver default)
  g.add(box(t, [0.46, 0.05, 0.8], scheme?.tertiary ?? 0xdce6ee, [0, 0.26, -0.04], { rough: 0.45 })); // rim stripe (ice-white default)
  [-0.15, 0.15].forEach((x) => g.add(box(t, [0.04, 0.05, 0.9], 0xd0d4da, [x, -0.02, 0], { tex: 'metal', metal: 0.85, rough: 0.2 }))); // chrome runners
  [0.18, -0.16].forEach((z, i) => {
    // padded seat (cushion + back pad) and a chrome grab handle at the hands
    g.add(box(t, [0.24, 0.06, 0.2], 0x4a2530, [0, 0.295, z], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // cushion (top 0.325)
    g.add(box(t, [0.24, 0.12, 0.04], 0x4a2530, [0, 0.34, z - 0.125], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // back pad
    g.add(cyl(t, 0.013, 0.013, 0.2, 0x2c2c30, [0, 0.43, z + 0.12], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.35, seg: 8 })); // grab bar
    [-0.08, 0.08].forEach((x) => g.add(cyl(t, 0.01, 0.01, 0.15, 0x2c2c30, [x, 0.36, z + 0.12], { metal: 0.6, rough: 0.35, seg: 6 }))); // bar stems
    const p = buildPeep(t, {
      skin: SKIN_TONES[(n * 2 + i) % SKIN_TONES.length],
      shirt: SHIRTS[[1, 2, 6, 4][(n * 2 + i) % 4]], // blues/greens/teal — cold-weather kit
      seated: true, // arms forward, hands ON the grab bar
    });
    p.group.scale.setScalar(0.4);
    p.group.position.set(0, 0.14, z); // hip underside 0.32 settles into the cushion
    g.add(p.group);
  });
  return g;
}

export function buildBobsleighScene(
  three: typeof THREE,
  opts: { pieces?: TrackPiece[] } = {},
): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  crashed?: () => boolean;
  invalid?: boolean;
} {
  const group = new three.Group();
  // sim extras picked up by <ConfigurableRide>: `vehicle` = the lead sled
  // (RideViewer onboard/follow cam), `crashed` = the guarded 'bobsled'
  // profile's 1.5 g derail state (registerRide vehicleHandle), `invalid` =
  // fatal pieces compile (the chassis skips the GameManager registration)
  const extras: { vehicle?: THREE.Object3D; crashed?: () => boolean; invalid?: boolean } = {};
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // bank 0.55 (~31°): still leans hard into every curve, but the bank
        // RAMP along the sled length stays gentle enough that runner tips
        // never knife through the ice — and 0.55/0.6 of the lateral force is
        // still soaked by the banking (worst effective ≈ 0.55 g < 1.5 g).
        // Seeded RCT2 bobsleigh scheme: white/brightRed/white — the classic
        // BobsleighCoaster.h:50 preset (red rim rails, white supports, white
        // sleds with red nose cowls). The ICE itself is never recoloured.
        const scheme = rideColourPreset(10, 'steel'); // deterministic pick of the bobsleigh preset
        // optional `pieces` swap the LAYOUT for a compileTrackPieces circuit
        // (auto-closed + validated; station low, use <Lift/> for height) on
        // the same guarded 'bobsled' profile — deck/markers follow any layout
        let layoutPts = LAYOUT;
        if (opts.pieces) {
          const compiled = compileTrackPieces(opts.pieces, { profile: 'bobsled', bank: 0.55, start: [0, 0.6, 0] });
          layoutPts = compiled.points;
          if (compiled.report.fatal) extras.invalid = true;
        }
        const ride = buildRideSpline(t, layoutPts, { profile: 'bobsled', bank: 0.55, colours: scheme.track, vehicleSchemes: scheme.vehicles });
        g.add(ride.group);
        extras.crashed = () => ride.crashed(); // 1.5 g derail guard is LIVE on this profile

        // chute edge markers: emissive-only amber beads riding the rim rails
        // (rail centre side ±0.74 / up +0.27 → beads at up +0.33 sit on the
        // 0.04-radius rail tops) — NO real lights, just night-gated glass
        const markerMats: THREE.MeshStandardMaterial[] = [];
        for (let i = 0; i < 12; i++) {
          const f = ride.frameAt(i / 12);
          [-1, 1].forEach((s) => {
            const m = ball(t, 0.032, 0xffe9b0, [0, 0, 0], { emissive: 0xffb45e, rough: 0.35 });
            m.position.copy(f.p).addScaledVector(f.side, s * 0.74).addScaledVector(f.up, 0.33);
            (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12; // faint by day
            g.add(m);
            markerMats.push(m.material as THREE.MeshStandardMaterial);
          });
        }

        // top-station deck: a steel-framed boarding platform beside the crest.
        // Side offset 1.19 puts its inner edge 0.79 from the centreline — just
        // clear of the chute's rim rail (outer face 0.78) — and the deck top
        // (+0.25) rides level with the ice-plate rim (+0.26), not buried in it.
        const st = ride.frameAt(0);
        const yaw = Math.atan2(st.fwd.x, st.fwd.z);
        const sideH = new t.Vector3(st.side.x, 0, st.side.z).normalize();
        const deck = box(t, [0.8, 0.07, 2.0], 0x6b7078, [0, 0, 0], { tex: 'metal', repeat: [2, 6], metal: 0.4, rough: 0.6, rotY: yaw });
        deck.position.copy(st.p).addScaledVector(sideH, 1.19).setY(st.p.y + 0.215);
        g.add(deck);
        [-0.8, 0.8].forEach((dz) => {
          const post = new t.Vector3().copy(st.p).addScaledVector(sideH, 1.19).addScaledVector(st.fwd, dz);
          g.add(cyl(t, 0.05, 0.07, st.p.y + 0.19, 0x9aa0a8, [post.x, (st.p.y + 0.19) / 2, post.z], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 10 }));
        });

        // station lamp: one pole at the deck end (deck top st.p.y + 0.25,
        // side 1.19 + fwd −0.8 stays on the 2.0-long deck) with an emissive
        // bulb and the component's ONE real PointLight over the boarding deck
        const lampBase = new t.Vector3().copy(st.p).addScaledVector(sideH, 1.19).addScaledVector(st.fwd, -0.8);
        const deckTop = st.p.y + 0.25;
        g.add(cyl(t, 0.02, 0.025, 0.5, 0x3a3d42, [lampBase.x, deckTop + 0.25, lampBase.z], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 8 }));
        const stBulb = ball(t, 0.05, 0xfff0c8, [lampBase.x, deckTop + 0.53, lampBase.z], { emissive: 0xffb45e, rough: 0.35 });
        (stBulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
        g.add(stBulb);
        const stLamp = new t.PointLight(0xffb45e, 0, 4, 2);
        stLamp.position.set(lampBase.x, deckTop + 0.6, lampBase.z);
        g.add(stLamp);

        // 2-sled train, energy-paced down the chute; wheelOffset 0.015 rides
        // the runners a hair above the ice sheet so corner-entry bank ramps
        // dip them INTO contact instead of through the floor
        const sleds = [0, 1].map((n) => buildSled(t, n, scheme.vehicles[n % scheme.vehicles.length]));
        extras.vehicle = sleds[0]; // lead sled — RideViewer onboard/follow cam
        const run = ride.run(sleds, { spacing: 1.4, wheelOffset: 0.015 });
        return (time) => {
          run(time);
          const k = nightKOf(g); // markers + station lamp only after dark
          const ease = k * k * (3 - 2 * k); // smoothstep
          stLamp.intensity = 0.8 * ease;
          (stBulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + 1.05 * ease;
          markerMats.forEach((m) => (m.emissiveIntensity = 0.12 + 1.1 * ease));
        };
      })(three, group) || undefined;
  return { group, update, ...extras };
}

const BobsleighBase = composableRide(
  'Bobsleigh',
  (t, props: { pieces?: TrackPiece[] }) => buildBobsleighScene(t, props),
  {
    // access geometry clears the stock run (chute reaches z 3.2 + rim 0.78):
    // queue HEAD 4.6 out the local +z front, exit hut beside it
    front: 4.6,
    exit: [-2.0, 4.2],
    defaults: { name: 'Bobsleigh', capacity: 4, rideDuration: 10, intensity: 6, price: 4 },
  },
);

/** <Bobsleigh> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 4.6 out the local +z
 *  front (lane extending +z, clear of the chute), exit hut beside it at
 *  local [-2.0, 4.2], boarding at the base. Override with top-level props /
 *  `queue`. The lead sled is exposed as the ride `vehicle` (RideViewer
 *  onboard cam) and the 1.5 g derail guard as `crashed` (RideViewer shows
 *  the crash status); a FATAL pieces compile marks the build `invalid`.
 *  OPTIONAL track pieces (SETUP §5.1): a `pieces` array or piece children
 *  (children win) replace the stock downhill run with a compileTrackPieces
 *  circuit on the same guarded 'bobsled' profile (1.5 g derail physics stay
 *  live — bank absorbs legal layouts); defaults unchanged otherwise. */
export const Bobsleigh: React.FC<ComposableRideProps & { pieces?: TrackPiece[]; children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <BobsleighBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
