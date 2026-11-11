/**
 * The Dockhand dashboard (`strategy: { type: custom:dockhand }`): a
 * dashboard Home Assistant builds from the cards, picked from Add dashboard
 * → Community dashboards. An overview of every environment, then a
 * subview per environment with all its cards, each laid out in columns
 * the settings choose. The cards' own settings are the Overview card's
 * (section defaults and per-environment overrides). Built again whenever
 * the set of environments changes; "take control" turns it into a normal
 * dashboard. See docs/architecture.md §22.
 */
import type { LovelaceCardEditor } from 'custom-card-helpers';
import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { resolveIncludedOrdered } from '../common/environment-scope';
import { resolveEnvironmentEntities } from '../common/entity-resolver';
import { loadEditor } from '../common/editor-loader';
import { t } from '../common/i18n-card';
import { sectionSettings, type DockhandOverviewCardConfig, type OverviewSection } from '../dockhand-overview-card/types';

type Config = Record<string, unknown>;

/** The cards the overview can show. */
export type OverviewPageCard = 'environments' | 'updates' | 'vulnerabilities' | 'schedules';

export const OVERVIEW_PAGE_CARDS: OverviewPageCard[] = ['environments', 'updates', 'vulnerabilities', 'schedules'];
export const ENVIRONMENT_PAGE_CARDS: OverviewSection[] = ['environments', 'vulnerabilities', 'updates', 'schedules', 'stacks', 'containers'];

/** Environments on the left (two columns' worth once there are three or
 * more), updates and vulnerabilities, then schedules. */
export const DEFAULT_OVERVIEW_LAYOUT: OverviewPageCard[][] = [['environments'], ['updates', 'vulnerabilities'], ['schedules']];
/** The full Environment card alone, the short cards together, then stacks
 * and containers. */
export const DEFAULT_ENVIRONMENT_LAYOUT: OverviewSection[][] = [['environments'], ['vulnerabilities', 'updates', 'schedules'], ['stacks'], ['containers']];
export const MAX_COLUMNS = 4;

/** The dashboard's settings: the Overview card's card settings (section
 * defaults, environment order and exclusions, overrides), plus its own
 * layout and instance. Show/hide and order come from the layouts. */
export type DockhandDashboardSettings = Omit<DockhandOverviewCardConfig, 'type' | 'align_columns' | 'section_order'> & {
  /** Only this Dockhand instance's environments (a config entry id). */
  config_entry_id?: string;
  /** Columns of cards, left to right; a card in no column isn't shown. */
  overview_layout?: OverviewPageCard[][];
  environment_layout?: OverviewSection[][];
};

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

/** An environment's view shows its full card, unless set otherwise. */
export const DASHBOARD_DEFAULTS = { environment_mode: 'full' } as const satisfies Partial<DockhandDashboardSettings>;

const withDefaults = (settings: Config | undefined): DockhandDashboardSettings => ({ ...DASHBOARD_DEFAULTS, ...settings }) as DockhandDashboardSettings;

/** `saved`, keeping only known cards, each once, in at most MAX_COLUMNS
 * columns; the default when nothing is saved. */
export function cleanLayout<T extends string>(saved: unknown, known: readonly T[], fallback: T[][]): T[][] {
  if (!Array.isArray(saved)) return fallback.map((column) => [...column]);
  const seen = new Set<T>();
  return saved.slice(0, MAX_COLUMNS).map((column) =>
    (Array.isArray(column) ? column : []).filter((key): key is T => {
      if (!known.includes(key as T) || seen.has(key as T)) return false;
      seen.add(key as T);
      return true;
    })
  );
}

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

/** Environments left out: the settings' own, and with an instance chosen,
 * every other instance's. */
export function excludedEnvironments(hass: HomeAssistant, settings: DockhandDashboardSettings): string[] {
  const other = settings.config_entry_id
    ? getEnvironmentDevices(hass)
        .map((d) => d.deviceId)
        .filter((id) => hass.devices?.[id]?.config_entry_id !== settings.config_entry_id)
    : [];
  return [...new Set([...(settings.exclude_device_ids ?? []), ...other])];
}

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
    const excluded = excludedEnvironments(hass, settings);
    const environments = resolveIncludedOrdered(getEnvironmentDevices(hass), settings.environments_order, excluded);
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

    // Two environments fit one column; from three they take two, two to a
    // row. Each environment's heading opens its view.
    const wide = environments.length >= 3;
    const scope = { environments_order: settings.environments_order, exclude_device_ids: excluded };
    const cardsFor = (which: OverviewPageCard): Config[] => {
      switch (which) {
        case 'environments':
          return environments.map((env) => ({
            type: 'vertical-stack',
            grid_options: { columns: wide ? 12 : 'full' },
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
        case 'updates':
          return [card('updates', { ...sectionSettings(settings, 'updates', undefined), ...scope })];
        case 'vulnerabilities':
          // One card adding up every scanned environment's findings.
          return environments.some((env) => scanning(hass, env.deviceId))
            ? [card('vulnerability', { ...sectionSettings(settings, 'vulnerabilities', undefined), ...scope, device_id: 'all' })]
            : [];
        case 'schedules':
          return [card('schedules', { show_stats: true, ...sectionSettings(settings, 'schedules', undefined), ...scope })];
      }
    };
    const sections = cleanLayout(settings.overview_layout, OVERVIEW_PAGE_CARDS, DEFAULT_OVERVIEW_LAYOUT).flatMap((column) => {
      const spans = wide && column.includes('environments');
      // In a two-column section, the other cards keep its whole width.
      const cards = column.flatMap((which) => cardsFor(which).map((c) => (spans && which !== 'environments' ? { ...c, grid_options: { columns: 'full' } } : c)));
      return cards.length > 0 ? [section(cards, spans ? { column_span: 2 } : {})] : [];
    });
    const overview = {
      title: t(hass, 'strategy_overview'),
      path: 'overview',
      icon: 'mdi:docker',
      type: 'sections',
      max_columns: Math.max(1, sections.reduce<number>((n, s) => n + ((s.column_span as number | undefined) ?? 1), 0)),
      sections
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

/** One environment's cards in Home Assistant's sections, in the columns
 * the settings lay out. */
export class DockhandEnvironmentViewStrategy extends HTMLElement {
  static shouldRegenerate(config: Config, oldHass: HomeAssistant, newHass: HomeAssistant): boolean {
    return DockhandDashboardStrategy.shouldRegenerate(config, oldHass, newHass);
  }

  static async generate(config: DockhandEnvironmentViewConfig, hass: HomeAssistant): Promise<Config> {
    const deviceId = config.device_id;
    const settings = withDefaults(config.settings);
    const sections = cleanLayout(settings.environment_layout, ENVIRONMENT_PAGE_CARDS, DEFAULT_ENVIRONMENT_LAYOUT).flatMap((column) => {
      const cards = column
        .filter((which) => which !== 'vulnerabilities' || scanning(hass, deviceId))
        .map((which) => environmentCard(hass, settings, deviceId, which, config.alone));
      return cards.length > 0 ? [section(cards)] : [];
    });
    return { type: 'sections', max_columns: Math.max(1, sections.length), sections };
  }
}
