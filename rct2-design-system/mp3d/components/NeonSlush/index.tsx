import * as THREE from 'three';
import { box, cyl, mat, mtx, mergedBoxes, mergedParts, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildPeep } from '../Guest';
import { buildNeonSign } from '../NeonSign';
import { composableStall } from '../Park';
import { PULSE, BEAT_HZ, beatStep, beatPulse, beatKick, paletteAt } from '../PulseScenery';

// ---------------------------------------------------------------------------
// NeonSlush — the PULSE DISTRICT's stall: a GLOWING SLUSHIE BAR. A black-gloss
// club-front counter under a neon fascia, with THREE real slush machines on the
// top — transparent bowls of luminous magenta / cyan / violet slush with their
// AUGERS turning inside them, chrome lids, chrome spigots and drip trays — a
// SLUSH marquee (a real `buildNeonSign`) over the fascia, a cup-stack tower, a
// straw caddy and a syrup rack. It sells a DRINK, and its buyers walk away with
// a TALL LIDDED CUP OF GLOWING SLUSH AND A STRAW (`heldItem`: buildHeldSlush),
// not the manager's generic red cup.
//
// PALETTE: every grey here is `PULSE` straight from components/PulseScenery
// (components/PulseScenery/Context.md) — graphite, black gloss, chrome,
// concrete — and every glow steps `PULSE_PALETTE` on the district's shared
// 2.2 Hz beat via that module's exported `beatStep` / `beatPulse` / `beatKick`.
// This stall pulses on the same frame as <DanceFloor>'s tiles, <Discotron>'s
// mirror ball, <Bassline>'s tunnel hoops and <PulseScenery>'s floor patches, and
// it weathers like the speaker stacks parked beside it rather than inventing its
// own greys — the same call components/SushiStall makes on TIDEWATER.
//
// THE HELD CUP IS THE POINT OF THE PIECE, and the shared hold spot has bitten
// this project twice (the floss cone, then the sushi tray). See `buildHeldSlush`
// below for the arithmetic, and Context.md for the close-up verdict.
//
// Budgets: TWO real PointLights (the marquee's own, inside buildNeonSign, and
// one low under-counter wash — both night-gated), ZERO particles, static repeats
// batched through `mergedBoxes` / `mergedParts`, fine detail (straws, syrup
// bottles, LED nodes, spigot levers, cup rims) tagged `userData.lodDetail`.
// Deterministic — hashed sines only, never Math.random / Date.now; the updater
// takes ABSOLUTE time (a club never stops).
//
// THE GLOW WITHOUT A LIGHT PER GUEST: a park full of buyers cannot carry a
// PointLight each (budget 16 active park-wide), so the cup glows with an
// EMISSIVE material at ~1.3 and a translucent wall — and because the manager
// `clone()`s one prototype per stall and clones SHARE materials, the stall's own
// updater beat-pulses the slush material every held cup in the park is using
// (see HELD_GLOW below). Zero extra cost, and the drinks pulse with the floor.
// ---------------------------------------------------------------------------

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (k: number) => k * k * (3 - 2 * k);

// ---- the world's greys, straight off PULSE (no invented values) ------------
const GRAPHITE = PULSE.graphite;
const GRAPHITE_D = PULSE.graphiteDark;
const GLOSS = PULSE.gloss;
const DECK = PULSE.deck;
const CHROME = PULSE.chrome;
const CONCRETE = PULSE.concrete;
const MAGENTA = PULSE.magenta;
const CYAN = PULSE.cyan;
const VIOLET = PULSE.violet;
const RUBBER = PULSE.rubber;

const METAL = { tex: 'metal' as const, metal: 0.3, rough: 0.44 };
const CHROMEY = { tex: 'metal' as const, metal: 0.32, rough: 0.3 };
const GLOSSY = { tex: 'plastic' as const, rough: 0.2 };

/** the three flavours, in the district's three warm-free accents */
const FLAVOURS = [MAGENTA, CYAN, VIOLET];
/** cup / bowl polycarbonate — a pale cold grey-blue, nearly clear */
const POLY = 0xcfe0ea;
/** lid + straw white */
const WHITE_P = 0xf2f4f2;

// ---------------------------------------------------------------------------
// THE HELD SLUSH (GameManager StallConfig.heldItem)
// ---------------------------------------------------------------------------
// Every material a held cup uses is registered here so the STALL's updater can
// beat-pulse it: the manager builds the prototype ONCE per stall and every
// purchase is a `clone()` that SHARES these materials, so one write per frame
// lights every slushie in the park. Materials are never disposed by the manager
// (its own contract), and writing `emissiveIntensity` on a disposed material is
// harmless, so this cannot dangle. The set is cleared if it somehow grows past
// a sane number of stalls.
const HELD_GLOW = new Set<THREE.MeshStandardMaterial>();

