# SETUP — building scenes and parks with the RCT2 3D rigs

> **IF THE USER ASKED FOR A PARK, BUILD ONE.** This file is injected as
> `<setup_instructions>` and it is **not** a list of boilerplate file edits — there is no
> "add import X to file Y" task anywhere in it. It is the SPEC: compose the park in the
> entry file out of the paste-able blocks in §0-P below, mount it, ship it.

The end-to-end manual, from one spinning ride to a full simulated park; component detail lives in
each `components/<Name>/Context.md`. **Every validator and probe WARNING is FATAL** — a warning is
an auto-fix that rescued something you were supposed to plan.

> ## ⚠ THIS IS THE ONLY RULES FILE INJECTED INTO EVERY GENERATION. EVERY OTHER PATH IS PROVENANCE.
>
> Measured from a generation's own message history: of the whole `rules/` corpus only
> `rules/setup.md` — this file — is injected AUTOMATICALLY. A path or a `§x.y` here is
> **where the number was measured, not an errand.** If a block is not in front of you, do
> not reconstruct it from memory: everything mandatory is pasted into §0-P below.
>
> ## ⚠⚠ DO NOT CALL `get_design_guidelines`. IT WILL DESTROY YOUR PARK.
>
> It returns **all 16 `rules/*.md` in one payload — 658 770 bytes.** Measured 2026-07-27,
> wave 18A: the call landed, the very next tool action was *Summarized chat context*, and
> the agent then read the **complete 667-line park it had just written itself** as
> *"already an App.tsx … full of stubbed/broken code"*, threw it away, and restarted from
> scratch. It burned half its budget and shipped **75.89** where the round before it
> shipped 94.00. The rules corpus is REFERENCE FOR THE MAINTAINERS; it is not a document
> you can afford to read. **This file is sufficient. Build from it.**
>
> Skills are the same story from the other side: `skills/*/SKILL.md` were reachable in
> earlier rounds but waves 18A and 18B both loaded **0 of 5**, and no tool in either
> transcript surfaces `skills/**` at all. **So nothing mandatory lives only in a skill.**

## 0-P. PARK MANDATES — the gates that refuse to bundle (READ FIRST for any park)

`harness/park-eval/preflight.mjs` runs **before esbuild and before any browser**, and
`eval.mjs` / `probe.mjs` both call it first and **refuse to launch on any problem** — exit 1,
no screenshots, no `probe.json`, no `validatePark` line. A round that trips one scores
**0/100 by absence of evidence**, and nothing later in the pipeline can recover it.

### 0-P.0a THE CATALOG IS 112 COMPONENTS, AND INSTALLING THEM IS FREE

**THERE ARE TWO RUNTIMES AND YOU MUST HANDLE BOTH. TRY A DIRECT CALL FIRST.**
`list_components`, `install_code_component`, `read_component_docs` — in one runtime these are
plain unwrapped tool calls and the display names **List Components** / **Install Code
Component** / **Read Component Docs** / **Get Setup Instructions** are the RECEIPT that one
landed (measured: 20 installs in a single run, no "Tool not found").

**IF A DIRECT CALL ANSWERS "Tool not found", YOU ARE IN THE OTHER RUNTIME — USE THE WRAPPER,
AND READ ITS ERROR.** The wrapper (`run_design_system_tool`) is real there, and calling it with
no inner tool name replies with the whole menu:

```
Tool "undefined" is not available for this design system. Available tools:
get_setup_instructions, list_components, read_component_docs, list_design_tokens,
get_design_guidelines, install_code_component, install_docs_module
```

**That message is the API documentation — it tells you the inner names are exactly the ones
above.** Pass the inner tool name in the wrapper's tool-name argument (try `tool`, then
`toolName`, then `name`) together with that tool's own arguments;
`install_code_component` takes the path `components/Park`. **DO NOT CODE-SEARCH FOR THE WRAPPER
NAME** — one run ran two searches, drew **269 000 characters**, was instantly *Summarized chat
context*, and lost its catalog.

> ### ⛔ NEVER FABRICATE A COMPONENT — NOT ONE FILE, NOT AS A "MINIMAL SHIM".
> Wave 22A burned its whole run here: six wrapper calls with an `undefined` inner name, then it
> gave up and started **writing its own `components/Park.tsx` from scratch**. A hand-written
> `Park`, `SetPieceKit` or `SplineRideKit` is not the design system — it has no `validatePark`,
> no `buildParkNet`, no rated coasters, and the park scores **nothing**. An earlier run did the
> same and shipped a PLACEHOLDER artifact (fabricated §0 header, park body commented out).
> A loud failure is recoverable; a fabricated design system looks like a park and is worth 0.
>
> ### ⛔ AND "I HAVE NO DESIGN-SYSTEM TOOLS" IS A CLAIM YOU MUST TEST BEFORE YOU MAKE IT.
> This rule used to read *"IF YOU CANNOT INSTALL, STOP"* full stop, and on 2026-07-28 a round
> obeyed it **off the tool list alone** — it never attempted a single call, quoted this line back
> at us, and shipped nothing. Stopping without fabricating is still the right ending when there
> is genuinely no install route, but it is the **FOURTH rung of §0-P.0b, not the first**, and it
> has a required output. **Go run the ladder in §0-P.0b before you conclude anything.**

**Call `list_components` ONCE, keep the result, and treat it as the authority on what
exists.** It returns the COMPLETE, alphabetical, untruncated catalog — *Design System "3D
RollerCoaster Tycoon Park": 112 Components* — matching `mp3d/components` on disk exactly.

**Installing is cheap and it CASCADES.** Installing `components/Park` alone
pulls in ~50 components transitively; a finished artifact measured 65 files, 59 of the 112
components, 2.47 MB of 4.35 MB of component source. **There is no install count limit and no
byte budget. NEVER trim the roster to reduce installs** — one round shrank its park around a
build step that costs nothing.

**THE ARTIFACT'S FILE LIST IS NOT THE CATALOG.** If a component is not under `components/`,
INSTALL it — never conclude it does not exist; and if your context was summarized, call
`list_components` AGAIN rather than inferring the catalog from an install receipt. One round
read *"Also installed 49 additional components: …"* as the inventory and dropped nine rigs
that do exist.

**IMPORT FROM `'./components/<Name>'`.** Installs are FLATTENED —
`components/PulseScenery/index.tsx` and its submodules become ONE
`components/PulseScenery.tsx` — but that file still sits UNDER `components/`, and your
entry file sits BESIDE that folder, so the specifier is `'./components/PulseScenery'`.

**THIS PARAGRAPH USED TO SAY THE OPPOSITE** — "imports are siblings, import
`'./PulseScenery'`, never `'./components/…'`" — and it was WRONG. Wave 18A obeyed it and
took `Build failed with 20 errors: Could not resolve "./SplineRideKit"`, then had to
rewrite all 21 specifiers. Every shipped reference park disagrees with the old text and
agrees with this one: `samples/skeleton-a.tsx:134`, `samples/r17a.tsx:34` and
`samples/r18a.tsx:36` all import `'./components/Park'`. **Every import specifier in this
file is already in the `./components/` form — copy them verbatim.**

**AND HERE IS WHICH MODULE EACH NAME COMES FROM. `<World>` IS NOT ON THE `Park` BARREL.**
Wave 19A looked for `World` on `'./components/Park'`, did not find it, wrote *"no
`<World>`/`worldPlan` export exists in this build"* in its own §0 header, shipped districts
as loose clusters instead — and **forfeited the entire 5-point worlds axis** on a component
that was there the whole time. This block is the authority (it is `samples/skeleton-a.tsx`'s,
verbatim); nothing mandated below is missing from the catalog:

```tsx
import type { V3, XZ } from './components/Park';
import type { TrackPiece } from './components/SplineRideKit';
import { Park, GameManager, Terrain, Paths, Gate, Coaster,
         Restroom, Scenery, Lights, Placed, offPathCell } from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import { buildParkNet, worldPlan, World,
         BRASSWORK_FOUNDRY, PULSE_DISTRICT, THORNWICK_GLADE } from './components/SetPieceKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';
```

**`buildParkNet`, `worldPlan`, `World`, `NetRef` and `SetPiecePlan` all live in
`SetPieceKit`** — `laneLenOf` and `parkComposition` in `ParkBuilder`, each set-piece's plan
beside its own component. **If a name is not where you first looked, it is in one of these
seven modules — never conclude it does not exist.**

### 0-P.0b A THIRD RUNTIME HAS NO DS TOOLS IN ITS LIST AT ALL — RUN THE LADDER, THEN THE MARKER

**A VISIBLE TOOL LIST IS NOT THE AUTHORITY ON WHAT YOU CAN CALL** — same class of evidence as
an artifact's file list (§0-P.0a), and wrong the same way. Measured 2026-07-28: a round reported
*"no `list_components`, `install_code_component`, `read_component_docs` or
`run_design_system_tool` are available in my toolset (only file read/write/replace)"*, quoted the
⛔ rule above, and ended with **zero output**. It had inspected a list. It had not attempted a
call. Four rungs, in order, and **record the verbatim reply from each** — you will need them:

1. **CALL `install_code_component` WITH `components/Park` BLIND, EVEN IF THE NAME IS NOT LISTED.**
   Tool names are namespaced in some runtimes (`mcp__…__install_code_component`) and loaded
   lazily in others, so absence from a list is not absence from the runtime. One call costs
   nothing and returns either a receipt or an error worth quoting. Then `list_components` the
   same way. **Search your own tool list by SUBSTRING — `component`, `design`, `install` — never
   by exact name.**
2. **CALL THE WRAPPER `run_design_system_tool` WITH NO INNER TOOL NAME** and read the menu it
   errors with (§0-P.0a). That error IS the documentation.
3. **READ THE DISK — `components/` MAY ALREADY BE THERE, AND THEN THERE IS NOTHING TO INSTALL.**
   A file-read/write-only runtime is still a runtime that can build a park *if the catalog was
   installed before you arrived* — a design forked from one that already installed it carries
   `components/*.tsx` from the first second (the four artifacts of 2026-07-27 each list 80+ files
   under `components/`). So list the project root and read `components/Park.tsx`. Read
   `package.json` as the one-line tell: **if it contains `"three": "0.169.0"`, the design system
   is installed in this project** — import `'./components/Park'` and build the park NORMALLY, no
   install step, no marker, no stopping.
4. **ONLY IF ALL THREE FAILED: EMIT THE MARKER BELOW AND STOP.**

**AND HERE IS WHY RUNG 4 IS NOT DEFEATISM — THE BARE SCAFFOLD CANNOT BE HAND-WRITTEN AROUND.**
A design created with this design system attached and NO prompt (`eye4wxfxvsh9e259vku2ue`,
2026-07-28) holds exactly five files — `App.tsx`, `index.css`, `index.tsx`, `package.json`,
`tailwind.config.js` — **zero components**; and reads of `components/Park.tsx`,
`components/Park/index.tsx`, `design-system/components/Park/index.tsx` and `rules/setup.md` all
come back `{"files":[]}`, so **the file surface does not fall through to the design system.**
That scaffold's `package.json` also has **no `three` at all** — `install_code_component` is what
adds `"three": "0.169.0"` (compare the tooled artifact `f829e635`). An empty project with no
install route therefore has no renderer, no 4.35 MB of rigs and **no version of "just write it
myself" that draws a single pixel.** Stopping there is correct. Stopping there *without running
rungs 1-3, and without leaving the marker*, is what cost the 2026-07-28 round.

**THE BLOCKED-ROUND MARKER — THE ONLY ACCEPTABLE ZERO-PARK ENDING.** An infra block and a park
that failed on its own merits are handled differently — the block is RELAUNCHED, the bad park is
SCORED — and from the outside they look identical. So write **exactly one file, `App.tsx`**, with
the token `MP3D_BLOCKED_NO_DS_TOOLING` as its **first line**, and **never create anything under
`components/`**:

```tsx
// MP3D_BLOCKED_NO_DS_TOOLING
/* No design-system install route existed in this runtime. NOTHING WAS FABRICATED: this
 * artifact contains no design-system code, no components/ directory and no <Park>.
 *   install_code_component('components/Park')  -> <verbatim reply>
 *   list_components()                          -> <verbatim reply>
 *   run_design_system_tool (no inner name)     -> <verbatim reply>
 *   read 'components/Park.tsx'                 -> <verbatim reply>
 *   read 'package.json' / root listing         -> <verbatim listing>
 * PLAN NOT BUILT: <the §0 arithmetic you had already worked out, so the relaunch inherits it>
 */
import React from 'react';
export function App() {
  return (
    <div style={{ padding: 24, fontFamily: 'monospace' }}>
      MP3D_BLOCKED_NO_DS_TOOLING — no design-system install route in this runtime; nothing fabricated.
    </div>
  );
}
```

**Then say the token on its own line in your final chat message.** Grep, screenshot and
transcript then agree with each other and the round is triaged in seconds. Three things about it
are load-bearing: the token is **copied verbatim** — not paraphrased, reformatted or decorated;
the marker line is a `//` run under 200 characters so `hasPreflightHeader` (§0-P.1) is FALSE and
preflight **refuses to bundle**, which is the outcome you want (a blocked round must not be
graded as a park); and it is **never emitted alongside hand-written design-system code** — a
marker on a fabricated park is worse than either failure by itself.

### 0-P.0 "THE HARNESS ISN'T THE RUNTIME" — the objection, answered

**`validatePark` RUNS INSIDE `<Park>`, IN THE PREVIEW.** `parkRoot.tsx:284` calls it from
`ctx.whenBuilt(...)` one settle after the children mount and the `validate` prop **defaults to
`true`** (`parkRoot.tsx:79`) — not gated on the harness, on `NODE_ENV` or on a flag, so every
park anyone previews validates itself into the console in front of the user. It does not stop
the render, and that is the point: `<Park>` renders an `ok: false` park as happily as a good
one, and every failure names something VISIBLE — a ride pad in a lake, a street edge through a
fountain basin, a queue no guest can reach, a train that derails on its first lateral.

**SO THE ASSERTIONS MUST REPORT — LOUDLY, IN ONE BLOCK, AND THEY MUST NEVER THROW.**
`parkAssert` / `parkAssertFlush` (§0-P.5) collect every failure and print ONE numbered
`console.error`. **`parkAssertFlush` DOES NOT THROW, and no assertion is fatal.**

**THIS REVERSES THE OLD RULE, AND THE MEASUREMENT IS WHY.** This section used to read "the
assertions must throw", on the reasoning that a check nobody acts on reads as "checked". That
is a real hazard, and it is the *smaller* one. A throw at module scope means React never
mounts: no Stage, no `validatePark` verdict, no registered ride — **all sixteen axes score
zero**, including the fifteen that were perfect. MEASURED across one session, three separate
parks lost EVERYTHING to a single droppable piece:

| park | the throw | what it was actually about | it should have |
|---|---|---|---|
| 25B | `nodeInSolid` | one node **1.44e-15 u** inside a bazaar | kept the node |
| 28A | `padReach` | ONE `<PirateShip>` pad 0.33 u short | omitted that ride, shipped the other nine |
| 29B | `ringPose` | no monorail pose cleared the flank | **omitted the monorail** |

All three would have scored in the 90s. All three scored **0**. A silent check is worth
nothing; a check that deletes the park is worth *less* than nothing.

**So the contract is: MEASURE EVERYTHING, REPORT EVERYTHING, SHIP ANYWAY.** A defect you can
see in a rendered park is diagnosable and costs a few points. A black page costs the round.
When a check fires, the correct response is to **drop the offending piece and ship the rest** —
never to abort the park.

### 0-P.1 The §0 PRE-FLIGHT header — and the THREE mechanical requirements

`hasPreflightHeader()` (`preflight.mjs:373`) reads `leadingCommentBlock(rawSrc)`, which
scans from the **first non-whitespace character** of the file: `/*` takes that block, `//`
takes the contiguous run of `//` lines, and **anything else — an `import`, JSX, code —
returns the empty string.** So:

1. **THE HEADER MUST BE THE FILE'S LEADING COMMENT — PHYSICALLY ABOVE THE IMPORTS.** One
   `import` line above it makes the inspected block **empty** and the gate fires even though
   the header is right there in the file — on its own that produced a 0/100 round. Nothing
   may precede it: no `/** @jsx */` pragma, no `'use client'`, no blank-line trickery.
2. **IT MUST BE >= 200 CHARACTERS** — `HEADER_MIN_LEN = 200` (`preflight.mjs:344`), measured
   on the comment block including its delimiters. A one-line docstring fails.
