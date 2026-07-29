// park-eval LAYOUT UNIQUENESS metrics (RUBRIC.md axis 15).
//
// Pure functions over the raw street net / ride positions / plaza rects the
// probe lifts off the live ParkStore (`probe.json.layoutRaw`), so the whole
// axis can be recalibrated over a stored corpus WITHOUT re-rendering anything
// (this is also what makes the metric auditable: every term is published).
//
//   layoutMetrics(raw)  -> the `layout` object probe.json publishes
//   signatureOf(m)      -> the 29-dim comparable layout SIGNATURE vector
//   sigDistance(a, b)   -> mean |Δ| per dimension, 0 = identical shape stats
//
// Everything is scale-normalised by the park `size` so a size-16 park and a
// size-48 park are measured on the same ruler.

const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

/** Shannon entropy (nats) of a count map, and its PERPLEXITY exp(H) — the
 *  "effective number of distinct classes". A perfect lattice with one edge
 *  length has perplexity 1; five evenly-used length classes give ~5. */
function perplexity(counts) {
  const vals = Object.values(counts).filter((c) => c > 0);
  const n = vals.reduce((a, b) => a + b, 0);
  if (!n) return { H: 0, eff: 1 };
  let H = 0;
  for (const c of vals) {
    const p = c / n;
    H -= p * Math.log(p);
  }
  return { H, eff: Math.exp(H) };
}

const ANG_BINS = 12; // 15° bins over [0, 180) — orientation is undirected

// ---------------------------------------------------------------------------
// DISTRICT SCALE — THE ONE SOURCE OF TRUTH (wave-10 P0)
//
// `rules/park-generation.md` §0.3 check 4 and §0.15 mandate **≥ 40 u between
// district centres at size 192** (≥ 20 u at 48), derived from district
// FOOTPRINTS. This harness used to derive its two district numbers as blind
// PLOT FRACTIONS off the size-48 figures — cut `0.25·size`, target `20·size/48`
// — which at the wave-8 default of 192 became 48 u and 80 u: the cut then
// exceeded most measured inter-district gaps (so a 4-district park read as ONE
// district) and the target was double what the rulebook asks. A park that
// obeyed the rules scored 0/1. `node probe-layout-thresholds.mjs` is the
// measurement; these two functions are the published answer, and
// `score-layout.mjs` / `RUBRIC.md` / §0.3 check 4 all cite THEM.
//
//   separationFloor(S) — the floor on the distance between two district
//     centres. Footprint-derived, NOT a plot fraction: a district's measured
//     diameter (19.4-23.0 u at 192, 5.8-19.0 u at 48 — probe section 1, with
//     §4.0-A's flagship ring alone at 37.6 × 37.6) plus one approach boulevard
//     (≥ 8 lattice cells = 9.6 u at 192, 4 cells = 4.8 u at 48). That brackets
//     the rulebook's two published anchors, 20 u @48 and 40 u @192, and
//     `20·√(S/48)` is the curve through both. A blind ×4 to 80 u is REFUTED by
//     measurement: inside §0.3's gate-reach band, with a district footprint
//     allowed for, the largest MUTUAL separation three district centres can
//     reach is 75.0 u, four 60.2 u and five 54.1 u (probe section 2), so an
//     80-u floor would mandate a park the acceptance sim cannot ride.
//
//   clusterCut(S) — how close two rides have to be to count as the same place.
//     0.6 · the floor: it must sit ABOVE every intra-district ride gap and
//     BELOW the floor. Measured (probe section 1): intra-district ride gaps run
//     4.6-9.4 u at 48 and 7.2-18.0 u at 192; inter-district jumps run
//     10.9-33.8 u at 48 and 20.6-61.4 u at 192. 0.6 keeps the size-48 value at
//     exactly the 12 u the size-48 reference parks were calibrated on (so every
//     48/16 park in the corpus is bit-identical), and gives 24 u at 192 — above
//     every measured intra-district gap, below every measured jump.
export const districtSeparationFloor = (S) => r2(20 * Math.sqrt((S || 48) / 48));
export const districtClusterCut = (S) => r2(0.6 * districtSeparationFloor(S));

