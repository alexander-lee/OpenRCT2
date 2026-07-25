---
name: ride-and-stall-roster
description: Use whenever a park needs its ride line-up or shops chosen and placed with the mp3d rigs — picking rides beyond the coaster, filling a district, adding a transport/water/dark ride, or placing stalls, restrooms and the <Bazaar>. Gives copy-paste blocks and verified piece circuits for the under-used catalog rides (Monorail, LogFlume, RiverRapids, Bobsleigh, Chairlift, GoKarts, GhostTrain, PaddleBoats, MotionSimulator, ObservationTower, Helicycles), the exact queue-lane arithmetic per ride, and the stall sale defaults and naming rules.
---

# The ride and stall roster — copy-paste, same as the coaster

Agent parks keep shipping the same four flat rides while eleven catalog rides
sit unused, then lose points for a thin line-up. **These rides deserve the same
copy-paste treatment the coaster archetypes get.** Every number here is read
out of the source.

A 48 plot expects **4+ registered rides** (6 is good), **≥ 1 stall per 2
rides**, and rides spanning the intensity bands: gentle (≤ 3), moderate (4-6),
intense (≥ 7).

## The two rules that decide whether a ride works at all

**1. The pad must stand ≥ 1.8 u clear of every street node AND edge centreline.**
`PAD_OFF_LATTICE = 1.8`; the real threshold is
`max(1.8, padHalf + pathWidth/2 + 0.05)`. A pad whose slab clearance is under
`pathWidth/2` is a **FATAL `padOnStreet`** lint; inside the margin it is a
non-fatal `padNearStreet`. Use `offPathCell(NET, [x, z], { clear: 1.8, size,
isDry })` to get a legal cell instead of guessing.

**2. A street node must sit at the queue tail, on the lane axis.**
The lane runs out the ride's **local +z** face (rotated by `rotation`), and

```
tailDistance = front + laneLenOf(capacity) + 0.35
laneLenOf(c) = max(2.2, 1.1 + 0.56·c)     // c=2 → 2.22, c=4 → 3.34, c=6 → 4.46, c=8 → 5.58
```

**`front` defaults to 1.8** — every ride's own doc comment says 1.5; the code
says 1.8, and several rides override it (table below). Worse for planning:
**on a compact rig (span ≤ 10 u) `front` is auto-raised** to
`min(6.5, footMaxZ × scale + 1.27)`, which you cannot compute from the props.

So there are exactly two reliable ways to wire a queue:

```tsx
// (a) EXACT and immune to trimming/flipping/snapping — pin the lane in world
//     space. anchor = tail − dir·(laneLenOf(capacity) + 0.35)
import { laneLenOf } from './components/ParkBuilder';   // or inline the formula
const TAIL: [number, number] = [9.6, 4.8];          // a real street node
const DIR: [number, number]  = [0, 1];              // hut → tail
const JOIN = laneLenOf(4) + 0.35;                   // 3.34 + 0.35 = 3.69
<SwingRide position={[9.6, -0.69]} rotation={0}
  register={{ name: 'Sky Swings', capacity: 4, rideDuration: 9, intensity: 5 }}
  queue={{ anchor: [TAIL[0] - DIR[0] * JOIN, TAIL[1] - DIR[1] * JOIN], dir: DIR }} />

// (b) DERIVED — put a street node on the lane axis and let the chassis trim to
//     it. Any node within [front + 1.55, defaultReach + 0.05] and ≤ 0.3 u off
//     the axis wins; the lane shortens (min 1.2 u) and reports a NON-FATAL
//     `laneTrim` with fewer queue slots. Never extends.
```

Use (a) for anything you need to be exact, and for every ride with an
auto-raised `front`. Passing `queue.anchor` also opts out of the derived-exit
`exitSnapped` move.

**Never let two rides share a queue tail node** — that is a FATAL
`queueTailShared` lint. One tail node per ride.

Two capacity-4 rides on the same street clear each other only at
centre-to-centre pitch **≥ 6 u**. Stagger opposite sides to pack tighter.
Keep every `rideDuration ≤ 12`.

**Never mount a `build<Name>Scene` builder in a park.** Almost every ride below
exports ONLY a `…Scene` builder (preview staging that ships its own ground —
the floating-oval failure). Mount the component.

---

## Piece-taking rides — the four water/track rides

