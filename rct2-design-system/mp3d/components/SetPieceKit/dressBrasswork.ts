import * as THREE from 'three';
import { alongDir, mat, mergedBoxes, mergedParts, mtx } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import type { WorldTheme } from './index';
import { buildGiantGear } from '../BrassworkScenery';
import { LEG_DIRS, glow, rimStations, spanLight, V, lampLight } from './dressShared';
import type { StreetDress } from './dressShared';

// ===========================================================================
// BRASSWORK — steampunk. The signature is RIGIDITY and PIPE: nothing sags,
// everything is bolted, and the standards are the tallest of the five.
// ===========================================================================
export const brassDress = (th: WorldTheme): StreetDress => {
  const P = th.palette;
  const BRASS = P.buntingAccent;
  return {
    id: 'steampunk',
    lamp: (t, at, opts) => {
      const g = new t.Group();
      const [x, y, z] = at;
      const H = opts.height ?? 3.15; // the tallest of the five standards
      const yaw = opts.yaw ?? 0;
      const iron: PartSpec[] = [];
      // octagonal stepped plinth (two boxes at 45°) + a fluted column
      iron.push({ geo: new t.BoxGeometry(0.46, 0.14, 0.46), matrix: mtx(t, [x, y + 0.07, z], [0, yaw, 0]) });
      iron.push({ geo: new t.BoxGeometry(0.4, 0.14, 0.4), matrix: mtx(t, [x, y + 0.07, z], [0, yaw + Math.PI / 4, 0]) });
      iron.push({ geo: new t.BoxGeometry(0.32, 0.16, 0.32), matrix: mtx(t, [x, y + 0.2, z], [0, yaw + Math.PI / 8, 0]) });
      iron.push({ geo: new t.CylinderGeometry(0.05, 0.085, H - 0.28, 8), matrix: mtx(t, [x, y + 0.28 + (H - 0.28) / 2, z]) });
      // the service PIPE ELBOW at the foot — the tell that this lamp is gas
      const pipe = new t.CylinderGeometry(0.035, 0.035, 1, 8);
      iron.push({ geo: pipe, matrix: mtx(t, [x + 0.17 * Math.cos(yaw), y + 0.1, z - 0.17 * Math.sin(yaw)], [0, yaw, Math.PI / 2], [1, 0.34, 1]) });
      iron.push({ geo: pipe, matrix: mtx(t, [x + 0.34 * Math.cos(yaw), y + 0.28, z - 0.34 * Math.sin(yaw)], [0, 0, 0], [1, 0.36, 1]) });
      g.add(mergedParts(t, iron, mat(t, P.iron, { tex: 'metal', metal: 0.55, rough: 0.55 }), false));
      pipe.dispose();
      // brass: the lamplighter's ladder bar, four bolts, an ogee cap, a finial
      const brass: PartSpec[] = [];
      const bolt = new t.CylinderGeometry(0.028, 0.028, 0.05, 6);
      [0, 1].forEach((k) => {
        brass.push({ geo: new t.BoxGeometry(0.62, 0.035, 0.035), matrix: mtx(t, [x, y + H - 0.62 + k * 0.17, z], [0, yaw, 0]) });
        [-1, 1].forEach((s) =>
          brass.push({ geo: bolt, matrix: mtx(t, [x + s * 0.29 * Math.cos(yaw), y + H - 0.62 + k * 0.17, z - s * 0.29 * Math.sin(yaw)], [0, 0, Math.PI / 2]) }),
        );
      });
      brass.push({ geo: new t.CylinderGeometry(0.03, 0.24, 0.2, 6), matrix: mtx(t, [x, y + H + 0.3, z], [0, yaw, 0]) });
      brass.push({ geo: new t.CylinderGeometry(0.2, 0.2, 0.04, 6), matrix: mtx(t, [x, y + H - 0.02, z], [0, yaw, 0]) });
      brass.push({ geo: new t.IcosahedronGeometry(0.045, 1), matrix: mtx(t, [x, y + H + 0.44, z]) });
      g.add(mergedParts(t, brass, mat(t, BRASS, { tex: 'metal', metal: 0.75, rough: 0.35 }), false));
      bolt.dispose();
      // a HEXAGONAL glazed head — six flat facets, not the default's cube
      const gl = glow(t, th, P.lampGlass, 0);
      g.add(mergedParts(t, [{ geo: new t.CylinderGeometry(0.19, 0.19, 0.36, 6), matrix: mtx(t, [x, y + H + 0.14, z], [0, yaw, 0]) }], gl.m));
      const li = opts.light ? lampLight(t, th, [x, y + H + 0.14, z]) : null;
      if (li) g.add(li.light);
      return {
        group: g,
        hook: [x, y + H - 0.45, z],
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
      g.add(
        mergedBoxes(
          t,
          [
            { dims: [1.06, 0.05, 0.15], pos: [0, 0.44, -0.18], repeat: [5, 1] },
            { dims: [1.06, 0.05, 0.15], pos: [0, 0.44, 0], repeat: [5, 1] },
            { dims: [1.06, 0.05, 0.15], pos: [0, 0.44, 0.18], repeat: [5, 1] },
            { dims: [1.06, 0.14, 0.045], pos: [0, 0.6, -0.26], repeat: [5, 1] },
            { dims: [1.06, 0.14, 0.045], pos: [0, 0.76, -0.26], repeat: [5, 1] },
          ],
          0x6a4a2a,
          { tex: 'wood', repeat: [1, 1], rough: 0.85 },
        ),
      );
      // cast SCROLL frames: three canted bars per end read as a curl
      const frame: MergedBoxSpec[] = [];
      [-0.46, 0.46].forEach((sx) => {
        frame.push({ dims: [0.05, 0.44, 0.05], pos: [sx, 0.22, 0.16] });
        frame.push({ dims: [0.05, 0.5, 0.05], pos: [sx, 0.28, -0.2], rotX: 0.18 });
        frame.push({ dims: [0.05, 0.05, 0.42], pos: [sx, 0.44, -0.02] });
        frame.push({ dims: [0.05, 0.22, 0.05], pos: [sx, 0.56, 0.02], rotX: -0.7 });
        frame.push({ dims: [0.05, 0.36, 0.05], pos: [sx, 0.66, -0.24] });
      });
      // the stretcher runs between the FRONT legs (z 0.135..0.185). At z -0.02 it
      // sat in the gap between the two leg pairs and touched neither — measured
      // 0.133 clear on the plaza's benches.
      frame.push({ dims: [0.95, 0.045, 0.045], pos: [0, 0.13, 0.16] });
      g.add(mergedBoxes(t, frame, P.iron, { tex: 'metal', metal: 0.55, rough: 0.5 }));
      return { group: g };
    },
    span: (t, from, to) => {
      const g = new t.Group();
      // A RIGID PIPE TRUSS: zero sag, four hangers, three gas globes. In an
      // ortho elevation this is a straight line where the others are a curve.
      const iron: PartSpec[] = [];
      const a = V(t, from[0], from[1], from[2]);
      const b = V(t, to[0], to[1], to[2]);
      const len = a.distanceTo(b);
      const dir = b.clone().sub(a);
      const pipeGeo = new t.CylinderGeometry(0.045, 0.045, 1, 8);
      const upper = alongDir(t, a.clone().setY(a.y + 0.16), dir, len);
      upper.multiply(new t.Matrix4().makeScale(1, len, 1));
      iron.push({ geo: pipeGeo, matrix: upper });
      const lower = alongDir(t, a, dir, len);
      lower.multiply(new t.Matrix4().makeScale(1, len, 1));
      iron.push({ geo: new t.CylinderGeometry(0.028, 0.028, 1, 6), matrix: lower });
      // diagonal web between the two chords
      for (let i = 0; i < 6; i += 1) {
        const p0 = new t.Vector3().lerpVectors(a, b, i / 6);
        const p1 = new t.Vector3().lerpVectors(a, b, (i + 1) / 6).setY(a.y + 0.16);
        const d = p1.clone().sub(p0);
        const m = alongDir(t, p0, d, d.length());
        m.multiply(new t.Matrix4().makeScale(1, d.length(), 1));
        iron.push({ geo: new t.CylinderGeometry(0.018, 0.018, 1, 5), matrix: m });
      }
      const drops: THREE.Vector3[] = [];
      [0.25, 0.5, 0.75].forEach((u) => {
        const p = new t.Vector3().lerpVectors(a, b, u);
        iron.push({ geo: new t.CylinderGeometry(0.02, 0.02, 0.26, 6), matrix: mtx(t, [p.x, p.y - 0.13, p.z]) });
        drops.push(p);
      });
      g.add(mergedParts(t, iron, mat(t, P.iron, { tex: 'metal', metal: 0.6, rough: 0.5 }), false));
      pipeGeo.dispose();
      const gl = glow(t, th, P.spanBulbs[0] ?? P.lampGlow, 0);
      const globeGeo = new t.IcosahedronGeometry(0.11, 2);
      g.add(mergedParts(t, drops.map((p) => ({ geo: globeGeo, matrix: mtx(t, [p.x, p.y - 0.34, p.z]) })), gl.m));
      const li = spanLight(t, th, from, to, 0.34);
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
      // a CONTINUOUS iron channel — no gaps at all, which is the visual
      // opposite of Emberfall's broken stones — with a bolt every station
      const parts: MergedBoxSpec[] = [];
      stations.forEach((s, i) => {
        // 0.46 ALONG against a 0.44 station pitch = a deliberate overlap, so
        // Brasswork's kerb is one unbroken channel — the visual opposite of
        // Emberfall's broken stones
        parts.push({ dims: [0.3, 0.11, 0.46], pos: [s.at[0], s.at[1] + 0.055, s.at[2]], rotY: s.yaw, repeat: [1, 2] });
        if (i % 2 === 0) parts.push({ dims: [0.07, 0.045, 0.07], pos: [s.at[0], s.at[1] + 0.125, s.at[2]], rotY: s.yaw + 0.4 });
      });
      g.add(mergedBoxes(t, parts, P.iron, { tex: 'metal', metal: 0.5, rough: 0.6 }));
      // a brass hand-rail on stanchions every fourth station
      const rail: PartSpec[] = [];
      const postGeo = new t.CylinderGeometry(0.022, 0.028, 0.44, 6);
      const heads: THREE.Vector3[] = [];
      stations.forEach((s, i) => {
        if (i % 4 !== 1) return;
        rail.push({ geo: postGeo, matrix: mtx(t, [s.at[0], s.at[1] + 0.33, s.at[2]]) });
        heads.push(V(t, s.at[0], s.at[1] + 0.53, s.at[2]));
      });
      const railGeo = new t.CylinderGeometry(0.02, 0.02, 1, 6);
      for (let i = 0; i + 1 < heads.length; i += 1) {
        const d = heads[i + 1].clone().sub(heads[i]);
        const m = alongDir(t, heads[i], d, d.length());
        m.multiply(new t.Matrix4().makeScale(1, d.length(), 1));
        rail.push({ geo: railGeo, matrix: m });
      }
      if (rail.length) g.add(mergedParts(t, rail, mat(t, BRASS, { tex: 'metal', metal: 0.7, rough: 0.4 })));
      return { group: g };
    },
    paving: (t, c) => {
      const g = new t.Group();
      // FOUR riveted iron plates with a raised seam cross and a bolt grid
      const plates: MergedBoxSpec[] = [];
      const q = (c.half - 0.32) / 2;
      ([[1, 1], [1, -1], [-1, -1], [-1, 1]] as [number, number][]).forEach(([sx, sz]) => {
        plates.push({ dims: [q * 2 - 0.08, 0.02, q * 2 - 0.08], pos: [sx * q, 0, sz * q], repeat: [4, 4] });
      });
      plates.push({ dims: [(c.half - 0.32) * 2, 0.028, 0.2], pos: [0, 0.004, 0] });
      plates.push({ dims: [0.2, 0.028, (c.half - 0.32) * 2], pos: [0, 0.004, 0] });
      for (let i = 0; i < 40; i += 1) {
        const a = (i / 40) * Math.PI * 2;
        const r = c.half - 0.42;
        plates.push({ dims: [0.075, 0.03, 0.075], pos: [Math.sin(a) * r, 0.01, Math.cos(a) * r], rotY: a });
      }
      g.add(mergedBoxes(t, plates, P.pavingDark, { tex: 'metal', metal: 0.45, rough: 0.62 }));
      // a brass compass rose around the apron: eight tapered rays
      const rays: PartSpec[] = [];
      const rayGeo = new t.CylinderGeometry(0.02, 0.11, 1, 3);
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const len = 0.62;
        const r = c.apron + 0.1 + len / 2;
        const m = alongDir(t, V(t, Math.sin(a) * (c.apron + 0.1), 0.024, Math.cos(a) * (c.apron + 0.1)), V(t, Math.sin(a), 0, Math.cos(a)), len);
        m.multiply(new t.Matrix4().makeScale(1, len, 0.24));
        rays.push({ geo: rayGeo, matrix: m });
        void r;
      }
      rays.push({ geo: new t.TorusGeometry(c.apron + 0.08, 0.035, 5, 32), matrix: mtx(t, [0, 0.03, 0], [Math.PI / 2, 0, 0]) });
      g.add(mergedParts(t, rays, mat(t, BRASS, { tex: 'metal', metal: 0.75, rough: 0.38 })));
      return { group: g };
    },
    parapet: (t, c) => {
      const g = new t.Group();
      const st = rimStations(c, 0.5);
      const parts: MergedBoxSpec[] = [];
      st.forEach((s, i) => {
        parts.push({ dims: [0.075, 0.5, 0.075], pos: [s.at[0], 0.25, s.at[2]], rotY: s.yaw });
        if (s.run) {
          const n = st[i + 1];
          if (n && n.run) {
            const mx = (s.at[0] + n.at[0]) / 2;
            const mz = (s.at[2] + n.at[2]) / 2;
            const len = Math.hypot(n.at[0] - s.at[0], n.at[2] - s.at[2]);
            [0.5, 0.32].forEach((yy) => parts.push({ dims: [len, 0.035, 0.035], pos: [mx, yy, mz], rotY: Math.atan2(n.at[0] - s.at[0], n.at[2] - s.at[2]) + Math.PI / 2 }));
          }
        }
      });
      g.add(mergedBoxes(t, parts, P.iron, { tex: 'metal', metal: 0.55, rough: 0.55 }));
      return { group: g };
    },
    centrepiece: (t, c) => {
      const g = new t.Group();
      const R = 1.45;
      const TOP = 3.15;
      // four legs, four ARCHING pipes to a hub, and a gear on the hub
      const iron: PartSpec[] = [];
      const legGeo = new t.CylinderGeometry(0.07, 0.1, 1, 8);
      LEG_DIRS.forEach((d) => iron.push({ geo: legGeo, matrix: mtx(t, [d[0] * R, (TOP - 1.2) / 2, d[1] * R], [0, 0, 0], [1, TOP - 1.2, 1]) }));
      const pipeGeo = new t.CylinderGeometry(0.055, 0.055, 1, 8);
      LEG_DIRS.forEach((d) => {
        // each arch is sampled as five short pipes between two points, so the
        // curve is built from the points it joins, never from a tilt angle
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 5; k += 1) {
          const u = k / 5;
          pts.push(V(t, d[0] * R * (1 - u), TOP - 1.2 + (TOP - (TOP - 1.2)) * Math.sin((u * Math.PI) / 2), d[1] * R * (1 - u)));
        }
        for (let k = 0; k + 1 < pts.length; k += 1) {
          const dd = pts[k + 1].clone().sub(pts[k]);
          const m = alongDir(t, pts[k], dd, dd.length());
          m.multiply(new t.Matrix4().makeScale(1, dd.length(), 1));
          iron.push({ geo: pipeGeo, matrix: m });
        }
      });
      // the hub is 0.5 tall (was 0.24) so it reaches the gear's plane — the
      // gear ring's inner edge is r 0.365 and a 0.24 hub simply ended below it,
      // leaving the wheel and its teeth orbiting nothing
      iron.push({ geo: new t.CylinderGeometry(0.2, 0.2, 0.5, 10), matrix: mtx(t, [0, TOP + 0.15, 0]) });
      // and a stem down the axis to carry the gas globe
      iron.push({ geo: new t.CylinderGeometry(0.03, 0.03, 0.3, 6), matrix: mtx(t, [0, TOP - 0.05, 0]) });
      g.add(mergedParts(t, iron, mat(t, P.iron, { tex: 'metal', metal: 0.6, rough: 0.5 }), false));
      legGeo.dispose();
      pipeGeo.dispose();
      // brass: a toothed wheel on the hub + a pressure gauge
      const brass: PartSpec[] = [];
      brass.push({ geo: new t.TorusGeometry(0.42, 0.055, 6, 24), matrix: mtx(t, [0, TOP + 0.22, 0], [Math.PI / 2, 0, 0]) });
      const tooth = new t.BoxGeometry(0.09, 0.05, 0.11);
      for (let i = 0; i < 14; i += 1) {
        const a = (i / 14) * Math.PI * 2;
        brass.push({ geo: tooth, matrix: mtx(t, [Math.sin(a) * 0.48, TOP + 0.22, Math.cos(a) * 0.48], [0, a, 0]) });
      }
      // four spokes from the hub out to the wheel rim, or the wheel is adrift
      const spoke = new t.BoxGeometry(0.055, 0.045, 0.46);
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2;
        brass.push({ geo: spoke, matrix: mtx(t, [Math.sin(a) * 0.22, TOP + 0.22, Math.cos(a) * 0.22], [0, a, 0]) });
      }
      // the pressure gauge bolted to the hub's flank (it was floating on a
      // diagonal where no arch runs — the legs are on the AXES)
      brass.push({ geo: new t.CylinderGeometry(0.15, 0.15, 0.08, 12), matrix: mtx(t, [0, TOP + 0.02, 0.22], [Math.PI / 2, 0, 0]) });
      const spin = mergedParts(t, brass, mat(t, BRASS, { tex: 'metal', metal: 0.75, rough: 0.35 }), false);
      tooth.dispose();
      spoke.dispose();
      g.add(spin);
      const gl = glow(t, th, P.lampGlass, 0);
      g.add(mergedParts(t, [{ geo: new t.CylinderGeometry(0.15, 0.15, 0.3, 6), matrix: mtx(t, [0, TOP - 0.32, 0]) }], gl.m));
      return {
        group: g,
        update: (time) => {
          spin.rotation.y = time * 0.28; // the foundry never stops
          gl.update(time, [0, TOP, 0], g);
        },
      };
    },
    landmark: (t, seed) => {
      const b = buildGiantGear(t, { seed, radius: 0.5, pinion: true, spin: true, ballast: true });
      return { group: b.group, update: b.update, radius: 0.6, name: 'giantGear' };
    },
  };
};

