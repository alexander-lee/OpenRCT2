import * as THREE from 'three';
import { box } from '../Stage';
import { buildMiniSled } from '../SplineRideKit';
import { composable } from '../Park';

// DEPRECATED — BobsleighCar has been REMOVED FROM THE CATALOG. Nothing in the
// design system imported it: the <Bobsleigh> ride models its own pod, and every
// spline/piece-composed bobsled course takes its vehicle from SplineRideKit's
// `buildMiniSled` (Park/pieces.tsx `<TrackRide profile="bobsled">`). This file
// survives ONLY as a thin alias so any existing design that still references
// it keeps rendering — the same treatment the retired `Road` component got,
// because the publish API cannot delete files.
//
// REPLACEMENT: `buildMiniSled(three)` from '../SplineRideKit' for the vehicle,
// <Bobsleigh> for the whole ride.

/** @deprecated removed from the catalog — use `buildMiniSled` (SplineRideKit)
 *  for the sled or `<Bobsleigh>` for the ride. Delegates to `buildMiniSled`
 *  and lifts it so the runner bottoms (0.045 below the sled origin) sit on the
 *  chute floor at 0.12, exactly as the old builder did. */
export function buildBobsleighCarScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // the banked half-pipe chute the old component drew, kept so the alias
        // still reads as a sled in a chute rather than a sled in mid-air
        g.add(box(t, [1.5, 0.12, 3], 0x9fb0c0, [0, 0.06, 0], { tex: 'concrete', repeat: [3, 10], rough: 0.9 }));
        [-0.75, 0.75].forEach((x) =>
          g.add(box(t, [0.12, 0.55, 3], 0xbcc6d2, [x, 0.28, 0], { tex: 'concrete', repeat: [1, 10], rough: 0.9, rotZ: x > 0 ? -0.22 : 0.22 })),
        );
        const sled = buildMiniSled(t);
        sled.position.y = 0.165; // runner bottoms (local −0.045) ride the chute floor at 0.12
        g.add(sled);
        return (time: number) => {
          sled.position.y = 0.165 + Math.sin(time * 2) * 0.01;
          sled.rotation.z = Math.sin(time * 1.5) * 0.06;
        };
      })(three, group) || undefined;
  return { group, update };
}

/** @deprecated removed from the catalog — use `<Bobsleigh>` (the full ride) or
 *  SplineRideKit's `buildMiniSled` as a `<TrackRide profile="bobsled">`
 *  vehicle. Kept as an alias so existing designs keep rendering. */
export const BobsleighCar = composable('BobsleighCar', (t) => buildBobsleighCarScene(t));
