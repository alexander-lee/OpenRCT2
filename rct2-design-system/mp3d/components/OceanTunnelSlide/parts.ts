// ---------------------------------------------------------------------------
// OceanTunnelSlide / parts.ts — PALETTE + the rig's reusable parts: merged-box
// bar/blade specs, tapered spars, the water draw-order helper, lanterns, kelp,
// the FISH SHOAL, the reef-bore maths (segDist2 / cutColumns) the basin cuts
// its hole with, the glass TUBE SHELL, and the TUBE RAFT.
//
// Split out of ./index.tsx for FILE SIZE ONLY — Magic Patterns writes whole
// files and the rig no longer fits one call. The <OceanTunnelSlide> component
// and its props stay declared in index.tsx (the prop extractor reads only
// index.tsx and cannot see through a re-export); buildFishShoal and
// buildTubeRaft are plain functions, so index.tsx re-exports them and the
// public surface is unchanged.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, mergedParts } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { buildEmitter } from '../ParticleKit';
import { hash01 } from '../ColorKit';
import type { TrackScheme, VehicleScheme } from '../ColorKit';
import { TIDEWATER } from '../TidewaterScenery';

// ---- palette (Tidewater Hollow) -------------------------------------------
/** the flooded channel inside the tube: the same brine-green trough and
 *  driftwood rims Reef Racer and Deep Drift run in */
export const TRACK_COLOURS: TrackScheme = { main: 0x47624f, additional: 0x8a7c66, supports: 0x6a5a44 };
/** the raft: dark rubberised canvas, bleached rope, brass fittings */
export const RAFT_LIVERY: VehicleScheme = { body: 0x37474a, trim: 0xb3aa90, tertiary: 0x94793f };

export const IRON = 0x59524a;
export const IRON_D = 0x474139;
export const RUST = TIDEWATER.rust;
export const BRASS = TIDEWATER.brass;
export const TIMBER = TIDEWATER.driftwood;
export const TIMBER_D = TIDEWATER.timberWet;
export const TAR = TIDEWATER.tar;
export const ROPE = TIDEWATER.rope;
export const WEED = TIDEWATER.weed;
export const WEED_D = TIDEWATER.weedDark;
export const SAND = 0xd6cca6; // Reef Racer's coral sand — one beach, one world
export const SAND_2 = 0xc2b68d;
export const SAND_WET = 0xb3a681;
export const SAND_BED = 0xcfc49c;
// ---- THE LAGOON BED, GRADED BY DEPTH --------------------------------------
// WaterTile's sheet is ~86 % opaque and — this is the bit that decides how the
// bed has to be painted — its alpha is driven by WAVE HEIGHT, not by depth. So
// a bed at one tone shows through at one strength wherever it is, and the pool
// reads as a flat painted disc however carefully the floor is shelved. The
// GEOMETRY of the dish buys the shore transition; the only thing that can carry
// a depth GRADIENT through a depth-blind shader is the bed's own colour.
//
// Three stops, and they are deliberately far apart: only ~14 % of the bed
// reaches the eye through the sheet, so a subtle ramp is a ramp of nothing.
// SHOAL is nearly white sand (the rim shelf, 0.12 under), BED is the coral sand
// of the mid dish, DEEP is a dark olive-teal — NOT grey-black: the palette this
// system settled on keeps deep water a readable blue-teal, and a black floor
// under it read as a hole rather than as depth.
// SHOAL was 0xe6dcbc first, and at close range that was too near white: the
// pale plates read as glazed TILES through the water rather than as sand,
// because a merged-box lattice gives every plate a hard rectangular edge and a
// near-white fill puts maximum contrast on it. Pulled back one step, and the
// class boundary is HASH-DITHERED where it is chosen (index.tsx §5) so the three
// tones interleave into mottled patches instead of drawing clean depth contours.
export const SAND_SHOAL = 0xdccfa6;
export const SAND_DEEP = 0x62705f;
export const REEF = 0x8f846c;
export const REEF_D = 0x776a54;
export const LAMP_GLASS = 0xfff4d2;
export const LAMP_GLOW = 0xffb84c;
/** the tube shell: a pale blue-green GLASS, kept matte */
export const GLASS = 0xbcd9d8;
/** what the tube glows after dark — a cold aquarium teal, NOT the warm
 *  LAMP_GLOW the deck and stair lanterns burn. The two must not match: a warm
 *  tube would read as a lit corridor, and the whole point of the shot is that
 *  this tunnel is under water. */