3. **IT MUST MATCH ONE OF `HEADER_KEYWORDS`** (`preflight.mjs:339-343`), verbatim:

   ```js
   const HEADER_KEYWORDS = [
     /§0/, /PRE-FLIGHT/i, /\bSEED\b/i, /\bSIZE\b/i, /\bWORLDS?\b/i, /\bROSTER\b/i,
     /\bGATE\b/i, /\bFLAG\b/i, /\bQUEUE\b/i, /\bLATTICE\b/i, /\bSPREAD\b/i,
     /\bDRESS\b/i, /\bMONO(?:RAIL)?\b/i,
   ];
   const HEADER_MIN_LEN = 200;
   ```

   Tolerant of form, strict about presence: row labels and banner glyphs are not policed.

**THE LITERAL FILL-IN TEMPLATE. Paste it as line 1 of the file, above the imports, and
replace every `<…>`. Write it FIRST and finish it LAST — every number COUNTED FROM THE FILE
you are shipping, never estimated.** Written honestly it catches missing `<World>`
declarations, pads inside a published peak, an absent `plazas` prop and a missing
`rateCoaster` call before a line of JSX exists. Two rules make it bite:

1. **A NUMBER YOU HAVE NOT COMPUTED IS WRITTEN `TBD`, never a plausible value.** A fabricated
   header is WORSE than an incomplete one: it defeats the check it pretends to pass. One
   carried `reliefFloor.kept 0.81 · probes 17→17 · NODES 48 · gridRegularity 0.38` with **zero
   code executed**.
2. **EVERY `>=` / `<=` ROW MUST BE ARITHMETICALLY TRUE**, every signed offset re-added. That
   same header ticked `tail→pad 9.6 >= 9.74 ✓` twice, and `tail [0,57.6] out [0,1] → pad
   [0,47.4]` where that `out` sign yields z **+67.8**. **A row that does not hold means the
   park is not ready to ship**, not that the row needs a tick.

```tsx
/* ═══ <PARK NAME> — §0 PRE-FLIGHT ═══════════════════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   <n> / <climate> — dominant lake ctr (<x>, <z>) <p>% · secondary ctr (<x>, <z>) <p>%  [PRE-keepDry]
 *        RING WATER WALK: all 16 monorail ring cells vs BOTH bodies' waterlines —
 *        tightest = <cell> → <d> u from (<x>,<z>) wl <r> = <d−r> u dry ✓ (none wet)
 *        ring-only re-compose: probes <a>→<b>, terrainSeed <n> unchanged, water ok ✓ ·
 *        every pad + prop cell re-checked IN THE TREE by the GATE'S OWN predicate —
 *        min ground over its footprint ring > WATER_LEVEL + 0.05 = −0.21 (§0-P.6) ✓
 *        (isDryCell alone does NOT prove this · 0 plantedWetCell in the console ✓)
 *        reliefFloor.kept <k> ≥ 0.70 ✓   ← report.reliefFloor, NOT report.relief
 * WORLDS 5 (ALL of them): fire @(<x>,<z>) · pirateBeach @(<x>,<z>) · steampunk @(<x>,<z>)
 *        · enchantedForest @(<x>,<z>) · neon @(<x>,<z>)
 *        all centre pairs SORTED, closest marked (the floor binds the CLOSEST):
 *        <a>↔<b> <d> ◄ ≥ 32.66 (20·√(128/48)) ✓ · DRY GAP between world RECTS > 0 ✓
 *        WORLD <id>: rides <Rig> + <Rig> (2 OF ITS THEME, distinct names, inside rect ✓)
 *              · stall <its own counter> · scenery 25 placements · GROUND + GIANT ✓ · path spur ✓
 *        …one row per world. >= 10 THEMED scenery PLACEMENTS each, ALL from that world's own
 *        pack — a foreign themed piece is a §0-FATAL `worldThemeMixed` ✓
 * CATS   (WRITTEN BEFORE ANY JSX) gentle <Rig> · thrill <flagship> · water <Rig>
 *        · transport Monorail ring · dark <Rig>   → 5/5 categories ✓
 *        RARE PICKS <Rig> + <Rig> — each appears in this WHOLE FILE exactly ONCE, only in
 *        §0-P.5's PAD_MARGIN table (ctrl-F it): no worked example, so nothing copied it ✓
 * CIRCUITS  §4.0-C · §4.0-B · Monorail ring · <Rig> · <Rig>
 *        → <n> CIRCUITS (rideRoster.circuitCount, ≥ 5) / <n> FAMILIES
 *        (rideRoster.circuitFamilyCount, ≥ 3) — families are coaster|water|transport|dark|
 *        tower, so two coasters are ONE family. Two counts, never one fraction ✓
 * GATE   [0, 63.6] → first queue tail [<x>,<z>] = <d> u  ≤ 15 ✓
 * FLAG   §4.0-C start [16.8, 0.55, −3.6] heading 0, steel, cars 3, NO bank prop (builds 0.7)
 *        rateCoaster(bank 0.7, cars 3) → E 6.27 / I 9.55 / N 3.55 / drop 5.47 / maxLatG 0.73
 *        / air 1.33 s / inversions 2  ← MEASURED with the bank+cars the mount uses
 *        CORRIDOR KEEP-OUT in PLOT coords: §0-P.4's four rects, pasted
 *        every street node + every boulevard leg OUTSIDE them ✓ (no leg crosses at grade)
 * FLAG2  §4.0-B start [−33.6, 0.55, −48.0] heading 0, steel, cars 3, NO bank prop
 *        rateCoaster(bank 0.7, cars 3) → E 5.27 / I 6.25 / N 2.25 / drop 3.58 / maxLatG 0.27
 *        DIFFERENT archetype ✓ · bbox DISJOINT from FLAG's ✓ · off all 16 ring cells ✓
 *        outside every <World> rect ✓ · coasterPts = [...FLAG_PTS, ...FLAG2_PTS] ✓
 * STREET buildParkNet called EXACTLY ONCE ✓ · the SAME NET feeds <Paths> and every offPathCell ✓
 *        PORT-REFS: <k> pieces → <k> refs in EDGES, counted and listed ✓
 *        every pad returned BY offPathCell (never a raw tail+out·d sum) ✓ · 0 padOnStreet ✓
 * MONO   ring VERBATIM · position [−42.6, 0, −9.7] (the START POSE, not the centre)
 *        4 platforms ≥ <k> declared worlds (one each) ✓
 *        probe.monorail.worldsTouched <k> = worldsDeclared <k> → everyWorldTouched true ✓
 *        worldsTouchedIds [<ids>] ← the NAMES live here, not in the counts
 *        tails [−36.0,−8.4] · [0,27.6] · [36.0,−8.4] · [0,−57.6] authored NODES, ALL LEAVES ✓
 *        (S queues OUTWARD; gate spine ENDS at the hub, N tail reached laterally — §0-P.4)
 * QUEUE  ONE ROW PER RIDE — tail is an authored NODE, pad DERIVED from it (never the reverse):
 *        <Rig>  cap <c>  tail [<x>,<z>]  out [<ux>,<uz>] → pad [<x>,<z>]  tail→pad <d> ≥ <floor> ✓
 *        …one row per ride · no two rides share a tail node · every tail appears in NODES ✓
 *        clear = padMarginOf(<Rig>) off the §0-P.5 table, never the 3.2 default by guess ✓
 * GROUND per ride, the 5 cells (pad · hut · hut · tail · exit join) inside the 0.5/1.2 grade ✓
 *        every one outside every peak disc (bumpAt ≤ 0.75) ✓ · causewayEdges EMPTY ✓
 * SPREAD built bbox <w> × <h> ≥ 70 × 45 ✓ · street-node bbox → pathExtent <e> ≥ 0.55 ✓
 * PLAZAS <k> rects from NET.plazas: <a> / <b> / <c> u² → largest ≥ 8 ✓ areaSpread <s> ≥ 1.8 ✓
 *        NO set-piece `position` appears in NODES or as a queue tail ✓
 * NODES  <k> authored · degree-1: <k> (<frac>) → each carries a queue tail / stall / gate ✓
 *        one PARK-SPANNING loop, crosses z = 0 ✓ (not a court-sized cycle)
 * ATTACH ONE ROW PER SPUR. Two ways a spur goes unreachable, and they are different:
 *        (a) GRADE. `nodeY` is the offset from the street's MEDIAN level, not from ground.
 *            The reachability walk (PathNetwork/build.ts:314) seeds at |nodeY| ≤ 0.05 — the
 *            bulk of the street — and then walks any edge whose |dy|/len ≤ 0.5/1.2. So a
 *            spur off a ramped parent is fine PROVIDED the connecting edge stays inside
 *            that grade. Write the grade, not just the offset:
 *            spur [<x>,<z>] nodeY <y> → parent [<px>,<pz>] nodeY <py> · len <l> ·
 *            |Δy|/len <g> ≤ 0.417 ✓
 *        (b) A REFUSED SPAN. `<Paths>` DROPS a span outright when it crosses a dip or bank
 *            past the hard limit (wrappersLand.tsx:590) — the edge is not built, so the
 *            graph SEPARATES and every node behind it reads unreachable. A dropped span is
 *            not a lint you can spend points on; it removes the street.
 *        …one row per spur · 0 "deck unreachable" ramp lints ✓ ·
 *        accessibility.allRidesReachable MUST come back true ✓
 *        (18A shipped allRidesReachable FALSE with 2 `blockers` and 14 deck-unreachable
 *         lints — a street edge crossed its OWN coaster queue lane, that span was refused,
 *         and the whole second-coaster spur went dark: −9.08 on axis 12. Its geometric
 *         causeway/steep tests were both EMPTY, so those numbers will NOT warn you.)
 * LATTICE authored spans <a>/<b>/<c>/<d> u + the 1.2 chains → effectiveClasses <e> ≥ 4 ✓
 *        1.2-u chain share <s> ≤ 0.55 ✓ · gridRegularity <g> ≤ 0.55 ✓ (floor 0.40)
 * ROSTER (WRITTEN LAST, counted off the register calls, and restated on <Park roster>)
 *        <k> rides / 5 categories / <k> stalls (<k> kinds) / restroom ✓ / bins ✓
 *        NAMED: every ride AND EVERY STALL carries an authored `name` — 0 shipped under
 *        its catalog `defaultName` ✓ (a bare <BurgerShop/> takes "Burger Bar"; wave 18A
 *        named all 10 rides and then shipped 3 default-named kiosks. Stalls count.)
 *        the <k> stalls here MUST equal the registered count — 18A's header claimed 8
 *        against 15 registered and took a `rosterOverstated` gate warning ✓
 *        <Park roster={{ rides: [...<k> names], stalls: <k>, categories: 5 }}> MOUNTED ✓
 *        ← without the PROP, preflight prints "refusing to bundle" and NOTHING renders
 * DRESS  <k> trees ≥ 32 ✓ · <k> scenery ≥ 16 ✓ · water <p>% (climate band <a>-<b>%) ✓
 *        EVERY prop cell from offPathCell(clear 1.2); buildings from clear 1.8 ✓
 *        no prop cell reuses a street node coordinate or sits on an edge centreline ✓
 * NIGHT  <k> <Lights> runs · <k> neon · <k> torches · draws ~<n> ≤ 3 000 ✓
 * GATE   parkAssertFlush() → 0 blocking (it NEVER throws) · validatePark → ok: true, 0 failures
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import { Park, GameManager, Terrain, Paths, Gate /* … */ } from './components/Park';
//  ↑ THE IMPORTS COME AFTER THE HEADER. Above it, whitespace only.
```

### 0-P.2 `<Park roster={{ rides, stalls, categories }}>` is MANDATORY

