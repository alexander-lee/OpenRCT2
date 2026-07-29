import React from 'react';
import * as THREE from 'three';
import { mat, mergedParts } from '../Stage';
import { hash01 } from '../ColorKit';
import { ScenePreview } from '../Park';
import { MagicMirror } from './index';

/** the glade clearing these previews stand in: leaf litter, moss and a few
 *  toadstools, so the mirror is in a wood instead of on a lawn */
function clearing(t: typeof THREE, g: THREE.Group, r = 9) {
  // ⚠️ THE CLEARING FLOOR IS MOSS, NOT LOAM. It shipped as a bare `0x50442f`
  // leaf-litter disc with green patches scattered over it, and the 50° render
  // read as a mirror standing on bare EARTH with dropped leaves round it — the
  // litter lumps are within a hair of the disc's own tone, so only the moss ones
  // showed and they read as isolated leaves. ThornwickGlade's own gradient is
  // "the clearing is MOSS and the wood is LITTER" (62 % moss inside the ring,
  // 22 % out in the wood); this disc is a clearing, so it is moss, and the litter
  // is what drifts ON it.
  const disc = new t.Mesh(new t.CircleGeometry(r, 48), mat(t, 0x3f5533, { tex: 'fabric', repeat: [14, 14], rough: 0.98 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.015;
  disc.receiveShadow = true;
  g.add(disc);
  // ⚠️ LUMPS, NOT PLATES — and this one was caught in a render, not in review.
  // These were 150 flat 0.04-thick BOXES lying on the disc, and at the park's
  // ~50° camera the whole clearing read as brown and green FLOOR TILES with a
  // mirror standing on them: ThornwickScenery's second documented bug ("flat
  // BOXES on the ground read as floor TILES"), hiding in preview staging where
  // nobody thought to apply the pack's own rule. Squashed detail-0 icosahedra
  // now — moss is a cushion — CLUMPED five to a patch so the floor reads as
  // ground rather than as confetti, and the litter tone pulled toward the moss
  // (ThornwickGlade's LOAM hue-contrast finding).
  const lump = new t.IcosahedronGeometry(1, 0);
  const loam: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const moss: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  for (let k = 0; k < 90; k += 1) {
    const a = hash01(k * 1.9 + 3) * Math.PI * 2;
    const rr = Math.sqrt(hash01(k * 3.7 + 11)) * r;
    const cx = Math.cos(a) * rr;
    const cz = Math.sin(a) * rr;
    const bag = hash01(k * 11.7) > 0.42 ? loam : moss;
    for (let n = 0; n < 6; n += 1) {
      const h1 = hash01(k * 5.3 + n * 2.7 + 7);
      const h2 = hash01(k * 7.1 + n * 4.3 + 19);
      // a moss cushion is ANKLE-high on a 0.55-tall guest: 0.16-0.42 across.
      // The first pass at 0.16-0.46 RADIUS made each lump nearly two guests wide
      // and the clearing read as a bed of lily pads.
      const s = 0.08 + h1 * 0.13;
      bag.push({
        geo: lump,
        matrix: new t.Matrix4()
          .makeRotationY(h2 * 3.1)
          .premultiply(new t.Matrix4().makeScale(s, s * (0.36 + h1 * 0.2), s * (0.7 + h2 * 0.6)))
          .setPosition(cx + (h1 - 0.5) * 0.6, 0.012 + h2 * 0.016, cz + (h2 - 0.5) * 0.6),
      });
    }
  }
  // leaf DRIFTS on the moss (the majority now), plus deeper moss cushions
  const p1 = mergedParts(t, loam, mat(t, 0x4b4632, { tex: "concrete", rough: 0.98, flat: true }), false);
  p1.castShadow = false;
  g.add(p1);
  const p2 = mergedParts(t, moss, mat(t, 0x334826, { tex: "fabric", rough: 0.97, flat: true }), false);
  p2.castShadow = false;
  g.add(p2);
  lump.dispose();
}

const previews = {
  componentName: 'MagicMirror',
  importPath: 'components/MagicMirror',
  previews: [
    {
      name: '3D rig — The Whispering Glass (LEAD, the interaction)',
      description:
        "Attraction 3 of THORNWICK GLADE, and NOT A RIDE: no queue, no station, no vehicle, no FSM — a `composable(...)` SCENERY component, so none of the ride placement rules apply to it. An ornate standing mirror on a mossy stone plinth: a carved frame of tarnished silver with leaf capitals, an arched crown, a crescent-moon crest, ivy creeping over it, toadstools at its foot — and GLASS THAT WAKES UP. This preview ships the DEMO VISITOR (default ON under a ScenePreview, OFF in a real park): a guest walks up on a deterministic 18-second loop, STOPS in front of the glass for eight seconds, and walks away — and they drive the REAL wake logic, the same code path a live GameManager guest goes through. Watch the tarnish clear, the enchanted reflection fade in, the frame runes light and the glass throw violet light back onto them; then it all fades again as they leave. Click the mirror for its window.",
      render: () => (
        <ScenePreview
          distance={4.2}
          targetY={0.85}
          height={520}
          autoRotate={false}
          ground={false}
          background="#3d4147"
          dress={(t, g, api) => {
            clearing(t, g);
            api.setCameraPose?.([2.3, 1.5, 3.1], [0.0, 0.8, 0.35]);
          }}
        >
          <MagicMirror position={[0, 0]} />
        </ScenePreview>
      ),
    },
    {
      name: 'The glass AWAKE (close — the vision)',
      description:
        "The screen itself, forced awake with `awake` for a reproducible still (`demo={false}` so nothing stands in the way of it). The vision is a procedural CanvasTexture drawn with paths only — no fillText, no external assets, cached module-level per enchantment — used as BOTH `map` and `emissiveMap`, so it reads as painted glass by day and as light in the dark. Every vision is the same picture, a BUST silhouette of whoever is standing there in a violet well ringed with two rune rings, with ONE thing added that the guest does not actually have: branching ANTLERS, moth WINGS with eye-spots (drawn behind the bust), a THORN CROWN, or a fox's EARS AND TAIL. It is deliberately a silhouette: a reflection you could recognise yourself in would be a portrait, and the mirror cannot see a face.",
      render: () => (
        <ScenePreview
          distance={2.9}
          targetY={0.95}
          height={520}
          autoRotate={false}
          ground={false}
          background="#3d4147"
          dress={(t, g, api) => {
            clearing(t, g, 5);
            api.setCameraPose?.([0.95, 1.35, 2.7], [0.0, 0.98, 0.0]);
          }}
        >
          <MagicMirror position={[0, 0]} awake demo={false} />
        </ScenePreview>
      ),
    },
    {
      name: 'Dull silver (close — dormant)',
      description:
        "The same glass with nobody near it (`demo={false}`, no `awake`): old silvering, and the state the vision has to clear AWAY. Its dormant CanvasTexture is a dull green-grey gradient with cloudy TARNISH BLOOMS, 420 hashed foxing specks where the silvering has failed, the diagonal sheen a flat pane always carries, and a heavy vignette — a mirror in a wood nobody has cleaned for a century. Note the frame: two carved pillars with three banded collars and a leaf capital each, a real torus half-ring for the arched crown with a beaded outer course, scrolled feet, and two STAY LEGS raking back off the crown, because from behind a standing mirror has to be a thing and not a billboard.",
      render: () => (
        <ScenePreview
          distance={2.9}
          targetY={0.9}
          height={500}
          autoRotate={false}
          ground={false}
          background="#3d4147"
          dress={(t, g, api) => {
            clearing(t, g, 5);
            api.setCameraPose?.([1.7, 1.5, 2.2], [0.0, 0.82, 0.0]);
          }}
        >
          <MagicMirror position={[0, 0]} demo={false} />
        </ScenePreview>
      ),
    },
    {
      name: 'Four in a row — the four enchantments',
      description:
        'The four visions side by side, each mirror forced `awake` and pinned with the `enchantment` prop: ANTLERS, WINGS, CROWN, FOX, left to right. Which one a guest gets is hashed off their guest id, so the same guest always sees the same reflection and two guests standing at the glass in turn see different ones. The picker is `hash01(id·7.31 + seed·3.7)` — deterministic, no Math.random.',
      render: () => (
        <ScenePreview
          distance={5.4}
          targetY={0.9}
          height={460}
          autoRotate={false}
          ground={false}
          background="#3d4147"
          dress={(t, g, api) => {
            clearing(t, g, 8);
            api.setCameraPose?.([0.4, 1.7, 4.4], [0.0, 0.85, 0.0]);
          }}
        >
          <MagicMirror position={[-1.65, 0]} awake demo={false} enchantment="antlers" seed={2} />
          <MagicMirror position={[-0.55, 0]} awake demo={false} enchantment="wings" seed={5} />
          <MagicMirror position={[0.55, 0]} awake demo={false} enchantment="crown" seed={8} />
          <MagicMirror position={[1.65, 0]} awake demo={false} enchantment="fox" seed={11} />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
