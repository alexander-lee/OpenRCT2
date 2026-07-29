import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

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
 * ENDPOINT PLACEMENT — a box of section `th × tw` spanning a → b. rotX/rotY/rotZ
 * cannot express the direction of an arbitrary member (a broken rafter, an iron
 * fence rail on an arc, a bone), so the rotation carrying local +x onto (b − a)
 * is built as a quaternion and baked into the spec's `matrix`.
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

        // THE SHOW'S LIGHT SOURCES. Almost everything the reveal is made of is
        // EMISSIVE, not lit: three real PointLights is this ride's whole budget
        // and they are already spoken for. Note the trap `mat()` sets — it bakes
        // the colour into the TEXTURE and leaves `material.color` white, so a
        // mapped material needs `emissiveMap = map` (the same texture object,
        // free) before its glow has the right shape. Everything self-lit here is
        // deliberately UNMAPPED so plain `emissive` is the whole story.
        const showGlow: THREE.MeshStandardMaterial[] = []; // green reveals
        const showFlame: THREE.MeshStandardMaterial[] = []; // candle flames
        const SHOW_GREEN = 0x39ff9a;
        const glowMat = (col: number, emis: number, base = 0.16) =>
          new t.MeshStandardMaterial({ color: col, roughness: 0.55, emissive: new t.Color(emis), emissiveIntensity: base });

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

        // ties (sleepers) + support posts on the outdoor sections.
        // The ties used to be ~60 separate meshes, each inside its own holder
        // Group, i.e. 60 draw calls and 60 shadow-pass draws for the cheapest
        // dressing on the ride — a tenth of this component's entire budget.
        // They are one MERGED mesh now, each tie's basis built the same way
        // `Object3D.lookAt` builds it (local +z onto the tangent, +x = up × z)
        // and baked into the spec's `matrix`, so the geometry is identical.
        const nTies = Math.floor(trackLen / 0.22);
        const tieP: MergedBoxSpec[] = [];
        const upA = new t.Vector3(0, 1, 0);
        for (let i = 0; i < nTies; i++) {
          const u = i / nTies;
          const p = curve.getPointAt(u);
          const zA = curve.getTangentAt(u).normalize();
          const xA = new t.Vector3().crossVectors(upA, zA).normalize();
          const yA = new t.Vector3().crossVectors(zA, xA);
          const m4 = new t.Matrix4().makeBasis(xA, yA, zA);
          m4.setPosition(p);
          tieP.push({ dims: [0.34, 0.035, 0.09], matrix: m4, repeat: [2, 1] });
          if (i % 6 === 0 && p.x > -0.3 && p.y > 0.16) {
            g.add(cyl(t, 0.028, 0.035, p.y, 0x3a3a40, [p.x, p.y / 2 - 0.02, p.z], { metal: 0.4, rough: 0.6, seg: 8 }));
          }
        }
        const ties = mergedBoxes(t, tieP, 0x4a3828, { tex: 'wood', rough: 0.9 });
        ties.castShadow = true;
        ties.receiveShadow = true;
        g.add(ties);
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
            // the FORWARD window on each flank is not boarded shut — the glass
            // is broken and the show is leaking out between the nailed boards.
            // A dark ride whose every opening is a black rectangle has nothing
            // to say after dark, which is exactly when it should say most.
            if (wx === -1.05) {
              const paneMat = glowMat(0x0c1c12, SHOW_GREEN, 0.45);
              showGlow.push(paneMat);
              const pn = new t.Mesh(new t.BoxGeometry(0.42, 0.5, 0.05), paneMat);
              pn.position.set(wx, 0.92, s * 1.39);
              g.add(pn);
            } else g.add(box(t, [0.42, 0.5, 0.05], 0x14121a, [wx, 0.92, s * 1.39], { rough: 0.8 })); // dark opening
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
        //
        // THE REVEAL. A dark ride's whole point is its interior, and a sealed
        // box has none: at noon this building read as a well-detailed shed and
        // at night as a well-detailed shed with two lanterns on it. Nothing an
        // outside camera could see said "there is a SHOW in here". The park is
        // viewed from an elevated three-quarter camera, so the opening that
        // actually reveals anything is a hole in the ROOF — and a derelict
        // haunted house wanting a collapsed roof is not a compromise, it is the
        // theme. The FRONT slope (si 1) loses a panel between the ridge and
        // mid-slope: the deck is cut into four pieces round the void (still one
        // merged mesh), every slate whose centre falls in the void is dropped,
        // slates within 0.14 of the lip are tipped and dragged down so the edge
        // is RAGGED and not sawn, and the structure that was under the slates —
        // rafters and purlins, two of them snapped and drooping into the hole —
        // is now on show. Everything below in `showRoom` is built to be seen
        // through it.
        const HOLE = { x0: -0.62, x1: 0.1, z0: -0.5, z1: 0.6 };
        [
          [-2.26, slopeAng],
          [-1.04, -slopeAng],
        ].forEach(([cx, ang], si) => {
          const slope = new t.Group();
          slope.position.set(cx, 1.78, 0);
          slope.rotation.z = ang;
          const open = si === 1; // the front slope carries the collapse
          if (!open) {
            slope.add(box(t, [1.42, 0.06, 3.06], ROOF, [0, 0, 0], { tex: 'concrete', repeat: [4, 8], rough: 0.85 }));
          } else {
            // deck in four pieces round the void — one merged mesh, same cost
            const deckP: MergedBoxSpec[] = [
              { dims: [1.42, 0.06, HOLE.z0 + 1.53], pos: [0, 0, (-1.53 + HOLE.z0) / 2], repeat: [4, 3] },
              { dims: [1.42, 0.06, 1.53 - HOLE.z1], pos: [0, 0, (HOLE.z1 + 1.53) / 2], repeat: [4, 3] },
              { dims: [HOLE.x0 + 0.71, 0.06, HOLE.z1 - HOLE.z0], pos: [(-0.71 + HOLE.x0) / 2, 0, (HOLE.z0 + HOLE.z1) / 2] },
              { dims: [0.71 - HOLE.x1, 0.06, HOLE.z1 - HOLE.z0], pos: [(HOLE.x1 + 0.71) / 2, 0, (HOLE.z0 + HOLE.z1) / 2], repeat: [2, 2] },
            ];
            const deck = mergedBoxes(t, deckP, ROOF, { tex: 'concrete', rough: 0.85 });
            deck.castShadow = true;
            deck.receiveShadow = true;
            slope.add(deck);
            // rafters up the slope + purlins across, two of each SNAPPED and
            // drooping into the void. Placed from their two endpoints — a
            // drooping rafter end has no axis-aligned rotation.
            const timb: MergedBoxSpec[] = [];
            [-0.42, -0.14, 0.14, 0.42].forEach((rz, k) => {
              const snapped = k === 1 || k === 2;
              const stop = snapped ? HOLE.x0 + 0.16 + k * 0.08 : 0.71;
              const sp = strutSpec(t, new t.Vector3(-0.71, -0.05, rz), new t.Vector3(stop, -0.05, rz), 0.05, 0.055, [3, 1]);
              if (sp) timb.push(sp);
              if (snapped) {
                // the broken end hangs into the room
                const d = strutSpec(t, new t.Vector3(stop, -0.05, rz), new t.Vector3(stop + 0.2, -0.26, rz + (k === 1 ? -0.05 : 0.06)), 0.045, 0.05);
                if (d) timb.push(d);
                // ...and the rest of the rafter survives past the void
                const r2 = strutSpec(t, new t.Vector3(HOLE.x1 + 0.06, -0.05, rz), new t.Vector3(0.71, -0.05, rz), 0.05, 0.055, [2, 1]);
                if (r2) timb.push(r2);
              }
            });
            [-0.45, -0.08].forEach((px, k) => {
              const zEnd = k === 0 ? HOLE.z1 : HOLE.z1 - 0.22;
              const sp = strutSpec(t, new t.Vector3(px, -0.11, HOLE.z0 - 0.28), new t.Vector3(px, -0.11, zEnd), 0.055, 0.06, [3, 1]);
              if (sp) timb.push(sp);
            });
            const rafters = mergedBoxes(t, timb, 0x2a2129, { tex: 'wood', rough: 0.95 });
            rafters.castShadow = true;
            slope.add(rafters);
          }
          const tabs: { dims: [number, number, number]; pos: [number, number, number]; rotZ?: number; rotX?: number }[] = [];
          for (let c = 0; c < 5; c++) {
            const lx = -0.71 + 0.15 + c * 0.28;
            const stagger = c % 2 ? 0.13 : 0; // courses break joint, like real slate
            for (let i = 0; i < 11; i++) {
              const tz = -1.5 + 0.14 + stagger + i * 0.27;
              if (tz > 1.53) continue;
              const h = ((c * 7 + i * 13 + si * 5) % 4) * 0.004; // weathered sag
              if (open) {
                const inHole = lx > HOLE.x0 - 0.12 && lx < HOLE.x1 + 0.12 && tz > HOLE.z0 - 0.1 && tz < HOLE.z1 + 0.1;
                if (inHole) continue;
                const nearLip =
                  lx > HOLE.x0 - 0.3 && lx < HOLE.x1 + 0.3 && tz > HOLE.z0 - 0.26 && tz < HOLE.z1 + 0.26;
                if (nearLip) {
                  // slipped slates round the lip: tipped both ways and dropped
                  tabs.push({
                    dims: [0.3, 0.028, 0.25],
                    pos: [lx + (((c + i) % 2) - 0.5) * 0.05, 0.043 - h - 0.02, tz + (((c * 3 + i) % 3) - 1) * 0.03],
                    rotZ: (((c + i) % 3) - 1) * 0.14,
                    rotX: (((c * 5 + i) % 3) - 1) * 0.12,
                  });
                  continue;
                }
              }
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
         * THE GHOSTS — a lofted SHROUD, not a stack of primitives.
         *
         * Second rebuild. The first one already knew what the silhouette had to
         * be (narrow head, sloping shoulders, a shroud that flares to a hem of
         * tatters) and then built it out of a ball, two cylinders, EIGHT MORE
         * BALLS for the hem lobes and three cones for the drips — twenty-odd
         * convex blobs threaded on one axis. That is the same defect as a hull
         * made of stacked discs: adjacent blobs differ by a few percent, so the
         * eye reads one shape repeated, the silhouette comes out bobbled rather
         * than draped, and it cost 20 draw calls a ghost.
         *
         * Cloth is a SURFACE, so this lofts the surface. A profile table gives
         * the radius and height down the body (crown → head → neck → shoulders
         * → flare → hem); the hem is then modulated IN TWO WAYS at once, which
         * is what a torn sheet actually does and what no stack of lobes can do:
         *   - the RADIUS gains eight lobes, ramping in below the shoulders, so
         *     the shroud swells and pinches round its circumference;
         *   - the HEM EDGE drops by a per-angle amount built from the lobe
         *     phase plus a slower 3-cycle, so the tatters hang at UNEVEN
         *     lengths — the bottom edge is a ragged curve, not a scalloped ring.
         * One mesh, 16 × 28 quads. With the two sleeves, the trailing wisp and
         * a merged 3-box face that is 5 draws a ghost instead of 20.
         *
         * Built facing +x; `k` scales it whole. One cloth material per ghost,
         * shared by shroud/sleeves/wisp, so the night gate has one handle.
         */
        const ghostSheets: THREE.MeshStandardMaterial[] = [];
        const buildGhost = (k: number, alpha: number): THREE.Group => {
          const gh = new t.Group();
          const SHEET = 0xf6f7f2;
          const HOLLOW = 0x0a0a10;
          // ONE material for the whole spectre. `mat()` with no `tex` leaves
          // `color` on the material (not baked into a map), so the explicit
          // green `emissive` is the only thing the night gate has to lift.
          const cloth = new t.MeshStandardMaterial({
            color: SHEET,
            roughness: 0.92,
            transparent: true,
            opacity: alpha,
            emissive: new t.Color(0x1d4a30),
            emissiveIntensity: 0.22,
          });
          cloth.side = t.DoubleSide;
          ghostSheets.push(cloth);
          // profile: [v, radius, y] from crown to hem
          const PROF: [number, number, number][] = [
            [0.0, 0.006, 0.3],
            [0.09, 0.062, 0.272],
            [0.2, 0.09, 0.216],
            [0.32, 0.068, 0.152],
            [0.45, 0.116, 0.104],
            [0.62, 0.152, 0.012],
            [0.8, 0.181, -0.1],
            [1.0, 0.196, -0.213],
          ];
          const profAt = (v: number): [number, number] => {
            for (let i = 1; i < PROF.length; i += 1) {
              if (v <= PROF[i][0]) {
                const [v0, r0, y0] = PROF[i - 1];
                const [v1, r1, y1] = PROF[i];
                const f = (v - v0) / (v1 - v0);
                return [r0 + (r1 - r0) * f, y0 + (y1 - y0) * f];
              }
            }
            return [PROF[PROF.length - 1][1], PROF[PROF.length - 1][2]];
          };
          const NV = 16;
          const NA = 28;
          const rows: THREE.Vector3[][] = [];
          for (let i = 0; i <= NV; i += 1) {
            const v = i / NV;
            const [r0, y0] = profAt(v);
            const la = Math.max(0, (v - 0.5) / 0.5); // lobes ramp in below the shoulders
            const row: THREE.Vector3[] = [];
            for (let j = 0; j <= NA; j += 1) {
              const th = (j / NA) * Math.PI * 2;
              const r = r0 * (1 + 0.15 * la * Math.cos(8 * th));
              // TATTERS: the hem drops unevenly — the 8-lobe phase sets which
              // folds hang low, a 3-cycle makes the whole hem asymmetric
              const dy =
                Math.pow(la, 1.7) *
                (0.055 + 0.095 * (0.5 + 0.5 * Math.cos(8 * th)) + 0.05 * (0.5 + 0.5 * Math.cos(3 * th + 0.9)));
              row.push(new t.Vector3(Math.cos(th) * r, y0 - dy, Math.sin(th) * r));
            }
            rows.push(row);
          }
          const shroud = new t.Mesh(loftRows(t, rows), cloth);
          shroud.castShadow = false;
          gh.add(shroud);
          // draped SLEEVES thrown up and out, tapered to points
          [-1, 1].forEach((sz) => {
            const arm = new t.Mesh(new t.CylinderGeometry(0.058, 0.012, 0.22, 9), cloth);
            arm.position.set(0.015, 0.075, sz * 0.155);
            arm.rotation.x = -sz * 1.15;
            arm.rotation.z = 0.18;
            gh.add(arm);
          });
          // a trailing wisp off the back, so it reads as FLOATING not standing
          const wisp = new t.Mesh(new t.CylinderGeometry(0.09, 0, 0.22, 10), cloth);
          wisp.position.set(-0.075, -0.26, 0);
          wisp.rotation.z = -0.5;
          gh.add(wisp);
          // FACE — three big dark shapes, merged. This is the entire read at
          // distance, so they are sized against the head rather than against
          // realism: each socket is a third of the face wide and canted, and
          // the mouth is a full open howl.
          gh.add(
            mergedBoxes(
              t,
              [
                { dims: [0.026, 0.062, 0.03], pos: [0.07, 0.222, 0.037], rotX: 0.25 },
                { dims: [0.026, 0.062, 0.03], pos: [0.07, 0.222, -0.037], rotX: -0.25 },
                { dims: [0.024, 0.072, 0.032], pos: [0.064, 0.152, 0] },
              ],
              HOLLOW,
              { rough: 1 },
            ),
          );
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
        // THE EARTH. It was a `CircleGeometry` — a perfect flat brown disc laid
        // on the grass, which from the elevated park camera is the single most
        // visible cheat on the ride: a decal, with a hard geometric edge no
        // amount of colour can rescue. It is a LOFTED graded mound now, with
        // (a) an IRREGULAR OUTLINE, two harmonics of it, because the circle is
        // what gives a decal away before anything else, (b) real relief —
        // 0.055 crowned at the middle, feathering to 2 mm at the rim, with a
        // hashed bumpiness so mourners' feet and settled graves show, and (c) a
        // scatter of merged clods and sods straddling the boundary, so the edge
        // is a transition and not a cut.
        const hash01 = (n: number) => {
          const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
          return x - Math.floor(x);
        };
        const EARTH_C = new t.Vector3(2.45, 0, 0);
        const rEdge = (th: number) => 1.15 * (1 + 0.14 * Math.sin(3 * th + 0.4) + 0.07 * Math.sin(7 * th + 1.9));
        const NTHE = 40;
        const earthRows: THREE.Vector3[][] = [];
        for (let i = 0; i <= 7; i += 1) {
          const k = i / 7;
          const row: THREE.Vector3[] = [];
          for (let j = 0; j <= NTHE; j += 1) {
            // theta walks BACKWARDS on purpose. `loftRows` winds each quad
            // (row, row+1, col+1), so the face normal comes out as
            // rowDir × colDir = radial × tangential — which for a
            // counter-clockwise theta is (0, −1, 0), i.e. the mound's front
            // faces point at the ground and the whole thing is backface-culled
            // into invisibility from the only camera that ever looks at it.
            // First pass shipped exactly that: a graveyard of clods on bare
            // grass with no earth under them.
            const th = -(j / NTHE) * Math.PI * 2;
            const rr = rEdge(th) * k;
            const bump = (hash01(i * 13.7 + j * 3.3) - 0.5) * 0.014 * (1 - k);
            const y = 0.002 + 0.053 * Math.pow(1 - k, 1.4) + bump;
            row.push(new t.Vector3(EARTH_C.x + Math.cos(th) * rr, y, EARTH_C.z + Math.sin(th) * rr));
          }
          earthRows.push(row);
        }
        const earth = new t.Mesh(loftRows(t, earthRows), mat(t, 0x4a3a2a, { tex: 'concrete', repeat: [5, 5], rough: 1, bump: 0.05 }));
        earth.receiveShadow = true;
        g.add(earth);
        // clods and sods straddling the boundary
        const clodP: MergedBoxSpec[] = [];
        for (let i = 0; i < 26; i += 1) {
          const th = (i / 26) * Math.PI * 2 + hash01(i * 5.1) * 0.2;
          const rr = rEdge(th) * (0.88 + hash01(i * 7.7) * 0.28);
          const w = 0.09 + hash01(i * 2.3) * 0.16;
          clodP.push({
            dims: [w, 0.035 + hash01(i * 3.9) * 0.03, w * (0.6 + hash01(i * 11.3) * 0.7)],
            pos: [EARTH_C.x + Math.cos(th) * rr, 0.014, EARTH_C.z + Math.sin(th) * rr],
            rotY: hash01(i * 9.1) * 3.14,
          });
        }
        const clods = mergedBoxes(t, clodP, 0x453728, { tex: 'concrete', rough: 1 });
        clods.castShadow = false;
        g.add(clods);
        const stone = 0x8f948f;
        /** a tombstone: plinth, marker, CARVED face (a sunk panel plus rows of
         *  chiselled inscription lines), a kerbed grave slab and moss on the
         *  weather side. `kind` picks the head shape — round, gabled or a
         *  broken stump snapped off at an angle. */
        // FIVE MARKERS, ONE BATCH. Every grave used to be a Group of 12-13
        // separate meshes — four graves plus the cross came to ~56 draw calls
        // for static stone that never moves relative to itself. The geometry is
        // unchanged; each part's transform is now COMPOSED (the grave's own
        // yaw/settle matrix times the part's local offset) and baked into a
        // MergedBoxSpec, so the whole churchyard lands in four merged meshes
        // banded by tone — furniture, marker stone, sunk panel, inscription —
        // plus one moss batch and the two round headstone caps.
        const furnP: MergedBoxSpec[] = []; // plinths, slabs, kerbs, footings
        const markP: MergedBoxSpec[] = []; // the markers themselves
        const panelP: MergedBoxSpec[] = []; // sunk carved panels
        const inscP: MergedBoxSpec[] = []; // chiselled lines
        const mossP: MergedBoxSpec[] = [];
        const roundCaps: [number, number, number, number][] = []; // x, y, z, ry
        const grave = (x: number, z: number, ry: number, kind: 'round' | 'gable' | 'broken', tilt = 0) => {
          // the grave's own frame: yaw, then settle (three.js Euler order XYZ)
          const G = new t.Matrix4().makeRotationFromEuler(new t.Euler(0, ry, tilt, 'XYZ'));
          G.setPosition(x, 0, z);
          /** compose a part's local transform into the grave's frame */
          const at = (
            dims: [number, number, number],
            pos: [number, number, number],
            rot?: [number, number, number],
            repeat?: [number, number],
          ): MergedBoxSpec => {
            const L = new t.Matrix4().makeRotationFromEuler(new t.Euler(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0, 'XYZ'));
            L.setPosition(pos[0], pos[1], pos[2]);
            return { dims, matrix: new t.Matrix4().multiplyMatrices(G, L), ...(repeat ? { repeat } : {}) };
          };
          const h = kind === 'broken' ? 0.21 : 0.3;
          furnP.push(at([0.26, 0.05, 0.1], [0, 0.025, 0])); // plinth
          markP.push(at([0.2, h, 0.055], [0, 0.05 + h / 2, 0], undefined, [2, 2]));
          if (kind === 'round') {
            const c = new t.Vector3(0, 0.05 + h, 0).applyMatrix4(G);
            roundCaps.push([c.x, c.y, c.z, ry]);
          }
          if (kind === 'gable')
            [-1, 1].forEach((sg) => markP.push(at([0.145, 0.05, 0.055], [sg * 0.036, 0.05 + h + 0.017, 0], [0, 0, -sg * 0.72])));
          if (kind === 'broken') {
            markP.push(at([0.2, 0.07, 0.055], [0.02, 0.05 + h, 0], [0, 0, 0.28])); // snapped top
            markP.push(at([0.13, 0.16, 0.05], [0.19, 0.03, 0.06], [0, 0.4, 1.2])); // the fallen piece
          }
          // carved face: a recessed panel with chiselled inscription lines
          panelP.push(at([0.15, h - 0.07, 0.012], [0, 0.06 + h / 2, 0.03]));
          for (let i = 0; i < 3; i++) inscP.push(at([0.1 - i * 0.022, 0.012, 0.008], [0, 0.03 + h - i * 0.055, 0.035]));
          furnP.push(at([0.3, 0.045, 0.34], [0, 0.022, 0.2])); // grave slab
          [-1, 1].forEach((sg) => furnP.push(at([0.03, 0.06, 0.34], [sg * 0.15, 0.03, 0.2]))); // kerbs
          mossP.push(at([0.075, 0.05, 0.07], [0.085, 0.05, -0.02], [0, 0.6, 0]));
          mossP.push(at([0.052, 0.036, 0.05], [-0.07, 0.042, 0.05], [0, 1.1, 0]));
        };
        grave(2.85, 0.35, -0.9, 'round');
        grave(2.75, -0.5, -2.2, 'gable', 0.07);
        grave(2.1, -0.95, -1.4, 'broken', -0.05);
        grave(3.0, 0.95, -0.55, 'round', 0.05);
        // cross-shaped marker, leaning, with a mossy footing — same batch
        {
          const G = new t.Matrix4().makeRotationFromEuler(new t.Euler(0, 0.5, 0.12, 'XYZ'));
          G.setPosition(2.05, 0, 0.72);
          const at = (dims: [number, number, number], pos: [number, number, number], ryy = 0): MergedBoxSpec => {
            const L = new t.Matrix4().makeRotationY(ryy);
            L.setPosition(pos[0], pos[1], pos[2]);
            return { dims, matrix: new t.Matrix4().multiplyMatrices(G, L) };
          };
          markP.push(at([0.06, 0.42, 0.06], [0, 0.21, 0]));
          markP.push(at([0.24, 0.06, 0.06], [0, 0.3, 0]));
          markP.push(at([0.05, 0.05, 0.05], [0, 0.345, 0], 0.78)); // finial
          furnP.push(at([0.16, 0.05, 0.16], [0, 0.025, 0])); // footing
        }
        [
          [furnP, 0x7f847f] as const,
          [markP, stone] as const,
          [panelP, 0x787d78] as const,
          [inscP, 0x5f645f] as const,
        ].forEach(([parts, col]) => {
          const m = mergedBoxes(t, parts, col, { tex: 'concrete', rough: 0.96 });
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
        });
        g.add(mergedBoxes(t, mossP, 0x4c6e30, { tex: 'leaf', rough: 0.95 }));
        roundCaps.forEach(([cx, cy, cz, ry]) => {
          const cap = cyl(t, 0.1, 0.1, 0.055, stone, [cx, cy, cz], { tex: 'concrete', rough: 0.95, seg: 14 });
          cap.rotation.set(Math.PI / 2, 0, 0);
          cap.rotateY(ry);
          g.add(cap);
        });
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
        /** a TWIG: the same endpoint-placed segment, but merged instead of drawn
         *  — twenty tapered cylinders and their knuckles were twenty draws for
         *  parts a few millimetres thick. The taper is the only thing lost. */
        const twigP: MergedBoxSpec[] = [];
        const twig = (p: [number, number, number], yaw: number, pitch: number, len: number, r: number) => {
          const h = new t.Vector3(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
          const a = new t.Vector3(p[0], p[1], p[2]);
          const b = a.clone().addScaledVector(h, len);
          const sp = strutSpec(t, a, b, r * 1.7, r * 1.7);
          if (sp) twigP.push(sp);
        };
        const bole = limb(limb([0, 0, 0], 0.5, 1.5, 0.62, 0.1, 0.075), -0.6, 1.42, 0.46, 0.075, 0.055); // kinked trunk
        for (let i = 0; i < 5; i++) {
          const yaw = (i / 5) * Math.PI * 2 + 0.9;
          const tip = limb(bole, yaw, 0.72 + (i % 3) * 0.16, 0.44 - (i % 2) * 0.07, 0.05, 0.028);
          for (let k = 0; k < 2; k++) twig(tip, yaw + (k ? 0.8 : -0.7), 0.5 + (i % 2) * 0.35, 0.26 - k * 0.05, 0.022);
        }
        const twigs = mergedBoxes(t, twigP, BARK, { tex: 'wood', rough: 0.95 });
        twigs.castShadow = true;
        tree.add(twigs);
        g.add(tree);
        // weeds and a fallen urn under it — bare earth alone reads unfinished.
        // 27 weed stalks were 27 draws; they are one merged clump now, each
        // blade placed from its base and its leaning tip.
        const weedP: MergedBoxSpec[] = [];
        for (let i = 0; i < 11; i++) {
          const a = i * 2.399;
          const rr = 0.42 + ((i * 17) % 7) * 0.1;
          const wx = 2.45 + Math.cos(a) * rr;
          const wz = Math.sin(a) * rr;
          for (let b = 0; b < 4; b++) {
            const hh = 0.11 + (b % 2) * 0.06 + hash01(i * 3.1 + b) * 0.05;
            const lean = 0.3 + hash01(i + b * 2.7) * 0.55;
            const dir = a + (b - 1.5) * 0.9;
            const base = new t.Vector3(wx + Math.cos(dir) * 0.02, 0.02, wz + Math.sin(dir) * 0.02);
            const sp = strutSpec(t, base, new t.Vector3(base.x + Math.cos(dir) * lean * hh, base.y + hh, base.z + Math.sin(dir) * lean * hh), 0.014, 0.014);
            if (sp) weedP.push(sp);
          }
        }
        const weeds = mergedBoxes(t, weedP, 0x5b6141, { tex: 'leaf', rough: 1 });
        weeds.castShadow = false;
        g.add(weeds);
        const urn = new t.Group();
        urn.position.set(2.62, 0.06, -0.95);
        urn.rotation.z = 1.35; // toppled
        urn.add(cyl(t, 0.07, 0.045, 0.14, 0x8a8f8a, [0, 0, 0], { tex: 'concrete', rough: 0.95, seg: 12 }));
        urn.add(cyl(t, 0.085, 0.085, 0.02, 0x8a8f8a, [0, 0.08, 0], { tex: 'concrete', rough: 0.95, seg: 12 }));
        g.add(urn);
        // rusty iron fence guarding the graveyard's outer arc — pickets, spear
        // finials and both rails in ONE merged mesh (it was 34), with every
        // rail placed from the two picket tops it spans and two pickets bent
        // out of true, because a fence with no casualties reads as a fresh one.
        const FR = 3.05;
        const fenceP: MergedBoxSpec[] = [];
        const picketAt = (i: number) => {
          const a = -0.6 + (i / 8) * 1.2;
          const lean = i === 3 ? 0.16 : i === 6 ? -0.11 : 0;
          return { a, lean, x: Math.cos(a) * FR, z: Math.sin(a) * FR };
        };
        for (let i = 0; i < 9; i++) {
          const q = picketAt(i);
          const base = new t.Vector3(q.x, 0.0, q.z);
          const top = new t.Vector3(q.x + Math.cos(q.a) * q.lean * 0.4, 0.4, q.z + Math.sin(q.a) * q.lean * 0.4);
          const sp = strutSpec(t, base, top, 0.028, 0.028);
          if (sp) fenceP.push(sp);
          // spear finial: a short taper-substitute above the picket top
          const tip = top.clone().addScaledVector(new t.Vector3().subVectors(top, base).normalize(), 0.055);
          const spF = strutSpec(t, top, tip, 0.036, 0.036);
          if (spF) fenceP.push(spF);
        }
        [0.14, 0.34].forEach((fy) => {
          for (let i = 0; i < 8; i++) {
            const q0 = picketAt(i);
            const q1 = picketAt(i + 1);
            const k = fy / 0.4;
            const a = new t.Vector3(q0.x + Math.cos(q0.a) * q0.lean * 0.4 * k, fy, q0.z + Math.sin(q0.a) * q0.lean * 0.4 * k);
            const b = new t.Vector3(q1.x + Math.cos(q1.a) * q1.lean * 0.4 * k, fy, q1.z + Math.sin(q1.a) * q1.lean * 0.4 * k);
            const sp = strutSpec(t, a, b, 0.025, 0.025);
            if (sp) fenceP.push(sp);
          }
        });
        const fence = mergedBoxes(t, fenceP, IRON, { tex: 'metal', metal: 0.5, rough: 0.6 });
        fence.castShadow = true;
        g.add(fence);

        // ------------------------------------------------------------------
        // THE SHOW ROOM — what the collapsed roof reveals.
        //
        // The track inside the building is a C, open toward the facade, and the
        // whole band |z| < 0.6 east of x −2.08 is free: the train only crosses
        // the full width of the room at |z| ≈ 0.65-0.75. That is where the show
        // goes, so nothing here is anywhere near the car envelope (rail centres
        // ±0.085, car half-width 0.18 ⇒ a 0.19 sweep, and the tightest
        // clearance below is 0.13 at the organ).
        //
        // Everything in here is night-driven, and almost all of it is EMISSIVE
        // rather than lit: three real PointLights is the whole budget for this
        // ride, so the candles, the coffin's glow, the organ's music desk and
        // the doorway reveals all carry their own light. Note the trap: `mat()`
        // bakes the colour into the TEXTURE and leaves `material.color` white,
        // so a mapped material has to be given `emissiveMap = map` (the same
        // texture object — free) for its glow to have the right shape, and an
        // unmapped one just takes `emissive`. Everything self-lit below is
        // deliberately UNMAPPED for that reason.
        // ------------------------------------------------------------------
        // 1. flagstone floor inside the show band, laid proud of the plinth so
        //    the doorways look into a FLOOR rather than out at the grass
        const flagP: MergedBoxSpec[] = [];
        for (let i = 0; i < 5; i += 1)
          for (let j = 0; j < 4; j += 1) {
            const w = 0.26 + hash01(i * 3.1 + j) * 0.07;
            flagP.push({
              dims: [w, 0.03, 0.24 + hash01(i + j * 2.7) * 0.07],
              pos: [-2.02 + i * 0.29, 0.185, -0.44 + j * 0.3],
              rotY: (hash01(i * 7.7 + j) - 0.5) * 0.08,
            });
          }
        const flags = mergedBoxes(t, flagP, 0x3a3a44, { tex: 'concrete', repeat: [1, 1], rough: 0.95 });
        flags.receiveShadow = true;
        g.add(flags);

        // 2. THE COFFIN, lid ajar on a trestle bier, with green light climbing
        //    out of it. This is the reveal the hole is aimed at.
        const COF = new t.Vector3(-1.66, 0.2, 0.02);
        const cofP: MergedBoxSpec[] = [];
        const bierP: MergedBoxSpec[] = [];
        [-0.28, 0.28].forEach((dz) => {
          bierP.push({ dims: [0.3, 0.05, 0.07], pos: [COF.x, COF.y + 0.3, COF.z + dz] });
          [-1, 1].forEach((sx) => {
            const a = new t.Vector3(COF.x + sx * 0.12, COF.y + 0.3, COF.z + dz);
            const b = new t.Vector3(COF.x + sx * 0.16, COF.y, COF.z + dz);
            const sp = strutSpec(t, a, b, 0.04, 0.04);
            if (sp) bierP.push(sp);
          });
        });
        g.add(mergedBoxes(t, bierP, 0x2a2129, { tex: 'wood', rough: 0.95 }));
        // a tapered casket: shoulders wide, foot narrow — three boxes, not one
        cofP.push({ dims: [0.26, 0.15, 0.3], pos: [COF.x, COF.y + 0.4, COF.z + 0.16], repeat: [2, 1] });
        cofP.push({ dims: [0.22, 0.15, 0.16], pos: [COF.x, COF.y + 0.4, COF.z - 0.05] });
        cofP.push({ dims: [0.15, 0.15, 0.2], pos: [COF.x, COF.y + 0.4, COF.z - 0.24] });
        // the LID, hinged on the far side and thrown open
        {
          const L = new t.Matrix4().makeRotationX(-0.85);
          L.setPosition(COF.x, COF.y + 0.49, COF.z + 0.24);
          cofP.push({ dims: [0.28, 0.03, 0.62], matrix: L, repeat: [2, 3] });
        }
        const coffin = mergedBoxes(t, cofP, 0x3d2a1c, { tex: 'wood', rough: 0.9 });
        coffin.castShadow = true;
        g.add(coffin);
        // the glow inside it, and the pale hands on the rim
        const cofGlowMat = glowMat(0x0d2a1a, SHOW_GREEN, 0.85);
        showGlow.push(cofGlowMat);
        const cofGlow = new t.Mesh(new t.BoxGeometry(0.2, 0.02, 0.52), cofGlowMat);
        cofGlow.position.set(COF.x, COF.y + 0.47, COF.z);
        g.add(cofGlow);
        g.add(
          mergedBoxes(
            t,
            [
              { dims: [0.05, 0.03, 0.09], pos: [COF.x - 0.08, COF.y + 0.5, COF.z + 0.12], rotZ: 0.2 },
              { dims: [0.05, 0.03, 0.09], pos: [COF.x + 0.08, COF.y + 0.5, COF.z + 0.12], rotZ: -0.2 },
            ],
            0xe8e4da,
            { rough: 0.6 },
          ),
        );

        // 3. THE CANDELABRA, hung off the surviving purlin over the coffin
        const CH = new t.Vector3(COF.x + 0.06, 1.62, COF.z + 0.05);
        const chainP: MergedBoxSpec[] = [{ dims: [0.018, 0.34, 0.018], pos: [CH.x, CH.y + 0.19, CH.z] }];
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          const arm = strutSpec(
            t,
            new t.Vector3(CH.x, CH.y, CH.z),
            new t.Vector3(CH.x + Math.cos(a) * 0.13, CH.y + 0.03, CH.z + Math.sin(a) * 0.13),
            0.016,
            0.016,
          );
          if (arm) chainP.push(arm);
          chainP.push({ dims: [0.035, 0.03, 0.035], pos: [CH.x + Math.cos(a) * 0.13, CH.y + 0.05, CH.z + Math.sin(a) * 0.13] });
        }
        chainP.push({ dims: [0.06, 0.05, 0.06], pos: [CH.x, CH.y - 0.02, CH.z] });
        g.add(mergedBoxes(t, chainP, 0x1e1f24, { tex: 'metal', metal: 0.5, rough: 0.55 }));
        const waxP: MergedBoxSpec[] = [];
        const flameP: MergedBoxSpec[] = [];
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          const hh = 0.07 + (i % 3) * 0.022; // candles burn down unevenly
          const cx = CH.x + Math.cos(a) * 0.13;
          const cz = CH.z + Math.sin(a) * 0.13;
          waxP.push({ dims: [0.026, hh, 0.026], pos: [cx, CH.y + 0.065 + hh / 2, cz] });
          flameP.push({ dims: [0.02, 0.05, 0.02], pos: [cx, CH.y + 0.065 + hh + 0.028, cz] });
        }
        g.add(mergedBoxes(t, waxP, 0xe6dfc8, { rough: 0.7 }));
        const flameMat = glowMat(0xffe1a0, 0xffb040, 1.5);
        showFlame.push(flameMat);
        const flames = new t.Mesh(mergedBoxes(t, flameP, 0xffe1a0, { rough: 0.7 }).geometry, flameMat);
        flames.castShadow = false;
        g.add(flames);

        // 4. THE ORGAN in the back corner — the tallest silhouette in the room,
        //    which is what the sight line through the hole actually lands on.
        //    Front face at x −2.42, clearing the car envelope (−2.29) by 0.13.
        const ORG = new t.Vector3(-2.55, 0.2, -0.92);
        const orgP: MergedBoxSpec[] = [
          { dims: [0.26, 0.62, 0.6], pos: [ORG.x, ORG.y + 0.31, ORG.z], repeat: [1, 2] }, // case
          { dims: [0.3, 0.05, 0.66], pos: [ORG.x, ORG.y + 0.64, ORG.z] }, // cornice
          { dims: [0.16, 0.05, 0.5], pos: [ORG.x + 0.19, ORG.y + 0.46, ORG.z] }, // music desk shelf
          { dims: [0.06, 0.3, 0.62], pos: [ORG.x - 0.02, ORG.y + 0.82, ORG.z] }, // pipe backboard
        ];
        const pipeP: MergedBoxSpec[] = [];
        for (let i = 0; i < 13; i += 1) {
          // a real organ front is a symmetric V of mitred pipes
          const k = Math.abs(i - 6) / 6;
          const hh = 0.5 - 0.3 * k;
          pipeP.push({ dims: [0.055, hh, 0.042], pos: [ORG.x + 0.06, ORG.y + 0.67 + hh / 2, ORG.z - 0.26 + i * 0.043] });
        }
        g.add(mergedBoxes(t, orgP, 0x2f2231, { tex: 'wood', rough: 0.9 }));
        const pipes = mergedBoxes(t, pipeP, 0x8f9299, { tex: 'metal', metal: 0.55, rough: 0.4 });
        pipes.castShadow = true;
        g.add(pipes);
        // the keyboard, and the sheet of music glowing on the desk
        g.add(box(t, [0.1, 0.03, 0.44], 0xe6e2d6, [ORG.x + 0.22, ORG.y + 0.49, ORG.z], { rough: 0.7 }));
        const deskMat = glowMat(0x0d2a1a, SHOW_GREEN, 0.65);
        showGlow.push(deskMat);
        const desk = new t.Mesh(new t.BoxGeometry(0.13, 0.02, 0.34), deskMat);
        desk.position.set(ORG.x + 0.2, ORG.y + 0.53, ORG.z);
        desk.rotation.z = 0.35;
        g.add(desk);

        // 5. interior cobwebs in the two back corners, seen through the hole
        cornerWeb(-2.64, 1.4, -1.2, 0.36, 1, Math.PI);
        cornerWeb(-2.64, 1.4, 1.2, 0.36, -1, Math.PI);

        // 6. DOORWAY REVEALS — the doors used to be two black rectangles day
        //    and night, which is the opposite of what a dark ride's mouth
        //    should do. Each opening gets a glowing jamb strip either side and
        //    a soffit under the lintel, all inboard of the wall face so nothing
        //    can foul the train passing through. One merged mesh, one material,
        //    night-gated with the rest of the show.
        const jambP: MergedBoxSpec[] = [];
        doorZs.forEach((dz) => {
          [-1, 1].forEach((sz) => jambP.push({ dims: [0.05, 0.86, 0.045], pos: [wallX - 0.05, 0.53, dz + sz * 0.27] }));
          jambP.push({ dims: [0.05, 0.045, 0.56], pos: [wallX - 0.05, 0.93, dz] });
        });
        const jambMat = glowMat(0x0d2a1a, SHOW_GREEN, 0.5);
        showGlow.push(jambMat);
        const jambs = new t.Mesh(mergedBoxes(t, jambP, 0x0d2a1a, { rough: 0.55 }).geometry, jambMat);
        jambs.castShadow = false;
        g.add(jambs);

        // 7. a fourth spectre rising OUT OF THE COFFIN, framed by the hole
        const cryptGhost = buildGhost(0.85, 0.62);
        cryptGhost.position.set(COF.x, COF.y + 0.62, COF.z + 0.04);
        g.add(cryptGhost);

        // the daylight base of every reveal, snapshotted once — the night gate
        // lifts each one off its OWN base rather than off a shared constant
        const showGlowBase = showGlow.map((m) => m.emissiveIntensity);

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
        // moved off the doorway and INTO the show room: at (-1.1, 0.7, 0) it lit
        // the inside of the front wall and nothing else, so the only thing it
        // achieved was a faint rim on the door flaps. Over the coffin it lights
        // the reveal the roof hole is aimed at AND still spills out both doors.
        const doorGlow = new t.PointLight(0x40ff80, 0, 4, 2); // eerie interior spill
        doorGlow.position.set(-1.62, 0.78, 0.04);
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
          // the show room: the green reveals climb hard after dark and BREATHE
          // (three offset sines so no two surfaces pulse together — one shared
          // clock would read as a single flickering bulb wired to everything),
          // and the candles flicker on their own faster clock.
          showGlow.forEach((m, i) => {
            m.emissiveIntensity = showGlowBase[i] + ease * (1.5 + 0.28 * Math.sin(time * (1.7 + i * 0.43) + i * 1.9));
          });
          showFlame.forEach((m) => {
            m.emissiveIntensity = 1.5 + ease * (1.6 + 0.5 * Math.sin(time * 11.3) + 0.3 * Math.sin(time * 17.7));
          });
          // the crypt spectre climbs slowly out of the coffin and sinks back
          cryptGhost.position.y = COF.y + 0.6 + 0.11 * Math.sin(time * 0.55);
          cryptGhost.rotation.y = 0.5 * Math.sin(time * 0.42) + Math.PI * 0.15;
          cryptGhost.rotation.z = 0.07 * Math.sin(time * 1.1);
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
