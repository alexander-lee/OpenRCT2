import React from 'react';
import * as THREE from 'three';
import { ScenePreview } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { buildRideEntrance } from '../RideEntrance';
import { HauntedMansion, buildHauntedMansionScene } from './index';

// Six previews. 0 is the LIVE SIM (real guests queue at the hut, vanish INSIDE
// the ground-floor room for the walkthrough, and come back out of the exit
// hut); 1 is the rig; 2 is the NIGHT HERO; 3 is the porch/facade close up; 4 is
// the roofline and tower; 5 is the park camera with the two access huts
// standing beside the house, which is the shot that proves the mansion still
// reads as the bigger thing. Components never render a <Stage> — every preview
// wraps them in <ScenePreview>.

/** the queue HEAD the chassis derives for this footprint: the built visual's
 *  +z extent (2.95) + 1.27, so the entrance hut's near side clears the
 *  railing by 0.15. Hard-coded here because the previews stage the access
 *  themselves; `registerComposedRide` computes the same number in a park. */
const FRONT = 4.22;

function MansionSim() {
  return (
    <ScenePreview
      distance={13}
      targetY={2.6}
      autoRotate={false}
      height={520}
      dress={(t, g, api) => {
        api.setCameraPose?.([7.0, 7.6, 13.2], [-0.5, 2.4, 2.1]);
        // The mansion is built IMPERATIVELY here rather than mounted as the
        // <HauntedMansion> child, because this vignette needs the built
        // result's own `seatWorld` — the six interior tour anchors — to hand
        // to registerRide. That is the whole point of the shot: the riders
        // have to end up in the real room, not in a default ring.
        const built = buildHauntedMansionScene(t);
        g.add(built.group);
        const nodes: [number, number][] = [
          [-5.4, 6.4],
          [0, 6.4],
          [5.4, 6.4],
          [5.4, 9.6],
          [0, 9.6],
          [-5.4, 9.6],
        ];
        const edges: [number, number][] = [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 4],
          [4, 5],
          [5, 0],
          [1, 4],
        ];
        const net = { nodes, edges };
        g.add(buildPathNetwork(t, net, { width: 1.1 }).group);
        const mgr = createGameManager(t, { net });
        g.add(mgr.group);
        // registerRide builds the queue lane and BOTH huts itself, at the RCT2
        // layout: entrance at the head minus 0.62, exit one tile (1.2) along
        // the same face, both doorways facing the same way out.
        mgr.registerRide({
          name: 'Haunted Mansion',
          capacity: 6,
          rideDuration: 12,
          intensity: 4,
          price: 4,
          queueAnchor: [0, 0, FRONT],
          queueDir: [0, 1],
          boardPoint: [0, 0.25, 0],
          exitPoint: [-1.2, 0, FRONT - 0.62],
          exitDir: [0, 1],
          seatWorld: built.seatWorld,
        });
        mgr.spawnGuests(18);
        // deterministic pre-warm (fixed 1/30 substeps): 96 sim-seconds is
        // enough for a queue to have formed, a full house of six to be inside
        // and a first party to be walking away on frame 1.
        const WARM = 96;
        let simT = 0;
        while (simT < WARM) {
          simT += 1 / 30;
          mgr.update(simT, 1 / 30);
        }
        // HARNESS PROBE (never called by the page, no visual cost): the live
        // ride roster + guest records, so a headless run can ASSERT that this
        // walkthrough really loads and really hides its riders.
        g.userData.rideProbe = () => ({ simT, rides: mgr.rides(), guests: mgr.guests() });
        let last = 0;
        return (time) => {
          built.update?.(time);
          const target = WARM + time * 2;
          while (last < target) {
            last += 1 / 30;
            mgr.update(WARM + last, 1 / 30);
          }
        };
      }}
    />
  );
}

