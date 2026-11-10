# Contributing

Thanks for helping with Dockhand Cards. Bug reports, ideas and translation fixes are all welcome.

- **Issues:** use the issue templates. For a card problem, include your ha-dockhand and Dockhand
  versions; check whether the integration itself shows the same thing, since the cards only read
  what it provides.
- **Pull requests:** open them against the `dev` branch, not `main` (`main` only receives
  releases). Run `npm run verify` first, and add a line under `## [Unreleased]` in `CHANGELOG.md`
  describing the change for people installing the cards.
- **Translations** are machine-generated; corrections from native speakers are especially
  welcome. English is in `src/common/i18n-card.ts` and `src/common/i18n-editor.ts`; every other
  language is in its own `src/i18n/<language>.ts`.

Setup, the everyday loop, the translation and accessibility rules, and how releases work are in
[docs/development.md](docs/development.md). How the cards work is in
[docs/architecture.md](docs/architecture.md), and ideas already considered are in
[docs/backlog.md](docs/backlog.md).
