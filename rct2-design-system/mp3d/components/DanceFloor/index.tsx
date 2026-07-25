import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { buildCrowd } from '../PeepCrowd';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// DanceFloor — a beat-synced disco floor. Checkerboard of emissive tiles that
// change colour on the shared ~2.2 Hz beat (the same beat the Guest pose
// layer's 'dance' state uses), cycling a disco palette with hashed per-tile
// phase offsets — fully deterministic, no Math.random. A DJ booth sits along
// the -z edge: wooden desk with a metal top, a console of sliders/knobs/decks,
// two speaker stacks with inset woofer cones, and a buildPeep DJ in headphones
// nodding and working the deck. A slow mirror ball hangs from a gantry arch
// and two low PointLights tinted to the dominant tile colour pool real light
// at night (tiles still glow ~40% by day via nightKOf).
//
// The DJ is PART of the attraction; DANCERS ARE NOT. The floor ships empty —
// real sim guests wander onto it and decide to dance (GameManager dance-zone
// registration, see Context.md). `dancers: true` adds a decorative preview
// crowd for standalone staging only.
// ---------------------------------------------------------------------------

// deterministic pseudo-random from an integer key (hashed sine)
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (k: number) => k * k * (3 - 2 * k);

// shared dance beat — matches the Guest pose layer / PeepCrowd BEAT (~2.2 Hz)
const BEAT_HZ = 2.2;
const BEAT = Math.PI * 2 * BEAT_HZ;

// disco palette: magenta / cyan / amber / lime / blue
export const DISCO_PALETTE = [0xd815b8, 0x18c8d8, 0xe8a018, 0x8fd818, 0x1858e0];

export interface DanceFloorOpts {
  /** tiles per side (default 4) */
  size?: number;
  /** tile width in metres (default 0.6) */
  tile?: number;
  /** decorative dancing peeps ON the tiles (default false — the rig ships
   *  EMPTY so real sim guests supply the dancers; previews turn this on for
   *  standalone staging). The crowd group is `userData.lodDetail`-tagged so
   *  the park runtime sheds it beyond NEAR distance. The DJ is NOT part of
   *  this — the booth peep is always built (it's the attraction). */
  dancers?: boolean;
}

