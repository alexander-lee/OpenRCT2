import * as THREE from 'three';
import { alongDir, mat, mergedBoxes, mergedParts, mtx } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import type { WorldTheme } from './index';
import { buildGiantToadstools } from '../ThornwickScenery';
import { LEG_DIRS, chainOf, glow, h01, rimStations, spanLight, spanPoints, V, lampLight } from './dressShared';
import type { StreetDress } from './dressShared';

// ===========================================================================
// THORNWICK — an enchanted wood. NOTHING here is straight or paired: the
// standard forks, the globes hang at two different heights, the flagstones
// spiral.
// ===========================================================================
export const gladeDress = (th: WorldTheme): StreetDress => {
  const P = th.palette;
  const BARK = 0x4a3a26;
  const MOSS = 0x4a6a34;
  return {
    id: 'enchantedForest',
    lamp: (t, at, opts) => {
      const g = new t.Group();
      const [x, y, z] = at;
      const H = opts.height ?? 2.35;
      const yaw = opts.yaw ?? 0;
      const wood: PartSpec[] = [];
      // a crooked trunk: three segments, each leaning its own way
      const segGeo = new t.CylinderGeometry(1, 1, 1, 7);
      let p = V(t, x, y - 0.06, z);
      const lean = [0.09, -0.13, 0.07];
      const rTop = [0.085, 0.07, 0.055];
      const rBot = [0.115, 0.085, 0.07];
      const forks: THREE.Vector3[] = [];
      for (let k = 0; k < 3; k += 1) {
        const segH = (H + 0.06) / 3;
        const dir = V(t, Math.sin(lean[k]) * Math.cos(yaw + k), Math.cos(lean[k]), Math.sin(lean[k]) * Math.sin(yaw + k));
        const nxt = p.clone().addScaledVector(dir, segH);
        const m = alongDir(t, p, dir, segH);
        m.multiply(new t.Matrix4().makeScale(rBot[k], segH, rBot[k]));
        wood.push({ geo: segGeo, matrix: m });
        void rTop[k];
        p = nxt;
        if (k >= 1) forks.push(nxt.clone());
      }
      // two branches to opposite sides, at DIFFERENT heights
      const globes: THREE.Vector3[] = [];
      forks.forEach((f, i) => {
        const a = yaw + (i === 0 ? Math.PI / 2 : -Math.PI / 2) + (h01(x * 3 + z * 5 + i) - 0.5) * 0.6;
        const reach = 0.52 + i * 0.14;
        const tip = V(t, f.x + Math.sin(a) * reach, f.y + 0.16 + i * 0.06, f.z + Math.cos(a) * reach);
        const d = tip.clone().sub(f);
        const m = alongDir(t, f, d, d.length());
        m.multiply(new t.Matrix4().makeScale(0.035, d.length(), 0.035));
        wood.push({ geo: segGeo, matrix: m });
        globes.push(tip);
      });
      g.add(mergedParts(t, wood, mat(t, BARK, { tex: 'wood', repeat: [1, 3], rough: 1 }), false));
      // a moss skirt at the foot, flat-shaded lumps in ONE mesh
      const lumpGeo = new t.IcosahedronGeometry(0.16, 1);
      g.add(
        mergedParts(
          t,
          [0, 1, 2].map((i) => {
            const a = yaw + (i / 3) * Math.PI * 2;
            return { geo: lumpGeo, matrix: mtx(t, [x + Math.sin(a) * 0.19, y + 0.05, z + Math.cos(a) * 0.19], [0, a, 0], [1, 0.55, 1]) };
          }),
          mat(t, MOSS, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }),
        ),
      );
      // TWO witch-light globes, one material, one mesh
      const gl = glow(t, th, P.lampGlow, 0);
      const globeGeo = new t.IcosahedronGeometry(0.145, 2);
      // drop is a CONSTANT 0.12, not 0.15 + i*0.05: the second globe's extra
      // 0.05 put its crown 0.055 BELOW the 0.035-radius branch it hangs from,
      // and it measured 0.057 clear. The two globes still sit at different
      // heights — the two branches do (different fork y, different reach).
      g.add(mergedParts(t, globes.map((v) => ({ geo: globeGeo, matrix: mtx(t, [v.x, v.y - 0.12, v.z]) })), gl.m));
      segGeo.dispose();
      const li = opts.light ? lampLight(t, th, [globes[0].x, globes[0].y - 0.15, globes[0].z]) : null;
      if (li) g.add(li.light);
      return {
        group: g,
        hook: [globes[1].x, globes[1].y - 0.04, globes[1].z],
        update: (time) => {
          gl.update(time, at, g);
          li?.update(time, g);
        },
      };
    },
    bench: (t, at, yaw) => {
      const g = new t.Group();
      g.position.set(at[0], at[1], at[2]);
      g.rotation.y = yaw;
      // a FELLED LOG, flattened on top, on two sawn stumps — one mesh
      const logGeo = new t.CylinderGeometry(0.24, 0.26, 1.2, 10);
      const stumpGeo = new t.CylinderGeometry(0.16, 0.19, 0.3, 8);
      g.add(
        mergedParts(
          t,
          [
            { geo: logGeo, matrix: mtx(t, [0, 0.36, -0.02], [0, 0.04, Math.PI / 2]) },
            { geo: stumpGeo, matrix: mtx(t, [-0.42, 0.15, 0.2]) },
            { geo: stumpGeo, matrix: mtx(t, [0.42, 0.15, 0.2]) },
            { geo: new t.BoxGeometry(1.14, 0.06, 0.42), matrix: mtx(t, [0, 0.56, -0.02]) },
          ],
          mat(t, BARK, { tex: 'wood', repeat: [3, 2], rough: 1 }),
        ),
      );
      // moss along the log's back
      g.add(
        mergedParts(
          t,
          [{ geo: new t.BoxGeometry(1.0, 0.05, 0.16), matrix: mtx(t, [0, 0.54, -0.2]) }],
          mat(t, MOSS, { tex: 'leaf', repeat: [4, 1], flat: true, rough: 1 }),
        ),
      );
      return { group: g };
    },
    span: (t, from, to) => {
      const g = new t.Group();
      const dist = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      // a VINE SWAG: the deepest sag of the five, with leaf pairs and pods
      const pts = spanPoints(t, from, to, 18, 0.34 + dist * 0.06);
      g.add(chainOf(t, pts, 0.019, 5, mat(t, BARK, { tex: 'wood', repeat: [1, 6], rough: 1 })));
      const leafGeo = new t.BoxGeometry(0.22, 0.012, 0.11);
      const leaves: PartSpec[] = [];
      for (let i = 1; i < 18; i += 1) {
        const p = pts[i];
        const d = pts[i + 1].clone().sub(pts[i - 1]).normalize();
        const yawAt = Math.atan2(d.x, d.z);
        [-1, 1].forEach((s) =>
          leaves.push({ geo: leafGeo, matrix: mtx(t, [p.x, p.y - 0.02, p.z], [0, yawAt + (s * Math.PI) / 2.4, s * 0.3], [1, 1, 1]) }),
        );
      }
      g.add(mergedParts(t, leaves, mat(t, MOSS, { tex: 'leaf', repeat: [1, 1], flat: true, rough: 1 })));
      const gl = glow(t, th, P.lampGlow, 0);
      const podGeo = new t.IcosahedronGeometry(0.075, 2);
      const pods: PartSpec[] = [];
      // 0.10 below the vine, not 0.20: a 0.075x1.35 pod is 0.101 tall, so a 0.20
      // drop left its crown 0.08 clear of the 0.019-radius vine it hangs from
      // (measured 0.057-0.093 on the avenue and both plaza spans)
      [3, 7, 11, 15].forEach((i) => pods.push({ geo: podGeo, matrix: mtx(t, [pts[i].x, pts[i].y - 0.1, pts[i].z], [0, 0, 0], [1, 1.35, 1]) }));
      g.add(mergedParts(t, pods, gl.m));
      const li = spanLight(t, th, from, to, 0.34 + dist * 0.06 + 0.2);
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
      // mossy boulders of wildly different sizes, no rhythm at all
      const lumpGeo = new t.IcosahedronGeometry(1, 1);
      const parts: PartSpec[] = [];
      stations.forEach((s, i) => {
        if (i % 2 === 1) return;
        const r = 0.12 + h01(seed + i * 3) * 0.14;
        parts.push({
          geo: lumpGeo,
          matrix: mtx(t, [s.at[0] + (h01(seed + i * 7) - 0.5) * 0.12, s.at[1] + r * 0.42, s.at[2]], [0, h01(seed + i * 11) * 3, 0], [r, r * 0.85, r * 1.15]),
        });
      });
      g.add(mergedParts(t, parts, mat(t, P.pavingDark, { tex: 'concrete', flat: true, rough: 1, bump: 0.06 }), false));
      // arching surface roots between the boulders
      const roots: PartSpec[] = [];
      const rootGeo = new t.CylinderGeometry(0.035, 0.05, 1, 5);
      for (let i = 0; i + 2 < stations.length; i += 4) {
        const a = V(t, stations[i].at[0], stations[i].at[1] + 0.02, stations[i].at[2]);
        const b = V(t, stations[i + 2].at[0], stations[i + 2].at[1] + 0.02, stations[i + 2].at[2]);
        const mid = a.clone().add(b).multiplyScalar(0.5).setY(a.y + 0.13);
        [[a, mid], [mid, b]].forEach(([p0, p1]) => {
          const d = p1.clone().sub(p0);
          const m = alongDir(t, p0, d, d.length());
          m.multiply(new t.Matrix4().makeScale(1, d.length(), 1));
          roots.push({ geo: rootGeo, matrix: m });
        });
      }
      if (roots.length) g.add(mergedParts(t, roots, mat(t, BARK, { tex: 'wood', repeat: [1, 2], rough: 1 })));
      return { group: g };
    },
    paving: (t, c) => {
      const g = new t.Group();
      // a SPIRAL of irregular flagstones — no border, no rosette, no axis
      const stones: MergedBoxSpec[] = [];
      const turns = 3.2;
      const n = 74;
      for (let i = 0; i < n; i += 1) {
        const u = i / (n - 1);
        const a = u * turns * Math.PI * 2;
        const r = c.apron + 0.18 + u * (c.half - 0.4 - c.apron - 0.18);
        const s = 0.34 + h01(c.seed + i * 3) * 0.24;
        stones.push({ dims: [s, 0.02, s * (0.7 + h01(c.seed + i * 5) * 0.5)], pos: [Math.sin(a) * r, 0, Math.cos(a) * r], rotY: a + (h01(c.seed + i) - 0.5) * 0.7 });
      }
      g.add(mergedBoxes(t, stones, P.pavingLight, { tex: 'concrete', rough: 0.95, bump: 0.05 }));
      // moss in the joints: a second, lower, greener scatter
      const moss: MergedBoxSpec[] = [];
      for (let i = 0; i < 44; i += 1) {
        const a = h01(c.seed * 7 + i) * Math.PI * 2;
        const r = c.apron + 0.2 + h01(c.seed * 11 + i) * (c.half - 0.5 - c.apron);
        moss.push({ dims: [0.2 + h01(i) * 0.14, 0.014, 0.16], pos: [Math.sin(a) * r, -0.003, Math.cos(a) * r], rotY: a * 1.7 });
      }
      g.add(mergedBoxes(t, moss, MOSS, { tex: 'leaf', repeat: [1, 1], flat: true, rough: 1 }));
      return { group: g };
    },
    parapet: (t, c) => {
      const g = new t.Group();
      const st = rimStations(c, 0.56);
      const lumpGeo = new t.IcosahedronGeometry(1, 1);
      const parts: PartSpec[] = [];
      st.forEach((s, i) => {
        const r = 0.2 + h01(c.seed + i * 5) * 0.18;
        parts.push({ geo: lumpGeo, matrix: mtx(t, [s.at[0], r * 0.6, s.at[2]], [0, h01(c.seed + i) * 3, 0], [r * 1.2, r, r * 1.2]) });
      });
      g.add(mergedParts(t, parts, mat(t, P.pavingDark, { tex: 'concrete', flat: true, rough: 1, bump: 0.06 }), false));
      const hedge: MergedBoxSpec[] = [];
      st.forEach((s, i) => {
        if (!s.run) return;
        const n = st[i + 1];
        if (!n || !n.run) return;
        const len = Math.hypot(n.at[0] - s.at[0], n.at[2] - s.at[2]);
        hedge.push({
          dims: [len, 0.36, 0.28],
          pos: [(s.at[0] + n.at[0]) / 2, 0.18, (s.at[2] + n.at[2]) / 2],
          rotY: Math.atan2(n.at[0] - s.at[0], n.at[2] - s.at[2]) + Math.PI / 2,
          repeat: [Math.max(2, Math.round(len * 2)), 1],
        });
      });
      g.add(mergedBoxes(t, hedge, MOSS, { tex: 'leaf', repeat: [1, 1], flat: true, rough: 1, bump: 0.05 }));
      return { group: g };
    },
    centrepiece: (t, c) => {
      const g = new t.Group();
      const R = 1.45;
      const TOP = 3.0;
      // four crooked boughs woven into a crown over the water
      const wood: PartSpec[] = [];
      const boughs: THREE.Vector3[][] = [];
      const segGeo = new t.CylinderGeometry(1, 1, 1, 7);
      LEG_DIRS.forEach((d, i) => {
        let p = V(t, d[0] * R, 0, d[1] * R);
        const path: THREE.Vector3[] = [V(t, d[0] * R, 0, d[1] * R)];
        for (let k = 0; k < 4; k += 1) {
          const u = (k + 1) / 4;
          const nxt = V(t, d[0] * R * (1 - u * 0.72), TOP * Math.sin((u * Math.PI) / 2.1), d[1] * R * (1 - u * 0.72));
          // the LAST joint takes no jitter: it has to land on the crown ring's
          // 0.045 tube, and 0.18 of wander is four times that
          if (k < 3) {
            nxt.x += (h01(c.seed + i * 9 + k) - 0.5) * 0.18;
            nxt.z += (h01(c.seed + i * 9 + k + 4) - 0.5) * 0.18;
          }
          const dd = nxt.clone().sub(p);
          const m = alongDir(t, p, dd, dd.length());
          const rr = 0.1 - k * 0.017;
          m.multiply(new t.Matrix4().makeScale(rr, dd.length(), rr));
          wood.push({ geo: segGeo, matrix: m });
          p = nxt;
          path.push(nxt.clone());
        }
        boughs.push(path);
      });
      // the crown ring joining the four tips
      const ring = new t.TorusGeometry(R * 0.28, 0.045, 5, 20);
      wood.push({ geo: ring, matrix: mtx(t, [0, TOP - 0.02, 0], [Math.PI / 2, 0, 0]) });
      g.add(mergedParts(t, wood, mat(t, BARK, { tex: 'wood', repeat: [1, 3], rough: 1 }), false));
      segGeo.dispose();
      // foliage clumps on the boughs
      const leafGeo = new t.IcosahedronGeometry(1, 1);
      // clumps sit ON the boughs, at the bough's own joints. The first cut
      // scattered them on a ring of 8 evenly spaced angles, and the four on the
      // diagonals had no bough anywhere near them — four floating bushes.
      const leaves: PartSpec[] = [];
      boughs.forEach((path, i) => {
        [2, 3].forEach((k, kk) => {
          const p0 = path[k];
          const sc = 0.28 + h01(c.seed * 3 + i * 5 + kk) * 0.13;
          leaves.push({ geo: leafGeo, matrix: mtx(t, [p0.x, p0.y, p0.z], [0, i + kk, 0], [sc, sc * 0.82, sc]) });
        });
      });
      g.add(mergedParts(t, leaves, mat(t, MOSS, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }), false));
      leafGeo.dispose();
      // three globes hanging from the crown ring, at three heights
      const gl = glow(t, th, P.lampGlow, 0);
      const wire: PartSpec[] = [];
      const globes: PartSpec[] = [];
      const globeGeo = new t.IcosahedronGeometry(0.13, 2);
      const wireGeo = new t.CylinderGeometry(0.008, 0.008, 1, 4);
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const rr = R * 0.28;
        const drop = 0.36 + i * 0.2;
        const top = V(t, Math.sin(a) * rr, TOP - 0.04, Math.cos(a) * rr);
        const m = alongDir(t, top, V(t, 0, -1, 0), drop);
        m.multiply(new t.Matrix4().makeScale(1, drop, 1));
        wire.push({ geo: wireGeo, matrix: m });
        globes.push({ geo: globeGeo, matrix: mtx(t, [top.x, top.y - drop - 0.06, top.z]) });
      }
      g.add(mergedParts(t, wire, mat(t, P.cable, { rough: 0.9 })));
      g.add(mergedParts(t, globes, gl.m, false));
      globeGeo.dispose();
      return { group: g, update: (time) => gl.update(time, [0, TOP, 0], g) };
    },
    landmark: (t, seed) => {
      // `light: false` on purpose — a boulevard already spends 6 PointLights on
      // its lanterns and the park admits only the nearest `budgets.lights`
      const b = buildGiantToadstools(t, { seed, radius: 0.62, height: 1.45, count: 4, glow: true, light: false });
      return { group: b.group, update: b.update, radius: 0.6, name: 'giantToadstools' };
    },
  };
};

