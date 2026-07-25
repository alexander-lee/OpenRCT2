import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// ---------------------------------------------------------------------------
// LOCAL PROCEDURAL BRICK — Stage's texture set has no masonry pattern
// (wood/metal/asphalt/leaf/fabric/concrete/grass/plastic/sand) and Stage is not
// ours to extend, so the mansion draws its own MASONRY canvas the exact same
// way Stage's `drawTexture` does: one 128px canvas, mortar bed + running-bond
// courses, shaded per brick, cached module-level and reused as map + bumpMap.
// DETERMINISTIC — hashed sine only (no Math.random, unlike Stage's speckles),
// so every mount and every screenshot is byte-identical.
// ---------------------------------------------------------------------------
const _brickCache = new Map<string, THREE.CanvasTexture>();
const bhash = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
function brickCanvas(color: number, mortar: number, S = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const rgb = (h: number, d = 0) =>
    `rgb(${Math.max(0, Math.min(255, ((h >> 16) & 255) + d))},${Math.max(0, Math.min(255, ((h >> 8) & 255) + d))},${Math.max(0, Math.min(255, (h & 255) + d))})`;
  // mortar bed
  x.fillStyle = rgb(mortar);
  x.fillRect(0, 0, S, S);
  const ROWS = 8; // 8 courses of 4 stretchers -> reads as brick at repeat [6,3]
  const COLS = 4;
  const bh = S / ROWS;
  const bw = S / COLS;
  for (let r = 0; r < ROWS; r++) {
    const off = r % 2 ? bw / 2 : 0; // running bond: alternate courses half-lapped
    for (let cix = -1; cix <= COLS; cix++) {
      const bx = cix * bw + off;
      const seed = r * 31 + ((cix + 8) % COLS) * 7;
      const d = Math.round(bhash(seed) * 40 - 20); // per-brick tonal variation
      x.fillStyle = rgb(color, d);
      x.fillRect(bx + 1.2, r * bh + 1.2, bw - 2.4, bh - 2.4);
      // weathered mottling: two darker flecks per brick, hashed placement
      for (let k = 0; k < 2; k++) {
        x.fillStyle = rgb(color, d - 26);
        const fx = bx + 2.5 + bhash(seed * 3 + k) * (bw - 7);
        const fy = r * bh + 2.5 + bhash(seed * 5 + k) * (bh - 7);
        x.fillRect(fx, fy, 2.2, 1.6);
      }
      // top-edge highlight so the bump map catches a lip on every brick
      x.fillStyle = rgb(color, d + 22);
      x.fillRect(bx + 1.2, r * bh + 1.2, bw - 2.4, 1);
    }
  }
  return c;
}
function brickTex(t: typeof THREE, color: number, mortar: number, rx: number, ry: number): THREE.CanvasTexture {
  const key = `${color}:${mortar}:${rx}:${ry}`;
  const hit = _brickCache.get(key);
  if (hit) return hit;
  const tex = new t.CanvasTexture(brickCanvas(color, mortar));
  tex.wrapS = tex.wrapT = t.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _brickCache.set(key, tex);
  return tex;
}
/** a `box()`-shaped brick wall: same signature as Stage's box() minus the tex
 *  opts, with the local masonry canvas wired in as map + bumpMap. */
