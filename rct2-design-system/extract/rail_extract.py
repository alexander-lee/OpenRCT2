#!/usr/bin/env python3
"""Extract flat track RAIL sprites from g1.dat using rails_map.json.

A flat straight track piece is drawn with two diagonal sprites; the 4 map
rotations cycle SW_NE, NW_SE, SW_NE, NW_SE. Track colour uses the primary/
secondary remap ranges, so we recolour to a pleasant default track scheme.
"""
import os, json
from g1extract import PALETTE, F_PALETTE, F_RLE, png_rgba, open_g1
from peep_extract import decode_pal, make_palette, g1, OUT as PEEP_OUT

ROOT = os.path.abspath(os.path.dirname(__file__) + "/..")
OUT = f"{ROOT}/assets/rails"

def extract():
    rmap = json.load(open(f"{os.path.dirname(__file__)}/rails_map.json"))
    data, dblob, elems, num, total = g1()
    os.makedirs(OUT, exist_ok=True)
    # track colour: main rail = steel blue, supports = grey
    pal = make_palette("blue", "grey")
    out = []
    for key, v in rmap.items():
        sw, nw = v['flat_sw_ne'], v['flat_nw_se']
        rots_src = [sw, nw, sw, nw]            # 4 map rotations
        rots = []
        ok = True
        for r, idx in enumerate(rots_src):
            if idx < 0 or idx >= num: ok = False; break
            e = elems[idx]
            if e['flags'] & F_PALETTE or e['w'] <= 0 or e['h'] <= 0: ok = False; break
            rgba = decode_pal(data, dblob+e['offset'], e['w'], e['h'], e['flags'], pal)
            if rgba is None: ok = False; break
            fn = f"{key}_rot{r}.png"
            open(f"{OUT}/{fn}", 'wb').write(png_rgba(e['w'], e['h'], rgba))
            rots.append(dict(file=f"assets/rails/{fn}", w=e['w'], h=e['h'], x=e['xo'], y=e['yo']))
        if ok:
            out.append(dict(key=key, name=v['name'], rotations=rots,
                            chained=('flat_chained_sw_ne' in v)))
    with open(f"{OUT}/manifest.json", "w") as fp:
        json.dump(out, fp)
    print(f"rails extracted: {len(out)}")
    return out

if __name__ == "__main__":
    o = extract()
    for x in o[:6]:
        r = x['rotations'][0]
        print(f"  {x['key']:20} '{x['name']}' {r['w']}x{r['h']}")
