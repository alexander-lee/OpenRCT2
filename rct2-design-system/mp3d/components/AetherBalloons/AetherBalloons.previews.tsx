import React from 'react';
import { ScenePreview } from '../Park';
import { mat } from '../Stage';
import { AetherBalloons, buildAetherGondola } from './index';

type StageT = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[0];
type StageG = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[1];

/** the foundry yard the ride stands in: a sooted flagstone apron over the
 *  preview's grass disc, so the mast reads as INDUSTRIAL ground rather than a
 *  meadow (the same staging trick EmberWings/LavaTubeRun use for ash). */
const foundryYard = (radius: number) => (t: StageT, g: StageG) => {
  const disc = new t.Mesh(new t.CircleGeometry(radius, 56), mat(t, 0x5c564c, { tex: 'concrete', repeat: [12, 12], rough: 1, bump: 0.06 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.011;
  disc.receiveShadow = true;
  g.add(disc);
  const inner = new t.Mesh(new t.CircleGeometry(radius * 0.58, 40), mat(t, 0x4c463c, { tex: 'concrete', repeat: [8, 8], rough: 1, bump: 0.07 }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.013;
  inner.receiveShadow = true;
  g.add(inner);
};

const previews = {
  componentName: 'AetherBalloons',
  importPath: 'components/AetherBalloons',
  previews: [
    {
      name: '3D rig — the aerial promenade at work',
      description:
        "\"Aether Balloons\", the Brasswork Foundry world's stately family flat ride: six ornate brass-and-glass gondolas on a spider of riveted arms that ROTATE around a square lattice mast WHILE a cable hoist lifts them 1.1 u, hold at the top, and settle back onto the boarding deck. Every part of the drive train is modelled and every part moves — the carriage sleeve slides up four face rails on eight guide rollers, its brass slew gearbox drives a toothed ring gear (0.52 : 0.058, so 8.97 pinion turns per revolution), two hoist cables run off the sleeve's top lugs over two crown sheaves and back down INSIDE the lattice to two cast-iron counterweights that visibly DESCEND as the gondolas rise, and the base winch's rope drum, 0.06 : 0.20 gear pair, spoked flywheel and ball governor all turn off the same travel. The gondolas hang on fore-and-aft pivot pins and sway gently. Metals all sit in the 0.2–0.34 metalness band (0.6+ with no env map renders near-black) — aged brass, oxidised copper weeping verdigris, soot-grey iron.",
      render: () => (
        <ScenePreview
          distance={7}
          targetY={1.5}
          autoRotate={false}
          height={520}
          dress={(t, g, api) => {
            foundryYard(4.3)(t, g);
            api.setCameraPose?.([4.3, 3.5, 5.4], [0, 1.5, 0]);
          }}
        >
          <AetherBalloons />
        </ScenePreview>
      ),
    },
    {
      name: 'Gondola rig — the bench, the glazing and the yoke',
      description:
        "One gondola close up, hung from a stub arm end. The basket is an OPEN riveted brass tub with eight corner ribs, a verdigris-weeping copper skirt, a glazed upper band and a brass rim moulding; inside it a REAL bench — moulded iron pan, buttoned oxblood leather cushion with its top exactly 0.225 above the floor, a leaning backrest with its own cushion, a brass divider rail, a lap bar on two uprights and a footrest bar. 0.225 is arithmetic, not taste: a park guest is GUEST_SCALE 0.5 and a peep's hips sit at peep-local 0.45, so a seat anchor ON THE FLOOR lands a rider's hips ON the cushion and their feet ON the floor — which is what `seatWorld` hands the GameManager. Ornament: a gas lamp on a curved bracket (night-gated emissive), a live pressure gauge, an engraved nameplate and four scrollwork brackets under the tub. Above it the yoke: two plates with diagonal stays up to a cross beam and the brass PIVOT PIN in its bearings, which is what lets the gondola sway.",
      render: () => (
        <ScenePreview
          distance={2.4}
          targetY={0.62}
          autoRotate={false}
          height={520}
          dress={(t, g, api) => {
            foundryYard(2.6)(t, g);
            api.setCameraPose?.([1.55, 1.35, 1.9], [0, 0.55, 0]);
            const rig = buildAetherGondola(t, { riders: true });
            rig.position.y = 0.34; // the docked floor height, so the frame reads at ride scale
            g.add(rig);
          }}
        />
      ),
    },
    {
      name: 'Mechanism — the mast, the sheaves and the counterweights',
      description:
        "The same ride from a low, close angle with the riders left in: the point of this camera is the MACHINERY. Six bays of crossed bracing between four riveted posts with gusseted ties at every bay line (the whole mast is ONE merged mesh), the hoist line shaft turning up the middle in three bearing brackets to the crown bevel gear, the two crown sheaves paying rope at exactly the carriage's speed, the two counterweights sliding down their own guide rails INSIDE the lattice as the gondolas climb, and the base winch on the deck — engine bed, roped drum, gear pair, flywheel, spinning ball governor, live gauge and the relief valve wisping 24 particles of steam. Two night-gated PointLights only (the crown aether globe and the yard gaslight).",
      render: () => (
        // FRAME THE WHOLE HOIST, NOT THE DECK. The first camera here sat at
        // [3.4, 1.75, 3.9] on a 1.35 target — 4.4° of elevation, which cropped
        // everything above the arm plane: the crown sheaves (2.80), the bevel
        // gear and the aether globe were off the top of the frame and the
        // preview showed the base winch and a dark lattice. It is 5.5 u tall to
        // the weathervane, so the camera has to stand back and look UP the mast.
        <ScenePreview
          distance={7.6}
          targetY={1.7}
          autoRotate={false}
          height={560}
          dress={(t, g, api) => {
            foundryYard(4.6)(t, g);
            api.setCameraPose?.([4.1, 2.55, 4.7], [0, 1.7, 0]);
          }}
        >
          <AetherBalloons />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
