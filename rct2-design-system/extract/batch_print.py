import os, json, sys
MP=os.path.abspath("mp")
prim={"Atlas","SpriteRotator","PeepWalker","MoodFaces"}
comps=sorted(d for d in os.listdir(f"{MP}/components")
             if os.path.isdir(f"{MP}/components/{d}") and d not in prim)
start=int(sys.argv[1]); count=int(sys.argv[2])
batch=comps[start:start+count]
files=[]
for c in batch:
    for fn in (f"{c}/index.tsx", f"{c}/{c}.previews.tsx", f"{c}/Context.md"):
        p=f"{MP}/components/{fn}"
        files.append({"fileName":f"components/{fn}","content":open(p).read()})
sys.stdout.write(json.dumps(files))
sys.stderr.write(f"batch {start}..{start+len(batch)-1} : {len(batch)} comps, {len(files)} files, {sum(len(x['content']) for x in files)} bytes\n")
