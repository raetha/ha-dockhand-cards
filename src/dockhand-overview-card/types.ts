import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { CardMode, CustomSection, DockhandEnvironmentCardConfig } from '../dockhand-environment-card/types';
import type { StacksCardBadge, DockhandStacksCardConfig } from '../dockhand-stacks-card/types';
import type { ContainersCardBadge, DockhandContainersCardConfig } from '../dockhand-containers-card/types';
import type { DockhandVulnerabilityCardConfig } from '../dockhand-vulnerability-card/types';

export type OverviewSection = 'environments' | 'vulnerabilities' | 'stacks' | 'containers' | 'updates';

export const DEFAULT_SECTION_ORDER: OverviewSection[] = ['environments', 'vulnerabilities', 'updates', 'stacks', 'containers'];

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
 * docs/ARCHITECTURE.md §3) — that specific bug was in the *runtime*
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
export type EnvironmentOverrideStacks = Omit<DockhandStacksCardConfig, 'type' | 'device_id'>;
export type EnvironmentOverrideContainers = Omit<DockhandContainersCardConfig, 'type' | 'device_id'>;
export interface EnvironmentOverrideUpdates {
  title?: string;
  hide_when_no_updates?: boolean;
}

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
}

export interface DockhandOverviewCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-overview-card';
  show_environments?: boolean;
  show_vulnerabilities?: boolean;
  show_stacks?: boolean;
  show_containers?: boolean;
  show_updates?: boolean;
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
  /** Same visible_badges concept as the standalone Stacks-list/
   * Containers-list cards' own config, applied as the shared default for
   * every environment's generated card of that type — same relationship
   * environment_mode/environment_custom_sections already have to the
   * Environment card's own fields. */
  stacks_visible_badges?: StacksCardBadge[];
  containers_visible_badges?: ContainersCardBadge[];
  /** Per-environment overrides of any field any of the 5 generated card
   * types expose, keyed by device id. Edited via the editor's per-
   * environment detail view — see EnvironmentOverride above. Plural,
   * matching show_environments/environments_order — this key is about
   * the environments section/list as a whole, not one environment's
   * card settings the way environment_mode etc. are (singular there is
   * correct: each of those really is a per-card-type default, this
   * isn't). Read via getEnvironmentOverrides(), not this field directly
   * — see that function for why. */
  environments_overrides?: Record<string, EnvironmentOverride>;
  /** @deprecated Renamed to `environments_overrides` (see above) shortly
   * after the 1.1.0 release that introduced it, while ha-dockhand-cards
   * had close to zero real users — the rename fixes a genuine
   * inconsistency (singular "environment", unlike every sibling
   * plural-when-about-the-section key) and removes the one case where
   * a top-level key collided with a global-defaults section prefix
   * (see docs/ARCHITECTURE.md §4). Read via getEnvironmentOverrides(),
   * never directly, so this fallback can be deleted from that one
   * function (and this field from this interface) once enough time has
   * passed that remaining old-style saved configs are a non-issue —
   * tracked in docs/BACKLOG.md with a target date. */
  environment_overrides?: Record<string, EnvironmentOverride>;
  exclude_device_ids?: string[];
  /** Device ids in the order the user dragged them to, in the editor.
   * Environments not listed here (newly added ones) sort after the
   * ordered ones, alphabetically. Read via getEnvironmentOrder(), not
   * this field directly — see environments_overrides above for the
   * same reasoning (plural, matches show_environments; not a
   * per-environment-card setting the way environment_mode is). */
  environments_order?: string[];
  /** @deprecated Renamed to `environments_order` (see above) — same
   * migration, same reasoning, same removal tracking in
   * docs/BACKLOG.md. Read via getEnvironmentOrder(), never directly. */
  environment_order?: string[];
  /** Section order within each environment's column, user-arranged in
   * the editor the same way environments_order is. Sections not listed
   * (newly added ones, e.g. after an update) sort after the ordered
   * ones, in DEFAULT_SECTION_ORDER's relative order. */
  section_order?: OverviewSection[];
}

/** Prefers the current environments_overrides key, falling back to the
 * deprecated environment_overrides for a config saved before the rename
 * — see that field's own doc comment in DockhandOverviewCardConfig for
 * the full reasoning and removal tracking. The only place either field
 * should ever be read from; card.ts and editor.ts both call this rather
 * than reading either key directly. */
export function getEnvironmentOverrides(config: DockhandOverviewCardConfig | undefined): Record<string, EnvironmentOverride> | undefined {
  return config?.environments_overrides ?? config?.environment_overrides;
}

/** Same fallback as getEnvironmentOverrides, for environments_order /
 * the deprecated environment_order. */
export function getEnvironmentOrder(config: DockhandOverviewCardConfig | undefined): string[] | undefined {
  return config?.environments_order ?? config?.environment_order;
}

/** Normalizes a config's deprecated environment_overrides/environment_order
 * keys to their current environments_overrides/environments_order names
 * (preferring an already-current value if somehow both are present),
 * deleting the deprecated key either way. Called once, in the editor's
 * own setConfig() — not here in types.ts as a side effect of the getters
 * above, since a pure accessor shouldn't also mutate — so this._config is
 * always in the post-rename shape from the moment the editor loads,
 * before any of its own code ever reads or writes either key again. This
 * is what lets _globalEditorConfig's generic prefix scan (see
 * docs/ARCHITECTURE.md §4) skip needing a denylist of its own: by the
 * time it runs, the deprecated keys it would otherwise have to exclude
 * simply aren't present in memory anymore. The live card (card.ts)
 * doesn't need this: it never writes anything back, and
 * getEnvironmentOverrides()/getEnvironmentOrder() already read either
 * key name correctly for rendering on their own. */
export function migrateOverviewConfig(config: DockhandOverviewCardConfig): DockhandOverviewCardConfig {
  if (config.environment_overrides === undefined && config.environment_order === undefined) return config;
  const next = { ...config } as Record<string, unknown>;
  if (next.environment_overrides !== undefined) {
    next.environments_overrides ??= next.environment_overrides;
    delete next.environment_overrides;
  }
  if (next.environment_order !== undefined) {
    next.environments_order ??= next.environment_order;
    delete next.environment_order;
  }
  return next as DockhandOverviewCardConfig;
}
