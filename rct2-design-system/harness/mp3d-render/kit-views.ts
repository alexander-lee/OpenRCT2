// ---------------------------------------------------------------------------
// kit-views.ts — zero-arg BUILDERS for every Kit asset + variant.
//
// `<Kit>`'s ScenePreview auto-rotates and exposes no camera prop, and
// shot-views.mjs / the kit probes can only call `fn(THREE)` and want
// `{ group, update? }` back. Kit's builders take option objects and half of
// them return a bare Group, so each export here pins ONE variant and
// normalises the return.
//
//   node shot-views.mjs treeRound --comp=../../harness/mp3d-render/kit-views:treeRound
//   node probe-kit-cost.mjs
//   node probe-kit-attach.mjs
//
// `kit-views-before.ts` is the same list against `kit-before-src.ts` (the
// pre-fidelity-pass snapshot), so every number has a matched pair.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as Kit from '../../mp3d/components/Kit';

type T = typeof THREE;
type Built = { group: THREE.Group; update?: (time: number) => void };
const wrap = (g: THREE.Group): Built => ({ group: g });

export const treeRound = (t: T): Built => wrap(Kit.tree(t, { shape: 'round' }));
export const treePine = (t: T): Built => wrap(Kit.tree(t, { shape: 'pine' }));
export const treePalm = (t: T): Built => wrap(Kit.tree(t, { shape: 'palm' }));
export const treeWillow = (t: T): Built => wrap(Kit.tree(t, { shape: 'willow' }));
export const bench = (t: T): Built => wrap(Kit.bench(t));
export const bin = (t: T): Built => wrap(Kit.bin(t));
export const hedge = (t: T): Built => wrap(Kit.hedge(t, 2));
export const flowerBed = (t: T): Built => wrap(Kit.flowerBed(t));
export const rock = (t: T): Built => wrap(Kit.rock(t));
export const statueObelisk = (t: T): Built => wrap(Kit.statue(t, 'obelisk'));
export const statueKnight = (t: T): Built => wrap(Kit.statue(t, 'knight'));
export const statueUrn = (t: T): Built => wrap(Kit.statue(t, 'urn'));
export const statueGiraffe = (t: T): Built => wrap(Kit.statue(t, 'giraffe'));
export const foodStall = (t: T): Built => wrap(Kit.foodStall(t));
export const fence = (t: T): Built => wrap(Kit.fence(t, 2));
export const lamp = (t: T): Built => Kit.lamp(t);
export const fountain = (t: T): Built => Kit.fountain(t);

/** every name above, in report order — the probes iterate this */
export const KIT_VIEWS = [
  'treeRound',
  'treePine',
  'treePalm',
  'treeWillow',
  'bench',
  'bin',
  'hedge',
  'flowerBed',
  'rock',
  'statueObelisk',
  'statueKnight',
  'statueUrn',
  'statueGiraffe',
  'foodStall',
  'fence',
  'lamp',
  'fountain',
] as const;

/** the three DOWNSTREAM-CONSUMED builders, at the scales real call sites use
 *  (ParkBuilder/dressing scatters 0.55–0.95, CoasterBuilder 0.8/0.9,
 *  Boulevard passes its own). Bounds here MUST NOT MOVE. */
export const BOUNDS_CASES: { name: string; build: (t: T) => THREE.Object3D }[] = [
  { name: 'tree round s1', build: (t) => Kit.tree(t, { shape: 'round' }) },
  { name: 'tree pine s1', build: (t) => Kit.tree(t, { shape: 'pine' }) },
  { name: 'tree palm s1', build: (t) => Kit.tree(t, { shape: 'palm' }) },
  { name: 'tree willow s1', build: (t) => Kit.tree(t, { shape: 'willow' }) },
  { name: 'tree round s0.55', build: (t) => Kit.tree(t, { shape: 'round', scale: 0.55 }) },
  { name: 'tree pine s0.9', build: (t) => Kit.tree(t, { shape: 'pine', scale: 0.9 }) },
  { name: 'tree palm s0.8', build: (t) => Kit.tree(t, { shape: 'palm', scale: 0.8 }) },
  { name: 'tree willow s0.95', build: (t) => Kit.tree(t, { shape: 'willow', scale: 0.95 }) },
  { name: 'bench', build: (t) => Kit.bench(t) },
  { name: 'bin', build: (t) => Kit.bin(t) },
];
