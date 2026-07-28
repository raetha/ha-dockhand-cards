import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices, getContainerDevicesForEnvironment, getEnvId } from '../common/device-utils';
import { resolveContainerEntities, findPrimaryEntityByDomain, type ResolutionResult } from '../common/entity-resolver';
import { getDockhandBaseUrl, SETTINGS_LINK_UNAVAILABLE_ICON } from '../common/format';
import { t } from '../common/i18n';
import type { ContainerTranslationKey } from '../common/const';
import { DEFAULT_CONTAINERS_BADGES, type DockhandContainersCardConfig } from './types';
import { cardStyles } from './styles';

// Matches Dockhand's own statusTypes color list (src/routes/containers/+page.svelte).
const STATE_ICON: Record<string, { icon: string; cls: 'ok' | 'warn' | 'error' | 'info' | 'neutral' }> = {
  running: { icon: 'mdi:play-circle', cls: 'ok' },
  paused: { icon: 'mdi:pause-circle', cls: 'warn' },
  restarting: { icon: 'mdi:refresh-circle', cls: 'error' },
  exited: { icon: 'mdi:stop-circle', cls: 'error' },
  created: { icon: 'mdi:plus-circle-outline', cls: 'info' },
  dead: { icon: 'mdi:close-circle', cls: 'neutral' }
};

interface ContainerRow {
  name: string;
  found: ResolutionResult<ContainerTranslationKey>['found'];
  updateEntityId: string | null;
}

