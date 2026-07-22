import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getAllContainerDevices } from '../common/device-utils';
import { resolveContainerEntities, type ResolutionResult } from '../common/entity-resolver';
import type { ContainerTranslationKey } from '../common/const';
import { barColorClass, formatBytes } from '../common/format';
import type { DockhandContainerCardConfig } from './types';
import { cardStyles } from './styles';

const STATE_ICON: Record<string, string> = {
  running: 'mdi:play-circle',
  paused: 'mdi:pause-circle',
  restarting: 'mdi:refresh-circle',
  exited: 'mdi:stop-circle',
  dead: 'mdi:close-circle',
  created: 'mdi:circle-outline'
};

const HEALTH_ICON: Record<string, string> = {
  healthy: 'mdi:heart',
  unhealthy: 'mdi:heart-broken',
  starting: 'mdi:heart-outline'
};

export class DockhandContainerCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandContainerCardConfig;
  @state() private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(hass: HomeAssistant): Partial<DockhandContainerCardConfig> {
    const devices = getAllContainerDevices(hass);
    return { type: 'custom:dockhand-container-card', device_id: devices[0]?.id ?? '' };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor');
    return document.createElement('dockhand-container-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandContainerCardConfig): void {
    if (!config.device_id) {
      throw new Error('Please select a Dockhand container.');
    }
    this._config = { show_settings_link: true, ...config };
  }

  set config(config: DockhandContainerCardConfig) {
    this.setConfig(config);
  }

  getCardSize(): number {
    return 3;
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
          <span>Container device not found. It may have been removed — edit this card to pick another.</span>
        </div>
      </ha-card>`;
    }

    const resolution = resolveContainerEntities(this._hass, this._config.device_id, [
      'state',
      'health',
      'cpuPercent',
      'memoryUsage',
      'memoryPercent',
      'memoryLimit',
      'networkRx',
      'networkTx',
      'blockRead',
      'blockWrite'
    ]);
    const s = resolution.found;
    const name = this._config.title || device.name_by_user || device.name || 'Container';

    return html`
      <ha-card>
        <div class="header">
          <div class="header-left">
            <div class="icon-badge">
              <ha-icon icon="mdi:docker"></ha-icon>
            </div>
            <div class="name-block">
              <span class="name">${name}</span>
            </div>
          </div>
          ${this._config?.show_settings_link && device.configuration_url
            ? html`<span class="settings-link" title="Open in Dockhand" @click=${() => window.open(device.configuration_url!, '_blank', 'noopener,noreferrer')}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>
              </span>`
            : nothing}
        </div>
        <div class="body">${this._renderBody(s)}</div>
      </ha-card>
    `;
  }

  private _renderBody(s: ResolutionResult<ContainerTranslationKey>['found']): TemplateResult {
    if (!s.state) {
      return html`<div class="unavailable-hint core-message">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>This container's state sensor isn't available yet.</span>
      </div>`;
    }

    const state = s.state.state.state;
    const health = s.health?.state.state;

    return html`
      <div
        class="state-row clickable"
        tabindex="0"
        role="button"
        @click=${() => this._moreInfo(s.state!.entityId)}
        @keydown=${this._onKeydown(s.state!.entityId)}
      >
        <span class="state-word ${state}"><ha-icon icon=${STATE_ICON[state] ?? 'mdi:help-circle'}></ha-icon> ${state}</span>
        ${health
          ? html`
              <span
                class="health-chip ${health} clickable"
                tabindex="0"
                role="button"
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this._moreInfo(s.health?.entityId);
                }}
                @keydown=${this._onKeydown(s.health?.entityId)}
              >
                <ha-icon icon=${HEALTH_ICON[health] ?? 'mdi:heart-outline'}></ha-icon> ${health}
              </span>
            `
          : nothing}
      </div>
      ${this._renderMetrics(s)}${this._renderIo(s)}
    `;
  }

  private _renderMetrics(s: ResolutionResult<ContainerTranslationKey>['found']): TemplateResult | typeof nothing {
    if (!s.cpuPercent && !s.memoryPercent) return nothing;
    const cpu = s.cpuPercent ? Number(s.cpuPercent.state.state) : undefined;
    const mem = s.memoryPercent ? Number(s.memoryPercent.state.state) : undefined;
    const memUsed = s.memoryUsage ? Number(s.memoryUsage.state.state) : undefined;
    const memLimit = s.memoryLimit ? Number(s.memoryLimit.state.state) : undefined;

    return html`
      <div class="metric-row">
        ${cpu !== undefined
          ? html`
              <div
                class="metric-line clickable"
                tabindex="0"
                role="button"
                @click=${() => this._moreInfo(s.cpuPercent?.entityId)}
                @keydown=${this._onKeydown(s.cpuPercent?.entityId)}
              >
                <span class="metric-label"><ha-state-icon .hass=${this._hass} .stateObj=${s.cpuPercent!.state}></ha-state-icon> CPU</span>
                <span class="metric-value">${cpu.toFixed(1)}%</span>
              </div>
              <div class="bar-track"><div class="bar-fill ${barColorClass(cpu)}" style="width:${Math.min(cpu, 100)}%"></div></div>
            `
          : nothing}
        ${mem !== undefined
          ? html`
              <div
                class="metric-line clickable"
                tabindex="0"
                role="button"
                @click=${() => this._moreInfo(s.memoryPercent?.entityId)}
                @keydown=${this._onKeydown(s.memoryPercent?.entityId)}
              >
                <span class="metric-label"><ha-state-icon .hass=${this._hass} .stateObj=${s.memoryPercent!.state}></ha-state-icon> Memory</span>
                <span class="metric-value">
                  ${mem.toFixed(1)}%
                  ${memUsed !== undefined
                    ? html`<span class="used">(${formatBytes(memUsed)}${memLimit ? ` / ${formatBytes(memLimit)}` : ''})</span>`
                    : nothing}
                </span>
              </div>
              <div class="bar-track"><div class="bar-fill ${barColorClass(mem)}" style="width:${Math.min(mem, 100)}%"></div></div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderIo(s: ResolutionResult<ContainerTranslationKey>['found']): TemplateResult | typeof nothing {
    const items: { icon: string; label: string; entry: ResolutionResult<ContainerTranslationKey>['found'][ContainerTranslationKey] }[] = [
      { icon: 'mdi:download-network', label: 'Network RX', entry: s.networkRx },
      { icon: 'mdi:upload-network', label: 'Network TX', entry: s.networkTx },
      { icon: 'mdi:database-arrow-down', label: 'Block read', entry: s.blockRead },
      { icon: 'mdi:database-arrow-up', label: 'Block write', entry: s.blockWrite }
    ];
    const available = items.filter((i) => i.entry);
    if (available.length === 0) return nothing;

    return html`
      <div class="io-grid">
        ${available.map(
          (item) => html`
            <div
              class="io-item clickable"
              tabindex="0"
              role="button"
              @click=${() => this._moreInfo(item.entry?.entityId)}
              @keydown=${this._onKeydown(item.entry?.entityId)}
            >
              <span class="label"><ha-icon icon=${item.icon}></ha-icon> ${item.label}</span>
              <span>${formatBytes(Number(item.entry!.state.state))}</span>
            </div>
          `
        )}
      </div>
    `;
  }
}
