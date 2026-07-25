import React from 'react';
import * as THREE from 'three';
import { cyl, mat, nightKOf } from '../Stage';
import { composable } from '../Park';

// Detailed animated water via a custom GLSL ShaderMaterial, tuned to RCT2's
// bright park water. Six directional wave octaves displace the mesh; the
// fragment stage adds high-frequency procedural ripple normals, crest foam,
// an edge foam ring near the shore (uRadius), depth colour gradient, and a
// deliberately matte shading model: mostly diffuse ambient with only a faint,
// broad sun glint and a subtle Fresnel rim (calm park water, not gloss).
// `radius` clips to a round pool; pass a huge radius for a square sheet
// (TerrainMap). Radius-clipped pools also grow a perimeter DEPTH SKIRT by
// default (see buildWater) so side-on views read a volume of water, not paper.

// NATURAL park-water palette (2026-07 THIRD pass — pass one fixed the navy
// dead-patch problem but overcorrected into a 100%-saturated electric cyan;
// pass two cut saturation to ~50% and still read as vivid "tropical pool"
// cyan-turquoise rather than a real lake). This pass pulls saturation down
// again to ~30-38%, darkens another step, and rotates hue OFF pure
// cyan/turquoise toward a more natural blue-grey with a touch of green in
// the shallows — the desaturated, sky-tinted grey-blue-green of a real
// lake/pool, not a glowing tank. Deep stays CLEARLY blue (never slate/black)
// — shared by the sheet, ribbon and skirt. Depth still darkens, just from a
// much higher floor than the original navy tuning.
// Natural, desaturated lake palette (hue ~195-205°, S ~30-37%) — NOT the old
// electric cyan, but deliberately NOT murky either: a third pass lifted the
// deep/mid stops after a close-up pool render came back near-black on the
// shaded side (that was the ORIGINAL "doesn't look like water" bug returning).
// Deep stays a readable blue-teal (L~29%), never grey-black.
const SHALLOW = 0x7ab8b8;
const MID = 0x477a8c;
const DEEP = 0x2f5266;

// the six directional wave octaves: [dirX, dirY, freq, speed, amp]
const OCTAVES: [number, number, number, number, number][] = [
  [1.0, 0.2, 1.1, 1.3, 0.1],
  [-0.4, 1.0, 1.7, 1.7, 0.07],
  [0.8, 0.8, 0.8, 1.05, 0.065],
  [-0.9, 0.5, 2.3, 2.1, 0.035],
  [0.3, -1.0, 3.1, 2.6, 0.022],
  [-0.7, -0.7, 4.3, 3.2, 0.012],
];

const fmt = (n: number) => {
  const s = n.toFixed(5);
  return s.includes('.') ? s : `${s}.0`;
};

