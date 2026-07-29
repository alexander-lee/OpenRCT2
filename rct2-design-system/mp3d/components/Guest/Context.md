# Guest

**CANONICAL IMPORT — copy exactly:** `import { Guest } from './components/Guest';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A park guest modelled from the RCT2 peep sprite, animated by a per-peep POSE CONTROLLER. Drag to orbit. The preview shows the controller's range: two walk speeds, breathing idle, a dancing female (skirt swings and flares on spins) and periodic anticipation-crouch jumps.

Built with three.js on top of the shared `Stage` component. The geometry is hand-modelled to match the colours and proportions of the authentic RollerCoaster Tycoon 2 sprite (its 4 rotations were used as reference).

## API

```ts
buildPeep(t: typeof THREE, opts?: PeepOpts)
// -> { group, walk(time, phase?), head, headSlot, armL, armR, legL, legR, pose, skirt, setSick }
```

`group / walk / head / armL / armR` are unchanged and fully backwards-compatible. New:

### `headSlot` — the HEAD attachment anchor (wearables)

The third attachment slot, alongside the two hands (the `armL`/`armR` pivots, whose hand ball sits at arm-local `[0, −0.32, 0]` — where GameManager parents held food, drink and balloons). `headSlot` is a group on the CROWN of the skull, parented to `head`, so anything added to it rides every nod, mood tilt and head bob for free — and, being part of the rig, it cannot be lost when the peep is hidden in a hut or seated on a ride.

- Position: head-local `(0, 0.10, 0)`. The skull is r 0.12 and the hair cap tops out at ~0.132, so an item sitting near the anchor's own origin hugs the hair instead of floating.
- Orientation: `+z` is the FACE direction (the nose is at z 0.12).
- Units are PEEP-LOCAL: size against the head radius 0.12 and let the caller's scale (0.5 for park crowds, `GUEST_SCALE`) do the rest — never pre-scale.
- A brow-line item (goggles) offsets itself DOWN and FORWARD, e.g. `position.set(0, −0.06, 0.02)`.

GameManager's `'wearable'` stall items (`StallConfig.heldItem`) attach here.

### `setSick(on)` + the sick face variant

`setSick(true)` swaps the head's painted-face texture for a SICK variant — skin blended ~45 % toward a queasy green, worried (sad-tilt) brows, a wavy clenched grimace mouth and green-washed cheeks — and `setSick(false)` restores the normal face. Both textures come from the same face cache (`skin:expression[:s]` keys, one canvas painted per combo ever), so toggling is just a material-map swap. GameManager uses this for the throw-up event.

### `legL` / `legR` — leg pivots

The leg pivot groups (same pivots the pose layer animates), exposed for caller overlays like GameManager's poop-squat crouch. Compose overrides AFTER `pose.update`, as with the arms.

### `pose` — the animation state machine (`PeepPose`)

```ts
pose.setState('idle' | 'walk' | 'dance' | 'jump', speed?)
pose.update(time, dt?)        // call every frame; dt optional (derived from time)
pose.setDanceStyle(0..3)      // bounce / twist / sway / spin-burst playlists
pose.seed = n                 // per-peep variation
pose.spinYaw                  // dance spin offset — ADD to your own group yaw
pose.headNod                  // head pitch written this frame (re-add if you overwrite)
pose.state                    // current state (readonly)
```

- **Crossfades everywhere** (~0.25 s ease-in-out) plus a per-channel slew limit — limb rotations never move more than ~0.14 rad per 60 fps frame across ANY transition.
- **idle**: breathing micro-bob, slow weight shift, settled arms — no leg swing.
- **walk**: phase-accumulator gait (`speed` = cadence in rad/s); amplitude scales with cadence, hip sway ±0.03 roll, counter-rotating shoulder z-sway, 2×-frequency footfall bob with a counter-bobbed steady head, knee-offset second harmonic. Stopping eases limbs home.
- **jump** (one-shot, auto-returns to the previous state): 0.12 s anticipation crouch → parabolic flight with tucked legs and rising arms → landing compression → recovery. `speed` scales the height. `setState` during a jump only retargets where it lands.
- **dance**: beat-synced (`speed` = Hz, default 2.2) move sequencer — bounce, twist, sway, full spins, alternating arm-waves and side-step shuffles from a per-style playlist, crossfaded per bar, with occasional hashed spins for every style.
- **skirt** (female): its own pivot; a damped spring lags body-yaw changes (world-yaw tracked, so carrier spins count) and the skirt flares (x/z scale) on fast spins and hops.
- Pose never writes group yaw/position x/z — add `pose.spinYaw` to your yaw for dance spins. Arm/leg overrides (lap bars, eat/drink cycles, choreography) go AFTER `pose.update` and should be eased by the caller (see GameManager's envelopes).

### `cadenceForSpeed(speed, scale?)`

Cadence (rad/s) whose stride exactly covers `speed` world-units/s at peep `scale` — drive `setState('walk', cadenceForSpeed(v, scale))` from actual displacement and feet never skate (verified < 2 % error).

### `walk(time, phase?)` — legacy wrapper

Same signature and visuals as before (`sin(time·5 + phase)` gait, bob in `group.position.y`); it now drives the pose controller, so cadence/amplitude follow how fast the caller advances `time`, and a frozen `time` eases the limbs to rest instead of freezing mid-swing.

Deterministic: hashed-sine variation only, no `Math.random` / `Date.now`.