These take the same `pieces` grammar as `<Coaster>` but through their OWN
compiler profile, with narrower whitelists. **A coaster piece list is not
portable to them.** They compile with `heading` 0 (station straight runs +z)
and **without `bounds`**, so keeping the circuit inside ±size/2 is entirely
your responsibility — do the arithmetic with the run-length table in the
**coaster-pieces** skill.

Every circuit below is copied verbatim from the component's verified previews,
with its measured clearance. Copy one and translate the `position`.

### LogFlume — `profile: 'flume'`, E-rated water ride

```tsx
import { LogFlume } from './components/LogFlume';
```

| fact | value |
|---|---|
| profile / start | `'flume'`, `start: [0, 0.6, 0]` |
| legal pieces | everything except inversions — `corkscrewL/R` are auto-replaced by an `sbend` |
| slopes | **25° up / steep-60° down only** (no `slopeSteepUp`): climb LONG, chute SHORT. Practical ceiling from the one-tile transition rule is **33.1°** |
| turns | `sBend` + `curveSmall`; **no helix, no banked turns**. Bank capped 0.25 rad |
| `layout` | `front: 4.4`, `exit: [-1.9, 4.0]` |
| defaults | `name: 'Log Flume', capacity: 4, rideDuration: 12, intensity: 5, price: 4` |
| tail reach @ cap 4 | 4.4 + 3.34 + 0.35 = **8.09 u** out +z |
| footprint (stock) | x −3.7..3.7, z −2.7..3.05; trough rim reaches z 3.55 |
| water body | **NOT required.** The trough carries its own `buildWaterRibbon` shader water (0.72 wide inside walls at ±0.45) |

```tsx
{/* "Big Chute" — the lead circuit: zero synthesized closure, design + spline
    clean, worst clearance 3.09, lift 23.9°, chute 33.1° */}
<LogFlume position={[-4.5, 7.61]} rotation={Math.PI * 0.75}
  register={{ name: 'Timber Chute', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}>
  <Station /><Lift height={4.8} length={16} /><TurnL angle={180} radius={2.2} />
  <Drop height={4.8} /><Straight length={9.05} /><TurnL angle={180} radius={2.2} />
  <Straight length={1.2} />
</LogFlume>

{/* "Horseshoe Plunge" — footprint 6 × 14.5, lands 0.3 u short on its own brake
    straight, nothing synthesized, clearance 2.12 */}
<LogFlume position={[-3.0, -4.45]}>
  <Station /><Lift height={1.15} /><TurnL angle={180} radius={3} /><Straight length={1.2} />
  <Drop /><Straight length={2.6} /><TurnL radius={1.6} /><Straight length={2.8} />
  <TurnL radius={1.6} /><Straight length={0.9} />
</LogFlume>
```

Also verified: "Cascade Run" (clearance 2.28) and the compact "Chute-drop
course". `<LogFlume position={[4, -3]} pieces={['station', { type: 'lift',
height: 1.2 }, 'turnL', 'drop', 'turnL']} />` is the minimal published form.

Thematically wants the shoreline; use `rideColourPreset(seed + zone, 'water')`.

### RiverRapids — `profile: 'rapids'`, the narrowest vocabulary in the catalog

```tsx
import { RiverRapids } from './components/RiverRapids';
```

| fact | value |
|---|---|
| profile / start | `'rapids'`, `start: [0, 0.3, 0]` |
| legal pieces | **`curveVerySmall` quarter-turns and 25° slopes ONLY** — no s-bends, no helix, no steep pieces. Corkscrews → sbend |
| slopes | **25° is a hard ceiling BOTH ways.** Buy descent with LENGTH. Verified peak 23.9°, roll 14.3°; bank capped 0.2 rad |
| `layout` | `front: 4.4`, `exit: [-1.7, 4.2]` |
| defaults | `name: 'River Rapids', capacity: 6, rideDuration: 12, intensity: 5, price: 4` |
| tail reach @ cap 6 | 4.4 + 4.46 + 0.35 = **9.21 u** |
| footprint (stock) | ≈ 7 × 4.5, min bend radius 1.11; boarding deck reaches z ≈ 3.65 |
| water body | **NOT required** — its channel and splash pond are part of the rig. With `pieces` the tuned splash pond is skipped |

```tsx
{/* "Gorge Run" — the lead: zero synthesized, validateSpline clean, clearance
    2.63, 23.9° both ways */}
<RiverRapids position={[-3.22, 6.05]} rotation={Math.PI * 0.75}
  register={{ name: 'Thunder Gorge', capacity: 6, rideDuration: 12, intensity: 5, price: 4 }}>
  <Station /><Lift height={3.6} length={12} /><TurnL angle={180} radius={2} />
  <Drop height={3.6} length={12} /><Straight length={4.1} /><TurnL angle={180} radius={2} />
  <Straight length={1.2} />