export const GLASS_GLOW = 0x62c4c8;
/** fish: two natural shoal liveries, silver-blue and olive-gold */
export const FISH_A = 0x7b8f9b;
export const FISH_B = 0x87794f;

// ---------------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------------

/** one merged box spanning A → B (its Y axis runs along the bar) */
export function barSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, thick: number, repeat?: [number, number]): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  const m = new t.Matrix4().makeRotationFromQuaternion(
    new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
  );
  m.setPosition(a.clone().addScaledVector(dir, 0.5));
  return { dims: [thick, len, thick], matrix: m, ...(repeat ? { repeat } : {}) };
}

/** a FLAT blade spanning A → B (kelp): the width axis is kept horizontal, so a
 *  frond reads as a leaf and not as a green joist */
export function bladeSpec(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, w: number, thick: number): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = Math.max(0.02, dir.length());
  dir.normalize();
  const side = new t.Vector3().crossVectors(new t.Vector3(0, 1, 0), dir);
  if (side.lengthSq() < 1e-5) side.set(1, 0, 0);
  side.normalize();
  const up2 = new t.Vector3().crossVectors(dir, side).normalize();
  const m = new t.Matrix4().makeBasis(side, dir, up2);
  m.setPosition(a.clone().addScaledVector(dir, len * 0.5));
  return { dims: [w, len, thick], matrix: m, repeat: [1, 2] };
}

/** a TAPERED round spar between two points (piles, masts) */
export function spar(t: typeof THREE, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, colour: number, tex: 'wood' | 'metal' = 'wood'): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = Math.max(0.05, dir.length());
  const m = cyl(t, r1, r0, len, colour, [0, 0, 0], { tex, repeat: [3, Math.max(1, Math.round(len * 1.6))], rough: 0.9, seg: 10 });
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}

/**
 * DRAW THIS AFTER THE WATER.
 *
 * WaterTile's sheet is ~80% opaque and is drawn in the TRANSPARENT pass
 * (renderOrder 1), which means every OPAQUE object — the raft, its riders, the
 * tube's ironwork, the channel itself — is drawn BEFORE it and gets veiled to a
 * fifth of its contrast the moment it goes under the surface. The raft dropping
 * through the reef basin is the whole point of this ride, so anything that has
 * to read through water is flipped into the transparent pass at full opacity:
 * `transparent` with `opacity 1` renders identically, just later. `depthWrite`
 * stays on so the parts still sort against each other properly.
 */
export function drawAfterWater(root: THREE.Object3D, order = 3): void {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const mm of Array.isArray(m) ? m : [m]) {
      if (!mm) continue;
      mm.transparent = true;
      if ((mm as THREE.MeshStandardMaterial).opacity === 1) mm.depthWrite = true;
    }
    o.renderOrder = order;
  });
}

/** Tag every mesh under `root` as REEF ROCK. The bore audit needs to know
 *  exactly which meshes are rock and which are theming: material colours are
 *  baked into the procedural textures (Stage's `mat` leaves `color` white when
 *  `tex` is set), so a probe cannot recover "is this rock?" from the material,
 *  and guessing by triangle count is how a probe silently stops testing the
 *  thing it was written to test. */
export function tagRock<T extends THREE.Object3D>(root: T): T {
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.userData.reefRock = true;
  });
  return root;
}

