/**
 * The Dockhand dashboard (`strategy: { type: custom:dockhand }`): a
 * dashboard Home Assistant builds from the cards, picked from Add dashboard
 * → Community dashboards. An overview of every environment, then a
 * subview per environment with all its cards, each laid out in columns
 * the settings choose, and under each environment a page of Stack cards
 * and one of Container cards. Every page of a kind shares its card
 * settings (`cards`), so changing a card on one environment's page changes
 * it on all of them. Built again whenever the set of environments
 * changes; "take control" turns it into a normal dashboard. See
 * docs/architecture.md §22.
 */
import type { LovelaceCardEditor } from 'custom-card-helpers';
import type { HomeAssistant } from '../common/ha-types';
import { getContainerDevicesForEnvironment, getContainerName, getEnvironmentDevices, getStackDevicesForEnvironment, getStackName } from '../common/device-utils';
import { resolveIncludedOrdered } from '../common/environment-scope';
import { resolveEnvironmentEntities } from '../common/entity-resolver';
import { loadEditor } from '../common/editor-loader';
import { t } from '../common/i18n-card';
import type { OverviewSection } from '../dockhand-overview-card/types';

type Config = Record<string, unknown>;
type CardSettings = Record<string, unknown>;

/** The cards the overview can show. */
export type OverviewPageCard = 'environments' | 'updates' | 'vulnerabilities' | 'schedules';

export const OVERVIEW_PAGE_CARDS: OverviewPageCard[] = ['environments', 'updates', 'vulnerabilities', 'schedules'];
export const ENVIRONMENT_PAGE_CARDS: OverviewSection[] = ['environments', 'vulnerabilities', 'updates', 'schedules', 'stacks', 'containers'];

/** Environments on the left (two columns' worth once there are three or
 * more), vulnerabilities above updates (a fixed height above one that
 * grows, so it stays in view), then schedules. */
export const DEFAULT_OVERVIEW_LAYOUT: OverviewPageCard[][] = [['environments'], ['vulnerabilities', 'updates'], ['schedules']];
/** The full Environment card alone, the short cards together, then stacks
 * and containers. */
export const DEFAULT_ENVIRONMENT_LAYOUT: OverviewSection[][] = [['environments'], ['vulnerabilities', 'updates', 'schedules'], ['stacks'], ['containers']];
export const MAX_COLUMNS = 4;

/** Each kind of page's card settings, by card. */
export interface DashboardCards {
  overview?: Partial<Record<OverviewPageCard, CardSettings>>;
  environment?: Partial<Record<OverviewSection, CardSettings>>;
  /** The Stack card on every Stacks page. */
  stack?: CardSettings;
  /** The Container card on every Containers page. */
  container?: CardSettings;
}

export type PageKind = keyof DashboardCards;

/** The dashboard's settings. Show/hide and order on a page come from its
 * layout. */
export interface DockhandDashboardSettings {
  /** Only this Dockhand instance's environments (a config entry id). */
  config_entry_id?: string;
  environments_order?: string[];
  exclude_device_ids?: string[];
  /** Columns of cards, left to right; a card in no column isn't shown. */
  overview_layout?: OverviewPageCard[][];
  environment_layout?: OverviewSection[][];
  cards?: DashboardCards;
}

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

/** A page of one card per stack, or per container, of one environment. */
export interface DockhandDevicesViewConfig {
  type: 'custom:dockhand-devices';
  device_id: string;
  kind: 'stacks' | 'containers';
  settings?: DockhandDashboardSettings;
}

/** What a card shows when its settings don't say: the overview's
 * environments at the standard size and its schedules with their counts,
 * an environment's own page with its full card. */
export const CARD_DEFAULTS: { [P in PageKind]?: Record<string, CardSettings> } = {
  overview: { environments: { mode: 'standard' }, schedules: { show_stats: true } },
  environment: { environments: { mode: 'full' } }
};

/** A card's settings on a kind of page: its defaults, then what was set.
 * `which` names the card on the overview and environment pages. */
export function cardSettings(settings: DockhandDashboardSettings, page: PageKind, which?: OverviewSection): CardSettings {
  if (page === 'stack' || page === 'container') return { ...(settings.cards?.[page] ?? {}) };
  const saved = (settings.cards?.[page] as Record<string, CardSettings> | undefined)?.[which!];
  return { ...CARD_DEFAULTS[page]?.[which!], ...saved };
}

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
const devicesPath = (deviceId: string, kind: DockhandDevicesViewConfig['kind']): string => `${viewPath(deviceId)}-${kind}`;

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

/** A heading opening one of the environment's Stacks or Containers pages,
 * above that list. */
const devicesHeading = (hass: HomeAssistant, deviceId: string, kind: DockhandDevicesViewConfig['kind']): Config => ({
  type: 'heading',
  heading: t(hass, kind === 'stacks' ? 'strategy_stack_details' : 'strategy_container_details'),
  heading_style: 'subtitle',
  icon: kind === 'stacks' ? 'mdi:layers-outline' : 'mdi:docker',
  tap_action: { action: 'navigate', navigation_path: devicesPath(deviceId, kind) }
});

/** One environment's card for a section, with the environment pages'
 * settings; the list cards solo'd to it the way their editors' solo
 * action writes it. */
