import React from 'react';
import * as THREE from 'three';
import { box, mat } from '../Stage';
import { ScenePreview, Station, Straight, Drop, Lift, TurnR } from '../Park';
import { OceanTunnelSlide, buildTubeRaft, buildFishShoal } from './index';

const previews = {
  componentName: 'OceanTunnelSlide',
  importPath: 'components/OceanTunnelSlide',
  previews: [
    {
      name: '3D rig — Deepwater Chute (LEAD)',
      description:
        "Deepwater Chute, attraction 3 of Tidewater Hollow: a RAFT SLIDE down a translucent TUBE that runs through the lagoon. The station is at the TOP of the launch tower — you do not ride a slide from the bottom — so the queue climbs a switchback stair to the launch deck, boards there, and the raft goes straight into the tube: 4.4 units at 31.8° inside a glass shell on iron hoop ribs, clean through a REEF BASIN standing in the lagoon (water 2.2 deep, fish and kelp in it, god-rays coming down through the surface), out through the broken seaward wall where the pool spills into the sea, and down to the splash run-out. Then the haul-back belt takes the empty raft back up to the deck. The channel inside the tube is the shared kit's flooded flume trough (buildRideSpline profile 'flume'); the lagoon and the pool are both `buildWater` with WaterTile's palette UNTOUCHED — the depth read comes from a dished pale coral-sand bed graded into three tones by how much water stands over it, and the waterline is the real sand contour rather than the shader's clip ellipse (the sheet's own vertices dive under any sand that stands above them). Compiles CLEAN. Compiles CLEAN — 0 design violations, worst clearance 3.53, closure closed with ZERO synthesized track, 60.04 units of arc.",
      render: () => (
        <ScenePreview
          distance={44}
          targetY={2.2}
          height={560}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([20.5, 16.0, 22.5], [-1.2, 1.5, 0.0])}
        >
          <OceanTunnelSlide position={[7.6, 3.4]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Through the water (close)',
      description:
        "The signature, and the reason the pool is 2.2 units DEEP: the tube crosses at 31.8°, so every 0.1 of depth buys only 0.16 of submerged run and a shallow shelf pool gave the tube barely a unit inside the water. Here the raft and its four riders are visible INSIDE the shell as it drops through the pool — shoals of fish swimming past the glass, kelp standing on the basin floor and breaking the surface, god-rays slanting down — before the tube leaves through the seaward wall below the waterline and the pool spills over its broken lip into the lagoon. The one rendering decision that makes this picture work: WaterTile's sheet is ~80% opaque by design, so anything under it is veiled to a fifth of its contrast. The tube, the fish and the kelp are drawn in the transparent pass AFTER the water (renderOrder 2/3 against the sheet's 1), so they read as being IN it. The water itself is untouched — no re-saturation, no second shader, and the shell is deliberately MATTE (roughness 0.55, metalness 0) because this system has de-glossed its water twice.",
      render: () => (
        <ScenePreview
          distance={9}
          targetY={2.4}
          height={520}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([4.6, 12.0, 11.0], [-1.6, 2.2, 1.4])}
        >
          <OceanTunnelSlide position={[7.6, 3.4]} />
        </ScenePreview>
      ),
    },
    {
      name: 'The launch tower (close)',
      description:
        "The tower head: the timber launch deck on braced legs, its railings, the dispatch hut, the painted depth board facing the queue, the iron launch gate with a lantern either side, and the switchback STAIR — four flights and four landings up the queue face. The station straight IS the launch trough, and behind it the haul-back belt's 180° turnaround runs round the deck at the same height, which is what the deck is shaped around. Boarding is `board: [-1.3, 5.0, 0]` on the deck: GameManager seats guests at the boardPoint and they never walk to it (registry.ts:76), so an elevated anchor is legal, and the queue lane and both huts stay on the sand at the tower's foot.",
      render: () => (
        <ScenePreview
          distance={13}
          targetY={3.4}
          height={520}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([10.8, 10.0, 11.6], [0.2, 2.8, 0.4])}
        >
          <OceanTunnelSlide position={[0, 0]} phase0={0} />
        </ScenePreview>
      ),
    },
    {
      name: 'The splash run-out (close)',
      description:
        "The foot of the slide: the tube's brass collar and flared mouth in the lagoon, the raft landing in a burst of foam and droplets, the mist drifting off it, and the 180° turn that takes the channel back out across the water for the haul-back. The lagoon surface sits at 0.62 — just above the channel rails — so the run-out trough is genuinely awash and the raft floats out of the tube into open sea; the reef, the kelp and a shoal are in the shallows around it, all drawn after the water sheet so they read as being in it.",
      render: () => (
        <ScenePreview
          distance={12}
          targetY={1.0}
          height={500}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([-13.0, 5.6, 10.2], [-7.9, 0.7, 3.6])}
        >
          <OceanTunnelSlide position={[7.6, 3.4]} />
        </ScenePreview>
      ),
    },
    {
      name: 'The raft + a shoal (close)',
      description:
        "The vehicle on its own (`buildTubeRaft`, staged through the preview's `dress` hook in a short length of the ride's own channel — floor, walls, rim rails and water strip at the exact heights buildRideSpline's flooded profile sweeps them) with a shoal of fish beside it. Two rubberised buoyancy tubes with rope lashing round the outer one, a slatted timber floor, four seat pads with grab straps set evenly round the ring (so riders face outward, which is what a round raft does), a brass bow ring and a painted number plate. A shoal is ONE merged mesh and each fish is three boxes — body, tail fin, dorsal — because three parts is the minimum that reads as a fish rather than a floating pill; the shoal GROUP is what swims.",
      render: () => (
        <ScenePreview
          distance={3.4}
          targetY={0.7}
          height={460}
          autoRotate={false}
          ground={false}
          background="#8d9296"
          dress={(t, g, api) => {
            g.add(box(t, [0.9, 0.06, 3.0], 0x3d5a48, [0, 0.37, 0], { tex: 'wood', repeat: [2, 6], rough: 0.85 }));
            [-1, 1].forEach((s) => {
              g.add(box(t, [0.06, 0.3, 3.0], 0x324a3b, [s * 0.45, 0.52, 0], { tex: 'wood', repeat: [1, 8], rough: 0.85 }));
              g.add(box(t, [0.09, 0.09, 3.0], 0x6e6152, [s * 0.46, 0.66, 0], { tex: 'wood', repeat: [1, 8], rough: 0.9 }));
            });
            g.add(box(t, [0.72, 0.03, 3.0], 0x447588, [0, 0.485, 0], { rough: 0.8, opacity: 0.9, emissive: 0x1b2b37 }));
            const raft = buildTubeRaft(t);
            raft.position.set(0, 0.67, 0); // = the channel centreline + the profile's wheelOffset
            g.add(raft);
            const shoal = buildFishShoal(t, 5, { count: 10, size: 0.2, order: 3 });
            shoal.position.set(-1.5, 0.75, -0.4);
            g.add(shoal);
            const sheet = new t.Mesh(new t.PlaneGeometry(6, 6), mat(t, 0x477a8c, { rough: 0.9, opacity: 0.8 }));
            sheet.rotation.x = -Math.PI / 2;
            sheet.position.set(-1.6, 0.62, -0.4);
            sheet.renderOrder = 1; // the shoal is drawn after it, and reads THROUGH it
            g.add(sheet);
            api.setCameraPose?.([2.0, 1.5, 2.3], [-0.3, 0.7, 0.0]);
          }}
        />
      ),
    },
    {
      name: "Down the chute (rider's eye)",
      description:
        "The view a rider actually gets, and the shot that has to be checked whenever the reef moves: on the axis at the top of the dive, looking down the tube at the crossing. The bore through the reef is `TUBE_R + 0.75`, and that number is set by THIS picture rather than by what fits. The previous 0.30 passed its own audit — worst rock-to-axis 1.233 against a 1.25 invariant, nothing inside the bore — and still read as blocked, because the shell is 40 % transparent, so reef standing 0.28 off the glass is drawn through the tunnel wall at full size and fills the view down the chute; the slide ran into a rock face and the riders looked like they were inside it. At 0.75 there is visible air all round the glass, the far end of the bore is open, and the reef reads as a tunnel cut through it. Measured by harness/mp3d-render/probe-ots-profile.mjs, which recovers the axis from the shell's own ring centroids (the raft floats ~0.2 BELOW the axis, so measuring against its path quietly shifts every clearance) and uses point-to-triangle distance: worst rock-to-axis over the crossing 1.679.",
      render: () => (
        <ScenePreview
          distance={9}
          targetY={2.6}
          height={520}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([3.6, 5.15, 3.4], [-2.0, 3.1, 3.4])}
        >
          <OceanTunnelSlide position={[7.6, 3.4]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Track pieces — Long Chute',
      description:
        'Track-piece composition: the same tower with a LONGER run-out and a wider turnaround (<Station/><Straight/><Drop height={4.4}/><Straight length={5.0}/><TurnR radius={4.2}/>…). Everything follows the layout off the frame scan — the lagoon ellipse and its sand, the reef, the tower (placed on the station frame), the tube (placed on the DESCENT WINDOW: the last level frame before the plunge to the first level frame after it, plus run-out) and the REEF BASIN (placed on whichever frame of the plunge sits at 45% of the drop height). The rules for authoring your own: the station must be the HIGH end, the first piece after it a `drop`, and the last leg a `lift` back to station height landing ~0.3 u short on the station axis.',
      render: () => (
        <ScenePreview
          distance={46}
          targetY={2.0}
          height={500}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([24.0, 19.0, 25.0], [-1.5, 1.4, -0.5])}
        >
          <OceanTunnelSlide position={[8.6, 4.2]} phase0={5.5}>
            <Station />
            <Straight length={0.4} />
            <Drop height={4.4} />
            <Straight length={5.0} />
            <TurnR angle={180} radius={4.2} />
            <Straight length={9.5} />
            <Lift height={4.4} />
            <TurnR angle={180} radius={4.2} />
            <Straight length={1.2} />
          </OceanTunnelSlide>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
