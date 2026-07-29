// ---------------------------------------------------------------------------
// PathNetwork / ribbon.ts — THE PATH CROSS-SECTION, in one place.
//
// WHY THIS FILE EXISTS
//
// A street in this design system is not just its wearing course. `build.ts`
// lays THREE courses on every span — a pave slab carried 0.02 below grade, pale
// KERB strips straddling both free edges 0.01 proud of the slab top, and
// EXPANSION-JOINT SEAMS every half tile — and that trim is what makes pavement
// read as pavement from the park camera.
//
// The RIDE ACCESS runs (`GameManager/access.ts`: the queue lane into a ride's
// entrance hut and the ordinary footpath out of its exit) are the same kind of
// path — RCT2 builds them out of footpath tiles like everything else — but they
// were each drawn by their own inline slab code with their own copies of the
// numbers. The queue lane had no kerbs and no seams at all (one bare box), and
// the exit path re-derived the cross-section by hand. Two copies of a
// cross-section drift: the exit path's slab was 0.09 thick where the network's
// is 0.11, so its edge showed an air gap the street's never does, and nothing
// stopped the next edit to one from missing the other.
//
// So the cross-section lives HERE and every straight run of pavement in the
// park — street span, ramp ribbon, queue lane, exit path — is emitted by
// `pathRibbon`. Change a number once and the whole park follows.
//
// LEAF-ish MODULE: it imports Stage only (for the merge spec type + Matrix4
// maths via the caller's `three`), never ./index.tsx, so it cannot join the
// `SetPieceKit -> PathNetwork -> Park -> SetPieceKit` cycle ./surfaces.ts
// documents. `GameManager/access.ts` imports it directly for the same reason it
// imports ./surfaces directly.
// ---------------------------------------------------------------------------

import type * as THREE from 'three';
import type { MergedBoxSpec } from '../Stage';

// ---- THE CROSS-SECTION ----------------------------------------------------
/** the walked surface sits this far above a path's DATUM (a node's level, a
 *  ride pad's level). `walkYAt` reports `datum + PATH_H`. */
export const PATH_H = 0.09;
/** rendered slab thickness: the 0.09 course PLUS the 0.02 it is carried below
 *  grade, so there is never an air gap between slab and ground at the edge */
export const PATH_SLAB = PATH_H + 0.02;
/** kerb strip width, and how far its top stands proud of the slab top */
export const PATH_KERB_W = 0.08;
export const PATH_KERB_PROUD = 0.01;
/** kerb centreline offset from the slab's centre, for a run of `width` — the
 *  strip STRADDLES the slab edge (this is `build.ts`'s `kerbOff`) */
export const kerbOffsetFor = (width: number) => width / 2 + 0.02;
/** expansion joints: one every half tile, this far proud of the slab */
export const PATH_SEAM_EVERY = 0.5;
export const PATH_SEAM_PROUD = 0.004;
export const PATH_SEAM_T = 0.02;
export const PATH_SEAM_H = 0.012;
/** default street width (`buildPathNetwork`'s `opts.width` default) */
export const PATH_WIDTH = 1.2;

/**
 * THE LIP: how far the network's RENDERED pavement stands above the `walkYAt`
 * datum. `build.ts` finishes its junction pads and every ramp ribbon at
 * `padTop = PATH_H + 0.006` (a deliberate 6 mm, so a pad's faces are never
 * coplanar with a passing slab's and the joins cannot z-fight), while `walkYAt`
 * — the SIM's datum, what guests set their feet with — reports the nominal
 * `PATH_H`.
 *
 * That 6 mm is why every ride access run used to end BELOW the street it joined:
 * both lanes were graded to `walkYAt` and so stopped 6 mm (measured 5-12 mm with
 * the per-edge slab jitter) under the pavement's actual top. An access run must
 * ramp to `walkYAt + PATH_PAD_LIP` to land flush on what is really drawn there.
 *
 * Do NOT "fix" this by moving `walkYAt`: it is the guest-height datum and every
 * queue slot, bench, stall front and waypoint in the sim is expressed against
 * it. The rendered lip is a rendering concern and belongs here.
 */
export const PATH_PAD_LIP = 0.006;
/** a junction pad's / ramp ribbon's finished walked level above the datum */
export const PATH_PAD_TOP = PATH_H + PATH_PAD_LIP;
/** RCT2's sloped-path limit: one 0.5 height step per 1.2 tile */
export const PATH_MAX_GRADE = 0.5 / 1.2;

/** the three merge buckets a ribbon emits into — one draw call each */
export interface RibbonSpecs {
  pave: MergedBoxSpec[];
  kerb: MergedBoxSpec[];
  seam: MergedBoxSpec[];
}
export const newRibbonSpecs = (): RibbonSpecs => ({ pave: [], kerb: [], seam: [] });

