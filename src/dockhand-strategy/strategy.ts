/**
 * The Dockhand dashboard (`strategy: { type: custom:dockhand }`): a
 * dashboard Home Assistant builds from the cards, picked from Add dashboard
 * → Community dashboards. An overview of every environment, then a view
 * per environment with all its cards. Built again whenever the set of
 * environments changes; "take control" turns it into a normal dashboard.
 * See docs/architecture.md §22.
 */
import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { resolveEnvironmentEntities } from '../common/entity-resolver';
import { t } from '../common/i18n-card';

type Config = Record<string, unknown>;

export interface DockhandEnvironmentViewConfig {
  type: 'custom:dockhand-environment';
  device_id: string;
}

const card = (name: string, config: Config = {}): Config => ({ type: `custom:dockhand-${name}-card`, ...config });

/** A list card solo'd to one environment, the way its editor's solo
 * action writes it. */
const only = (hass: HomeAssistant, deviceId: string): Config => ({
  exclude_device_ids: getEnvironmentDevices(hass)
    .map((d) => d.deviceId)
    .filter((id) => id !== deviceId)
});

/** The environment device ids, in order: the strategy is built again only
 * when this changes, not for every container that comes and goes. */
const environmentKey = (hass: HomeAssistant): string =>
  getEnvironmentDevices(hass)
    .map((d) => `${d.deviceId}:${d.name}`)
    .join('|');

/** A view's path, from the device id: environment names can repeat across
 * Dockhand instances. */
const viewPath = (deviceId: string): string => `environment-${deviceId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export class DockhandDashboardStrategy extends HTMLElement {
  static noEditor = true;

  static getCreateSuggestions(): { title: string; icon: string } {
    return { title: 'Dockhand', icon: 'mdi:docker' };
  }

  static shouldRegenerate(_config: Config, oldHass: HomeAssistant, newHass: HomeAssistant): boolean {
    return environmentKey(oldHass) !== environmentKey(newHass);
  }

  static async generate(_config: Config, hass: HomeAssistant): Promise<Config> {
    const environments = getEnvironmentDevices(hass);
    if (environments.length === 0) {
      return {
        title: 'Dockhand',
        views: [{ title: 'Dockhand', path: 'overview', cards: [{ type: 'markdown', content: t(hass, 'strategy_no_environments') }] }]
      };
    }
    const overview = {
      title: t(hass, 'strategy_overview'),
      path: 'overview',
      icon: 'mdi:docker',
      type: 'sections',
      max_columns: 4,
      sections: [
        ...environments.map((env) => ({
          type: 'grid',
          cards: [
            { type: 'heading', heading: env.name, icon: 'mdi:server', tap_action: { action: 'navigate', navigation_path: viewPath(env.deviceId) } },
            card('environment', { device_id: env.deviceId, mode: 'standard' })
          ]
        })),
        { type: 'grid', cards: [card('updates'), card('schedules', { show_stats: true })] }
      ]
    };
    const perEnvironment = environments.map((env) => ({
      title: env.name,
      path: viewPath(env.deviceId),
      icon: 'mdi:server',
      // Built only when someone opens it.
      strategy: { type: 'custom:dockhand-environment', device_id: env.deviceId } satisfies DockhandEnvironmentViewConfig
    }));
    return { title: 'Dockhand', views: [overview, ...perEnvironment] };
  }
}

/** One environment: its summary, vulnerabilities (when scanning is set up),
 * updates, stacks, containers and schedules, in Home Assistant's sections. */
export class DockhandEnvironmentViewStrategy extends HTMLElement {
  static shouldRegenerate(config: Config, oldHass: HomeAssistant, newHass: HomeAssistant): boolean {
    return DockhandDashboardStrategy.shouldRegenerate(config, oldHass, newHass);
  }

  static async generate(config: DockhandEnvironmentViewConfig, hass: HomeAssistant): Promise<Config> {
    const deviceId = config.device_id;
    const scoped = only(hass, deviceId);
    const scanning = Boolean(resolveEnvironmentEntities(hass, deviceId, ['vulnerabilities']).found.vulnerabilities);
    const section = (...cards: Config[]): Config => ({ type: 'grid', cards });
    return {
      type: 'sections',
      max_columns: 4,
      sections: [
        section(card('environment', { device_id: deviceId, mode: 'full' }), ...(scanning ? [card('vulnerability', { device_id: deviceId })] : [])),
        section(card('updates', scoped), card('schedules', { ...scoped, include_global: false })),
        section(card('stacks', scoped)),
        section(card('containers', scoped))
      ]
    };
  }
}
