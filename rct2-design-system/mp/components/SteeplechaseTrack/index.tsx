import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[683,1237,47,25],[731,1237,47,25],[779,1237,47,25],[827,1237,47,25]];

export function SteeplechaseTrack() {
  return <SpriteRotator name="Steeplechase Track" group="Track Rail" cells={CELLS} />;
}