`checkPreflightHeader` (`preflight.mjs:387`) refuses to bundle a `<Park>` with no `roster` prop:
without it the header's roster arithmetic is never wired to the live registry, so
`validatePark`'s `rosterOverstated` check has nothing to audit. Write it
`roster={{ rides: 9, stalls: 5, categories: 5 }}` (or `rides: [...names]`) — counted off the
`register={{…}}` calls that actually MOUNT, **not off the header** — beside
`onReady={(report) => { /* report.ok MUST be true */ }}` (§5's example mounts both).

### 0-P.3 ALL SIX PRE-BUNDLE GATES, enumerated

`preflightCheck()` returns a flat problem list and `reportPreflight` prints `refusing to bundle`;
**any one non-empty entry stops the round.** The first three run over the entry file *and every
local sibling module it imports*; the last three are entry-file only.

| # | check (`preflight.mjs`) | fires when | fix |
|---|---|---|---|
| 1 | `checkImports` `:400` | a relative import names a component that is **not a directory under `mp3d/components/`** — read fresh off disk every run. The five land macros `BrassworkFoundry`, `PulseDistrict`, `ThornwickGlade`, `EmberfallCaldera`, `TidewaterHollow` DO NOT EXIST | build the world from a themed set-piece plan + its own rides/stalls + its surviving `*Scenery` pack. The catalog IS the filesystem |
| 2 | `checkPiecesCast` `:410` | a `<Coaster>`/`<TrackRide>` `pieces={… as string[]}` or `as unknown as string[]` | `pieces` is `TrackPiece[]` — drop the cast, fix the real type mismatch. (Plain `as any` is NOT flagged) |
| 3 | `checkRatingsWithoutMeasurement` `:422` | an authored `ratings={{…}}` on a `<Coaster>`/`<TrackRide>` with **no `rateCoaster(` call anywhere in the file** | call `rateCoaster` on the compiled points and log it. Comments are blanked first, so a call-shaped string in a docstring does not satisfy it |
| 4 | `checkPreflightHeader` `:387` — **problem A** | `hasPreflightHeader()` false: leading comment absent, under 200 chars, or matching no `HEADER_KEYWORDS` regex | §0-P.1 — and put it **above the imports** |
| 5 | `checkPreflightHeader` `:387` — **problem B** | a `<Park>` tag with no `roster={` prop | §0-P.2 |
| 6 | `checkMonorail` `:307` | the entry authors a `<Park>` and **no `<Monorail>` appears in the park's own sources** | §0-P.4 — mount the ring |

Two more are easy to mistake for a pass: a **nonexistent entry file** and a walk that **collected
zero source files** both report *"nothing was linted (this is not `clean`)"*. `[preflight] <file>:
clean` is the only green line.

### 0-P.4 THE BUILD MANDATES — state them positively, because they are unconditional

- **BUILD AT SIZE 128.** Omit the `size` prop (`parkRoot.tsx:137` — 128 is the default)
  unless the user asked for a different plot. 128 is what every published number,
  skeleton, seed row, corridor table and clearance figure is measured at. **Do not pick
  a smaller plot to get out of scope of a check** — the park that did that, at size 48,
  lost the monorail, all three worlds, its second coaster and a water body.
- **SHIP THE MONORAIL RING — OR DROP IT.** One park-spanning `<Monorail>` with a boarding
  platform in every declared world. It is worth one ride and the `transport` category; if no
  pose works, **take transport from `<GoKarts>`/`<Chairlift>` and move on** (§0-P.4's
  never-abort rule).

  **THE MOUNT SIGNATURE IS THE TRAP.** `<Monorail>` is a `composableRide`: its props are
  **`position` and `rotation`** — there is no `start` and no `heading`. Pass those and they are
  swept into `...rest` and silently dropped, mounting the whole ring at the origin with a
  perfect compile report and `worldsTouched: 0`. At size 128:
  `position={[-42.6, 0, -9.7 + RING_DZ]}`, `rotation={0}` — that is the **START POSE, not the
  ring centre**.

  **COPY THE 17-PIECE RING VERBATIM** (the array is below). This is the ONE ride you may not
  re-author: a hand-written list synthesized 52 % of its arc and shipped an unboardable ride.

  **THE POSE IS SEARCHED, NOT ASSUMED.** The four decks sit at
  `[-42.6, RZ] · [0, NZ] · [42.6, RZ] · [0, SZ]` with `RZ = -8.4 + dz`, `NZ = 34.2 + dz`,
  `SZ = -51.0 + dz`, and the published `dz = 0` puts the south deck on a hill flank at bump
  0.87 against the 0.75 limit on seed 1. So sweep `dz ∈ [0, ±1.2, ±2.4, ±3.6, ±4.8, ±6.0]`,
  score `bumpIn(COMP0, deck)` on **all four** decks plus the dryness of all 16 ring cells, and
  take the first pose that clears both. A narrower sweep dead-ends; `keepDry` does NOT move a
  flank.

  **EVERY DECK NEEDS AN AUTHORED TAIL NODE, AND ALL FOUR MUST BE STREET LEAVES** (degree 1) —
  a street continuing past a tail runs through the deck (`blockers` FAIL). Tails sit 6.6 u off
  their deck: `[-36.0, RZ] · [0, NZ-6.6] · [36.0, RZ] · [0, SZ-6.6]`. **W/N/E queue INWARD;
  SOUTH queues OUTWARD** (`queueDir [0,-1]`) — that asymmetry is measured, not stylistic:
  inward, its tail and the paved column to it stand 5.3–5.8 u from the biggest summit, the
  terrain guard flattens the range and `stdH` drops under the axis-7 floor.

  **THE RING, VERBATIM — THIS IS THE ONE CANONICAL COPY** (the other five were deleted;
  every rules and skills file now points here):

```tsx
  const MONO_PIECES: TrackPiece[] = [           // a real TrackPiece[] — NO `as` cast (gate 2)
    'station',
    { type: 'straight', length: 35.3 },
    { type: 'turnL', angle: 90, radius: 6 },
    { type: 'straight', length: 35.3 },
    'station',   // platform 1 — NORTH
    { type: 'straight', length: 35.3 },
    { type: 'turnL', angle: 90, radius: 6 },
    { type: 'straight', length: 35.3 },
    'station',   // platform 2 — EAST
    { type: 'straight', length: 35.3 },
    { type: 'turnL', angle: 90, radius: 6 },
    { type: 'straight', length: 35.3 },
    'station',   // platform 3 — SOUTH
    { type: 'straight', length: 35.3 },
    { type: 'turnL', angle: 90, radius: 6 },
    { type: 'straight', length: 33.5 },   // the tail in TWO pieces — MERGED into one 35.0 it
    { type: 'straight', length: 1.5 },    // emits a midpoint, the end point is popped, and
  ];                                      // closure.gap = 17.80: FATAL
  ```

  **AND THE BEAM IS A KEEP-OUT BAND, NOT A POINT.** The ring registers a footprint rect for
  every span, so a ride pad near the beam's PATH breaks the 1.5 u OBB edge gap while its centre
  is tens of units from any station. Treat the whole loop as ~2 u wide when choosing tails.


- **SEARCH THE RING POSE WIDE, AND IN BOTH AXES.** The pose search only works if
  the candidate list actually contains a clear pose. MEASURED on two parks run
  the same hour against the same seed: one searched
  `dz ∈ [0, −1.2, −2.4, −3.6, −4.8]`, found nothing under the limit (best 0.92)
  and hit a genuine dead end; the other included **−6.0** and cleared it. The
  peaks move with YOUR `coasterPts` pre-cap, so no single offset is universally
  right — search at least `dz ∈ [0, ±1.2, ±2.4, ±3.6, ±4.8, ±6.0]`, and if the
  whole column fails, sweep `dx` too before declaring the seed unusable.

- **⛔⛔ NEVER ABORT THE PARK. IF A PIECE WILL NOT FIT, DROP THAT PIECE AND SHIP
  THE REST.**

  `parkAssertFlush()` no longer throws (§0-P.5) — but you can still destroy a park
  by hand, with a bare `throw`, a thrown plan error, or an early `return null`
  from `App`. Any of those at MODULE SCOPE means React never mounts: no Stage, no
  `validatePark` verdict, no registered ride — **all sixteen axes score zero.**
  Not "a few points": the whole park, including the fifteen axes that were
  perfect.

  **MEASURED — THREE separate parks lost EVERYTHING this way in one session,**
  each over a single droppable piece, each while the rest of the park was sound:

  | park | the abort | what it was actually about | it should have |
  |---|---|---|---|
  | 25B | `nodeInSolid` | one node **1.44e-15 u** inside a bazaar | kept the node |
  | 28A | `padReach` | ONE `<PirateShip>` pad 0.33 u short | omitted that ride, shipped the other nine |
  | 29B | `ringPose` | no monorail pose cleared the flank | **omitted the monorail** |

  All three would have scored in the 90s. All three scored **0**.

  **THE MONORAIL IS OPTIONAL.** It is one ride and one `transport` category. If
  no ring pose clears the flank limit and the waterline, **drop the ring** — take
  the category from `<Chairlift>` or `<GoKarts>` (both `transport`) and ship.
  Losing the ring costs at most ~1 point. Aborting costs 100.

  ```tsx
  // the shape to use for ANY piece the park can live without
  const RING_OK = parkAssert('ringPose', bestBump <= PEAK_LIMIT && bestWet === 0,
    `no monorail ring pose clears the flank limit — SHIPPING WITHOUT THE RING; ` +
    `transport comes from <GoKarts> instead.`, 'blocking');
  // …then HONOUR it in the tree, rather than aborting:
  {RING_OK ? <Monorail … /> : <GoKarts … />}
  ```

  **Nine rides scores. Zero rides does not.** There is no condition under which
  refusing to render beats rendering something measurable — a defect you can see
  is worth a few points; a black page is worth nothing.

- **⛔ RIDE SPACING IS AN *OBB EDGE GAP* OF ≥ 1.5 u — NOT A PAD-CENTRE PITCH.**
  Axis 3 scores `rideSpacing.obb.minGap`: the smallest gap between the ORIENTED
  BOUNDING BOXES of any two registered rides, edge to edge. Under 1.5 u costs
  **−2**, and it does not stop there — axis 13's ride-count term is gated on
  axis 3 being full, so it drops to 1.75/2 as well. **One thin gap costs 2.25
  points.**

  **MEASURED, wave 28B (2026-07-27):** a park that got everything else right —
  clean gate, terrain 9/9, worlds 5/5, thrill 8/8 — scored **96.75** on a single
  `obb.minGap 1.4 < 1.5`. **It missed 99 by one tenth of a unit.** Its own
  spacing check was a 6 u PAD-CENTRE pitch assert, which passed comfortably
  while the real measurement failed.

  **THE TRAP IS THE MONORAIL RING.** The offending pair was
  `Three Crowns Skyline` (the ring) against `Salt Run Flume`. A ring registers a
  footprint rect for **every span of its beam** — that park published **126
  rects across 10 rides** — so the ring is not a point you can stand 6 u away
  from, it is a 170-u loop of thin rectangles threaded through your whole plot.
  Any ride placed near the beam's PATH violates the edge gap while its pad
  centre is still tens of units from any station.

  So measure the thing the axis measures, over the rects the manager actually
  holds, and do it AFTER the pads settle:

  ```ts
  const SPACING_FLOOR = 1.5;   // rideSpacing.obb.minGap, axis 3
  // in onReady, where the manager's real rects exist:
  const rects = report.footprints ?? [];      // every registered ride rect
  rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
    if (a.rideId === b.rideId) return;        // a ride never crowds itself
    const gap = Math.max(
      Math.abs(a.cx - b.cx) - (a.hx + b.hx),
      Math.abs(a.cz - b.cz) - (a.hz + b.hz),
    );
    if (gap < SPACING_FLOOR)
      console.error(`[park] SPACING: ${a.label} vs ${b.label} gap ${gap.toFixed(2)} < ${SPACING_FLOOR} — −2 on axis 3, −0.25 on axis 13`);
  }));
  ```

  **⛔ RIDES MAY NEST — THEY MAY NEVER TOUCH.** Two rides sharing ground plan is not a mistake:
  a coaster whose track flies clean over a flat ride's pad, a bobsleigh threading the middle of a
  ferris wheel, a station tucked under a lift hill — that is the best thing a park can do with
  its space, and a park that never does it reads as objects parked on a lawn.

  What is forbidden is CONTACT. Two rides must not intersect, clip, or graze each other in 3D.

  The footprint sweep used to be purely 2D, so it failed a legal overflight as if it were a
  crash. Since 2026-07-28 a footprint may declare a VERTICAL EXTENT, and when two rects overlap
  in plan but clear each other by **2.2 u** (`OVERFLY_CLEAR` — guest headroom plus a train) the
  overlap is allowed and reported as `nestedFootprint`, not failed:

  ```ts
  park.registerFootprint({ cx, cz, hx, hz, yaw, label: 'Cinder Spine deck', y0: 4.2, y1: 6.4 });
  //                                                                        ^^^^^^^^^^^^^^^^
  //  declare what you occupy VERTICALLY and you may share the ground plan under it
  ```

  **A rect that does NOT declare `y0`/`y1` is still treated as floor-to-sky and still fails on
  any overlap** — an undeclared height cannot be assumed short. So nesting is opt-in, by saying
  where you actually are. The same 2.2 u is the clearance the track-overfly rule already uses, so
  "legal to cross" means one thing everywhere in this design system.

  At author time the cheap defence is to keep every ride pad **clear of the ring
  beam's corridor**, not merely clear of its four decks: the beam runs the full
  rectangle through `RING_CELLS`, so treat that loop as a keep-out band a couple
  of units wide when you choose tails, exactly as you treat a coaster's
  corridor.

  Neither failing park called `bumpIn` **even once** — they flank-tested nothing, so the first
  news of the defect was the score. The reference skeleton tests every ride pad this way and
  relocates through `offPathCell`'s ring search when one trips.

  **What the "shaving" worry actually applies to** is the TAIL and the paved approach column near
  the summit — that is what drops `stdH` under the 0.75 floor, and it is why the south queue
  faces OUTWARD. It was never a reason to skip measuring the decks. **Do NOT shift the ring west to recover the rest:**
  it drops the West deck 4.2 u inside a world rect, trading "0 foreign pieces" for terrain. The
  approach runs down the **x −24.0** column then
  east along z −57.6 (`[−24, −48] → [−24, −57.6] → [0, −57.6]`), passing UNDER the south beam at
  `[−24, −51]`, 24 u clear of the deck pad.

  **PUT THE WORLDS ON THE RING** — `everyWorldTouched` tests whether each world's RECT contains a
  DECK, so four decks and five worlds is not a pass by arithmetic (one world will have
  no platform — give it a path spur instead); read
  `probe.monorail.worldsTouched` against `worldsDeclared`, the missing name out of
  `worldsTouchedIds`, and move that WORLD's rect — the deck cells are fixed. **The ring does not
  satisfy the gate-walk budget** (closest platform 24.0 u of street from the turnstile, past the
  20-u practical maximum), so pair it with a NON-monorail ride whose tail is inside 15 u of the
  gate to carry the smoke cycle. And **walk these 16 cells against your seed's water basins
  BEFORE you pin the seed** — a deck inside a basin is a shrunk lake:

  ```ts
  const RING_CELLS: XZ[] = [   // → the §0-P.6 guard sieve too
    [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],     // decks
    [-42.6, -9.7],   // the start pose
    [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],     // tails — AUTHORED street NODES
    [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79], // queue anchors
    [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],   // exits
  ];
  ```
- **A SET-PIECE'S `position` IS NEVER A STREET NODE AND NEVER A QUEUE TAIL.** A
  `<FountainPlaza>`/`<Bazaar>` `position` is its SOLID CENTRE; its connectors are its
  **PORTS**, one lattice cell outside the footprint. Wire `'hub:E'`, never `hub.position`. One
  park put its hub cell in `NODES`, used it as `fountainPlazaPlan({ position })` AND ran four
  edges across it: `edgeThroughSolid` ×2 (§0-FATAL) + a dropped edge + an orphan island + the
  `accessibility` FAIL — **~11 points from one coordinate.** Assert it with
  `assertNodesOffPieces` (§0-P.5) and re-run it over the PADS after the fuse.
- **AT LEAST TWO TRACKED RIDES, AND NOT TWO OF THE SAME THING.** Pick **two or more** from
  **`<Coaster>` · `<MineTrainCoaster>` · `<LogFlume>` · `<Bobsleigh>`** — four different
  vehicles, four different profiles, four different silhouettes. Bounding boxes disjoint.

  **"TWO COASTERS" WAS THE OLD WORDING AND IT IS WHY EVERY PARK SHIPS TWO COASTERS.** A steel
  coaster plus a mine train, or a coaster plus a log flume, or a bobsleigh plus a flume, all
  satisfy this — and each reads as a different ride from across the park. Add themed circuits
  (`MagmaRun`, `DeepDrift`, `WyrmsHollow`, `GearworksExpress`, `Bassline`, …) on top; they are
  the cheapest way to fill both a world's own-ride floor and the circuit count.

  `circuitCount` >= 5 across `circuitFamilyCount` >= 3 (families: coaster · water · transport ·
  dark · tower — two coasters are ONE family; flat rides are not circuits). Pass every tracked
  ride's points to `<Terrain coasterPts={[...]}>` so the landform pre-caps under all of them.

  **⛔ DESIGN YOUR OWN CIRCUITS — AND MAKE THEM DRAMATIC.** There are no excitement, intensity
  or nausea targets: build something worth riding and worth LOOKING at. Specifically:

  * **AT LEAST ONE INVERSION on the flagship — a vertical `loop` or a `corkscrewL/R`.**
  * **MORE CLIMB AND MORE PLUNGE.** Chain several `lift`/`drop` pairs of DIFFERENT heights,
    not four identical corners. A big first `lift` into a deep `drop` into the inversion, then
    smaller rolling `hill`s for airtime, is the shape people recognise as a roller coaster.
  * **VARY THE PLAN.** Mix `turnL` with `turnR`, use angles other than 90° and radii other
    than 2.5, and use `helixL/R` (a 360° helix buys height and length without moving the
    layout) and `sbend`.

  The arrays further down are WORKED EXAMPLES, not a shelf. Every one of them is the same
  closed rectangle — `station` then four identical `lift → straight → turnR 90° r2.5 → drop`
  corners — which is why fifteen corpus parks shipped one silhouette. **Do not make it a
  sixteenth.**

  **THE WHOLE VOCABULARY IS LEGAL AND MOSTLY UNUSED:**

| piece | what it gives you | notes |
  |---|---|---|
  | `turnL` / `turnR` | `angle` (default 90) + `radius` (default 1.5) | **nothing forces 90° or 2.5.** 45°, 135° and 180° all compile; mixed radii read as a real layout |
  | `loop` (`loopL`/`loopR`) | a 360° VERTICAL LOOP | **STEEL only.** `radius` is HALF-HEIGHT (default 1.8, clamped 0.7–2.6); `offset` is the lateral step (default 1.2, floored at 1.0); `angle` is ignored with a warn |
  | `corkscrewL` / `corkscrewR` | inverting barrel roll | STEEL only; on water/monorail profiles it silently becomes an `sbend` |
  | `helixL` / `helixR` | `angle` (default 360) + `height` | buys height and length. A **flat** 360° helix returns to its own entry point; a CLIMBING one does NOT — MEASURED 5.48 u forward at `height` 1, 7.86 at 2, 10.0 at 4. `angle` over 360° measures identical to 360° |
  | `sbend` | lateral shift, heading preserved | `radius` = offset (default 1.2, +ve left) |
  | `hill` | camelback — starts and ends level | airtime on the crest |
  | `lift` / `drop` | eased climb/descent | pitch-legal by construction |
  | `straight` / `flat` | level run | |
  | `station` | boarding — **put it FIRST** | several are legal (multi-platform) |

  Every piece enters and exits LEVEL, so they chain in any order. Reach for a figure-of-eight
  (`turnL` against `turnR`), a helix tower, an out-and-back with one big loop, a 180° hairpin
  twister. Mix radii; nothing forces 90° or 2.5.

  **VERIFY WHAT YOU DESIGN, AT MODULE SCOPE.** Authoring is only safe because the kit is
  importable inside the park. A hand-rolled circuit once shipped at 1.64 g and 1.96 g against
  the 1.275 g derail guard — translucent red, unregistered, `ratedCount 0`.

```ts
  import { compileTrackPieces, rateCoaster, checkCoasterDesign } from './components/SplineRideKit';

  const LAT_GUARD = 1.275;   // 1.5 g derail × 0.85 — PHYSICS, not a rubric target

  /** Compile a candidate, print its numbers, and say whether it is safe to ship. */
  function verifyCircuit(name: string, pieces: TrackPiece[], start: V3) {
    const out = compileTrackPieces(pieces, { type: 'steel', start, heading: 0, bounds: SIZE });
    const rating = rateCoaster(out.points, { type: 'steel', bank: 0.7, cars: 3 });
    // All three take the POINTS FIRST. (`checkCoasterDesign` also accepts a leading
    // THREE namespace for older call sites; it defaults to the bundle's own, so do
    // not pass one. An earlier revision of this snippet omitted a `t` that WAS then
    // required, and `points` landed where `t` was expected — `Uncaught TypeError:
    // t.CatmullRomCurve3 is not a constructor`, at module scope, park blanked.)
    const design = checkCoasterDesign(out.points, { type: 'steel' });
    const ok = out.report.ok && !out.report.fatal
      && rating.maxLatG <= LAT_GUARD && !design.violations.length;
    console.log(`[park] ${name}:`, {
      E: rating.excitement, I: rating.intensity, N: rating.nausea,
      maxLatG: rating.maxLatG, inversions: rating.inversions,
      synthesized: out.report.synthesizedCount, ok,
    });
    if (!ok) console.error(`[park] ${name} FAILED verification — ${out.report.fatal
      ?? design.violations.map((v: any) => v.kind).join(', ') ?? `maxLatG ${rating.maxLatG}`}`);
    return { ok, points: out.points, rating };
  }
  ```

  If it fails, iterate — widen a radius, shorten a drop, buy a loop's rise back out of the
  lifts. If you run out of ideas, fall back to a worked array and gate the mount on the result:
  `{FLAG.ok ? <Coaster pieces={MINE} …/> : <Coaster pieces={FALLBACK} …/>}`. A rectangle that
  works beats a novel circuit that renders red.

  **THE ONLY HARD NUMBERS — physics and the crash gate, not scoring:** `maxLatG <= 1.275` ·
  first drop >= 0.9 u · `pitchRate <= ~0.55` · clearance >= 0.9 · synthesized closure <= 40 % ·
  every point inside ±64.3 at size 128 · track flies >= 2.2 u over anything it crosses. Land
  the last authored piece **~0.3 u short of the start, on the station axis**, or the closure
  invents the difference and spends it against that 40 %.

  **⛔ CLOSURE IS THE ONE THAT ACTUALLY KILLS AUTHORED CIRCUITS.** A measured park lost all 8
  thrill points to a single line — *"the synthesized closure is 24.6 u — 46 % of the 53.5 u
  authored (limit 40 %)"*. The ride was legal on every other count. It simply never came back.

  It is arithmetic, not taste. `compileTrackPieces` walks a cursor: `turnL`/`turnR` do
  `yaw += ±angle` and **every other piece preserves heading** (a 360° `helix` returns to its own
  entry point and heading; `loop`, `corkscrew` and `sbend` change nothing about where you end up
  facing). So:

  > **Your signed turn angles must sum to ±360°, and your straights must close as a polygon.**

  The easy way to satisfy both at once is a **rounded regular N-gon** — N equal turns of 360/N
  in the SAME direction, with equal straights between them. **MEASURED: these close with ZERO
  synthesized track** (`closure.synthesized` came back `[]`), and none of them is a rectangle:

  | shape | turns | straights | measured |
  |---|---|---|---|
  | pentagon | 5 × `turnR 72°` r 2.5 | 8.0 | closes, `synthesized []` |
  | hexagon | 6 × `turnR 60°` r 2.5 | 7.0 | closes, `synthesized []` |
  | octagon | 8 × `turnL 45°` r 2.5 | 5.0 | closes, `synthesized []` |
  | rectangle (the tired one) | 4 × `turnR 90°` r 2.5 | 8.0 | closes, `synthesized []` |
  | **the same hexagon, ONE side doubled** | 6 × `turnR 60°` | 14, 7, 7, 7, 7, 7 | **FATAL** — invents `turnL 180° + straight 10.80 + turnL 180°` |

  **The station is a SIDE, not a prologue.** It is 2.6 u long, so side 0 is
  `'station'` followed by `straight (side − 2.6)`. Give it a full side of its own and the
  polygon has N turns and N sides, which is the only way it closes.

  Stretching is legal as long as it stays balanced: with an even N, opposite sides must be
  equal (a, b, c, a, b, c on a hexagon). That is where an interesting silhouette comes from.

  **⛔ AND THE TRAP THAT CATCHES EVERYONE: drama pieces cost no HEADING but they DO eat
  FORWARD DISTANCE.** A `lift`, `drop`, `hill`, `loop` or `corkscrew` leaves you facing exactly
  where you were — but further along. So dropping one into a balanced hexagon makes that ONE
  side longer than its opposite and the polygon stops closing. MEASURED: a clean hexagon
  synthesized nothing at all, and the same hexagon with `lift 5 → drop 5 → loop` added to one
  side synthesized `turnL 162° + straight 13.55 + …` and went FATAL.

  > **Add drama to a side, then SHORTEN that side's `straight` by what you added.**

  **MEASURED forward cost, in units** — these are not estimates, they were compiled and diffed:

  | piece | forward cost | note |
  |---|---|---|
  | `straight L` | `L` | |
  | `loop` / `loopL` / `loopR` r | **1.6 × r** (r 1.4 → 2.27, r 1.8 → 2.90, r 2.2 → 3.52) | cheap in distance |
  | `corkscrewL` / `corkscrewR` | **2.40** | |
  | `sbend length L` | ≈ `L` (4 → 4.09) | |
  | `hill h` | **3.98 @ 0.4 · 5.63 @ 0.8 · 6.90 @ 1.2 · 8.91 @ 2.0** | |
  | `lift h` / `drop h` | **≈ 8.4 + 2.6 h** (h 1 → 10.96, h 3 → 17.43, h 5 → 22.59) | **the expensive one** |
  | `helix 360°` | **0 at height 0 — but 5.48 @ h 1, 7.86 @ h 2, 10.0 @ h 4** | see below |

  **⛔ A LIFT IS ENORMOUS.** Even a 1-unit lift eats **11 u** of forward travel, and a 5-unit
  lift eats **22.6**. That is more than a whole side of a normal hexagon. Budget the lift FIRST
  and lay the polygon out around it — do not design a pretty shape and then try to fit a lift in.

  **⛔ AND A CLIMBING HELIX DOES NOT COME BACK.** A **flat** 360° helix returns to its own entry
  point (cost 0) — that is the documented behaviour and it is true. Give it a `height` and it
  does not: h 2 displaces **7.86 u**. (`angle` above 360° measured identical to 360°, so a
  720° helix buys you nothing.)

  **A LOOP IS DELIBERATELY HELICAL, AND THAT COSTS INVERSION — PICK `radius` ACCORDINGLY.**
  The lateral step is not decoration: a perfectly planar vertical loop would have its two legs
  occupy the same ground and could never pass the 0.9 clearance gate, so the element steps
  sideways and is slightly helical. The price is that the crest never goes fully upside down.
  MEASURED (`harness/mp3d-render/shot-loop.mjs`, continuous 40 000-sample sweep of the track
  frame; 180° would be fully inverted):

  | `radius` | `offset` 1.0 | `offset` 1.2 (default) | `offset` 2.0 |
  |---|---|---|---|
  | 1.2 | — | 145° | — |
  | 1.8 | 160° | 157° | 142° |
  | 2.0 | 162° | 158° | 145° |
  | 2.6 | **166°** | 163° | 152° |

  So: **a bigger loop inverts better, and raising `offset` above the default makes it worse
  fast.** If the loop is the ride, use `radius` 2.0–2.6 and leave `offset` alone. A `radius` 1.2
  loop only reaches 145° and reads more like a steep hump than an inversion.

  **⛔ AND `loop` AND `sbend` STEP SIDEWAYS.** A `loop` carries an `offset` (default 1.2) and an
  `sbend` is a lateral shift by definition, so both leave you on a **parallel line**, not the
  one you were on. That breaks a polygon just as surely as a length error. MEASURED: one
  `loopR` alone left the closure split `turnL 174° / 186°`; **`loopR` and `loopL` on opposite
  sides cancel exactly** and restore a clean `180° / 180°`. Pair your inversions.

  **A caution, measured and not yet solved:** combining a real lift-and-drop with inversions on
  a wide-turn polygon drove `maxLatG` to **1.82** against the 1.275 guard — the train exits the
  drop and enters the next turn at full speed. If you go this way, put a speed-bleeding `hill`
  between the drop and the next turn, and CHECK. A rectangle with a verified loop beats a
  hexagon that renders red.

  Then prove it at module scope rather than hoping. **The thing to read is
  `report.closure.synthesized` — the list of pieces the compiler had to INVENT.**
  (`closure.gap` is not it: it sits at 1.2 on a perfect circuit, because that is the brake tail.)

  ```tsx
  const { report } = compileTrackPieces(MINE, { profile: 'coaster', type: 'steel' });
  console.log('[closure]', report.closure.synthesized, 'fatal:', report.fatalReason ?? 'none');
  ```

  MEASURED, so you know what good looks like:

  | what you see | verdict |
  |---|---|
  | `["straight 0.20", "straight 1.2 (brake tail)"]` | **balanced.** This is the target — two trivial pieces |
  | `["turnL 180°", "straight 10.80", "turnL 180°", …]` | an invented U-turn: a side is out of balance. Rebalance, do not ship |

  Note the call signature — **`compileTrackPieces(pieces, opts)` takes the pieces FIRST and
  needs no `THREE` argument.** (`checkCoasterDesign` is the one that takes `THREE` first.)


- **EVERY SPLINE RIDE *ACCEPTS* `pieces` — CUSTOMISING IS AN UPGRADE, NOT A TOLL.**
  Omitting `pieces` ships the rig's stock layout, byte-identical in every park that ever
  mounted it — which is why the flume, the karts and the bobsleigh look the same everywhere.
  So author one where you can: it is the cheapest way to make a land feel bespoke.

  **⛔ BUT NEVER SKIP A RIDE BECAUSE YOU DID NOT WANT TO AUTHOR ITS TRACK.** That trade is the
  worst outcome available and a park has already made it — it dodged every themed ride that
  runs on rails and left two worlds with **zero**. Stock track in the right world beats an
  empty world every time. Order of preference, best to worst:

  1. themed ride, custom `pieces` — the land feels made for it
  2. themed ride on its `DEFAULT_PIECES` — **completely fine, and always better than 3**
  3. a stock `<Carousel>` standing in for it, or nothing at all — this is the failure

  `<Monorail>` is the one rig where 2 is mandatory: copy the published ring.

| rig | `profile` | author what | constraint that bites |
  |---|---|---|---|
  | `<Coaster>` / `<TrackRide>` | `coaster` | the full vocabulary | inversions need `type="steel"` |
  | `<LogFlume>` | `flume` | lifts + drops ARE legal | drops pace ~4× the climb; start `[0, 0.6, 0]` |
  | `<Bobsleigh>` | `bobsled` | tall lifts, stepped drops | bank 0.55, 1.5 g derail live; with no steep pieces, height is bought with LENGTH |
  | `<GoKarts>` | `gokart` | `station`/`straight`/`turnL`/`turnR`/`sbend` | **flat only** — `lift`/`drop`/`hill` are STRIPPED with a warn, and a helix loses its `height` |
  | `<RiverRapids>` | `rapids` | short reaches + shallow bends | RCT2 whitelists quarter-turns and 25° slopes only — no s-bends, no helix |
  | `<Chairlift>`, `<MagneticRide>` | `monorail` | horizontal only | everything else stripped with a warn |
  | the themed circuits — `MagmaRun`, `DeepDrift`, `WyrmsHollow`, `GearworksExpress`, `Bassline`, `LavaTubeRun`, `ReefRacer`, `OceanTunnelSlide`, `MoonlitBarge`, `EmberWings` | per rig | `pieces` REPLACES its `DEFAULT_PIECES` | each ships a default that is otherwise the same in every park |
  | **`<Monorail>`** | `monorail` | **nothing — copy the published ring** | a hand-authored list synthesized **52 %** of its arc and shipped an unboardable ride |

  Layout rules worth honouring: `<OceanTunnelSlide>` wants its station at the HIGH end with a
  `drop` right after; `<DeepDrift>` stays level with one straight >= 4.6 u for the lock house;
  `<EmberWings>` is `type: 'inverted'` and wants >= ~1.6 u of terrain clearance;
  `<MineTrainCoaster>` must **end FACING the station**.

  Verify anything you author the same way as a coaster — `report.fatal`, synthesized < 40 % —
  and land the last piece ~0.3 u short of the start. If it will not close, drop the `pieces`
  prop: a stock ride that registers beats a custom one that renders red.


- **BUILD ALL FIVE `<World>`s — AND EACH ONE IS A REAL PLACE, NOT A LABELLED RECTANGLE.**
  `fire` · `pirateBeach` · `steampunk` · `enchantedForest` · `neon`, every one of them, in
  every park. (Plus the `default` Original dress for the hub and entrance plaza, which is a
  theme but NOT a world.) A world is built only when a **REGISTERED position falls inside its
  rect** (0.04 u of drift reads as `worldNotBuiltOut`). Closest pair of world centres >=
  `20·√(size/48)` = **32.66 u at 128**, and the rects need a dry gap > 0 — touching rects are
  one district.

  **FIVE WORLDS FIT AT 128 — HERE IS A VERIFIED FAN.** Every pair below clears the 32.66 u
  floor (closest pair 50.00 u), so start from this and adjust rather than solving it cold:

  | world | centre | nearest neighbour |
  |---|---|---|
  | north  | `[0, 38]`    | 51.22 u |
  | west   | `[-40, 6]`   | 50.00 u |
  | east   | `[40, 6]`    | 50.00 u |
  | south-west | `[-26, -42]` | 50.00 u |
  | south-east | `[26, -42]`  | 50.00 u |

  Keep each rect around `hx/hz ≈ 9–11` so the five never touch, run the gate street north into
  the hub, and spur off it to each land.

  **⛔ THE FLOOR FOR EVERY THEMED WORLD — ALL FOUR, NOT A CHOICE OF ONE:**

| | requirement | why it is not optional |
  |---|---|---|
  | **ALL 3 rides OF THAT THEME** (15 across the five worlds) | every ride on the world's own row below, each with its own authored `register.name` | `rideCount` is a **Set of names** — two rides sharing a name count as ONE |
  | **its own themed stall** | `bazaarPlan({ stalls: ['<its counter>', …], theme })` | stock only YOUR theme's counter; a foreign one is a `crossTheme` deduction |
  | **>= 25 themed scenery PIECES** | from that world's own pack, INSIDE the rect | see the repetition note below |
  | **its own path spur** | a street reaching the land | a district nobody can walk to is not a place |
  | **its own GROUND** | `<WorldGround plan={W} />`, mounted after `<Paths>` and before its props | `theme.pathSurface` re-skins only the STREETS — without this the caldera and the glade are the same green field |
  | **its own GIANT** | `<WorldLandmark plan={W} />` | one `<Volcano>`-class mass per land — it is what names the place from across the park |

  A foreign themed piece inside the rect is a §0-FATAL `worldThemeMixed`.

  **⛔ LAY THE FLOOR — `<WorldGround plan={W} />`.** This is the fastest single change that
  makes five worlds read as five places, and **the last full park mounted it ZERO times** on
  five declared worlds. Each theme carries a `ground` dress (basalt + ash · wet tide sand ·
  soot yard · deep moss · black glass · park lawn) and `<WorldGround>` tiles it across the
  world's rect, settled on the terrain and sunk 0.025 u so paths, plaza tiles and ride pads
  always sit proud of it. It registers no footprint and blocks nothing:

  ```tsx
  import { WorldGround } from './components/WorldGround';   // ← its OWN folder now
  ```

  ```tsx
  <Paths … />
  <WorldGround plan={COVE} />     {/* the floor goes down FIRST */}
  <WorldLandmark plan={COVE} />   {/* then the land's GIANT */}
  <World plan={COVE} />
  <Bazaar plan={COVE_ROW} />      {/* …then everything that stands on it */}
  ```

  **⛔ AND GIVE EVERY WORLD ITS GIANT — `<WorldLandmark plan={W} />`.** `fire` always had
  `<Volcano>`: radius 2.75 (5.5 tiles across), height 2.55, a cone visible from the gate. No
  other world had anything like it — their biggest pieces are PROPS (`<WreckedHull>` 1.8 ×
  0.78, `<GiantGear>` r 0.64, `<GiantToadstools>` r 0.94, and neon's pylons are tall but
  THIN). So the caldera read as a place and the rest read as a lawn with ornaments.

  Each theme now has a `<Volcano>`-class anchor, picked automatically off the world's theme:

  | world | its giant | reads as |
  |---|---|---|
  | `fire` | `<Volcano>` | the cone, crater and lava flows |
  | `pirateBeach` | **Beached Galleon** | a whole hull heeled over in the sand, broken mast, snapped topmast |
  | `steampunk` | **Blast Furnace** | riveted stack on a brick base, catwalk, tap spout, live smoke plume |
  | `enchantedForest` | **Dragon Roost** | a claw-raked crag under a great stick nest, a clutch of five eggs that pulse after dark (one cracked open), a shed scale in the moss below |
  | `neon` | **Mirrorball Tower** | a truss tower under a giant rotating faceted ball |

  It defaults to the world's centre; pass `position` to move it off a ride pad, and `scale` to
  size it to the land. **Put its cell in `worldPlan({ include })`** or it dresses nothing.
  Mount it AFTER `<WorldGround>` and BEFORE the props.



  **The old floor (1 ride / 1 stall / 1 prop) passed for parks with NO themed content.** One
  declared three themed worlds and shipped zero themed rides and zero themed scenery — its own
  header said "all scatter is NEUTRAL". Dressing a stock `<Carousel>` with giant toadstools is
  not an enchanted forest; `<WyrmsHollow>` is.

  **TWENTY-FIVE PIECES MEANS TWENTY-FIVE PLACED OBJECTS, NOT TWENTY-FIVE KINDS.** Each pack ships 5–7 kinds, so repeat
  them with different `seed` AND `rotation` — `sceneryCount` counts instances, and varied
  rotation is what stops a scatter reading as a grid:

```tsx
  {/* fire: 25 objects from 7 kinds — every one a different seed AND rotation */}
  <Volcano       position={F[0]} rotation={0.0}  seed={2}  />
  <LavaFissure   position={F[1]} rotation={2.0}  seed={4}  />
  <Fumarole      position={F[2]} rotation={0.9}  seed={3}  />
  <ObsidianShards position={F[3]} rotation={0.4} seed={5}  />
  <ObsidianShards position={F[4]} rotation={-1.2} seed={11} />
  <BasaltColumns position={F[5]} rotation={0.7}  seed={7}  />
  <BasaltColumns position={F[6]} rotation={-0.5} seed={17} />
  <CharredSnag   position={F[7]} rotation={1.3}  seed={9}  />
  <CharredSnag   position={F[8]} rotation={-0.8} seed={23} />
  <CharredSnag   position={F[9]} rotation={0.2}  seed={31} />
  ```

  Every cell goes in that world's `worldPlan({ include })` or it is outside the rect and counts
  for nothing. `ThornwickScenery`/`PulseScenery` also export `THORNWICK_PIECES`/`PULSE_PIECES`
  dispatchers for list-driven placement.

  **⛔ INSTALLING A COMPONENT IS NOT MOUNTING IT. THE AUDIT COUNTS *REGISTERED* RIDES.**
  MEASURED on the first five-world park: it installed `MagmaRun`, `EmberWings`, `DeepDrift`,
  `ReefRacer`, `GearworksExpress`, `WyrmsHollow`, `Chairlift` and `MineTrainCoaster` — every
  themed ride it needed — and then mounted a stock `<Carousel>`, `<DropTower>`, `<PirateShip>`
  and `<Teacups>` instead. Three of its five worlds reported **0 themed rides** while their
  components sat installed and unused.

  `install_code_component` only puts the file in your project. A ride counts when it is
  **mounted in the tree with `register`**, its pad **inside the world's rect**, and its cell in
  `worldPlan({ include })`. Check your own JSX: for each world, can you point at three
  `<ThemedRide … register={{…}} />` tags from that world's row below? If not, it does not have
  three rides, however many you installed.

  **⛔ AND MOUNTING A THEMED *CIRCUIT* IS CHEAP — `pieces` IS OPTIONAL.** The next park skipped
  every themed ride that runs on track and mounted only the flat ones (`BoilerBurst`,
  `AetherBalloons`, `Chairlift`, `Discotron`), so `fire` and `pirateBeach` — whose three rides
  are ALL tracked — finished with **zero**. That trade is not real. Every themed circuit ships
  a working `DEFAULT_PIECES`, and `pieces` is declared optional on all of them:

  ```tsx
  <MagmaRun position={[-38, 4]} rotation={Math.PI / 2}
            register={{ name: 'Cinder Run', kind: 'coaster' }} />
  ```

  That is a complete, boardable, rated ride — no `pieces`, no circuit design, no verifier.
  Authoring a custom `pieces` array is an UPGRADE you make when you want the land to feel
  bespoke (§ the spline table above), never a toll you pay to mount the component. Mount all
  three of a world's rides on defaults FIRST; customise afterwards if budget remains.

  **THE PER-WORLD INVENTORY — take ALL 3 rides, its stall, 25 scenery placements, its floor and its giant:**

  | world (canonical / legacy) | its GROUND | its stall | its RIDES — MOUNT ALL THREE | its SCENERY (repeat to 25) |
  |---|---|---|---|---|
  | `fire` / `emberfall` | cooled basalt + ash | `'emberRoast'` | **`EmberWings` + `MagmaRun` (the lava flume) — BOTH, and that is the whole quota.** `LavaTubeRun` is OPTIONAL | `Volcano`, `Fumarole`, `ObsidianShards`, `BasaltColumns`, `LavaFissure`, `CharredSnag`, `EmberWingsHanger` |
  | `pirateBeach` / `tidewater` | wet tide sand | `'sushi'` | `ReefRacer`, `DeepDrift`, `OceanTunnelSlide` | `WreckedHull`, `CoralCluster`, `AnchorPile`, `TidePool`, `DockPilings` |
  | `steampunk` / `brasswork` | soot-stained yard | `'goggles'` | `GearworksExpress`, `AetherBalloons`, `BoilerBurst` | `GiantGear`, `SteamPipes`, `ClockTower`, `BoilerTank`, `CoalCart` |
  | `enchantedForest` / `thornwick` | deep moss | `'honeywitch'` | **`WyrmsHollow` — REQUIRED**, `MoonlitBarge`, `Chairlift` | `GiantToadstools`, `StandingStones`, `LanternTree`, `RuinedArch`, `FlowerPodBed`, **`MagicMirror` — REQUIRED, exactly one** |
  | `neon` / `pulse` | black glass | `'neonSlush'` | `Bassline`, `Discotron`, `MagneticRide` | `NeonArch`, `SpeakerStack`, `MirrorBallPylon`, `LaserTruss`, `LightTiles`, **`BigPiano` — REQUIRED, exactly one** |

  Stock the stall FIRST in that world's `bazaarPlan({ stalls })`, neutrals after
  (`burger`/`hotDog`/`soda`/`cottonCandy`/`balloon` are legal anywhere). **Stock only YOUR
  theme's counter** — a foreign one is a `crossTheme` deduction, and `bazaarPlan` lints it at
  plan time as `bazaarForeignStall`.

  **⛔ `fire` IS THE EXCEPTION — TAKE `EmberWings` AND THE LAVA FLUME `MagmaRun`, AND STOP.**
  `LavaTubeRun` is the lava tunnel COASTER and it is now OPTIONAL: three tracked rides in one
  caldera is one too many, and two of the three were coasters. Two mounted beats three planned.

  **⛔ `<WyrmsHollow>` IS REQUIRED IN THE GLADE.** The glade is not the glade without the wyrm,
  and it is the ride that keeps getting dropped whenever a park mounts two of `enchantedForest`'s
  three. Mount it every time.

  **⛔ AND TWO PIECES ARE REQUIRED BY NAME, NOT BY COUNT — `<MagicMirror>` in the glade and
  `<BigPiano>` in the neon street.** Both are the signature curiosity of their land and both
  have been getting skipped: one measured park placed NEITHER, and the next placed **four of
  each**, which is just as wrong — a magic mirror is a thing you come across once, not a hedge.
  **Place exactly one.** They are SCENERY, not rides (they register no ride handle), so they
  count toward the 25 placements and never toward the ride quota.

  **EVERY OTHER THEME OWNS EXACTLY 3 RIDES — MOUNT ALL OF THEM.** `enchantedForest` and `neon`
  used to own only 2, so `Chairlift` (a canopy ride over the glade) and `MagneticRide` (a
  maglev down the nightclub street) were claimed for them on 2026-07-28. **`MagicMirror` and
  `BigPiano` are NOT the third ride** — both are `composable()` SCENERY: their `register` prop
  wires a guest WATCH ZONE, never `registerRide`, so the audit cannot count them however you
  label them. They are listed in the scenery column, where they belong.


- **>= 8 rides**, all distinct kinds, across **5 categories** (gentle · thrill · water ·
  transport · dark). Write the five category names into the header **before any JSX** —
  coverage is decided at planning time and cannot be repaired at the end.

### 0-P.5 THE PASTE-ABLE ASSERTION SET — route every check through ONE `parkAssert`

**Every check REPORTS. No check throws.** `<Park>` renders an invalid park anyway,
`validatePark` reports the defect anyway, and the round is scored on it anyway — so the job of
an assertion is to put the number where you can read it, not to decide whether the park is
allowed to exist. Collect every failure, print ONE numbered block, **ship the park**. Paste
this above every other assertion; call the flush as the LAST line of the module-scope block,
before the mount:

```ts
type Sev = 'blocking' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
/** Records a defect. NOTHING here is fatal — the default severity is 'advisory' on
 *  purpose, so a forgotten third argument can never delete the park. */
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'advisory'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
/** LAST line of the assertion block, before the mount. NEVER THROWS. */
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  const blocking = PARK_FAILS.filter((f) => f.sev === 'blocking');
  console.error(`[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${blocking.length} blocking):\n` +
    PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'));
  if (blocking.length)
    console.error(`[park] ${blocking.length} BLOCKING failure(s) — DROP the offending piece and ` +
      `ship the rest. The park still renders and still scores; aborting it would score 0 on all 16 axes.`);
}
```

**`'blocking'` MEANS "DO NOT MOUNT THIS ONE PIECE" — NOT "DO NOT MOUNT THE PARK."** When a
blocking check fires, gate the JSX for that piece and carry on:

```tsx
const RING_OK = parkAssert('ringPose', bestBump <= PEAK_LIMIT, '…', 'blocking');
{RING_OK ? <Monorail … /> : <GoKarts … />}   {/* transport comes from elsewhere */}
```

**BLOCKING** (drop the piece, keep the park): a coaster whose `report.fatal` is set · a ride
whose pad cannot be made flat and dry · a monorail with no legal ring pose · a set-piece whose
port is unwired. **ADVISORY** (printed, nothing dropped): cardinal edges · the `offRow` guard
pre-filter (a BOX, with known corner false positives) · `assertPadFlat`'s flatter-cell
fallback · the relief diff · the tail→pad reach floor · the themed-content floors · self-score
floors.

**THE SEVERITY IS A SCORING DECISION, NOT A STYLE ONE — ASK "DOES THE RUNTIME REPAIR THIS?"**
If it does, it is ADVISORY: report the number and mount the piece anyway. `cardinalEdge` was
structural by default back when the flush still threw, and that cost wave 18B **the entire
park**: `buildParkNet` elbows a diagonal edge into two cardinal legs, so the park renders and
the honest charge is a couple of lint points — but the throw blanked the page, so there was no
`validatePark` verdict, nothing was measured, and all 16 axes scored 0. That is the incident
the flush was rewritten never to be able to repeat. Reserve `'blocking'` for the narrow case
where mounting the piece would itself be worse than omitting it — a `report.fatal` coaster
(translucent red, unregistered), a pad that cannot be made flat and dry, a monorail with no
legal pose.

**EVERY AUTHORED CELL THAT MOUNTS GEOMETRY GOES THROUGH `offPathCell`, AND A PAD ALSO
GOES THROUGH `assertPadFlat`.** `offPathCell` is street-aware and **terrain-blind**, so
it is not the last call — a pad it returned can still sit on a hill flank or in a lake.
The `clear` margin is **`padMarginOf(rig)`, a MESH property of the rig — capacity never
enters it**, so two capacity-6 rides can want 1.8 and 4.77. A park that used 1.8 on all
seven pads took **9 `padOnStreet` + 6 `footprints` FAILs**; one that used the superseded
constant 3.2 on a `<GhostTrain>` landed 4.42 against 4.77 and earned a `padNearStreet`.

```ts
// THE WHOLE CATALOG, DERIVED THE WAY THE VALIDATOR DOES IT — never from capacity:
//   margin = max(1.8, bodyHalf + pathWidth/2 + 0.05)   pathWidth/2 = 0.55
// where bodyHalf = max(hx, hz) of the MOUNTED group's Box3 × `scale`, less the 0.08 the
// wrapper shaves (`Park/configurableRide.tsx:1276-1283`, `:444`). Measured on every
// composableRide rig with its DEFAULT pieces. Six of these reproduce a real lint text
// exactly (GhostTrain 4.77, LogFlume 5.36, PaddleBoats, Discotron, FerrisWheel,
// AetherBalloons), which is the check on the method.
const PAD_MARGIN: Record<string, number> = {
  LavaTubeRun: 23.41, ReefRacer: 22.20, OceanTunnelSlide: 22.14, EmberWings: 16.15,
  WyrmsHollow: 15.99, MagmaRun: 14.22, MineTrainCoaster: 13.99, DeepDrift: 12.65,
  Bassline: 11.59, GearworksExpress: 10.03, MoonlitBarge: 8.23, SplineCoaster: 7.32,
  RiverRapids: 6.60, Bobsleigh: 6.01, MagneticRide: 5.56, LogFlume: 5.36,
  GhostTrain: 4.77, HauntedMansion: 4.77, GoKarts: 4.39, Monorail: 4.02,
  Chairlift: 3.52, Helicycles: 3.42, FlyingSaucers: 3.37, MotionSimulator: 3.20,
  Enterprise: 3.13, PaddleBoats: 3.12, Discotron: 3.07, BoilerBurst: 3.05,
  FerrisWheel: 2.97, AetherBalloons: 2.95, PirateShip: 2.70, TwistRide: 2.65,
  TopSpin: 2.52, Teacups: 2.47, Carousel: 2.40, SwingingInverterShip: 2.35,
  LaunchedFreefall: 2.25, BumperCars: 2.07, SpaceRings: 1.92, SwingRide: 1.92,
  DropTower: 1.80, ObservationTower: 1.80,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;   // off-table rig: take the
// default, probe ONCE, and read the exact margin AND the legal cell out of the lint.
// TWO CAVEATS, both measured. (1) A TRACKED rig re-spans when you hand it your own
// `pieces` — the number above is its default circuit, so probe a custom one. (2) Above a
// 10-u body span the `padOnStreet` lint only audits the 0.45-u boarding pad, so its
// demand COLLAPSES to 1.8 — but the `footprints` + `corridor` sweeps still audit the whole
// body, so USE THE TABLE'S NUMBER anyway. A pad chosen at 1.8 for a `<DeepDrift>` clears
// the lint and then loses the footprint sweep.
// Other margins, for cells that are not ride pads:
//   1.8  — a BUILDING (restroom / hut / hand-placed stall / kiosk)
//   1.2  — any <Scenery>/<Placed> prop (pathWidth/2 + ground radius)
//   0.75 — the TREE SCATTER, that too: a park that handed its raw tree array straight
//          through landed five trees 0.00 u from a street edge, five `scenery` FAILs, and
//          floored that axis to 0/5.
```

**AND THAT TABLE DOUBLES AS THE RARE-RIDE SHELF — §0-P.1's `RARE PICKS` row.** Novelty CAPS at
0.5/1 unless the roster registers a kind the corpus has never built (`rideRoster.firstUseKinds`),
and a never-used CIRCUIT is worth another 0.25. **That shelf is DERIVED AT SCORING TIME from
`signatures/` (`node harness/park-eval/usage.mjs`) and CANNOT be pasted into a rules file** — a
frozen usage list has rotted twice, once calling a whole category unbuilt while `GhostTrain`
stood in 12 parks. **So never write "never-used" in the header: you cannot read the corpus from
in here**, and one park invented the claim for two rides already in it. What you CAN verify, by
ctrl-F: a kind that appears exactly ONCE in this file — only in `PAD_MARGIN` above — has no
worked example in the only rules file anyone gets, so nothing has copied it. **Take two, from the
TOP of the table.** The corpus skips the 7 u+ rigs because they are big and awkward to place,
which is exactly why they are unbuilt: as of a **30-park corpus, 2026-07-27** (a dated snapshot
of a moving target) 13 of the 44 registerable kinds had never shipped and **9 of the 13 sit above
7 u**. Give each the margin the table demands and the awkwardness is solved, not risked.

```ts

const PEAK_LIMIT = 0.75;                     // ParkBuilder/validate.ts, verbatim
// bumpAt / assertPadFlat / place READ COMP and NET, declared LOWER DOWN. That is legal and
// deliberate: `function` declarations are HOISTED and they are only ever CALLED after both
// exist. A `const` arrow for THOSE would be a TDZ.
// ⚠ `isDry` HERE IS A BASIN PRE-FILTER AND NOT A DRYNESS PROOF. There is NO heightfield at
// module scope — `parkComposition` returns `basins`/`peaks`, never a `heightAt` — so all it
// can ask is "is this cell outside every composed bowl", and a bowl's waterline sits at
// 0.74·radius (`Park/parkContext.ts:676`). PROVE dryness in the TREE: §0-P.6's `dryRing`.
const isDry = (c: XZ) => [...COMP.basins, ...COMP.clampBasins]
  .every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);
