#!/usr/bin/env python3
"""Build a SECOND atlas of paths + terrain + extra trees (leaves atlas-v1 intact).

Outputs assets/paths_atlas.png + app/cdn_manifest2.json.
Terrain/path tiles are single-cell (rotation-invariant surfaces); trees get 4 rotations.
"""
import os, json, struct
from PIL import Image
from g1extract import open_g1, decode_sprite, F_PALETTE, PALETTE
import objextract as ox

ROOT = os.path.abspath(os.path.dirname(__file__) + "/..")
DEPOT = "/Users/alexanderlee/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamapps/content/app_285330/depot_285331"
OBJ = f"{DEPOT}/ObjData"
G1 = f"{DEPOT}/Data/g1.dat"
ATLAS_W = 900

_g1 = open_g1(G1)

def g1_tile(idx):
    data, dblob, elems, num, total = _g1
    e = elems[idx]
    r = decode_sprite(data, dblob+e['offset'], e['w'], e['h'], e['flags'])
    return Image.frombytes('RGBA', (e['w'], e['h']), r)

def obj_img(dat, i):
    otype, name, obj = ox.read_object(f"{OBJ}/{dat}.DAT")
    it = ox.find_image_table(obj); p, num, ds = it
    tbl = p+8; data_off = tbl + num*16; imgdata = obj[data_off:data_off+ds]
    o = tbl + i*16
    offset, w, h, xo, yo, fl, zo = struct.unpack_from('<IhhhhHH', obj, o)
    r = decode_sprite(imgdata, offset, w, h, fl)
    return Image.frombytes('RGBA', (w, h), r), (xo, yo)

# ---- definitions ----
TERRAIN = [  # (name, g1 index)
    ("Grass Tile", 1915), ("Sand Tile", 1973), ("Dirt Tile", 1976),
    ("Rock Tile", 2371), ("Water Tile", 2143),
]
PATHS = [  # (name, dat, imageIndex)  0 = surface, 51 = queue surface
    ("Paved Path", "TARMAC", 0), ("Dirt Road", "PATHDIRT", 0),
    ("Crazy Paving Path", "PATHCRZY", 0), ("Ash Path", "PATHASH", 0),
    ("Tarmac Road", "ROAD", 0), ("Queue Line", "TARMAC", 51),
]
TREES = [  # (name, dat) -> 4 rotations (imgs 0..3)
    ("Pine Tree", "TCT"), ("Cypress Tree", "TIC"),
    ("Conifer Tree", "TLC"), ("Bushy Tree", "TMP"),
]

def main():
    cells = []   # (key, img)
    comps = []
    def add(key, img): cells.append((key, img)); return key

    for name, idx in TERRAIN:
        k = add(f"terr_{idx}", g1_tile(idx))
        comps.append(dict(kind="tile", name=name, group="Terrain", keys=[k]))
    for name, dat, i in PATHS:
        im, _ = obj_img(dat, i)
        k = add(f"path_{dat}_{i}", im)
        comps.append(dict(kind="tile", name=name, group="Path", keys=[k]))
    for name, dat in TREES:
        ks = []
        # align 4 rotations into common bbox
        raw = []
        for r in range(4):
            im, off = obj_img(dat, r)
            raw.append((im, off))
        minX = min(o[0] for _, o in raw); minY = min(o[1] for _, o in raw)
        maxX = max(o[0]+im.width for im, o in raw); maxY = max(o[1]+im.height for im, o in raw)
        cw, ch = maxX-minX, maxY-minY
        for r, (im, off) in enumerate(raw):
            canvas = Image.new("RGBA", (cw, ch), (0,0,0,0))
            canvas.alpha_composite(im, (off[0]-minX, off[1]-minY))
            ks.append(add(f"tree_{dat}_{r}", canvas))
        comps.append(dict(kind="rot", name=name, group="Scenery · Nature", keys=ks))

    # shelf-pack
    order = sorted(cells, key=lambda kv: -kv[1].height)
    pos = {}; x = y = rowh = 0
    for key, im in order:
        if x + im.width > ATLAS_W:
            x = 0; y += rowh + 1; rowh = 0
        pos[key] = (x, y, im.width, im.height); x += im.width + 1; rowh = max(rowh, im.height)
    H = y + rowh + 1
    atlas = Image.new("RGBA", (ATLAS_W, H), (0,0,0,0))
    for key, im in cells: atlas.alpha_composite(im, (pos[key][0], pos[key][1]))
    ncol = min(256, len(atlas.getcolors(maxcolors=1<<20) or [0]*256))
    atlas.convert("RGBA").quantize(colors=max(2, ncol), method=Image.Quantize.FASTOCTREE,
                                   dither=Image.Dither.NONE).save(f"{ROOT}/assets/paths_atlas.png", optimize=True)
    def cell(k): p = pos[k]; return [p[0], p[1], p[2], p[3]]
    out = [dict(kind=c['kind'], name=c['name'], group=c['group'], cells=[cell(k) for k in c['keys']]) for c in comps]
    json.dump(dict(atlasW=ATLAS_W, atlasH=H, components=out), open(f"{ROOT}/app/cdn_manifest2.json", "w"))
    print(f"paths_atlas {ATLAS_W}x{H}, {len(cells)} cells, {os.path.getsize(f'{ROOT}/assets/paths_atlas.png')/1024:.1f}KB, {len(out)} components")

if __name__ == "__main__":
    main()