</RiverRapids>

{/* "Delta Gorge" — 10.4 × 11.4, closes on its own last bend, clearance 2.05 */}
<RiverRapids position={[-5.2, -3.2]}>
  <Station /><Lift height={0.7} /><TurnL angle={120} radius={2} /><Straight length={0.6} />
  <Drop height={0.4} /><Straight length={0.4} /><Drop height={0.3} />
  <TurnL angle={120} radius={2} /><Straight length={7.4} /><TurnL angle={120} radius={2} />
</RiverRapids>
```

Also verified: "Oxbow Meander" (an octagon of 45° turns, closes exactly,
clearance 2.14) and "Descending gorge".

### Bobsleigh — `profile: 'bobsled'`, energy-paced, crash-guarded

```tsx
import { Bobsleigh } from './components/Bobsleigh';
```

`BobsleighCar` is DEPRECATED — never import it.

| fact | value |
|---|---|
| profile / start | `'bobsled'`, `bank: 0.55`, `start: [0, 0.6, 0]` |
| legal pieces | tall lifts, stepped drops, **half-banked helixes up AND down**, sbend. **25° absolute ceiling — no steep slopes at all** |
| graded on | lateral Gs (`RequirementLateralGs` 1.20), not drop height. Bank 0.55 rad = 31.5° measured |
| crash | the 1.5 g derail guard is wired as the ride's `vehicleHandle` |
| `layout` | `front: 4.6`, `exit: [-2.0, 4.2]` |
| defaults | `name: 'Bobsleigh', capacity: 4, rideDuration: 10, intensity: 6, price: 4` |
| tail reach @ cap 4 | 4.6 + 3.34 + 0.35 = **8.29 u** |
| footprint (stock) | x −5.5..3.4, z −3.2..3.2; chute rim reaches z 3.98 |

```tsx
{/* "Summit Chute" — 480 simulated seconds CRASH-FREE, peak grade 24.0°,
    bank 31.5°, zero synthesized, worst clearance 3.59 */}
<Bobsleigh position={[-0.14, 3.54]} rotation={Math.PI * 0.75}
  register={{ name: 'Glacier Run', capacity: 4, rideDuration: 10, intensity: 6, price: 4 }}>
  <Station /><Lift height={3.6} length={12} /><TurnL angle={180} radius={2.4} />
  <Drop height={3.6} length={12} /><Straight length={4.1} />
  <Lift height={2.2} /><TurnL angle={180} radius={2.4} /><Drop height={2.2} />
  <Straight length={1.2} />
</Bobsleigh>

{/* "Chicane Descent" — 4.4 × 16.5, crash-free over 480 s, clearance 2.15 */}
<Bobsleigh position={[-2.2, -1.6]}>
  <Station /><Lift height={0.9} /><TurnL angle={180} radius={2.2} /><Drop height={0.4} />
  <SBend length={2.4} radius={1.2} /><Hill height={0.3} /><Drop height={0.5} />
  <TurnL radius={1.6} /><TurnL radius={1.6} /><Straight length={4.75} />
</Bobsleigh>
```

Also verified: "Alpine Spiral" (a `<HelixL angle={360} radius={2.4}
height={-1.15} />`, 480 s crash-free, clearance 1.15) and "Downhill run" —
whose `<Drop height={0.2} />` immediately after the lift crest exists to keep
the lift-hill detector unambiguous. Copy that trick if you author a lift crest.

Alpine climates favour the bobsled.

### Monorail — `profile: 'monorail'`, FLAT-ONLY transport

```tsx
import { Monorail } from './components/Monorail';
```

| fact | value |
|---|---|
| profile / start | `'monorail'`, `start: [0, 1.2, 0]` (the beam rides at y 1.2) |
| legal pieces | `station`, `straight`/`flat`, `turnL`, `turnR`, `sbend`, **height-less** helixes. **`lift`/`drop`/`hill` are REMOVED with a warn**; a helix `height` is stripped; corkscrews become an sbend |
| turns | the only whitelist with `curveLarge` as well as small/medium; radius 3 is the published archetype, 1.8 the published tight radius. Bank capped 0.08 rad |
| `layout` | chassis defaults — `front: 1.8`, `exit: [-1.5, 1.35]` |
| defaults | `name: 'Monorail', capacity: 6, rideDuration: 12, intensity: 1, price: 2` |
| footprint | the stock (piece-less) rig is a 7-u shuttle beam along local z, 0.42 wide, on piers every 1.6 u. Its span > 10 u so it gets **no** compact-rig hut auto-clearance and **no body blocker is registered** — plan the pathing around it yourself |

Monorail is the park's **gentle ride** (intensity 1) and the natural way to make
a big plot read as connected: a long circuit whose piers march past several
districts. It registers ONE station at its origin — it is a scenic loop, not a
two-terminus shuttle. There is no multi-station support in the code.

```tsx
{/* "Grand Circle Tour" — nothing synthesized, worst clearance 2.15 */}
<Monorail position={[-4.2, -1.45]}
  register={{ name: 'Skyline Monorail', capacity: 6, rideDuration: 12, intensity: 1, price: 2 }}>
  <Station /><Straight length={2} /><TurnL radius={3} /><Straight length={2.4} />
  <TurnL radius={3} /><Straight length={1.2} /><SBend length={3.6} radius={1.2} />
  <Straight length={1.5} /><TurnL radius={3} /><Straight length={1.2} />
  <TurnL radius={3} /><Straight length={1.4} />