function brickBox(
  t: typeof THREE,
  dims: [number, number, number],
  color: number,
  mortar: number,
  pos: [number, number, number],
  repeat: [number, number],
  o: { rotY?: number; rotZ?: number; bump?: number } = {},
): THREE.Mesh {
  const tex = brickTex(t, color, mortar, repeat[0], repeat[1]);
  const m = new t.Mesh(
    new t.BoxGeometry(...dims),
    new t.MeshStandardMaterial({ color: 0xffffff, map: tex, bumpMap: tex, bumpScale: o.bump ?? 0.06, roughness: 0.95 }),
  );
  m.position.set(...pos);
  if (o.rotY) m.rotation.y = o.rotY;
  if (o.rotZ) m.rotation.z = o.rotZ;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Haunted house matched to the RCT2 HHBUILD sprite: a grand THREE-TIER mansion
// — a wide ground floor with a wraparound slate awning roof, a narrower middle
// storey, and a square clock tower with a steep pyramidal cap. Cream/timber
// walls, blue-slate shingled roofs edged with mossy GREEN trim and green ball
// finials at every corner, rows of tall amber-lit windows that flicker, a
// round clock face, and vine-wrapped porch posts. Slow ParticleKit smoke
// wisps drift off the crooked chimney — tinted eerie green after dark.
export function buildHauntedMansionScene(three: typeof THREE): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
} {
  const group = new three.Group();
  // WALKTHROUGH — deliberately NO motion gate: the mansion has no vehicle to
  // park (bats/smoke/flicker keep their own life). REAL guests "ride" by
  // walking the interior: 6 static anchors INSIDE the ground floor (walls
  // x ±1.3, z ±1.1 hide them) spread the tour stops out deterministically.
  const seats: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const seat = new three.Group();
    seat.position.set(Math.cos(a) * 0.7, 0.05, Math.sin(a) * 0.55);
    seat.rotation.y = -a;
    group.add(seat);
    seats.push(seat);
  }
  let vehicle: THREE.Object3D | undefined; // walkthrough has no car — a circling bat gives the follow cam a tour (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const BRICK = 0x8c6a5a; // weathered masonry (the cream sprite wall, read as brick)
        const MORTAR = 0xa89b8c; // pale lime mortar bed
        const TIMBER = 0x6a5a40;
        const SLATE = 0x5a707a; // roof shingles
        const SLATE_D = 0x435459;
        const MOSS = 0x4c6e30; // green trim (sprite #305020)
        const wins: THREE.MeshStandardMaterial[] = [];
        const winPane = (w: number, h: number) => {
          const m = new t.MeshStandardMaterial({ color: 0x3a2a10, emissive: 0xdf9a30, emissiveIntensity: 0.8, roughness: 0.5 });
          wins.push(m);
          return new t.Mesh(new t.BoxGeometry(w, h, 0.05), m);
        };
        const finial = (x: number, y: number, z: number) => {
          g.add(cyl(t, 0.03, 0.05, 0.14, MOSS, [x, y, z], { rough: 0.8, seg: 8 }));
          g.add(ball(t, 0.09, MOSS, [x, y + 0.13, z], { tex: 'leaf', repeat: [2, 2], flat: true, rough: 0.9 }));
        };

        // ---- tier 1: wide ground floor ----
        g.add(brickBox(t, [2.6, 1.1, 2.2], BRICK, MORTAR, [0, 0.55, 0], [8, 3])); // tier-1 brick masonry
        // timber corner posts + door
        [-1.28, 1.28].forEach((x) => [-1.08, 1.08].forEach((z) => g.add(box(t, [0.1, 1.1, 0.1], TIMBER, [x, 0.55, z], { tex: 'wood', repeat: [1, 3], rough: 0.9 }))));
        g.add(box(t, [0.44, 0.8, 0.06], 0x2a1c10, [0.5, 0.4, 1.12], { tex: 'wood', repeat: [2, 3], rough: 0.85 })); // door
        // ground-floor window rows (front + sides), amber lit
        for (const x of [-0.9, -0.4, 0.05]) {
          const wmesh = winPane(0.26, 0.55);
          wmesh.position.set(x, 0.6, 1.11);
          g.add(wmesh);
          g.add(box(t, [0.32, 0.62, 0.03], MOSS, [x, 0.6, 1.1], { rough: 0.85 })); // green surround
        }
        for (const z of [-0.6, 0, 0.6]) {
          const wmesh = winPane(0.26, 0.55);
          wmesh.rotation.y = Math.PI / 2;
          wmesh.position.set(1.31, 0.6, z);
          g.add(wmesh);
        }
        // wraparound hipped slate awning over tier 1 — a 4-sided frustum whose top
        // rim tucks inside the tier-2 wall and whose eaves overhang the tier-1 top
        const roof1 = new t.Group();
        roof1.add(cyl(t, 0.962, 1.839, 0.47, SLATE, [0, 0, 0], { tex: 'concrete', repeat: [8, 2], rough: 0.85, seg: 4, rotY: Math.PI / 4 }));
        roof1.scale.x = 1.206; // rectangular hip: rim (0.82, 0.68), eaves (1.568, 1.30)
        roof1.position.y = 1.315; // eave underside 1.08, rim top 1.55
        g.add(roof1);
        [-1.42, 1.42].forEach((x) => [-1.18, 1.18].forEach((z) => g.add(box(t, [0.5, 0.06, 0.5], MOSS, [x, 1.17, z], { tex: 'leaf', repeat: [2, 2], rough: 0.95 }))));
        [-1.5, 1.5].forEach((x) => [-1.25, 1.25].forEach((z) => finial(x, 1.17, z)));

        // ---- tier 2: middle storey (drops to the tier-1 wall top at y=1.1) ----
        g.add(brickBox(t, [1.7, 1.35, 1.4], BRICK, MORTAR, [0, 1.775, 0], [5, 4])); // tier-2 brick masonry
        [-0.82, 0.82].forEach((x) => [-0.66, 0.66].forEach((z) => g.add(box(t, [0.09, 1.35, 0.09], TIMBER, [x, 1.775, z], { tex: 'wood', repeat: [1, 4], rough: 0.9 }))));
        for (const x of [-0.5, 0, 0.5]) {
          const wmesh = winPane(0.24, 0.5);
          wmesh.position.set(x, 2.0, 0.71);
          g.add(wmesh);
          g.add(box(t, [0.3, 0.56, 0.03], MOSS, [x, 2.0, 0.7], { rough: 0.85 }));
        }
        // tier-2 hipped skirt roof (frustum: rim inside the tower, eaves overhang) + finials
        const roof2 = new t.Group();
        roof2.add(cyl(t, 0.495, 1.301, 0.42, SLATE, [0, 0, 0], { tex: 'concrete', repeat: [6, 1], rough: 0.85, seg: 4, rotY: Math.PI / 4 }));
        roof2.scale.x = 1.2; // rim (0.42, 0.35), eaves (1.104, 0.92)
        roof2.position.y = 2.64; // eave underside 2.43, rim top 2.85
        g.add(roof2);
        [-0.95, 0.95].forEach((x) => [-0.78, 0.78].forEach((z) => finial(x, 2.58, z)));

        // ---- tier 3: clock tower (drops to the tier-2 wall top at y=2.4) ----
        g.add(brickBox(t, [0.85, 1.2, 0.85], BRICK, MORTAR, [0, 3.0, 0], [3, 4])); // clock-tower brick masonry
        [-0.4, 0.4].forEach((x) => [-0.4, 0.4].forEach((z) => g.add(box(t, [0.08, 1.2, 0.08], TIMBER, [x, 3.0, z], { tex: 'wood', repeat: [1, 4], rough: 0.9 }))));
        // round clock face + hands
        g.add(cyl(t, 0.2, 0.2, 0.05, 0xe8dfc8, [0, 3.25, 0.44], { rotX: Math.PI / 2, rough: 0.6, seg: 20 }));
        g.add(box(t, [0.02, 0.13, 0.02], 0x2a1c10, [0, 3.3, 0.47], { rough: 0.5 }));
        g.add(box(t, [0.1, 0.02, 0.02], 0x2a1c10, [0.04, 3.25, 0.47], { rough: 0.5 }));
        // lit tower windows live on the SIDE faces so the front facade belongs
        // to the clock alone (roof2 slope hides the x-faces below y 2.847)
        [-1, 1].forEach((sx) => {
          const sw = winPane(0.2, 0.4);
          sw.rotation.y = Math.PI / 2;
          sw.position.set(sx * 0.44, 3.08, 0);
          g.add(sw);
        });
        // steep pyramidal slate cap + moss ridge + top finial — rotY 45° turns
        // the seg-4 faces square to the tower (face half-width 0.48 > wall 0.425)
        g.add(cyl(t, 0.03, 0.68, 0.85, SLATE_D, [0, 4.0, 0], { seg: 4, rough: 0.85, rotY: Math.PI / 4, tex: 'concrete', repeat: [4, 2] }));
        g.add(cyl(t, 0.03, 0.7, 0.1, MOSS, [0, 3.63, 0], { seg: 4, rough: 0.9, rotY: Math.PI / 4 }));
        finial(0, 4.42, 0);

        // porch deck + steps + railing
        g.add(box(t, [2.7, 0.1, 0.5], 0x7a6448, [0, 0.05, 1.35], { tex: 'wood', repeat: [8, 1], rough: 0.9 })); // deck butts the facade at z=1.1
        g.add(box(t, [0.7, 0.07, 0.3], 0x6a5640, [0.5, 0.035, 1.72], { tex: 'wood', repeat: [3, 1], rough: 0.9 })); // step
        for (let px = -1.2; px <= 1.2; px += 0.4) {
          if (Math.abs(px - 0.5) < 0.25) continue; // gap at the door (only the 0.4 post)
          g.add(cyl(t, 0.025, 0.025, 0.32, TIMBER, [px, 0.25, 1.57], { tex: 'wood', rough: 0.9, seg: 6 })); // base sunk into the deck
        }
        // rail in two runs so the doorway (x 0.28..0.72) stays open; tops of the
        // posts (0.41) embed 0.01 into the rails (0.40..0.44)
        g.add(box(t, [1.25, 0.04, 0.04], TIMBER, [-0.6, 0.42, 1.57], { tex: 'wood', repeat: [4, 1], rough: 0.9 }));
        g.add(box(t, [0.5, 0.04, 0.04], TIMBER, [1.05, 0.42, 1.57], { tex: 'wood', repeat: [2, 1], rough: 0.9 }));
        // crooked brick chimney — base buried in the tier-1 roof slope
        g.add(brickBox(t, [0.28, 1.8, 0.28], 0x7d5546, MORTAR, [0.85, 2.35, -0.5], [1, 6], { rotZ: 0.05 })); // crooked BRICK chimney stack
        g.add(brickBox(t, [0.36, 0.12, 0.36], 0x5f3b2f, MORTAR, [0.81, 3.28, -0.5], [1, 1], { rotZ: 0.05 })); // centred on the tilted chimney top (x 0.805)
        // shutters beside ground-floor windows (middle one hangs askew — pushed
        // out to x-0.26 so its swung corner (max x -0.54) clears the pane at -0.53)
        [-0.9, -0.4, 0.05].forEach((x, si) => {
          g.add(box(t, [0.09, 0.55, 0.02], 0x3c5228, [x - (si === 1 ? 0.26 : 0.21), 0.6, 1.115], { tex: 'wood', repeat: [1, 3], rough: 0.9, rotZ: si === 1 ? 0.28 : 0 }));
          g.add(box(t, [0.09, 0.55, 0.02], 0x3c5228, [x + 0.21, 0.6, 1.115], { tex: 'wood', repeat: [1, 3], rough: 0.9 }));
        });
        // rusty iron fence out front
        for (let fx = -1.5; fx <= 1.5; fx += 0.25) g.add(cyl(t, 0.014, 0.014, 0.42, 0x2c2c30, [fx, 0.21, 2.1], { metal: 0.5, rough: 0.6, seg: 6 }));
        [0.12, 0.36].forEach((fy) => g.add(box(t, [3.1, 0.03, 0.03], 0x2c2c30, [0, fy, 2.1], { metal: 0.5, rough: 0.6 })));
        // flickering door lantern
        const lam = new t.MeshStandardMaterial({ color: 0xffe3a0, emissive: 0xffaa22, emissiveIntensity: 1, roughness: 0.4 });
        const lantern = new t.Mesh(new t.BoxGeometry(0.1, 0.14, 0.1), lam);
        lantern.position.set(0.85, 0.95, 1.14);
        g.add(lantern);
        wins.push(lam);
        // night lighting: real light in the porch lantern + eerie cold washes
        // (green facade uplight, blue clock-tower wash) — all nightK-gated
        const lanternLight = new t.PointLight(0xffaa33, 0, 3.5, 2);
        lanternLight.position.set(0.85, 0.95, 1.3);
        g.add(lanternLight);
        const greenUplight = new t.PointLight(0x58ff9a, 0, 4.5, 2);
        greenUplight.position.set(0, 0.25, 1.75);
        g.add(greenUplight);
        const towerWash = new t.PointLight(0x7aa0ff, 0, 3.5, 2);
        towerWash.position.set(0, 3.5, 1.4);
        g.add(towerWash);
        // low ground fog
        const fogDisc = new t.Mesh(new t.CircleGeometry(2.6, 32), new t.MeshStandardMaterial({ color: 0xaebacf, transparent: true, opacity: 0.16, roughness: 1 }));
        fogDisc.rotation.x = -Math.PI / 2;
        fogDisc.position.y = 0.12;
        g.add(fogDisc);
        // chimney smoke: slow eerie ParticleKit wisps drifting off the
        // crooked stack — pale grey by day, tinted sickly GREEN after dark
        // (the material colour multiplies the per-particle vertex colours)
        const wisp = buildEmitter(t, {
          max: 40, rate: 4, life: 4.5, lifeVar: 1.2,
          velocity: [0.05, 0.3, 0.02], spread: 0.055, gravity: -0.015,
          size: 0.1, sizeEnd: 0.44, color: 0x8f949c, colorEnd: 0x6f7a74, opacity: 0.3,
        });
        wisp.setOrigin(0.81, 3.36, -0.5); // the chimney cap mouth
        g.add(wisp.points);
        const wispDay = new t.Color(0xffffff);
        const wispNight = new t.Color(0x9ef2a8);
        const wispMat = wisp.points.material as THREE.PointsMaterial;
        // circling bats
        const bats: THREE.Group[] = [];
        for (let b = 0; b < 3; b++) {
          const bat = new t.Group();
          bat.add(box(t, [0.05, 0.03, 0.03], 0x14141a, [0, 0, 0]));
          bat.add(box(t, [0.1, 0.015, 0.05], 0x14141a, [-0.07, 0.01, 0], { rotZ: 0.4 }));
          bat.add(box(t, [0.1, 0.015, 0.05], 0x14141a, [0.07, 0.01, 0], { rotZ: -0.4 }));
          g.add(bat);
          bats.push(bat);
        }
        vehicle = bats[0];
        // vine-wrapped porch posts (deck to awning underside) + creeping moss patches
        [-1.28, 1.28].forEach((x) => g.add(cyl(t, 0.045, 0.045, 1.06, MOSS, [x, 0.56, 1.2], { tex: 'leaf', repeat: [1, 4], rough: 0.95, seg: 8 }))); // 0.03..1.09: buried in deck, embeds in the awning underside
        [
          [-1.1, 0.9, 1.11], // tier-1 wall
          [0.9, 1.35, 0.95], // tier-1 roof slope
          [0.86, 1.9, 0.4], // tier-2 wall
        ].forEach(([x, y, z]) => g.add(ball(t, 0.16, MOSS, [x, y, z], { tex: 'leaf', repeat: [2, 2], flat: true, rough: 0.95 })));

        return (time) => {
          // day -> night gate: windows flicker up from a dim daytime residual,
          // lantern + eerie washes only live after dark
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          wins.forEach((m, i) => {
            const flicker = 0.5 + Math.abs(Math.sin(time * 2.6 + i * 1.9)) * 0.65;
            m.emissiveIntensity = 0.15 + (flicker - 0.15) * ease;
          });
          lanternLight.intensity = ease * (0.7 + 0.15 * Math.sin(time * 11));
          greenUplight.intensity = ease * (0.9 + 0.1 * Math.sin(time * 1.7));
          towerWash.intensity = ease * 0.8;
          wisp.update(time);
          wispMat.color.lerpColors(wispDay, wispNight, ease); // eerie green at night
          bats.forEach((bat, b) => {
            const a = time * (0.9 + b * 0.25) + b * 2.1;
            bat.position.set(Math.cos(a) * (1.4 + b * 0.35), 3.4 + Math.sin(time * 3 + b) * 0.25, Math.sin(a) * (1.4 + b * 0.35));
            bat.rotation.y = -a + Math.PI / 2;
            bat.rotation.z = Math.sin(time * 14 + b) * 0.5;
          });
        };
      })(three, group) || undefined;
  return { group, update, vehicle, seatWorld: makeSeatWorld(three, seats) };
}

/** <HauntedMansion> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. WALKTHROUGH exception: no motion gate (there is no
 *  vehicle to park — bats/smoke keep animating); capacity 6 = the 6 interior
 *  tour spots (seatWorld anchors hidden inside the ground-floor walls).
 *  Override with top-level props / `queue`. */
export const HauntedMansion = composableRide(
  'HauntedMansion',
  (t) => buildHauntedMansionScene(t),
  { defaults: { name: 'Haunted Mansion', capacity: 6, rideDuration: 12, intensity: 4, price: 4 } },
);
