import React from 'react';
import * as THREE from 'three';
import { box, cyl, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { computeSplineFrames } from '../SplineCoaster';
import { compileTrackPieces, ribbon, railTube } from '../SplineRideKit';
import type { TrackPiece, TrackStationPose } from '../SplineRideKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// A chunky BOXY WHITE monorail with a tall band of amber (lit) windows in dark
// frames, a magenta belt stripe, roof plant and a bevelled cab nose — gliding on
// an elevated concrete beam with piers. Default: the classic 7-unit shuttle beam
// (byte-identical to the original). With `pieces` the beam follows a
// compileTrackPieces circuit instead and the train becomes a LOOP glider —
// articulated cars riding the closed spline at constant speed.
//
// LIVERY: the original matched the RCT2 MONO1 sprite literally (#f07020 orange
// body, #401000 frames). The ride is now WHITE — the real-world transit livery,
// and the one the park was asked for — with the magenta kept as the single
// accent line, because a white body with no stripe reads as unpainted plastic
// and the magenta is the one note of the sprite worth keeping. The platform
// canopies, the fascia stripe and the station elevator all take the SAME three
// colours, so the ride reads as one fleet rather than a white train parked under
// an orange roof.
const BODY = 0xf4f2ec; // body — warm white, never pure #fff (it would clip in sun)
const BODY_D = 0xd8d5cc; // shaded white: skirt, roof, canopies
const ACCENT = 0xd6338c; // the belt / skirt stripe
const FRAME = 0x2a2c30; // window frames, door leaves
const AMBER = 0xe8b040; // lit windows
const STEEL = 0x9aa0a8; // grab rails, bumpers, roof plant
const GLASS = 0x7f96a8; // cab windscreen (does NOT glow — only the saloon does)
const TAIL_RED = 0xc4342a; // tail lamps

/** monorails must NOT ramp up and down: lift/drop/hill are removed outright
 *  and a helix keeps its flat arc but loses any `height` — one console.warn
 *  per stripped piece, naming it. The beam vocabulary is horizontal:
 *  station/straight/turnL/turnR/sbend (+ flat helix arcs). */
function stripVerticalPieces(pieces: TrackPiece[]): TrackPiece[] {
  const out: TrackPiece[] = [];
  pieces.forEach((p, i) => {
    const d = typeof p === 'string' ? { type: p } : p;
    if (d.type === 'lift' || d.type === 'drop' || d.type === 'hill') {
      console.warn(`Monorail: stripped vertical piece '${d.type}' (piece ${i}) — monorail beams stay level`);
      return;
    }
    if ((d.type === 'helixL' || d.type === 'helixR') && (d.height ?? 0) !== 0) {
      console.warn(`Monorail: stripped the height off '${d.type}' (piece ${i}) — monorail beams stay level (kept the flat arc)`);
      const { height: _h, ...flat } = d;
      out.push(flat);
      return;
    }
    out.push(p);
  });
  return out;
}

interface MonorailLightMats {
  paneMats: { emissiveIntensity: number }[];
  headMats: { emissiveIntensity: number }[];
  headLights: { intensity: number }[];
}

/** One monorail car, geometry relative to the beam CENTRELINE at `beamY`
 *  (the original shuttle passes 1.2; the loop glider passes 0 and lets the
 *  spline frame place the car). `nose` grows the bevelled cab at -z / +z;
 *  `gasket` bridges to the car in front (rigid shuttle train only).
 *
 *  BATCHED BY MATERIAL (2026-07). The car used to be ~22 loose meshes, each
 *  with its own MeshStandardMaterial — fine for one shuttle, ruinous now that
 *  `trains` can put FOUR three-car trains on a beam (12 cars). Every part is a
 *  box, so they collect into six buckets and merge into six meshes per car:
 *  ~264 draws for a full fleet became ~96, which is what paid for the detail
 *  below. Only the head/tail lamps stay separate — they carry their own
 *  emissive materials and the night gate drives them individually.
 *
 *  The saloon PANES are one merged emissive mesh per car rather than ten, so
 *  the day→night gate now updates one material per car instead of ten. */
function buildMonorailCar(
  t: typeof THREE,
  beamY: number,
  lights: MonorailLightMats,
  opts: { nose?: -1 | 1 | null; gasket?: boolean; seats?: THREE.Group[] } = {},
): THREE.Group {
  const car = new t.Group();
  const y = beamY + 0.42;
  const bodyB: MergedBoxSpec[] = []; // white
  const shadeB: MergedBoxSpec[] = []; // shaded white — skirt, roof
  const accentB: MergedBoxSpec[] = []; // magenta stripes
  const frameB: MergedBoxSpec[] = []; // dark frames, doors, vent grilles
  const steelB: MergedBoxSpec[] = []; // rails, bumpers, roof plant
  const paneB: MergedBoxSpec[] = []; // amber saloon glass (ONE emissive mesh)
  const glassB: MergedBoxSpec[] = []; // cab windscreens (never lit)

  // 2 seat anchors INSIDE the enclosed cabin (seatWorld) — REAL GameManager
  // guests ride behind the amber window band, RCT2-style
  if (opts.seats)
    [-0.25, 0.25].forEach((sz) => {
      const seat = new t.Group();
      seat.position.set(0, beamY + 0.1, sz);
      car.add(seat);
      opts.seats!.push(seat);
    });

  // ---- straddle skirt hugging the beam ------------------------------------
  shadeB.push({ dims: [0.56, 0.3, 1.06], pos: [0, beamY + 0.08, 0], repeat: [2, 1] });
  accentB.push({ dims: [0.58, 0.05, 1.08], pos: [0, beamY + 0.2, 0] }); // skirt stripe
  // GUIDE-WHEEL housings: the bulges that make a straddle-beam bogie read as
  // gripping the beam instead of hovering beside it. Four per car, at the
  // quarter points, embedded 0.01 into the skirt face.
  [-1, 1].forEach((sx) =>
    [-0.34, 0.34].forEach((wz) => frameB.push({ dims: [0.05, 0.13, 0.2], pos: [sx * 0.285, beamY + 0.05, wz] })),
  );

  // ---- body ---------------------------------------------------------------
  bodyB.push({ dims: [0.6, 0.52, 1.1], pos: [0, y, 0], repeat: [3, 1] });
  accentB.push({ dims: [0.61, 0.035, 1.06], pos: [0, y - 0.2, 0] }); // BELT stripe under the glass

  // ---- window band, both sides -------------------------------------------
  // frame strip + amber panes with PILLARS between them, a sliding DOOR in a
  // proper frame with a threshold step, and a small number plate
  [-0.305, 0.305].forEach((x, side) => {
    frameB.push({ dims: [0.012, 0.3, 1.0], pos: [x, y + 0.06, 0] }); // glazing strip
    for (let wz = -0.38; wz <= 0.38; wz += 0.19) {
      paneB.push({ dims: [0.016, 0.24, 0.14], pos: [x, y + 0.06, wz] });
      // PILLAR between this pane and the next — the vertical rhythm a bus-like
      // slab of glass is missing
      if (wz < 0.37) frameB.push({ dims: [0.018, 0.28, 0.05], pos: [x, y + 0.06, wz + 0.095] });
    }
    frameB.push({ dims: [0.02, 0.42, 0.2], pos: [x, y - 0.04, 0] }); // door leaf over the centre bay
    // door FRAME: two jambs + a head, so the leaf sits in an opening
    [-0.115, 0.115].forEach((dz) => frameB.push({ dims: [0.026, 0.44, 0.03], pos: [x, y - 0.04, dz] }));
    frameB.push({ dims: [0.026, 0.03, 0.26], pos: [x, y + 0.19, 0] });
    steelB.push({ dims: [0.024, 0.03, 0.16], pos: [x, y - 0.1, 0] }); // door handle rail
    steelB.push({ dims: [0.05, 0.025, 0.2], pos: [x + (side ? 0.02 : -0.02), y - 0.27, 0] }); // threshold step
    bodyB.push({ dims: [0.014, 0.07, 0.13], pos: [x, y - 0.27, side ? 0.42 : -0.42] }); // number plate
  });

  // ---- roof + plant -------------------------------------------------------
  shadeB.push({ dims: [0.56, 0.07, 1.04], pos: [0, y + 0.29, 0] }); // overlaps the body top (no air gap)
  // ROOF PLANT, kept LIGHT. The first pass put a dark steel AC box and two
  // full-width dark grilles up here, and from the park's overhead camera that
  // is most of what you see of the train: the render came back with a white
  // body under a near-black roof. The shroud is now shaded white like the rest
  // of the roof and only its grille is steel, so the roof still reads white
  // with equipment ON it.
  [-0.31, 0.31].forEach((vz) => frameB.push({ dims: [0.22, 0.035, 0.1], pos: [0, y + 0.33, vz] })); // vent grilles set into the roof
  shadeB.push({ dims: [0.32, 0.07, 0.28], pos: [0, y + 0.35, 0] }); // AC / traction shroud on the roof centre
  steelB.push({ dims: [0.24, 0.02, 0.2], pos: [0, y + 0.392, 0] }); // …and its grille
  [-1, 1].forEach((sx) => steelB.push({ dims: [0.018, 0.026, 0.88], pos: [sx * 0.235, y + 0.335, 0] })); // roof walkway rails

  // ---- bevelled cab nose --------------------------------------------------
  // nose bottom clears the beam top; windscreen, board and headlight sit ON the
  // slope (proud, ends embedded)
  if (opts.nose) {
    const s = opts.nose;
    const tilt = s * 0.35;
    bodyB.push({ dims: [0.58, 0.46, 0.24], pos: [0, y - 0.01, s * 0.6], rotX: tilt });
    frameB.push({ dims: [0.4, 0.16, 0.04], pos: [0, y + 0.08, s * 0.76], rotX: tilt }); // windscreen surround
    glassB.push({ dims: [0.35, 0.12, 0.03], pos: [0, y + 0.075, s * 0.775], rotX: tilt }); // …and its glass
    // WIPERS on the screen, and a lit DESTINATION BOARD above it
    [-0.09, 0.09].forEach((wx) => steelB.push({ dims: [0.012, 0.08, 0.012], pos: [wx, y + 0.02, s * 0.79], rotX: tilt }));
    frameB.push({ dims: [0.26, 0.07, 0.03], pos: [0, y + 0.2, s * 0.62], rotX: tilt });
    paneB.push({ dims: [0.22, 0.04, 0.026], pos: [0, y + 0.2, s * 0.632], rotX: tilt });
    steelB.push({ dims: [0.52, 0.05, 0.07], pos: [0, y - 0.24, s * 0.6] }); // bumper across the nose foot
    const head = cyl(t, 0.05, 0.05, 0.03, AMBER, [0, y - 0.18, s * 0.67], { emissive: 0x8a5a10, rotX: Math.PI / 2, seg: 10 });
    car.add(head);
    lights.headMats.push(head.material as unknown as { emissiveIntensity: number });
    const hl = new t.PointLight(0xffd9a0, 0, 3, 2);
    hl.position.set(0, y - 0.18, s * 0.85);
    car.add(hl);
    lights.headLights.push(hl);
    // TAIL LAMPS on the same end — a real cab carries both, and on the loop
    // glider the rear car's cab is what a following guest actually sees
    const tail = new t.Mesh(
      new t.BoxGeometry(0.3, 0.035, 0.03),
      new t.MeshStandardMaterial({ color: TAIL_RED, emissive: 0x6a1410, emissiveIntensity: 0.2, roughness: 0.5 }),
    );
    tail.position.set(0, y - 0.11, s * 0.7);
    car.add(tail);
    lights.headMats.push(tail.material as unknown as { emissiveIntensity: number });
    // an aerial, on the head end only
    if (s > 0) steelB.push({ dims: [0.012, 0.16, 0.012], pos: [0.16, y + 0.42, -0.3] });
  }

  // inter-car gasket (rigid shuttle only — loop cars articulate)
  if (opts.gasket) frameB.push({ dims: [0.5, 0.44, 0.16], pos: [0, y, -0.58] }); // bridges the 0.1 gap, 0.01 embedded in BOTH car faces

  // ---- merge ---------------------------------------------------------------
  car.add(mergedBoxes(t, bodyB, BODY, { tex: 'plastic', rough: 0.42 }));
  car.add(mergedBoxes(t, shadeB, BODY_D, { tex: 'plastic', rough: 0.5 }));
  car.add(mergedBoxes(t, accentB, ACCENT, { rough: 0.5 }));
  car.add(mergedBoxes(t, frameB, FRAME, { rough: 0.68 }));
  car.add(mergedBoxes(t, steelB, STEEL, { tex: 'metal', metal: 0.7, rough: 0.32 }));
  if (glassB.length) car.add(mergedBoxes(t, glassB, GLASS, { rough: 0.15, metal: 0.2 }));
  // the saloon glass: ONE emissive material per car, which is what the night
  // gate raises (see gateLights)
  const panes = mergedBoxes(t, paneB, AMBER, { emissive: 0x8a5a10, rough: 0.4 });
  car.add(panes);
  lights.paneMats.push(panes.material as unknown as { emissiveIntensity: number });
  return car;
}

/** the boarding PLATFORM at one compiled `station` deck: a paved island beside
 *  the beam with railings, a canopy and a pier tower down to grade. Elevated
 *  monorail stations are how RCT2 draws them, and the deck has to READ as
 *  somewhere a guest gets on — an unmarked stretch of beam does not.
 *  `left` points at the ring INTERIOR on the §4.2 circuit, so the platform,
 *  its canopy and the stair tower all land inside the ring, never out on the
 *  apron where the queue would have to come from off-plot.
 *
 *  Returns the group, a per-frame hook (the two ELEVATORS' cars ride up and
 *  down and have to be driven every frame) and `place` — a re-pose of the
 *  vertical cores against the entrance/exit hut coordinates the GameManager
 *  actually resolved, which is not knowable at build time. */
function buildStationDeck(
  t: typeof THREE,
  st: { center: [number, number, number]; length: number; dir: [number, number]; left: [number, number]; yaw: number },
): { group: THREE.Group; update?: (time: number) => void; place: (entXZ: [number, number], exitXZ: [number, number]) => void } {
  const g = new t.Group();
  const [cx, cy, cz] = st.center;
  // THE DECK OVERRUNS THE TRAIN, and by more than it used to. At +1.2 the
  // island was 3.8 long, and the two huts (which land 1.2 apart in the middle
  // of it) left no pair of SYMMETRIC slots on its back shoulder that both
  // cleared them — one lift always ended up shunted onto a deck end, mirroring
  // nothing. +2.2 makes it 4.8, which is exactly enough for the two lift slots
  // at `hutMid ± 1.5` to sit on the island rather than overhang it. A longer
  // platform is also the truer read: a real transit deck is several car-lengths.
  const L = st.length + 2.2;
  const W = 0.9; // island width, beside the beam
  const off = 0.62; // beam half-width 0.21 + island half 0.45 − a 0.04 overlap
  const [lx, lz] = st.left;
  const px = cx + lx * off;
  const pz = cz + lz * off;
  // the deck slab, its kerb lip and the platform-edge safety line
  g.add(box(t, [W, 0.12, L], 0xb9b3a6, [px, cy - 0.36, pz], { rotY: st.yaw, tex: 'concrete', repeat: [2, 6], rough: 0.9 }));
  g.add(box(t, [W + 0.06, 0.05, L + 0.06], 0x8a8578, [px, cy - 0.43, pz], { rotY: st.yaw, tex: 'concrete', rough: 0.95 }));
  g.add(box(t, [0.1, 0.02, L], 0xe8b040, [cx + lx * 0.24, cy - 0.29, cz + lz * 0.24], { rotY: st.yaw, rough: 0.6 })); // yellow edge line
  // back railing + two end railings (the beam side is deliberately OPEN — that
  // is the boarding edge) and a canopy on four posts
  const back = off + W / 2 - 0.03;
  g.add(box(t, [0.06, 0.5, L], 0x4a4e55, [cx + lx * back, cy - 0.05, cz + lz * back], { rotY: st.yaw, tex: 'metal', metal: 0.6, rough: 0.4 }));
  [-1, 1].forEach((e) => {
    g.add(
      box(t, [W, 0.5, 0.06], 0x4a4e55, [px + st.dir[0] * e * (L / 2), cy - 0.05, pz + st.dir[1] * e * (L / 2)], {
        rotY: st.yaw,
        tex: 'metal',
        metal: 0.6,
        rough: 0.4,
      }),
    );
    [-1, 1].forEach((sd) => {
      const ax = px + st.dir[0] * e * (L / 2 - 0.2) + lx * sd * (W / 2 - 0.1);
      const az = pz + st.dir[1] * e * (L / 2 - 0.2) + lz * sd * (W / 2 - 0.1);
      g.add(cyl(t, 0.045, 0.045, 1.05, 0x9aa0a8, [ax, cy + 0.23, az], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 8 }));
    });
  });
  g.add(box(t, [W + 0.3, 0.08, L + 0.2], BODY_D, [px, cy + 0.78, pz], { rotY: st.yaw, tex: 'plastic', rough: 0.5 })); // canopy
  g.add(box(t, [W + 0.34, 0.05, 0.06], ACCENT, [px, cy + 0.72, pz + 0], { rotY: st.yaw, rough: 0.5 })); // fascia stripe
  // ---- THE THREE VERTICAL CORES --------------------------------------------
  // Stairs, an ENTRANCE lift and an EXIT lift. Each is built about its own
  // origin and POSED afterwards, because where they belong is a function of
  // where the GameManager put the huts — which the compiler does not know at
  // build time. `layout` below is the default; `place` re-runs it against the
  // real hut coordinates once <ConfigurableRide> has them (see `onAccessPlaced`).
  const H = Math.max(0.6, cy - 0.42);
  const stairs = buildStationStair(t, H);
  const liftIn = buildStationLift(t, H); // serves the ENTRANCE hut
  const liftOut = buildStationLift(t, H); // serves the EXIT hut
  // numeric-probe hooks — harness/park-eval/probe-monorail-access.mjs asserts
  // these against the resolved hut rects rather than re-deriving the offsets
  stairs.group.userData.monorailCore = 'stairs';
  liftIn.group.userData.monorailCore = 'liftIn';
  liftOut.group.userData.monorailCore = 'liftOut';
  g.add(stairs.group, liftIn.group, liftOut.group);

  /** deck frame → world xz. `along` runs down the deck from its centre,
   *  `across` out along `left` (the ring interior) from the beam centreline. */
  const at = (along: number, across: number): [number, number] => [
    cx + st.dir[0] * along + lx * across,
    cz + st.dir[1] * along + lz * across,
  ];
  /** stand a core at (along, across), its boarding face turned to `[fAlong,
   *  fAcross]` — the deck-frame unit that points AT the deck */
  const pose = (o: THREE.Object3D, along: number, across: number, f: [number, number]) => {
    const [wx, wz] = at(along, across);
    o.position.set(wx, 0, wz);
    o.rotation.y = Math.atan2(st.dir[0] * f[0] + lx * f[1], st.dir[1] * f[0] + lz * f[1]);
  };
  // WHERE THE CORES GO, AND WHY IT IS NOT "DIRECTLY BEHIND EACH HUT".
  // Measured on the reference park (`harness/park-eval/probe-monorail-access.mjs`),
  // the huts land at across 1.17 — pressed right up under the deck overhang,
  // with the island's own outboard edge at 1.07. There is NO clear ground
  // directly behind a hut. What there is, is the deck's back SHOULDER: across
  // 1.35, tangent to the island and inboard of the queue HEAD at 1.79, so a
  // core there is out of the lane.
  //
  // THE TWO LIFTS ARE MIRROR IMAGES about the midpoint of the hut pair, at the
  // SAME across and the same distance out — `hutMid ± LIFT_SET`. That is the
  // whole point of the +2.2 deck overrun above: at ±1.5 each shaft clears its
  // hut by 0.08 u and both still land on a 4.8-u island. An earlier pass put
  // the entrance lift on the shoulder and shunted the exit lift onto a deck
  // END, which cleared everything and mirrored nothing.
  const SHOULDER = 1.35;
  const LIFT_SET = 1.5; // half the gap between the two lifts, about the hut midpoint
  const ENDSET = L / 2 + 0.45; // just clear of the deck end, bridging back in
  const layout = (entAlong: number, exitAlong: number) => {
    const sE = Math.sign(entAlong - exitAlong) || -1; // deck-ward sense of "the entrance end"
    const mid = (entAlong + exitAlong) / 2;
    pose(liftIn.group, mid + sE * LIFT_SET, SHOULDER, [0, -1]); // outboard of the ENTRANCE hut
    pose(liftOut.group, mid - sE * LIFT_SET, SHOULDER, [0, -1]); // …and its mirror at the EXIT
    pose(stairs.group, sE * ENDSET, off, [-sE, 0]); // stairs take the deck end behind the entrance
  };
  // the §4.2 arithmetic's own answer (entrance on the deck centre, exit one
  // 1.2-u tile along it) until `onAccessPlaced` supplies the measured truth
  layout(0, 1.2);
  /** re-pose the cores from the REAL hut positions, in the component's local xz */
  const place = (entXZ: [number, number], exitXZ: [number, number]) => {
    const alongOf = ([qx, qz]: [number, number]) => (qx - cx) * st.dir[0] + (qz - cz) * st.dir[1];
    layout(alongOf(entXZ), alongOf(exitXZ));
  };
  const update = (time: number) => {
    liftIn.update(time);
    liftOut.update(time);
  };
  return { group: g, update, place };
}

