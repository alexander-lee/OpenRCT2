// BONUS REFERENCE — NOT one of the four requested restorations (demo,
// broadmoor, setpiece-demo, arch-w6). Mounts the OTHER preview in
// components/Park/Park.previews.tsx: `DistrictPark`, "THE canonical
// composition (size 48)" per its own description — a size-48 park whose
// streets are fused from set-piece plans (FountainPlaza hub + Bazaar +
// Boulevard) plus a hand-authored spine, with a full §4.0-A steel-rectangle
// coaster. validatePark: ok, 0 failures per the in-repo docstring.
//
// Kept alongside demo-ref.tsx because the pre-migration harness had confused
// the two (demo-ref.tsx was accidentally rendering THIS park under the
// previews[0] index — see the fix note in demo-ref.tsx). This file makes the
// distinction explicit instead of silent. It is NOT a substitute for
// samples/broadmoor.tsx — nothing in the design system or docs ties
// DistrictPark to the "broadmoor" name; see README/report for why broadmoor
// itself could not be recovered.
import React from 'react';
import { DistrictPark } from './components/Park/Park.previews';

export default function DistrictRef() {
  return <DistrictPark />;
}
