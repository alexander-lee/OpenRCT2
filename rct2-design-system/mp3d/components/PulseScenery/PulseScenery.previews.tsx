import React from 'react';
import { ScenePreview } from '../Park';
import { LaserTruss, LightTiles, MirrorBallPylon, NeonArch, SpeakerStack } from './index';

// The PULSE DISTRICT scenery set. Preview 0 stages all five pieces as one club
// forecourt by day; previews 1-5 take each piece close up; preview 6 is the same
// forecourt after dark — the HERO shot for this world. Components never render a
// <Stage>: every preview wraps them in <ScenePreview>.

/** the club forecourt, shared by the day and night group shots */
const Forecourt = () => (
  <>
    <NeonArch position={[-0.45, -2.95]} text="PULSE" seed={1} />
    <LightTiles position={[-0.35, -1.25]} count={3} seed={4} />
    <MirrorBallPylon position={[-3.3, -1.0]} seed={2} />
    <LaserTruss position={[2.9, -0.2]} rotation={-0.95} seed={3} />
    <SpeakerStack position={[-2.1, 1.15]} rotation={0.42} count={3} seed={5} />
    <SpeakerStack position={[1.25, 1.5]} rotation={-0.3} count={2} seed={9} />
  </>
);

const previews = {
  componentName: 'PulseScenery',
  importPath: 'components/PulseScenery',
  previews: [
    {
      name: 'The set',
      description:
        "All five Pulse District scenery pieces by day, laid out as a club forecourt: the NEON ARCH (centre back — graphite posts on concrete footings, chrome collars, painted magenta/cyan hazard chevrons, a chorded steel header truss, a real buildNeonSign PULSE marquee on stand-off brackets and a crown of five concentric neon tube arches on chrome shoes), the LIGHT-UP FLOOR TILES as its apron, the MIRROR-BALL PYLON (left — a tapering four-leg steel lattice mast, chorded and cross-braced at six levels, motor drum and a 64-facet silver mirror ball on a chrome spindle), the LASER TRUSS (right — a four-chord box truss on two A-frame legs with concrete ballast, four moving heads panning under it) and two SPEAKER STACKS (touring PA on castored dollies: ported bass bin with two coned woofers, mid cabinet with a live VU ladder and a compression horn, canted horn-flare top box, ratchet strap, cable coil). THE DAYTIME READ IS THE TEST: with every emissive down at 12-20 % the pieces have to read as a nightclub district on FORM alone — concrete, chrome, real cones with dust caps and surrounds, visible truss webs and lattice bracing, painted chevrons and badge plates — and not as grey boxes waiting for dark. Metals all sit at 0.22-0.35 (≥ 0.6 renders near-black with no env map on this Stage).",
      render: () => (
        <ScenePreview distance={13.5} targetY={1.5} autoRotate={false} ground height={560}>
          <Forecourt />
        </ScenePreview>
      ),
    },
    {
      name: 'Neon arch',
      description:
        "The gateway. CLEAR HEIGHT is the whole constraint — the header underside sits at 2.10 so a 0.5-scale guest walks through with balloon room while the thing still reads as a doorway and not a football goal. It BUILDS ON the shared `buildNeonSign` (the same call <Discotron> makes for its marquee) rather than re-inventing tube lettering: PULSE at scale 0.2 over its own dark backboard, bolted to the header top on two stand-off brackets, flickering and night-gating through the sign's own updater and carrying the pack's only marquee PointLight. Above it the CROWN of five concentric neon half-ellipses fires OUTWARD — arch k lights on beat (step − k) — so a pulse visibly runs from the lettering to the outermost tube once per bar, and every arch foot lands in a chrome shoe on the header (a neon tube that levitates is the failure the NeonSign stand-off pins exist to prevent). The header itself is a real chorded truss with zigzag webs, two flood cans hang off its underside aimed at the path, and an LED ladder alternates up each post on the beat.",
      render: () => (
        <ScenePreview distance={7.0} targetY={1.6} autoRotate={false} ground height={520}>
          <NeonArch seed={1} />
        </ScenePreview>
      ),
    },
    {
      name: 'Speaker stack',
      description:
        "<Discotron> already has speaker stacks — single 0.98-tall gloss cabinets with inset woofer cones, bolted to its stage. This is the SAME register and deliberately not that object: it is the hired-in touring rig that got wheeled in and left there. A castored dolly (tyres, hubs, swivel stems), a ported BASS BIN with two 0.145 cones — surround torus, paper cone, dust cap — over a real slot port, a mid cabinet carrying one cone, a four-sided compression-horn throat and a six-rung VU LADDER that climbs with the beat bloom (the piece's 'live' tell at park zoom: a meter that MOVES rather than blinks), a horn-flare top box canted 0.2 rad down at the crowd on a wedge, eight chrome corner protectors per cabinet, recessed flank handles, a ratchet strap holding the stack to the dolly and a cable coil with a plug on the deck. The cones THUMP forward 0.018 on every downbeat; the cabinets stay put. `count` stacks 1-4 boxes, so a park can drop a lone bass bin against a wall or a full triple beside the arch. Zero PointLights.",
      render: () => (
        <ScenePreview distance={3.2} targetY={0.55} autoRotate={false} ground height={470}>
          <SpeakerStack seed={5} rotation={0.4} />
        </ScenePreview>
      ),
    },
    {
      name: 'Mirror-ball pylon',
      description:
        "A faceted mirror ball up a tapering steel lattice mast: four legs raked from a 0.22 spread at grade to 0.10 at the drum, chorded at seven levels with an alternating-hand diagonal in every bay (a stack of hoops with no diagonals reads as a pile of rings, not a mast), painted hazard chevrons round the bottom bay, a junction box and conduit at the foot, then a motor drum, a chrome band and a spindle. The ball is <Discotron>'s recipe at pylon scale: a dark seam core plus 64 mirror tiles on a Fibonacci sphere split into THREE shells that scintillate on hashed beat offsets, with the tint pulled halfway to WHITE — at full palette saturation the shells turn the ball into a rainbow beach ball, where a mirror ball is silver glass CATCHING a colour. Six rotating LIGHT SHARDS come off it: tapered additive shafts each ending in an elongated floor patch, elevations hashed 0.72-1.14 rad so every shard lands on the ground within ~2.4 u instead of smearing glow over the next ride. The ball turns at 0.5 rad/s with a wobble on its pin — absolute clock, because a mirror ball never stops. One night-gated PointLight washes the underside in the beat's dominant colour.",
      render: () => (
        <ScenePreview distance={6.6} targetY={1.6} autoRotate={false} ground height={540}>
          <MirrorBallPylon seed={2} />
        </ScenePreview>
      ),
    },
    {
      name: 'Laser truss',
      description:
        "Discotron's chorded truss RING, straightened into the gantry a club hangs over a plaza. A genuine FOUR-CHORD box truss (two top chords, two bottom, flank posts, an alternating diagonal per bay and top/bottom lacing) on two A-frame legs — splayed tube pairs with horizontal ties, a diagonal and a concrete ballast block under each foot, because a truss that stands on two sticks reads as a washing line. Four moving heads clamp under the lower chord on chrome clamps and stub drops: a yoke base with two arms straddling a gloss housing, a chrome bezel, an emissive lens and a hair-thin additive beam cone. Each head PANS ±1.05 rad on its own hashed rate and breathes its TILT between 0.62 and 1.18 rad below horizontal — a band chosen so every beam terminates on the ground inside ~1.9 u of the centreline rather than raking the surrounding park. Lenses and beams punch on `beatKick`; sixteen LED nodes alternate along the lower chord in two groups; one 48-particle haze vent (the whole pack's particle budget) gives the beams something to bite on, and one night-gated centre downlight puts the colour on the ground.",
      render: () => (
        <ScenePreview distance={7.0} targetY={1.35} autoRotate={false} ground height={520}>
          <LaserTruss seed={3} />
        </ScenePreview>
      ),
    },
    {
      name: 'Light-up floor tiles',
      description:
        "The piece that PROVES the shared clock. Each tile takes a hashed beat-phase offset and a hashed palette offset, steps `PULSE_PALETTE[(beatStep(time, ph) + off) % 4]` once per beat and blooms on <DanceFloor>'s own `0.55 + 0.45·|sin(π(t·2.2 + ph))|` curve at `gain = 0.4 + 1.1·nightK` — the floor's exact three lines, over the cool palette subset, so a patch laid beside the real DanceFloor changes colour on the same frame. On top of that the patch runs a RADIAL RIPPLE: a `beatKick` spike delayed by each tile's ring index, so a bright wave visibly runs outward from the centre once per beat and 5×5 tiles read as one coordinated FLOOR instead of 25 independent blinking squares. Set in a graphite grout plate on a concrete slab inside a chrome kerb with four LED corner studs, plus ONE additive bloom quad a hair above the tiles — at night a lit floor washes the air over it, and without that the patch reads as flat coloured paint. Ankle-high and meant to be walked ON, so it registers NO blocker by default (the same call <TidePool> and <LavaFissure> make); `count` sets tiles per side, 1-8.",
      render: () => (
        <ScenePreview distance={5.4} targetY={0.15} autoRotate={false} ground height={450}>
          <LightTiles count={5} seed={4} />
        </ScenePreview>
      ),
    },
    {
      name: 'The set at night — the hero',
      description:
        "The same forecourt after dark, which is what this world is FOR. Everything on screen is on one 2.2 Hz clock: the arch crown running outward from the marquee, the LED ladders and chord nodes alternating, the mirror ball's three facet shells scintillating on hashed offsets while its shards sweep the grass, the four laser heads panning with their beams punching on the downbeat through the haze, the VU ladders riding the bloom, the woofers thumping, and the tile patch rippling out from its centre — all of it stepping the SAME magenta/cyan/violet/blue PULSE_PALETTE imported from <Discotron>. THREE real PointLights in the whole frame (the marquee's, the ball wash, the truss downlight); every other glow is an emissive material or an additive mesh, which is the only way a neon world fits the ≤4-lights budget. The light show runs on ABSOLUTE time — nothing here is motion-gated, because a club never stops.",
      render: () => (
        <ScenePreview distance={13.5} targetY={1.5} autoRotate={false} ground night height={560}>
          <Forecourt />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