/** THE STAIR CORE — a concrete tower with switchback flights and a landing that
 *  bridges onto the deck. Built about its own origin (+z at the deck) for the
 *  same reason the lift is: `buildStationDeck` decides where it stands only
 *  after it knows where the huts are. Batched into three meshes. */
function buildStationStair(t: typeof THREE, H: number): { group: THREE.Group } {
  const g = new t.Group();
  const flights: MergedBoxSpec[] = [];
  for (let k = 0; k < 7; k += 1) flights.push({ dims: [0.5, 0.035, 0.16], pos: [0, (H * (k + 0.5)) / 7, -0.24 + (k % 2) * 0.48] });
  g.add(mergedBoxes(t, [{ dims: [0.62, H, 0.62], pos: [0, H / 2, 0], repeat: [2, 4] }], 0xb9b3a6, { tex: 'concrete', rough: 0.9 }));
  g.add(mergedBoxes(t, flights, 0x9aa0a8, { tex: 'metal', metal: 0.4, rough: 0.6 }));
  g.add(
    mergedBoxes(
      t,
      [
        { dims: [0.66, 0.06, 0.66], pos: [0, H + 0.03, 0] }, // landing
        { dims: [0.42, 0.05, 0.36], pos: [0, H + 0.02, 0.49] }, // bridge onto the deck
      ],
      0x8a8578,
      { tex: 'concrete', rough: 0.95 },
    ),
  );
  return { group: g };
}