/**
 * `buildHeldSlush(t) → THREE.Group` — a TALL LIDDED CUP of glowing slush with a
 * straw. Peep-local units: head radius 0.12, closed fist ball radius 0.05
 * centred at arm-local (0, −0.32, 0). The park's 0.5 GUEST_SCALE is applied by
 * the guest rig, so nothing here is pre-scaled for it.
 *
 * THE HOLD-SPOT ARITHMETIC — the third time this project has paid for it (the
 * floss cone, then the sushi tray). The manager parents this group at the DRINK
 * hand hold spot, arm-local (±0.03, −0.37, 0.115): 0.05 BELOW the fist centre
 * and 0.115 IN FRONT of it, because the spot is sized for a fat burger. A slim
 * item left at that origin floats a clear air gap ahead of the fist — the
 * generic 0.06-radius cup only just grazes it, and anything slimmer plainly
 * hovers. So this group carries its own offset:
 *
 *   g.position = (−0.01, −0.069, −0.115),  g.rotation.x = 0.5
 *
 * which puts the cup's axis at arm-local (0.02, …, 0.062) at the GRIP height —
 * i.e. INSIDE the fist ball, so the fingers visibly wrap the cup — with 0.069 of
 * the base hanging BELOW the fist like a real carried drink, and the 0.5 rad
 * forward tip swinging the rim and lid clear of the forearm box (which spans
 * arm-local z ±0.055 over the whole length of the arm; a plumb-vertical cup of
 * this height cannot clear it, and that is why the tilt is not cosmetic). A
 * LIDDED cup is what makes the tilt honest — an open cup carried at 29° is
 * spilling. The straw counter-tilts −0.38 inside the cup frame so it stands up
 * roughly plumb in the world and clears the hair at full sip lift.
 *
 * Verified with close-up renders, front and profile, on a real `buildPeep` at
 * GUEST_SCALE with the manager's exact attach transform — not just on paper. See
 * Context.md → "The held cup, close up".
 */
export function buildHeldSlush(three: typeof THREE): THREE.Group {
  const t = three;
  const g = new t.Group();
  g.position.set(-0.01, -0.069, -0.115);
  g.rotation.x = 0.5;

  const CUP_H = 0.185;
  const R_BOT = 0.038;
  const R_TOP = 0.052;

  if (HELD_GLOW.size > 48) HELD_GLOW.clear(); // paranoia; a park has a few stalls

  // ---- the glowing contents (the reason the piece exists) -----------------
  // Emissive at 1.3 with the cup wall translucent over it: the slush reads as
  // LIT at night from three metres without a PointLight anywhere near it.
  const slushMat = new t.MeshStandardMaterial({
    color: MAGENTA,
    emissive: MAGENTA,
    emissiveIntensity: 1.3,
    roughness: 0.35,
  });
  HELD_GLOW.add(slushMat);
  const fill = new t.Mesh(new t.CylinderGeometry(R_TOP - 0.006, R_BOT - 0.004, CUP_H - 0.03, 14), slushMat);
  fill.position.y = CUP_H / 2 - 0.006;
  fill.castShadow = false;
  g.add(fill);
  // the slush MOUNDS above the rim under the dome, the way it comes out of the
  // machine — a flat fill line reads as a cup of cordial
  const mound = new t.Mesh(new t.SphereGeometry(R_TOP - 0.004, 12, 8), slushMat);
  mound.scale.set(1, 0.5, 1);
  mound.position.y = CUP_H - 0.012;
  mound.castShadow = false;
  g.add(mound);

  // ---- the cup: a translucent tapered wall + a printed band + a rolled lip -
  const wallMat = new t.MeshStandardMaterial({
    color: POLY,
    emissive: MAGENTA,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.42,
    roughness: 0.12,
    side: t.DoubleSide,
  });
  HELD_GLOW.add(wallMat);
  const wall = new t.Mesh(new t.CylinderGeometry(R_TOP, R_BOT, CUP_H, 16, 1, true), wallMat);
  wall.position.y = CUP_H / 2;
  wall.castShadow = false;
  g.add(wall);
  g.add(cyl(t, R_BOT + 0.002, R_BOT + 0.002, 0.008, WHITE_P, [0, 0.004, 0], { rough: 0.5, seg: 14 })); // base disc
  g.add(cyl(t, R_TOP * 0.86, R_BOT * 1.05, 0.028, WHITE_P, [0, CUP_H * 0.34, 0], { rough: 0.55, seg: 16 })); // printed label band
  g.add(cyl(t, R_TOP + 0.004, R_TOP + 0.004, 0.012, WHITE_P, [0, CUP_H - 0.004, 0], { rough: 0.5, seg: 16 })); // rolled lip

  // ---- the DOMED LID: what makes the carry tilt honest -------------------
  const lid = new t.Mesh(new t.SphereGeometry(R_TOP + 0.002, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(t, WHITE_P, { rough: 0.35 }));
  lid.scale.set(1, 0.92, 1);
  lid.position.y = CUP_H + 0.004;
  lid.castShadow = true;
  g.add(lid);
  g.add(cyl(t, 0.014, 0.014, 0.012, WHITE_P, [0, CUP_H + 0.052, 0], { rough: 0.4, seg: 8 })); // lid boss

  // ---- the straw, counter-tilted so it stands plumb in the world ---------
  const straw = new t.Group();
  straw.position.set(0.016, CUP_H + 0.02, 0);
  straw.rotation.x = -0.38;
  g.add(straw);
  const strawMat = new t.MeshStandardMaterial({ color: WHITE_P, emissive: CYAN, emissiveIntensity: 0.35, roughness: 0.5 });
  HELD_GLOW.add(strawMat);
  const tube = new t.Mesh(new t.CylinderGeometry(0.0085, 0.0085, 0.14, 7), strawMat);
  tube.position.y = 0.06;
  tube.castShadow = false;
  straw.add(tube);
  return g;
}

// ---------------------------------------------------------------------------
// THE STALL
// ---------------------------------------------------------------------------

export interface NeonSlushOpts {
  /** add the decorative queueing guest (preview flavour — in a composed park
   *  the GameManager's real guests walk up instead; default false) */
  withGuest?: boolean;
  /** marquee text (default 'SLUSH') */
  text?: string;
}

export interface NeonSlushBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
}

