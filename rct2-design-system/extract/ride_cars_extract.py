#!/usr/bin/env python3
"""Extract REAL ride vehicle (car) sprites at their 4 cardinal map rotations.

NOT ride previews. Parses each ride .DAT's car header exactly as
RideObject::ReadLegacyCar does, computes each car's flat sprite-group base
image index and frame stride, then pulls the 4 cardinal rotation sprites
(yaw 0/8/16/24 of the 32-frame flat group; scaled for 16/4-frame variants).

Layout facts (verified against src/openrct2/object/RideObject.cpp):
  image table: [0,1,2] = 3 preview slots (SKIPPED), car sprites start at index 3.
  car header = 101 bytes; ride header before cars = 26 bytes.
  flat group (SpriteGroupType::SlopeFlat=0) is first; its imageId == car base.
  sprite index = flatImageId + yawFrame*base_num_frames (+ subframe).
"""
import os, struct, glob, json
from g1extract import PALETTE, decode_sprite, png_rgba, F_PALETTE, F_RLE
from objextract import read_object, find_image_table

ROOT = os.path.abspath(os.path.dirname(__file__) + "/..")
DEPOT = "/Users/alexanderlee/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamapps/content/app_285330/depot_285331"
OBJ = f"{DEPOT}/ObjData"
OUT = f"{ROOT}/assets/rides_cars"

# ---- SpriteGroupMultiplier (RideObject.cpp:57) ----
MULT = [1,2,2,2,2,2,2,10,1,2,2,2,2,2,2,2,6,4,4,4,
        4,4,4,4,4,4,4,12,4,4,4,4,4,4,4,4,20,3,1,1]
COUNT = 40  # SpriteGroupType::Count

# SpritePrecision enum values -> frame count = (1<<p)>>1
def num_sprites(p): return (1 << p) >> 1
P_NONE, P_S1, P_S2, P_S4, P_S8, P_S16, P_S32 = 0,1,2,3,4,5,6

# ---- CarSpriteFlag bits (RideObject.cpp:133) ----
CS_FLAT=0; CS_GENTLE=1; CS_STEEP=2; CS_VERT=3; CS_DIAG=4; CS_FLATBANK=5
CS_INLINE=6; CS_F2GBANK=7; CS_DGBANK=8; CS_GBANKTR=9; CS_GBANKTURN=10
CS_F2GWBANK=11; CS_CORK=12; CS_RESTRAINT=13; CS_CURVELIFT=14; CS_4ROT=15

# ---- CarEntryFlag bits (CarEntry.h) ----
CF_DODGEMLIGHTS=7; CF_USE16ROT=11; CF_OVERRIDEVFRAMES=12; CF_SPINCOMBINED=14
CF_SWINGING=17; CF_SPINNING=18; CF_SUSPSWING=21; CF_VEHANIM=23
CF_WOODENWMSWING=25; CF_SLIDESWING=27

def bit(v, b): return (v >> b) & 1

def read_legacy_sprite_groups(car_flags, sprite_flags):
    """Return precision[40] replicating ReadLegacySpriteGroups()."""
    prec = [P_NONE]*COUNT
    baseP = P_S32
    if bit(car_flags, CF_USE16ROT): baseP = P_S16
    if bit(sprite_flags, CS_4ROT):  baseP = P_S4
    def s(i, p): prec[i] = p
    if bit(sprite_flags, CS_FLAT): s(0, baseP)
    if bit(sprite_flags, CS_GENTLE):
        s(1, P_S4); s(2, baseP)
        if bit(car_flags, CF_SPINCOMBINED): s(2, P_S4)
    if bit(sprite_flags, CS_STEEP): s(3, P_S8); s(4, baseP)
    if bit(sprite_flags, CS_VERT):  s(5, P_S4); s(6, baseP); s(7, P_S4); s(8, P_S4)
    if bit(sprite_flags, CS_DIAG):  s(9, P_S4); s(10, P_S4); s(11, P_S4)
    if bit(sprite_flags, CS_FLATBANK): s(12, P_S8); s(13, baseP)
    if bit(sprite_flags, CS_INLINE):  s(14, P_S4); s(15, P_S4); s(16, P_S4)
    if bit(sprite_flags, CS_F2GBANK): s(17, baseP)
    if bit(sprite_flags, CS_DGBANK):  s(18, P_S4)
    if bit(sprite_flags, CS_GBANKTR): s(19, P_S4)
    if bit(sprite_flags, CS_GBANKTURN): s(23, baseP)
    if bit(sprite_flags, CS_F2GWBANK): s(24, P_S4)
    if bit(sprite_flags, CS_CORK): s(36, P_S4)
    if bit(sprite_flags, CS_RESTRAINT): s(37, P_S4)
    if bit(sprite_flags, CS_CURVELIFT): s(38, baseP)
    return prec

