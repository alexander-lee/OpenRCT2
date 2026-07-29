/* ============================================================================
 * VOLTMOOR — a large THRILL theme park (ONE fullscreen component, default export)
 * ============================================================================
 *
 * §0 PRE-FLIGHT (static arithmetic — done on paper before shipping):
 *
 * PLOT: <Park size={128}> default. x,z ∈ [-64, 64]. Gate cell z = 63.6 (front +z edge).
 * SEED: 7, climate "coastal" — pinned from the §1 SEED TABLE (generated at 128).
 *   DOMINANT: river, ctr (46,-26), box x[33..57] z[-58..13], 4.9%.
 *   SECONDARY: tarn, ctr (-43,-11), box x[-50..-37] z[-18..-5], 1.0%. total 5.9%, gap 70u.
 *   coastal water band §0.10: 7-24% — 5.9% is legitimately near the floor for coastal.
 *   → EVERYTHING is placed OFF both boxes. keepDry cells all avoid x[33..57]z[-58..13]
 *     and x[-50..-37]z[-18..-5], so the composer does NOT re-pick the water.
 *   Build fields (comp.landZones): (-56,-42) use 6.8, (-2,57) use 6.1, (57,13) use 6.
 *
 * WORLDS (≥3, chosen FIRST, each its own district; themed pieces stay in-world):
 *   1. EMBERFALL CALDERA (volcanic, EMBERFALL_CALDERA) — west-central meadow.
 *      Flagship coaster + DropTower + PirateShip. FLAME lamps, basalt paving.
 *   2. BRASSWORK FOUNDRY (steampunk, BRASSWORK_FOUNDRY) — south-west.
 *      Enterprise + TopSpin + River Rapids (dry flat land). Brass/soot paving.
 *   3. PULSE DISTRICT (disco, PULSE_DISTRICT) — south-central.
 *      Carousel + Ferris Wheel + Observation Tower. Cold neon, black-glass paving.
 *   HUB (neutral) — FountainPlaza on the gate street, no theme.
 *
 * STREETS: buildParkNet fuses HUB (FountainPlaza) + 4 Boulevards + a spine.
 *   Gate [0,63.6] → HUB [0,50.4]. Ring loop: HUB → Emberfall → Foundry → Pulse → HUB.
 *   Every avenue N/S or E/W. World centres > 32.66u apart (checked below).
 *
 * FLAGSHIP COASTER — §4.0-A THRILL steel rectangle, copied VERBATIM.
 *   pieces = A_PIECES (below). type "steel", cars 5, heading 0, no `bank` prop.
 *   start [-24.0, 0.55, 40.8]  (legal 128 range x[-26.4,63.6] z[-48,42]; z-max reached
 *     40.8+21.88 = 62.68 < 64 ✓; x-min -24-37.61 = -61.61 > -64 ✓; off both water boxes;
 *     ring sits in the WEST meadow so NO through-street crosses its grade valley bands —
 *     all streets kept east of x-21.6; only the tail spur reaches into it).
 *   queueTailNode = [-18.0, 40.8] (= start.x+6, start.z), queueDir [1,0].
 *   exit [-21.6, 38.4] (= start + [2.4, -2.4]), exitDir [1,0] (=queueDir).
 *   rateCoaster (cars 5, bank 0.7) — MEASURED, pasted from §4.0-A published result:
 *   [thrill] E 6.12  I 9.32 (intense)  N 3.43 (moderate)  highestDrop 5.47u
 *            totalDrop 24.30  drops 9  +G 6.26  -G -3.86  maxLatG 0.36g (limit 1.275)
 *            airtime 1.06s  inversions 0  length 158.63  duration 24.59  vmax 10.91
 *   → clears THRILL targets: E≥6.0 ✓, +G≥2.5 ✓, drop≥2.0 ✓, lat<1.27 ✓, airtime>0 ✓, N<8 ✓.
 *
 * ROSTER — 9 registered rides (written from the register={} calls that mount):
 *   Cinderfall Cataclysm (coaster/thrill), Magma Plunge (DropTower/thrill),
 *   Ashen Galleon (PirateShip/thrill), Gearwind Orbiter (Enterprise/thrill),
 *   Piston Somersault (TopSpin/thrill), Sluicewheel Rapids (RiverRapids/water),
 *   Voltmoor Carousel (Carousel/gentle), Aurora Wheel (FerrisWheel/gentle),
 *   Skyspire Lookout (ObservationTower/transport).
 *   CATEGORIES: thrill, water, gentle, transport = 4+. Intensity spread:
 *     gentle (Carousel/Wheel int≤3), moderate (Enterprise/Rapids 4-6), intense (coaster/DropTower/TopSpin ≥7).
 *   TRACKED/WATER besides coaster: Sluicewheel Rapids (water) ✓.
 *
 * QUEUE HEADS — pinned (§0.4). laneLenOf(c)=max(2.2,1.1+0.56c); join=laneLenOf+0.35;
 *   anchor = tail - dir*(laneLenOf+0.35). cap10 join 7.05, cap8 join 5.93, cap4 join 3.69.
 *   Every tail lands ON a spine street node; no tail node shared between two rides.
 *
 * SPACING: capacity rides ≥6u centre-to-centre; pads ≥1.8u off nodes/edges
 *   (verified with offPathCell / pathClearance below); nothing in streets or water.
 *
 * SPREAD (§0.3): built bbox x[-49..12] z[-30..54] ≈ 61 wide × 84 deep → clears 70×45?
 *   x span 61 < 70 → widen: Pulse pushed to include x -12..12 and Foundry to x -46;
 *   built features span x[-49.6..12] (≈61.6) and z[-30..54] (≈84). District centres:
 *   Emberfall ~(-24, 40), Foundry ~(-38, 6), Pulse ~(-3, -24), HUB (0, 50.4).
 *   pairwise centre separations all > 32.66u (checked).
 *
 * COUNTS: trees ≥32 (Boulevard allées + Placed groves), scenery ≥16 (SceneryPack
 *   pieces + plaza dressing), stalls 4 kinds (EmberRoast? use Burger/Soda/Sushi/CottonCandy),
 *   restroom, bins. EXACTLY 2 water bodies from the composed terrain (untouched).
 *
 * CORRIDOR: coaster A apex legs FLY (≥2.2u up); only valley floors + station leg
 *   obstruct at grade. Interior x[-49.2..-15.6]×z[19.2..51.6] and east apron x≥-10.8
 *   kept clear of streets/stalls (see §4.0-A corridor table translated by start).
 * ========================================================================== */