/** the Neon Slush bar. Group origin on the ground at the counter's centre; the
 *  SERVING FRONT faces local +z. */
export function buildNeonSlush(three: typeof THREE, opts: NeonSlushOpts = {}): NeonSlushBuilt {
  const t = three;
  const g = new t.Group();

  // =========================================================================
  // SCALE NOTE — sized against a 0.5-scale park guest (~0.55 u tall), the same
  // way the four catalog shops, EmberRoast and SushiStall are: counter top
  // y 0.39, slush-machine lids 0.85, fascia 0.95-1.12, marquee to ~1.48.
  // =========================================================================
  const TOP = 0.39;
  const lampMats: THREE.MeshStandardMaterial[] = [];
  const lamp = (tint: number, emi = 0.2) => {
    const m = new t.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: emi, roughness: 0.35 });
    lampMats.push(m);
    return m;
  };

  // =========================================================================
  // 1. THE COUNTER — a black-gloss club front on a concrete plinth, chrome
  //    kick rail, chrome nosing and a beat-pulsed neon trim along the lip.
  //    Core: x ±0.75, z −0.39…0.39, y 0…0.36.
  // =========================================================================
  g.add(box(t, [1.56, 0.06, 0.84], CONCRETE, [0, 0.03, 0], { tex: 'concrete', repeat: [6, 3], rough: 0.94 })); // plinth
  g.add(box(t, [1.5, 0.3, 0.78], GLOSS, [0, 0.21, 0], { ...GLOSSY, repeat: [5, 2], bump: 0.02 })); // gloss body
  // a recessed panel band down the front so the face is not one black slab —
  // the PulseScenery speaker-stack lesson (a big `gloss` surface reads as a void)
  const panels: MergedBoxSpec[] = [];
  for (let i = 0; i < 5; i += 1) {
    panels.push({ dims: [0.26, 0.17, 0.02], pos: [-0.56 + i * 0.28, 0.2, 0.392], repeat: [2, 1] });
  }
  g.add(mergedBoxes(t, panels, DECK, { tex: 'plastic', rough: 0.3, repeat: [1, 1] }));
  g.add(box(t, [1.5, 0.03, 0.03], CHROME, [0, 0.075, 0.395], CHROMEY)); // kick rail
  [-1, 1].forEach((s) => g.add(box(t, [0.03, 0.03, 0.78], CHROME, [s * 0.75, 0.075, 0], CHROMEY)));
  // the TOP SLAB is `gloss`, not `deck`: a sun-facing 1.62 × 0.9 plane is the
  // brightest surface on the whole piece, and at `deck` it blew out to a big
  // pale-grey plate that read as a concrete counter and unbalanced the front
  g.add(box(t, [1.62, 0.06, 0.9], GLOSS, [0, TOP - 0.03, 0.02], { tex: 'plastic', repeat: [6, 3], rough: 0.3 })); // top slab
  // the chrome nosing is a thin FRAME round the slab, not a plate over it: as a
  // full 1.64 × 0.92 box it WAS the counter top, and a chrome plane that size
  // took the sun and read as a pale grey concrete slab covering the whole bar
  const nosing: MergedBoxSpec[] = [];
  [-1, 1].forEach((s) => nosing.push({ dims: [1.64, 0.022, 0.03], pos: [0, TOP + 0.006, 0.02 + s * 0.45] }));
  [-1, 1].forEach((s) => nosing.push({ dims: [0.03, 0.022, 0.9], pos: [s * 0.81, TOP + 0.006, 0.02] }));
  g.add(mergedBoxes(t, nosing, CHROME, CHROMEY));
  // the neon trim strip along the serving lip — the stall's signature at night
  const trimMat = lamp(MAGENTA, 0.2);
  const trim = new t.Mesh(new t.BoxGeometry(1.5, 0.03, 0.028), trimMat);
  trim.position.set(0, 0.335, 0.4);
  trim.castShadow = false;
  g.add(trim);
  // an under-counter wash strip aimed at the queue's feet
  const washMat = lamp(CYAN, 0.2);
  const washBar = new t.Mesh(new t.BoxGeometry(1.42, 0.022, 0.02), washMat);
  washBar.position.set(0, 0.105, 0.405);
  washBar.castShadow = false;
  g.add(washBar);

  // =========================================================================
  // 2. THE THREE SLUSH MACHINES — the piece's whole identity
  // =========================================================================
  // Each: a chrome drip tray, a gloss base housing with a flavour plate and a
  // chrome spigot + lever, a TRANSPARENT bowl, a glowing slush charge with a
  // mounded top, a turning AUGER on a chrome shaft, and a chrome lid + knob.
  interface Machine {
    auger: THREE.Group;
    slush: THREE.MeshStandardMaterial;
    bowl: THREE.MeshStandardMaterial;
    slot: number;
  }
  const machines: Machine[] = [];
  const trays: MergedBoxSpec[] = [];
  const housings: MergedBoxSpec[] = [];
  const spigots: PartSpec[] = [];
  const levers: PartSpec[] = [];
  const lids: PartSpec[] = [];
  const plates: [MergedBoxSpec[], MergedBoxSpec[], MergedBoxSpec[]] = [[], [], []];
  const BASE_Y = TOP + 0.015; // machines stand on the chrome nosing
  const BOWL_R = 0.105;
  const BOWL_H = 0.21;
  for (let i = 0; i < 3; i += 1) {
    const mx = -0.46 + i * 0.46;
    const flavour = FLAVOURS[i];
    trays.push({ dims: [0.3, 0.016, 0.22], pos: [mx, BASE_Y + 0.008, 0.02], repeat: [2, 1] });
    housings.push({ dims: [0.27, 0.15, 0.2], pos: [mx, BASE_Y + 0.09, 0.01], repeat: [2, 1] });
    plates[i].push({ dims: [0.19, 0.05, 0.02], pos: [mx, BASE_Y + 0.135, 0.115] }); // flavour plate
    // spigot: a chrome tap body out of the front face with a lever above it
    spigots.push({ geo: new t.CylinderGeometry(0.022, 0.026, 0.05, 10), matrix: mtx(t, [mx, BASE_Y + 0.06, 0.13], [Math.PI / 2, 0, 0]) });
    spigots.push({ geo: new t.BoxGeometry(0.07, 0.05, 0.035), matrix: mtx(t, [mx, BASE_Y + 0.085, 0.115]) });
    levers.push({ geo: new t.CylinderGeometry(0.008, 0.008, 0.07, 6), matrix: mtx(t, [mx, BASE_Y + 0.115, 0.125], [0.7, 0, 0]) });

    const bowlY = BASE_Y + 0.165 + BOWL_H / 2;
    // the BOWL — transparent polycarbonate, DoubleSide so the far wall shows
    const bowlMat = new t.MeshStandardMaterial({
      color: POLY,
      emissive: flavour,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.3,
      roughness: 0.08,
      side: t.DoubleSide,
    });
    lampMats.push(bowlMat);
    const bowl = new t.Mesh(new t.CylinderGeometry(BOWL_R, BOWL_R * 0.94, BOWL_H, 18, 1, true), bowlMat);
    bowl.position.set(mx, bowlY, 0.01);
    bowl.castShadow = false;
    g.add(bowl);
    // the glowing slush charge + its mounded top. SLIGHTLY TRANSLUCENT on
    // purpose: at opacity 1 the charge completely hid the auger inside it, which
    // threw away the one detail that says "slush machine" instead of "jar of jam".
    const slushMat = new t.MeshStandardMaterial({
      color: flavour,
      emissive: flavour,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      transparent: true,
      opacity: 0.84,
    });
    lampMats.push(slushMat);
    const charge = new t.Mesh(new t.CylinderGeometry(BOWL_R - 0.014, BOWL_R - 0.02, BOWL_H * 0.72, 16), slushMat);
    charge.position.set(mx, bowlY - BOWL_H * 0.12, 0.01);
    charge.castShadow = false;
    g.add(charge);
    const dome = new t.Mesh(new t.SphereGeometry(BOWL_R - 0.014, 14, 8), slushMat);
    dome.scale.set(1, 0.45, 1);
    dome.position.set(mx, bowlY + BOWL_H * 0.24, 0.01);
    dome.castShadow = false;
    g.add(dome);
    // the AUGER: a chrome shaft with a helical ribbon of blades, in its own
    // group so it TURNS. This is the one thing that says "slush machine" rather
    // than "jar of jam" — the blade is what churns the ice.
    const auger = new t.Group();
    auger.position.set(mx, bowlY, 0.01);
    g.add(auger);
    auger.add(cyl(t, 0.014, 0.014, BOWL_H * 0.96, CHROME, [0, 0, 0], { ...CHROMEY, seg: 8 }));
    const blades: PartSpec[] = [];
    const TURNS = 18;
    for (let k = 0; k < TURNS; k += 1) {
      const u = k / (TURNS - 1);
      const a = u * Math.PI * 3.4;
      const by = (u - 0.5) * BOWL_H * 0.82;
      // the blades sweep close to the BOWL WALL (radius 0.072 inside a 0.105
      // bowl) — that is where a real auger scrapes the ice off the glass, and it
      // is also the only radius at which they are visible through the charge
      blades.push({
        geo: new t.BoxGeometry(0.062, 0.02, 0.014),
        matrix: mtx(t, [Math.cos(a) * 0.072, by, Math.sin(a) * 0.072], [0, -a, 0.35]),
      });
    }
    const bladeMesh = mergedParts(t, blades, mat(t, CHROME, { tex: 'metal', metal: 0.32, rough: 0.34 }));
    bladeMesh.castShadow = false;
    bladeMesh.userData.lodDetail = true;
    auger.add(bladeMesh);
    // chrome lid + knob
    lids.push({ geo: new t.CylinderGeometry(BOWL_R * 0.82, BOWL_R + 0.006, 0.05, 18), matrix: mtx(t, [mx, bowlY + BOWL_H / 2 + 0.024, 0.01]) });
    lids.push({ geo: new t.CylinderGeometry(0.02, 0.024, 0.03, 10), matrix: mtx(t, [mx, bowlY + BOWL_H / 2 + 0.062, 0.01]) });
    machines.push({ auger, slush: slushMat, bowl: bowlMat, slot: i });
  }
  g.add(mergedBoxes(t, trays, CHROME, CHROMEY));
  g.add(mergedBoxes(t, housings, GLOSS, { ...GLOSSY, repeat: [1, 1] }));
  g.add(mergedParts(t, spigots, mat(t, CHROME, CHROMEY)));
  const leverMesh = mergedParts(t, levers, mat(t, GRAPHITE_D, { rough: 0.5 }));
  leverMesh.userData.lodDetail = true;
  g.add(leverMesh);
  g.add(mergedParts(t, lids, mat(t, CHROME, CHROMEY)));
  FLAVOURS.forEach((f, i) => {
    const m = mergedBoxes(t, plates[i], f, { rough: 0.45 });
    m.userData.lodDetail = true;
    g.add(m);
  });

  // =========================================================================
  // 3. THE FRONT GANTRY — posts, a neon fascia, and the SLUSH marquee
  // =========================================================================
  const POST_H = 1.12;
  const postBoxes: MergedBoxSpec[] = [];
  [-1, 1].forEach((s) => {
    postBoxes.push({ dims: [0.07, POST_H, 0.07], pos: [s * 0.78, POST_H / 2, 0.36], repeat: [1, 6] });
  });
  postBoxes.push({ dims: [1.72, 0.07, 0.1], pos: [0, POST_H, 0.36], repeat: [6, 1] }); // lintel
  g.add(mergedBoxes(t, postBoxes, GRAPHITE, { ...METAL, repeat: [1, 1] }));
  const collars: PartSpec[] = [];
  [-1, 1].forEach((s) =>
    [0.4, 0.8].forEach((cy) =>
      collars.push({ geo: new t.CylinderGeometry(0.05, 0.05, 0.04, 10), matrix: mtx(t, [s * 0.78, cy, 0.36]) }),
    ),
  );
  const collarMesh = mergedParts(t, collars, mat(t, CHROME, CHROMEY));
  collarMesh.userData.lodDetail = true;
  g.add(collarMesh);
  // the FASCIA: a gloss valance between the posts with an LED bar under it.
  // A club front is a lit band over a dark counter, so this is what turns the
  // stall from "a kiosk" into "a bar" at fifty metres.
  g.add(box(t, [1.62, 0.17, 0.035], GLOSS, [0, POST_H - 0.115, 0.375], { ...GLOSSY, repeat: [5, 1] }));
  g.add(box(t, [1.64, 0.02, 0.045], CHROME, [0, POST_H - 0.028, 0.375], CHROMEY));
  const fasciaMats: THREE.MeshStandardMaterial[] = [];
  for (let grp = 0; grp < 3; grp += 1) {
    const parts: PartSpec[] = [];
    for (let k = grp; k < 12; k += 3) {
      parts.push({ geo: new t.BoxGeometry(0.09, 0.035, 0.02), matrix: mtx(t, [-0.66 + k * 0.12, POST_H - 0.205, 0.383]) });
    }
    const m = lamp(paletteAt(grp), 0.2);
    const mesh = mergedParts(t, parts, m);
    mesh.castShadow = false;
    mesh.userData.lodDetail = true;
    g.add(mesh);
    fasciaMats.push(m);
  }
  // ---- the marquee: a real buildNeonSign standing on the lintel -----------
  const SIGN_Y = POST_H + 0.06;
  const sign = buildNeonSign(t, {
    text: opts.text ?? 'SLUSH',
    color: CYAN,
    secondary: MAGENTA,
    scale: 0.18,
    backboard: true,
  });
  sign.group.position.set(0, SIGN_Y, 0.36);
  g.add(sign.group);
  // ...framed in chrome, exactly as <NeonArch> frames its own. NeonSign's board
  // is 0x1d1e22 and the tubes only glow at ~12 % by day, so an unframed marquee
  // reads as a black rectangle at noon.
  {
    const pad = 0.15 * 1.5 * 0.18;
    const bw = sign.width + 2 * pad;
    const bh = 1.5 * 0.18 + 2 * pad;
    const midY = SIGN_Y + 0.75 * 0.18;
    const frame: MergedBoxSpec[] = [];
    [-1, 1].forEach((s) => frame.push({ dims: [bw + 0.05, 0.026, 0.05], pos: [0, midY + s * (bh / 2 + 0.013), 0.358] }));
    [-1, 1].forEach((s) => frame.push({ dims: [0.026, bh + 0.052, 0.05], pos: [s * (bw / 2 + 0.013), midY, 0.358] }));
    g.add(mergedBoxes(t, frame, CHROME, CHROMEY));
  }
  // stand-off feet from the lintel into the board
  const feetParts: PartSpec[] = [];
  [-1, 1].forEach((s) =>
    feetParts.push({ geo: new t.CylinderGeometry(0.013, 0.013, 0.07, 6), matrix: mtx(t, [s * Math.min(0.36, sign.width / 2), POST_H + 0.05, 0.35]) }),
  );
  const feetMesh = mergedParts(t, feetParts, mat(t, CHROME, CHROMEY));
  feetMesh.userData.lodDetail = true;
  g.add(feetMesh);

  // =========================================================================
  // 4. COUNTER DRESSING — cup-stack tower, straw caddy, syrup rack
  // =========================================================================
  // a tower of nested empty cups at the left end (what you buy is right there)
  const cupParts: PartSpec[] = [];
  for (let i = 0; i < 7; i += 1) {
    cupParts.push({
      geo: new t.CylinderGeometry(0.036, 0.028, 0.04, 12, 1, true),
      matrix: mtx(t, [-0.68, TOP + 0.045 + i * 0.028, 0.19]),
    });
  }
  const cupMesh = mergedParts(t, cupParts, mat(t, WHITE_P, { rough: 0.4 }));
  cupMesh.castShadow = false;
  cupMesh.userData.lodDetail = true;
  g.add(cupMesh);
  g.add(cyl(t, 0.042, 0.046, 0.02, CHROME, [-0.68, TOP + 0.03, 0.19], { ...CHROMEY, seg: 12 })); // cup-tower base ring
  // the straw caddy: a chrome tube with straws poking out at hashed angles
  g.add(cyl(t, 0.032, 0.036, 0.09, CHROME, [0.68, TOP + 0.065, 0.19], { ...CHROMEY, seg: 12 }));
  const strawParts: PartSpec[] = [];
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    strawParts.push({
      geo: new t.CylinderGeometry(0.005, 0.005, 0.12, 5),
      matrix: mtx(t, [0.68 + Math.cos(a) * 0.014, TOP + 0.14, 0.19 + Math.sin(a) * 0.014], [
        (hash01(i * 3.1) - 0.5) * 0.34,
        0,
        (hash01(i * 5.7) - 0.5) * 0.34,
      ]),
    });
  }
  const strawMesh = mergedParts(t, strawParts, mat(t, WHITE_P, { rough: 0.5 }));
  strawMesh.castShadow = false;
  strawMesh.userData.lodDetail = true;
  g.add(strawMesh);
  // syrup rack behind the machines: three bottles in a chrome cradle
  g.add(box(t, [0.5, 0.02, 0.09], CHROME, [0, TOP + 0.025, -0.3], CHROMEY));
  const syrupMats: THREE.MeshStandardMaterial[] = [];
  FLAVOURS.forEach((f, i) => {
    const bx = -0.17 + i * 0.17;
    const m = new t.MeshStandardMaterial({ color: f, emissive: f, emissiveIntensity: 0.25, roughness: 0.3, transparent: true, opacity: 0.85 });
    lampMats.push(m);
    syrupMats.push(m);
    const bottle = new t.Mesh(new t.CylinderGeometry(0.032, 0.034, 0.13, 12), m);
    bottle.position.set(bx, TOP + 0.1, -0.3);
    bottle.castShadow = false;
    bottle.userData.lodDetail = true;
    g.add(bottle);
    g.add(cyl(t, 0.014, 0.02, 0.03, GRAPHITE_D, [bx, TOP + 0.18, -0.3], { rough: 0.5, seg: 8 })); // pump neck
  });
  // a chalk-free PRICE PANEL on the left post: a gloss board with LED bars
  const priceMat = lamp(MAGENTA, 0.18);
  const panel = new t.Group();
  panel.position.set(-0.94, 0, 0.5);
  panel.rotation.y = 0.7;
  g.add(panel);
  panel.add(cyl(t, 0.03, 0.04, 0.66, GRAPHITE, [0, 0.33, 0], { ...METAL, repeat: [1, 4], seg: 10 }));
  panel.add(box(t, [0.36, 0.28, 0.04], GLOSS, [0, 0.78, 0], { ...GLOSSY, repeat: [2, 2] }));
  panel.add(box(t, [0.39, 0.02, 0.05], CHROME, [0, 0.925, 0], CHROMEY));
  const priceParts: PartSpec[] = [];
  [0.86, 0.81, 0.76, 0.71].forEach((py, i) => {
    priceParts.push({ geo: new t.BoxGeometry(0.24 - i * 0.03, 0.022, 0.012), matrix: mtx(t, [-0.02 + i * 0.01, py, 0.026]) });
  });
  const priceMesh = mergedParts(t, priceParts, priceMat);
  priceMesh.castShadow = false;
  priceMesh.userData.lodDetail = true;
  panel.add(priceMesh);
  // a rubber mat in front of the counter (the wet zone of any drinks stall)
  g.add(box(t, [1.3, 0.012, 0.34], RUBBER, [0, 0.006, 0.62], { tex: 'plastic', repeat: [5, 2], rough: 0.9 }));

  // =========================================================================
  // 5. TWO REAL LIGHTS — the marquee's own (inside buildNeonSign) + one wash
  // =========================================================================
  const wash = new t.PointLight(CYAN, 0, 2.4, 2);
  wash.position.set(0, 0.2, 0.62);
  g.add(wash);

  // ---- optional decorative queueing guest --------------------------------
  let peep: ReturnType<typeof buildPeep> | null = null;
  if (opts.withGuest) {
    peep = buildPeep(t, { shirt: 0x2b2f5c, expression: 'happy' });
    peep.group.scale.setScalar(0.5);
    peep.group.position.set(0.3, 0, 0.88);
    peep.group.rotation.y = Math.PI;
    g.add(peep.group);
  }

  const update = (time: number) => {
    const nk = smooth(nightKOf(g));
    const gain = 0.35 + 1.25 * nk;
    const step = beatStep(time);
    const dom = paletteAt(step);

    // the augers turn — absolute clock, each at its own rate, and one runs the
    // other way because nobody plumbs three machines the same
    machines.forEach((m, i) => {
      m.auger.rotation.y = time * (0.9 + i * 0.22) * (i === 1 ? -1 : 1);
      // the slush keeps ITS OWN flavour colour (a magenta machine does not turn
      // cyan on the beat — that would read as a bug, not a light show); what
      // beats is its BRIGHTNESS, so the three bowls throb together
      const pulse = beatPulse(time, i * 0.14);
      m.slush.emissiveIntensity = 0.45 + (0.35 + 1.15 * nk) * pulse;
      m.bowl.emissiveIntensity = 0.16 + (0.2 + 0.7 * nk) * pulse;
    });
    // the fascia LED bars chase in three steps, one per beat
    fasciaMats.forEach((m, i) => {
      const on = ((step % 3) + 3) % 3 === i;
      const col = paletteAt(step + i);
      m.color.setHex(col);
      m.emissive.setHex(col);
      m.emissiveIntensity = (on ? 0.32 + 1.7 * gain : 0.12 + 0.24 * gain) * beatPulse(time, i * 0.08);
    });
    // the counter trim and the under-counter wash breathe on the beat
    trimMat.color.setHex(dom);
    trimMat.emissive.setHex(dom);
    trimMat.emissiveIntensity = 0.18 + gain * 1.1 * beatPulse(time, 0.25);
    washMat.emissive.setHex(paletteAt(step + 1));
    washMat.emissiveIntensity = 0.18 + gain * 0.9 * beatPulse(time, 0.5);
    priceMat.emissiveIntensity = 0.16 + gain * 0.7 * beatKick(time, 0.5);
    syrupMats.forEach((m, i) => (m.emissiveIntensity = 0.2 + gain * 0.4 * beatPulse(time, i * 0.2)));

    // EVERY HELD CUP IN THE PARK, in one write per material: the manager clones
    // one prototype per stall and clones share materials, so the slushies the
    // guests are carrying pulse on the same beat as the machines they came out
    // of — and not one of them costs a PointLight.
    const heldGlow = 1.05 + 0.55 * beatPulse(time, 0.3);
    HELD_GLOW.forEach((m) => {
      m.emissiveIntensity = m.transparent ? heldGlow * 0.26 : heldGlow;
    });

    wash.color.setHex(dom);
    wash.intensity = nk * (0.5 + 0.35 * beatPulse(time, 0.25));
    sign.update(time);
    if (peep) peep.group.position.y = Math.abs(Math.sin(time * BEAT_HZ * Math.PI)) * 0.008; // a queueing guest bobs to the beat
  };

  return {
    group: g,
    update,
    dispose() {
      wash.dispose();
      lampMats.forEach((m) => m.dispose());
    },
  };
}

export interface NeonSlushProps {
  /** decorative queueing guest (preview flavour) */
  withGuest?: boolean;
  /** marquee text (default 'SLUSH') */
  text?: string;
}

/** <NeonSlush> — the Pulse District's glowing slushie bar, a composable stall
 *  (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` (+ optional `name`/`price`/`value`) registers a selling
 *  DRINK stall with the GameManager — the serving front faces local +z, with the
 *  attach point 0.72 u out that way, so aim `rotation` at the customers' path.
 *  Buyers walk away carrying a real TALL LIDDED CUP OF GLOWING SLUSH with a
 *  straw (`heldItem`: buildHeldSlush), not the manager's generic red cup, and the
 *  cup pulses on the district's shared 2.2 Hz beat along with the machines. */
export const NeonSlush = composableStall<NeonSlushProps>(
  'NeonSlush',
  (t, { withGuest = false, text }) => buildNeonSlush(t, { withGuest, text }),
  { name: 'Neon Slush', item: 'drink', price: 3, value: 5, heldItem: buildHeldSlush },
);
