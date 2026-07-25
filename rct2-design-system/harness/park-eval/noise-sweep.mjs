#!/usr/bin/env node
// sweep buildTerrain's landform noise params and report the relief they yield
// over a size-S plot (peaks/basins off). Picks the archetype numbers honestly.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.resolve(HERE, '..', 'mp3d-render');
const REPO = path.resolve(HERE, '..', '..', 'mp3d');
const S = Number((process.argv.find(a => a.startsWith('--size=')) ?? '--size=192').split('=')[1]);
const entrySrc = `
import * as THREE from 'three';
import { buildTerrain } from ${JSON.stringify(path.join(REPO, 'components/TerrainKit/index.tsx'))};
const S = ${S};
const out = [];
const AMPS=[0.38,0.8,1.2,1.8,2.6];
const SKS=[0.52,0.30,0.19,0.12,0.08,0.05];
const OCT=[2,3,4,5];
const ROUGH=[0.35,0.5,0.62];
for (const amp of AMPS) for (const sk of SKS) for (const oc of OCT) for (const ro of ROUGH) {
  // average over 4 seeds
  let stds=[], rels=[], pks=[];
  for (const sd of [17,113,307,701]) {
    const ter = buildTerrain(THREE, { size:S, seg:2, seed:sd, amplitude:amp, scale:S*sk, octaves:oc, roughness:ro, waterLevel:null, peaks:[], basins:[] });
    const h=ter.heightAt, N=64, half=S/2, hs=[];
    for (let i=0;i<N;i++) for (let j=0;j<N;j++) hs.push(h(-half+(i+0.5)*S/N,-half+(j+0.5)*S/N));
    const m=hs.reduce((a,b)=>a+b,0)/hs.length;
    stds.push(Math.sqrt(hs.reduce((a,b)=>a+(b-m)**2,0)/hs.length));
    const so=[...hs].sort((a,b)=>a-b); rels.push(so[so.length-1]-so[0]);
    // local maxima count (5x5)
    let pn=0; const at=(i,j)=>hs[i*N+j];
    for(let i=2;i<N-2;i++)for(let j=2;j<N-2;j++){const v=at(i,j); if(v<m+0.15)continue; let mx=true; for(let di=-2;di<=2&&mx;di++)for(let dj=-2;dj<=2;dj++){if(!di&&!dj)continue; if(at(i+di,j+dj)>v){mx=false;break;}} if(mx)pn++;}
    pks.push(pn);
    ter.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose();});
  }
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  out.push({amp,sk,oc,ro,std:+avg(stds).toFixed(3),relief:+avg(rels).toFixed(2),lobes:+avg(pks).toFixed(1)});
}
console.log('__RESULT__'+JSON.stringify(out));
`;
fs.mkdirSync(path.join(HARNESS, 'out'), { recursive: true });
const entryPath = path.join(HARNESS, 'out', '_noise-sweep.tsx');
fs.writeFileSync(entryPath, entrySrc);
const bundle = await build({ entryPoints: [entryPath], bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' }, nodePaths: [path.join(HARNESS, 'node_modules')], target: 'chrome120', logLevel: 'silent' });
const { chromium } = await import('playwright');
const htmlPath = path.join(HARNESS, 'out', 'noise-sweep.html');
fs.writeFileSync(htmlPath, `<!doctype html><html><body><script>${bundle.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>')}</script></body></html>`);
const browser = await chromium.launch();
const page = await browser.newPage();
let result = null;
page.on('console', (m) => { const s = m.text(); if (s.startsWith('__RESULT__')) result = JSON.parse(s.slice(10)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`file://${htmlPath}`);
for (let i = 0; i < 240 && !result; i++) await page.waitForTimeout(500);
await browser.close();
fs.writeFileSync(path.join(HERE, `noise-sweep-${S}.json`), JSON.stringify(result, null, 1));
// print a compact table, grouped by scaleK
const by = {};
for (const r of result) (by[r.sk] ??= []).push(r);
for (const sk of Object.keys(by)) {
  console.log(`\n--- scaleK ${sk} (wavelength ${(S * Number(sk)).toFixed(1)} u on a ${S} plot) ---`);
  console.log('amp   oct rough   stdH  relief lobes');
  for (const r of by[sk]) console.log(`${String(r.amp).padEnd(5)} ${r.oc}   ${String(r.ro).padEnd(5)}  ${String(r.std).padStart(6)} ${String(r.relief).padStart(6)} ${String(r.lobes).padStart(5)}`);
}
