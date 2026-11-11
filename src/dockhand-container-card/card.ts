import { loadEditor } from '../common/editor-loader';
import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getAllContainerDevices, getRepresentativeEntityId } from '../common/device-utils';
import { resolveCardName } from '../common/card-name';
import { resolveContainerEntities, findPrimaryEntityByDomain, type ResolutionResult } from '../common/entity-resolver';
import { renderResourceIo, renderResourceMetrics } from '../common/resource-sections';
import { joinWithDividers, mergeSections } from '../common/section-join';
import type { ContainerTranslationKey } from '../common/const';
import { getDockhandBaseUrl } from '../common/format';
import { PairGridController } from '../common/pair-grid';
import { t } from '../common/i18n-card';
import { updateKindIcon, updateStatus } from '../common/update-kind';
import { stateLabel } from '../common/state-label';
import { renderSettingsLink, renderIcon } from '../common/icon';
import { CONTAINER_STATE_CLASS, HEALTH_ICON, HEALTH_STATUS_CLASS, DEFAULT_CONTAINER_ICON, UPDATE_PENDING_VERSION } from '../common/const';
import { renderDeviceControls, resolveDeviceControls } from '../common/device-controls';
import { DEFAULT_CONTAINER_SECTIONS, type DockhandContainerCardConfig } from './types';
import { renderTagRow } from '../common/tag-pills';
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
  constructor() {
    super();
    new PairGridController(this);
  }

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
    await loadEditor();
    return document.createElement('dockhand-container-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandContainerCardConfig): void {
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

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    if (!this._config.device_id) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>${t(this._hass, 'msg_select_container')}</span>
        </div>
      </ha-card>`;
    }

    const device = this._hass.devices?.[this._config.device_id];
    if (!device) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>${t(this._hass, 'msg_container_not_found')}</span>
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
    const name = resolveCardName(this._hass, representativeEntityId, this._config.name, device.name_by_user || device.name || t(this._hass, 'name_container'));
    const image = s.state?.state.attributes.image as string | undefined;
    const update = findPrimaryEntityByDomain(this._hass, this._config.device_id, 'update');
    const controls = resolveDeviceControls(this._hass, this._config.device_id, this._config.show_controls);
    const status = updateStatus(update?.state);

    return html`
      <ha-card>
        <div class="body">
          <div class="card-header">
            <div class="header-left">
              ${renderIcon({ baseClass: 'card-badge', icon: this._config.icon || DEFAULT_CONTAINER_ICON, static: true })}
              <div class="stacked-pair">
                <span class="truncate">${name}</span>
                ${image ? html`<span class="card-subheader truncate">${image}</span>` : nothing}
              </div>
            </div>
            <div class="header-right">
              ${status
                ? renderIcon({
                    baseClass: 'header-icon',
                    // A moved pin or a held update isn't something Install
                    // can apply: their own icons, as on the other cards.
                    icon: status.kind === 'pinned' || status.kind === 'held' ? updateKindIcon(this._hass, status).icon : 'mdi:package-up',
                    colorClass: status.kind === 'held' ? 'neutral' : 'warn',
                    title:
                      status.kind === 'pinned' || status.kind === 'held'
                        ? updateKindIcon(this._hass, status).title
                        : update?.state.attributes.latest_version && update.state.attributes.latest_version !== UPDATE_PENDING_VERSION
                          ? t(this._hass, 'update_available_versions', { from: update.state.attributes.installed_version ?? '?', to: update.state.attributes.latest_version })
                          : t(this._hass, 'update_available'),
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
          ${renderTagRow(s.state?.state)}
          <div class="divider"></div>
          ${this._renderBody(s, controls ? renderDeviceControls(this, this._hass, controls, name) : nothing)}
        </div>
      </ha-card>
    `;
  }

  private _renderBody(s: ResolutionResult<ContainerTranslationKey>['found'], controlsContent: TemplateResult | typeof nothing): TemplateResult {
    if (!s.state) {
      return html`<div class="card-message warn">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>${t(this._hass, 'msg_container_state_missing')}</span>
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
              text: stateLabel(this._hass, 'container_state', state, s.state.state),
              onClick: () => this._moreInfo(s.state!.entityId)
            })}
            ${health
              ? renderIcon({
                  baseClass: 'hero-word health-chip',
                  colorClass: HEALTH_STATUS_CLASS[health] as 'ok' | 'warn' | 'error' | undefined,
                  icon: HEALTH_ICON[health] ?? 'mdi:heart-outline',
                  title: stateLabel(this._hass, 'health', health, s.health?.state),
                  onClick: () => this._moreInfo(s.health?.entityId)
                })
              : nothing}
          </div>
        `
      : nothing;
    const moreInfo = (entityId: string | undefined) => this._moreInfo(entityId);
    const metricsContent = visible.has('metrics') ? renderResourceMetrics(this._hass, s, moreInfo) : nothing;
    const ioContent = visible.has('io') ? renderResourceIo(this._hass, s, moreInfo) : nothing;

    return joinWithDividers([mergeSections(stateContent, controlsContent), mergeSections(metricsContent, ioContent)]);
  }
}
