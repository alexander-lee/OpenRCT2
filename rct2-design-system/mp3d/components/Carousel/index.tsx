import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, mergedParts, mtx, nightKOf } from '../Stage';
import { buildPeep, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// Merry-go-round matched to the RCT2 MGR1 sprite: a flat conical canopy with
// ORANGE/WHITE pinwheel stripes and a scalloped orange rim, a green+gold
// decorated frieze band, WHITE horses with pink saddles on gold poles, a tan
// wooden deck, and stacked orange ring steps at the base.
export function buildCarouselScene(
  three: typeof THREE,
  opts: { riders?: boolean } = {},
): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
} {
  const group = new three.Group();
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests take the saddles
  const seats: THREE.Group[] = []; // one anchor per horse (seatWorld)
  let vehicle: THREE.Object3D | undefined; // a horse — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const ORANGE = 0xe8641c;
        const CREAM = 0xdad4c8; // canopy white (sprite #d0d0d0)
        const TAN = 0x9a8456; // deck wood (sprite #605030 lit)
        const GREEN = 0x4c6e30; // frieze trim
        const GOLD = 0xd8b040;
        const HORSE = 0xf0ece4; // white horses
        const SADDLE = 0xd6338c; // pink saddles

        // stacked orange ring steps at the base (sprite shows 2-3 ledges);
        // each tier sinks 0.005-0.01 into the one below — no coplanar seams
        g.add(cyl(t, 1.78, 1.86, 0.1, ORANGE, [0, 0.05, 0], { tex: 'plastic', repeat: [12, 1], rough: 0.7, seg: 36 }));
        g.add(cyl(t, 1.68, 1.76, 0.1, 0xc44a14, [0, 0.14, 0], { tex: 'plastic', repeat: [12, 1], rough: 0.7, seg: 36 }));
        g.add(cyl(t, 1.6, 1.66, 0.08, ORANGE, [0, 0.225, 0], { tex: 'plastic', repeat: [12, 1], rough: 0.7, seg: 36 }));

        const ride = new t.Group();
        g.add(ride);
        // tan wooden deck (0.26..0.36, sunk 0.005 into the top step)
        ride.add(cyl(t, 1.52, 1.52, 0.1, TAN, [0, 0.31, 0], { tex: 'wood', repeat: [10, 1], rough: 0.85, seg: 36 }));
        // centre drum, gold-trimmed with mirrored panels (0.355..1.905, into the deck)
        ride.add(cyl(t, 0.34, 0.34, 1.55, 0xb8a070, [0, 1.13, 0], { tex: 'wood', repeat: [6, 2], rough: 0.7, seg: 20 }));
        // BATCHED (perf wave 12): 8 mirrored drum panels, one mesh
        const panelSpecs: { dims: [number, number, number]; pos: [number, number, number]; rotY: number }[] = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          panelSpecs.push({ dims: [0.1, 0.5, 0.02], pos: [Math.cos(a) * 0.35, 1.05, Math.sin(a) * 0.35], rotY: Math.PI / 2 - a }); // thickness radial: panel lies FLUSH on the drum (0.34..0.36)
        }
        ride.add(mergedBoxes(t, panelSpecs, GOLD, { metal: 0.6, rough: 0.3 }));

        // pinwheel canopy: alternating orange/white wedge segments (flat cone).
        // BATCHED: the 16 wedges are static in the ride frame and use only TWO
        // materials, so they merge into two meshes (was 16 meshes / 16 draws).
        const SEGS = 16;
        const wedgeParts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[][] = [[], []];
        for (let i = 0; i < SEGS; i++) {
          const a0 = (i / SEGS) * Math.PI * 2;
          wedgeParts[i % 2].push({
            geo: new t.CylinderGeometry(0.04, 1.78, 0.5, 3, 1, false, a0, (Math.PI * 2) / SEGS),
            matrix: mtx(t, [0, 2.12, 0]),
          });
        }
        wedgeParts.forEach((parts, i) => {
          const wedge = mergedParts(t, parts, mat(t, i ? ORANGE : CREAM, { tex: 'fabric', repeat: [2, 2], rough: 0.6 }));
          wedge.castShadow = false; // sun reaches the horses — the deck reads in daylight
          ride.add(wedge);
        });
        // scalloped orange rim band under the canopy edge (shadows off, same reason)
        const band = cyl(t, 1.8, 1.8, 0.1, ORANGE, [0, 1.88, 0], { tex: 'plastic', repeat: [12, 1], rough: 0.6, seg: 36 });
        band.castShadow = false;
        ride.add(band);
        {
          // BATCHED: 18 rim scallops, one mesh (same balls, same places)
          const scGeo = new t.IcosahedronGeometry(0.08, 1); // == ball(0.08, { flat: true })
          const scParts = Array.from({ length: 18 }, (_, i) => {
            const a = (i / 18) * Math.PI * 2;
            return { geo: scGeo, matrix: mtx(t, [Math.cos(a) * 1.8, 1.82, Math.sin(a) * 1.8]) };
          });
          const scallops = mergedParts(t, scParts, mat(t, ORANGE, { flat: true, rough: 0.6 }), false);
          scallops.castShadow = false;
          ride.add(scallops);
          scGeo.dispose();
        }
        // green + gold frieze ring — chained with 0.005 overlaps into the rim band
        ride.add(cyl(t, 1.72, 1.72, 0.07, GREEN, [0, 1.8, 0], { rough: 0.7, seg: 36 })); // 1.765..1.835 into the band (1.83..1.93)
        ride.add(cyl(t, 1.74, 1.74, 0.03, GOLD, [0, 1.755, 0], { metal: 0.6, rough: 0.3, seg: 36 })); // 1.74..1.77 into the frieze
        // finial on top
        ride.add(cyl(t, 0.02, 0.02, 0.5, GOLD, [0, 2.55, 0], { metal: 0.7, rough: 0.3, seg: 8 }));
        ride.add(ball(t, 0.09, GOLD, [0, 2.8, 0], { metal: 0.7, rough: 0.3 }));
        // night lighting: canopy-edge bulb row half-embedded in the rim band
        // (band r 1.8 spans y 1.83..1.93; bulbs at r 1.81, y 1.88, offset 10deg
        // from the scallops) + two warm centre-glow lights under the canopy
        const bulbGeo = new t.SphereGeometry(0.045, 10, 8);
        const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
        {
          // BATCHED: the 18 bulbs already shared ONE material (its
          // emissiveIntensity is the night gate below), so merging their
          // geometry keeps the gate working and drops 17 draws.
          const bulbParts = Array.from({ length: 18 }, (_, i) => {
            const a = ((i + 0.5) / 18) * Math.PI * 2;
            return { geo: bulbGeo, matrix: mtx(t, [Math.cos(a) * 1.81, 1.88, Math.sin(a) * 1.81]) };
          });
          const bulbs = mergedParts(t, bulbParts, bulbMat, false);
          bulbs.castShadow = false;
          bulbs.receiveShadow = false;
          ride.add(bulbs);
          bulbGeo.dispose();
        }
        const nightLights: THREE.PointLight[] = [];
        [-0.6, 0.6].forEach((x) => {
          const pl = new t.PointLight(0xffc97a, 0, 5.5, 2);
          pl.position.set(x, 1.55, 0);
          ride.add(pl);
          nightLights.push(pl);
        });

        // 8 white horses with pink saddles on gold poles, alternating riders
        const horses: { grp: THREE.Group; ph: number }[] = [];
        const N = 8;
        // BATCHED: the 8 fixed gold poles are static in the ride frame — one mesh
        const poleGeo = new t.CylinderGeometry(0.022, 0.022, 1.7, 10);
        const poleParts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2;
          const hg = new t.Group();
          hg.position.set(Math.cos(a) * 1.12, 0.92, Math.sin(a) * 1.12);
          hg.rotation.y = -a + Math.PI / 2;
          // FIXED pole in the ride frame (the horse slides on it): 0.30..2.00 —
          // buried in the deck (0.26..0.36) and ending 0.06 under the canopy
          // slope at radius 1.12 (surface y = 1.87 + (1.78-1.12)/1.74*0.5 = 2.06)
          poleParts.push({ geo: poleGeo, matrix: mtx(t, [Math.cos(a) * 1.12, 1.15, Math.sin(a) * 1.12]) });
          // horse: body, chest, neck, head, muzzle, legs mid-gallop, tail.
          // BATCHED per horse: the 13 parts are rigid relative to each other
          // (only the whole horse bobs), so they collapse to THREE meshes by
          // colour — 104 meshes across the ride became 24. Same boxes, same
          // rotations, same colours; the chest ball keeps its smooth detail.
          const hide: { dims: [number, number, number]; pos: [number, number, number]; rotZ?: number }[] = [
            { dims: [0.48, 0.2, 0.17], pos: [0, 0, 0] },
            { dims: [0.13, 0.24, 0.12], pos: [0.27, 0.17, 0], rotZ: -0.3 }, // neck
            { dims: [0.18, 0.11, 0.11], pos: [0.37, 0.3, 0] }, // head
            // galloping legs (front pair forward, rear pair back)
            { dims: [0.05, 0.24, 0.05], pos: [0.19, -0.19, 0.05], rotZ: 0.5 },
            { dims: [0.05, 0.24, 0.05], pos: [0.19, -0.19, -0.05], rotZ: 0.3 },
            { dims: [0.05, 0.24, 0.05], pos: [-0.19, -0.19, 0.05], rotZ: -0.5 },
            { dims: [0.05, 0.24, 0.05], pos: [-0.19, -0.19, -0.05], rotZ: -0.3 },
          ];
          const trim: { dims: [number, number, number]; pos: [number, number, number]; rotZ?: number }[] = [
            { dims: [0.09, 0.07, 0.08], pos: [0.46, 0.28, 0] }, // muzzle
            { dims: [0.14, 0.05, 0.04], pos: [-0.29, 0.06, 0], rotZ: 0.5 }, // tail
          ];
          const tack: { dims: [number, number, number]; pos: [number, number, number] }[] = [
            { dims: [0.28, 0.05, 0.02], pos: [-0.02, 0.11, 0.09] }, // saddle blanket
            { dims: [0.28, 0.05, 0.02], pos: [-0.02, 0.11, -0.09] },
            { dims: [0.2, 0.05, 0.17], pos: [-0.02, 0.12, 0] }, // saddle
          ];
          hg.add(mergedBoxes(t, hide, HORSE, { rough: 0.55 }));
          hg.add(mergedBoxes(t, trim, 0xd8cfc0, { rough: 0.55 }));
          hg.add(mergedBoxes(t, tack, SADDLE, { rough: 0.6 }));
          hg.add(ball(t, 0.11, HORSE, [0.24, 0.02, 0], { rough: 0.55 })); // chest
          // saddle anchor — rides the galloping horse; REAL GameManager guests
          // land here via seatWorld (one seat per horse)
          const seat = new t.Group();
          seat.position.set(-0.06, -0.04, 0); // hips on the saddle, just behind the pole
          seat.rotation.y = Math.PI / 2; // face the horse's head
          hg.add(seat);
          seats.push(seat);
          if (withRiders && i % 2 === 0) {
            const p = buildPeep(t, { skin: SKIN_TONES[(i / 2) % SKIN_TONES.length], shirt: [0x3aa0e0, 0xe0a020, 0x2e9e54, 0xd6338c][(i / 2) % 4], seated: true });
            p.group.scale.setScalar(0.42);
            seat.add(p.group);
          }
          ride.add(hg);
          horses.push({ grp: hg, ph: a });
        }
        ride.add(mergedParts(t, poleParts, mat(t, GOLD, { tex: 'metal', metal: 0.85, rough: 0.2 }), false));
        poleGeo.dispose();
        vehicle = horses[0].grp;
        return (time) => {
          // day -> night gate: canopy bulbs + centre glow rise as it darkens
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          bulbMat.emissiveIntensity = 0.15 + (1.25 + 0.12 * Math.sin(time * 2.7) - 0.15) * ease;
          nightLights.forEach((pl) => (pl.intensity = ease * 1.0));
          ride.rotation.y = time * 0.55;
          horses.forEach((hh) => (hh.grp.position.y = 0.92 + Math.sin(time * 3 + hh.ph * 2) * 0.11));
        };
      })(three, group) || undefined;
  // station gate (RCT2: the carousel is PARKED while guests mount the horses
  // and only turns departing→arriving)
  const gate = createMotionGate((tt) => update?.(tt));
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange: gate.onStateChange };
}

/** <Carousel> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 8 = the 8 horses: REAL guests ride the
 *  saddles via `seatWorld` (decorative riders off when registered) and the
 *  deck is motion-gated — parked for boarding/unloading. Override with
 *  top-level props / `queue`. */
export const Carousel = composableRide<{ riders?: boolean }>(
  'Carousel',
  (t, props) => buildCarouselScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Carousel', capacity: 8, rideDuration: 8, intensity: 2, price: 2 } },
);
