import React from 'react';
import * as THREE from 'three';
import { ScenePreview } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { NeonSlush, buildHeldSlush } from './index';

// The slush bar sells REAL cups through the GameManager consumable flow (the
// same live-sim vignette as the four catalog shops, EmberRoast and SushiStall):
// a ScenePreview `dress` hook runs a miniature deterministic sim — a small path
// loop with the stall registered at the counter front — at 2x time, PRE-WARMED so
// guests are already thirsty and mid-loop on the first frame. Thirsty guests step
// off the path to the counter, buy (item 'drink', price 3, value 5 — good-value
// happiness), then stroll on SIPPING: the bar's OWN held cup, a tall lidded cup
// of glowing slush with a straw, threaded into the fist.
function NeonSlushDemo({ night = false }: { night?: boolean }) {
  return (
    <ScenePreview
      distance={6.2}
      targetY={0.95}
      autoRotate={false}
      night={night}
      height={480}
      dress={(t, g, api) => {
        api.setCameraPose?.([0, 3.1, 6.4], [0, 0.8, 0.9]);
        const nodes: [number, number][] = [
          [-3, 1.6], [0, 1.6], [3, 1.6], [3, 4.2], [0, 4.2], [-3, 4.2],
        ];
        const edges: [number, number][] = [
          [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4],
        ];
        const net = { nodes, edges };
        const paths = buildPathNetwork(t, net, { width: 1.0 });
        g.add(paths.group);
        const mgr = createGameManager(t, { net });
        g.add(mgr.group);
        // the <NeonSlush> child is the visual; ScenePreview skips its
        // registration hook, so the demo registers the sale itself. The anchor is
        // pushed +z so the serving front (anchor + 0.72·dir) lands at z 0.87 —
        // clear of the counter nosing (z 0.47), the gantry posts (z 0.40) and the
        // rubber floor mat (z 0.79). ...with the bar's OWN held cup
        // (StallConfig.heldItem), exactly as <NeonSlush register> wires it inside
        // a real <Park>.
        mgr.registerStall({ name: 'Neon Slush', item: 'drink', price: 3, value: 5, anchor: [0, 0, 0.15], dir: [0, 1], heldItem: buildHeldSlush });
        // ...and the cohort is spawned ALREADY THIRSTY. A fresh RCT2
        // arrival is watered — thirst spawns at 177-255 on the INVERTED 0-255
        // scale — and the counter refuses a drink above thirst 75 (RCT2's own
        // DecideAndBuyItem gate), which on the RCT2-faithful 512-tick needs
        // clock is ~163 sim-s of walking before anyone may buy at all: longer
        // than this whole vignette, so the counter stood idle. The needs RATES are
        // correct and deliberately untouched; a STAGED vignette seeds the state
        // it exists to demonstrate. The band is wide on purpose — the driest
        // guests buy during the pre-warm and are already sipping on frame 1, the
        // watered end of it crosses the seek threshold while the preview plays,
        // so fresh sales keep landing on screen.
        mgr.spawnGuests(8, undefined, { thirst: [4, 48] });
        // pre-warm (fixed 1/30 substeps, deterministic): 32 sim-s is enough for
        // the thirstiest of the staged cohort to have bought and be sipping on
        // frame 1, with the rest still working their way to the counter — the
        // sales then keep coming while the preview plays. (It used to be 78 s
        // to outwait the OLD thirst onset; the seeded cohort above replaces
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
          const dt = Math.min(Math.max(time - last, 0), 0.1);
          last = time;
          let step = dt * 2;
          while (step > 0) {
            const h = Math.min(step, 1 / 30);
            simT += h;
            mgr.update(simT, h);
            step -= h;
          }
          paths.update?.(time);
        };
      }}
    >
      <NeonSlush />
    </ScenePreview>
  );
}

