import React from 'react';
import { ScenePreview } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { buildPeep } from '../Guest';
import { Honeywitch, buildHeldCandyApple } from './index';

// THORNWICK GLADE's stall. Preview 0 is the LIVE SIM (guests really buy and
// walk off eating a candied apple — the same vignette the four catalog shops
// and EmberRoast ship); preview 1 is the 3D rig; previews 2-3 are the HELD
// APPLE close up against a real hand, front and profile, because the shared
// hold spot is sized for a fat burger and has floated a slim item three times
// in this project; preview 4 is the cottage after dark.
// Components never render a <Stage> — every preview wraps them in <ScenePreview>.

function HoneywitchDemo() {
  return (
    <ScenePreview
      distance={6.2}
      targetY={0.85}
      autoRotate={false}
      dress={(t, g, api) => {
        // frame the serving hatch with the path loop in the foreground; the
        // thatch ridge, the sign board and the chimney fill the top of the frame
        api.setCameraPose?.([0.4, 3.1, 6.2], [0, 0.8, 0.9]);
        const nodes: [number, number][] = [
          [-3, 1.6],
          [0, 1.6],
          [3, 1.6],
          [3, 4.2],
          [0, 4.2],
          [-3, 4.2],
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
        const paths = buildPathNetwork(t, net, { width: 1.0 });
        g.add(paths.group);
        const mgr = createGameManager(t, { net });
        g.add(mgr.group);
        // the <Honeywitch> child is the visual; ScenePreview skips its
        // registration hook, so the demo registers the sale itself. The anchor is
        // pushed +z so the serving front (anchor + 0.72·dir) lands at z 0.82 —
        // clear of the counter shelf's front lip (z 0.68) and the awning bar.
        // ...with the cottage's OWN held candied apple (StallConfig.heldItem),
        // exactly as <Honeywitch register> wires it inside a real <Park>.
        mgr.registerStall({ name: 'The Honeywitch', item: 'food', price: 4, value: 6, anchor: [0, 0, 0.1], dir: [0, 1], heldItem: buildHeldCandyApple });
        // ...and the cohort is spawned ALREADY PECKISH. A fresh RCT2
        // arrival is well fed — hunger spawns at 177-255 on the INVERTED 0-255
        // scale — and the counter refuses food above hunger 75 (RCT2's own
        // DecideAndBuyItem gate), which on the RCT2-faithful 512-tick needs
        // clock is ~163 sim-s of walking before anyone may buy at all: longer
        // than this whole vignette, so the cottage stood idle. The needs RATES are
        // correct and deliberately untouched; a STAGED vignette seeds the state
        // it exists to demonstrate. The band is wide on purpose — the hungriest
        // guests buy during the pre-warm and are already eating on frame 1, the
        // fed end of it crosses the seek threshold while the preview plays, so
        // fresh sales keep landing on screen.
        mgr.spawnGuests(8, undefined, { hunger: [4, 48] });
        // pre-warm (fixed 1/30 substeps, deterministic): 32 sim-s is enough for
        // the hungriest of the staged cohort to have bought and be eating on
        // frame 1, with the rest still working their way to the counter — the
        // sales then keep coming while the preview plays. (It used to be 78 s
        // to outwait the OLD hunger onset; the seeded cohort above replaces
        // that wait, and a shorter warm keeps live buying on screen.)
        const WARM = 32;
        let simT = 0;
        while (simT < WARM) {
          simT += 1 / 30;
          mgr.update(simT, 1 / 30);
        }
        // HARNESS PROBE (never called by the page, no visual cost): the live
        // stall roster + guest records, so a headless run can ASSERT this
        // vignette actually trades (sold > 0, items in hands) instead of
        // eyeballing a screenshot.
        g.userData.stallProbe = () => ({ simT, stalls: mgr.stalls(), guests: mgr.guests() });
        let last = 0;
        return (time) => {
          const target = WARM + time * 2;
          while (last < target) {
            last += 1 / 30;
            mgr.update(WARM + last, 1 / 30);
          }
        };
      }}
    >
      <Honeywitch />
    </ScenePreview>
  );
}

/** a static peep holding the apple at the EXACT transform GameManager uses, so
 *  the fit can be judged in a render instead of on paper. `holdSpot` in
 *  GameManager/guestFx.ts puts the anchor at arm-local (±0.03, −0.37, 0.15) on
 *  the arm pivot; the fist ball is at arm-local (0, −0.32, 0), r 0.05. */
const heldAppleRig = (t: typeof import('three'), g: import('three').Group, yaw: number) => {
  const peep = buildPeep(t, { shirt: 0x4e6b3a, expression: 'happy' });
  peep.group.rotation.y = yaw;
  const anchor = new t.Group();
  anchor.position.set(0.03, -0.37, 0.15);
  anchor.add(buildHeldCandyApple(t));
  peep.armR.add(anchor);
  g.add(peep.group);
  return peep;
};

const previews = {
  componentName: 'Honeywitch',
  importPath: 'components/Honeywitch',
  previews: [
    {
      name: 'Selling candied apples (live sim)',
      description:
        'A miniature deterministic GameManager on a small path loop with the cottage registered at the hatch front (anchor [0, 0, 0.1], serving front z 0.82), pre-warmed 78 sim-seconds so the crowd is already hungry and mid-loop on the first frame, then run at 2x. Peckish guests step off the path to the counter, buy (item "food", price 4, value 6 — good-value happiness), and stroll on EATING the shop’s OWN held item: a real CANDIED APPLE ON A STICK, threaded through the fist, lifting to the mouth on the eased bite-cycle arm overlay, until only a crumpled container is left to bin. That is StallConfig.heldItem doing its job — the park is not full of guests eating the same generic burger.',
      render: () => <HoneywitchDemo />,
    },
    {
      name: '3D rig',
      description:
        'THE HONEYWITCH: a crooked half-timbered cottage counter selling honey cakes and candied apples. NOTHING IS PLUMB — the whole shell sits in a group tipped 0.035 rad, the chimney leans the other way, the thatch ridge SAGS 0.055 in the middle, the courses are hashed and the shutters hang at their own angles, because a stall built square reads as a garden shed. The framing is real carpentry (sill, wall posts at four uneven bays, mid rail, head beam, and one brace per bay set alternately) over lime-washed cob, on a course of hashed rubble stone so the cottage is founded rather than placed. Six thatch courses per slope plus a ridge run with hazel PEGS pinning it and moss along the crown — roofs are what the park camera actually sees. The BUILDING SAYS WHAT IT SELLS: seven candied apples stood in a drilled oak block, five honey cakes on a board, a honey crock with a dipper trailing a real drip, a cut honeycomb frame — and, as the sign, one heroic candied apple on a painted board hung off an iron scroll bracket. Above all of it, seated in the thatch ridge on its own stick, a GIANT CANDIED APPLE at 0.60 R — 1.20 wide, 6.8x the board apple — because the board apple is one red pixel from the park camera and the two stalls that never have that problem (BurgerShop, CottonCandyStand) are legible for one reason: the shop IS the item. Beside it the TOFFEE CAULDRON is doing a job: an iron pot on a tripod over a low fire, half full of molten toffee, with two freshly-dipped apples hung upside-down on a rack over it to set. Dressing: a coiled-straw bee skep on a stone, a besom, a crate of UNDIPPED green apples (the contrast is what tells you the red ones have been dipped), herb bundles hung upside-down off the eave, and moss + toadstools planting it in the glade. The palette is entirely THORNWICK (from WyrmsHollow) and GLADE (from ThornwickScenery) — no invented browns.',
      render: () => (
        // FRAMED FOR THE HERO APPLE. At distance 4.8 / targetY 0.8 the giant
        // candied apple on the ridge (top y 2.58) was cropped off the canvas,
        // which is now the loudest thing the stall owns.
        <ScenePreview distance={6.6} targetY={1.3} autoRotate={false} ground height={480}>
          <Honeywitch withGuest />
        </ScenePreview>
      ),
    },
    {
      name: 'The held apple — against the hand',
      description:
        'THE FLOSS-CONE LESSON, THIRD TIME. The shared hand hold spot (GameManager guestFx `holdSpot`) puts the item anchor at arm-local (±0.03, −0.37, 0.15) — 0.15 FORWARD of the fist ball and 0.05 below it — because it was tuned for a FAT BURGER. A slim item left near its own origin therefore floats a clear 0.1 in front of the hand, which happened to CottonCandyStand’s floss cone, to EmberRoast’s skewer and to SushiStall’s tray before each of them carried its own self-offset. So this recipe pulls itself BACK onto the fist and tips forward with the solved numbers position (0, 0.03, −0.15) and rotation.x **0.6**: the z offset cancels the anchor’s forward push so the fist centre lands on the item group’s own y axis, and with that the 0.34 stick passes STRAIGHT THROUGH THE FIST at any tilt — what the 0.6 buys instead is SHAFT CLEAR OF THE SLEEVE, since the arm box is 0.11 deep and at EmberRoast’s 0.4 only 0.03 of stick showed before the fruit began. Probed in the arm-local frame, not eyeballed (`hw-hand.mjs`): the stick axis passes **0.0321** from the fist-ball centre (inside its 0.05 radius), **0.0244** of BARE HANDLE pokes out below the ball, the apple’s underside rides **0.0599** clear above the top of the grip, and at full bite lift (arm rotation.x −2.2) the fruit sits **0.2378** from the head centre against the 0.188 the skull plus the apple needs. The apple is r 0.062, a little smaller than the head (r 0.12), which is what a toffee apple looks like in a hand and what reads at park zoom. This preview builds a peep at the EXACT GameManager transform so the fit is judged in a render, not on paper.',
      render: () => (
        <ScenePreview
          distance={1.15}
          targetY={0.78}
          autoRotate={false}
          ground
          height={460}
          dress={(t, g, api) => {
            api.setCameraPose?.([0.62, 0.72, 0.66], [0.21, 0.65, 0.03]);
            heldAppleRig(t, g, 0);
            return undefined;
          }}
        />
      ),
    },
    {
      name: 'The held apple — profile',
      description:
        'The same rig from the side, which is the view that catches a floating item: the stick has to cross the fist BALL, not pass in front of it, and the fruit has to clear the forearm on the way up. Here the bare handle shows below the closed hand, the stick disappears into the grip, and the apple stands clear of both the sleeve and (at full bite lift) the hair. Nothing about this is guessed — it is the same arithmetic EmberRoast solved for its skewer, checked against a real hand at close range.',
      render: () => (
        <ScenePreview
          distance={1.15}
          targetY={0.78}
          autoRotate={false}
          ground
          height={460}
          dress={(t, g, api) => {
            api.setCameraPose?.([0.95, 0.6, 0.38], [0.2, 0.6, 0.03]);
            heldAppleRig(t, g, 0);
            return undefined;
          }}
        />
      ),
    },
    {
      name: 'The cottage after dark',
      description:
        'TWO KINDS OF GLOW, deliberately different. The EAVE LANTERN is a real lamp and gates HARD to dark by day — a lantern with no flame in it is just a glass ball — so the difference between the day and night shots is that it comes on, and its PointLight is a child of the fitting so it follows any placement. The TOFFEE in the cauldron is hot sugar over a fire, which is NOT a lamp: following EmberfallScenery’s rule (already applied across this world to glow-worms, lit toadstool caps, carved runes and flower pods) its emissive only LERPS between a day and a night value and its PointLight keeps a real daylight floor of 0.3, so the pot is visibly hot at noon as well. The embers under it glow at 0.8 of the toffee, and the whole lot shimmers on an absolute-time term. Two PointLights and 30 smoke particles is the entire budget.',
      render: () => (
        <ScenePreview distance={4.8} targetY={0.8} autoRotate={false} ground night height={480}>
          <Honeywitch withGuest />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
