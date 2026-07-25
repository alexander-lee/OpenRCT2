import React from 'react';
import * as THREE from 'three';
import { box, nightKOf } from '../Stage';
import { compileTrack, buildTrackMesh, attachTrain, PieceName } from '../TrackKit';
import { buildCoasterCar, gateCarLights } from '../CoasterCar';
import { tree } from '../Kit';
import { composable } from '../Park';

// A COMPOSED wooden coaster built from TrackKit pieces exactly the way RCT2
// chains TrackElemTypes: station → chain-lift up (3× gentle 25°) → first drop
// → corkscrew → hop → quarter turns to close the circuit. NOTE: per-type
// construction rules live in TrackKit's TRACK_WHITELIST (wooden coasters have
// no corkscrew pieces — WoodenRollerCoaster.h:26,85); this demo keeps its
// corkscrew, i.e. it is a steel-whitelist layout dressed in wooden supports.
// Pass compileTrack(t, pieces, 'wooden') to have the whitelist checked.
// The peep-filled
// train follows the spline (position + banked orientation from the piece roll
// profile), and the wooden support bents apply RCT2-style CLEARANCE: where a
// column would pass through a lower track's swept envelope it is split so the
// cars never drive through structure.
export function buildCoasterBuilderScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // Verified-closed circuit: opposite legs are equal length, every rise is
        // matched by a fall, and four right turns total 360° — compileTrack
        // validates this (an unclosed circuit warns, like RCT2 refusing to open).
        const LAYOUT: PieceName[] = [
          'station', 'flat',
          'up25', 'up25', 'up25', // chain lift
          'down25', 'down25', 'down25', // first drop (rises cancel exactly)
          'flat', 'corkscrewR', 'flat', // 3-tile inversion, returns to centreline
          'turnR', 'up25', 'down25', // south leg hop
          'turnR', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', 'flat', // west return (13 = east leg)
          'turnR', 'flat', 'flat', // north leg (matches south: turn+2)
          'turnR',
        ];
        const tk = compileTrack(t, LAYOUT);
        // build into a recentred root (the piece walk starts at the origin, so
        // the raw circuit's centroid sits far off in +z and the default camera
        // crops it): rotate the long axis across the wide viewport + centre it
        const root = new t.Group();
        g.add(root);
        // Stage orbits from azimuth 45°: the screen-horizontal axis is the
        // world (1,0,-1) diagonal, so yaw the loop's +z long axis onto it
        root.rotation.y = Math.PI * 0.75;
        buildTrackMesh(t, root, tk, { wood: true, supportEvery: 8 });

        // three detailed cars (each carries two peeps with faces) in RCT2
        // train order — attachTrain places car i at head − i·spacing, so
        // index 0 leads: nose car first, plain middle, tail car with the light
        const cars = (['front', 'middle', 'end'] as const).map((v) => {
          const c = buildCoasterCar(t, v);
          c.scale.setScalar(0.78);
          return c;
        });
        // 0.78-scaled cars: wheel bottoms at 0.78*0.15 below the origin, rail
        // tops +0.045 above the centreline -> 0.162 seats the wheels on the rails
        const run = attachTrain(t, root, tk, cars, { speed: 0.05, spacing: 0.026, wheelOffset: 0.162 });

        // a little landscaping so the circuit reads as a ride, not a diagram
        // (parented to the root so it keeps its place beside the station)
        const pine = tree(t, { shape: 'pine', scale: 0.9 });
        pine.position.set(-2.6, 0, 3.2);
        root.add(pine);
        const oak = tree(t, { shape: 'round', scale: 0.8 });
        oak.position.set(4.2, 0, -2.4);
        root.add(oak);
        root.add(box(t, [1.4, 0.5, 0.1], 0xb03030, [0.65, 0.25, -1.05], { tex: 'plastic', repeat: [5, 1], rough: 0.5 })); // entrance sign wall

        // recentre the loop on the stage origin
        const bb = new t.Box3();
        for (let i = 0; i < 100; i++) bb.expandByPoint(tk.curve.getPointAt(i / 100));
        const centre = bb.getCenter(new t.Vector3()).applyAxisAngle(new t.Vector3(0, 1, 0), root.rotation.y);
        root.position.set(-centre.x - 0.55, 0, -centre.z + 0.35); // nudged SW so the station canopy clears the frame top // extra 0.9 west: the camera sits NE, so the frame's usable centre is west of the origin

        return (time) => {
          run(time);
          const k = nightKOf(g); // headlamps only after dark
          cars.forEach((c) => gateCarLights(c, k));
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <CoasterBuilder> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const CoasterBuilder = composable('CoasterBuilder', (t) => buildCoasterBuilderScene(t));
