import React from 'react';
import * as THREE from 'three';
import { mat } from '../Stage';
import { ScenePreview, Station, Straight, TurnR } from '../Park';
import { DeepDrift, buildDivingBell } from './index';

/**
 * The cove's SEA, added by the previews rather than by the ride.
 *
 * Deep Drift is the one ride in this world that digs BELOW its ground datum —
 * the trench needs 4.35 units of depth under a channel that sits 0.60 above the
 * ground — so every preview runs with `ground={false}` (a flat grass disc at
 * y = 0 would lid the fissure like a manhole cover) and gets an ANNULUS of open
 * water instead: a ring whose inner edge tucks under the ride's own rock ledge
 * and whose outer edge runs off to the haze. A disc would have covered the
 * fissure; a ring cannot. The inner radius has to UNDERLAP the ledge (which
 * reaches ~11.2): at 12.6 a ring of bare pale background showed between them and
 * read as a concrete apron round the whole cove.
 */
function seaRing(t: typeof THREE, g: THREE.Group, y = -0.12, inner = 10.6) {
  const ring = new t.Mesh(new t.RingGeometry(inner, 46, 64, 1), mat(t, 0x2c4a5c, { rough: 0.95 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = y;
  ring.receiveShadow = true;
  g.add(ring);
}

const previews = {
  componentName: 'DeepDrift',
  importPath: 'components/DeepDrift',
  previews: [
    {
      name: '3D rig — Bell Trench Drift (LEAD)',
      description:
        "Deep Drift, attraction 2 of Tidewater Hollow: a slow boat ride in TWO ACTS. Act 1 drifts the boats out of the landing stage and THROUGH THE SEA CAVES on the far side of the cove — rock arches they duck under, a long collapsed roof they pass beneath, water dripping off the stalactites, kelp on the ledge and the first faint bioluminescence crusting the wet rock. Act 2 brings them into the iron LOCK HOUSE straddling the trench, where a riveted DIVING BELL takes the boat, and the boat only, 3.6 units down into a fissure in the reef whose walls are alight with anemones, polyp patches and drifting jellies; then the hoist brings it back up and the boat drifts home. The channel is the shared kit's flooded flume trough (buildRideSpline profile 'flume') and the layout is DELIBERATELY LEVEL — not one lift or drop in it, because the only vertical move on this ride is the bell. Compiles CLOSED with zero synthesized track, worst clearance 2.46, 41.65 units of arc.",
      render: () => (
        <ScenePreview
          distance={36}
          targetY={1.2}
          height={560}
          autoRotate={false}
          ground={false}
          background="#8d9296"
          dress={(t, g, api) => {
            seaRing(t, g);
            api.setCameraPose?.([19.5, 15.5, -15.0], [0.2, 0.5, -1.4]);
          }}
        >
          <DeepDrift position={[1.85, 5.7]} />
        </ScenePreview>
      ),
    },
    {
      name: 'The diving bell in the TRENCH (close)',
      description:
        "ACT 2, at the bottom of the stage (`phase0={5}` opens the act machine straight into the descent, so the shot lands in the 6.8-second hold — see Context.md for the wait to render it at). The bell is 3.6 units down in the fissure with the boat and its four riders inside it, hanging on four hoist cables off the headframe sheaves and running on two GUIDE RAILS that carry down from the headgear to the trench floor; its four brass-ringed viewing ports and its crown lamp are lit, bubbles stream off its skirt, and the trench walls either side are crusted with bioluminescent anemones and polyp patches with jellies drifting between them. It descends through a real opening: the swept trough is CUT at the dock (a moon pool 2.92 long by 2.8 wide, the whole bell's plan) and the mouth of the fissure is bulged and plated where it passes, so nothing at all is left for the bell to pass through — measured over the whole 13.8-second stage, zero intersecting triangles and a worst clearance of 0.061 (the guide shoes' running fit on their rails). The bioluminescence is NOT night-gated: a fissure 4.35 units under a rock ledge is dark at noon, so the glow is lerped between a daylight and a night value and never gates to zero (LavaTubeRun's lava rule) — it only gets brighter after dark.",
      render: () => (
        <ScenePreview
          distance={8}
          targetY={-1.6}
          height={520}
          autoRotate={false}
          ground={false}
          background="#8d9296"
          dress={(t, g, api) => {
            seaRing(t, g);
            api.setCameraPose?.([6.0, 3.4, -10.7], [0.0, -2.0, -5.7]);
          }}
        >
          <DeepDrift position={[1.85, 5.7]} phase0={5} />
        </ScenePreview>
      ),
    },
    {
      name: 'The lock house + the bell at the surface (close)',
      description:
        "The same machinery with the hoist UP (`phase0={13.5}` — the boat is a couple of units short of the dock, still drifting in). THE CRADLE PAN IS THE PLUG: 2.72 units of iron channel against the moon pool's 2.92, so it seats with a 0.10 joint at each end, flush with the trough floor, and the channel reads continuous straight through the house. The bell sits on it with its fore-and-aft arches open for the boat to drift into, and its domed crown stands up through the HOIST WELL in the roof — the well is 2.64 × 2.68 because the crown is 2.32 across and the lifting yoke 2.44; the two 0.33 cable slots the roof used to have were never going to let a bell through, and it went through the roof plate instead. The bell is built as 30 riveted PLATE STAVES rather than a lathed cone precisely so those arches can exist, with stepped iron lintels over each opening, three rust-strapped rivet bands, a domed crown with a brass-covered hatch, a crossed lifting yoke and four eyes. Beside the fissure on the ledge: the AIR PUMP house with its flywheel, the hose running up to the headframe, a coil of spare hose and a stack of lead weights — a bell has to breathe.",
      render: () => (
        <ScenePreview
          distance={10}
          targetY={1.4}
          height={500}
          autoRotate={false}
          ground={false}
          background="#8d9296"
          dress={(t, g, api) => {
            seaRing(t, g);
            api.setCameraPose?.([7.6, 4.6, -12.4], [0.0, 0.5, -5.7]);
          }}
        >
          <DeepDrift position={[1.85, 5.7]} phase0={13.5} />
        </ScenePreview>
      ),
    },
    {
      name: 'The sea caves (close)',
      description:
        "ACT 1: the cave reach. Rock closes in on both sides of the channel and comes over the top of it — a free-standing ARCH of three stacked slabs on two rock piers, then the long collapsed roof, then a second arch — with the underside of every span held 1.62 above the rails and every stalactite cut off 1.24 above them, against a boat whose carved prow tops out 0.67 above its own rail and a seated rider's head at about 0.80. Weed fringes hang off the arch, drips fall from the roof, kelp clumps stand on the ledge, and glowing polyp patches crust the wall at the waterline — the cave's hint of what act 2 is about. Nothing here is a coaster tunnel: the boats drift under it at 1.25 units a second and never leave the water.",
      render: () => (
        <ScenePreview
          distance={10}
          targetY={1.0}
          height={500}
          autoRotate={false}
          ground={false}
          background="#8d9296"
          dress={(t, g, api) => {
            seaRing(t, g);
            api.setCameraPose?.([1.2, 3.7, 1.9], [-5.3, 1.0, 0.4]);
          }}
        >
          <DeepDrift position={[1.85, 5.7]} phase0={4.5} />
        </ScenePreview>
      ),
    },
    {
      name: 'The diving bell (close)',
      description:
        "The bell on its own, staged through the preview's `dress` hook in the ride's own channel (floor, walls, rim rails and the water strip at the exact heights buildRideSpline's flooded profile sweeps them) — and the channel is INTERRUPTED, because that is the mechanism. A bell 2.5 units across cannot descend through a channel 1.0 wide, so the ride cuts a MOON POOL 2.92 long out of the swept trough at the dock and stops the wood at each end on an iron head casting; what bridges the gap is the cradle PAN, a 2.72-unit iron caisson with coamings, transverse ribs and its own strip of water that seats flush with the trough floor and goes down with the bell. Local y = 0 is the CHANNEL RAIL, which is why the caller can hang the bell straight off a spline frame and simply move it down. On the two quarters facing you: the GUIDE SHOES, forked brackets that run on the shaft's rails.",
      render: () => (
        <ScenePreview
          distance={5.4}
          targetY={1.0}
          height={460}
          autoRotate={false}
          ground={false}
          background="#8d9296"
          dress={(t, g, api) => {
            // THE CHANNEL IS INTERRUPTED HERE, and that is the point of the
            // shot: the ride cuts a MOON POOL 2.92 units long out of the swept
            // trough at the dock, because a bell 2.5 units across cannot pass
            // through a channel 1.0 wide. Two lengths of the ride's own flooded
            // trough are staged at the profile's exact heights with that gap
            // between them, and the cradle pan — the removable section of
            // channel the bell carries — plugs it.
            const HZ = 1.46; // POOL_HZ
            const L = 3.4;
            [-1, 1].forEach((end) => {
              const cz = end * (HZ + L / 2);
              [-1, 1].forEach((s) => {
                const wall = new t.Mesh(new t.BoxGeometry(0.06, 0.3, L), mat(t, 0x324a3b, { tex: 'wood', repeat: [1, 6], rough: 0.85 }));
                wall.position.set(s * 0.45, 0.63, cz);
                g.add(wall);
                const rail = new t.Mesh(new t.BoxGeometry(0.09, 0.09, L), mat(t, 0x6e6152, { tex: 'wood', repeat: [1, 6], rough: 0.9 }));
                rail.position.set(s * 0.46, 0.78, cz);
                g.add(rail);
              });
              const floor = new t.Mesh(new t.BoxGeometry(0.9, 0.06, L), mat(t, 0x3d5a48, { tex: 'wood', repeat: [2, 6], rough: 0.85 }));
              floor.position.set(0, 0.47, cz);
              g.add(floor);
              const strip = new t.Mesh(new t.BoxGeometry(0.72, 0.03, L), mat(t, 0x447588, { rough: 0.8, opacity: 0.9, emissive: 0x1b2b37 }));
              strip.position.set(0, 0.585, cz);
              g.add(strip);
              // the head casting that stops the wooden channel at the pool edge
              const iron = mat(t, 0x59524a, { tex: 'metal', metal: 0.5, rough: 0.66, bump: 0.05 });
              [-1, 1].forEach((sx) => {
                const jamb = new t.Mesh(new t.BoxGeometry(0.19, 0.62, 0.28), iron);
                jamb.position.set(sx * 0.585, 0.63, end * (HZ + 0.14));
                g.add(jamb);
              });
              const band = new t.Mesh(new t.BoxGeometry(1.5, 0.2, 0.28), iron);
              band.position.set(0, 0.3, end * (HZ + 0.14));
              g.add(band);
              const nose = new t.Mesh(new t.BoxGeometry(1.0, 0.2, 0.48), iron);
              nose.position.set(0, 0.39, end * (HZ + 0.24));
              g.add(nose);
            });
            const bell = buildDivingBell(t);
            bell.position.set(0, 0.6, 0); // local y = 0 IS the rail
            g.add(bell);
            // pulled back from the old 5.4: the pool is 2.92 long and the two
            // lengths of channel either side have to be IN the frame, or the
            // shot cannot show the thing it exists to show
            api.setCameraPose?.([5.4, 3.6, 5.9], [0.0, 1.0, 0.0]);
          }}
        />
      ),
    },
    {
      name: 'Track pieces — Kelp Gallery',
      description:
        'Track-piece composition: a bigger, rounder LEVEL circuit (<Station/><Straight length={4.6}/><TurnR radius={3}/>…) instead of the stock rectangle — 53.0 units of arc, worst clearance 3.12, ZERO synthesized closure. Every bit of the dressing follows the layout: the rock ledge and its tide pools are laid out off the frame scan, the caves are laid along the far reach, and the LOCK HOUSE and the TRENCH re-place themselves on the midpoint of whichever long straight level run lies farthest from the station (pin it with `bellU`). The rule for authoring your own: keep it LEVEL and leave one straight of at least ~4.6 units for the house to straddle.',
      render: () => (
        <ScenePreview
          distance={42}
          targetY={1.0}
          height={500}
          autoRotate={false}
          ground={false}
          background="#8d9296"
          dress={(t, g, api) => {
            seaRing(t, g, -0.06);
            api.setCameraPose?.([23.0, 22.0, 23.0], [0.0, 0.2, -0.8]);
          }}
        >
          <DeepDrift position={[2.85, 7.2]}>
            <Station />
            <Straight length={4.6} />
            <TurnR angle={90} radius={3.0} />
            <Straight length={8.4} />
            <TurnR angle={90} radius={3.0} />
            <Straight length={8.7} />
            <TurnR angle={90} radius={3.0} />
            <Straight length={8.4} />
            <TurnR angle={90} radius={3.0} />
            <Straight length={1.2} />
          </DeepDrift>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
