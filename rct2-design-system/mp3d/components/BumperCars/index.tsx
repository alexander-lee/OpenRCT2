import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mergedBoxes, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate } from '../GameManager';
import { composableRide } from '../Park';

// Bumper cars (dodgems) modelled from the RCT2 sprite: a fenced arena with a
// powered ceiling grid and four rounded cars that ACTUALLY bump. The cars run
// a tiny deterministic rink sim — hashed-sine waypoint steering, velocity
// integration with clamped dt (<=0.1, GameManager-style), wall reflection
// with restitution and circle-circle impulses (restitution 0.65) — so they
// visibly deflect off each other with a jolt: body-tilt kick, driver whiplash
// and a bumper-skirt / pole-contact flash on every hit. No Math.random
// anywhere: the seed layout is fixed and steering is pure hashed sine.

export interface BumperCarsOpts {
  /** decorative drivers in the cars (default true). A ride registered in a
   *  <Park> turns them off so the GameManager seats REAL guests via
   *  `seatWorld` instead. */
  riders?: boolean;
}

export interface BumperCarsBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  /** per-seat world transform (seat -> live car) for GameManager seatWorld */
  seatWorld: (seat: number) => [number, number, number, number];
  /** one car for the RideViewer onboard cam (userData.rideVehicle) */
  vehicle: THREE.Object3D;
  /** GameManager FSM hook — cars glide to a stop while brokenDown/beingRepaired */
  onStateChange: (state: string) => void;
}