export function buildDanceFloor(
  t: typeof THREE,
  opts: DanceFloorOpts = {},
): { group: THREE.Group; update: (time: number) => void; floorTopY: number } {
  const size = opts.size ?? 4;
  const tileW = opts.tile ?? 0.6;
  const field = size * tileW;
  const half = field / 2;
  const group = new t.Group();

  const PLINTH_H = 0.1;
  const GROUT_H = 0.03;
  const TILE_H = 0.045;
  const floorTopY = PLINTH_H + GROUT_H + TILE_H;
  const IRON = 0x2a2c30;

  // concrete plinth — extends under the DJ booth strip on the -z side
  const boothDepth = 1.05;
  group.add(
    box(t, [field + 0.6, PLINTH_H, field + 0.6 + boothDepth], 0x9a978e, [0, PLINTH_H / 2, -boothDepth / 2], {
      tex: 'concrete',
      repeat: [6, 6],
      rough: 0.95,
    }),
  );
  // near-black grout plate — thin dark lines show between the inset tiles
  group.add(box(t, [field + 0.1, GROUT_H, field + 0.1], 0x141418, [0, PLINTH_H + GROUT_H / 2, 0], { rough: 0.9 }));

  // ---- emissive tiles: one material each, colour-cycled on the beat ----
  interface Tile {
    m: THREE.MeshStandardMaterial;
    ph: number; // hashed beat-phase offset (0..1)
    off: number; // hashed palette offset
  }
  const tiles: Tile[] = [];
  const tileGeo = new t.BoxGeometry(tileW - 0.07, TILE_H, tileW - 0.07);
  for (let ix = 0; ix < size; ix += 1) {
    for (let iz = 0; iz < size; iz += 1) {
      const m = new t.MeshStandardMaterial({
        color: DISCO_PALETTE[0],
        emissive: DISCO_PALETTE[0],
        emissiveIntensity: 0.4,
        roughness: 0.35,
      });
      const mesh = new t.Mesh(tileGeo, m);
      mesh.position.set(-half + tileW * (ix + 0.5), PLINTH_H + GROUT_H + TILE_H / 2, -half + tileW * (iz + 0.5));
      mesh.receiveShadow = true;
      group.add(mesh);
      tiles.push({ m, ph: hash01(ix * 53 + iz * 97 + 5), off: Math.floor(hash01(ix * 29 + iz * 71 + 9) * 5) });
    }
  }

  // ---- DJ booth along the -z edge ----
  const bz = -(half + 0.42); // desk centreline
  group.add(box(t, [1.7, 0.34, 0.4], 0x3a2a1c, [0, PLINTH_H + 0.17, bz], { tex: 'wood', repeat: [3, 1], rough: 0.85 }));
  group.add(box(t, [1.8, 0.04, 0.5], IRON, [0, PLINTH_H + 0.36, bz], { tex: 'metal', rough: 0.5, metal: 0.6 }));
  // console slab with sliders, knobs and two decks
  group.add(box(t, [1.15, 0.05, 0.3], 0x1b1c20, [0, PLINTH_H + 0.405, bz], { rough: 0.6 }));
  for (let i = 0; i < 6; i += 1) {
    group.add(box(t, [0.02, 0.02, 0.09], 0xd8d8de, [-0.5 + i * 0.075, PLINTH_H + 0.44, bz + 0.06], { rough: 0.4, metal: 0.4 }));
  }
  for (let i = 0; i < 4; i += 1) {
    group.add(cyl(t, 0.018, 0.018, 0.025, 0xb8bcc4, [0.12 + i * 0.11, PLINTH_H + 0.44, bz + 0.07], { rough: 0.35, metal: 0.5, seg: 8 }));
  }
  [-0.32, 0.32].forEach((dx) => {
    group.add(cyl(t, 0.09, 0.09, 0.015, 0x0d0d10, [dx, PLINTH_H + 0.437, bz - 0.05], { rough: 0.45, seg: 20 })); // turntable
    group.add(cyl(t, 0.012, 0.012, 0.02, 0xc8ccd4, [dx, PLINTH_H + 0.445, bz - 0.05], { rough: 0.3, metal: 0.6, seg: 6 })); // spindle
  });

  // speaker stacks flanking the desk — woofer cones inset into the front face
  [-1.25, 1.25].forEach((sx) => {
    group.add(box(t, [0.45, 0.95, 0.42], 0x1c1c20, [sx, PLINTH_H + 0.475, bz], { tex: 'plastic', rough: 0.75 }));
    [0.28, 0.62].forEach((sy) => {
      group.add(cyl(t, 0.15, 0.09, 0.07, 0x0c0c0f, [sx, PLINTH_H + sy, bz + 0.2], { rotX: Math.PI / 2, rough: 0.8, seg: 18 }));
      group.add(ball(t, 0.035, 0x3a3c42, [sx, PLINTH_H + sy, bz + 0.2], { rough: 0.5, metal: 0.4 })); // dust cap
    });
    group.add(cyl(t, 0.05, 0.035, 0.05, 0x0c0c0f, [sx, PLINTH_H + 0.85, bz + 0.2], { rotX: Math.PI / 2, rough: 0.7, seg: 12 })); // tweeter
  });

  // DJ peep on a metal riser behind the desk, facing the floor (+z) — the DJ
  // is part of the rig (the attraction's operator), unlike the dancers
  group.add(box(t, [0.7, 0.07, 0.5], IRON, [0, PLINTH_H + 0.035, -(half + 0.78)], { tex: 'metal', rough: 0.6, metal: 0.4 }));
  const dj = buildPeep(t, { shirt: 0x18a0a0, trousers: 0x333940, skin: 0xc68642, hair: 0x1c1c1c, expression: 'happy' });
  dj.group.scale.setScalar(0.5);
  dj.group.position.set(0, PLINTH_H + 0.07, -(half + 0.78));
  group.add(dj.group);
  // headphones: torus band over the head + two ear pads (ride the head group)
  const band = new t.Mesh(new t.TorusGeometry(0.14, 0.022, 8, 18, Math.PI), mat(t, 0x202024, { rough: 0.5 }));
  band.position.set(0, 0.01, -0.01);
  band.castShadow = true;
  dj.head.add(band);
  [-1, 1].forEach((s) => {
    const pad = cyl(t, 0.05, 0.05, 0.035, 0x202024, [s * 0.135, 0, -0.01], { rotZ: Math.PI / 2, rough: 0.6, seg: 12 });
    dj.head.add(pad);
  });

  // ---- mirror ball on a gantry arch over the floor centre ----
  const gx = half + 0.45;
  [-1, 1].forEach((s) => {
    group.add(cyl(t, 0.05, 0.065, 2.42, IRON, [s * gx, 1.21, 0], { tex: 'metal', repeat: [1, 4], rough: 0.55, metal: 0.6 }));
    group.add(cyl(t, 0.12, 0.15, 0.06, IRON, [s * gx, 0.03, 0], { rough: 0.6, metal: 0.4 })); // base pad
  });
  group.add(box(t, [gx * 2 + 0.14, 0.09, 0.09], IRON, [0, 2.42, 0], { tex: 'metal', rough: 0.55, metal: 0.6 }));
  group.add(cyl(t, 0.012, 0.012, 0.44, 0x44464c, [0, 2.16, 0], { rough: 0.5, metal: 0.7, seg: 6 }));
  const mirror = ball(t, 0.17, 0xd8dae2, [0, 1.77, 0], { metal: 1, rough: 0.12, flat: true });
  group.add(mirror);
  // faceted-glass sheen so the ball still reads after dark (nothing to reflect
  // in a black sky): a soft silver emissive that rises with nightKOf
  const mirrorMat = mirror.material as THREE.MeshStandardMaterial;
  mirrorMat.emissive = new t.Color(0x9aa2b6);
  mirrorMat.emissiveIntensity = 0.05;

  // ---- two low floor lights tinted to the dominant tile colour ----
  const lights: THREE.PointLight[] = [-1, 1].map((s) => {
    const pl = new t.PointLight(DISCO_PALETTE[0], 0.3, 4.5, 2);
    pl.position.set(s * half * 0.5, 1.35, 0);
    group.add(pl);
    return pl;
  });

  // ---- OPTIONAL decorative dancers (preview staging only) ----
  // Real parks leave this off: the floor registers a dance zone instead and
  // wandering sim guests stop and dance. Count/radius scale with the field so
  // a bigger `size` still fills; hands in the air on the SAME 2.2 Hz beat the
  // tiles flash to (buildCrowd's dance beat and DISCO tiles share BEAT_HZ).
  let crowdUpdate: ((time: number) => void) | null = null;
  if (opts.dancers) {
    const crowd = buildCrowd(t, {
      count: Math.max(4, Math.round((field * field) / 0.64)), // 9 on the default 2.4 u field
      radius: Math.max(0.45, half - 0.25),
      dance: 1,
    });
    crowd.group.position.y = floorTopY; // feet ON the tiles
    crowd.group.userData.lodDetail = true; // park runtime sheds the crowd beyond NEAR
    group.add(crowd.group);
    crowdUpdate = crowd.update;
  }

  const update = (time: number) => {
    const k = smooth(nightKOf(group));
    const gain = 0.4 + 1.1 * k; // ~40% glow by day, full disco at night
    tiles.forEach((tl) => {
      // colour steps once per beat (hashed per-tile phase + palette offset)
      const step = Math.floor(time * BEAT_HZ + tl.ph);
      const col = DISCO_PALETTE[(step + tl.off) % DISCO_PALETTE.length];
      tl.m.color.setHex(col);
      tl.m.emissive.setHex(col);
      // pulse dips exactly at the colour change, blooms mid-beat
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * (time * BEAT_HZ + tl.ph)));
      tl.m.emissiveIntensity = gain * pulse;
    });
    const dom = DISCO_PALETTE[Math.floor(time * BEAT_HZ) % DISCO_PALETTE.length];
    lights.forEach((pl, i) => {
      pl.color.setHex(dom);
      pl.intensity = (0.25 + 1.6 * k) * (0.8 + 0.2 * Math.abs(Math.sin(Math.PI * time * BEAT_HZ + i)));
    });
    mirror.rotation.y = time * 0.6;
    mirrorMat.emissiveIntensity = 0.05 + 0.5 * k; // silver sheen after dark
    // DJ works the deck on the beat
    const b = time * BEAT;
    dj.head.rotation.x = 0.08 + 0.14 * Math.sin(b); // nod
    dj.armR.rotation.x = -1.2 + 0.16 * Math.sin(b); // hand bobbing over the console
    const bar = ((time * BEAT_HZ) % 4 + 4) % 4; // 4-beat bar
    const lift = bar < 1 ? Math.sin(Math.PI * bar) : 0; // periodic arm raise
    dj.armL.rotation.x = -1.1 - lift * 1.7;
    crowdUpdate?.(time);
  };

  return { group, update, floorTopY };
}

