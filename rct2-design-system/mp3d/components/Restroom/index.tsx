import React from 'react';
import * as THREE from 'three';
import { box, cyl, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// Restroom — the RCT2 toilets facility: a squat 1-tile utilitarian park hut.
// Brick walls with dark timber corner posts and top plate, pitched shingle
// roof with stepped gable fillers, a real door OPENING in the front wall
// (+z) with a dark recessed interior behind it, a framed blue enamel PLAQUE
// over the door whose male/female pictograms are PAINTED into a procedural
// CanvasTexture (signTexture below — the Stage drawTexture pattern: drawn
// deterministically at build time, no primitives poking off the face and no
// external assets) and a red occupied-light RECESSED into the brick beside
// the door (bezel ring buried in the wall, lens flush with the wall face)
// whose emissive is gated by nightKOf via onBeforeRender (the { group,
// doorway } contract carries no per-frame update). Realistic palette.
// ---------------------------------------------------------------------------

const BRICK = 0x8a5040;
const POST = 0x4a3826;
const ROOF = 0x4a4640;
const SIGN = 0x2f5fb0;
const APRON = 0x9a978e;

// ---------------------------------------------------------------------------
// signTexture — the plaque artwork, drawn ONCE into a 2D canvas and cached
// (same shape as Stage's drawTexture / Guest's faceTexture): blue enamel with
// a vertical sheen gradient, a white keyline border, a male and a female
// pictogram either side of a divider bar. Fully deterministic — the enamel
// speckle comes from a hashed sine, never Math.random.
// ---------------------------------------------------------------------------
let _signTex: THREE.CanvasTexture | null = null;
function signTexture(t: typeof THREE): THREE.CanvasTexture {
  if (_signTex) return _signTex;
  const W = 512;
  const H = 236; // 2.17:1 — matches the 0.52 x 0.24 sign plane
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  const hash = (n: number) => {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

  // enamel base: sheen gradient through the SIGN blue
  const grad = x.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#4278cc');
  grad.addColorStop(0.55, hex(SIGN));
  grad.addColorStop(1, '#1f4179');
  x.fillStyle = grad;
  x.fillRect(0, 0, W, H);
  // baked-enamel speckle + a few chips (deterministic hashed sine)
  for (let i = 0; i < 1100; i++) {
    x.fillStyle = hash(i + 1) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    x.fillRect(hash(i * 3 + 7) * W, hash(i * 5 + 11) * H, 2, 2);
  }
  // white keyline border
  x.strokeStyle = '#eef0ea';
  x.lineWidth = 7;
  x.strokeRect(11, 11, W - 22, H - 22);

  // ---- pictograms (paths only — no fillText, so no font dependency) ----
  x.fillStyle = '#f4f5f0';
  const head = (cx: number) => {
    x.beginPath();
    x.arc(cx, 62, 21, 0, Math.PI * 2);
    x.fill();
  };
  const poly = (pts: [number, number][]) => {
    x.beginPath();
    x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
    x.closePath();
    x.fill();
  };
  // male: head, sloped-shoulder torso, arms, two legs
  const m = 136;
  head(m);
  poly([[m - 23, 96], [m + 23, 96], [m + 31, 152], [m - 31, 152]]);
  poly([[m - 23, 98], [m - 34, 100], [m - 40, 150], [m - 30, 150]]);
  poly([[m + 23, 98], [m + 34, 100], [m + 40, 150], [m + 30, 150]]);
  poly([[m - 27, 152], [m - 6, 152], [m - 6, 212], [m - 24, 212]]);
  poly([[m + 27, 152], [m + 6, 152], [m + 6, 212], [m + 24, 212]]);
  // female: head, flared dress, arms, two legs
  const f = 376;
  head(f);
  poly([[f - 20, 96], [f + 20, 96], [f + 40, 176], [f - 40, 176]]);
  poly([[f - 20, 98], [f - 32, 100], [f - 40, 150], [f - 30, 152]]);
  poly([[f + 20, 98], [f + 32, 100], [f + 40, 150], [f + 30, 152]]);
  poly([[f - 19, 176], [f - 5, 176], [f - 5, 212], [f - 18, 212]]);
  poly([[f + 19, 176], [f + 5, 176], [f + 5, 212], [f + 18, 212]]);
  // divider bar between the two halves
  x.fillRect(W / 2 - 3, 40, 6, H - 80);

  const tex = new t.CanvasTexture(c);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _signTex = tex;
  return tex;
}

/**
 * Contract (GameManager agents code against this): `doorway` is the walk-in
 * point at the FRONT of the hut (+z), at ground level, in the group's local
 * space — [0, 0, 0.72].
 */
export function buildRestroom(t: typeof THREE): { group: THREE.Group; doorway: [number, number, number] } {
  const g = new t.Group();
  const W = 1.3; // width (x)
  const D = 1.1; // depth (z)
  const wallH = 0.85; // squat, utilitarian
  const doorW = 0.46;
  const doorH = 0.62;

  // concrete base slab (top y 0.08) + apron bridging base to the doorway
  // point (apron spans z 0.55..0.89 so it covers doorway z 0.72)
  g.add(box(t, [W + 0.14, 0.08, D + 0.14], APRON, [0, 0.04, 0], { tex: 'concrete', repeat: [4, 3], rough: 0.95 }));
  g.add(box(t, [0.7, 0.08, 0.34], APRON, [0, 0.04, 0.72], { tex: 'concrete', repeat: [2, 1], rough: 0.95 }));

  // brick walls on the slab (0.08..0.93): back, sides, and a split front wall
  // leaving a doorW × doorH opening in the middle
  const brick = { tex: 'concrete' as const, repeat: [5, 3] as [number, number], rough: 0.95, bump: 0.045 };
  g.add(box(t, [W, wallH, 0.08], BRICK, [0, 0.08 + wallH / 2, -(D / 2 - 0.04)], brick)); // back
  [-1, 1].forEach((s) => g.add(box(t, [0.08, wallH, D], BRICK, [s * (W / 2 - 0.04), 0.08 + wallH / 2, 0], brick))); // sides
  const flankW = (W - doorW) / 2; // 0.42
  [-1, 1].forEach((s) => g.add(box(t, [flankW, wallH, 0.08], BRICK, [s * (doorW / 2 + flankW / 2), 0.08 + wallH / 2, D / 2 - 0.04], brick)));
  // lintel over the opening: 0.08+doorH (0.70) .. wall top (0.93)
  g.add(box(t, [doorW, wallH - doorH, 0.08], BRICK, [0, 0.08 + doorH + (wallH - doorH) / 2, D / 2 - 0.04], brick));

  // dark interior panel just behind the opening plane so the doorway reads
  // as real depth (z 0.44, behind the wall inner face at 0.47)
  g.add(box(t, [0.54, 0.66, 0.06], 0x17110c, [0, 0.41, 0.44], { rough: 1 }));

  // timber door frame: posts flanking the opening, z 0.46..0.55 — FLUSH with
  // the wall face (0.55) so nothing crosses into the plaque's z range below,
  // and topping out at the opening head (0.08..0.70). The plaque frame above
  // doubles as the door header trim.
  [-1, 1].forEach((s) => g.add(box(t, [0.05, 0.62, 0.09], POST, [s * (doorW / 2 + 0.025), 0.39, D / 2 - 0.045], { tex: 'wood', repeat: [1, 3], rough: 0.9 })));

  // timber corner posts (0.08..0.98) + top plate ring capping the wall tops
  // (0.93..0.99) — the roof eaves clear the plate (see below)
  [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ].forEach(([sx, sz]) => g.add(box(t, [0.1, 0.9, 0.1], POST, [sx * (W / 2 - 0.05), 0.53, sz * (D / 2 - 0.05)], { tex: 'wood', repeat: [1, 3], rough: 0.9 })));
  g.add(box(t, [W + 0.04, 0.06, D + 0.04], POST, [0, 0.96, 0], { tex: 'wood', repeat: [4, 1], rough: 0.9 }));

  // pitched shingle roof, ridge along x, slopes facing ±z. Slabs (rotX 0.55,
  // half-span 0.39): outer eave edge y 1.006 (clears the plate top 0.99),
  // inner ridge edge y 1.414 under the ridge cap.
  [-1, 1].forEach((s) =>
    g.add(box(t, [1.5, 0.06, 0.78], ROOF, [0, 1.21, s * 0.31], { tex: 'asphalt', repeat: [6, 3], rough: 0.95, bump: 0.03, rotX: s * 0.55 })),
  );
  g.add(box(t, [1.56, 0.07, 0.14], 0x38342e, [0, 1.42, 0], { rough: 0.9 })); // ridge cap
  // stepped brick gable fillers — tops verified against the roof underside
  // y_u(z) = 1.175 + (0.31 − |z|)·tan(0.55): 1.11 < 1.12 @|z|=0.4,
  // 1.22 < 1.24 @0.2, 1.31 < 1.316 @0.08 — nothing clips the slabs
  g.add(box(t, [1.26, 0.12, 0.8], BRICK, [0, 1.05, 0], { tex: 'concrete', repeat: [5, 1], rough: 0.95, bump: 0.045 }));
  g.add(box(t, [1.26, 0.11, 0.4], BRICK, [0, 1.165, 0], { tex: 'concrete', repeat: [5, 1], rough: 0.95, bump: 0.045 }));
  g.add(box(t, [1.26, 0.09, 0.16], BRICK, [0, 1.265, 0], { tex: 'concrete', repeat: [5, 1], rough: 0.95, bump: 0.045 }));

  // ---- signage plaque over the door -------------------------------------
  // timber frame (also the door header trim) z 0.55..0.60, y 0.63..0.93 — its
  // top lands exactly on the wall top, under the plate; and a THIN PLANE
  // carrying the procedural enamel texture (signTexture) 0.0015 proud of the
  // frame face, so the pictograms are PAINTED instead of built from glyph
  // primitives standing off the panel.
  g.add(box(t, [0.6, 0.3, 0.05], POST, [0, 0.78, 0.575], { tex: 'wood', repeat: [4, 2], rough: 0.9 }));
  const signPlane = new t.Mesh(
    new t.PlaneGeometry(0.52, 0.24),
    new t.MeshStandardMaterial({ map: signTexture(t), roughness: 0.5, metalness: 0.05 }),
  );
  signPlane.position.set(0, 0.78, 0.6015);
  signPlane.receiveShadow = true;
  g.add(signPlane);

  // ---- RECESSED occupied-light -------------------------------------------
  // Flush wall fixture in the brick flank right of the door (brick spans x
  // 0.23..0.55): a bezel RING whose tube (major 0.04, tube 0.012) is half
  // BURIED in the wall — centre z 0.5535, so it reaches only 0.0145 past the
  // wall face 0.55 — with the red lens disc set back INSIDE it (front face
  // 0.5545, i.e. 0.0045 proud, and r 0.026 < the ring's 0.028 inner radius).
  // Nothing pokes off the facade the way the old 0.05-radius ball did.
  const bezel = new t.Mesh(
    new t.TorusGeometry(0.04, 0.012, 8, 20),
    new t.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.55, metalness: 0.35 }),
  );
  bezel.position.set(0.39, 0.56, 0.5535);
  bezel.castShadow = true;
  g.add(bezel);
  const lamp = cyl(t, 0.026, 0.026, 0.01, 0xd03030, [0.39, 0.56, 0.5495], { rotX: Math.PI / 2, rough: 0.4, emissive: 0xff4030, seg: 16 });
  const lampMat = lamp.material as THREE.MeshStandardMaterial;
  lampMat.emissiveIntensity = 0;
  g.add(lamp);
  const lampGlow = new t.PointLight(0xff5040, 0, 1.1, 2); // small red bloom on the wall
  lampGlow.position.set(0.39, 0.56, 0.66);
  g.add(lampGlow);

  // warm bracket lanterns flanking the sign (bracket backs at z 0.53 embed in
  // the wall face 0.55; bulbs proud of the bracket) + ONE warm door light so
  // the facade reads at night — all gated by the same onBeforeRender
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffc76a, emissiveIntensity: 0.15, roughness: 0.35 });
  [-1, 1].forEach((s) => {
    g.add(box(t, [0.05, 0.05, 0.08], POST, [s * 0.38, 0.82, 0.57], { tex: 'wood', rough: 0.9 }));
    const bulb = new t.Mesh(new t.SphereGeometry(0.035, 10, 8), bulbMat);
    bulb.position.set(s * 0.38, 0.82, 0.625);
    g.add(bulb);
  });
  const doorLight = new t.PointLight(0xffc97a, 0, 2.6, 2);
  doorLight.position.set(0, 0.95, 0.9);
  g.add(doorLight);
  lamp.onBeforeRender = () => {
    const k = nightKOf(lamp);
    const ease = k * k * (3 - 2 * k); // smoothstep
    lampMat.emissiveIntensity = 3.2 * ease;
    lampGlow.intensity = ease * 0.35;
    bulbMat.emissiveIntensity = 0.15 + 1.35 * ease;
    doorLight.intensity = ease * 0.95;
  };

  return { group: g, doorway: [0, 0, 0.72] };
}