export function layoutMetrics(raw) {
  const S = raw.size || 48;
  const nodes = raw.nodes || [];
  const allEdges = (raw.edges || []).filter(([a, b]) => nodes[a] && nodes[b] && a !== b);
  // GRID / LATTICE / CURVE metrics measure the AUTHORED STREET net only.
  // `streetNodes` (from <Paths>) is the count of street nodes; every node past
  // that index is a queue/exit access spur the GameManager appended, and those
  // stubs are short, odd-length and sometimes oblique — including them flatters
  // a monotonous lattice (Cinder Peak reads 0.57 with spurs, 0.79 without).
  // DISTRICT / PLOT / OPEN-SPACE metrics use the WHOLE net.
  const sn = Number.isFinite(raw.streetNodes) ? raw.streetNodes : nodes.length;
  const edges = allEdges.filter(([a, b]) => a < sn && b < sn);
  const streetOnly = edges.length !== allEdges.length;
  const allRides = (raw.rides || []).filter((r) => r.at);
  // districts are read off the REGISTERED roster when there is one (a fatal /
  // unregistered coaster visual is not an attraction guests can reach)
  const rides = allRides.some((r) => r.registered) ? allRides.filter((r) => r.registered) : allRides;
  const plazas = raw.plazas || [];

  // ---------------------------------------------------------------------
  // 1. EDGE GEOMETRY — lengths, orientations, cardinal/diagonal content
  // ---------------------------------------------------------------------
  const segs = edges.map(([a, b]) => {
    const dx = nodes[b][0] - nodes[a][0];
    const dz = nodes[b][1] - nodes[a][1];
    const len = Math.hypot(dx, dz);
    let ang = (Math.atan2(dz, dx) * 180) / Math.PI;
    ang = ((ang % 180) + 180) % 180; // undirected bearing in [0, 180)
    return { a, b, len, ang };
  });
  const nE = segs.length;
  const offAxis = (ang) => Math.min(Math.abs(ang - 0), Math.abs(ang - 90), Math.abs(ang - 180));
  const offDiag = (ang) => Math.min(Math.abs(ang - 45), Math.abs(ang - 135));
  const AX_TOL = 5; // degrees: within 5° of a cardinal axis counts as axis-aligned
  const axisAligned = segs.filter((s) => offAxis(s.ang) <= AX_TOL).length;
  const diagonal = segs.filter((s) => offDiag(s.ang) <= AX_TOL).length;
  const axisAlignedFraction = nE ? axisAligned / nE : 0;
  const diagonalFraction = nE ? diagonal / nE : 0;
  const obliqueEdgeFraction = 1 - axisAlignedFraction;

  // ---------------------------------------------------------------------
  // 1b. SET-PIECE MEMBER EDGES (wave-12 P0, round 11's park) — EXCLUDED from
  // the edge-length VARIETY terms only, the same way access spurs are
  // excluded from the grid/lattice/curve block above.
  //
  // A `<Boulevard>`'s carriageway is authored as a chain of 1.2 u lattice
  // cells (one node per cell — Boulevard/index.tsx `localEdges`), a
  // `<Bazaar>`'s aisle the same, and a `<FountainPlaza>`'s walkable ring is a
  // handful of fixed-length legs around the basin. All three are the DESIGN
  // SYSTEM'S OWN macro geometry, not a choice the author made about block
  // size — but the length-variety histogram cannot tell "the rulebook's
  // recommended boulevard" from "an author who hand-chained 100 unit edges to
  // fake variety": round 11's park routed seven boulevards exactly as
  // `rules/park-generation.md` §3 advises and measured `effectiveClasses
  // 1.96` / `modalShare 0.857` with 132 of 154 edges at 1.2 u — LOSING the
  // 0.75-pt block-size-variety term for following the rules.
  //
  // The fix reads `raw.setPieces[].bbox` (probe.mjs, world-space bbox of the
  // piece's own mounted dressing group — its lamps/trees/benches/props sit at
  // the same world coordinates as its internal chain/ring, so the box is a
  // reasonable proxy for "this edge belongs to piece X's own sub-net", even
  // though the carriageway SLAB itself is drawn by the shared <Paths>
  // component and is not literally inside that group). An edge is a MEMBER
  // edge when BOTH its endpoints fall inside some piece's padded bbox. This
  // is a proxy, not a byte-exact membership tag (a boulevard's stations start
  // one `spacing` in from its ports, so a short run right at the port may
  // read as "authored" rather than "member" — a conservative miss, not a
  // false exclusion), and it is a NO-OP for any park with no `raw.setPieces`
  // at all, so a park that hand-chains uniform edges WITHOUT ever using a
  // macro piece gets no exclusion and no help from this fix.
  const PIECE_BBOX_PAD = 0.75; // u — dressing sits >= 1.35 u off a boulevard's
  // centreline and a plaza's benches sit inside `ring`, so a small pad closes
  // rounding gaps without pulling in an unrelated street a few units away
  const pieceBoxes = (raw.setPieces || [])
    .filter((p) => p && p.bbox)
    .map((p) => ({
      x0: p.bbox.min[0] - PIECE_BBOX_PAD, x1: p.bbox.max[0] + PIECE_BBOX_PAD,
      z0: p.bbox.min[2] - PIECE_BBOX_PAD, z1: p.bbox.max[2] + PIECE_BBOX_PAD,
    }));
  const inBox = (x, z, b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  const nodeInAnyPiece = (i) => pieceBoxes.some((b) => inBox(nodes[i][0], nodes[i][1], b));
  const isMemberEdge = (s) => pieceBoxes.length > 0 && nodeInAnyPiece(s.a) && nodeInAnyPiece(s.b);
  const memberEdgeCount = pieceBoxes.length ? segs.filter(isMemberEdge).length : 0;

  // length classes, quantised to the DS half-pitch (0.6 u). Computed TWICE:
  // `*Raw` over every street edge (the pre-wave-12 behaviour, kept for
  // audit), and the published fields over the AUTHORED SPINE only (set-piece
  // member edges excluded) — see the block comment above.
  const LEN_Q = 0.6;
  const lengthStats = (segList) => {
    const counts = {};
    segList.forEach((s) => {
      const k = (Math.round(s.len / LEN_Q) * LEN_Q).toFixed(1);
      counts[k] = (counts[k] || 0) + 1;
    });
    const n = segList.length;
    const p = perplexity(counts);
    const lensL = segList.map((s) => s.len);
    const meanL = n ? lensL.reduce((a, b) => a + b, 0) / n : 0;
    const varL = n ? lensL.reduce((a, b) => a + (b - meanL) ** 2, 0) / n : 0;
    return {
      counts,
      eff: p.eff,
      cv: meanL > 0 ? Math.sqrt(varL) / meanL : 0,
      modalShare: n ? Math.max(0, ...Object.values(counts)) / n : 0,
    };
  };
  const authoredSegs = pieceBoxes.length ? segs.filter((s) => !isMemberEdge(s)) : segs;
  const lenStatsRaw = lengthStats(segs);
  const lenStats = lengthStats(authoredSegs);
  const lenCounts = lenStats.counts;
  const lenP = { eff: lenStats.eff };
  const lengthCV = lenStats.cv;
  const modalLenShare = lenStats.modalShare;

  // orientation classes, 15° bins
  const angCounts = {};
  segs.forEach((s) => {
    const b = Math.min(ANG_BINS - 1, Math.floor(s.ang / (180 / ANG_BINS)));
    angCounts[b] = (angCounts[b] || 0) + 1;
  });
  const angP = perplexity(angCounts);
  const orientationBinsUsed = Object.keys(angCounts).length;
  // 6-bin (30°) orientation histogram — part of the signature
  const hist6 = new Array(6).fill(0);
  segs.forEach((s) => { hist6[Math.min(5, Math.floor(s.ang / 30))] += 1; });
  const orientationHist6 = hist6.map((c) => (nE ? c / nE : 0));

  // ---------------------------------------------------------------------
  // 2. LATTICE FIT — grid lines, pitch classes, degree-4 share
  // ---------------------------------------------------------------------
  const COORD_Q = 0.05; // node coordinates are authored on a 0.05 u grid
  const lineMap = (idx, limit = nodes.length) => {
    const m = {};
    nodes.slice(0, limit).forEach((n) => {
      const k = (Math.round(n[idx] / COORD_Q) * COORD_Q).toFixed(2);
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  };
  // a GRID LINE is a coordinate value shared by >= 3 nodes (an isolated spur
  // coordinate is not lattice evidence)
  const gridLines = (m) => Object.keys(m).filter((k) => m[k] >= 3).map(Number).sort((a, b) => a - b);
  const xm = lineMap(0, sn), zm = lineMap(1, sn);
  const colLines = gridLines(xm), rowLines = gridLines(zm);
  const onLine = (v, lines) => lines.some((l) => Math.abs(v - l) <= 0.06);
  const streetNodeList = nodes.slice(0, sn);
  const latticeNodes = streetNodeList.filter((n) => onLine(n[0], colLines) && onLine(n[1], rowLines)).length;
  const latticeNodeShare = streetNodeList.length ? latticeNodes / streetNodeList.length : 0;

  // pitch classes: the distinct spacings between consecutive grid lines
  const PITCH_Q = 0.3;
  const pitchClasses = (lines) => {
    const set = new Set();
    for (let i = 1; i < lines.length; i++) {
      const d = lines[i] - lines[i - 1];
      if (d > 0.3) set.add((Math.round(d / PITCH_Q) * PITCH_Q).toFixed(1));
    }
    return [...set].sort();
  };
  const xPitches = pitchClasses(colLines), zPitches = pitchClasses(rowLines);
  const pu = (p) => (p.length === 0 ? 0 : 1 / p.length);
  const pitchUniformity = (pu(xPitches) + pu(zPitches)) / 2;

  // node degrees
  const deg = nodes.map(() => 0);
  edges.forEach(([a, b]) => { deg[a] += 1; deg[b] += 1; });
  const degShare = (f) => (sn ? deg.slice(0, sn).filter(f).length / sn : 0);
  const deg1Share = degShare((d) => d === 1);
  const deg2Share = degShare((d) => d === 2);
  const deg3Share = degShare((d) => d === 3);
  const deg4Share = degShare((d) => d >= 4);

  // ---- THE HEADLINE NUMBER: gridRegularity in [0, 1] (HIGHER = MORE
  // LATTICE-LIKE = WORSE). Fixed weights; every term is published above so
  // two scorers reach the same value.
  const g1 = axisAlignedFraction;                   // all-cardinal streets
  const g2 = clamp01(1 / lenP.eff);                 // one edge length only (AUTHORED spine — set-piece member edges excluded, see 1b above)
  const g3 = clamp01(2 / Math.max(1e-9, angP.eff)); // only the 2 cardinal bearings
  const g4 = latticeNodeShare;                      // nodes on col ∩ row lines
  const g5 = pitchUniformity;                       // a single pitch per axis
  const gridRegularity = clamp01(0.25 * g1 + 0.25 * g2 + 0.15 * g3 + 0.2 * g4 + 0.15 * g5);
  // pre-wave-12 number, kept for audit: `lengthUniformity` computed over
  // EVERY street edge, set-piece member chains included
  const g2Raw = clamp01(1 / lenStatsRaw.eff);
  const gridRegularityRaw = clamp01(0.25 * g1 + 0.25 * g2Raw + 0.15 * g3 + 0.2 * g4 + 0.15 * g5);

  // ---------------------------------------------------------------------
  // 3. CURVE / NON-RIGHT-ANGLE CONTENT
  // ---------------------------------------------------------------------
  // bearings measured OUT of each node (0..360)
  const outDir = nodes.map(() => []);
  edges.forEach(([a, b]) => {
    const ab = (Math.atan2(nodes[b][1] - nodes[a][1], nodes[b][0] - nodes[a][0]) * 180) / Math.PI;
    outDir[a].push((ab + 360) % 360);
    outDir[b].push((ab + 180 + 360) % 360);
  });
  const JUNC_TOL = 8; // degrees off 0/90/180 before a junction reads oblique
  let obliqueJunctions = 0, junctions = 0;
  nodes.forEach((_, i) => {
    if (outDir[i].length < 2) return;
    junctions += 1;
    let oblique = false;
    for (let p = 0; p < outDir[i].length; p++)
      for (let q = p + 1; q < outDir[i].length; q++) {
        let d = Math.abs(outDir[i][p] - outDir[i][q]) % 360;
        if (d > 180) d = 360 - d;
        const off = Math.min(Math.abs(d - 90), Math.abs(d - 180), Math.abs(d - 0));
        if (off > JUNC_TOL) oblique = true;
      }
    if (oblique) obliqueJunctions += 1;
  });
  const obliqueJunctionFraction = junctions ? obliqueJunctions / junctions : 0;

  // CURVED RUNS: >= 3 consecutive degree-2 nodes each turning 8°..60° the same
  // way — an actual sweeping street rather than a staircase of right angles
  let curvedRuns = 0;
  {
    const adj = nodes.map(() => []);
    edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    const turnAt = (prev, cur, next) => {
      const a1 = Math.atan2(nodes[cur][1] - nodes[prev][1], nodes[cur][0] - nodes[prev][0]);
      const a2 = Math.atan2(nodes[next][1] - nodes[cur][1], nodes[next][0] - nodes[cur][0]);
      let d = ((a2 - a1) * 180) / Math.PI;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      return d;
    };
    const used = new Set();
    nodes.forEach((_, i) => {
      if (adj[i].length !== 2 || used.has(i)) return;
      // walk the degree-2 chain through i in both directions
      const chain = [i];
      for (const startDir of [0, 1]) {
        let prev = i, cur = adj[i][startDir];
        while (cur !== undefined && adj[cur].length === 2 && !chain.includes(cur)) {
          if (startDir === 0) chain.unshift(cur); else chain.push(cur);
          const nxt = adj[cur].find((n) => n !== prev);
          prev = cur; cur = nxt;
        }
        if (cur !== undefined && !chain.includes(cur)) { if (startDir === 0) chain.unshift(cur); else chain.push(cur); }
      }
      chain.forEach((n) => { if (adj[n].length === 2) used.add(n); });
      let run = 0;
      for (let k = 1; k + 1 < chain.length; k++) {
        const t = turnAt(chain[k - 1], chain[k], chain[k + 1]);
        if (Math.abs(t) >= 8 && Math.abs(t) <= 60) run += 1; else run = 0;
        if (run >= 3) { curvedRuns += 1; run = 0; }
      }
    });
  }

  // ---------------------------------------------------------------------
  // 4. DISTRICT STRUCTURE — single-link clustering of the ride positions
  // ---------------------------------------------------------------------
  // rides closer than CUT share a district — 12 u @48, 24 u @192, published
  // above (was `0.25·S`, a plot fraction that merged whole parks at 192)
  const CUT = districtClusterCut(S);
  const clusters = [];
  {
    const pts = rides.map((r) => ({ name: r.name, x: (r.centre || r.at)[0], z: (r.centre || r.at)[1] }));
    const parent = pts.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        if (Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) <= CUT) parent[find(i)] = find(j);
    const groups = {};
    pts.forEach((p, i) => { const r = find(i); (groups[r] = groups[r] || []).push(p); });
    Object.values(groups).forEach((g) => {
      clusters.push({
        rides: g.map((p) => p.name),
        size: g.length,
        centroid: [r2(g.reduce((a, p) => a + p.x, 0) / g.length), r2(g.reduce((a, p) => a + p.z, 0) / g.length)],
      });
    });
    clusters.sort((a, b) => b.size - a.size);
  }
  let maxSep = 0, minSep = Infinity;
  for (let i = 0; i < clusters.length; i++)
    for (let j = i + 1; j < clusters.length; j++) {
      const d = Math.hypot(clusters[i].centroid[0] - clusters[j].centroid[0], clusters[i].centroid[1] - clusters[j].centroid[1]);
      maxSep = Math.max(maxSep, d); minSep = Math.min(minSep, d);
    }
  if (!Number.isFinite(minSep)) minSep = 0;
  // §0.3 check 4's floor: 20 u @48, 40 u @192 (was `20·S/48` → 80 u @192)
  const SEP_TARGET = districtSeparationFloor(S);

  // ---------------------------------------------------------------------
  // 5. PLOT UTILISATION — is the whole plot used, or one huddled quadrant?
  // ---------------------------------------------------------------------
  const feats = [
    ...nodes.map((n) => ({ x: n[0], z: n[1] })),
    ...rides.map((r) => ({ x: (r.centre || r.at)[0], z: (r.centre || r.at)[1] })),
    ...(raw.stalls || []).filter((s) => s.at).map((s) => ({ x: s.at[0], z: s.at[1] })),
    ...plazas.map((p) => ({ x: p[0], z: p[1] })),
  ];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  nodes.forEach((n) => { minX = Math.min(minX, n[0]); maxX = Math.max(maxX, n[0]); minZ = Math.min(minZ, n[1]); maxZ = Math.max(maxZ, n[1]); });
  const pathExtentFraction = nodes.length ? clamp01(((maxX - minX) * (maxZ - minZ)) / (S * S)) : 0;
  const G = 8; // 8x8 coarse grid over the plot (6 u cells at size 48)
  const cells = new Set();
  feats.forEach((f) => {
    const ix = Math.floor(((f.x + S / 2) / S) * G), iz = Math.floor(((f.z + S / 2) / S) * G);
    if (ix >= 0 && iz >= 0 && ix < G && iz < G) cells.add(iz * G + ix);
  });
  const occupancyFraction = cells.size / (G * G);
  const quad = [0, 0, 0, 0];
  feats.forEach((f) => { quad[(f.x >= 0 ? 1 : 0) + (f.z >= 0 ? 2 : 0)] += 1; });
  // quadrantBalance (min share / 0.25) demands all FOUR quadrants — too strict:
  // a legitimate two-district park leaves one corner as woodland. What must be
  // caught is CONCENTRATION, so the scored term is quadrantSpread, driven by
  // the BIGGEST quadrant share: 1 quadrant = 0, even = 1, two-even = 0.67.
  const quadrantBalance = feats.length ? clamp01((4 * Math.min(...quad)) / feats.length) : 0;
  const maxQuadShare = feats.length ? Math.max(...quad) / feats.length : 1;
  const quadrantSpread = clamp01((1 - maxQuadShare) / 0.75);
  const cx = feats.length ? feats.reduce((a, f) => a + f.x, 0) / feats.length : 0;
  const cz = feats.length ? feats.reduce((a, f) => a + f.z, 0) / feats.length : 0;
  const centroidOffset = clamp01(Math.hypot(cx, cz) / (S / 2));
  // occupancy target 0.35 of an 8x8 grid (22 of 64 cells): a corridor-based
  // street net legitimately touches fewer cells than an area-filling lattice
  const plotUtilisation = clamp01(
    0.4 * clamp01(pathExtentFraction / 0.55) + 0.3 * clamp01(occupancyFraction / 0.35) + 0.3 * quadrantSpread,
  );

  // ---------------------------------------------------------------------
  // 6. OPEN SPACE — plaza rects merged into connected open SPACES, so a
  //    fountain court paved out of nine 1.2 u cells counts as ONE plaza
  // ---------------------------------------------------------------------
  const openSpaces = [];
  {
    const parent = plazas.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const touch = (A, B) =>
      Math.abs(A[0] - B[0]) <= A[2] / 2 + B[2] / 2 + 0.1 && Math.abs(A[1] - B[1]) <= A[3] / 2 + B[3] / 2 + 0.1;
    for (let i = 0; i < plazas.length; i++)
      for (let j = i + 1; j < plazas.length; j++) if (touch(plazas[i], plazas[j])) parent[find(i)] = find(j);
    const groups = {};
    plazas.forEach((p, i) => { const r = find(i); (groups[r] = groups[r] || []).push(p); });
    Object.values(groups).forEach((g) => {
      const x0 = Math.min(...g.map((p) => p[0] - p[2] / 2)), x1 = Math.max(...g.map((p) => p[0] + p[2] / 2));
      const z0 = Math.min(...g.map((p) => p[1] - p[3] / 2)), z1 = Math.max(...g.map((p) => p[1] + p[3] / 2));
      openSpaces.push({
        rects: g.length,
        area: r2(g.reduce((a, p) => a + p[2] * p[3], 0)),
        bboxArea: r2((x1 - x0) * (z1 - z0)),
        centre: [r2((x0 + x1) / 2), r2((z0 + z1) / 2)],
      });
    });
    openSpaces.sort((a, b) => b.area - a.area);
  }
  const areas = openSpaces.map((o) => o.area);
  const openSpaceCount = openSpaces.length;
  const largestOpenArea = areas.length ? areas[0] : 0;
  const openAreaSpread = areas.length >= 2 ? r2(areas[0] / Math.max(0.01, areas[areas.length - 1])) : 1;
  const totalOpenArea = r2(areas.reduce((a, b) => a + b, 0));

  // ---------------------------------------------------------------------
  // 7. LANDMARKS / SET PIECES
  // ---------------------------------------------------------------------
  const setPieceKinds = [...new Set((raw.setPieces || []).map((s) => s.kind))].sort();
  const sceneryKinds = Object.keys(raw.sceneryByName || {});
  const LANDMARK = /statue|gazebo|clock|obelisk|fountain|arch|monument|birdbath|topiary|bandstand|flagpole|tower/i;
  const landmarkSceneryKinds = sceneryKinds.filter((k) => LANDMARK.test(k)).sort();
  const landmarkVariety = setPieceKinds.length + landmarkSceneryKinds.length;

  const m = {
    parkSize: S,
    net: {
      nodes: nodes.length, edges: allEdges.length,
      streetNodes: sn, streetEdges: nE, accessSpursExcluded: streetOnly,
      meanEdgeLen: r2(nE ? segs.reduce((a, s) => a + s.len, 0) / nE : 0),
      totalLength: r2(segs.reduce((a, s) => a + s.len, 0)),
      setPieceMemberEdges: memberEdgeCount,
    },

    gridRegularity: r3(gridRegularity),
    gridRegularityRaw: r3(gridRegularityRaw),
    gridTerms: { axisAligned: r3(g1), lengthUniformity: r3(g2), bearingUniformity: r3(g3), latticeNodeShare: r3(g4), pitchUniformity: r3(g5) },
    gridWeights: { axisAligned: 0.25, lengthUniformity: 0.25, bearingUniformity: 0.15, latticeNodeShare: 0.2, pitchUniformity: 0.15 },

    edgeLengths: {
      // AUTHORED SPINE only (set-piece member edges excluded — see 1b above)
      distinctClasses: Object.keys(lenCounts).length,
      effectiveClasses: r2(lenP.eff),
      modalShare: r3(modalLenShare),
      cv: r3(lengthCV),
      byClass: lenCounts,
      // pre-wave-12 numbers, every street edge included (audit trail)
      distinctClassesRaw: Object.keys(lenStatsRaw.counts).length,
      effectiveClassesRaw: r2(lenStatsRaw.eff),
      modalShareRaw: r3(lenStatsRaw.modalShare),
      cvRaw: r3(lenStatsRaw.cv),
      byClassRaw: lenStatsRaw.counts,
    },
    edgeBearings: {
      axisAlignedFraction: r3(axisAlignedFraction),
      diagonalFraction: r3(diagonalFraction),
      obliqueEdgeFraction: r3(obliqueEdgeFraction),
      binsUsed: orientationBinsUsed,
      effectiveBins: r2(angP.eff),
      hist6: orientationHist6.map(r3),
    },
    lattice: {
      colLines: colLines.length,
      rowLines: rowLines.length,
      latticeNodeShare: r3(latticeNodeShare),
      xPitchClasses: xPitches,
      zPitchClasses: zPitches,
      pitchUniformity: r3(pitchUniformity),
      degreeShare: { d1: r3(deg1Share), d2: r3(deg2Share), d3: r3(deg3Share), d4plus: r3(deg4Share) },
    },
    curves: {
      obliqueJunctions,
      junctions,
      obliqueJunctionFraction: r3(obliqueJunctionFraction),
      curvedRuns,
      hasCurveOrDiagonal: diagonalFraction > 0 || obliqueJunctions > 0 || curvedRuns > 0,
    },

    districts: {
      count: clusters.length,
      cutDistance: r2(CUT),
      separationTarget: r2(SEP_TARGET),
      maxSeparation: r2(maxSep),
      minSeparation: r2(minSep),
      separated: clusters.length >= 2 && maxSep >= SEP_TARGET,
      clusters,
    },
    plot: {
      pathExtentFraction: r3(pathExtentFraction),
      occupancyFraction: r3(occupancyFraction),
      quadrantCounts: quad,
      quadrantBalance: r3(quadrantBalance),
      maxQuadrantShare: r3(maxQuadShare),
      quadrantSpread: r3(quadrantSpread),
      centroidOffset: r3(centroidOffset),
      plotUtilisation: r3(plotUtilisation),
    },
    openSpace: {
      plazaRects: plazas.length,
      count: openSpaceCount,
      largestArea: largestOpenArea,
      totalArea: totalOpenArea,
      areaSpread: openAreaSpread,
      spaces: openSpaces.slice(0, 8),
    },
    landmarks: {
      setPieceKinds,
      setPieceCount: (raw.setPieces || []).length,
      distinctSceneryKinds: sceneryKinds.length,
      landmarkSceneryKinds,
      landmarkVariety,
    },
  };
  m.signature = signatureOf(m);
  return m;
}

/** the comparable LAYOUT SIGNATURE — 29 fixed dimensions, each normalised to
 *  roughly [0, 1]. NOT a hash: two parks that look alike land close together,
 *  so `sigDistance` is a real novelty measure. */
export const SIG_DIMS = [
  'axisAligned', 'diagonal', 'obliqueJunction', 'lengthUniformity', 'bearingUniformity',
  'latticeNodeShare', 'pitchUniformity', 'deg1', 'deg2', 'deg3', 'deg4plus',
  'cycleRatio', 'meanEdgeLen', 'pathDensity', 'nodeDensity',
  'pathExtent', 'occupancy', 'quadrantSpread', 'centroidOffset',
  'districtCount', 'districtSeparation', 'openSpaceCount', 'openArea', 'curvedRuns',
  'bearing0', 'bearing30', 'bearing60', 'bearing90', 'bearing120',
];

export function signatureOf(m) {
  const S = m.parkSize || 48;
  const N = m.net.streetNodes || m.net.nodes || 1;
  const cycleRatio = (m.net.streetEdges ?? m.net.edges) - N + 1;
  const v = [
    m.edgeBearings.axisAlignedFraction,
    m.edgeBearings.diagonalFraction,
    m.curves.obliqueJunctionFraction,
    m.gridTerms.lengthUniformity,
    m.gridTerms.bearingUniformity,
    m.lattice.latticeNodeShare,
    m.lattice.pitchUniformity,
    m.lattice.degreeShare.d1,
    m.lattice.degreeShare.d2,
    m.lattice.degreeShare.d3,
    m.lattice.degreeShare.d4plus,
    clamp01((cycleRatio / Math.max(1, N)) * 4),
    clamp01(m.net.meanEdgeLen / (S * 0.15)),
    clamp01(m.net.totalLength / (S * S * 0.35)),
    clamp01((m.net.streetNodes || m.net.nodes) / (S * 2)),
    m.plot.pathExtentFraction,
    m.plot.occupancyFraction,
    m.plot.quadrantSpread,
    m.plot.centroidOffset,
    clamp01(m.districts.count / 5),
    clamp01(m.districts.maxSeparation / S),
    clamp01(m.openSpace.count / 5),
    clamp01(m.openSpace.totalArea / (S * S * 0.02)),
    clamp01(m.curves.curvedRuns / 4),
    ...m.edgeBearings.hist6.slice(0, 5), // the 6th bin is 1 − Σ, so it is redundant
  ];
  return v.map((x) => r3(clamp01(x)));
}

/** mean absolute difference per dimension — 0 = the same shape statistics */
export function sigDistance(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return r3(s / a.length);
}

/** Jaccard distance between two ride/stall KIND sets (roster novelty) */
export function jaccardDistance(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size && !B.size) return 0;
  let inter = 0;
  A.forEach((k) => { if (B.has(k)) inter += 1; });
  const uni = A.size + B.size - inter;
  return r3(uni ? 1 - inter / uni : 0);
}
