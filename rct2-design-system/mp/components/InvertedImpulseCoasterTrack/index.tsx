import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[0,1077,44,35],[45,1077,44,35],[90,1077,44,35],[135,1077,44,35]];

export function InvertedImpulseCoasterTrack() {
  return <SpriteRotator name="Inverted Impulse Coaster Track" group="Track Rail" cells={CELLS} />;
}
