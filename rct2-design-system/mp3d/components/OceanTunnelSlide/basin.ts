// ---------------------------------------------------------------------------
// OceanTunnelSlide / basin.ts — THE REEF BASIN (section 6 of the rig build):
// the rock pool standing in the lagoon, the BORE cut along the tube's own axis
// through its seaward wall (6a), the PORTAL that makes the hole read as a bore
// (6b), the pool water, god-rays, kelp, shoals and the spill over the broken
// lip.
//
// Split out of ./index.tsx for FILE SIZE ONLY. This was one braced block
// inside buildOceanTunnelSlideScene, so it is lifted VERBATIM into a function
// and every value it closed over is now an explicit parameter — the block's
// own locals, ordering and side effects on `g` are untouched.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { mat, mergedBoxes, mergedParts } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildRock } from '../Rock';
import { hash01 } from '../ColorKit';
import {
  BORE_R,
  IRON_D,
  REEF,
  REEF_D,
  REEF_L,
  REEF_X,
  TUBE_C,
  TUBE_R,
  buildFishShoal,
  cutColumns,
  drawAfterWater,
  kelpClump,
  segDist2,
  tagRock,
} from './parts';

/** everything the basin block used from the enclosing build closure */
export interface ReefBasinCtx {
  t: typeof THREE;
  g: THREE.Group;
  ride: { frameAt: (u: number) => { p: THREE.Vector3; fwd: THREE.Vector3; up: THREE.Vector3; side: THREE.Vector3 } };
  groundAt: (x: number, z: number) => number;
  distToTrack: (x: number, z: number) => number;
  yawOf: (f: { fwd: THREE.Vector3 }) => number;
  basin: THREE.Vector3;
  basinInfo: { u: number; y: number; f: { p: THREE.Vector3; fwd: THREE.Vector3; up: THREE.Vector3; side: THREE.Vector3 } };
  basinWater: { mesh: THREE.Mesh; update?: (time: number) => void };
  BASIN_R: number;
  BASIN_FLOOR: number;
  SEA: number;
  uTubeA: number;
  uTubeB: number;
  shoals: { grp: THREE.Group; c: THREE.Vector3; r: number; ph: number; sp: number; yaw0: number }[];
}

