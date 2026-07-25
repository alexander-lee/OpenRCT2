#!/usr/bin/env node
// esbuild-bundle SPECIFIC components' previews: node check-some.mjs A B C
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d', 'components');
let fail = 0;
for (const n of process.argv.slice(2)) {
  const ep = path.join(HARNESS, 'out', `_chk-${n}.tsx`);
  fs.writeFileSync(ep, `import p from ${JSON.stringify(path.join(REPO, n, `${n}.previews.tsx`))}; console.log(p.componentName);`);
  try {
    await build({ entryPoints: [ep], bundle: true, write: false, format: 'iife', jsx: 'automatic',
      loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
      nodePaths: [path.join(HARNESS, 'node_modules')], target: 'chrome120', logLevel: 'silent' });
    console.log(`ok   ${n}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${n}`);
    for (const err of (e.errors ?? []).slice(0, 4)) console.log(`   ${err.location?.file}:${err.location?.line} ${err.text}`);
  }
}
process.exit(fail ? 1 : 0);
