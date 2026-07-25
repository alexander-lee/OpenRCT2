import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { computeSplineFrames } from '../SplineCoaster';
import { compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// Chairlift matched to the RCT2 CLIFT1 sprite: ORANGE bucket cabins with a
// little flag on the hanger, gliding along a cable strung between two lattice
// pylons with sheave wheels. Optional `pieces` (SETUP §5.1) swap the stock
// out-and-back loop for a compileTrackPieces circuit — the vocabulary is
// strictly HORIZONTAL (station/straight/turnL/turnR/sbend, everything else
// stripped with a warn): chairlifts here never ramp up or down; only the
// CABLE sags a shallow catenary belly between the line towers.

/** one bucket cabin, hanger at the group origin ON the cable line: rod +
 *  yellow flag, bucket shell + rim, a properly UPHOLSTERED interior (see
 *  below), safety bar and cabin lamp, and a seated guest on two of every three
 *  cabins. Shared by the stock loop and piece-composed courses (identical
 *  geometry either way).
 *
 *  UPHOLSTERY (the CoasterCar pattern — dark shell, fabric-textured cushions
 *  proud of it): the bucket shell is an OPEN cone (no lid) so the interior is
 *  actually visible; inside it a dark moulded seat pan holds a DOMED fabric
 *  squab (crown −0.585) with a rolled nose under the knees, and a dark reclined
 *  backrest shell carries a padded fabric backrest flanked by two bolster ROLLS,
 *  capped by a head roll and joined to the squab by a lumbar roll. Every pad
 *  interpenetrates its neighbour, so nothing floats. Saddle-tan fabric so the
 *  padding reads against the red bucket. The seat anchor puts the rider's hips
 *  0.005 INTO the squab crown and their hands ON the safety bar. */
function buildBucket(
  t: typeof THREE,
  i: number,
  bulbMat: THREE.MeshStandardMaterial,
  orange: number,
  withRiders: boolean,
  seats: THREE.Group[],
): THREE.Group {
  const SHELL = 0x34383e; // dark charcoal moulded seat shell
  const CUSH = 0x8a7150; // upholstery fabric — muted saddle tan, so the padding READS against the red bucket
  const STEEL = 0x2c2c30;
  const b = new t.Group();
  b.add(cyl(t, 0.015, 0.015, 0.6, 0x3a3a40, [0, -0.254, -0.159], { metal: 0.6, rough: 0.35, seg: 6, rotX: 0.56 })); // hanger rod: cable (0,0,0) down INTO the rim ring at (0,−0.508,−0.319)
  b.add(box(t, [0.05, 0.12, 0.02], 0xe8c020, [0.03, -0.06, -0.03], { rough: 0.6 })); // yellow flag on the rod
  // OPEN bucket shell: a double-sided cone WITHOUT end caps, so the mouth is
  // genuinely open and the upholstery inside is visible from every orbit angle
  // (a capped cyl() shell hid the whole interior behind a lid).
  const shellMat = mat(t, orange, { tex: 'plastic', repeat: [5, 1], rough: 0.45 });
  shellMat.side = t.DoubleSide;
  const shell = new t.Mesh(new t.CylinderGeometry(0.3, 0.22, 0.4, 20, 1, true), shellMat);
  shell.position.set(0, -0.68, 0);
  shell.castShadow = true;
  shell.receiveShadow = true;
  b.add(shell);
  b.add(cyl(t, 0.225, 0.225, 0.03, 0x7a1a1a, [0, -0.865, 0], { tex: 'plastic', rough: 0.5, seg: 20 })); // bucket floor closing the cone
  const rimGeo = new t.TorusGeometry(0.305, 0.028, 8, 28); // rim as a RING, not a lid
  rimGeo.rotateX(Math.PI / 2);
  const rim = new t.Mesh(rimGeo, mat(t, 0x8a1f1f, { rough: 0.5 }));
  rim.position.y = -0.487;
  rim.castShadow = true;
  rim.receiveShadow = true;
  b.add(rim);
  // --- upholstery: dark moulded shell + plump fabric padding ----------------
  b.add(cyl(t, 0.2, 0.19, 0.08, SHELL, [0, -0.665, 0], { tex: 'plastic', repeat: [4, 1], rough: 0.5, seg: 18 })); // moulded seat pan, top −0.625
  const cushion = ball(t, 0.19, CUSH, [0, -0.638, 0.01], { tex: 'fabric', repeat: [3, 2], rough: 0.95, bump: 0.03 });
  cushion.scale.set(1, 0.28, 1); // DOMED squab −0.691..−0.585: plump, crown at the hip contact line, foot buried in the pan
  b.add(cushion);
  b.add(cyl(t, 0.033, 0.033, 0.22, CUSH, [0, -0.6, 0.15], { rotZ: Math.PI / 2, tex: 'fabric', repeat: [3, 1], rough: 0.95, bump: 0.03, seg: 12 })); // rolled cushion nose under the knees
  b.add(box(t, [0.24, 0.29, 0.05], SHELL, [0, -0.515, -0.135], { tex: 'plastic', repeat: [2, 2], rough: 0.5, rotX: -0.1 })); // reclined backrest shell −0.662..−0.368 (shoulder height), foot WELDED through the squab into the pan
  b.add(box(t, [0.2, 0.25, 0.05], CUSH, [0, -0.505, -0.085], { tex: 'fabric', repeat: [2, 2], rough: 0.95, bump: 0.03, rotX: -0.1 })); // padded BACKREST, back face flush on the shell, foot buried in the squab
  [-0.105, 0.105].forEach((x) => b.add(cyl(t, 0.03, 0.03, 0.25, CUSH, [x, -0.505, -0.075], { rotX: -0.1, tex: 'fabric', repeat: [1, 3], rough: 0.95, bump: 0.03, seg: 12 }))); // bolster ROLLS hugging the rider's sides
  b.add(cyl(t, 0.032, 0.032, 0.19, CUSH, [0, -0.578, -0.05], { rotZ: Math.PI / 2, tex: 'fabric', repeat: [3, 1], rough: 0.95, bump: 0.03, seg: 12 })); // lumbar roll bridging squab -> backrest
  b.add(cyl(t, 0.03, 0.03, 0.22, CUSH, [0, -0.375, -0.1], { rotZ: Math.PI / 2, tex: 'fabric', repeat: [3, 1], rough: 0.95, bump: 0.03, seg: 12 })); // padded head roll capping the shell, just clear of the rider's head
  // safety bar: ONE foam-sleeved restraint at the rider's hands on two side arms
  b.add(cyl(t, 0.013, 0.013, 0.3, STEEL, [0, -0.493, 0.12], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.35, seg: 8 }));
  b.add(cyl(t, 0.028, 0.028, 0.21, 0x3a2a30, [0, -0.493, 0.12], { rotZ: Math.PI / 2, rough: 0.95, seg: 10 })); // foam sleeve right under the rider's hands
  [-0.13, 0.13].forEach((x) => b.add(cyl(t, 0.01, 0.01, 0.235, STEEL, [x, -0.505, 0.01], { rotX: 1.456, metal: 0.6, rough: 0.35, seg: 6 }))); // side arm: bar -> backrest shell
  const cabinLamp = new t.Mesh(new t.SphereGeometry(0.035, 10, 8), bulbMat);
  cabinLamp.position.set(0, -0.51, 0.295); // half-buried in the shell wall (radius 0.294 at this height)
  b.add(cabinLamp);
  // bucket anchor — REAL GameManager guests ride the circulating cabins via
  // seatWorld (chairlifts never stop: guests board the moving chairs)
  const seat = new t.Group();
  seat.position.set(0, -0.743, 0.01); // hip underside (−0.590) settles 0.005 INTO the box cushion top (−0.585)
  b.add(seat);
  seats.push(seat);
  if (withRiders && i % 3 !== 2) {
    const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[(i + 2) % SHIRTS.length], seated: true });
    p.group.scale.setScalar(0.34);
    seat.add(p.group);
  }
  return b;
}

