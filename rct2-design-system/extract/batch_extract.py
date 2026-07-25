#!/usr/bin/env python3
"""Batch-extract a broad, per-category real-sprite library for the park builder.
Outputs assets/<cat>/*.png and app/index.js (window.RCT_INDEX = {...})."""
import os, struct, json, glob
from g1extract import PALETTE, decode_sprite, png_rgba, F_PALETTE, F_RLE, open_g1
from objextract import read_object, find_image_table, decode_sawyer

ROOT=os.path.abspath(os.path.dirname(__file__)+"/..")
DEPOT="/Users/alexanderlee/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamapps/content/app_285330/depot_285331"
OBJ=f"{DEPOT}/ObjData"; G1=f"{DEPOT}/Data/g1.dat"
ASSETS=f"{ROOT}/assets"

def save(cat, fn, w, h, rgba):
    d=f"{ASSETS}/{cat}"; os.makedirs(d,exist_ok=True)
    open(f"{d}/{fn}",'wb').write(png_rgba(w,h,rgba))

# ---------- object image-table header parse (cheap, no decode) ----------
def obj_headers(objbytes, it):
    p,num,ds=it; tbl=p+8; data_off=tbl+num*16
    imgdata=objbytes[data_off:data_off+ds]
    hdrs=[]
    for i in range(num):
        o=tbl+i*16
        offset,w,h,xo,yo,fl,zo=struct.unpack_from('<IhhhhHH',objbytes,o)
        hdrs.append((i,offset,w,h,xo,yo,fl))
    return hdrs, imgdata

def extract_object_previews(path, cat, prefix, want_all=False, max_imgs=200):
    try:
        otype,name,obj=read_object(path)
        it=find_image_table(obj)
        if it is None: return []
        hdrs,imgdata=obj_headers(obj,it)
    except Exception:
        return []
    entries=[]
    # choose indices: all (paths) or preview = image0 + largest-area
    if want_all:
        idxs=[h[0] for h in hdrs][:max_imgs]
    else:
        real=[h for h in hdrs if not (h[6]&F_PALETTE) and h[2]>0 and h[3]>0]
        if not real: return []
        largest=max(real, key=lambda h:h[2]*h[3])
        idxs=[]
        if real[0][0] not in idxs: idxs.append(real[0][0])
        if largest[0] not in idxs: idxs.append(largest[0])
    for i in idxs:
        h=hdrs[i]
        _,offset,w,hh,xo,yo,fl=h
        if fl&F_PALETTE or w<=0 or hh<=0: continue
        rgba=decode_sprite(imgdata,offset,w,hh,fl)
        if rgba is None: continue
        fn=f"{prefix}_{i:03}.png"
        save(cat,fn,w,hh,rgba)
        entries.append(dict(file=f"assets/{cat}/{fn}",name=name,w=w,h=hh,x=xo,y=yo,i=i))
    return entries

def main():
    index={"rides":[],"paths":[],"people":[],"scenery":[],"terrain":[]}
    # ---- RIDES: preview per ride object (type 0) ----
    rides=[]
    for f in sorted(glob.glob(f"{OBJ}/*.DAT")):
        try:
            flags=struct.unpack_from('<I',open(f,'rb').read(4),0)[0]
        except Exception: continue
        if (flags&0x0F)==0: rides.append(f)
    print(f"rides: {len(rides)} objects")
    for f in rides:
        pre=os.path.basename(f).split('.')[0]
        e=extract_object_previews(f,"rides",pre,want_all=False)
        # keep only the hero (largest) as the ride tile; also keep img0
        if e:
            hero=max(e,key=lambda x:x['w']*x['h']); hero['hero']=True
            index["rides"].append(hero)
    print(f"  extracted {len(index['rides'])} ride previews")
    # ---- PATHS: footpaths (type 5) + path additions (type 6), all images ----
    for typ,cat_slug in [(5,"footpath"),(6,"addition")]:
        objs=[f for f in sorted(glob.glob(f"{OBJ}/*.DAT"))
              if (struct.unpack_from('<I',open(f,'rb').read(4),0)[0]&0x0F)==typ]
        for f in objs:
            pre=os.path.basename(f).split('.')[0]
            e=extract_object_previews(f,"paths",pre,want_all=True,max_imgs=100)
            for x in e: x['sub']=cat_slug
            index["paths"]+=e
    print(f"paths: {len(index['paths'])} sprites")
    # ---- SCENERY: small(1) + large(2) previews (broad sample) ----
    for typ in (1,2):
        objs=[f for f in sorted(glob.glob(f"{OBJ}/*.DAT"))
              if (struct.unpack_from('<I',open(f,'rb').read(4),0)[0]&0x0F)==typ]
        for f in objs:
            pre=os.path.basename(f).split('.')[0]
            e=extract_object_previews(f,"scenery",pre,want_all=False)
            if e:
                hero=max(e,key=lambda x:x['w']*x['h']); hero['sub']=("small" if typ==1 else "large")
                index["scenery"].append(hero)
    print(f"scenery: {len(index['scenery'])} previews")
    # ---- PEOPLE: guest + staff walking (g1), mood faces ----
    data,dblob,elems,num,total=open_g1(G1)
    def g1grab(cat,indices,prefix):
        out=[]
        for idx in indices:
            if idx<0 or idx>=num: continue
            e=elems[idx]
            if e['flags']&F_PALETTE: continue
            rgba=decode_sprite(data,dblob+e['offset'],e['w'],e['h'],e['flags'])
            if rgba is None or e['w']<=0: continue
            fn=f"{prefix}_{idx:05}.png"; save(cat,fn,e['w'],e['h'],rgba)
            out.append(dict(file=f"assets/{cat}/{fn}",name=prefix,w=e['w'],h=e['h'],x=e['xo'],y=e['yo'],i=idx))
        return out
    index["people"]+=g1grab("people",range(6409,6521),"guest_walk")   # base walk (dirs+frames)
    index["people"]+=g1grab("people",range(11261,11285),"handyman")
    index["people"]+=g1grab("people",range(5284,5327),"face")          # large mood faces
    print(f"people: {len(index['people'])} sprites")
    # ---- TERRAIN: 64px-wide iso tiles in surface band ----
    terr=[i for i in range(1550,2620)
          if elems[i]['w']==64 and 12<=elems[i]['h']<=40 and not (elems[i]['flags']&F_PALETTE)]
    index["terrain"]+=g1grab("terrain",terr[:120],"tile")
    print(f"terrain: {len(index['terrain'])} candidate tiles")
    # ---- write index ----
    os.makedirs(f"{ROOT}/app",exist_ok=True)
    with open(f"{ROOT}/app/index.js","w") as fp:
        fp.write("window.RCT_INDEX = "+json.dumps(index)+";\n")
    tot=sum(len(v) for v in index.values())
    print(f"\nTOTAL {tot} sprites indexed -> app/index.js")
    for k,v in index.items(): print(f"  {k}: {len(v)}")

if __name__=="__main__": main()
