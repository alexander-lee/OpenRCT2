#!/usr/bin/env python3
"""Standalone RCT2 g1.dat sprite extractor -> PNG (RGBA).
Uses the authentic OpenRCT2 StandardPalette. No external deps (zlib PNG writer).
Format verified against src/openrct2/drawing/{G1Element.h,Drawing.Sprite.RLE.cpp}.
"""
import os, re, struct, zlib, sys, json

REPO = "/Users/alexanderlee/Desktop/OpenRCT2"
DEPOT = "/Users/alexanderlee/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamapps/content/app_285330/depot_285331"

# ---- palette (RGB), from ImageImporter.h StandardPalette (BGRA on disk) ----
def load_palette():
    txt = open(f"{REPO}/src/openrct2/drawing/ImageImporter.h").read()
    block = txt.split('StandardPalette = { {',1)[1].split('} };',1)[0]
    pal=[]
    for ln in block.splitlines():
        if ln.strip().startswith('//'):   # skip commented-out entries
            continue
        for b,g,r,a in re.findall(r'\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}', ln):
            pal.append((int(r),int(g),int(b)))
    assert len(pal)==256, f"palette len {len(pal)}"
    return pal
PALETTE = load_palette()

# ---- g1 flags ----
F_TRANSPARENT = 1<<0
F_RLE         = 1<<2
F_PALETTE     = 1<<3

def png_rgba(w,h,pixels):
    """pixels: bytes RGBA row-major. returns PNG bytes."""
    raw=bytearray()
    stride=w*4
    for y in range(h):
        raw.append(0)  # filter none
        raw+=pixels[y*stride:(y+1)*stride]
    def chunk(typ,data):
        c=struct.pack(">I",len(data))+typ+data
        return c+struct.pack(">I",zlib.crc32(typ+data)&0xffffffff)
    sig=b"\x89PNG\r\n\x1a\n"
    ihdr=struct.pack(">IIBBBBB",w,h,8,6,0,0,0)
    idat=zlib.compress(bytes(raw),9)
    return sig+chunk(b"IHDR",ihdr)+chunk(b"IDAT",idat)+chunk(b"IEND",b"")

def decode_sprite(data, off, w, h, flags):
    """Return RGBA bytes (w*h*4) or None if empty/unsupported."""
    if w<=0 or h<=0 or w>2000 or h>2000: return None
    out=bytearray(w*h*4)  # all zero = transparent
    if flags & F_RLE:
        # per-row u16 offset table at start of this sprite's data
        for y in range(h):
            lo = data[off+y*2] | (data[off+y*2+1]<<8)
            p = off+lo
            end=False
            while not end:
                dsize=data[p]; startx=data[p+1]; p+=2
                end = (dsize & 0x80)!=0
                dsize &= 0x7F
                for i in range(dsize):
                    x=startx+i
                    if 0<=x<w:
                        idx=data[p+i]
                        r,g,b=PALETTE[idx]
                        o=(y*w+x)*4
                        out[o]=r; out[o+1]=g; out[o+2]=b; out[o+3]=255
                p+=dsize
    else:
        # raw: w*h palette indices, index 0 = transparent
        n=w*h
        seg=data[off:off+n]
        if len(seg)<n: return None
        for i in range(n):
            idx=seg[i]
            if idx==0: continue
            r,g,b=PALETTE[idx]
            o=i*4
            out[o]=r; out[o+1]=g; out[o+2]=b; out[o+3]=255
    return bytes(out)

def open_g1(path):
    with open(path,'rb') as f:
        data=f.read()
    num,total=struct.unpack_from('<II',data,0)
    table_off=8
    dblob_off=8+num*16
    elems=[]
    for i in range(num):
        o=table_off+i*16
        offset,w,h,xo,yo,flags,zoff=struct.unpack_from('<IhhhhHH',data,o)
        elems.append(dict(i=i,offset=offset,w=w,h=h,xo=xo,yo=yo,flags=flags))
    return data,dblob_off,elems,num,total

def extract_indices(g1path, outdir, indices, prefix=""):
    data,dblob,elems,num,total=open_g1(g1path)
    os.makedirs(outdir,exist_ok=True)
    manifest=[]
    ok=0
    for idx in indices:
        if idx<0 or idx>=num: continue
        e=elems[idx]
        if e['flags'] & F_PALETTE: continue
        rgba=decode_sprite(data,dblob+e['offset'],e['w'],e['h'],e['flags'])
        if rgba is None: continue
        fn=f"{prefix}{idx:05}.png"
        open(os.path.join(outdir,fn),'wb').write(png_rgba(e['w'],e['h'],rgba))
        manifest.append(dict(index=idx,file=fn,w=e['w'],h=e['h'],x=e['xo'],y=e['yo'],
                             rle=bool(e['flags']&F_RLE)))
        ok+=1
    return manifest,num,total

if __name__=="__main__":
    g1=f"{DEPOT}/Data/g1.dat"
    data,dblob,elems,num,total=open_g1(g1)
    print(f"g1.dat: {num} sprites, data blob at {dblob}, total {total}")
    # validation batch: a spread across the atlas
    val=list(range(0,40))+list(range(3300,3320))+list(range(11000,11020))
    m,_,_=extract_indices(g1, f"{os.path.dirname(__file__)}/../assets/_validate", val, "")
    print(f"validation: wrote {len(m)} pngs")
    # dims histogram
    from collections import Counter
    dims=Counter((e['w'],e['h']) for e in elems if not (e['flags']&F_PALETTE) and e['w']>0)
    print("top sprite dimensions:", dims.most_common(8))