const bumpAt = (c: XZ) =>
  Math.max(0, ...COMP.peaks.map((p) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));
function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpAt(pad) <= PEAK_LIMIT && isDry(pad)) return pad;   // BOTH, not just the bump
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;    // ring, not disc
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpAt(c) > PEAK_LIMIT || !isDry(c)) continue;
        const off = offPathCell(NET, c, { clear });
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: pad [${pad}] on a hill flank (bump ${bumpAt(pad).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, and no cell ` +
      `within 4.8 u is flat, dry AND ${clear} u off the street. MOVE THE TAIL — this rig is on a range or in a lake.`);
  return pad;
}
// `laneLenOf` is IMPORTED from './components/ParkBuilder' — do not re-implement it, and
// note it is NOT on the './components/Park' barrel.
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

// THE TAIL IS THE AUTHORED NODE AND THE PAD IS DERIVED FROM IT — never the reverse.
// `front` IS NOT YOURS TO INVENT: it is `layout.front`, frozen into the component at
// composableRide() time (default 1.8; <Discotron> 4.0, <BumperCars> 2.6) and unreadable
// while authoring. Declare `place` AFTER the single buildParkNet fuse — it reads NET.
function place(tail: XZ, out: XZ, capacity: number, rig: string) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  // TWO lattice cells past the floor, NOT one: a composableRide's boardPoint sits NEARER the
  // tail than `position` does (1.40 u on a <Discotron>), and one cell left a cap-12 rig
  // 9.54 u out against the 9.74 u floor — a `footprints` FAIL on arithmetic that looked right.
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;   // streets…
  const pad = assertPadFlat(onStreet, clear, rig);   // …THEN terrain
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    parkAssert('padReach', false,
      `pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
        `${(minReachOf(capacity) + 1.2).toFixed(2)} u (board-pad floor ${minReachOf(capacity).toFixed(2)} = lane ` +
        `${laneLenOf(capacity).toFixed(2)} + 0.35 join + 0.62 hut set-back + 0.50 hut half + 0.45 pad half, plus one ` +
        `cell for the rig's own board offset). offPathCell pulled the candidate INWARD, so the court is too tight: ` +
        `move the TAIL outward, open the court, or pick a lower-capacity rig. Do NOT lower the clearance.`,
    );
  return { pad, anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
           dir: [-out[0], -out[1]] as XZ };
}
```

`offPathCell` searches `rings 8 × step 0.6` = 4.8 u. **`null`, or a cell under the reach
floor, means RE-PLAN THE STREETS** — never relax the number. It also does not know about your
other pads, stalls or scenery: check its answer against your committed footprints (pitch
>= 6 u).

**A SET-PIECE'S `position` IS ITS SOLID CENTRE — NEVER A STREET NODE AND NEVER A QUEUE
TAIL** (§0-P.4, the ~11-point coordinate). Here is the assertion — and **run it again over the
PADS** once they come out of the fuse:

```ts
const SOLID_CLEAR: Record<string, number> = {
  FountainPlaza: 1.8,   // pathWidth/2 0.55 + a pad half 1.2 + 0.05, off the paved pad
  Bazaar: 0.6,          // footprint hz is 1.8, so 1.8 + 0.6 = 2.4 u off the AISLE
  Boulevard: 0,         // its carriageway IS a street; a node may stand on it
};
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[]): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;   // { cx, cz, hx, hz, yaw }
    const c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
    nodes.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;      // a PORT is legal
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;       // into the piece's own frame
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);     // < 0 ⇒ INSIDE
      // EPS, AND IT IS NOT OPTIONAL — same lesson as the port compare below.
      // MEASURED (wave 25B, 2026-07-27): a node 2.4 u from a Bazaar centre with
      // hz 1.8 computes gap 0.5999999999999985 against clear 0.6 — a shortfall
      // of 1.4e-15, pure float noise. `gap < clear` called it a violation,
      // `nodeInSolid` is STRUCTURAL, and the throw blanked the whole park: 0
      // rides, no Stage, no validatePark verdict, all 16 axes lost.
      if (gap < clear - 1e-9)
        hits.push(`[${n[0]}, ${n[1]}] (cell ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', !hits.length,
    `${hits.length} authored cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` + hits.join('\n  '));
}
```

**RESOLVE THE `NetRef` PORT STRINGS — DO NOT SKIP THEM**, and compare with a
**TOLERANCE, never `!==`**: port cells are computed as `tiles·0.6 + 0.6`, and
`7*0.6 + 0.6` is `4.799999999999999` in binary, so a strict compare against an authored
`4.8` reports a FALSE diagonal on a legal park. A diagonal `EDGES`
pair is auto-elbowed by `buildParkNet` through a synthesised corner node you did not
plan, which a pad can then land on and a corridor sweep can cross — so the assertion is
ADVISORY (it must not blank the page over something the runtime repaired), and a false
positive therefore costs you a real defect hidden in the noise rather than a dead round.

```ts
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name);
};
const EPS = 1e-6;   // four orders of magnitude under the 1.2 lattice: it cannot hide a real one
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}]. buildParkNet ELBOWS it through a synthesised ` +
      `corner node at [${A[0]}, ${B[1]}] that you did not plan — a pad can land on it and a corridor ` +
      `sweep can cross it. FIX THE TABLE: move one endpoint so the pair shares an x or a z.`,
    'advisory');   // ADVISORY ON PURPOSE — buildParkNet REPAIRS this, so the park still renders
});

