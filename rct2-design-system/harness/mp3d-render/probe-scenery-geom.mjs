#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-scenery-geom.mjs — DOES EACH PART LIE ON THE SURFACE IT DRESSES?
//
// Four SceneryPack pieces shipped with detail that was placed in the WRONG
// FRAME — a roof pitched the wrong way, railings rotated per-bay by a varying
// error, seam ribs built as straight rods on a sphere, parasol ribs tilted
// about world X instead of their own tangent. Every one of those is invisible
// in a mesh/triangle count and invisible in an auto-rotating preview, and every
// one is a single number once you measure the part against the surface it is
// supposed to follow. This measures them.
//
//   node probe-scenery-geom.mjs            # audit the working tree
//   node probe-scenery-geom.mjs --src=DIR  # audit some other SceneryPack dir
//                                          # (used to prove the probe can FAIL)
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const argSrc = process.argv.find((a) => a.startsWith('--src='));
const SRC = argSrc ? path.resolve(argSrc.slice(6)) : path.join(REPO, 'components/SceneryPack');
const TAG = path.basename(SRC);
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const entry = path.join(OUT, `_geom-entry-${TAG}.ts`);
fs.writeFileSync(
  entry,
  `export { buildSceneryAnimated } from ${JSON.stringify(path.join(SRC, 'index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, `_geom-bundle-${TAG}.mjs`);
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundlePath,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  platform: 'node',
  target: 'node20',
  logLevel: 'error',
});
const grad = () => ({ addColorStop() {} });
const ctx2d = new Proxy({ measureText: () => ({ width: 0 }) }, {
  get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.endsWith('Gradient') ? grad : () => {}),
  set: () => true,
});
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? { width: 128, height: 128, getContext: () => ctx2d, style: {} } : { style: {} }),
};
const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;

const quiet = console.warn;
const piece = (name) => {
  console.warn = () => {};
  const built = K.buildSceneryAnimated(T, name, { seed: 3 });
  console.warn = quiet;
  built.group.updateMatrixWorld(true);
  return built.group;
};
/** every mesh vertex in WORLD space, plus the mesh it came from */
function verts(root, filter = () => true) {
  const out = [];
  const v = new T.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || !filter(o)) return;
    const pa = o.geometry.getAttribute('position');
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
      out.push({ x: v.x, y: v.y, z: v.z, mesh: o });
    }
  });
  return out;
}
const results = [];
const check = (piece, what, ok, detail) => results.push({ piece, what, ok, detail });

// ---------------------------------------------------------------------------
// 1. wishingWell — the roof must be a GABLE: the high edge of each slab is the
//    one at the ridge (|z| small), the low edge is the eave (|z| large). A
//    butterfly roof inverts exactly that, and nothing else about the piece
//    changes, so this single comparison is the whole test.
// ---------------------------------------------------------------------------
{
  const g = piece('wishingWell');
  // the two slabs are the only BoxGeometry with a ~0.045 thickness and a depth
  // over 0.5 — identify by geometry parameters, not by colour (mat() bakes tone
  // into the texture canvas and leaves material.color white)
  const isSlab = (o) => {
    const p = o.geometry.parameters;
    return p && p.height > 0.03 && p.height < 0.06 && p.depth > 0.5 && p.width > 1.0;
  };
  const vs = verts(g, isSlab);
  const slabs = [...new Set(vs.map((p) => p.mesh))];
  let worst = null;
  for (const m of slabs) {
    const mine = vs.filter((p) => p.mesh === m);
    const hi = mine.reduce((a, b) => (b.y > a.y ? b : a));
    const lo = mine.reduce((a, b) => (b.y < a.y ? b : a));
    const d = { ridgeZ: +Math.abs(hi.z).toFixed(3), ridgeY: +hi.y.toFixed(3), eaveZ: +Math.abs(lo.z).toFixed(3), eaveY: +lo.y.toFixed(3) };
    if (!worst || Math.abs(hi.z) - Math.abs(lo.z) > worst.m) worst = { m: Math.abs(hi.z) - Math.abs(lo.z), d };
  }
  check('wishingWell', `roof is a GABLE (high edge inboard) — ${slabs.length} slabs`, slabs.length === 2 && worst.m < 0, JSON.stringify(worst.d));
  // and it must actually shelter the shaft: the drum rim is radius 0.58
  const zReach = Math.max(...vs.map((p) => Math.abs(p.z)));
  check('wishingWell', 'roof overhangs the 0.58 rim', zReach > 0.58, `roof reaches |z| ${zReach.toFixed(3)}`);
}

// ---------------------------------------------------------------------------
// 2. gazebo — every railing box must be PERPENDICULAR to its own radius. The
//    old bug put each panel on the right chord midpoint at the wrong angle, and
//    the angle error varied per bay, so a "same for all six" test would have
//    missed it. Per-box principal axis vs that box's own radial direction is
//    the invariant that cannot be satisfied by a wrong constant.
// ---------------------------------------------------------------------------
{
  const g = piece('gazebo');
  // the railing batches are merged boxes living in the rail band 0.30–0.80
  const railBand = (o) => {
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    return b.min.y > 0.25 && b.max.y < 0.85;
  };
  const vs = verts(g, railBand);
  const meshes = [...new Set(vs.map((p) => p.mesh))];
  // mergedBoxes appends 24 vertices per box in order, so slice them back apart
  let worstDeg = 0;
  let worstR = 0;
  let boxes = 0;
  for (const m of meshes) {
    const mine = vs.filter((p) => p.mesh === m);
    for (let i = 0; i + 24 <= mine.length; i += 24) {
      const b = mine.slice(i, i + 24);
      const c = b.reduce((a, p) => ({ x: a.x + p.x / 24, y: a.y + p.y / 24, z: a.z + p.z / 24 }), { x: 0, y: 0, z: 0 });
      // dominant horizontal axis of the xz covariance, IN CLOSED FORM. Power
      // iteration seeded at (1,0) silently returns the WRONG eigenvector when
      // the box happens to be axis-aligned — (1,0) is then already an exact
      // eigenvector, so every iteration is a no-op and it reports the minor
      // axis. That dropped 6 of the 15 rails (the axis-aligned ones) from the
      // count while the 9 it did test read a clean 0.00°: a probe silently
      // grading 60% of the thing it claims to cover.
      let cxx = 0;
      let cxz = 0;
      let czz = 0;
      for (const p of b) {
        cxx += (p.x - c.x) ** 2;
        cxz += (p.x - c.x) * (p.z - c.z);
        czz += (p.z - c.z) ** 2;
      }
      const th = 0.5 * Math.atan2(2 * cxz, cxx - czz);
      const ax = Math.cos(th);
      const az = Math.sin(th);
      const rl = Math.hypot(c.x, c.z);
      if (rl < 0.2) continue; // a part on the axis has no radial direction
      // A BALUSTER IS 0.025 x 0.025 IN PLAN, so its xz covariance is isotropic
      // and the power iteration returns an arbitrary direction — which read as a
      // flat 90.00° error on a gazebo whose rails were provably correct. Only a
      // box with a genuine long horizontal axis has an orientation to test.
      const l1 = cxx * ax * ax + 2 * cxz * ax * az + czz * az * az;
      const l2 = cxx + czz - l1; // trace − dominant
      if (l1 < 4 * l2) continue;
      boxes += 1;
      // angle between the box's long axis and the tangent at its own position
      const dot = Math.abs((ax * c.x + az * c.z) / rl); // 0 = perpendicular = correct
      worstDeg = Math.max(worstDeg, (Math.asin(Math.min(1, dot)) * 180) / Math.PI);
      worstR = Math.max(worstR, Math.max(...b.map((p) => Math.hypot(p.x, p.z))));
    }
  }
  check('gazebo', `all ${boxes} railing boxes are tangential to their own bay`, boxes >= 12 && worstDeg < 2, `worst off-tangent ${worstDeg.toFixed(2)}°`);
  // A rail on its chord reaches its own post at r 0.98 and no further. The bound
  // was 1.42 (the eave) at first, which the 90°-wrong rails cleared at 1.339 —
  // an assertion loose enough to pass the exact defect it sits next to.
  check('gazebo', 'no railing box splays past the post circle', worstR < 1.10, `furthest railing vertex r ${worstR.toFixed(3)} (posts at 0.98)`);
  // ---- the entrance steps must butt onto the plinth FACE ------------------
  // The plinth is a HEXAGON, so "distance from the axis" is the wrong ruler: its
  // own corners sit at 1.36 while the face a step lands on is at the apothem
  // 1.178, and measuring radius made the plinth itself look like a floating
  // step 0.122 out. Use the hexagon's SUPPORT FUNCTION — max over the six face
  // normals — which is exactly 1.178 for every point of the plinth and larger
  // only for something genuinely outboard of it.
  const plinthFace = 1.36 * Math.cos(Math.PI / 6);
  const support = (p) => {
    let h = -Infinity;
    for (let j = 0; j < 6; j++) {
      const n = Math.PI / 3 + (j / 6) * Math.PI * 2; // face normals at the bay mid-angles
      h = Math.max(h, p.x * Math.cos(n) + p.z * Math.sin(n));
    }
    return h;
  };
  // steps live in a shared merged batch with trim that reaches y 1.84, so select
  // by VERTEX height rather than by mesh. Anything low and outboard of the
  // plinth's support is a step; the plinth's own hull sits exactly AT it.
  const low = verts(g).filter((p) => p.y < 0.1 && support(p) > plinthFace + 0.005);
  // The flight must be a CHAIN from the plinth face outward. Testing "min support
  // ≈ plinthFace" cannot work: a box face flush with the plinth is excluded by
  // the very filter that identifies steps, so a correct flight reported a 0.180
  // gap. What actually distinguishes a flight from a plank on the grass is that
  // no consecutive pair of its faces is further apart than one tread.
  const TREAD = 0.18;
  const planes = [...new Set([plinthFace, ...low.map((p) => Math.round(support(p) * 1000) / 1000)])].sort((a, b) => a - b);
  let worstJump = 0;
  for (let i = 1; i < planes.length; i++) worstJump = Math.max(worstJump, planes[i] - planes[i - 1]);
  const reach = planes[planes.length - 1];
  check(
    'gazebo',
    'entrance steps form an unbroken flight off the plinth face',
    low.length > 0 && worstJump <= TREAD + 0.01,
    `${low.length} step verts, planes [${planes.map((p) => p.toFixed(3)).join(', ')}], worst jump ${worstJump.toFixed(3)}, reach ${reach.toFixed(3)}`,
  );
}

// ---------------------------------------------------------------------------
// 3. hotAirBalloon — every seam-rib vertex must sit ON the envelope ellipsoid.
//    Measured as radial excess along the ray from the envelope centre, in world
//    units: how far the rib stands off the skin it is supposed to be sewn into.
// ---------------------------------------------------------------------------
{
  const g = piece('hotAirBalloon');
  const RXZ = 0.95;
  const RY = 0.95 * 1.15;
  const CY = 1.95;
  // ribs are the dark-red seam parts: the tall thin geometry between the crown
  // and the throat. Select by extent — anything spanning >1.2 in y and living
  // outside radius 0.25 but inside 1.05 is envelope dressing.
  const ribMesh = (o) => {
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    const tall = b.max.y - b.min.y > 1.2;
    const wide = Math.max(Math.abs(b.max.x), Math.abs(b.min.x)) > 0.4;
    return tall && wide && b.min.y > 0.6 && b.max.y < 3.2;
  };
  const vs = verts(g, ribMesh);
  let worst = 0;
  let worstPt = null;
  for (const p of vs) {
    const dy = p.y - CY;
    const rr = Math.hypot(p.x, p.z);
    const k = Math.hypot(rr / RXZ, dy / RY); // 1 = exactly on the skin
    // radial excess in world units along that ray
    const excess = (k - 1) * Math.hypot(rr, dy);
    if (Math.abs(excess) > Math.abs(worst)) {
      worst = excess;
      worstPt = p;
    }
  }
  check(
    'hotAirBalloon',
    'seam ribs + gores follow the envelope (|offset| < 0.06)',
    vs.length > 0 && Math.abs(worst) < 0.06,
    `${vs.length} rib verts, worst radial offset ${worst.toFixed(3)} at y ${worstPt ? worstPt.y.toFixed(2) : '-'}`,
  );
}

// ---------------------------------------------------------------------------
// 4. picnicTable — every parasol rib must lie ON the canopy cone. Measured as
//    the vertical gap to the cone surface at that vertex's own radius, which is
//    the quantity a rib tilted about the wrong axis gets wrong.
// ---------------------------------------------------------------------------
{
  const g = piece('picnicTable');
  const coneY = (r) => 2.225 - ((r - 0.02) / (1.0 - 0.02)) * 0.45;
  // THE SELECTOR HAS TO FIND THE RIBS IN A BROKEN BUILD TOO. A first cut keyed
  // on `min.y > 1.7` matched nothing once the ribs tilted (they then reach down
  // to 1.67), so the gap check "failed" on an empty set and the hem check PASSED
  // on an empty set — a green light from a measurement that never happened.
  // Widened to the whole canopy zone, and the count is now asserted.
  //   - `!geometry.parameters` keeps merged batches only, excluding the cone
  //     primitive, which otherwise matches every extent test the ribs do
  //   - a >0.3 y-extent separates the ribs from the valance batch (0.11)
  const ribMesh = (o) => {
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    const dy = b.max.y - b.min.y;
    return !o.geometry.parameters && b.min.y > 1.5 && b.max.y < 2.3 && dy > 0.3 && dy < 0.6 && b.max.x > 0.8 && b.min.x < -0.8;
  };
  const vs = verts(g, ribMesh);
  check('picnicTable', 'the parasol rib batch was actually found', vs.length > 100, `${vs.length} rib verts selected`);
  let worstGap = 0;
  let worstR = 0;
  for (const p of vs) {
    const r = Math.hypot(p.x, p.z);
    worstR = Math.max(worstR, r);
    const gap = p.y - coneY(Math.max(r, 0.02));
    if (Math.abs(gap) > Math.abs(worstGap)) worstGap = gap;
  }
  check('picnicTable', 'parasol ribs lie on the canopy (|gap| < 0.05)', vs.length > 100 && Math.abs(worstGap) < 0.05, `${vs.length} rib verts, worst gap ${worstGap.toFixed(3)}`);
  check('picnicTable', 'no rib overshoots the 1.0 hem', vs.length > 100 && worstR < 1.06, `furthest rib vertex r ${worstR.toFixed(3)}`);
}

// ---------------------------------------------------------------------------
// 5. marbleStatue — each HAND must actually touch the arm it hangs off. Found
//    while auditing the other sixteen pieces: the lowered arm's rotZ sign was
//    inverted, so its hand floated 0.14 clear of the wrist.
//
//    AN AABB TEST CANNOT SEE THIS, and it is worth writing down why: the broken
//    arm's box spans x [−0.266, −0.074] / y [1.139, 1.501] and the loose hand
//    spans x [−0.295, −0.205] / y [1.105, 1.195] — the two boxes DO overlap, so
//    a bounding-box connectivity probe reports the hand as attached. It takes
//    exact point-to-OBB distance to tell a wrist from a near miss.
// ---------------------------------------------------------------------------
{
  const g = piece('marbleStatue');
  const arms = [];
  const hands = [];
  g.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.parameters;
    if (!p) return;
    if (p.width === 0.07 && p.depth === 0.07 && (p.height === 0.42 || p.height === 0.36)) arms.push(o);
    // ball() builds an IcosahedronGeometry; the two hands are the 0.045/0.04 ones
    if (p.radius === 0.045 || p.radius === 0.04) hands.push({ mesh: o, r: p.radius });
  });
  /** exact distance from a world point to a box's solid volume */
  const toBox = (pt, mesh) => {
    const q = pt.clone().applyMatrix4(new T.Matrix4().copy(mesh.matrixWorld).invert());
    const p = mesh.geometry.parameters;
    const h = [p.width / 2, p.height / 2, p.depth / 2];
    const d = new T.Vector3(
      Math.max(0, Math.abs(q.x) - h[0]),
      Math.max(0, Math.abs(q.y) - h[1]),
      Math.max(0, Math.abs(q.z) - h[2]),
    );
    return d.length();
  };
  let worst = 0;
  for (const hand of hands) {
    const c = new T.Vector3().setFromMatrixPosition(hand.mesh.matrixWorld);
    const gap = Math.min(...arms.map((a) => toBox(c, a))) - hand.r;
    worst = Math.max(worst, gap);
  }
  check(
    'marbleStatue',
    'both hands are attached to an arm',
    arms.length === 2 && hands.length === 2 && worst <= 0,
    `${arms.length} arms, ${hands.length} hands, worst wrist gap ${worst.toFixed(3)}`,
  );
}

// ---------------------------------------------------------------------------
let bad = 0;
console.log(`\n  probe-scenery-geom · source: ${SRC}\n`);
for (const r of results) {
  if (!r.ok) bad += 1;
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.piece.padEnd(15)} ${r.what}`);
  console.log(`        ${r.detail}`);
}
console.log(`\n  ${results.length - bad}/${results.length} checks pass\n`);
process.exit(bad ? 1 : 0);
