// Regenerates icon-paths.json by scanning the actual card source (../../src)
// for every `mdi:xxx` reference and extracting just those icons' path data
// from @mdi/js — not the whole ~7500-icon set. Run this after adding a new
// icon anywhere in the cards, before regenerating screenshots.
//
//   node extract-icons.mjs

import * as mdi from '@mdi/js';
import { writeFileSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(import.meta.dirname, '..', '..', 'src');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const names = new Set();
for (const file of walk(SRC_DIR)) {
  const text = readFileSync(file, 'utf-8');
  for (const m of text.matchAll(/mdi:([a-z0-9-]+)/g)) names.add(m[1]);
}

function toCamel(name) {
  return 'mdi' + name.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
}

const out = {};
const missing = [];
for (const n of names) {
  const key = toCamel(n);
  if (mdi[key]) out[n] = mdi[key];
  else missing.push(n);
}

writeFileSync(join(import.meta.dirname, 'icon-paths.json'), JSON.stringify(out));
console.log(`wrote ${Object.keys(out).length} icons`);
if (missing.length) console.error('MISSING (not found in @mdi/js):', missing);
