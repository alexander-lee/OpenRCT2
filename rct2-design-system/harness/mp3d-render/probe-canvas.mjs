import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HARNESS=path.dirname(fileURLToPath(import.meta.url));
const REPO=path.resolve(HARNESS,'..','..','mp3d');
const name=process.argv[2]||'MineTrainCoaster';
const only=process.argv[3]??'0';
const compDir=path.join(REPO,'components',name);
const entry=`
import React from 'react';
import { createRoot } from 'react-dom/client';
import previews from ${JSON.stringify(path.join(compDir, `${name}.previews.tsx`))};
const list = previews.previews ?? [];
createRoot(document.getElementById('root')).render(React.createElement('div', null, [list[${only}]].map((p,i)=>React.createElement('div',{key:i},p.render()))));
`;
const ep=path.join(HARNESS,'out',`_cv-${name}.tsx`);
fs.writeFileSync(ep,entry);
const b=await build({entryPoints:[ep],bundle:true,write:false,format:'iife',jsx:'automatic',loader:{'.tsx':'tsx','.ts':'ts'},define:{'process.env.NODE_ENV':'"production"'},nodePaths:[path.join(HARNESS,'node_modules')],target:'chrome120',logLevel:'silent'});
const html=path.join(HARNESS,'out',`cv-${name}.html`);
fs.writeFileSync(html,`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#38343a}#root{width:900px}</style></head><body><div id="root"></div><script>${b.outputFiles[0].text}</script></body></html>`);
const br=await chromium.launch({args:['--use-angle=swiftshader']});
const pg=await br.newPage({viewport:{width:900,height:700}});
await pg.goto(`file://${html}`);
await pg.waitForTimeout(6000);
const info=await pg.evaluate(()=>{
  const c=document.querySelector('canvas');
  const api=c.__stageApi;
  const cam=api?.cameras?.()[0];
  const THREE=window.__THREE || null;
  const scene=api?.scene?.() ?? cam?.parent;
  const out=[];
  const root = scene;
  const camObj = cam;
  camObj.updateMatrixWorld(true);
  const project=(v)=>{ const p=v.clone().applyMatrix4(camObj.matrixWorldInverse ?? camObj.matrixWorld.clone().invert()).applyMatrix4(camObj.projectionMatrix); return p; };
  // walk top-level children, compute world bbox and NDC bbox
  const Box3 = root.children[0]?.constructor ? null : null;
  const res=[];
  for (const ch of root.children) {
    const box = new (window.THREE_Box3 || Object)();
    res.push({name: ch.name || ch.type, children: ch.children?.length ?? 0});
  }
  return {cw:c.clientWidth, ch:c.clientHeight, fov:cam?.fov, aspect:cam?.aspect, pos:cam?.position?.toArray(), kids: res};
});
console.log(JSON.stringify(info,null,1));
await br.close();