/** the two access huts, standalone, at the cells the chassis derives */
function dressHuts(t: typeof THREE, g: THREE.Group) {
  const ent = buildRideEntrance(t, { kind: 'entrance' });
  ent.group.position.set(0, 0, FRONT - 0.62);
  g.add(ent.group);
  const ex = buildRideEntrance(t, { kind: 'exit' });
  ex.group.position.set(-1.2, 0, FRONT - 0.62);
  g.add(ex.group);
}

const previews = {
  componentName: 'HauntedMansion',
  importPath: 'components/HauntedMansion',
  previews: [
    {
      name: 'Open for tours (live sim)',
      description:
        'A miniature deterministic GameManager on a street loop, with the mansion registered as the WALKTHROUGH it is: capacity 6, a 12 s tour, and the component’s own `seatWorld` — the six interior tour anchors — handed straight to `registerRide`. Guests queue up the lane, are swallowed by the entrance hut, and then spend the ride INSIDE THE GROUND-FLOOR ROOM (a real hollow shell: four brick walls, a boarded floor and a ceiling), which is why nobody is visible on the ride and everybody reappears out of the exit hut one tile along the same face. Pre-warmed 96 sim-seconds so the first frame already has a queue, a full house and a party walking away. Probed rather than eyeballed (`aud-hm.mjs sim`, 300 deterministic sim-seconds): 6 simultaneous riders max, **exactly 6 distinct anchors occupied**, **0 visible rider-frames outside the room**, worst rider distance from an anchor 0.0000, 13 of 14 guests rode and resumed walking, worst still-while-`walking` 2.43 s against the 25 s gate.',
      render: () => <MansionSim />,
    },
    {
      name: '3D rig',
      description:
        'A CROOKED THREE-TIER BRICK MANSION, built as architecture rather than as blocks. Nothing is plumb: the middle storey leans −0.021 rad, the clock tower kinks +0.036 back against it, three chimneys lean their own ways, every roof course SAGS toward mid-span on a hashed ripple and a few railing pickets are simply gone. Ground floor: a stone plinth and water table, quoined corners, a belt string course, a moulded three-member cornice on modillion brackets, a canted three-light BAY WINDOW under a lead cap and stone balustrade, a panelled double door with a lit radiating FANLIGHT, and a full porch — four turned posts on plinth blocks with scroll brackets, sprung deck boards, a turned balustrade and a scalloped PORTICO pediment over cracked stone steps. Above it a hipped roof laid as real shingle COURSES with lead hip rolls, a fascia, a gutter that has come away at one end, and three gabled dormers. The front CROSS-GABLE carries a rose window over an arched light and a corbelled balcony on rusted rail; the tower carries a stone-ringed CLOCK with moving hands, arched belfry lights, a widow’s walk with fleur cresting and a bat WEATHERVANE that swings. Decay throughout: ivy clumps up the masonry, missing bricks, cracks stepping off two window heads, boarded and smashed windows, shutters hanging off their bottom pintles, cobwebs in the eaves, gravestones, two dead trees and a leaning rusted railing with its gate swung open.',
      render: () => (
        <ScenePreview distance={12.5} targetY={3.0} height={520}>
          <HauntedMansion />
        </ScenePreview>
      ),
    },
    {
      name: 'After dark (night hero)',
      description:
        'NIGHT IS THE POINT OF THIS BUILDING. Twenty-eight separate emissive glazings gutter on their own speeds and phases under one slow shared "draught" term, so the house breathes instead of strobing: the fanlight over the door, the bay, the rose window in the gable, the arched belfry lights, the dormers, the clock face. Only FOUR real PointLights do any lighting work — the porch lantern in its iron cage, a green facade uplight, a warm SPILL light outside the bay so the light lands on the ground it comes from, and a high cold moon wash off the back-left that rims the roof. Everything else is emissive, including the MOONLIGHT RIM: the slate, brick, ironwork and dead wood all take a faint blue self-lift after dark so the silhouette stays readable rather than collapsing into the sky. The chimney smoke lerps to a sickly green (it is being lit from below) and the ground mist goes with it.',
      render: () => (
        <ScenePreview
          distance={12.5}
          targetY={3.0}
          night
          autoRotate={false}
          height={520}
          dress={(t, g, api) => {
            api.setCameraPose?.([6.8, 5.4, 10.2], [0, 2.8, 0.2]);
            return undefined;
          }}
        >
          <HauntedMansion />
        </ScenePreview>
      ),
    },
    {
      name: 'The porch and facade, close',
      description:
        'The detail the park camera only hints at. Four TURNED posts (plinth block, iron collar, shaft, neck, capital), each with a pair of scroll brackets into the beam; deck boards laid front-to-back with hashed gaps and two of them sprung; a turned balustrade broken by the step opening; a scalloped portico pediment on its own shingled slopes under a finial. Beside it the door case — moulded jambs, entablature, cornice hood and a half-round fanlight of radiating bars that is LIT — and the canted bay with its stone sills, label moulds and label stops. Then the decay that makes it a haunted house rather than a nice house: a shutter hanging off its bottom pintle, boards nailed across the next window, cracks stepping down off two window heads, missing bricks, ivy clumping up the left return and cobwebs slung in the porch corners.',
      render: () => (
        <ScenePreview
          distance={5.4}
          targetY={1.05}
          autoRotate={false}
          height={520}
          dress={(t, g, api) => {
            // a three-quarter view from OUTSIDE the railing on the porch side:
            // door case, porch, bay and the left return all in one frame. A
            // tighter head-on pose put the two gate piers across the steps and
            // the porch read as a dark box behind them.
            api.setCameraPose?.([-3.9, 2.0, 5.0], [-0.35, 1.0, 1.35]);
            return undefined;
          }}
        >
          <HauntedMansion />
        </ScenePreview>
      ),
    },
    {
      name: 'The roofline and tower',
      description:
        'Everything above the cornice. Every slope on this building is laid as overlapping shingle COURSES — nine on the main hip, seven on the middle storey, nine on the tower cap, four per dormer — each lapped over the head of the one below, sagged toward mid-span and rippled on a hash, with lead hip rolls capping the four arrises and lead flashings where the three chimneys pass through. Above that the front cross-gable with its scalloped bargeboards, pendant drop, apex ball and rose window; the clock tower with quoins on all four corners and a stone-ringed face whose minute hand JERKS as it catches; a widow’s walk of rusted balusters and fleur cresting; and the finial carrying a bat weathervane that swings on a slow deterministic sine. Four bats circle the tower with real flapping wings.',
      render: () => (
        <ScenePreview
          distance={8}
          targetY={4.6}
          autoRotate={false}
          height={520}
          dress={(t, g, api) => {
            api.setCameraPose?.([4.9, 7.8, 6.2], [0, 4.4, -0.1]);
            return undefined;
          }}
        >
          <HauntedMansion />
        </ScenePreview>
      ),
    },
    {
      name: 'The park camera (50°), with its huts',
      description:
        'The angle a park actually uses, with the entrance and exit huts standing at the cells the chassis derives (head at +z 4.22, hut at head − 0.62, exit one tile beside it). The huts were rebuilt small and symmetrical with the sign on the building; at 1.2 u tall against the mansion’s 6.8 they read as gatehouses, which is exactly the relationship a haunted-house attraction wants. From up here the piece has to survive on massing and value: the wide hipped roof and its dormers, the cross-gable breaking the front, the tower on top, and dark roof against pale stone dressings that never collapses to the value of the grass.',
      render: () => (
        <ScenePreview
          distance={14}
          targetY={2.6}
          autoRotate={false}
          height={520}
          dress={(t, g, api) => {
            api.setCameraPose?.([7.4, 10.6, 8.8], [0, 2.2, 0.8]);
            dressHuts(t, g);
            return undefined;
          }}
        >
          <HauntedMansion />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
