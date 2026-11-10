import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { CardMode, CustomSection, DockhandEnvironmentCardConfig } from '../dockhand-environment-card/types';
import type { StacksCardBadge, StacksGroupBy, StacksSortBy, DockhandStacksCardConfig } from '../dockhand-stacks-card/types';
import type { ContainersCardBadge, ContainersGroupBy, ContainersSortBy, DockhandContainersCardConfig } from '../dockhand-containers-card/types';
import type { DockhandVulnerabilityCardConfig } from '../dockhand-vulnerability-card/types';
import type { ScheduleGroupBy, ScheduleSortBy, ScheduleBadge, DockhandSchedulesCardConfig } from '../dockhand-schedules-card/types';
import type { DockhandUpdatesCardConfig } from '../dockhand-updates-card/types';

export type OverviewSection = 'environments' | 'vulnerabilities' | 'stacks' | 'containers' | 'updates' | 'schedules';

export const DEFAULT_SECTION_ORDER: OverviewSection[] = ['environments', 'vulnerabilities', 'updates', 'schedules', 'stacks', 'containers'];

/** Sections the config turns on, in the given order. A section that's off is
 * off in every column, so it needs no alignment wrapper — and an empty
 * wrapper would still take a flex gap, leaving a visible hole. */
export function enabledSections(sections: OverviewSection[], config: DockhandOverviewCardConfig): OverviewSection[] {
  const shown: Record<OverviewSection, boolean | undefined> = {
    environments: config.show_environments,
    vulnerabilities: config.show_vulnerabilities,
    stacks: config.show_stacks,
    containers: config.show_containers,
    updates: config.show_updates,
    schedules: config.show_schedules
  };
  return sections.filter((s) => shown[s]);
}

/** Section → the prefix of its defaults' keys (§4) and its key in an
 * environment's override. */
const SECTION_PREFIX: Record<OverviewSection, string> = {
  environments: 'environment',
  vulnerabilities: 'vulnerabilities',
  stacks: 'stacks',
  containers: 'containers',
  updates: 'updates',
  schedules: 'schedules'
};
const OVERRIDE_KEY: Record<OverviewSection, keyof EnvironmentOverride> = {
  environments: 'environment',
  vulnerabilities: 'vulnerabilities',
  stacks: 'stacks',
  containers: 'containers',
  updates: 'updates',
  schedules: 'schedules'
};

/** A section's settings for one environment's card: the section's
 * defaults (`stacks_group_by` → `group_by`), then the environment's
 * override. The singular `environment_` prefix can't match the plural
 * `environments_overrides`/`environments_order` (§4). Shared by the
 * Overview card and the Dockhand dashboard (§22). */
export function sectionSettings(config: Record<string, unknown>, section: OverviewSection, override: EnvironmentOverride | undefined): Record<string, unknown> {
  const prefix = `${SECTION_PREFIX[section]}_`;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (key.startsWith(prefix) && value !== undefined) out[key.slice(prefix.length)] = value;
  }
  for (const [key, value] of Object.entries(override?.[OVERRIDE_KEY[section]] ?? {})) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** The saved section order, with any section it doesn't name after it. */
export function orderedSections(saved: OverviewSection[] | undefined): OverviewSection[] {
  if (!saved) return DEFAULT_SECTION_ORDER;
  const known = new Set(saved);
  return [...saved, ...DEFAULT_SECTION_ORDER.filter((s) => !known.has(s))];
}

