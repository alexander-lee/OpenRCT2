#!/usr/bin/env python3
"""Extract animated, diverse peep/guest sprites from g1.dat.

Layout (verified vs src/openrct2/paint/entity/Paint.Peep.cpp:
  imageId = baseImage + direction + frame*4)  -> 4 directions inner, frame stride 4.

Diversity via authentic RCT2 palette remap:
  shirt  = primary remap, source palette indices 243..254 -> a 12-shade colour ramp
  trousers = secondary remap, source indices 202..213 -> a 12-shade colour ramp
Ramps are sampled from the real StandardPalette (each game colour = 12 contiguous shades).
"""
import os, struct, json
from g1extract import PALETTE, F_PALETTE, F_RLE, png_rgba, open_g1

ROOT = os.path.abspath(os.path.dirname(__file__) + "/..")
DEPOT = "/Users/alexanderlee/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamapps/content/app_285330/depot_285331"
G1 = f"{DEPOT}/Data/g1.dat"
OUT = f"{ROOT}/assets/peeps"

# --- 12-shade colour ramp starts in the StandardPalette ---
RAMP = dict(red=166, blue=130, green=94, yellow=46, purple=154, orange=178,
            teal=190, pink=202, grass=70, grey=10, brown=34, satbrown=106,
            darkblue=118, darkgreen=142, darkbrown=214, olive=82, bordeaux=58,
            magenta=202, satred=166, lightblue=130)
PRIMARY0, SECONDARY0, RAMPLEN = 243, 202, 12

def make_palette(shirt, trousers):
    pal = list(PALETTE)
    s = RAMP[shirt]; t = RAMP[trousers]
    for k in range(RAMPLEN):
        pal[PRIMARY0 + k] = PALETTE[s + k]
        pal[SECONDARY0 + k] = PALETTE[t + k]
    return pal

def decode_pal(data, off, w, h, flags, pal):
    """RGBA decode with a custom 256-colour palette."""
    if w <= 0 or h <= 0 or w > 2000 or h > 2000:
        return None
    out = bytearray(w*h*4)
    if flags & F_RLE:
        for y in range(h):
            lo = data[off+y*2] | (data[off+y*2+1] << 8)
            p = off+lo; end = False
            while not end:
                dsize = data[p]; startx = data[p+1]; p += 2
                end = (dsize & 0x80) != 0; dsize &= 0x7F
                for i in range(dsize):
                    x = startx+i
                    if 0 <= x < w:
                        r, g, b = pal[data[p+i]]
                        o = (y*w+x)*4
                        out[o], out[o+1], out[o+2], out[o+3] = r, g, b, 255
                p += dsize
    else:
        n = w*h; seg = data[off:off+n]
        if len(seg) < n: return None
        for i in range(n):
            idx = seg[i]
            if idx == 0: continue
            r, g, b = pal[idx]
            o = i*4
            out[o], out[o+1], out[o+2], out[o+3] = r, g, b, 255
    return bytes(out)

_G1 = None
def g1():
    global _G1
    if _G1 is None:
        _G1 = open_g1(G1)
    return _G1

def extract_walk(base, frames, dirs, pal, prefix):
    """base+dir+frame*4 -> PNGs. Returns list of {dir, frame, file, w, h, x, y}."""
    data, dblob, elems, num, total = g1()
    os.makedirs(OUT, exist_ok=True)
    out = []
    for d in dirs:
        for fi, fr in enumerate(frames):
            idx = base + d + fr*4
            if idx < 0 or idx >= num: continue
            e = elems[idx]
            if e['flags'] & F_PALETTE or e['w'] <= 0: continue
            rgba = decode_pal(data, dblob+e['offset'], e['w'], e['h'], e['flags'], pal)
            if rgba is None: continue
            fn = f"{prefix}_d{d}_f{fi}.png"
            open(f"{OUT}/{fn}", 'wb').write(png_rgba(e['w'], e['h'], rgba))
            out.append(dict(dir=d, frame=fi, file=f"assets/peeps/{fn}",
                            w=e['w'], h=e['h'], x=e['xo'], y=e['yo']))
    return out

def extract_faces(base, count, prefix):
    data, dblob, elems, num, total = g1()
    os.makedirs(OUT, exist_ok=True)
    out = []
    for i in range(count):
        idx = base+i
        if idx >= num: break
        e = elems[idx]
        if e['flags'] & F_PALETTE or e['w'] <= 0: continue
        rgba = decode_pal(data, dblob+e['offset'], e['w'], e['h'], e['flags'], list(PALETTE))
        if rgba is None: continue
        fn = f"{prefix}_{i}.png"
        open(f"{OUT}/{fn}", 'wb').write(png_rgba(e['w'], e['h'], rgba))
        out.append(dict(i=i, file=f"assets/peeps/{fn}", w=e['w'], h=e['h'], x=e['xo'], y=e['yo']))
    return out

