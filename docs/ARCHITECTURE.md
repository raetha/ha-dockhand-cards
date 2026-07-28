# Architecture reference

Read the relevant section before touching the area it covers. Topical reference to the *current*
design and why it looks the way it does — not a changelog of what was tried and discarded along
the way (`CHANGELOG.md` and git history cover that). If a claim here and the actual code ever
disagree, the code is right and this file needs fixing, not the other way around.

## 1. Entity resolution — two strategies, not one

Almost every entity this repo reads is resolved via **`translation_key`**, scoped to a device
(`resolveEnvironmentEntities`/`resolveContainerEntities`/`resolveStackEntities` in
`entity-resolver.ts`, all thin wrappers around one generic `resolveEntities<K>()`) — never by
parsing `unique_id`, which is an implementation detail of ha-dockhand's, not a stable contract for
this repo to depend on. `translation_key` *is* that contract (see ha-dockhand's own
`ARCHITECTURE.md` §1 — renaming one there is a breaking change for this repo, by design on both
sides).

A small set of ha-dockhand entities have **no `translation_key` at all, by design** — anything
`has_entity_name=True` where the entity name equals the device name (the container/stack running
switch, the container `update` entity, the git stack deploy button). For these, `domain +
device_id` is the safe lookup key instead: `findPrimaryEntityByDomain()` in `entity-resolver.ts`.
Don't reach for this for anything that *does* have a `translation_key` — domain-based lookup only
works because ha-dockhand guarantees exactly one entity of that domain per device for this
specific small set; it's not a general-purpose fallback.

## 2. Editors are built from `<ha-form>` schemas, not hand-rendered fields

Seven of this repo's eight editors (all but Overview) build their config UI as a `schema` array fed
into HA's own `<ha-form>`, rather than hand-rendering individual `ha-select`/`ha-input`/`ha-switch`
elements. Minimal schema types live in `common/ha-form-types.ts`, declared the same way
`ha-types.ts` already declares `HomeAssistant`/`DeviceRegistryEntry` — verified against real HA
source, extended only as new shapes are actually needed. This was checked against HA's own current
reference editors (Tile, Media Player, Weather — not just the simplest example) before committing
to it, not adopted on faith.

**What this buys you:** one `<ha-form>` + one `_valueChanged` handler replaces N hand-written
`@change`/`@input`/`@selected` handlers. Labels/helpers move into `computeLabel`/`computeHelper`
callbacks, still backed by this repo's own `t()` translation system (not HA's `localize()` — these
are our own strings). `type: "multi_select"` renders a set of `ha-checkbox`-backed options natively
from a `Record<string, string>` map, round-tripping as a plain `string[]` — no hand-written
checkbox loop anywhere in this repo. `.warning`/`computeWarning` (a real, currently-shipped
`<ha-form>` feature, confirmed against source) renders a native `<ha-alert alert-type="warning">`
at a specific field, keyed by field name — used by the Container/Stack/Environment card editors to
flag a missing/disabled entity right at the relevant field, instead of a disconnected message
elsewhere in the form.

**What genuinely can't be a schema field, and stays hand-built:**
- **The Updates card's `visibility:` condition derivation** — whenever scope/device_id/
  hide_when_no_updates change, the card's own native HA visibility condition needs rebuilding or
  clearing. A derived side effect across several fields, not a value any one field holds, so it's
  handled in `_valueChanged` after `ha-form` hands back the merged data.
- **Overview's sortable lists and per-environment override navigation** — drag-reordering and the
  override list↔detail navigation (§3) don't map onto `ha-form`'s schema model at all. Same
  reasoning as Badges/Features staying hand-built in HA's own reference editors: some UI shapes
  aren't forms, and forcing them to be one doesn't make the result more standard, just harder to
  read. This is the ceiling for how much of Overview's editor can become `ha-form`-driven, not
  "hasn't gotten there yet."
- **A field that filters another field's options without being saved itself** — the environment
  picker above Container/Stack's device picker was one of these before it was turned into a real,
  persisted `environment_device_id` config field instead (§5). Worth remembering as a pattern: "no
  standard way to do X without saving something" is sometimes better resolved by asking whether
  saving that something is actually fine, not by concluding X must stay hand-built.