export class DockhandContainersCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandContainersCardConfig;
  @state() private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(hass: HomeAssistant): Partial<DockhandContainersCardConfig> {
    const devices = getEnvironmentDevices(hass);
    return { type: 'custom:dockhand-containers-card', device_id: devices[0]?.deviceId ?? '' };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor');
    return document.createElement('dockhand-containers-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandContainersCardConfig): void {
    if (!config.device_id) {
      throw new Error('Please select a Dockhand environment.');
    }
    this._config = { show_settings_link: true, ...config };
  }

  set config(config: DockhandContainersCardConfig) {
    this.setConfig(config);
  }

  getCardSize(): number {
    if (!this._hass || !this._config) return 3;
    const envId = getEnvId(this._hass.devices[this._config.device_id]);
    const count = envId !== null ? getContainerDevicesForEnvironment(this._hass, envId).length : 0;
    return Math.max(2, Math.ceil(count / 2) + 1);
  }

  getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 2 };
  }

  private _moreInfo(entityId: string | null | undefined): void {
    if (!entityId) return;
    fireEvent(this, 'hass-more-info', { entityId });
  }

  private _onKeydown(entityId: string | null | undefined) {
    return (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._moreInfo(entityId);
      }
    };
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    const device = this._hass.devices?.[this._config.device_id];
    if (!device) {
      return html`<ha-card>
        <div class="error-state core-message">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>Environment device not found. It may have been removed — edit this card to pick another.</span>
        </div>
      </ha-card>`;
    }

    const envId = getEnvId(device);
    const containerDevices = envId !== null ? getContainerDevicesForEnvironment(this._hass, envId) : [];
    const name = this._config.title || device.name_by_user || device.name || 'Environment';
    const base = getDockhandBaseUrl(device.configuration_url);

    const rows: ContainerRow[] = containerDevices
      .map((d) => {
        const { found } = resolveContainerEntities(this._hass!, d.id, ['state', 'health', 'cpuPercent', 'memoryPercent']);
        if (!found.state) return null;
        const update = findPrimaryEntityByDomain(this._hass!, d.id, 'update');
        return {
          name: found.state.state.attributes.name || d.name_by_user || d.name || d.id,
          found,
          updateEntityId: update?.state.state === 'on' ? update.entityId : null
        };
      })
      .filter((r): r is ContainerRow => r !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return html`
      <ha-card>
        <div class="header">
          <div class="header-left">
            <div class="icon-badge">
              <ha-icon icon="mdi:docker"></ha-icon>
            </div>
            <div class="name-block"><span class="name">${name} — Containers</span></div>
          </div>
          ${this._config?.show_settings_link
            ? base
              ? html`<span class="settings-link" title=${t(this._hass, 'settings_link_view_containers')} @click=${() => window.open(`${base}/containers`, '_blank', 'noopener,noreferrer')}>
                  <ha-icon icon="mdi:open-in-new"></ha-icon>
                </span>`
              : html`<span class="settings-link unavailable" title=${t(this._hass, 'settings_link_unavailable')}>
                  <ha-icon icon=${SETTINGS_LINK_UNAVAILABLE_ICON}></ha-icon>
                </span>`
            : nothing}
        </div>
        <div class="body">
          ${rows.length === 0
            ? html`<div class="empty-note">No containers found for this environment yet.</div>`
            : html`<div class="row-list">${rows.map((r) => this._renderRow(r))}</div>`}
        </div>
      </ha-card>
    `;
  }

  private _renderRow(row: ContainerRow): TemplateResult {
    const found = row.found;
    const st = found.state!.state.state;
    const stateIcon = STATE_ICON[st] ?? { icon: 'mdi:help-circle', cls: 'neutral' as const };
    const health = found.health?.state.state;
    const healthId = found.health?.entityId;
    const cpu = found.cpuPercent ? Number(found.cpuPercent.state.state) : undefined;
    const cpuId = found.cpuPercent?.entityId;
    const mem = found.memoryPercent ? Number(found.memoryPercent.state.state) : undefined;
    const memId = found.memoryPercent?.entityId;
    const id = found.state!.entityId;
    const visible = new Set(this._config?.visible_badges ?? DEFAULT_CONTAINERS_BADGES);

    return html`
      <div class="item-row clickable" tabindex="0" role="button" @click=${() => this._moreInfo(id)} @keydown=${this._onKeydown(id)}>
        <ha-icon class="item-status-icon ${stateIcon.cls}" icon=${stateIcon.icon}></ha-icon>
        <span class="item-name">${row.name}</span>
        ${(health === 'healthy' || health === 'unhealthy' || health === 'starting') && visible.has('health')
          ? html`<span
              class="item-badge ${health === 'healthy' ? 'healthy' : health === 'unhealthy' ? 'unhealthy' : ''} clickable"
              tabindex="0"
              role="button"
              title=${health}
              @click=${(e: Event) => {
                e.stopPropagation();
                this._moreInfo(healthId);
              }}
              @keydown=${this._onKeydown(healthId)}
            >
              <ha-icon
                icon=${health === 'healthy' ? 'mdi:heart' : health === 'unhealthy' ? 'mdi:heart-broken' : 'mdi:heart-outline'}
              ></ha-icon>
            </span>`
          : nothing}
        ${row.updateEntityId && visible.has('updates')
          ? html`<span
              class="item-badge updates clickable"
              tabindex="0"
              role="button"
              title="Update available"
              @click=${(e: Event) => {
                e.stopPropagation();
                this._moreInfo(row.updateEntityId);
              }}
              @keydown=${this._onKeydown(row.updateEntityId)}
            >
              <ha-icon icon="mdi:arrow-up-circle"></ha-icon>
            </span>`
          : nothing}
        ${cpu !== undefined && visible.has('cpu')
          ? html`<span
              class="item-badge clickable"
              tabindex="0"
              role="button"
              @click=${(e: Event) => {
                e.stopPropagation();
                this._moreInfo(cpuId);
              }}
              @keydown=${this._onKeydown(cpuId)}
              ><ha-icon icon="mdi:chip"></ha-icon>${cpu.toFixed(0)}%</span
            >`
          : nothing}
        ${mem !== undefined && visible.has('memory')
          ? html`<span
              class="item-badge clickable"
              tabindex="0"
              role="button"
              @click=${(e: Event) => {
                e.stopPropagation();
                this._moreInfo(memId);
              }}
              @keydown=${this._onKeydown(memId)}
              ><ha-icon icon="mdi:memory"></ha-icon>${mem.toFixed(0)}%</span
            >`
          : nothing}
      </div>
    `;
  }
}