GUEST_BASE = 6409          # vanilla "normal walking" guest, 6-frame cycle
WALK_FRAMES = 6
DIRS = [0, 1, 2, 3]

# (name, shirtRamp, trouserRamp)
GUEST_COLOURS = [
    ("Red",    "red",    "darkblue"),
    ("Blue",   "blue",   "grey"),
    ("Green",  "green",  "darkbrown"),
    ("Yellow", "yellow", "purple"),
    ("Purple", "purple", "darkgreen"),
    ("Orange", "orange", "darkblue"),
    ("Teal",   "teal",   "grey"),
    ("Pink",   "pink",   "darkbrown"),
]

# (name, base, uniformColour)  staff uniforms also use the primary-remap range
STAFF = [
    ("Handyman", 11821, "teal"),
    ("Mechanic", 11413, "blue"),
]

def _decode_elem(idx, pal):
    data, dblob, elems, num, total = g1()
    if idx < 0 or idx >= num: return None
    e = elems[idx]
    if e['flags'] & F_PALETTE or e['w'] <= 0 or e['h'] <= 0: return None
    rgba = decode_pal(data, dblob+e['offset'], e['w'], e['h'], e['flags'], pal)
    if rgba is None: return None
    return dict(w=e['w'], h=e['h'], x=e['xo'], y=e['yo'], rgba=rgba)

def _aligned_walk(base, pal, prefix):
    """Decode 4 dirs x WALK_FRAMES, align to a shared canvas, save PNGs."""
    from PIL import Image
    cells = {}   # (d,f) -> elem dict
    for d in DIRS:
        for f in range(WALK_FRAMES):
            el = _decode_elem(base + d + f*4, pal)
            if el: cells[(d, f)] = el
    if not cells: return None
    minL = min(el['x'] for el in cells.values())
    minT = min(el['y'] for el in cells.values())
    maxR = max(el['x']+el['w'] for el in cells.values())
    maxB = max(el['y']+el['h'] for el in cells.values())
    cw, ch = maxR-minL, maxB-minT
    os.makedirs(OUT, exist_ok=True)
    frames = {}
    for (d, f), el in cells.items():
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        im = Image.frombytes('RGBA', (el['w'], el['h']), el['rgba'])
        canvas.alpha_composite(im, (el['x']-minL, el['y']-minT))
        fn = f"{prefix}_d{d}_f{f}.png"
        canvas.save(f"{OUT}/{fn}")
        frames.setdefault(str(d), []).append(f"assets/peeps/{fn}")
    return dict(w=cw, h=ch, frames=frames, dirs=len(frames), frameCount=WALK_FRAMES)

# mood faces: 7 happiness levels + tired/sick, from SPR_PEEP_LARGE_FACE (5284)
FACE_BASE = 5284
FACES = [
    ("Very very unhappy", 0), ("Very unhappy", 1), ("Unhappy", 2), ("Neutral", 3),
    ("Happy", 4), ("Very happy", 5), ("Very very happy", 6),
    ("Tired", 7), ("Very tired", 8), ("Sick", 9),
]

def generate():
    manifest = {"guests": [], "staff": [], "faces": []}
    # guests
    for label, shirt, trousers in GUEST_COLOURS:
        pal = make_palette(shirt, trousers)
        w = _aligned_walk(GUEST_BASE, pal, f"guest_{shirt}")
        if w:
            w.update(name=f"{label} Guest", shirt=shirt, trousers=trousers)
            manifest["guests"].append(w)
    # staff (recolour uniform via primary remap)
    for label, base, colour in STAFF:
        pal = make_palette(colour, "grey")
        w = _aligned_walk(base, pal, f"staff_{label.lower()}")
        if w:
            w.update(name=label, base=base, colour=colour)
            manifest["staff"].append(w)
    # faces (standard palette)
    std_faces = extract_faces(FACE_BASE, 10, "face")
    for (label, i), fe in zip(FACES, std_faces):
        manifest["faces"].append(dict(name=label, file=fe['file'], w=fe['w'], h=fe['h']))
    with open(f"{OUT}/manifest.json", "w") as fp:
        json.dump(manifest, fp)
    print(f"guests: {len(manifest['guests'])}, staff: {len(manifest['staff'])}, "
          f"faces: {len(manifest['faces'])}")
    return manifest

if __name__ == "__main__":
    generate()
