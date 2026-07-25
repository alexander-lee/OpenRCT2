import React from 'react';
import * as THREE from 'three';
import { box, cyl, mat, nightKOf } from '../Stage';
import { computeSplineFrames } from '../SplineCoaster';
import { compileTrackPieces, ribbon, railTube } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// Monorail matched to the RCT2 MONO1 sprite: a chunky BOXY ORANGE train with a
// tall band of amber (lit) windows in dark frames, a MAGENTA stripe along the
// lower skirt, roof vents, and a slightly bevelled nose — gliding on an
// elevated concrete beam with piers. Default: the classic 7-unit shuttle beam
// (byte-identical to the original). With `pieces` the beam follows a
// compileTrackPieces circuit instead and the train becomes a LOOP glider —
// articulated cars riding the closed spline at constant speed.

const ORANGE = 0xe8641c; // body (sprite #f07020)
const ORANGE_D = 0xc44a14;
const MAGENTA = 0xd6338c; // skirt stripe
const FRAME = 0x3a1c04; // window frames (sprite #401000)
const AMBER = 0xe8b040; // lit windows

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
 *  `gasket` bridges to the car in front (rigid shuttle train only). */
function buildMonorailCar(
  t: typeof THREE,
  beamY: number,
  lights: MonorailLightMats,
  opts: { nose?: -1 | 1 | null; gasket?: boolean; seats?: THREE.Group[] } = {},
): THREE.Group {
  const car = new t.Group();
  const y = beamY + 0.42;
  // 2 seat anchors INSIDE the enclosed cabin (seatWorld) — REAL GameManager
  // guests ride behind the amber window band, RCT2-style
  if (opts.seats)
    [-0.25, 0.25].forEach((sz) => {
      const seat = new t.Group();
      seat.position.set(0, beamY + 0.1, sz);
      car.add(seat);
      opts.seats!.push(seat);
    });
  // straddle skirt hugging the beam, with magenta stripe
  car.add(box(t, [0.56, 0.3, 1.06], ORANGE_D, [0, beamY + 0.08, 0], { tex: 'plastic', repeat: [2, 1], rough: 0.45 }));
  car.add(box(t, [0.58, 0.05, 1.08], MAGENTA, [0, beamY + 0.2, 0], { rough: 0.5 }));
  // boxy body
  car.add(box(t, [0.6, 0.52, 1.1], ORANGE, [0, y, 0], { tex: 'plastic', repeat: [3, 1], rough: 0.45 }));
  // window band: dark frame strip + amber panes both sides, with a
  // sliding DOOR (dark leaf + silver handle rail) over the centre bay
  [-0.305, 0.305].forEach((x) => {
    car.add(box(t, [0.012, 0.3, 1.0], FRAME, [x, y + 0.06, 0], { rough: 0.7 }));
    for (let wz = -0.38; wz <= 0.38; wz += 0.19) {
      const pane = new t.Mesh(new t.BoxGeometry(0.016, 0.24, 0.14), new t.MeshStandardMaterial({ color: AMBER, emissive: 0x8a5a10, emissiveIntensity: 0.2, roughness: 0.4 }));
      pane.position.set(x, y + 0.06, wz);
      car.add(pane);
      lights.paneMats.push(pane.material as unknown as { emissiveIntensity: number });
    }
    car.add(box(t, [0.02, 0.42, 0.2], FRAME, [x, y - 0.04, 0], { rough: 0.65 })); // door leaf over the centre bay
    car.add(box(t, [0.024, 0.03, 0.16], 0xcfd4da, [x, y - 0.1, 0], { tex: 'metal', metal: 0.85, rough: 0.25 })); // door handle rail
  });
  // roof + vents
  car.add(box(t, [0.56, 0.07, 1.04], ORANGE_D, [0, y + 0.29, 0], { tex: 'plastic', rough: 0.5 })); // overlaps the body top (no air gap)
  [-0.3, 0, 0.3].forEach((vz) => car.add(box(t, [0.3, 0.05, 0.16], 0xb0400f, [0, y + 0.34, vz], { rough: 0.6 }))); // vents embedded in the roof
  // bevelled cab nose: nose bottom clears the beam top; windscreen +
  // headlight sit ON the slope (proud, ends embedded)
  if (opts.nose) {
    const s = opts.nose;
    car.add(box(t, [0.58, 0.46, 0.24], ORANGE, [0, y - 0.01, s * 0.6], { rotX: s * 0.35, tex: 'plastic', rough: 0.45 }));
    car.add(box(t, [0.4, 0.16, 0.04], FRAME, [0, y + 0.08, s * 0.76], { rough: 0.6, rotX: s * 0.35 })); // windscreen
    const head = cyl(t, 0.05, 0.05, 0.03, AMBER, [0, y - 0.18, s * 0.67], { emissive: 0x8a5a10, rotX: Math.PI / 2, seg: 10 });
    car.add(head);
    lights.headMats.push(head.material as unknown as { emissiveIntensity: number });
    const hl = new t.PointLight(0xffd9a0, 0, 3, 2);
    hl.position.set(0, y - 0.18, s * 0.85);
    car.add(hl);
    lights.headLights.push(hl);
  }
  // inter-car gasket (rigid shuttle only — loop cars articulate)
  if (opts.gasket) car.add(box(t, [0.5, 0.44, 0.16], 0x2a2a2e, [0, y, -0.58], { rough: 0.8 })); // bridges the 0.1 gap, 0.01 embedded in BOTH car faces
  return car;
}