// Preview: the hut plus one guest walking in on a loop — she walks up the
// apron to the doorway, disappears "inside", then reappears at the start.
export function buildRestroomScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const r = buildRestroom(t);
        g.add(r.group);
        const p = buildPeep(t, { shirt: 0x2e9e54, expression: 'neutral', female: true });
        p.group.scale.setScalar(0.5); // scaled peep width 0.24 < opening 0.46; height 0.56 < opening 0.62
        p.group.rotation.y = Math.PI; // walking toward −z (into the door)
        g.add(p.group);
        const T = 6; // loop: 4.2s walking in, 1.8s "inside"
        return (time) => {
          const k = time % T;
          if (k < 4.2) {
            p.group.visible = true;
            const z = 1.8 - (1.8 - 0.3) * (k / 4.2); // start z 1.8 → z 0.3 inside the opening
            p.walk(time); // sets limb swing + bob (bob writes position.y)
            const step = z < 1.05 ? 0.08 * Math.min(1, (1.05 - z) / 0.15) : 0; // ramp up onto the apron (top y 0.08, front edge z 0.89)
            p.group.position.set(0, p.group.position.y + step, z);
          } else {
            p.group.visible = false;
          }
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <Restroom> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const Restroom = composable('Restroom', (t) => buildRestroomScene(t));
