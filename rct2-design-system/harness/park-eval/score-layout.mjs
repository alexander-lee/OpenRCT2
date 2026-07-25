// park-eval AXIS 15 SCORER — turns the `layout` object into the 7-point
// layout-uniqueness score, with every threshold numeric so two scorers reach
// the same number. This is the executable form of RUBRIC.md axis 15.

export const THRESHOLDS = {
  // 3 pts — NOT a monotonous lattice
  gridRegularityFull: 0.55, // <= 0.55 -> full 3
  gridRegularityZero: 0.75, // >= 0.75 -> 0 (Cinder Peak's uniform grid)
  effectiveLengthClasses: 3, // >= 3 effective edge-length classes
  // BLOCK IRREGULARITY. NOTE: validatePark FAILS any rendered street edge that
  // runs diagonally (RCT2 paths are N/S/E/W), so a legal park cannot earn this
  // with diagonal STREETS. The primary test is therefore "the net is not a
  // filled lattice"; non-cardinal geometry (plaza paving, spur attaches, curved
  // chains) is the alternative route.
  latticeNodeShareFull: 0.5,  // <= 0.5 of nodes on a col-line AND a row-line
  latticeNodeShareHalf: 0.7,
  obliqueEdgeFraction: 0.15,  // >= 15% of edges off the two cardinal axes
  // 2 pts — genuine district structure
  districtsRequired: 2,
  separationAtSize48: 20, // scaled by size/48
  plotUtilisationFull: 0.7,
  plotUtilisationHalf: 0.45,
  // 1 pt — plaza / open-space variety
  openSpaceCount: 2,
  openAreaSpread: 1.8,
  largestOpenArea: 8, // u^2 — a real open space, not a single 2.4 cell
  // 1 pt — cross-park novelty
  noveltyDistinct: 0.08,
  noveltyDerivative: 0.04,
};

const T = THRESHOLDS;

/** score(layout) -> { total, parts: {...}, notes: [...] } (max 7) */
export function scoreLayout(m) {
  if (!m) return { total: 0, parts: {}, notes: ['no layout metrics'] };
  const notes = [];

  // ---- 3 pts: anti-lattice ------------------------------------------------
  // 1.5 pts on gridRegularity (linear between the two thresholds),
  // 0.75 on real edge-length variety, 0.75 on curve/diagonal content.
  const gr = m.gridRegularity;
  let pGrid;
  if (gr <= T.gridRegularityFull) pGrid = 1.5;
  else if (gr >= T.gridRegularityZero) pGrid = 0;
  else pGrid = 1.5 * ((T.gridRegularityZero - gr) / (T.gridRegularityZero - T.gridRegularityFull));
  const eff = m.edgeLengths.effectiveClasses;
  const pLen = eff >= T.effectiveLengthClasses ? 0.75 : eff >= 2 ? 0.375 : 0;
  const obl = m.edgeBearings.obliqueEdgeFraction;
  const lns = m.lattice.latticeNodeShare;
  const pBlock =
    lns <= T.latticeNodeShareFull || obl >= T.obliqueEdgeFraction ? 0.75
    : lns <= T.latticeNodeShareHalf || m.curves.hasCurveOrDiagonal ? 0.375
    : 0;
  const antiLattice = pGrid + pLen + pBlock;
  if (gr >= T.gridRegularityZero) notes.push(`monotonous lattice: gridRegularity ${gr} >= ${T.gridRegularityZero}`);

  // ---- 2 pts: district structure -----------------------------------------
  const sepOk = m.districts.count >= T.districtsRequired && m.districts.maxSeparation >= m.districts.separationTarget;
  let pDistrict = sepOk ? 1 : m.districts.count >= 2 ? 0.5 : 0;
  const pu = m.plot.plotUtilisation;
  const pPlot = pu >= T.plotUtilisationFull ? 1 : pu >= T.plotUtilisationHalf ? 0.5 : 0;
  const districts = pDistrict + pPlot;
  if (!sepOk) notes.push(`districts ${m.districts.count}, maxSeparation ${m.districts.maxSeparation} vs target ${m.districts.separationTarget}`);
  if (pPlot < 1) notes.push(`plotUtilisation ${pu} (extent ${m.plot.pathExtentFraction}, occupancy ${m.plot.occupancyFraction}, quadrantSpread ${m.plot.quadrantSpread})`);

  // ---- 1 pt: plaza / open-space variety ----------------------------------
  const os = m.openSpace;
  let pPlaza = 0;
  if (os.count >= T.openSpaceCount && os.areaSpread >= T.openAreaSpread && os.largestArea >= T.largestOpenArea) pPlaza = 1;
  else if (os.count >= T.openSpaceCount) pPlaza = 0.5;
  else if (os.count === 1 && os.largestArea >= T.largestOpenArea) pPlaza = 0.25;
  if (pPlaza < 1) notes.push(`open spaces ${os.count}, spread ${os.areaSpread}, largest ${os.largestArea} u2`);

  // ---- 1 pt: cross-park novelty ------------------------------------------
  const d = m.novelty ? m.novelty.distance : null;
  let pNovel;
  if (d === null) { pNovel = 1; notes.push('empty corpus — novelty point granted by default'); }
  else if (d >= T.noveltyDistinct) pNovel = 1;
  else if (d >= T.noveltyDerivative) pNovel = 0.5;
  else pNovel = 0;
  if (d !== null && pNovel < 1) notes.push(`layout signature only ${d} from ${m.novelty.nearest}`);

  const parts = {
    antiLattice: round(antiLattice),
    antiLatticeTerms: { gridRegularity: round(pGrid), lengthVariety: round(pLen), blockIrregularity: round(pBlock) },
    districts: round(districts),
    districtTerms: { separation: round(pDistrict), plotUtilisation: round(pPlot) },
    plazaVariety: round(pPlaza),
    novelty: round(pNovel),
  };
  return { total: round(antiLattice + districts + pPlaza + pNovel), parts, notes };
}

const round = (v) => Math.round(v * 100) / 100;
