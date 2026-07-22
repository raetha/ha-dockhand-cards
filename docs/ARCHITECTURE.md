# Architecture reference

Read the relevant section before touching the area it covers. Same role as ha-dockhand's own
`docs/ARCHITECTURE.md` — a topical reference, not a history of what changed and when
(`CHANGELOG.md` and git history cover that).

## 1. Entity resolution — two strategies, not one

Almost every entity this repo reads is resolved via **`translation_key`**, scoped to a device
(`resolveEnvironmentEntities`/`resolveContainerEntities`/`resolveStackEntities` in
`entity-resolver.ts`) — never by parsing `unique_id`, which is an implementation detail of
ha-dockhand's, not a stable contract for this repo to depend on. `translation_key` *is* that
contract (see ha-dockhand's own `ARCHITECTURE.md` §1 — renaming one there is a breaking change
for this repo, by design on both sides).

A small set of ha-dockhand entities have **no `translation_key` at all, by design** — anything
`has_entity_name=True` where the entity name equals the device name (the container/stack running
switch, the container `update` entity, the git stack deploy button). For these, `domain +
device_id` is the safe lookup key instead: `findPrimaryEntityByDomain()` in `entity-resolver.ts`.
Don't reach for this for anything that *does* have a `translation_key` — domain-based lookup only
works because ha-dockhand guarantees exactly one entity of that domain per device for this
specific small set; it's not a general-purpose fallback.

## 2. Editor components — current HA form components, verified against source

Editors use `ha-select`, `ha-input`, `ha-switch`+`ha-formfield`, `ha-expansion-panel` — genuinely
current, HA-maintained components, not native HTML substitutes. This wasn't the original choice:
an earlier pass found `ha-select` apparently broken (raw value shown instead of a label, clicks
did nothing) and wrongly concluded it was deprecated, switching everything to native HTML.

The actual cause, found by cloning `home-assistant/frontend` and reading
`src/components/ha-select.ts` directly rather than assuming: `ha-select`'s API was rewritten as
part of HA's move off Material Web Components. It no longer accepts slotted children at all —
it now takes an `.options` array (`{value, label}`) and fires a `selected` event with
`event.detail.value`. The old `<mwc-list-item>`-child pattern silently fell into a dead
slot-fallback path. `ha-textfield` really was removed (replaced by `ha-input`); `ha-switch`,
`ha-formfield`, and `ha-expansion-panel` were checked the same way and were never actually
broken.

