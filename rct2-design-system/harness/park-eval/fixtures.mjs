// park-eval LAYOUT FIXTURES — build a `layoutRaw` (the exact shape probe.mjs
// publishes) WITHOUT rendering anything, so the layout-uniqueness metric can be
// calibrated and regression-tested with zero dependencies.
//
// Two sources:
//   rawFromParkSource(file)  — evaluate a park TSX's net-construction constants
//                              (NODES / EDGES / PLAZA(S) / BINS + the ride
//                              positions in its JSX). Exact for parks that
//                              author their street net as plain arithmetic,
//                              which every campaign park does.
//   CONTROLS                 — four hand-built reference layouts that pin the
//                              ends of the scale (see calibrate.mjs).
//
// A fixture is NOT a substitute for probing a live park: the live net also
// carries the GameManager's queue/exit attach nodes. It IS exact for the
// authored STREET net, which is what grid regularity measures.

import fs from 'node:fs';

/** strip TS annotations from the simple const/loop statements park files use */
function detype(src) {
  return src
    .replace(/:\s*\[number,\s*number\][\[\]]*/g, '')
    .replace(/:\s*\[number,\s*number,\s*number\][\[\]]*/g, '')
    .replace(/:\s*\[number,\s*number,\s*number,\s*number\]/g, '')
    .replace(/:\s*\[number,\s*number,\s*string\][\[\]]*/g, '')
    .replace(/:\s*number(\s*[,)=])/g, '$1')
    .replace(/\bas\s+\[[^\]]*\][\[\]]*/g, '')
    .replace(/\bas\s+const\b/g, '');
}

/**
 * Extract a layoutRaw from a park source file.
 * `opts.size` overrides the park size when the `<Park size=…>` prop is dynamic.
 */
export function rawFromParkSource(file, opts = {}) {
  const src = fs.readFileSync(file, 'utf8');
  const size = opts.size ?? Number((src.match(/size=\{(\d+)\}/) || [])[1]) ?? 48;

  // ---- the net-construction block: every top-level const/for statement that
  // mentions NODES / EDGES / PLAZA / BINS, in source order
  const lines = src.split('\n');
  const keep = [];
  let depth = 0, capturing = false;
  for (const line of lines) {
    const starts = /^(const|let|for)\b/.test(line) && /\b(NODES|EDGES|PLAZA|PLAZAS|BINS|COLS|ROWS|EXTRA|idx|RING|SPINE|HUB)\b/.test(line);
    if (!capturing && starts) capturing = true;
    if (capturing) {
      keep.push(line);
      depth += (line.match(/[{([]/g) || []).length - (line.match(/[})\]]/g) || []).length;
      if (depth <= 0 && /[;}]\s*$/.test(line)) { capturing = false; depth = 0; }
    }
  }
  const block = detype(keep.join('\n'));
  const fn = new Function(`
    ${block}
    return {
      nodes: typeof NODES !== 'undefined' ? NODES : [],
      edges: typeof EDGES !== 'undefined' ? EDGES : [],
      plazas: typeof PLAZAS !== 'undefined' ? PLAZAS : (typeof PLAZA !== 'undefined' ? [PLAZA] : []),
      bins: typeof BINS !== 'undefined' ? BINS : [],
    };
  `);
  const net = fn();

  // ---- rides: every catalog JSX element carrying position={[x, z]} and a
  // register name. Coasters are anchored on their station straight instead.
  const rides = [];
  const jsx = src.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of jsx.matchAll(/<([A-Z][A-Za-z]*)\b([^>]*?)\/?>/g)) {
    const [, kind, attrs] = m;
    if (/^(Park|Terrain|Paths|GameManager|Gate|Restroom|Neon|Scenery|Torch|Lights|Placed|Fountain|Fence|StringLights|DanceFloor|NeonSign)$/.test(kind)) continue;
    const pos = attrs.match(/position=\{\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*(?:,\s*(-?[\d.]+)\s*)?\]\}/);
    const nm = attrs.match(/name:\s*'([^']+)'/) || attrs.match(/name="([^"]+)"/);
    if (!pos) continue;
    const x = Number(pos[1]);
    const z = pos[3] !== undefined ? Number(pos[3]) : Number(pos[2]);
    rides.push({ name: nm ? nm[1] : kind, kind, registered: /register/.test(attrs), at: [x, z] });
  }
  // a <Coaster points={…}> anchors at its station (first authored point)
  const coasterName = (jsx.match(/<Coaster[\s\S]{0,400}?name="([^"]+)"/) || jsx.match(/<Coaster[\s\S]{0,400}?name=\{'([^']+)'\}/) || [])[1];
  if (coasterName && opts.coasterAt) rides.push({ name: coasterName, kind: 'Coaster', registered: true, at: opts.coasterAt });

  return {
    size,
    nodes: net.nodes.map(([x, z]) => [x, z]),
    edges: net.edges.filter((e) => e && e[0] >= 0 && e[1] >= 0),
    plazas: net.plazas,
    bins: net.bins,
    rides: opts.rides ?? rides,
    stalls: opts.stalls ?? [],
    setPieces: opts.setPieces ?? [],
    sceneryByName: opts.sceneryByName ?? {},
  };
}