/** Per-environment override of any field the standalone Environment/
 * Vulnerability/Stacks/Containers card itself exposes — same fields,
 * same meaning, just scoped to one environment's column here instead of
 * a whole separate card. Absence of a key means "use the shared/default
 * value", not "use a blank one".
 *
 * Derived from each card's own config type (everything except
 * type/device_id, which don't apply to an override) rather than
 * hand-declared separately, on purpose: a hand-declared parallel
 * interface is exactly the kind of duplication that silently broke
 * per-environment visible_badges overrides for a while (see
 * docs/architecture.md §3) — that specific bug was in the *runtime*
 * extraction handlers, already fixed by making those generic, but the
 * *type* had the same duplication risk sitting right next to it, just
 * without a way to fail loudly yet. `Omit<..., 'type' | 'device_id'>`
 * means adding a field to e.g. DockhandStacksCardConfig automatically
 * makes it a valid override field too, with nothing here to remember to
 * touch. `EnvironmentOverrideUpdates` is deliberately NOT built this way
 * — DockhandUpdatesCardConfig has scope/visibility fields that aren't
 * override-appropriate, so Omit alone doesn't produce the right shape
 * there; it stays hand-declared, the same exception `updates` already
 * is everywhere else in this design. */
export type EnvironmentOverrideEnvironment = Omit<DockhandEnvironmentCardConfig, 'type' | 'device_id'>;
export type EnvironmentOverrideVulnerabilities = Omit<DockhandVulnerabilityCardConfig, 'type' | 'device_id'>;
/** `environments_order`/`exclude_device_ids` also omitted, alongside the
 * pre-existing `type`/`device_id` — not override-appropriate now that
 * Stacks supports multiple environments: Overview already owns which
 * environment(s) each generated card represents, same reasoning as
 * EnvironmentOverrideSchedules' own comment. */
export type EnvironmentOverrideStacks = Omit<DockhandStacksCardConfig, 'type' | 'device_id' | 'environments_order' | 'exclude_device_ids'>;
export type EnvironmentOverrideContainers = Omit<DockhandContainersCardConfig, 'type' | 'device_id' | 'environments_order' | 'exclude_device_ids'>;
/** Updates and Schedules also leave out the keys a column decides for
 * them: the environment scope (an Overview column is one environment, with
 * no global schedules), and Updates' `visibility`, since the Overview hides
 * that card itself. */
export type EnvironmentOverrideUpdates = Omit<DockhandUpdatesCardConfig, 'type' | 'device_id' | 'scope' | 'environments_order' | 'exclude_device_ids' | 'visibility'>;
export type EnvironmentOverrideSchedules = Omit<DockhandSchedulesCardConfig, 'type' | 'environments_order' | 'exclude_device_ids' | 'include_global'>;

/** One environment's full set of per-card-type overrides — edited via the
 * editor's per-environment detail view (see editor.ts), not hand-written
 * YAML, though nothing stops that either. Every field optional and every
 * sub-object optional: an environment with no overrides at all simply
 * isn't a key in environments_overrides. */
export interface EnvironmentOverride {
  environment?: EnvironmentOverrideEnvironment;
  vulnerabilities?: EnvironmentOverrideVulnerabilities;
  stacks?: EnvironmentOverrideStacks;
  containers?: EnvironmentOverrideContainers;
  updates?: EnvironmentOverrideUpdates;
  schedules?: EnvironmentOverrideSchedules;
}