function environmentCard(hass: HomeAssistant, settings: DockhandDashboardSettings, deviceId: string, which: OverviewSection, alone = false): Config {
  const own = cardSettings(settings, 'environment', which);
  const others = getEnvironmentDevices(hass)
    .map((d) => d.deviceId)
    .filter((id) => id !== deviceId);
  if (which === 'environments') return card(CARD[which], { ...own, device_id: deviceId });
  // Global schedules belong to no environment.
  const global = which === 'schedules' && !alone ? { include_global: false } : {};
  return card(CARD[which], { ...own, exclude_device_ids: others, ...global });
}

/** An environment's Stacks and Containers pages: subviews, built only when
 * opened, with a back arrow to the environment's page. */
function devicesViews(env: { deviceId: string; name: string }, settings: Config): Config[] {
  return (['stacks', 'containers'] as const).map((kind) => ({
    title: env.name,
    path: devicesPath(env.deviceId, kind),
    subview: true,
    back_path: viewPath(env.deviceId),
    strategy: { type: 'custom:dockhand-devices', device_id: env.deviceId, kind, settings } satisfies DockhandDevicesViewConfig
  }));
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
    const settings = rest as DockhandDashboardSettings;
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
      return { title: 'Dockhand', views: [{ title: env.name, path: viewPath(env.deviceId), icon: 'mdi:docker', strategy: view }, ...devicesViews(env, rest)] };
    }

    // Two environments fit one column; from three they take two, two to a
    // row. Each environment's heading opens its view.
    const wide = environments.length >= 3;
    const scope = { environments_order: settings.environments_order, exclude_device_ids: excluded };
    const cardsFor = (which: OverviewPageCard): Config[] => {
      const own = cardSettings(settings, 'overview', which);
      switch (which) {
        case 'environments':
          return environments.map((env) => ({
            type: 'vertical-stack',
            grid_options: { columns: wide ? 12 : 'full' },
            cards: [
              { type: 'heading', heading: env.name, icon: 'mdi:server', tap_action: { action: 'navigate', navigation_path: viewPath(env.deviceId) } },
              card('environment', { ...own, device_id: env.deviceId })
            ]
          }));
        case 'updates':
          return [card('updates', { ...own, ...scope })];
        case 'vulnerabilities':
          // One card adding up every scanned environment's findings.
          return environments.some((env) => scanning(hass, env.deviceId)) ? [card('vulnerability', { ...own, ...scope })] : [];
        case 'schedules':
          return [card('schedules', { ...own, ...scope })];
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
    const perEnvironment = environments.flatMap((env) => [
      {
        title: env.name,
        path: viewPath(env.deviceId),
        // Not a tab: opened from the overview, with a back arrow to it.
        subview: true,
        // Built only when someone opens it.
        strategy: { type: 'custom:dockhand-environment', device_id: env.deviceId, settings: rest } satisfies DockhandEnvironmentViewConfig
      },
      ...devicesViews(env, rest)
    ]);
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
    const settings = config.settings ?? {};
    const sections = cleanLayout(settings.environment_layout, ENVIRONMENT_PAGE_CARDS, DEFAULT_ENVIRONMENT_LAYOUT).flatMap((column) => {
      const cards = column
        .filter((which) => which !== 'vulnerabilities' || scanning(hass, deviceId))
        .flatMap((which) => {
          const own = environmentCard(hass, settings, deviceId, which, config.alone);
          return which === 'stacks' || which === 'containers' ? [devicesHeading(hass, deviceId, which), own] : [own];
        });
      return cards.length > 0 ? [section(cards)] : [];
    });
    return { type: 'sections', max_columns: Math.max(1, sections.length), sections };
  }
}

/** The stacks or containers of one environment, one card each, by name.
 * Built again when they come and go. */
export class DockhandDevicesViewStrategy extends HTMLElement {
  static shouldRegenerate(config: DockhandDevicesViewConfig, oldHass: HomeAssistant, newHass: HomeAssistant): boolean {
    const key = (hass: HomeAssistant) =>
      devices(hass, config)
        .map((d) => d.id)
        .join('|');
    return key(oldHass) !== key(newHass);
  }

  static async generate(config: DockhandDevicesViewConfig, hass: HomeAssistant): Promise<Config> {
    const settings = config.settings ?? {};
    const own = cardSettings(settings, config.kind === 'stacks' ? 'stack' : 'container');
    const type = config.kind === 'stacks' ? 'stack' : 'container';
    const sections = devices(hass, config).map((d) => section([card(type, { ...own, device_id: d.id })]));
    if (sections.length === 0) {
      const empty = t(hass, config.kind === 'stacks' ? 'strategy_no_stacks' : 'strategy_no_containers');
      return { type: 'sections', max_columns: 1, sections: [section([{ type: 'markdown', content: empty }])] };
    }
    return { type: 'sections', max_columns: MAX_COLUMNS, sections };
  }
}

function devices(hass: HomeAssistant, config: DockhandDevicesViewConfig) {
  const env = hass.devices?.[config.device_id];
  if (!env) return [];
  const list = config.kind === 'stacks' ? getStackDevicesForEnvironment(hass, env) : getContainerDevicesForEnvironment(hass, env);
  const name = config.kind === 'stacks' ? getStackName : getContainerName;
  return [...list].sort((a, b) => (name(a) ?? a.name ?? '').localeCompare(name(b) ?? b.name ?? ''));
}
