import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
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
    ((t: typeof THREE, g: THREE.Group) => {
        const WALL = 0x3b3347; // dark purple-grey masonry
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
        // boarded-up side windows + timber wainscot band so the flanks read
        [-1, 1].forEach((s) => {
          g.add(box(t, [2.32, 0.09, 0.13], TRIMC, [-1.65, 0.42, s * 1.35], { tex: 'wood', repeat: [8, 1], rough: 0.9 })); // wainscot band
          [-2.25, -1.05].forEach((wx) => {
            g.add(box(t, [0.42, 0.5, 0.05], 0x14121a, [wx, 0.92, s * 1.39], { rough: 0.8 })); // dark opening
            g.add(box(t, [0.5, 0.06, 0.06], TRIMC, [wx, 1.19, s * 1.4], { tex: 'wood', rough: 0.9 })); // header
            g.add(box(t, [0.5, 0.06, 0.06], TRIMC, [wx, 0.65, s * 1.4], { tex: 'wood', rough: 0.9 })); // sill
            g.add(box(t, [0.52, 0.07, 0.045], 0x4a3828, [wx, 0.95, s * 1.41], { tex: 'wood', repeat: [3, 1], rough: 0.95, rotZ: 0.35 })); // nailed board
            g.add(box(t, [0.52, 0.07, 0.045], 0x4a3828, [wx, 0.89, s * 1.415], { tex: 'wood', repeat: [3, 1], rough: 0.95, rotZ: -0.3 })); // nailed board
          });
        });
        // back-wall cobweb corner hint: pale diagonal slats high on the wall
        [1.05, 1.25].forEach((wy, wi) => g.add(box(t, [0.36 - wi * 0.14, 0.02, 0.02], 0xb9bcc2, [-2.82, wy, -1.12 + wi * 0.1], { rough: 0.9, rotZ: 0.5 })));
        [wallX, -2.75].forEach((x) => [-1.35, 1.35].forEach((z) => g.add(box(t, [0.14, 1.56, 0.14], TRIMC, [x, 0.78, z], { tex: 'wood', repeat: [1, 4], rough: 0.9 }))));
        // gabled slate roof (ridge along z) + stepped Victorian gable ends
        const slopeAng = Math.atan2(0.55, 1.25);
        g.add(box(t, [1.42, 0.06, 3.06], ROOF, [-2.26, 1.78, 0], { tex: 'concrete', repeat: [4, 8], rough: 0.85, rotZ: slopeAng }));
        g.add(box(t, [1.42, 0.06, 3.06], ROOF, [-1.04, 1.78, 0], { tex: 'concrete', repeat: [4, 8], rough: 0.85, rotZ: -slopeAng }));
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
        // (wall front face sits at x = wallX + 0.06 — everything mounts PROUD of it)
        g.add(box(t, [0.05, 0.68, 0.96], DOOR, [wallX + 0.085, 1.12, signZ], { rough: 0.8 })); // red border
        g.add(box(t, [0.08, 0.62, 0.9], 0x1c1a22, [wallX + 0.12, 1.12, signZ], { tex: 'wood', repeat: [3, 2], rough: 0.85 })); // sign board
        const skull = ball(t, 0.17, BONE, [wallX + 0.19, 1.2, signZ], { rough: 0.6 });
        skull.scale.set(0.6, 1.05, 1);
        g.add(skull);
        g.add(box(t, [0.09, 0.1, 0.2], BONE, [wallX + 0.18, 1.0, signZ], { rough: 0.6 })); // jaw
        [-1, 1].forEach((s) => g.add(ball(t, 0.045, 0x0a0a0e, [wallX + 0.27, 1.24, signZ + s * 0.065], { rough: 0.4 }))); // eye sockets
        g.add(ball(t, 0.028, 0x0a0a0e, [wallX + 0.28, 1.12, signZ], { rough: 0.4 })); // nasal hollow
        [-1, 1].forEach((s) => g.add(box(t, [0.06, 0.05, 0.55], BONE, [wallX + 0.17, 0.92, signZ + s * 0.09], { rough: 0.6, rotX: s * 0.6 }))); // crossbones
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
        // the ghost: white sheet (tapered skirt + head + black eyes), bobbing
        const ghost = new t.Group();
        ghost.position.set(caseX + 0.17, 0.78, winZ);
        const sheet = cyl(t, 0.035, 0.115, 0.28, 0xf2f2ee, [0, 0, 0], { rough: 0.85, seg: 10 });
        ghost.add(sheet);
        ghost.add(ball(t, 0.08, 0xf2f2ee, [0, 0.16, 0], { rough: 0.85 }));
        [-1, 1].forEach((s) => ghost.add(ball(t, 0.018, 0x0a0a0e, [0.062, 0.18, s * 0.032], { rough: 0.4 }))); // eyes face OUT (+x)
        g.add(ghost);

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
        const grave = (x: number, z: number, ry: number) => {
          const gr = new t.Group();
          gr.position.set(x, 0, z);
          gr.rotation.y = ry;
          gr.add(box(t, [0.2, 0.3, 0.055], stone, [0, 0.15, 0], { tex: 'concrete', repeat: [2, 2], rough: 0.95 }));
          gr.add(cyl(t, 0.1, 0.1, 0.055, stone, [0, 0.3, 0], { rotX: Math.PI / 2, tex: 'concrete', rough: 0.95, seg: 12 }));
          gr.add(box(t, [0.24, 0.05, 0.32], 0x7a7f7a, [0, 0.025, 0.12], { tex: 'concrete', rough: 0.95 })); // slab
          gr.add(ball(t, 0.045, 0x4c6e30, [0.08, 0.06, -0.02], { tex: 'leaf', flat: true, rough: 0.95 })); // moss
          g.add(gr);
        };
        grave(2.85, 0.35, -0.9);
        grave(2.75, -0.5, -2.2);
        // cross-shaped marker
        const cross = new t.Group();
        cross.position.set(2.05, 0, 0.72);
        cross.rotation.y = 0.5;
        cross.rotation.z = 0.12; // leaning
        cross.add(box(t, [0.06, 0.42, 0.06], stone, [0, 0.21, 0], { tex: 'concrete', rough: 0.95 }));
        cross.add(box(t, [0.24, 0.06, 0.06], stone, [0, 0.3, 0], { tex: 'concrete', rough: 0.95 }));
        g.add(cross);
        // dead tree: gnarled trunk + bare tapering branches
        const tree = new t.Group();
        tree.position.set(1.75, 0, -1.15);
        tree.add(cyl(t, 0.045, 0.1, 0.95, 0x3a2c22, [0, 0.47, 0], { tex: 'wood', repeat: [2, 3], rough: 0.95, seg: 8, rotZ: 0.06 }));
        [
          [0.12, 0.95, 0.5, -0.7, 0],
          [-0.1, 1.05, 0.45, 0.9, 0.3],
          [0.02, 1.1, 0.38, -0.2, -0.8],
          [0.2, 1.2, 0.3, -1.0, 0.4],
        ].forEach(([bx, by, bl, rz, rx]) => {
          tree.add(cyl(t, 0.012, 0.035, bl, 0x3a2c22, [bx, by, 0], { tex: 'wood', rough: 0.95, seg: 6, rotZ: rz, rotX: rx }));
        });
        g.add(tree);
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
              p.group.scale.setScalar(0.3);
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
            const emblem = ball(t, 0.035, BONE, [0, 0.12, 0.29], { rough: 0.6 });
            emblem.scale.set(1, 1.1, 0.55);
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
          // the ghost bobs + sways behind its bars, peering out
          ghost.position.y = 0.78 + 0.05 * Math.sin(time * 1.8);
          ghost.rotation.y = 0.25 * Math.sin(time * 0.9);
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