// shared fragment stage (identical for plane sheets and ribbons)
const FRAGMENT = [
  'precision highp float;',
  'uniform float uTime;',
  'uniform float uNight;',
  'uniform float uRadius;',
  'uniform float uWav;',
  'uniform vec3 uShallow;',
  'uniform vec3 uMid;',
  'uniform vec3 uDeep;',
  'uniform vec3 uSun;',
  // scene.fog, hand-plumbed: a raw ShaderMaterial gets NO fog from three, so
  // without these the water stayed fully saturated past the fog wall while
  // every MeshStandard surface hazed out (distant park water read as a bright
  // blue slab). Matches three's LINEAR Fog exactly (fog_fragment: smoothstep
  // over near..far of the view-space depth); syncWaterFog feeds the uniforms
  // from the live scene each frame, and the defaults are "no fog".
  'uniform vec3 uFogColor;',
  'uniform float uFogNear;',
  'uniform float uFogFar;',
  'varying float vFogDepth;',
  'varying float vH;',
  'varying vec3 vWorld;',
  'varying vec2 vLocal;',
  'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  // bilinear value noise (smoothstep-mixed hash): soft organic patches for
  // foam/dither instead of the old floor() hash squares
  'float valueNoise(vec2 p) {',
  '  vec2 i = floor(p);',
  '  vec2 f = p - i;',
  '  vec2 u = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
  '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
  '}',
  // two octaves, second rotated ~37 deg: hides the axis-aligned cell
  // lattice a single octave of value noise would show
  'float noise2(vec2 p) {',
  '  return 0.65 * valueNoise(p) + 0.35 * valueNoise(mat2(0.8, -0.6, 0.6, 0.8) * p * 2.1 + 7.3);',
  '}',
  'void main() {',
  '  float r = length(vLocal);',
  '  if (r > uRadius) discard;',
  '  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));',
  // high-frequency ripple detail: four ROTATED directional wavelets
  // (~37/113/201/289 deg, incommensurate freqs) — no axis-aligned separable
  // sine products, so no rectangular interference grid; gentle x3 gain
  '  float rip = sin(dot(vWorld.xz, vec2(0.799, 0.602)) * 17.0 + uTime * 3.1)',
  '            + 0.7  * sin(dot(vWorld.xz, vec2(-0.391, 0.921)) * 26.0 - uTime * 2.6)',
  '            + 0.5  * sin(dot(vWorld.xz, vec2(-0.934, -0.358)) * 37.0 + uTime * 3.7)',
  '            + 0.35 * sin(dot(vWorld.xz, vec2(0.326, -0.946)) * 47.0 - uTime * 4.4);',
  // noise-modulated amplitude: coherent constant-amplitude sines would
  // still interfere into a visible plaid; this breaks them into patches
  '  rip *= 0.45 + 0.55 * noise2(vWorld.xz * 1.7 + vec2(0.25, -0.2) * uTime);',
  // fade the detail normal where a pixel spans a large world footprint
  // (grazing/far rows), otherwise the ripples alias into moire striations
  '  float fade = clamp(1.0 - length(fwidth(vWorld.xz)) * 45.0, 0.0, 1.0);',
  // uWav scales the detail-normal wobble too, so low-waviness water goes
  // optically calm (fewer shimmer facets), not just geometrically flat
  '  n = normalize(n + vec3(dFdx(rip), 0.0, dFdy(rip)) * 2.5 * fade * uWav);',
  '  vec3 v = normalize(cameraPosition - vWorld);',
  '  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);',
  // three-stop depth gradient driven by wave height; tiny noise dither
  // (+/-0.02) breaks up any visible colour banding between the stops
  // gentler slope + higher bias than the old navy tuning: deep patches stay
  // in the bright mid-blue band instead of pooling at the darkest stop
  '  float hMix = clamp(vH * 2.4 + 0.62 + (noise2(vWorld.xz * 5.0) - 0.5) * 0.04, 0.0, 1.0);',
  '  vec3 base = hMix < 0.5 ? mix(uDeep, uMid, hMix * 2.0) : mix(uMid, uShallow, hMix * 2.0 - 1.0);',
  '  vec3 l = normalize(uSun);',
  '  vec3 hf = normalize(l + v);',
  // faint, broad sun glint: low power widens the highlight, tiny coefficient
  '  float spec = pow(max(dot(n, hf), 0.0), 12.0);',
  // diffuse-led shading: high ambient floor, gentle wave shading on top
  '  float diff = max(dot(n, l), 0.0) * 0.16 + 0.94;',
  // glint tinted CLOSE to the local water colour (2026-07 second pass:
  // pulled from ~22% toward white down to ~16% — a shimmer ~10-18% lighter
  // than the body, never a near-white gloss patch), weighted down over deep
  // water (hMix) and top-down views (fresnel), and BLENDED in via mix
  // rather than added, so it can never blow out over the dark bottom
  '  vec3 glintCol = mix(base, vec3(1.0), 0.16);',
  '  float glint = spec * mix(0.35, 1.0, hMix) * mix(0.55, 1.0, fres) * 0.075;',
  // fresnel rim tint desaturated toward neutral pale (was a saturated
  // sky-blue vec3(0.55,0.78,1.0)) and weighted down — a bright saturated
  // rim was part of the "neon" read at grazing angles
  '  vec3 col = base * diff + fres * vec3(0.75, 0.85, 0.95) * 0.05;',
  '  col = mix(col, glintCol, clamp(glint, 0.0, 1.0));',
  // crest foam: soft drifting value-noise patches on the highest wave tops
  // (the old floor()-hash version flashed hard square cells); foam colour is
  // anchored to the local body colour so crests read as pale water, not
  // stark white islands against the deep blue
  '  float crest = smoothstep(0.16, 0.24, vH);',
  '  float streak = smoothstep(0.45, 0.8, noise2(vWorld.xz * 7.0 + vec2(0.6, -0.4) * uTime));',
  '  col = mix(col, mix(base, vec3(0.93, 0.96, 1.0), 0.55), crest * streak * 0.34);',
  // shore foam at the pool edge (only when a real radius is set) — broken
  // up by world-space hash + directional lapping so it NEVER reads as a
  // clean concentric circle (the old sin(r*26) ring looked like a weird
  // circle at splash pools whenever the water dipped)
  '  if (uRadius < 1000.0) {',
  '    float shore = smoothstep(uRadius - 0.14, uRadius - 0.02, r);',
  '    float breakup = 0.3 + 0.7 * noise2(vWorld.xz * 6.0 + vec2(-0.5, 0.7) * uTime);',
  '    float lap = 0.5 + 0.5 * sin(vLocal.x * 7.0 + vLocal.y * 6.0 - uTime * 1.8 + rip * 3.0);',
  '    col = mix(col, mix(base, vec3(0.94, 0.97, 1.0), 0.6), shore * breakup * lap * 0.4);',
  '  }',
  // sun glints — nearly off, just the rare barely-there twinkle; tinted
  // toward the water colour, depth-weighted like the main glint and scaled
  // by waviness (calm water barely twinkles)
  '  float sp = sin(dot(vWorld.xz, vec2(0.94, 0.34)) * 24.0 + uTime * 6.0) * sin(dot(vWorld.xz, vec2(-0.42, 0.91)) * 22.0 - uTime * 5.0);',
  '  col = mix(col, glintCol, smoothstep(0.98, 1.0, sp) * 0.035 * mix(0.4, 1.0, hMix) * min(uWav, 1.0));',
  // raised opacity floor: underwater ground reads as a soft aqua hint, never
  // grey dead patches punching through the body colour
  // night dimming: the shader is ambient-led (not scene-lit), so without
  // this the bright palette glowed like a lit pool after dark — a cool
  // moonlight multiplier keeps night water subdued and blue-cast
  '  col *= mix(vec3(1.0), vec3(0.34, 0.40, 0.52), uNight);',
  '  float alpha = mix(0.78, 0.9, 1.0 - hMix * 0.6);', // shallows clearer, deeps denser
  // fade out over the last few cm before the radius clip so the pool edge
  // blends into its basin instead of cutting a hard circle
  '  if (uRadius < 1000.0) alpha *= 1.0 - smoothstep(uRadius - 0.08, uRadius - 0.005, r);',
  // distance haze LAST (after night dimming, before the write) — colour only,
  // like three's fog_fragment, so the sheet still reads as translucent water
  // where the haze is thin and dissolves into the horizon where it is thick
  '  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));',
  '  gl_FragColor = vec4(col, alpha);',
  '}',
].join('\n');