export interface DockhandOverviewCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-overview-card';
  show_environments?: boolean;
  show_vulnerabilities?: boolean;
  show_stacks?: boolean;
  show_containers?: boolean;
  show_updates?: boolean;
  /** Defaults to false, unlike every sibling show_X field — schedules
   * existing per-environment (rather than flat, ha-dockhand 1.9.0+ only)
   * is recent enough that defaulting this on could put an empty or
   * confusingly-partial section in front of someone running an older
   * ha-dockhand, the same reasoning the standalone Schedules card's own
   * README already gives for needing that version. */
  show_schedules?: boolean;
  /** Passed through to every per-environment Updates card this generates
   * (each is independently scope: 'environment', so this correctly hides
   * only the specific environment's card that has no updates, never
   * affecting the others). */
  updates_hide_when_no_updates?: boolean;
  environment_mode?: CardMode;
  /** Only meaningful when environment_mode is 'custom' — same
   * custom_sections concept as the Environment card itself, applied
   * uniformly to every environment's column (shared, not per-environment,
   * matching how environment_mode is already a single shared setting
   * rather than configured separately per column). */
  environment_custom_sections?: CustomSection[];
  /** Same show_settings_link concept as each standalone card's own
   * config, applied as the shared default for every environment's
   * generated card of that type — same relationship the other
   * per-section global defaults already have to their card's own
   * fields. Unlike title (genuinely per-instance, hidden from these
   * global-default screens), a link-visibility preference is
   * legitimately something a user wants uniformly per card *type*
   * rather than repeated per environment. */
  environment_show_settings_link?: boolean;
  vulnerabilities_show_settings_link?: boolean;
  stacks_show_settings_link?: boolean;
  containers_show_settings_link?: boolean;
  schedules_show_settings_link?: boolean;
  /** Same visible_badges concept as the standalone Stacks-list/
   * Containers-list cards' own config, applied as the shared default for
   * every environment's generated card of that type — same relationship
   * environment_mode/environment_custom_sections already have to the
   * Environment card's own fields. */
  stacks_visible_badges?: StacksCardBadge[];
  containers_visible_badges?: ContainersCardBadge[];
  containers_group_by?: ContainersGroupBy;
  containers_sort_by?: ContainersSortBy;
  /** Same relationship to the standalone Stacks card's own group_by/
   * sort_by fields as every other X_fieldname global default here. */
  stacks_group_by?: StacksGroupBy;
  stacks_sort_by?: StacksSortBy;
  /** Same relationship to the standalone Schedules card's own fields as
   * every other X_fieldname global default above — applied uniformly to
   * every environment's generated Schedules card. Not included:
   * environments_order/exclude_device_ids/include_global (Overview
   * already owns environment scoping for every generated card of every
   * type; see EnvironmentOverrideSchedules' own comment). visible_badges
   * *is* included, unlike those three — see card.ts's own comment on why
   * its default (['next_run'], no environment badge) differs from the
   * standalone card's own default. */
  schedules_show_stats?: boolean;
  schedules_visible_badges?: ScheduleBadge[];
  schedules_group_by?: ScheduleGroupBy;
  schedules_sort_by?: ScheduleSortBy;
  /** Every other field of a list card works the same way as a section
   * default (`stacks_show_controls`, `containers_filters`, …): the Overview
   * passes any key with a section's prefix on to that section's cards. */
  /** Per-environment overrides of any field any of the 5 generated card
   * types expose, keyed by device id. Edited via the editor's per-
   * environment detail view — see EnvironmentOverride above. Plural,
   * matching show_environments/environments_order — this key is about
   * the environments section/list as a whole, not one environment's
   * card settings the way environment_mode etc. are (singular there is
   * correct: each of those really is a per-card-type default, this
   * isn't). */
  environments_overrides?: Record<string, EnvironmentOverride>;
  exclude_device_ids?: string[];
  /** Device ids in the order the user dragged them to, in the editor.
   * Environments not listed here (newly added ones) sort after the
   * ordered ones, alphabetically. Plural, matching show_environments,
   * like environments_overrides above. */
  environments_order?: string[];
  /** Section order within each environment's column, user-arranged in
   * the editor the same way environments_order is. Sections not listed
   * (newly added ones, e.g. after an update) sort after the ordered
   * ones, in DEFAULT_SECTION_ORDER's relative order. */
  section_order?: OverviewSection[];
  /** Controls whether JS height equalisation is active across environment
   * columns. When true (the default), matching section slots (Stacks,
   * Containers, etc.) are kept the same height across side-by-side
   * environment columns: after each render, the tallest natural height
   * in each visual row is applied as min-height to every column's
   * corresponding slot, so section boundaries line up. A lone column
   * in its own row (e.g. a third environment wrapping to a new row on a
   * narrow viewport, or any single-column mobile layout) is left
   * untouched — no dead whitespace. Set to false for a more compact
   * flex-wrap layout when section heights differ significantly between
   * environments. */
  align_columns?: boolean;
}