/** Preview STAGING: the floor + DJ with the decorative dance crowd on the
 *  tiles. For previews only — inside a real <Park> compose `<DanceFloor>`
 *  (dancers default OFF there; real guests dance). */
export function buildDanceFloorScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  return buildDanceFloor(three, { size: 4, tile: 0.6, dancers: true });
}

export interface DanceFloorProps {
  /** tiles per side (default 4) */
  size?: number;
  /** tile width in metres (default 0.6) */
  tile?: number;
  /** decorative dancers on the tiles. Default: ON under <ScenePreview> (a
   *  standalone preview still looks alive), OFF inside a real <Park> — the
   *  fleet's riders-off-when-registered convention: real sim guests wander
   *  onto the floor and decide to dance instead of baked peeps. */
  dancers?: boolean;
  /** inside a real <Park>: register the floor as a GameManager DANCE ZONE —
   *  wandering guests whose stroll crosses the floor (happy + energetic
   *  enough) stop and dance on the shared 2.2 Hz beat for a hashed 10-30 s.
   *  No-op (with a console note) until the manager exposes
   *  `registerDanceZone` — see Context.md. Registrations are permanent
   *  (manager convention): remount the whole <Park> to change them. */
  register?: boolean;
}

/** the manager surface the compose hook needs (additive — lands with the
 *  GameManager dance-zone patch; optional-called until then) */
