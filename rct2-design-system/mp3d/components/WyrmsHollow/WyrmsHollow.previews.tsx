import React from 'react';
import { ScenePreview, Station, Straight, Lift, Drop, Hill, TurnR } from '../Park';
import { mat, mergedBoxes, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { hash01 } from '../ColorKit';
import { OakTree } from '../OakTree';
import { WyrmsHollow, buildWyrmDragon, buildIvyStrand, THORNWICK } from './index';

type StageT = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[0];
type StageG = Parameters<NonNullable<Parameters<typeof ScenePreview>[0]['dress']>>[1];

/** the same CURVATURE-RAMPED corners the component's stock circuit turns on —
 *  RCT2 never welds a tight curve onto a fast straight and neither can the kit:
 *  a bare chorded arc leaves a kink where the auto-bank has not developed and
 *  that junction is the whole lateral-G budget. Each fragment sums to exactly
 *  90°, so four of them bring the beast home on the station heading with
 *  NOTHING synthesized. */
const crestCorner = (r: number) => (
  <>
    <TurnR angle={12} radius={r * 2.6} />
    <TurnR angle={66} radius={r} />
    <TurnR angle={12} radius={r * 2.6} />
  </>
);
const easyCorner = (r: number) => (
  <>
    <TurnR angle={6} radius={12} />
    <TurnR angle={12} radius={7} />
    <TurnR angle={54} radius={r} />
    <TurnR angle={12} radius={7} />
    <TurnR angle={6} radius={12} />
  </>
);

/** the glade floor: a moss/leaf-litter apron over the preview's grass disc */
const gladeFloor = (radius: number) => (t: StageT, g: StageG) => {
  const disc = new t.Mesh(new t.CircleGeometry(radius, 56), mat(t, 0x3f5330, { tex: 'grass', repeat: [14, 14], rough: 1, bump: 0.07 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.012;
  disc.receiveShadow = true;
  g.add(disc);
  const inner = new t.Mesh(new t.CircleGeometry(radius * 0.55, 44), mat(t, 0x47552f, { tex: 'grass', repeat: [10, 10], rough: 1, bump: 0.06 }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.014;
  inner.receiveShadow = true;
  g.add(inner);
};

/** THE DRAGON, standing free of the ride: the beast on its own, posed as a
 *  free serpentine CHAIN (`update(..., chained)`) so it undulates in place with
 *  its wings beating — plus a mossy ruin plinth, ivy and a REAL GUEST at park
 *  scale (0.55 tall) beside it, which is the only honest way to show how big
 *  the thing is. */
const dragonStage = (t: StageT, g: StageG) => {
  gladeFloor(9)(t, g);
  // A RUINED KERB, and it has to read as one. This was 16 IDENTICAL 0.5 × 0.28 ×
  // 0.42 blocks at even angular spacing round an ellipse, and at the park's ~50°
  // camera that reads as neither a kerb nor rubble — it reads as CONFETTI, a ring
  // of grey cubes dropped on the grass (the rubric's repetition artefact, and the
  // reason the 50° shot of this preview looked like a broken land). A ruined kerb
  // is a BROKEN RUN: stones of hashed size and yaw laid nose to tail with real
  // GAPS where courses have gone, some tipped, in two tones.
  const blocks: { dims: [number, number, number]; pos: [number, number, number]; rotY?: number; rotZ?: number }[] = [];
  const blocksDark: typeof blocks = [];
  let a = 0;
  let n = 0;
  while (a < Math.PI * 2) {
    const h1 = hash01(n * 4.7 + 3);
    const h2 = hash01(n * 2.3 + 11);
    const len = 0.34 + h1 * 0.3;
    const step = len / 3.1; // arc-ish advance: the stones butt, not scatter
    if (h2 > 0.24) {
      // …and one stone in four is simply MISSING
      const rr = 3.5 + h1 * 0.24;
      (h1 > 0.62 ? blocksDark : blocks).push({
        dims: [len, 0.2 + h2 * 0.12, 0.3 + h1 * 0.14],
        pos: [Math.sin(a) * rr, 0.1 + h2 * 0.03, Math.cos(a) * (rr * 0.72) - 1.4],
        rotY: a + (h1 - 0.5) * 0.4,
        rotZ: (h2 - 0.5) * 0.22,
      });
    }
    a += step;
    n += 1;
  }
  const kerbOpt = { tex: 'concrete' as const, repeat: [2, 1] as [number, number], rough: 1, bump: 0.08 };
  g.add(mergedBoxes(t, blocks, THORNWICK.stone, kerbOpt));
  g.add(mergedBoxes(t, blocksDark, THORNWICK.stoneDark, kerbOpt));
  const pier = mergedBoxes(
    t,
    [0, 1, 2, 3].map((c) => ({ dims: [0.62, 0.34, 0.66] as [number, number, number], pos: [2.3, 0.17 + c * 0.34, -2.4] as [number, number, number], rotY: c * 0.1 })),
    THORNWICK.stone,
    { tex: 'concrete', repeat: [2, 1], rough: 1, bump: 0.08 },
  );
  g.add(pier);
  const ivy = buildIvyStrand(t, 1.0, 7);
  ivy.position.set(2.3, 1.3, -2.1);
  g.add(ivy);
  // the SCALE REFERENCE: a park guest, 0.55 tall
  const peep = buildPeep(t, { shirt: 0x2f6fd0, expression: 'surprised' });
  peep.group.scale.setScalar(0.5);
  peep.group.position.set(1.5, 0, 1.5);
  peep.group.rotation.y = -2.4;
  g.add(peep.group);
  const wyrm = buildWyrmDragon(t, { riders: true });
  wyrm.group.position.set(0, 0.62, 1.6); // flying low over the ruin
  g.add(wyrm.group);
  // the breath belongs to the STATIC root, not to the head — the smoke has to
  // be left behind in the world
  wyrm.breathPoints.forEach((pt) => g.add(pt));
  return (time: number) => wyrm.update(time, 1, nightKOf(g), true);
};

const previews = {
  componentName: 'WyrmsHollow',
  importPath: 'components/WyrmsHollow',
  previews: [
    {
      name: 'THE WYRM — the beast itself (body, wings, hide, claws, breath)',
      description:
        "The deliverable, off the track. Eleven articulated segments of scaled hide — merged dorsal spine plates, overlapping flank shingles and oxblood belly scutes — posed here as a free serpentine CHAIN so the travelling undulation reads in place (on the ride the SAME segments are placed by the spline runner at `uHead − i·spacing/total`, so the layout itself bends the body). The wings are a real bone chain — humerus → forearm → wrist → four fingers of two phalanges each — and the **membrane is rebuilt every frame as a BufferGeometry from the live bone tips**, so it stretches, creases and bags on the downstroke; the beat is phase-lagged down the chain (shoulder leads, elbow 0.9 rad behind, wrist 1.4, fingers 1.8), which is the whole difference between a wing and a rigid flap. Clawed fore and hind limbs, a tail spade, a horned head with brow ridges, a bony crest, five-segment swept horns, a hinged jaw with two opposed rows of teeth, slit-pupil amber eyes and smoke + ember breath out of the nostrils. **The blue-shirted guest at the right is a real `buildPeep` at park scale (0.55 tall)** — that is the yardstick: the wyrm's barrel is about one guest thick and it is a little over 6 units nose to spade.",
      render: () => (
        // a ~34° three-quarter, close to the park's own default camera: round 8
        // shot this from 26° almost down the beast's own axis, which foreshortens
        // both wings into slivers — the ONE thing the money shot has to show
        <ScenePreview distance={8.2} targetY={0.75} height={460} autoRotate={false} dress={(t, g, api) => {
          const up = dragonStage(t, g);
          api.setCameraPose?.([5.2, 4.85, 4.8], [-0.6, 0.72, 0.1]);
          return up;
        }} />
      ),
    },
    {
      name: 'THE WYRM, head close-up (horns, brow, jaw, teeth, glowing eyes)',
      description:
        "The head, at the distance a queueing guest sees it from. Cranium and tapering snout, **brow ridges** over deep-set sockets, a bony crest running back over the crown, two horns built from five tapering segments each (so they sweep rather than stick out), cheek and jaw spikes, a five-spine neck frill, and a **hinged lower jaw** that breathes open and gapes wide on the roar — with fourteen upper and fourteen lower teeth in opposed rows. The **eyes are amber and lit from inside with a vertical slit pupil**, lerped between a daylight and a night value and never gated to zero, and they brighten with the roar; the same roar drives the smoke and ember emitters at the nostrils. The single PointLight on the head is the beast's own glow — everything else in the ride is night-gated lantern light.",
      render: () => (
        // framed on the SKULL, which round 9 carried 0.27 higher on a longer
        // reared neck and enlarged 20%: the round-8 pose cropped it at the top
        <ScenePreview distance={2.7} targetY={1.8} height={460} autoRotate={false} dress={(t, g, api) => {
          const up = dragonStage(t, g);
          api.setCameraPose?.([2.62, 2.5, 4.95], [-0.02, 1.82, 2.34]);
          return up;
        }} />
      ),
    },
    {
      name: "3D rig — Wyrm's Coil (the family circuit and the ruin it threads)",
      description:
        "The whole attraction on the shipped \"Wyrm's Coil\" circuit: a 2.8-unit climb out of the mossy stone station to a 3.35 summit, a curvature-ramped corner at the crest, the same 2.8 back down in one gentle 21° descent — no plunge, this is a family ride — then the long low run that goes clean **through a collapsed breach in a broken tower**, a shallow camelback (0.8 over an 8-unit run) for the airtime, and two more easy corners home past crumbling arches. Compiled with the ride's own rules (`profile: 'coaster'`, `type: 'steel'`, bank **0.70** — the auto-bank is what holds the low corners at 0.96 g of effective lateral against the 1.5 g derail guard and validatePark's 1.27 g margin) and verified compile-only before shipping: `checkCoasterDesign('steel')` clean with **ZERO violations and zero warnings**, `validateSpline` worst clearance **4.54**, **ZERO** synthesized closure, 2 drops, highest 2.81, 0.21 s of airtime, 81.3 u of track, a **13.6 s lap** and E 2.56 / I 2.78 / N 0.86 — **moderate**, which is exactly the family band. The wyrm has no chain lift because it does not need one: it climbs under its own power and the wing beat deepens on the way up.",
      render: () => (
        <ScenePreview distance={27} targetY={2.2} height={400} autoRotate={false} dress={(t, g, api) => {
          gladeFloor(23)(t, g);
          api.setCameraPose?.([15.0, 10.4, 21.6], [0, 2.0, 0]);
        }}>
          {/* rotated a half turn so the tower and the arches are on the near
              side of the circuit and the station recedes behind them */}
          <WyrmsHollow position={[-4.95, -10.0]} rotation={Math.PI} />
          <OakTree position={[13.5, 3.0]} scale={1.5} />
          <OakTree position={[-14.0, -6.0]} scale={1.35} />
          <OakTree position={[9.0, -12.5]} scale={1.6} />
          <OakTree position={[-11.5, 9.5]} scale={1.25} />
          <OakTree position={[2.0, 13.0]} scale={1.45} />
          <OakTree position={[15.0, -8.0]} scale={1.2} />
        </ScenePreview>
      ),
    },
    {
      name: 'THE TOWER — the breach the track runs through',
      description:
        "The set-piece, close up. A round ruined tower straddles the longest, most level straight on the circuit and the track runs clean through a **collapsed breach** in each side of it: fifteen courses of moss-capped masonry, more and more of it missing toward the top, with the voussoirs that DID hold stepped over each opening on ragged jambs, the ruined spiral stair still clinging to the inside of the wall, a broken window arch high on the surviving flank, roots splitting the base, nine ivy strands down the outside and rubble heaped where the breach came out. The breach is deliberately wide (half-width 1.75, clear height 2.2) — it has to pass a beating wing — which is exactly why it is built as a collapse and not a doorway. A lantern hangs inside on a timber bracket: after dark it is the light the wyrm comes through.",
      render: () => (
        <ScenePreview distance={16} targetY={1.6} height={440} autoRotate={false} dress={(t, g, api) => {
          gladeFloor(23)(t, g);
          api.setCameraPose?.([-14.2, 6.0, 19.8], [-1.6, 1.5, 8.7]);
        }}>
          <WyrmsHollow position={[-4.95, -10.0]} rotation={Math.PI} />
        </ScenePreview>
      ),
    },
    {
      name: 'Deepwood Coil (piece composition — tighter corners, a longer climb)',
      description:
        "Track-piece composition through JSX children (`<Station/><Lift/><Drop/><Hill/><TurnR/>…`, read with `collectTrackPieces`, which win over the `pieces` prop), plus `arches={4}` for a fourth ruined arch. The three low corners tighten from radius 3.0 to **2.6** and the climb stretches over a 9-unit run, which re-solves the circuit's two free straights to **14.078** and **2.778** — a four-corner layout has exactly two degrees of freedom and the last authored piece has to land 0.30 u short of the station ON its axis, or the compiler closes the loop with a Dubins return leg straight through the track. Measured: design clean, worst clearance 4.65, **ZERO** synthesized closure, worst effective lateral **0.78 g** (the tighter corners are also the slower ones), 82.7 u, a 13.7 s lap, E 2.55 / I 2.76 / N 0.86.",
      render: () => (
        <ScenePreview distance={30} targetY={2.2} height={360} autoRotate={false} dress={(t, g, api) => {
          gladeFloor(23)(t, g);
          api.setCameraPose?.([-14.0, 11.5, 24.0], [0, 2.2, 0]);
        }}>
          <WyrmsHollow position={[4.95, 10.0]} arches={4}>
            <Station />
            <Straight length={0.6} />
            <Lift height={2.8} length={9} />
            <Straight length={0.8} />
            {crestCorner(3.0)}
            <Straight length={0.8} />
            <Drop height={2.8} length={9} />
            <Straight length={1.6} />
            {easyCorner(2.6)}
            <Straight length={14.078} />
            {easyCorner(2.6)}
            <Hill height={0.8} length={8} />
            <Straight length={2.778} />
            {easyCorner(2.6)}
            <Straight length={1.4} />
          </WyrmsHollow>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
