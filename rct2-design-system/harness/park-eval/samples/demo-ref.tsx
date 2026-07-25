// REFERENCE PARK 1 — the in-repo JSX worked example (components/Park/
// Park.previews.tsx `DemoPark`, a size-16 park). The harness mounts it
// verbatim: this is the park the design system itself ships as
// `validatePark ok: true`, so it is the strongest available substitute for
// the lost samples/demo.tsx.
//
// FIXED 2026-07-24 (disaster-recovery migration): the pre-migration copy of
// this file rendered `previews.previews[0]`, which is actually the OTHER
// preview in that file — `DistrictPark` (the size-48 canonical composition,
// see district-ref.tsx) — not `DemoPark` (previews[1]). The docstring above
// always claimed DemoPark; only the index was wrong. Import DemoPark by name
// instead of indexing into the previews array so this can't drift again.
import React from 'react';
import { DemoPark } from './components/Park/Park.previews';

export default function DemoRef() {
  return <DemoPark />;
}