**`ha-form`'s `visible: { field, operator, value }` conditional-field-visibility feature is real,
but unreleased as of this writing** — merged into HA frontend's `dev` branch 2026-07-17, not in any
released version including 2026.7.4 (checked directly against
`homeassistant/components/frontend/manifest.json` in HA core, not assumed). Two fields in this repo
need conditional visibility (`custom_sections` on the Environment card, `device_id` on the Updates
card); both achieve it by conditionally including/excluding the schema entry via a plain JS
array-spread instead, needing no unreleased functionality. The type is declared in
`ha-form-types.ts` for when this ships in a release this repo's floor covers — check that before
using it, and don't assume something real on HA's `dev` branch is safe to depend on just because
it's real code in the real repo.

**One behavioral nuance, not a bug:** `custom_sections`'s array order used to be enforced by hand;
`ha-form-multi_select` appends/removes by interaction order instead, so saved YAML may list
sections in whatever order they were checked. Confirmed harmless — `card.ts` only ever checks set
membership on this array, never relies on stored order.

**`select` selector auto-picks a mode based on option count — always set it explicitly.** Every
`selector: { select: { options: [...] } }` in this repo sets `mode: 'dropdown'`. Without it, HA's
own `ha-selector-select.ts` decides:

```ts
private get _mode(): "list" | "dropdown" | "box" {
  return (
    this.selector.select?.mode ||
    ((this.selector.select?.options?.length || 0) < 6 ? "list" : "dropdown")
  );
}
```

Fewer than 6 options silently renders as an expanded `"list"`, not a compact dropdown, with no
warning. This produced a genuinely confusing bug here: Container/Stack pickers (usually 5+ options)
rendered as dropdowns while Environment/Display-mode/Scope pickers (usually under 6) rendered as
lists — an inconsistency nobody chose, just a side effect of how many items each field happened to
have. Don't rely on the option-count default even when it happens to produce what you want today;
it's liable to flip the moment the count crosses 6 in either direction.

