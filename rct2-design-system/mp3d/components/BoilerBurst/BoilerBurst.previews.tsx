import React from 'react';
import { ScenePreview } from '../Park';
import { mat } from '../Stage';
import { BoilerBurst, buildBoilerCart } from './index';

type StageT = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[0];
type StageG = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[1];

/** the foundry yard the rig stands in: a sooted flagstone apron over the
 *  preview's grass disc, so the boiler reads as INDUSTRIAL ground, not a
 *  meadow (the staging trick EmberWings/LavaTubeRun use for ash). */
const foundryYard = (radius: number) => (t: StageT, g: StageG) => {
  const disc = new t.Mesh(new t.CircleGeometry(radius, 56), mat(t, 0x5c564c, { tex: 'concrete', repeat: [12, 12], rough: 1, bump: 0.06 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.011;
  disc.receiveShadow = true;
  g.add(disc);
  const inner = new t.Mesh(new t.CircleGeometry(radius * 0.6, 40), mat(t, 0x4c463c, { tex: 'concrete', repeat: [8, 8], rough: 1, bump: 0.07 }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.013;
  inner.receiveShadow = true;
  g.add(inner);
};

const previews = {
  componentName: 'BoilerBurst',
  importPath: 'components/BoilerBurst',
  previews: [
    {
      name: '3D rig — the pressure-test rig venting',
      description:
        "\"Boiler Burst\", the Brasswork Foundry world's spinner: eight riveted test carts circle a live boiler on a turntable, each cart spinning on its own valve hub at a hashed rate in alternating directions (waltzer-style — no two neighbours in step), while the boiler VENTS steam through four brass nozzles. The rhythm is fixed and deterministic — `floor(time / 3.6)` off the ABSOLUTE clock, with the jet decaying from the ideal vent instant rather than the frame time — and it is TELEGRAPHED: the big gauge bolted to the boiler's +z face (the one the queue looks at) has a needle that accelerates into a red danger arc, then the safety-valve lever pops, the pressure lamp flashes, the whistle throws a burst and all four nozzles blow for 0.55 s. The firebox burns day and night with a coal heap and a shovel beside its swung-open brass door; the turntable is driven by a visible perimeter unit — spur pinion into a 44-tooth ring gear on the deck skirt (21.5 : 1), spoked flywheel, starting lever.",
      render: () => (
        <ScenePreview
          distance={7}
          targetY={1.1}
          autoRotate={false}
          height={520}
          dress={(t, g, api) => {
            foundryYard(4.5)(t, g);
            api.setCameraPose?.([4.4, 3.1, 5.3], [0, 1.05, 0]);
          }}
        >
          <BoilerBurst />
        </ScenePreview>
      ),
    },
    {
      name: 'Cart rig — the handwheel, the seat and the relief loop',
      description:
        "One test cart close up on its toothed slew hub. The tub is riveted iron in two brass hoop bands with a brass rim moulding and rust weeping down its flanks, and it is OPEN, so the rider reads: moulded iron pan, buttoned leather cushion with its top exactly 0.225 above the floor, a leaning backrest with its own cushion, a lap bar on two uprights and a footrest bar. 0.225 is arithmetic, not taste — a park guest is GUEST_SCALE 0.5 and a peep's hips sit at peep-local 0.45, so a seat anchor ON THE FLOOR lands the hips ON the cushion and the feet ON the floor, which is exactly what `seatWorld` hands the GameManager. On the outboard face: the valve body, stem and full-size brass HANDWHEEL the rider grips (it spins with the cart), the cart's own little pressure gauge reading its own hashed static pressure, a copper relief loop arching over the back with a verdigris streak, and a stencilled test number.",
      render: () => (
        <ScenePreview
          distance={2}
          targetY={0.42}
          autoRotate={false}
          height={520}
          dress={(t, g, api) => {
            foundryYard(2.4)(t, g);
            api.setCameraPose?.([1.35, 1.1, 1.6], [0, 0.36, 0]);
            const rig = buildBoilerCart(t, { riders: true });
            rig.position.y = 0.34; // the cart floor's real height on the turntable
            g.add(rig);
          }}
        />
      ),
    },
    {
      name: 'Boiler — the gauge, the firebox and the four nozzles',
      description:
        "A low, close camera on the boiler itself: the firebrick firebox with its glowing grate and swung-open brass door, the riveted barrel in four brass hoop bands, the oxidised copper shoulder and dome weeping verdigris, the offset sooted chimney (offset to −z on purpose, so it never hides the safety valve), the whistle, the safety-valve lever with its weight, the inspection ladder up the −z flank, the two small flanking gauges, the red pressure lamp and the BIG gauge whose needle climbs toward the danger arc. The four vent nozzles — flange, elbow, cone, mouth ring — point outward and 35° up, and the jets leave along exactly that direction from exactly that mouth, so the steam really does come out of the nozzle it is drawn on, and it blows across the carts.",
      render: () => (
        <ScenePreview
          distance={4.4}
          targetY={1.2}
          autoRotate={false}
          height={520}
          dress={(t, g, api) => {
            foundryYard(4)(t, g);
            api.setCameraPose?.([2.5, 1.7, 3.0], [0, 1.15, 0]);
          }}
        >
          <BoilerBurst />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
