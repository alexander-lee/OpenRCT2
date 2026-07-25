import React from 'react';
import * as THREE from 'three';
import { cyl, ball, mat, nightKOf } from '../Stage';
import { buildWater } from '../WaterTile';
import { buildEmitter } from '../ParticleKit';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// Fountain — single-tier stone park fountain, ported from the reference
// design system's Fountain (ds-6160cd89) into OUR helpers/palette: coped
// basin holding a real buildWater sheet (LOW waviness — a fountain basin is
// a still ornamental pool, not open water), smooth entasis pedestal + one
// bellied bowl carved with LatheGeometry (concrete texture + bump), a small
// radius-clipped buildWater sheet as the bowl's TOP-TIER water (same shader
// as the basin, so both tiers read as the same water), six translucent
// tapered jets arcing from the bowl lip into the basin with a ParticleKit
// droplet SPRAY at each arc
// top and a slow mist bank over the basin water. (The former second bowl
// tier, its pedestal extension and the top plume were removed — the single
// bowl reads cleaner from the park camera.) All geometry at 0.75x the
// reference so it sits on one park tile. Deterministic — hashed particle
// emission, no randomness.
// ---------------------------------------------------------------------------

const S = 0.75; // scale from the reference model to our tile scale
const STONE = 0x9b968c;
const GOLD = 0xb08a2a;

// reference jet parabola: linear drop + 1.8·t·(1−t) arc (scaled by S)
const jetY = (y0: number, y1: number, k: number) => y0 + (y1 - y0) * k + 1.8 * S * k * (1 - k);

// reference lathe profiles (unscaled [r, y] pairs; ×S applied when built).
// Pedestal gets an extra bottom ring so it roots inside the basin floor disc
// (floor slab spans y 0..0.08 — the lathe starts at y 0.015, fully embedded).
const PEDESTAL: [number, number][] = [
  [0.55, 0.02], [0.46, 0.16], [0.43, 0.21], [0.35, 0.33], [0.295, 0.47], [0.265, 0.64],
  [0.252, 0.85], [0.26, 1.04], [0.285, 1.19], [0.315, 1.3], [0.325, 1.36],
];
// bellied bowl with a rolled lip that tucks back down inside, so the water
// disc edge (r 1.02·S at y 1.62·S) stays hidden behind the inner tuck (r 0.96·S)
const TIER1: [number, number][] = [
  [0.3, 1.36], [0.36, 1.39], [0.56, 1.44], [0.8, 1.5], [1.0, 1.575], [1.12, 1.645],
  [1.19, 1.7], [1.22, 1.735], [1.17, 1.755], [1.07, 1.75], [0.99, 1.71], [0.96, 1.65],
];