// PRESENCE for every piece, and BOTH ENDS for a CHAIN piece. A port with
// `prunable: false` is a structural carriageway END (buildParkNet drops an unwired STUB
// but never SHORTENS an avenue), so leaving one unwired paves a slab that dead-ends in
// grass. <Boulevard>'s 'A' and 'B' are both prunable:false. READ THE FLAG OFF THE PIECE —
// never maintain a list of kinds. And NAME the world bazaars in ALL_PLANS rather than
// writing `...WORLDS.flatMap(w => w.pieces)`: WORLDS reads the pads, the pads read NET,
// so WORLDS does not exist yet. buildParkNet keys their ports `<planId>:<PORT>` exactly
// like an explicit piece's, whether they arrived via `pieces:` or `worlds:`.
const CHAIN_END_OPT_OUT = new Set<string>([/* 'gateAve:B' — ONLY when something real
  stands on that terminus, e.g. a bare <Gate> on it */]);
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
    parkAssert('chainEnd', false,
      `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end of the ` +
        `carriageway dead-ends in grass (deadStreetNode). Wire it, and READ THE ENDPOINT OFF THE PIECE: ` +
        `boulevardPlan({ from: HUB.port('W'), to: MARKET.port('E') }) — never retype the cell.`);
  });
});
```

### 0-P.6 `keepDryOf(NET, SEED_ROW)` — never a blanket `NODES.slice()` guard

**`KEEP_DRY = NODES.slice()` has shipped in FOUR consecutive rounds and it costs ~−7.** `keepDry`
does not *avoid* water — it **LIFTS the ground** and pushes that body out, so a blanket guard list
moves the lakes off the row your layout was planned against **and hides every wet cell you own** (a
guarded wet node reads dry, so the check meant to catch it passes) — two §0-FATAL `waterRePicked`
and **−3.5**, measured below.

**And sieving `NODES` is not enough: `buildParkNet` MERGES EVERY SET-PIECE AND WORLD CELL INTO
`NET.keepDry`** — plaza pad cells, bazaar aisle and verge cells, port stubs. Measured on a verified
skeleton, **30 authored cells fuse to 638 paved cells and 650 guard cells.** So sieve **the fuse's
OUTPUT**, and hand `<Terrain keepDry>` the sieved list, never `NET.keepDry` raw.

```ts
export type SeedBasin = { ctr: XZ; box: [number, number, number, number] };  // [x0,x1,z0,z1]
export type SeedRow = { dom: SeedBasin; sec: SeedBasin };
// PRE-guard, generated at size 128. Copy the ONE pair you pinned. The three rows that are
// RING-CLEAN WITH DRY DECKS are `1/temperate`, `31/temperate` and `91/desert`; prefer
// `31/temperate` for a NEW layout (its relief sits ABOVE the band, so `terrainFlattened`
// cannot fire at all, and its 13 % SW lake forces a genuinely different plan).
// `53/coastal` is UNUSABLE for a ring park: it passes the whole centroid diff and its
// WEST DECK STANDS AT h −0.06, in the water — which is why the deck-HEIGHT read below is
// not optional. `<Park seed={7}>` with no `climate` composes climateOf(7) = DESERT, not
// temperate: always pass `climate` explicitly.
export const SEED_ROW_WATER: Record<string, SeedRow> = {
  '1/temperate': {dom:{ctr:[41,-39],box:[21,60,-60,-21]},sec:{ctr:[-38,31],box:[-56,-21,23,39]}},
  '31/temperate': {dom:{ctr:[-40,-38],box:[-64,-16,-63,-8]},sec:{ctr:[17,40],box:[5,30,18,63]}},
  '83/temperate': {dom:{ctr:[41,-42],box:[26,57,-59,-26]},sec:{ctr:[-12,40],box:[-29,6,29,53]}},
  '71/temperate': {dom:{ctr:[-30,0],box:[-40,-20,-14,16]},sec:{ctr:[38,-23],box:[32,45,-29,-17]}},
  '3/desert': {dom:{ctr:[43,-45],box:[28,60,-63,-28]},sec:{ctr:[-39,20],box:[-45,-34,13,27]}},
  '19/desert': {dom:{ctr:[46,-49],box:[31,64,-64,-30]},sec:{ctr:[-26,34],box:[-36,-17,26,45]}},
  '37/desert': {dom:{ctr:[-47,-47],box:[-54,-41,-54,-41]},sec:{ctr:[11,42],box:[3,19,34,49]}},
  '91/desert': {dom:{ctr:[-51,-50],box:[-61,-42,-61,-40]},sec:{ctr:[40,16],box:[36,45,13,21]}},
  '5/alpine': {dom:{ctr:[42,34],box:[20,57,14,53]},sec:{ctr:[-17,-41],box:[-26,-9,-49,-33]}},
  '8/alpine': {dom:{ctr:[48,48],box:[38,59,38,60]},sec:{ctr:[-9,-48],box:[-19,-2,-58,-39]}},
  '17/alpine': {dom:{ctr:[37,34],box:[19,57,13,52]},sec:{ctr:[-15,-46],box:[-23,-8,-56,-37]}},
  '42/alpine': {dom:{ctr:[-45,-43],box:[-64,-24,-64,-24]},sec:{ctr:[26,34],box:[5,48,23,45]}},
  '7/coastal': {dom:{ctr:[46,-26],box:[33,57,-58,13]},sec:{ctr:[-43,-11],box:[-50,-37,-18,-5]}},
  '23/coastal': {dom:{ctr:[-24,-46],box:[-50,4,-61,-31]},sec:{ctr:[30,32],box:[14,47,15,50]}},
  '73/coastal': {dom:{ctr:[29,34],box:[5,54,12,56]},sec:{ctr:[-6,-42],box:[-30,19,-60,-24]}},
  '53/coastal': {dom:{ctr:[-46,-24],box:[-60,-28,-63,18]},sec:{ctr:[39,22],box:[29,49,11,33]}},
};
const SEED_ROW = SEED_ROW_WATER['1/temperate'];   // the pair you pinned