// ---------------------------------------------------------------------------
// CONTROL LAYOUTS — the ends of the scale, so the thresholds are anchored
// ---------------------------------------------------------------------------

/** a PERFECT uniform lattice: the theoretical worst case (gridRegularity → 1) */
export function ctrlLattice({ size = 48, cols = 6, rows = 6, pitch = 6 } = {}) {
  const nodes = [], edges = [];
  const at = (c, r) => r * cols + c;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) nodes.push([-15 + c * pitch, 15 - r * pitch]);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) edges.push([at(c, r), at(c + 1, r)]);
      if (r + 1 < rows) edges.push([at(c, r), at(c, r + 1)]);
    }
  const rides = [[-15, 15], [-3, 9], [9, 3], [-9, -3], [3, -9], [15, -15]].map((p, i) => ({
    name: `Ride ${i + 1}`, kind: 'Carousel', registered: true, at: p,
  }));
  return { size, nodes, edges, plazas: [[0, 0, 3.6, 3.6]], bins: [], rides, stalls: [], setPieces: [], sceneryByName: {} };
}

/** everything HUDDLED in one quadrant — round 6's failure mode */
export function ctrlHuddle({ size = 48 } = {}) {
  const nodes = [], edges = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) nodes.push([2.4 + c * 2.4, 2.4 + r * 2.4]);
  const at = (c, r) => r * 5 + c;
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      if (c + 1 < 5) edges.push([at(c, r), at(c + 1, r)]);
      if (r + 1 < 5) edges.push([at(c, r), at(c, r + 1)]);
    }
  const rides = [[4.8, 4.8], [7.2, 7.2], [9.6, 4.8], [4.8, 9.6]].map((p, i) => ({
    name: `Ride ${i + 1}`, kind: 'Carousel', registered: true, at: p,
  }));
  return { size, nodes, edges, plazas: [[6, 6, 2.4, 2.4]], bins: [], rides, stalls: [], setPieces: [], sceneryByName: {} };
}

/** an ORGANIC park: a curved ring boulevard, two diagonal spokes, two clearly
 *  separated districts, three plazas of different sizes */
export function ctrlOrganic({ size = 48 } = {}) {
  const nodes = [], edges = [];
  // curved ring of 16 nodes, radius 15 with a slight ellipse (r 15 x 12)
  const RING = 16;
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2;
    nodes.push([Math.round(Math.cos(a) * 15 * 100) / 100, Math.round(Math.sin(a) * 12 * 100) / 100]);
  }
  for (let i = 0; i < RING; i++) edges.push([i, (i + 1) % RING]);
  // hub + two diagonal spokes + a north gate spur
  const hub = nodes.push([0, 0]) - 1;
  edges.push([hub, 2], [hub, 10]);           // diagonal spokes
  const gate = nodes.push([0, 20.4]) - 1;
  edges.push([gate, 4]);
  // a short south promenade off the ring at an oblique bearing
  const p1 = nodes.push([6, -16.8]) - 1;
  edges.push([p1, 13]);
  const rides = [
    { name: 'North Coaster', kind: 'Coaster', registered: true, at: [-9, 14] },
    { name: 'North Wheel', kind: 'FerrisWheel', registered: true, at: [-4, 16] },
    { name: 'South Flume', kind: 'LogFlume', registered: true, at: [7, -15] },
    { name: 'South Drop', kind: 'DropTower', registered: true, at: [12, -12] },
  ];
  return {
    size, nodes, edges,
    plazas: [[0, 0, 6, 6], [-4.8, 15.6, 3.6, 2.4], [9.6, -14.4, 2.4, 2.4]],
    bins: [], rides, stalls: [],
    setPieces: [{ kind: 'FountainPlaza', id: 'hub', at: [0, 0] }, { kind: 'Boulevard', id: 'ring', at: [0, 12] }],
    sceneryByName: { marbleStatue: 1, gazebo: 1, parkClock: 1 },
  };
}

