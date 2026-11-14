# Editor design rules

Rules for card editor layout and behavior, applied across the Vulnerability, Stack, Container, Environment, Stacks, Containers, Updates and Schedules editors except where a rule says otherwise. The Overview editor and the dashboard settings compose other editors (rule 8).

## 0. Home Assistant's own guidance first

- [Custom card docs](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/): the `getConfigForm()` schema API, including the `expandable` and `grid` schema types.
- [Dashboard chapter 2](https://www.home-assistant.io/blog/2024/07/26/dashboard-chapter-2/) (2024): "include only the necessary options in the visual editor, while also hid[ing] away the less used options... in an accordion UI to avoid clutter."

When a claim needs checking, read the HA frontend source (`git clone --depth 1 --filter=blob:none --sparse` plus `git sparse-checkout set <dir>`) rather than guessing: "confirmed against source" below means that.

## 1. Field order follows the card, top to bottom

At root (rule 2): the Environments section (rule 4) where it applies, then the card's organizational choices (`group_by`, `sort_by`), worth deciding when the card is added. In Content: Name first (the card's header), then the rest, ending with per-row details (rule 5), since those affect the last thing the card renders.

## 2. Root is what the card is of; Content is how it displays

As in HA's Tile, Area and Heading editors: root holds only what the card is *of* (the device picker, or the Environments section for a card spanning environments). Everything else (Name, links, display toggles) goes in one collapsed `type: 'expandable'` **Content** section with icon `mdi:text-short`, HA's own `mdiTextShort` for those editors.

**Exception:** a field with a `warning` stays in the outer form: `ha-form-expandable.ts` doesn't forward `warning` to its nested form. The Environment card's `mode` (its warning lists the entities a mode needs) stays at root for that reason.

## 3. Name: HA's own selector

`name` uses `selector: { entity_name: {} }`, the same as Tile, Area and Heading's Name (in their Content sections): Composed (area, device, entity, floor) or Custom text, rendered by HA's own form. `common/card-name.ts`: `cardNameFieldSchema(entityId, defaultName)` builds the field, `resolveCardName(hass, entityId, name, fallback)` resolves it with `hass.formatEntityName()`.

- **`entityId`:** a real entity to compose from (the picker can't compose from a bare device id). `getRepresentativeEntityId()` (`device-utils.ts`) picks one on the device, since area, device and floor are the same for all of them; multi-environment cards use the first included environment's.
- **Fallback:** what the card shows unnamed, unchanged from before the field existed: single-device cards the device's name (`[{ type: 'device' }]` as the picker's preview), multi-environment cards a plain string (`'Schedules'`). `resolveCardName` only touches the entity when `name` is set.
- **The picker's "Entity" option can't be removed** (`ha-entity-name-picker.ts` adds it unconditionally). On cards where the entity is only a proxy it composes from an arbitrary entity; a hand-built replacement would cost more than that nit.
- Names here say "card", not "entity" (`card-name.ts`, `cardNameFieldSchema`), since no card is about one entity; `EntityNameItem`/`EntityNameOptions` in `ha-types.ts` keep HA's own names.

## 4. Environment selection: one shared section

A card that spans environments uses `renderEnvironmentOrderSection()` (`common/environment-scope-editor.ts`) at root, inside an `<ha-expansion-panel>` with `mdi:web` (Dockhand's own icon) and `label_environments`, through the panel's `leading-icon` and `header` slots.

- In card editors it's open with `no-collapse`: always shown and always usable. The dashboard settings pass `collapsible`, since there it sits among other folded panels.
- Drag to reorder, the eye to include or leave out, solo, Show all and Clear. The drag handle is greyed (`.disabled`, not hidden) on a card with a `group_by` not set to `environment`, since order does nothing until then; Updates always groups by environment, so its handle is never greyed.
- `<ha-form>` has nothing for a drag list with per-row actions (`type: 'constant'` renders a label and value, with no icon slot), so this list is the one recurring hand-built piece.

## 5. Several optional per-row details: one `multi_select`

Two or more independently toggleable per-row details (Stacks' and Containers' badges; Schedules' next run and environment) are checkboxes under one `type: 'multi_select'` field labelled **Row details**, not separate booleans. One detail alone can be a boolean.

## 6. `<ha-form>` schemas are the standard

Every standard editor is root fields plus, where rule 4 applies, the Environments section, plus the shared Filters form (architecture.md §21); nothing else hand-built (architecture.md §2). A new hand-built pattern needs a reason as specific as rule 4's.

`type: 'grid'` (`repeat(auto-fit, minmax(200px, 1fr))`, as Tile uses for its toggles) puts narrow fields side by side. It doesn't forward `warning` either.

## 7. Editors never link to entities or live data

An editor configures; even where the card links a heading to more-info, the editor doesn't, as in HA's own editors.

## 8. Editors that compose other editors

The Overview editor uses the cards' own editors for its section defaults and per-environment overrides (architecture.md §3), and the dashboard settings use them for every card on every kind of page (§22). Most rules above apply through those editors rather than to the host:

- **Their own lists stay hand-built:** Overview's Sections list (section types, not environments) and the dashboard's column boards.
- **No Content section of their own:** a card's chrome comes through its own editor. The *editor* side follows a renamed field automatically; the *generation* side (Overview's `card.ts`, the strategy) builds configs by hand and has to be checked when an embedded card's field names change.
- **Rule 4 applies as usual:** both reuse `renderEnvironmentOrderSection()`; Overview's per-environment pencil is its optional `onEdit` callback, like `onSolo`.
- **Hand-built panels use `<h3 slot="header">`,** as Tile, Area and Heading's own hand-built Features panels do.

## 9. Hint text: say only what a tooltip can't

Every row action (drag, eye, solo, pencil) has its own `label`, a hover tooltip, so hints don't repeat what buttons do.

- **State the section's job:** that dragging reorders, that hiding doesn't delete.
- **Plain, and one paragraph:** "Drag to reorder." A hint with more to say is one paragraph, not several one-sentence ones.
- **The same wording for the same kind of list:** `order_list_hint` serves every environment and section list; a hint key that exists only to describe one card's icons belongs folded back into it.
- **Not by default:** add a hint only when there's something nothing else says (dragging, or a requirement such as a sensor that must be enabled).
- Row-level `title` tooltips that state a requirement (`vulnerabilities_hint`, `updates_hint`, `schedules_overview_hint` on Overview's Sections rows) are a different thing and fine.