const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, row: SeedRow = SEED_ROW, nearR = 12) =>
  [row.dom, row.sec].every((b) =>
    !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

// ADVISORY, before the fuse: `AUTHORED.filter((c) => !offRow(c))` names every authored cell on
// the row's water — the same predicate `keepDryOf` reports below, so print it, do not re-assert
// it. Each hit is a waterRePicked/waterShrunk finding waiting to happen: move the cell off the
// bowl, or stop guarding it (guard only what you PAVE), or pin a row your skeleton misses.
// NEVER widen the tolerance. Known corner false positives — the BOX is not the BASIN (below).

/** THE GUARD LIST IS *DERIVED*, NOT TRANSCRIBED. This — not NET.keepDry — is what
 *  <Terrain keepDry> gets. It DROPS rather than fixes: a dropped guard is a cell still in
 *  the lake, so a non-zero drop count means MOVE THE THING. */
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned row's water. ` +
      `A DROPPED guard is NOT a fixed cell — whatever you meant to build there is still in the lake. MOVE it.`);
  return kept;
}
const GUARDS = keepDryOf(NET, SEED_ROW);   // ← THIS is what <Terrain keepDry> gets
```

Measured on one skeleton, same seed row: `NODES.slice()` moved the dominant body **77.3 u** and
the secondary **69.4 u**, `terrainSeed` 16 → 501, probes 17 → 64. `keepDryOf` → **650 guards,
BOTH bodies moved 0.0 u**, `terrainSeed` unchanged, 0 guarded cells wet — and it made that
park's **13 genuinely wet cells VISIBLE**: guarding them had hidden them.

**AND ANY PUBLISHED RANGE / PEAK GEOMETRY IS THE *UNGUARDED* COMPOSITION — NEVER PLAN A
CLEARANCE OFF IT.** With a dense 128 layout no slot in `composeHills`' jittered ring can offer the
19.2 u guard-free disc the primary range wants, so it falls through to a **phase-1 fallback walk
that is guard-BLIND.** On seed 1 temperate that is a FIVE-PEAK RIDGE along **z ≈ −43**, summit
**(5.33, −42.89) h 8.59 r 12.09**, peaks at x −13.8 / −5.8 / +5.3 / +19.2 / +29.9 —
**byte-identical in two parks with different guard clouds.** So you cannot move this ridge by
authoring around it (a gap at x ≈ 0 is exactly where the summit lands), and its skirt is
CONTINUOUS from **x −23 to x +38.6**, leaving only `x ≤ −23` and `x ≥ +38.6` dry southbound — and
the second is the SE lake. **Route down x ≤ −23** (hence the ring's x −24.0 column, §0-P.4).

**THE SIEVE IS A PRE-FILTER, NOT THE AUTHORITY — the §5c RE-COMPOSE DIFF IS.** The published
BOXES are narrower than the real BASINS: seed 1's secondary box is `x[−56…−21]` but its bowls
reach **`x −18.1`**, 2.9 u past the wall — so a street column at `x −19.2` crossing `z 23…39`
clears `offRow` silently and still moves that body **25 u**. Ship both, in this order, every
time — re-compose with your guard list and diff against the unguarded row:

```ts
// parkComposition(t, seed, size, climate, guards) is POSITIONAL and PURE. THREE THINGS
// ABOUT THE SIGNATURE, EACH OF WHICH HAS COST A PARK:
//   (1) `t` IS THE REAL THREE NAMESPACE — `import * as THREE from 'three'` at the top of
//       the file, then pass `THREE`. It is NOT optional and NOT nullable: wave 19B wrote
//       `parkComposition(null as any, 91, …)` because nothing said where `t` comes from,
//       and took `Uncaught TypeError: Cannot read properties of null (reading
//       'PlaneGeometry')` at MODULE SCOPE — blank page, 0 of 100, every axis unmeasured.
//   (2) `size` DEFAULTS TO 48. Pass 128 explicitly or you audit a different park than the
//       one you ship.
//   (3) THE 5th ARG IS AN OBJECT, NOT A BARE ARRAY:
//       `{ keepDry: GUARDS, coasterPts: ALL_COASTER_PTS }`. Passing the guard array
//       directly silently gives the composer no guards at all.
//   const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE);                    // unguarded
//   const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE,
//                                { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });
// Diff BOTH centroids,
// terrainSeed and probesTried, and READ THE FOUR DECK HEIGHTS — one row passes the
// centroid diff and still drowns a platform (53/coastal, West deck h −0.06).
parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - BARE.waterCentre[0], COMP.waterCentre[1] - BARE.waterCentre[1]) < 1 &&
  Math.hypot(COMP.waterCentreSecond[0] - BARE.waterCentreSecond[0],
             COMP.waterCentreSecond[1] - BARE.waterCentreSecond[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(BARE.waterCentre)} → ` +
    `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(BARE.waterCentreSecond)} → ` +
    `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}`);

// AND DIFF THE *RELIEF*, NOT ONLY THE WATER — the water diff alone is HALF A CHECK. One park
// ran the centroid diff faithfully, PASSED, and was charged a `terrainFlattened` anyway: three
// guard cells cut a range from h 8.59 to 0.83, −1.5. On an OFF-TABLE seed this is the ONLY
// terrain check you have (`expectWater` is undefined, so `waterRePicked` cannot fire).
//
// ⚠ THE FIELD IS `report.reliefFloor`. `report.relief` AND `report.stdH` DO NOT EXIST —
// reading them throws `TypeError: ... (reading 'toFixed')` AT MODULE SCOPE, i.e. a BLANK
// PAGE. `reliefFloor` is `ReliefFloorReport | null`, null on an UNGUARDED composition and on
// any plot <= 48 (`guardAware = size > 48 && guards.length > 0`), so THE NULL GUARD IS NOT
// DECORATION. Its ONLY fields: `relief` `stdH` `authoredRelief` `authoredStdH` `kept`
// `keptRelief` `keptStdH` `floor` `ok` `guardedRanges` `cappedPeaks[]`, where
// kept = min(relief/authoredRelief, stdH/authoredStdH) and floor is RELIEF_FLOOR_FRAC = 0.70.
const rf = COMP.report.reliefFloor;      // NOT COMP.report.relief — no such field
parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
  rf ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} → built ` +
    `${rf.relief.toFixed(2)} (kept ${rf.kept.toFixed(2)} against the ${rf.floor} floor), stdH ` +
    `${rf.authoredStdH.toFixed(2)} → ${rf.stdH.toFixed(2)}. Guarding a cell does not dodge the ` +
    `land, it LIFTS it — a tail or a deck on a range SHAVES the range. Ranges this guard list ` +
    `stood on: ${rf.guardedRanges}; peaks it took ≥ 25 % of, with the culprit cells: ` +
    `${JSON.stringify(rf.cappedPeaks)}` : '',
  'advisory');   // the GATE's FATAL test is the CONJUNCTION kept < 0.70 AND stdH < 0.76