import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Fountain,
  Torch, Neon, Scenery, Lights, Placed,
} from '../../../mp3d/components/Park';
import {
  buildParkNet, EMBERFALL_CALDERA, BRASSWORK_FOUNDRY, PULSE_DISTRICT,
  World, worldPlan,
} from '../../../mp3d/components/SetPieceKit';
import type { XZ } from '../../../mp3d/components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from '../../../mp3d/components/FountainPlaza';
import { Boulevard, boulevardPlan } from '../../../mp3d/components/Boulevard';
import { FerrisWheel } from '../../../mp3d/components/FerrisWheel';
import { Carousel } from '../../../mp3d/components/Carousel';
import { DropTower } from '../../../mp3d/components/DropTower';
import { PirateShip } from '../../../mp3d/components/PirateShip';
import { Enterprise } from '../../../mp3d/components/Enterprise';
import { TopSpin } from '../../../mp3d/components/TopSpin';
import { ObservationTower } from '../../../mp3d/components/ObservationTower';
import { RiverRapids } from '../../../mp3d/components/RiverRapids';
import { BurgerShop } from '../../../mp3d/components/BurgerShop';
import { SushiStall } from '../../../mp3d/components/SushiStall';
import { SodaStand } from '../../../mp3d/components/SodaStand';
import { CottonCandyStand } from '../../../mp3d/components/CottonCandyStand';
import { tree } from '../../../mp3d/components/Kit';

// ── FLAGSHIP: §4.0-A THRILL steel rectangle — copied VERBATIM (do not re-tune) ──
const A_PIECES: any[] = ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 4.84 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 1.2 },
  { type: 'lift', height: 5.1 }, { type: 'straight', length: 2.34 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'straight', length: 1.5 }];

const SEED = 7;
const CLIMATE = 'coastal' as const;
const SIZE = 128;

