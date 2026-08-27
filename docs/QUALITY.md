# Quality checklist

Home Assistant's [integration quality scale](https://www.home-assistant.io/docs/quality_scale/)
has no equivalent for Lovelace cards or HACS "Plugin" repos — confirmed against HACS's own docs
(hacs.xyz) and the HA developer docs for custom cards. What HACS itself actually validates for a
plugin repository (via the `hacs/action` GitHub Action, and separately for inclusion in the
default store) is narrower:

- `hacs.json` exists and contains at least `name`
- Repository is public, not archived, and has at least one GitHub **release** (not just a tag)
- Has a description and topics set on GitHub (used for search, not shown in HACS)
- Has a README
- *(Default-store inclusion only, not needed for a custom repository)*: submitter is the owner or
  a major contributor; README contains images

That's the actual bar. Everything below this line is a self-imposed checklist built from that
baseline plus the community reference implementation (`custom-cards/boilerplate-card`) and general
Lovelace card best practices — not an official standard, but a concrete target for what "as high
quality as possible" means for this repo. Check it before every release.

## Repository / HACS

- [x] `hacs.json` with `name` and `filename` (no `content_in_root` override — matches
      `custom-cards/boilerplate-card` exactly, since the bundle isn't in the repo tree at all,
      only ever delivered as a release asset; see the "Releasing" note in the README for how
      that's confirmed to be how HACS actually resolves it)
- [x] Public GitHub repo, MIT `LICENSE`
- [x] README with install instructions, a config reference, and screenshots for every card (via
      `tools/screenshot-harness/` — real rendered output against fictional mock data, not a live
      instance)
- [ ] GitHub repo description + topics set (`home-assistant`, `hacs`, `lovelace`,
      `home-assistant-card`, `dockhand`) — set on GitHub itself, not in this repo
- [x] Tagged GitHub releases with the bundle attached as a release asset (not committed to `main`)
- [x] A `my.home-assistant.io` "Add to HACS" badge in the README

## Code quality

- [x] TypeScript, `strict: true`, `noUnusedLocals`/`noUnusedParameters`
- [x] ESLint clean (`npm run lint`)
- [x] `npm run verify` (typecheck + lint + test + build) passes locally before every commit, and
      CI runs the identical script on every push/PR
- [x] Unit tests for all pure logic — entity resolution, device matching, formatting
      (`src/common/*.ts`), and card-specific pure logic where it exists (e.g. Overview's config
      migration functions in `dockhand-overview-card/types.test.ts`). Not attempting full
      component render tests yet (LitElement + jsdom is workable but lower value than the
      resolver/logic tests — see below)
- [x] No hardcoded API calls or credentials — reads only `hass.states`/`hass.entities`/
      `hass.devices`, same trust boundary as any other Lovelace card
- [x] No `localStorage`/`sessionStorage` usage
- [x] Editors built on HA's own `<ha-form>` schema system for their core fields (three —
      Schedules, Updates, Overview — also interleave a shared hand-built sortable
      environment-order/exclude section `<ha-form>` has no model for; see
      `docs/ARCHITECTURE.md` §2), verified against present-day
      HA source rather than assumed from older examples — see `docs/ARCHITECTURE.md` §2 and §7 for
      what that verification actually found, including a case where it caught an earlier pass
      wrongly concluding a component was deprecated when its API had just changed

## Card behavior

- [x] `setConfig` throws a clear error for missing required config
- [x] `getStubConfig` pre-fills a working default so "Add Card" isn't a blank slate
- [x] `getCardSize` and `getGridOptions` implemented (masonry layout, and the newer "sections"
      dashboard view's resizable grid respectively)
- [x] Visual editor — no YAML required for basic use
- [x] `getEntitySuggestion` (HA 2026.6+ entity-first card picker)
- [x] Every displayed value that maps to a real entity opens that entity's more-info dialog on
      click/Enter/Space
- [x] Icons pulled from the entity (`<ha-state-icon>`) rather than hardcoded, wherever a 1:1
      entity exists, so a user's icon customization is reflected automatically
- [x] Graceful degradation: disabled/missing entities never throw or render a broken layout —
      either the specific value shows a neutral placeholder, or (for whole sections with no
      backing data, like detailed mode's top-containers/recent-events) the section is omitted
      entirely rather than shown empty. The one exception — a card with genuinely nothing else to
      show (device not found, core sensor missing) — always pairs its message with a warning icon
      (`.core-message` in shared-styles.ts) rather than showing unstyled text
- [x] Respects HA theme variables — no hardcoded light/dark assumptions in `ha-card` chrome
- [x] Theme-overridable status/severity colors via documented CSS custom properties, and a stable
      class-name structure for card_mod — see `docs/STYLING.md`
- [ ] Keyboard navigation manually tested in a real browser (implemented via `tabindex`/`role`/
      `@keydown`, not yet verified against a screen reader)
- [ ] Tested against both light and dark default HA themes on a live instance
- [ ] Tested at narrow (mobile) card widths

## Known gaps (tracked, not blocking)

See `BACKLOG.md` in this same folder for what's not done yet, `ARCHITECTURE.md` for how this
repo's pieces fit together and why.
