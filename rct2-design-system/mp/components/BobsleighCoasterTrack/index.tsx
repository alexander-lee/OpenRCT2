import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[948,1038,56,35],[1005,1038,56,35],[1062,1038,56,35],[1119,1038,56,35]];

export function BobsleighCoasterTrack() {
  return <SpriteRotator name="Bobsleigh Coaster Track" group="Track Rail" cells={CELLS} />;
}