/**
 * The shared water ShaderMaterial. Plane mode (no `ribbonLength`): waves ride
 * the plane's local xy (buildWater's PlaneGeometry). Ribbon mode
 * (`ribbonLength` = total arc length): geometry supplies `local` (across,
 * alongArc) + `upv` attributes, waves displace along `upv`, and every
 * octave's along-arc frequency is QUANTIZED to a whole number of cycles over
 * the loop so a closed ribbon's waves meet themselves seamlessly at the seam.
 * `amp` scales the vertex displacement only (colour/foam keep full range —
 * matches the old mesh.scale.z trick). `waviness` (default 1 = current look)
 * is the ONE calm-water knob: it scales the wave field `w` BEFORE both the
 * displacement (so it composes with `amp`: total swell = amp x waviness) and
 * the colour/foam height read (calmer colour churn, less crest foam), plus
 * the fragment-stage ripple-normal wobble and twinkle. 0.4 reads as a still
 * pool; >1 whips the water up.
 */
export function buildWaterMaterial(
  t: typeof THREE,
  opts: { radius?: number; amp?: number; ribbonLength?: number; waviness?: number } = {},
) {
  const radius = opts.radius ?? 1e6;
  const ribbon = opts.ribbonLength;
  let vertexShader: string;
  if (ribbon === undefined) {
    vertexShader = [
      'uniform float uTime;',
      'uniform float uAmp;',
      'uniform float uWav;',
      'varying float vH;',
      'varying vec3 vWorld;',
      'varying vec2 vLocal;',
      'varying float vFogDepth;',
      'void main() {',
      '  vLocal = position.xy;',
      '  vec3 p = position;',
      '  float tme = uTime;',
      '  float w = 0.0;',
      ...OCTAVES.map(
        ([dx, dy, f, s, a]) =>
          `  w += sin(dot(p.xy, vec2(${fmt(dx)}, ${fmt(dy)})) * ${fmt(f)} + tme * ${fmt(s)}) * ${fmt(a)};`,
      ),
      '  w *= uWav;', // waviness scales swell AND the colour/foam height read
      '  p.z += w * uAmp;',
      '  vH = w;',
      '  vec4 wp = modelMatrix * vec4(p, 1.0);',
      '  vWorld = wp.xyz;',
      '  vFogDepth = -(viewMatrix * wp).z;', // view-space depth for the fog mix
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}',
    ].join('\n');
  } else {
    const TAU = Math.PI * 2;
    vertexShader = [
      'uniform float uTime;',
      'uniform float uAmp;',
      'uniform float uWav;',
      'attribute vec2 local;',
      'attribute vec3 upv;',
      'varying float vH;',
      'varying vec3 vWorld;',
      'varying vec2 vLocal;',
      'varying float vFogDepth;',
      'void main() {',
      '  vLocal = local;',
      '  float tme = uTime;',
      '  float w = 0.0;',
      // along-arc frequency snapped to k whole cycles over ribbonLength
      ...OCTAVES.map(([dx, dy, f, s, a]) => {
        const k = Math.round((dy * f * ribbon) / TAU);
        const ay = (k * TAU) / ribbon;
        return `  w += sin(local.x * ${fmt(dx * f)} + local.y * ${fmt(ay)} + tme * ${fmt(s)}) * ${fmt(a)};`;
      }),
      '  w *= uWav;', // waviness scales swell AND the colour/foam height read
      '  vec3 p = position + upv * (w * uAmp);',
      '  vH = w;',
      '  vec4 wp = modelMatrix * vec4(p, 1.0);',
      '  vWorld = wp.xyz;',
      '  vFogDepth = -(viewMatrix * wp).z;', // view-space depth for the fog mix
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}',
    ].join('\n');
  }
  return new t.ShaderMaterial({
    transparent: true,
    depthWrite: false, // real transparency: terrain reads through shallows, no slab look
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uAmp: { value: opts.amp ?? 1 },
      uWav: { value: opts.waviness ?? 1 },
      uRadius: { value: radius },
      uShallow: { value: new t.Color(SHALLOW) },
      uMid: { value: new t.Color(MID) },
      uDeep: { value: new t.Color(DEEP) },
      uSun: { value: new t.Vector3(6, 11, 5).normalize() },
      // fog defaults = OFF (near past any real far plane); syncWaterFog copies
      // the live scene.fog in every frame
      uFogColor: { value: new t.Color(0xffffff) },
      uFogNear: { value: 1e8 },
      uFogFar: { value: 1e8 + 1 },
    },
    vertexShader,
    fragmentShader: FRAGMENT,
  });
}

