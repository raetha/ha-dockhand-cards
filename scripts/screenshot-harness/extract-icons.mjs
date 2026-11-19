// Regenerates icon-paths.json: the path data, from @mdi/js, of every
// `mdi:` icon the cards, this harness and ha-dockhand's entities use (not
// the whole MDI set). Also copies ha-dockhand's entity icons (its
// icons.json) to entity-icons.json, which the ha-state-icon shim resolves
// states with, as Home Assistant does. Run it after adding an icon to the
// cards or when ha-dockhand's icons change.
//
//   node extract-icons.mjs [path/to/ha-dockhand/custom_components/dockhand/icons.json]

import * as mdi from '@mdi/js';
import { existsSync, writeFileSync, readdirSync, readFileSync, statSync } from 'fs';
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
for (const file of ['mock-data.mjs', 'ha-shims.mjs']) {
  const text = readFileSync(join(import.meta.dirname, file), 'utf-8');
  for (const m of text.matchAll(/mdi:([a-z0-9-]+)/g)) names.add(m[1]);
}

// ha-dockhand's entity icons, from a checkout next to this repo by default.
const iconsJson = process.argv[2] ?? join(import.meta.dirname, '..', '..', '..', 'ha-dockhand', 'custom_components', 'dockhand', 'icons.json');
const entityIconsFile = join(import.meta.dirname, 'entity-icons.json');
if (existsSync(iconsJson)) {
  writeFileSync(entityIconsFile, JSON.stringify(JSON.parse(readFileSync(iconsJson, 'utf-8')).entity, null, 1) + '\n');
} else {
  console.error(`${iconsJson} not found: keeping entity-icons.json as it is`);
}
for (const m of readFileSync(entityIconsFile, 'utf-8').matchAll(/mdi:([a-z0-9-]+)/g)) names.add(m[1]);

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
