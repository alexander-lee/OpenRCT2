import React from 'react';
import { box } from '../Stage';
import { ScenePreview, Station, Lift, Drop, TurnR, Straight } from '../Park';
import { ReefRacer, buildReefBoat } from './index';

const previews = {
  componentName: 'ReefRacer',
  importPath: 'components/ReefRacer',
  previews: [
    {
      name: '3D rig — Wreck Reef Run (LEAD)',
      description:
        "Reef Racer, the flagship of Tidewater Hollow: an RCT2 WATER COASTER threading a shipwreck cove. The boats climb ONE steep 34.8° chain lift out of the reef lagoon (WaterCoaster.h enables liftHill AND slopeSteepUp, where LogFlume.h:26 / SplashBoats.h:27 only have slopeSteepDown — so this is a chain lift, not a log flume's long gentle conveyor), run the summit along the reef crest past a channel-marker beacon, give all 5.6 units back in ONE 34.8° plunge — ducking under the hanging YARD of a second, older wreck 0.6 u before the lip (0.303 of measured daylight over the boat) — and come home THROUGH the stove-in side of a broken sailing ship. Her severed BOW SECTION is reared up on a coral head at the foot of the plunge with the bowsprit spearing right across the channel. The channel itself is the Water Coaster's own FLOODED drawer (TrackStyle::splashBoats on wooden truss supports) so the boats are always in water; the lagoon is one buildWater sheet over the component's own pale coral-sand bed, and the turquoise read comes from the pale bed under it — WaterTile's desaturated palette is untouched. The waterline sits ONE RCT2 land step (0.30) above the surrounding ground, just under the sand apron's crest, because a component cannot dig: the host's own surface would occlude any floor put below it, so the basin is built UP as a dish and the reef is submerged in it rather than standing on it. The sheet's clip ellipse is deliberately 1.16x the cove's, and its own vertices are TUCKED under the beach and the station apron wherever the sand stands above the waterline, so the shore is a shoreline and not a sawtooth. Compiles CLOSED with zero synthesized track, worst clearance 3.56, design report clean.",
      render: () => (
        <ScenePreview
          distance={40}
          targetY={2.0}
          height={560}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([23.5, 24.0, -23.5], [0.0, 1.5, 0.0])}
        >
          <ReefRacer position={[6.1, 6.5]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Through the wreck (close)',
      description:
        "The signature: a broken sailing ship lying across the home stretch, listing 9° to starboard, half-buried on the reef — and the channel running STRAIGHT THROUGH her. The gash starts below the waterline (which is why she sank) and runs up to the deck line; the hull is lofted in Z BANDS, so the hole is a real absence of planking rather than a decal, with full frames standing at each edge, snapped frame stubs in the flooded hold between them, and broken DECK BEAMS bridging the passage overhead (underside 2.0 above the waterline — half a unit of daylight over the boat's carved prow). A ship's lantern hangs off a davit over the exit. Above: the snapped mainmast with its splintered crown, the mizzen stump, the fallen topmast down across the starboard quarter into the water, a yard hanging by one lift with three shredded sails on it, and shrouds to deadeyes on the channels. Aft: a cambered deck with a hatch off its seat, a capstan with a bar still shipped, bitts, a staved cask, and a transom with brass-framed quarter windows and the rudder swung off its pintles.",
      render: () => (
        <ScenePreview
          distance={16}
          targetY={1.4}
          height={500}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([5.0, 9.0, 12.2], [0.0, 1.3, -1.2])}
        >
          <ReefRacer position={[-3.55, 6.5]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Under the bowsprit (close)',
      description:
        "The foot of the plunge: the boat splashes down in a burst of foam and droplets, then shoots UNDER the bowsprit of the ship's severed bow section, reared up on a coral head with her stem 1.75 above the water. The bowsprit is built in ride-local space rather than on the hull, so its clearance is exact BY CONSTRUCTION — the spar runs from her stem head through a point 1.55 above the channel centreline and 1.4 units past it, with a jibboom lashed on beyond the tip, rusted iron bands, a bobstay chain sagging back to the stem, a footrope, a shred of jib canvas and a rusted lantern hanging right over the boats. Under the bowsprit: a weathered carved figurehead, catheads, bow bitts and the foremast snapped off just above the deck; aft of that, the ragged break where she tore in two, with full frames and splintered planking.",
      render: () => (
        <ScenePreview
          distance={9}
          targetY={1.4}
          height={480}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([4.4, 5.6, -4.2], [-0.3, 1.1, 0.3])}
        >
          <ReefRacer position={[2.9, 11.3]} />
        </ScenePreview>
      ),
    },
    {
      name: 'The reef skiff (close)',
      description:
        "The vehicle on its own (`buildReefBoat`, staged through the preview's `dress` hook in a short length of the ride's own channel — floor, walls, rim rails and the water strip at the exact heights buildRideSpline's flooded profile sweeps them). A clinker-built reef skiff, four riders abreast on hewn thwarts: a real lofted hull of 15 cross-sections from a canoe stern to a raked stem, with rocker in the bottom (0.135 — what clears the plunge's pull-out) and sheer in the gunwale, split into three lofts so it carries a hard boot-top line — brine-green painted topsides above TARRED near-black planking below the waterline. Then swept cut-wood gunwale caps and a tarred boot-top batten, two BRASS bands chorded round the sections, a brass stem cap and mooring ring, a carved MARLIN prow (head, bill, dorsal and pectorals, every piece leaning the same way forward over the water), a tarred sole of boards, four thwarts with back lips, a coil of rope in the bow and a brass stern lantern on a short jackstaff. Wood grain runs fore-and-aft on every loft, because the UVs are (girth, along-z) — it reads as planking, not as a texture wrapped round a tube.",
      render: () => (
        <ScenePreview
          distance={3.0}
          targetY={0.6}
          height={430}
          autoRotate={false}
          ground={false}
          background="#8d9296"
          dress={(t, g, api) => {
            g.add(box(t, [0.9, 0.06, 2.7], 0x3d5a48, [0, 0.37, 0], { tex: 'wood', repeat: [2, 6], rough: 0.85 }));
            [-1, 1].forEach((s) => {
              g.add(box(t, [0.06, 0.3, 2.7], 0x324a3b, [s * 0.45, 0.52, 0], { tex: 'wood', repeat: [1, 8], rough: 0.85 }));
              g.add(box(t, [0.09, 0.09, 2.7], 0x6e6152, [s * 0.46, 0.66, 0], { tex: 'wood', repeat: [1, 8], rough: 0.9 }));
            });
            g.add(box(t, [0.72, 0.03, 2.7], 0x447588, [0, 0.485, 0], { rough: 0.8, opacity: 0.9, emissive: 0x1b2b37 }));
            const boat = buildReefBoat(t);
            boat.position.set(0, 0.72, 0); // = the channel centreline 0.47 + wheelOffset 0.25
            g.add(boat);
            api.setCameraPose?.([1.72, 1.36, 1.98], [0.02, 0.6, 0.02]);
          }}
        />
      ),
    },
    {
      name: 'The plunge + the lagoon (close)',
      description:
        'Down the drop: 5.6 units at 34.8° off the summit, straight back into the reef lagoon between three leaning REEF FANGS (0.406 of measured clearance to the hull) while a shark works the pool. Also the clearest look at the setting — a reef pool over pale coral sand, 0.30 deep in the middle and shelving to 0.09 at the shore, with SUBMERGED coral heads and reef rock (a few of the tallest heads breaking the surface, and the sand banks that are meant to), ripple ridges on the bed, wreck debris (broken planking, staved barrels, fallen spars, a rusted anchor with one fluke in the air) strewn through the shallows, and the flooded channel carried over all of it on wooden truss trestles standing in the water like pilings. The dry sand BERM ringing the cove is the component\'s own ground: a lattice of overlapping plates at four heights, every one of them quoted relative to the WATERLINE — the dished lagoon bed, an awash wet band, the station spit just clear of the water, and the raised apron whose crest is the basin lip the waterline sits 0.055 under.',
      render: () => (
        <ScenePreview
          distance={18}
          targetY={2.2}
          height={480}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([9.0, 9.0, -13.5], [-1.0, 2.2, 1.4])}
        >
          <ReefRacer position={[5.5, 14.6]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Track pieces — Coral Cut',
      description:
        'Track-piece composition: <Station/> jetty straight, one <Lift/> chain lift straight out of the cove, a WIDE 180° hairpin at its head and ONE <Drop/> plunge back down the far side — a long out-and-back instead of the stock rectangle. The wreck leg length is not free here: the two closing 90° turns have to give back exactly 2·5.6 − 2·2.0 = 7.2 units of z, which is what makes it close with ZERO synthesized track (worst clearance 3.19). Every bit of theming follows the layout: the lagoon ellipse, the sand berm, the coral scatter, the wreck, the bowsprit crossing, the channel marker and the jetty are all placed off frame scans, so a different piece list rebuilds the whole cove around it.',
      render: () => (
        <ScenePreview
          distance={38}
          targetY={1.8}
          height={480}
          autoRotate={false}
          background="#8d9296"
          dress={(_t, _g, api) => api.setCameraPose?.([24.0, 22.0, -20.0], [1.2, 1.4, -0.8])}
        >
          <ReefRacer position={[6.8, 5.6]}>
            <Station />
            <Lift height={3.2} />
            <TurnR angle={180} radius={5.6} />
            <Straight length={1.2} />
            <Drop height={3.2} />
            <Straight length={2.9} />
            <TurnR angle={90} radius={2.0} />
            <Straight length={7.2} />
            <TurnR angle={90} radius={2.0} />
            <Straight length={1.2} />
          </ReefRacer>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
