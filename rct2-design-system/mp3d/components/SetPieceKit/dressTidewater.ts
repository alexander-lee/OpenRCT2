import * as THREE from 'three';
import { alongDir, mat, mergedBoxes, mergedParts, mtx } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import type { WorldTheme } from './index';
import { buildDockPilings } from '../TidewaterScenery';
import { CROSS, LEG_DIRS, blockRun, chainOf, glow, h01, rimStations, spanLight, spanPoints, V, lampLight } from './dressShared';
import type { StreetDress, V3 } from './dressShared';

// ===========================================================================
// TIDEWATER — a shipwreck cove. Nothing is symmetric and nothing is plumb:
// masts LEAN, lanterns HANG off a yard, decking runs one way.
// ===========================================================================
export const tideDress = (th: WorldTheme): StreetDress => {
  const P = th.palette;
  const TIMBER = 0xb59a74;
  const DECK = 0x9c8663;
  return {
    id: 'pirateBeach',
    lamp: (t, at, opts) => {
      const g = new t.Group();
      const [x, y, z] = at;
      const H = opts.height ?? 2.7;
      const yaw = opts.yaw ?? 0;
      const lean = 0.1;
      // the mast leans across the verge; +x local is "along the yard"
      const cx = Math.cos(yaw);
      const sx = Math.sin(yaw);
      const top: V3 = [x + Math.sin(lean) * H * cx, y + Math.cos(lean) * H, z - Math.sin(lean) * H * sx];
      const timber: PartSpec[] = [];
      const mastGeo = new t.CylinderGeometry(0.055, 0.085, 1, 8);
      const dir = V(t, top[0] - x, top[1] - y, top[2] - z);
      const mm = alongDir(t, V(t, x, y - 0.05, z), dir, dir.length() + 0.05);
      mm.multiply(new t.Matrix4().makeScale(1, dir.length() + 0.05, 1));
      timber.push({ geo: mastGeo, matrix: mm });
      // the YARD: a horizontal crossarm, deliberately off-centre
      const yardY = y + H * 0.78;
      const yardMid: V3 = [x + Math.sin(lean) * H * 0.78 * cx, yardY, z - Math.sin(lean) * H * 0.78 * sx];
      timber.push({ geo: new t.BoxGeometry(1.15, 0.07, 0.07), matrix: mtx(t, yardMid, [0, yaw, 0.03]) });
      // two cleats and a deck collar at the foot
      timber.push({ geo: new t.BoxGeometry(0.52, 0.09, 0.52), matrix: mtx(t, [x, y + 0.045, z], [0, yaw + 0.2, 0]) });
      timber.push({ geo: new t.BoxGeometry(0.13, 0.05, 0.3), matrix: mtx(t, [x + 0.26 * cx, y + 0.32, z - 0.26 * sx], [0, yaw, 0]) });
      g.add(mergedParts(t, timber, mat(t, TIMBER, { tex: 'wood', repeat: [1, 3], rough: 0.9 })));
      // a tarred stay from the mast head down to the far cleat
      const stayA = V(t, top[0], top[1] - 0.1, top[2]);
      const stayB = V(t, x - 0.42 * cx, y + 0.06, z + 0.42 * sx);
      g.add(chainOf(t, [stayA, stayB], 0.016, 5, mat(t, P.cable, { rough: 0.95 })));
      // the ship's lantern hangs off ONE end of the yard, on a short chain
      const lx = yardMid[0] + 0.5 * cx;
      const lz = yardMid[2] - 0.5 * sx;
      const glassY = yardY - 0.36;
      g.add(chainOf(t, [V(t, lx, yardY - 0.03, lz), V(t, lx, glassY + 0.17, lz)], 0.011, 4, mat(t, P.cable, { rough: 0.9 })));
      const gl = glow(t, th, P.lampGlass, 0);
      const lant = mergedParts(t, [
        { geo: new t.CylinderGeometry(0.13, 0.15, 0.26, 8), matrix: mtx(t, [lx, glassY, lz], [0, yaw, 0]) },
      ], gl.m);
      g.add(lant);
      // its brass cap + base ring, one more merged mesh
      g.add(
        mergedParts(
          t,
          [
            { geo: new t.CylinderGeometry(0.05, 0.17, 0.11, 8), matrix: mtx(t, [lx, glassY + 0.19, lz], [0, yaw, 0]) },
            { geo: new t.CylinderGeometry(0.16, 0.16, 0.045, 8), matrix: mtx(t, [lx, glassY - 0.15, lz], [0, yaw, 0]) },
          ],
          mat(t, P.buntingAccent, { tex: 'metal', metal: 0.6, rough: 0.45 }),
        ),
      );
      const li = opts.light ? lampLight(t, th, [lx, glassY, lz]) : null;
      if (li) g.add(li.light);
      // the HOOK is the yard's OTHER end — spans leave the mast sideways
      const hook: V3 = [yardMid[0] - 0.52 * cx, yardY + 0.02, yardMid[2] + 0.52 * sx];
      return {
        group: g,
        hook,
        update: (time) => {
          gl.update(time, [lx, glassY, lz], g);
          li?.update(time, g);
        },
      };
    },
    bench: (t, at, yaw) => {
      const g = new t.Group();
      g.position.set(at[0], at[1], at[2]);
      g.rotation.y = yaw;
      // planks on two beached casks
      g.add(
        mergedBoxes(
          t,
          [
            { dims: [1.12, 0.055, 0.17], pos: [0, 0.46, -0.17], repeat: [5, 1] },
            { dims: [1.12, 0.055, 0.17], pos: [0, 0.46, 0], repeat: [5, 1] },
            { dims: [1.12, 0.055, 0.17], pos: [0, 0.46, 0.17], repeat: [5, 1] },
            { dims: [1.12, 0.26, 0.055], pos: [0, 0.66, -0.25], rotX: -0.2, repeat: [5, 1] },
            { dims: [0.075, 0.24, 0.075], pos: [-0.5, 0.57, -0.23] },
            { dims: [0.075, 0.24, 0.075], pos: [0.5, 0.57, -0.23] },
          ],
          TIMBER,
          { tex: 'wood', repeat: [1, 1], rough: 0.9 },
        ),
      );
      const caskGeo = new t.CylinderGeometry(0.22, 0.22, 0.44, 12);
      g.add(
        mergedParts(
          t,
          [
            { geo: caskGeo, matrix: mtx(t, [-0.34, 0.22, -0.02], [0, 0, Math.PI / 2]) },
            { geo: caskGeo, matrix: mtx(t, [0.34, 0.22, -0.02], [0, 0, Math.PI / 2]) },
          ],
          mat(t, DECK, { tex: 'wood', repeat: [2, 2], rough: 0.92 }),
        ),
      );
      return { group: g };
    },
    span: (t, from, to) => {
      const g = new t.Group();
      const dist = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      // SIGNAL FLAGS, not bulbs — a rope with eight alternating pennants
      const pts = spanPoints(t, from, to, 16, 0.22 + dist * 0.035);
      g.add(chainOf(t, pts, 0.013, 5, mat(t, P.cable, { rough: 0.95 })));
      const cols = [P.canopyPrimary, P.canopySecondary, P.bunting, P.buntingAccent];
      const flagGeo = new t.BoxGeometry(0.2, 0.24, 0.012);
      for (let c = 0; c < cols.length; c += 1) {
        const parts: PartSpec[] = [];
        for (let i = 1; i < 16; i += 1) {
          if (i % cols.length !== c) continue;
          const p = pts[i];
          const d = pts[i + 1].clone().sub(pts[i - 1]).normalize();
          parts.push({ geo: flagGeo, matrix: mtx(t, [p.x, p.y - 0.14, p.z], [0, Math.atan2(d.x, d.z) + Math.PI / 2, 0.12]) });
        }
        if (parts.length) g.add(mergedParts(t, parts, mat(t, cols[c], { rough: 0.85 }), false));
      }
      flagGeo.dispose();
      // one glass float at mid-span carries the night light
      const gl = glow(t, th, P.spanBulbs[1] ?? P.lampGlow, 0);
      const mid = pts[8];
      const fl = mergedParts(t, [{ geo: new t.IcosahedronGeometry(0.085, 2), matrix: mtx(t, [mid.x, mid.y - 0.16, mid.z]) }], gl.m);
      g.add(fl);
      const li = spanLight(t, th, from, to, 0.22 + dist * 0.035 + 0.16);
      g.add(li.light);
      return {
        group: g,
        update: (time) => {
          gl.update(time, from, g);
          li.update(time, g);
        },
      };
    },
    kerb: (t, stations, seed) => {
      const g = new t.Group();
      // DECK BOARDS across the verge, plus a short piling every sixth station
      g.add(
        blockRun(t, stations, DECK, () => [0.54, 0.05, 0.34], () => 0, { tex: 'wood', repeat: [1, 2], rough: 0.9 }, (i) => i % 6 === 3),
      );
      const pileGeo = new t.CylinderGeometry(0.075, 0.09, 1, 8);
      const piles: PartSpec[] = [];
      const heads: THREE.Vector3[] = [];
      stations.forEach((s, i) => {
        if (i % 6 !== 3) return;
        const hgt = 0.62 + h01(seed + i * 7) * 0.16;
        const m = mtx(t, [s.at[0], s.at[1] + hgt / 2, s.at[2]], [0, s.yaw, 0], [1, hgt, 1]);
        piles.push({ geo: pileGeo, matrix: m });
        heads.push(V(t, s.at[0], s.at[1] + hgt - 0.06, s.at[2]));
      });
      if (piles.length) g.add(mergedParts(t, piles, mat(t, TIMBER, { tex: 'wood', repeat: [1, 3], rough: 0.92 }), false));
      pileGeo.dispose();
      // a rope swag between consecutive pilings
      const rope = mat(t, P.cable, { rough: 0.95 });
      const ropeParts: THREE.Vector3[][] = [];
      for (let i = 0; i + 1 < heads.length; i += 1) {
        const a = heads[i];
        const b = heads[i + 1];
        const seg: THREE.Vector3[] = [];
        for (let k = 0; k <= 6; k += 1) {
          const u = k / 6;
          const p = new t.Vector3().lerpVectors(a, b, u);
          p.y -= 0.16 * 4 * u * (1 - u);
          seg.push(p);
        }
        ropeParts.push(seg);
      }
      if (ropeParts.length) {
        const geo = new t.CylinderGeometry(0.014, 0.014, 1, 5, 1, true);
        const parts: PartSpec[] = [];
        ropeParts.forEach((seg) => {
          for (let i = 0; i + 1 < seg.length; i += 1) {
            const d = seg[i + 1].clone().sub(seg[i]);
            const m = alongDir(t, seg[i], d, d.length());
            m.multiply(new t.Matrix4().makeScale(1, d.length(), 1));
            parts.push({ geo, matrix: m });
          }
        });
        g.add(mergedParts(t, parts, rope));
      }
      return { group: g };
    },
    paving: (t, c) => {
      const g = new t.Group();
      // PLANK DECKING: long boards one way, with a caulked joint every board
      const boards: MergedBoxSpec[] = [];
      const w = 0.44;
      const n = Math.floor((c.half * 2 - 0.5) / w);
      for (let i = 0; i < n; i += 1) {
        const zz = -((n - 1) / 2) * w + i * w;
        const halfLen = Math.sqrt(Math.max(0.04, (c.half - 0.3) * (c.half - 0.3)));
        boards.push({ dims: [halfLen * 2, 0.02, w - 0.05], pos: [0, 0, zz], repeat: [Math.max(3, Math.round(halfLen * 2)), 1] });
      }
      g.add(mergedBoxes(t, boards, DECK, { tex: 'wood', repeat: [1, 1], rough: 0.92 }));
      // a coiled rope ring around the fountain apron
      const geo = new t.TorusGeometry(1, 0.045, 5, 30);
      g.add(
        mergedParts(
          t,
          [
            { geo, matrix: mtx(t, [0, 0.04, 0], [Math.PI / 2, 0, 0], [c.apron + 0.12, c.apron + 0.12, 1]) },
            { geo, matrix: mtx(t, [0, 0.11, 0], [Math.PI / 2, 0, 0], [c.apron + 0.06, c.apron + 0.06, 1]) },
          ],
          mat(t, P.cable, { rough: 0.95 }),
        ),
      );
      return { group: g };
    },
    parapet: (t, c) => {
      const g = new t.Group();
      // low pilings with a rope swag — the cove's rim is a mooring line
      const st = rimStations(c, 0.62);
      const pileGeo = new t.CylinderGeometry(0.08, 0.1, 1, 8);
      const piles: PartSpec[] = [];
      st.forEach((s, i) => {
        const hgt = 0.5 + h01(c.seed + i * 5) * 0.14;
        piles.push({ geo: pileGeo, matrix: mtx(t, [s.at[0], hgt / 2, s.at[2]], [0, s.yaw, 0], [1, hgt, 1]) });
      });
      g.add(mergedParts(t, piles, mat(t, TIMBER, { tex: 'wood', repeat: [1, 3], rough: 0.92 }), false));
      pileGeo.dispose();
      const geo = new t.CylinderGeometry(0.016, 0.016, 1, 5, 1, true);
      const parts: PartSpec[] = [];
      for (let i = 0; i + 1 < st.length; i += 1) {
        if (!st[i].run || !st[i + 1].run) continue;
        const a = V(t, st[i].at[0], 0.52, st[i].at[2]);
        const b = V(t, st[i + 1].at[0], 0.52, st[i + 1].at[2]);
        for (let k = 0; k < 5; k += 1) {
          const p0 = new t.Vector3().lerpVectors(a, b, k / 5);
          const p1 = new t.Vector3().lerpVectors(a, b, (k + 1) / 5);
          p0.y -= 0.14 * 4 * (k / 5) * (1 - k / 5);
          p1.y -= 0.14 * 4 * ((k + 1) / 5) * (1 - (k + 1) / 5);
          const d = p1.clone().sub(p0);
          const m = alongDir(t, p0, d, d.length());
          m.multiply(new t.Matrix4().makeScale(1, d.length(), 1));
          parts.push({ geo, matrix: m });
        }
      }
      if (parts.length) g.add(mergedParts(t, parts, mat(t, P.cable, { rough: 0.95 })));
      return { group: g };
    },
    centrepiece: (t, c) => {
      const g = new t.Group();
      const R = 1.45;
      const TOP = 3.05;
      // a mast-and-yard rig over the water with a furled sail canopy
      const timber: PartSpec[] = [];
      const postGeo = new t.CylinderGeometry(0.075, 0.1, 1, 8);
      LEG_DIRS.forEach((d, i) => {
        const hgt = TOP - 1.05;
        timber.push({ geo: postGeo, matrix: mtx(t, [d[0] * R, hgt / 2, d[1] * R], [0, 0, (h01(c.seed + i) - 0.5) * 0.06], [1, hgt, 1]) });
      });
      // ring beam joining the four post heads, as four straight braces
      const braceGeo = new t.BoxGeometry(1, 0.075, 0.075);
      for (let i = 0; i < 4; i += 1) {
        const a = LEG_DIRS[i];
        const b = LEG_DIRS[(i + 1) % 4];
        const p0 = V(t, a[0] * R, TOP - 1.05, a[1] * R);
        const p1 = V(t, b[0] * R, TOP - 1.05, b[1] * R);
        const mid = p0.clone().add(p1).multiplyScalar(0.5);
        const len = p0.distanceTo(p1);
        timber.push({ geo: braceGeo, matrix: mtx(t, [mid.x, mid.y, mid.z], [0, Math.atan2(p1.x - p0.x, p1.z - p0.z) + Math.PI / 2, 0], [len, 1, 1]) });
      }
      // TWO DIAGONAL CROSS-BRACES over the water, then a short KING POST
      // standing on their crossing. The first cut ran a full mast from y 0 —
      // straight down through the fountain basin, which the plan publishes as a
      // solid 1.07-radius blocker.
      CROSS.forEach(([i, j]) => {
        const a = V(t, LEG_DIRS[i][0] * R, TOP - 1.05, LEG_DIRS[i][1] * R);
        const b = V(t, LEG_DIRS[j][0] * R, TOP - 1.05, LEG_DIRS[j][1] * R);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const len = a.distanceTo(b);
        timber.push({ geo: braceGeo, matrix: mtx(t, [mid.x, mid.y, mid.z], [0, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2, 0], [len, 1, 1]) });
      });
      timber.push({ geo: postGeo, matrix: mtx(t, [0, TOP - 1.05 + (TOP - (TOP - 1.05)) / 2, 0], [0, 0, 0], [1.15, 1.05, 1.15]) });
      timber.push({ geo: braceGeo, matrix: mtx(t, [0, TOP - 0.14, 0], [0, 0.4, 0], [2.1, 1, 1]) });
      g.add(mergedParts(t, timber, mat(t, TIMBER, { tex: 'wood', repeat: [1, 3], rough: 0.9 }), false));
      postGeo.dispose();
      braceGeo.dispose();
      // four sailcloth panels sloping from the mast down to the ring beam
      const sail: PartSpec[] = [];
      const panelGeo = new t.BoxGeometry(1, 0.022, 1);
      for (let i = 0; i < 4; i += 1) {
        const a = ((i + 0.5) / 4) * Math.PI * 2;
        const rMid = R * 0.6;
        // each panel spans from the king post's head down to the ring beam, so
        // its inner edge overlaps the post and its outer edge overlaps the beam
        sail.push({
          geo: panelGeo,
          matrix: mtx(t, [Math.sin(a) * rMid, TOP - 0.5, Math.cos(a) * rMid], [0, a, 0], [R * 1.02, 1, R * 1.12]).multiply(new t.Matrix4().makeRotationX(0.62)),
        });
      }
      g.add(mergedParts(t, sail, mat(t, P.canopyPrimary, { tex: 'fabric', repeat: [3, 3], rough: 0.9 })));
      const gl = glow(t, th, P.lampGlass, 0);
      // the lantern hangs off the king post itself (its top overlaps the post's
      // lower half), not in mid-air under the sails
      const lant = mergedParts(t, [{ geo: new t.CylinderGeometry(0.14, 0.16, 0.3, 8), matrix: mtx(t, [0, TOP - 0.9, 0]) }], gl.m);
      g.add(lant);
      return { group: g, update: (time) => gl.update(time, [0, TOP, 0], g) };
    },
    landmark: (t, seed) => {
      const b = buildDockPilings(t, { seed, count: 4, height: 1.35, radius: 0.4, net: true });
      return { group: b.group, update: b.update, radius: 0.62, name: 'dockPilings' };
    },
  };
};

