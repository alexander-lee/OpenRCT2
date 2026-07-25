#!/usr/bin/env python3
"""Extract 10 curated scenery/objects, each with its 4 rotations, from .DAT files."""
import os, struct, json
import objextract as ox
from g1extract import decode_sprite, png_rgba, F_PALETTE

ROOT = os.path.abspath(os.path.dirname(__file__) + "/..")
DEPOT = "/Users/alexanderlee/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamapps/content/app_285330/depot_285331"
OBJ = f"{DEPOT}/ObjData"
OUT = f"{ROOT}/assets/scenery10"

# (dat, friendly name, category)
CURATED = [
    ("1X1ATREE", "Oak Tree",         "Nature"),
    ("TMZP",     "Large Tree",       "Nature"),
    ("TCB",      "Conifer Shrub",    "Nature"),
    ("LAMP2",    "Ornate Lamp",      "Urban"),
    ("BENCH1",   "Park Bench",       "Urban"),
    ("TQF",      "Tiered Fountain",  "Water Feature"),
    ("TDF",      "Dolphin Fountain", "Water Feature"),
    ("TSK",      "Giant Skull",      "Statue"),
    ("TES1",     "Egyptian Statue",  "Statue"),
    ("TGS",      "Giraffe Topiary",  "Statue"),
]

def extract_one(dat, name, cat):
    otype, oname, obj = ox.read_object(f"{OBJ}/{dat}.DAT")
    it = ox.find_image_table(obj)
    if not it: return None
    p, num, ds = it
    tbl = p+8; data_off = tbl + num*16
    imgdata = obj[data_off:data_off+ds]
    os.makedirs(OUT, exist_ok=True)
    rots = []
    for r in range(4):                 # small scenery images 0..3 = 4 rotations
        i = r if r < num else 0
        o = tbl + i*16
        offset, w, h, xo, yo, fl, zo = struct.unpack_from('<IhhhhHH', obj, o)
        if fl & F_PALETTE or w <= 0 or h <= 0:
            i = 0; o = tbl; offset, w, h, xo, yo, fl, zo = struct.unpack_from('<IhhhhHH', obj, o)
        rgba = decode_sprite(imgdata, offset, w, h, fl)
        if rgba is None: return None
        fn = f"{dat}_rot{r}.png"
        open(f"{OUT}/{fn}", 'wb').write(png_rgba(w, h, rgba))
        rots.append(dict(file=f"assets/scenery10/{fn}", w=w, h=h, x=xo, y=yo))
    return dict(dat=dat, name=name, category=cat, rotations=rots)

def main():
    out = []
    for dat, name, cat in CURATED:
        e = extract_one(dat, name, cat)
        if e:
            out.append(e)
            print(f"  {dat:10} '{name}' {e['rotations'][0]['w']}x{e['rotations'][0]['h']}")
    with open(f"{OUT}/manifest.json", "w") as fp:
        json.dump(out, fp)
    print(f"scenery components: {len(out)}")

if __name__ == "__main__":
    main()