/** a small brass-caged LANTERN — the glass material is returned for gating */
export function shipLantern(t: typeof THREE, scale = 1): { group: THREE.Group; glass: THREE.MeshStandardMaterial } {
  const grp = new t.Group();
  const s = scale;
  grp.add(cyl(t, 0.07 * s, 0.05 * s, 0.05 * s, BRASS, [0, 0.16 * s, 0], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 8 }));
  grp.add(cyl(t, 0.055 * s, 0.07 * s, 0.04 * s, BRASS, [0, -0.14 * s, 0], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 8 }));
  const cage: MergedBoxSpec[] = [];
  for (let k = 0; k < 4; k += 1) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    cage.push({ dims: [0.014 * s, 0.28 * s, 0.014 * s], pos: [Math.cos(a) * 0.055 * s, 0, Math.sin(a) * 0.055 * s] });
  }
  cage.push({ dims: [0.016 * s, 0.09 * s, 0.016 * s], pos: [0, 0.22 * s, 0] });
  grp.add(mergedBoxes(t, cage, BRASS, { tex: 'metal', metal: 0.65, rough: 0.45 }));
  const globe = ball(t, 0.058 * s, LAMP_GLASS, [0, 0, 0], { emissive: LAMP_GLOW, rough: 0.3 });
  (globe.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
  grp.add(globe);
  return { group: grp, glass: globe.material as THREE.MeshStandardMaterial };
}

/** a clump of KELP — five flat blades off one holdfast, all leaning one way.
 *  'fabric', never 'leaf': the leaf texture's 1.3× saturation boost turns weed
 *  into bright lawn green (the ReefRacer note). */
export function kelpClump(t: typeof THREE, seed: number, scale = 1, order = 0): THREE.Group {
  const grp = new t.Group();
  const h = (n: number) => hash01(seed * 3.61 + n * 2.29);
  const lean = h(1) * Math.PI * 2;
  const specs: MergedBoxSpec[] = [];
  for (let k = 0; k < 5; k += 1) {
    const a = lean + (k - 2) * 0.32 + (h(k + 2) - 0.5) * 0.3;
    const len = scale * (0.55 + 0.6 * h(k + 3));
    const foot = new t.Vector3((h(k + 4) - 0.5) * scale * 0.16, 0, (h(k + 5) - 0.5) * scale * 0.16);
    const knee = foot.clone().add(new t.Vector3(Math.cos(a) * len * 0.18, len * 0.62, Math.sin(a) * len * 0.18));
    const tip = knee.clone().add(new t.Vector3(Math.cos(a) * len * 0.6, len * 0.3, Math.sin(a) * len * 0.6));
    specs.push(bladeSpec(t, foot, knee, scale * 0.11, scale * 0.024));
    specs.push(bladeSpec(t, knee, tip, scale * 0.15, scale * 0.02));
  }
  const m = mergedBoxes(t, specs, h(9) > 0.5 ? WEED : WEED_D, { tex: 'fabric', rough: 0.94, bump: 0.03 });
  if (order) {
    // drawn AFTER the water sheet, so weed standing in the lagoon reads as weed
    // in water instead of a shape veiled under an 80%-opaque lid
    const mm = m.material as THREE.MeshStandardMaterial;
    mm.transparent = true;
    mm.opacity = 0.98;
    m.renderOrder = order;
  }
  grp.add(m);
  grp.userData.lodDetail = true;
  return grp;
}

// ---------------------------------------------------------------------------
// FISH — a shoal is ONE merged mesh, and each fish is three boxes: a body, a
// tail fin and a dorsal. Three parts is the minimum that reads as a fish rather
// than as a floating pill; a whole shoal is one draw call, and the shoal GROUP
// is what swims (a hashed circuit on absolute time), so nothing is skinned.
// ---------------------------------------------------------------------------

export interface FishShoalOpts {
  /** fish in the shoal (default 12) */
  count?: number;
  /** body length of one fish (default 0.2) */
  size?: number;
  /** renderOrder — drawn after WaterTile's sheet so the shoal reads IN the
   *  water and not under it (default 3) */
  order?: number;
}

/** A shoal of fish, all headed the same way, spread through a lens-shaped
 *  volume. Exported for parks dressing their own reefs. */
