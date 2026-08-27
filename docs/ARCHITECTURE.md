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

Every editor in this repo builds its core config fields as a `schema` array fed into HA's own
`<ha-form>`, rather than hand-rendering individual `ha-select`/`ha-input`/`ha-switch` elements.
Every multi-environment card (Schedules, Updates, Stacks, Containers, Overview) also interleaves a
hand-built sortable environment-order/exclude section at root, outside any `<ha-form>` — see the
shared `renderEnvironmentOrderSection()` in `common/environment-scope.ts` — since drag-reordering
and eye-icon toggles don't map onto `ha-form`'s schema model at all, so that piece stays hand-built
regardless of how much of the rest of the editor is schema-driven. Minimal schema types live in
`common/ha-form-types.ts`, declared the same way `ha-types.ts` already declares
`HomeAssistant`/`DeviceRegistryEntry` — verified against real HA source, extended only as new
shapes are actually needed. This was checked against HA's own current reference editors (Tile,
Media Player, Weather — not just the simplest example) before committing to it, not adopted on
faith.

**Two native schema types this repo's editors were hand-building equivalents for, before checking
source properly, turned out to already exist:**

- **`type: 'expandable'`** — a real, native collapsible section (confirmed against
  `src/components/ha-form/ha-form-expandable.ts`), with `icon`/`iconPath`, `title`, `expanded`, and
  `flatten` (writes child field values directly onto the parent data object rather than nesting
  under this entry's own key). Every card's "Content" section (§ everywhere Name/settings-link/
  display toggles live) uses this now — nothing hand-built there anymore. `warning` is *not*
  forwarded to the nested `<ha-form>` this renders internally — a field with a `.warning` attached
  has to stay in the outer schema, not inside an `expandable` entry (the Environment card's `mode`
  field is the live example; see `docs/EDITOR_DESIGN.md` rule 2).
- **`type: 'grid'`** — real too (`ha-form-grid.ts`), `grid-template-columns: repeat(auto-fit,
  minmax(column_min_width ?? 200px, 1fr))`, so narrow fields (boolean toggles, mainly) naturally
  sit side by side without any layout CSS this repo would otherwise need to write. Same
  `warning`-forwarding constraint as `expandable`.

**The Name field (`selector: { entity_name: {} }`) is also a real, native selector**, not
something built here — confirmed against `src/data/selector.ts` and by finding it in HA's own
Tile/Area/Heading card editors first. Gives Composed (Area/Device/Entity/Floor) and Custom (plain
text) modes entirely for free, rendered by HA's own already-loaded `<ha-selector>` at runtime. See
`docs/EDITOR_DESIGN.md` rule 3 for the full mechanism and `common/card-name.ts` for what this repo
actually supplies (an entity id to resolve Composed values against, and a fallback matching each
card's pre-existing default).

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
- **The Updates card's `visibility:` condition derivation** — whenever which environments are
  included, or `hide_when_no_updates`, change, the card's own native HA visibility condition needs
  rebuilding or clearing. A derived side effect across several fields, not a value any one field
  holds, so it's handled in `_applyValueChange()` after `ha-form` hands back the merged data.
- **The environment-order/exclude sortable section** (every multi-environment card; see above) and
  **Overview's own per-environment override navigation** — drag-reordering and the override
  list↔detail navigation (§3) don't map onto `ha-form`'s schema model at all. Same reasoning as
  Badges/Features staying hand-built in HA's own reference editors: some UI shapes aren't forms,
  and forcing them to be one doesn't make the result more standard, just harder to read. Order/
  exclude toggling was generalized into `common/environment-scope.ts`'s
  `renderEnvironmentOrderSection()` once several editors needed it — Overview's per-section
  override navigation, with its own extra "pencil" action button per row, is the one thing that
  function's own `onEdit` callback exists for (an optional hook, same pattern as its
  `onSolo`/`onSelectAll`/`onClearAll`), rather than a second, Overview-specific copy of the row
  rendering.
- **A field that filters another field's options without being saved itself** — the environment
  picker above Container/Stack's device picker was one of these before it was turned into a real,
  persisted `environment_device_id` config field instead (§5). Worth remembering as a pattern: "no
  standard way to do X without saving something" is sometimes better resolved by asking whether
  saving that something is actually fine, not by concluding X must stay hand-built.

**`ha-form`'s `visible: { field, operator, value }` conditional-field-visibility feature is real,
but unreleased as of this writing** — merged into HA frontend's `dev` branch 2026-07-17, not in any
released version including 2026.7.4 (checked directly against
`homeassistant/components/frontend/manifest.json` in HA core, not assumed). One field in this repo
needs conditional visibility (`custom_sections` on the Environment card, shown only when `mode:
'custom'`); it achieves this by conditionally including/excluding the schema entry via a plain JS
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
rendered as dropdowns while Environment/Display-mode pickers (usually under 6) rendered as lists —
an inconsistency nobody chose, just a side effect of how many items each field happened to have.
Don't rely on the option-count default even when it happens to produce what you want today; it's
liable to flip the moment the count crosses 6 in either direction.

**Verify `computeLabel`/`computeHelper` for every schema field, not a sample.** Two real fields
(`custom_sections` on the standalone Environment editor, `environment_custom_sections` on
Overview's environment-settings view) shipped with no case in their `computeLabel` switch, silently
falling through to `default: return schema.name` — the raw field name rendered as the label. This
survived multiple rounds of verification (schema construction, cascading behavior, `cardIsEmbedded`,
the `.warning` mechanism, locale switching for *other* fields) because every check exercised a
handful of representative fields, not every one. Found only because a person opened the actual UI.
When verifying via a harness script, loop over `form.schema.map(s => form.computeLabel(s))` for
every field — testing 2–3 "interesting" ones will not catch a silent fallthrough. This applies
especially to `multi_select`: its own per-option labels (via the `options` map) can be correct while
the field-level label is still broken, since `<ha-form>` renders those from two different places in
the schema.

## 3. Reusing a standalone card's own editor component inside another card's editor

Overview's editor reuses the actual `dockhand-environment-card-editor`/`-vulnerability-`/`-stacks-`/
`-containers-`/`-schedules-card-editor` components directly for two different purposes — the
per-environment override detail view and the global-defaults view (both elaborated in §4) —
mounting them as real child elements and listening to their `config-changed`, rather than
hand-duplicating each one's fields. Less code, and a field added to any of those 5 editors is
picked up in both places for free. Updates is the one exception, and stays that way for a real
reason — see §4.

Reusing an editor this way needs three things that aren't obvious from the standalone case:

- **`cardIsEmbedded`/`hideTitle` opt-in properties**, both `@property({ type: Boolean }) = false`
  so standalone HA usage is unaffected. `cardIsEmbedded` suppresses the environment/device
  picker every one of these editors unconditionally renders at the top — redundant once the
  environment is already implied by which detail view is open. `hideTitle` (added later, for the
  global-defaults view specifically) suppresses only the title field, since a single title shared
  across every environment's card doesn't mean anything — unlike `show_settings_link`, which stays
  visible on both reuse contexts, since a link-visibility preference is genuinely something a user
  might want set uniformly per card type. Which fields to hide is a real question worth asking
  per-field, not "hide everything not device-specific." Easy to add to some editors and forget one
  — this happened during development (Environment card's editor was missed for `cardIsEmbedded`
  on the first pass) — so when adding a fifth reusable editor, verify the property actually
  suppresses what it should by checking rendered output, not just that it compiles.
- **`setConfig()` is a method, not a settable property.** `LovelaceCardEditor`'s contract is `.hass
  = ...` (a real setter) plus a `.setConfig(config)` *call*. A Lit template can't invoke a method
  as part of a declarative binding, so mounting one of these editors needs an imperative `ref()`
  callback that sets `.hass`, sets `.cardIsEmbedded`/`.hideTitle`, then calls `.setConfig(...)` —
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
`EnvironmentOverrideEnvironment`/`Vulnerabilities` are derived as `Omit<DockhandXCardConfig, 'type'
| 'device_id'>` rather than hand-declared parallel interfaces, so a field added to either of those
2 cards' configs is automatically valid in an override too, with nothing here to remember to
update. `EnvironmentOverrideStacks`/`Containers` extend that same `Omit` with two more fields
excluded (`environments_order`/`exclude_device_ids`) — real fields on those cards' own configs now
that they're multi-environment-capable, but not override-appropriate: Overview already owns which
environment each generated card represents. `EnvironmentOverrideSchedules`/`Updates` are the two
exceptions, kept fully hand-declared rather than `Omit`-derived — Schedules for the same
environment-scoping reason as Stacks/Containers, plus never having had a `device_id` to omit in the
first place; Updates because `DockhandUpdatesCardConfig` carries `scope`/`visibility` fields
alongside the same environment-scoping ones, none of which a plain `Omit` would correctly exclude.

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

**Global defaults reuse the same 5 real editors §3 already established**, for the same reason —
Environment/Vulnerability/Stacks/Containers/Schedules' global-defaults views in Overview's editor
mount the real `dockhand-*-card-editor` components (with `cardIsEmbedded`/`hideTitle` both set),
rather than building a separate `<ha-form>` schema that would duplicate the standalone editor's own
fields. `updates` is the one section that doesn't do this: its real editor builds a native HA
`visibility:` condition that has no meaning as a shared default for cards Overview generates and
renders directly (§9 covers why neither `visibility:` nor a nested card's own preview state reach
each other). Its Name field still goes through the same real `cardNameFieldSchema()` every other
card's override view uses, though — a plain text input can't hold a Composed value, so this is a
small hand-built `<ha-form>` with just the two fields that actually apply (Name,
`hide_when_no_updates`), not fully hand-rendered markup the way it used to be.

**Mapping between an embedded editor's own field names and Overview's prefixed global keys**
(`mode` vs `environment_mode`, `visible_badges` vs `stacks_visible_badges`) is entirely mechanical:
`${prefix}_${field}`, where the prefix is the section name itself, except `environments` →
`environment` (dropping the trailing s — matching the singular-vs-plural distinction above).
`GLOBAL_SECTION_PREFIX` in `dockhand-overview-card/editor.ts` is the one place that exception lives
— just 5 short strings (environment/vulnerabilities/stacks/containers/schedules — Updates isn't in
this map at all, for the same reason it isn't one of the reused editors in §3), not a per-field
map. Both directions are now fully generic: reading a section's current values scans Overview's own
config for any key matching that prefix; writing back applies the same prefix to every field the
embedded editor emits, `type`/`device_id` excluded. A field added to any of these 5 cards' editors
needs nothing added here to work in either direction.

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

Every card's Dockhand link (`.header-icon`, shared with every other header icon — see §11)
renders one of three ways, not two. `show_settings_link` on, and
`getDockhandBaseUrl(configuration_url)` resolves a valid URL → the normal clickable icon.
`show_settings_link` on, but no resolvable URL → a visually distinct, non-interactive icon
(`mdi:link-off`, `.header-icon.link-unavailable` — an *additive* CSS modifier, so a rule targeting
`.header-icon` alone still matches this state too) with a `title` tooltip explaining what's wrong
and where to look. `show_settings_link` off → nothing, same as always. The icon and tooltip text
are shared constants (`SETTINGS_LINK_UNAVAILABLE_ICON`/`_TITLE` in `common/format.ts`), not seven
separate copies.

The middle case is real, not hypothetical: a `ha-dockhand` bug (API URL with incidental
leading/trailing whitespace, fixed in that repo — see its own CHANGELOG) produced a
`configuration_url` that both `new URL()` and `window.open()` reject outright in a browser. Before
this three-state design, "toggle on but broken" rendered identically to "toggle off" — indistinguishable,
and the only way to check whether something needed fixing was to remember that "no icon" could mean
two different things. All 7 cards with a settings link validate the same way now (Updates is the
one card with no settings link at all): 3 of them originally only checked whether
`configuration_url` was present, not whether it actually parsed, which is what let this particular
bug hide as "icon shows, click silently does nothing" instead of surfacing as the same unavailable
state the other cards already showed correctly. When validating that a URL resolves
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
  currently used anywhere in this repo, worth remembering if one needs a description line later.
- **Two different kinds of `<ha-expansion-panel>` exist in this repo now, deliberately, not by
  accident:** every card's own "Content" section (§2) uses the *native* `type: 'expandable'` schema
  type, rendered entirely by HA's own `ha-form-expandable.ts` — a plain `<div slot="header">`, no
  icon-tag choice to make, `.content { padding: 12px }` set by that component itself, not this
  repo's CSS. The environment-order/exclude sections (§2, §4) and Overview's own two remaining
  hand-built panels ("Sections," the per-environment-override wrapper) are genuinely hand-built —
  their content (drag-reorder, embedded editor components) can't be schema fields at all — and use
  `<ha-icon slot="leading-icon">` + `<h3 slot="header">` directly. The `<h3>` choice specifically is
  confirmed against source, not picked: Tile/Area/Heading's own hand-built Features panels (the one
  section on each of those cards that similarly can't be schema-driven) all use `<h3>` too. What
  actually makes a hand-built header look right regardless of tag choice is HA's own shared
  `configElementStyle` (`config-elements-style.ts`): `ha-expansion-panel > *[slot="header"] {
  margin: 0; font-size: inherit; font-weight: inherit; }` — resets whatever's slotted there to
  inherit the panel's own `#summary` styling. This repo's `sortableRowStyles` includes the
  equivalent rule for the same reason; an earlier, hand-rolled attempt at this same reset (a custom
  `h3 { ... }` block, picked before checking whether HA already solved it) got both the font sizing
  and the icon-sizing selector wrong at the same time — the icon selector targeted `h3 ha-icon` (a
  descendant), but the icon is a sibling via `slot="leading-icon"`, so it silently matched nothing.
- **`ha-expansion-panel` has a real, native `no-collapse` boolean attribute** (confirmed against
  `ha-expansion-panel.ts`) — set alongside `expanded` to make a panel permanently open, no click
  target to collapse it at all. Used on every environment-order/exclude section as of this writing,
  a maintainer decision revisited more than once already (see `docs/EDITOR_DESIGN.md` rule 4) —
  removing just this one attribute is the entire change needed if that decision changes again,
  nothing else about how the section renders depends on it.
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

## 10. CSS design tokens

Spacing and font-size use HA's own `--ha-space-*`/`--ha-font-size-*` custom properties (confirmed
against `resources/theme/core.globals.ts`/`typography.globals.ts` — not this repo's own invention),
wherever a value lands exactly on HA's own scale:

```
--ha-space-1: 4px   --ha-space-2: 8px   --ha-space-3: 12px  --ha-space-4: 16px
--ha-space-6: 24px  --ha-space-9: 36px  --ha-space-12: 48px
--ha-font-size-xs: 10px  -s: 12px  -m: 14px (base)  -l: 16px  -xl: 20px  -2xl: 24px
```

Both are set on `<html>` at the root, so they inherit through this repo's own shadow DOM. Always
written with a fallback (`var(--ha-space-2, 8px)`) for an HA version old enough to predate the
tokens, and for the screenshot harness, which doesn't load HA's real styles — the harness instead
defines these tokens directly (`tools/screenshot-harness/index.html`) with the same real values, so
testing exercises the actual-token code path rather than only ever the fallback.

**Every `--ha-font-size-*` fallback in this repo is a direct px value from the table above, not an
em approximation.** HA's own real tokens are confirmed px-based, scaled by a separate
`--ha-font-size-scale` multiplier — not `em` — per HA frontend's own GitHub issue #51602
("the rest of HA's own typography system uses px-based tokens scaled by `--ha-font-size-scale`").
This matters structurally, not just for accuracy: `em` is relative to whatever font-size an element
inherits from its own parent, so two nested elements each declaring their own em-based size
multiply together rather than each landing on its own intended, absolute size — a real bug found
and fixed this way (a badge nested three levels inside an ordinary row landed at ~9.66px
instead of its own intended 10px `xs`, since 0.85em × 0.71em ≈ 0.6em, not 0.71em). Using real px
fallbacks throughout eliminates this class of bug entirely, since a px value never compounds with
ancestor nesting regardless of depth.

One thing worth checking before adding a new token-matching value: **a value landing on a round
number isn't itself evidence HA treats it as a token.** Check the actual HA source for the specific
rule being matched — `ha-form-expandable.ts`'s own `.content { padding: 12px }` is a hardcoded
value in HA's own file, not `var(--ha-space-3)`, so this repo's matching rule stays a plain `12px`
too.

## 11. Shared component classes

Everything lives in `common/shared-styles.ts`, used by every card that needs it rather than a
local copy per card. Full class-by-class reference (every shared and card-specific class, its
purpose, and why it can't roll up further) is generated on request rather than duplicated here —
ask for a fresh CSS classes table if this section's own summary isn't enough.

**Row shapes**, composed rather than duplicated:

- **`.row-left`** — the base: flex, centered, `8px` gap. Used wherever an icon+label needs to
  stay grouped as one unit — a list row's own "left group." Position comes entirely from `.row`'s
  own `justify-content: space-between` and DOM order, not from `.row-left`/`.row-right`
  themselves — neither contributes any positioning of its own.
- **`.header-left`** / **`.header-right`** — a card header's own left/right groups specifically,
  genuinely separate from `.row-left`/`.row-right` above despite looking almost identical at a
  glance. These were briefly merged into `.row-left`/`.row-right` earlier this same session, once
  testing showed `.header-left`'s own extra `flex: 1` made zero visible difference (`space-between`
  and `min-width: 0` already did the real work) — but merging them also meant sharing one `8px`
  gap value, which broke once `.header-icon` later gained its own 32×32 clickable footprint (a
  24px icon centered inside, leaving 4px of invisible padding on every side): two adjacent
  `.header-icon` boxes sharing that same `8px` gap put `16px` between the actual, visible icon
  glyphs, not `8px` — confirmed directly (real, measured gaps before and after). Split back into
  their own classes so each can use the gap math its own content actually needs: `.header-right`
  uses `gap: 0` (two adjacent `.header-icon` boxes each already contribute `4px` of their own
  padding facing the other, so `4+0+4` already totals `8px`); `.header-left` keeps the standard
  `8px` (its own common case — `.card-badge` + plain text — has no equivalent padding to
  compensate for), with a small, scoped exception (`.header-left .header-icon { margin: 0 -4px }`)
  for Environment card's own connection-type icon specifically, the one case where a `.header-icon`
  does sit inside `.header-left` alongside content that has no padding of its own. Stack card's own
  header-right needed the same kind of scoped fix in the other direction
  (`.header-right .label-pill { margin-right: 4px }`), since it mixes a plain `.label-pill` (no
  padding) with `.header-icon` — confirmed via the same, real measurement (`8px` in every case,
  including this one). All of this is measured from the actual, visible icon glyphs, not from the
  (mostly invisible until hover/focus) box edges — matching the same `8px` standard used
  everywhere else in this file, just accounting for where each shape's own visible content
  actually starts.
- **`.row`** — a self-contained rule sharing `.row-left`'s own base shape, plus
  `justify-content: space-between` and its own `8px` gap — the default shape for nearly every
  data row across every card. Merges what were two separate classes (`.split-row` + `.item-row`);
  no current usage ever needed one behavior without the other, so keeping them apart was pure
  duplication.
- **`.row-icon`** — a small, non-shrinking icon+optional-text badge, position-neutral (despite
  once being misleadingly named `.row-left` before this session's own rename) — used both as a
  row's own standalone icon+label content and, nested inside `.row-right`, as one of several
  trailing badges (Stacks/Containers list rows). Also absorbed `.item-status-icon`'s own former
  role (a list row's own bare, wrapper-less leading state icon) — same 16px tier, same color-
  modifier concept, so keeping them as two separate classes was pure duplication once one of them
  no longer had a misleading name blocking the merge. Carries the full union of both former
  modifier sets: `.ok`/`.warn`/`.error`/`.accent`/`.neutral` (`.info`, briefly part of this set
  too, was removed once confirmed genuinely unreachable — outside `colorClass`'s own type union
  and unused by any remaining template).
- **`.hero-row`** — a card's single most prominent value, centered, `12px` padding (the standard
  `8px` plus its own `8px` extra). Excluded from the core context-padding rule below (rather than
  needing to out-specificity it) so the two never compete for the same element at all — see that
  paragraph's own note on this.
- **`.stacked-pair`** — a primary line + secondary content, `2px` apart, owning the *outer*
  spacing contribution as one unit rather than either child claiming it independently. The shared
  mechanism behind both a stacked header (name + subheader) and a stacked data row (a metric's own
  label-line + its bar).

**The core spacing mechanism**: `.body`/`.section`/`.list`/`.grid-2` never declare a `gap` at all.
Instead, every direct child gets `4px` of its own top/bottom padding via
`.body > *:not(.section):not(.grid-2):not(.divider):not(.hero-row), .section > *, .list > *,
.grid-2 > *` — two adjacent rows combine to the standard `8px` entirely through padding, composed
rather than a parent-owned value a child then has to cancel out. The four exclusions on the first
clause each exist for a real, previously-shipped-broken reason, not speculatively: `.section` and
`.grid-2` are real, sized containers (unlike `.list`, which is `display: contents` and has no box
of its own) that would otherwise get their own 4px as a `.body` child *and* also pass 4px to their
own first/last child via the second/third/fourth clause — double-counting to 8px of internal
padding before content even starts. `.divider` and `.hero-row` each have their own, different,
deliberately-non-4px value (see below and the `.hero-row` entry above) — matching the generic
clause here as well would let it win via higher specificity and silently override their own
value. A row needing more than the standard `8px` (`.hero-row`) adds its own larger padding value
directly, rather than the parent needing to anticipate every possible row's own spacing needs.

**Dividers are never owned by an individual section — always inserted by the caller composing
several sections together**, via `joinWithDividers()`/`mergeSections()` in
`common/section-join.ts`. `joinWithDividers()` takes an array of section results (each a
`TemplateResult` or `nothing`) and places a `.divider` between adjacent ones that actually
rendered — never before the first, never after the last, never around one that rendered nothing
(a config visibility toggle, or genuine data unavailability). `mergeSections()` combines several
results into one before they reach `joinWithDividers()`, for sections that should always sit
directly adjacent with no divider between them at all (Container/Environment's own metrics
section and the grid immediately below it), while still correctly reducing to `nothing` if every
constituent piece is empty, so the merged group still composes correctly as a single entry. The
previous pattern — each section's own render method independently prepending its own leading
divider — ties the divider to the wrong thing's own visibility (itself, the section below the
line) instead of whatever precedes it, and breaks the moment a section that isn't always first in
a card's own fixed order happens to be the first one that actually renders (Environment's own
Custom mode: any section can be first, depending on what a person's own config selects). A shared
join step sidesteps this entirely: no section owns a divider at all, so there's no "first section"
special case to get wrong, and no combination of hidden/empty sections can produce two adjacent
lines or a dangling one at the very end. `.divider` itself is also excluded from the core
context-padding clause above for a related but distinct reason: not a double-counting risk (it's
a leaf, no children of its own), but a real CSS specificity bug discovered this way — the context
rule is more specific than `.divider`'s own bare-class rule, so without the exclusion it silently
overrode `.divider`'s own intended zero padding with the generic 4px, landing wrongly *after* the
line (padding comes after border in the box model) on top of `.divider`'s own correct margin,
roughly doubling the gap after every divider on the page.

**The list mechanism** is deliberately singular now: `.list` (`display: contents`) is the only
list container, used identically whether or not the list's own rows happen to share a fixed set of
columns. Cross-row column alignment via CSS subgrid was tried and abandoned in favor of this
simpler, uniform approach — rows just group their own left/right content via `.row`'s own
`justify-content`, not shared column tracks.

**Status indicators**: `.status-banner` (one prominent card-level message) takes a
`.ok`/`.warn`/`.error`/`.accent` modifier for color, reading HA's own native
`--success-color`/`--warning-color`/`--error-color`/`--dockhand-accent-color`. A smaller,
per-row/header status tier used to exist as a separate class (`.status-icon`), but was eliminated
entirely once its own two remaining uses (Container's own header-positioned update-chip, its own
hero-row-positioned health-chip) turned out to already belong to one of the four primary
icon-class tiers this file organizes around (`.header-icon`/`.hero-word`/`.row-icon`/
`.label-pill` — each with its own size and color-modifier set) — giving them a third, separate
class purely for color dressed up an ordinary header/hero-row icon as a distinct shape, when color
was the only thing it ever needed beyond that context.

A card needing a new instance of any of these should use the shared one directly rather than
writing a local copy. Where a card's own state value doesn't already match one of the shared
canonical modifier names (Container's own `healthy`/`unhealthy`/`starting`, for example), map it
to the canonical name in a small local lookup table (e.g. `HEALTH_STATUS_CLASS` in that card's own
`card.ts`) rather than adding a new, card-specific modifier — the state value itself stays
unchanged anywhere it's still shown as text or used as an unrelated lookup key; only the CSS class
benefits from the translation.

**A plain, unscoped class name is a real collision risk once reused across several cards' own
templates** — confirmed twice: once when `.name` (before its own elimination)
collided conceptually with the card-header class of the same name, and again when a rename
(`.status-chip` → `.status-icon`) silently collided with a pre-existing, unrelated class of the
same new name (Environment's own feature-toggle icon wrapper, renamed at the time to
`.feature-icon` and since consolidated further into the shared `.header-icon`, §11).
CSS's own explicit-beats-inherited rule means a lower-specificity rule that explicitly sets a
property still wins over inheritance from a more specific parent — a genuine, silent-failure risk
that a plain, generic class name invites. Prefer a name specific enough not to collide (`.item-
name`, `.row-left`) over a generic one, and grep for an exact match before reusing any short,
generic-sounding class name for something new.

**Not every visually-similar HA component is safe to use directly, even when its CSS is a genuine,
checked reference.** `ha-automation-row-event-chip` and `ha-assist-chip` (the source for
`.header-icon`/`.hero-word`'s own shape values, absorbed from the former `.status-icon`) are real
custom elements, but neither is guaranteed to be
registered in an arbitrary dashboard — confirmed by checking their own actual import graph, not
assumed: `ha-automation-row-event-chip` is imported by 5 files, all automation-editor-specific;
`ha-assist-chip` by 17, all specific cards/panels. Neither is part of the always-loaded dashboard
shell the way `ha-icon-button` is (206 importers, including `hui-root.ts`, the Lovelace dashboard
root itself). This is why this repo matches these components' visual values with its own plain
HTML/CSS rather than importing and using them directly — a deliberate compatibility choice, not an
oversight. `ha-form`, `ha-selector`, `ha-expansion-panel`, `ha-icon`, `ha-icon-button`, `ha-alert`,
`ha-input`, and `ha-sortable` don't have this problem and are used directly elsewhere in this repo
(§2) — each confirmed via its own real, traced import chain (a full local clone of
`home-assistant/frontend`, not search alone): `ha-alert`/`ha-input` are imported directly by
`ha-form.ts` itself (already-established safe); `ha-sortable` via `ha-areas-picker` →
`ha-selector-area` → `ha-selector`, which `ha-form.ts` also imports directly. `ha-relative-time`
was considered too (its own chain — `hui-root` → `hui-view` → `hui-card` → `create-card-element`
→ `hui-entities-card` → `create-row-element` → one of 28 entity-row types — is also fully static)
but deliberately not used: that chain runs through a specific default card type
(`hui-entities-card`) rather than the dashboard shell root itself, a genuinely less durable
guarantee than the components above it — `hui-entities-card` could in principle become
lazy-loaded in some future frontend refactor in a way `hui-root.ts`'s own direct imports couldn't.
Replaced with the existing `formatRelativeTime()` utility (`common/format.ts`, already used by
Schedules card) instead. `ha-button` was also genuinely safe by this same standard (206 importers
via `hui-icon-button`) and was used for a while — Updates card's own "Check for updates"/"Update
all" header buttons — but has since been converted to `renderIcon()` too (§17), once a real
`ha-button`'s own size/shape turned out not to fit alongside every other, compact header-icon on
that same card; no card renders one directly anymore (editors still do, which is fine — a
different concern with a different bar, since an editor's own dialog isn't trying to match this
file's own visual language at all).

The distinguishing question for any future "should we just use HA's own component" instinct: is it
part of the guaranteed-loaded shell, or does it depend on something else being present first.

## 12. Text color hierarchy

`secondary-text-color` is `ha-card`'s own default, set once at the root rather than repeated per
class. Only genuine exceptions declare `primary-text-color` explicitly: headers
(`.section-title`/`.group-header`/`.column-title`) and deliberate standalone highlights
(`.hero-word`, `.hero-row`, `.section-title-value`, a stack's own `.sync-status`) — each a real
stat or state meant to draw the eye, not a case that slipped through. Everything else —
`.item-name`, `.row-left`, `.row-right`, and every plain content wrapper — declares no color at
all and inherits the default.

A few elements keep their own explicit color deliberately, not as an oversight: `.label-pill` (has
its own background, functions as a self-contained badge rather than inherited text); color-modifier
sets like `.row-icon.neutral`/`.hero-word.neutral`/`.sync-status.pending` (explicitness
within a set of mutually-exclusive modifiers is safer than relying on one matching the page default
by coincidence); and `.header-icon`'s own `:hover`/`.link-unavailable:hover` rules (real state
*overrides*, not defaults).

**Setting the default once at `ha-card` makes an entire bug class structurally impossible, not
just fixes the instances found at the time**: a bare `<span>`/`<ha-relative-time>` sitting next to
an explicitly-colored label, with no color rule of its own, silently inherits whatever the page
default happens to be — invisible in the markup, since CSS doesn't warn about it. An element with
no explicit color now correctly matches its neighbors by construction. `card_mod`/theme targeting
is unaffected either way — this is a real CSS custom property, not a hardcoded value, so a theme
swapping `--secondary-text-color` flows through regardless of where the rule lives.

## 13. List-row and section spacing

**The standard vertical rhythm is `8px` between any two content rows or sections — composed
from padding each row's own context contributes, not a parent's own `gap`.** See §11's own core
spacing mechanism paragraph for the actual rule and its own exclusions. This composes correctly
regardless of a card's own DOM nesting depth around a given element — verified directly
(`getBoundingClientRect()` measurements, not visual inspection) across multiple cards' own
hero-rows, sitting at different nesting depths, landing at the identical spacing.

**Padding composes safely with a parent's own padding-based contribution; margin does not** —
margin on a flex child adds *on top of* whatever a parent's own mechanism already provides
(additive, not collapsing), which is exactly why the spacing system uses padding as its own single
mechanism throughout rather than mixing margin and padding for the same purpose. A row needing
more than the standard `8px` (`.hero-row`) adds its own larger padding value directly, rather than
the parent needing to anticipate every possible row's own spacing needs.

**Everything below a card's own header lives inside `.body`, including content that's always
present regardless of the card's own state or mode** (an environment's own optional labels row,
its own header itself, for instance) — not placed outside `.body` with its own separate spacing
mechanism just because it isn't part of the state-dependent content underneath it. Every card's
own header now lives as `.body`'s own first child, universally, so the entire rendered card
inherits `.body`'s own spacing as its starting point rather than the header being a structurally
separate concern with its own conventions.

**Stacks and Containers (plural, list cards) stay without cross-row column alignment, a
deliberate decision extended to every list card, not just these two.** Their own badges (health,
updates, CPU, memory) are individually toggleable per card config and conditionally present per
row depending on available data — the number of visible columns can genuinely differ row to row.
CSS subgrid-based cross-row column alignment was tried for Schedules/Updates/Recent Events/Top
Containers (where the row shape itself doesn't vary) and then abandoned everywhere, per direct
instruction, in favor of a single, simpler mechanism (`.list`) used identically whether or not a
given list's own rows happen to share a fixed set of columns — rows just group their own left/right
content via `.row`'s own `justify-content`, trading exact cross-row alignment for one less
structural concept to maintain.

## 14. CSS/rendering facts worth remembering

- **SVG elements have a different default `transform-origin` than HTML elements**: `(0, 0)`, the
  viewport's own top-left corner, not `50% 50%`. Rotating an SVG element without setting
  `transform-origin` explicitly rotates around the wrong point, distorting and potentially clipping
  its own content against the viewport edge.
- **Lit's plain `html` tag doesn't correctly create dynamically-templated elements nested inside an
  `<svg>`** — it needs its own dedicated `svg` tag function (`import { svg } from 'lit'`) for that
  content specifically. The outer `<svg>` element itself can stay part of a surrounding `html`
  template, since a browser's own HTML parser already namespace-switches on `<svg>` as a
  foreign-element trigger; only dynamically templated *children* need the fix.
- **CSS specificity, not source order, decides which rule wins when specificities differ.** A
  two-class selector (`.row-icon.warn`) always beats a one-class selector regardless of which
  is defined later in the file. Matching or exceeding the specificity being overridden is
  required, not just placing the override after it.
- **A flex item's own default `min-width` is `auto`, not `0`** — this prevents it from shrinking
  below its own content's preferred width, causing overflow instead of wrapping. `min-width: 0`
  (plus `overflow-wrap: break-word` where relevant) is needed on a flex item that should wrap long
  content instead of overflowing its own container.

## 15. Icon sizing reference

| Context | Size |
|---|---|
| Section title icons, `.stats-row .stat`, `.status-banner` | 16px |
| Row content (`.row-icon`, `.row`) | 16px |
| Header row icons (`.card-badge`, `.header-icon`'s own icon — including
Environment's own connection-type icon, merged in from a former separate `.conn-icon`) | HA
default (24px), no
override on the icon itself |
| `.header-icon`'s own clickable footprint | 32×32px, deliberately larger than the 24px icon it
contains — a real touch-target improvement over an earlier version of this class, which had no
explicit size at all and so exactly matched the bare icon with zero padding. Confirmed directly
(a real render, before/after measurement) that this size doesn't disturb the standard 8px gap
between a header and its own divider below — that spacing comes from `.body`'s own
context-padding rule plus the divider's own margin, both independent of header content height. |
| A card's own main hero-word icon (`.hero-row`'s own status text) | HA default (24px), no override |

**An icon-containing element needs its own explicit `line-height: 1` to avoid a taller box than a
sibling that has one, even when both contain an identically-sized icon.** Without it, the element
inherits its parent's own font-size-driven default line-height (`normal`, roughly 1.15–1.2× the
font-size) instead of the icon's own actual pixel height — a real, confirmed bug in Container
card's own `.hero-row`: `.hero-word` had `line-height: 1` but its own sibling (the health-chip,
also `.hero-word` now, but a separate class at the time) didn't, so at the row's own 24px
inherited font-size, the health-chip's own box was several pixels taller than the state text's,
even though both contained a plain 24px `ha-icon` —
confirmed directly (`getComputedStyle().lineHeight` on each, `24px` vs `normal`) after an earlier,
incorrect fix attempt (forcing `--mdc-icon-size` explicitly on both) made no difference, since the
icon's own size was never actually the problem.

## 16. Donut chart geometry (Environment card's own disk-usage chart)

Built on `d3-shape`'s own `arc()` generator for the wedge shapes and rounded corners — this repo's
only dependency beyond `lit`, adopted after repeated real bugs in a hand-rolled version, since
correctly rounding a corner across two different radii needs different treatment at each one, not
the same radius applied identically. `d3-shape`'s own `padAngle` produces an angular gap between
segments (confirmed directly from Dockhand's own source, which uses the same underlying technique
via `layerchart`) — a fixed *angle* covers a shorter physical distance closer to the center, so an
angular gap is inherently wedge-shaped (narrower at the ring's own inner edge), not a visual
illusion. This repo's own gap is a genuine constant-pixel width instead, computed separately: each
segment's own straight radial edge, extended, passes through the donut's own center, so a line
parallel to it offset by a constant perpendicular distance stays that same physical distance from
the original at every radius — unlike a fixed angular offset. Implemented as a thin, non-clickable
"eraser" line drawn at each boundary's own angle, in the card's own background color, rather than
baked into the wedge angles themselves — simpler, lower-risk geometry (a straight line, not a
curve) than continuing to derive a constant-pixel gap analytically within the arc math itself.

## 17. Shared helper functions

- **`multiEnvCardNameFallback`** (`common/card-name.ts`) — computes a consistent default name
  across every card that can represent more than one environment (Stacks/Containers/Updates),
  falling back sensibly when zero, one, or several environments are in scope.
- **`resolveEffectiveGroupBy`** (`common/environment-scope.ts`) — the shared default for whether a
  multi-environment list card groups its own rows by environment, used consistently by every card
  with a `group_by` option rather than each re-deriving its own default logic.
- **`renderIcon`** (`common/icon.ts`) — the single shape behind every small icon across every
  card, clickable or genuinely static: a header update chip, a feature toggle, the Dockhand link,
  a row's own CPU%/health/container-count badge, a card's own fixed header badge
  (`baseClass: 'card-badge'`), a small icon+count summary (`baseClass: 'stat'`, Environment's own
  container-state counts and Schedules' own run-outcome counts). `baseClass` (a plain string, not
  a hardcoded union) supplies the icon's own size/layout tier — `.header-icon`/`.row-icon`/
  `.card-badge`/`.stat` for every current caller, but genuinely open to a new tier without editing
  this function itself. Two further modifiers, both string-appended onto `baseClass` at the call
  site rather than a separate parameter (Updates card's own two header buttons, converted from
  `ha-button` this session, are the only current usages of either): `.filled` gives a
  `.header-icon` a persistent, visible background instead of the usual hover-only one, for the one
  case (Updates card's own "Update all") that needs to read as a prominent action rather than blend
  in with the other, more incidental header icons around it — also switches from the fixed 32×32
  square every plain `.header-icon` uses to auto width + padding, since this is the one case where
  a header-icon carries real text alongside its own icon. `.spinning` rotates the icon
  indefinitely — the loading-spinner state a real `ha-button` provided natively, reimplemented here
  as a small, standalone CSS animation (no existing spin pattern anywhere else in this codebase to
  reuse). `onClick` is required unless `disabled: true` (a known, meaningful muted
  state — the Dockhand link when its own URL couldn't resolve, still intercepts its own click) or
  `static: true` (genuinely, permanently non-interactive by design — a card's own header badge —
  intercepts nothing, so a click passes through untouched to whatever it sits inside) is set
  explicitly — a discriminated union, not just optional fields, so there's no ambiguous "present
  but nothing to do, no explanation" state possible at the type level. Keyboard activation
  (Enter/Space) is wired up automatically for the interactive case, from `onClick` alone, via the
  shared `onKeydownActivate()` below. `renderSettingsLink` (the "open in Dockhand" icon
  specifically, shared by all 7 cards that have one) is a specialized wrapper on top of this, for
  concerns genuinely specific to that one icon (URL resolution, translated tooltip keys, the
  "link couldn't resolve" unavailable state) that don't belong in the generic function.
- **`onKeydownActivate`** (`common/icon.ts`) — the shared Enter/Space-activates-like-a-click
  keydown handler, used internally by `renderIcon()` and by every card's own remaining hand-rolled
  clickable element that doesn't fit `renderIcon()`'s own icon+optional-text shape (a whole
  clickable `.row`, a `.hero-row` wrapping more than one prominent value). Every card used to
  independently hand-roll an identical, private `_onKeydown()` method to wire this same logic up
  manually — confirmed byte-for-byte identical across all 8 cards that had one before this helper
  replaced every one of them; no card defines its own copy anymore.

## 18. CSS classes reference

A fast lookup for every class actually in use across the repo, built directly against the current
codebase (every shared class below confirmed genuinely referenced in at least one card's own
template — none are stale/leftover). Complements §11's own prose reasoning for *why* certain
decisions were made; this is a flatter "what does this class do" table. `docs/STYLING.md`'s own
"card_mod hooks" section is the subset of these meant as stable, public targeting points for
end-user customization — this table is the fuller, internal-development reference, including
classes not meant as public hooks at all (state-color modifiers, card-specific chart/layout
pieces).

### Shared classes (`common/shared-styles.ts`)

| Class | Purpose |
|---|---|
| `.body` | A card's outermost content wrapper. No spacing of its own — every direct child contributes its own `4px` top/bottom padding (see §11's own core spacing mechanism paragraph). |
| `.card-header`, `.header-left`, `.header-right` | The header row, common to every card. `.header-left` groups the icon-badge + name; `.header-right` groups action/link icons. Genuinely separate classes from `.row-left`/`.row-right` (see §11) — briefly merged into them, then split back out once merging turned out to also merge their gap values, which broke when `.header-icon` later gained its own 32×32 clickable footprint. |
| `.card-badge` | The header's own fixed-size (28×28) tinted icon box, identifying the card. Always static, rendered via `renderIcon()` (§17). |
| `.truncate` | Single-line ellipsis truncation — a card's own name, a row's own name, a subheader. Can't be inherited from an ancestor; sits directly on the text element. |
| `.card-subheader` | A header's own secondary line (hostname:port, a docker image tag) — smaller, secondary-colored text beneath the name. |
| `.header-icon` (+ `.link-unavailable`, `.filled`, `.spinning`) | Any header icon, clickable or static, either side of a card's own header — an update chip, a feature toggle, the Dockhand link, Environment's own connection-type icon (merged in from a former separate `.conn-icon`, once nothing distinguished them but a stray `flex-shrink: 0`, folded into this class instead) — all one shared shape and treatment, so they visually line up and behave identically regardless of what each one links to. A deliberately larger clickable footprint (32×32) than the icon itself needs — the icon stays at HA's own native, unmodified size, centered within the larger box, a real touch-target improvement over an earlier version of this class that had no explicit size at all. Carries its own `.ok`/`.warn`/`.error`/`.accent`/`.neutral` color modifiers. `.link-unavailable` is the Dockhand link's own muted, non-interactive state when no usable URL could be resolved — additive, so a rule targeting `.header-icon` alone still matches this state too. `.filled`/`.spinning` are Updates card's own two header buttons (converted from `ha-button` this session) — see §17. |
| `.clickable` | The shared hover/focus treatment only (background tint, cursor, outline, border-radius) — always additive on top of whatever class gives an element its own identity (`.row.clickable`, `.hero-word.clickable`, `.header-icon.clickable`). Never a replacement for that identity class. |
| `.section`, `.section-title` | A labeled sub-section (detailed mode's own resource sections, Stack's own git-sync details, and others) — one shared shape, not a separate copy per card. |
| `.section-title-value` | A trailing count next to a section title, pushed right via `margin-left: auto`. |
| `.group-header`, `.column-title` | A group label (Schedules/Updates/Stacks/Containers grouping) and a column header — share font-size/line-height with `.section-title`, each with its own distinct structural need (icon layout vs. divider styling vs. minimal padding), so kept as three real, separate shapes. |
| `.divider` | A thin horizontal separator line between two sections/rows. Never owned by an individual section — always placed by whichever card composes them together, via `joinWithDividers()`/`mergeSections()` (`common/section-join.ts`) — see §11's own note on this. |
| `.hero-row`, `.hero-word` | A card's own single most prominent value, centered (Stack's own status, Container's own state, Vulnerability's own total findings). `.hero-row` is the outer, padded (`12px`) row; `.hero-word` the text/icon itself — independently clickable where it has a real entity to link to, and also the shape Container's own health-chip uses (structurally a hero-row icon, not a header one, once `.status-icon` was eliminated). |
| `.stacked-pair` | A primary line + secondary content stacked `2px` apart (a metric's own label+value row paired with its own bar/sparkline below it) — owns the outer spacing contribution as one unit; its own children don't independently claim padding. |
| `.list` | A list card's own row container (Stacks, Containers, Schedules, Updates, Recent Events, Top Containers) — `display: contents`, so rows become effectively direct children of whatever wraps them. Column alignment was deliberately abandoned for simplicity — see §15's own note. |
| `.row`, `.row-left`, `.row-right` | The default shape for almost every data row across every card — icon+label pushed to one side (`.row-left`), a value or secondary content to the other (`.row-right`), `8px` internal gap. The single most-reused row shape in the whole system — a card's own header uses the separate `.header-left`/`.header-right` pair instead (see above), not these. |
| `.item-name` | A row's own primary, often-long name text — flexible, truncating (`flex: 1`), a direct child of `.row-left` alongside a leading icon and any trailing pill(s) (`.name-and-type`, a wrapper that used to sit between them, was eliminated once `.item-name`'s own existing `flex: 1` was confirmed to already produce the same "name grows, pill sits immediately after" result on its own). |
| `.row-icon` | A small, non-shrinking icon+optional-text badge, position-neutral (despite once being misleadingly named `.row-left`, before this session's own rename) — used both as a row's own standalone icon+label content and, nested inside `.row-right`, as one of several trailing badges (Stacks/Containers list rows). Also absorbed `.item-status-icon`'s own former role (a list row's own bare, wrapper-less leading state icon) — same 16px tier, same color-modifier concept. Carries the full union of both former modifier sets: `.ok`/`.warn`/`.error`/`.accent`/`.neutral`. Rendered via `renderIcon()` (§17) whether clickable (a row's own CPU%/health badge) or genuinely static (a metric row's own "CPU"/"Memory" label, Environment's own "Top containers" section). |
| `.label-row`, `.label-pill` | A wrapping flex row of pills, and the pill shape itself (a stack/container type, a custom environment label) — shared by every card that has one, see §10. `.label-row`'s own gap is the standard `8px` (fixed from an earlier, smaller `4px` — confirmed via direct measurement this was genuinely producing `4px` between adjacent pills, not `8px`). `.label-pill`'s own text is `12px`, matching `.row`'s standard size, with `line-height: 1` added at the same time so the larger, more readable text doesn't make the pill any taller than it was before (confirmed via direct measurement: same `16px` total height either way). |
| `.status-banner` | A colored status indicator — a larger, one-per-card prominent message with its own text. Paired with a `.ok`/`.warn`/`.error`/`.accent` modifier for color — same shared definition, §10 again. A smaller, per-row/header tier used to exist separately (`.status-icon`), eliminated once its own remaining uses turned out to already belong to `.header-icon`/`.hero-word` instead. |
| `.card-message` | The shared shape for any message taking over a card (or its own body) in place of normal content — missing entity, not-yet-available entity, nothing to show, or a positive "all clear"/"up to date" state. `.warn`/`.error` modifiers for color, no modifier for the neutral/positive case. |
| `.grid-2` | Two independent, self-contained rows side by side (Container's own I/O rows, Environment's own resource-count grid) — deliberately a plain grid, not subgrid, since items don't need to align sub-columns with each other. |
| `.bar-track`, `.bar-fill` | A CPU/Memory progress bar's own track shell and colored fill — `.bar-fill`'s own `.ok`/`.warn`/`.error` modifiers match the shared color convention. |
| `.stats-row`, `.stat` | A container-count/schedule-outcome summary row — centered icon+count items, evenly spread (`justify-content: space-between` across N items, not the two `.row` handles). `.stat` is always static, rendered via `renderIcon()` (§17); its own color is typically set per-instance via the `color` option rather than a shared modifier class, since each usage's own semantic meaning (running/stopped/paused/etc.) is specific to that one context. |
| `.ok` / `.warn` / `.error` / `.accent` / `.neutral` | The shared color-modifier set, paired with whichever base class (`.header-icon`, `.row-icon`, `.status-banner`, `.bar-fill`, `.hero-word`, `.card-message`) needs color for a given state. |

### Card-specific classes

Cards not listed here (Container, Containers, Schedules, Stacks, Updates) have **no local classes
at all** — fully expressed through shared classes alone, confirmed directly (each card's own
`styles.ts` is just `${sharedStyles}`).

**Environment card** (`dockhand-environment-card/styles.ts`) — the disk-usage donut + legend
(`.disk-chart-row`, `.disk-donut`, `.disk-dot`, `.disk-legend`), the CPU/Memory history sparkline
and its own hover tooltip (`.sparkline`, `.sparkline-wrap`, `.chart-tooltip` and its own
`.chart-tooltip-dot`/`-time`/`-value` children, `.chart-value`), the full-mode two-column
container-query layout (`.full-container`, `.full-layout`, `.full-left`, `.full-right`), and the
resource-grid's own compact run/partial/stopped breakdown (`.breakdown` with `.running`/`.partial`/
`.stopped` color modifiers) — all genuinely unique to this card's own charts/layout, nothing a
shared class could reasonably cover.

**Stack card** (`dockhand-stack-card/styles.ts`) — git-sync status (`.sync-status` with its own
`.synced`/`.syncing`/`.pending`/`.error` modifiers, unique to this one status vocabulary) and
`.sync-error-banner` (the one banner usage needing top-alignment for multi-line error text, instead
of `.status-banner`'s own centered default).

**Vulnerability card** (`dockhand-vulnerability-card/styles.ts`) — `.severity-grid` (a fixed 4-up
grid, not `.grid-2`'s own 2-up or a vertical list) and `.severity-pill` with its own `.critical`/
`.high`/`.medium`/`.low` color modifiers (a genuinely separate 4-tier severity scale, distinct from
the shared `.ok`/`.warn`/`.error`/`.accent` set).

**Overview card** (`dockhand-overview-card/styles.ts`) — `.overview` (the outer multi-column
wrapper) and `.env-column` (one environment's own column) — this card doesn't render `<ha-card>`,
rows, sections, or a header/hero in the sense every other card does, so none of the shared row-shape
classes apply to it at all; it's purely compositional, embedding instances of the other cards.

