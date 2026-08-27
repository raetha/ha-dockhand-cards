import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getAllContainerDevices, getRepresentativeEntityId } from '../common/device-utils';
import { resolveCardName, migrateTitleToName } from '../common/card-name';
import { resolveContainerEntities, findPrimaryEntityByDomain, type ResolutionResult } from '../common/entity-resolver';
import { joinWithDividers, mergeSections } from '../common/section-join';
import type { ContainerTranslationKey } from '../common/const';
import { barColorClass, formatBytes, getDockhandBaseUrl } from '../common/format';
import { renderSettingsLink, renderIcon, onKeydownActivate } from '../common/icon';
import { CONTAINER_STATE_CLASS, HEALTH_ICON, HEALTH_STATUS_CLASS } from '../common/const';
import { DEFAULT_CONTAINER_SECTIONS, type DockhandContainerCardConfig } from './types';
import { cardStyles } from './styles';

const STATE_ICON: Record<string, string> = {
  running: 'mdi:play-circle',
  paused: 'mdi:pause-circle',
  restarting: 'mdi:refresh-circle',
  exited: 'mdi:stop-circle',
  dead: 'mdi:close-circle',
  created: 'mdi:circle-outline'
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
    this._config = { show_settings_link: true, ...(migrateTitleToName(config as Record<string, unknown>) as DockhandContainerCardConfig) };
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

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    if (!this._config.device_id) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>Please select a Dockhand container — edit this card to pick one.</span>
        </div>
      </ha-card>`;
    }

    const device = this._hass.devices?.[this._config.device_id];
    if (!device) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>Container device not found. It may have been removed — edit this card to pick another.</span>
        </div>
      </ha-card>`;
    }

    // Only used to validate configuration_url parses (see the
    // identical comment in dockhand-environment-card/card.ts for the
    // full reasoning) — the click target stays the full
    // device.configuration_url, not this value.
    const base = getDockhandBaseUrl(device.configuration_url);
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
    const representativeEntityId = getRepresentativeEntityId(this._hass, this._config.device_id);
    const name = resolveCardName(this._hass, representativeEntityId, this._config.name, device.name_by_user || device.name || 'Container');
    const image = s.state?.state.attributes.image as string | undefined;
    const update = findPrimaryEntityByDomain(this._hass, this._config.device_id, 'update');
    const updatePending = update?.state.state === 'on';

    return html`
      <ha-card>
        <div class="body">
          <div class="card-header">
            <div class="header-left">
              ${renderIcon({ baseClass: 'card-badge', icon: 'mdi:docker', static: true })}
              <div class="stacked-pair">
                <span class="truncate">${name}</span>
                ${image ? html`<span class="card-subheader truncate">${image}</span>` : nothing}
              </div>
            </div>
            <div class="header-right">
              ${updatePending
                ? renderIcon({
                    baseClass: 'header-icon',
                    icon: 'mdi:package-up',
                    colorClass: 'warn',
                    title: update?.state.attributes.latest_version
                      ? `Update available: ${update.state.attributes.installed_version ?? '?'} → ${update.state.attributes.latest_version}`
                      : 'Update available',
                    onClick: () => this._moreInfo(update?.entityId)
                  })
                : nothing}
              ${renderSettingsLink({
                hass: this._hass,
                show: this._config?.show_settings_link,
                href: base ? device.configuration_url : null,
                tooltipKey: 'settings_link_view_container'
              })}
            </div>
          </div>
          <div class="divider"></div>
          ${this._renderBody(s)}
        </div>
      </ha-card>
    `;
  }

  private _renderBody(s: ResolutionResult<ContainerTranslationKey>['found']): TemplateResult {
    if (!s.state) {
      return html`<div class="card-message warn">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>This container's state sensor isn't available yet.</span>
      </div>`;
    }

    const state = s.state.state.state;
    const health = s.health?.state.state;
    const visible = new Set(this._config?.visible_sections ?? DEFAULT_CONTAINER_SECTIONS);

    const stateContent = visible.has('state')
      ? html`
          <div class="hero-row">
            ${renderIcon({
              baseClass: 'hero-word',
              colorClass: CONTAINER_STATE_CLASS[state] as 'ok' | 'warn' | 'error' | 'neutral' | undefined,
              icon: STATE_ICON[state] ?? 'mdi:help-circle',
              text: state,
              onClick: () => this._moreInfo(s.state!.entityId)
            })}
            ${health
              ? renderIcon({
                  baseClass: 'hero-word health-chip',
                  colorClass: HEALTH_STATUS_CLASS[health] as 'ok' | 'warn' | 'error' | undefined,
                  icon: HEALTH_ICON[health] ?? 'mdi:heart-outline',
                  title: health,
                  onClick: () => this._moreInfo(s.health?.entityId)
                })
              : nothing}
          </div>
        `
      : nothing;
    const metricsContent = visible.has('metrics') ? this._renderMetrics(s) : nothing;
    const ioContent = visible.has('io') ? this._renderIo(s) : nothing;

    return joinWithDividers([stateContent, mergeSections(metricsContent, ioContent)]);
  }

  private _renderMetrics(s: ResolutionResult<ContainerTranslationKey>['found']): TemplateResult | typeof nothing {
    if (!s.cpuPercent && !s.memoryPercent) return nothing;
    const cpu = s.cpuPercent ? Number(s.cpuPercent.state.state) : undefined;
    const mem = s.memoryPercent ? Number(s.memoryPercent.state.state) : undefined;
    const memUsed = s.memoryUsage ? Number(s.memoryUsage.state.state) : undefined;
    const memLimit = s.memoryLimit ? Number(s.memoryLimit.state.state) : undefined;

    return html`
      <div class="section">
        ${cpu !== undefined
          ? html`
              <div class="stacked-pair">
                <div
                  class="row clickable"
                  tabindex="0"
                  role="button"
                  @click=${() => this._moreInfo(s.cpuPercent?.entityId)}
                  @keydown=${onKeydownActivate(() => this._moreInfo(s.cpuPercent?.entityId))}
                >
                  ${renderIcon({ baseClass: 'row-icon', hass: this._hass, stateObj: s.cpuPercent!.state, text: 'CPU', static: true })}
                  <span class="row-right">${cpu.toFixed(1)}%</span>
                </div>
                <div class="bar-track"><div class="bar-fill ${barColorClass(cpu)}" style="width:${Math.min(cpu, 100)}%"></div></div>
              </div>
            `
          : nothing}
        ${mem !== undefined
          ? html`
              <div class="stacked-pair">
                <div
                  class="row clickable"
                  tabindex="0"
                  role="button"
                  @click=${() => this._moreInfo(s.memoryPercent?.entityId)}
                  @keydown=${onKeydownActivate(() => this._moreInfo(s.memoryPercent?.entityId))}
                >
                  ${renderIcon({ baseClass: 'row-icon', hass: this._hass, stateObj: s.memoryPercent!.state, text: 'Memory', static: true })}
                  <span class="row-right">
                    ${mem.toFixed(1)}%
                    ${memUsed !== undefined
                      ? html`(${formatBytes(memUsed)}${memLimit ? ` / ${formatBytes(memLimit)}` : ''})`
                      : nothing}
                  </span>
                </div>
                <div class="bar-track"><div class="bar-fill ${barColorClass(mem)}" style="width:${Math.min(mem, 100)}%"></div></div>
              </div>
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
      <div class="grid-2">
        ${available.map(
          (item) => html`
            <div
              class="row clickable"
              tabindex="0"
              role="button"
              @click=${() => this._moreInfo(item.entry?.entityId)}
              @keydown=${onKeydownActivate(() => this._moreInfo(item.entry?.entityId))}
            >
              ${renderIcon({ baseClass: 'row-icon', icon: item.icon, text: item.label, static: true })}
              <span class="row-right">${formatBytes(Number(item.entry!.state.state))}</span>
            </div>
          `
        )}
      </div>
    `;
  }
}
