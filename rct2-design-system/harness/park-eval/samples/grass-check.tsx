// TERRAIN-ONLY VISUAL PROBE — the ground, and nothing but the ground.
//
// This is not a park and does not try to be one: no <Paths>, no <GameManager>,
// no rides, so `validatePark` reports its "no GameManager was created" failure
// by design and the console line is noise here. Its ONE job is to let the
// 2026-07 terrain work be judged BY LOOKING at it — the turf material, the
// patchiness, the hollow/crest tones and the mountainous relief — with nothing
// else in frame to hide behind. It mounts <Park> with NO `size`, so it is
// always whatever the current default plot is (128 as of 2026-07).
//
// Use `node eval.mjs samples/grass-check.tsx`; read 01-04 for the orbit read,
// 06-ground for the grazing read and 06b-ground-close for the eye-level read.
import React from 'react';
import { Park, Terrain } from './components/Park';

export default function GrassCheck() {
  return (
    <Park seed={1} climate="temperate" guests={0}>
      <Terrain />
    </Park>
  );
}