export function buildFishShoal(t: typeof THREE, seed: number, opts: FishShoalOpts = {}): THREE.Group {
  const grp = new t.Group();
  const n = opts.count ?? 12;
  const S = opts.size ?? 0.17;
  const h = (k: number) => hash01(seed * 1.93 + k * 4.31);
  const specs: MergedBoxSpec[] = [];
  for (let k = 0; k < n; k += 1) {
    const px = (h(k) - 0.5) * S * 9;
    const py = (h(k + 40) - 0.5) * S * 3.4;
    const pz = (h(k + 80) - 0.5) * S * 5.5;
    const yaw = (h(k + 120) - 0.5) * 0.5; // the shoal points one way, roughly
    const sc = 0.7 + 0.6 * h(k + 160);
    const m = new t.Matrix4().makeRotationY(yaw);
    m.setPosition(px, py, pz);
    specs.push({ dims: [S * 0.26 * sc, S * 0.4 * sc, S * sc], matrix: m }); // the body
    const mt = new t.Matrix4().makeRotationY(yaw);
    mt.setPosition(px - Math.sin(yaw) * S * 0.62 * sc, py, pz - Math.cos(yaw) * S * 0.62 * sc);
    specs.push({ dims: [S * 0.045 * sc, S * 0.38 * sc, S * 0.28 * sc], matrix: mt }); // the tail fin
    const md = new t.Matrix4().makeRotationY(yaw);
    md.setPosition(px, py + S * 0.28 * sc, pz);
    specs.push({ dims: [S * 0.04 * sc, S * 0.2 * sc, S * 0.36 * sc], matrix: md }); // the dorsal
  }
  const mesh = mergedBoxes(t, specs, seed % 2 ? FISH_A : FISH_B, { tex: 'plastic', rough: 0.68, metal: 0.05 });
  const mm = mesh.material as THREE.MeshStandardMaterial;
  mm.transparent = true;
  mm.opacity = 0.98;
  mesh.renderOrder = opts.order ?? 3;
  mesh.castShadow = false;
  grp.add(mesh);
  grp.userData.lodDetail = true;
  return grp;
}

// ---------------------------------------------------------------------------
// THE TUBE — the signature.
//
// A shell swept over the kit's own spline frames: for each frame, a ring of
// vertices about a point `TUBE_C` above the channel centreline. Transparent,
// MATTE (roughness 0.55, metalness 0, no environment map — this system has
// de-glossed its water twice and a mirror-bright tube would undo it), and
// drawn LAST WITHOUT WRITING DEPTH (`depthWrite = false`, renderOrder 4 — see
// the layering note at the shell's own build site): a transparent shell that
// wrote depth would put its NEAR wall in the depth buffer and everything
// inside the tube, the raft included, would be depth-rejected.
//
// SECTION — centre `TUBE_C` 0.30 above the rail, radius `TUBE_R` 0.95, and the
// RADIUS IS SET BY THE RAFT, not by taste. The raft is a torus of outer radius
// 0.77 whose ring plane rides ~0.41 BELOW the tube axis (the axis is lifted
// 0.30 so the crown clears heads), so its lowest outboard vertex sits
// 0.883 from the axis (measured, not derived — the raft also sits a little low in the trough). At the first pass's 0.82 that is
// −0.051 — the buoyancy ring passed THROUGH the glass along the tube's lower
// flank for 15 % of the lap, measured by sweeping the ungated lap and testing
// every raft vertex against the shell's own recovered ring centres (probe:
// tw-clash.tsx). 0.95 restores +0.067 of daylight there, and the crown goes to
// TUBE_C + TUBE_R = 1.25 against a rider's ~0.80, i.e. 0.45 of headroom. The
// trough floor is at −0.10 and its walls reach +0.18, so the shell also stands
// further off the channel than it did. Everything hung on the tube (hoop ribs
// at +0.035, the four longitudinal rails, the brass mouth collars at +0.08)
// derives from TUBE_R and follows it.
// ---------------------------------------------------------------------------
export const TUBE_C = 0.3;
export const TUBE_R = 0.95;