/**
 * Copy the enclosing scene's LINEAR fog into a water material's fog uniforms
 * (no-op haze when the scene has none, or when the fog is exponential —
 * three's FogExp2 has no near/far). Water is drawn by a raw ShaderMaterial, so
 * three never plumbs `scene.fog` into it: without this call the sheet stays
 * fully saturated past the fog wall while every MeshStandard surface around it
 * hazes out — at long render distances distant water read as a bright blue
 * slab with a hard horizon. Call it from the mesh's per-frame update (the
 * builders in this file already do).
 */
export function syncWaterFog(mesh: THREE.Object3D, material: THREE.ShaderMaterial): void {
  const u = material.uniforms;
  if (!u.uFogNear) return;
  let o: THREE.Object3D | null = mesh;
  while (o && !(o as THREE.Scene).isScene) o = o.parent;
  const fog = (o as THREE.Scene | null)?.fog as THREE.Fog | undefined;
  if (fog && typeof (fog as THREE.Fog).near === 'number') {
    (u.uFogColor.value as THREE.Color).copy(fog.color);
    u.uFogNear.value = fog.near;
    u.uFogFar.value = fog.far;
  } else {
    u.uFogNear.value = 1e8;
    u.uFogFar.value = 1e8 + 1;
  }
}

/**
 * Perimeter DEPTH SKIRT: a short translucent band hanging from the sheet's
 * perimeter (circle when radius-clipped, square otherwise) with a static
 * deep-colour vertical gradient — edge-on the water reads as a volume, not a
 * paper-thin plane. Built in the sheet's LOCAL space (plane xy, -z = down
 * after the sheet's -PI/2 tilt) so it inherits the sheet's transform.
 */
