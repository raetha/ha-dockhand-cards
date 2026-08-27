# Editor design rules

A concrete checklist for card editor layout and behavior. Everything below is real, working code,
applied consistently across all eight cards (Vulnerability, Stack, Container, Environment, Stacks,
Containers, Updates, Schedules) except where a rule says otherwise. Overview itself is a structural
exception — see rule 8.

## 0. HA's own guidance takes precedence over everything below

Two real sources, checked directly rather than assumed:

- [Custom card docs](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/) —
  the `getConfigForm()` schema API, including the native `expandable`/`grid` schema types (rules 2
  and 6).
- [*Dashboard chapter 2*](https://www.home-assistant.io/blog/2024/07/26/dashboard-chapter-2/)
  (2024) — HA's own stated philosophy: *"include only the necessary options in the visual editor,
  while also hid[ing] away the less used options... in an accordion UI to avoid clutter."* No
  dedicated sequel found covering editor structure specifically, checked more than once this
  session — still the most direct statement available.

When something is genuinely unclear or a claim needs checking, **clone the actual HA frontend repo**
(`git clone --depth 1 --filter=blob:none --sparse` + `git sparse-checkout set <dir>`) rather than
search or guess — this is what actually resolved several wrong assumptions this file used to make,
more than once. Every rule below marked "confirmed against source" was checked this way, not
inferred, and every correction below exists because an earlier version of this same rule turned
out to be wrong on inspection — that's not a failure mode to hide, it's the actual track record of
why checking beats assuming.

## 1. Field order follows the card's own visual order, top to bottom

Within root (rule 2): the Environments section (rule 4) first where it applies, then whatever
organizational toggles the card has (`include_global`, `group_by`, `sort_by`) — decisions worth
making the moment the card's added, not left buried. Within Content: Name first (it's the card's
own header, the first thing rendered), then whatever else the card has, ending with per-row detail
toggles (rule 5), since those affect the last thing the card renders.

## 2. Root vs. Content: what a card "is" vs. how it displays

Confirmed directly against HA's own Tile/Area/Heading card editors: a card's root holds only the
field(s) answering "what is this card even of" — for Tile, just `entity`; for this repo's cards,
the device picker, or the Environments section (rule 4) for a card that can span several
environments. Everything else — Name, links, display toggles — lives in one collapsible `type:
'expandable'` "Content" section, collapsed by default. Icon is `mdi:text-short`, matching HA's own
`mdiTextShort` used for Tile/Area/Heading's own Content section exactly (confirmed against source
— an earlier version of this rule used `mdi:eye-outline`, picked before checking what HA's own
cards actually use there).

**One real exception, worth remembering exactly:** a field with a `.warning` attached (ha-form's
own per-field `<ha-alert>` mechanism) must stay in the *outer* `<ha-form>`, not inside Content.
Confirmed against source: `ha-form-expandable.ts` does not forward the `warning` prop to its
nested `<ha-form>` at all — only `hass`/`data`/`schema`/`disabled`/`computeLabel`/`computeHelper`/
`localizeValue` are. The Environment card's own `mode` field is the current example (its warning
lists which entities a given mode needs) — it stays at root specifically because of this, not
because "what mode to use" is conceptually root-level content.

## 3. The Name field: borrowed whole from HA, not reinvented

Every card's `title` field is now `name`, using `selector: { entity_name: {} }` — a real, native
ha-form selector (confirmed against `src/data/selector.ts`/`ha-form-expandable.ts`), the same one
Tile/Area/Heading's own Name field uses (confirmed directly against their editors' own source —
it's part of their own Content section, matching rule 2's placement here exactly, not a root
field). This gives Composed (Area/Device/Entity/Floor, combined and reordered) and Custom (plain
text) modes for free — HA's own already-loaded `<ha-form>`/`<ha-selector>` renders the whole picker
at runtime; nothing here is a component this repo owns or maintains. See `common/card-name.ts`:
`cardNameFieldSchema(entityId, defaultName)` builds the schema entry, `resolveCardName(hass,
entityId, name, fallback)` resolves it at render time via `hass.formatEntityName()` — also real,
also HA's own.

Two things this repo supplies, both required:

- **`entityId`** — a real entity to resolve Composed values against (HA's own picker needs one;
  it can't compose Area/Device/Floor from a bare device id). See `getRepresentativeEntityId()` in
  `device-utils.ts` — picks any one entity on the relevant device, since Area/Device/Floor are
  identical for every entity on it. Single-device cards use that device's own id; the
  multi-environment cards use the first included environment's.
- **`fallback`/`defaultName`** — what the card shows/previews when nothing's configured. This must
  match what the card showed *before* this field existed, not a new default: single-device cards
  pass `device.name_by_user || device.name || '<CardType>'` as the render-side fallback and
  `[{ type: 'device' }]` as the picker's own `default_name` preview. The multi-environment cards —
  which have no single device to name themselves after — use a plain string (`'Schedules'`,
  `'Updates'`) for both, not a composed value. `resolveCardName` only ever touches
  `entityId`/`formatEntityName` when `name` is actually set; an unset field returns `fallback`
  directly, so this distinction is safe by construction, not something that has to be remembered
  at every call site.

**The Composed picker's "Entity" option can't be excluded, for any card.** Checked directly
against `ha-entity-name-picker.ts`, not assumed: which types it offers (`entity`/`device`/`area`/
`floor`) are module-level constants, with `entity` added unconditionally and no
`@property`/selector option anywhere to restrict the set — real for every card using this
selector, not specific to this repo's own usage. Genuinely confusing for the cards where
`entityId` is only ever an arbitrary proxy (everything except Container/Stack, which point at a
real, meaningful entity) — picking "Entity" there composes off whatever representative entity
happened to be chosen, not something a person configuring the card would recognize as meaningful.
Not worked around: hand-building a restricted replacement would undo the entire reason this field
uses HA's own selector in the first place (nothing here to bundle or maintain) for a minor
usability nit on one option out of four, not a broken picker.

Neither is called "entity" anything in this repo's own naming — `card-name.ts`, not
`entity-name.ts`; `cardNameFieldSchema`, not `nameFieldSchema`. None of this repo's cards are
actually "about" one entity the way Tile is; the entity involved is only ever a proxy HA's own API
happens to need. `EntityNameItem`/`EntityNameOptions` (in `ha-types.ts`) keep "Entity" in their
name regardless — they're direct re-declarations of HA's own wire type, not something safe to
rename and stay compatible.

## 4. Environment selection: always shown, always wrapped, currently non-collapsible

Any card whose "what is this of" answer is a set of environments — not a single device — uses
`renderEnvironmentOrderSection()` (`common/environment-scope.ts`), rendered at root inside a real
`<ha-expansion-panel>`: leading icon (`mdi:web`, Dockhand's own actual default, confirmed against
Dockhand source) and heading (`label_environments`, reused, not a new key) via the native
`slot="leading-icon"`/`slot="header"` convention, `expanded` and the native `no-collapse` attribute
(confirmed real against HA frontend source) both set. This is a maintainer decision, not settled
architecture — an earlier version of this function rendered a bare, unwrapped heading instead
(reasoning that nothing needed collapsing at all), reverted after actually seeing it rendered: the
wrapped version looked better in practice, even permanently open. `no-collapse` is explicitly "for
now" — revisit if collapsing turns out to be wanted after all, at which point removing the
attribute is the entire change needed, nothing else about this rule depends on it.

The section itself: always shown (not conditional on another field), always fully interactive —
drag to reorder, eye icon to include/exclude, a "solo" action, Show all/Clear. The drag handle
specifically disables itself (visibly greyed, via a `.disabled` class — not hidden outright) on any
card that has a `group_by` choice and isn't currently set to `environment`, since drag order has no
effect on anything until it is; a card with no `group_by` concept at all (Updates, which always
groups by environment structurally) never disables it. No `scope` field on any card using this —
see the README's own per-card sections for the full reasoning if a card considering one is tempted
to reintroduce it.

There is no native ha-form equivalent for the drag-list content itself — checked directly, not
assumed: `type: 'constant'` is real but renders a "label: value" pair with no icon slot, built for
a different purpose, and still requires living inside an `<ha-form>`, which this hand-built
drag-list content can't (drag-reorder and per-row icon actions aren't expressible as schema fields
at all). That's the one genuinely unavoidable hand-built piece here, independent of whether the
wrapping panel is native or not.

## 5. Multiple optional per-row details: one `multi_select`, not several booleans

When a card has more than one independently-toggleable piece of per-row display (Stacks/
Containers' badges; Schedules' next-run time and environment name), they're checkboxes under one
`type: 'multi_select'` field (`visible_badges_label` → "Row details"), not separate standalone
boolean fields. Reconsidered mid-session on Schedules specifically: an earlier pass removed
"next run" outright reasoning nothing else in the row needed a toggle to replace it — wrong, once
it was clear the environment badge was a second toggleable detail already there. One boolean is
fine standalone; two or more is what this pattern exists for.

## 6. `<ha-form>` schemas are the standard; hand-built UI is the deliberate exception

