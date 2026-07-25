import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { Stage, box, cyl, ball } from '../Stage';
import type { StageApi } from '../Stage';
import { buildTerrain } from '../TerrainKit';
import { buildWater } from '../WaterTile';
import { buildPathNetwork, snapNetToGrid } from '../PathNetwork';
import { attachWalkers } from '../PathWalkers';
import { buildRideSpline } from '../SplineRideKit';
import { buildCoasterCar } from '../CoasterCar';
import { buildParkEntrance } from '../ParkEntrance';
import { buildRestroom } from '../Restroom';
import { buildFountain } from '../Fountain';
import { buildTorch } from '../Torch';
import { buildScenery } from '../SceneryPack';
import { tree } from '../Kit';
import { createGameManager } from '../GameManager';
import { rideColourPreset } from '../ColorKit';
import type { RideColourScheme } from '../ColorKit';
import { RideViewer } from '../RideViewer';
import { GuestInfo } from '../GuestInfo';
import type { GuestInfoRecord } from '../GuestInfo';
import { ParkInfo } from '../ParkInfo';
import {
  parkComposition,
  tintTerrainForClimate,
  dressTerrain,
  terrainLint,
  planRideAccess,
  bermNetToGround,
  plinthUnder,
  groundRideAccess,
  validatePark,
  SIM_SMOKE_SECONDS,
  WATER_LEVEL,
  TILE,
  TERRAIN_BASE,
} from './index';

// ---------------------------------------------------------------------------
// THE WORKED EXAMPLE (rules/park-generation.md) — a small park HAND-COMPOSED
// the way the agent composes every park: explicit, literal calls in the
// recipe-book order, then validatePark as the acceptance gate. There is no
// park generator in this design system — every brief gets its own layout;
// this one is a compact temperate lakeside park (seed 7).
// ---------------------------------------------------------------------------

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const S = 16;
const SEED = 7;
const WL = WATER_LEVEL;
const G = TILE;

// ---- the street skeleton, authored ON the RCT2 lattice (nodes at multiples
// of 1.2, edges N/S/E/W): gate street → 3×3 plaza ring → a south avenue to
// the fairground spur + a west spur to the coaster queue tail --------------
const NODES: [number, number][] = [
  [0, 5 * G], // 0 gate
  [0, 4 * G], // 1 street
  [0, 3 * G], // 2 plaza N
  [G, 3 * G], // 3 ring NE
  [G, G], // 4 ring SE
  [0, G], // 5 plaza S
  [-G, G], // 6 ring SW
  [-G, 3 * G], // 7 ring NW
  [0, -2 * G], // 8 south avenue end
  [G, -2 * G], // 9 spinner queue tail
  [-2 * G, G], // 10 west spur
  [-2 * G, 2 * G], // 11 west spur north
  [-3 * G, 2 * G], // 12 coaster queue tail
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 2], // gate street + plaza ring
  [5, 8], [8, 9], // south avenue + fairground spur
  [6, 10], [10, 11], [11, 12], // west spur to the coaster
];
const PLAZA: [number, number, number, number] = [0, 2 * G, 3 * G, 3 * G];