// ⚠ TWO DIFFERENT stdH FLOORS, AND BOTH ARE CORRECT — do not "reconcile" them.
//   0.76 = SEED_TABLE_128_BAND.stdH[0] (ParkBuilder/landform.ts:427), the band floor the
//          GATE uses for the fatal conjunction above.
//   0.75 = the SCORER's axis-7 "normal" band floor (0.75–1.5 → the full 3 points).
// So 0.75 ≤ stdH < 0.76 PASSES the gate and still scores below normal on axis 7. That
// 0.01 strip is not academic: 18A built 0.73, skeleton-a 0.74, skeleton-b 0.72 — every
// reference park lands just under BOTH. Clearing 0.76 is the real target, not 0.70 kept.
```

The other `report.` fields that EXIST on a `parkComposition` result — anything else is `undefined`,
and `undefined.toFixed()` is a black page: `probesTried` · `violations` (string[], POST-clamp) ·
`clampedCells` · `waterBodies` · `waterAreaU2` · `waterAreas[]` · `waterGap` ·
`waterFracEastHalf` · `waterFracNEQuad` · `apronMaxAbs` · `reliefFloor`. (`terrainSeed`, `basins`,
`basinsSecond`, `clampBasins`, `clampPeaks`, `peaks`, `waterCentre`, `waterCentreSecond` are on
the COMPOSITION, not on `.report`; `report.valid`/`fatal`/`closure`/`stations` belong to
`compileTrackPieces`, a DIFFERENT type.)

**AND SIEVE THE PLANTING — `isDryCell` IS NOT THE TEST THE GATE RUNS.** The difference was one
park's ONLY gate failure: `[scenery] <Scenery topiarySpiral> … ground -0.34 under its 0.48 u
footprint is below waterline+0.05 = -0.21` — on a cell that had passed `offPathCell(NET, …,
{ clear: 1.2 })` AND `park.isDryCell()`.

- **THE GATE'S PREDICATE** (`ParkBuilder/validate.ts:1195-1207`, transcribed below): sample the
  ground at the piece's centre and at 8 points on a circle of the piece's **OWN footprint radius**
  — EVERY sample `> waterLevel + 0.05`. `waterLevel` is the CONSTANT `WATER_LEVEL = -0.26`
  (`ParkBuilder/climate.ts:24`), so the bar is a fixed number: **min ground > −0.21.** Pads, lanes
  and huts get the same rule over their rect corners (`:1171`).
- **`isDryCell` IS a height test** — `heightAt > waterLevel + clearance`
  (`Park/parkContext.ts:667/684`), not a basin-distance sieve — **but not THAT test.** It samples a
  FIXED **0.6** half-cell ring, never the piece's measured mesh radius; **it answers `true` for
  EVERYTHING while `park.ground` is null** (`:697` — a vacuous pass, hence CHILD, never module
  scope); and it describes the heightfield only AS IT WAS WHEN IT RAN, while `<Terrain>` re-clamps
  and REBUILDS the ground after settle (`:449-451`).
- **A SHALLOW WET CELL IS NOT REFUSED — IT MOUNTS.** `refuseIfWet` (`Park/wrappers.tsx:387`)
  refuses only OPEN water, `minH < wl − 0.4` (§0-FATAL `plantedInWater`, and you come up short on
  the >= 32 tree / >= 16 scenery counts). Between `wl − 0.4` and `wl + 0.05` the piece IS built and
  you get a NON-FATAL **`plantedWetCell`** lint promising an AUTO-keepDry bank — exactly what
  failed to arrive above. **Under §0's fatal-warnings policy that console line IS the failure.**

```tsx
// THE RECEIPT, IN THE TREE, MOUNTED LAST — the gate's predicate over YOUR cells. `park.ground.lint`
// is `terrainLint(heightAt, size, WATER_LEVEL)` (`Park/wrappersLand.tsx:172`) and `lint.isDry(x, z,
// c)` IS `heightAt(x, z) > waterLevel + c` (`ParkBuilder/placement.ts:70`) off the SAME sampler
// validatePark reads (`validate.ts:800`). PASS 0.05 EXPLICITLY — the default is 0.12.
function dryRing(park: ParkContextValue, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g) { console.error('[park] dryRing ran with NO TERRAIN — a VACUOUS pass'); return true; }
  const dry = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}
// r is the piece's GROUND radius, measured off the BUILT mesh (`groundFootprintRadius`) and
// unreadable while authoring: 0.75 covers every single-tile prop and tree.
// FOR CELLS YOU CANNOT DROP — ride pads, huts, queue tails, deck cells — you still need the
// receipt: mount the sieve below over `PADS.map((at) => ({ at }))` with `render={() => null}`.
// It renders nothing and prints the same line. A silent console is the ONLY evidence that row
// of the header is true; the park that skipped it FAILED the gate on a 0.08-u shoreline dip.
```

```tsx
function DryScatter<T extends { at: XZ }>({ cells, render }: {
  cells: T[]; render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));   // the GATE'S test, not isDryCell
    if (kept.length < cells.length)
      console.error(`[park] DryScatter dropped ${cells.length - kept.length} of ${cells.length} ` +
        `cell(s) UNDER waterline+0.05: ${JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at))}`);
    setDry(kept);
  }, [park, cells]);
  return <>{(dry ?? []).map(render)}</>;
}

// …last in the tree, after <Terrain> and <Paths>. AND THE CELLS YOU HAND IT MUST ALREADY BE OFF
// THE STREET, INCLUDING THE TREES — it only sieves for WATER. Type the shape off the tuple:
// `shape: string` is a TS2322 against tree()'s union, and Kit exports the FUNCTION, not the union.
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,   // 0.55 slab + 0.6 blockR − 0.1 kerb
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

<DryScatter cells={TREES}   render={(t, i) => <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />} />
<DryScatter cells={SCENERY} render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />} />
```

**A SIEVE DROPS THINGS, SO OVER-PROVISION:** author ~40 tree and ~20 scenery cells against the
floors of 32 and 16, and read the `DryScatter dropped N` line against that margin.

## 0. Rigs are pre-scored — USE THE CATALOG, never hand-roll

**Every catalog rig was screenshot-scored /100 day + night before it shipped**, so a catalog rig
beats a hand-rolled one every time. A hand-rolled carousel/teacups/tree out of raw primitives is
a defect, not creativity. If you ever must model one: work from the RCT2 sprite, **realistic
colours only** (muted brick red, forest green, navy, cream, silver, grey-brown — never
orange/pink plastic), 1 unit ≈ one tile edge, a guest ~1.1 tall, bases at y = 0. **Reuse the
shared builders:** `buildPeep` (Guest), `buildWater` (WaterTile) for ALL water,
`buildCoasterCar`, `buildTerrain`, `tree`/`bench`/`lamp` (Kit), `buildRock`/`buildRockCluster`,
`buildPathNetwork`, `buildStringLights`. ONE updater from `build`.

## 1-3. Stage · day/night — `<Park>` owns all of it

**A park never authors a `<Stage>`.** `<Park>` wires fullscreen, `autoRotate={false}`, fog and
camera-vs-ground clamping. Every `Stage` prop, `box`/`cyl`/`ball`/`mat`, the
`mergedBoxes`/`mergedParts`/`mtx` helpers, `api.stats()`/`addViewport` and the inset rules live in
**`components/Stage/Context.md`**; import them from `'./components/Stage'`, never from
`'./components/Park'`. Two things matter here: **`opts.tex`** picks a procedural canvas texture
(`wood | metal | asphalt | leaf | fabric | concrete | grass | plastic | sand`) with `repeat`/`bump`
and the material flags — **no external image assets, ever**; and **day/night runs off `nightKOf`**,
the Stage writing `group.userData.nightK` (0 day → 1 night) every frame. **Lights stay OFF until
dark** (daytime = intensity 0). Keep real PointLights **≤ ~4 per component**. `api.onPick(cb)`
raycasts clicks and returns the first ancestor carrying `rideRef` or `guestRef`.

## 5. The park workflow — compose with `<Park>` (React first)

**YOU compose every park — there is no `generatePark`.** The surface is JSX, one shared canvas:
seed a `<Terrain>`, lay `<Paths>`, declare the `<GameManager/>`, mount the `<Gate>`, then place
rides straight from the catalog — `<FerrisWheel position rotation register />`. **If it is in the
catalog, use the component** — a hand-rolled carousel/teacups/tree out of raw primitives is a
defect, not creativity; trees/rocks from Kit (`tree`/`rock`), scenery from SceneryPack, colours
from ColorKit (`rideColourPreset` is in ColorKit, **not** SplineRideKit), `compileTrackPieces`
from SplineRideKit. Once `<GameManager/>` is declared ALL the game logic comes free — guest
spawning/needs, every ride's FSM + breakdowns, queue flow, purchases, clickability, the whole
UI-window suite — and `validatePark` runs once the children settle (§0-P.0):

```tsx
import { Park, GameManager, Terrain, Paths, Gate, Coaster, Fountain,
         Restroom, Neon, Scenery, Lights, Placed } from './components/Park';
import { FerrisWheel } from './components/FerrisWheel';
import { BurgerShop } from './components/BurgerShop';

<Park seed={1} climate="temperate" roster={{ rides: 9, stalls: 5, categories: 5 }}
      onReady={(report) => { /* report.ok MUST be true */ }}>   {/* size OMITTED → 128 */}
  <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />  {/* probed landform + lakes */}
  <Paths nodes={NODES} edges={EDGES} plazas={[PLAZA]} walkers={4} bins={[[1.5, 2.4]]} />
  <GameManager />   {/* the sim brain — declare it */}
  <Gate />   {/* sole guest spawn */}
  {/* PIECES mode · cars passed · no bank prop (steel builds 0.7) · exit/exitDir omitted,
      so the chassis takes the RCT2 cell one tile along the station face — §0-P.4 */}
  <Coaster name="Corkscrew Ascent" pieces={C_PIECES} start={C_START} heading={0}
    type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={9}
    price={7} queueTailNode={NET.node(C_TAIL)} queueDir={[1, 0]} />
  <FerrisWheel position={WHEEL.pad} rotation={WHEEL.yaw}
    register={{ name: 'Grand Wheel', capacity: 4, price: 3 }}
    queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }} />      {/* catalog ride, one line */}
  <BurgerShop position={[3.0, -0.5]} rotation={-Math.PI / 2} register price={3} value={5} />
  <Fountain /> <Restroom position={[-1.2, 4.8]} rotation={Math.PI / 2} />
  <Neon text="ARCADE" position={[3.6, 1.7, -6]} rotation={Math.PI} />
  <Scenery name="planterBox" position={[1.65, 0.75]} />  <Lights from={A} to={B} />
  <Placed build={(t) => tree(t, { shape: 'pine' })} position={[-2.8, 4.6]} />
</Park>
```

- **USE the land** (§0-P.4): spread **8+ rides** into **3-5 districts + the hub** on the
  composition's flat fields (a 128 draws **6-7 meadow build fields per seed**; a 48 gave 1-2),
  linked by long approach boulevards, every ride with breathing room — the 6-u pitch is a floor,
  not a target. **BUT THE GATE BINDS: the first ride's queue tail must sit within 15 u of the
  gate cell (z 63.6 at 128), and nothing past ~75 u of the gate is ridden inside the 60 sim-s
  acceptance window.** Every validator scales with `size`; the 1.2-u lattice does not.
- **Composition order is mount order** (sibling effects run in JSX order): `<Terrain>` →
  `<Paths>` → `<GameManager>` → `<Gate>` → rides/stalls/amenities → scenery. Wrappers throw
  when a prerequisite is missing.
- `position` props are `[x, z]` (y settles onto the plaza/terrain) or `[x, y, z]`;
  `rotation` is Y yaw. Everything is deterministic off `<Park seed>`; prop changes REMOUNT
  the object (manager registrations cannot unregister — remount the whole `<Park>` via `key`
  to change sim config).
- The Park wrapper set: `GameManager, Terrain, Paths, Gate, Coaster, FlatRide, Placed` (escape
  hatch for ANY built group), `Stall` (`sell` makes it a registered selling stall), `Restroom,
  Fountain, Torch, Neon, DanceFloorR, Scenery, Lights` + the `usePark()` hook (`{ three, root,
  api, addObject, manager(), ground, paths, composition, groundAt, floorAt, registerFootprint,
  registerCoaster }`). A bare `<Gate/>` defaults to the lattice cell hugging the FRONT terrain
  edge (z = `1.2·round((size/2 − 0.8)/1.2)`: **63.6 at 128**, 22.8 at 48, 7.2 at 16), facing out
  — keep a street node under it. **Every catalog component is composable too** (§5.1): rides,
  stalls, tiles and scenery all mount with `position/rotation/scale` inside a `<Park>`.

**PARK PRE-FLIGHT — the static arithmetic, written into the §0-P.1 header before any JSX and
finished last.** The numbers §0-P does not repeat: capacity-4 rides
**≥ 6 u centre-to-centre**, queue reach `front + laneLenOf(capacity) + 0.35` with
**`laneLenOf(c) = max(2.2, 1.1 + 0.56·c)`** (`ParkBuilder/placement.ts:79`) and the EXIT hut
one tile along the same station face with `exitDir = queueDir`, so plan TWO free tiles on
that face; **`rideDuration ≤ 12`** (the 60 sim-s acceptance window must fit one full cycle);
path level hugs the MEDIAN node ground (bulge nodes move or take a `nodeY` ramp — never a
street-long berm); gate within ~1 u of the front edge facing OUT; Neon `scale` 0.4-0.7;
**≥ 32 trees, ≥ 16 scenery pieces** at 128 (≥ 12 / ≥ 6 at 48); **≥ 1 stall per 2 rides**;
and exactly **TWO** water bodies — a dominant plus a secondary (`waterBodyTarget`) — inside
the per-climate band re-measured at 128 with two bodies (**desert 2-8 %, alpine 2-11 %,
temperate 4-22 %, coastal 7-24 %** of the plot, TOTAL over both — the flat "~12 %" figure was
never true), the secondary ≥ 16 % of the dominant and ≥ 7 u clear of it. For the
track corridor, **copy §0-P.4's published keep-out rects and the pinned seed row (§0-P.6)
rather than deriving either by hand.**

**RUNTIME SELF-HEALING IS A SAFETY NET AND EVERY USE OF IT IS A §0-FATAL `autofix`
FAILURE.** Once the children mount (before guests spawn, before `validatePark` reads anything)
the settle pass corrects a pad in the walked slab, shifts any MOVABLE stall/flat-ride rig out
of a coaster's 1.6-u corridor (≤ 4 cells, with exit-hut relocation and lane trims as fallbacks;
`pinned` rigs, streets and coasters never move), then re-clamps the terrain under every
registered footprint and **rebuilds the `<Terrain>` in place — which is why a dryness check
that ran earlier proves nothing at gate time (§0-P.6).** **None of it makes your own `keepDry`
list optional**: the re-clamp cannot un-move a lake your guards pushed off its row.
`manager().corridorCells(name?)` lists a circuit's live corridor cells.

### 5.1 Componentized catalog — the composable convention

Every catalog component exports ONE React component that COMPOSES: it mounts its built group
into the surrounding scene context and renders null. **You will not normally write a new one: if
it is in the catalog, USE the catalog component** — the convention (`useComposable`,
`composable(name, build, cfg)`, `<ScenePreview>`) lives in `components/Park`. What a park DOES
touch is the two chassis every catalog ride/shop delegates to:

- **`<ConfigurableRide build layout register name capacity rideDuration loadTime intensity price
  queue position rotation scale>`** — with `register` set inside a real `<Park>` it wires the whole
  GameManager life: the RCT2 ride FSM + breakdowns, the queue lane + entrance/exit huts derived
  from position+rotation (queue HEAD `front` out the local **+z** face, default **1.8**;
  `<Discotron>` 4.0, `<BumperCars>` 2.6; the EXIT hut one tile along that face facing the same way
  out, with its own footpath), `groundRideAccess` berms, real riders via `seatWorld`, crash wiring,
  clickability. `queue={{ anchor, dir }}` overrides the derived lane in world space; **lane LENGTH
  always follows `capacity` (`laneLenOf`)** — §0-P.5's `place()` is the arithmetic.
- **`<ConfigurableStall build stall register name price value>`** — registers a selling
  stall; the serving front faces local **+z** (attach point 0.72 out), so aim `rotation` at
  the customers' path.

**Track piece composition.** Track rides compose from PIECES, RCT2-style, compiled to spline
control points by `compileTrackPieces`. **For a park COASTER, copy §0-P.4's two verified
archetypes rather than authoring a circuit** — below is the grammar behind them.

```tsx
// pieces ARRAY (bare names take all defaults)
<LogFlume position={[4, -3]} pieces={['station', { type: 'lift', height: 1.2 }, 'turnL', 'drop', 'turnL']} />
// JSX piece CHILDREN (children WIN when both are given)
<TrackRide profile="coaster" type="steel" position={[-1, -7]}>
  <Station /><Lift height={1.6} /><TurnR /><Drop /><TurnR /><Hill height={0.7} />
