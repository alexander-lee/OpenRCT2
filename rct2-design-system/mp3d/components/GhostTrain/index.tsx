import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mergedBoxes, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// Ghost Train dark ride modelled on the RCT2 Ghost Train: a small enclosed
// show building (dark stepped-gable walls, geometric skull sign, flap doors at
// the entry and exit) with a closed CatmullRom circuit that runs THROUGH the
// building and dips outdoors through a mini graveyard — original tombstones, a
// dead tree and a rusty iron fence. A 3-car train (2-seat cars, lamp on the
// lead car) stays glued to the rails via a minimal local spline runner; a
// white ghost sheet bobs deterministically inside a barred window. Night is
// eerie green: interior door-glow, graveyard wash and the head-lamp (3 real
// PointLights), with flickering green window panes.
export function buildGhostTrainScene(
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
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests fill the benches
  const seats: THREE.Group[] = []; // 3 cars × 2 bench spots (seatWorld)
  let vehicle: THREE.Object3D | undefined; // the lead car — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, root: THREE.Group) => {
        // THE WHOLE RIDE IS BUILT INSIDE A SCALED SHELL. Every dimension below
        // is authored in the original units and the shell blows the assembly
        // up by RIDE_SCALE, so the show building, the graveyard and the train
        // stay in exact proportion to one another and to the track — the ride
        // just occupies more ground, RCT2-style (the 2×2 dark ride is a 3×3).
        // Two things must NOT scale with it: decorative riders (guests are one
        // size park-wide, so they are pre-divided by RIDE_SCALE) and the queue
        // hut, which <ConfigurableRide> re-places from the measured footprint.
        const RIDE_SCALE = 1.3;
        const g = new t.Group();
        g.scale.setScalar(RIDE_SCALE);
        root.add(g);
        const WALL = 0x4c4360; // dark purple-grey masonry (lifted off near-black: the shaded flank has to keep its buttress/plinth relief readable)
        const TRIMC = 0x241f2b; // near-black timber trim
        const ROOF = 0x323848; // storm-slate
        const DOOR = 0x5a1c22; // blood-red flaps
        const BONE = 0xe8e4da;
        const IRON = 0x2c2c30;

        // ---- track: closed loop through the building + outdoor graveyard dip
        const P = (x: number, y: number, z: number) => new t.Vector3(x, y, z);
        const curve = new t.CatmullRomCurve3(
          [
            P(-1.05, 0.18, -0.65), // inside, past the entry door
            P(-2.1, 0.18, -0.75),
            P(-2.35, 0.18, 0.0), // back-wall sweep
            P(-2.1, 0.18, 0.75),
            P(-1.05, 0.18, 0.65), // heading for the exit door
            P(-0.1, 0.22, 0.92), // burst outdoors
            P(0.9, 0.52, 1.28), // first hump
            P(1.9, 0.4, 0.78),
            P(2.35, 0.12, 0.0), // the graveyard dip
            P(1.9, 0.4, -0.78),
            P(0.9, 0.55, -1.28), // second hump
            P(-0.1, 0.24, -0.92), // approach to the entry door
          ],
          true,
          'catmullrom',
          0.5,
        );
        const trackLen = curve.getLength();

        // ties (sleepers) + support posts on the outdoor sections
        const nTies = Math.floor(trackLen / 0.22);
        for (let i = 0; i < nTies; i++) {
          const u = i / nTies;
          const p = curve.getPointAt(u);
          const tan = curve.getTangentAt(u);
          const tie = box(t, [0.34, 0.035, 0.09], 0x4a3828, [0, 0, 0], { tex: 'wood', repeat: [2, 1], rough: 0.9 });
          const holder = new t.Group();
          holder.position.copy(p);
          holder.lookAt(p.clone().add(tan));
          holder.add(tie);
          g.add(holder);
          if (i % 6 === 0 && p.x > -0.3 && p.y > 0.16) {
            g.add(cyl(t, 0.028, 0.035, p.y, 0x3a3a40, [p.x, p.y / 2 - 0.02, p.z], { metal: 0.4, rough: 0.6, seg: 8 }));
          }
        }
        // twin rails: offset closed curves swept as tubes
        const railMat = new t.MeshStandardMaterial({ color: 0x565b63, metalness: 0.7, roughness: 0.35 });
        [-1, 1].forEach((side) => {
          const pts: THREE.Vector3[] = [];
          const M = 160;
          for (let i = 0; i < M; i++) {
            const u = i / M;
            const p = curve.getPointAt(u);
            const tan = curve.getTangentAt(u);
            const o = new t.Vector3(0, 1, 0).cross(tan).normalize().multiplyScalar(side * 0.085);
            pts.push(p.clone().add(o).add(new t.Vector3(0, 0.028, 0)));
          }
          const railCurve = new t.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
          const rail = new t.Mesh(new t.TubeGeometry(railCurve, 260, 0.023, 8, true), railMat);
          rail.castShadow = true;
          rail.receiveShadow = true;
          g.add(rail);
        });

        // ---- show building (x -2.75..-0.55, z -1.35..1.35, walls 1.5 high) --
        const wallX = -0.55;
        // find where the loop pierces the front wall — the doors go THERE
        const doorZs: number[] = [];
        const samp = curve.getPoints(400);
        for (let i = 0; i < samp.length - 1; i++) {
          if ((samp[i].x - wallX) * (samp[i + 1].x - wallX) < 0) {
            const f = (wallX - samp[i].x) / (samp[i + 1].x - samp[i].x);
            doorZs.push(samp[i].z + (samp[i + 1].z - samp[i].z) * f);
          }
        }
        doorZs.sort((a, b) => a - b); // [entry (z<0), exit (z>0)]
        // front wall in segments around the two 0.6-wide door gaps
        const edges = [-1.35, doorZs[0] - 0.3, doorZs[0] + 0.3, doorZs[1] - 0.3, doorZs[1] + 0.3, 1.35];
        for (let k = 0; k < edges.length; k += 2) {
          const z0 = edges[k];
          const z1 = edges[k + 1];
          if (z1 - z0 > 0.02) g.add(box(t, [0.12, 1.5, z1 - z0], WALL, [wallX, 0.75, (z0 + z1) / 2], { tex: 'concrete', repeat: [3, 4], rough: 0.9 }));
        }
        doorZs.forEach((dz, di) => {
          g.add(box(t, [0.12, 0.55, 0.6], WALL, [wallX, 1.225, dz], { tex: 'concrete', repeat: [2, 2], rough: 0.9 })); // lintel
          // frame + hanging flap doors, swung outward at the exit / inward-ish at the entry
          [-1, 1].forEach((s) => g.add(box(t, [0.16, 0.98, 0.07], DOOR, [wallX, 0.49, dz + s * 0.315], { tex: 'wood', repeat: [1, 3], rough: 0.85 })));
          g.add(box(t, [0.16, 0.09, 0.7], DOOR, [wallX, 0.99, dz], { tex: 'wood', repeat: [3, 1], rough: 0.85 }));
          [-1, 1].forEach((s) => {
            const flap = box(t, [0.03, 0.86, 0.27], 0x6a2028, [0, -0.43, s * 0.145], { tex: 'wood', repeat: [1, 3], rough: 0.9 });
            const hinge = new t.Group();
            hinge.position.set(wallX + 0.08, 0.93, dz + s * 0.28);
            hinge.rotation.y = s * (di === 0 ? -0.55 : 0.55) * -1; // flaps ajar
            hinge.add(flap);
            flap.position.set(0.015, -0.43, -s * 0.145 + s * 0.01);
            g.add(hinge);
          });
        });
        // back + side walls, corner trim
        g.add(box(t, [0.12, 1.5, 2.7], WALL, [-2.75, 0.75, 0], { tex: 'concrete', repeat: [6, 4], rough: 0.9 }));
        [-1, 1].forEach((s) => g.add(box(t, [2.32, 1.5, 0.12], WALL, [-1.65, 0.75, s * 1.35], { tex: 'concrete', repeat: [6, 4], rough: 0.9 })));
        // RELIEF on the flanks: a stone plinth course all the way round, brick
        // buttresses up the long walls and a cast-iron downpipe at the back
        // corner. Without them the flanks are 2.3 × 1.5 slabs of flat colour,
        // which is what made the building read as blocked-out from the side.
        g.add(box(t, [2.5, 0.17, 2.88], 0x372f43, [-1.65, 0.085, 0], { tex: 'concrete', repeat: [8, 1], rough: 0.95 })); // plinth course
        [-1, 1].forEach((s) =>
          [-2.3, -1.65, -1.0].forEach((bx) => {
            g.add(box(t, [0.2, 1.16, 0.14], 0x3c3450, [bx, 0.66, s * 1.42], { tex: 'concrete', repeat: [1, 4], rough: 0.92 })); // buttress
            g.add(box(t, [0.24, 0.07, 0.18], 0x4c455c, [bx, 1.26, s * 1.44], { tex: 'concrete', rough: 0.92 })); // pale stone cap — the only light line on the flank
          }),
        );
        [-1, 1].forEach((s) => {
          g.add(cyl(t, 0.035, 0.035, 1.34, 0x25262b, [-2.71, 0.68, s * 1.24], { metal: 0.45, rough: 0.6, seg: 8 })); // downpipe
          g.add(cyl(t, 0.06, 0.045, 0.12, 0x25262b, [-2.71, 1.4, s * 1.24], { metal: 0.45, rough: 0.6, seg: 8 })); // hopper head
          g.add(cyl(t, 0.045, 0.045, 0.1, 0x25262b, [-2.68, 0.06, s * 1.24], { metal: 0.45, rough: 0.6, seg: 8, rotZ: 1.1 })); // shoe
        });
        // boarded-up side windows + timber wainscot band so the flanks read
        [-1, 1].forEach((s) => {
          g.add(box(t, [2.32, 0.09, 0.13], TRIMC, [-1.65, 0.42, s * 1.35], { tex: 'wood', repeat: [8, 1], rough: 0.9 })); // wainscot band
          [-2.25, -1.05].forEach((wx) => {
            g.add(box(t, [0.42, 0.5, 0.05], 0x14121a, [wx, 0.92, s * 1.39], { rough: 0.8 })); // dark opening
            g.add(box(t, [0.5, 0.06, 0.06], TRIMC, [wx, 1.19, s * 1.4], { tex: 'wood', rough: 0.9 })); // header
            g.add(box(t, [0.5, 0.06, 0.06], TRIMC, [wx, 0.65, s * 1.4], { tex: 'wood', rough: 0.9 })); // sill
            g.add(box(t, [0.52, 0.07, 0.045], 0x7a5c3c, [wx, 0.95, s * 1.41], { tex: 'wood', repeat: [3, 1], rough: 0.95, rotZ: 0.35 })); // nailed board
            g.add(box(t, [0.52, 0.07, 0.045], 0x7a5c3c, [wx, 0.89, s * 1.415], { tex: 'wood', repeat: [3, 1], rough: 0.95, rotZ: -0.3 })); // nailed board
          });
        });
        // COBWEBS in the wall corners — a real quarter-web (radial spokes from
        // the corner plus concentric catenary rings between them), not the two
        // pale diagonal slats this used to hint with. One merged mesh each.
        const cornerWeb = (x: number, y: number, z: number, span: number, sz: 1 | -1, ry: number) => {
          const RINGS = [0.34, 0.62, 0.9];
          const SPOKES = 5;
          const at = (a: number, r: number): [number, number] => [-Math.sin(a) * r * span, sz * Math.cos(a) * r * span];
          const seg = (p: [number, number], q: [number, number]) => {
            const dy = q[0] - p[0];
            const dz = q[1] - p[1];
            const len = Math.hypot(dy, dz);
            return { dims: [0.006, 0.006, len] as [number, number, number], pos: [0, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as [number, number, number], rotX: Math.atan2(dy, dz) };
          };
          const parts = [];
          for (let s = 0; s < SPOKES; s++) {
            const a = (s / (SPOKES - 1)) * (Math.PI / 2);
            parts.push(seg([0, 0], at(a, 1)));
            if (s === SPOKES - 1) continue;
            const b = ((s + 1) / (SPOKES - 1)) * (Math.PI / 2);
            // the rings sag toward the corner between spokes, like a real web
            for (const r of RINGS) parts.push(seg(at(a, r), at(b, r * 0.93)), seg(at(a + (b - a) * 0.5, r * 0.9), at(b, r * 0.93)));
          }
          const web = mergedBoxes(t, parts, 0xc6c9cf, { rough: 0.95, opacity: 0.75 });
          web.position.set(x, y, z);
          web.rotation.y = ry;
          web.castShadow = false;
          g.add(web);
        };
        cornerWeb(-2.78, 1.4, -1.28, 0.42, 1, 0); // back wall, north corner
        cornerWeb(-2.78, 1.4, 1.28, 0.42, -1, 0); // back wall, south corner
        cornerWeb(wallX + 0.07, 1.46, -1.24, 0.34, 1, 0); // facade, beside the gable
        [wallX, -2.75].forEach((x) => [-1.35, 1.35].forEach((z) => g.add(box(t, [0.14, 1.56, 0.14], TRIMC, [x, 0.78, z], { tex: 'wood', repeat: [1, 4], rough: 0.9 }))));
        // gabled slate roof (ridge along z) + stepped Victorian gable ends
        const slopeAng = Math.atan2(0.55, 1.25);
        // each slope is a deck plus five courses of SLATE TABS — 55 little
        // boxes a slope, staggered course to course and sagging on a
        // deterministic wobble, all merged into one draw call per slope. The
        // scalloped shadow line down the roof is most of what makes the
        // building read as built rather than blocked out.
        [
          [-2.26, slopeAng],
          [-1.04, -slopeAng],
        ].forEach(([cx, ang], si) => {
          const slope = new t.Group();
          slope.position.set(cx, 1.78, 0);
          slope.rotation.z = ang;
          slope.add(box(t, [1.42, 0.06, 3.06], ROOF, [0, 0, 0], { tex: 'concrete', repeat: [4, 8], rough: 0.85 }));
          const tabs: { dims: [number, number, number]; pos: [number, number, number]; rotZ?: number }[] = [];
          for (let c = 0; c < 5; c++) {
            const lx = -0.71 + 0.15 + c * 0.28;
            const stagger = c % 2 ? 0.13 : 0; // courses break joint, like real slate
            for (let i = 0; i < 11; i++) {
              const tz = -1.5 + 0.14 + stagger + i * 0.27;
              if (tz > 1.53) continue;
              const h = ((c * 7 + i * 13 + si * 5) % 4) * 0.004; // weathered sag
              tabs.push({ dims: [0.3, 0.028, 0.25], pos: [lx, 0.043 - h, tz], rotZ: ((c + i) % 3) * 0.012 });
            }
          }
          const slate = mergedBoxes(t, tabs, 0x2b3040, { tex: 'concrete', rough: 0.92 });
          slate.castShadow = true;
          slate.receiveShadow = true;
          slope.add(slate);
          g.add(slope);
        });
        g.add(box(t, [0.16, 0.1, 3.1], TRIMC, [-1.65, 2.06, 0], { tex: 'wood', repeat: [8, 1], rough: 0.9 })); // ridge cap
        // wrought-iron ridge cresting: a row of spikes along the ridge
        for (let i = 0; i < 9; i++) {
          const rz = -1.4 + i * 0.35;
          g.add(cyl(t, 0.004, 0.018, 0.16, IRON, [-1.65, 2.19, rz], { metal: 0.5, rough: 0.5, seg: 6 }));
          g.add(ball(t, 0.016, IRON, [-1.65, 2.28, rz], { rough: 0.5 }));
        }
        [-1, 1].forEach((s) => {
          g.add(box(t, [1.5, 0.34, 0.12], WALL, [-1.65, 1.65, s * 1.35], { tex: 'concrete', repeat: [4, 1], rough: 0.9 }));
          g.add(box(t, [0.9, 0.3, 0.12], WALL, [-1.65, 1.95, s * 1.35], { tex: 'concrete', repeat: [3, 1], rough: 0.9 }));
          g.add(box(t, [0.4, 0.26, 0.12], WALL, [-1.65, 2.2, s * 1.35], { tex: 'concrete', repeat: [2, 1], rough: 0.9 }));
          g.add(ball(t, 0.09, TRIMC, [-1.65, 2.38, s * 1.35], { flat: true, rough: 0.85 })); // gable finial
        });
        // crooked chimney on the rear slope
        g.add(box(t, [0.22, 0.78, 0.22], 0x5a3a32, [-2.3, 1.92, -0.7], { tex: 'concrete', repeat: [2, 3], rough: 0.95, rotZ: 0.08 }));
        g.add(box(t, [0.3, 0.09, 0.3], 0x452c26, [-2.33, 2.32, -0.7], { tex: 'concrete', rough: 0.95, rotZ: 0.08 }));

        // ---- facade dressing: skull sign, lanterns, ghost window ------------
        const signZ = (doorZs[0] + doorZs[1]) / 2;

        /**
         * THE SKULL. Second pass, and the rebuild is driven by one observation:
         * at the size this is actually seen — a 0.34-wide sign read across a
         * park, or a 0.1 emblem on a car's nose — the BONE is a pale blob and
         * the only thing carrying the shape is the DARK. So the dark shapes are
         * sized first and the bone is built around them:
         *
         *  - SOCKETS are huge. A real orbit is about a third of the face wide
         *    and nearly as tall; the first pass used 0.05-radius dots on a 0.17
         *    cranium and they read as eyes on a bald head. These are 0.085 wide
         *    × 0.105 tall each, canted inward and down the way orbits sit under
         *    a brow, and sunk so the bone surface cuts the opening.
         *  - The NASAL APERTURE is a real inverted heart — two angled slots
         *    meeting at a septum — not a small cone.
         *  - The TOOTH LINE is read from the GAPS, not the teeth: white teeth on
         *    white bone is invisible, so it is a pale band with dark vertical
         *    slots cut into it, over a dark mouth shadow.
         *
         * The bone is also brighter than the rest of the ride's palette and the
         * cranium is WIDER THAN TALL with a squared brow and a narrowing jaw —
         * the taper is what separates a skull from an egg in silhouette.
         * Built facing +x; `k` scales the whole assembly.
         */
        const buildSkull = (k: number): THREE.Group => {
          const s = new t.Group();
          const PALE = 0xf4f1e8; // brightest bone in the component — it has to pop off the dark board
          const HOLLOW = 0x05050a;
          const cran = ball(t, 0.17 * k, PALE, [0, 0.015 * k, 0], { rough: 0.55 });
          cran.scale.set(0.74, 0.94, 1.0); // wider than tall, shallow front-to-back
          s.add(cran);
          // squared-off brow shelf across the top of both orbits, and the
          // temple flats behind it — the two planes that kill the "egg" read
          s.add(box(t, [0.07 * k, 0.042 * k, 0.235 * k], PALE, [0.088 * k, 0.072 * k, 0], { rough: 0.55 }));
          [-1, 1].forEach((sz) => s.add(box(t, [0.16 * k, 0.2 * k, 0.02 * k], PALE, [0.0, 0.02 * k, sz * 0.152 * k], { rough: 0.6 })));
          s.add(box(t, [0.06 * k, 0.17 * k, 0.22 * k], PALE, [-0.1 * k, 0.01 * k, 0], { rough: 0.6 })); // occiput
          // THE ORBITS — big, canted, and cut into the bone
          [-1, 1].forEach((sz) => {
            const orb = ball(t, 0.062 * k, HOLLOW, [0.072 * k, 0.0, sz * 0.083 * k], { rough: 1 });
            orb.scale.set(0.85, 1.1, 1.0);
            orb.rotation.x = sz * 0.22;
            s.add(orb);
            // the bone bridge between orbit and temple
            s.add(box(t, [0.05 * k, 0.13 * k, 0.035 * k], PALE, [0.09 * k, 0.0, sz * 0.145 * k], { rough: 0.58 }));
          });
          // the nasal bridge between the orbits
          s.add(box(t, [0.06 * k, 0.13 * k, 0.045 * k], PALE, [0.1 * k, 0.01 * k, 0], { rough: 0.55 }));
          // NASAL APERTURE — two slots angled to a septum: an inverted heart
          [-1, 1].forEach((sz) => {
            const nos = box(t, [0.035 * k, 0.075 * k, 0.032 * k], HOLLOW, [0.108 * k, -0.062 * k, sz * 0.024 * k], { rough: 1 });
            nos.rotation.x = -sz * 0.42;
            s.add(nos);
          });
          // cheekbones: zygomatic arches sweeping back under the orbits
          [-1, 1].forEach((sz) => s.add(box(t, [0.055 * k, 0.032 * k, 0.13 * k], PALE, [0.088 * k, -0.055 * k, sz * 0.093 * k], { rough: 0.58, rotX: sz * 0.3, rotZ: -0.12 })));
          // MOUTH: a dark shadow band, then the pale tooth band with dark slots
          // cut into it — the slots are what read as teeth at any distance
          s.add(box(t, [0.055 * k, 0.075 * k, 0.19 * k], HOLLOW, [0.088 * k, -0.135 * k, 0], { rough: 1 }));
          const jaw = new t.Group();
          jaw.position.set(0, -0.005 * k, 0);
          jaw.add(box(t, [0.075 * k, 0.032 * k, 0.175 * k], PALE, [0.087 * k, -0.113 * k, 0], { rough: 0.55 })); // upper tooth band
          jaw.add(box(t, [0.075 * k, 0.03 * k, 0.16 * k], PALE, [0.083 * k, -0.163 * k, 0], { rough: 0.55 })); // lower tooth band
          for (let i = 0; i < 6; i++) {
            const tz = (i - 2.5) * 0.031 * k;
            jaw.add(box(t, [0.05 * k, 0.034 * k, 0.009 * k], HOLLOW, [0.096 * k, -0.113 * k, tz], { rough: 1 })); // gaps, upper
            if (i !== 4) jaw.add(box(t, [0.05 * k, 0.032 * k, 0.009 * k], HOLLOW, [0.092 * k, -0.163 * k, tz], { rough: 1 })); // gaps, lower (one tooth missing)
          }
          // mandible: the U under the tooth bands, with a jaw angle each side
          jaw.add(box(t, [0.07 * k, 0.028 * k, 0.15 * k], PALE, [0.078 * k, -0.188 * k, 0], { rough: 0.58 }));
          [-1, 1].forEach((sz) => jaw.add(box(t, [0.05 * k, 0.1 * k, 0.03 * k], PALE, [0.05 * k, -0.13 * k, sz * 0.078 * k], { rough: 0.58, rotZ: -0.25 })));
          s.add(jaw);
          return s;
        };
        /** a bone: shaft plus the four knuckle knobs that make it read as one */
        const buildBone = (len: number, r: number): THREE.Group => {
          const b = new t.Group();
          b.add(cyl(t, r, r, len, 0xdedacf, [0, 0, 0], { rough: 0.7, seg: 8, rotX: Math.PI / 2 }));
          [-1, 1].forEach((sz) =>
            [-1, 1].forEach((sy) => b.add(ball(t, r * 1.75, 0xdedacf, [0, sy * r * 1.3, (sz * len) / 2], { rough: 0.7, flat: true }))),
          );
          return b;
        };

        // (wall front face sits at x = wallX + 0.06 — everything mounts PROUD of it)
        // sign board: red bevel frame, boarded backer, four corner bolts
        g.add(box(t, [0.05, 0.82, 1.06], DOOR, [wallX + 0.085, 1.14, signZ], { rough: 0.8 })); // red border
        g.add(box(t, [0.08, 0.7, 0.94], 0x1c1a22, [wallX + 0.12, 1.14, signZ], { tex: 'wood', repeat: [3, 2], rough: 0.85 })); // sign board
        [-1, 1].forEach((sy) =>
          [-1, 1].forEach((sz) => g.add(ball(t, 0.017, 0x74757c, [wallX + 0.105, 1.14 + sy * 0.31, signZ + sz * 0.42], { metal: 0.6, rough: 0.35 }))),
        );
        // crossbones FIRST (they sit behind the skull on the board)
        [-1, 1].forEach((sz) => {
          const bone = buildBone(0.62, 0.026);
          bone.position.set(wallX + 0.16, 1.02, signZ);
          bone.rotation.x = sz * 0.62;
          g.add(bone);
        });
        const skull = buildSkull(1);
        skull.position.set(wallX + 0.17, 1.21, signZ);
        g.add(skull);
        // flame lanterns flanking the sign
        const lanternMat = new t.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xff8822, emissiveIntensity: 0.5, roughness: 0.4 });
        doorZs.forEach((dz) => {
          const lantern = new t.Mesh(new t.BoxGeometry(0.09, 0.13, 0.09), lanternMat);
          lantern.position.set(wallX + 0.12, 1.15, dz);
          g.add(lantern);
          g.add(box(t, [0.1, 0.04, 0.04], IRON, [wallX + 0.09, 1.24, dz], { metal: 0.5, rough: 0.6 })); // bracket
        });
        // ghost display case: a barred bay window protruding from the facade
        // (past the exit door) with the ghost sheet bobbing INSIDE it
        const winZ = 1.0;
        const caseX = wallX + 0.06; // wall front face
        const winPane = new t.MeshStandardMaterial({ color: 0x0c1810, emissive: 0x2f8f4a, emissiveIntensity: 0.18, roughness: 0.6 });
        const pane = new t.Mesh(new t.BoxGeometry(0.03, 0.5, 0.44), winPane);
        pane.position.set(caseX + 0.02, 0.85, winZ);
        g.add(pane);
        [-1, 1].forEach((s) => {
          g.add(box(t, [0.36, 0.05, 0.54], TRIMC, [caseX + 0.17, 0.85 + s * 0.275, winZ], { tex: 'wood', rough: 0.9 })); // top/bottom boards
          g.add(box(t, [0.36, 0.6, 0.05], TRIMC, [caseX + 0.17, 0.85, winZ + s * 0.245], { tex: 'wood', rough: 0.9 })); // side boards
        });
        [-0.08, 0.08].forEach((dz) => g.add(cyl(t, 0.012, 0.012, 0.55, IRON, [caseX + 0.33, 0.85, winZ + dz], { metal: 0.5, rough: 0.6, seg: 6 }))); // bars
        /**
         * THE GHOSTS. A sheet spectre instead of a cone with a ball on top:
         * a domed head under a cowl, a shroud that flares to a HEM OF TATTERS
         * (tapered lobes of uneven length hung off the rim — the silhouette is
         * what sells a ghost at any distance), two stubby raised arms, sunken
         * eyes and an open mouth. The cloth is translucent and faintly
         * self-lit, so it reads as a spectre in daylight and glows on the
         * night gate below. Built facing +x; `k` scales it whole.
         */
        const ghostSheets: THREE.MeshStandardMaterial[] = [];
        const buildGhost = (k: number, alpha: number): THREE.Group => {
          const gh = new t.Group();
          const SHEET = 0xf6f7f2;
          const HOLLOW = 0x0a0a10;
          const cloth = { rough: 0.92, opacity: alpha, emissive: 0x1d4a30 };
          const keep = (m: THREE.Mesh) => {
            ghostSheets.push(m.material as THREE.MeshStandardMaterial);
            gh.add(m);
            return m;
          };
          // SILHOUETTE FIRST. The first pass was a cylinder with a ball on it
          // and it read as a marshmallow. A sheet ghost is a NARROW head over
          // SLOPING shoulders over a shroud that FLARES, finished with a hem of
          // deep scallops — the wavy bottom edge and the taper above it are the
          // whole silhouette, and they have to be big enough to survive at 40
          // pixels. Head 0.09 against a 0.19 hem is roughly a 1:2 taper.
          const head = keep(ball(t, 0.09, SHEET, [0, 0.205, 0], cloth));
          head.scale.set(0.95, 1.08, 0.95);
          keep(cyl(t, 0.078, 0.14, 0.14, SHEET, [0, 0.1, 0], { ...cloth, seg: 16 })); // shoulders
          keep(cyl(t, 0.14, 0.19, 0.26, SHEET, [0, -0.06, 0], { ...cloth, seg: 18 })); // flaring shroud
          // THE HEM — 8 deep scallops round the rim, every other one drawn out
          // into a drip. Uneven lengths, deterministic.
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + 0.25;
            const cx = Math.cos(a) * 0.172;
            const cz = Math.sin(a) * 0.172;
            const lobe = keep(ball(t, 0.058, SHEET, [cx, -0.185, cz], cloth));
            lobe.scale.set(1, 1.15, 1);
            if (i % 3 === 0) {
              const len = 0.06 + ((i * 29) % 3) * 0.018;
              keep(cyl(t, 0.05, 0, len, SHEET, [cx, -0.2 - len / 2, cz], { ...cloth, seg: 8 })); // drip
            }
          }
          // a trailing wisp off the back, so it reads as FLOATING not standing
          const wisp = keep(cyl(t, 0.09, 0, 0.2, SHEET, [-0.07, -0.24, 0], { ...cloth, seg: 10 }));
          wisp.rotation.z = -0.5;
          // draped SLEEVES thrown up and out, tapered to points (the old round
          // "hands" were what made it a snowman)
          [-1, 1].forEach((sz) => {
            const arm = keep(cyl(t, 0.062, 0.012, 0.22, SHEET, [0.015, 0.075, sz * 0.155], { ...cloth, seg: 9 }));
            arm.rotation.x = -sz * 1.15;
            arm.rotation.z = 0.18;
          });
          // FACE — three big dark shapes. This is the entire read at distance,
          // so they are sized against the head, not against realism: each eye
          // is a third of the face wide and the mouth is a full open howl.
          [-1, 1].forEach((sz) => {
            const eye = ball(t, 0.032, HOLLOW, [0.064, 0.218, sz * 0.037], { rough: 1 });
            eye.scale.set(0.5, 1.15, 0.85);
            gh.add(eye);
          });
          const mouth = ball(t, 0.034, HOLLOW, [0.058, 0.15, 0], { rough: 1 });
          mouth.scale.set(0.5, 1.5, 0.85);
          gh.add(mouth);
          gh.scale.setScalar(k);
          return gh;
        };
        // 1 — the display-case ghost, penned behind the bars of the bay window
        const ghost = buildGhost(1, 0.86);
        ghost.position.set(caseX + 0.17, 0.76, winZ);
        g.add(ghost);
        // 2 — a spectre wafting up THROUGH the roof ridge, seen from outside
        const roofGhost = buildGhost(1.25, 0.6);
        roofGhost.position.set(-1.65, 2.18, 0.25); // half-sunk in the ridge — rising THROUGH the roof, not floating over it
        g.add(roofGhost);
        // 3 — a graveyard wraith drifting a slow circle between the stones
        const graveGhost = buildGhost(0.95, 0.55);
        graveGhost.position.set(2.45, 0.72, 0.4);
        g.add(graveGhost);

        // ---- graveyard: tombstones, dead tree, iron fence -------------------
        // bare-earth patch under the graveyard
        const earth = new t.Mesh(
          new t.CircleGeometry(1.15, 24),
          new t.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 }),
        );
        earth.rotation.x = -Math.PI / 2;
        earth.position.set(2.45, 0.004, 0);
        earth.receiveShadow = true;
        g.add(earth);
        const stone = 0x8f948f;
        /** a tombstone: plinth, marker, CARVED face (a sunk panel plus rows of
         *  chiselled inscription lines), a kerbed grave slab and moss on the
         *  weather side. `kind` picks the head shape — round, gabled or a
         *  broken stump snapped off at an angle. */
        const grave = (x: number, z: number, ry: number, kind: 'round' | 'gable' | 'broken', tilt = 0) => {
          const gr = new t.Group();
          gr.position.set(x, 0, z);
          gr.rotation.y = ry;
          gr.rotation.z = tilt; // settled ground
          const h = kind === 'broken' ? 0.21 : 0.3;
          gr.add(box(t, [0.26, 0.05, 0.1], 0x7f847f, [0, 0.025, 0], { tex: 'concrete', rough: 0.95 })); // plinth
          gr.add(box(t, [0.2, h, 0.055], stone, [0, 0.05 + h / 2, 0], { tex: 'concrete', repeat: [2, 2], rough: 0.95 }));
          if (kind === 'round') gr.add(cyl(t, 0.1, 0.1, 0.055, stone, [0, 0.05 + h, 0], { rotX: Math.PI / 2, tex: 'concrete', rough: 0.95, seg: 14 }));
          if (kind === 'gable')
            [-1, 1].forEach((s) => gr.add(box(t, [0.145, 0.05, 0.055], stone, [s * 0.036, 0.05 + h + 0.017, 0], { tex: 'concrete', rough: 0.95, rotZ: -s * 0.72 })));
          if (kind === 'broken') {
            gr.add(box(t, [0.2, 0.07, 0.055], stone, [0.02, 0.05 + h, 0], { tex: 'concrete', rough: 0.95, rotZ: 0.28 })); // snapped top
            gr.add(box(t, [0.13, 0.16, 0.05], stone, [0.19, 0.03, 0.06], { tex: 'concrete', rough: 0.95, rotZ: 1.2, rotY: 0.4 })); // the fallen piece
          }
          // carved face: a recessed panel with chiselled inscription lines
          gr.add(box(t, [0.15, h - 0.07, 0.012], 0x787d78, [0, 0.06 + h / 2, 0.03], { rough: 0.98 }));
          for (let i = 0; i < 3; i++)
            gr.add(box(t, [0.1 - i * 0.022, 0.012, 0.008], 0x5f645f, [0, 0.03 + h - i * 0.055, 0.035], { rough: 1 }));
          gr.add(box(t, [0.3, 0.045, 0.34], 0x7a7f7a, [0, 0.022, 0.2], { tex: 'concrete', rough: 0.95 })); // grave slab
          [-1, 1].forEach((s) => gr.add(box(t, [0.03, 0.06, 0.34], 0x868b86, [s * 0.15, 0.03, 0.2], { tex: 'concrete', rough: 0.95 }))); // kerbs
          gr.add(ball(t, 0.045, 0x4c6e30, [0.085, 0.055, -0.02], { tex: 'leaf', flat: true, rough: 0.95 })); // moss
          gr.add(ball(t, 0.03, 0x53753a, [-0.07, 0.045, 0.05], { tex: 'leaf', flat: true, rough: 0.95 }));
          g.add(gr);
        };
        grave(2.85, 0.35, -0.9, 'round');
        grave(2.75, -0.5, -2.2, 'gable', 0.07);
        grave(2.1, -0.95, -1.4, 'broken', -0.05);
        grave(3.0, 0.95, -0.55, 'round', 0.05);
        // cross-shaped marker, leaning, with a mossy footing
        const cross = new t.Group();
        cross.position.set(2.05, 0, 0.72);
        cross.rotation.y = 0.5;
        cross.rotation.z = 0.12; // leaning
        cross.add(box(t, [0.06, 0.42, 0.06], stone, [0, 0.21, 0], { tex: 'concrete', rough: 0.95 }));
        cross.add(box(t, [0.24, 0.06, 0.06], stone, [0, 0.3, 0], { tex: 'concrete', rough: 0.95 }));
        cross.add(box(t, [0.05, 0.05, 0.05], stone, [0, 0.345, 0], { tex: 'concrete', rough: 0.95, rotY: 0.78 })); // finial
        cross.add(box(t, [0.16, 0.05, 0.16], 0x7a7f7a, [0, 0.025, 0], { tex: 'concrete', rough: 0.95 })); // footing
        g.add(cross);
        // DEAD TREE — a real branching skeleton instead of four sticks in a
        // trunk: a buttressed, kinked bole and two generations of limbs, each
        // child growing off the TIP of its parent (so the joints actually
        // meet) at a deterministic spread, tapering to twigs. Bare, clawed and
        // legible in silhouette, which is the whole job of a graveyard tree.
        const tree = new t.Group();
        tree.position.set(1.75, 0, -1.15);
        const BARK = 0x3a2c22;
        // root buttresses
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          tree.add(cyl(t, 0.02, 0.05, 0.2, BARK, [Math.cos(a) * 0.07, 0.07, Math.sin(a) * 0.07], { tex: 'wood', rough: 0.95, seg: 5, rotX: -Math.sin(a) * 0.55, rotZ: Math.cos(a) * 0.55 }));
        }
        /** one limb: a tapered segment from `p` along (yaw, pitch), returning
         *  its tip so the next generation can grow off it */
        const limb = (p: [number, number, number], yaw: number, pitch: number, len: number, r0: number, r1: number): [number, number, number] => {
          const hx = Math.cos(pitch) * Math.sin(yaw);
          const hy = Math.sin(pitch);
          const hz = Math.cos(pitch) * Math.cos(yaw);
          const seg = cyl(t, r1, r0, len, BARK, [p[0] + (hx * len) / 2, p[1] + (hy * len) / 2, p[2] + (hz * len) / 2], { tex: 'wood', repeat: [1, 2], rough: 0.95, seg: 6 });
          seg.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), new t.Vector3(hx, hy, hz).normalize());
          tree.add(seg);
          tree.add(ball(t, r1 * 1.25, BARK, [p[0] + hx * len, p[1] + hy * len, p[2] + hz * len], { tex: 'wood', flat: true, rough: 0.95 })); // knuckle
          return [p[0] + hx * len, p[1] + hy * len, p[2] + hz * len];
        };
        const bole = limb(limb([0, 0, 0], 0.5, 1.5, 0.62, 0.1, 0.075), -0.6, 1.42, 0.46, 0.075, 0.055); // kinked trunk
        for (let i = 0; i < 5; i++) {
          const yaw = (i / 5) * Math.PI * 2 + 0.9;
          const tip = limb(bole, yaw, 0.72 + (i % 3) * 0.16, 0.44 - (i % 2) * 0.07, 0.05, 0.028);
          for (let k = 0; k < 2; k++) limb(tip, yaw + (k ? 0.8 : -0.7), 0.5 + (i % 2) * 0.35, 0.26 - k * 0.05, 0.026, 0.008); // twigs (limb() self-adds)
        }
        g.add(tree);
        // weeds and a fallen urn under it — bare earth alone reads unfinished
        for (let i = 0; i < 9; i++) {
          const a = i * 2.399;
          const rr = 0.45 + ((i * 17) % 7) * 0.09;
          const wx = 2.45 + Math.cos(a) * rr;
          const wz = Math.sin(a) * rr;
          for (let b = 0; b < 3; b++)
            g.add(cyl(t, 0.002, 0.012, 0.1 + (b % 2) * 0.05, 0x5b6141, [wx + b * 0.02 - 0.02, 0.05, wz + (b % 2) * 0.02], { rough: 1, seg: 4, rotZ: (b - 1) * 0.4 }));
        }
        const urn = new t.Group();
        urn.position.set(2.62, 0.06, -0.95);
        urn.rotation.z = 1.35; // toppled
        urn.add(cyl(t, 0.07, 0.045, 0.14, 0x8a8f8a, [0, 0, 0], { tex: 'concrete', rough: 0.95, seg: 12 }));
        urn.add(cyl(t, 0.085, 0.085, 0.02, 0x8a8f8a, [0, 0.08, 0], { tex: 'concrete', rough: 0.95, seg: 12 }));
        g.add(urn);
        // rusty iron fence guarding the graveyard's outer arc
        const FR = 3.05;
        for (let i = 0; i < 9; i++) {
          const a = -0.6 + (i / 8) * 1.2;
          g.add(cyl(t, 0.014, 0.014, 0.4, IRON, [Math.cos(a) * FR, 0.2, Math.sin(a) * FR], { metal: 0.5, rough: 0.6, seg: 6 }));
          g.add(ball(t, 0.022, IRON, [Math.cos(a) * FR, 0.41, Math.sin(a) * FR], { rough: 0.5 })); // spike finial
        }
        [0.14, 0.34].forEach((fy) => {
          for (let i = 0; i < 8; i++) {
            const a0 = -0.6 + (i / 8) * 1.2;
            const a1 = -0.6 + ((i + 1) / 8) * 1.2;
            const mx = ((Math.cos(a0) + Math.cos(a1)) / 2) * FR;
            const mz = ((Math.sin(a0) + Math.sin(a1)) / 2) * FR;
            const len = Math.hypot(Math.cos(a1) - Math.cos(a0), Math.sin(a1) - Math.sin(a0)) * FR;
            const rail = box(t, [0.025, 0.025, len], IRON, [mx, fy, mz], { metal: 0.5, rough: 0.6 });
            rail.rotation.y = Math.atan2(Math.cos(a1) - Math.cos(a0), Math.sin(a1) - Math.sin(a0));
            g.add(rail);
          }
        });

        // ---- the train: 3 two-seat cars, lamp on the lead car ---------------
        const CARBODY = 0x27343f; // midnight slate
        const CARTRIM = 0x50e090; // spectral green stripe
        const cars: { grp: THREE.Group; off: number }[] = [];
        const headlampMat = new t.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffc040, emissiveIntensity: 0.35, roughness: 0.3 });
        let headLight: THREE.PointLight | null = null;
        for (let c = 0; c < 3; c++) {
          const car = new t.Group();
          // chassis + wheels hugging the rails
          car.add(box(t, [0.3, 0.05, 0.52], 0x1a1c20, [0, 0.045, 0], { metal: 0.4, rough: 0.6 }));
          [-1, 1].forEach((xs) => [-0.17, 0.17].forEach((wz) => car.add(cyl(t, 0.045, 0.045, 0.03, 0x111116, [xs * 0.16, 0.045, wz], { rotZ: Math.PI / 2, rough: 0.5, seg: 10 }))));
          // tub body: sides, sloped nose, tall rounded back panel
          [-1, 1].forEach((xs) => car.add(box(t, [0.045, 0.16, 0.5], CARBODY, [xs * 0.155, 0.15, 0], { tex: 'plastic', repeat: [3, 1], rough: 0.5 })));
          car.add(box(t, [0.36, 0.14, 0.06], CARBODY, [0, 0.14, 0.26], { tex: 'plastic', rough: 0.5, rotX: 0.5 })); // nose
          car.add(box(t, [0.36, 0.32, 0.05], CARBODY, [0, 0.24, -0.255], { tex: 'plastic', repeat: [3, 2], rough: 0.5 })); // back panel
          car.add(cyl(t, 0.18, 0.18, 0.05, CARBODY, [0, 0.4, -0.255], { rotX: Math.PI / 2, rough: 0.5, seg: 14 })); // rounded back top
          car.add(box(t, [0.37, 0.03, 0.05], CARTRIM, [0, 0.09, 0.255], { rough: 0.45, rotX: 0.5 })); // nose stripe
          [-1, 1].forEach((xs) => car.add(box(t, [0.048, 0.03, 0.5], CARTRIM, [xs * 0.155, 0.205, 0], { rough: 0.45 }))); // side stripes
          // bench: pan + cushions + shared lap bar over both riders
          car.add(box(t, [0.28, 0.05, 0.24], 0x1f262e, [0, 0.1, -0.1], { rough: 0.6 }));
          car.add(box(t, [0.26, 0.025, 0.2], 0x5a2430, [0, 0.14, -0.1], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // pan cushion
          car.add(box(t, [0.26, 0.2, 0.02], 0x5a2430, [0, 0.25, -0.225], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back cushion
          for (let k = 0; k < 2; k++) {
            // bench anchor — REAL GameManager guests land here via seatWorld
            const seat = new t.Group();
            seat.position.set((k - 0.5) * 0.16, 0.0, -0.115);
            car.add(seat);
            seats.push(seat);
            if (withRiders) {
              const p = buildPeep(t, {
                skin: SKIN_TONES[(c * 2 + k) % SKIN_TONES.length],
                shirt: SHIRTS[(c * 2 + k + 2) % SHIRTS.length],
                seated: true,
                expression: c === 0 ? 'surprised' : k ? 'surprised' : 'happy',
                female: (c + k) % 2 === 1,
              });
              p.group.scale.setScalar(0.3 / RIDE_SCALE); // guests are ONE size park-wide: undo the shell scale
              p.group.userData.lodDetail = true; // park runtime hides riders beyond NEAR distance
              seat.add(p.group);
            }
          }
          car.add(box(t, [0.26, 0.035, 0.035], 0x14161a, [0, 0.19, 0.03], { metal: 0.5, rough: 0.4 })); // lap bar (over both laps)
          [-0.13, 0.13].forEach((bx) => car.add(box(t, [0.03, 0.1, 0.03], 0x14161a, [bx, 0.14, 0.03], { metal: 0.5, rough: 0.4 }))); // bar arms
          if (c === 0) {
            // lead-car lamp + tiny skull emblem on the nose
            const lamp = new t.Mesh(new t.SphereGeometry(0.04, 10, 8), headlampMat);
            lamp.position.set(0, 0.2, 0.29);
            car.add(lamp);
            headLight = new t.PointLight(0xffd9a0, 0, 2.5, 2);
            headLight.position.set(0, 0.24, 0.42);
            car.add(headLight);
            const emblem = buildSkull(0.3); // the same skull as the sign, shrunk onto the nose
            emblem.position.set(0, 0.13, 0.29);
            emblem.rotation.y = Math.PI / 2; // buildSkull faces +x; the nose faces +z
            car.add(emblem);
          }
          g.add(car);
          cars.push({ grp: car, off: (-c * 0.62) / trackLen });
        }
        vehicle = cars[0].grp;

        // ---- night rig: 3 real lights, all nightK-gated ----------------------
        const doorGlow = new t.PointLight(0x40ff80, 0, 4, 2); // eerie interior spill
        doorGlow.position.set(-1.1, 0.7, 0);
        g.add(doorGlow);
        const graveWash = new t.PointLight(0x58ff9a, 0, 4.5, 2);
        graveWash.position.set(2.4, 0.9, 0);
        g.add(graveWash);

        const up = new t.Vector3(0, 1, 0);
        return (time) => {
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          lanternMat.emissiveIntensity = 0.5 + (1.5 + 0.35 * Math.sin(time * 9) - 0.5) * ease;
          winPane.emissiveIntensity = 0.18 + (0.9 + 0.4 * Math.abs(Math.sin(time * 2.3)) - 0.18) * ease;
          headlampMat.emissiveIntensity = 0.35 + (1.6 - 0.35) * ease;
          if (headLight) headLight.intensity = ease * 0.9;
          doorGlow.intensity = ease * (0.8 + 0.15 * Math.sin(time * 3.1));
          graveWash.intensity = ease * (0.85 + 0.1 * Math.sin(time * 1.7));
          // the ghosts. All three bob and sway on their own clocks and glow
          // harder after dark; the outdoor pair also drift, so the ride has
          // something moving in it from every angle.
          ghost.position.y = 0.76 + 0.05 * Math.sin(time * 1.8);
          ghost.rotation.y = 0.25 * Math.sin(time * 0.9);
          ghost.rotation.z = 0.06 * Math.sin(time * 1.3);
          roofGhost.position.set(-1.65 + 0.08 * Math.sin(time * 0.31), 2.18 + 0.09 * Math.sin(time * 0.74), 0.25 + 0.55 * Math.sin(time * 0.43));
          roofGhost.rotation.y = 0.9 * Math.sin(time * 0.37);
          roofGhost.rotation.z = 0.1 * Math.sin(time * 0.9 + 1);
          const wa = time * 0.24;
          graveGhost.position.set(2.45 + Math.cos(wa) * 0.42, 0.72 + 0.09 * Math.sin(time * 1.1), 0.4 + Math.sin(wa) * 0.42);
          graveGhost.rotation.y = -wa + Math.PI / 2; // faces the way it drifts
          graveGhost.rotation.z = 0.08 * Math.sin(time * 1.5);
          for (const m of ghostSheets) m.emissiveIntensity = 0.22 + (1.15 - 0.22) * ease;
          // train: constant crawl around the loop, cars glued to the rails
          const uHead = ((time * 0.38) / trackLen + 0.52) % 1; // phased so the train opens OUTDOORS
          cars.forEach(({ grp, off }) => {
            const u = (((uHead + off) % 1) + 1) % 1;
            const p = curve.getPointAt(u);
            const tan = curve.getTangentAt(u);
            grp.position.set(p.x, p.y + 0.03, p.z);
            grp.lookAt(p.clone().add(tan.setY(tan.y).normalize()));
            grp.up.copy(up);
          });
        };
      })(three, group) || undefined;
  // station gate: the train's crawl clock is gated, so it stands PARKED on
  // the loop while guests board and rolls to a stop for unloading (the
  // ghost/bats keep their own life via the frozen clock's last pose)
  const gate = createMotionGate((tt) => update?.(tt));
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange: gate.onStateChange };
}

/** <GhostTrain> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 6 = 3 two-seat cars: REAL guests fill the
 *  benches via `seatWorld` (decorative riders off when registered) and the
 *  train is motion-gated — parked for boarding/unloading. Override with
 *  top-level props / `queue`. */
export const GhostTrain = composableRide<{ riders?: boolean }>(
  'GhostTrain',
  (t, props) => buildGhostTrainScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Ghost Train', capacity: 6, rideDuration: 11, intensity: 5, price: 4 } },
);
