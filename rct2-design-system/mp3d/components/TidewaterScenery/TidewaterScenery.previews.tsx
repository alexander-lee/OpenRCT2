import React from 'react';
import { ScenePreview } from '../Park';
import { AnchorPile, CoralCluster, DockPilings, TidePool, WreckedHull } from './index';

// The Tidewater Hollow scenery set. Preview 0 stages all five pieces in one
// cove group shot; previews 1-5 take each piece close up; preview 6 is the same
// group after dark. Components never render a <Stage> — every preview wraps
// them in <ScenePreview>.

/** the cove group, shared by the day and night group shots */
const Row = () => (
  <>
    <WreckedHull position={[-2.12, 0.99]} rotation={0.55} seed={3} />
    <DockPilings position={[-0.87, -0.49]} rotation={0.6} seed={5} />
    <TidePool position={[0.38, 1.2]} seed={4} />
    <AnchorPile position={[1.24, -1.34]} rotation={-0.6} seed={2} />
    <CoralCluster position={[2.62, -0.72]} rotation={0.7} seed={7} />
  </>
);

const previews = {
  componentName: 'TidewaterScenery',
  importPath: 'components/TidewaterScenery',
  previews: [
    {
      name: 'The set',
      description:
        'All five Tidewater Hollow scenery pieces by day: the WRECKED HULL (back left — a broken hull section half-buried in sand, planking torn away to a diagonal edge, curved frames standing bare, raked stem and a snapped bowsprit, barnacle crust along the old waterline), the DOCK PILINGS (four leaning salt-scoured piles with a lashed crossbeam and a fishing net draped off it), the TIDE POOL (a rock basin holding still water, with starfish, limpets and weed), the ANCHOR AND CHAIN PILE (a rusted admiralty anchor leaning back over a coiled heap of thick chain) and the CORAL CLUSTER (branching and brain corals and sea fans on a dead-coral reef head). The palette is salt-weathered throughout: silvered driftwood grey, algae-dark damp timber, tar black, rust orange-brown over pitted iron, wet sand, barnacle chalk. NOTHING here glows — no emissive surface and no PointLights at all — and there are no particles; the coral is the only colour in the world and it is BLEACHED (dusty rose, muted ochre, dull violet), never a fluorescent reef.',
      render: () => (
        <ScenePreview distance={6.6} targetY={0.4} autoRotate={false} ground height={430}>
          <Row />
        </ScenePreview>
      ),
    },
    {
      name: 'Wrecked hull section',
      description:
        'THE PLAN TAPER is the whole piece. A constant-radius arc extruded along a keel is a barrel: from the park camera it has no bow, and two passes of this wreck read as a dinosaur ribcage for exactly that reason. The sections now narrow toward both ends (0.44 at the stem), which gives the hull a POINTED PLAN — and because the radius shrinks while the section centre stays put, the keel rockers up toward the stem the way a real one does. Both flanks stay planked and both are torn: the surviving top edge runs as a diagonal from an almost-intact bow down to ~1.0 rad aft, with the frames standing past it (an earlier tear ran the planking below ground and left a bare skeleton). Strakes are boxes rotated so their local +y is the arc tangent, hashed-warped off flush, switching to algae-dark timber below the waterline, where a tight BAND of barnacles sits — barnacles only colonise the strip that was awash. The ship cues that earn their keep, in order: the taper, the WALE following the sheer, the raked stem with its snapped bowsprit stub, and the FOREDECK (five boards, middle one missing for an open hatch) which is what closes the read from directly above. Tar flakes are kept small on purpose: run across whole plank faces they read as black portholes.',
      render: () => (
        <ScenePreview distance={3.5} targetY={0.35} autoRotate={false} ground height={430}>
          <WreckedHull seed={3} />
        </ScenePreview>
      ),
    },
    {
      name: 'Coral cluster',
      description:
        'Coral reads by SILHOUETTE, so each kind is built as its own structure rather than as a lump with a colour on it: three recursive BRANCHING clumps (a fork that keeps forking three levels deep, every child biased upward because coral grows toward the light, with a knuckle at each joint and a blunt club knob at each tip — a tapered point reads as a thorn), three grooved BRAIN domes on a local procedural canvas of meandering ridge-and-valley lines (whole cycles in x so it wraps the dome; also the bump map), set a third of their radius proud of the rock because sunk flush the grooves simply hide, and three lacy SEA FANS of nine radial rods with cross-lace, splayed wider than they are tall — a solid fan plate at this size reads as a spade and a 7-rod fan of 0.01 twigs read as cobweb. It all roots in NINE small flattened lumps of dull grey-tan reef rock: one big dome read as a boulder with twigs stuck in it, and coral-bone white rock washes out every bleached tone standing on it. The rods carry no texture map at all — at ~0.01 u across any tile is sub-pixel at park zoom.',
      render: () => (
        <ScenePreview distance={2.1} targetY={0.32} autoRotate={false} ground height={410}>
          <CoralCluster seed={7} />
        </ScenePreview>
      ),
    },
    {
      name: 'Anchor and chain pile',
      description:
        'An admiralty anchor is a very specific silhouette and every part has to be there or it reads as a plus sign: shank, crown, two arms sweeping up out of the crown along a real circular ARC, a flat triangular PALM on each arm end, the STOCK crossbar set at right angles to the arm plane (this is the part that makes it "admiralty"), and the ring with its shackle — all on heavy scantlings, because a thin shank reads as a garden ornament. It leans back at 0.72 rad with a palm dug into the sand and the shank resting across the chain. The chain is real interlocking links: a torus stretched 1.55x along the run with ALTERNATE links standing at 90 degrees to their neighbours, which is the entire read of a chain, laid along 3.4 turns spiralling in and UP into a heap (a flat spiral reads as a coil of rope) and then a sagging run that climbs to the ring. Iron is the local RUST canvas — blotchy orange-brown blooms, flaked scale edges, 260 deep pits, a few pale salt blooms — as map and bump at roughness 0.94, because pitted rust is not shiny, tiled one 128² per ~0.25 u so the pits stay several pixels across at park zoom. The salt bloom lives in that canvas and not on the ground: pale flat plates scattered on sand read as dropped paper.',
      render: () => (
        <ScenePreview distance={2.2} targetY={0.3} autoRotate={false} ground height={410}>
          <AnchorPile seed={2} />
        </ScenePreview>
      ),
    },
    {
      name: 'Tide pool',
      description:
        'The water is WaterTile’s `buildWater` used AS IS at amp 0.10 x waviness 0.25 — about 0.008 u of swell, which is what a rock pool does between waves — because its 2026-07 desaturated blue-grey palette is already exactly right for cold water over dark rock: no hand-rolled shader, no re-saturation. Four things make it read as water in a basin and all four are here: something to see THROUGH it (a pale wet-sand floor, since a light bottom is what makes shallow water read as shallow, plus 26 pebbles); a RIM standing above the sheet, 15 lumps spread over 0.64–0.98 R with real gaps in the lip (the first pass — 17 near-identical boulders at one radius — read as a campfire ring, and the flat slabs mixed in to break it up were boxes and read as kerbstones, so everything is a squashed icosahedron now), plus seven half-buried rocks out on the shelf so the piece is not two concentric discs; three rocks standing IN the pool and breaking the surface, the cheapest cue there is that the water is ankle-deep; and a darker, slicker WET FRINGE the water laps over. Life: three starfish (one out on the bare shelf at 0.11 across — 0.072 vanished at park zoom), 22 limpets on the rim tops, and bladderwrack in four TUFTS of five blades, because scattered singles read as green confetti. Flat and ankle-deep, so it registers NO blocker — scatter it along paths.',
      render: () => (
        <ScenePreview distance={2.0} targetY={0.16} autoRotate={false} ground height={410}>
          <TidePool seed={4} />
        </ScenePreview>
      ),
    },
    {
      name: 'Dock pilings',
      description:
        'Four piles at four heights and four leans — parallel piles read as a fence, and the point of a derelict jetty is that nothing is plumb. Creosote-and-algae dark for the bottom 0.30, silvered driftwood above, a tight barnacle band at the old waterline, and three different tops on purpose (snapped into splinters, a rusted iron cap band, sawn flat). The CROSSBEAM is lashed across the two tallest with three rope turns and a through-bolt at each join — that bit of ironmongery is what says "jetty" rather than "two sticks and a plank" — with more wraps up the shafts and a catenary rope loop to a third pile. The NET took three passes: a 7x6 grid of 0.0075 strands was invisible from three metres; nine columns against seven rows made the mesh 2.5x denser vertically and it read as a CAGE, so both counts now come from one target spacing; and even square cells in a constant-width rectangle read as a trellis panel, so the drape is GATHERED at the head rope and fans out below it, bulges toward the viewer, pools out on the sand, carries a heavier lead line and cork floats, and is missing a few strands because an old net has holes. Which side it hangs on is part of the contract — always the piece’s local +Z hemisphere, so `rotation` aims it (here 0.6, to turn it toward the camera). It swings ±0.022 rad about the beam on a ~11 s absolute-time updater; nothing else in the cove moves but the water.',
      render: () => (
        <ScenePreview distance={2.6} targetY={0.6} autoRotate={false} ground height={440}>
          <DockPilings seed={5} rotation={0.6} />
        </ScenePreview>
      ),
    },
    {
      name: 'The set at night',
      description:
        'The same cove after dark, and there is deliberately NOTHING to light it with: this world has no emissive surface and no PointLights at all, so the moonlit read has to come from form alone — the wreck as a black arc of frames, the pilings and their net as a silhouette, the barnacle crust and the salt bloom on the iron as the only pale values left. The tide pool keeps just enough sky in it to read as water (WaterTile’s sheet moonlight-dims itself through `nightKOf`). The net keeps swinging; nothing else moves.',
      render: () => (
        <ScenePreview distance={6.6} targetY={0.4} autoRotate={false} ground night height={430}>
          <Row />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