**Verify `computeLabel`/`computeHelper` for every schema field, not a sample.** Two real fields
(`custom_sections` on the standalone Environment editor, `environment_custom_sections` on
Overview's environment-settings view) shipped with no case in their `computeLabel` switch, silently
falling through to `default: return schema.name` — the raw field name rendered as the label. This
survived multiple rounds of verification (schema construction, cascading behavior, `hideDevicePicker`,
the `.warning` mechanism, locale switching for *other* fields) because every check exercised a
handful of representative fields, not every one. Found only because a person opened the actual UI.
When verifying via a harness script, loop over `form.schema.map(s => form.computeLabel(s))` for
every field — testing 2–3 "interesting" ones will not catch a silent fallthrough. This applies
especially to `multi_select`: its own per-option labels (via the `options` map) can be correct while
the field-level label is still broken, since `<ha-form>` renders those from two different places in
the schema.

## 3. Reusing a standalone card's own editor component inside another card's editor

Overview's editor reuses the actual `dockhand-environment-card-editor`/`-vulnerability-`/`-stacks-`/
`-containers-card-editor` components directly for two different purposes — the per-environment
override detail view and the global-defaults view (both elaborated in §4) — mounting them as real
child elements and listening to their `config-changed`, rather than hand-duplicating each one's fields. Less code,
and a field added to any of those 4 editors is picked up in both places for free.

Reusing an editor this way needs three things that aren't obvious from the standalone case:

- **`hideDevicePicker`/`hideTitle` opt-in properties**, both `@property({ type: Boolean }) = false`
  so standalone HA usage is unaffected. `hideDevicePicker` suppresses the environment/device
  picker every one of these editors unconditionally renders at the top — redundant once the
  environment is already implied by which detail view is open. `hideTitle` (added later, for the
  global-defaults view specifically) suppresses only the title field, since a single title shared
  across every environment's card doesn't mean anything — unlike `show_settings_link`, which stays
  visible on both reuse contexts, since a link-visibility preference is genuinely something a user
  might want set uniformly per card type. Which fields to hide is a real question worth asking
  per-field, not "hide everything not device-specific." Easy to add to some editors and forget one
  — this happened during development (Environment card's editor was missed for `hideDevicePicker`
  on the first pass) — so when adding a fifth reusable editor, verify the property actually
  suppresses what it should by checking rendered output, not just that it compiles.
- **`setConfig()` is a method, not a settable property.** `LovelaceCardEditor`'s contract is `.hass
  = ...` (a real setter) plus a `.setConfig(config)` *call*. A Lit template can't invoke a method
  as part of a declarative binding, so mounting one of these editors needs an imperative `ref()`
  callback that sets `.hass`, sets `.hideDevicePicker`/`.hideTitle`, then calls `.setConfig(...)` —
  hass first, so the first render already reflects the hide flags rather than briefly showing the
  full form before it changes. `ref()` only fires when the bound element is actually created, not
  on every re-render of an already-mounted one — the per-environment override view wraps its
  subtree in Lit's `keyed()` directive, keyed on device id, so switching which environment is being
  edited forces a fresh mount instead of Lit reusing the existing node with stale data. One
  consequence of only setting `.hass` at mount time: if `hass` updates while the same detail view
  stays open, the embedded editor won't see the new value until the user navigates away and back —
  a known, low-impact limitation (`docs/BACKLOG.md`), since these editors only use `hass` for
  translated label text once the device picker is hidden.
- **`ev.stopPropagation()` as the first line of whatever handles the embedded editor's
  `config-changed`.** Without it, the embedded editor's own raw event (still typed as e.g.
  `custom:dockhand-stacks-card`, with whatever placeholder `device_id` it was mounted with) keeps
  bubbling straight past this component and reaches HA's *own* card-editor dialog outside anything
  this repo controls. That outer dialog listens for `config-changed` bubbling from anywhere inside
  the mounted editor to know what to preview, with no way to tell a nested editor's event from the
  one it thinks it's editing — it mistook a leaked `dockhand-stacks-card` config (empty
  `device_id`) for the real thing, and that card's own `setConfig()` correctly threw ("Please
  select a Dockhand environment.") on the missing id. The per-environment override handlers always
  had this call; the global-defaults handler was originally written without it, and the leak was
  only visible there because that context uses a placeholder empty `device_id` — the same leak was
  arguably already possible on the per-environment side too, just silent, since a live device_id
  never triggers the validation error. **Every handler for an embedded editor's `config-changed`
  needs this line, whether or not skipping it currently produces a visible symptom** — the absence
  of an error isn't evidence the leak isn't happening. Also worth knowing when verifying this kind
  of handler: a bubbling listener attached to the *outer* Overview element can catch both the
  embedded editor's raw event and Overview's own re-fired one (both named `config-changed`,
  both bubble to the same place), capturing whichever arrives second rather than the one that
  matters — reading the editor's own internal `_config` state directly after dispatching sidesteps
  the ambiguity entirely.

**Prefer generic field handling over hand-picking which fields to extract**, on both the
per-environment override side and (see §4) the global-defaults side. An earlier version of the
per-environment handlers hand-picked specific fields out of each embedded editor's emitted config;
when `visible_badges` was added to the Stacks/Containers cards, the handlers for those two sections
were never updated to extract it, so a per-environment override of that field was accepted by the
UI, reflected back in the editor, and silently dropped on save — this class of bug doesn't fail
loudly, and was only caught by a routine "did you check the other cards too" follow-up, not a test.
Fixed by consolidating to one generic `_overrideSectionChanged<K>(deviceId, section)`: strip
`type`/`device_id` from what the embedded editor emits, use everything else as the override value.
Safe without any allowlist here, because the data fed into each embedded editor is already narrowly
scoped to one environment's one-section override sub-object — never the whole Overview config — so
there's no unrelated key that could leak in. The same principle applies at the *type* level:
`EnvironmentOverrideEnvironment`/`Vulnerabilities`/`Stacks`/`Containers` are derived as
`Omit<DockhandXCardConfig, 'type' | 'device_id'>` rather than hand-declared parallel interfaces, so
a field added to one of those 4 cards' configs is automatically valid in an override too, with
nothing here to remember to update. `EnvironmentOverrideUpdates` is the one exception, kept
hand-declared: `DockhandUpdatesCardConfig` has `scope`/`visibility` fields that aren't
override-appropriate, so a plain `Omit` doesn't produce the right shape there.

## 4. Overview card: config field naming and the global-defaults design

Overview generates per-environment `dockhand-environment-card`/`-vulnerability-`/`-stacks-`/
`-containers-`/`-updates-card` instances internally. Three layers of config feed each generated
card, in priority order: a per-environment override (§3, above) → a section-wide global default →
that standalone card's own built-in default. Naming convention: a key about one environment's card
settings is singular (`environment_mode`, `environment_custom_sections`,
`environment_show_settings_link`) — matching the standalone card's own field names, just
section-prefixed; a key about the environments *section*/*list* as a whole is plural
(`show_environments`, `environments_overrides`, `environments_order`) — this distinction matters
for the prefix-scan mechanism described next, and got its own naming bug fixed once real users were
close to zero (see below).

**Global defaults reuse the same 4 real editors §3 already established**, for the same reason —
Environment/Vulnerability/Stacks/Containers' global-defaults views in Overview's editor mount the
real `dockhand-*-card-editor` components (with `hideDevicePicker`/`hideTitle` both set), rather than
building a separate `<ha-form>` schema that would duplicate the standalone editor's own fields.
`updates` is the one section that doesn't do this — its real editor builds a native HA
`visibility:` condition that has no meaning as a shared default, and it's a single field, so
hand-duplicating just that one costs little.

**Mapping between an embedded editor's own field names and Overview's prefixed global keys**
(`mode` vs `environment_mode`, `visible_badges` vs `stacks_visible_badges`) is entirely mechanical:
`${prefix}_${field}`, where the prefix is the section name itself, except `environments` →
`environment` (dropping the trailing s — matching the singular-vs-plural distinction above).
`GLOBAL_SECTION_PREFIX` in `dockhand-overview-card/editor.ts` is the one place that exception lives
— just 4 short strings, not a per-field map. Both directions are now fully generic: reading a
section's current values scans Overview's own config for any key matching that prefix; writing
back applies the same prefix to every field the embedded editor emits, `type`/`device_id`
excluded. A field added to any of these 4 cards' editors needs nothing added here to work in
either direction.

That generic scan is only safe because of one thing: `environments_overrides` (the per-environment
override map) and `environments_order` (environment display order) are the *only* two other
top-level Overview config keys that share a section prefix (`environment_`/`environments_`), and
they're plural, so they don't collide with the singular `environment_`-prefixed global-default
keys. They didn't always avoid this collision — until 1.1.0 they were named `environment_overrides`/
`environment_order` (singular), which *did* collide with the `environments` section's prefix, and
which the global-defaults scan originally had to work around with a small denylist. Both keys were
renamed specifically because the collision (and the pre-existing singular/plural inconsistency —
these are section-wide concepts, not per-card-type settings, so they should have been plural from
the start) was worth fixing while this repo has close to zero real users; doing this once real
adoption exists would need a real migration, not a quick fix. Backward compatibility for existing
saved configs: `card.ts` never migrates anything, it just reads through
`getEnvironmentOverrides()`/`getEnvironmentOrder()` (`dockhand-overview-card/types.ts`), which fall
back to the deprecated singular names — an old-style saved config keeps rendering correctly
indefinitely with no special handling. The *editor*'s `setConfig()` calls `migrateOverviewConfig()`
unconditionally, normalizing to the new keys the instant a config loads, before any of the editor's
own code (including the global-defaults scan) ever runs — any edit at all, even one unrelated to
overrides or order, saves the full config back in the new shape. What this can't do: force a
rewrite of a dashboard nobody ever reopens in the editor — there's no mechanism for a live Lovelace
card to write back to its own stored YAML (confirmed against HA's own Heading card, which handles
an analogous old-config-shape case the same "read forever, never force a save" way). The deprecated
fields, the fallback branches, and `migrateOverviewConfig()` itself are tracked for removal in
`docs/BACKLOG.md` once enough time has passed.

**A card that generates another card's config must not pass explicit `undefined` for a field the
target card defaults via `{ default, ...config }` in its own `setConfig()`.** Object spread copies
a key with value `undefined` just like any other value — `{ show_settings_link: true, ...{
show_settings_link: undefined } }` evaluates to `{ show_settings_link: undefined }`, not `{
show_settings_link: true }`. This bit Overview's per-environment override merging early on:
building a generated card's config with `show_settings_link: override?.environment?.show_settings_link`
unconditionally meant every environment lost its settings-link icon whenever no override was set
for that field, because the key existed with value `undefined`, not because it was absent. Fixed by
only including a key at all when there's a real value to contribute
(`...(override?.x !== undefined ? { x: override.x } : {})`), matching how hand-written YAML would
behave. Applies to any future code that assembles another card's config object programmatically —
check the target's `setConfig()` for a `{ default, ...config }` pattern before assuming a merge is
safe. A field read via `??` at the point of use instead (like the Updates card's `scope`) doesn't
have this problem, since `undefined ?? fallback` correctly falls through.

## 5. Entity-derived config: `environment_device_id` and when persisting scratch state is fine

The Container/Stack card editors' environment picker filters which containers/stacks the actual
device picker offers, but for a while wasn't itself part of the saved config — there seemed to be
no standard way to represent "a field that filters another field's options without being saved."
That held until it was pointed out that a container/stack's environment is always derivable from
its own device identifiers anyway, so persisting the picked environment costs nothing:
`environment_device_id` is a real, optional config field, cascading the container/stack picker's
options the same way HA's own Tile card's entity-dependent schema does. Falls back to
device-identifier-based derivation when loading a config saved before this field existed, *or* when
the persisted value has gone stale (the referenced environment device was since removed from HA —
since the value is read back from saved config rather than recomputed from a live search, it needs
its own explicit existence check against `hass.devices`, unlike the scratch `@state` it replaced,
which could only ever hold a freshly-verified value). Worth remembering generally: "there's no
standard way to do X without saving something" is sometimes better resolved by asking whether
saving that something is actually fine — but persisting something also means it can go stale in
ways scratch state never could, and that needs handling explicitly.

## 6. Settings-link: "hidden because you asked" and "hidden because it's broken" look different

Every card's settings-link renders one of three ways, not two. `show_settings_link` on, and
`getDockhandBaseUrl(configuration_url)` resolves a valid URL → the normal clickable icon.
`show_settings_link` on, but no resolvable URL → a visually distinct, non-interactive icon
(`mdi:link-off`, `.settings-link.unavailable` — an *additive* CSS modifier, so `.settings-link`
alone still matches for existing `card_mod` usage per `docs/STYLING.md`) with a `title` tooltip
explaining what's wrong and where to look. `show_settings_link` off → nothing, same as always. The
icon and tooltip text are shared constants (`SETTINGS_LINK_UNAVAILABLE_ICON`/`_TITLE` in
`common/format.ts`), not six separate copies.

The middle case is real, not hypothetical: a `ha-dockhand` bug (API URL with incidental
leading/trailing whitespace, fixed in that repo — see its own CHANGELOG) produced a
`configuration_url` that both `new URL()` and `window.open()` reject outright in a browser. Before
this three-state design, "toggle on but broken" rendered identically to "toggle off" — indistinguishable,
and the only way to check whether something needed fixing was to remember that "no icon" could mean
two different things. All 6 cards also validate the same way now: 3 of them originally only checked
whether `configuration_url` was present, not whether it actually parsed, which is what let this
particular bug hide as "icon shows, click silently does nothing" instead of surfacing as the same
unavailable state the other 3 cards already showed correctly. When validating that a URL resolves
but still using it as a click target, use the *original* URL, not `getDockhandBaseUrl`'s return
value — that function deliberately returns just the origin, and several cards (Environment,
Container, Stack) need the full path-and-query URL ha-dockhand already built for that specific deep
link, not the bare origin. `base` is for validation only in those cases; the caught mistake was
using it as the navigation target too, which would have silently discarded a working deep link.

## 7. Native HA form-component capabilities — check source, don't assume parity

Checked directly against HA frontend source rather than assumed, since components that look similar
don't necessarily offer the same API:

- `ha-select` has a real `.helper` property (backed by `ha-input-helper-text`, matching HA's own
  helper-text styling automatically) and `ha-input` has an equivalent native `hint` attribute.
  Neither `ha-formfield` nor `ha-switch` has anything like this — no native secondary-description
  slot exists for a switch/toggle row in HA's current component set. Where a hint sits next to a
  single select/input, use the native property; where it sits next to a switch, or is a
  section-level intro line for a group of controls, there's genuinely no native replacement, so the
  hand-styled `.hint` class (`editor-styles.ts`) is correct there, not a gap.
- `ha-expansion-panel` has a native `secondary` property for a description under its header — not
  currently used anywhere in this repo (the 3 panels that exist, all in Overview's editor: Section
  order, Environment order, and each per-environment override's own detail panel, use only the
  primary header slot), worth remembering if one needs a description line later.
- HA's `ha-assist-chip`/`ha-filter-chip`/`ha-input-chip` don't fit a plain static informational
  label like the per-environment override view's "Overrides from default" badge — each implies
  real interactive behavior (a suggestion, a togglable filter, a removable tag) a read-only badge
  shouldn't claim. The hand-built `.detail-badge` span stays hand-built because there's no native
  "static label" component, not because it was easier.
- **`ha-select`'s API was rewritten, not deprecated** — worth remembering as a general debugging
  principle beyond this one component. An early pass found `ha-select` apparently broken (raw value
  shown instead of a label, clicks did nothing) and wrongly concluded it was deprecated, switching
  to native HTML. The actual cause, found by cloning `home-assistant/frontend` and reading
  `ha-select.ts` directly: its API was rewritten as part of HA's move off Material Web Components —
  it no longer accepts slotted children, takes an `.options` array (`{value, label}`) instead, and
  fires `selected` with `event.detail.value`. The old `<mwc-list-item>`-child pattern silently fell
  into a dead slot-fallback path. When an HA-internal component misbehaves, check whether its
  *contract* changed (the source is public and fast to clone) before assuming deprecation and
  reaching for a native-HTML workaround — the workaround is safe but gives up visual/behavioral
  consistency with HA's own UI for no reason if the component was simply updated.
- **`getConfigForm()`** (a static schema + selectors, no separate editor element — what HA's own
  automation editor uses) was evaluated as an alternative to hand-written editor elements and not
  adopted: its `computeLabel`/`computeHelper` callbacks only ever see the static schema, never live
  `hass`/config data, so it can't drive the environment→stack/container cascading pickers or the
  per-instance ".warning" hints these editors need. Worth re-checking if a future HA release makes
  `getConfigForm` schemas data-dependent.

**HA has a real font-size design-token system.** `--ha-font-size-xs/-s/-m/-l/...` are real, current
HA CSS custom properties (`src/resources/theme/typography.globals.ts`), not component-specific.
`--ha-font-size-m` (14px baseline) is HA's own body-text default. This matters beyond visual
consistency: `html { font-size: 14px; --ha-font-size-scale: 1; }` sets the document root to a
*fixed* 14px, but each token is `calc(<base> * var(--ha-font-size-scale))` — a user's HA
accessibility text-size setting changes `--ha-font-size-scale`, and only text sized via the actual
tokens tracks that; a hand-picked `em` value computed off the fixed root doesn't. `.hint`
(`editor-styles.ts`) uses `var(--ha-font-size-s, ...)` with a literal fallback for this reason. Also
don't shrink a heading just because it "feels like a subheading" — HA's own equivalent
(`ha-expansion-panel`'s slotted header) doesn't scale text down at all, only bolds it
(`font-weight: var(--ha-font-weight-medium)`) and uses `--primary-text-color`; this repo's own `h3`
matches that exactly.

**Switch vs. checkbox: settled by real usage count, not by what merely exists.** Both `ha-switch`
and `ha-checkbox` are current, valid components — existence alone doesn't say which to use where.
A single, independent on/off setting (unrelated to any group) uses `ha-switch`: confirmed 79 real
usages across current HA config screens (`selector: { boolean: {} }`), versus zero real usages of
the older `type: "boolean"` → `ha-checkbox` path, which still exists in HA's codebase but is
effectively dead. Picking several items from a defined, homogeneous set uses `ha-checkbox`, via
`type: "multi_select"` — confirmed in active use across several current config panels, a
structurally different case (peers within one group, not independent settings that happen to sit
near each other). This repo's custom-section fields (8 equally-weighted section toggles) are the
multi-select case; every other boolean in this codebase (`show_environments`, `show_settings_link`,
`hide_when_no_updates`, etc.) is a standalone independent setting and correctly stays a switch.

## 8. CSS — container queries and shadow DOM

Full mode's two-column layout uses a CSS container query so it responds to the *card's own*
rendered width, not the viewport or dashboard section — correct even when the card ends up nested
somewhere narrower than its configured width (e.g. inside Overview's columns). Two non-obvious
things:

- **An element cannot query the container-query context it establishes on itself** — only its
  descendants can. `container-type: inline-size` and the `@container` rule responding to it need
  to be on two different elements. Getting this wrong doesn't error — the query silently never
  matches, at any width.
- **A CSS custom property only reaches where the selector setting it actually resolves to
  something.** A tag selector like `.status-icons ha-icon` matches a literal `<ha-icon>`, not
  `<ha-state-icon>`, which renders its own `<ha-icon>` inside its own shadow root. Set the custom
  property on a wrapping element instead (it cascades through shadow boundaries fine) — the failure
  mode is the selector never matching anything, not a shadow-DOM limitation.

## 9. HA platform constraints with no card-side hook

**`LovelaceCard.preview` means dashboard edit mode, not "picker thumbnail."** Set by
`hui-view.ts`/`hui-masonry-view.ts`/etc. as `element.preview = this.lovelace.editMode`, applied to
*every* card on the view. The add-card picker (`hui-card-picker.ts`) never sets it at all —
confirmed by reading `_renderCardElement()` directly — and has no built-in preview size cap of its
own; a card's grid cell just grows to whatever it naturally renders. The only thing that actually
feeds the picker's preview is `getStubConfig()`'s return value — there's no other card-side hook for
"render smaller because this is a preview." Overview's environments-only default exists because of
this: a real default-behavior change, not a picker-specific hack, since there was no way to
special-case the picker itself.

**HA's native `visibility:` card config is the correct mechanism for hiding a standalone card**,
materially better than the `getGridOptions()`/`getCardSize()` + `.preview`-tracking approach tried
first (returning the smallest valid grid footprint to simulate hiding, since CSS Grid's `span`
can't represent zero). Confirmed in `hui-card.ts` source: `visibility:` applies genuine `display:
none` to the card's own wrapper (`this.style.setProperty("display", visible ? "" : "none")`),
correctly removing it from *any* layout algorithm, and already handles dashboard-edit-mode
natively — no `preview` property needed on the card at all for this. The Updates card's editor
builds and saves a `visibility:` condition automatically whenever `hide_when_no_updates` is toggled
on (one `numeric_state` condition per relevant environment's aggregate pending-updates attribute,
OR'd together when there's more than one — `common/updates-visibility.ts`), and removes it
entirely when toggled off, rather than leaving a stale condition behind.

**Neither mechanism reaches a card nested inside another card's own template.** `hui-card.ts` (and
therefore `visibility:` support) only wraps cards HA itself directly places on a dashboard or in a
section — Overview generates `dockhand-updates-card` per environment as raw custom element tags
inside its own shadow DOM, never wrapped by `hui-card.ts`, so a `visibility:` condition on one of
those would have no effect. For this nested case, Overview does its own live check instead
(`hasPendingUpdates()` in `common/updates-visibility.ts`) and omits the element from its own
template entirely when there's nothing pending — true zero-space collapse, and simpler than the
standalone card's own history here since this is a plain flex column Overview already controls, not
HA's sections grid, so there's no CSS span-validity issue to work around. Worth remembering for any
future card that nests another one this way: neither `.preview` nor `visibility:` reach a nested
card, but a parent can always make its own inclusion of a nested element conditional instead.

**`hasPendingUpdates()`/`buildUpdatesVisibilityCondition()` check a per-environment aggregate
entity, not each individual container's own `update` entity — real bugs (undercounting, then a
safety concern) went through several shapes before landing back here, deliberately.** The
aggregate (ha-dockhand's "containers" sensor) used to relay Dockhand's own
`stats.containers.pendingUpdates` value verbatim, which silently excludes system containers —
`dockhand-updates-card/card.ts`'s own row-rendering (`_buildGroups()`, checking each container's
individual `update` entity) has no such exclusion, so a card could hide itself via "hide when no
updates" despite one of its own rows genuinely having something to show. The first fix tried was
in this repo: rebuild the visibility check around the same per-container lookup the rows use
(`findPrimaryEntityByDomain(hass, containerId, 'update')`), so the two could never disagree. That
introduced two new, real problems of its own: a `visibility:` array is baked into saved YAML at
edit time, but individual containers come and go (recreated on every image update, added,
removed) — a config built today would silently go stale the moment the container set changed,
with no indication anything needed re-saving; and scale — a real environment with 50+ containers
turned one toggle into a 50+ condition array. Reverted, and fixed at the actual source instead —
but the first version of that source-side fix folded system containers into the *same* attribute
this repo's visibility check already read (`pending_updates`), which raised a real safety question
once ha-dockhand's own bulk-update button turned out to derive its own gating from a sibling
function: could a display-oriented count and a bulk-action-eligibility count silently drift onto
the same number, in either direction? ha-dockhand settled this by exposing three separate,
named attributes on that same "containers" sensor instead of one overloaded one:
`pending_updates` (bulk-eligible only — excludes system containers, by construction in a shared
helper rather than by each caller separately remembering to filter them out), `pending_system_updates`
(system containers only, purely informational), and `pending_updates_total` (the sum — "does
anything at all need attention"). This repo's visibility check reads `pending_updates_total`
specifically, not `pending_updates` — the card's own rows already show a system container's
pending update, so "should this card hide itself" needs the total, not the narrower bulk-eligible
count; reading the wrong one of the three would reintroduce the exact bug this whole chain of
fixes was for. This repo's `updates-visibility.ts` otherwise went back to exactly what it was
before any of this — one stable aggregate entity per environment, safe to bake into `visibility:`
because its id never changes as containers churn — and is now correct because the specific
attribute it reads *is* correct. General lesson, worth keeping in mind even though the specific
fix landed elsewhere: when two code paths both claim to answer "does X have any pending update,"
a coarser aggregate that usually agrees with the detailed source is exactly the kind of
discrepancy that stays invisible until a case (here, system containers, and separately an
optional second data tier) falls on the wrong side of whatever it quietly excludes — but the fix
for that isn't always "make both sides use the detailed source," and definitely isn't "merge two
meanings that need to stay separably safe into one number"; check whether the aggregate itself can
just be made correct (and, where two genuinely different meanings are both needed, kept as two
differently-named attributes) before restructuring the consumer of it, especially when the
consumer's current shape (one entity per environment, not per container) exists for real reasons
that restructuring would give up.

One more consumer of this same discrepancy risk existed in this repo, caught in review rather than
by a symptom: the Updates card's own header count ("Updates (N)") was still separately tallying
`_buildGroups()`'s own row list (`groups.reduce((sum, g) => sum + g.updates.length, 0)`) — a
second, independent computation from the one `hasPendingUpdates()`/`buildUpdatesVisibilityCondition()`
use, that happened to usually agree with it. `_buildGroups()` still has to exist and still has to
iterate every container individually — there's no way to render *which* containers have updates,
with names and versions, from a single aggregate count — but the header's own *number* doesn't
need a second source of truth just because the rows next to it do. Switched to
`getTotalPendingUpdates()` (same file), which reads the identical `pending_updates_total` entity
attribute the visibility check already reads, for the identical set of environments. The
empty-state check ("Everything up to date") deliberately did *not* move to the same aggregate,
though, and stayed on `groups.every((g) => g.updates.length === 0)` — the row list's own real
content, not the aggregate's opinion of it. Rationale: if the aggregate and the per-container
rows were ever to genuinely disagree (the same class of bug this whole chain of fixes has been
about), gating the empty-state message on the aggregate could actively hide real rows a user
would want to see — the header count showing a different number than the rows below is a visible,
investigable mismatch; a hidden row that should have been visible is not. Where a future
discrepancy like this shows up, it's a signal to look at whether ha-dockhand's own aggregate and
its own per-container update entities have drifted apart again, not a cards-repo bug to patch
around locally.