export function buildChairliftScene(
  three: typeof THREE,
  opts: { pieces?: TrackPiece[]; riders?: boolean } = {},
): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
} {
  const group = new three.Group();
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests ride the buckets
  const seatAnchors: THREE.Group[] = []; // one anchor per bucket (seatWorld)
  let vehicle: THREE.Object3D | undefined; // a bucket cabin — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, gg: THREE.Group) => {
        const ORANGE = 0xc23434; // classic red gondola buckets
        // shared night-bulb material: pylon/terminal lamps + cabin lamps
        const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });

        if (opts.pieces) {
          // ---- PIECE-COMPOSED COURSE: horizontal-only circuit --------------
          // legal vocabulary: station/straight(flat)/turnL/turnR/sbend — any
          // vertical or inverting piece is stripped with a warn (chairlifts
          // never ramp; the cable alone sags visually between towers)
          const LEGAL = new Set(['station', 'flat', 'straight', 'turnL', 'turnR', 'sbend']);
          const flat: TrackPiece[] = [];
          opts.pieces.forEach((p, i) => {
            const ty = typeof p === 'string' ? p : p.type;
            if (LEGAL.has(ty)) flat.push(p);
            else console.warn(`Chairlift: stripped piece '${ty}' (piece ${i}) — chairlift courses are horizontal (station/straight/turnL/turnR/sbend)`);
          });
          const CABLE_Y = 2.32; // the stock loop's cable line (cableY 2.4 − 0.08)
          const compiled = compileTrackPieces(flat, { profile: 'monorail', start: [0, CABLE_Y, 0] });
          gg.userData.trackReport = compiled.report;
          const fb = computeSplineFrames(t, compiled.points, { bank: 0 });

          // line towers roughly every 2.8 arc-units (index 0 is the drive
          // terminal); the rope sags a shallow catenary belly between them
          const K = Math.max(4, Math.round((2.8 * fb.N) / fb.total));
          const towerU: number[] = [];
          for (let i = 0; i + K * 0.6 < fb.N; i += K) towerU.push(i / fb.N);
          const SAG = 0.07;
          const sagAt = (uRaw: number) => {
            const u = ((uRaw % 1) + 1) % 1;
            let j = 0;
            for (let k = 0; k < towerU.length; k++) if (towerU[k] <= u) j = k;
            const u0 = towerU[j];
            const u1 = j + 1 < towerU.length ? towerU[j + 1] : 1;
            return SAG * Math.sin(Math.PI * ((u - u0) / Math.max(1e-6, u1 - u0)));
          };

          // towers: mast OFFSET beside the line (local +x) with a cantilever
          // arm reaching over the rope, so passing cabins (radius 0.32 +
          // sway) always clear the column at 0.55
          const pylonLights: { intensity: number }[] = [];
          const midU = towerU.reduce((best, tu) => (Math.abs(tu - 0.5) < Math.abs(best - 0.5) ? tu : best), 0);
          towerU.forEach((tu, ti) => {
            const f = fb.frameAt(tu);
            const tower = new t.Group();
            tower.position.set(f.p.x, 0, f.p.z);
            tower.rotation.y = Math.atan2(f.fwd.x, f.fwd.z);
            const armY = f.p.y + 0.12;
            if (ti === 0) {
              // drive terminal at the station piece: beefier mast, a flat
              // drive bullwheel under the arm and a boarding deck beside the
              // line at cabin-floor height (cable − 0.88)
              tower.add(box(t, [0.5, 0.2, 1.3], 0x8a8f98, [0.55, 0.1, 0], { tex: 'concrete', repeat: [2, 3], rough: 0.9 }));
              tower.add(cyl(t, 0.09, 0.12, armY, 0x9aa0a8, [0.55, armY / 2, 0], { tex: 'metal', metal: 0.5, rough: 0.4, seg: 12 }));
              tower.add(box(t, [0.85, 0.08, 0.3], 0x9aa0a8, [0.18, armY, 0], { metal: 0.5, rough: 0.4 })); // cantilever arm over the rope
              tower.add(cyl(t, 0.3, 0.3, 0.035, 0x2c2c30, [0, armY - 0.08, 0], { metal: 0.5, rough: 0.4, seg: 28 })); // drive bullwheel
              tower.add(cyl(t, 0.07, 0.07, 0.12, 0x3a3a40, [0, armY - 0.08, 0], { metal: 0.6, rough: 0.35, seg: 12 })); // hub
              const deckY = f.p.y - 0.92;
              tower.add(box(t, [0.7, 0.08, 2.0], 0x8a6a3c, [0.9, deckY, 0], { tex: 'wood', repeat: [2, 6], rough: 0.9 })); // boarding deck
              [-0.8, 0.8].forEach((dz) => tower.add(cyl(t, 0.05, 0.06, deckY, 0x5a3d22, [0.9, deckY / 2, dz], { tex: 'wood', rough: 1, seg: 8 })));
            } else {
              tower.add(box(t, [0.44, 0.16, 0.44], 0x8a8f98, [0.55, 0.08, 0], { tex: 'concrete', repeat: [2, 2], rough: 0.9 }));
              tower.add(cyl(t, 0.07, 0.1, armY, 0x9aa0a8, [0.55, armY / 2, 0], { tex: 'metal', metal: 0.5, rough: 0.4, seg: 12 }));
              tower.add(box(t, [0.78, 0.07, 0.14], 0x9aa0a8, [0.2, armY, 0], { metal: 0.5, rough: 0.4 })); // cantilever arm
              tower.add(cyl(t, 0.07, 0.07, 0.05, 0x2c2c30, [0, f.p.y + 0.06, 0], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.35, seg: 14 })); // sheave wheel riding the rope
            }
            // night lamps: bulbs on the terminal + the far-side tower, each
            // with a REAL light (2 PointLights total, same as the stock loop)
            if (ti === 0 || tu === midU) {
              const lamp = new t.Mesh(new t.SphereGeometry(0.04, 10, 8), bulbMat);
              lamp.position.set(0.2, armY + 0.075, 0);
              tower.add(lamp);
              const pl = new t.PointLight(0xffc97a, 0, 4.5, 2);
              pl.position.set(0.2, armY - 0.2, 0);
              tower.add(pl);
              pylonLights.push(pl);
            }
            gg.add(tower);
          });

          // the cable itself: one closed tube through the sagged line
          const cablePts: THREE.Vector3[] = [];
          for (let i = 0; i < fb.N; i++) {
            const f = fb.frames[i];
            cablePts.push(new t.Vector3(f.p.x, f.p.y - sagAt(i / fb.N), f.p.z));
          }
          const cable = new t.Mesh(
            new t.TubeGeometry(new t.CatmullRomCurve3(cablePts, true), 480, 0.015, 6),
            new t.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.7, roughness: 0.3 }),
          );
          cable.castShadow = true;
          gg.add(cable);

          // cabins: same spacing density as the stock loop (~1 per 2.65 units)
          const nB = Math.max(4, Math.min(14, Math.round(fb.total / 2.65)));
          const buckets: THREE.Group[] = [];
          for (let i = 0; i < nB; i++) {
            const b = buildBucket(t, i, bulbMat, ORANGE, withRiders, seatAnchors);
            gg.add(b);
            buckets.push(b);
          }
          vehicle = buckets[0];
          return (time: number) => {
            const nk = nightKOf(gg);
            const ease = nk * nk * (3 - 2 * nk); // smoothstep
            bulbMat.emissiveIntensity = 0.15 + (1.15 - 0.15) * ease;
            pylonLights.forEach((pl) => (pl.intensity = ease * 0.85));
            buckets.forEach((b, i) => {
              const u = (time * 0.7) / fb.total + i / nB; // same 0.7 u/s glide
              const f = fb.frameAt(u);
              b.position.set(f.p.x, f.p.y - sagAt(u), f.p.z); // hangs off the sagged rope
              b.rotation.y = Math.atan2(f.fwd.x, f.fwd.z);
              b.rotation.z = Math.sin(time * 2 + i) * 0.06; // gentle sway
            });
          };
        }

        // ---- DEFAULT: the classic out-and-back loop (unchanged) ------------
        // yaw the whole ride 45 deg: the Stage camera orbits from azimuth 45°,
        // so this lays the cable run across the screen instead of end-on
        const g = new t.Group();
        g.rotation.y = Math.PI / 4;
        gg.add(g);
        const RUN = 6.4;
        const cableY = 2.4;
        const W = 0.5; // half-width of the cable LOOP (bullwheel radius)
        // pylons: concrete base, column, crossarm spanning the loop and a flat
        // BULLWHEEL disc the cable wraps — a real out-and-back chairlift loop
        [-1, 1].forEach((s) => {
          const x = s * (RUN / 2);
          g.add(box(t, [0.5, 0.2, 1.3], 0x8a8f98, [x, 0.1, 0], { tex: 'concrete', repeat: [2, 3], rough: 0.9 }));
          g.add(cyl(t, 0.09, 0.12, cableY, 0x9aa0a8, [x, cableY / 2, 0], { tex: 'metal', metal: 0.5, rough: 0.4, seg: 12 }));
          g.add(box(t, [0.2, 0.08, 1.2], 0x9aa0a8, [x, cableY, 0], { metal: 0.5, rough: 0.4 })); // crossarm over the bullwheel
          g.add(cyl(t, W + 0.02, W + 0.02, 0.035, 0x2c2c30, [x, cableY - 0.08, 0], { metal: 0.5, rough: 0.4, seg: 28 })); // bullwheel
          g.add(cyl(t, 0.07, 0.07, 0.12, 0x3a3a40, [x, cableY - 0.08, 0], { metal: 0.6, rough: 0.35, seg: 12 })); // hub
        });
        // cable loop: two straight strands + half-torus wraps around each bullwheel
        [-W, W].forEach((z) => g.add(cyl(t, 0.015, 0.015, RUN, 0x3a3a40, [0, cableY - 0.08, z], { rotZ: Math.PI / 2, metal: 0.7, rough: 0.3, seg: 6 })));
        [-1, 1].forEach((s) => {
          const geo = new t.TorusGeometry(W, 0.015, 6, 32, Math.PI);
          geo.rotateX(Math.PI / 2); // into the horizontal plane
          const arc = new t.Mesh(geo, new t.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.7, roughness: 0.3 }));
          arc.position.set(s * (RUN / 2), cableY - 0.08, 0);
          arc.rotation.y = (s * Math.PI) / 2; // bulge outward past the pylon
          arc.castShadow = true;
          g.add(arc);
        });
        // night lighting: lamp on each pylon crossarm (arm top 2.45; bulb
        // bottoms 2.42 embed) + a real light per pylon; cabin lamps on the
        // buckets are added below and travel with them
        const bulbGeo = new t.SphereGeometry(0.04, 10, 8);
        const pylonLights: { intensity: number }[] = [];
        [-1, 1].forEach((s) => {
          const lamp = new t.Mesh(bulbGeo, bulbMat);
          lamp.position.set(s * (RUN / 2), cableY + 0.06, 0);
          g.add(lamp);
          const pl = new t.PointLight(0xffc97a, 0, 4.5, 2);
          pl.position.set(s * (RUN / 2), cableY - 0.15, 0);
          g.add(pl);
          pylonLights.push(pl);
        });
        // buckets: 6 evenly spaced around the loop, 4 ridden + 2 empty (the
        // empty ones show off the padded seat), each with a grab bar
        const buckets: THREE.Group[] = [];
        for (let i = 0; i < 6; i++) {
          const b = buildBucket(t, i, bulbMat, ORANGE, withRiders, seatAnchors);
          g.add(b);
          buckets.push(b);
        }
        vehicle = buckets[0];
        // stadium loop the buckets ride: straights at z = ±W, semicircle wraps
        // around each bullwheel — continuous, no teleporting wrap
        const PERIM = 2 * RUN + 2 * Math.PI * W;
        const placeAt = (b: THREE.Group, sRaw: number) => {
          const s = ((sRaw % PERIM) + PERIM) % PERIM;
          const R2 = RUN / 2;
          if (s < RUN) {
            b.position.set(-R2 + s, cableY - 0.08, W);
            b.rotation.y = Math.PI / 2; // travelling +x
          } else if (s < RUN + Math.PI * W) {
            const a = (s - RUN) / W;
            b.position.set(R2 + W * Math.sin(a), cableY - 0.08, W * Math.cos(a));
            b.rotation.y = Math.atan2(Math.cos(a), -Math.sin(a));
          } else if (s < 2 * RUN + Math.PI * W) {
            b.position.set(R2 - (s - RUN - Math.PI * W), cableY - 0.08, -W);
            b.rotation.y = -Math.PI / 2; // travelling -x
          } else {
            const a = (s - 2 * RUN - Math.PI * W) / W;
            b.position.set(-R2 - W * Math.sin(a), cableY - 0.08, -W * Math.cos(a));
            b.rotation.y = Math.atan2(-Math.cos(a), Math.sin(a));
          }
        };
        // ground scenery so the ride reads as transit
        g.add(ball(t, 0.5, 0x6f8f3a, [-1.4, 0.5, 1.4], { tex: 'leaf', repeat: [3, 3], flat: true, rough: 1 }));
        g.add(cyl(t, 0.08, 0.12, 0.8, 0x5a3d22, [-1.4, 0.3, 1.4], { tex: 'wood', repeat: [2, 2], rough: 1, seg: 8 }));
        g.add(ball(t, 0.42, 0x6f8f3a, [1.6, 0.42, -1.3], { tex: 'leaf', repeat: [3, 3], flat: true, rough: 1 })); // second shrub balances the far side
        g.add(cyl(t, 0.07, 0.1, 0.7, 0x5a3d22, [1.6, 0.25, -1.3], { tex: 'wood', repeat: [2, 2], rough: 1, seg: 8 }));
        const rock = ball(t, 0.22, 0x8d8d90, [0.7, 0.1, 1.2], { tex: 'concrete', repeat: [2, 2], flat: true, rough: 1 });
        rock.scale.set(1.3, 0.6, 1);
        g.add(rock);
        return (time) => {
          // day -> night gate: pylon + cabin lamps rise as the Stage darkens
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          bulbMat.emissiveIntensity = 0.15 + (1.15 - 0.15) * ease;
          pylonLights.forEach((pl) => (pl.intensity = ease * 0.85));
          buckets.forEach((b, i) => {
            placeAt(b, time * 0.7 + (i * PERIM) / 6);
            b.rotation.z = Math.sin(time * 2 + i) * 0.06; // gentle sway
          });
        };
      })(three, group) || undefined;
  // NOTE: deliberately NO motion gate (real chairlifts never stop — guests
  // board the moving buckets); real guests still ride via seatWorld
  return { group, update, vehicle, seatWorld: makeSeatWorld(three, seatAnchors) };
}

