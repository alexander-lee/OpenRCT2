import React from "react";
import { Coaster, Gate, GameManager, Lights, Neon, Park, Paths, Placed, Restroom, Scenery, Terrain, Torch, offPathCell } from "./components/Park";
import { Bazaar, bazaarPlan } from "./components/Bazaar";
import { Boulevard, boulevardPlan } from "./components/Boulevard";
import { buildParkNet } from "./components/SetPieceKit";
import { FountainPlaza, fountainPlazaPlan } from "./components/FountainPlaza";
import { FerrisWheel } from "./components/FerrisWheel";
import { Teacups } from "./components/Teacups";
import { TwistRide } from "./components/TwistRide";
import { LogFlume } from "./components/LogFlume";
import { BurgerShop } from "./components/BurgerShop";
import { SodaStand } from "./components/SodaStand";
import { CottonCandyStand } from "./components/CottonCandyStand";
import { compileTrackPieces } from "./components/SplineRideKit";
import { tree } from "./components/Kit";

/**
 * SCORIA POINT — §0 PRE-FLIGHT (size 192, seed 83, temperate)
 *
 * LAND: Seed-table row 83 is temperate hollows (amp 2.62, λ59.4): the one
 * corner lake remains far south-east at centroid (63.0, -63.6), wet box
 * x[38..88] z[-91..-38], 5.5% water (inside temperate's 5–19% budget).
 * All paths, pads, stalls and planted streetscape stay north/west of it.
 *
 * BOUNDS: all authored world-space extents remain inside x,z ±96. The flagship
 * is the published §4.0-A steel rectangle translated rigidly by Δ(-40.8,+58.8):
 * start [-24,0.55,55.2], low corridor copied with the archetype. Its queue tail
 * is node 5 [-18,55.2], dir [1,0], head = [-21.69,55.2] using laneLenOf(4)=3.34
 * plus 0.35. Published exit translates to [-21.6,57.6], dir [1,0].
 *
 * REACH + DISTRICTS: gate [0,94.8]; the Teacups tail is hub:S [0,80.4], about
 * 10.8 graph units from the gate (Ferris tail node 1 is the second gate-side
 * attraction). Hub, Scoria Ridge, and the fairground span >82u x >45u and have
 * 40u+ district separation. Every tail is unique and every explicit queue head
 * is tail − dir·(laneLenOf(capacity)+0.35). Paths are buildParkNet set-pieces,
 * not a hand-authored lattice; pads are resolved through offPathCell(clear 1.8).
 *
 * §4.0-A pasted rateCoaster result (cars 5, bank 0.7): E 6.12, I 9.32,
 * N 3.43, highest drop 5.47u, maxLatG 0.36g, airtime 1.06s.
 * This is the THRILL flagship: drops and apex turns are the only thrill source.
 */

type XZ = [number, number];
type QueueDirection = [number, number];
const SIZE = 192;
const SEED = 83;

