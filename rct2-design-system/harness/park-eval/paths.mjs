// park-eval shared PATHS — kept separate from lib.mjs so the layout/catalog/
// corpus modules never depend on which harness build is in place (wave 7
// rebuilt lib.mjs around puppeteer-core; the eval-tag bundler lives in
// evaltags.mjs).
//
// MOVED IN-REPO 2026-07-24: this harness now lives at
// rct2-design-system/harness/park-eval, versioned alongside the design
// system it evaluates. Both HERE and REPO are derived from this file's own
// location (not hardcoded absolutes) so the harness keeps working no matter
// where the repo is cloned or moved.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..', 'mp3d');