type DanceZoneMgr = {
  registerDanceZone?: (cfg: { center: [number, number]; halfW: number; halfD: number; rotation?: number }) => unknown;
};

/** <DanceFloor> — composable (components/Park/Context.md): mounts the rig at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. The rig
 *  itself ships WITHOUT dancers (DJ, tiles, lights and booth only) — pass
 *  `register` inside a real <Park> so sim guests treat it as a dance zone. */
export const DanceFloor = composable<DanceFloorProps>(
  'DanceFloor',
  (t, props, park) => {
    const preview = (park as unknown as { _previewHost?: boolean })._previewHost === true;
    return buildDanceFloor(t, {
      size: props.size,
      tile: props.tile,
      dancers: props.dancers ?? (preview && !props.register),
    });
  },
  {
    compose: (park, { props, position, rotation, scale }) => {
      if (!props.register) return;
      const size = props.size ?? 4;
      const tile = props.tile ?? 0.6;
      const half = ((size * tile) / 2) * scale;
      const mgr = park.manager() as DanceZoneMgr;
      if (mgr.registerDanceZone) {
        // zone = the tile field + a 0.9 u apron so guests strolling the path
        // ALONGSIDE the floor step in too (guests walk the street network —
        // the apron is what puts their polyline inside the zone)
        mgr.registerDanceZone({
          center: [position[0], position[2]],
          halfW: half + 0.9,
          halfD: half + 0.9,
          rotation,
        });
      } else {
        console.warn(
          '[DanceFloor] register: this GameManager has no registerDanceZone yet — the floor is visual-only until the manager gains the dance-zone patch (components/DanceFloor/Context.md)',
        );
      }
      // manager registrations are permanent — nothing to clean up
    },
  },
);
