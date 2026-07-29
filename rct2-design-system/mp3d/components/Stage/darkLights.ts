// ---------------------------------------------------------------------------
// darkLights.ts — SHED THE LIGHTS THAT ARE ALREADY SWITCHED OFF.
//
// Split out of `Stage/index.tsx` for FILE SIZE (Magic Patterns replaces whole
// files, and index.tsx is already at the ceiling); `Stage/index.tsx` imports it
// and re-exports `createDarkLightCull`, so the public import surface is
// unchanged. Same pattern as `SplineCoaster/liftChain.ts`.
//
// ---- THE PROBLEM, MEASURED ------------------------------------------------
//
// The fleet convention is emissive-only bulbs plus a handful of REAL lights,
// and every real one is NIGHT-GATED: the component lerps `intensity` from 0 at
// noon up to its lit value as `nightKOf()` rises. By DAY, therefore, almost
// every PointLight in a composed park sits at `intensity === 0`.
//
// An `intensity === 0` light is NOT free. three.js decides a material's shader
// permutation from the number of lights it collected while walking the scene,
// and it only skips a light when `light.visible === false` — an intensity of
// zero still books a slot in `pointLights[]` and still makes every
// MeshStandardMaterial fragment run one more full PBR loop iteration whose
// result is multiplied by zero.
//
// DemoPark (`components/Park/Park.previews.tsx`), size 16, headless chromium +
// SwiftShader, measured by `harness/mp3d-render/probe-render-cost.mjs` with the
// four variants INTERLEAVED over 5 rounds (a first attempt ran them as four
// consecutive blocks and the re-timed baseline came back 37% slower than the
// identical first baseline — machine drift, not signal):
//
//   24 point/spot lights in the scene, of which 3 LIT and 21 DARK by day
//
//   variant                        ms/frame   draws   triangles
//   baseline                          397.9    1750     400 518
//   dark lights visible = false       232.6    1776     405 090   -42%
//   shadow depth pass frozen          335.1     942     227 730   -16%
//   both                              237.6     971     233 022   -40%
//
// So: culling the dark lights is worth **-42% of the frame** and changes NO
// draw call and NO triangle — the picture is bit-identical, because a light
// contributing zero radiance contributes zero radiance either way. (And it is
// the whole win: freezing the shadow pass ON TOP of it bought nothing, which is
// why the Stage still re-renders its depth map every frame.)
//
// ---- WHY IT IS SAFE -------------------------------------------------------
//
// Two rules keep this from ever changing a rendered pixel or fighting another
// owner of `visible`:
//
//  1. **Hysteresis, not a bare threshold.** A light is shed once its intensity
//     falls below `OFF` and restored once it climbs above `ON`; in between it
//     keeps whatever state it has. A lamp lerping through the dead band during
//     a day/night transition therefore flips at most once, so three.js
//     recompiles the forward programs once per transition rather than every
//     cadence tick.
//  2. **It only ever restores lights IT shed.** Nothing in the fleet sets a
//     light's `visible` (checked across `components/`), but `<Park budgets={{
//     lights }}`'s opt-in nearest-N cap does. Culled lights are remembered in a
//     Set and no other light is ever switched on, so the two compose as an
//     intersection (nearest-N AND lit) instead of overwriting each other.
//
// The cull re-walks the scene on a CADENCE (default 0.25 s) rather than every
// frame: a park mounts and disposes lights while its build queue drains, so the
// list cannot be collected once, but a `traverse` over ~1000 objects four times
// a second is free next to a 240 ms frame.
//
// ---- THE CADENCE WAS THE LOAD JANK (2026-07-28) ---------------------------
//
// The cadence is correct for a settled park and was WRONG for a loading one, and
// it cost multiple seconds of hard freeze on every park the generator emits.
//
// three.js bakes THE NUMBER OF VISIBLE LIGHTS into a material's program cache
// key. So a park does not compile one shader per material — it compiles one per
// (material, light count) PAIR that is ever rendered. Measured on
// `harness/park-eval/samples/parkA-99.tsx` (size 128, 178 night-gated lamps),
// real Apple M4 Pro via `--use-angle=metal`, no CPU throttle, with
// `harness/mp3d-render/probe-assembly.mjs`:
//
//   169 WebGLPrograms live after load. Deleting the light-count field from
//   every program's cacheKey collapses them to 23. The park has 23 shaders and
//   compiled each one at ~7 different light counts.
//
// and the compiles are the load spikes, not the builds:
//
//   18 rAF gaps over 100 ms, 4.53 s of stall total, in a ~12 s assembly
//   the 100–190 ms gaps each land exactly on "+10 or +11 programs compiled"
//   one 890 ms gap lands on the visible light count jumping 16 -> 83
//   ALL 107 queued component builds together are 1.35 s — a third of the stall
//
// The staircase is the cadence: a component mounts its lamps mid-build (the
// build queue drains in `setTimeout` macrotasks, i.e. between frames), those
// lamps sit at `intensity 0` but VISIBLE for up to 0.25 s ≈ 15 frames, and the
// first of those frames compiles all 23 shaders at the new count. Next batch,
// next count, another 23.
//
// FIX: an O(1) TOPOLOGY CHECK every frame, with the cadence kept as a backstop.
// `parkContext.addObject` adds each runtime entry as a child of the group Stage
// handed to `build()`, so a component mounting (and therefore its lamps
// appearing) always changes the child count one level under the scene. Hashing
// that is a handful of integer adds per frame — nothing next to the traverse it
// gates — and it means the pass runs on the very frame a light appears. Since
// `tick()` is called BEFORE `renderer.render`, a dark lamp is now shed before it
// is ever drawn, so the light count never leaves its by-day value and the
// program cache never sees a second count.
//
// The 0.25 s cadence still runs underneath it, so a light that appears WITHOUT
// changing the top-level topology (a ride rebuilt in place, a `<Paths>`
// furniture rebuild) is still caught exactly as before — the fast path is a
// strict addition, never a replacement.
// ---------------------------------------------------------------------------
import type * as THREE from 'three';

