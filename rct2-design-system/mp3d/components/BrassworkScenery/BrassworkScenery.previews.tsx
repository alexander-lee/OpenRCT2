import React from 'react';
import { ScenePreview } from '../Park';
import { BoilerTank, ClockTower, CoalCart, GiantGear, SteamPipes } from './index';

// The Brasswork Foundry scenery set. Preview 0 stages all five pieces in one yard
// group shot; previews 1-5 take each piece close up; preview 6 is the same yard
// after dark, when the clock dial and the firebox are the only light in it.
// Components never render a <Stage> — every preview wraps them in <ScenePreview>.

// THE ROW RUNS ALONG THE SCREEN, NOT ALONG WORLD X. This Stage's default camera
// sits off at an azimuth where BOTH +x and +z come toward the viewer, so world x
// alone stacks the pieces diagonally and half of them fall off the frame (which
// is exactly what the first two passes of this group shot did). Measured off the
// harness: 100 px right ≈ (+0.76, −0.58) in (x, z) and 100 px DOWN ≈ (+0.85,
// +0.64), so a left-to-right row is a line of INCREASING x and DECREASING z.
/** the yard group, shared by the day and night group shots */
const Yard = () => (
  <>
    <ClockTower position={[-2.12, 1.39]} seed={3} />
    <GiantGear position={[-0.71, 0.96]} rotation={0.34} seed={2} />
    <SteamPipes position={[-0.1, -0.08]} rotation={-0.2} seed={5} />
    <BoilerTank position={[1.31, -0.51]} rotation={1.25} seed={4} />
    <CoalCart position={[1.99, -1.49]} rotation={1.15} seed={7} />
  </>
);