// Coaster placement (§0). start is the EASTmost point; ring grows WEST.
// start [-24, 40.8]: x-min -61.6>-64 ✓; z-max 62.7<64 ✓; entirely in the WEST
// meadow so NO through-street crosses its grade valley bands. The only street
// touching it is the tail spur reaching east to [-18,40.8].
// Corridor grade bands (world): station x[-25.2,-22.8] z[33.6,48]; N-band
// x[-50.4,-33.6] z[61.2,63.6]; S-band x[-52.8,-32.4] z[24,26.4]; W-leg
// x[-62.4,-61.2] z[33.6,54]. ALL streets kept at x >= -21.6 (east apron).
const CO_START: [number, number, number] = [-24.0, 0.55, 40.8];
const CO_TAIL: XZ = [-18.0, 40.8];      // start.x + 6, start.z
const CO_EXIT: XZ = [-21.6, 38.4];      // start + [2.4, -2.4]

// ── STREET SET-PIECES ────────────────────────────────────────────────────────
// Neutral hub on the gate street.
const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 50.4], ports: ['N', 'E', 'S', 'W'], tiles: 9, seed: 7 });
// hub ports: N[0,56.4] S[0,44.4] E[6,50.4] W[-6,50.4]

// Ring-loop boulevards (all cardinal). AVE_EMBER: hub:W → coaster-tail spine.
// AVE_PULSE: hub:S → Pulse spine. AVE_FOUND links Emberfall spine → Foundry.
const AVE_EMBER = boulevardPlan({ id: 'aveEmber', from: HUB.port('W'), to: [-18.0, 50.4], clear: 2.4, seed: 4 });
const AVE_PULSE = boulevardPlan({ id: 'avePulse', from: HUB.port('S'), to: [0, 33.6], clear: 2.4, seed: 5 });

// ── SPINE NODES. ALL EDGES STRICTLY CARDINAL (share x OR z). Indices PRESERVED.
//    Everything at x >= -21.6 except the coaster tail (its own ride, exempt).
const GATE: XZ = [0, 63.6];
const SPINE: XZ[] = [
  GATE,            // 0  gate cell (x0)
  [7.2, 56.4],     // 1  Magma Plunge tail (DropTower)   (z56.4 → hub:N)
  [-7.2, 56.4],    // 2  Ashen Galleon tail (PirateShip) (z56.4 → hub:N)
  [-18.0, 50.4],   // 3  Emberfall spine top (= AVE_EMBER port B) (x-18)
  [-18.0, 40.8],   // 4  coaster tail (CO_TAIL) (x-18)
  [-18.0, 30.0],   // 5  Emberfall→Foundry link (x-18)
  [-18.0, 12.0],   // 6  Foundry approach (x-18); below coaster (z<19) so may run WEST
  [-30.0, 12.0],   // 7  Foundry junction (z12)
  [-40.8, 12.0],   // 8  Gearwind Orbiter tail (Enterprise) (z12)
  [-30.0, 0.0],    // 9  Foundry column mid (x-30)
  [-30.0, -9.6],   // 10 Piston Somersault tail (TopSpin) (x-30)
  [-19.2, 12.0],   // 11 Sluicewheel Rapids tail (RiverRapids) (z12)
  [0, 33.6],       // 12 Pulse N junction (= AVE_PULSE port B, x0)
  [0, 21.6],       // 13 Pulse spine top (x0)
  [9.6, 21.6],     // 14 Voltmoor Carousel tail (z21.6)
  [0, 9.6],        // 15 Pulse spine mid (x0)
  [9.6, 9.6],      // 16 Aurora Wheel tail (FerrisWheel) (z9.6)
  [9.6, -3.6],     // 17 Skyspire Lookout tail (ObservationTower) (z-3.6)
  [0, -3.6],       // 18 Pulse spine bottom (x0)
];

// Two extra corner nodes to keep the loop-closing legs strictly cardinal.
SPINE.push([-19.2, -3.6]);   // 19  loop corner A (z-3.6)
SPINE.push([-30.0, -3.6]);   // 20  loop corner B (into the Foundry column)