/** intensity at or above which a shed light is switched back on */
const ON = 0.004;
/** intensity below which a visible light is shed */
const OFF = 0.001;

export interface DarkLightCull {
  /** call once per frame, AFTER the scene's updaters have set intensities and
   *  BEFORE `renderer.render` — the cadence limiter is inside */
  tick(dt: number): void;
  /** how many lights are currently shed (for `api.stats()` / perf lines) */
  culled(): number;
}

/**
 * Hide every Point/SpotLight in `scene` whose `intensity` has fallen to zero,
 * so three.js drops it from the forward shaders' light arrays.
 *
 * @param scene   the scene to walk
 * @param cadence seconds between passes (default 0.25)
 */
export function createDarkLightCull(scene: THREE.Object3D, cadence = 0.25): DarkLightCull {
  // the lights THIS cull switched off — the only ones it is allowed to switch
  // back on (rule 2 above)
  const shed = new Set<THREE.Object3D>();
  const seen = new Set<THREE.Object3D>();
  let clock = cadence; // run on the very first frame, not 0.25 s in
  let shedCount = 0;

  /** A CHEAP FINGERPRINT OF THE SCENE'S TOP TWO LEVELS. Order-sensitive (the
   *  index multiplier) so a remove-plus-add in one frame still registers, which
   *  a bare total would miss. O(scene.children.length) — about ten integer adds
   *  on a park, evaluated once per frame to decide whether the traverse below is
   *  worth doing NOW rather than in up to 0.25 s. See the header. */
  const topology = () => {
    let h = scene.children.length * 7919;
    for (let i = 0; i < scene.children.length; i += 1) h += scene.children[i].children.length * (i + 1) * 31;
    return h;
  };
  let topo = -1;

  return {
    tick(dt: number) {
      clock += dt;
      // The park grew or shrank since the last pass: run NOW, before the render
      // that would otherwise draw a newly mounted dark lamp and compile every
      // shader in the park at a light count that is about to change back.
      const t = topology();
      const grew = t !== topo;
      if (clock < cadence && !grew) return;
      topo = t;
      clock = 0;
      seen.clear();
      shedCount = 0;
      scene.traverse((o) => {
        const l = o as THREE.Object3D & { isPointLight?: boolean; isSpotLight?: boolean; intensity?: number };
        if (!l.isPointLight && !l.isSpotLight) return;
        seen.add(l);
        const i = l.intensity ?? 0;
        if (l.visible && i < OFF) {
          l.visible = false;
          shed.add(l);
        } else if (!l.visible && i >= ON && shed.has(l)) {
          l.visible = true;
          shed.delete(l);
        }
        if (!l.visible && shed.has(l)) shedCount += 1;
      });
      // A park mounts and UNMOUNTS lights (an unmounted ride, a rebuilt <Paths>
      // furniture pass), and a Set of Object3Ds would pin every one of them
      // alive AND over-count. `culled()` returned 42 on a park with 41 lights
      // until this prune existed — a small lie, but the kind that makes a whole
      // perf report untrustworthy. Anything not met on this walk is gone.
      if (shed.size !== seen.size) shed.forEach((l) => { if (!seen.has(l)) shed.delete(l); });
    },
    /** lights currently shed AND still in the scene (counted on the last pass) */
    culled() {
      return shedCount;
    },
  };
}