export function buildReefBasin(ctx: ReefBasinCtx): void {
  const {
    t,
    g,
    ride,
    groundAt,
    distToTrack,
    yawOf,
    basin,
    basinInfo,
    basinWater,
    BASIN_R,
    BASIN_FLOOR,
    SEA,
    uTubeA,
    uTubeB,
    shoals,
  } = ctx;

          const gy = groundAt(basin.x, basin.z);
          // ---- 6a. THE BORE: the line the hole is cut along ----------------
          // The tube's OWN axis, `TUBE_C` above the rail — the same line
          // `buildTubeShell` sweeps its rings about. Every rock decision below
          // is taken against this polyline, so the hole is the tube's hole and
          // cannot drift: widen `TUBE_R` again and the bore widens with it.
          const AXN = 200;
          const ax = new Float64Array((AXN + 1) * 3);
          const uAt = (i: number) => uTubeA + ((uTubeB - uTubeA) * i) / AXN;
          for (let i = 0; i <= AXN; i += 1) {
            const f = ride.frameAt(uAt(i));
            const p = f.p.clone().addScaledVector(f.up, TUBE_C);
            ax[i * 3] = p.x;
            ax[i * 3 + 1] = p.y;
            ax[i * 3 + 2] = p.z;
          }
          /** distance from a point to the tube's axis */
          const axisDist = (x: number, y: number, z: number) => {
            let best = Infinity;
            for (let i = 0; i < AXN; i += 1) {
              const d2 = segDist2(x, y, z, ax[i * 3], ax[i * 3 + 1], ax[i * 3 + 2], ax[i * 3 + 3], ax[i * 3 + 4], ax[i * 3 + 5]);
              if (d2 < best) best = d2;
            }
            return Math.sqrt(best);
          };
          /** the test the whole cut is built on */
          const clearOfBore = (x: number, y: number, z: number) => axisDist(x, y, z) >= BORE_R + 0.04;
          /** the closest the axis comes to a COLUMN of wall, in 3-D — used to
           *  decide which boxes need cutting at all */
          const axisColumn = (x: number, z: number, y0: number, y1: number) => {
            let best = Infinity;
            const n = Math.max(2, Math.ceil((y1 - y0) / 0.3));
            for (let k = 0; k <= n; k += 1) {
              const d = axisDist(x, y0 + ((y1 - y0) * k) / n, z);
              if (d < best) best = d;
            }
            return best;
          };
          /** a loose piece (a boulder, a chunk of spoil) may not reach inside
           *  the bore — `pad` buys extra daylight round it */
          const clearsBore = (o: THREE.Object3D, pad = 0.04) => {
            o.updateMatrixWorld(true);
            let ok = true;
            const v = new t.Vector3();
            o.traverse((m) => {
              const geo = (m as THREE.Mesh).geometry;
              if (!ok || !geo) return;
              const pos = geo.getAttribute('position');
              for (let i = 0; i < pos.count; i += 1) {
                v.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(m.matrixWorld);
                if (axisDist(v.x, v.y, v.z) < BORE_R + pad) {
                  ok = false;
                  return;
                }
              }
            });
            return ok;
          };
          // the two ends of the PASS-THROUGH. The axis dives across the pool,
          // so the crossing that needs a hole is the DOWNHILL one — at the
          // uphill rim the tube is 2.5 units of air above the rock and needs
          // nothing. `iIn` is the pool-side mouth, `iOut` the seaward one.
          let iMid = 0;
          let dMid = Infinity;
          for (let i = 0; i <= AXN; i += 1) {
            const d = Math.hypot(ax[i * 3] - basin.x, ax[i * 3 + 2] - basin.z);
            if (d < dMid) {
              dMid = d;
              iMid = i;
            }
          }
          // THE MOUTHS GO ON THE WALL FACES, and that is a correction worth
          // keeping: the tube also dips below the level of the pool's FLOOR two
          // units before it reaches the wall (measured, the axis is only 0.50
          // above the floor at the lining), so an earlier cut put the portal
          // where the bore first met rock of any kind — out in the middle of
          // the pool, where it rendered as a ring of masonry standing free in
          // the water with daylight all round it. The floor is a cutting, not a
          // portal: it gets a TRENCH (the floor grid is cut like everything
          // else) and the arch, the rim and the mouth ring go on the wall,
          // where there is rock above them to be carried over the hole.
          const FLOOR_TOP = BASIN_FLOOR + 0.05;
          let iIn = iMid;
          let iOut = iMid;
          for (let i = iMid; i <= AXN; i += 1) {
            const d = Math.hypot(ax[i * 3] - basin.x, ax[i * 3 + 2] - basin.z);
            if (d < BASIN_R - 0.42) iIn = i;
            if (d < BASIN_R + 1.15) iOut = i;
          }
          /** plan distance to the bore and the crown height over it, measured
           *  ONLY over the pass-through stations.
           *
           *  Measuring it over the whole axis was a real bug and it rendered
           *  loudly: in PLAN the tube also passes straight over the pool's
           *  UPHILL rim — 2.5 units above it, in open air — so every box on the
           *  entry side read as "on the bore" and was raised to that crown plus
           *  0.55. The park camera came back with a six-unit cliff of rock
           *  standing across the near side of the pool. The face is a property
           *  of the CROSSING, not of the ground plan. */
          const boreFace = (x: number, z: number) => {
            let best = Infinity;
            let y = 0;
            for (let i = Math.max(0, iIn - 8); i <= Math.min(AXN, iOut + 8); i += 1) {
              const dx = ax[i * 3] - x;
              const dz = ax[i * 3 + 2] - z;
              const d = dx * dx + dz * dz;
              if (d < best) {
                best = d;
                y = ax[i * 3 + 1];
              }
            }
            return { d: Math.sqrt(best), crown: y + BORE_R };
          };

          // the STACK: a wall of reef rock round the pool, BROKEN on the
          // seaward side where it spills — and BORED where the tube goes
          // through it
          const spillYaw = yawOf(basinInfo.f) + Math.PI; // downhill, along the tube
          const rockSpecs: MergedBoxSpec[] = [];
          for (let k = 0; k < 34; k += 1) {
            const a = (k / 34) * Math.PI * 2;
            const inNotch = Math.abs(Math.cos(a - spillYaw)) > 0.955;
            // THE VIEWING SIDE IS LOW, and it has to be: a rock wall all the way
            // round a 3.5-unit pool hides the water and the tube inside it from
            // every camera that is not directly overhead (the same lesson the
            // sea caves in DeepDrift taught). The local +z arc — the queue and
            // beach side — is capped level with the water, so the eye looks over
            // a lip into the pool; the rest of the ring stands 0.2-0.5 proud.
            const openSide = Math.sin(a) > 0.35;
            const h1 = hash01(k * 5.7 + 3);
            const h2 = hash01(k * 2.9 + 17);
            const rr = BASIN_R + 0.42 + h1 * 0.3;
            const bx = basin.x + Math.cos(a) * rr;
            const bz = basin.z + Math.sin(a) * rr;
            const bw = 1.05 + h1 * 0.5;
            const bd = 0.95 + h2 * 0.5;
            const rotY = a + (h1 - 0.5) * 0.5;
            const plan = boreFace(bx, bz);
            // THE PORTAL FACE. Where the bore comes through, the wall does the
            // OPPOSITE of a notch: it STANDS UP, to the bore's crown plus 1.10,
            // so there is undisturbed rock over the opening. The first pass
            // notched the top down to a hair above the tube's crown, which
            // buried the tube in the wall instead of opening it — that is
            // exactly why the ride read as blocked. Beyond 2.6 the face falls
            // away again to the broken lip, so the pool still spills either
            // side of the portal and the buttress reads as a headland with a
            // hole in it rather than as a dam.
            const face = Math.max(0, Math.min(1, (2.6 - plan.d) / 1.0));
            const broken = basinInfo.y - 0.55;
            const plain = openSide
              ? basinInfo.y + 0.04 + 0.06 * hash01(k * 3.1)
              : basinInfo.y + 0.2 + 0.34 * hash01(k * 3.1);
            // crown + 1.10 puts the headland ~0.9 above the pool's surface,
            // level with the rest of the ring: at +0.55 the buttress topped out
            // 0.12 above the waterline and read as a submerged shelf, not as a
            // headland with a hole driven through it.
            const top = face > 0 ? (1 - face) * (inNotch ? broken : plain) + face * (plan.crown + 1.1) : inNotch ? broken : plain;
            const o = { cx: bx, cz: bz, w: bw, d: bd, rotY, y0: gy - 0.3, y1: top, repeat: [2, 3] as [number, number] };
            if (axisColumn(bx, bz, gy - 0.3, top) < BORE_R + 0.1 + Math.hypot(bw, bd) / 2) cutColumns(rockSpecs, o, clearOfBore);
            else rockSpecs.push({ dims: [bw, top - gy + 0.3, bd], pos: [bx, (top + gy) / 2 - 0.15, bz], rotY, repeat: [2, 3] });
          }
          const stack = mergedBoxes(t, rockSpecs, REEF_D, { tex: 'concrete', rough: 0.96, bump: 0.08, flat: true });
          g.add(tagRock(stack));
          // faceted rock over the wall, because a ring of merged boxes has flat
          // tops and a reef stack must not read as masonry
          for (let k = 0; k < 32; k += 1) {
            const a = (k / 32) * Math.PI * 2 + 0.3;
            if (Math.abs(Math.cos(a - spillYaw)) > 0.93) continue; // keep the notch clear
            if (Math.sin(a) > 0.3) continue; // and the viewing side low
            const h1 = hash01(k * 4.3 + 21);
            const h2 = hash01(k * 7.9 + 31);
            const rr = BASIN_R + 0.5 + h1 * 0.7;
            const rx = basin.x + Math.cos(a) * rr;
            const rz = basin.z + Math.sin(a) * rr;
            const rk = buildRock(t, { scale: 0.7 + 0.8 * h2, seed: 400 + k * 7, tint: h1 > 0.5 ? REEF : REEF_D });
            rk.position.set(rx, basinInfo.y + 0.06 + 0.34 * h1, rz);
            // the azimuth skip above is a HEURISTIC; this is the measurement.
            // Every boulder is tested VERTEX BY VERTEX against the tube's axis.
            // AT THE PORTAL it must stand a full unit clear, not merely outside
            // the hole: a 1.5-scale boulder sitting on the lintel blocks
            // nothing, but from the queue and the park camera it hides the very
            // thing the lintel is there to frame, and the first cut of this
            // work buried the whole portal under the rim pile. Everywhere else
            // — including the uphill rim, where the tube flies 2.5 units over
            // the rock in open air — the margin stays at the geometric 0.04, so
            // the reef keeps its boulders.
            if (!clearsBore(rk, boreFace(rx, rz).d < 3.4 ? 1.0 : 0.04)) continue;
            g.add(tagRock(rk));
          }
          // small rock along the LOW viewing lip: the merged wall is boxes, and
          // a kerb of flat-topped boxes round a pool reads as masonry
          for (let k = 0; k < 14; k += 1) {
            const a = 0.4 + (k / 13) * 2.35; // the +z arc only
            const h1 = hash01(k * 8.3 + 61);
            const rr = BASIN_R + 0.42 + h1 * 0.34;
            const rk = buildRock(t, { scale: 0.3 + 0.28 * h1, seed: 520 + k * 5, tint: h1 > 0.5 ? REEF : REEF_D });
            rk.position.set(basin.x + Math.cos(a) * rr, basinInfo.y - 0.02, basin.z + Math.sin(a) * rr);
            rk.userData.lodDetail = true;
            g.add(tagRock(rk));
          }
          // THE BASIN FLOOR — pale wet sand, because a light bottom is what
          // makes water read as water.
          //
          // It is a TILE GRID and not the smooth disc it started as, for one
          // measured reason: the tube dives below the floor's own level 2.2
          // units before it reaches the wall (the axis is 0.50 above the floor
          // at the lining and the bore needs 1.07), so the disc was the largest
          // single blocker left in the bore after the wall was opened — 76 of
          // 401 stations under the required clearance, worst 0.496. A disc
          // cannot be cut; a grid can, through the same `cutColumns` every
          // other piece of rock here goes through, and it matches how this
          // component already builds its beach and its lagoon bed.
          {
            const floorSpecs: MergedBoxSpec[] = [];
            const FS = 0.62;
            for (let fx = -BASIN_R - 0.3; fx <= BASIN_R + 0.3; fx += FS)
              for (let fz = -BASIN_R - 0.3; fz <= BASIN_R + 0.3; fz += FS) {
                if (Math.hypot(fx, fz) > BASIN_R + 0.22) continue;
                const h = hash01(fx * 3.7 + fz * 1.9 + 13);
                const px = basin.x + fx;
                const pz = basin.z + fz;
                const top = FLOOR_TOP - 0.03 * h;
                const o = { cx: px, cz: pz, w: FS + 0.16, d: FS + 0.16, rotY: (h - 0.5) * 0.24, y0: top - 0.62, y1: top, repeat: [2, 2] as [number, number] };
                if (axisColumn(px, pz, o.y0, o.y1) < BORE_R + 0.1 + FS) cutColumns(floorSpecs, o, clearOfBore);
                else floorSpecs.push({ dims: [o.w, 0.62, o.d], pos: [px, top - 0.31, pz], rotY: o.rotY, repeat: [2, 2] });
              }
            const floor = mergedBoxes(t, floorSpecs, 0xa89c7e, { tex: 'sand', rough: 1, bump: 0.05, flat: true });
            floor.castShadow = false;
            g.add(tagRock(floor));
          }
          const lining: MergedBoxSpec[] = [];
          for (let k = 0; k < 26; k += 1) {
            const a = (k / 26) * Math.PI * 2;
            const h1 = hash01(k * 6.1 + 41);
            const lw = 0.95;
            const ld = 0.5 + h1 * 0.3;
            const lx = basin.x + Math.cos(a) * (BASIN_R - 0.12);
            const lz = basin.z + Math.sin(a) * (BASIN_R - 0.12);
            const o = { cx: lx, cz: lz, w: lw, d: ld, rotY: a, y0: BASIN_FLOOR - 0.2, y1: basinInfo.y + 0.2, repeat: [2, 3] as [number, number] };
            // the lining is a CLOSED ring and the tube goes straight through it
            // — it was the deepest blocker of the three, standing floor to lip
            // right across the mouth
            if (axisColumn(lx, lz, o.y0, o.y1) < BORE_R + 0.1 + Math.hypot(lw, ld) / 2) cutColumns(lining, o, clearOfBore);
            else
              lining.push({
                dims: [lw, basinInfo.y - BASIN_FLOOR + 0.4, ld],
                pos: [lx, (basinInfo.y + BASIN_FLOOR) / 2, lz],
                rotY: a,
                repeat: [2, 3],
              });
          }
          g.add(tagRock(mergedBoxes(t, lining, REEF, { tex: 'concrete', rough: 0.96, bump: 0.07, flat: true })));

          // ---- 6b. THE PORTAL: what makes the hole read as a BORE ----------
          // A gap in a wall is not a tunnel. What says "driven through" is the
          // set of things a real bore leaves behind, and all five are here, at
          // BOTH ends of the pass-through:
          //   * a THROAT of darker rock with a chiselled, scalloped skin, so
          //     the hole has depth and goes somewhere;
          //   * a rim of freshly CUT stone round each mouth — paler than the
          //     weathered reef, which is what reads as "cut" at 40 units;
          //   * an ARCH of undisturbed rock carrying the wall over the opening;
          //   * SPOIL heaped at the foot of each mouth, where it was dug out;
          //   * an iron MOUTH RING where the glass meets the stone, so the tube
          //     visibly ENTERS the rock instead of merely intersecting it.
          // Every piece is sized off `BORE_R`, and every loose piece is
          // REJECTED by `clearsBore` if it reaches into the opening, so the
          // dressing can never re-block what the cut opened.
          //
          // Drawn AFTER the water (`drawAfterWater`, order 2 — the channel's
          // own layer). The pool-side mouth is 1.7 units under the surface and
          // the seaward one stands in the lagoon shallows; WaterTile's sheet is
          // ~80 % opaque, so a portal left in the opaque pass would be veiled
          // to a fifth of its contrast — which is the exact failure that lost
          // the fish and the raft in the first pass.
          {
            const portal: THREE.Object3D[] = [];
            const arcLen = (() => {
              let s = 0;
              for (let i = iIn; i < iOut; i += 1) s += Math.hypot(ax[i * 3 + 3] - ax[i * 3], ax[i * 3 + 4] - ax[i * 3 + 1], ax[i * 3 + 5] - ax[i * 3 + 2]);
              return s;
            })();
            /** the radial / tangential pair at angle `ang` about the axis */
            const dirs = (f: { side: THREE.Vector3; up: THREE.Vector3 }, ang: number) => ({
              radial: f.side.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.up, Math.sin(ang)).normalize(),
              tang: f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.side, -Math.sin(ang)).normalize(),
            });

            // THE THROAT — a rough sleeve of dark rock through the wall. Its
            // inner skin sits 0.03-0.14 outside BORE_R and varies block by
            // block, so the bore is scalloped like something drilled, not piped.
            const throat: MergedBoxSpec[] = [];
            const NS = Math.max(4, Math.round(arcLen / 0.42));
            const segLen = arcLen / NS + 0.06;
            for (let j = 0; j < NS; j += 1) {
              const f = ride.frameAt(uAt(iIn + ((iOut - iIn) * (j + 0.5)) / NS));
              const fwd = new t.Vector3().crossVectors(f.side, f.up);
              const c0 = f.p.clone().addScaledVector(f.up, TUBE_C);
              for (let m = 0; m < 16; m += 1) {
                const ang = (m / 16) * Math.PI * 2;
                const h = hash01(j * 7.3 + m * 2.9 + 5);
                const { radial, tang } = dirs(f, ang);
                const mx = new t.Matrix4().makeBasis(radial, tang, fwd);
                mx.setPosition(c0.clone().addScaledVector(radial, BORE_R + 0.28 + 0.11 * h));
                throat.push({ dims: [0.5, (Math.PI * 2 * BORE_R) / 16 + 0.07, segLen], matrix: mx, repeat: [1, 1] });
              }
            }
            portal.push(mergedBoxes(t, throat, REEF_X, { tex: 'concrete', rough: 0.98, bump: 0.09, flat: true }));

            // THE MOUTHS — cut rim, arch and spoil, at both ends
            const rim: MergedBoxSpec[] = [];
            const arch: MergedBoxSpec[] = [];
            const spoil: MergedBoxSpec[] = [];
            [iIn, iOut].forEach((idx, mouth) => {
              const f = ride.frameAt(uAt(idx));
              const fwd = new t.Vector3().crossVectors(f.side, f.up);
              const out = mouth === 0 ? fwd.clone().negate() : fwd.clone(); // out of the rock
              const c0 = f.p.clone().addScaledVector(f.up, TUBE_C);
              // the CUT RIM: 14 blocks of pale stone standing proud of the face
              for (let m = 0; m < 14; m += 1) {
                const ang = (m / 14) * Math.PI * 2 + 0.11 + mouth * 0.22;
                const h = hash01(m * 4.7 + mouth * 13 + 2);
                const { radial, tang } = dirs(f, ang);
                const mx = new t.Matrix4().makeBasis(radial, tang, fwd);
                mx.setPosition(c0.clone().addScaledVector(radial, BORE_R + 0.26 + 0.12 * h).addScaledVector(out, 0.1 + 0.13 * h));
                rim.push({ dims: [0.44 + 0.22 * h, (Math.PI * 2 * BORE_R) / 14 + 0.05, 0.32 + 0.18 * h], matrix: mx, repeat: [1, 1] });
              }
              // THE ARCH: five voussoirs of undisturbed rock over the opening,
              // plus a keystone — the thing that says the wall did not simply
              // stop, it was carried over the hole
              for (let m = 0; m < 5; m += 1) {
                const ang = Math.PI / 2 + (m - 2) * 0.44;
                const h = hash01(m * 3.3 + mouth * 5 + 7);
                const { radial, tang } = dirs(f, ang);
                const mx = new t.Matrix4().makeBasis(radial, tang, fwd);
                mx.setPosition(c0.clone().addScaledVector(radial, BORE_R + 0.62 + 0.12 * h).addScaledVector(out, 0.12 + 0.1 * h));
                arch.push({ dims: [0.82 + 0.2 * h, 0.66, 0.52 + 0.2 * h], matrix: mx, repeat: [2, 1] });
              }
              {
                const h = hash01(mouth * 9.1 + 3);
                const { radial, tang } = dirs(f, Math.PI / 2);
                const mx = new t.Matrix4().makeBasis(radial, tang, fwd);
                mx.setPosition(c0.clone().addScaledVector(radial, BORE_R + 0.52).addScaledVector(out, 0.2 + 0.1 * h));
                arch.push({ dims: [1.0, 0.5, 0.66], matrix: mx, repeat: [2, 1] }); // the keystone
              }
              // SPOIL: boulders and rubble at the foot of the mouth. The heap
              // is thrown sideways, never in front of the hole, and anything
              // that fails `clearsBore` is dropped rather than nudged.
              const baseY = mouth === 0 ? BASIN_FLOOR : groundAt(c0.x, c0.z);
              for (let m = 0; m < 8; m += 1) {
                const h1 = hash01(m * 5.1 + mouth * 17 + 1);
                const h2 = hash01(m * 2.7 + mouth * 23 + 4);
                const lat = (m % 2 ? 1 : -1) * (1.15 + 0.95 * h1);
                const p = c0
                  .clone()
                  .addScaledVector(out, 0.15 + 1.0 * h2)
                  .addScaledVector(f.side, lat);
                const rk = buildRock(t, { scale: 0.28 + 0.34 * h1, seed: 700 + m * 9 + mouth * 41, tint: h2 > 0.5 ? REEF_L : REEF });
                rk.position.set(p.x, baseY + 0.12 + 0.16 * h2, p.z);
                rk.userData.lodDetail = true;
                if (!clearsBore(rk)) continue;
                portal.push(tagRock(rk));
              }
              for (let m = 0; m < 14; m += 1) {
                const h1 = hash01(m * 6.7 + mouth * 29 + 6);
                const h2 = hash01(m * 3.9 + mouth * 31 + 8);
                const h3 = hash01(m * 8.3 + mouth * 11 + 2);
                const lat = (m % 2 ? 1 : -1) * (0.95 + 1.5 * h1);
                const p = c0
                  .clone()
                  .addScaledVector(out, 0.1 + 1.5 * h2)
                  .addScaledVector(f.side, lat);
                const py = baseY + 0.06 + 0.1 * h3;
                if (axisDist(p.x, py, p.z) < BORE_R + 0.5) continue;
                spoil.push({ dims: [0.2 + 0.3 * h1, 0.14 + 0.16 * h3, 0.22 + 0.26 * h2], pos: [p.x, py, p.z], rotY: h1 * 3.1, rotZ: (h3 - 0.5) * 0.4 });
              }
            });
            portal.push(mergedBoxes(t, rim, REEF_L, { tex: 'concrete', rough: 0.94, bump: 0.09, flat: true }));
            portal.push(mergedBoxes(t, arch, REEF_D, { tex: 'concrete', rough: 0.96, bump: 0.08, flat: true }));
            const spoilMesh = mergedBoxes(t, spoil, REEF, { tex: 'concrete', rough: 0.98, bump: 0.07, flat: true });
            spoilMesh.userData.lodDetail = true;
            portal.push(spoilMesh);
            for (const o of portal) {
              tagRock(o);
              drawAfterWater(o, 2);
              g.add(o);
            }
            // THE MOUTH RINGS — an iron shoulder where the glass meets the
            // stone, one merged mesh for the pair. At TUBE_R + 0.16 it hugs the
            // shell and still leaves 0.09 of shadow gap inside the bore, so the
            // eye reads glass → iron → dark gap → cut rock and the tube is
            // unmistakably going INTO something.
            {
              const parts: PartSpec[] = [iIn, iOut].map((idx) => {
                const f = ride.frameAt(uAt(idx));
                const fwd = new t.Vector3().crossVectors(f.side, f.up);
                // makeBasis(side, up, fwd) is RIGHT-HANDED (fwd = side × up) and
                // puts the torus's hole along the tube, which is the whole point
                // of a mouth ring
                const mx = new t.Matrix4().makeBasis(f.side, f.up, fwd);
                mx.setPosition(f.p.clone().addScaledVector(f.up, TUBE_C));
                return { geo: new t.TorusGeometry(TUBE_R + 0.16, 0.055, 6, 22), matrix: mx, uv: [4, 1] as [number, number] };
              });
              const rings = mergedParts(t, parts, mat(t, IRON_D, { tex: 'metal', metal: 0.45, rough: 0.6, bump: 0.04 }));
              drawAfterWater(rings, 3);
              g.add(rings);
            }
          }

          // the pool itself: WaterTile as it comes, with a real depth skirt so
          // the volume reads from the side
          basinWater.mesh.position.set(basin.x, basinInfo.y, basin.z);
          g.add(basinWater.mesh);
          // KELP standing on the basin floor and breaking the surface, and two
          // SHOALS inside the pool — both drawn after the sheet
          for (let k = 0; k < 9; k += 1) {
            const a = hash01(k * 3.7 + 51) * Math.PI * 2;
            const rr = BASIN_R * (0.35 + 0.55 * hash01(k * 5.3 + 61));
            const kx = basin.x + Math.cos(a) * rr;
            const kz = basin.z + Math.sin(a) * rr;
            if (distToTrack(kx, kz) < 0.95) continue;
            const kelp = kelpClump(t, 900 + k * 11, 1.5 + 0.9 * hash01(k * 2.1), 3);
            kelp.position.set(kx, BASIN_FLOOR + 0.1, kz);
            g.add(kelp);
          }
          for (let k = 0; k < 2; k += 1) {
            const sh = buildFishShoal(t, 11 + k * 4, { count: 13, size: 0.17 });
            const c = new t.Vector3(
              basin.x + (hash01(k * 9.1) - 0.5) * BASIN_R * 0.9,
              BASIN_FLOOR + 0.7 + hash01(k * 4.7) * 1.0,
              basin.z + (hash01(k * 6.3) - 0.5) * BASIN_R * 0.9,
            );
            sh.position.copy(c);
            g.add(sh);
            shoals.push({ grp: sh, c, r: BASIN_R * 0.5, ph: k * 2.2, sp: 0.16 + 0.06 * hash01(k), yaw0: hash01(k * 3.3) * 6.28 });
          }
          // GOD-RAYS: additive slabs coming down through the pool surface. Six,
          // low opacity, drawn last — any more and the pool fogs over.
          // GOD-RAYS: narrow shafts, and narrow is the whole point — the first
          // pass used 1-unit-wide panels at 0.075 and they read as sheets of
          // glass standing in the pool, not as light coming through the surface
          const rayMat = new t.MeshBasicMaterial({
            color: 0xd8f0f4,
            transparent: true,
            opacity: 0.06,
            blending: t.AdditiveBlending,
            depthWrite: false,
            side: t.DoubleSide,
          });
          for (let k = 0; k < 8; k += 1) {
            const h1 = hash01(k * 5.9 + 71);
            const h2 = hash01(k * 3.1 + 83);
            const ray = new t.Mesh(new t.PlaneGeometry(0.16 + h1 * 0.16, 2.3), rayMat);
            const a = h1 * Math.PI * 2 + k * 0.8;
            const rr = BASIN_R * 0.78 * h2;
            ray.position.set(basin.x + Math.cos(a) * rr, basinInfo.y - 1.05, basin.z + Math.sin(a) * rr);
            ray.rotation.set(0.16 + h2 * 0.12, a, 0.1 * (h1 - 0.5), 'YXZ');
            ray.renderOrder = 4;
            g.add(ray);
          }
          // the SPILL: the broken seaward lip, a curtain of water down to the
          // lagoon, and foam where it lands.
          //
          // IT STRADDLES THE PORTAL. The tube leaves through the same seaward
          // arc the pool spills over, and six strands on the centreline hung a
          // curtain of water straight down the face of the mouth — the bore was
          // cut and then immediately curtained. The strands now fall in two
          // clusters 1.5-2.2 either side, off the broken lip the portal
          // buttress rises out of, so the water pours round the shoulders of
          // the headland and the hole stays open. The spray emitter sits at the
          // left-hand cluster for the same reason (and there is still only one
          // of it: the budget is 3 emitters).
          const spillX = basin.x + Math.sin(spillYaw) * (BASIN_R + 0.3);
          const spillZ = basin.z + Math.cos(spillYaw) * (BASIN_R + 0.3);
          const fallMat = mat(t, 0x9fc4cf, { rough: 0.75, opacity: 0.6 });
          fallMat.side = t.DoubleSide;
          const spillOff = (lat: number): [number, number] => [
            spillX + Math.sin(spillYaw + 1.57) * lat,
            spillZ + Math.cos(spillYaw + 1.57) * lat,
          ];
          for (let k = 0; k < 6; k += 1) {
            const hk = hash01(k * 4.9 + 13);
            const w = 0.24 + hk * 0.2;
            const fall = new t.Mesh(new t.PlaneGeometry(w, basinInfo.y - SEA - 0.1 - hk * 0.2, 2, 4), fallMat);
            const [fx, fz] = spillOff((k < 3 ? -1 : 1) * (1.5 + (k % 3) * 0.34));
            fall.position.set(fx, (basinInfo.y + SEA) / 2, fz);
            fall.rotation.y = spillYaw + Math.PI / 2 + (hk - 0.5) * 0.4;
            fall.renderOrder = 2;
            fall.castShadow = false;
            g.add(fall);
          }
          const [sfx, sfz] = spillOff(-1.85);
          g.userData.spillAt = [sfx, SEA, sfz];
}
