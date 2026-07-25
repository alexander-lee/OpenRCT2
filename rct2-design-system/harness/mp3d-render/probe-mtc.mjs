#!/usr/bin/env node
// COMPILE-ONLY probe for MineTrainCoaster layouts: compiles the candidate piece
// lists with the component's own options (profile coaster / type wooden /
// bank 0.42 / heading -90) and prints the design + clearance + closure report,
// the rating triple and the bounding box (for camera framing).
//
//   node probe-mtc.mjs            # all candidates in layouts-mtc.tsx
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');

const entry = path.join(HARNESS, 'layouts-mtc.tsx');
const outFile = path.join(HARNESS, 'out', '_probe-mtc.mjs');
await build({
  entryPoints: [entry], bundle: true, outfile: outFile, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')], target: 'node20', logLevel: 'silent',
  external: ['react', 'react-dom', 'three'],
  alias: { REPO: REPO },
}).catch((e) => {
  console.error('esbuild failed:');
  for (const err of e.errors ?? []) console.error(` ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});
await import(outFile);