// ---- the coaster, authored as LITERAL control points [x, yAboveRef, z]:
// a wooden circuit on the west strip hugging the hill cluster — N-S station
// straight, chain lift up the back edge, ridge run, one wide HIGH (slow)
// home turn, dead-straight dive back to the station. Heights ride ONE ground
// reference plane (§4); tuned to pass checkCoasterDesign + the 1.5 g guard.
const COASTER_PTS: [number, number, number][] = [
  [-5.06, 0.6, 2.0], // station straight, north end
  [-5.06, 0.6, 0.1], // station mid pin (keeps the spline dead flat)
  [-5.06, 0.6, -2.0], // station straight, south end
  [-5.32, 1.07, -2.89], // climb turning west (on the chain by here)
  [-6.63, 1.42, -3.44], // climb along the back edge
  [-7.38, 1.65, -2.89], // lift top
  [-7.48, 1.55, -2.01], // decisive step off the crest (locks the chain detect)
  [-7.33, 1.5, -0.78], // ridge run
  [-7.44, 0.9, 0.58], // drop bottom
  [-7.38, 0.95, 1.81], // pull-up northward along the west edge
  [-7.54, 1.2, 2.7], // climbing approach to the home turn
  [-7.54, 1.3, 3.62], // arc entry (ridden high + slow)
  [-7.27, 1.38, 4.2],
  [-6.74, 1.44, 4.57],
  [-6.06, 1.46, 4.65], // slow apex of the home turn
  [-5.44, 1.44, 4.38],
  [-5.14, 1.41, 3.98],
  [-5.04, 1.37, 3.55], // arc exit — heading dead south on the station line
  [-5.04, 1.1, 3.02], // straight-line dive, grade-legal
  [-5.05, 0.82, 2.52], // easing flat into the station approach
];
const DECK: [number, number] = [-4.31, 0]; // platform, east of the station rail
const PAD_SPINNER: [number, number] = [3 * G, -5 * G]; // fairground podium cell

