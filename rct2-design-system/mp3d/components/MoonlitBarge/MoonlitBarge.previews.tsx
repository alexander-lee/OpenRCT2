import React from 'react';
import * as THREE from 'three';
import { mat, mergedBoxes, mergedParts } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { hash01 } from '../ColorKit';
import { ScenePreview, Station, Straight, TurnR } from '../Park';
import { MoonlitBarge, buildMoonlitBargeBoat, buildRuinArch } from './index';

/**
 * THE GLADE FLOOR, added by the previews rather than by the ride.
 *
 * The ride lays its own BANK over its footprint but stops at the rim, so a
 * standalone preview would show that rim against bare `<ScenePreview>` grass.
 * These previews therefore run with `ground={false}` and get a dark leaf-litter
 * disc with a scatter of moss and fern instead — the forest floor Thornwick
 * Glade sits on, so the bank fades into woodland rather than ending on a lawn.
 */
function gladeFloor(t: typeof THREE, g: THREE.Group, r = 30) {
  // the WOOD's own tone, not bare earth: ThornwickGlade carries its forest floor
  // 60 % moss out in the wood, so the disc is mossy-olive and the leaf litter is
  // what DRIFTS on it. Shipped as 0x50442f bare loam, which read as the ride
  // standing on a ploughed field once the plate scatter stopped being tiles.
  const disc = new t.Mesh(new t.CircleGeometry(r, 56), mat(t, 0x424f30, { tex: 'fabric', repeat: [24, 24], rough: 0.98 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.02;
  disc.receiveShadow = true;
  g.add(disc);
  // ⚠️ LUMPS, NOT PLATES. This scatter used to be 260 flat 0.05-thick BOXES lying
  // on the disc, and from the park's ~50° camera they read as exactly what they
  // are: green and brown FLOOR TILES dropped on a lawn — ThornwickScenery's
  // second documented bug, in the one place nobody had looked for it because it
  // is preview staging rather than component geometry. The pack's own rule is
  // `mossLumps` for horizontals (moss is a cushion) and thin plates only on
  // VERTICAL faces, so these are squashed detail-0 icosahedra now. They are also
  // CLUMPED — five lumps in a patch read as ground, one lonely lump per spot reads
  // as confetti — and the litter tone is pulled toward the moss for the same
  // hue-contrast reason the land's own floor was (ThornwickGlade's LOAM note).
  const lump = new t.IcosahedronGeometry(1, 0);
  const litterParts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const mossParts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  for (let k = 0; k < 190; k += 1) {
    const a = hash01(k * 1.9 + 3) * Math.PI * 2;
    const rr = Math.sqrt(hash01(k * 3.7 + 11)) * r;
    const cx = Math.cos(a) * rr;
    const cz = Math.sin(a) * rr;
    const bag = hash01(k * 11.7) > 0.42 ? litterParts : mossParts;
    for (let n = 0; n < 6; n += 1) {
      const h1 = hash01(k * 5.3 + n * 2.7 + 7);
      const h2 = hash01(k * 7.1 + n * 4.3 + 19);
      // ankle-high on a 0.55-tall guest — 0.2-0.5 across, not 0.5-1.5
      const s = 0.1 + h1 * 0.15;
      bag.push({
        geo: lump,
        matrix: new t.Matrix4()
          .makeRotationY(h2 * 3.1)
          .premultiply(new t.Matrix4().makeScale(s, s * (0.34 + h1 * 0.2), s * (0.7 + h2 * 0.6)))
          .setPosition(cx + (h1 - 0.5) * 0.9, 0.015 + h2 * 0.02, cz + (h2 - 0.5) * 0.9),
      });
    }
  }
  const p1 = mergedParts(t, litterParts, mat(t, 0x4b4632, { tex: 'concrete', rough: 0.98, flat: true }), false);
  p1.castShadow = false;
  g.add(p1);
  const p2 = mergedParts(t, mossParts, mat(t, 0x3a5230, { tex: 'fabric', rough: 0.97, flat: true }), false);
  p2.castShadow = false;
  g.add(p2);
  lump.dispose();
}

const previews = {
  componentName: 'MoonlitBarge',
  importPath: 'components/MoonlitBarge',
  previews: [
    {
      name: '3D rig — The Lantern Round (LEAD, night)',
      description:
        "The Moonlit Barge, attraction 2 of THORNWICK GLADE: a slow lantern-lit boat drift with NO drops, no lift and no thrill in it — the charm is the atmosphere. A lantern-hung barge leaves the timber landing stage and drifts a still stone-lined channel at 1.75 units a second: out under the ruined wall, along the WILLOW REACH where twisted trees lean right out over the water, through the BROKEN ARCH straddling the far reach with its bracket lantern and its ivy, past three leaning statue plinths, and home through the TOADSTOOL HOLLOW where the banks are crusted with glow-worms. Motes drift up off the water and a low mist lies on it. The channel is the shared kit's flooded flume trough (`buildRideSpline` profile 'flume') and the layout is DELIBERATELY LEVEL — not one lift or drop piece in it, measured level 0.000. Compiles CLOSED with ZERO synthesized track, worst clearance 1.56, 26.33 units of arc → a 15.05-second lap at the drift speed, which is what `rideDuration: 15` is set from. This is a NIGHT ride: all four of its PointLights are lanterns and every one of them is night-gated.",
      render: () => (
        <ScenePreview
          distance={26}
          targetY={1.0}
          height={560}
          autoRotate={false}
          ground={false}
          background="#3d4147"
          fog={{ near: 36, far: 84 }}
          dress={(t, g, api) => {
            gladeFloor(t, g);
            api.setCameraPose?.([13.0, 10.4, 8.6], [-1.0, 0.4, -2.6]);
          }}
        >
          <MoonlitBarge position={[1.2, 3.2]} phase0={5.6} />
        </ScenePreview>
      ),
    },
    {
      name: 'The broken arch (close)',
      description:
        "The hero of the drift, and the one thing on the ride the barge passes THROUGH: a ruined masonry arch across the channel with a real ring of voussoirs, a keystone wedged proud of it, and the top BROKEN — one voussoir gone (a fern grows out of the gap it left, and the stone itself lies on the bank beside the pier), the parapet snapped off down one haunch. The springing is 0.55 above the channel rail and the inner crown 1.45, against a barge whose lantern hoop tops out 0.93 over the water and a seated rider's head at 0.66. An iron bracket lantern reaches out over the water off the left pier — one of the ride's four real PointLights. Moss furs every horizontal, ivy hangs down both haunches. `phase0={8.19}` with `still` freezes the barge exactly under it (the lap is only 15 s — a drifting barge would be somewhere different in every screenshot).",
      render: () => (
        <ScenePreview
          distance={9}
          targetY={1.1}
          height={520}
          autoRotate={false}
          ground={false}
          background="#3d4147"
          fog={{ near: 30, far: 74 }}
          dress={(t, g, api) => {
            gladeFloor(t, g, 22);
            // threaded 21° off the channel axis, so the camera looks nearly
            // straight down the far reach and THROUGH the arch's opening (the
            // arch is published at ride-local [−1.13, 0.6, −6.05], i.e. world
            // [0.07, 0.6, −2.85] at this mount — see MoonlitBarge/Context.md)
            api.setCameraPose?.([7.8, 3.5, 0.7], [-0.1, 1.0, -2.9]);
          }}
        >
          <MoonlitBarge position={[1.2, 3.2]} phase0={8.19} still />
        </ScenePreview>
      ),
    },
    {
      name: 'The landing stage + the barge alongside (close)',
      description:
        "The timber landing stage: a plank deck on piles with a shingled saddle roof on carved brackets, a moss course along its ridge, two lanterns hung under it (one of them carrying the stage's real light), mooring bollards with a sagging rope loop between them, a notice board and crates of spare lamp glass. The FERRYMAN'S KIT stands behind it: spare punt poles leaning in the corner, a hooped lamp-oil barrel, crates. There is deliberately no second barge — a spare hull cannot lie in the channel (that is where the live one parks when the motion gate closes) and hauled out on the bank it read as a second live boat adrift inside the loop. `phase0={0.74}` with `still` freezes the live barge alongside the deck, at the ride's own `board` point: four seats on two benches (capacity 4 — real GameManager guests fill them through `seatWorld` when the ride is registered, and the decorative riders shown here switch OFF), an iron lantern hoop over them, and a carved FERN SPIRAL on the prow.",
      render: () => (
        <ScenePreview
          distance={7.5}
          targetY={1.0}
          height={500}
          autoRotate={false}
          ground={false}
          background="#3d4147"
          fog={{ near: 30, far: 74 }}
          dress={(t, g, api) => {
            gladeFloor(t, g, 22);
            api.setCameraPose?.([4.3, 3.7, 7.9], [-0.2, 0.85, 3.5]);
          }}
        >
          <MoonlitBarge position={[1.2, 3.2]} phase0={0.74} still />
        </ScenePreview>
      ),
    },
    {
      name: 'The barge (close)',
      description:
        "One lantern-hung barge on its own, staged through the preview's `dress` hook in a short length of the ride's own channel (trough floor, walls, rim rails and the water strip at the exact heights `buildRideSpline`'s flooded profile sweeps them). Built the way a punt is built: VERTICAL SIDES on a flat bottom, so the hull is an ExtrudeGeometry of the plan outline with the interior as a real HOLE — an extruded shape-with-hole is a hollow tube, open top and bottom, which is exactly a hull wall and, unlike a lofted shell, cannot leave a seam. The bottom is a second thinner extrusion of the inner plan and the gunwale is one tube swept along the outer plan, so the rim reads rounded from every angle. Local y = 0 is the hull bottom, so the caller drops it on the water with a 0.03 draught. Four seats on two benches, an iron hoop with three hanging lanterns down the centre aisle, external ribs and a rubbing strake chorded to the taper, and the glade's fern-spiral carving on the prow.",
      render: () => (
        <ScenePreview
          distance={4.4}
          targetY={0.6}
          height={460}
          autoRotate={false}
          ground={false}
          background="#3d4147"
          dress={(t, g, api) => {
            // a length of the ride's own flooded trough, at the profile's heights
            [-1, 1].forEach((s) => {
              const wall = new t.Mesh(new t.BoxGeometry(0.06, 0.3, 6.4), mat(t, 0x4b4e45, { tex: 'concrete', repeat: [1, 12], rough: 0.9 }));
              wall.position.set(s * 0.45, 0.63, 0);
              g.add(wall);
              const rail = new t.Mesh(new t.BoxGeometry(0.09, 0.09, 6.4), mat(t, 0x53442f, { tex: 'wood', repeat: [1, 12], rough: 0.9 }));
              rail.position.set(s * 0.46, 0.78, 0);
              g.add(rail);
            });
            const floor = new t.Mesh(new t.BoxGeometry(0.9, 0.06, 6.4), mat(t, 0x5f6257, { tex: 'concrete', repeat: [2, 12], rough: 0.9 }));
            floor.position.set(0, 0.47, 0);
            g.add(floor);
            const strip = new t.Mesh(new t.BoxGeometry(0.74, 0.03, 6.4), mat(t, 0x2c4a52, { rough: 0.8, opacity: 0.92, emissive: 0x16241f }));
            strip.position.set(0, 0.585, 0);
            g.add(strip);
            const barge = buildMoonlitBargeBoat(t);
            barge.position.set(0, 0.57, 0); // hull bottom 0.03 under the water
            g.add(barge);
            api.setCameraPose?.([2.7, 1.7, 2.9], [0.0, 0.55, 0.0]);
          }}
        />
      ),
    },
    {
      name: 'The ruin arch (close, standalone)',
      description:
        "`buildRuinArch` on its own, exported so a park can dress its own glade waterway with it. Local frame: +x is ACROSS the channel (the piers stand at ±0.9, clear of the 0.45 half-width channel and its trough walls), +z is the channel direction, and y = 0 is the CHANNEL RAIL — so the caller hangs it straight off a spline frame with no extra arithmetic. The piers are stacked blocks hashed in size and yaw with a footing buried 0.62 deep, the ring is 13 voussoirs on a real circle with one MISSING, and the extrados course is snapped off down the right-hand haunch. `userData.lampAt` is where the caller may hang a real PointLight; `userData.crownY` is the inner crown height.",
      render: () => (
        <ScenePreview
          distance={5.6}
          targetY={1.25}
          height={440}
          autoRotate={false}
          ground={false}
          background="#3d4147"
          dress={(t, g, api) => {
            gladeFloor(t, g, 8);
            const arch = buildRuinArch(t, { seed: 3 });
            arch.position.y = 0.6; // local y = 0 IS the rail
            g.add(arch);
            api.setCameraPose?.([3.5, 2.6, 3.7], [0.0, 1.2, 0.0]);
          }}
        />
      ),
    },
    {
      name: 'Track pieces — The Long Reach',
      description:
        'Track-piece composition: a longer, rounder LEVEL circuit through JSX piece children (<Station/><Straight length={1.6}/><TurnR radius={1.9}/>…) instead of the stock rectangle — 28.31 units of arc, worst clearance 1.70, footprint 9.70 × 6.10, measured level 0.000, ZERO synthesized closure. Every bit of the dressing follows the layout off the frame scan: the bank and the stone revetment are laid along the compiled frames, the lantern posts and the trees re-place themselves on the OUTBOARD side, and the BROKEN ARCH re-picks the midpoint of whichever long straight level run lies farthest from the landing stage (pin it with `archU`). The rule for authoring your own: keep it LEVEL (no `lift`, no `drop`), leave one straight of at least ~2 units for the arch to straddle, land the last piece 0.3 u short of the station ON its axis (`station 2.6 + lead + tail + 0.3 = the opposite leg`, and the two side legs equal), and keep the arc near 26 units — the lap is arc ÷ 1.75 u/s and `rideDuration` has to match it (this one laps in 16.2 s).',
      render: () => (
        <ScenePreview
          distance={32}
          targetY={0.9}
          height={500}
          autoRotate={false}
          ground={false}
          background="#3d4147"
          fog={{ near: 42, far: 96 }}
          dress={(t, g, api) => {
            gladeFloor(t, g, 34);
            api.setCameraPose?.([16.0, 14.0, 12.0], [-1.6, 0.2, -3.4]);
          }}
        >
          <MoonlitBarge position={[1.6, 4.0]} phase0={3.0}>
            <Station />
            <Straight length={1.6} />
            <TurnR angle={90} radius={1.9} />
            <Straight length={2.3} />
            <TurnR angle={90} radius={1.9} />
            <Straight length={5.9} />
            <TurnR angle={90} radius={1.9} />
            <Straight length={2.3} />
            <TurnR angle={90} radius={1.9} />
            <Straight length={1.4} />
          </MoonlitBarge>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