</TrackRide>
```

- **Vocabulary** — every piece starts and ends LEVEL, so pieces chain freely: `station` (flat
  boarding straight — make it FIRST), `flat`/`straight` (`length`), `lift`/`drop` (`height`;
  drop defaults back to station level), `hill` (camelback), `turnL`/`turnR` (`angle` 90°,
  `radius` 1.5), `helixL`/`helixR` (`angle` 360°), `corkscrewL`/`corkscrewR` (a real inversion —
  **steel only**; water profiles substitute an sbend), `loop`/`loopL`/`loopR` (`radius` =
  half-height, default 1.8 — steel only), `sbend`. The JSX descriptors from `components/Park`
  mirror them one-for-one. **Run lengths:** station 2.6 · straight 1.3 · lift/drop ≈ 1.6 +
  3.9×height (auto-extended, a short `length` is ignored) · hill 6.0 · 90° turn = R forward +
  R sideways · helix 360° returns to its entry point ONLY when `height` is 0 (climbing: 7.86 u forward at h 2) · corkscrew 2.4 · sbend ~= its `length`.
- **CLOSURE** — the cursor starts at the local origin heading +z and the compiler closes the
  circuit legally wherever the pieces end (RCT2 refuses an unclosed one): an eased ramp back to
  station height, then the shortest arc–straight–arc return (radius **2.2** coasters, 1.5
  otherwise) onto the START POSE — the start point AND the heading you left the station on. So
  **end your pieces heading within ~30° of that ENTRY heading and within ~3 u of the start**
  (alignment, not "pointing at the station") with a **straight brake tail ≥ ~1.2 u landing
  ~0.3 u SHORT**; landing from a turn welds a curved, unbanked station at full speed and the
  crash replay FAILs it. **A synthesized closure over 40 % of the authored length is FATAL**
  (translucent red, NOT registered), and **synthesized points COUNT toward the park bounds.**
  Banking SATURATES at the type's bankLimit (`coasterBankCap` — wooden 25°, steel 55°), so the
  default bank is legal on every type, and `checkCoasterDesign` + `validateSpline` ALWAYS run
  (report on `group.userData.trackReport`). **Prefer PIECES mode** — raw `points` gets no
  leniency at the same fatal gate, without the grammar's by-construction legality.
- **Where it plugs in**: `<Coaster pieces|children start heading>` (`start` accepts `[x, z]` or
  the `[x, y, z]` given to `compileTrackPieces`), the generic `<TrackRide
  profile='coaster'|'flume'|'rapids'|'bobsled'>`, and `<LogFlume/> <RiverRapids/> <Monorail/>
  <Bobsleigh/>` on their own profiles (defaults unchanged when no pieces are given).
  **`<Monorail>` IS A REQUIRED, MULTI-STATION TRANSPORT RIDE — its copy-paste block is §0-P.4
  and it is the sixth pre-bundle gate.** ONE `station` piece per platform is legal on the
  monorail profile only (RCT2 rides own a station ARRAY, `ride/Ride.h:404`); the train unloads at
  each so guests transfer A → B (`probe.sim.transfers`) — but RCT2 has no transport ROUTING, so
  that counter is the only claim you may make about it.

**The imperative path underneath.** Every wrapper is a thin layer over the builders
(`parkComposition` → `buildTerrain` + `tintTerrainForClimate` + `buildWater` →
`buildParkEntrance` → `buildPathNetwork` → rides → stalls → `createGameManager` →
`validatePark`). **`<Park>` does all of that wiring, and a generated park has no reason to drop
below it** — wrap any one exception in `<Placed>`/`usePark`. Note `parkComposition` guards are
POST-ENFORCED: wet/bulging guarded cells are clamp-terraformed and `comp.report.violations` is
POST-clamp. `<Park fullscreen>` is the default.

## 6. GameManager — declare it and the sim is free

`<GameManager/>` inside a `<Park>` is all a park needs: guest spawning/needs, every ride's FSM +
breakdowns, queue flow, purchases, clickability, the UI suite. Underneath it is
`createGameManager(t, { groundAt, net, laneY, bins })` + `registerParkEntrance(gate)` (the SOLE
spawn point) + `registerRide`/`registerStall`/`registerRestroom`/`spawnGuests(n)`, stepped with
`mgr.update(time, dt)`. Give it the SAME `{nodes, edges}` the PathNetwork rendered — guests walk
ONLY that graph. Accessors: `stats()`, `guests()`, `rides()`, `accessPoints()`, `footprints()`,
`corridorCells(name?)`, `blockers()`, `blocked(x, z)`, `edgeWalkable(a, b)`.

**THE GATE STREAM.** Population is LIVE — arrival rate is dominated by the share over
`happiness > 128`: **20/min while ≥ 83 % are happy, 2/min when none are.** Two ceilings: RCT2's
soft `suggestedGuestMaximum` (Σ ride BonusValue — **a one-ride park throttles itself**) and a hard
`arrivals.cap` by plot (26/52/100/132 at size 16/48/128/192). Opening population `<Park guests>`
defaults to **~50 at 128**.

**BLOCKERS — guests do not walk through solid objects.** Rides/stalls register their pad, body and
queue railings automatically, as do `<Fountain>`, `<Restroom>` and every `<Fence>`. Path edges
crossing a blocker are REFUSED by the router (which severs the graph — §0-P.1's ATTACH row), and
`validatePark` gains a `blockers` check: no street through a blocker, every queue tail reachable.

## 7. UI + clickability — wired for free

**A `<Park>` with a `<GameManager/>` wires the whole suite; there is nothing to author**:
RideViewer, GuestInfo, **ParkInfo** (bottom-right, collapsible, **MANDATORY**),
`attachPlayerCam`. **One floating window at a time**; never cover the top-right day/night
switcher. Pixel icons from UIIcons only. The GameManager tags guests `userData.guestRef` and
rides `userData.rideRef` (+ `rideVehicle` for the onboard cam); Stage `onPick` delivers them.

## 8-10. ColorKit · ParticleKit · SceneryPack

- **ColorKit** — `rideColourPreset(seed, type)` (`'wooden'|'steel'|'water'|'kart'`) rolls a real
  RCT2 TRACK_COLOUR_PRESETS entry → `{ track: { main, additional, supports }, vehicles: [{ body,
  trim }…] }`; seed it `seed + zoneIndex` so each land rolls its own. `RCT2_COLOURS` is the full
  Colour.h palette, `shade(c, f)` derives trims. **Never invent ride hexes — and OMIT `colours` on
  a catalog ride: the chassis presets it.**
- **ParticleKit** — `buildEmitter(t, { max, rate, life, velocity, spread, gravity, size, color,
  additive })` → `{ points, update, burst, setOrigin, setRate, dispose }`. One `THREE.Points` ring
  buffer per emitter; `additive: true` for fire/glow. Add `points` to your group, fold in `update`.
- **SceneryPack** — `buildScenery(t, name, { scale?, seed? })` / `buildSceneryAnimated`.
  `SCENERY_NAMES`: marbleStatue, birdbath, picnicTable, planterBox, topiarySpiral,
  topiaryElephant, signpost, tvMonitorPost, parkClock, flagpole, ironArchway, brickWall,
  picketFence, lionStatue, cactusCluster, fallenLog, mushroomCluster, wishingWell, gazebo,
  hotAirBalloon.
- **NeonSign** `buildNeonSign(t, { text|path, color, scale, backboard })` · **DanceFloor**
  `buildDanceFloor(t, { size, tile })` (night-gated). **At most one DanceFloor per park.**

## 11. Validators — nothing ships unchecked

- **`validateSpline`** (clearance ≥ 0.9) · **`checkCoasterDesign`** (RCT2 construction rules:
  per-type slope/bank whitelists, windowed pitch-rate — one grade step per 1.2-u tile — bank-rate,
  a real station flat; `shortDrop`/`shortLength` are stat-gate warnings, and `validatePark`
  promotes `coaster:shortDrop` to a hard failure) · **crash physics** (derail past **1.5 g**
  lateral) · **`placeAccess`** (SAT audit of huts, lanes, pads). All four run automatically and
  every violation is FATAL.
- **`validatePark(t, { net, manager, terrain, coasters, group, rebuild? })`** (ParkBuilder) — the
  acceptance gate, and it RUNS IN THE PREVIEW (§0-P.0): accessibility (gate routes to every queue
  tail AND every exit path back), terrain vibe (TWO water bodies, flat apron, hills clear, the
  wet-pad guard), the footprint SAT sweep, coaster legality + crash margin (worst lateral under
  **1.5 g × 0.85 = 1.275**), the track-CORRIDOR sweep (a 1.6-u corridor along every circuit must
  clear stalls, other rides' access rects and street edges unless the track flies ≥ 2.2 u above
  them, re-audited against each obstacle's own roof), a 60 sim-s smoke run, the area-scaled mesh
  budget + double-build determinism hash, a hard `bounds` check over every footprint corner and
  manager-derived queue-tail/exit node, the `scenery` check (§0-P.6), and `autofix` — every
  build-time auto-fix is §0-FATAL. `{ ok, failures, warnings }` — **ship only `ok: true` WITH an
  EMPTY `warnings` array.**
- **`reportPlanLint` / `parkPlanLints()`** — the PLAN-TIME lint bus. **PLAN BUILDERS DEGRADE,
  THEY NEVER THROW**: they run at MODULE SCOPE, where a throw black-frames the page, so a
  diagonal `boulevardPlan` becomes an L-route through a corner node, an unknown port falls back
  to a real one, a bad edge is dropped — and the defect is recorded here. **The park you shipped
  is then not the park you designed: fix the coordinate, never accept the degraded shape.**
  `<Park>` replays the bus into `validatePark`, where the fatal ones become `autofix` failures.
  (That is plan BUILDERS. **YOUR OWN checks are the opposite case and must throw** — §0-P.5.)
- **`seedTableRow(seed, climate, size)`** — `<Park>` passes the pinned row (§0-P.6) to
  `validatePark` as `expectWater`, which flood-fills the BUILT terrain and warns
  (`waterRePicked` / `waterShrunk` / `waterGrew`) when the composed water moved off the row your
  layout was planned against — in EITHER direction: a body that grew past ×1.333 has moved its
  shore inward onto ground you called dry.
- **esbuild strips types without checking them**, so a type error reaches the browser as a
  runtime surprise: keep every prop shape copied from a published block (§0-P.4).

## 12. Determinism rules

- Hashed-sine PRNGs ONLY (`hash01(n) = fract(sin(n·12.9898 + 78.233) · 43758.5453)` keyed
  by seed/index/counter). **Never `Math.random`, never `Date.now`** — the same seed must
  rebuild the identical park, byte for byte (validatePark's double-build hash enforces it).
- Time comes in through the updater argument; derive everything per-frame from it (clamp dt).

## 13. Performance — the budgets are yours to respect

The Park runtime LOD-throttles every mounted entry by distance automatically, and since updaters
take ABSOLUTE time (§12) a throttled frame is coarser motion, never drifted motion. Park-spanning
backdrops opt out with `addObject(obj, update, { lod: 'full' })`; close-up dressing tags
`group.userData.lodDetail = true`. The Stage caches geometry/textures (`userData.shared` — **never
hand-dispose them**) but deliberately NOT materials, so **keep materials per-mesh**.

- **≤ 4 real PointLights per component** — past that use emissive gated on `nightKOf`. Park-wide
  only the nearest `budgets.lights` stay `visible` — **OPT-IN, no default cap**
  since 2026-07 (it defaulted to 16 and was switching off 11 of a park's 24 night
  lights for no measurable frame saving; Park/Context.md "Lights are no longer
  throttled" has the A/B). Lights are also no longer shed at FAR/OFFSCREEN.
- **A REAL LIGHT COSTS THE SAME AT NOON AS AT MIDNIGHT unless it is `visible:false`.**
  three.js only leaves a light out of a material's forward light loop when it is
  invisible; `intensity = 0` still books its slot and still runs a full per-fragment
  PBR iteration whose result is multiplied by zero. So a park's night-gated lamps
  used to cost their full price all day. **The Stage now sheds them for you** —
  `Stage/darkLights.ts`, cadence 0.25 s, with hysteresis so a day/night transition
  recompiles the shaders once — and `api.stats().lightsCulled` reports how many.
  Measured (SwiftShader, `harness/mp3d-render/probe-render-cost.mjs`, interleaved
  A/B): DemoPark size 16, 21 of 24 lights dark, **406 → 281 ms/frame (−31%)**;
  monorail-ref size 128, 41 of 41 dark, **342 → 197 ms/frame (−42%)**. Zero change
  to draw calls or triangles, bit-identical picture. **This does not buy your night
  scene anything** — at night those lamps are lit and cost full price, so the
  ≤ 4-real-lights rule is still the rule. It only stops you paying for darkness.
- **≤ 300 particles per component**, global cross-emitter budget 4000.
- **Mesh budget `2500·(size/16)²` — 160 000 at 128** (~22 500 at 48). validatePark warns past it
  and warnings are FATAL. The Stage warns past ~3000 draws / ~2.5M triangles.
- **ONE live inset viewport** (insets are full render passes). **UI polls at ≥ 300 ms.**
- `mergedBoxes`/`mergedParts` for static dressing; `InstancedMesh` for repeats. Never merge parts
  that move independently. Big parks: `fullscreen` + `fog={{ near, far }}` (also tightens the far
  plane). Measure with `api.stats()`. **A single rig ≲ 300 draw calls, an example park ~2000.**
- **DO NOT TRUST A PERF NUMBER TAKEN BEFORE THE PARK STOPS GROWING.** `[Park] perf:`
  used to fire on a fixed 3 s timer armed BEFORE the build queue drained and
  reported **293 draws / 9 runtime entries for a park that renders 1874 / 29** — a
  6x under-report that hid the light cost above for months. It now polls until the
  draw count is stable and says `STILL RISING` if it gives up first, because the
  gate stream keeps admitting guests for seconds after `onReady` (DemoPark asks
  for 10 and settles at 22). And `stats().fps` was averaging `1/dt` over the loop's
  CLAMPED dt, so it could never read below 10 — a park at 1.4 fps reported "13.6".
  It is `1 / mean(unclamped dt)` now; `frameMs` was always the honest one.
- **THE LOAD IS NOT THE FRAME, AND IT IS THE PART THE USER FEELS.** A settled park
  reading 2.9 ms on this machine can still be "super laggy" to look at, because the
  cost lives in the ~15 s ASSEMBLY WINDOW that no settled-frame probe ever sampled.
  `harness/mp3d-render/probe-assembly.mjs` measures it (rAF gap series, long tasks,
  per-build marks, shader-program census, under an explicit `--throttle`). Three
  things pay for themselves there, all measured on `parkA-99` at `--throttle=4`:
  the park **does not render while it assembles** (streamed content mounts hidden,
  one `revealBuilt()` + one `renderer.compileAsync` at the end — Park/Context.md
  §3), the acceptance gate **runs after a paint**, and `<Terrain>`'s 383 ms of
  auto-dressing is **queued** while its heightfield stays synchronous. Together:
  **113 long tasks / 16.0 s of stall → 19 / 9.6 s, median load frame 59 → 28 ms.**
  Do not "optimise" load by chunking work into more frames without checking the
  program census — rendering an intermediate state is what compiles the same
  shader at yet another light count.