export function buildBumperCarsScene(three: typeof THREE, opts: BumperCarsOpts = {}): BumperCarsBuilt {
  const t = three;
  const g = new t.Group();
  const withRiders = opts.riders ?? true;
  const A = 2.4;
  g.add(box(t, [A + 0.4, 0.15, A + 0.4], 0x3a3f48, [0, 0.07, 0], { tex: 'metal', repeat: [8, 8], metal: 0.5, rough: 0.5 }));
  // STEEL FLOOR PLATES — a dodgem floor is a bolted grid of steel plates, and
  // the seams are what stop it reading as one grey slab. Raised 3 mm proud,
  // merged into a single draw call, with a scuffed painted circle in the
  // middle the way an operator marks the rink centre.
  {
    const seams: { dims: [number, number, number]; pos: [number, number, number] }[] = [];
    for (let i = -2; i <= 2; i++) {
      seams.push({ dims: [A + 0.4, 0.006, 0.022], pos: [0, 0.153, i * 0.56] });
      seams.push({ dims: [0.022, 0.006, A + 0.4], pos: [i * 0.56, 0.153, 0] });
    }
    for (let i = -2; i <= 2; i++)
      for (let k = -2; k <= 2; k++) seams.push({ dims: [0.045, 0.008, 0.045], pos: [i * 0.56 + 0.28, 0.154, k * 0.56 + 0.28] }); // plate bolts
    g.add(mergedBoxes(t, seams, 0x4d525b, { metal: 0.55, rough: 0.5 }));
    const ring = new t.Mesh(
      new t.TorusGeometry(0.72, 0.022, 6, 40),
      new t.MeshStandardMaterial({ color: 0xc9a63c, roughness: 0.85 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.152, 0);
    ring.receiveShadow = true;
    g.add(ring);
  }
  // low walls, each capped with a fat rubber RUB RAIL (cars hit these all day)
  // and skirted with hazard chevrons on the outside face
  [-1, 1].forEach((s) => {
    g.add(box(t, [A + 0.4, 0.4, 0.12], 0xd23a4a, [0, 0.3, (s * (A + 0.4)) / 2], { tex: 'plastic', repeat: [8, 1], rough: 0.5 }));
    g.add(box(t, [0.12, 0.4, A + 0.4], 0xe0e0e0, [(s * (A + 0.4)) / 2, 0.29, 0], { tex: 'plastic', repeat: [8, 1], rough: 0.5 })); // 0.01 lower: no coplanar wall tops at the corners
    g.add(cyl(t, 0.055, 0.055, A + 0.4, 0x232429, [0, 0.5, (s * (A + 0.4)) / 2], { rough: 0.85, seg: 10, rotZ: Math.PI / 2 })); // rub rail
    g.add(cyl(t, 0.055, 0.055, A + 0.4, 0x232429, [(s * (A + 0.4)) / 2, 0.49, 0], { rough: 0.85, seg: 10, rotX: Math.PI / 2 }));
    const chevrons: { dims: [number, number, number]; pos: [number, number, number]; rotZ?: number }[] = [];
    for (let i = 0; i < 7; i++) {
      // proud of the wall's OUTER face (walls span |1.34|..|1.46|), or they
      // bury themselves in the wall and only the tips show
      chevrons.push({ dims: [0.085, 0.24, 0.018], pos: [-1.2 + i * 0.4, 0.3, s * 1.469], rotZ: 0.5 });
      chevrons.push({ dims: [0.018, 0.24, 0.085], pos: [s * 1.469, 0.29, -1.2 + i * 0.4], rotZ: 0.5 });
    }
    g.add(mergedBoxes(t, chevrons, 0xf0d24a, { rough: 0.7 }));
  });
  // corner bollards, so the rink has a hard edge from outside too
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      g.add(cyl(t, 0.07, 0.085, 0.56, 0x2b2b30, [(sx * (A + 0.52)) / 2, 0.28, (sz * (A + 0.52)) / 2], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 10 }));
      g.add(ball(t, 0.075, 0xd23a4a, [(sx * (A + 0.52)) / 2, 0.57, (sz * (A + 0.52)) / 2], { rough: 0.5 }));
    }),
  );
  // ceiling grid + posts
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => g.add(cyl(t, 0.05, 0.05, 1.9, 0x2b2b30, [(sx * A) / 2, 1.0, (sz * A) / 2], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 8 }))));
  g.add(box(t, [A, 0.06, A], 0x23242a, [0, 1.95, 0], { tex: 'metal', repeat: [10, 10], metal: 0.6, rough: 0.5, opacity: 0.55 })); // the live grid is a mesh, not a lid — you can see the rink through it from above
  // the live grid is a real GRID: slats BOTH ways under the panel, plus the
  // striped facia valance that every fairground dodgem hangs off its roof edge
  {
    const grid: { dims: [number, number, number]; pos: [number, number, number] }[] = [];
    for (let i = -2; i <= 2; i++) {
      grid.push({ dims: [A, 0.02, 0.03], pos: [0, 1.915, (i * A) / 5] });
      grid.push({ dims: [0.03, 0.018, A], pos: [(i * A) / 5, 1.9, 0] });
    }
    g.add(mergedBoxes(t, grid, 0x33343a, { metal: 0.5, rough: 0.5 }));
    for (let e = 0; e < 4; e++) {
      const along = e % 2 === 0 ? 1 : 0;
      const sgn = e < 2 ? 1 : -1;
      const valance = new t.Group();
      valance.position.set(along ? 0 : (sgn * (A + 0.12)) / 2, 1.83, along ? (sgn * (A + 0.12)) / 2 : 0);
      valance.rotation.y = along ? 0 : Math.PI / 2;
      valance.add(box(t, [A + 0.12, 0.16, 0.05], 0xf2f2f2, [0, 0, 0], { rough: 0.6 }));
      const stripes: { dims: [number, number, number]; pos: [number, number, number] }[] = [];
      for (let i = 0; i < 8; i++) stripes.push({ dims: [0.155, 0.16, 0.012], pos: [-1.09 + i * 0.31, 0, 0.032] });
      valance.add(mergedBoxes(t, stripes, 0xd23a4a, { rough: 0.6 }));
      g.add(valance);
    }
  }
  // night lighting: string-light grid under the ceiling slats (bulb tops
  // 1.935 bury in the slat undersides at 1.905 / panel at 1.92) + two
  // real lights pooling on the floor; poles at |x|,|z| = 1.2 stay clear
  const bulbGeo = new t.SphereGeometry(0.035, 10, 8);
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
  for (let i = -2; i <= 2; i++)
    for (let k = -2; k <= 2; k++) {
      const bulb = new t.Mesh(bulbGeo, bulbMat);
      bulb.position.set(k * 0.4, 1.9, (i * A) / 5);
      g.add(bulb);
    }
  const gridLights: { intensity: number }[] = [];
  [-0.8, 0.8].forEach((x) => {
    const pl = new t.PointLight(0xffc97a, 0, 4, 2);
    pl.position.set(x, 1.7, 0);
    g.add(pl);
    gridLights.push(pl);
  });
  // corner lamps on the ceiling posts, proud of the roof panel so the
  // pavilion reads from outside at night
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      const lamp = new t.Mesh(new t.SphereGeometry(0.05, 10, 8), bulbMat);
      lamp.position.set((sx * A) / 2, 1.99, (sz * A) / 2); // post tops at 1.95
      g.add(lamp);
    }),
  );

  // ---- the car ------------------------------------------------------------
  // A dodgem is a MOULDED SHELL, not a box on a disc: a fat rubber bumper ring
  // around a flared fibreglass tub, a rounded nose cowl, a tall curved back
  // panel with a number roundel, a bucket seat, a real steering wheel on a
  // raked column, and a sprung pole up to the ceiling grid. Everything below
  // is built around the two numbers the SIM owns — collision radius 0.41 (the
  // bumper's outer edge) and the seat anchor at (0, 0.16, −0.02), which the
  // rider and `seatWorld` both key off — so the rebuild is visual only.
  const BODY = 0x2e4444; // dark teal body (sprite #305050)
  const CHROME = 0xb9bec6;
  const skirts = [0xe8641c, 0xd6338c, 0xe8641c, 0xd23a4a]; // orange/pink bumper rings
  const N = 4;
  const cars: THREE.Group[] = [];
  const skirtMats: THREE.MeshStandardMaterial[] = [];
  const contactMats: THREE.MeshStandardMaterial[] = [];
  const drivers: (THREE.Group | undefined)[] = [];
  const torus = (R: number, r: number, color: number, pos: [number, number, number], o: { metal?: number; rough?: number; rotX?: number; rotZ?: number; seg?: number } = {}) => {
    const m = new t.Mesh(
      new t.TorusGeometry(R, r, o.seg ?? 8, 24),
      new t.MeshStandardMaterial({ color, metalness: o.metal ?? 0, roughness: o.rough ?? 0.6 }),
    );
    m.position.set(...pos);
    m.rotation.x = o.rotX ?? -Math.PI / 2; // default: lying flat
    if (o.rotZ) m.rotation.z = o.rotZ;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  for (let i = 0; i < N; i++) {
    const car = new t.Group();
    const trim = skirts[i];
    // rubber bumper ring — a real torus, outer edge exactly on the sim radius
    car.add(torus(0.35, 0.06, 0x15161b, [0, 0.075, 0], { rough: 0.85, seg: 10 }));
    car.add(cyl(t, 0.3, 0.3, 0.035, 0x1b1c22, [0, 0.045, 0], { metal: 0.4, rough: 0.6, seg: 20 })); // chassis pan
    // the coloured skirt band (this is what flashes on a hit)
    const skirt = cyl(t, 0.325, 0.355, 0.13, trim, [0, 0.145, 0], { tex: 'plastic', repeat: [4, 1], rough: 0.5, seg: 22, emissive: trim });
    (skirt.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    skirtMats.push(skirt.material as THREE.MeshStandardMaterial);
    car.add(skirt);
    // flared tub, slightly egg-shaped, with a chrome rim round the cockpit
    const tub = cyl(t, 0.285, 0.325, 0.28, BODY, [0, 0.26, 0], { tex: 'plastic', repeat: [4, 1], rough: 0.42, seg: 22 });
    tub.scale.set(0.94, 1, 1.12);
    car.add(tub);
    const rim = torus(0.275, 0.02, CHROME, [0, 0.395, 0], { metal: 0.75, rough: 0.3 });
    rim.scale.set(0.94, 1.12, 1);
    car.add(rim);
    // nose cowl + chrome nose bar and two lamp studs
    const cowl = ball(t, 0.17, BODY, [0, 0.27, 0.24], { tex: 'plastic', rough: 0.42 });
    cowl.scale.set(0.92, 0.72, 0.86);
    car.add(cowl);
    car.add(torus(0.12, 0.022, CHROME, [0, 0.24, 0.3], { metal: 0.8, rough: 0.25, rotX: 0.35 }));
    [-1, 1].forEach((s) => car.add(ball(t, 0.032, 0xf2e4c0, [s * 0.1, 0.32, 0.28], { rough: 0.3, emissive: 0x3a3320 })));
    // tall curved back panel carrying the number roundel and two tail lamps
    car.add(box(t, [0.38, 0.26, 0.055], BODY, [0, 0.5, -0.32], { tex: 'plastic', repeat: [2, 1], rough: 0.42 }));
    car.add(cyl(t, 0.19, 0.19, 0.055, BODY, [0, 0.63, -0.32], { rotX: Math.PI / 2, tex: 'plastic', rough: 0.42, seg: 18 }));
    car.add(cyl(t, 0.085, 0.085, 0.02, 0xf0ece2, [0, 0.58, -0.35], { rotX: Math.PI / 2, rough: 0.5, seg: 18 })); // roundel
    car.add(cyl(t, 0.055, 0.055, 0.02, trim, [0, 0.58, -0.36], { rotX: Math.PI / 2, rough: 0.5, seg: 18 })); // car number disc
    [-1, 1].forEach((s) => car.add(ball(t, 0.026, 0xd8323a, [s * 0.14, 0.44, -0.34], { rough: 0.35, emissive: 0x5a0e12 }))); // tail lamps
    car.add(box(t, [0.4, 0.045, 0.5], trim, [0, 0.225, 0], { rough: 0.5 })); // waist trim line
    // cockpit: footwell floor, bucket seat with piping, dash and wheel
    car.add(cyl(t, 0.25, 0.25, 0.02, 0x14161a, [0, 0.36, 0.02], { rough: 0.8, seg: 18 }));
    car.add(box(t, [0.3, 0.05, 0.26], 0x3c5a5a, [0, 0.385, -0.1], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // seat pan (top 0.41 — the rider anchor)
    car.add(box(t, [0.3, 0.2, 0.055], 0x3c5a5a, [0, 0.5, -0.245], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // backrest
    [-1, 1].forEach((s) => car.add(box(t, [0.025, 0.2, 0.06], 0x2f4747, [s * 0.15, 0.5, -0.245], { rough: 0.9 }))); // backrest piping
    car.add(box(t, [0.3, 0.025, 0.03], 0x2f4747, [0, 0.6, -0.245], { rough: 0.9 })); // headroll
    car.add(box(t, [0.32, 0.11, 0.09], 0x16181d, [0, 0.44, 0.19], { rough: 0.7 })); // dash
    car.add(box(t, [0.3, 0.02, 0.03], CHROME, [0, 0.5, 0.185], { metal: 0.7, rough: 0.3 })); // dash chrome strip
    car.add(cyl(t, 0.018, 0.018, 0.15, 0x2b2b30, [0, 0.5, 0.13], { metal: 0.5, rough: 0.45, seg: 8, rotX: -0.75 })); // raked column
    const wheel = torus(0.072, 0.014, 0x1d1e23, [0, 0.55, 0.09], { rough: 0.5, rotX: -0.75 });
    car.add(wheel);
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * Math.PI * 2;
      const spoke = box(t, [0.014, 0.07, 0.012], 0x2b2b30, [0, 0.55, 0.09], { metal: 0.4, rough: 0.5 });
      spoke.rotation.set(-0.75, 0, a);
      spoke.position.set(Math.sin(a) * 0.035, 0.55 + Math.cos(a) * 0.026, 0.09 + Math.cos(a) * 0.026);
      car.add(spoke);
    }
    car.add(ball(t, 0.02, CHROME, [0, 0.55, 0.09], { metal: 0.7, rough: 0.3 })); // wheel hub
    // sprung pole: coil at the foot, mast, brace, and the contact shoe
    car.add(cyl(t, 0.055, 0.06, 0.04, 0x4a4d53, [0, 0.4, -0.375], { metal: 0.6, rough: 0.45, seg: 10 })); // pole foot plate
    for (let s = 0; s < 4; s++) car.add(torus(0.036, 0.009, 0x6f7278, [0, 0.44 + s * 0.026, -0.375], { metal: 0.6, rough: 0.4, seg: 6 })); // spring coil
    car.add(cyl(t, 0.018, 0.022, 1.18, 0x83868c, [0, 1.14, -0.375], { metal: 0.65, rough: 0.35, seg: 8 })); // mast
    car.add(cyl(t, 0.01, 0.01, 0.28, 0x83868c, [0, 0.66, -0.31], { metal: 0.6, rough: 0.4, seg: 6, rotX: 0.44 })); // brace back to the deck
    car.add(box(t, [0.12, 0.02, 0.08], 0x4a4d53, [0, 1.73, -0.375], { metal: 0.6, rough: 0.4 })); // contact shoe
    const contact = ball(t, 0.05, 0x66e0ff, [0, 1.76, -0.375], { emissive: 0x2288aa }); // brushing the ceiling grid
    (contact.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
    contactMats.push(contact.material as THREE.MeshStandardMaterial);
    car.add(contact);
    if (withRiders) {
      const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[i], seated: true });
      p.group.scale.setScalar(0.42);
      p.group.position.set(0, 0.16, -0.02);
      p.group.userData.lodDetail = true; // park runtime hides drivers beyond NEAR distance
      car.add(p.group);
      drivers.push(p.group);
    } else drivers.push(undefined);
    g.add(car);
    cars.push(car);
  }

  // ---- deterministic rink sim -------------------------------------------
  // Each car is a circle of radius R on the arena plane; the rubber ring
  // (r 0.41) is the visual footprint. Wall inner faces sit at |x|,|z| = 1.34
  // so centres live in the ±MAXC box. Fixed seed layout, hashed-sine waypoint
  // steering, dt clamped to 0.1 — reproducible, never Math.random.
  const R = 0.41; // collision radius = rubber-ring footprint
  const MAXC = 1.34 - R; // centre travel box (±0.93)
  const SPEED = 1.05; // cruise speed target
  const STEER = 3.2; // steering gain toward the wander waypoint
  const REST = 0.65; // car-car restitution (elastic-ish, satisfying jolt)
  const WALL_REST = 0.55; // wall bounce restitution
  const px: number[] = [], pz: number[] = [], vx: number[] = [], vz: number[] = [];
  const heading: number[] = [], kickT: number[] = [], kickA: number[] = [], kickX: number[] = [], kickZ: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.7; // fixed seed: ring layout, tangential launch
    px.push(Math.cos(a) * 0.6);
    pz.push(Math.sin(a) * 0.6);
    vx.push(-Math.sin(a) * 0.6);
    vz.push(Math.cos(a) * 0.6);
    heading.push(Math.atan2(-Math.sin(a), Math.cos(a)));
    kickT.push(-10); kickA.push(0); kickX.push(0); kickZ.push(1);
  }
  g.userData.simVehicles = cars; // numeric-probe hook (harness reads positions)
  g.userData.simRadius = R;
  g.userData.simBumps = 0; // car-car impacts so far (probe asserts >= 1)

  // FSM spin-down: cars glide to a stop while brokenDown/beingRepaired
  let speedK = 1;
  let speedTarget = 1;
  let lastT = 0;
  const onStateChange = (state: string) => {
    speedTarget = state === 'brokenDown' || state === 'beingRepaired' ? 0 : 1;
  };

  const kick = (i: number, nx: number, nz: number, amp: number, now: number) => {
    kickT[i] = now;
    kickA[i] = Math.min(1, amp);
    kickX[i] = nx;
    kickZ[i] = nz;
  };

  const update = (time: number, motionK = 1) => {
    // day -> night gate: ceiling string lights twinkle up after dark
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (1.55 + 0.15 * Math.sin(time * 4.2) - 0.15) * ease;
    gridLights.forEach((pl, i) => (pl.intensity = ease * (1.2 + 0.12 * Math.sin(time * 4.2 + i * 2))));

    const dt = Math.min(Math.max(time - lastT, 0), 0.1); // clamped like the GameManager
    lastT = time;
    speedK += (speedTarget - speedK) * Math.min(1, dt * 1.8);
    const driveK = speedK * motionK; // breakdown stop × station gate — same drift-to-rest

    // steer: each car chases its own hashed-sine waypoint roaming the arena —
    // the four tracks cross constantly, so cars meet and bump
    for (let i = 0; i < N; i++) {
      const tx = 0.72 * MAXC * Math.sin(time * 0.43 + i * 2.39 + Math.sin(time * 0.17 + i * 3.1));
      const tz = 0.72 * MAXC * Math.sin(time * 0.57 + i * 4.71 + Math.sin(time * 0.23 + i * 1.9));
      const dx = tx - px[i];
      const dz = tz - pz[i];
      const dl = Math.hypot(dx, dz) || 1;
      // mild neighbour avoidance so contacts stay DISCRETE jolts (cars swerve
      // off after a hit instead of grinding), still weak enough to keep the
      // waypoint tracks crossing and bumping
      let ax = dx / dl;
      let az = dz / dl;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const ox = px[i] - px[j];
        const oz = pz[i] - pz[j];
        const od = Math.hypot(ox, oz);
        if (od < 3 * R && od > 1e-6) {
          const w = ((3 * R - od) / (3 * R)) * 1.2;
          ax += (ox / od) * w;
          az += (oz / od) * w;
        }
      }
      const al = Math.hypot(ax, az) || 1;
      const want = SPEED * driveK;
      vx[i] += ((ax / al) * want - vx[i]) * Math.min(1, STEER * dt);
      vz[i] += ((az / al) * want - vz[i]) * Math.min(1, STEER * dt);
      const s = Math.hypot(vx[i], vz[i]);
      if (s > SPEED) {
        vx[i] *= SPEED / s;
        vz[i] *= SPEED / s;
      }
      px[i] += vx[i] * dt;
      pz[i] += vz[i] * dt;
      // arena wall: reflect off the boundary with a little restitution
      if (px[i] > MAXC) { px[i] = MAXC; if (vx[i] > 0) { kick(i, -1, 0, Math.abs(vx[i]), time); vx[i] *= -WALL_REST; } }
      if (px[i] < -MAXC) { px[i] = -MAXC; if (vx[i] < 0) { kick(i, 1, 0, Math.abs(vx[i]), time); vx[i] *= -WALL_REST; } }
      if (pz[i] > MAXC) { pz[i] = MAXC; if (vz[i] > 0) { kick(i, 0, -1, Math.abs(vz[i]), time); vz[i] *= -WALL_REST; } }
      if (pz[i] < -MAXC) { pz[i] = -MAXC; if (vz[i] < 0) { kick(i, 0, 1, Math.abs(vz[i]), time); vz[i] *= -WALL_REST; } }
    }
    // circle-circle collisions: positional correction + impulse along the
    // contact normal (equal masses, restitution REST) — O(n²) over 4 cars
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        let dx = px[j] - px[i];
        let dz = pz[j] - pz[i];
        let d = Math.hypot(dx, dz);
        if (d >= 2 * R) continue;
        if (d < 1e-6) { dx = 0.01; dz = 0.01 * (j - i); d = Math.hypot(dx, dz); } // deterministic degenerate split
        const nx = dx / d;
        const nz = dz / d;
        const push = (2 * R - d) / 2; // split the overlap
        px[i] -= nx * push; pz[i] -= nz * push;
        px[j] += nx * push; pz[j] += nz * push;
        const rel = (vx[i] - vx[j]) * nx + (vz[i] - vz[j]) * nz; // approach speed along n
        if (rel > 0) {
          const imp = ((1 + REST) * rel) / 2;
          vx[i] -= imp * nx; vz[i] -= imp * nz;
          vx[j] += imp * nx; vz[j] += imp * nz;
          kick(i, -nx, -nz, rel, time); // recoil tilt away from the contact
          kick(j, nx, nz, rel, time);
          if (rel > 0.15) g.userData.simBumps++; // count real hits, not residual grazing
        }
      }
    // drive the visuals
    for (let i = 0; i < N; i++) {
      const c = cars[i];
      c.position.set(px[i], 0.125, pz[i]); // rubber ring 0.005 into the floor top (0.145): contact, not coplanar
      const s = Math.hypot(vx[i], vz[i]);
      if (s > 0.05) {
        let dh = Math.atan2(vx[i], vz[i]) - heading[i];
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        heading[i] += dh * Math.min(1, dt * 7);
      }
      c.rotation.y = heading[i];
      // impact jolt: decaying body tilt along the (local-frame) hit normal,
      // driver whiplash, bumper-skirt + pole-contact flash
      const k = kickA[i] * Math.exp(-(time - kickT[i]) * 5.5);
      const ch = Math.cos(heading[i]);
      const sh = Math.sin(heading[i]);
      const lx = kickX[i] * ch - kickZ[i] * sh; // world hit normal -> car frame
      const lz = kickX[i] * sh + kickZ[i] * ch;
      c.rotation.x = 0.2 * k * lz;
      c.rotation.z = 0.2 * k * lx;
      const dr = drivers[i];
      if (dr) dr.rotation.x = -0.45 * k; // driver jerks with the hit
      skirtMats[i].emissiveIntensity = 1.4 * k;
      contactMats[i].emissiveIntensity = 0.6 + 2.5 * k;
    }
  };

  // per-seat transform so REGISTERED rides carry real GameManager guests: the
  // guest's group origin (feet) lands on the live car seat
  const _v = new t.Vector3();
  const _q = new t.Quaternion();
  const _e = new t.Euler();
  const seatWorld = (seat: number): [number, number, number, number] => {
    const c = cars[seat % N];
    c.updateWorldMatrix(true, false);
    _v.set(0, 0.16, -0.02).applyMatrix4(c.matrixWorld);
    c.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ');
    return [_v.x, _v.y, _v.z, _e.y];
  };

  // station gate: the rink sim's internal clock (and its clamped dt) is fed
  // the GATED clock, so cars sit PARKED while guests board and drift to a
  // stop for unloading — unified with the breakdown drift above.
  const gate = createMotionGate(update);
  const onStateChangeAll = (state: string) => {
    gate.onStateChange(state);
    onStateChange(state);
  };
  return { group: g, update: gate.update, seatWorld, vehicle: cars[0], onStateChange: onStateChangeAll };
}

export interface BumperCarsProps {
  /** decorative drivers (default: on standalone, off when `register`ed) */
  riders?: boolean;
}

/** <BumperCars> — composable ride (components/Park/Context.md): mounts the
 *  arena at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 2.6 out the local +z
 *  front (lane extending +z; the entrance hut then clears the arena wall at
 *  z 1.4), exit hut beside it at local [-2.1, 2.0], boarding at the floor.
 *  Real guests ride the bumping cars via `seatWorld`; clicking the arena opens
 *  the RideViewer with the onboard cam on car 0. Override with top-level
 *  props / `queue`. */
export const BumperCars = composableRide<BumperCarsProps>(
  'BumperCars',
  (t, props) => buildBumperCarsScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  {
    front: 2.6,
    exit: [-2.1, 2.0],
    board: [0, 0.25, 0],
    defaults: { name: 'Bumper Cars', capacity: 4, rideDuration: 9, intensity: 4, price: 3 },
  },
);