def calc_vframes(car_flags, legacy_anim, vframes_override):
    if bit(car_flags, CF_OVERRIDEVFRAMES): return vframes_override or 1
    if not bit(car_flags, CF_SPINCOMBINED):
        obs_tower = (legacy_anim == 6)
        if bit(car_flags, CF_VEHANIM) and not obs_tower:
            return 2 if bit(car_flags, CF_DODGEMLIGHTS) else 4
        return 1
    # spinning combined
    return 32 if bit(car_flags, CF_SPINCOMBINED) else (8 if bit(car_flags, CF_SPINNING) else 1)

def calc_hframes(car_flags):
    if not bit(car_flags, CF_SWINGING): return 1
    susp = bit(car_flags, CF_SUSPSWING); slide = bit(car_flags, CF_SLIDESWING)
    if not (susp or slide):
        return 3 if bit(car_flags, CF_WOODENWMSWING) else 5
    if not (susp and slide): return 7
    return 13

def parse_cars(obj):
    """Return list of car dicts with flat_image_id, F (flat frames), bnf."""
    cars = []
    off = 26  # header: seek8 + flags4 + ride_type3 + 10 u8 + pad1
    cur = 3   # currentCarImagesOffset = images_offset(0) + 3 preview slots
    for i in range(4):
        base = off + i*101
        if base + 101 > len(obj): break
        sprite_flags = struct.unpack_from('<H', obj, base+12)[0]
        legacy_anim  = obj[base+17]
        car_flags    = struct.unpack_from('<I', obj, base+18)[0]
        vf_override  = obj[base+96]
        prec = read_legacy_sprite_groups(car_flags, sprite_flags)
        flat_enabled = prec[0] != P_NONE
        car = dict(index=i, flat=flat_enabled)
        if flat_enabled:
            bnf = calc_vframes(car_flags, legacy_anim, vf_override) * calc_hframes(car_flags)
            F = num_sprites(prec[0])
            num_car_images = sum(bnf * num_sprites(prec[g]) * MULT[g]
                                 for g in range(COUNT) if prec[g] != P_NONE)
            no_seating_rows = obj[base+84]
            car.update(flat_image_id=cur, F=F, bnf=bnf, num_car_images=num_car_images)
            cur = cur + num_car_images + no_seating_rows * num_car_images
        cars.append(car)
    return cars

def extract_ride(path, want_cars=None):
    """Extract 4 cardinal rotations for each flat car. Returns list of entries."""
    otype, name, obj = read_object(path)
    if (otype & 0x0F) != 0: return []   # not a ride
    it = find_image_table(obj)
    if it is None: return []
    p, num, ds = it
    tbl = p+8; data_off = tbl + num*16
    imgdata = obj[data_off:data_off+ds]
    def hdr(i):
        o = tbl + i*16
        return struct.unpack_from('<IhhhhHH', obj, o)  # offset,w,h,xo,yo,fl,zo
    cars = parse_cars(obj)
    flat_cars = [c for c in cars if c.get('flat')]
    if not flat_cars: return []
    prefix = os.path.basename(path).split('.')[0]
    os.makedirs(OUT, exist_ok=True)
    entries = []
    for c in flat_cars:
        if want_cars is not None and c['index'] not in want_cars: continue
        F, bnf, fid = c['F'], c['bnf'], c['flat_image_id']
        frames = [0, F//4, F//2, (3*F)//4]  # 4 cardinal yaws
        sub = 0
        rots = []
        ok = True
        for r, fr in enumerate(frames):
            idx = fid + fr*bnf + sub
            if idx < 0 or idx >= num: ok = False; break
            offset, w, h, xo, yo, fl, zo = hdr(idx)
            if fl & F_PALETTE or w <= 0 or h <= 0: ok = False; break
            rgba = decode_sprite(imgdata, offset, w, h, fl)
            if rgba is None: ok = False; break
            fn = f"{prefix}_car{c['index']}_rot{r}.png"
            open(f"{OUT}/{fn}", 'wb').write(png_rgba(w, h, rgba))
            rots.append(dict(file=f"assets/rides_cars/{fn}", w=w, h=h, x=xo, y=yo))
        if ok and len(rots) == 4:
            entries.append(dict(prefix=prefix, obj_name=name, car=c['index'],
                                F=F, bnf=bnf, rotations=rots))
    return entries

if __name__ == "__main__":
    import sys
    tests = sys.argv[1:]
    if not tests:
        # curated validation coasters
        tests = ["PTCT1","BMSD","ARRT2","WMOUSE","BOB1","MINE1","LFB1",
                 "SPDRCR","BMFL","REVF1","STEEP2","BMVD","ZLDB","VEKST"]
    for t in tests:
        path = f"{OBJ}/{t}.DAT"
        if not os.path.exists(path):
            print(f"{t:10} MISSING"); continue
        e = extract_ride(path)
        if e:
            for x in e:
                r0 = x['rotations'][0]
                print(f"{t:10} '{x['obj_name']}' car{x['car']} F={x['F']} bnf={x['bnf']} "
                      f"size={r0['w']}x{r0['h']} -> {len(x['rotations'])} rots")
        else:
            print(f"{t:10} no flat cars / failed")