export function buildMonorailScene(
  three: typeof THREE,
  opts: { pieces?: TrackPiece[] } = {},
): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  /** fatal pieces compile — <ConfigurableRide> skips registration (parity with
   *  LogFlume/RiverRapids/Bobsleigh, which already report this) */
  invalid?: boolean;
} {
  const group = new three.Group();
  const extras: { invalid?: boolean } = {};
  const seatAnchors: THREE.Group[] = []; // 3 cars × 2 cabin anchors (seatWorld)
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
          const compiled = compileTrackPieces(stripVerticalPieces(opts.pieces), { profile: 'monorail', start: [0, 1.2, 0] });
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
          // articulated 3-car loop glider: head car nose forward (+z of the
          // frame), tail car nose backward — cars ride the beam centreline
          const cars = [0, 1, 2].map((i) =>
            buildMonorailCar(t, 0, lights, { nose: i === 0 ? 1 : i === 2 ? -1 : null, seats: seatAnchors }),
          );
          cars.forEach((c) => g.add(c));
          vehicle = cars[0];
          const SPACING = 1.25;
          const V = 1.1; // constant beam-glide speed (units/s)
          const m = new t.Matrix4();
          return (time: number) => {
            gateLights(time);
            const uHead = (time * V) / fb.total;
            cars.forEach((c, i) => {
              const f = fb.frameAt(uHead - (i * SPACING) / fb.total);
              c.position.copy(f.p);
              m.makeBasis(f.side, f.up, f.fwd);
              c.setRotationFromMatrix(m);
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
  // station gate: the train parks (shuttle: at the beam centre; loop: where
  // the glide clock stops) while guests board/unload — spinDown 0.9 so it is
  // at rest before 'unloadingPassengers' begins
  const gate = createMotionGate((tt, k) => update?.(tt, k), { spinDown: 0.9 });
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seatAnchors), onStateChange: gate.onStateChange, ...extras };
}

const MonorailBase = composableRide(
  'Monorail',
  (t, props: { pieces?: TrackPiece[] }) => buildMonorailScene(t, props),
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
 *  shuttle — are unchanged when no pieces are given. */
export const Monorail: React.FC<ComposableRideProps & { pieces?: TrackPiece[]; children?: React.ReactNode }> = ({
  children,
  pieces,
  ...rest
}) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <MonorailBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};
