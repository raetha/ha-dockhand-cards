# Screenshot harness

Renders the real, built cards (`dist/`) in a headless browser against made-up data and saves the screenshots in `docs/images/`, checks accessibility, and gives the DOM tests their mock Home Assistant (`harnessHass()` in `src/common/mount.test-helpers.ts`). Nothing here talks to a real Home Assistant.

## Setup (one-time)

```bash
cd scripts/screenshot-harness
npm install                        # @mdi/js, @fontsource/roboto, axe-core
pip install playwright pillow
python3 -m playwright install chromium
```

## Screenshots

```bash
# from the repo root
npm run build
cp dist/*.js scripts/screenshot-harness/
cd scripts/screenshot-harness
python3 -m http.server 8931 &
python3 screenshot.py              # dark theme
python3 screenshot.py --light      # the -light.png variants
```

Screenshots land in `out/`; copy the ones that changed into `docs/images/`. Every screenshot comes in both themes, and the docs show the one matching the reader's theme. `CARDS` in `screenshot.py` lists them as `(tag, config, file, width, height)`, optionally with `{"backdrop": True}` to render on Home Assistant's dashboard background (the Overview card, whose column titles sit outside any card).

The same run renders the Dockhand dashboard (`DASHBOARDS`): `window.__mountDashboard` asks the real strategies for a page and lays out their cards in a stand-in for Home Assistant's sections view, plus the dashboard's settings editor with its panels opened (`window.__mountDashboardEditor`). The cards are real; the page around them only approximates Home Assistant's.

`python3 screenshot-editors.py` does the same for editors (`window.__mountEditor`, through each card's `getConfigElement()`), to look at an editor's layout after changing it.

## Accessibility check

```bash
python3 a11y.py              # report violations, exit 1 if any
python3 a11y.py --verbose    # also list every affected element
```

Runs [axe-core](https://github.com/dequelabs/axe-core)'s WCAG 2.1 A/AA rules over every card in `CARDS`, a few more states, and every editor, in both themes, on Home Assistant's dashboard background. Elements drawn by `ha-shims.mjs` are skipped, and so is text in Home Assistant's own theme colors, which the cards use unchanged. It checks names, roles, nesting and contrast, not whether a card makes sense read aloud.

It also reports `clipped-by-corner`: content cut off by an element's rounded corners. Every element that clips its content (`overflow` other than `visible`) and has rounded corners is screenshotted with its corners rounded and square, its own background, border and shadow hidden both times, and any pixel that differs is content the corners cut off. That's how a clickable name lost the tail of its first "p"; it takes a zoomed-in look to see otherwise. Needs Pillow (`pip install pillow`).

## How it works

- **`mock-data.mjs`** builds `hass.devices`, `hass.entities` and `hass.states` as ha-dockhand 2.0 makes them: four environments (Nebula, Aurora, Orion offline, Vega), each with the same stacks and containers, plus schedules. Device identifiers, `translation_key`s, states and attributes follow ha-dockhand's own (`docs/development.md` → "Test data looks like Home Assistant's"); counts are worked out from the containers and stacks listed, so they can't disagree. Every name and value is made up.
- **`ha-shims.mjs`** stands in for the Home Assistant elements the cards and editors use (`ha-icon`, `ha-state-icon`, `ha-card`, `ha-switch`, `ha-form` and a few more), enough to render them, not to match Home Assistant's styling exactly. Icons are real MDI paths: `icon-paths.json` holds the ones used, and `ha-state-icon` resolves an entity's icon from ha-dockhand's icon translations (`entity-icons.json`), as Home Assistant does. The shims change their DOM in a microtask, since changing it during Lit's own render throws inside Lit.
- **`index.html`** loads the built bundle, Roboto (another font's metrics would shift text in the screenshots) and Home Assistant's theme variables for both themes (`?theme=light`), and mounts cards, editors and dashboard pages on request.

## After adding an icon

```bash
node extract-icons.mjs [path/to/ha-dockhand/custom_components/dockhand/icons.json]
```

Regenerates `icon-paths.json` from every `mdi:` icon in `src/`, this harness and ha-dockhand's icons, and refreshes `entity-icons.json` from ha-dockhand's `icons.json` (a checkout next to this repo by default). Run it after adding an icon to the cards or when ha-dockhand's icons change; an icon missing from `@mdi/js` is reported.

## Performance

```bash
python3 bench.py [--copies N] [--others N] [--updates N]
```

With the harness served as for screenshots: copies every container and stack `--copies` times (default 10), adds `--others` unrelated entities (default 5000) as a real Home Assistant has, mounts each card in `CARDS`, and prints its first render and its update on a new `hass` in which one entity elsewhere changed, in milliseconds. Home Assistant sends one of those whenever any state changes, so the update is the number to keep small.

## Limitations

- The CPU and memory sparklines draw a generated wave (`hass.callApi` is stubbed).
- `out/` and the copied bundles are git-ignored: rebuild and regenerate rather than expect them.
