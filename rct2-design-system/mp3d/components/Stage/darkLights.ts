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
//
// ---- THE SAME MECHANISM WAS THE DAY/NIGHT TOGGLE FREEZE (2026-07-28) -------
//
// Reported as "when i turn off lighting there's always a super lag with large
// park". Measured on `samples/parkA-99.tsx` (size 128, 168 lit lamps after
// dark) on a real Apple M4 Pro with `harness/mp3d-render/probe-night-toggle.mjs`
// — which also has the `--legacy` switch that reproduces the before:
//
//   BEFORE  press DAY and the park NEVER RECOVERS. 60 s after the click nightK
//           was still 0.050, all 168 lights still visible, still 1318 ms/frame,
//           and every later toggle the same. Four consecutive toggles, four
//           "NOT RECOVERED in 60 s".
//   AFTER   13.1 s / 14.0 s (cycle 1 / cycle 2) back to 2 visible lights and
//           16 ms/frame — with only the Stage's fade fixed.
//   AFTER   6.1 / 7.2 / 7.4 s over three cycles with this file's coalescing too,
//           and press-NIGHT went from a fade that never completed to 4.2 / 5.5 /
//           5.4 s with exactly ONE light-count change (the whole 0.8 s fade now
//           renders at the DAY light count, ~18 ms/frame, because the restores
//           are coalesced into the single step at the end).
//
// What is left is not the toggle: 1.3 s of it is ONE night frame (the click
// lands mid-frame and a 168-light frame costs that much), and ~3 s is 11 shader
// compiles at a light count the park has never drawn. Priced directly by the
// same probe, at settled day: making ONE extra lamp visible costs 145 ms and 11
// programs the first time and 32 ms / 0 programs when the count repeats. A
// park inside the ~8-light budget would pay neither.
//
// TWO causes, both of them a per-FRAME quantity standing in for a per-SECOND
// one, which is the same bug shape as the cadence above:
//
//  1. `Stage`'s cross-fade was `nightK += (want - nightK) * 0.06` PER FRAME, and
//     a night park's frame is ~80x a day park's (1330 ms vs 16 ms at 168 visible
//     point lights — three.js re-uploads the whole point-light uniform array on
//     every program bind, so the cost is lights × binds). ~110 frames of fade at
//     1.3 s each is over two minutes, and because the exponential only
//     APPROACHES zero the lamps never crossed OFF at all, so the cull never fired
//     and the park stayed in its slow state for good. Fixed in `Stage/index.tsx`:
//     the fade is linear on the UNCLAMPED dt over `NIGHT_FADE_S`, so it lands
//     EXACTLY on 0/1 in bounded wall-clock time.
//  2. `tick(dt)` was handed the loop's CLAMPED dt (max 0.1 s), so at 1.3 s/frame
//     the 0.25 s cadence needed THREE frames — 4 s of the freeze was the cull
//     waiting for its own clock. It gets `dtRaw` now.
//
// ---- AND WHY THE FADE TAIL IS COALESCED -----------------------------------
//
// With the fade fixed, the toggle's remaining cost was a STAIRCASE of light
// counts, and each step is a full re-resolve of every material in the park plus
// ~11 shader compiles at a light count nothing has drawn before:
//
//   168 → 36 → 34 → 28 → 4 → 2   4886 ms, 2196 ms, 218 ms, 197 ms per step
//
// The first step is the whole prize (168 lights → 36 takes the frame from
// 1330 ms to 60 ms). The other three are a handful of lamps whose OWNERS smooth
// their own intensity, so they arrive over the following ~10 frames — and their
// counts depend on frame timing, so every toggle invents new ones and compiles
// them again. That is the "ALWAYS" in the report: nothing was ever cached.
//
// So the two kinds of shed are treated differently, and the split is by a
// property that is DETERMINISTIC rather than by a threshold on a magnitude:
//
//   * `intensity === 0` — its owner has switched it off outright (every
//     nightK-multiplied lamp, once the fade lands exactly on 0). Shed on the
//     spot: this is the batch worth paying a compile for, and the set is the
//     same set on every toggle, so the compile happens ONCE EVER.
//   * `0 < intensity < OFF` — a lamp still on its way down. Held until no NEW
//     light has joined the pending set since the previous pass, then applied as
//     ONE batch. Holding is nearly free (those frames are already down at 36
//     lights ≈ 60 ms) and it collapses three staircase steps into one whose
//     count is always the same.
//
// A RESTORE is coalesced the same way, for the same reason. The asymmetry to
// keep in mind: a dark light left VISIBLE only costs frame time, while a lit
// light left INVISIBLE is a wrong picture — so the hold is bounded by
// `HOLD_MAX` passes, after which the batch goes out regardless. A lamp
// flickering across the dead band can therefore delay the cull by at most
// `HOLD_MAX × cadence`, never disable it.
// ---------------------------------------------------------------------------
import type * as THREE from 'three';

