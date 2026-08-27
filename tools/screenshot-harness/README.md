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
npm install                        # installs @mdi/js (icon path data) and @fontsource/roboto
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

### Editor screenshots

```bash
python3 screenshot-editors.py
```

Same mechanism, but mounts an editor (via the card class's own `getConfigElement()` — the same
lazy dynamic-import path HA itself uses to get one, not `document.createElement` on the editor tag
directly, since nothing else ever triggers that import) instead of the card itself. This exists so
a visual layout/spacing regression in an editor can actually be *seen* before it ships, not just
inferred from `npm run verify` passing — several real spacing bugs in this repo's editors were only
caught by eye, after the fact, before this existed. The `EDITORS` list in `screenshot-editors.py`
isn't meant to stay in sync with every card/config the way `screenshot.py`'s `CARDS` list is for
the README — add/adjust entries there ad hoc while actively working on a given editor.

Needs `<ha-form>` to actually render anything (every editor's real field content lives inside it,
not in the editor's own template directly) — see `ha-shims.mjs`'s own `HaForm` class for what that
shim does and doesn't cover: real schema/data/label/helper/warning rendering for the
select/boolean/text/multi_select shapes this repo's `ha-form-types.ts` declares, deliberately
non-interactive (disabled inputs, no `value-changed` wiring) since a screenshot doesn't need to be
editable. Not a pixel-perfect clone of HA's actual `<ha-selector>` widgets — good enough to judge
spacing/layout/grouping, not to judge exact widget styling.

## How it works

- `mock-data.mjs` builds a fake `hass.devices`/`hass.entities`/`hass.states` set, matching
  ha-dockhand's actual entity schema (translation_key + device identifiers) — see
  `docs/ARCHITECTURE.md` §1 for the real contract this mirrors. Edit this file to change the
  fictional names/values, or add more containers/stacks.
- `ha-shims.mjs` provides minimal replacements for the Home Assistant frontend components the
  cards and editors use (`ha-icon`, `ha-state-icon`, `ha-card`, `ha-switch`, `ha-formfield`,
  `ha-expansion-panel`, `ha-icon-button`, `ha-form`) — none of these are available outside a real
  HA frontend bundle. Icons
  render as real MDI SVG paths via `@mdi/js`, not placeholders — `icon-paths.json` holds just the
  ~50 icon paths these cards actually reference, not the whole MDI set (see below for keeping
  this in sync).

  Note: the icon/switch shims defer their DOM mutation to a microtask
  (`queueMicrotask`) rather than mutating synchronously in `connectedCallback`/
  `attributeChangedCallback`. Mutating synchronously there conflicts with Lit's own
  synchronous template commit when both happen inside the same browser task — surfaces as
  `this.element.setAttribute is not a function` thrown from Lit's internals, not from this
  code, which makes it non-obvious to trace back here if you're extending these shims later.
- `index.html` loads the real card bundle as an ES module, real self-hosted Roboto (via
  `@fontsource/roboto`, a harness-only dependency — see its own `package.json`) rather than
  falling back to whatever font this sandbox happens to have installed, and exposes
  `window.__mount(tag, config, width)` to mount a card, and `window.__mountEditor(tag, config,
  width)` to mount that card's editor instead — both with a config and the mock `hass` object.
  The font matters more than it might seem: a fallback system font has genuinely different
  line-height/glyph metrics than real Roboto, which can make an element look vertically
  misaligned in a screenshot when it renders correctly in actual HA (or the reverse — hide a real
  misalignment a correctly-fonted render would show). Found and fixed after exactly that
  discrepancy was reported against a real HA instance and didn't reproduce cleanly here until the
  font was corrected.
- `screenshot.py` (Playwright) drives headless Chromium: the `CARDS` list at the top is
  `(tag, config_dict, output_filename, width, height)` tuples — add a new one to capture another
  card/config combination. `screenshot-editors.py` is the same thing for editors (see above).

## Known limitations

- CPU/Memory history sparklines use a fake generated wave (`hass.callApi` is stubbed), not real
  Dockhand-shaped history — fine for a screenshot, not meaningful for testing chart logic.
- `index.html`'s `<style>` block hardcodes HA's default **dark** theme's CSS custom properties.
  Swap those values for a light-theme screenshot instead.
- `dist/ha-dockhand-cards.js` and `out/*.png` working copies in this folder are gitignored —
  only the harness source itself is tracked. Rebuild/regenerate rather than expect them present.
- Font weights beyond 400/500/600 (see below) fall back to the browser's own synthetic
  bold/regular approximation rather than a real font file, since those are the only weights this
  repo's own CSS currently uses — checked by grepping every `font-weight` declaration in `src/`,
  not guessed. If a future change introduces a new weight, `npm install
  @fontsource/roboto/<weight>.css` (or add the import to `index.html`) the same way the existing
  three were added.

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
