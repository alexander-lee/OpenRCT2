import React from 'react';
import { ScenePreview } from '../Park';
import { BasaltColumns, CharredSnag, Fumarole, LavaFissure, ObsidianShards } from './index';

// The Emberfall Caldera scenery set. Preview 0 stages all five pieces in one
// row; previews 1–5 take each piece close up; preview 6 is the night group shot,
// where the lava does the lighting. Components never render a <Stage> — every
// preview wraps them in <ScenePreview>.

/** the group row, shared by the day and night group shots */
const Row = () => (
  <>
    <BasaltColumns position={[-1.5, 0.65]} seed={3} rotation={0.4} />
    <CharredSnag position={[-0.2, 0.1]} seed={5} rotation={0.9} />
    <Fumarole position={[1.05, -0.4]} seed={2} />
    <ObsidianShards position={[2.2, -0.95]} seed={7} rotation={0.6} />
    <LavaFissure position={[1.0, 0.85]} rotation={2.0} length={2.2} seed={4} />
  </>
);

const previews = {
  componentName: 'EmberfallScenery',
  importPath: 'components/EmberfallScenery',
  previews: [
    {
      name: 'The set',
      description:
        'All five Emberfall Caldera scenery pieces by day, left to right: the BASALT COLONNADE (hexagonal columns cut off at wildly varying heights, cross-jointed, with toppled drums at its foot), the CHARRED SNAG (blackened trunk, broken limb stubs, a snapped splintered crown), the FUMAROLE (a cracked rock vent hissing a steam plume out of a glowing throat, with sulfur crust staining one side), the OBSIDIAN SHARDS (angular volcanic-glass blades — the only glossy surface in the world) and, running across the foreground, the LAVA FISSURE (a flat ground crack with magma glowing inside). The palette is deliberately muted basalt grey, ash and scorched brown; the only saturated colour anywhere is the lava, and it glows in full daylight — the emissive multiplier lerps between a day and a night value on nightKOf and never gates to zero.',
      render: () => (
        <ScenePreview distance={6.4} targetY={0.45} autoRotate={false} ground height={430}>
          <Row />
        </ScenePreview>
      ),
    },
    {
      name: 'Fumarole steam vent',
      description:
        'A fracture, not a chimney: a squat basalt plug with a real BORE through it (an open-ended frustum wall plus a ring top cap — a solid mound just buries the glowing throat inside the rock) and nine angular slabs heaved up around the rim with GAPS left between them, because the gaps are the cracks. Down the throat is a short glowing shaft: a hot crust wall at u 0.42 over an orange-yellow floor at u 0.16, the bore kept WIDE and SHALLOW so half the floor stays in view from the park camera at any orbit angle. Hairline cracks radiate over the mound top and a pale ochre bloom of sulfur crust stains the downwind side. The plume is a fat, fairly opaque pale steam column (118 particles) with a small additive amber gas flicker at the lip (24) — PointsMaterial is unlit, so a thin faint wisp simply vanishes against daylit grass. No real light by default: the throat glow is emissive.',
      render: () => (
        <ScenePreview distance={2.1} targetY={0.35} autoRotate={false} ground height={400}>
          <Fumarole seed={2} />
        </ScenePreview>
      ),
    },
    {
      name: 'Obsidian shard formation',
      description:
        'The ONE place gloss is right — volcanic glass is genuinely reflective, unlike the matte basalt everywhere else. Each blade is a 4- or 5-sided tapered prism, non-uniformly squashed so it reads as a blade rather than a spike, flat-shaded with a near-black albedo and a MeshPhysicalMaterial clearcoat at obsidian’s real index of refraction (1.48). A mirror needs something to REFLECT, so the material carries a small procedural equirectangular env map of the caldera (pale ash sky, a faint warm glow band over the rim, dark ash ground, one hot sun blob): bright sky on the up-facing facets against black on the down-facing ones is the whole glassiness, and the piece’s one updater dims that reflection after dark, since an env map does not care that the sun has set. Around the blades: conchoidal flakes lying flat where the mass shattered, and a scoria grit apron. Two glass materials (plain black, faintly plum-cast), four draw calls.',
      render: () => (
        <ScenePreview distance={2.2} targetY={0.32} autoRotate={false} ground height={400}>
          <ObsidianShards seed={7} rotation={0.6} />
        </ScenePreview>
      ),
    },
    {
      name: 'Basalt column colonnade',
      description:
        'Cooling basalt contracts into a hexagonal crack pattern, so the columns TESSELLATE: they sit on a real triangular lattice at pitch r·√3 (the flat-to-flat width of a hexagonal prism), which is why a Giant’s-Causeway colonnade looks packed instead of scattered. The erosion surface cuts them at wildly varying heights, the odd lattice cell is missing, and every column is stacked out of 2–4 DRUMS with a hairline gap and a degree of yaw between them — real columns carry horizontal cross joints, and that detail is most of what stops the cluster reading as a bundle of pipes. Two rock materials (fresh dark basalt, dust-weathered pale) plus ash caps on exposed tops, all merged.',
      render: () => (
        <ScenePreview distance={3.6} targetY={0.65} autoRotate={false} ground height={430}>
          <BasaltColumns seed={3} />
        </ScenePreview>
      ),
    },
    {
      name: 'Lava-crack ground fissure',
      description:
        'The piece that has to work hardest in daylight. Four layers: a wide irregular SCORCHED APRON of sterile dark ash (an incandescent crack laid straight onto bright grass has nothing to be bright against and reads as a decal — give it a black surround and it reads as heat); a low SPATTER RAMPART either side, near-black crust with dull-red hairlines still deep in it (u 0.88); the CRACK itself, cut into seven segments and temperature-ramped as a V — white-yellow at ~1100 °C mid-length where it is widest, cooling to deep red at each pinched tip, with two branch cracks spurring off it; and broken basalt LIPS along both edges. It pinches and swells along its length so it reads as a fracture, not a painted line. Flat (~0.09 tall) and NOT a blocker: scatter it across paths and lawns. 66 particles (heat haze + embers, origins walking along the crack) and one warm PointLight floored low by day.',
      render: () => (
        <ScenePreview distance={3.4} targetY={0.15} autoRotate={false} ground height={430}>
          <LavaFissure length={2.4} seed={4} />
        </ScenePreview>
      ),
    },
    {
      name: 'Charred tree snag',
      description:
        'A standing dead trunk a pyroclastic surge went through: blackened, no foliage, bark gone except a few spalled plates showing the pale grey-brown heartwood underneath, and the top SNAPPED OFF into splinters rather than tapering to a tip — that broken crown is what says "killed" instead of "pruned". Three broken limb stubs (one forked) each ending in a blunt snap, a root flare with five buttresses, and charcoal litter at the foot. The char carries the "alligator" checking pattern of real burnt wood as both map and bump. Utterly matte and utterly unlit: no glow, no emissive, no light.',
      render: () => (
        <ScenePreview distance={3.2} targetY={0.75} autoRotate={false} ground height={430}>
          <CharredSnag seed={5} />
        </ScenePreview>
      ),
    },
    {
      name: 'The set at night',
      description:
        'The same row after dark, with the fissure’s single PointLight and the emissive crack networks doing all the lighting: the temperature gradient down the crack reads at its most dramatic, the fumarole throat glows under its steam column, and the obsidian — placed next to the fissure for exactly this reason — picks the lava up as red glints along its facets. Nothing here strobes: one ~15 s breath of the whole crack network plus a slow surge travelling along it.',
      render: () => (
        <ScenePreview distance={6.4} targetY={0.45} autoRotate={false} ground night height={430}>
          <Row />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
