import React from 'react';
import { ScenePreview, Station, Straight, TurnL, SBend } from '../Park';
import { MagneticRide } from './index';

const previews = {
  componentName: 'MagneticRide',
  importPath: 'components/MagneticRide',
  previews: [
    {
      name: '3D rig',
      description:
        "The MAGLEV GLIDER: a trackless-dark-ride idea built OUTDOORS so the whole attraction reads from outside — a slim graphite induction beam on single elegant pylons (polished levitation rail, glowing coil strips, coil ribs, cable conduits, painted travel chevrons) closing a hexagonal ring, with four open pods hovering a visible 0.185-unit gap above it. They glide at a constant walking pace, lean gently through the sweeps, drift a few degrees off the beam for the cinematic feel and trail a faint ion-mist wake; coil pulses chase along the rail in the direction of travel. Boarding is from an elevated steel-and-concrete platform under a cantilevered canopy.",
      render: () => (
        <ScenePreview distance={17} targetY={1.5} height={560}>
          {/* the ring hangs off the station's −z face, so the whole circuit is
              recentred in frame (built extents: x ±4.8, z −9.1…1.1) */}
          <MagneticRide position={[0.8, 4]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Night (coil pulses + beacons)',
      description:
        "The same ring after dark, where the effect rig is designed to live: the flank coil strips and the chasing coil pulses light up, every pylon flashes its violet beacon in a runway-style chase, the pods' levitation coils and under-pod glow discs breathe over the beam, cabin glass and footwell strips glow from inside the pods, and the platform edge strip, canopy lip and two holographic panels come up. Only TWO real PointLights carry it (lead-pod levitation glow + station canopy) — everything else is night-gated emissive material.",
      render: () => (
        <ScenePreview distance={17} targetY={1.5} height={560} night>
          <MagneticRide position={[0.8, 4]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Station close-up',
      description:
        'Boarding detail: the elevated deck sits 0.03 above the pod floor plate so guests step straight in over the kerb, its edge light strip marks the pod line, the stair flight drops off the far end, and the guide fins can be seen skimming down beside the beam flanks without ever touching them — the pods carry nothing that reaches the rail. Real guests fill the two tandem seats per pod via seatWorld when the ride is registered (capacity 8).',
      render: () => (
        <ScenePreview distance={8} targetY={1.9} height={480}>
          {/* unshifted (the station sits at the local origin) and turned so the
              OPEN boarding edge faces the camera — the deck's canopy would
              otherwise stand between the lens and the pods */}
          <MagneticRide rotation={Math.PI} />
        </ScenePreview>
      ),
    },
    {
      name: 'Custom circuit (pieces)',
      description:
        'The guideway takes any compileTrackPieces circuit (SETUP §5.1) as piece children or a `pieces` array — here a long stadium sweep with an <SBend/> kink easing the beam past the far corner, so the pods make a slow showcase run down one flank instead of ringing a hexagon. The profile is level (a magnetic guideway is precision-flat); the gentle two-crest levitation wave over the pylons comes from the component, not the pieces.',
      render: () => (
        <ScenePreview distance={19} targetY={1.4} height={560}>
          <MagneticRide position={[0, 4.7]}>
            <Station />
            <Straight length={2} />
            <TurnL radius={3} />
            <Straight length={2.4} />
            <TurnL radius={3} />
            <Straight length={1.2} />
            <SBend length={3.6} radius={1.2} />
            <Straight length={1.5} />
            <TurnL radius={3} />
            <Straight length={1.2} />
            <TurnL radius={3} />
            <Straight length={1.4} />
          </MagneticRide>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
