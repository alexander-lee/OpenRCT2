import * as THREE from 'three';
import { alongDir, cyl, mat, mergedBoxes, mergedParts, mtx } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import type { WorldTheme } from './index';
import { buildBasaltColumns } from '../EmberfallScenery';
import { LEG_DIRS, blockRun, chainOf, glow, h01, rimBlocks, spanLight, spanPoints, V, lampLight } from './dressShared';
import type { StreetDress } from './dressShared';

// ===========================================================================
// EMBERFALL — volcanic. Everything is heavy, low-slung basalt with fire ON TOP
// of it; the lantern is an OPEN BOWL, never a glazed cage.
// ===========================================================================
export const fireDress = (th: WorldTheme): StreetDress => {
  const P = th.palette;
  const STONE = P.pavingDark;
  const ASH = P.pavingLight;
  return {
    id: 'fire',
    lamp: (t, at, opts) => {
      const g = new t.Group();
      const [x, y, z] = at;
      const H = opts.height ?? 2.55;
      // stepped basalt plinth — three rough courses, each turned off-axis, so
      // the base reads as stacked rock rather than a machined pedestal
      const plinth: MergedBoxSpec[] = [0, 1, 2].map((i) => ({
        dims: [0.56 - i * 0.11, 0.19, 0.56 - i * 0.11],
        pos: [x, y + 0.095 + i * 0.19, z],
        rotY: (opts.yaw ?? 0) + (h01(x * 7 + z * 3 + i) - 0.5) * 0.5,
        repeat: [2, 1],
      }));
      g.add(mergedBoxes(t, plinth, STONE, { tex: 'concrete', rough: 0.95, bump: 0.05 }));
      // a single tapered iron shaft, then a WIDE flared bowl
      g.add(cyl(t, 0.05, 0.075, H - 0.57, P.iron, [x, y + 0.57 + (H - 0.57) / 2, z], { tex: 'metal', repeat: [1, 4], rough: 0.6, metal: 0.5, seg: 10 }));
      g.add(cyl(t, 0.33, 0.13, 0.26, P.iron, [x, y + H + 0.13, z], { tex: 'metal', rough: 0.55, metal: 0.55, seg: 12 }));
      // coals: two flat-shaded lumps on ONE emissive material, lit by day
      const gl = glow(t, th, P.lampGlow, 0.55);
      const coalGeo = new t.IcosahedronGeometry(0.15, 1);
      const coals = mergedParts(
        t,
        [
          { geo: coalGeo, matrix: mtx(t, [x - 0.07, y + H + 0.27, z + 0.04], [0, 0.4, 0], [1.35, 0.62, 1.2]) },
          { geo: coalGeo, matrix: mtx(t, [x + 0.09, y + H + 0.3, z - 0.05], [0, 1.1, 0], [1, 0.8, 1.05]) },
        ],
        gl.m,
      );
      coals.castShadow = false;
      g.add(coals);
      const li = opts.light ? lampLight(t, th, [x, y + H + 0.3, z]) : null;
      if (li) g.add(li.light);
      return {
        group: g,
        hook: [x, y + H + 0.02, z],
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
      // ONE mesh: two block piers, a thick slab, a canted back slab
      g.add(
        mergedBoxes(
          t,
          [
            { dims: [0.24, 0.4, 0.5], pos: [-0.38, 0.2, -0.02] },
            { dims: [0.24, 0.4, 0.5], pos: [0.38, 0.2, -0.02] },
            { dims: [1.08, 0.13, 0.56], pos: [0, 0.46, 0], repeat: [4, 2] },
            { dims: [1.08, 0.34, 0.11], pos: [0, 0.68, -0.24], rotX: -0.16, repeat: [4, 1] },
          ],
          STONE,
          { tex: 'concrete', rough: 0.94, bump: 0.045 },
        ),
      );
      return { group: g };
    },
    span: (t, from, to) => {
      const g = new t.Group();
      const dist = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      // a heavy CHAIN, sagging hard, with three fire pots hung off it
      const pts = spanPoints(t, from, to, 20, 0.24 + dist * 0.05);
      g.add(chainOf(t, pts, 0.022, 5, mat(t, P.cable, { tex: 'metal', metal: 0.6, rough: 0.5 })));
      const potGeo = new t.CylinderGeometry(0.14, 0.07, 0.18, 10);
      const bailGeo = new t.TorusGeometry(0.055, 0.012, 4, 8);
      const pots: PartSpec[] = [];
      const flames: PartSpec[] = [];
      const flameGeo = new t.IcosahedronGeometry(0.1, 1);
      [0.25, 0.5, 0.75].forEach((u, i) => {
        const p = pts[Math.round(u * 20)];
        pots.push({ geo: potGeo, matrix: mtx(t, [p.x, p.y - 0.24, p.z]) });
        pots.push({ geo: bailGeo, matrix: mtx(t, [p.x, p.y - 0.1, p.z], [Math.PI / 2, 0, 0]) });
        flames.push({ geo: flameGeo, matrix: mtx(t, [p.x, p.y - 0.16, p.z], [0, i * 0.7, 0], [1, 1.5, 1]) });
      });
      g.add(mergedParts(t, pots, mat(t, P.iron, { tex: 'metal', metal: 0.55, rough: 0.55 })));
      const gl = glow(t, th, P.spanBulbs[1] ?? P.lampGlow, 0.5);
      const fl = mergedParts(t, flames, gl.m);
      fl.castShadow = false;
      g.add(fl);
      const li = spanLight(t, th, from, to, 0.24 + dist * 0.05 + 0.2);
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
      // irregular basalt kerbstones with real gaps, plus an ember slit in
      // every fourth joint — glowing by day (see `glow`'s dayFloor)
      // dims are [ACROSS the run, height, ALONG the run]: a station's yaw puts
      // local +z along the carriageway, so `along` under the 0.44 station pitch
      // is what decides whether a kerb reads as separate stones or one line.
      // Emberfall's is deliberately BROKEN — 0.34 along leaves a real 0.10 gap.
      g.add(
        blockRun(
          t,
          stations,
          STONE,
          (i) => [0.3 + h01(seed + i * 3) * 0.1, 0.1 + h01(seed + i * 5) * 0.09, 0.34],
          () => 0,
          { tex: 'concrete', rough: 0.96, bump: 0.06 },
          (i) => i % 4 === 2,
        ),
      );
      const gl = glow(t, th, P.lampGlow, 0.26);
      const slit: PartSpec[] = [];
      const slitGeo = new t.BoxGeometry(0.3, 0.024, 0.2);
      // the ember slit takes the place of a missing stone rather than sitting on
      // top of one, where it would be buried inside the block it lit
      stations.forEach((s, i) => {
        if (i % 4 !== 2) return;
        slit.push({ geo: slitGeo, matrix: mtx(t, [s.at[0], s.at[1] + 0.012, s.at[2]], [0, s.yaw, 0]) });
      });
      if (slit.length) {
        const m = mergedParts(t, slit, gl.m);
        m.castShadow = false;
        g.add(m);
      }
      return { group: g, update: (time) => gl.update(time, stations[0]?.at ?? [0, 0, 0], g) };
    },
    paving: (t, c) => {
      const g = new t.Group();
      // TWELVE radiating spokes from the apron to the rim — a caldera floor is a
      // fissure field, not a bordered municipal square. They are ASH-coloured,
      // not basalt: the first cut used `pavingDark` for the spokes on a plaza
      // whose own surface is dark, and the whole pattern was invisible in the
      // TOP elevation (which is exactly what the ortho sheet is for).
      const spokes: MergedBoxSpec[] = [];
      const reach = c.half - 0.35 - c.apron;
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        const r = c.apron + reach / 2;
        spokes.push({ dims: [0.34 + h01(c.seed + i) * 0.16, 0.02, reach], pos: [Math.sin(a) * r, 0, Math.cos(a) * r], rotY: a, repeat: [1, Math.max(2, Math.round(reach)) ] });
      }
      // a broken ring of darker plates at the apron, laid OVER the spokes
      const ring: MergedBoxSpec[] = [];
      for (let i = 0; i < 16; i += 1) {
        const a = ((i + 0.5) / 16) * Math.PI * 2;
        ring.push({ dims: [0.42, 0.022, 0.3], pos: [Math.sin(a) * (c.apron + 0.2), 0.006, Math.cos(a) * (c.apron + 0.2)], rotY: a });
      }
      g.add(mergedBoxes(t, spokes, ASH, { tex: 'concrete', rough: 0.95, bump: 0.05 }));
      g.add(mergedBoxes(t, ring, STONE, { tex: 'concrete', rough: 0.95, bump: 0.05 }));
      const gl = glow(t, th, P.lampGlow, 0.4);
      const cracks: PartSpec[] = [];
      const crackGeo = new t.BoxGeometry(0.07, 0.016, 1);
      for (let i = 0; i < 12; i += 3) {
        const a = (i / 12) * Math.PI * 2;
        const len = reach * 0.8;
        const r = c.apron + len / 2;
        const m = mtx(t, [Math.sin(a) * r, 0.012, Math.cos(a) * r], [0, a, 0], [1, 1, len]);
        cracks.push({ geo: crackGeo, matrix: m });
      }
      const cm = mergedParts(t, cracks, gl.m);
      cm.castShadow = false;
      cm.receiveShadow = false;
      g.add(cm);
      return { group: g, update: (time) => gl.update(time, [0, 0, 0], g) };
    },
    parapet: (t, c) => {
      const g = new t.Group();
      g.add(mergedBoxes(t, rimBlocks(c, 0.44, (i) => [0.44, 0.3 + h01(c.seed * 3 + i) * 0.22, 0.3]), STONE, { tex: 'concrete', rough: 0.95, bump: 0.06 }));
      return { group: g };
    },
    centrepiece: (t, c) => {
      const g = new t.Group();
      const R = 1.45;
      const TOP = 2.9;
      // four basalt pylons carrying an iron ring, with a brazier slung under it
      const legs: MergedBoxSpec[] = [];
      LEG_DIRS.forEach((d, i) => {
        for (let k = 0; k < 3; k += 1)
          legs.push({
            dims: [0.3 - k * 0.05, 0.78, 0.3 - k * 0.05],
            pos: [d[0] * R, 0.39 + k * 0.78, d[1] * R],
            rotY: Math.atan2(d[0], d[1]) + (h01(c.seed + i * 4 + k) - 0.5) * 0.35,
            repeat: [1, 2],
          });
      });
      g.add(mergedBoxes(t, legs, STONE, { tex: 'concrete', rough: 0.95, bump: 0.06 }));
      const iron: PartSpec[] = [];
      const ringGeo = new t.TorusGeometry(R, 0.05, 6, 28);
      iron.push({ geo: ringGeo, matrix: mtx(t, [0, TOP - 0.55, 0], [Math.PI / 2, 0, 0]) });
      // three suspension chains from the ring down to the brazier bail
      const bowlY = TOP - 1.05;
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        const from = V(t, Math.sin(a) * R, TOP - 0.55, Math.cos(a) * R);
        const to = V(t, Math.sin(a) * 0.3, bowlY + 0.14, Math.cos(a) * 0.3);
        const d = to.clone().sub(from);
        const m = alongDir(t, from, d, d.length());
        m.multiply(new t.Matrix4().makeScale(1, d.length(), 1));
        iron.push({ geo: new t.CylinderGeometry(0.017, 0.017, 1, 5), matrix: m });
      }
      iron.push({ geo: new t.CylinderGeometry(0.46, 0.2, 0.3, 14), matrix: mtx(t, [0, bowlY, 0]) });
      g.add(mergedParts(t, iron, mat(t, P.iron, { tex: 'metal', metal: 0.5, rough: 0.55 })));
      const gl = glow(t, th, P.lampGlow, 0.6);
      const coalGeo = new t.IcosahedronGeometry(0.19, 1);
      // sized to sit INSIDE the bowl's 0.46 rim: the first cut was 1.5x0.19
      // wide and its lower half poked out through the bowl wall
      const coals = mergedParts(t, [
        { geo: coalGeo, matrix: mtx(t, [-0.09, bowlY + 0.13, 0.04], [0, 0.5, 0], [1.1, 0.6, 1.0]) },
        { geo: coalGeo, matrix: mtx(t, [0.1, bowlY + 0.14, -0.05], [0, 1.3, 0], [0.95, 0.7, 0.95]) },
      ], gl.m);
      coals.castShadow = false;
      g.add(coals);
      return { group: g, update: (time) => gl.update(time, [0, bowlY, 0], g) };
    },
    landmark: (t, seed) => {
      const b = buildBasaltColumns(t, { seed, spread: 0.6, height: 1.5, fallen: true });
      return { group: b.group, update: b.update, radius: 0.66, name: 'basaltColumns' };
    },
  };
};

