import React from 'react';
import * as THREE from 'three';
import { mat, mergedBoxes } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { hash01 } from '../ColorKit';
import { ScenePreview } from '../Park';
import { BigPiano } from './index';

/** the club forecourt these previews stand on: a dark asphalt apron with a pale
 *  PROMENADE running straight across the keys (local x), because "the street
 *  runs along the key run" is the whole placement rule and a preview on a lawn
 *  hides it */
function forecourt(t: typeof THREE, g: THREE.Group, r = 9) {
  const disc = new t.Mesh(new t.CircleGeometry(r, 48), mat(t, 0x3c3f45, { tex: 'concrete', repeat: [12, 12], rough: 0.95 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.02;
  disc.receiveShadow = true;
  g.add(disc);
  // the promenade slab the keyboard is laid into, running along x
  const street = new t.Mesh(new t.PlaneGeometry(r * 2, 1.36), mat(t, 0x6f7076, { tex: 'concrete', repeat: [16, 2], rough: 0.92 }));
  street.rotation.x = -Math.PI / 2;
  street.position.set(0, -0.012, 0);
  street.receiveShadow = true;
  g.add(street);
  // kerbs either side of it, and a hashed scatter of paving joints
  const kerb: MergedBoxSpec[] = [];
  for (const s of [-1, 1]) kerb.push({ dims: [r * 2, 0.05, 0.09], pos: [0, 0.005, s * 0.72] });
  for (let k = 0; k < 40; k += 1) {
    const a = hash01(k * 1.7 + 5) * Math.PI * 2;
    const rr = 1.8 + Math.sqrt(hash01(k * 3.1 + 9)) * (r - 2);
    kerb.push({
      dims: [0.5 + hash01(k * 5.3) * 0.7, 0.012, 0.5 + hash01(k * 7.9) * 0.6],
      pos: [Math.cos(a) * rr, 0.0, Math.sin(a) * rr],
      rotY: hash01(k * 9.1) * 3.1,
    });
  }
  const km = mergedBoxes(t, kerb, 0x585b62, { tex: 'concrete', rough: 0.94, flat: true });
  km.castShadow = false;
  g.add(km);
}

const previews = {
  componentName: 'BigPiano',
  importPath: 'components/BigPiano',
  previews: [
    {
      name: '3D rig — The Big Piano (LEAD, the interaction)',
      description:
        "Attraction 3 of the PULSE DISTRICT, and NOT A RIDE: no queue, no station, no hut, no vehicle, no FSM — a `composable(...)` SCENERY component, so none of the ride placement rules apply. An oversized walk-on keyboard laid into the promenade: fifteen ivory keys and ten sharps hinged on a chrome balance rail, a low fallboard with twelve chromatic note lamps, the EXPOSED ACTION (one felt hammer per key on its rail), a leaning harp strung with 29 wires, and the BIG PIANO neon marquee on chrome posts behind it. This preview ships the DEMO PLAYER (default ON under a ScenePreview, OFF in a real park): a guest strides across the keys on a deterministic 18-second loop, stops mid-run to dance on the beat, and walks off — and they are fed through EXACTLY the same per-key hit detection a live GameManager guest goes through. Watch each key DEPRESS about its back edge — resting tip-up, coming down LEVEL under the foot so it stops flush with the ground rather than sinking through it — wash toward its own note colour, fire its hammer into the strings and light its note lamp, then rise again behind them. With nobody on it the board never goes dead: a glissando wave walks the run, the whole keyboard breathes on the district's 2.2 Hz beat and a hashed triad flashes every fourth bar. Click it for its window.",
      render: () => (
        <ScenePreview
          distance={6.2}
          targetY={0.5}
          height={540}
          autoRotate={false}
          ground={false}
          background="#2a2d33"
          dress={(t, g, api) => {
            forecourt(t, g);
            api.setCameraPose?.([2.6, 2.0, 4.4], [0.1, 0.45, -0.2]);
          }}
        >
          <BigPiano position={[0, 0]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Night (the keyboard lit)',
      description:
        "The hero shot. Everything is locked to the district beat — the same ~2.2 Hz clock <DanceFloor> flashes its tiles to and <Discotron>'s mirror ball scintillates on, over `PULSE_PALETTE` (imported from Discotron, never re-derived: magenta, cyan, violet, blue — the floor's amber and lime are deliberately dropped). ONE CLOCK, ABSOLUTE: the piano has no motor and no ride FSM, so nothing here sits behind a motion gate; a club never stops. Two real PointLights of its own wash the keybed and re-tint to whichever note sounded last, the marquee brings the third, and everything else — key emissive, note lamps, the LED chord bar over the harp, the string shimmer, the note flares and the bloom plate — is night-gated emissive or additive mesh. Zero particles.",
      render: () => (
        <ScenePreview
          distance={6.2}
          targetY={0.5}
          height={540}
          autoRotate={false}
          ground={false}
          night
          background="#0e1014"
          dress={(t, g, api) => {
            forecourt(t, g);
            api.setCameraPose?.([2.6, 1.9, 4.2], [0.1, 0.5, -0.2]);
          }}
        >
          <BigPiano position={[0, 0]} />
        </ScenePreview>
      ),
    },
    {
      name: 'A chord held down (close — the keys)',
      description:
        "The keys themselves, with a chord forced down by the `chord` prop for a reproducible still (`demo={false}`, so nothing stands in the way of them). A pressed key ROTATES about its back edge — a pure vertical translation of the same distance did not read at park zoom, a hinge rotation does. Note which way the stroke runs: a key at REST is tilted tip-UP and a fully pressed key is LEVEL, settling the last 2 mm onto its balance rail. That is the fix for a keyboard whose keys used to sink straight through the paving they are flush-mounted into — a pressed natural was measured 51.7 mm UNDER the plaza slab, i.e. gone. Now the whole 42 mm of travel happens in the open air and the key stops dead level with the ground the guest is standing on. Each pressed key also washes its ivory toward its own note colour and drives its felt hammer back into the strings. The sharps are a raised PANEL on the back half of the whites, standing only 0.02 proud: this is a floor a guest walks over, so a real keyboard's trip-hazard sharps are deliberately flattened. Note the twelve chromatic note lamps in the nameboard: one per pitch class, so a sounded note still reads when the key that sounded it is under somebody's foot.",
      render: () => (
        <ScenePreview
          distance={3.4}
          targetY={0.25}
          height={500}
          autoRotate={false}
          ground={false}
          background="#2a2d33"
          dress={(t, g, api) => {
            forecourt(t, g, 6);
            api.setCameraPose?.([1.35, 0.95, 2.0], [-0.15, 0.16, -0.15]);
          }}
        >
          <BigPiano position={[0, 0]} chord demo={false} />
        </ScenePreview>
      ),
    },
    {
      name: 'One octave + the action (count 7)',
      description:
        'The same piano at `count={7}` — one octave, seven keys and five sharps, a 2.24 u key run for a tight plaza. The `count` axis scales the footprint, the strings, the hammer rail and the marquee posts together (7…15, sweep-clean over 400 seeds). This framing is about the CASE: the low fallboard that keeps the action visible, the chrome hammer rail with one felt hammer per key, the leaning harp with its tuning-pin bar and hitch bar, the LED chord bar along the harp top, and the cheek blocks — which sit on the CASE side only, because the ±x ends of the keybed are the walk-on edges and a cheek across them would fence off the whole point of the piece.',
      render: () => (
        <ScenePreview
          distance={3.6}
          targetY={0.6}
          height={500}
          autoRotate={false}
          ground={false}
          background="#2a2d33"
          dress={(t, g, api) => {
            forecourt(t, g, 6);
            api.setCameraPose?.([1.9, 1.5, 2.4], [0.0, 0.55, -0.55]);
          }}
        >
          <BigPiano position={[0, 0]} count={7} demo={false} />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