See ARCHITECTURE.md §2 for the full technical reasoning. The goal for every *standard* card
(anything that isn't Overview — rule 8) is that its editor is expressible as root fields (rule 2)
plus, where rule 4 applies, the shared Environments section — nothing else hand-built. Rule 4's own
drag-list is the one recurring exception, for a documented, checked reason (no schema field covers
drag-reorder); a new hand-built pattern should get the same level of justification before being
added, not be assumed fine because a precedent already exists somewhere.

`type: 'grid'` (also real, also confirmed against source —
`grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`, same mechanism Tile uses for "Show
entity picture"/"Hide state") arranges narrow fields — boolean toggles, mainly — side by side
instead of each taking a full row, when a card has two or more that make sense next to each other.
Same `warning`-forwarding constraint as `expandable` (rule 2's own exception) applies here too.

## 7. Editors never link to entities or live data

An editor is a configuration surface, not a dashboard view — even where a *rendered* card links a
heading to an entity's more-info dialog, its editor never does. Clicking something mid-configuration
to pop a live-data dialog doesn't match how HA's own core editors behave, and isn't what someone
configuring a card is trying to do at that moment.

## 8. Overview is the one real structural exception

Overview composes *other* cards' own editors for its global-defaults and per-environment-override
views (ARCHITECTURE.md §3) rather than being a card with its own independent fields — most rules
above don't map onto it cleanly, and that's structural, not an oversight:

- Its own "Sections" list (which section *types* show, in what order) is a genuinely different
  kind of list — section types, not environment devices — and stays separate and hand-built, not
  the same duplication rule 4 exists to avoid.
- No Content section of its own — per-card chrome is exposed *through* each embedded card's own
  editor instead (which is exactly why rules 1–6 landing on those cards flows through to Overview
  automatically, with no Overview-specific work needed — confirmed by tracing an actual regression
  this caused: `card.ts`'s own generation code still built `title: override.x.title` for every
  embedded type after the fields renamed to `name`, since that code was never schema-driven and had
  no way to pick up the rename on its own. Fixed, but worth remembering: the *editor* half of this
  pattern updates for free, the *generation* half in `card.ts` does not, and needs checking by hand
  whenever an embedded card's own field names change).
- Rule 4 is the one rule that *does* apply in the standard way — its own "Environments" list now
  reuses `renderEnvironmentOrderSection()` directly, not a second hand-built copy of the same row
  rendering. The one thing Overview's usage needs that no other card does — a pencil button opening
  its own per-environment override view — is an optional `onEdit` callback on the shared function
  itself, exactly the same way `onSolo`/`onSelectAll`/`onClearAll` are optional: unifying the
  duplication meant extending the shared piece, not special-casing Overview around it.
- Its two remaining hand-built sections ("Sections," and the per-environment-override detail
  wrapper) use `<h3 slot="header">` rather than the plain `<div>` HA's own native `expandable`
  type renders — confirmed correct, not a leftover inconsistency: Tile/Area/Heading's own
  hand-built Features panels (the one section on each of those cards that, like Overview's,
  genuinely can't be schema-driven) all use `<h3>` too, checked directly against all three.

## 9. Hint/description text: say only what a tooltip can't, and say it the same way everywhere

Every row-level action (drag, eye, target/solo, pencil) already carries its own `label` — a real
hover tooltip, not something a section-level hint needs to repeat. A hint restating "the eye icon
hides an environment" is telling the person something their own cursor is about to tell them
anyway, in more words, from a source they have to read separately. The Environments and Sections
lists' own hint text used to do exactly this, and — written at different times, describing
different specific icons — ended up sounding like two different people wrote them, which is its
own separate problem from the redundancy.

The fix applied here, worth repeating for any future hint text:

- **State the section's job, not its buttons.** What can't a tooltip tell someone who hasn't
  started interacting yet: that dragging reorders, and that hiding something doesn't delete it.
  Anything a specific icon's own tooltip already covers doesn't need restating.
- **One sentence, plain, imperative where it's an instruction.** "Drag to reorder." Not "You can
  drag items to change their order."
- **Same wording for the same shape of thing, not one description per card.** Environments and
  Sections are structurally the same list (reorder + show/hide + optional per-row settings) —
  `order_list_hint` is now the one hint text every one of them uses, Overview's own
  Environments list included, rather than a separate key existing only because Overview happens to
  have one more row action than everyone else. A hint key that exists solely to describe one
  card's own icon set is the signal to fold it back into the shared one and drop the icon-specific
  detail, not to keep drifting further from it.
- **Don't add one by default.** A control whose purpose is genuinely clear from its own tooltip and
  the section heading it sits under doesn't need a hint at all — most of this repo's controls
  don't have one. Add a hint when there's something real to say that nothing else already says
  (drag, or a genuine requirement/caveat like a minimum ha-dockhand version or a sensor that has to
  be enabled), not as a reflex every new section gets one.

This applies to any descriptive text attached to a control, not only the two `hint` divs this rule
was written against — row-level `title` tooltips (`vulnerabilities_hint`, `updates_hint`,
`schedules_overview_hint` on Overview's own Sections rows) are a legitimately different category
and were left alone: each states a real, specific requirement or caveat a tooltip on a generic eye/
pencil icon has no way to convey, not a restatement of what a button does.
