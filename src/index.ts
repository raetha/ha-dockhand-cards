import { CARD_VERSION, DOCKHAND_DOMAIN, ENV_TRANSLATION_KEYS } from './common/const';
import {
  isEnvironmentDevice,
  isContainerDevice,
  isStackDevice,
  isScheduleDevice,
  getEnvIdForStackDevice,
  getEnvIdForContainerDevice,
  getEnvIdForScheduleDevice,
  getEnvDeviceIdForEnvId
} from './common/device-utils';
import type { HomeAssistant } from './common/ha-types';

import { DockhandEnvironmentCard } from './dockhand-environment-card/card';
import { DockhandVulnerabilityCard } from './dockhand-vulnerability-card/card';
import { DockhandStackCard } from './dockhand-stack-card/card';
import { DockhandContainerCard } from './dockhand-container-card/card';
import { DockhandStacksCard } from './dockhand-stacks-card/card';
import { DockhandContainersCard } from './dockhand-containers-card/card';
import { DockhandUpdatesCard } from './dockhand-updates-card/card';
import { DockhandOverviewCard } from './dockhand-overview-card/card';
import { DockhandSchedulesCard } from './dockhand-schedules-card/card';

customElements.define('dockhand-environment-card', DockhandEnvironmentCard);
customElements.define('dockhand-vulnerability-card', DockhandVulnerabilityCard);
customElements.define('dockhand-stack-card', DockhandStackCard);
customElements.define('dockhand-container-card', DockhandContainerCard);
customElements.define('dockhand-stacks-card', DockhandStacksCard);
customElements.define('dockhand-containers-card', DockhandContainersCard);
customElements.define('dockhand-updates-card', DockhandUpdatesCard);
customElements.define('dockhand-overview-card', DockhandOverviewCard);
customElements.define('dockhand-schedules-card', DockhandSchedulesCard);

// Each card's own editor is registered lazily via its getConfigElement()
// (dynamically imported, self-registers on first use) to keep the initial
// bundle small.

type EntitySuggestion = { config: Record<string, unknown>; label?: string };

declare global {
  interface Window {
    customCards: {
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
      getEntitySuggestion?: (hass: HomeAssistant, entityId: string) => EntitySuggestion | EntitySuggestion[] | undefined;
    }[];
  }
}

window.customCards = window.customCards || [];

window.customCards.push({
  type: 'dockhand-environment-card',
  name: 'Dockhand Environment Card',
  description: 'Shows a Dockhand-managed Docker environment, modeled on Dockhand’s own dashboard tile.',
  preview: true,
  documentationURL: 'https://github.com/raetha/ha-dockhand-cards',
  getEntitySuggestion(hass, entityId) {
    const entry = hass.entities?.[entityId];
    if (!entry || entry.platform !== DOCKHAND_DOMAIN || !entry.device_id) return undefined;
    const device = hass.devices?.[entry.device_id];
    if (!device || !isEnvironmentDevice(device)) return undefined;

    const envSuggestion: EntitySuggestion = {
      config: { type: 'custom:dockhand-environment-card', device_id: device.id, mode: 'standard' },
      label: 'Environment overview'
    };

    // The environment's own aggregate sensors point at a more specific
    // card too, in addition to the general environment card — e.g.
    // picking the "stacks" count sensor probably means the person wants
    // to see the stacks themselves, not just the environment tile.
    if (entry.translation_key === ENV_TRANSLATION_KEYS.vulnerabilities) {
      return [
        { config: { type: 'custom:dockhand-vulnerability-card', device_id: device.id }, label: 'Vulnerability summary' },
        envSuggestion
      ];
    }
    if (entry.translation_key === ENV_TRANSLATION_KEYS.stacks) {
      return [{ config: { type: 'custom:dockhand-stacks-card', device_id: device.id }, label: 'All stacks' }, envSuggestion];
    }
    if (entry.translation_key === ENV_TRANSLATION_KEYS.containers) {
      return [{ config: { type: 'custom:dockhand-containers-card', device_id: device.id }, label: 'All containers' }, envSuggestion];
    }
    return envSuggestion;
  }
});

window.customCards.push({
  type: 'dockhand-vulnerability-card',
  name: 'Dockhand Vulnerability Card',
  description: "Shows an environment's vulnerability scan summary by severity.",
  preview: true,
  documentationURL: 'https://github.com/raetha/ha-dockhand-cards'
  // Deliberately no getEntitySuggestion here — it's offered as a variant
  // from the environment card's suggestion above instead, so picking the
  // vulnerabilities entity doesn't show this card twice.
});

window.customCards.push({
  type: 'dockhand-stack-card',
  name: 'Dockhand Stack Card',
  description: 'Status, updates, and git sync details for one Dockhand Compose stack.',
  preview: true,
  documentationURL: 'https://github.com/raetha/ha-dockhand-cards',
  getEntitySuggestion(hass, entityId) {
    const entry = hass.entities?.[entityId];
    if (!entry || entry.platform !== DOCKHAND_DOMAIN || !entry.device_id) return undefined;
    const device = hass.devices?.[entry.device_id];
    if (!device || !isStackDevice(device)) return undefined;

    const suggestions: EntitySuggestion[] = [{ config: { type: 'custom:dockhand-stack-card', device_id: device.id }, label: 'This stack' }];
    const envId = getEnvIdForStackDevice(device);
    const envDeviceId = envId !== null ? getEnvDeviceIdForEnvId(hass, envId) : null;
    if (envDeviceId) {
      suggestions.push({ config: { type: 'custom:dockhand-stacks-card', device_id: envDeviceId }, label: 'All stacks in this environment' });
    }
    return suggestions;
  }
});

