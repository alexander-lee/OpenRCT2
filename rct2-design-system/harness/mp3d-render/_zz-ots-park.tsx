// ---------------------------------------------------------------------------
// THROWAWAY FIXTURE (delete after the run) — OceanTunnelSlide's own access
// against its own lagoon, inside a real <Park>.
//
// `PerfPark` is the fixture Context.md quotes 436 draws on: <Park><Terrain/>
// <OceanTunnelSlide/></Park> with every default. w33a is the only sample park
// that mounts this ride and it fails its own circuit verification for unrelated
// reasons, so the gate never reaches a verdict line there.
//
// `AccessPark` / `AccessParkNoMask` mount the ride REGISTERED, which is the only
// way the queue lane and the two huts exist at all — they come from
// <ConfigurableRide>, not from the visual builder.
// ---------------------------------------------------------------------------
import React from 'react';
import { Park, GameManager, Terrain, Paths, Gate } from '../../mp3d/components/Park';
import type { XZ } from '../../mp3d/components/Park';
import { OceanTunnelSlide } from '../../mp3d/components/OceanTunnelSlide';
import { OceanTunnelSlide as OTSNoMask } from '../../mp3d/components/OceanTunnelSlide/_zzmask';

const ready = (report: unknown) => {
  (window as unknown as { __parkReport?: unknown }).__parkReport = report ?? { skipped: true };
};

export function PerfPark() {
  return (
    <Park onReady={ready}>
      <Terrain />
      <OceanTunnelSlide />
    </Park>
  );
}

// the ride sits on the 1.2 grid so the street lattice can meet its queue tail
const AT: [number, number, number] = [4.8, 0, -2.4];
// front 7.0 → head (4.8, 4.6), hut (4.8, 3.98), exit cells (3.6|6.0, 3.98),
// lane tail (4.8, 7.94) → the tail node is (4.8, 8.4)
const NODES: XZ[] = [
  [4.8, 21.6], // 0 gate
  [4.8, 16.8], // 1
  [4.8, 12.0], // 2
  [4.8, 8.4], // 3 queue tail
  [3.6, 8.4], // 4 exit landing (-x cell)
  [6.0, 8.4], // 5 exit landing (+x cell)
];
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [3, 5],
];
// the whole ride body + its beach + the access, kept dry and flat-ish so the
// composed lake cannot land under the cove
const KEEP_DRY: XZ[] = [];
for (let x = -26.4; x <= 14.4; x += 2.4) for (let z = -13.2; z <= 10.8; z += 2.4) KEEP_DRY.push([x, z]);
for (const n of NODES) KEEP_DRY.push(n);

function AccessParkBody({ Ride }: { Ride: React.FC<Record<string, unknown>> }) {
  return (
    <Park seed={7} size={64} guests={6} onReady={ready} cameraPose={{ position: [10, 24, 34], target: [0, 0.6, 0] }}>
      <Terrain keepDry={KEEP_DRY} />
      <Paths nodes={NODES} edges={EDGES} />
      <GameManager />
      <Gate />
      <Ride position={AT} register />
    </Park>
  );
}

export function AccessPark() {
  return <AccessParkBody Ride={OceanTunnelSlide as unknown as React.FC<Record<string, unknown>>} />;
}

export function AccessParkNoMask() {
  return <AccessParkBody Ride={OTSNoMask as unknown as React.FC<Record<string, unknown>>} />;
}