// ---------------------------------------------------------------------------
// THE BORE — the hole the tube is driven THROUGH the reef wall.
//
// The first pass had no hole. The seaward wall was NOTCHED — its top dropped to
// `basinY − 0.55`, which is a hair above the tube's crown — so the wall came
// down to the tube and then BURIED it: measured along the tube's own axis, 30
// of 401 stations sat INSIDE solid rock and the clear radius on the crossing
// was 0.00 for three units of arc. The tube passed through and the rock never
// acknowledged it, so from the raft and from the park camera the slide ran into
// a cliff. That is the whole of the "it looks blocked" complaint.
//
// The fix is a real bore, and it is DERIVED, never a second hard-coded radius:
// the shell (0.95), its hoop ribs (+0.035, half thickness 0.028 → 1.013) and a
// mouth ring (1.16) all fit inside it, and if the raft ever forces `TUBE_R`
// wider again the hole widens with it. Everything below hangs off `BORE_R`: the
// throat's inner skin, the cut rim, the arch over the mouth and the rejection
// test that keeps the spoil out of the opening.
//
// THE CLEARANCE IS SET BY WHAT A RIDER SEES, NOT BY WHAT FITS. `TUBE_R + 0.30`
// fit — the audit was clean, the worst rock-to-axis over the crossing measured
// 1.233 against the 1.25 invariant, nothing was inside the bore — and the ride
// still read as blocked, because 0.28 of daylight between the glass and the
// rock is not daylight at all. The shell is 40 % transparent, so reef pressed
// that close to it is drawn THROUGH the tunnel wall at full size and fills the
// view down the chute; from the raft the slide runs into a rock face and the
// riders look like they are inside it. So the bore is now `TUBE_R + 0.75`:
// 0.75 of visible air all round the glass, a bore you can see the far end
// through, and the reef reads as a tunnel cut through it rather than as a plug
// resting on the tube. (Verified with harness/mp3d-render/probe-ots-profile.mjs,
// which recovers the axis from the shell's own ring centroids and measures
// point-to-triangle: worst rock-to-axis over the crossing 1.233 → 1.70.)
// ---------------------------------------------------------------------------
export const BORE_R = TUBE_R + 0.75;
// THE MOUTH IS READ AS A VALUE STEP, not as a shape. At the park camera the
// whole portal is about forty pixels across, and the first pass tinted the
// throat 0x554a3c and the rim 0xa1957a — both within a shade of the weathered
// reef (0x8f846c / 0x776a54) they sit in, so the hole vanished into the rock at
// any distance. These two are deliberately the darkest and the palest things in
// the reef palette: a PALE cut rim round a BLACK throat still reads as a hole
// when it is a dozen pixels wide.
/** the throat's own rock — a bore is not lit inside */
export const REEF_X = 0x39312a;
/** freshly cut stone, the brightest rock in the component */
export const REEF_L = 0xc0b498;

/** squared distance from a point to a segment, no allocations (this runs in a
 *  triple loop over every wall column) */