/** intensity at or above which a shed light is switched back on */
const ON = 0.004;
/** intensity below which a visible light is shed */
const OFF = 0.001;
/** passes a coalesced batch may wait for quiescence before going out anyway */
const HOLD_MAX = 8;

export interface DarkLightCull {
  /** call once per frame, AFTER the scene's updaters have set intensities and
   *  BEFORE `renderer.render`, with the UNCLAMPED frame delta — the cadence is
   *  wall-clock (a clamped dt made it three frames long on a slow park) */
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
  let seen = new Set<THREE.Object3D>();
  // the lights walked on the PREVIOUS pass — `seen` and `known` are swapped at
  // the end of every pass, so "have I met this light before?" costs nothing and
  // neither set can pin an unmounted light for more than one pass
  let known = new Set<THREE.Object3D>();
  // flips waiting for the pending set to stop growing (the fade tail — header)
  const pending = new Set<THREE.Object3D>();
  let holdPasses = 0;
  let quietPasses = 0;
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
      let joined = false; // did a light JOIN `pending` on this pass?
      scene.traverse((o) => {
        const l = o as THREE.Object3D & { isPointLight?: boolean; isSpotLight?: boolean; intensity?: number };
        if (!l.isPointLight && !l.isSpotLight) return;
        seen.add(l);
        const i = l.intensity ?? 0;
        if (l.visible && i < OFF) {
          // switched off OUTRIGHT (i === 0), or a light we are meeting for the
          // first time: both are deterministic sets, so shedding them now costs
          // one shader compile ONCE rather than a new one per toggle. A light
          // still lerping down through the dead band waits for its friends.
          if (i === 0 || !known.has(l)) {
            l.visible = false;
            shed.add(l);
            pending.delete(l);
          } else if (!pending.has(l)) {
            pending.add(l);
            joined = true;
          }
        } else if (!l.visible && i >= ON && shed.has(l)) {
          if (!pending.has(l)) {
            pending.add(l);
            joined = true;
          }
        } else if (pending.has(l)) {
          pending.delete(l); // left the dead band on its own — nothing to apply
        }
      });
      // THE COALESCED BATCH. Applied once the set stops growing (the fade has
      // finished arriving) or after HOLD_MAX passes, so one light flickering
      // across the dead band can delay the cull but never disable it.
      if (pending.size > 0) {
        holdPasses += 1;
        quietPasses = joined ? 0 : quietPasses + 1;
        // TWO quiet passes, not one: the tail arrives in dribbles, and a single
        // quiet pass let each dribble out as its own light count (168 → 65 → 24
        // → 18 → 13 → 2, five compiles). Waiting one more pass costs ~0.25 s of
        // frames that are already back under 70 ms and collapses the tail.
        if (quietPasses >= 2 || holdPasses >= HOLD_MAX) {
          pending.forEach((l) => {
            const lt = l as THREE.Object3D & { intensity?: number };
            const i = lt.intensity ?? 0;
            if (l.visible && i < OFF) {
              l.visible = false;
              shed.add(l);
            } else if (!l.visible && i >= ON && shed.has(l)) {
              l.visible = true;
              shed.delete(l);
            }
          });
          pending.clear();
          holdPasses = 0;
          quietPasses = 0;
        }
      } else {
        holdPasses = 0;
        quietPasses = 0;
      }
      // A park mounts and UNMOUNTS lights (an unmounted ride, a rebuilt <Paths>
      // furniture pass), and a Set of Object3Ds would pin every one of them
      // alive AND over-count. `culled()` returned 42 on a park with 41 lights
      // until this prune existed — a small lie, but the kind that makes a whole
      // perf report untrustworthy. Anything not met on this walk is gone.
      if (shed.size !== seen.size) shed.forEach((l) => { if (!seen.has(l)) shed.delete(l); });
      if (pending.size > 0) pending.forEach((l) => { if (!seen.has(l)) pending.delete(l); });
      shedCount = 0;
      shed.forEach((l) => { if (!l.visible) shedCount += 1; });
      // this pass's census becomes the next pass's "have I met this light" set
      const prev = known;
      known = seen;
      seen = prev;
    },
    /** lights currently shed AND still in the scene (counted on the last pass) */
    culled() {
      return shedCount;
    },
  };
}