/** a SET-PIECE park in the shape setpiece-demo builds: a fountain-plaza hub
 *  paved from 3x3 cells, four boulevards on three different spacings, a bazaar
 *  court, two districts. Reconstructed from samples/setpiece-demo.tsx's plans
 *  (hub [0,12] ports N/E/W; market [-16.8,12]; gate ave 2.4; west link 2.4;
 *  east midway 3.6; promenade [16.8,12]->[16.8,-20.4] at 4.8). */
export function ctrlSetPiece({ size = 48 } = {}) {
  const nodes = [], edges = [];
  const key = new Map();
  const N = (x, z) => {
    const k = `${x.toFixed(2)},${z.toFixed(2)}`;
    if (key.has(k)) return key.get(k);
    const i = nodes.push([x, z]) - 1;
    key.set(k, i);
    return i;
  };
  const run = (from, to, spacing) => {
    const [x0, z0] = from, [x1, z1] = to;
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(d / spacing));
    let prev = N(x0, z0);
    for (let i = 1; i <= n; i++) {
      const cur = N(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n);
      edges.push([prev, cur]);
      prev = cur;
    }
  };
  // the hub court: a 3x3 paved lattice on the 1.2 pitch around [0, 12]
  const plazas = [];
  for (let r = -1; r <= 1; r++)
    for (let c = -1; c <= 1; c++) plazas.push([c * 1.2, 12 + r * 1.2, 1.2, 1.2]);
  for (let r = -1; r <= 1; r++) run([-1.2, 12 + r * 1.2], [1.2, 12 + r * 1.2], 1.2);
  for (let c = -1; c <= 1; c++) run([c * 1.2, 10.8], [c * 1.2, 13.2], 1.2);
  // the bazaar court at [-16.8, 12] (a 2x3 paved aisle)
  for (let r = -1; r <= 1; r++) for (let c = 0; c <= 1; c++) plazas.push([-16.8 + c * 1.2, 12 + r * 1.2, 1.2, 1.2]);
  run([-16.8, 10.8], [-16.8, 13.2], 1.2);
  // the four avenues, each on its own spacing
  run([0, 22.8], [0, 13.2], 2.4);      // gate avenue
  run([-1.2, 12], [-16.8, 12], 2.4);   // market walk
  run([1.2, 12], [16.8, 12], 3.6);     // east midway
  run([16.8, 12], [16.8, -20.4], 4.8); // lake promenade
  const rides = [
    { name: 'Commons Carousel', kind: 'Carousel', registered: true, at: [-7.2, 19.2] },
    { name: 'Teacup Garden', kind: 'Teacups', registered: true, at: [14.4, 19.2] },
    { name: 'Lakeside Drop', kind: 'DropTower', registered: true, at: [10.8, -14.4] },
    { name: 'Commons Wheel', kind: 'FerrisWheel', registered: true, at: [10.8, -20.4] },
  ];
  return {
    size, nodes, edges, plazas, bins: [],
    rides,
    stalls: [
      { name: 'Commons Burgers', kind: 'BurgerShop', at: [-16.8, 13.2] },
      { name: 'Market Sodas', kind: 'SodaStand', at: [-15.6, 13.2] },
      { name: 'Spun Sugar', kind: 'CottonCandyStand', at: [-16.8, 10.8] },
      { name: 'Lantern Balloons', kind: 'BalloonStand', at: [-15.6, 10.8] },
    ],
    setPieces: [
      { kind: 'FountainPlaza', id: 'hub', at: [0, 12] },
      { kind: 'Bazaar', id: 'market', at: [-16.8, 12] },
      { kind: 'Boulevard', id: 'gate', at: [0, 18] },
      { kind: 'Boulevard', id: 'west', at: [-9, 12] },
      { kind: 'Boulevard', id: 'east', at: [9, 12] },
      { kind: 'Boulevard', id: 'promenade', at: [16.8, -4] },
    ],
    sceneryByName: { parkClock: 1, birdbath: 1 },
  };
}

export const CONTROLS = {
  'ctrl-lattice': ctrlLattice,
  'ctrl-huddle': ctrlHuddle,
  'ctrl-organic': ctrlOrganic,
  'ctrl-setpiece': ctrlSetPiece,
};