/** THE STATION ELEVATOR — a glazed shaft from a ground-level lobby up to the
 *  platform landing, with a car that actually rides it.
 *
 *  BUILT ABOUT ITS OWN ORIGIN. It used to be authored straight into world xz
 *  (`x`, `z` and a `toDeck` unit, mapped out through an `at()` helper), which
 *  meant a shaft could only ever be positioned at build time — and the shaft
 *  that shipped was positioned wrong: it stood in the QUEUE LANE MOUTH,
 *  squarely in front of the entrance hut, capping the lane and hiding the
 *  ENTRANCE sign (measured in `harness/park-eval/probe-monorail-access.mjs`:
 *  lift across 1.97 from the beam centreline vs the queue HEAD at 1.79 and the
 *  hut at 1.17). A lift whose pose is a caller's decision can be MOVED once the
 *  GameManager has told us where the huts actually landed — see `onAccessPlaced`.
 *
 *  Local frame: origin on the ground at the shaft centre, +z pointing at the
 *  deck (the boarding face, and the side the landing bridge spans), +x its
 *  right hand. The caller sets `group.position` / `group.rotation.y`.
 *
 *  `H` is the landing height above grade. Deterministic: the car's height is a
 *  pure function of the scene clock (dwell → rise → dwell → descend).
 *
 *  BATCHED. Every static part is a box in one of three materials, so they merge
 *  into three meshes instead of the fifteen the old loose-mesh version cost —
 *  which is what pays for there now being TWO lifts per platform (entrance and
 *  exit) rather than one. Only the glazing (transparent) and the car (it moves)
 *  stay separate. */