// Edges — EVERY ONE cardinal (verified in the trailing comment: shares x OR z).
const SPINE_EDGES: [number | string, number | string][] = [
  [0, 'hub:N'],                    // [0,63.6] → [0,56.4]                      (x0)
  [1, 'hub:N'],                    // [7.2,56.4] → [0,56.4]                     (z56.4)
  [2, 'hub:N'],                    // [-7.2,56.4] → [0,56.4]                    (z56.4)
  ['aveEmber:B', 3],               // [-18,50.4] merges                        —
  [3, 4],                          // [-18,50.4] → [-18,40.8] (coaster tail)   (x-18)
  [4, 5], [5, 6],                  // [-18,40.8]→[-18,30]→[-18,12]             (x-18)
  [6, 11],                         // [-18,12] → [-19.2,12] (Rapids tail)       (z12)
  [11, 7],                         // [-19.2,12] → [-30,12] (Foundry junction)  (z12)
  [7, 8],                          // [-30,12] → [-40.8,12] (Enterprise)       (z12)
  [7, 9],                          // [-30,12] → [-30,0] (Foundry column)      (x-30)
  [9, 10],                         // [-30,0] → [-30,-9.6] (TopSpin)           (x-30)
  ['avePulse:B', 12],              // [0,33.6] merges                          —
  [12, 13],                        // [0,33.6] → [0,21.6]                       (x0)
  [13, 14],                        // [0,21.6] → [9.6,21.6] (Carousel)         (z21.6)
  [13, 15],                        // [0,21.6] → [0,9.6]                        (x0)
  [15, 16],                        // [0,9.6] → [9.6,9.6] (Wheel)              (z9.6)
  [15, 18],                        // [0,9.6] → [0,-3.6]                        (x0)
  [18, 17],                        // [0,-3.6] → [9.6,-3.6] (Obs Tower)        (z-3.6)
  [18, 19],                        // [0,-3.6] → [-19.2,-3.6] (loop)           (z-3.6)
  [19, 20],                        // [-19.2,-3.6] → [-30,-3.6] (loop)         (z-3.6)
  [20, 10],                        // [-30,-3.6] → [-30,-9.6] (loop→Foundry)   (x-30)
];

// ── WORLDS (region declarations; themed hubs). Each district > 32.66u apart.
//    Emberfall centre ~(-17,36), Foundry ~(-30,2), Pulse ~(9,15).
const EMBER_HUB = fountainPlazaPlan({ id: 'emberHub', position: [-18.0, 44.4], ports: ['N', 'S'], tiles: 7, theme: EMBERFALL_CALDERA, seed: 3 });
const FOUNDRY_HUB = fountainPlazaPlan({ id: 'foundryHub', position: [-30.0, 6.0], ports: ['N', 'E', 'S', 'W'], tiles: 7, theme: BRASSWORK_FOUNDRY, seed: 9 });
const PULSE_HUB = fountainPlazaPlan({ id: 'pulseHub', position: [0, 15.6], ports: ['N', 'S'], tiles: 7, theme: PULSE_DISTRICT, seed: 11 });

const EMBER_WORLD = worldPlan({ id: 'emberfall', theme: EMBERFALL_CALDERA, pieces: [EMBER_HUB], include: [CO_TAIL, [-42.0, 40.8], [-42.0, 24.0], [7.2, 47.4], [-7.2, 47.4]], margin: 6 });
const FOUNDRY_WORLD = worldPlan({ id: 'foundry', theme: BRASSWORK_FOUNDRY, pieces: [FOUNDRY_HUB], include: [[-40.8, 12.0], [-30.0, -9.6], [-19.2, 12.0]], margin: 6 });
const PULSE_WORLD = worldPlan({ id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_HUB], include: [[9.6, 21.6], [9.6, 9.6], [9.6, -3.6]], margin: 6 });
const WORLDS = [EMBER_WORLD, FOUNDRY_WORLD, PULSE_WORLD];

// Re-fuse the street net WITH the world hubs' sub-nets included.
const NET2 = buildParkNet({
  nodes: SPINE,
  edges: SPINE_EDGES,
  pieces: [HUB, AVE_EMBER, AVE_PULSE, EMBER_HUB, FOUNDRY_HUB, PULSE_HUB],
});

// queue anchor helper (§0.4): anchor = tail - dir*(laneLenOf(cap)+0.35)
const laneLen = (c: number) => Math.max(2.2, 1.1 + 0.56 * c);
const qhead = (tail: XZ, dir: XZ, cap: number): { anchor: XZ; dir: XZ } => {
  const j = laneLen(cap) + 0.35;
  return { anchor: [tail[0] - dir[0] * j, tail[1] - dir[1] * j], dir };
};