</Monorail>

{/* "Plaza Circuit" — footprint 11.4 × 10.5, lands 0.3 u short, clearance 2.22 */}
<Monorail position={[-5.7, -2.15]}>
  <Station /><Straight length={3} /><TurnL radius={1.8} /><Straight length={2} />
  <TurnL radius={1.8} /><Straight length={1.5} /><TurnR radius={1.8} /><Straight length={2.2} />
  <TurnL radius={1.8} /><Straight length={1.8} /><TurnL radius={1.8} /><Straight length={7.8} />
  <TurnL radius={1.8} /><Straight length={1} />
</Monorail>
```

**Known-bad, do not copy:** the older "custom loop" whose turns summed to only
180°. The compiler synthesized 52 % of the authored length and reported FATAL.
Turns summing to 360° is not sufficient either — **the list must END FACING the
station** (see the closure rules in the coaster-pieces skill).

### Chairlift — horizontal only; it compiles on the `'monorail'` profile

```tsx
import { Chairlift } from './components/Chairlift';
```

| fact | value |
|---|---|
| profile / start | `'monorail'`, `start: [0, 2.32, 0]` (the cable line) |
| legal pieces | **`station`, `flat`/`straight`, `turnL`, `turnR`, `sbend` and nothing else.** `lift`/`drop`/`hill`/helix/corkscrew are stripped with a warn |
| `layout` | chassis defaults — `front: 1.8`, `exit: [-1.5, 1.35]` |
| defaults | `name: 'Chairlift', capacity: 6, rideDuration: 10, intensity: 2, price: 3` |
| motion | the fleet-wide **motion-gate EXCEPTION**: the cable never stops and guests board moving chairs |
| capacity | 6 = the stock loop's bucket count. **A piece-composed course sizes its fleet from circuit length (4-14 buckets) — keep `capacity` ≤ that count** |
| footprint | stock loop is a 6.4-u run between bullwheel pylons, cable at y 2.4, and the whole stock rig is yawed +45° internally, so its box is ~5.6 × 5.6 on the diagonal |

```tsx
<Chairlift position={[-3.3, -1.3]}
  register={{ name: 'Summit Chairlift', capacity: 6, rideDuration: 10, intensity: 2, price: 3 }}
  pieces={[
    'station',
    { type: 'turnL', angle: 120, radius: 2.2 },
    { type: 'straight', length: 2.6 },
    { type: 'turnL', angle: 120, radius: 2.2 },
    { type: 'straight', length: 2.6 },
    { type: 'turnL', angle: 120, radius: 2.2 },
  ]} />
