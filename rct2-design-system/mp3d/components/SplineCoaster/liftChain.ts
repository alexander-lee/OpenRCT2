// ---------------------------------------------------------------------------
// SplineCoaster / liftChain.ts — THE MECHANISED CHAIN LIFT.
// Split out of ./index.tsx for FILE SIZE only (Magic Patterns'
// write_design_system_files replaces whole files with no patch API, so a module
// past ~55 KB becomes hard to publish; the roll channel pushed index.tsx onto
// that line). index.tsx re-exports `buildLiftChain` and `LiftChainOpts`, so
// `import { buildLiftChain } from '../SplineCoaster'` — which is how
// SplineRideKit's flume/rapids/bobsled lifts reach it — is unchanged.
//
// This is a LEAF apart from one TYPE-ONLY import of SplineFrame (erased at
// build time, so there is no runtime cycle with index.tsx). Same split pattern
// as SplineRideKit/{design,pieces,ratings,crash}.ts.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { mat, mergedBoxes, mergedParts } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import type { SplineFrame } from './index';

// ---------------------------------------------------------------------------
// CHAIN LIFT — the mechanised lift hill (shared by every spline ride profile)
//
// This used to be ONE smooth TubeGeometry painted `metal: 0.6`, and it read
// exactly as "a random black rail down the middle": this Stage carries NO
// environment map, so a PBR material past metalness ~0.5 has nothing to
// reflect and renders near-black (the fleet's own 0.2-0.35 band is documented
// in SETUP.md). Two problems in one: the wrong colour AND no mechanism.
//
// A real lift hill is the most obviously ENGINEERED part of a coaster, so it
// is modelled as one now — roller chain with visible link plates and rollers,
// the anti-rollback RATCHET RACK (the thing that does the clanking), drive and
// idler SPROCKETS at the two ends, the MOTOR + GEARBOX at the drive end, side
// GUIDE ROLLERS down the run, the slack RETURN strand, and a maintenance
// CATWALK with a handrail alongside. Everything repeated is batched through
// `mergedBoxes`/`mergedParts`, so the whole assembly costs ~6 draw calls, and
// the fine parts (links, rollers, rack teeth) carry `userData.lodDetail`.
//
// CLEARANCE IS THE HARD CONSTRAINT — every profile's vehicle rides straight
// over this. The DRIVEN STRAND keeps EXACTLY the line and thickness it had
// before (`sides`/`h`/`r` are the caller's existing numbers), so the
// previously documented margins are unchanged by construction; every part
// ADDED here is placed against the measured cross-section of the vehicle that
// rides it (frame coords, y = 0 at the rail/trough centreline, vehicle placed
// at its own runner wheelOffset):
//
//   CoasterCar  half-width 0.335; floor 0.335 on the centreline, 0.69 at
//               |x| 0.10, 0.86 at |x| 0.16, and the WHEEL BOGIES drop to
//               0.045 in the band |x| 0.26-0.34
//   MiniLog     half-width 0.26; hull bottom -0.100 at x = 0, -0.080 at 0.10,
//               -0.024 at 0.18, +0.061 at 0.24 — nothing at all past 0.26
//   MiniSled    half-width 0.21; floor 0.449 on the centreline, 0.155 at
//               |x| 0.14-0.18
//   Rapids raft outer radius 0.455; the TORUS bottoms out at -0.065 but only
//               on the ring |x| 0.285-0.455, and the deck above the
//               centreline sits at +0.035
//
// so: nothing added on the centreline rises above +0.30 (coaster), +0.01
// (rapids); nothing in the |x| 0.24-0.36 wheel/hull band rises above +0.04;
// the rack and catwalk live where the measured floor is highest.
// ---------------------------------------------------------------------------

export interface LiftChainOpts {
  /** first frame index of the climb (detectLiftHill) */
  liftStart: number;
  /** climb length in frames */
  liftLen: number;
  /** lateral offsets of the DRIVEN strand(s) — [0] centreline, [-0.3, 0.3] twin */
  sides: number[];
  /** driven strand height above the centreline (the caller's existing number) */
  h: number;
  /** driven strand half-thickness (the caller's existing tube radius) */
  r: number;
  /** anti-rollback rack lateral offset (omit: no rack — water lifts are belts) */
  rackX?: number;
  /** overall height of the chain TROUGH's side plates (default 2·r + 0.02).
   *  The slack RETURN run of a real lift chain lives inside this channel,
   *  under the driven strand and between the crossties — at one-unit-per-tile
   *  it is never visible, so the channel is what gets modelled. Shrink it on
   *  profiles whose own floor is close under the strand (rapids). */
  troughH?: number;
  /** end sprocket radius */
  sprocketR: number;
  /** motor/gearbox housing lateral offset (its own side of the track) */
  motorX: number;
  /** catwalk inner edge (omit: no catwalk) */
  catwalkX?: number;
  /** RCT2 TrackColour.supports — tints the catwalk + machine housing */
  colour?: number;
}

