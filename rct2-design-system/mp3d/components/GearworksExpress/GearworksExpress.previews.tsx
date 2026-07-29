import React from 'react';
import { ScenePreview, Station, Straight, Lift, Drop, TurnR } from '../Park';
import { mat } from '../Stage';
import { GearworksExpress } from './index';

type StageT = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[0];
type StageG = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[1];

/** the foundry yard: a soot-grey cinder apron over the preview's grass disc, so
 *  the works stand on WORKS GROUND rather than in a meadow. */
const cinderYard = (radius: number) => (t: StageT, g: StageG) => {
  const disc = new t.Mesh(new t.CircleGeometry(radius, 56), mat(t, 0x5a544b, { tex: 'concrete', repeat: [14, 14], rough: 1, bump: 0.06 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.012;
  disc.receiveShadow = true;
  g.add(disc);
  const inner = new t.Mesh(new t.CircleGeometry(radius * 0.62, 44), mat(t, 0x494237, { tex: 'concrete', repeat: [9, 9], rough: 1, bump: 0.07 }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.014;
  inner.receiveShadow = true;
  g.add(inner);
};

const previews = {
  componentName: 'GearworksExpress',
  importPath: 'components/GearworksExpress',
  previews: [
    {
      name: '3D rig — the Gear Gallery (the stock circuit and the works it runs through)',
      description:
        "The whole dark ride on the shipped **Gear Gallery** circuit: a 1.0-unit chain hoist out of the iron station up into the machine gallery, a slow corner, the level **ENGINE BAY** leg at y 1.55 where the riders pass three vertical pistons at rod height, the 1.0 back down through the press hall, then the long low **GEAR GALLERY** straight — a four-gear train whose teeth actually engage, a spoked flywheel, a steam cylinder on a real slider-crank and the overhead line shaft that belts the lot together, all 1.25 from the rail so the cars pass a metre from the teeth. Compiled with the ride's own rules (`profile: 'coaster'`, `type: 'steel'`, bank **0.18** — a dark-ride car does not lean) and run at `speedScale` **0.70**. Verified compile-only before shipping: design clean with **ZERO** violations, worst clearance **2.39**, **ZERO** synthesized closure, peak grade 18.1°, **41.3 u** of circuit, a **14.3 s** lap, E 1.11 / I 1.03 / N 0.35 — **gentle**, which is what a family dark ride should score. Mounted a half-turn round so the machinery is the near side of the loop and the station recedes behind it; note the back-only gantry roof — a full roof reads as a closed shed at this camera elevation and hides everything under it.",
      render: () => (
        <ScenePreview
          distance={16}
          targetY={1.5}
          height={360}
          autoRotate={false}
          dress={(t, g, api) => {
            cinderYard(17)(t, g);
            api.setCameraPose?.([7.4, 6.5, 12.6], [-0.4, 1.35, 0.3]);
          }}
        >
          <GearworksExpress position={[-3.25, -3.7]} rotation={Math.PI} />
        </ScenePreview>
      ),
    },
    {
      name: 'THE GEAR GALLERY — four wheels that really mesh, a flywheel and a piston',
      description:
        "The show, close up. **Four spur gears on one circular pitch** (22 / 11 / 16 / 9 teeth): two gears mesh iff they share the pitch and their axles sit exactly `pitchR(a) + pitchR(b)` apart, so the teeth engage by construction — and each wheel's phase is **solved from its neighbour's live angle every frame** (`φB = θ + π + π/Nb − (Na/Nb)(φA − θ)`), which differentiates to the gear law `ωB = −(Na/Nb)·ωA` and means the interleave can never drift. The flywheel turns at 1.25 rad/s (a 5-second revolution — a big low-speed mill engine) and everything else is geared or belted off that one clock: the line-shaft pulleys, the 22-tooth first wheel through a flat leather belt, and the **steam cylinder** through an exact slider-crank (a rigid rod, the crosshead solved on the cylinder axis, and a piston rod that really slides into the gland). Each belt carries its **one laced splice**, and that splice travels round the loop at the belt's real linear speed — which is what makes a belt read as *running*, since Stage's canvas textures are globally cached and cannot be scrolled. Three live pressure gauges on the bed face the riders; the gaslight over the bay is night-gated.",
      render: () => (
        <ScenePreview
          distance={7}
          targetY={1.3}
          height={480}
          autoRotate={false}
          dress={(t, g, api) => {
            cinderYard(17)(t, g);
            api.setCameraPose?.([1.1, 2.85, 8.5], [-0.95, 1.15, 2.65]);
          }}
        >
          <GearworksExpress position={[-3.25, -3.7]} rotation={Math.PI} />
        </ScenePreview>
      ),
    },
    {
      name: 'THE ENGINE BAY — three pistons at rider height on the elevated leg',
      description:
        "The other half of the show, on the circuit's HIGH leg. Three vertical cylinders on a **three-throw crankshaft at 120°**, so one piston is always at mid-stroke: iron barrels with brass lagging bands, domed heads, relief valves and copper steam feeds off the girder, and under each of them a **rigid connecting rod swinging on its crank pin** with the crosshead solved on the cylinder axis (`crankSlider`, the same exact solution the gallery's horizontal cylinder uses — a piston animated by a bare sine slides, but the rod does not swing, and the swing is what says *reciprocating*). The bay stands 1.6 from the rail with its crankshaft 0.25 BELOW rail height, so the cars go past at rod height: from a seat, the rods are at eye level. Relief-valve puffs cycle between the three cylinder heads off a hashed tick (deterministic — no `Math.random`), and the engine runs at 2.1 rad/s, a 3-second stroke, deliberately quicker than the gallery's big 5-second mill engine.",
      render: () => (
        <ScenePreview
          distance={8}
          targetY={1.6}
          height={440}
          autoRotate={false}
          dress={(t, g, api) => {
            cinderYard(17)(t, g);
            api.setCameraPose?.([12.6, 3.9, 3.6], [5.5, 1.55, 0.1]);
          }}
        >
          <GearworksExpress position={[-3.25, -3.7]} rotation={Math.PI} />
        </ScenePreview>
      ),
    },
    {
      name: 'The Machine Shop (piece composition — a longer run past the pistons)',
      description:
        "Track-piece composition through JSX children (`<Station/><Lift/><Drop/><TurnR/>…`, read with `collectTrackPieces`, which win over the `pieces` prop): the high leg is stretched to **5.0** so the cars spend longer beside the piston frame, and the two solved straights that close the circuit come out at 5.5 (gallery) and 3.8 (return). Measured compile-only: design clean with ZERO violations, worst clearance **2.53**, **ZERO** synthesized closure, 44.5 u, a **15.4 s** lap at `speedScale` 0.70 — still inside the 12-16 s band the park's `sim` gate wants. Both machine bays follow the track: the gear gallery goes on the longest level LOW run and the engine on the longest level HIGH run (`runAt` walks the heading out both ways rather than sampling instantaneous curvature — the first pass scored curvature and parked the engine frame against the 0.8-unit crest straight between two corners). Pin them with `galleryU` / `engineU`.",
      render: () => (
        <ScenePreview
          distance={23}
          targetY={1.5}
          height={360}
          autoRotate={false}
          dress={(t, g, api) => {
            cinderYard(18)(t, g);
            // from the +x/+z quadrant: BOTH machine fronts face this way once the
            // ride is turned a half-turn (the gear gallery looks down +z, the
            // engine bay down +x)
            api.setCameraPose?.([14.4, 10.6, 14.4], [0, 1.4, 0]);
          }}
        >
          <GearworksExpress position={[-3.25, -4.5]} rotation={Math.PI} cars={4}>
            <Station />
            <Straight length={0.4} />
            <Lift height={1.0} length={4.0} />
            <Straight length={0.8} />
            <TurnR angle={90} radius={2.0} />
            <Straight length={5.0} />
            <TurnR angle={90} radius={2.0} />
            <Drop height={1.0} length={4.0} />
            <Straight length={5.5} />
            <TurnR angle={90} radius={2.6} />
            <Straight length={3.8} />
            <TurnR angle={90} radius={2.6} />
            <Straight length={1.4} />
          </GearworksExpress>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