function buildStationLift(t: typeof THREE, H: number): { group: THREE.Group; update: (time: number) => void } {
  const g = new t.Group();
  const S = 0.54; // shaft outside width
  const GLASSC = 0x9fc4d8;
  const STEELC = 0x8f959d;
  const shaftTop = H + 0.34; // headroom above the landing for the winch house
  /** the three faces that are NOT the boarding side, as local unit normals */
  const walls: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, -1],
  ];
  // ---- the steel: four corner columns + the call post's plate ---------------
  const steel: MergedBoxSpec[] = [];
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => steel.push({ dims: [0.06, shaftTop, 0.06], pos: [sx * (S / 2), shaftTop / 2, sz * (S / 2)] })),
  );
  g.add(mergedBoxes(t, steel, STEELC, { tex: 'metal', metal: 0.7, rough: 0.35 }));
  g.add(cyl(t, 0.03, 0.03, 0.7, STEELC, [S / 2 + 0.16, 0.43, S / 2 - 0.06], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 8 })); // call post
  // ---- the glazing between the columns. The DECK side stays OPEN — that is
  // the boarding face, and the landing bridge passes through it.
  const glassGeoms: MergedBoxSpec[] = walls.map(([nx, nz]) => ({
    dims: [nx !== 0 ? 0.03 : S, shaftTop - 0.1, nz !== 0 ? 0.03 : S] as [number, number, number],
    pos: [nx * (S / 2), (shaftTop - 0.1) / 2, nz * (S / 2)] as [number, number, number],
  }));
  const glass = mergedBoxes(t, glassGeoms, GLASSC, { rough: 0.12, metal: 0.1 });
  (glass.material as THREE.MeshStandardMaterial).transparent = true;
  (glass.material as THREE.MeshStandardMaterial).opacity = 0.32;
  g.add(glass);
  // ---- the white livery: winch house on top (the SAME white the cars carry,
  // so the station and the fleet read as one ride)
  g.add(mergedBoxes(t, [{ dims: [S + 0.12, 0.16, S + 0.12], pos: [0, shaftTop + 0.08, 0] }], BODY_D, { tex: 'plastic', rough: 0.5 }));
  g.add(box(t, [S + 0.16, 0.05, 0.06], ACCENT, [0, shaftTop + 0.01, 0], { rough: 0.5 })); // fascia stripe
  // ---- the concrete: the ground LOBBY pad the run starts from, and the
  // LANDING BRIDGE that carries the top of the run onto the deck
  g.add(
    mergedBoxes(
      t,
      [
        { dims: [S + 0.5, 0.08, S + 0.5], pos: [0, 0.04, 0], repeat: [2, 2] },
        { dims: [0.42, 0.05, 0.36], pos: [0, H + 0.02, S / 2 + 0.16] },
      ],
      0xb9b3a6,
      { tex: 'concrete', rough: 0.92 },
    ),
  );
  g.add(box(t, [0.11, 0.14, 0.05], 0x2a2a2e, [S / 2 + 0.16, 0.8, S / 2 - 0.06], { rough: 0.6 })); // call plate

  // ---- THE CAR -------------------------------------------------------------
  // Built about its own FLOOR (y = 0) so the update below can drive the floor
  // height directly: 0.09 rests it on the lobby pad, H + 0.045 lands it flush
  // with the bridge.
  const car = new t.Group();
  const CH = 0.62; // car height
  const CW = S - 0.12; // car width, clear of the columns
  car.add(box(t, [CW, 0.04, CW], 0x4a4e55, [0, 0, 0], { tex: 'metal', metal: 0.5, rough: 0.5 })); // floor
  car.add(
    mergedBoxes(
      t,
      [
        { dims: [CW, 0.04, CW], pos: [0, CH, 0] }, // roof
        ...walls.map(([nx, nz]) => ({
          dims: [nx !== 0 ? 0.03 : CW, CH - 0.06, nz !== 0 ? 0.03 : CW] as [number, number, number],
          pos: [nx * (CW / 2), CH / 2, nz * (CW / 2)] as [number, number, number],
        })),
      ],
      BODY,
      { tex: 'plastic', rough: 0.47 },
    ),
  );
  car.add(box(t, [CW - 0.08, 0.03, CW - 0.08], AMBER, [0, CH - 0.05, 0], { emissive: 0x8a5a10, rough: 0.4 })); // cabin light
  g.add(car);

  // dwell → rise → dwell → descend, on a fixed 15.4 s cycle. Smoothstepped at
  // both ends so the car eases off the floor and settles at the landing rather
  // than snapping between levels.
  const DWELL = 3.4;
  const TRAVEL = 4.3;
  const CYCLE = 2 * (DWELL + TRAVEL);
  const yBottom = 0.09; // car FLOOR resting on the lobby pad
  const yTop = H + 0.045; // car floor flush with the landing bridge
  const update = (time: number) => {
    const p = ((time % CYCLE) + CYCLE) % CYCLE;
    let k: number;
    if (p < DWELL) k = 0;
    else if (p < DWELL + TRAVEL) k = (p - DWELL) / TRAVEL;
    else if (p < 2 * DWELL + TRAVEL) k = 1;
    else k = 1 - (p - 2 * DWELL - TRAVEL) / TRAVEL;
    const e = k * k * (3 - 2 * k); // smoothstep
    car.position.y = yBottom + (yTop - yBottom) * e;
  };
  update(0);
  return { group: g, update };
}

