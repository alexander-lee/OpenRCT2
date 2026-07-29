import React from 'react';
import { ScenePreview } from '../Park';
import { FlowerPodBed, GiantToadstools, LanternTree, RuinedArch, StandingStones } from './index';

// The Thornwick Glade scenery set. Preview 0 stages all five pieces in one
// clearing group shot; previews 1-5 take each piece close up; previews 6-7 are
// the group and the pod bed after dark, which is when this world is at its
// best. Components never render a <Stage> — every preview wraps them in
// <ScenePreview>.

/** the glade clearing, shared by the day and night group shots */
const Clearing = () => (
  <>
    <RuinedArch position={[-3.05, -0.45]} rotation={0.42} seed={4} />
    <LanternTree position={[-1.0, -2.5]} seed={3} />
    <GiantToadstools position={[0.95, -0.3]} seed={1} />
    <StandingStones position={[3.3, -1.9]} seed={2} />
    <FlowerPodBed position={[2.35, 0.5]} seed={5} />
  </>
);

const previews = {
  componentName: 'ThornwickScenery',
  importPath: 'components/ThornwickScenery',
  previews: [
    {
      name: 'The set',
      description:
        'All five Thornwick Glade scenery pieces by day: the RUINED ARCH (back left — a real thirteen-voussoir ring with one stone missing, a fern in the gap, the keystone wedged proud, the extrados course snapped off one haunch, ivy down both, an iron bracket lantern reaching out over the path), the LANTERN TREE (a twisting trunk on six root flares hung with four wrought-iron cage lanterns, bracket fungi stepping up it, moss on its shaded side), the GIANT TOADSTOOLS (the world’s signature: house-high stools with real domed caps, rolled rims, radial gills, warty crowns, an annulus skirt on the big ones, and one pale cap that glows), the STANDING STONES (five mossy megaliths built as stacks of split blocks, one fallen and half sunk, one snapped off with the piece at its foot, carved spiral runes on the tallest) and the FLOWER POD BED (glowing pods on nodding stalks, some open with a lit core, some still tight buds). The palette is the glade’s own — THORNWICK, imported from WyrmsHollow: lichen-grey masonry, three greens of moss and ivy, root brown, and the warm lantern amber, with cap red, dusk violet and glow-worm green as the only living colour.',
      render: () => (
        <ScenePreview distance={9.4} targetY={1.15} autoRotate={false} ground height={460}>
          <Clearing />
        </ScenePreview>
      ),
    },
    {
      name: 'Giant toadstools',
      description:
        'MoonlitBarge’s toadstool hollow is ground cover with caps 0.1 across; this is the same species grown to house height, which forces it to answer the two questions a small one never does — what does the underside look like, and what is holding it up. So every stool has a BULBOUS FOOT and a curved tapering stipe (built as a bending limb: it leans out of the clump and straightens, and no two are parallel), an ANNULUS — the torn skirt of the veil — on anything over half size, a real DOME cap (a sphere cut a little past its equator then squashed; a cone reads as a traffic bollard) with a rolled RIM torus so the cap has thickness instead of reading as a bowl, and RADIAL GILL BLADES under it, because at this scale the underside is the first thing a park camera sees when it looks up and a blank disc there loses the whole illusion. Hashed cream WARTS on the crowns say amanita. One cap per clump is the pale glowing one — a muted bone diffuse that happens to be emissive, so it lights the clump after dark without reading as a white blob at noon — and glow-worms spiral up the hero stipe and scatter through the loam ring. Three BABY STOOLS at the feet are what make the giants read as giants; a fallen cap lies upside-down in the moss with its gills to the sky.',
      render: () => (
        <ScenePreview distance={3.4} targetY={0.8} autoRotate={false} ground height={430}>
          <GiantToadstools seed={1} />
        </ScenePreview>
      ),
    },
    {
      name: 'Standing stones',
      description:
        'A megalith is not a box. Each stone is a STACK of three to five hashed blocks under one lean, tapering as it rises the way a split slab does, so the silhouette steps and bulges and none of them is plumb. One stone is FALLEN — flat, half sunk, moss growing over its upper face — because a complete ring reads as a fence and one gap is the whole difference between "ruin" and "boundary marker"; another is SNAPPED OFF with the broken piece lying at its foot, since a short stone with nothing beside it just reads as a short stone. Moss goes on ONE side and on the horizontals (a stone furred evenly all round reads as topiary), pale lichen flecks crust every face, and a little kerb of packed earth stones plants each foot. The night payoff costs no PointLight: an archimedean SPIRAL of carved runes with three chevrons under it, down the tallest stone’s inward face, in a material whose emissive is lerped by nightKOf — a shadowed carving by day, the only cold light in a warm-lantern world after dark. That rune mesh is deliberately NOT tagged lodDetail, because MID-tier LOD would shed the piece’s entire night read at exactly park distance.',
      render: () => (
        <ScenePreview distance={3.6} targetY={0.65} autoRotate={false} ground height={430}>
          <StandingStones seed={2} />
        </ScenePreview>
      ),
    },
    {
      name: 'Lantern tree',
      description:
        'The trunk is a bending, TWISTING limb — its lean direction rotates as it climbs and eases toward vertical, so the silhouette is never a pole — standing on six tapered root buttresses with five surface roots crawling out over the loam. Five branches all reach up and OUT, each carrying THREE small flattened canopy lumps rather than one big sphere: few large spheres read as a lollipop whatever you rotate them to (MoonlitBarge’s willow lesson). The lanterns are the point. Wrought-iron cages of four uprights leaning IN toward a peaked cap (a straight cage reads as a crate), with glazing bars, a base tray, a finial and a hanging hoop, hung on hooks off the LOWEST branches first so the light lands where guests walk instead of up in the canopy. Unlike the glow-worms, a lantern is a LAMP: its glass gates hard to dark by day, because a lamp with no flame in it is just a glass ball. Only the first two carry a real PointLight (parented INTO the fitting, so it follows any placement with no world-space arithmetic); the rest are emissive glass alone. Bracket fungi step up the trunk, a knot hole sits in it, moss furs the shaded side only, and ivy — buildIvyStrand, shared from WyrmsHollow, never a second copy — hangs off three branches.',
      render: () => (
        <ScenePreview distance={6.4} targetY={1.5} autoRotate={false} ground height={480}>
          <LanternTree seed={3} />
        </ScenePreview>
      ),
    },
    {
      name: 'Ruined arch',
      description:
        'The one number that matters is makeRotationZ(-a), NOT a - pi/2. A voussoir’s long axis has to lie along the ring’s TANGENT — that is what makes its joints radial — and since the tangent at ring angle a is (sin a, cos a) while a Z rotation by theta sends a box’s own +Y to (-sin theta, cos theta), theta = -a. MoonlitBarge’s first pass used a - pi/2, which is 90 degrees out: every stone pointed along its own RADIUS and the "arch" rendered as a scatter of slabs standing on end with no ring in it at all. Its Context.md recorded that, so this build was written with -a from the first keystroke. An intact arch in a ruin is a GATE, so: thirteen voussoirs with ONE MISSING (a fern grows out of the gap, and the stone itself lies on the ground beside the pier with the rubble it broke into), the keystone wedged proud, the extrados course snapped off down the far haunch, moss on every horizontal including a cap on the keystone, ivy down both haunches, and an iron bracket lantern reaching out over the path. Note the frame: unlike the barge’s channel arch, whose local y = 0 is the water RAIL, this one’s y = 0 is the GROUND — a park drops it straight onto floorAt — and local +x is ACROSS the opening, so rotation aims it along the path. Its blockers are the two PIERS, never the span: an arch you cannot walk through is a wall.',
      render: () => (
        <ScenePreview distance={3.9} targetY={0.85} autoRotate={false} ground height={440}>
          <RuinedArch seed={4} />
        </ScenePreview>
      ),
    },
    {
      name: 'Flower pod bed',
      description:
        'The glade’s ground-level light source, and the piece that gets scattered most. What makes it read as a bed of LIVING things rather than a row of bulbs is that the pods are at three different stages: OPEN ones with five sepals folded right back and DOWN off a bright core ball (an opened calyx hangs off a flower, it does not stand up) with four pale violet petals splayed above; HALF ones whose calyx is still closed over the core, so the light only leaks out of the seams and the shape reads as a bud, glowing at a third the intensity; and two or three SPENT buds with no glow at all, which are exactly what stop the bed reading as a light fixture. Every stalk NODS — it leaves the ground upright and bends over at the top, which is what makes a pod look heavy and alive. Broad low leaves lie almost flat on the loam underneath, with moss plates and pebbles. The glow is emissive and lerped by nightKOf, never gated to zero (a pod is alive at noon, it is just outshone), plus one low opt-out PointLight; each stage breathes at its own rate so the bed is not one bulb. There are NO particles: pollen motes would be lovely, but this piece is meant to be scattered a dozen times and the park’s particle budget is global — the same call Tidewater made for spray. Flat and ankle-high, so it registers NO blocker unless asked.',
      render: () => (
        <ScenePreview distance={2.1} targetY={0.24} autoRotate={false} ground height={420}>
          <FlowerPodBed seed={5} />
        </ScenePreview>
      ),
    },
    {
      name: 'The set at night',
      description:
        'The same clearing after dark, which is what this world was built for and the reason it does not follow Tidewater’s no-emissive discipline. Three different KINDS of light, on purpose: the LANTERNS (the tree’s four and the arch’s one) are real lamps and gate hard to dark by day, so the difference between the two group shots is that they come ON; the GLOW-WORMS, the pale toadstool cap, the carved runes and the flower pods are ALIVE and only LERP between a day and a night value, never reaching zero — EmberfallScenery’s lava rule applied to living light, because a glow-worm is alive at noon, it is just outshone. Real PointLights are rationed hard (two in the tree, one in the arch, one under the glowing cap, one over the pod bed) since a scenery piece gets placed a dozen times in a park; every other glowing surface is emissive only. Each glow material breathes on its own phase and rate, so the clearing never pulses as one bulb.',
      render: () => (
        <ScenePreview distance={9.4} targetY={1.15} autoRotate={false} ground night height={460}>
          <Clearing />
        </ScenePreview>
      ),
    },
    {
      name: 'Pods and stones at night (close)',
      description:
        'The pod bed and the megalith ring together after dark, close enough to read what the glow is actually doing: the open pods’ bare cores burning, the half-closed buds leaking a third as much through their sepals, the spent buds dark, and the runes awake on the tallest stone in the cold rune green against the pods’ warmer yellow-green. Glow-worms sparkle through the moss around both. Nothing here is a PointLight except one low lamp over the bed — everything else in this frame is emissive surface.',
      render: () => (
        <ScenePreview distance={3.4} targetY={0.5} autoRotate={false} ground night height={430}>
          <FlowerPodBed position={[-0.75, -0.15]} seed={5} />
          <FlowerPodBed position={[0.5, 0.5]} seed={12} count={5} radius={0.44} />
          <StandingStones position={[1.35, -1.1]} seed={2} radius={0.7} height={1.15} />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