window.customCards.push({
  type: 'dockhand-container-card',
  name: 'Dockhand Container Card',
  description: 'State, health, CPU/memory, and I/O for one Docker container.',
  preview: true,
  documentationURL: 'https://github.com/raetha/ha-dockhand-cards',
  getEntitySuggestion(hass, entityId) {
    const entry = hass.entities?.[entityId];
    if (!entry || entry.platform !== DOCKHAND_DOMAIN || !entry.device_id) return undefined;
    const device = hass.devices?.[entry.device_id];
    if (!device || !isContainerDevice(device)) return undefined;

    const suggestions: EntitySuggestion[] = [
      { config: { type: 'custom:dockhand-container-card', device_id: device.id }, label: 'This container' }
    ];
    const envId = getEnvIdForContainerDevice(device);
    const envDeviceId = envId !== null ? getEnvDeviceIdForEnvId(hass, envId) : null;
    if (envDeviceId) {
      suggestions.push({
        config: { type: 'custom:dockhand-containers-card', device_id: envDeviceId },
        label: 'All containers in this environment'
      });
    }
    return suggestions;
  }
});

window.customCards.push({
  type: 'dockhand-stacks-card',
  name: 'Dockhand Stacks Card',
  description: 'Every Compose stack in one environment, one compact row each.',
  preview: true,
  documentationURL: 'https://github.com/raetha/ha-dockhand-cards'
  // No getEntitySuggestion of its own — it's offered as the second option
  // from both the environment card's "stacks" sensor suggestion and the
  // singular stack card's suggestion above, covering the two realistic
  // entry points (environment-level sensor, or a specific stack's entity).
});

window.customCards.push({
  type: 'dockhand-containers-card',
  name: 'Dockhand Containers Card',
  description: 'Every container in one environment, one compact row each.',
  preview: true,
  documentationURL: 'https://github.com/raetha/ha-dockhand-cards'
});

window.customCards.push({
  type: 'dockhand-updates-card',
  name: 'Dockhand Updates Card',
  description: 'Every pending container update, for one environment or all of them, with a bulk-update action.',
  preview: true,
  documentationURL: 'https://github.com/raetha/ha-dockhand-cards',
  getEntitySuggestion(hass, entityId) {
    const entry = hass.entities?.[entityId];
    if (!entry || entry.platform !== DOCKHAND_DOMAIN || !entityId.startsWith('update.') || !entry.device_id) return undefined;
    const device = hass.devices?.[entry.device_id];
    if (!device || !isContainerDevice(device)) return undefined;
    const envId = getEnvIdForContainerDevice(device);
    const envDeviceId = envId !== null ? getEnvDeviceIdForEnvId(hass, envId) : null;
    return {
      config: { type: 'custom:dockhand-updates-card', scope: envDeviceId ? 'environment' : 'all', device_id: envDeviceId ?? undefined },
      label: 'Pending updates'
    };
  }
});

window.customCards.push({
  type: 'dockhand-overview-card',
  name: 'Dockhand Overview',
  description: 'One big dashboard: every environment, with stacks/containers/vulnerabilities alongside it — intended to fill a whole dashboard view.',
  preview: true,
  documentationURL: 'https://github.com/raetha/ha-dockhand-cards'
});

window.customCards.push({
  type: 'dockhand-schedules-card',
  name: 'Dockhand Schedules Card',
  description: 'Every schedule — container updates, git syncs, environment checks, image prunes, and system jobs — for one environment or all of them.',
  preview: true,
  documentationURL: 'https://github.com/raetha/ha-dockhand-cards',
  getEntitySuggestion(hass, entityId) {
    const entry = hass.entities?.[entityId];
    if (!entry || entry.platform !== DOCKHAND_DOMAIN || !entry.device_id) return undefined;
    if (entry.translation_key !== 'next_run' && entry.translation_key !== 'last_status') return undefined;
    const device = hass.devices?.[entry.device_id];
    if (!device || !isScheduleDevice(device)) return undefined;
    const envId = getEnvIdForScheduleDevice(hass, device);
    const envDeviceId = envId !== null ? getEnvDeviceIdForEnvId(hass, envId) : null;
    // No scope/device_id fields anymore — "just this environment" is
    // expressed the same way the editor's own per-row "solo" action
    // writes it: exclude every other known environment, same as picking
    // scope: 'environment' + this device_id used to mean.
    const excludeOthers = envDeviceId ? Object.values(hass.devices ?? {}).filter((d) => isEnvironmentDevice(d) && d.id !== envDeviceId).map((d) => d.id) : [];
    return {
      config: { type: 'custom:dockhand-schedules-card', ...(envDeviceId ? { exclude_device_ids: excludeOthers } : {}) },
      label: envDeviceId ? 'Schedules in this environment' : 'All schedules'
    };
  }
});

console.info(`%c HA-DOCKHAND-CARDS %c v${CARD_VERSION} `, 'color: white; background: #0ea5e9; font-weight: 700;', 'color: #0ea5e9; background: white; font-weight: 700;');