export function buildExamplePark(t: typeof THREE, g: THREE.Group, validate: boolean) {
  const half = S / 2;
  const updaters: ((time: number) => void)[] = [];

  // ---- 1. terrain + climate: compose, probe, build, tint -------------------
  // guards = MY layout, so the probe rejects any terrain seed that would
  // sink, drown or bulge under what I am about to build
  const keepDry: [number, number][] = [
    ...NODES,
    ...EDGES.map(([a, b]) => [(NODES[a][0] + NODES[b][0]) / 2, (NODES[a][1] + NODES[b][1]) / 2] as [number, number]),
    DECK,
    PAD_SPINNER,
    [G, 4 * G], // kiosk cell
    [-G, 4 * G], // restroom cell
    [-3.6, 1.2], // coaster exit hut cell
    [2 * G, -3 * G], // spinner exit hut cell
    [-3.6, 5.53], [-3.6, 3.97], // coaster queue lane (anchor + midpoint)
    [1.2, -5.53], [1.2, -6.15], [1.2, -3.97], // spinner lane + hut
  ];
  const comp = parkComposition(t, SEED, S, 'temperate', { keepDry, coasterPts: COASTER_PTS });
  const terrain = buildTerrain(t, {
    size: S,
    seg: 110,
    seed: comp.terrainSeed,
    amplitude: TERRAIN_BASE.amplitude,
    scale: S * TERRAIN_BASE.scaleK,
    octaves: TERRAIN_BASE.octaves,
    roughness: TERRAIN_BASE.roughness,
    waterLevel: WL,
    peaks: [...comp.peaks, ...comp.clampPeaks], // guard post-enforcement discs ride along
    basins: [...comp.basins, ...comp.clampBasins],
    firmShore: true, // matches the composition probe — no stray noise puddles
  });
  tintTerrainForClimate(t, terrain.mesh, comp.climate, comp.basins, comp); // climate bias + zone paint
  g.add(terrain.mesh);
  const water = buildWater(t, S * 0.995, 120);
  water.mesh.position.y = WL;
  g.add(water.mesh);
  updaters.push(water.update);
  const groundAt = terrain.heightAt;
  const lint = terrainLint(groundAt, S, WL);
  const obstacles: { x: number; z: number; r: number }[] = [];

  // ---- 3. path skeleton: ONE level, berms close every gap ------------------
  const parkNet = snapNetToGrid({ nodes: NODES.map((n) => [...n] as [number, number]), edges: EDGES.map((e) => [...e] as [number, number]) }, G);
  let pathY = -Infinity;
  parkNet.nodes.forEach(([x, z]) => (pathY = Math.max(pathY, groundAt(x, z))));
  pathY += 0.03;
  const plazaY = pathY + 0.096; // PathNetwork's one-level plaza surface
  const net = buildPathNetwork(t, parkNet, { width: 1.1, y: pathY, groundAt, grid: true, plazas: [PLAZA] });
  g.add(net.group);
  updaters.push(net.update);
  updaters.push(attachWalkers(t, g, net, { count: 4 })); // BEFORE the manager
  bermNetToGround(t, g, parkNet, pathY, groundAt);
  obstacles.push({ x: PLAZA[0], z: PLAZA[1], r: 2.9 });

  // ---- 2. park entrance CENTRED on the flat apron (+z outside) -------------
  const gate = buildParkEntrance(t);
  gate.group.position.set(0, pathY + 0.03, 5 * G);
  g.add(gate.group);
  plinthUnder(t, g, groundAt, 0, 5 * G, 3.2, 1.2, pathY + 0.03);
  obstacles.push({ x: 0, z: 5 * G, r: 2.1 });

  // ---- 4a. the coaster (hills land): buildRideSpline + a wooden preset -----
  const woodScheme: RideColourScheme = rideColourPreset(SEED + 2, 'wooden');
  const gs = COASTER_PTS.map(([x, , z]) => groundAt(x, z)).sort((a, b) => a - b);
  const gRef = gs[Math.floor(gs.length * 0.8)]; // ONE ground reference plane
  const pts: [number, number, number][] = COASTER_PTS.map(([x, y, z]) => [x, Math.max(y + gRef + 0.05, groundAt(x, z) + 0.22, WL + 0.5), z]);
  const stY = Math.max(pts[0][1], pts[1][1], pts[2][1]); // level the station flat
  pts[0][1] = stY;
  pts[1][1] = stY;
  pts[2][1] = stY;
  const coaster = buildRideSpline(t, pts, {
    profile: 'coaster',
    type: 'wooden',
    bank: 0.2,
    supportEvery: 9,
    groundAt,
    colours: woodScheme.track,
    vehicleSchemes: woodScheme.vehicles,
  });
  g.add(coaster.group);
  const cars = (['front', 'middle', 'end'] as const).map((v) => buildCoasterCar(t, v, woodScheme.vehicles[0]));
  updaters.push(coaster.run(cars, { spacing: 1.2, speed: 0.95 }));
  // station platform deck EAST of the rail, boarding height, legs grounded
  const deckTop = stY - 0.05;
  {
    const gy = Math.max(groundAt(DECK[0], DECK[1]), WL + 0.2);
    g.add(box(t, [1.1, 0.16, 2.2], 0x5b432c, [DECK[0], stY - 0.13, DECK[1]], { tex: 'wood', repeat: [3, 6], rough: 0.9 }));
    [-0.9, 0.9].forEach((sz) => {
      const hp = stY - 0.19 - (gy - 0.3);
      g.add(box(t, [0.12, hp, 0.12], 0x5b432c, [DECK[0], gy - 0.3 + hp / 2, DECK[1] + sz], { tex: 'wood', rough: 0.95 }));
    });
    obstacles.push({ x: DECK[0], z: DECK[1], r: 1.8 });
  }

  // ---- 4b. one flat ride (fairground land): a spinner on a settled podium,
  // steel preset, seatWorld so boarded guests ride the live rotor -------------
  const steelScheme: RideColourScheme = rideColourPreset(SEED + 3, 'steel');
  const [px, pz] = PAD_SPINNER;
  const padTop = groundAt(px, pz) + 0.22;
  const spinnerGrp = new t.Group();
  const rotor = new t.Group();
  {
    const gy = groundAt(px, pz);
    spinnerGrp.add(cyl(t, 1.05, 1.2, padTop - (gy - 0.5), 0x9a978e, [px, (padTop + gy - 0.5) / 2, pz], { tex: 'concrete', repeat: [8, 1], rough: 0.95, seg: 24 }));
    spinnerGrp.add(cyl(t, 0.09, 0.13, 0.95, steelScheme.track.supports, [px, padTop + 0.47, pz], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 12 }));
    rotor.position.set(px, padTop + 0.95, pz);
    rotor.add(ball(t, 0.16, 0x3c4450, [0, 0, 0], { metal: 0.5, rough: 0.4 }));
    for (let k = 0; k < 2; k += 1) rotor.add(box(t, [0.1, 0.06, 2.0], steelScheme.track.main, [0, 0, 0], { tex: 'metal', metal: 0.6, rough: 0.4, rotY: k * Math.PI * 0.5 }));
    for (let k = 0; k < 4; k += 1) {
      const a = k * Math.PI * 0.5;
      rotor.add(box(t, [0.3, 0.2, 0.32], steelScheme.vehicles[0].body, [Math.sin(a) * 1.0, -0.12, Math.cos(a) * 1.0], { rough: 0.7 }));
    }
    spinnerGrp.add(rotor);
    g.add(spinnerGrp);
    obstacles.push({ x: px, z: pz, r: 1.9 });
    updaters.push((time) => {
      rotor.rotation.y = time * 0.9;
      rotor.position.y = padTop + 0.95 + Math.sin(time * 1.8) * 0.06;
    });
  }
  const spinnerSeat = (k: number): [number, number, number, number] => {
    const a = k * Math.PI * 0.5 + rotor.rotation.y;
    return [px + Math.sin(a), rotor.position.y - 0.28, pz + Math.cos(a), a];
  };

  // ---- 4c. a stall (kiosk mesh on the cell ABUTTING the gate street) -------
  const kioskXZ: [number, number] = [G, 4 * G];
  const kioskY = Math.max(pathY, groundAt(kioskXZ[0], kioskXZ[1]) + 0.02);
  {
    const k = new t.Group();
    k.position.set(kioskXZ[0], kioskY, kioskXZ[1]);
    k.rotation.y = Math.atan2(-1, 0); // serving front faces the street (west)
    const gk = groundAt(kioskXZ[0], kioskXZ[1]);
    const baseH = kioskY + 0.04 - (gk - 0.5);
    k.add(box(t, [1.32, baseH, 1.12], 0x9a978e, [0, 0.04 - baseH / 2, 0], { tex: 'concrete', repeat: [4, 2], rough: 0.95 }));
    k.add(box(t, [1.1, 0.78, 0.9], 0x5b432c, [0, 0.39, 0], { tex: 'wood', repeat: [4, 3], rough: 0.9 }));
    k.add(box(t, [1.16, 0.05, 0.22], 0x5b432c, [0, 0.6, 0.52], { tex: 'wood', repeat: [4, 1], rough: 0.85 }));
    for (let s = 0; s < 6; s += 1)
      k.add(box(t, [0.19, 0.03, 0.52], s % 2 === 0 ? 0x7d2e28 : 0xe8e2d2, [-0.48 + s * 0.192, 0.73, 0.66], { tex: 'fabric', repeat: [1, 2], rough: 0.9, rotX: 0.42 }));
    [-1, 1].forEach((s) => {
      const pb = Math.min(0, gk - kioskY) - 0.1;
      k.add(cyl(t, 0.018, 0.022, 0.64 - pb, 0x3f3a34, [s * 0.42, (0.64 + pb) / 2, 0.85], { tex: 'metal', metal: 0.4, rough: 0.5, seg: 8 }));
    });
    k.add(box(t, [1.2, 0.07, 1.0], 0x3f3a34, [0, 0.81, 0], { tex: 'wood', repeat: [4, 4], rough: 0.9 }));
    g.add(k);
    obstacles.push({ x: kioskXZ[0], z: kioskXZ[1], r: 1.3 });
  }

  // ---- 4d. amenities + flavour: restroom, fountain, torches, planters, bin --
  const restroom = buildRestroom(t);
  restroom.group.position.set(-G, pathY, 4 * G);
  restroom.group.rotation.y = Math.PI / 2; // doorway east, onto the gate street
  g.add(restroom.group);
  plinthUnder(t, g, groundAt, -G, 4 * G, 1.5, 1.3, pathY);
  obstacles.push({ x: -G, z: 4 * G, r: 1.2 });
  const fountain = buildFountain(t);
  fountain.group.scale.setScalar(0.45);
  fountain.group.position.set(PLAZA[0], plazaY, PLAZA[1]); // the plaza's centre tile
  g.add(fountain.group);
  updaters.push(fountain.update);
  ([[1.65, 4.05], [-1.65, 4.05]] as [number, number][]).forEach(([tx, tz]) => {
    const torch = buildTorch(t, { height: 1.5 });
    torch.group.position.set(tx, plazaY, tz); // plaza pavement corners
    g.add(torch.group);
    updaters.push(torch.update);
    obstacles.push({ x: tx, z: tz, r: 0.45 });
  });
  ([[1.65, 0.75], [-1.65, 0.75]] as [number, number][]).forEach(([sx, sz], i) => {
    const planter = buildScenery(t, 'planterBox', { scale: 0.85, seed: SEED + i });
    planter.position.set(sx, plazaY, sz);
    g.add(planter);
    obstacles.push({ x: sx, z: sz, r: 0.5 });
  });
  const binXZ: [number, number] = [1.5, 2 * G]; // east pavement, by the ring line
  g.add(cyl(t, 0.09, 0.08, 0.26, 0x24282c, [binXZ[0], plazaY + 0.13, binXZ[1]], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.6, seg: 12 }));
  g.add(cyl(t, 0.02, 0.095, 0.06, 0x24282c, [binXZ[0], plazaY + 0.29, binXZ[1]], { metal: 0.3, rough: 0.6, seg: 12 }));
  obstacles.push({ x: binXZ[0], z: binXZ[1], r: 0.4 });

  // ---- 5. ONE GameManager: same graph object, gate = SOLE spawn point ------
  const inPlaza = (x: number, z: number) => Math.abs(x - PLAZA[0]) <= PLAZA[2] / 2 && Math.abs(z - PLAZA[1]) <= PLAZA[3] / 2;
  const mgr = createGameManager(t, {
    groundAt: (x, z) => (inPlaza(x, z) ? plazaY : Math.max(groundAt(x, z), WL + 0.06)),
    net: parkNet, // the SAME object buildPathNetwork rendered
    laneY: pathY + 0.09,
    bins: [binXZ],
  });
  g.add(mgr.group);
  mgr.registerParkEntrance(gate); // guests appear at the gate and walk in

  // queue lanes planned ON the lattice: tails exactly on street nodes
  const accCoaster = planRideAccess(parkNet.nodes, 12, [0, -1], 3, [-3.6, 1.2], [1, 0]);
  const accSpinner = planRideAccess(parkNet.nodes, 9, [0, 1], 3, [2 * G, -3 * G], [0, 1]);
  const coasterHandle = mgr.registerRide({
    name: 'Wooden Coaster',
    capacity: 3,
    rideDuration: 9,
    loadTime: 2,
    intensity: 6,
    price: 6,
    vehicleHandle: { crashed: () => coaster.crashed() }, // crash wiring (§4)
    queueAnchor: [accCoaster.anchor[0], deckTop, accCoaster.anchor[1]],
    queueDir: accCoaster.dir,
    boardPoint: [DECK[0], stY - 0.02, DECK[1]],
    exitPoint: [accCoaster.exit[0], deckTop, accCoaster.exit[1]],
  });
  const spinnerHandle = mgr.registerRide({
    name: 'Spinner',
    capacity: 3,
    rideDuration: 6,
    loadTime: 1.6,
    intensity: 6,
    price: 4,
    seatWorld: spinnerSeat, // riders spin with the live rotor
    queueAnchor: [accSpinner.anchor[0], padTop, accSpinner.anchor[1]],
    queueDir: accSpinner.dir,
    boardPoint: [px, padTop + 0.1, pz],
    exitPoint: [accSpinner.exit[0], padTop, accSpinner.exit[1]],
  });
  // plinths + berms under huts and lanes (exit spots as AUDIT-RESOLVED)
  obstacles.push(...groundRideAccess(t, g, groundAt, accCoaster, deckTop, [coasterHandle.exitPoint()[0], coasterHandle.exitPoint()[2]]));
  obstacles.push(...groundRideAccess(t, g, groundAt, accSpinner, padTop, [spinnerHandle.exitPoint()[0], spinnerHandle.exitPoint()[2]]));
  mgr.registerStall({ name: 'Snack Kiosk', item: 'food', price: 3, value: 4, anchor: [kioskXZ[0], kioskY, kioskXZ[1]], dir: [-1, 0] });
  mgr.registerRestroom({ anchor: [-G, pathY, 4 * G], yaw: Math.PI / 2 });
  // clickability (rules/ui.md): rides carry their sim handle; the coaster
  // also carries a train car for RideViewer's onboard cam
  coaster.group.userData.rideRef = coasterHandle;
  coaster.group.userData.rideVehicle = cars[0];
  spinnerGrp.userData.rideRef = spinnerHandle;
  mgr.spawnGuests(10);

  // ---- scenery LAST, with the legality lint (§5): dressTerrain plants the
  // sections (forest/mountain/beach), then trees by seeded rejection ---------
  const distToPaths = (x: number, z: number) => {
    let best = Infinity;
    for (const [a, b] of parkNet.edges) {
      const [ax, az] = parkNet.nodes[a];
      const [bx, bz] = parkNet.nodes[b];
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
      best = Math.min(best, Math.hypot(ax + dx * u - x, az + dz * u - z));
    }
    return best;
  };
  const distToCoaster = (x: number, z: number) => {
    let best = Infinity;
    for (let i = 0; i < pts.length; i += 1) {
      const [ax, , az] = pts[i];
      const [bx, , bz] = pts[(i + 1) % pts.length];
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
      best = Math.min(best, Math.hypot(ax + dx * u - x, az + dz * u - z));
    }
    return best;
  };
  const clear = (x: number, z: number, r: number) =>
    lint.inBounds(x, z) && lint.isDry(x, z) && distToPaths(x, z) > 1.25 && distToCoaster(x, z) > 1.6 && !obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
  // the composition's sections dress themselves: forest tree clusters,
  // mountain outcrops + scree, beach dunes/palms — deterministic, clear of
  // keepDry cells, the coaster envelope and every obstacle disc above
  const dressed = dressTerrain(t, comp, groundAt, { obstacles });
  g.add(dressed.group);
  obstacles.push(...dressed.obstacles);
  // ...then a hand pass adds park trees near the streets (dressing keeps off
  // the lattice entirely — these fill the built-up middle ground)
  let planted = 0;
  for (let i = 0; i < 140 && planted < 12; i += 1) {
    const x = (hash01(SEED * 31 + i * 2 + 1) - 0.5) * (S - 2.2);
    const z = (hash01(SEED * 31 + i * 2 + 2) - 0.5) * (S - 2.2);
    if (!clear(x, z, 0.6) || lint.slopeAt(x, z) > 0.8) continue;
    const nearHill = comp.peaks.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius * 1.05);
    const shape = nearHill ? 'pine' : hash01(SEED * 31 + i * 2 + 3) < 0.35 ? 'pine' : 'round';
    const tr = tree(t, { shape, scale: 0.5 + hash01(SEED * 31 + i * 2 + 4) * 0.38 });
    tr.position.set(x, groundAt(x, z) - 0.08, z);
    tr.rotation.y = hash01(SEED * 31 + i * 2 + 5) * Math.PI * 2;
    g.add(tr);
    obstacles.push({ x, z, r: 0.6 });
    planted += 1;
  }

  // ---- 7. validatePark — the acceptance gate. The park does not "open"
  // until this reports ok: true. The smoke run fast-forwards the sim clock,
  // so the returned updater shifts time to stay monotonic. -------------------
  let tShift = 0;
  let report: ReturnType<typeof validatePark> | null = null;
  if (validate) {
    report = validatePark(t, {
      net: parkNet,
      manager: mgr,
      terrain: { heightAt: groundAt, waterLevel: WL, size: S, peaks: comp.peaks },
      coasters: [{ points: pts, type: 'wooden', bank: 0.2 }],
      group: g,
      rebuild: () => {
        const g2 = new t.Group();
        buildExamplePark(t, g2, false); // MUST rebuild with validation off
        return g2;
      },
    });
    tShift = SIM_SMOKE_SECONDS + 1 / 30;
    console.log('[ExamplePark] validatePark →', report.ok ? 'ok: true' : JSON.stringify(report.failures, null, 1));
    report.failures.forEach((f) => console.warn(`[ExamplePark] validatePark FAIL [${f.check}] ${f.detail}`));
  }

  // ---- 6. one combined updater ----------------------------------------------
  let lastT = 0;
  const update = (time: number) => {
    const dt = time - lastT;
    lastT = time;
    const tt = time + tShift;
    updaters.forEach((u) => u(tt));
    mgr.update(tt, dt);
  };
  return { update, manager: mgr, heightAt: groundAt, validation: report };
}

