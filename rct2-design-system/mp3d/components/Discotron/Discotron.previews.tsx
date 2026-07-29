import React from 'react';
import { ScenePreview } from '../Park';
import { Discotron } from './index';

const previews = {
  componentName: 'Discotron',
  importPath: 'components/Discotron',
  previews: [
    {
      name: '3D rig',
      description:
        "The Pulse District's mirror-ball GYRO SPINNER by day, when the form has to carry it on its own: a two-tier stage (concrete apron, raised black-gloss disc with painted magenta and cyan radial inlays), a chrome-banded graphite mast, six arms swinging six two-seat pods on gimbal yokes, four real speaker stacks with inset woofer cones, a chrome laser truss on four legs and the giant 48-facet mirror ball turning under it. The neon marquee hangs from the front truss chord; the boarding gate, its steps and the operator console face the local +z front.",
      render: () => (
        <ScenePreview distance={11.5} targetY={1.5} height={560}>
          <Discotron />
        </ScenePreview>
      ),
    },
    {
      name: 'Night (mirror ball + light shards)',
      description:
        'The hero shot. Everything is locked to the district beat — the same ~2.2 Hz clock <DanceFloor> flashes its tiles to, cycling the same DISCO_PALETTE. The ball scintillates in four independent facet shells; THREE shard rigs rake rotating light shafts and elongated floor patches across the gloss stage and up over the pods at three different rates and three palette offsets; the four truss lasers punch on the downbeat; the rim LEDs chase one step per beat; the pod trim strips and gate crown pulse; the woofers thump. Haze from two stage vents gives the shafts something to bite on. Only THREE real PointLights carry it (ball wash, boarding gate, the marquee) — everything else is night-gated emissive.',
      render: () => (
        <ScenePreview distance={11.5} targetY={1.5} height={560} night>
          <Discotron />
        </ScenePreview>
      ),
    },
    {
      name: 'Marquee + boarding face (night)',
      description:
        "The +z front, turned square to the Stage's fixed 45° camera: the DISCOTRON neon marquee slung under the truss ring, the beat-lit gate crown between its two posts, the steps up from the ground to the apron and on to the stage disc, the operator console beside the gate, and the two speaker stacks that flank the queue. This is the face a park's queue lane runs into (layout front 4.0 out the local +z).",
      render: () => (
        <ScenePreview distance={11} targetY={1.6} height={520} night autoRotate={false}>
          <Discotron rotation={Math.PI / 4} />
        </ScenePreview>
      ),
    },
    {
      name: 'Pod close-up (real seats)',
      description:
        'Boarding detail. Each pod is a real two-seater: a moulded gloss pan on a chrome frame, a fabric cushion sunk into it, a shell backrest with its own fabric pad and lumbar roll, a headrest cap and a padded lap bar on a stem out of the cushion. The `seatWorld` anchors sit so a 0.5-scale guest lands hips-ON-cushion, so registered rides look right with real guests and empty seats read as empty upholstery rather than bare plastic. Capacity 12 = 6 pods × 2 seats.',
      render: () => (
        <ScenePreview distance={4.2} targetY={1.0} height={480}>
          <Discotron />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;
