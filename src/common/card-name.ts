import type { HaFormSchema } from './ha-form-types';
import type { EntityNameItem, HomeAssistant } from './ha-types';

/**
 * This repo's shared card-name field — every card's own Content section
 * uses this instead of a plain `{ name: 'title', selector: { text: {} } }`
 * field, and it always stores into a `name` config key, replacing what
 * used to be called `title`.
 *
 * Named around what this actually *is* for this repo — a card's name/
 * title — not around "entity," even though the field it's built from is
 * called `entity_name` in HA's own selector API (`EntityNameItem`/
 * `EntityNameOptions` in ha-types.ts keep that name deliberately, since
 * they're direct re-declarations of HA's own wire type, not something
 * this repo gets to rename and still stay compatible). None of this
 * repo's cards are actually "about" one entity the way Tile's `entity:
 * media_player.x` is — they're about a device (an environment, a stack,
 * a container) or, for Schedules, a set of them. The `entity_id` this
 * module's functions take is only ever a *proxy* — some real entity that
 * happens to live on the relevant device, used purely so HA's own
 * Composed-mode picker has something to resolve Area/Device/Floor
 * context from (see getRepresentativeEntityId in device-utils.ts). It
 * doesn't mean this repo has started modeling cards as being about an
 * entity; it means HA's API for "let the person compose a name" happens
 * to be keyed on one, and borrowing that API as-is is simpler and more
 * correct than reinventing an equivalent that takes a device instead.
 *
 * Borrowed directly from HA's own Tile/Area/Heading card editors (all
 * three confirmed, directly against HA frontend source, to use the exact
 * same selector for their own Name field) rather than reinvented:
 * `selector: { entity_name: {} }` is a real, native ha-form selector
 * type. Composed/Custom mode switching, the drag-reorder chip picker,
 * Area/Device/Entity/Floor resolution — all of it is rendered by HA's own
 * already-loaded `<ha-form>`/`<ha-selector>` at runtime, the same way any
 * other selector type is. This repo supplies nothing but the schema entry
 * and a proxy entity_id; there is no component here to bundle, maintain,
 * or keep in sync with HA's own — it doesn't exist as code we own.
 *
 * `defaultName` must match whatever `fallback` string the same card
 * passes to resolveCardName below for an unset `name` — this is purely
 * what the picker *shows* when nothing's configured yet, not something
 * that gets saved into config on its own (HA's own picker only writes a
 * value once the person actually changes something). Skipping this would
 * leave the picker looking blank/empty for a config that hasn't set
 * `name`, while the live card still correctly shows its real default —
 * a confusing mismatch between what the editor previews and what
 * actually renders, not a difference in the real default itself.
 */
/**
 * Migrates a config carrying the old `title: string` field (real,
 * released in 1.1.0 for six of this repo's cards) to the new `name`
 * field this file's own cardNameFieldSchema/resolveCardName use. A
 * plain string is already a valid `name` value (Custom mode is exactly
 * that), so this is a straight move, not a conversion — but it has to
 * happen somewhere, or an existing user's real, already-saved
 * `title: "My Custom Title"` would be silently ignored the moment this
 * repo stops reading `title` at all, with no error and no visible
 * explanation for where their title went. Idempotent and safe to call
 * unconditionally in every affected card's own setConfig(): a config
 * that never had `title` (new, or already migrated) passes through
 * unchanged. `title` is always stripped once present, even in the one
 * case its value doesn't get used — a config with both `title` and
 * `name` already set (shouldn't normally happen, but a person
 * hand-editing YAML could produce it) keeps whichever `name` was
 * already there rather than silently overwriting it with the stale
 * `title`, but still drops the now-meaningless `title` key rather than
 * leaving it to linger in every future save. An earlier version of this
 * function only stripped `title` in the branch that actually used its
 * value, silently carrying a dead key forward indefinitely in the
 * both-set case.
 *
 * Takes/returns `Record<string, unknown>` rather than each card's own
 * config type — a config arriving via setConfig() is only ever
 * type-asserted, never actually validated at that boundary (it's
 * whatever the person's YAML happened to contain), so this reflects
 * what's really being handled here more honestly than threading a
 * generic through call sites would.
 */
export function migrateTitleToName(config: Record<string, unknown>): Record<string, unknown> {
  if (config.title === undefined) return config;
  const { title, ...rest } = config;
  return config.name !== undefined ? rest : { ...rest, name: title };
}

export function cardNameFieldSchema(entityId: string | undefined, defaultName: string | EntityNameItem | EntityNameItem[]): HaFormSchema {
  return {
    name: 'name',
    selector: { entity_name: { entity_id: entityId, default_name: defaultName } }
  };
}

/**
 * Computes the fallback name for a card that can represent one or many
 * environments (Stacks/Containers/Schedules/Updates) — consistent across
 * all four: the included environment's own name plus the card's own type
 * when exactly one environment is included ("Nebula — Stacks"), or just
 * the type name otherwise (zero, or two or more, environments —
 * "Stacks"). Computed once here and passed as resolveCardName's own
 * `fallback` argument, rather than each card appending "— Type" to
 * whatever resolveCardName returns in its own template: that unconditional
 * append is what doubled up the type name when the fallback was already
 * just the type name (a real bug — "Stacks — Stacks" with 0 or 2+
 * environments included), and it would incorrectly apply to a person's
 * own custom name too, not just the fallback case that's actually meant
 * for. */
export function multiEnvCardNameFallback(envDevices: { name: string }[], cardType: string): string {
  return envDevices.length === 1 ? `${envDevices[0].name} — ${cardType}` : cardType;
}

/**
 * Render-time counterpart to cardNameFieldSchema — resolves whatever the
 * person configured (a plain string from old-style YAML or Custom mode, a
 * single EntityNameItem, or an ordered EntityNameItem[] from Composed
 * mode) into the actual display string for the card's own header.
 * Delegates entirely to `hass.formatEntityName()` (a real, public HA API
 * — verified against HA frontend's own types.ts) rather than re-deriving
 * Area/Device/Floor names from the entity/device/area registries
 * ourselves; HA already has this exact logic, correctly handling RTL text
 * direction and separator rules this repo has no reason to reimplement.
 *
 * `fallback` is deliberately a plain string the caller computes itself,
 * not something this function derives — every card that had a title
 * before this field existed already had its own "what to show when
 * nothing's configured" answer (the single-device cards' own
 * `device.name_by_user || device.name`, Schedules' own generic
 * "Schedules"), and that answer needs to keep meaning exactly what it did
 * before. This function only ever calls into formatEntityName when the
 * person has *actually* set something — an unset `name` skips it
 * entirely and returns `fallback` directly, rather than defaulting to
 * some composed value (e.g. `[{ type: 'device' }]`) that would run
 * through a different code path than the one that's always produced a
 * card's default title. A plain string value (Custom mode, or a config
 * carried over before this field existed) also resolves without needing
 * hass/entityId — formatEntityName handles that case directly, but
 * skipping the call when there's obviously no state object to pass
 * avoids a pointless "entity not found" lookup on every render for the
 * common case of a plain custom title.
 */
export function resolveCardName(
  hass: HomeAssistant,
  entityId: string | undefined,
  name: string | EntityNameItem | EntityNameItem[] | undefined,
  fallback: string
): string {
  if (!name) return fallback;
  if (typeof name === 'string' && (!entityId || !hass.states[entityId])) return name;
  if (!entityId) return fallback;
  const stateObj = hass.states[entityId];
  if (!stateObj) return typeof name === 'string' ? name : fallback;
  return hass.formatEntityName(stateObj, name) || fallback;
}