const previews = {
  componentName: 'BrassworkScenery',
  importPath: 'components/BrassworkScenery',
  previews: [
    {
      name: 'The set',
      description:
        'All five Brasswork Foundry scenery pieces by day, left to right: the CLOCK TOWER (a slender riveted octagonal shaft under a verdigris copper spire, four working clock faces reading the same absolute-time clock, a bell in the belfry), the GIANT GEAR (an oversized cast-iron gear on a bearing pedestal, teeth worn and one broken clean off, turning a small pinion at an exact 24 : 10), the STEAM-PIPE CLUSTER (flanged risers, real elbows over the top, two valve handwheels, live gauges and two relief vents puffing steam), the RIVETED BOILER (a horizontal barrel set in brick with its firebox door glowing, safety valve, gauge glass and a smoking chimney) and the COAL CART (a narrow-gauge tipper heaped with coal on spiked track with sleepers and ballast). The palette is muted industrial throughout — aged brass, oxidised copper weeping verdigris, soot-grey iron, coal black, rust — with NO shiny gold anywhere: every metal sits at metalness 0.18-0.34, because a MeshStandardMaterial above ~0.6 with no environment map renders near-black in this Stage, and the brass read comes from colour plus the tarnish canvas instead.',
      render: () => (
        <ScenePreview distance={7.4} targetY={0.62} autoRotate={false} ground height={470}>
          <Yard />
        </ScenePreview>
      ),
    },
    {
      name: 'Giant gear wheel',
      description:
        'A gear reads by its TEETH, so the teeth are the piece: 24 of them, tangential width exactly half the circular pitch, standing 0.15 R proud of a rim built as 24 bolted segments with the SIX SPOKES visible through it — a solid disc is a wheel, not a gear. Three hashed teeth are worn round and one is BROKEN CLEAN OFF, leaving a chipped stump, which does more for "old machinery" than any amount of rust. It drives a PINION on a bracket off the same pedestal, and the mesh is exact rather than eyeballed: the pinion carries the same circular pitch (so 24 : 10 = 2.4) and starts half a tooth off the line of centres, so every 2pi/24 the big gear turns the pinion turns exactly one of its own teeth and the interleave holds forever. Slow rotation, ~46 s per revolution, off the absolute-time clock. The cast-iron pedestal stands BEHIND the gear plane so it never hides the spokes, and the gear bottom sits just clear of a low cinder ballast mound.',
      render: () => (
        <ScenePreview distance={2.5} targetY={0.6} autoRotate={false} ground height={420}>
          <GiantGear seed={2} />
        </ScenePreview>
      ),
    },
    {
      name: 'Steam-pipe cluster',
      description:
        '"Tangle" is the brief, and a tangle needs three things a neat pipe stack does not: pipes at DIFFERENT DEPTHS (there is a run at ankle height crossing toward the viewer, which is what stops the cluster reading as a flat facade), real ELBOWS over the top rather than mitred butt joints (quarter tori — a pipe that turns a corner by intersecting another pipe reads as scaffolding), and FLANGED joints with rivet rings, because that is where the eye looks for plumbing. Then the ironmongery that says pressure: an octagonal stop-valve casting with a handwheel on its stem, a second wheel on the riser facing the viewer, a drain cock, two live gauges on a bolted bracket with a red danger arc on the dial, and two relief vents that PUFF — 48 particles on two hashed lift cycles, because a real relief valve lifts, blows and reseats while a steady plume reads as a smoke machine. One copper line weeps verdigris; the rest is soot-grey iron on a stained concrete plinth.',
      render: () => (
        <ScenePreview distance={2.2} targetY={0.55} autoRotate={false} ground height={420}>
          <SteamPipes seed={5} />
        </ScenePreview>
      ),
    },
    {
      name: 'Brass clock tower',
      description:
        'A clock tower lives or dies on whether you can READ THE TIME at park zoom, and that is a contrast problem, not a detail problem: brass hands on a brass dial are invisible at any resolution. So the dial is the palest surface in the world, the hands are near-black soot, and the numerals are dark brass — twelve of them, long bars at the quarters — and after dark the dial goes EMISSIVE (gas-lit dials are historically right) so the hands silhouette against it. All four faces show the same time off ONE absolute-time clock: the minute hand takes 150 s to go round, the hour hand twelve times that, starting at 10:10, the classic display time that keeps the hands apart. The shaft is deliberately SLENDER (0.26 across under 2.63 u of height — a fat tower at this height reads as a chimney), octagonal, with brass strapping bands, a gas conduit clipped up the front and a 96-rivet seam grid up its eight corners. Above: a belfry with a swinging bell, an octagonal copper spire weeping verdigris down its slope, and a brass finial with a weather vane.',
      render: () => (
        <ScenePreview distance={3.55} targetY={1.36} autoRotate={false} ground height={470}>
          <ClockTower seed={3} />
        </ScenePreview>
      ),
    },
    {
      name: 'Riveted boiler tank',
      description:
        'The read is RIVETED PRESSURE VESSEL, and it comes from four things in this order: the CIRCUMFERENTIAL SEAMS with their rivet rings (a smooth cylinder is a water tank — the seams are what make it a boiler; 130 rivet heads here, all in one merged mesh), the FIREBOX under the barrel with a glowing door, because a boiler needs a fire or it is a barrel on legs, the CHIMNEY, and the ironmongery on top: a safety valve with its weight lever, a bolted manhole cover, a gauge glass on stand-off cocks with the water level showing dark in the bottom half, and a live pressure gauge. It is SET IN BRICK rather than propped on two cradles, which is what a stationary boiler actually did — the brick setting carries the firebox half and a single iron cradle carries the smokebox end. The fire glow never gates to zero by day (a lit fire is lit; only the PointLight it throws is night-weighted), rust weeps down the lower flank, soot fans above the door and round the chimney base, and there is a heap of coal and a shovel by the firebox.',
      render: () => (
        <ScenePreview distance={2.9} targetY={0.72} autoRotate={false} ground height={430}>
          <BoilerTank seed={4} rotation={1.35} />
        </ScenePreview>
      ),
    },
    {
      name: 'Coal cart on rails',
      description:
        'Two reads have to land and they are independent. TRACK reads from the layer cake: cinder ballast with sloped shoulders, ten creosoted sleepers each hashed off square (a row of identical square sleepers reads as a ladder), a real rail SECTION of foot, web and head (a single box is a plank), forty spikes at the chairs and a bolted fishplate at the joint. WAGON reads from the FLARE and the LOAD: the tipper body is built as four separately tilted plates rather than one tapered prism, which gives real corner seams to strap and rivet, and the coal is heaped ABOVE the rim in rounded flat-shaded lumps — pitched up off pure black, because a 3%-albedo heap reads as a hole in the frame, and left slightly glossy because anthracite has a genuine sheen. Flanged wheels sit ON the rail head, there is a pin-and-link coupling hook at each end with a loose link hanging off one, a brake lever on the near side, and spilled lumps along the ballast. The track is flat and is NOT a blocker; only the wagon is.',
      render: () => (
        <ScenePreview distance={2.6} targetY={0.3} autoRotate={false} ground height={420}>
          <CoalCart seed={7} rotation={0.55} />
        </ScenePreview>
      ),
    },
    {
      name: 'The yard at night',
      description:
        'The same yard after dark. Three PointLights across the whole set, all night-gated: the clock tower\'s dial gaslight washing the cornice from under the clock stage (never inside it — a PointLight in a closed box lights nothing), its bracket lantern on the shaft, and the boiler\'s firebox. The clock dial goes emissive so the soot hands read as silhouettes, the firebox breathes on two hashed sines and throws warm light across the brick and the coal heap, the chimney keeps smoking and the relief vents keep puffing. Everything else in the foundry is unlit iron: brass at metalness 0.32 has nothing to reflect after sunset, which is exactly why the palette leans on colour and tarnish rather than shine.',
      render: () => (
        <ScenePreview distance={7.4} targetY={0.62} autoRotate={false} ground night height={470}>
          <Yard />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
