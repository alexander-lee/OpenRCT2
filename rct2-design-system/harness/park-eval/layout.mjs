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

  // length classes, quantised to the DS half-pitch (0.6 u)
  const LEN_Q = 0.6;
  const lenCounts = {};
  segs.forEach((s) => {
    const k = (Math.round(s.len / LEN_Q) * LEN_Q).toFixed(1);
    lenCounts[k] = (lenCounts[k] || 0) + 1;
  });
  const lenP = perplexity(lenCounts);
  const lens = segs.map((s) => s.len);
  const meanLen = nE ? lens.reduce((a, b) => a + b, 0) / nE : 0;
  const varLen = nE ? lens.reduce((a, b) => a + (b - meanLen) ** 2, 0) / nE : 0;
  const lengthCV = meanLen > 0 ? Math.sqrt(varLen) / meanLen : 0;
  const modalLenShare = nE ? Math.max(0, ...Object.values(lenCounts)) / nE : 0;

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
  const g2 = clamp01(1 / lenP.eff);                 // one edge length only
  const g3 = clamp01(2 / Math.max(1e-9, angP.eff)); // only the 2 cardinal bearings
  const g4 = latticeNodeShare;                      // nodes on col ∩ row lines
  const g5 = pitchUniformity;                       // a single pitch per axis
  const gridRegularity = clamp01(0.25 * g1 + 0.25 * g2 + 0.15 * g3 + 0.2 * g4 + 0.15 * g5);

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
  const CUT = 0.25 * S; // 12 u on size 48: rides closer than this share a district
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
  const SEP_TARGET = 20 * (S / 48); // >= 20 u on size 48, scaled with the plot

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
      meanEdgeLen: r2(meanLen), totalLength: r2(lens.reduce((a, b) => a + b, 0)),
    },

    gridRegularity: r3(gridRegularity),
    gridTerms: { axisAligned: r3(g1), lengthUniformity: r3(g2), bearingUniformity: r3(g3), latticeNodeShare: r3(g4), pitchUniformity: r3(g5) },
    gridWeights: { axisAligned: 0.25, lengthUniformity: 0.25, bearingUniformity: 0.15, latticeNodeShare: 0.2, pitchUniformity: 0.15 },

    edgeLengths: {
      distinctClasses: Object.keys(lenCounts).length,
      effectiveClasses: r2(lenP.eff),
      modalShare: r3(modalLenShare),
      cv: r3(lengthCV),
      byClass: lenCounts,
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