```

Note: unlike LogFlume/RiverRapids/Bobsleigh/Monorail, Chairlift does **not**
mark itself invalid on a FATAL compile — it just stashes the report. Get the
closure right yourself.

### GoKarts — `profile: 'gokart'`, FLAT-ONLY

```tsx
import { GoKarts } from './components/GoKarts';
```

| fact | value |
|---|---|
| profile / start | `'gokart'`, `start: [0, 0.02, 0]` — kerb height, the course is dead flat |
| legal pieces | `station`, `straight`/`flat`, `turnL`, `turnR`, `sbend`, height-less helixes. **`lift`/`drop`/`hill` REMOVED with a warn**; helix heights stripped. Bank capped 0.02 rad |
| `<TrackRide>` | **excludes `'gokart'`** — `<GoKarts>` is the ONLY route to a kart course |
| `layout` | chassis defaults — `front: 1.8`, `exit: [-1.5, 1.35]` |
| defaults | `name: 'Go-Karts', capacity: 4, rideDuration: 12, intensity: 5, price: 4` |
| footprint (stock) | a flat ≈ 6 × 4 asphalt oval; min turn radius 0.63 against a 0.55 ribbon half-width |
| colours | `rideColourPreset(seed + zone, 'kart')`. Desert parks favour kart energy |

```tsx
<GoKarts position={[2, -2.4]}
  register={{ name: 'Dust Devil Karts', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}>
  <Station /><Straight length={2.2} /><TurnR angle={180} radius={1.1} />
  <Straight length={1.2} /><SBend radius={1.4} /><TurnL angle={90} radius={1.3} />
</GoKarts>
```

Like Chairlift, GoKarts does not mark itself invalid on a FATAL compile.
It costs 128 exhaust particles against the 4000 global budget.

---

## No-pieces rides — one line each

All five are plain `composableRide`s: give them `position`, `rotation`,
`register` and a queue, and that is the whole placement.

```tsx
import { GhostTrain } from './components/GhostTrain';
import { PaddleBoats } from './components/PaddleBoats';
import { MotionSimulator } from './components/MotionSimulator';
import { ObservationTower } from './components/ObservationTower';
import { Helicycles } from './components/Helicycles';
```

| ride | capacity | duration | intensity | price | land footprint | notes |
|---|---:|---:|---:|---:|---|---|
| **GhostTrain** | 6 | 11 | 5 | 4 | ≈ 4.7 × 2.6 | a dark ride: show building on the −x half, graveyard dip on +x. Extra prop `riders?` |
| **PaddleBoats** | 4 | 12 | 1 | 2 | ≈ 5.2 × 5.2 (round) | **builds its OWN pond** — see below |
| **MotionSimulator** | 4 | 7 | 6 | 3 | 2.2 × 2.2 base plate | pod at y 1.05 on a hexapod; riders hidden by the shell |
| **ObservationTower** | 8 | 10 | 1 | 2 | ≈ 2 × 2 base — but **5.9 u TALL** | the mast top is at 5.7, beacon 5.86: check the coaster's 2.2-u corridor clearance VERTICALLY here. Extra prop `riders?` |
| **Helicycles** | **2** | 8 | 2 | 2 | ≈ 5.2 × 5.2 (round) | flight circle r 1.4, fence rings at 2.36. `laneLenOf(2) = 2.22`, the shortest lane in the catalog. Extra prop `riders?` |

All use the chassis `exit: [-1.5, 1.35]` and `board: [0, 0.25, 0]`, and
`loadTime: 1.6`.

```tsx
<GhostTrain position={[-13.8, -6.0]} rotation={Math.PI}
  register={{ name: 'Haunted Hollow', capacity: 6, rideDuration: 11, intensity: 5, price: 4 }}
  queue={{ anchor: [-13.8, -8.9], dir: [0, -1] }} />
<ObservationTower position={[-3.0, 3.6]}
  register={{ name: 'Panorama Tower', capacity: 8, rideDuration: 10, intensity: 1, price: 2 }} />
<Helicycles position={[6.6, -9.6]} rotation={-Math.PI / 2}
  register={{ name: 'Rotor Rally', capacity: 2, rideDuration: 8, intensity: 2, price: 2 }} />
```

### ⚠ The water rides do NOT need the water body — and PaddleBoats must NOT be on it

This is the opposite of the intuition and of some older guidance:

- **PaddleBoats builds its own pond**: a sandy bank cylinder r 2.5→2.6 (0.16
  tall), a pond bed disc r 2.42, and a scaled WaterTile sheet at waterline
  y 0.13 with a shore lamp post at local (1.78, 1.78). Putting it on the real
  water body would trip the **WET-PAD guard** (any footprint cell with ground
  below `waterLevel + 0.05` is a hard `terrain` failure).
- **LogFlume** carries its own `buildWaterRibbon` trough.
- **RiverRapids** carries its own channel and splash pond.

So all three go on **DRY, FLAT LAND**. What the water body buys you is
*thematic adjacency*: put them in the waterside district, near the shore, with
`rideColourPreset(…, 'water')` and palms — but keep every footprint cell dry and
in `keepDry`.

---

## Stalls

```tsx
import { BurgerShop } from './components/BurgerShop';
import { HotDogStand } from './components/HotDogStand';
import { SodaStand } from './components/SodaStand';
import { CottonCandyStand } from './components/CottonCandyStand';
import { BalloonStand } from './components/BalloonStand';
```

| component | item | price | value | default name |
|---|---|---:|---:|---|
| BurgerShop | `food` | 3 | 5 | Burger Bar |
| HotDogStand | `food` | 3 | 5 | Hot Dogs |
| SodaStand | `drink` | 2 | 4 | Soda Stand |
| CottonCandyStand | `food` | 2 | 4 | Cotton Candy |
| BalloonStand | `balloon` | 2 | 3 | Balloon Stand |

Props on every one: `position`, `rotation`, `scale`, `register` (boolean or
`{ name, price, value, item }`), and top-level `name`/`price`/`value` overrides
which win over `register`. The four food shops also take
`withGuest?: boolean` (a decorative queuing peep, default off).

**The serving-front rule: the front faces LOCAL +z and the manager's attach
point sits 0.72 u out that way. Aim `rotation` at the customers' path.** A shop
whose front faces a hedge sells nothing. The registered footprint is a
1.3 × 2.02 rect centred 0.36 u forward of the anchor, so it includes the apron.

**Always pass a themed `name`.** `register` alone ships the catalog default
name, and names are the manager's PRIMARY KEY — duplicates make the corridor
resolver move the wrong shop and emit a warning.

Stall bodies are lattice-audited exactly like ride pads: a body sitting in a
street slab is a FATAL `padOnStreet`.

```tsx
<BurgerShop position={[7.8, 8.4]} rotation={-Math.PI / 2} register
  name="Lakeside Burger Bar" price={3} value={5} />
```

**Prefer the `<Bazaar>` set-piece over hand-placing stalls.** It plants 3-6
catalog stalls at pitch 2.4 along a paved aisle that IS a street in the shared
graph, each 1.2 u off it with its front turned toward it, so every attach point
lands 0.48 u from the centreline — on the path. It names them
`"<title> <Label>"` with a trailing number from the second of a kind
(`"Commons Market Soda Stand 2"`), and `pinStalls` defaults true so the
corridor resolver cannot break the row.

```tsx
const MARKET = bazaarPlan({ id: 'market', title: 'Commons Market',
  position: [-9.6, 12.0],
  stalls: ['burger', 'soda', 'cottonCandy', 'balloon'] });   // 3-6 of
  // 'burger' | 'hotDog' | 'soda' | 'cottonCandy' | 'balloon'
```

### `<Stall>` and `<Restroom>` — two traps

- **`<Stall kind>` accepts `'balloon'` and nothing else.** The four food shops
  are catalog components; mount those directly. `<Stall>` also uses **`sell`**,
  not `register`: `sell` (kind defaults) or `sell={{ name, item, price, value }}`.
- **There are TWO components called `Restroom`.** Import it from
  **`./components/Park`** — that one registers with the manager, registers its
  blocker (hx 0.72, hz 0.55, doorway kept clear) and plinths its cell.
  `./components/Restroom` is a bare `composable` wrapping the preview staging
  builder: it is NOT registered and must not be used in a park.
  `<Restroom position rotation elevation>`; doorway at local `[0, 0, 0.72]`
  (+z), footprint ≈ 1.44 × 1.24, ridge 1.45.

Both `<Stall>` and `<Restroom>` auto-deck-match a nearby elevated path node
within 1.75 u (explicit `elevation` overrides), and a lift > 0.35 gets an RCT2
wooden scaffold + plank deck.

---

## Picking a line-up

A worked THRILL roster for a 48 plot (6 rides, all bands covered, 4 stalls via
the Bazaar plus one kiosk on the hub):

| slot | ride | intensity | district |
|---|---|---:|---|
| flagship | `<Coaster>` §4.0-A or C | 7 | hills / the ring |
| gentle transport | `<Monorail>` "Grand Circle Tour" | 1 | spans the plot |
| gentle landmark | `<ObservationTower>` | 1 | hub |
| water | `<LogFlume>` "Big Chute" | 5 | waterside |
| moderate | `<Bobsleigh>` "Summit Chute" | 6 | hills |
| moderate/flat | `<GoKarts>` or `<GhostTrain>` | 5 | fairground |

A FAMILY roster swaps the flagship for §4.0-B and replaces Bobsleigh with
`<PaddleBoats>` (1) and `<Helicycles>` (2), keeping one intense ride so the
bands are still spanned.
