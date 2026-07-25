#!/usr/bin/env python3
"""RCT2 .DAT object sprite extractor -> PNG.
Decodes the SawyerCoding chunk, locates the image directory by end-anchored scan
(image table is always last: 8 + n*16 + dataSize must consume the tail), then
decodes each g1 element with the shared RLE/raw decoder.
"""
import os, struct, sys
from g1extract import PALETTE, decode_sprite, png_rgba, F_PALETTE, F_RLE

def decode_sawyer(enc, data):
    if enc==0:   # none
        return bytes(data)
    if enc==1:   # rle
        return decode_rle(data)
    if enc==2:   # rleCompressed = rle then repeat
        return decode_repeat(decode_rle(data))
    if enc==3:   # rotate
        return bytes(((b>>c)|(b<<(8-c)))&0xFF for b,c in zip(data,_rotcodes(len(data))))
    raise ValueError(f"enc {enc}")

def _rotcodes(n):
    code=1
    for _ in range(n):
        yield code
        code=(code+2)%8

def decode_rle(src):
    out=bytearray(); i=0; n=len(src)
    while i<n:
        b=src[i]
        if b & 0x80:
            i+=1; count=257-b
            out += bytes([src[i]])*count
            i+=1
        else:
            length=b+1
            out += src[i+1:i+1+length]
            i+=1+length
    return bytes(out)

def decode_repeat(src):
    out=bytearray(); i=0; n=len(src)
    while i<n:
        b=src[i]
        if b==0xFF:
            i+=1; out.append(src[i]); i+=1
        else:
            count=(b&7)+1; offset=(b>>3)-32
            start=len(out)+offset
            out += bytes(out[start:start+count])
            i+=1
    return bytes(out)

def read_object(path):
    raw=open(path,'rb').read()
    flags=struct.unpack_from('<I',raw,0)[0]
    otype=flags & 0x0F
    name=raw[4:12].decode('latin-1').strip()
    # chunk header: encoding u8, length u32 (packed, 5 bytes)
    enc=raw[16]; length=struct.unpack_from('<I',raw,17)[0]
    comp=raw[21:21+length]
    obj=decode_sawyer(enc,comp)
    return otype,name,obj

def find_image_table(obj):
    """Return (offset, numImages, imageDataSize) or None. End-anchored scan."""
    L=len(obj)
    best=None
    # image table starts somewhere in the back half typically; scan all plausible p
    p=0
    while p < L-8:
        n=struct.unpack_from('<I',obj,p)[0]
        if 0 < n <= 20000:
            ds=struct.unpack_from('<I',obj,p+4)[0]
            total=8 + n*16 + ds
            if p+total==L:
                # sanity: first element offset should be 0 and dims plausible
                first_off=struct.unpack_from('<I',obj,p+8)[0]
                w,h=struct.unpack_from('<hh',obj,p+12)
                if first_off==0 and -1<=w<=2000 and -1<=h<=2000:
                    return (p,n,ds)
        p+=1
    return None

def extract_object(path, outdir, prefix, limit=None):
    otype,name,obj=read_object(path)
    it=find_image_table(obj)
    if it is None:
        return None
    p,num,ds=it
    tbl=p+8
    data_off=tbl+num*16
    imgdata=obj[data_off:data_off+ds]
    os.makedirs(outdir,exist_ok=True)
    manifest=[]
    count=0
    rng=range(num if limit is None else min(num,limit))
    for i in rng:
        o=tbl+i*16
        offset,w,h,xo,yo,fl,zo=struct.unpack_from('<IhhhhHH',obj,o)
        if fl & F_PALETTE: continue
        rgba=decode_sprite(imgdata,offset,w,h,fl)
        if rgba is None: continue
        fn=f"{prefix}_{i:03}.png"
        open(os.path.join(outdir,fn),'wb').write(png_rgba(w,h,rgba))
        manifest.append(dict(i=i,file=fn,w=w,h=h,x=xo,y=yo))
        count+=1
    return dict(name=name,type=otype,numImages=num,extracted=count,manifest=manifest)

if __name__=="__main__":
    DEPOT="/Users/alexanderlee/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamapps/content/app_285330/depot_285331/ObjData"
    tests=sys.argv[1:] or ["MONO1.DAT","TARMAC.DAT","1X1ATREE.DAT","BOMERANG.DAT","LAMP1.DAT"]
    for t in tests:
        r=extract_object(os.path.join(DEPOT,t), "../assets/_objtest", t.split('.')[0])
        if r: print(f"{t:16} type={r['type']} '{r['name']}' images={r['numImages']} extracted={r['extracted']}")
        else: print(f"{t:16} FAILED to locate image table")
