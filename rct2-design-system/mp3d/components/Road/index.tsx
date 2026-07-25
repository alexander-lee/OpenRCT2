import React from 'react';
import { NormalPath } from '../NormalPath';

// DEPRECATED: Road is replaced by the RCT2 footpath set — use NormalPath for
// paved walkways, DirtPath for trodden trails and QueuePath for ride queues.
// Kept only as an alias so existing designs keep rendering.
export function Road() {
  return <NormalPath />;
}
