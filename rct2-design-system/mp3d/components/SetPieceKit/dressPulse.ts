import * as THREE from 'three';
import { alongDir, mat, mergedBoxes, mergedParts, mtx } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import type { WorldTheme } from './index';
import { buildSpeakerStack } from '../PulseScenery';
import { CROSS, LEG_DIRS, blockRun, glow, rimStations, spanLight, V, lampLight } from './dressShared';
import type { StreetDress } from './dressShared';

// ===========================================================================
// PULSE — a nightclub street. Rectilinear, cantilevered, and the only world
// whose overhead run is a straight LIT BAR. Rings and slabs, no cages.
// ===========================================================================
export const pulseDress = (th: WorldTheme): StreetDress => {
  const P = th.palette;
  const CHROME = P.cable;
  return {
    id: 'neon',
    lamp: (t, at, opts) => {
      const g = new t.Group();
      const [x, y, z] = at;
      const H = opts.height ?? 2.95;
      const yaw = opts.yaw ?? 0;
      // a square-section mast on a chrome disc — no taper, no cage, no finial
      g.add(
        mergedBoxes(
          t,
          [
            { dims: [0.42, 0.06, 0.42], pos: [x, y + 0.03, z], rotY: yaw + Math.PI / 4 },
            { dims: [0.26, 0.1, 0.26], pos: [x, y + 0.11, z], rotY: yaw },
            { dims: [0.1, H - 0.16, 0.1], pos: [x, y + 0.16 + (H - 0.16) / 2, z], rotY: yaw },
            { dims: [0.5, 0.07, 0.07], pos: [x, y + H - 0.1, z], rotY: yaw },
          ],
          P.iron,
          { tex: 'metal', metal: 0.6, rough: 0.42 },
        ),
      );
      const gl = glow(t, th, P.lampGlow, 0.3);
      const emissive: PartSpec[] = [];
      // a vertical neon tube up the mast face
      const tube = new t.CylinderGeometry(0.028, 0.028, 1, 6);
      emissive.push({ geo: tube, matrix: mtx(t, [x + Math.cos(yaw) * 0.08, y + 0.5 + (H - 0.9) / 2, z - Math.sin(yaw) * 0.08], [0, 0, 0], [1, H - 0.9, 1]) });
      // THE HALO: a horizontal ring at the head, which no other world has —
      // carried on a DIAMETRAL bar in the ring's own plane. The first cut put a
      // 0.46 cross-bar 0.16 below the ring and left the 0.34 ring itself
      // unsupported (probe-setpiece-attach: 0.108-0.142 clear, six of them).
      // ...at y + H - 0.02, so the bar passes THROUGH the mast head (which tops
      // out at y + H). At + 0.06 the whole halo assembly cleared the mast by
      // 0.032 and measured 0.044 adrift.
      const HALO = 0.34;
      emissive.push({ geo: new t.TorusGeometry(HALO, 0.034, 6, 22), matrix: mtx(t, [x, y + H - 0.02, z], [Math.PI / 2, 0, 0]) });
      emissive.push({ geo: tube, matrix: mtx(t, [x, y + H - 0.02, z], [0, yaw, Math.PI / 2], [1, HALO * 2, 1]) });
      g.add(mergedParts(t, emissive, gl.m, false));
      tube.dispose();
      const li = opts.light ? lampLight(t, th, [x, y + H, z]) : null;
      if (li) g.add(li.light);
      return {
        group: g,
        hook: [x, y + H - 0.12, z],
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
      // a CANTILEVER: one pier, a floating slab, and a lit reveal under it
      g.add(
        mergedBoxes(
          t,
          [
            { dims: [0.5, 0.34, 0.34], pos: [0, 0.17, -0.16] },
            { dims: [1.14, 0.1, 0.56], pos: [0, 0.4, 0.02] },
            { dims: [1.14, 0.4, 0.07], pos: [0, 0.63, -0.24], rotX: -0.1 },
          ],
          P.iron,
          { tex: 'metal', metal: 0.55, rough: 0.45 },
        ),
      );
      const gl = glow(t, th, P.spanBulbs[1] ?? P.lampGlow, 0.35);
      const strip = mergedParts(t, [{ geo: new t.BoxGeometry(1.06, 0.035, 0.06), matrix: mtx(t, [0, 0.33, 0.24]) }], gl.m);
      strip.castShadow = false;
      g.add(strip);
      // this is the one bench of the five that is LIT, so it is also the one
      // that needs an update — hence the bench contract returns a built, not a
      // bare Group (the default `setPieceBench` had nothing to animate)
      return { group: g, update: (time) => gl.update(time, at, g) };
    },
    span: (t, from, to) => {
      const g = new t.Group();
      // A RIGID LIT BAR — no sag, no bulbs: three parallel tubes in a channel
      const a = V(t, from[0], from[1], from[2]);
      const b = V(t, to[0], to[1], to[2]);
      const len = a.distanceTo(b);
      const dir = b.clone().sub(a);
      const channel = alongDir(t, a, dir, len);
      channel.multiply(new t.Matrix4().makeScale(1, len, 1));
      const chan = mergedParts(t, [{ geo: new t.BoxGeometry(0.12, 1, 0.16), matrix: channel }], mat(t, P.iron, { tex: 'metal', metal: 0.6, rough: 0.45 }));
      g.add(chan);
      const gl = glow(t, th, P.spanBulbs[0] ?? P.lampGlow, 0.3);
      const tube = new t.CylinderGeometry(0.03, 0.03, 1, 6);
      const tubes: PartSpec[] = [];
      [-0.055, 0, 0.055].forEach((off) => {
        const p = a.clone();
        p.y -= 0.09;
        const m = alongDir(t, p, dir, len);
        m.multiply(new t.Matrix4().makeTranslation(off, 0, 0));
        m.multiply(new t.Matrix4().makeScale(1, len, 1));
        tubes.push({ geo: tube, matrix: m });
      });
      const lit = mergedParts(t, tubes, gl.m);
      lit.castShadow = false;
      g.add(lit);
      const li = spanLight(t, th, from, to, 0.14);
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
      // a continuous black channel with a CONTINUOUS light reveal — the only
      // world whose kerb is a single unbroken line
      g.add(blockRun(t, stations, P.pavingDark, () => [0.3, 0.13, 0.46], () => 0, { tex: 'metal', metal: 0.4, rough: 0.5 }));
      const gl = glow(t, th, P.spanBulbs[1] ?? P.lampGlow, 0.32);
      const strip: PartSpec[] = [];
      const stripGeo = new t.BoxGeometry(0.12, 0.035, 0.46);
      stations.forEach((s) => {
        strip.push({ geo: stripGeo, matrix: mtx(t, [s.at[0], s.at[1] + 0.125, s.at[2]], [0, s.yaw, 0]) });
      });
      void seed;
      const m = mergedParts(t, strip, gl.m);
      m.castShadow = false;
      g.add(m);
      return { group: g, update: (time) => gl.update(time, stations[0]?.at ?? [0, 0, 0], g) };
    },
    paving: (t, c) => {
      const g = new t.Group();
      // a dark CHEQUER of lifted tiles + concentric light rings
      const tiles: MergedBoxSpec[] = [];
      const pitch = 0.6;
      const n = Math.floor((c.half - 0.3) / pitch);
      for (let ix = -n; ix <= n; ix += 1) {
        for (let iz = -n; iz <= n; iz += 1) {
          if ((ix + iz) % 2 !== 0) continue;
          const px = ix * pitch;
          const pz = iz * pitch;
          if (Math.hypot(px, pz) < c.apron + 0.2) continue;
          if (Math.abs(px) > c.half - 0.35 || Math.abs(pz) > c.half - 0.35) continue;
          tiles.push({ dims: [pitch - 0.07, 0.022, pitch - 0.07], pos: [px, 0, pz] });
        }
      }
      g.add(mergedBoxes(t, tiles, P.pavingLight, { tex: 'metal', metal: 0.35, rough: 0.45 }));
      const gl = glow(t, th, P.spanBulbs[1] ?? P.lampGlow, 0.34);
      const rings: PartSpec[] = [];
      const ringGeo = new t.TorusGeometry(1, 0.03, 4, 40);
      [c.apron + 0.14, c.apron + 0.62, c.half - 0.5].forEach((r) => {
        rings.push({ geo: ringGeo, matrix: mtx(t, [0, 0.026, 0], [Math.PI / 2, 0, 0], [r, r, 1]) });
      });
      const m = mergedParts(t, rings, gl.m);
      m.castShadow = false;
      m.receiveShadow = false;
      g.add(m);
      return { group: g, update: (time) => gl.update(time, [0, 0, 0], g) };
    },
    parapet: (t, c) => {
      const g = new t.Group();
      const st = rimStations(c, 0.48);
      const parts: MergedBoxSpec[] = [];
      st.forEach((s) => parts.push({ dims: [0.13, 0.62, 0.13], pos: [s.at[0], 0.31, s.at[2]], rotY: s.yaw }));
      g.add(mergedBoxes(t, parts, P.iron, { tex: 'metal', metal: 0.6, rough: 0.42 }));
      const gl = glow(t, th, P.lampGlow, 0.3);
      const caps: PartSpec[] = [];
      const capGeo = new t.BoxGeometry(0.15, 0.05, 0.15);
      st.forEach((s) => caps.push({ geo: capGeo, matrix: mtx(t, [s.at[0], 0.64, s.at[2]], [0, s.yaw, 0]) }));
      const m = mergedParts(t, caps, gl.m);
      m.castShadow = false;
      g.add(m);
      return { group: g, update: (time) => gl.update(time, [0, 0, 0], g) };
    },
    centrepiece: (t, c) => {
      const g = new t.Group();
      const R = 1.45;
      const TOP = 3.2;
      // four chrome masts, a square neon frame, a mirror ball on the axis
      const parts: MergedBoxSpec[] = [];
      LEG_DIRS.forEach((d) => parts.push({ dims: [0.1, TOP, 0.1], pos: [d[0] * R, TOP / 2, d[1] * R], rotY: Math.atan2(d[0], d[1]) }));
      for (let i = 0; i < 4; i += 1) {
        const a = LEG_DIRS[i];
        const b = LEG_DIRS[(i + 1) % 4];
        const len = Math.hypot((b[0] - a[0]) * R, (b[1] - a[1]) * R);
        parts.push({
          dims: [len, 0.09, 0.09],
          pos: [((a[0] + b[0]) / 2) * R, TOP - 0.05, ((a[1] + b[1]) / 2) * R],
          rotY: Math.atan2((b[0] - a[0]) * R, (b[1] - a[1]) * R) + Math.PI / 2,
        });
      }
      // the two diagonal cross-braces: without them the stem and the ball hang
      // from the middle of a frame that has no member at the axis
      CROSS.forEach(([i, j]) => {
        const a = LEG_DIRS[i];
        const b = LEG_DIRS[j];
        const len = Math.hypot((b[0] - a[0]) * R, (b[1] - a[1]) * R);
        parts.push({
          dims: [len, 0.09, 0.09],
          pos: [0, TOP - 0.05, 0],
          rotY: Math.atan2((b[0] - a[0]) * R, (b[1] - a[1]) * R) + Math.PI / 2,
        });
      });
      g.add(mergedBoxes(t, parts, CHROME, { tex: 'metal', metal: 0.8, rough: 0.28 }));
      const gl = glow(t, th, P.spanBulbs[0] ?? P.lampGlow, 0.34);
      const lit: PartSpec[] = [];
      const tube = new t.CylinderGeometry(0.032, 0.032, 1, 6);
      for (let i = 0; i < 4; i += 1) {
        const a = LEG_DIRS[i];
        const b = LEG_DIRS[(i + 1) % 4];
        const p0 = V(t, a[0] * R, TOP - 0.16, a[1] * R);
        const p1 = V(t, b[0] * R, TOP - 0.16, b[1] * R);
        const d = p1.clone().sub(p0);
        const m = alongDir(t, p0, d, d.length());
        m.multiply(new t.Matrix4().makeScale(1, d.length(), 1));
        lit.push({ geo: tube, matrix: m });
      }
      const litM = mergedParts(t, lit, gl.m);
      litM.castShadow = false;
      g.add(litM);
      tube.dispose();
      // the ball hangs from the frame centre on a real stem, so it is supported
      const stem = mergedParts(
        t,
        [{ geo: new t.CylinderGeometry(0.02, 0.02, 0.34, 5), matrix: mtx(t, [0, TOP - 0.22, 0]) }],
        mat(t, CHROME, { tex: 'metal', metal: 0.8, rough: 0.3 }),
      );
      g.add(stem);
      const ballM = new t.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 0.95, roughness: 0.18, flatShading: true });
      const ballMesh = new t.Mesh(new t.IcosahedronGeometry(0.28, 1), ballM);
      ballMesh.position.set(0, TOP - 0.62, 0);
      g.add(ballMesh);
      return {
        group: g,
        update: (time) => {
          ballMesh.rotation.y = time * 0.6;
          gl.update(time, [0, TOP, 0], g);
        },
      };
    },
    landmark: (t, seed) => {
      const b = buildSpeakerStack(t, { seed, count: 2 });
      return { group: b.group, update: b.update, radius: 0.45, name: 'speakerStack' };
    },
  };
};

