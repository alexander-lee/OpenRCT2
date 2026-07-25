import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, nightKOf } from '../Stage';
import { TrackScheme, rideColourPreset, shade } from '../ColorKit';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// TrackKit — composable roller-coaster track, modelled on RCT2's track-piece
// system. RCT2 builds coasters from a fixed vocabulary of TrackElemTypes
// (flat, gentle 25° slopes, steep 60°, quarter turns, corkscrews...) and gives
// every element a CLEARANCE HEIGHT (RideData ClearanceHeight — the vertical
// envelope a train sweeps through). Wooden-coaster supports must never enter
// that envelope, so when structure would cross a lower track, it is split
// around [railY - STRUCT_DEPTH, railY + CLEARANCE]. We reproduce both ideas:
// a piece vocabulary compiled into a smooth closed spline, and support bents
// that check every other track pass before building through it.
// ---------------------------------------------------------------------------

export type PieceName =
  | 'station'
  | 'flat'
  | 'up25'
  | 'down25'
  | 'up60'
  | 'down60'
  | 'turnL'
  | 'turnR'
  | 'corkscrewL'
  | 'corkscrewR';

const STEP = 1.3; // horizontal run of one straight piece (one "tile")
const RISE25 = 0.55; // rise of a gentle slope piece (RCT2 gentle = 25°)
const RISE60 = 1.15; // rise of a steep piece
const TURN_R = 1.5; // quarter-turn radius
export const CLEARANCE = 0.85; // RCT2-style clearance envelope above the rail
const STRUCT_DEPTH = 0.3; // structure depth below the rail

interface CompiledTrack {
  curve: THREE.CatmullRomCurve3;
  rollOf: (u: number) => number;
  stations: THREE.Vector3[];
}

/**
 * RCT2 per-type piece whitelists — ride/rtd/coaster/WoodenRollerCoaster.h:26,85:
 * the wooden coaster's TrackElemType table stops at the steep-60° slope group
 * and has NO corkscrew/inversion groups (banking exists only as gradual
 * transition pieces); steel piece tables allow the lot. SplineRideKit's
 * checkCoasterDesign applies the same limits in freeform spline space.
 */
export const TRACK_WHITELIST: Record<'wooden' | 'steel', PieceName[]> = {
  wooden: ['station', 'flat', 'up25', 'down25', 'up60', 'down60', 'turnL', 'turnR'],
  steel: ['station', 'flat', 'up25', 'down25', 'up60', 'down60', 'turnL', 'turnR', 'corkscrewL', 'corkscrewR'],
};

/**
 * Compile a piece list into a smooth closed spline + roll profile. Pass the
 * optional `type` to check the layout against TRACK_WHITELIST — pieces that
 * RCT2's track table for that coaster type doesn't contain console.warn (the
 * track still compiles so authors can see the offending element).
 */