export function buildFountain(t: typeof THREE): { group: THREE.Group; update: (time: number) => void } {
  const grp = new t.Group();
  const basinR = 1.6;

  // shared lathe helper: profile is [r, y] pairs, scaled by `scale`; rings
  // and bowls are open shells so the material is DoubleSide
  const lathe = (profile: [number, number][], repeat: [number, number], scale = 1, color = STONE) => {
    const pts = profile.map(([r, y]) => new t.Vector2(r * scale, y * scale));
    const m = mat(t, color, { tex: 'concrete', repeat, rough: 0.92, bump: 0.035 });
    m.side = t.DoubleSide;
    const mesh = new t.Mesh(new t.LatheGeometry(pts, 32), m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grp.add(mesh);
  };

  // ---- basin: dark pool floor + stone wall RING + coping RING ----
  // (rings, not solid cylinders — a solid coping disc would cap the basin and
  // hide the water). Floor 0..0.08 in the deep water colour so wave troughs
  // blend; wall ring 0..0.42; coping ring 0.42..0.52. The water sheet (y 0.44)
  // laps the coping inner face (r basinR−0.06, just outside the water clip
  // radius basinR−0.08, whose edge alpha-fades anyway).
  grp.add(cyl(t, basinR, basinR, 0.08, 0x1f8fd2, [0, 0.04, 0], { rough: 0.35, seg: 32 })); // bright water-bed blue (matches the v2.6 water palette)
  lathe([[basinR - 0.04, 0.42], [basinR - 0.04, 0.08], [basinR + 0.09, 0.0], [basinR + 0.09, 0.42]], [12, 2]);
  lathe(
    [[basinR - 0.06, 0.42], [basinR + 0.18, 0.42], [basinR + 0.18, 0.52], [basinR - 0.06, 0.52], [basinR - 0.06, 0.42]],
    [14, 1], 1, 0xb2ada2,
  );

  // ---- pedestal + the single carved bowl (LatheGeometry, concrete tex) ----
  lathe(PEDESTAL, [4, 2], S);
  lathe(TIER1, [8, 1], S);
  // gold collar between pedestal and the bowl, gold finial dome at the bowl
  // centre (caps the old stem hole and gives the silhouette a crown)
  grp.add(cyl(t, 0.26 * S, 0.34 * S, 0.08 * S, GOLD, [0, 1.34 * S, 0], { rough: 0.35, metal: 0.7, seg: 16 }));
  grp.add(ball(t, 0.15 * S, GOLD, [0, 1.62 * S, 0], { rough: 0.3, metal: 0.7 }));

  // ---- bowl water: the SAME shader water as the basin, clipped to the
  // tier radius (the old scrolling-metal-texture disc read as painted resin
  // next to the real water below). Tiny swell (amp 0.12 x waviness 0.5 →
  // ±0.018) so crests stay under the rolled lip; no skirt — the bowl shell
  // is the volume. Edge (r 1.02·S) alpha-fades and hides behind the lip tuck.
  const bowlWater = buildWater(t, 1.02 * S * 2 + 0.3, 48, 1.02 * S, false, 0.12, 0.5);
  bowlWater.mesh.position.y = 1.62 * S;
  grp.add(bowlWater.mesh);

  // ---- basin water: the size warrants the real animated sheet. LOW
  // waviness 0.4 (composing with amp 0.6 → ±0.072 swell) — a calm pool that
  // shimmers gently instead of the old full-amp open-water chop ----
  const water = buildWater(t, (basinR - 0.06) * 2 + 0.4, 96, basinR - 0.08, undefined, 0.6, 0.4);
  water.mesh.position.y = 0.44;
  grp.add(water.mesh);

  // ---- six translucent arcing jets from the tier-1 lip into the basin ----
  const jetR0 = 1.08 * S; // spout radius, just inside the lip (1.22·S)
  const jetY0 = 1.68 * S; // just under the lip top (1.755·S)
  const jetR1 = basinR - 0.35;
  const jetY1 = 0.46; // splash just above the basin water sheet (0.44)
  const jetMat = new t.MeshStandardMaterial({ color: 0x9adcec, transparent: true, opacity: 0.8, roughness: 0.15, depthWrite: false });
  const up = new t.Vector3(0, 1, 0);
  const barSeg = (from: THREE.Vector3, to: THREE.Vector3, w: number) => {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const mesh = new t.Mesh(new t.BoxGeometry(w, len, w), jetMat);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(up, dir.normalize());
    mesh.castShadow = false;
    grp.add(mesh);
  };
  for (let i = 0; i < 6; i++) {
    const th = (i / 6) * Math.PI * 2;
    const cx = Math.cos(th);
    const cz = Math.sin(th);
    const steps = 9; // tapered: thick at the spout, thinning to the splash
    for (let k = 0; k < steps; k++) {
      const k0 = k / steps;
      const k1 = (k + 1) / steps;
      const r0 = jetR0 + (jetR1 - jetR0) * k0;
      const r1 = jetR0 + (jetR1 - jetR0) * k1;
      const thick = (0.075 - 0.038 * ((k0 + k1) / 2)) * S;
      barSeg(
        new t.Vector3(cx * r0, jetY(jetY0, jetY1, k0), cz * r0),
        new t.Vector3(cx * r1, jetY(jetY0, jetY1, k1), cz * r1),
        thick,
      );
    }
  }

  // ---- ParticleKit spray: one droplet emitter riding each jet's arc top
  // (velocity = the stream tangent there, gravity carries the spray down
  // into the basin) + a slow wide mist bank over the basin water. These
  // replace the old 12 orbiting droplet meshes. ~204 particles total.
  const sprayK = 0.45; // arc parameter of the emission point (near the apex)
  const sprayR = jetR0 + (jetR1 - jetR0) * sprayK;
  const sprayY = jetY(jetY0, jetY1, sprayK);
  // stream tangent at sprayK, scaled by the old droplet pace (0.75 k/s)
  const dvR = 0.75 * (jetR1 - jetR0);
  const dvY = 0.75 * (jetY1 - jetY0 + 1.8 * S * (1 - 2 * sprayK));
  const sprays = Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const cx = Math.cos(th);
    const cz = Math.sin(th);
    const e = buildEmitter(t, {
      max: 30, rate: 34, life: 0.55, lifeVar: 0.18,
      velocity: [cx * dvR, dvY, cz * dvR], spread: 0.24, gravity: 2.2,
      size: 0.2, sizeEnd: 0.11, color: 0xf4fcfe, colorEnd: 0xaadcea, opacity: 1,
    });
    e.setOrigin(cx * sprayR, sprayY, cz * sprayR);
    grp.add(e.points);
    return e;
  });
  const mist = buildEmitter(t, {
    max: 48, rate: 11, life: 2.2, lifeVar: 0.7,
    velocity: [0, 0.13, 0], spread: 0.28, gravity: -0.01,
    size: 0.3, sizeEnd: 0.65, color: 0xcfe8ee, colorEnd: 0xe6f4f8, opacity: 0.28,
  });
  mist.setOrigin(0, 0.52, 0);
  grp.add(mist.points);

  // splash foam where each jet meets the basin sheet — squashed translucent
  // white domes riding just proud of the water (y 0.44), selling the arc
  // landings from the steep park camera
  const foamMat = new t.MeshStandardMaterial({ color: 0xeaf6f8, transparent: true, opacity: 0.55, roughness: 0.4, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const th = (i / 6) * Math.PI * 2;
    const foam = new t.Mesh(new t.SphereGeometry(0.1, 12, 8), foamMat);
    foam.scale.set(1.3, 0.28, 1.3);
    foam.position.set(Math.cos(th) * jetR1, 0.455, Math.sin(th) * jetR1);
    foam.castShadow = false;
    grp.add(foam);
  }

  // ---- night: four cool up-lights around the pedestal, gated by the Stage
  // day/night cycle in update() (both water sheets moonlight-dim themselves
  // via the shader's uNight)
  const upLights: THREE.PointLight[] = [];
  for (let i = 0; i < 4; i++) {
    const th = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const ul = new t.PointLight(0x9fd4e2, 0, 3.2, 2);
    ul.position.set(Math.cos(th) * 0.95, 0.62, Math.sin(th) * 0.95);
    grp.add(ul);
    upLights.push(ul);
  }

  const update = (time: number) => {
    water.update(time);
    bowlWater.update(time);
    sprays.forEach((e) => e.update(time)); // emitters self-derive dt
    mist.update(time);
    // day -> night gate: cool up-lit stone
    const nk = nightKOf(grp);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    upLights.forEach((ul) => (ul.intensity = ease * 0.75));
  };
  return { group: grp, update };
}

// Preview: the fountain alone on the shared Stage.
export function buildFountainScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const f = buildFountain(t);
        g.add(f.group);
        return f.update;
      })(three, group) || undefined;
  return { group, update };
}

/** <Fountain> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const Fountain = composable('Fountain', (t) => buildFountainScene(t));
