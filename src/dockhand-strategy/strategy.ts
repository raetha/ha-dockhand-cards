/**
 * The Dockhand dashboard (`strategy: { type: custom:dockhand }`): a
 * dashboard Home Assistant builds from the cards, picked from Add dashboard
 * → Community dashboards. An overview of every environment, then a
 * subview per environment with all its cards. Its settings are the
 * Overview card's (which sections, their defaults, environment order and
 * per-environment overrides), edited with the Overview card's editor.
 * Built again whenever the set of environments changes; "take control"
 * turns it into a normal dashboard. See docs/architecture.md §22.
 */
import type { LovelaceCardEditor } from 'custom-card-helpers';
import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { resolveIncludedOrdered } from '../common/environment-scope';
import { resolveEnvironmentEntities } from '../common/entity-resolver';
import { loadEditor } from '../common/editor-loader';
import { t } from '../common/i18n-card';
import { enabledSections, orderedSections, sectionSettings, type DockhandOverviewCardConfig, type OverviewSection } from '../dockhand-overview-card/types';

type Config = Record<string, unknown>;

/** The dashboard's settings: the Overview card's, less its column alignment. */
export type DockhandDashboardSettings = Omit<DockhandOverviewCardConfig, 'type' | 'align_columns'>;

export interface DockhandDashboardStrategyConfig extends DockhandDashboardSettings {
  type: 'custom:dockhand';
}

export interface DockhandEnvironmentViewConfig {
  type: 'custom:dockhand-environment';
  device_id: string;
  settings?: DockhandDashboardSettings;
  /** The dashboard's only environment: its view is the dashboard, so it
   * also shows the global schedules. */
  alone?: boolean;
}

/** Unlike the Overview card, every section is on by default, and an
 * environment's own view shows its full card. */
export const DASHBOARD_DEFAULTS = {
  show_environments: true,
  show_vulnerabilities: true,
  show_stacks: true,
  show_containers: true,
  show_updates: true,
  show_schedules: true,
  environment_mode: 'full'
} as const satisfies Partial<DockhandDashboardSettings>;

const withDefaults = (settings: Config | undefined): DockhandDashboardSettings => ({ ...DASHBOARD_DEFAULTS, ...settings }) as DockhandDashboardSettings;

const card = (name: string, config: Config = {}): Config => ({ type: `custom:dockhand-${name}-card`, ...config });

/** The environment device ids, in order: the strategy is built again only
 * when this changes, not for every container that comes and goes. */
const environmentKey = (hass: HomeAssistant): string =>
  getEnvironmentDevices(hass)
    .map((d) => `${d.deviceId}:${d.name}`)
    .join('|');

/** A view's path, from the device id: environment names can repeat across
 * Dockhand instances. */