export function compileTrack(t: typeof THREE, pieces: PieceName[], type?: 'wooden' | 'steel'): CompiledTrack {
  if (type) {
    const allowed = TRACK_WHITELIST[type];
    const warned = new Set<PieceName>();
    pieces.forEach((p, i) => {
      if (!allowed.includes(p) && !warned.has(p)) {
        warned.add(p);
        // eslint-disable-next-line no-console
        console.warn(`TrackKit: '${p}' (piece ${i}) is not in the ${type} coaster whitelist — ` +
          `RCT2's ${type} track table has no such element (WoodenRollerCoaster.h:26,85).`);
      }
    });
  }
  const pts: THREE.Vector3[] = [];
  const rolls: { i: number; roll: number }[] = [];
  const stations: THREE.Vector3[] = [];
  const pos = new t.Vector3(0, 1.0, 0);
  let yaw = 0;
  let roll = 0;
  const fwd = () => new t.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const push = (p: THREE.Vector3) => {
    pts.push(p.clone());
    rolls.push({ i: pts.length - 1, roll });
  };
  push(pos);
  for (const piece of pieces) {
    if (piece === 'station' || piece === 'flat') {
      if (piece === 'station') stations.push(pos.clone());
      pos.addScaledVector(fwd(), STEP);
      push(pos);
    } else if (piece === 'up25' || piece === 'down25' || piece === 'up60' || piece === 'down60') {
      const rise = (piece.startsWith('up') ? 1 : -1) * (piece.endsWith('60') ? RISE60 : RISE25);
      pos.addScaledVector(fwd(), STEP);
      pos.y = Math.max(0.55, pos.y + rise);
      push(pos);
    } else if (piece === 'turnL' || piece === 'turnR') {
      const s = piece === 'turnL' ? 1 : -1;
      // quarter circle in 3 chords around the turn centre. The centre sits on
      // the INSIDE of the turn: heading (sin yaw, 0, cos yaw) has its left at
      // +(cos yaw, 0, -sin yaw), so turnL orbits +that and turnR orbits -that.
      // (With the sign flipped the arc is retrograde — the track loops BACK
      // through a switchback bulge at every corner and trains ride it in a
      // cusp, wheels ~0.3 under the rails.)
      const centre = pos.clone().addScaledVector(new t.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), s * TURN_R);
      for (let k = 1; k <= 3; k++) {
        const a = (s * (k / 3) * Math.PI) / 2;
        const rel = pos.clone().sub(centre);
        const rot = rel.clone().applyAxisAngle(new t.Vector3(0, 1, 0), a);
        push(centre.clone().add(rot));
      }
      yaw += (s * Math.PI) / 2;
      pos.copy(pts[pts.length - 1]);
    } else if (piece === 'corkscrewL' || piece === 'corkscrewR') {
      // RCT2 corkscrew: full 360° roll across the element with a rise-fall
      // hump. THREE tiles long (like the real multi-tile element) — at two
      // tiles the roll rate is so hot that cars 1.2 apart ride ~170° out of
      // phase and sweep through each other around the centreline.
      const s = piece === 'corkscrewL' ? 1 : -1;
      const side = new t.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const y0 = pos.y;
      for (let k = 1; k <= 6; k++) {
        const f = k / 6;
        const p = pos
          .clone()
          .addScaledVector(fwd(), STEP * 3 * f)
          // S-curve: swings out and RETURNS to the centreline, keeping the grid legal
          .addScaledVector(side, s * 0.4 * Math.sin(f * Math.PI * 2));
        p.y = y0 + 0.55 * Math.sin(f * Math.PI);
        roll += (s * Math.PI * 2) / 6;
        push(p);
      }
      pos.copy(pts[pts.length - 1]);
    }
  }
  // ---- circuit closure validation (RCT2 refuses to open an unclosed circuit) ----
  const start = pts[0];
  const end = pts[pts.length - 1];
  const yawOk = Math.abs(((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) < 0.01;
  const gap = Math.hypot(end.x - start.x, end.z - start.z) + Math.abs(end.y - start.y);
  if (!yawOk || gap > STEP * 0.6) {
    // eslint-disable-next-line no-console
    console.warn(`TrackKit: layout does not close (gap ${gap.toFixed(2)}, yaw ok: ${yawOk}). ` +
      'Opposite legs must be equal length, rises must sum to zero, and turns must total 360°.');
  }
  if (gap < STEP * 0.6 && gap > 1e-6) {
    // snap the final point onto the start so the closed spline has no jump
    pts[pts.length - 1] = start.clone();
  }
  if (pts.length > 2 && pts[pts.length - 1].distanceTo(start) < 1e-6) {
    pts.pop(); // closed CatmullRom wraps automatically; a duplicate start point causes a kink
    rolls.pop();
  }
  // ---- corner rounding (one Chaikin pass) ----
  // RCT2 pieces meet at hard corners; a raw CatmullRom through those corners
  // OVERSHOOTS (dips below slope feet, bulges past turn exits) hard enough to
  // sink train wheels ~0.3 into the rails. Cutting every corner 25/75 before
  // fitting the spline bounds the overshoot like RCT2's transition pieces do.
  const rpts: THREE.Vector3[] = [];
  const rrolls: number[] = [];
  const nRaw = pts.length;
  for (let i = 0; i < nRaw; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % nRaw];
    const ra = rolls[i].roll;
    let rb = rolls[(i + 1) % nRaw].roll;
    // wrap pair (last -> first): bring the first roll into the last's winding
    if ((i + 1) % nRaw === 0) rb += Math.round((ra - rb) / (Math.PI * 2)) * Math.PI * 2;
    rpts.push(a.clone().lerp(b, 0.25), a.clone().lerp(b, 0.75));
    rrolls.push(ra * 0.75 + rb * 0.25, ra * 0.25 + rb * 0.75);
  }
  const curve = new t.CatmullRomCurve3(rpts, true, 'centripetal', 0.5);
  const n = rpts.length;
  const rollOf = (u: number) => {
    const f = u * n;
    const i0 = Math.floor(f) % n;
    const i1 = (i0 + 1) % n;
    const fr = f - Math.floor(f);
    // wrap segment (i1 === 0): re-express the first point's roll in the last
    // point's winding (± n·2π) — otherwise a layout whose corkscrews wound the
    // roll to ±2π would lerp back through ±π and the train would phantom
    // barrel-roll around the centreline just before the station.
    const wrap = i1 === 0 ? Math.round((rrolls[n - 1] - rrolls[0]) / (Math.PI * 2)) * Math.PI * 2 : 0;
    return rrolls[i0] * (1 - fr) + (rrolls[i1] + wrap) * fr;
  };
  return { curve, rollOf, stations };
}