export function segDist2(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const dd = abx * abx + aby * aby + abz * abz;
  let s = dd > 1e-9 ? (apx * abx + apy * aby + apz * abz) / dd : 0;
  s = s < 0 ? 0 : s > 1 ? 1 : s;
  const dx = apx - abx * s;
  const dy = apy - aby * s;
  const dz = apz - abz * s;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Cut a WALL PRISM into columns with the bore taken out of it.
 *
 * The reef wall and the pool's lining are rings of merged boxes, so the hole
 * cannot be a boolean subtraction — but it does not need to be. Each box is a
 * vertical prism, so it is re-emitted as a 3 × 3 grid of columns and each
 * column keeps only the runs of height that are CLEAR of the bore. Every run is
 * tested at its eight corners and its centre against the tube's real axis
 * polyline, so no emitted box can reach inside `BORE_R` — the opening is clear
 * BY CONSTRUCTION rather than by a radius someone remembered to keep in sync.
 * The 0.11-unit slabs also leave the cut edge stepped and ragged, which is what
 * broken rock round a bore looks like.
 */
export function cutColumns(
  out: MergedBoxSpec[],
  o: { cx: number; cz: number; w: number; d: number; rotY: number; y0: number; y1: number; repeat?: [number, number] },
  clearAt: (x: number, y: number, z: number) => boolean,
): void {
  const NX = 3;
  const NZ = 3;
  const ca = Math.cos(o.rotY);
  const sa = Math.sin(o.rotY);
  const cw = o.w / NX;
  const cd = o.d / NZ;
  const NY = Math.max(6, Math.round((o.y1 - o.y0) / 0.11));
  const hy = (o.y1 - o.y0) / NY;
  for (let ix = 0; ix < NX; ix += 1)
    for (let iz = 0; iz < NZ; iz += 1) {
      const lx = -o.w / 2 + cw * (ix + 0.5);
      const lz = -o.d / 2 + cd * (iz + 0.5);
      const wx = o.cx + lx * ca + lz * sa;
      const wz = o.cz - lx * sa + lz * ca;
      // the column's four corners in world XZ, plus its centre
      const cor: [number, number][] = [[wx, wz]];
      for (const sx of [-0.5, 0.5])
        for (const sz of [-0.5, 0.5]) {
          const ox = sx * cw;
          const oz = sz * cd;
          cor.push([wx + ox * ca + oz * sa, wz - ox * sa + oz * ca]);
        }
      let runStart = -1;
      const flush = (endK: number) => {
        if (runStart < 0) return;
        const ya = o.y0 + runStart * hy;
        const yb = o.y0 + endK * hy;
        if (yb - ya >= 0.14) out.push({ dims: [cw, yb - ya, cd], pos: [wx, (ya + yb) / 2, wz], rotY: o.rotY, ...(o.repeat ? { repeat: o.repeat } : {}) });
        runStart = -1;
      };
      for (let k = 0; k < NY; k += 1) {
        const ya = o.y0 + k * hy;
        const yb = ya + hy;
        let clear = true;
        for (const [x, z] of cor) {
          if (!clearAt(x, ya, z) || !clearAt(x, yb, z)) {
            clear = false;
            break;
          }
        }
        if (clear) {
          if (runStart < 0) runStart = k;
        } else flush(k);
      }
      flush(NY);
    }
}

export function buildTubeShell(
  t: typeof THREE,
  frames: { p: THREE.Vector3; side: THREE.Vector3; up: THREE.Vector3 }[],
  material: THREE.Material,
  seg = 18,
): THREE.Mesh {
  const n = frames.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const arc: number[] = [0];
  for (let i = 1; i < n; i += 1) arc.push(arc[i - 1] + frames[i].p.distanceTo(frames[i - 1].p));
  for (let i = 0; i < n; i += 1) {
    const f = frames[i];
    const c = f.p.clone().addScaledVector(f.up, TUBE_C);
    for (let j = 0; j <= seg; j += 1) {
      const a = (j / seg) * Math.PI * 2;
      const v = c
        .clone()
        .addScaledVector(f.side, Math.cos(a) * TUBE_R)
        .addScaledVector(f.up, Math.sin(a) * TUBE_R);
      pos.push(v.x, v.y, v.z);
      uv.push((a / (Math.PI * 2)) * 2, arc[i] * 0.6);
    }
  }
  for (let i = 0; i < n - 1; i += 1)
    for (let j = 0; j < seg; j += 1) {
      const a = i * (seg + 1) + j;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const geo = new t.BufferGeometry();
  geo.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new t.Mesh(geo, material);
  mesh.renderOrder = 2;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// THE RAFT — a four-seat round raft: two rubberised canvas tubes, a slatted
// floor, four seat pads with grab straps and a brass bow ring.
// ---------------------------------------------------------------------------
export const RAFT_R = 0.62;
export const SEAT_A = [0.6, 2.17, 3.74, 5.31]; // four seats, evenly round the ring
/** hips sit 0.45 × scale above a seated buildPeep's group origin (Teacups) */
export const HIP_RISE = 0.45 * 0.42;

export interface TubeRaftOpts {
  /** decorative seated riders (default true — <OceanTunnelSlide register> turns
   *  them OFF so REAL GameManager guests fill the seats through seatWorld) */
  riders?: boolean;
  /** seat anchors are pushed here in seat order, for seatWorld */
  seats?: THREE.Object3D[];
}

/** The raft. Exported for parks composing their own fleets. */
export function buildTubeRaft(t: typeof THREE, scheme?: VehicleScheme, opts: TubeRaftOpts = {}): THREE.Group {
  const raft = new t.Group();
  const BODY = scheme?.body ?? RAFT_LIVERY.body!;
  const TRIM = scheme?.trim ?? RAFT_LIVERY.trim!;
  const METAL = scheme?.tertiary ?? BRASS;

  // the two buoyancy tubes — a torus reads as an inflatable at any distance
  const tubeMat = mat(t, BODY, { tex: 'fabric', repeat: [8, 2], rough: 0.88, bump: 0.03 });
  const outer = new t.Mesh(new t.TorusGeometry(RAFT_R, 0.15, 8, 22), tubeMat);
  outer.position.y = 0.02;
  outer.rotation.x = Math.PI / 2;
  outer.castShadow = true;
  raft.add(outer);
  const inner = new t.Mesh(new t.TorusGeometry(RAFT_R - 0.16, 0.1, 7, 20), mat(t, TIMBER_D, { tex: 'fabric', repeat: [8, 2], rough: 0.9 }));
  inner.position.y = -0.06;
  inner.rotation.x = Math.PI / 2;
  raft.add(inner);
  // lashing round the outer tube, and the rubbing strake
  const lash: MergedBoxSpec[] = [];
  for (let k = 0; k < 16; k += 1) {
    const a = (k / 16) * Math.PI * 2;
    lash.push({ dims: [0.06, 0.36, 0.06], pos: [Math.cos(a) * RAFT_R, 0.02, Math.sin(a) * RAFT_R], rotY: -a, rotZ: 0.2 });
  }
  const lashMesh = mergedBoxes(t, lash, ROPE, { tex: 'fabric', rough: 0.95 });
  lashMesh.userData.lodDetail = true;
  raft.add(lashMesh);

  // a slatted floor, and the four seat pads with grab straps
  const deck: MergedBoxSpec[] = [];
  for (let k = 0; k < 7; k += 1) {
    const z = -0.44 + k * 0.148;
    const w = 2 * Math.sqrt(Math.max(0.01, (RAFT_R - 0.14) ** 2 - z * z));
    deck.push({ dims: [w, 0.035, 0.11], pos: [0, -0.12, z], repeat: [2, 1] });
  }
  raft.add(mergedBoxes(t, deck, TIMBER, { tex: 'wood', rough: 0.9, bump: 0.03 }));
  const seats: MergedBoxSpec[] = [];
  SEAT_A.forEach((a) => {
    const rx = Math.cos(a) * (RAFT_R - 0.3);
    const rz = Math.sin(a) * (RAFT_R - 0.3);
    seats.push({ dims: [0.3, 0.06, 0.26], pos: [rx, -0.05, rz], rotY: -a, repeat: [2, 1] }); // the pad
    seats.push({ dims: [0.28, 0.05, 0.05], pos: [rx * 1.5, 0.16, rz * 1.5], rotY: -a }); // its grab strap
  });
  raft.add(mergedBoxes(t, seats, TAR, { tex: 'fabric', rough: 0.92 }));
  // brass bow ring + a painted number plate
  const ring = new t.Mesh(new t.TorusGeometry(0.05, 0.014, 6, 12), mat(t, METAL, { tex: 'metal', metal: 0.6, rough: 0.45 }));
  ring.position.set(0, 0.06, RAFT_R + 0.05);
  ring.rotation.x = Math.PI / 2;
  raft.add(ring);
  raft.add(box(t, [0.2, 0.12, 0.04], TRIM, [0, 0.08, -RAFT_R - 0.06], { tex: 'plastic', rough: 0.7 }));

  // ---- seat anchors ride WITH the raft, so REAL guests ride the slide ----
  SEAT_A.forEach((a, i) => {
    const anchor = new t.Group();
    anchor.position.set(Math.cos(a) * (RAFT_R - 0.3), -0.03 - HIP_RISE, Math.sin(a) * (RAFT_R - 0.3));
    anchor.rotation.y = -a + Math.PI / 2;
    raft.add(anchor);
    opts.seats?.push(anchor);
    if (opts.riders ?? true) {
      const p = buildPeep(t, {
        skin: SKIN_TONES[(i + 2) % SKIN_TONES.length],
        shirt: SHIRTS[(i + 3) % SHIRTS.length],
        seated: true,
        expression: i % 2 ? 'surprised' : 'happy',
      });
      p.group.scale.setScalar(0.42);
      p.group.position.copy(anchor.position);
      p.group.rotation.y = anchor.rotation.y;
      raft.add(p.group);
    }
  });
  return raft;
}