function buildSkirt(t: typeof THREE, size: number, radius: number, depth: number) {
  const round = radius < 1000;
  const geo = round
    ? new t.CylinderGeometry(radius, radius, depth, 64, 1, true)
    : new t.CylinderGeometry(size / Math.SQRT2, size / Math.SQRT2, depth, 4, 1, true, Math.PI / 4);
  const skirtMat = new t.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: t.DoubleSide,
    uniforms: {
      uTop: { value: new t.Color(MID) },
      uBottom: { value: new t.Color(DEEP).multiplyScalar(0.85) },
      uNight: { value: 0 },
      uFogColor: { value: new t.Color(0xffffff) },
      uFogNear: { value: 1e8 },
      uFogFar: { value: 1e8 + 1 },
    },
    vertexShader: [
      'varying float vK;',
      'varying float vFogDepth;',
      'void main() {',
      '  vK = uv.y;', // 0 bottom -> 1 top of the band
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  vFogDepth = -mv.z;',
      '  gl_Position = projectionMatrix * mv;',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uTop;',
      'uniform vec3 uBottom;',
      'uniform float uNight;',
      'uniform vec3 uFogColor;',
      'uniform float uFogNear;',
      'uniform float uFogFar;',
      'varying float vK;',
      'varying float vFogDepth;',
      'void main() {',
      '  vec3 col = mix(uBottom, uTop, vK);',
      '  col *= mix(vec3(1.0), vec3(0.34, 0.40, 0.52), uNight);', // moonlight dim, matches the sheet
      '  float alpha = mix(0.9, 0.78, vK);', // denser toward the depths
      '  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));', // same haze as the sheet
      '  gl_FragColor = vec4(col, alpha);',
      '}',
    ].join('\n'),
  });
  const mesh = new t.Mesh(geo, skirtMat);
  mesh.rotation.x = Math.PI / 2; // cylinder axis -> plane-local z (world up)
  mesh.position.z = -depth / 2; // hang below the sheet
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * Square animated water sheet (optionally radius-clipped to a round pool).
 * `skirt`: perimeter depth-skirt depth — a number for an explicit depth,
 * `false` to disable; default ON (0.16) for radius-clipped pools, off for
 * huge square sheets (TerrainMap supplies its own shores).
 * `amp` scales the vertex swell only (default 1 — the full ±0.30 open-water
 * displacement; colour/foam keep their full range). Shallow basins should
 * pass a smaller amp so wave troughs never dip below their floor — the old
 * full-amp troughs punched through pool floors and read as flat dead patches.
 * `waviness` (default 1 = current look) calms the WHOLE water look: it
 * composes with `amp` on the swell (total displacement = amp x waviness) and
 * also quiets the shader ripple shimmer, colour churn, crest foam and
 * twinkle — pass ~0.4 for a still ornamental pool.
 */
export function buildWater(
  t: typeof THREE, size = 4, seg = 140, radius = 1e6, skirt?: number | false, amp = 1, waviness = 1,
) {
  const geo = new t.PlaneGeometry(size, size, seg, seg);
  const material = buildWaterMaterial(t, { radius, amp, waviness });
  const mesh = new t.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1; // draw after opaque terrain (depthWrite is off)
  const depth = typeof skirt === 'number' ? skirt : skirt === false ? 0 : radius < 1000 ? 0.16 : 0;
  let skirtMat: THREE.ShaderMaterial | null = null;
  if (depth > 0) {
    const sk = buildSkirt(t, size, radius, depth);
    skirtMat = sk.material as THREE.ShaderMaterial;
    mesh.add(sk);
  }
  return {
    mesh,
    update: (time: number) => {
      material.uniforms.uTime.value = time;
      const nk = nightKOf(mesh); // moonlight dim after dark (0 by day)
      material.uniforms.uNight.value = nk;
      syncWaterFog(mesh, material); // haze with the scene, like every other surface
      if (skirtMat) {
        skirtMat.uniforms.uNight.value = nk;
        syncWaterFog(mesh, skirtMat);
      }
    },
  };
}

/**
 * ONE continuous water ribbon following a channel course (RiverRapids etc.):
 * positions come from spline frame samples (`p` centreline, `side` across,
 * optional `up` — wave displacement direction, default +y), width just inside
 * the walls. The plane-local coords attribute is (across, alongArc), so the
 * same wave shader flows CONTINUOUSLY along the channel — no per-reach seams
 * or patchwork tiling; closed loops (last sample == first) also wrap
 * seamlessly thanks to the quantized along-arc wave frequencies.
 * `amp` calms open-water swell to channel chop (default 0.16); `waviness`
 * (default 1) additionally scales the whole wave field — swell (composes
 * with amp), ripple shimmer, colour churn, foam, twinkle — for calmer or
 * rougher channels.
 */
