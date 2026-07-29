import React from 'react';
import { ScenePreview } from '../Park';
import { mat } from '../Stage';
import { buildPathNetwork } from '../PathNetwork';
import { createGameManager } from '../GameManager';
import { buildPeep } from '../Guest';
import { GoggleWorks, buildWornGoggles } from './index';

type StageT = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[0];
type StageG = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[1];

/** the foundry yard this shop stands on — the same sooted apron
 *  `AetherBalloons` and `GearworksExpress` stage, so the kiosk reads as WORKS
 *  ground rather than as a kiosk dropped in a meadow (it serves onto the
 *  Brasswork Foundry's iron-plate frontage in a real park, never onto grass). */
const foundryYard = (radius: number) => (t: StageT, g: StageG) => {
  const disc = new t.Mesh(new t.CircleGeometry(radius, 48), mat(t, 0x5c564c, { tex: 'concrete', repeat: [10, 10], rough: 1, bump: 0.06 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.011;
  disc.receiveShadow = true;
  g.add(disc);
  const inner = new t.Mesh(new t.CircleGeometry(radius * 0.55, 32), mat(t, 0x4c463c, { tex: 'concrete', repeat: [7, 7], rough: 1, bump: 0.07 }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.013;
  inner.receiveShadow = true;
  g.add(inner);
};

// The shop sells REAL goggles through the GameManager WEARABLE flow (the same
// live-sim vignette as the four catalog shops, with the accessory twist): a
// ScenePreview `dress` hook runs a miniature deterministic sim — small path
// loop, the stall registered at the counter front — at 2x time, PRE-WARMED so
// several guests are already wearing a pair on the first frame. A wearable is a
// JOY buy (a hashed passing impulse on the aimless-wander roll, once per guest,
// +12 happiness like a balloon), and unlike every other stall item it is never
// eaten, never dropped and never littered: the goggles hang off the peep's
// `headSlot`, so they ride every nod and mood tilt for the REST OF THE VISIT.
function GoggleWorksDemo() {
  return (
    <ScenePreview
      distance={4.2}
      targetY={0.75}
      autoRotate={false}
      dress={(t, g, api) => {
        // THE WEARABLE IS THE POINT, AND IT IS SMALL. This is the only stall
        // whose item is WORN, and at the old 6.6 u eye the goggles on a 0.5-
        // scale peep's crown read as an anonymous brass band — the sale was
        // happening (5 sold) but the shot under-sold it. Pulled in to 4.4 u and
        // dropped to near head height so the crown of a passing guest is
        // roughly at frame centre: close enough to read the lenses and the
        // strap, still wide enough to keep the counter and the sign in shot.
        api.setCameraPose?.([0.9, 1.85, 4.3], [0, 0.72, 1.2]);
        // small loop passing the counter front (kiosk at origin faces +z)
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
        // the <GoggleWorks> child is the visual; ScenePreview skips its
        // registration hook, so the demo registers the sale itself. The anchor is
        // pushed +z so the serving front (anchor + 0.72·dir) lands at z 0.82 —
        // clear of the counter nosing (z 0.525) and the front roof posts (z 0.1).
        // ...with the shop's OWN worn goggles (StallConfig.heldItem on an
        // item: 'wearable' stall), exactly as <GoggleWorks register> wires it
        // inside a real <Park>
        mgr.registerStall({ name: 'The Goggle Works', item: 'wearable', price: 4, value: 6, anchor: [0, 0, 0.1], dir: [0, 1], heldItem: buildWornGoggles });
        mgr.spawnGuests(8);
        // pre-warm (fixed 1/30 substeps, deterministic): the joy-buy impulse only
        // rolls when a guest is aimlessly wandering, so fast-forward far enough
        // that a couple of pairs are already being worn on the first frame —
        // 44 s, not the old 90, so new customers still step up to the counter
        // while the preview plays instead of the whole crowd arriving kitted out.
        const WARM = 44;
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
        // then run at 2x in fixed substeps — walk-up -> buy -> wear reads in one
        // viewing without rushing the walk cycles
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
      <GoggleWorks />
    </ScenePreview>
  );
}

/**
 * A single 0.5-scale peep WEARING the shop's goggles, built through exactly the
 * path the GameManager uses on a buyer: `buildWornGoggles(t)` parented to
 * `peep.headSlot` (the crown group), which is what applies the brow offset.
 * Nothing here is a bespoke stand-in — if this fit is right, the fit on every
 * buyer in a real park is right, because it is the same two calls.
 */
function wornGogglesRig(t: StageT, g: StageG) {
  const peep = buildPeep(t, { shirt: 0x2f5f6f, skin: 0xc68642, expression: 'happy' });
  peep.group.scale.setScalar(0.5);
  peep.group.rotation.y = Math.PI; // face the camera
  peep.headSlot.add(buildWornGoggles(t));
  g.add(peep.group);
  return peep;
}

const previews = {
  componentName: 'GoggleWorks',
  importPath: 'components/GoggleWorks',
  previews: [
    {
      name: 'Selling goggles (live sim)',
      description:
        "The Goggle Works as a working composableStall — the fleet's first WEARABLE shop: the riveted brass optician's kiosk registered with a miniature GameManager sim (item 'wearable', price 4, value 6). Guests on the path loop take the joy-buy impulse, step up to the serving front (local +z, 0.72 out from the counter) and walk away WEARING the shop's own brass aviator goggles — two domed lenses in machined brass rims, leather gaskets and strap, side buckles — parented to the peep's headSlot on the brow, riding every nod and mood tilt. No eating, no container, no litter, no fly-away: a wearable is kept for the rest of the visit and survives boarding a ride (GameManager/Context.md 'Wearables'). Pre-warmed + 2x time so several pairs are already out on the paths. Deterministic.",
      render: () => <GoggleWorksDemo />,
    },
    {
      name: '3D rig',
      description:
        "The Goggle Works: riveted brass and copper panels on a soot-iron carcass, a treadle-driven lens-grinding wheel turning on the counter behind its flat leather belt, a patinated copper boiler with three live pressure gauges venting steam through the roof, a display rack of finished goggles, a brass gaslight on a curved bracket and, on the roof, a GIANT pair of goggles as the shop sign — 6.4x the worn pair, 1.64 u wide across a 1.84 u roof, tipped back 0.5 rad so the two lens discs face the park camera square-on instead of showing it their rims edge-on. The browsing guest is already wearing a pair — the same recipe the GameManager clones onto every buyer's head.",
      // LOOK UNDER THE ROOF. With no `dress` this preview took the ScenePreview
      // default pose, measured at 50.8 deg of elevation and 4.44 u out: from up
      // there the shop is its own back-half roof plate, and the grinder, the
      // gauges, the lens tray and the counter — everything the modelling note
      // exists to keep visible — were a sliver under the eaves. 26 deg gets the
      // camera under the roof line and onto the serving front, and the yard disc
      // stops the kiosk standing on open grass.
      render: () => (
        // …AND THEN PULLED BACK FOR THE HERO SIGN. The 26 deg pose is kept (it is
        // the only shot that gets under the roof line), but at 3.5 u out the
        // GIANT goggles — 1.64 wide, topping out at y 2.10 — were cropped off the
        // canvas. The camera moves straight out along the same ray, so the
        // elevation is unchanged at ~25 deg and everything the modelling note
        // protects is still in shot.
        <ScenePreview
          distance={4.7}
          targetY={0.9}
          autoRotate={false}
          dress={(t, g, api) => {
            foundryYard(2.4)(t, g);
            api.setCameraPose?.([2.1, 2.9, 3.75], [0, 0.9, 0.05]);
          }}
        >
          <GoggleWorks withGuest />
        </ScenePreview>
      ),
    },
    {
      name: 'The worn goggles — against the head',
      description:
        "THE WEARABLE HAD NO CLOSE-UP, and it is the only worn item in the fleet. Every stall that sells a HELD item ships a close-up judging the fit against a real hand (Honeywitch's apple against the fist, EmberRoast's skewer, SushiStall's tray) — because the shared hold spot is sized for a fat burger and a slim item floats unless it carries its own self-offset. The worn item has the same class of problem one anatomical step up: it is parented to the peep's `headSlot` on the CROWN and offset back down to the brow by `STRAP_TO_HEAD` (the inverse of buildWornGoggles' own brow offset), so if that inverse is ever wrong the goggles sit on top of the skull like a hat, or sink into the hair. There was no shot in which you could see that. There is now. Note the SCALE problem this shot exists to work around: a 0.5-scale peep's head is r 0.12 and the goggles span about 0.05, so in any whole-stall frame they are a brass band and nothing more — the live-sim preview proves the SALE (5 sold, worn for the rest of the visit), and this preview proves the FIT. Built at the exact transform the GameManager clones onto a buyer, so the fit is judged in a render rather than on paper.",
      render: () => (
        <ScenePreview
          distance={0.5}
          targetY={0.52}
          autoRotate={false}
          ground
          height={460}
          dress={(t, g, api) => {
            // MEASURED, not guessed: the goggles assembly centres at world
            // (0.001, 0.521, 0.004) and spans 0.189 on a peep whose whole
            // 0.5-scale body is 0.561 tall. A first pass aimed at y 0.98 —
            // above the peep entirely — and rendered empty sky.
            api.setCameraPose?.([0.17, 0.58, -0.44], [0, 0.52, 0]);
            wornGogglesRig(t, g);
            return undefined;
          }}
        />
      ),
    },
    {
      name: 'The worn goggles — profile',
      description:
        'The same head from the side, which is the view that catches the two ways a worn item goes wrong: the strap has to WRAP the skull rather than pass in front of it, and the lens rims must stand clear of the brow without floating off it. From here the strap band crosses the temple, the buckles sit at the sides where a real pair buckles, and the gaskets are buried against the face while the rims and lenses stay proud — which is the whole read.',
      render: () => (
        <ScenePreview
          distance={0.5}
          targetY={0.52}
          autoRotate={false}
          ground
          height={460}
          dress={(t, g, api) => {
            api.setCameraPose?.([0.46, 0.55, -0.06], [0, 0.52, 0]);
            wornGogglesRig(t, g);
            return undefined;
          }}
        />
      ),
    },
  ],
};

export default previews;