/** one straight cardinal run of pavement, in the CALLER's frame */
export interface RibbonRun {
  /** near end, in the caller's xz */
  from: [number, number];
  /** unit direction (near -> far) */
  dir: [number, number];
  /** PLAN length (horizontal run, not slope length) */
  len: number;
  /** WALKED SURFACE height at `from` and at the far end (caller's y frame).
   *  Equal ⇒ a level run; different ⇒ an RCT2 sloped path, and the kerbs and
   *  seams ride the incline with the slab. */
  surfFrom: number;
  surfTo: number;
}

export interface RibbonOpts {
  /** slab width (default PATH_WIDTH) */
  width?: number;
  /** lay kerb strips down both sides (default true — a QUEUE is railed instead,
   *  so it passes false and gets its edge from the Fence run) */
  kerbs?: boolean;
  /** lay expansion-joint seams (default true) */
  seams?: boolean;
  /** take this much off EACH end of the kerb run (an L's corner, a junction
   *  pad's kerb corner block) */
  kerbTrim?: number;
  /** rendered slab thickness (default PATH_SLAB) */
  thickness?: number;
  /** texture repeat across the WIDTH of the pave slab (default 4, the street's;
   *  a 0.55-wide access lane uses 2) */
  paveRepeatX?: number;
  /** skip seams closer than this to either end (default 0.35 — clear of a
   *  junction pad, exactly `build.ts`'s inset) */
  seamInset?: number;
}

/**
 * Emit one straight run of pavement — slab + kerbs + seams — into `out`.
 *
 * Everything is positioned in the run's own INCLINED frame, so on a sloped run
 * the kerbs and seams sit ON the tilted plane instead of being offset
 * vertically off it (the bug that made a hand-rolled ramp's kerb float at the
 * top end and sink at the bottom). Yaw is applied first and pitch about the
 * yawed local x — the same `YXZ` convention `build.ts` uses, so a ribbon
 * emitted here and a ribbon emitted there join without a step.
 *
 * The returned value is the run's slope length (the slab's actual length), which
 * callers use for texture repeats and for stepping along the run.
 */
export function pathRibbon(t: typeof THREE, out: RibbonSpecs, run: RibbonRun, o: RibbonOpts = {}): number {
  const width = o.width ?? PATH_WIDTH;
  const th = o.thickness ?? PATH_SLAB;
  const len = Math.max(1e-6, run.len);
  const rise = run.surfTo - run.surfFrom;
  const slope = Math.hypot(len, rise); // the slab's real length
  const yaw = Math.atan2(run.dir[0], run.dir[1]);
  const pitch = -Math.atan2(rise, len); // far end rises with `rise`
  // centre of the run ON its walked-surface plane
  const cx = run.from[0] + run.dir[0] * (len / 2);
  const cz = run.from[1] + run.dir[1] * (len / 2);
  const cy = (run.surfFrom + run.surfTo) / 2;
  const eul = new t.Euler(pitch, yaw, 0, 'YXZ');
  const rot = new t.Matrix4().makeRotationFromEuler(eul);
  const ax = new t.Vector3(1, 0, 0).applyMatrix4(rot); // lateral
  const az = new t.Vector3(0, 0, 1).applyMatrix4(rot); // along the run
  const up = new t.Vector3(0, 1, 0).applyMatrix4(rot); // off the plane
  /** a box whose TOP face lies `proud` above the plane, `lat` sideways and
   *  `fwd` along it (both measured ON the plane, in slope units) */
  const put = (
    specs: MergedBoxSpec[],
    dims: [number, number, number],
    lat: number,
    fwd: number,
    proud: number,
    repeat?: [number, number],
  ) => {
    const off = proud - dims[1] / 2;
    const m = new t.Matrix4().copy(rot);
    m.setPosition(
      cx + ax.x * lat + az.x * fwd + up.x * off,
      cy + ax.y * lat + az.y * fwd + up.y * off,
      cz + ax.z * lat + az.z * fwd + up.z * off,
    );
    specs.push(repeat ? { dims, matrix: m, repeat } : { dims, matrix: m });
  };
  // 1. the wearing course
  put(out.pave, [width, th, slope], 0, 0, 0, [o.paveRepeatX ?? 4, Math.max(2, Math.round(slope * 3.3))]);
  // 2. the kerbs — 0.01 proud of the slab top, straddling both edges
  if (o.kerbs !== false) {
    const kerbLen = slope - 2 * (o.kerbTrim ?? 0.02);
    if (kerbLen > 0.15) {
      const koff = kerbOffsetFor(width);
      [-1, 1].forEach((s) =>
        put(out.kerb, [PATH_KERB_W, th + PATH_KERB_PROUD, kerbLen], s * koff, 0, PATH_KERB_PROUD, [
          1,
          Math.max(2, Math.round(kerbLen * 3.3)),
        ]),
      );
    }
  }
  // 3. expansion-joint seams every half tile, ON the incline
  if (o.seams !== false) {
    const inset = o.seamInset ?? 0.35;
    for (let f = -slope / 2 + inset; f <= slope / 2 - inset + 1e-9; f += PATH_SEAM_EVERY)
      put(out.seam, [width, PATH_SEAM_H, PATH_SEAM_T], 0, f, PATH_SEAM_PROUD);
  }
  return slope;
}