const viewPath = (deviceId: string): string => `environment-${deviceId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const scanning = (hass: HomeAssistant, deviceId: string): boolean =>
  Boolean(resolveEnvironmentEntities(hass, deviceId, ['vulnerabilities']).found.vulnerabilities);

const CARD: Record<OverviewSection, string> = {
  environments: 'environment',
  vulnerabilities: 'vulnerability',
  stacks: 'stacks',
  containers: 'containers',
  updates: 'updates',
  schedules: 'schedules'
};

const section = (cards: Config[], extra: Config = {}): Config => ({ type: 'grid', ...extra, cards });

/** One environment's card for a section, with the section's defaults and
 * the environment's override; the list cards solo'd to it the way their
 * editors' solo action writes it. */
function environmentCard(hass: HomeAssistant, settings: DockhandDashboardSettings, deviceId: string, which: OverviewSection, alone = false): Config {
  const own = sectionSettings(settings, which, settings.environments_overrides?.[deviceId]);
  const others = getEnvironmentDevices(hass)
    .map((d) => d.deviceId)
    .filter((id) => id !== deviceId);
  if (which === 'environments' || which === 'vulnerabilities') return card(CARD[which], { ...own, device_id: deviceId });
  // Global schedules belong to no environment.
  const global = which === 'schedules' && !alone ? { include_global: false } : {};
  return card(CARD[which], { ...own, exclude_device_ids: others, ...global });
}

export class DockhandDashboardStrategy extends HTMLElement {
  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await loadEditor();
    return document.createElement('dockhand-dashboard-strategy-editor') as unknown as LovelaceCardEditor;
  }

  static getCreateSuggestions(): { title: string; icon: string } {
    return { title: 'Dockhand', icon: 'mdi:docker' };
  }

  static shouldRegenerate(_config: Config, oldHass: HomeAssistant, newHass: HomeAssistant): boolean {
    return environmentKey(oldHass) !== environmentKey(newHass);
  }

  static async generate(config: Config, hass: HomeAssistant): Promise<Config> {
    const rest = { ...config };
    delete rest.type;
    const settings = withDefaults(rest);
    const environments = resolveIncludedOrdered(getEnvironmentDevices(hass), settings.environments_order, settings.exclude_device_ids);
    if (environments.length === 0) {
      return {
        title: 'Dockhand',
        views: [{ title: 'Dockhand', path: 'overview', cards: [{ type: 'markdown', content: t(hass, 'strategy_no_environments') }] }]
      };
    }
    if (environments.length === 1) {
      // Nothing to choose between: the environment's own view is the dashboard.
      const [env] = environments;
      const view = { type: 'custom:dockhand-environment', device_id: env.deviceId, settings: rest, alone: true } satisfies DockhandEnvironmentViewConfig;
      return { title: 'Dockhand', views: [{ title: env.name, path: viewPath(env.deviceId), icon: 'mdi:docker', strategy: view }] };
    }

    // Environments across two columns, two to a row; then a column with
    // updates and the vulnerabilities of every environment, and one with
    // schedules. Each environment's heading opens its view.
    const environmentCards = environments.map((env) => ({
      type: 'vertical-stack',
      grid_options: { columns: 12 },
      cards: [
        { type: 'heading', heading: env.name, icon: 'mdi:server', tap_action: { action: 'navigate', navigation_path: viewPath(env.deviceId) } },
        card('environment', {
          ...sectionSettings(settings, 'environments', settings.environments_overrides?.[env.deviceId]),
          // The overview's own size, whatever the views use.
          mode: 'standard',
          device_id: env.deviceId
        })
      ]
    }));
    const scope = { environments_order: settings.environments_order, exclude_device_ids: settings.exclude_device_ids };
    const updatesColumn = [
      ...(settings.show_updates ? [card('updates', { ...sectionSettings(settings, 'updates', undefined), ...scope })] : []),
      // One card adding up every scanned environment's findings.
      ...(settings.show_vulnerabilities && environments.some((env) => scanning(hass, env.deviceId))
        ? [card('vulnerability', { ...sectionSettings(settings, 'vulnerabilities', undefined), ...scope, device_id: 'all' })]
        : [])
    ];
    const overview = {
      title: t(hass, 'strategy_overview'),
      path: 'overview',
      icon: 'mdi:docker',
      type: 'sections',
      max_columns: 4,
      sections: [
        section(environmentCards, { column_span: 2 }),
        ...(updatesColumn.length > 0 ? [section(updatesColumn)] : []),
        ...(settings.show_schedules ? [section([card('schedules', { show_stats: true, ...sectionSettings(settings, 'schedules', undefined), ...scope })])] : [])
      ]
    };
    const perEnvironment = environments.map((env) => ({
      title: env.name,
      path: viewPath(env.deviceId),
      // Not a tab: opened from the overview, with a back arrow to it.
      subview: true,
      // Built only when someone opens it.
      strategy: { type: 'custom:dockhand-environment', device_id: env.deviceId, settings: rest } satisfies DockhandEnvironmentViewConfig
    }));
    return { title: 'Dockhand', views: [overview, ...perEnvironment] };
  }
}

/** Which column of an environment's view each section goes in: the
 * environment card alone, the short cards together, stacks and
 * containers each on their own. */
const COLUMN: Record<OverviewSection, string> = {
  environments: 'environment',
  vulnerabilities: 'short',
  updates: 'short',
  schedules: 'short',
  stacks: 'stacks',
  containers: 'containers'
};

/** One environment's cards in Home Assistant's sections, in the dashboard
 * settings' section order. */
export class DockhandEnvironmentViewStrategy extends HTMLElement {
  static shouldRegenerate(config: Config, oldHass: HomeAssistant, newHass: HomeAssistant): boolean {
    return DockhandDashboardStrategy.shouldRegenerate(config, oldHass, newHass);
  }

  static async generate(config: DockhandEnvironmentViewConfig, hass: HomeAssistant): Promise<Config> {
    const deviceId = config.device_id;
    const settings = withDefaults(config.settings);
    const shown = enabledSections(orderedSections(settings.section_order), settings as DockhandOverviewCardConfig).filter(
      (s) => s !== 'vulnerabilities' || scanning(hass, deviceId)
    );
    const columns = new Map<string, Config[]>();
    for (const which of shown) {
      const column = columns.get(COLUMN[which]) ?? [];
      column.push(environmentCard(hass, settings, deviceId, which, config.alone));
      columns.set(COLUMN[which], column);
    }
    return { type: 'sections', max_columns: 4, sections: [...columns.values()].map((cards) => section(cards)) };
  }
}
