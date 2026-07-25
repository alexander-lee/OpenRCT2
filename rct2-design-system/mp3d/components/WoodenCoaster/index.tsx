import React from 'react';
import { SplineCoaster } from '../SplineCoaster';

// DEPRECATED: WoodenCoaster (the original starter rig) is replaced by the
// SplineCoaster system — freeform spline rails with parallel-transport frames,
// curvature banking, chain lift and energy-paced trains (opts: { wood: true }
// gives the wooden aesthetic). For RCT2-style grid pieces use TrackKit /
// CoasterBuilder. Kept only as an alias so existing designs keep rendering.
export function WoodenCoaster() {
  return <SplineCoaster />;
}