// ---------------------------------------------------------------------------
// Preview component: the example park on the shared Stage with the full
// UI-window suite (rules/ui.md) — click a ride → RideViewer (the coaster
// offers the onboard cam), click a guest → live GuestInfo, ParkInfo
// bottom-right. Camera holds still (no auto-rotate).
// ---------------------------------------------------------------------------

type Mgr = ReturnType<typeof createGameManager>;
type Pick_ =
  | { kind: 'ride'; handle: ReturnType<Mgr['registerRide']>; vehicle?: THREE.Object3D }
  | { kind: 'guest'; accessor: () => GuestInfoRecord & { gone?: boolean } };

export function ExamplePark() {
  const [api, setApi] = useState<StageApi | null>(null);
  const [manager, setManager] = useState<Mgr | null>(null);
  const [picked, setPicked] = useState<Pick_ | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (picked?.kind !== 'guest') return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [picked]);
  const guestRec = picked?.kind === 'guest' ? picked.accessor() : null;
  useEffect(() => {
    if (guestRec?.gone) setPicked(null);
  }, [guestRec?.gone]);

  return (
    <div style={{ position: 'relative', height: 620 }}>
      <Stage
        distance={19}
        targetY={0.7}
        height={620}
        background="#a8cdd9"
        ground={false}
        autoRotate={false}
        build={(t, g, stageApi) => {
          const park = buildExamplePark(t, g, true);
          setManager(park.manager);
          if (stageApi) {
            setApi(stageApi);
            stageApi.setGroundSampler?.(park.heightAt); // camera never clips terrain
            stageApi.setCameraPose?.([4.2, 15.2, -14], [0, 0.4, 0.6]); // open on the gate-front view
            stageApi.onPick?.((obj) => {
              const ud = obj.userData as {
                rideRef?: ReturnType<Mgr['registerRide']>;
                rideVehicle?: THREE.Object3D;
                guestRef?: () => GuestInfoRecord & { gone?: boolean };
              };
              if (ud.rideRef) setPicked({ kind: 'ride', handle: ud.rideRef, vehicle: ud.rideVehicle });
              else if (ud.guestRef) setPicked({ kind: 'guest', accessor: ud.guestRef });
            });
          }
          return park.update;
        }}
      />
      {api && picked?.kind === 'ride' && <RideViewer ride={picked.handle} api={api} vehicle={picked.vehicle} onClose={() => setPicked(null)} />}
      {api && guestRec && !guestRec.gone && <GuestInfo guest={guestRec} onClose={() => setPicked(null)} />}
      {api && manager && <ParkInfo manager={manager} api={api} />}
    </div>
  );
}

const previews = {
  componentName: 'ParkBuilder',
  importPath: 'components/ParkBuilder',
  previews: [
    {
      name: 'Hand-composed example park',
      description:
        'The worked example of the compose-then-validate workflow (rules/park-generation.md): parkComposition seeds a temperate lakeside landform, then explicit literal calls build terrain + water, the gate on the flat apron, a lattice street skeleton with a fountain plaza, a wooden spline coaster hugging the hills, a spinner podium, a snack kiosk, a restroom, torches and planting — everything registers with ONE GameManager (the gate is the sole spawn) and validatePark gates the opening (report logged to the console).',
      render: () => <ExamplePark />,
    },
  ],
};

export default previews;