export function buildMonorailScene(
  three: typeof THREE,
  opts: { pieces?: TrackPiece[]; beamY?: number; loopSeconds?: number; speed?: number; trains?: number } = {},
): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  /** fatal pieces compile — <ConfigurableRide> skips registration (parity with
   *  LogFlume/RiverRapids/Bobsleigh, which already report this) */
  invalid?: boolean;
  /** ADDITIVE: one pose per compiled `station` deck (SplineRideKit
   *  `report.stations`). A MULTI-STATION monorail publishes them so a park can
   *  check the platform coordinates it authored against the ones the compiler
   *  actually produced instead of trusting arithmetic. */
  stationPoses?: TrackStationPose[];
  /** ADDITIVE: tell the ride where the GameManager put each platform's
   *  entrance and exit hut (WORLD xz, station order) so the station's stair
   *  core and its two lifts can be posed around them instead of guessed at */
  onAccessPlaced: (stations: { entrance: [number, number]; exit: [number, number] }[]) => void;
} {
  const group = new three.Group();
  const extras: { invalid?: boolean; stationPoses?: TrackStationPose[] } = {};
  /** one TRAIN on the circuit: its three cars, its offset into the shared
   *  TIMETABLE, and its head car's live curve parameter. Trains on one beam
   *  differ ONLY by that offset, which is the whole reason a fleet stays
   *  evenly spaced for ever instead of bunching. */
  interface TrainCtl {
    cars: THREE.Group[];
    /** seconds this train runs AHEAD of train 0 on the timetable */
    phase: number;
    /** how far along the beam the head car is, in units (read by `nearestTrain`) */
    arc: number;
  }
  /** the running gear the ride-FSM hooks talk to.
   *
   *  THE TRAINS DO NOT RUN ON THE RIDE FSM. They used to: each train waited for
   *  a `departing` edge, ran one leg on the motion gate's GATED clock and then
   *  parked until the next edge. Measured on the reference park's four-platform
   *  ring, that left every train STILL for 69.7% of the time, in stalls up to
   *  30.8 s, averaging 0.226 u/s against a 0.9 u/s cruise — and because the FSM
   *  cycles on its own `rideDuration` timer while a real 47-u leg takes ~52 s at
   *  a walking-ish cruise, the ride's idea of which platform it was at drifted
   *  free of where the train actually was within the first minute.
   *
   *  A monorail is a TRANSPORT ride: RCT2 runs it as a timetable, not as a
   *  per-guest cycle — the trains circulate whether or not anybody is waiting
   *  (`ride/Vehicle.Station.cpp:598-605` departs an empty platform on the
   *  max-wait timer alone). So the fleet now runs on its OWN clock at a
   *  constant cruise with a short dwell at each platform, and the FSM keeps
   *  what it is actually good at: queues, boarding, unloading and breakdowns. */
  const loopCtl: {
    nStops: number;
    trains: TrainCtl[];
    /** the platform the ride FSM is at, MIRRORED — see `onStateChange` */
    fsmStation: number;
    /** riders' seat anchors resolve into THIS train (latched while empty) */
    boardTrain: number;
    /** eased 1 → 0 while the ride is broken down or crashed; nothing else ever
     *  slows the fleet */
    haltK: number;
    haltTarget: number;
    /** which train is nearest to a given platform, installed by the loop branch */
    nearestTrain: ((station: number) => number) | null;
  } = { nStops: 1, trains: [], fsmStation: 0, boardTrain: 0, haltK: 1, haltTarget: 1, nearestTrain: null };
  /** per-frame hooks for the PLATFORMS (their elevators). Driven off the RAW
   *  clock, deliberately: a station lift that freezes exactly when a train is
   *  in — i.e. exactly when guests are getting on and off — is the one moment
   *  it must be running. Station infrastructure is not vehicle motion. */
  const deckHooks: ((time: number) => void)[] = [];
  /** one per compiled platform, in the same order: re-pose that deck's stair
   *  core and its two lifts against the REAL hut coordinates. See `onAccessPlaced`. */
  const deckPlacers: ((entXZ: [number, number], exitXZ: [number, number]) => void)[] = [];
  /** the hut coordinates <ConfigurableRide> handed us, in WORLD xz, waiting for
   *  a frame in which the group's world matrix is known to be current */
  let pendingAccess: { entrance: [number, number]; exit: [number, number] }[] | null = null;
  const seatAnchors: THREE.Group[] = []; // per train: 3 cars × 2 cabin anchors (seatWorld)
  let vehicle: THREE.Object3D | undefined; // the train (loop: head car) — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const lights: MonorailLightMats = { paneMats: [], headMats: [], headLights: [] };
        const gateLights = (time: number) => {
          // day -> night gate: cabin windows glow, headlights come on
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          lights.paneMats.forEach((m) => (m.emissiveIntensity = 0.2 + (1.1 - 0.2) * ease));
          lights.headMats.forEach((m) => (m.emissiveIntensity = 0.15 + (1.3 - 0.15) * ease));
          lights.headLights.forEach((pl) => (pl.intensity = ease * 0.8));
          void time;
        };

        if (opts.pieces) {
          // ---- PIECE-COMPOSED LOOP: beam follows the compiled circuit ----
          // compileTrackPieces auto-closes the loop and runs the validators;
          // monorail beams stay LEVEL — vertical pieces are stripped with a
          // warn — and banking is capped tiny like the real straddle beam
          // THE DEFAULT IS THE PARK-SCALE HEIGHT, not the shuttle's 1.2. A
          // piece-composed circuit is by definition the park-spanning ride, and
          // at 1.2 its soffit sits 1.05 u up — BELOW validatePark's 2.2-u
          // overfly gate, so it blocks every street it crosses. 3.6 puts the
          // soffit 3.45 up: 3.36 over a footpath slab and 1.35 over a stall
          // canopy, where 2.6 left only 0.35 over the canopy and 0.16 of margin
          // on the gate itself. RCT2's own monorail tops out at height 8
          // (`ride/rtd/transport/Monorail.h`), so this is not near any ceiling.
          // The shuttle (no `pieces`) is untouched at 1.2.
          const beamY = opts.beamY ?? 3.6;
          const compiled = compileTrackPieces(stripVerticalPieces(opts.pieces), { profile: 'monorail', start: [0, beamY, 0] });
          const fb = computeSplineFrames(t, compiled.points, { bank: 0.08, bankGain: 0.4 });
          g.userData.trackReport = compiled.report;
          if (compiled.report.fatal) extras.invalid = true; // an illegal circuit never registers as a real ride
          // concrete beam: 4 swept ribbons (top/bottom/sides) — same 0.42 ×
          // 0.3 section as the shuttle beam — plus the side power-rail tubes
          const beamMat = mat(t, 0xc4c9d1, { tex: 'concrete', repeat: [2, 22], rough: 0.85 });
          beamMat.side = t.DoubleSide;
          g.add(ribbon(t, fb.frames, -0.21, 0.15, 0.21, 0.15, beamMat));
          g.add(ribbon(t, fb.frames, -0.21, -0.15, 0.21, -0.15, beamMat));
          [-1, 1].forEach((s) => {
            g.add(ribbon(t, fb.frames, s * 0.21, -0.15, s * 0.21, 0.15, beamMat));
            g.add(railTube(t, fb.frames, s * 0.225, 0.1, 0.022, mat(t, 0x4a4e55, { tex: 'metal', repeat: [1, 30], metal: 0.6, rough: 0.4 })));
          });
          // piers + footer pads down to the ground, every ~10 samples
          for (let i = 0; i < fb.N; i += 10) {
            const f = fb.frames[i];
            const h = f.p.y - 0.15;
            if (h < 0.25) continue;
            g.add(cyl(t, 0.14, 0.2, h, 0x9aa0a8, [f.p.x, h / 2, f.p.z], { tex: 'concrete', repeat: [2, 2], rough: 0.9, seg: 12 }));
            g.add(box(t, [0.52, 0.08, 0.52], 0x8a8578, [f.p.x, 0.04, f.p.z], { tex: 'concrete', repeat: [2, 2], rough: 0.95 }));
          }
          // ---- THE PLATFORMS ----------------------------------------------
          // one deck per compiled `station` piece. `report.stations` is the
          // kit's own list of them (SplineRideKit TrackStationPose), so this is
          // never guesswork about where along the beam a platform sits.
          const stationPoses = compiled.report.stations;
          stationPoses.forEach((st) => {
            const deck = buildStationDeck(t, st);
            g.add(deck.group);
            if (deck.update) deckHooks.push(deck.update); // the platform ELEVATORS — ungated, see deckHooks
            deckPlacers.push(deck.place); // re-posed once the huts are known
          });
          extras.stationPoses = stationPoses;
          loopCtl.nStops = Math.max(1, stationPoses.length);

          const CARS_PER_TRAIN = 3;
          const SPACING = 1.25;
          const m = new t.Matrix4();
          // ---- ARC LENGTH, NOT CURVE PARAMETER ----------------------------
          // Everything below positions trains by DISTANCE ALONG THE BEAM, and
          // that is not a stylistic choice. The old code advanced `u` (the 0..1
          // curve parameter) at a constant rate and treated `u · total` as
          // metres — but `computeSplineFrames` samples through
          // `CatmullRomCurve3.getPointAt`, whose arc-length table is built at
          // three.js's default 200 divisions while the frames are 320, so the
          // sample spacing is uniform only to a few percent. Driving `u` at a
          // constant rate therefore produced a cruise that breathed between
          // 0.853 and 0.950 u/s round a lap — measured, and the one remaining
          // source of "the speed isn't consistent" once the freezing was gone.
          // A cumulative chord table over the frames we ACTUALLY draw removes
          // it: the path is a closed polyline, so its arc length is exact.
          const cum = new Float64Array(fb.N + 1);
          for (let i = 0; i < fb.N; i += 1) cum[i + 1] = cum[i] + fb.frames[i].p.distanceTo(fb.frames[(i + 1) % fb.N].p);
          const arcTotal = cum[fb.N];
          /** distance along the beam → curve parameter, by binary search */
          const uOfArc = (d: number) => {
            const x = ((d % arcTotal) + arcTotal) % arcTotal;
            let lo = 0;
            let hi = fb.N;
            while (hi - lo > 1) {
              const mid = (lo + hi) >> 1;
              if (cum[mid] <= x) lo = mid;
              else hi = mid;
            }
            const seg = cum[lo + 1] - cum[lo];
            return (lo + (seg > 1e-9 ? (x - cum[lo]) / seg : 0)) / fb.N;
          };
          // ---- WHERE THE TRAINS STOP --------------------------------------
          // The distance along the beam of each platform CENTRE, found by
          // scanning the frames once at build time. A multi-station transport
          // ride must park AT a platform: RCT2 brakes into every station piece
          // unconditionally (ride/Vehicle.TrackMotion.cpp:433 →
          // ride/Vehicle.Station.cpp:1503-1511, :1720-1724), and its train sits
          // there through waitingForPassengers/unloading.
          const stopArc = stationPoses.map((st) => {
            let best = 0;
            let bestD = Infinity;
            for (let i = 0; i < fb.N; i += 1) {
              const f = fb.frames[i];
              const d = (f.p.x - st.center[0]) ** 2 + (f.p.z - st.center[2]) ** 2;
              if (d < bestD) {
                bestD = d;
                best = cum[i];
              }
            }
            return best;
          });
          // WHERE A TRAIN PARKS. The head car leads and the other two trail it
          // at `SPACING` each, so parking the HEAD on the platform centre would
          // leave two thirds of the train hanging off the approach end — the
          // "stops a little ahead" read. A braked train sits CENTRED on its
          // platform, so the head parks half a train-length PAST the centre.
          const trainHalf = (SPACING * (CARS_PER_TRAIN - 1)) / 2;
          const stopHead = stopArc.map((sa) => (sa + trainHalf) % arcTotal);
          // SPEED. This used to be `total / (loopSeconds · 0.8)` — a LOOP TIME,
          // which means the speed is whatever the circuit length happens to
          // make it: a park-spanning loop at the default 12 s came out over
          // 10 u/s, twenty times a guest's walking pace, and two monorails of
          // different sizes ran at completely different speeds. A monorail is a
          // TRANSPORT ride and RCT2 paces it by velocity, so this is a flat
          // cruise in units/second, identical on every circuit; the gate
          // envelope still eases it away from and into each platform, which is
          // the only speed variation there should be.
          //
          // The cruise itself is now a SLOW one. 2.0 u/s was still four times a
          // guest's walking pace (locomotion.ts `speedOf` runs ~0.5) and read as
          // a train being fired between platforms rather than a sightseeing
          // shuttle idling across the park. CRUISE_SLOW is a shade under twice
          // walking pace — quick enough to be transport, slow enough that you
          // can follow a car with your eye the whole way. `loopSeconds` is still
          // honoured for layouts tuned against it, but CAPPED at CRUISE_MAX with
          // a warn: a short loop time on a park-spanning circuit is exactly the
          // way the old bug came back.
          const CRUISE_SLOW = 0.9;
          const CRUISE_MAX = 1.6;
          const CRUISE = Math.max(0.25, opts.speed ?? CRUISE_SLOW);
          let V = CRUISE;
          if (opts.loopSeconds !== undefined && stopArc.length > 1) {
            const want = arcTotal / (Math.max(2, opts.loopSeconds) * 0.8);
            if (want > CRUISE_MAX) {
              console.warn(
                `Monorail: loopSeconds=${opts.loopSeconds} over a ${arcTotal.toFixed(1)} u circuit asks for ${want.toFixed(
                  1,
                )} u/s — clamped to ${CRUISE_MAX} u/s. A monorail is a transport ride and cruises at a walking-ish pace; pass \`speed\` to set the velocity directly instead of a loop time`,
              );
            }
            V = Math.min(want, CRUISE_MAX);
          }

          // ---- THE TIMETABLE ----------------------------------------------
          // The circuit as a repeating SCHEDULE rather than a per-guest cycle:
          // dwell DWELL seconds at platform i, run leg i to platform i+1 at the
          // constant cruise V, repeat. One number describes the whole thing —
          // `cycleT`, a full lap including its dwells — and that is what makes a
          // FLEET trivial: train k simply reads the same schedule `k·cycleT/n`
          // seconds ahead, so the spacing is exact, permanent and needs no
          // inter-train logic at all.
          const nStops = stopHead.length;
          const DWELL = nStops ? 2.4 : 0; // a bare ring with no platform never stops
          // the run of each leg in BEAM UNITS, stop i → stop i+1. One platform
          // (or none) is a single leg the whole way round.
          const legLen = nStops
            ? stopHead.map((sa, i) => (nStops === 1 ? arcTotal : ((stopHead[(i + 1) % nStops] - sa + arcTotal) % arcTotal) || arcTotal))
            : [arcTotal];
          // A leg is CRUISE WITH EASED ENDS: RAMP seconds of smoothstepped
          // acceleration off the platform and the same braking into the next
          // one, flat cruise in between — a train that snapped from 0 to full
          // speed at a platform edge would read as a teleport, and RCT2 brakes
          // into every station piece. ∫smoothstep over [0,1] = ½, so a ramp
          // covers half the ground full speed would; hence `legLen/V + RAMP`.
          const legRamp = legLen.map((L) => Math.min(1.2, (L / V) * 0.2));
          const legT = legLen.map((L, i) => L / V + legRamp[i]);
          const stopsN = Math.max(1, nStops);
          const cycleT = legT.reduce((a, b) => a + b, 0) + stopsN * DWELL;
          /** distance covered `x` seconds into leg `i`. ∫(3p²−2p³) = p³ − p⁴/2. */
          const legDist = (i: number, x: number) => {
            const R = legRamp[i];
            const S = (p: number) => p * p * p - (p * p * p * p) / 2;
            if (R > 1e-6 && x < R) return V * R * S(x / R);
            const tail = legT[i] - R;
            if (R > 1e-6 && x >= tail) return legLen[i] - V * R * S(Math.max(0, Math.min(1, (legT[i] - x) / R)));
            return 0.5 * V * R + V * (x - R);
          };
          /** how far along the beam a train is, `tau` seconds into the timetable */
          const arcAt = (tau: number) => {
            let x = ((tau % cycleT) + cycleT) % cycleT;
            for (let i = 0; i < stopsN; i += 1) {
              const base = nStops ? stopHead[i] : 0;
              if (x < DWELL) return base;
              x -= DWELL;
              if (x < legT[i]) return base + legDist(i, x);
              x -= legT[i];
            }
            return nStops ? stopHead[0] : 0;
          };

          // ---- HOW MANY TRAINS --------------------------------------------
          // RCT2 runs SEVERAL trains on one circuit (`ride.numTrains`,
          // ride/Ride.cpp), spaced around it so a guest at any platform has one
          // coming. A fleet is the NORM for a park-spanning transport ride, not
          // an opt-in, so the default is now the platform count (up to 4)
          // instead of a lone train crawling a 200-u ring — one visible train on
          // a circuit that takes three and a half minutes to lap reads as a
          // broken ride. They are spaced in TIME on the shared timetable, which
          // is why the old "never more trains than platforms" clamp is gone:
          // two trains dwelling at the same platform at the same moment is
          // impossible by construction. What IS possible is packing them so
          // tightly that a dwelling train is rear-ended by the next one, so the
          // cap is a real HEADWAY — a train length plus 1.5 u of clear beam,
          // plus the dwell the leader spends standing still.
          const TRAIN_LEN = SPACING * (CARS_PER_TRAIN - 1);
          const headway = DWELL + (TRAIN_LEN + 1.5) / V;
          const roomFor = Math.max(1, Math.floor(cycleT / headway));
          const defTrains = nStops > 1 ? Math.min(4, nStops) : arcTotal >= 40 ? 2 : 1;
          let nTrains = Math.max(1, Math.min(6, Math.round(opts.trains ?? defTrains)));
          if (nTrains > roomFor) {
            console.warn(
              `Monorail: ${nTrains} trains asked for on a ${arcTotal.toFixed(1)} u circuit that laps in ${cycleT.toFixed(
                0,
              )} s — clamped to ${roomFor}. Trains are spaced ${(cycleT / nTrains).toFixed(1)} s apart at ${nTrains}, under the ${headway.toFixed(
                1,
              )} s headway a ${TRAIN_LEN.toFixed(1)} u train needs to clear the one dwelling ahead of it`,
            );
            nTrains = roomFor;
          }
          const trains: TrainCtl[] = Array.from({ length: nTrains }, (_, ti) => {
            // seat anchors go in TRAIN ORDER, so seats 0..5 are one train's
            // cabins and a park that raises `capacity` past six spills the extra
            // riders into the NEXT train rather than double-seating this one.
            const cars = [0, 1, 2].map((i) =>
              buildMonorailCar(t, 0, lights, { nose: i === 0 ? 1 : i === 2 ? -1 : null, seats: seatAnchors }),
            );
            cars.forEach((c) => g.add(c));
            const phase = (ti * cycleT) / nTrains;
            return { cars, phase, arc: arcAt(phase) };
          });
          loopCtl.trains = trains;
          // which train a boarding guest is put in: the one with the shortest
          // FORWARD run to the platform the FSM is at — "the next one in".
          loopCtl.nearestTrain = (station: number) => {
            if (!nStops) return 0;
            const target = stopHead[Math.max(0, Math.min(nStops - 1, station))];
            let best = 0;
            let bestD = Infinity;
            trains.forEach((tr, i) => {
              const d = ((target - tr.arc) % arcTotal + arcTotal) % arcTotal; // forward run to the platform
              if (d < bestD) {
                bestD = d;
                best = i;
              }
            });
            return best;
          };
          vehicle = trains[0].cars[0];
          g.userData.trainCars = trains[0].cars; // numeric-probe hook (harness measures the TRAIN CENTRE, not the head car)
          g.userData.monorailTrains = trains.map((tr) => tr.cars);
          // the timetable, published for the harness (probe-monorail-motion /
          // park-eval probe-monorail-timetable)
          g.userData.monorailTimetable = { cycleT, cruise: V, dwell: DWELL, stops: nStops, trains: nTrains, length: arcTotal };
          return (time: number, motionK = 1) => {
            gateLights(time);
            // `time` is the RAIL CLOCK (see `tick`): a plain integral of real
            // time, scaled ONLY by the breakdown brake. Not the motion gate's
            // clock — the fleet's dwells are the timetable's, not the FSM's.
            void motionK;
            trains.forEach((tr) => {
              tr.arc = arcAt(time + tr.phase);
              // the trailing cars sit `SPACING` BEHIND ALONG THE BEAM, which is
              // only the same thing as a fixed step in `u` on a perfectly
              // uniform parameterisation — see the arc-length note above
              tr.cars.forEach((c, i) => {
                const f = fb.frameAt(uOfArc(tr.arc - i * SPACING));
                c.position.copy(f.p);
                m.makeBasis(f.side, f.up, f.fwd);
                c.setRotationFromMatrix(m);
              });
            });
          };
        }

        // ---- DEFAULT: the classic 7-unit shuttle (unchanged behaviour) ----
        const RUN = 7;
        const beamY = 1.2;
        // beam + piers (power-rail strips break up the flat concrete faces;
        // each pier lands on a concrete footer pad instead of bare grass)
        g.add(box(t, [0.42, 0.3, RUN], 0xc4c9d1, [0, beamY, 0], { tex: 'concrete', repeat: [2, 22], rough: 0.85 }));
        [-0.22, 0.22].forEach((x) => g.add(box(t, [0.02, 0.07, RUN], 0x4a4e55, [x, beamY + 0.02, 0], { tex: 'metal', repeat: [1, 30], metal: 0.6, rough: 0.4 }))); // side power rails
        for (let z = -3.1; z <= 3.3; z += 1.6) {
          g.add(cyl(t, 0.14, 0.2, beamY, 0x9aa0a8, [0, beamY / 2, z], { tex: 'concrete', repeat: [2, 2], rough: 0.9, seg: 12 }));
          g.add(box(t, [0.52, 0.08, 0.52], 0x8a8578, [0, 0.04, z], { tex: 'concrete', repeat: [2, 2], rough: 0.95 })); // footer pad
        }

        const train = new t.Group();
        g.add(train);
        vehicle = train;
        for (let i = 0; i < 3; i++) {
          const car = buildMonorailCar(t, beamY, lights, {
            nose: i === 0 ? -1 : i === 2 ? 1 : null,
            gasket: i > 0,
            seats: seatAnchors,
          });
          car.position.z = (i - 1) * 1.2;
          train.add(car);
        }
        return (time: number, motionK = 1) => {
          gateLights(time);
          // shuttle glide: cab noses reach +/-3.49 and stay on the +/-3.5 beam the whole
          // cycle (the old wrap sent the train fully off the beam end into mid-air).
          // The gate envelope eases it back to the beam CENTRE (the station) to park.
          train.position.z = Math.sin(time * 0.8) * 1.5 * motionK;
        };
      })(three, group) || undefined;
  /** TRUE when `pieces` put the ride on a compiled circuit — the fleet then
   *  runs the timetable on its own rail clock, and the FSM's motion gate is
   *  bypassed entirely. The default SHUTTLE keeps the gate: it is a single
   *  vehicle at a single platform, where parking for boarding IS correct. */
  const railed = !!opts.pieces;
  // station gate (SHUTTLE ONLY): the train parks at the beam centre while
  // guests board/unload — spinDown 0.9 so it is at rest before
  // 'unloadingPassengers' begins
  const gate = createMotionGate((tt, k) => update?.(tt, k), { spinDown: 0.9 });
  /** the RAIL CLOCK — real time, integrated, scaled only by the breakdown
   *  brake. This is what makes the cruise CONSTANT: nothing in the guest sim
   *  can slow it, speed it up or stop it except a ride that is actually out of
   *  service. */
  let railClock = 0;
  let lastRaw = -1;
  let stateNow = 'init';
  let stateAt = 0;
  /** the ride's per-frame tick: the platforms first on the RAW clock, then the
   *  vehicles — through the timetable (loop) or the motion gate (shuttle) */
  const tick = (time: number) => {
    // APPLY A PENDING ACCESS PLACEMENT. Deliberately deferred to the first
    // frame rather than done inside `onAccessPlaced`: the caller is
    // <ConfigurableRide>, which registers the ride the moment it has a handle,
    // and at that point there is no promise that this group has been added to
    // the scene — `worldToLocal` on an unmounted group silently returns the
    // world coordinates unchanged, which would put every lift 40 u off the
    // beam. By the first tick the graph is mounted, so the transform is real.
    if (pendingAccess) {
      const list = pendingAccess;
      pendingAccess = null;
      group.updateWorldMatrix(true, false);
      const v = new three.Vector3();
      const toLocal = (p: [number, number]): [number, number] => {
        v.set(p[0], 0, p[1]);
        group.worldToLocal(v);
        return [v.x, v.z];
      };
      list.forEach((a, i) => deckPlacers[i]?.(toLocal(a.entrance), toLocal(a.exit)));
    }
    deckHooks.forEach((h) => h(time));
    if (!railed) {
      gate.update(time);
      return;
    }
    const dt = lastRaw < 0 ? 0 : Math.max(0, Math.min(0.25, time - lastRaw));
    lastRaw = time;
    // A BREAKDOWN is the one thing that stops the fleet, and the FSM never says
    // so out loud: `breakDown()` parks the ride in 'movingToEndOfStation' and
    // then returns early for BREAK_DOWN_SECS + REPAIR_SECS (18 s) without
    // emitting another state, while 'brokenDown'/'beingRepaired' exist only on
    // `handle.status()`. A NORMAL 'movingToEndOfStation' lasts exactly 1.0 s
    // (GameManager/rideFsm.ts), so one that outlives 2.5 s is a breakdown —
    // that dwell time IS the signal, and it is the only one there is.
    if (stateNow === 'movingToEndOfStation' && time - stateAt > 2.5) loopCtl.haltTarget = 0;
    const k = loopCtl.haltTarget;
    loopCtl.haltK = k > loopCtl.haltK ? Math.min(k, loopCtl.haltK + dt / 0.9) : Math.max(k, loopCtl.haltK - dt / 0.9);
    railClock += dt * loopCtl.haltK; // eased coast to a stand, eased back out
    update?.(railClock, loopCtl.haltK);
  };
  const onStateChange = (state: string) => {
    gate.onStateChange(state); // the shuttle still parks on the FSM
    stateNow = state;
    stateAt = lastRaw;
    if (state === 'crashed') loopCtl.haltTarget = 0;
    else if (state !== 'movingToEndOfStation') loopCtl.haltTarget = 1;
    // MIRROR the FSM's station pointer. The manager hands the visuals a state
    // and an occupancy, never `atStation` — but the FSM advances it on exactly
    // one edge, `r.atStation = (r.atStation + 1) % nStations` immediately
    // before 'unloadingPassengers' (GameManager/rideFsm.ts), so counting that
    // edge tracks it exactly rather than approximately.
    if (state === 'unloadingPassengers' && loopCtl.nStops > 1)
      loopCtl.fsmStation = (loopCtl.fsmStation + 1) % loopCtl.nStops;
    // WHICH TRAIN A RIDER SITS IN. Latched only while the vehicle is empty
    // (post-unload), so nobody's seat jumps between cars mid-ride: boarders go
    // into the train with the shortest run left to the platform they are
    // queuing at — the one a guest standing there would watch pull in.
    if (state === 'movingToEndOfStation' || state === 'waitingForPassengers')
      loopCtl.boardTrain = loopCtl.nearestTrain?.(loopCtl.fsmStation) ?? 0;
  };
  // seats resolve into the LATCHED train, not always train 0: the anchors run
  // in train order, six per train, so offsetting by `boardTrain · 6` keeps the
  // old spill-into-the-next-train behaviour for capacities above six.
  const baseSeat = makeSeatWorld(three, seatAnchors);
  const seatWorld = (seat: number) => baseSeat(loopCtl.boardTrain * 6 + seat);
  /** WHERE THE HUTS ACTUALLY LANDED. The compiler knows where the platform
   *  decks are; only the GameManager knows where the entrance and exit huts
   *  ended up, because those come from the PARK's authored `queueAnchor` /
   *  `exitPoint` (and can be auto-shifted again by the access audit). Without
   *  this the station's lift was placed from the deck pose alone and stood in
   *  the queue lane mouth, capping the lane in front of the ENTRANCE hut —
   *  see `buildStationLift`. One entry per platform, in station order (which
   *  IS compiled-station order), in WORLD xz. */
  const onAccessPlaced = (stations: { entrance: [number, number]; exit: [number, number] }[]) => {
    pendingAccess = stations;
  };
  return { group, update: tick, vehicle, seatWorld, onStateChange, onAccessPlaced, ...extras };
}