**The general principle:** when an HA-internal component misbehaves, check whether its *contract*
changed (read the actual current source — it's public and fast to clone) before assuming it's
deprecated and reaching for a native-HTML workaround. The workaround is safe but gives up
visual/behavioral consistency with HA's own UI for no reason if the component was simply updated.

`getConfigForm()` (a static schema + selectors, no separate editor element — what HA's own
automation editor uses) was evaluated as an alternative to hand-written editor elements and not
adopted: its `computeLabel`/`computeHelper` callbacks only ever see the static schema, never live
`hass`/config data, so it can't drive the environment→stack/container cascading pickers or the
per-instance "would show more with X enabled" hints these editors need. Worth re-checking if a
future HA release makes `getConfigForm` schemas data-dependent.

## 3. CSS — container queries and shadow DOM

Full mode's two-column layout uses a CSS container query so it responds to the *card's own*
rendered width, not the viewport or dashboard section — correct even when the card ends up
nested somewhere narrower than its configured width (e.g. inside the Overview card's columns).

Two non-obvious things to know before touching this pattern elsewhere:

- **An element cannot query the container-query context it establishes on itself** — only its
  descendants can. `container-type: inline-size` and the `@container` rule responding to it need
  to be on two different elements (context on a wrapper, query on a child). Getting this wrong
  doesn't error — the query just silently never matches, at any width.
- **A CSS custom property only reaches where the selector setting it actually resolves to
  something.** A tag selector like `.status-icons ha-icon` matches a literal `<ha-icon>` — it
  does not match `<ha-state-icon>`, which renders its own `<ha-icon>` inside its own shadow root.
  Set the custom property on a wrapping element instead (it cascades through shadow boundaries
  fine); the failure mode is the selector never matching anything, not a shadow-DOM limitation.

## 4. The HA card-picker preview has no card-side hook

`LovelaceCard.preview` does not mean "this is a small picker thumbnail" — it means "the dashboard
is currently in edit mode," set by `hui-view.ts`/`hui-masonry-view.ts`/etc. as `element.preview =
this.lovelace.editMode`, applied to *every* card on the view. The add-card picker
(`hui-card-picker.ts`) never sets it at all — confirmed by reading `_renderCardElement()`
directly. The picker also has no built-in preview size cap of its own (no `max-height`, no
per-card scroll); a card's grid cell just grows to whatever it naturally renders.

The only thing that actually feeds the picker's preview is `getStubConfig()`'s return value —
there's no other card-side property or CSS hook for "render smaller/differently because this is
a preview." The Overview card's environments-only default exists because of this: not a picker
hack, a real default-behavior change, since there was no way to special-case the picker itself.

**A `preview`-based approach to `hide_when_no_updates` was tried first, then replaced by HA's own
native card `visibility:` config — a materially better mechanism, not just a different one.**
`getGridOptions()`/`getCardSize()` were used initially to hide the card (returning the smallest
valid grid footprint, `columns: 1, rows: 1`, since CSS Grid's `span` can't represent zero — see
`docs/BACKLOG.md`'s now-superseded entry on this), with `this._preview` (a plain `set
preview(value: boolean)`, since `custom-card-helpers`' own `LovelaceCard` type doesn't declare it
despite HA genuinely setting it) used to keep the card visible while editing the dashboard.

That approach is gone now, replaced by HA's own `visibility:` card config — a real, first-class
dashboard feature (the same one available in every card's own editor, not something invented
here), implemented in `hui-card.ts`. Confirmed directly in HA frontend source that this is a
strictly better mechanism for a *standalone* card: `hui-card.ts` applies genuine `display: none`
to the card's own wrapper element when a `visibility:` condition isn't met
(`this.style.setProperty("display", visible ? "" : "none")`), which correctly removes it from
*any* layout algorithm — unlike `getGridOptions()`'s `span`-based approach, this isn't limited by
CSS Grid's requirement that a span be a positive integer. It also already handles the
dashboard-edit-mode case natively (`if (this.preview) { this._setElementVisibility(true); ...
}`), so the card no longer needs its own `preview` property at all for this. The Updates card's
editor now builds and saves a `visibility:` condition automatically whenever
`hide_when_no_updates` is toggled on (one `numeric_state` condition per relevant environment's
`sensor.*_containers` `pending_updates` attribute — see `common/updates-visibility.ts` — OR'd
together when there's more than one), and removes `visibility:` from the saved config entirely
when toggled off, rather than leaving a stale condition behind.

**This still doesn't reach nested cards, though — confirmed the same underlying reason `.preview`
didn't.** `hui-card.ts` (and therefore `visibility:` support) only wraps cards HA itself directly
places on a dashboard or in a section. The Overview card generates a `dockhand-updates-card` per
environment internally, as raw custom element tags inside its own shadow DOM — those nested
instances are never wrapped by `hui-card.ts`, so a `visibility:` condition in their config would
have no effect at all. For this nested case, the Overview card does its own live check instead
(`hasPendingUpdates()` in `common/updates-visibility.ts`) and simply omits the
`<dockhand-updates-card>` element from its own template entirely when there's nothing pending —
true zero-space collapse, and a simpler win than the standalone card's own history here, since
this is a plain flex column the Overview card already controls, not HA's sections grid, so
there's no CSS span-validity issue to work around in the first place. Worth remembering for any
future card that nests another one this way: neither `.preview` nor `visibility:` reach a nested
card, but a parent card can always make its own inclusion of a nested element conditional instead.