// ---------------------------------------------------------------------------
// THE HELD-CUP CLOSE-UP — the preview that exists because held items have bitten
// this project twice. Three guests hold the real `buildHeldSlush` mesh at the
// GameManager's EXACT drink attach transform (arm-local (0.03, −0.37, 0.115) on
// the right arm pivot, the whole peep at GUEST_SCALE 0.5), so what you see here
// is byte-identical to what a buyer carries in a park: front, profile, and at
// full sip lift with the straw at the mouth.
// ---------------------------------------------------------------------------
function cupHolder(t: typeof THREE, idx: number, lift: number, yaw: number): THREE.Group {
  // deliberately COOL shirts: the first cut hashed one out of SHIRTS and landed a
  // magenta one, which made the magenta cup vanish into the guest's chest
  const SHIRT = [0x1f5f8a, 0x2f6a63, 0x3a4a6e][idx % 3];
  const p = buildPeep(t, {
    skin: SKIN_TONES[idx % SKIN_TONES.length],
    shirt: SHIRT,
    expression: 'happy',
    female: idx === 1,
  });
  p.group.scale.setScalar(0.5);
  p.group.rotation.y = yaw;
  // GameManager's drink hold spot, verbatim (guestFx.ts `holdSpot`)
  const hold = new t.Group();
  hold.position.set(0.03, -0.37, 0.115);
  hold.add(buildHeldSlush(t));
  p.armR.add(hold);
  // the manager's carry bend (≤ −0.45 rad) eased toward the drink sip lift
  // (−2.0) plus the inward shoulder tilt that crosses the cup to the mouth
  p.armR.rotation.x = -0.45 + (-2.0 + 0.45) * lift;
  p.armR.rotation.z = -0.4 * lift;
  p.armL.rotation.x = -0.22;
  if (lift > 0.6) p.head.rotation.x = -0.22; // head tips back for the swig
  return p.group;
}

function HeldCupCloseUp() {
  return (
    <ScenePreview
      distance={1.35}
      targetY={0.33}
      autoRotate={false}
      ground
      height={520}
      dress={(t, g) => {
        // the line-up lives in a group yawed 45° so its local x-axis maps onto
        // the Stage's fixed 45°-azimuth camera screen-x (the RideEntrance trick)
        const row = new t.Group();
        row.rotation.y = Math.PI / 4;
        g.add(row);
        // in the row's local frame the camera looks down −z, so yaw 0 faces the
        // camera and yaw +π/2 turns the guest's RIGHT side (the cup hand) to it
        ([
          [-0.42, 0, 0], // front on, at the carry bend
          [0.02, 0, Math.PI / 2], // PROFILE — the view that catches a floating item
          [0.46, 1, Math.PI / 2], // full sip lift, also in profile (face + straw)
        ] as [number, number, number][]).forEach(([x, lift, yaw], i) => {
          const holder = cupHolder(t, i, lift, yaw);
          holder.position.set(x, 0, 0);
          row.add(holder);
        });
      }}
    />
  );
}

/** the FIST DETAIL: one guest, one cup, close enough to see the fingers on the
 *  wall. This is the frame that decides whether a held item ships. */
function FistDetail() {
  return (
    <ScenePreview
      distance={0.62}
      targetY={0.31}
      autoRotate={false}
      ground
      height={520}
      dress={(t, g) => {
        const row = new t.Group();
        row.rotation.y = Math.PI / 4;
        g.add(row);
        const holder = cupHolder(t, 0, 0, Math.PI / 2);
        holder.position.set(-0.02, 0, 0);
        row.add(holder);
      }}
    />
  );
}