const MonorailBase = composableRide(
  'Monorail',
  (t, props: { pieces?: TrackPiece[]; beamY?: number; loopSeconds?: number; speed?: number; trains?: number }) =>
    buildMonorailScene(t, props),
  { defaults: { name: 'Monorail', capacity: 6, rideDuration: 12, intensity: 1, price: 2 } }, // capacity = 3 enclosed cabins × 2 (seatWorld anchors)
);

/** <Monorail> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Override with top-level props / `queue`.
 *  OPTIONAL track pieces (SETUP §5.1): a `pieces` array or piece children
 *  (children win) turn the shuttle into a closed-LOOP beam circuit compiled
 *  by compileTrackPieces (elevated beam + piers follow the spline; the train
 *  becomes three articulated cars gliding the loop). The beam is FLAT-only:
 *  lift/drop/hill (and any helix height) are stripped with a console.warn —
 *  monorails never ramp up and down. Defaults — the classic back-and-forth
 *  shuttle — are unchanged when no pieces are given.
 *  The fleet runs a TIMETABLE on its own clock — a constant cruise between
 *  platforms and a 2.4 s dwell at each — NOT the ride FSM, which cycles on a
 *  `rideDuration` timer that a park-scale circuit can never match and which
 *  left the trains standing still 70% of the time. Only a BREAKDOWN stops
 *  them. `speed` is the cruise in units/second (default 0.9, a deliberately
 *  SLOW transport pace); `trains` puts a whole FLEET on the beam — the
 *  DEFAULT is the platform count up to 4, hard cap 6, clamped further only by
 *  the headway a dwelling train needs. They are spaced in time on the shared
 *  timetable, so they run in parallel round the circuit for ever. Every
 *  platform carries a working ELEVATOR from its ground-level entrance lobby up
 *  to the deck. */
export const Monorail: React.FC<
  ComposableRideProps & {
    pieces?: TrackPiece[];
    beamY?: number;
    loopSeconds?: number;
    speed?: number;
    trains?: number;
    children?: React.ReactNode;
  }
> = ({ children, pieces, beamY, loopSeconds, speed, trains, ...rest }) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return (
    <MonorailBase
      {...rest}
      {...(resolved ? { pieces: resolved } : {})}
      {...(beamY !== undefined ? { beamY } : {})}
      {...(loopSeconds !== undefined ? { loopSeconds } : {})}
      {...(speed !== undefined ? { speed } : {})}
      {...(trains !== undefined ? { trains } : {})}
    />
  );
};