export function buildWaterRibbon(
  t: typeof THREE,
  points: { p: THREE.Vector3; side: THREE.Vector3; up?: THREE.Vector3 }[],
  width: number,
  opts: { amp?: number; across?: number; waviness?: number } = {},
) {
  const across = Math.max(2, opts.across ?? 4);
  const n = points.length;
  // cumulative arc length along the centreline
  const arc: number[] = [0];
  for (let i = 1; i < n; i++) arc.push(arc[i - 1] + points[i].p.distanceTo(points[i - 1].p));
  const total = arc[n - 1];
  const pos = new Float32Array(n * (across + 1) * 3);
  const loc = new Float32Array(n * (across + 1) * 2);
  const ups = new Float32Array(n * (across + 1) * 3);
  const upDefault = new t.Vector3(0, 1, 0);
  const v = new t.Vector3();
  for (let i = 0; i < n; i++) {
    const { p, side } = points[i];
    const up = points[i].up ?? upDefault;
    for (let j = 0; j <= across; j++) {
      const x = -width / 2 + (j / across) * width;
      v.copy(p).addScaledVector(side, x);
      const k = (i * (across + 1) + j) * 3;
      pos[k] = v.x;
      pos[k + 1] = v.y;
      pos[k + 2] = v.z;
      ups[k] = up.x;
      ups[k + 1] = up.y;
      ups[k + 2] = up.z;
      const k2 = (i * (across + 1) + j) * 2;
      loc[k2] = x;
      loc[k2 + 1] = arc[i];
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + across + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new t.BufferGeometry();
  geo.setAttribute('position', new t.BufferAttribute(pos, 3));
  geo.setAttribute('local', new t.BufferAttribute(loc, 2));
  geo.setAttribute('upv', new t.BufferAttribute(ups, 3));
  geo.setIndex(idx);
  const material = buildWaterMaterial(t, { ribbonLength: total, amp: opts.amp ?? 0.16, waviness: opts.waviness });
  const mesh = new t.Mesh(geo, material);
  mesh.renderOrder = 1;
  return {
    mesh,
    update: (time: number) => {
      material.uniforms.uTime.value = time;
      material.uniforms.uNight.value = nightKOf(mesh); // moonlight dim after dark
      syncWaterFog(mesh, material); // channel water hazes with the scene too
    },
  };
}

export function buildWaterTileScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // opaque sand basin (top at y=0) + aqua pool floor a touch deeper than
        // the shader's deep colour, so the read-through under the transparent
        // sheet stays a natural lagoon-blue hint (never a dark dead patch);
        // re-matched to the 2026-07 third-pass desaturated DEEP so the floor
        // doesn't read as a leftover neon patch under the calmer sheet
        g.add(cyl(t, 2.9, 3.05, 0.7, 0xcdb98a, [0, -0.35, 0], { tex: 'sand', repeat: [10, 2], rough: 1, seg: 48 }));
        g.add(cyl(t, 2.36, 2.36, 0.14, 0x2f5266, [0, 0, 0], { rough: 0.35, seg: 48 })); // matches DEEP — read-through never darker than the water
        // beach berm: an annular lathe ring hugging the shoreline — its crest
        // (y 0.19) stands above the water sheet (y 0.16) and both feet land on
        // the basin top, so waves lap a real beach instead of a floating disc
        const prof = [
          [2.3, 0.0],
          [2.44, 0.15],
          [2.6, 0.19],
          [2.76, 0.12],
          [2.86, 0.0],
        ].map(([r, yy]) => new t.Vector2(r, yy));
        const bermMat = mat(t, 0x9a8a5f, { tex: 'sand', repeat: [12, 1], rough: 1 });
        bermMat.side = t.DoubleSide;
        const berm = new t.Mesh(new t.LatheGeometry(prof, 48), bermMat);
        berm.castShadow = true;
        berm.receiveShadow = true;
        g.add(berm);
        // amp 0.22: troughs bottom out at 0.093 — always above the pool floor
        // top (0.07), so the sheet never clips through to bare shaded floor
        const water = buildWater(t, 4.8, 140, 2.32, undefined, 0.22);
        water.mesh.position.y = 0.16;
        g.add(water.mesh);
        return (time) => water.update(time);
      })(three, group) || undefined;
  return { group, update };
}

/** <WaterTile> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const WaterTile = composable('WaterTile', (t) => buildWaterTileScene(t));
