import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[0,1264,54,24],[55,1264,54,24],[110,1264,54,24],[165,1264,54,24]];

export function WoodenWildMouseTrack() {
  return <SpriteRotator name="Wooden Wild Mouse Track" group="Track Rail" cells={CELLS} />;
}