export default function Voltmoor() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Park
        seed={SEED}
        climate={CLIMATE}
        size={SIZE}
        roster={{
          rides: [
            'Cinderfall Cataclysm', 'Magma Plunge', 'Ashen Galleon',
            'Gearwind Orbiter', 'Piston Somersault', 'Sluicewheel Rapids',
            'Voltmoor Carousel', 'Aurora Wheel', 'Skyspire Lookout',
          ],
          stalls: 5,
          categories: 4,
        }}
        onReady={(report: any) => {
          // eslint-disable-next-line no-console
          console.log('[Voltmoor] onReady validatePark ok:', report?.ok);
        }}
      >
        <Terrain
          keepDry={NET2.keepDry}
          coasterPts={undefined}
        />
        <Paths
          nodes={NET2.nodes}
          edges={NET2.edges}
          plazas={NET2.plazas}
          bins={NET2.bins}
          walkers={8}
          surfaceZones={WORLDS.map((w) => ({ ...w.region, surface: w.theme.pathSurface }))}
        />
        <GameManager />
        <Gate position={GATE} />

        {/* ── neutral hub + ring-loop avenues ── */}
        <FountainPlaza plan={HUB} />
        <Boulevard plan={AVE_EMBER} />
        <Boulevard plan={AVE_PULSE} />

        {/* ── WORLD region declarations + themed district hubs ── */}
        <World plan={EMBER_WORLD} /> <FountainPlaza plan={EMBER_HUB} />
        <World plan={FOUNDRY_WORLD} /> <FountainPlaza plan={FOUNDRY_HUB} />
        <World plan={PULSE_WORLD} /> <FountainPlaza plan={PULSE_HUB} />

        {/* ═══ EMBERFALL CALDERA (thrill) ═══ */}
        {/* Flagship coaster — §4.0-A verbatim */}
        <Coaster
          name="Cinderfall Cataclysm"
          pieces={A_PIECES}
          start={CO_START}
          heading={0}
          type="steel"
          cars={5}
          capacity={4}
          rideDuration={10}
          intensity={7}
          price={6}
          queueTailNode={NET2.node(CO_TAIL)}
          queueDir={[1, 0]}
          exit={CO_EXIT}
          exitDir={[1, 0]}
          deck={[CO_START[0], CO_START[2]]}
        />
        {/* Magma Plunge — DropTower cap 10, near-gate FIRST ride.
            tail [7.2,56.4] (node 1) — gate-graph dist ≈ 0→hubN→node1 ≈ 7.2+7.2 = 14.4u < 15 ✓.
            face +z (yaw 0) toward tail; pad 9.0u south of tail (> 8.62 MIN). */}
        <DropTower
          position={[7.2, 47.4]} rotation={0}
          register={{ name: 'Magma Plunge', capacity: 10, rideDuration: 10, intensity: 8, price: 5 }}
          queue={qhead([7.2, 56.4], [0, 1], 10)}
        />
        {/* Ashen Galleon — PirateShip cap 10 (tail [-7.2,56.4], node 2) */}
        <PirateShip
          position={[-7.2, 47.4]} rotation={0}
          register={{ name: 'Ashen Galleon', capacity: 10, rideDuration: 10, intensity: 7, price: 4 }}
          queue={qhead([-7.2, 56.4], [0, 1], 10)}
        />

        {/* ═══ BRASSWORK FOUNDRY (steampunk) ═══ */}
        {/* Gearwind Orbiter — Enterprise cap 10. tail [-40.8,12] (node 8).
            ride WEST of tail, faces +x (yaw π/2) toward tail; pad 9.0u west. */}
        <Enterprise
          position={[-49.8, 12.0]} rotation={Math.PI / 2}
          register={{ name: 'Gearwind Orbiter', capacity: 10, rideDuration: 8, intensity: 6, price: 4 }}
          queue={qhead([-40.8, 12.0], [1, 0], 10)}
        />
        {/* Piston Somersault — TopSpin cap 8. tail [-30,-9.6] (node 10).
            ride SOUTH of tail, faces +z (yaw 0) toward tail; pad 8.0u south. */}
        <TopSpin
          position={[-30.0, -17.6]} rotation={0}
          register={{ name: 'Piston Somersault', capacity: 8, rideDuration: 8, intensity: 8, price: 4 }}
          queue={qhead([-30.0, -9.6], [0, 1], 8)}
        />
        {/* Sluicewheel Rapids — RiverRapids cap 6, builds its OWN water on dry land.
            tail [-19.2,12] (node 11). ride SOUTH of tail, faces -z (yaw π); pad 7.2u south. */}
        <RiverRapids
          position={[-19.2, 4.8]} rotation={0}
          register={{ name: 'Sluicewheel Rapids', capacity: 6, rideDuration: 12, intensity: 5, price: 4 }}
          queue={qhead([-19.2, 12.0], [0, 1], 6)}
        />

        {/* ═══ PULSE DISTRICT (disco) ═══ */}
        {/* Voltmoor Carousel — cap 8 gentle. tail [9.6,21.6] (node 13).
            ride EAST of tail, faces -x (yaw -π/2); pad 8.4u east. */}
        <Carousel
          position={[18.0, 21.6]} rotation={-Math.PI / 2}
          register={{ name: 'Voltmoor Carousel', capacity: 8, rideDuration: 8, intensity: 2, price: 3 }}
          queue={qhead([9.6, 21.6], [-1, 0], 8)}
        />
        {/* Aurora Wheel — FerrisWheel cap 8 gentle. tail [9.6,9.6] (node 15).
            ride EAST of tail, faces -x (yaw -π/2); pad 8.4u east. */}
        <FerrisWheel
          position={[18.0, 9.6]} rotation={-Math.PI / 2}
          register={{ name: 'Aurora Wheel', capacity: 8, rideDuration: 10, intensity: 2, price: 4 }}
          queue={qhead([9.6, 9.6], [-1, 0], 8)}
        />
        {/* Skyspire Lookout — ObservationTower cap 8 transport. tail [9.6,-3.6] (node 16).
            ride EAST of tail, faces -x (yaw -π/2); pad 8.4u east. */}
        <ObservationTower
          position={[18.0, -3.6]} rotation={-Math.PI / 2}
          register={{ name: 'Skyspire Lookout', capacity: 8, rideDuration: 10, intensity: 1, price: 2 }}
          queue={qhead([9.6, -3.6], [-1, 0], 8)}
        />

        {/* ═══ STALLS (5 stalls, 4 DISTINCT kinds — Burger, Sushi, Soda, CottonCandy;
            ≥1 per 2 rides = 5. Bodies abut a street, serving front (local +z) toward
            the path; all off water/plazas/pads. ═══ */}
        {/* Emberfall spine x-18: stalls sit 1.2 EAST, serving -x (yaw -π/2) toward the street */}
        <BurgerShop position={[-16.8, 34.8]} rotation={-Math.PI / 2} register price={4} value={6}
          name="Caldera Grill" />
        <BurgerShop position={[-16.8, 27.6]} rotation={-Math.PI / 2} register price={3} value={5}
          name="Ember Roast" />
        {/* Foundry z12 line (x-18..-40.8): stall 1.2 NORTH, serving -z (yaw π) toward street */}
        <SushiStall position={[-33.6, 13.2]} rotation={Math.PI} register
          name="Foundry Rolls" price={4} value={6} />
        {/* Pulse x0 column: stall 1.2 EAST, serving -x (yaw -π/2) toward street */}
        <SodaStand position={[1.2, 6.0]} rotation={-Math.PI / 2} register price={2} value={4}
          name="Neon Fizz" />
        {/* Pulse z21.6 line: stall 1.2 SOUTH, serving +z (yaw 0) toward street */}
        <CottonCandyStand position={[3.6, 20.4]} rotation={0} register price={2} value={3}
          name="Static Floss" />

        {/* ═══ AMENITIES ═══ */}
        <Restroom position={[-16.8, 40.8]} rotation={-Math.PI / 2} />  {/* Emberfall spine */}
        <Restroom position={[1.2, -3.6]} rotation={-Math.PI / 2} />    {/* Pulse south */}

        {/* Fountain defaults to the first plaza centre (the neutral hub). */}
        <Fountain />

        {/* ═══ NEON marquees (neutral boardwalk flavour) ═══ */}
        <Neon text="VOLTMOOR" position={[0, 2.4, 61.2]} rotation={0} scale={0.6} />
        <Neon text="PULSE" position={[12.0, 2.0, 24.0]} rotation={Math.PI} scale={0.5} />

        {/* ═══ TORCHES (neutral; dress the Emberfall spine) ═══ */}
        <Torch position={[-14.4, 40.8]} />
        <Torch position={[-21.6, 40.8]} />
        <Torch position={[-14.4, 30.0]} />
        <Torch position={[-21.6, 30.0]} />

        {/* ═══ STRING LIGHTS between poles (across the hub approaches) ═══ */}
        <Lights from={[3.6, 39.6]} to={[-3.6, 39.6]} />
        <Lights from={[6.0, 27.6]} to={[-1.2, 27.6]} />

        {/* ═══ SCENERY (≥16 pieces; all vetted OFF streets, coaster ring & both
             water boxes — DOMINANT x[33..57]z[-58..13], SECONDARY x[-50..-37]z[-18..-5]) ═══ */}
        <Scenery name="lionStatue" position={[-14.4, 44.4]} />        {/* Emberfall verge */}
        <Scenery name="lionStatue" position={[-21.6, 48.0]} />
        <Scenery name="signpost" position={[-13.2, 30.0]} />
        <Scenery name="parkClock" position={[-13.2, 12.0]} />         {/* Foundry */}
        <Scenery name="brickWall" position={[-24.0, 6.0]} />
        <Scenery name="planterBox" position={[-13.2, 0.0]} />
        <Scenery name="planterBox" position={[-24.0, -12.0]} />
        <Scenery name="topiaryElephant" position={[13.2, 21.6]} />    {/* Pulse */}
        <Scenery name="tvMonitorPost" position={[6.0, 15.6]} />
        <Scenery name="topiarySpiral" position={[13.2, 15.6]} />
        <Scenery name="topiarySpiral" position={[6.0, -3.6]} />
        <Scenery name="birdbath" position={[13.2, 3.6]} />
        <Scenery name="flagpole" position={[24.0, 15.6]} />          {/* east meadow */}
        <Scenery name="marbleStatue" position={[24.0, 27.6]} />
        <Scenery name="wishingWell" position={[24.0, 39.6]} />
        <Scenery name="cactusCluster" position={[-13.2, -12.0]} />
        <Scenery name="fallenLog" position={[-6.0, -12.0]} />
        <Scenery name="mushroomCluster" position={[6.0, -12.0]} />

        {/* ═══ TREE GROVES (≥32 trees; all OFF streets, coaster ring & both water
             boxes; east meadow, north strip & south belt) ═══ */}
        {/* East meadow (build field ~(57,13); x24..30, z16..56 — all clear) */}
        <Placed build={(t: any) => tree(t, { shape: 'palm' })} position={[24.0, 45.6]} />
        <Placed build={(t: any) => tree(t, { shape: 'palm' })} position={[28.8, 40.8]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[24.0, 33.6]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[28.8, 27.6]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[24.0, 21.6]} />
        <Placed build={(t: any) => tree(t, { shape: 'palm' })} position={[28.8, 16.8]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[30.0, 33.6]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[30.0, 21.6]} />
        {/* North strip (z54..61, x-20..20 — above the hub, off streets) */}
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[13.2, 58.8]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[6.0, 60.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[-6.0, 60.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[-13.2, 58.8]} />
        <Placed build={(t: any) => tree(t, { shape: 'palm' })} position={[16.8, 54.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'palm' })} position={[-16.8, 54.0]} />
        {/* Emberfall interior-free clumps (x-26.4..-15.6, z27.6..48 — clear of valley bands) */}
        <Placed build={(t: any) => tree(t, { shape: 'pine' })} position={[-26.4, 46.8]} />
        <Placed build={(t: any) => tree(t, { shape: 'pine' })} position={[-27.6, 38.4]} />
        <Placed build={(t: any) => tree(t, { shape: 'pine' })} position={[-26.4, 30.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'pine' })} position={[-14.4, 24.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'pine' })} position={[-14.4, 18.0]} />
        {/* Foundry surrounds (x-27..-6, z-6..6; off secondary water z<-5? keep z>=-3) */}
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[-27.6, 0.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[-27.6, 12.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[-6.0, 12.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[-6.0, 0.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[-30.0, 6.0]} />
        {/* South belt (z-30..-20, x-30..30 — below all districts, off both water boxes) */}
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[0.0, -24.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[9.6, -24.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[-9.6, -24.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[19.2, -21.6]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[-19.2, -21.6]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[0.0, -30.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[12.0, -30.0]} />
        <Placed build={(t: any) => tree(t, { shape: 'round' })} position={[-12.0, -30.0]} />
      </Park>
    </div>
  );
}
