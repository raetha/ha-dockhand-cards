# Screenshot harness

Renders the real, built card bundle (`dist/ha-dockhand-cards.js`, not a mockup of it) in a
headless browser against entirely fictional data, and saves PNG screenshots — used to generate
the images in `docs/images/` and embedded in the main `README.md`.

Every name and value in `mock-data.mjs` is made up (a fictional environment called "Nebula",
containers named `web`/`postgres`/`redis`/`traefik`/`worker`, fake vulnerability counts, fake
CPU/memory figures). Nothing here reads from or writes to a real Home Assistant instance —
that's the point of it existing as a separate tool rather than screenshotting a live dashboard.

## Setup (one-time)

```bash
cd tools/screenshot-harness
npm install                        # installs @mdi/js — real icon path data, ~50 icons
pip install playwright
python3 -m playwright install chromium
```

## Generating screenshots

```bash
# from the repo root
npm run build                      # produces dist/ha-dockhand-cards.js
cp dist/ha-dockhand-cards.js tools/screenshot-harness/
cd tools/screenshot-harness
python3 -m http.server 8931 &
python3 screenshot.py
```

Screenshots land in `tools/screenshot-harness/out/`. Copy whichever ones you want into
`docs/images/` and reference them from `README.md`.

## How it works

- `mock-data.mjs` builds a fake `hass.devices`/`hass.entities`/`hass.states` set, matching
  ha-dockhand's actual entity schema (translation_key + device identifiers) — see
  `docs/ARCHITECTURE.md` §1 for the real contract this mirrors. Edit this file to change the
  fictional names/values, or add more containers/stacks.
- `ha-shims.mjs` provides minimal replacements for the handful of Home Assistant frontend
  components the cards use (`ha-icon`, `ha-state-icon`, `ha-card`, `ha-switch`, `ha-formfield`,
  `ha-expansion-panel`) — none of these are available outside a real HA frontend bundle. Icons
  render as real MDI SVG paths via `@mdi/js`, not placeholders — `icon-paths.json` holds just the
  ~50 icon paths these cards actually reference, not the whole MDI set (see below for keeping
  this in sync).

  Note: the icon/switch shims defer their DOM mutation to a microtask
  (`queueMicrotask`) rather than mutating synchronously in `connectedCallback`/
  `attributeChangedCallback`. Mutating synchronously there conflicts with Lit's own
  synchronous template commit when both happen inside the same browser task — surfaces as
  `this.element.setAttribute is not a function` thrown from Lit's internals, not from this
  code, which makes it non-obvious to trace back here if you're extending these shims later.
- `index.html` loads the real card bundle as an ES module, and exposes `window.__mount(tag,
  config, width)` to mount a card with a config and the mock `hass` object.
- `screenshot.py` (Playwright) drives headless Chromium: the `CARDS` list at the top is
  `(tag, config_dict, output_filename, width, height)` tuples — add a new one to capture another
  card/config combination.

## Known limitations

- CPU/Memory history sparklines use a fake generated wave (`hass.callApi` is stubbed), not real
  Dockhand-shaped history — fine for a screenshot, not meaningful for testing chart logic.
- `index.html`'s `<style>` block hardcodes HA's default **dark** theme's CSS custom properties.
  Swap those values for a light-theme screenshot instead.
- Editors (`getConfigElement()`) aren't exercised by this harness, only the live cards.
- `dist/ha-dockhand-cards.js` and `out/*.png` working copies in this folder are gitignored —
  only the harness source itself is tracked. Rebuild/regenerate rather than expect them present.

## Updating icons after adding a new `mdi:` reference anywhere in the cards

If you add a new `mdi:xxx` icon anywhere in `src/`, `icon-paths.json` needs regenerating or that
icon renders blank in screenshots:

```bash
cd tools/screenshot-harness
node extract-icons.mjs
```

It scans `src/` itself for every `mdi:` reference, so it can't go stale silently the way a
one-off hardcoded list would — if an icon used in the cards isn't found in `@mdi/js` under the
expected name, it prints a `MISSING` warning instead of failing quietly.