/** Frame (pos, forward, up, side) at u along the track, including roll. */
export function frameAt(t: typeof THREE, tk: CompiledTrack, u: number) {
  const uu = ((u % 1) + 1) % 1;
  const p = tk.curve.getPointAt(uu);
  const fwd = tk.curve.getTangentAt(uu).normalize();
  let up = new t.Vector3(0, 1, 0);
  up = up.sub(fwd.clone().multiplyScalar(up.dot(fwd))).normalize(); // orthogonalise
  up.applyAxisAngle(fwd, tk.rollOf(uu));
  const side = new t.Vector3().crossVectors(up, fwd).normalize();
  return { p, fwd, up, side };
}

export interface TrackStyle {
  wood?: boolean;
  railColor?: number;
  supportEvery?: number;
  /** RCT2 TrackColour scheme (ride/RideColour.h:19-24): rails = main,
   *  ties + stringers = additional, support posts/bents = supports.
   *  Overrides railColor; omitted = today's colours exactly. */
  colours?: TrackScheme;
}

/** Render rails/ties/supports along the compiled track with clearance checks. */
export function buildTrackMesh(t: typeof THREE, g: THREE.Group, tk: CompiledTrack, style: TrackStyle = {}) {
  // RCT2 TrackColour mapping — defaults byte-identical to the stock colours
  const RAIL = style.colours?.main ?? style.railColor ?? 0x8b8f96;
  const WOOD = style.colours?.additional ?? 0x7a5230; // stringers
  const TIE = style.colours?.additional ?? (style.wood ? 0x6b4626 : 0x4a4e55);
  const SUP = style.colours?.supports ?? (style.wood ? 0x7a5230 : 0x9aa0a8);
  const SUP_D = style.colours !== undefined ? shade(style.colours.supports, 0.78) : 0x5f3f24; // stock 0x5f3f24 ≈ 0.78·0x7a5230
  const GAP = 0.34; // half rail gauge
  const SAMPLES = 260;

  // pre-sample frames for rails + clearance queries
  const frames = [] as { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[];
  for (let i = 0; i <= SAMPLES; i++) frames.push(frameAt(t, tk, i / SAMPLES));

  // rails as tubes along offset point chains
  [-1, 1].forEach((s) => {
    const off = frames.map((f) => f.p.clone().addScaledVector(f.side, s * GAP));
    const railCurve = new t.CatmullRomCurve3(off, true);
    const tube = new t.Mesh(new t.TubeGeometry(railCurve, SAMPLES, 0.045, 8, true), mat(t, RAIL, { tex: 'metal', repeat: [1, 40], metal: 0.8, rough: 0.35 }));
    tube.castShadow = true;
    g.add(tube);
  });
  // wooden stringers under the rails
  if (style.wood) {
    [-1, 1].forEach((s) => {
      const off = frames.map((f) => f.p.clone().addScaledVector(f.side, s * GAP).addScaledVector(f.up, -0.12));
      const c = new t.CatmullRomCurve3(off, true);
      const tube = new t.Mesh(new t.TubeGeometry(c, SAMPLES, 0.06, 6, true), mat(t, WOOD, { tex: 'wood', repeat: [1, 30], rough: 0.9 }));
      tube.castShadow = true;
      g.add(tube);
    });
  }
  // ties every few samples
  for (let i = 0; i < SAMPLES; i += 3) {
    const f = frames[i];
    const tie = box(t, [GAP * 2 + 0.28, 0.055, 0.13], TIE, [0, 0, 0], { tex: style.wood ? 'wood' : 'metal', repeat: [3, 1], rough: 0.9 });
    tie.position.copy(f.p).addScaledVector(f.up, -0.06);
    const m = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
    tie.setRotationFromMatrix(m);
    g.add(tie);
  }

  // supports with RCT2-style clearance: a bent may not pass through the
  // clearance envelope [railY - STRUCT_DEPTH, railY + CLEARANCE] of any OTHER
  // track pass crossing its column.
  const every = style.supportEvery ?? 9;
  for (let i = 0; i < SAMPLES; i += every) {
    const f = frames[i];
    // wood bents meet the stringer undersides (-0.18); steel columns meet the
    // tie undersides (-0.0875) — either way the post top is embedded, no gap
    const topY = f.p.y - (style.wood ? 0.14 : 0.08);
    if (topY < 0.25) continue;
    // collect blocked intervals from other passes over this column
    const blocked: [number, number][] = [];
    for (let j = 0; j < SAMPLES; j += 2) {
      if (Math.abs(j - i) < 14 && Math.abs(j - i) > SAMPLES - 14) continue;
      const q = frames[j].p;
      const dx = q.x - f.p.x;
      const dz = q.z - f.p.z;
      if (dx * dx + dz * dz < 0.45 * 0.45 && Math.abs(q.y - f.p.y) > 0.3) {
        blocked.push([q.y - STRUCT_DEPTH, q.y + CLEARANCE]);
      }
    }
    // build the column as segments that skip blocked intervals
    const segs: [number, number][] = [];
    let y0 = 0;
    const stops = blocked.filter(([a, b]) => b > 0 && a < topY).sort((a, b) => a[0] - b[0]);
    for (const [a, b] of stops) {
      if (a > y0 + 0.12) segs.push([y0, Math.min(a, topY)]);
      y0 = Math.max(y0, b);
    }
    if (topY > y0 + 0.12) segs.push([y0, topY]);
    for (const [a, b] of segs) {
      const h = b - a;
      if (style.wood) {
        [-0.42, 0.42].forEach((sx) => {
          const post = box(t, [0.11, h, 0.11], SUP, [0, 0, 0], { tex: 'wood', repeat: [1, 4], rough: 0.9 });
          post.position.set(f.p.x + f.side.x * sx, a + h / 2, f.p.z + f.side.z * sx);
          g.add(post);
        });
        if (h > 0.5) {
          const ledger = box(t, [0.95, 0.09, 0.09], SUP_D, [0, 0, 0], { tex: 'wood', repeat: [4, 1], rough: 0.9 });
          ledger.position.set(f.p.x, a + h - 0.2, f.p.z);
          const m = new t.Matrix4().makeBasis(f.side, new t.Vector3(0, 1, 0), new t.Vector3().crossVectors(f.side, new t.Vector3(0, 1, 0)));
          ledger.setRotationFromMatrix(m);
          g.add(ledger);
          const brace = box(t, [1.1, 0.06, 0.05], SUP_D, [0, 0, 0], { tex: 'wood', repeat: [4, 1], rough: 0.9 });
          brace.position.set(f.p.x, a + h / 2, f.p.z);
          brace.setRotationFromMatrix(m);
          brace.rotateZ(0.8);
          g.add(brace);
        }
      } else {
        const post = cyl(t, 0.07, 0.09, h, SUP, [0, 0, 0], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 10 });
        post.position.set(f.p.x, a + h / 2, f.p.z);
        g.add(post);
      }
    }
  }
  // station platform(s): a full-height concrete deck BESIDE the track (top just
  // below rail height, base on the ground), timber canopy on four posts and a
  // red name board — all clear of the train's swept envelope.
  tk.stations.forEach((sp) => {
    // nearest pre-sampled frame gives the track direction at the station
    let bi = 0;
    let bd = Infinity;
    frames.forEach((f, fi) => {
      const d = f.p.distanceTo(sp);
      if (d < bd) {
        bd = d;
        bi = fi;
      }
    });
    const f = frames[bi];
    const nf = frames[(bi + 1) % frames.length];
    const fwdH = new t.Vector3(nf.p.x - f.p.x, 0, nf.p.z - f.p.z).normalize();
    const sideH = new t.Vector3(fwdH.z, 0, -fwdH.x); // horizontal lateral
    // pick the platform side AWAY from other track passes — the closing turn
    // of a circuit can sweep straight through the naive +side position (its
    // ties would clip the deck), so score both sides against every non-station
    // sample and build on the clearer one (group yawed 180° when mirrored so
    // the canopy tilt + name board stay on the outer edge).
    const clearOf = (s: number) => {
      const cx = sp.x + sideH.x * 1.15 * s;
      const cz = sp.z + sideH.z * 1.15 * s;
      let m = Infinity;
      frames.forEach((f2, fi) => {
        const steps = Math.min(Math.abs(fi - bi), frames.length - Math.abs(fi - bi));
        if (steps < 18) return; // the station pass itself
        m = Math.min(m, Math.hypot(f2.p.x - cx, f2.p.z - cz));
      });
      return m;
    };
    const sSide = clearOf(1) >= clearOf(-1) ? 1 : -1;
    const st = new t.Group();
    st.position.set(sp.x + sideH.x * 1.15 * sSide, 0, sp.z + sideH.z * 1.15 * sSide);
    st.rotation.y = Math.atan2(fwdH.x, fwdH.z) + (sSide < 0 ? Math.PI : 0);
    const py = sp.y - 0.06; // platform top just below the rail centreline
    st.add(box(t, [1.3, py, 2.2], 0x8a8f98, [0, py / 2, 0], { tex: 'concrete', repeat: [5, 5], rough: 0.9 }));
    // deck dressing: cream safety stripe along the boarding (track) edge and
    // a timber bench against the outer edge — breaks up the bare slab top
    st.add(box(t, [0.07, 0.02, 2.2], 0xd8d0be, [-0.6, py + 0.005, 0], { rough: 0.8 }));
    st.add(box(t, [0.28, 0.05, 0.9], 0x7a5230, [0.34, py + 0.2, 0], { tex: 'wood', repeat: [3, 1], rough: 0.9 })); // bench seat
    st.add(box(t, [0.05, 0.24, 0.9], 0x7a5230, [0.46, py + 0.3, 0], { tex: 'wood', repeat: [1, 3], rough: 0.9 })); // bench back
    [-0.35, 0.35].forEach((bz) => st.add(box(t, [0.24, 0.2, 0.07], 0x5f3f24, [0.34, py + 0.1, bz], { tex: 'wood', rough: 0.9 }))); // bench legs
    const canopyY = sp.y + 0.75;
    (
      [
        [-0.45, -0.95],
        [0.45, -0.95],
        [-0.45, 0.95],
        [0.45, 0.95],
      ] as const
    ).forEach(([lx, lz]) => {
      // canopy rotZ +0.1 RAISES the +x side (underside y ≈ canopyY + 0.1·lx − 0.03),
      // so the post height follows +lx·0.1, topping ~0.015 INTO the tilted slab
      const hp = canopyY + lx * 0.1 - py + 0.005;
      st.add(box(t, [0.09, hp, 0.09], 0x7a5230, [lx, py + hp / 2 - 0.02, lz], { tex: 'wood', repeat: [1, 3], rough: 0.85 }));
    });
    st.add(box(t, [1.5, 0.06, 2.4], 0x7a5230, [0, canopyY, 0], { tex: 'wood', repeat: [6, 3], rough: 0.85, rotZ: 0.1 }));
    // name board hung from the canopy's raised (+x) eave: top edge embeds into
    // the slab underside (canopyY + 0.066·... − 0.03) instead of floating below
    st.add(box(t, [0.07, 0.35, 1.6], 0xb03030, [0.66, canopyY - 0.13, 0], { tex: 'plastic', repeat: [1, 6], rough: 0.5 }));
    // night-gated platform lamps: two warm bulbs hung under the canopy (at
    // x=0 the tilted slab's underside is canopyY − 0.03; stems drop 0.05 to
    // bulbs at canopyY − 0.1) + ONE real PointLight under the canopy centre.
    // buildTrackMesh returns no updater, so the gate rides the first bulb's
    // onBeforeRender (the ParkEntrance lantern pattern) via nightKOf.
    const bulbs: THREE.Mesh[] = [];
    [-0.8, 0.8].forEach((lz) => {
      st.add(cyl(t, 0.012, 0.012, 0.05, 0x3a3d42, [0, canopyY - 0.055, lz], { metal: 0.5, rough: 0.5, seg: 8 }));
      const bulb = ball(t, 0.045, 0xfff0c8, [0, canopyY - 0.1, lz], { emissive: 0xffb45e, rough: 0.35 });
      (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15; // faint glass by day
      st.add(bulb);
      bulbs.push(bulb);
    });
    const stLamp = new t.PointLight(0xffb45e, 0, 4, 2); // 1 real light per station
    stLamp.position.set(0, canopyY - 0.25, 0);
    st.add(stLamp);
    bulbs[0].onBeforeRender = () => {
      const k = nightKOf(bulbs[0]);
      const ease = k * k * (3 - 2 * k); // smoothstep: off by day, on at night
      stLamp.intensity = 0.8 * ease;
      bulbs.forEach((b) => ((b.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + 1.05 * ease));
    };
    g.add(st);
  });
  return frames;
}

/** Attach a train of car groups to the track; returns an updater. */
export function attachTrain(t: typeof THREE, g: THREE.Group, tk: CompiledTrack, cars: THREE.Group[], opts: { speed?: number; spacing?: number; wheelOffset?: number } = {}) {
  const speed = opts.speed ?? 0.045;
  const spacing = opts.spacing ?? 0.028;
  // rail tube top is +0.045 above the centreline; car undersides/wheel bottoms
  // sit 0.15 below the car origin — 0.195 puts wheels ON the rails, not in them
  const wheelOffset = opts.wheelOffset ?? 0.195;
  cars.forEach((c) => g.add(c));
  const m = new t.Matrix4();
  return (time: number) => {
    const head = time * speed;
    cars.forEach((c, i) => {
      const f = frameAt(t, tk, head - i * spacing);
      c.position.copy(f.p).addScaledVector(f.up, wheelOffset);
      m.makeBasis(f.side, f.up, f.fwd);
      c.setRotationFromMatrix(m);
    });
  };
}

/** Standalone preview of the kit: a wooden figure-8-ish circuit. */
export function buildTrackKitScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // verified closed rectangle: 13 tiles east (lift + 3-tile corkscrew),
        // 2 south, 13 west, 2 north — opposite legs equal, rises cancel.
        const tk = compileTrack(t, [
          'station', 'flat', 'up25', 'up25', 'up25', 'down25', 'down25', 'down25', 'flat', 'corkscrewR', 'flat',
          'turnR', 'up25', 'down25',
          'turnR', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat',
          'turnR', 'flat', 'flat',
          'turnR',
        ]);
        // seeded RCT2 wooden scheme: tan/sepia/lightBrown — the "Generic GCI"
        // preset (WoodenRollerCoaster.h:58) — with matching sepia car bodies
        const scheme = rideColourPreset(2, 'wooden');
        // build into a recentred root: the piece walk starts at the origin so
        // the raw circuit's centroid sits way off in +z — centring it keeps
        // the whole loop in the default camera frame instead of cropping it
        const root = new t.Group();
        g.add(root);
        // Stage orbits from azimuth 45°: the screen-horizontal axis is the
        // world (1,0,-1) diagonal, so yaw the loop's +z long axis onto it
        root.rotation.y = Math.PI * 0.75;
        buildTrackMesh(t, root, tk, { wood: true, colours: scheme.track });
        // simple kit demo cars, dressed just enough to read as vehicles:
        // body + dark cockpit well + chrome nose trim + four wheels (bottoms
        // 0.15 below the origin — attachTrain's default 0.195 wheelOffset)
        const cars = [0, 1, 2].map(() => {
          const c = new t.Group();
          c.add(box(t, [0.5, 0.26, 0.9], scheme.vehicles[0].body, [0, 0.05, 0], { tex: 'plastic', rough: 0.4 }));
          c.add(box(t, [0.4, 0.08, 0.78], 0x1c1c20, [0, 0.2, 0], { rough: 0.9 })); // open cockpit well
          c.add(box(t, [0.52, 0.05, 0.1], 0xcfd4da, [0, 0.08, 0.42], { tex: 'metal', metal: 0.85, rough: 0.25 })); // nose trim
          [
            [-0.28, 0.3],
            [0.28, 0.3],
            [-0.28, -0.3],
            [0.28, -0.3],
          ].forEach(([x, z]) => c.add(cyl(t, 0.09, 0.09, 0.06, 0x141417, [x, -0.06, z], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.6, rough: 0.4, seg: 14 })));
          return c;
        });
        const run = attachTrain(t, root, tk, cars);
        // recentre: put the curve's bounding centre on the stage origin
        const bb = new t.Box3();
        for (let i = 0; i < 100; i++) bb.expandByPoint(tk.curve.getPointAt(i / 100));
        const c = bb.getCenter(new t.Vector3()).applyAxisAngle(new t.Vector3(0, 1, 0), root.rotation.y);
        root.position.set(-c.x - 0.9, 0, -c.z); // extra 0.9 west: the camera sits NE, so the frame's usable centre is west of the origin
        return (time) => run(time);
      })(three, group) || undefined;
  return { group, update };
}

/** <TrackKit> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const TrackKit = composable('TrackKit', (t) => buildTrackKitScene(t));
