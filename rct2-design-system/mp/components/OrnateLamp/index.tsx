import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[1054,715,37,70],[1092,715,37,70],[1130,715,37,70],[0,813,37,70]];

export function OrnateLamp() {
  return <SpriteRotator name="Ornate Lamp" group="Scenery \u00b7 Urban" cells={CELLS} />;
}
