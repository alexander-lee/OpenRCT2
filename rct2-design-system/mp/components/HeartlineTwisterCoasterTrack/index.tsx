import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[0,1038,57,38],[58,1038,57,38],[116,1038,57,38],[174,1038,57,38]];

export function HeartlineTwisterCoasterTrack() {
  return <SpriteRotator name="Heartline Twister Coaster Track" group="Track Rail" cells={CELLS} />;
}
