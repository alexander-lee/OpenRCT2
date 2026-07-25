import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[220,1264,45,24],[266,1264,45,24],[312,1264,45,24],[358,1264,45,24]];

export function LoopingRollerCoasterTrack() {
  return <SpriteRotator name="Looping Roller Coaster Track" group="Track Rail" cells={CELLS} />;
}