// EXCEPTION to the fleet-wide motion gate: real chairlifts NEVER stop — the
// cable keeps circulating and guests board the moving chairs, so the update
// is deliberately left ungated. REAL guests still ride the buckets via
// seatWorld (capacity 6 = the stock loop's 6 buckets; decorative riders off
// when registered).
const ChairliftBase = composableRide<{ pieces?: TrackPiece[]; riders?: boolean }>(
  'Chairlift',
  (t, props) => buildChairliftScene(t, { pieces: props.pieces, riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Chairlift', capacity: 6, rideDuration: 10, intensity: 2, price: 3 } },
);

/** <Chairlift> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Override with top-level props / `queue`.
 *  OPTIONAL track pieces (SETUP §5.1): a `pieces` array or piece children
 *  (`<Station/><Straight/><TurnL angle={120}/>` — children win) replace the
 *  stock out-and-back loop with a piece-composed cable circuit. The
 *  vocabulary is strictly HORIZONTAL — station/straight/turnL/turnR/sbend;
 *  lift/drop/hill/helix/corkscrew are stripped with a console.warn (no
 *  up/down ramps — only the cable sags between towers). Defaults are
 *  unchanged when neither is given. */
export const Chairlift: React.FC<ComposableRideProps & { pieces?: TrackPiece[]; riders?: boolean; children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <ChairliftBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