/** the mechanised chain-lift assembly for one climb — see the note above. */
export function buildLiftChain(t: typeof THREE, frames: SplineFrame[], o: LiftChainOpts): THREE.Group {
  const g = new t.Group();
  const N = frames.length;
  const { liftStart, liftLen } = o;
  // --- arc-length walk along the climb -------------------------------------
  const idx: number[] = [];
  for (let k = 0; k <= liftLen; k++) idx.push((liftStart + k) % N);
  const cum: number[] = [0];
  for (let k = 1; k < idx.length; k++) cum.push(cum[k - 1] + frames[idx[k]].p.distanceTo(frames[idx[k - 1]].p));
  const runLen = cum[cum.length - 1];
  /** frame interpolated at arc distance s along the climb */
  const at = (s: number): SplineFrame => {
    const q = Math.max(0, Math.min(runLen, s));
    let k = 1;
    while (k < cum.length - 1 && cum[k] < q) k++;
    const a = frames[idx[k - 1]];
    const b = frames[idx[k]];
    const tt = (q - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
    return {
      p: a.p.clone().lerp(b.p, tt),
      fwd: a.fwd.clone().lerp(b.fwd, tt).normalize(),
      up: a.up.clone().lerp(b.up, tt).normalize(),
      side: a.side.clone().lerp(b.side, tt).normalize(),
    };
  };
  /** world matrix for a part sitting at (x across, y up) at arc distance s */
  const M = (s: number, x: number, y: number, roll = 0): THREE.Matrix4 => {
    const f = at(s);
    const m = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
    m.setPosition(f.p.clone().addScaledVector(f.side, x).addScaledVector(f.up, y));
    if (roll) m.multiply(new t.Matrix4().makeRotationZ(roll));
    return m;
  };

  const CHAIN = 0x50545a; // dark oiled steel — NOT a black PBR metal
  const BRIGHT = 0x8a9099; // machined steel: sprockets, rollers, rack
  // the catwalk is GALVANISED GRATING, not part of the ride's colour scheme —
  // it only picks up a hint of TrackColour.supports so a red-support coaster
  // doesn't grow a stone-grey walkway (a full tint made it read as a plank)
  const mix = (a: number, b: number, k: number) => {
    const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  const SUP = o.colour === undefined ? 0x9298a0 : mix(0x9298a0, o.colour, 0.12);
  const HOUSE = 0x475049; // painted machine housing (industrial grey-green)

  // --- 1. roller chain: alternating link plates + rollers ------------------
  const PITCH = 0.10;
  const links: MergedBoxSpec[] = [];
  const n = Math.max(2, Math.floor(runLen / PITCH));
  for (const x of o.sides) {
    for (let k = 0; k < n; k++) {
      const s = ((k + 0.5) / n) * runLen;
      const wide = k % 2 === 0; // outer / inner link plates alternate down a roller chain
      links.push({ dims: [wide ? 0.032 : 0.019, 2 * o.r, PITCH * 0.72], matrix: M(s, x, o.h) });
      links.push({ dims: [0.040, 0.7 * o.r, 0.7 * o.r], matrix: M(s + PITCH * 0.5, x, o.h) }); // the roller at the joint
    }
  }
  const chainMesh = mergedBoxes(t, links, CHAIN, { tex: 'metal', rough: 0.5, metal: 0.3 });
  chainMesh.userData.lodDetail = true; // individual links: close-up only
  g.add(chainMesh);
  // a plain strand UNDER the links so the chain still reads as a continuous
  // line once the LOD drops the link detail at distance
  o.sides.forEach((x) => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= liftLen; k++) {
      const f = frames[(liftStart + k) % N];
      pts.push(f.p.clone().addScaledVector(f.side, x).addScaledVector(f.up, o.h));
    }
    const core = new t.Mesh(
      new t.TubeGeometry(new t.CatmullRomCurve3(pts, false), liftLen * 2, o.r * 0.62, 5, false),
      mat(t, CHAIN, { tex: 'metal', repeat: [1, 24], metal: 0.3, rough: 0.55 }),
    );
    core.castShadow = true;
    g.add(core);
  });

  // --- 1b. the chain TROUGH the strand runs in (and the return run hides in)
  {
    const ch = o.troughH ?? 2 * o.r + 0.02;
    const plates: MergedBoxSpec[] = [];
    const PL = 0.8;
    for (const x of o.sides)
      for (let s = 0; s < runLen; s += PL) {
        const l = Math.min(PL, runLen - s);
        if (l < 0.1) break;
        for (const sgn of [-1, 1])
          plates.push({ dims: [0.014, ch, l - 0.015], matrix: M(s + l / 2, x + sgn * (o.r + 0.016), o.h + o.r * 0.4 - ch / 2), repeat: [1, Math.max(1, Math.round(l * 4))] });
      }
    g.add(mergedBoxes(t, plates, 0x646972, { tex: 'metal', metal: 0.28, rough: 0.62 }));
  }

  // --- 2. side guide rollers (VERTICAL axles flanking the strand) ----------
  // THE ENVELOPE INVARIANT: every part added here tops out at or below the
  // driven strand's own top, `h + r` — the exact line the old smooth tube
  // occupied — so no profile's previously measured vehicle margin can move.
  const TOP = o.h + o.r;
  // ONE batch for every small BRIGHT-steel part that only reads close up
  // (guide rollers, rack teeth, sprocket teeth) and one for the solid machine
  // parts — two draw calls instead of five.
  const fine: PartSpec[] = [];
  const solid: PartSpec[] = [];
  const bx = (dims: [number, number, number], matrix: THREE.Matrix4): PartSpec => ({ geo: new t.BoxGeometry(...dims), matrix });
  {
    const rr = Math.min(0.028, Math.max(0.018, o.r * 1.1));
    const TH = 0.026;
    const geo = new t.CylinderGeometry(rr, rr, TH, 8);
    const step = 0.8;
    // twin-strand lifts put their guides OUTBOARD only — an inboard roller
    // would reach in to |x| 0.24 and eat into the log hull's measured margin
    const signs: number[] = o.sides.length > 1 ? [1] : [-1, 1];
    for (let s = step * 0.5; s < runLen; s += step)
      for (const x of o.sides)
        for (const sgn of signs)
          fine.push({ geo, matrix: M(s, x + (x < 0 ? -sgn : sgn) * (o.r + rr * 0.8), TOP - TH / 2) });
  }

  // --- 3. anti-rollback ratchet rack — the clank ---------------------------
  if (o.rackX !== undefined) {
    const RH = o.h; // pawl teeth crest 0.036 above this — level with the chain, never over it
    for (let s = 0; s < runLen - 0.04; s += 0.16) fine.push(bx([0.036, 0.026, 0.15], M(s + 0.08, o.rackX, RH - 0.026))); // the rail
    for (let s = 0.06; s < runLen - 0.06; s += 0.115) fine.push(bx([0.030, 0.036, 0.024], M(s, o.rackX, RH + 0.010))); // the pawl teeth
  }

  // --- 4. sprockets at both ends (drive at the top, idler at the foot) -----
  {
    const R = o.sprocketR;
    // recessed into the track structure so the TEETH crest at `TOP` and not a
    // millimetre higher — a lift sprocket really does sit down between the ties
    const syc = TOP - 1.07 * R;
    const hub = new t.CylinderGeometry(R * 0.82, R * 0.82, 0.05, 14);
    // twin-strand lifts drive only the strand on the motor's side: a cross
    // shaft to the far strand would run straight through the log's hull
    const driven = o.sides.reduce((a, b) => (Math.abs(b - o.motorX) < Math.abs(a - o.motorX) ? b : a), o.sides[0]);
    for (const [s, isDrive] of [[0.1, false], [runLen - 0.1, true]] as [number, boolean][]) {
      for (const x of o.sides) {
        const base = M(s, x, syc);
        // the wheel lies in the track's vertical plane: spin its axis onto `side`
        const m = base.clone().multiply(new t.Matrix4().makeRotationZ(Math.PI / 2));
        solid.push({ geo: hub, matrix: m });
        const nT = 10;
        for (let i = 0; i < nT; i++) {
          const a = (i / nT) * Math.PI * 2;
          fine.push(
            bx(
              [0.042, R * 0.34, 0.03],
              base
                .clone()
                .multiply(new t.Matrix4().makeRotationX(a))
                .multiply(new t.Matrix4().makeTranslation(0, R * 0.9, 0)),
            ),
          );
        }
        if (isDrive && x === driven) {
          // the drive shaft: sprocket → gearbox, laid along the `side` axis
          // dropped 0.02 below the sprocket centre so it passes UNDER the
          // coaster car's wheel bogies (which reach down to +0.045 in the
          // |x| 0.26-0.34 band the shaft has to cross) with room to spare
          const len = Math.abs(o.motorX - x);
          solid.push({
            geo: new t.CylinderGeometry(0.018, 0.018, len, 8),
            matrix: M(s, (x + o.motorX) / 2, syc - 0.02).multiply(new t.Matrix4().makeRotationZ(Math.PI / 2)),
          });
        }
      }
    }
  }

  // --- 5. motor + gearbox at the drive (top) end ---------------------------
  {
    const s = runLen - 0.1;
    const box0: MergedBoxSpec[] = [
      { dims: [0.30, 0.24, 0.44], matrix: M(s - 0.06, o.motorX, o.h + 0.04), repeat: [2, 2] }, // motor housing
      { dims: [0.22, 0.20, 0.20], matrix: M(s + 0.16, o.motorX, o.h + 0.02) }, // gearbox
      { dims: [0.36, 0.05, 0.56], matrix: M(s - 0.02, o.motorX, o.h - 0.10), repeat: [2, 3] }, // bed plate
    ];
    g.add(mergedBoxes(t, box0, HOUSE, { tex: 'metal', metal: 0.28, rough: 0.6 }));
    // cooling fan cowl on the motor's tail, in bright steel
    solid.push({ geo: new t.CylinderGeometry(0.085, 0.085, 0.06, 12), matrix: M(s - 0.30, o.motorX, o.h + 0.04).multiply(new t.Matrix4().makeRotationX(Math.PI / 2)) });
  }

  // the two batched BRIGHT-steel meshes
  g.add(mergedParts(t, solid, mat(t, BRIGHT, { tex: 'metal', metal: 0.32, rough: 0.4 }), true));
  {
    const fineMesh = mergedParts(t, fine, mat(t, BRIGHT, { tex: 'metal', metal: 0.3, rough: 0.45 }), true);
    fineMesh.userData.lodDetail = true; // rollers / rack teeth / sprocket teeth: close-up only
    g.add(fineMesh);
  }

  // --- 6. maintenance catwalk + handrail -----------------------------------
  // only on a climb long enough to be worth walking: the kit's mini rides have
  // 2-3-unit "lifts" where a walkway is just clutter beside a toy-sized chute
  if (o.catwalkX !== undefined && runLen >= 3.5) {
    const X = o.catwalkX;
    const W = 0.44;
    const Y = o.h - 0.16;
    const deck: MergedBoxSpec[] = [];
    const rail: MergedBoxSpec[] = [];
    // SHORT plates: the deck is a rigid chord per plate, and the walkway hangs
    // a full unit off the centreline, so a long plate SPLAYS off a tight climb
    // (the kit's mini flume, which climbs round a 1.5-radius ring, threw its
    // whole catwalk off the track at 0.9). 0.42 tracks any legal radius.
    const PLATE = 0.42;
    let k = 0;
    for (let s = 0; s < runLen; s += PLATE, k++) {
      const l = Math.min(PLATE, runLen - s);
      if (l < 0.12) break;
      deck.push({ dims: [W, 0.035, l + 0.01], matrix: M(s + l / 2, X + W / 2, Y), repeat: [3, Math.max(1, Math.round(l * 4))] });
      if (k % 3 === 0) deck.push({ dims: [X - 0.06, 0.03, 0.05], matrix: M(s + l / 2, (X + 0.06) / 2, Y - 0.02) }); // bracket back to the track
      rail.push({ dims: [0.03, 0.03, l + 0.01], matrix: M(s + l / 2, X + W - 0.03, Y + 0.35) }); // top rail
      rail.push({ dims: [0.022, 0.022, l + 0.01], matrix: M(s + l / 2, X + W - 0.03, Y + 0.20) }); // mid rail
      rail.push({ dims: [0.03, 0.07, l + 0.01], matrix: M(s + l / 2, X + W - 0.02, Y + 0.05) }); // toe board
      if (k % 3 === 1) rail.push({ dims: [0.035, 0.34, 0.035], matrix: M(s + l / 2, X + W - 0.03, Y + 0.19) }); // post
    }
    const deckMesh = mergedBoxes(t, deck, SUP, { tex: 'metal', metal: 0.25, rough: 0.72 });
    g.add(deckMesh);
    const railMesh = mergedBoxes(t, rail, BRIGHT, { tex: 'metal', metal: 0.28, rough: 0.55 });
    railMesh.userData.lodDetail = true;
    g.add(railMesh);
  }

  g.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true;
  });
  return g;
}