const previews = {
  componentName: 'NeonSlush',
  importPath: 'components/NeonSlush',
  previews: [
    {
      name: 'Selling slush (live sim)',
      description:
        "Neon Slush as a working composableStall: the glowing slushie bar registered with a miniature GameManager sim (item 'drink', price 3, value 5). Thirsty guests on the path loop walk up to the serving front (local +z, 0.72 out from the counter), buy, and stroll off SIPPING — the bar's OWN held cup, a tall lidded cup of glowing slush with a straw threaded into the fist, lifts to the mouth on the eased sip-cycle arm overlay with the head tipping back, until only a crumpled container is left to bin (RCT2 DecideAndBuyItem, Guest.cpp:1529). The three slush machines' augers keep turning and the bowls throb on the district's 2.2 Hz beat — and so do the cups the guests are carrying, because the manager clones ONE prototype per stall and clones share materials, so the stall's updater lights every slushie in the park in one write. Pre-warmed + 2x time so buying and sipping both show in one viewing. Deterministic.",
      render: () => <NeonSlushDemo />,
    },
    {
      name: 'The held cup, close up',
      description:
        "THE PREVIEW THAT EXISTS BECAUSE HELD ITEMS HAVE BITTEN THIS PROJECT TWICE. Three guests at GUEST_SCALE 0.5 holding the real `buildHeldSlush` mesh at the GameManager's EXACT drink attach transform — arm-local (0.03, −0.37, 0.115) on the right arm pivot, which is 0.05 BELOW the fist centre and 0.115 IN FRONT of it, because the shared hold spot is sized for a fat burger. Left: front, at the manager's carry bend (−0.45 rad). Centre: the same carry in PROFILE, which is the view that catches a floating item. Right: at full sip lift (−2.0 rad + the inward shoulder tilt), straw at the mouth, head tipped back. The cup's own self-offset (−0.01, −0.069, −0.107) with a 0.5 rad forward tip is what threads it INTO the fist — the axis lands at arm-local z 0.07 at the grip height, inside the 0.05-radius fist ball so the fingers wrap the wall, with 0.069 of the base hanging below the hand like a real carried drink, and the tip swinging the rim and the domed lid clear of the forearm box (arm-local z ±0.055 over the arm's whole length — a plumb-vertical cup this tall CANNOT clear it, which is why the tilt is structural and not styling, and why the lid is not optional: an open cup carried at 29° is spilling). The straw counter-tilts −0.38 inside the cup frame so it stands plumb in the world and clears the hair at full lift.",
      render: () => <HeldCupCloseUp />,
    },
    {
      name: 'The fist, in detail',
      description:
        "One guest, one cup, close enough to count the fingers. The FIST BALL (skin, radius 0.05, centred at arm-local (0, −0.32, 0)) sits at roughly 70 % up the cup's 0.185 body, with the printed label band under it and the base ring clear below — a real carried drink, not an object hovering ahead of a hand. The cup wall at the grip height passes through arm-local z 0.023-0.117, i.e. it PENETRATES the fist ball, which is exactly what a grip looks like on a rig with no articulated fingers. The 0.5 rad forward tip then carries the rolled lip and the domed lid out past arm-local z 0.096, clear of the forearm box's 0.055 front face — the whole reason the tilt exists.",
      render: () => <FistDetail />,
    },
    {
      name: '3D rig',
      description:
        "Neon Slush: a black-gloss club-front counter on a concrete plinth with a chrome kick rail, recessed front panels (a big `gloss` face reads as a void — the PulseScenery speaker-stack lesson), a chrome-nosed deck top and a beat-pulsed neon trim along the serving lip. On the top, the three real SLUSH MACHINES that are the whole identity of the piece: chrome drip trays, gloss base housings with flavour plates and chrome spigots and levers, transparent polycarbonate bowls holding luminous magenta / cyan / violet slush mounded above the fill line, and a chrome AUGER on a shaft turning inside each one — the one part that says 'slush machine' rather than 'jar of jam'. Over it a front gantry carries a neon FASCIA whose LED bars chase three-to-the-bar and a chrome-framed SLUSH marquee (a real `buildNeonSign`, framed because NeonSign's own board is near-black and its tubes only glow at ~12 % by day). Plus a nested cup tower, a straw caddy, a syrup pump rack, an LED price panel and the rubber wet-zone mat every drinks stall has. TWO real PointLights, zero particles.",
      render: () => (
        <ScenePreview distance={3.6} targetY={0.75} autoRotate={false} ground height={470}>
          <NeonSlush withGuest />
        </ScenePreview>
      ),
    },
    {
      name: 'After dark',
      description:
        "The bar at night, which is what the world is for. The three bowls throb on the shared 2.2 Hz beat while keeping their OWN flavour colours (a magenta machine turning cyan on the beat would read as a bug, not a light show — what beats is the brightness), the fascia LEDs chase, the counter trim and the under-counter wash breathe, the SLUSH marquee flickers on, and the cups the buyers are carrying pulse with the machines they came out of. ONE night-gated PointLight down here plus the marquee's own — everything else is emissive material, which is the only way a neon world fits the ≤4-light budget with a park full of drinkers.",
      render: () => <NeonSlushDemo night />,
    },
  ],
};

export default previews;
