import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[1144,1264,41,22],[0,1289,41,22],[42,1289,41,22],[84,1289,41,22]];

export function WildMouseTrack() {
  return <SpriteRotator name="Wild Mouse Track" group="Track Rail" cells={CELLS} />;
}
