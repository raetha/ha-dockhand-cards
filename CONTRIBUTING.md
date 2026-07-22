# Contributing

## Development setup

```bash
npm install         # once, after cloning or pulling new dependencies
npm run watch        # rebuilds dist/ha-dockhand-cards.js on every save while iterating
npm run verify        # typecheck + lint + test + build, in that order — run this before every commit
```

`verify` runs exactly what CI runs, so a clean `npm run verify` locally means CI will pass too.
The individual steps (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`) are also
available on their own for faster iteration on just one of them.

There's no separate `scripts/` folder the way ha-dockhand has one — for a Python integration with
no build step, small shell/Python scripts are the natural place for repeatable tasks. Here,
`package.json`'s `"scripts"` block **is** that place; splitting `verify` out into a shell script
would just be an extra layer between you and `npm run verify`.

**Don't bump `typescript` past 6.x right now.** TypeScript 7.0 (a Go-native compiler rewrite,
GA'd July 2026) doesn't ship a stable programmatic API until 7.1 — `typescript-eslint` can't run
against it yet and currently hard-crashes rather than just warning (confirmed via live GitHub
issues, not a hypothetical). TypeScript 6.x itself is fine — verified by actually installing
6.0.3 and re-running `npm run verify` clean, not just checking the version number. The `^6.0.3`
range in `package.json` can't reach 7.x, since a caret range stops below the next major — that's
deliberate, not an oversight. Revisit once `typescript-eslint` adds TS7 support (tracked
upstream, expected around TS 7.1, ~October 2026).

## Before submitting a PR

Run `npm run verify` — see above. Read `docs/QUALITY.md` for the checklist this repo is held to,
and `docs/ARCHITECTURE.md` for how the pieces fit together before touching entity resolution,
editor components, CSS/container-query patterns, or anything about the card-picker preview.

## Testing against a real Home Assistant instance

`npm run watch` keeps `dist/ha-dockhand-cards.js` up to date on save. Point a Lovelace resource
at it directly — e.g. if you're running HA in a container with this repo bind-mounted, add a
resource pointing at wherever `dist/` ends up under `<config>/www/`; if not, copy
`dist/ha-dockhand-cards.js` into `<config>/www/` after each build (or symlink it once, so `watch`
keeps it current without re-copying). Either way, a hard browser refresh picks up each rebuild —
Home Assistant caches Lovelace resources aggressively.

## Regenerating README screenshots

See `tools/screenshot-harness/README.md`. It renders the real built card bundle against
fictional mock data in a headless browser — no real Home Assistant instance involved. Also
where to regenerate `icon-paths.json` after adding a new `mdi:` icon reference anywhere in the
cards, or the new icon renders blank in screenshots.

## Translations

Home Assistant's own translation system only covers backend-declared strings (integrations'
`strings.json`) — it has no channel for a Lovelace card's own UI text, so this repo bundles its
own small per-locale dictionary (`src/common/i18n.ts`), looked up by `hass.language` at render
time. Same locale list as ha-dockhand (de, es, fr, it, nb, nl, pl, pt, sv, zh-Hans),
machine-translated the same way.

Current coverage (v1): editor field labels and section headings — the highest-visibility text
for someone configuring a card in their own language. Live-card-rendered labels (e.g. "Images",
"CPU", "Events") and the longer mode-description hint paragraphs are still English-only; see
`docs/BACKLOG.md` for the reasoning and what's left.

Adding a new editor string should add it to every locale in the same pass, matching ha-dockhand's
own discipline — no partially-translated locale files.

## CHANGELOG discipline

Same discipline as ha-dockhand's own `CHANGELOG.md` — see the maintainer note at the top of that
file. Short version: entries describe net user-facing functionality, not the development
journey; a bug introduced and fixed within the same still-unreleased cycle doesn't get its own
entry, since there's nothing to disclose about something that never shipped broken.

## Releasing

Same flow as ha-dockhand: bump `package.json`'s `version`, update `CHANGELOG.md`'s `[Unreleased]`
section into a dated one, commit, then push a `vX.Y.Z` tag. The release workflow verifies the tag
matches `package.json`, runs `npm run verify`, and creates a GitHub release with
`dist/ha-dockhand-cards.js` attached as a release asset and the matching CHANGELOG section as the
release notes — `dist/` itself is gitignored and never committed, same as
`custom-cards/boilerplate-card` and most maintained HA cards (confirmed this is how HACS actually
resolves a plugin's file when it's not in the repo tree: it looks for a release asset matching
`hacs.json`'s `filename` first, falling back to the repo tree only if no matching asset exists).
`hacs.json`'s `filename` points HACS at that release asset.