// Indices are load-bearing: Coaster queueTailNode={5} is the verified tail.
const SPINE_NODES: XZ[] = [[0, 94.8], [6.0, 91.2], [38.4, 86.4], [-27.6, 68.4], [-18.0, 68.4], [-18.0, 55.2], [0, 73.2], [38.4, 74.4], [0, 45.6], [0, 40.8], [50.4, 74.4], [-27.6, 45.6]];
const HUB = fountainPlazaPlan({
  id: "hub",
  title: "Cinder Gate Plaza",
  position: [0, 86.4],
  tiles: 9,
  ports: ["N", "S", "E", "W"],
  fountainScale: 0.62,
  seed: SEED
});
const MARKET = bazaarPlan({
  id: "market",
  title: "Ashmarket Row",
  position: [-20.4, 86.4],
  stalls: ["burger", "hotDog", "soda", "cottonCandy"],
  seed: SEED + 1
});
const FAIR = fountainPlazaPlan({
  id: "fair",
  title: "Ember Fairground",
  position: [43.2, 74.4],
  tiles: 7,
  ports: ["W", "E"],
  fountainScale: 0.5,
  seed: SEED + 2
});
const AVE_MARKET = boulevardPlan({
  id: "ave-market",
  from: HUB.port("W"),
  to: MARKET.port("E"),
  spacing: 3.6,
  seed: SEED + 3
});
const AVE_FAIR = boulevardPlan({
  id: "ave-fair",
  from: HUB.port("E"),
  to: SPINE_NODES[2],
  spacing: 4.8,
  seed: SEED + 4
});
const AVE_RIDGE = boulevardPlan({
  id: "ave-ridge",
  from: MARKET.port("W"),
  to: SPINE_NODES[3],
  spacing: 4.8,
  seed: SEED + 5
});
const PARK_NET = buildParkNet({
  nodes: SPINE_NODES,
  edges: [[0, "hub:N"], [1, "hub:E"], [2, 7], ["fair:E", 10], [3, 4], [4, 5], ["hub:S", 6], [6, 8], [8, 11], [11, 3], [8, 9]],
  pieces: [HUB, MARKET, FAIR, AVE_MARKET, AVE_FAIR, AVE_RIDGE],
  keepDry: [[14.4, 91.2], [-7.2, 80.4], [57.6, 74.4], [-4.8, 40.8], [-24, 55.2], [-21.6, 55.2], [-21.6, 57.6]]
});
const A_PIECES = ["station", {
  type: "lift",
  height: 5.5
}, {
  type: "straight",
  length: 4.84
}, {
  type: "turnR",
  angle: 90,
  radius: 2.5
}, {
  type: "drop",
  height: 5.5
}, {
  type: "hill",
  height: 1.2
}, {
  type: "lift",
  height: 5.1
}, {
  type: "straight",
  length: 2.34
}, {
  type: "turnR",
  angle: 90,
  radius: 2.5
}, {
  type: "drop",
  height: 5.1
}, {
  type: "hill",
  height: 0.6
}, {
  type: "hill",
  height: 0.6
}, {
  type: "lift",
  height: 5.1
}, {
  type: "turnR",
  angle: 90,
  radius: 2.5
}, {
  type: "drop",
  height: 5.1
}, {
  type: "hill",
  height: 0.6
}, {
  type: "hill",
  height: 0.6
}, {
  type: "lift",
  height: 5.1
}, {
  type: "turnR",
  angle: 90,
  radius: 2.5
}, {
  type: "drop",
  height: 5.1
}, {
  type: "straight",
  length: 1.5
}] as const;
const COASTER_START: [number, number, number] = [-24, 0.55, 55.2];
const COASTER_POINTS = compileTrackPieces(A_PIECES, {
  type: "steel",
  start: COASTER_START,
  heading: 0
}).points;
const FLUME_PIECES = ["station", {
  type: "lift",
  height: 1.2
}, {
  type: "turnL",
  angle: 90,
  radius: 2
}, {
  type: "turnL",
  angle: 90,
  radius: 2
}, {
  type: "drop",
  height: 1.2
}, {
  type: "turnR",
  angle: 90,
  radius: 2
}, {
  type: "turnR",
  angle: 90,
  radius: 2
}, {
  type: "straight",
  length: 1.1
}] as const;
function laneLength(capacity: number) {
  return Math.max(2.2, 1.1 + 0.56 * capacity);
}
function queueHead(tail: XZ, dir: QueueDirection, capacity: number): XZ {
  const reach = laneLength(capacity) + 0.35;
  return [tail[0] - dir[0] * reach, tail[1] - dir[1] * reach];
}
function clearCell(cell: XZ): XZ {
  return offPathCell(PARK_NET, cell, {
    clear: 1.8
  }) ?? cell;
}
const TREE_SPOTS: Array<{
  position: XZ;
  shape: "round" | "pine" | "willow";
}> = [[[-2.4, 94.8], "round"], [[2.4, 94.8], "round"], [[-9.6, 92.4], "round"], [[9.6, 92.4], "round"], [[-14.4, 91.2], "round"], [[19.2, 91.2], "round"], [[24.0, 91.2], "pine"], [[28.8, 91.2], "round"], [[-31.2, 91.2], "pine"], [[-36.0, 86.4], "pine"], [[-31.2, 81.6], "pine"], [[-31.2, 76.8], "round"], [[-31.2, 72.0], "pine"], [[-33.6, 63.6], "pine"], [[-33.6, 58.8], "round"], [[-33.6, 51.6], "pine"], [[-33.6, 43.2], "pine"], [[-21.6, 43.2], "pine"], [[-16.8, 43.2], "round"], [[-12.0, 43.2], "round"], [[7.2, 45.6], "willow"], [[12.0, 45.6], "round"], [[16.8, 45.6], "pine"], [[21.6, 45.6], "round"], [[26.4, 45.6], "pine"], [[31.2, 50.4], "round"], [[36.0, 55.2], "round"], [[40.8, 60.0], "pine"], [[48.0, 62.4], "round"], [[54.0, 64.8], "round"], [[60.0, 69.6], "pine"], [[62.4, 74.4], "round"], [[60.0, 79.2], "round"], [[55.2, 81.6], "pine"], [[50.4, 84.0], "round"], [[45.6, 86.4], "round"], [[36.0, 91.2], "pine"], [[31.2, 91.2], "round"], [[26.4, 81.6], "round"], [[21.6, 79.2], "pine"], [[16.8, 76.8], "round"], [[12.0, 74.4], "round"], [[7.2, 69.6], "pine"], [[-7.2, 69.6], "round"], [[-12.0, 64.8], "pine"], [[-16.8, 60.0], "round"], [[-21.6, 55.2], "pine"], [[-36.0, 48.0], "pine"]];
const SCENERY_SPOTS: Array<{
  name: string;
  position: XZ;
}> = [{
  name: "ironArchway",
  position: [-2.4, 93.6]
}, {
  name: "parkClock",
  position: [7.2, 88.8]
}, {
  name: "flagpole",
  position: [-7.2, 88.8]
}, {
  name: "planterBox",
  position: [10.8, 87.6]
}, {
  name: "planterBox",
  position: [-10.8, 87.6]
}, {
  name: "topiarySpiral",
  position: [-15.6, 81.6]
}, {
  name: "topiaryElephant",
  position: [-24.0, 81.6]
}, {
  name: "signpost",
  position: [-31.2, 78.0]
}, {
  name: "picnicTable",
  position: [-19.2, 76.8]
}, {
  name: "birdbath",
  position: [-12.0, 73.2]
}, {
  name: "marbleStatue",
  position: [34.8, 79.2]
}, {
  name: "lionStatue",
  position: [43.2, 80.4]
}, {
  name: "gazebo",
  position: [55.2, 81.6]
}, {
  name: "wishingWell",
  position: [57.6, 67.2]
}, {
  name: "tvMonitorPost",
  position: [52.8, 62.4]
}, {
  name: "picketFence",
  position: [48.0, 57.6]
}, {
  name: "brickWall",
  position: [38.4, 52.8]
}, {
  name: "fallenLog",
  position: [24.0, 48.0]
}, {
  name: "mushroomCluster",
  position: [16.8, 48.0]
}, {
  name: "picnicTable",
  position: [9.6, 50.4]
}, {
  name: "birdbath",
  position: [-9.6, 50.4]
}, {
  name: "topiarySpiral",
  position: [-14.4, 46.8]
}, {
  name: "signpost",
  position: [-19.2, 43.2]
}, {
  name: "planterBox",
  position: [-4.8, 83.2]
}, {
  name: "parkClock",
  position: [38.4, 82.8]
}, {
  name: "hotAirBalloon",
  position: [66.0, 72.0]
}];
export function App() {
  const ferrisPosition = clearCell([14.4, 91.2]);
  const cupsPosition = clearCell([-7.2, 80.4]);
  const twistPosition = clearCell([57.6, 74.4]);
  const flumePosition = clearCell([-4.8, 40.8]);
  return <main className="min-h-screen w-full bg-slate-950" aria-label="SCORIA POINT thrill park">
      <Park seed={SEED} climate="temperate" size={SIZE} guests={14} fullscreen quality="medium" fog={{
      near: 145,
      far: 330
    }} onReady={report => {
      // <Park> invokes validatePark as its final settle step before this callback.
      console.log("[SCORIA POINT] validatePark", report);
    }}>
        <Terrain keepDry={PARK_NET.keepDry} coasterPts={COASTER_POINTS} />
        <Paths nodes={PARK_NET.nodes} edges={PARK_NET.edges} plazas={PARK_NET.plazas} bins={PARK_NET.bins} walkers={8} />
        <GameManager guests={14} />
        <Gate />

        <FountainPlaza plan={HUB} />
        <Bazaar plan={MARKET} />
        <FountainPlaza plan={FAIR} />
        <Boulevard plan={AVE_MARKET} />
        <Boulevard plan={AVE_FAIR} />
        <Boulevard plan={AVE_RIDGE} />

        <Teacups position={cupsPosition} rotation={-Math.PI / 2} register={{
        name: "Sulfur Cups",
        capacity: 4,
        rideDuration: 8,
        intensity: 3,
        price: 3
      }} queue={{
        anchor: queueHead([0, 80.4], [1, 0], 4),
        dir: [1, 0]
      }} />
        <FerrisWheel position={ferrisPosition} rotation={Math.PI / 2} register={{
        name: "Cinder Wheel",
        capacity: 8,
        rideDuration: 10,
        intensity: 2,
        price: 3
      }} queue={{
        anchor: queueHead([6, 91.2], [-1, 0], 8),
        dir: [-1, 0]
      }} />
        <TwistRide position={twistPosition} rotation={Math.PI / 2} register={{
        name: "Scoria Twist",
        capacity: 4,
        rideDuration: 9,
        intensity: 5,
        price: 4
      }} queue={{
        anchor: queueHead([50.4, 74.4], [-1, 0], 4),
        dir: [-1, 0]
      }} />
        <LogFlume position={flumePosition} pieces={FLUME_PIECES} register={{
        name: "Cinderfall Flume",
        capacity: 4,
        rideDuration: 10,
        intensity: 5,
        price: 4
      }} queue={{
        anchor: queueHead([0, 40.8], [1, 0], 4),
        dir: [1, 0]
      }} />
        <Coaster name="Ashfall Ridge" pieces={A_PIECES} start={COASTER_START} heading={0} type="steel" cars={5} bank={0.7} capacity={4} rideDuration={10} intensity={7} price={5} queueTailNode={5} queueDir={[1, 0]} deck={[-24, 55.2]} />

        <BurgerShop position={[-14.4, 83.4]} rotation={Math.PI / 2} register={{
        name: "Cinder Grill",
        price: 3,
        value: 5
      }} />
        <SodaStand position={[19.2, 83.4]} rotation={-Math.PI / 2} register={{
        name: "Magma Fizz",
        price: 2,
        value: 4
      }} />
        <CottonCandyStand position={[54.0, 78.0]} rotation={Math.PI} register={{
        name: "Ashcloud Candy",
        price: 2,
        value: 3
      }} />
        <Restroom position={[24.0, 78.0]} rotation={Math.PI} />

        <Neon text="SCORIA POINT" position={[0, 2.4, 93.6]} rotation={Math.PI} scale={0.58} />
        <Neon text="EMBER FAIR" position={[43.2, 2.1, 81.6]} rotation={Math.PI} scale={0.5} />
        <Torch position={[-6.0, 92.4]} />
        <Torch position={[6.0, 92.4]} />
        <Torch position={[38.4, 86.4]} />
        <Torch position={[-27.6, 68.4]} />
        <Lights from={[-13.2, 86.4]} to={[-27.6, 86.4]} />
        <Lights from={[6.0, 86.4]} to={[38.4, 86.4]} />

        {TREE_SPOTS.map(({
        position,
        shape
      }, index) => <Placed key={`tree-${index}`} position={position} build={three => tree(three, {
        shape
      })} />)}
        {SCENERY_SPOTS.map(({
        name,
        position
      }, index) => <Scenery key={`scenery-${name}-${index}`} name={name} position={position} seed={SEED + index} />)}
      </Park>
    </main>;
}
