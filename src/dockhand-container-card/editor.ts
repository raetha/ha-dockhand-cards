import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices, getEnvId, getContainerDevicesForEnvironment, getEnvIdForContainerDevice } from '../common/device-utils';
import { resolveContainerEntities } from '../common/entity-resolver';
import { t } from '../common/i18n';
import { editorFormStyles } from '../common/editor-styles';
import { CONTAINER_FRIENDLY_LABEL } from '../common/const';
import type { DockhandContainerCardConfig } from './types';

export class DockhandContainerCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandContainerCardConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _envDeviceId?: string;

  static styles = editorFormStyles;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandContainerCardConfig): void {
    this._config = config;
    if (config.device_id && this._hass && !this._envDeviceId) {
      const containerDevice = this._hass.devices?.[config.device_id];
      if (containerDevice) {
        const envId = getEnvIdForContainerDevice(containerDevice);
        if (envId !== null) {
          const envDevice = Object.values(this._hass.devices).find((d) => getEnvId(d) === envId);
          this._envDeviceId = envDevice?.id;
        }
      }
    }
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const envDevices = getEnvironmentDevices(this._hass);
    if (envDevices.length === 0) {
      return html`<div class="row">${t(this._hass, 'no_environments_found')}</div>`;
    }

    const envId = this._envDeviceId ? getEnvId(this._hass.devices[this._envDeviceId]) : null;
    const containerDevices = envId !== null ? getContainerDevicesForEnvironment(this._hass, envId) : [];

    return html`
      <div class="row">
        <ha-select
          label=${t(this._hass, 'environment')}
          .options=${envDevices.map((d) => ({ value: d.deviceId, label: d.name }))}
          .value=${this._envDeviceId ?? ''}
          @selected=${this._envChanged}
        ></ha-select>
      </div>

      <div class="row">
        <ha-select
          label=${t(this._hass, 'container')}
          .options=${containerDevices.map((d) => ({ value: d.id, label: d.name_by_user || d.name || d.id }))}
          .value=${this._config.device_id}
          .disabled=${containerDevices.length === 0}
          .helper=${envId !== null && containerDevices.length === 0 ? t(this._hass, 'no_containers_found') : undefined}
          @selected=${this._containerChanged}
        ></ha-select>
      </div>

      <div class="row">
        <ha-input label=${t(this._hass, 'title_override')} .value=${this._config.title ?? ''} @input=${this._titleChanged}></ha-input>
      </div>

      <div class="row">
        <ha-formfield label=${t(this._hass, 'show_settings_link')}>
          <ha-switch .checked=${this._config.show_settings_link ?? true} @change=${this._settingsLinkChanged}></ha-switch>
        </ha-formfield>
      </div>

      ${this._renderAvailabilityHint()}
    `;
  }

  /** Only checks the genuinely opt-in diagnostic sensors — "state" is
   * handled by the card's own core error message, and "health" only exists
   * when the container has a Docker healthcheck configured at all, which
   * isn't something enabling an entity would fix. */
  private _renderAvailabilityHint(): TemplateResult | typeof nothing {
    if (!this._hass || !this._config?.device_id) return nothing;
    const { unavailable } = resolveContainerEntities(this._hass, this._config.device_id, [
      'cpuPercent',
      'memoryUsage',
      'memoryPercent',
      'memoryLimit',
      'networkRx',
      'networkTx',
      'blockRead',
      'blockWrite'
    ]);
    const disabledOnly = unavailable.filter((u) => u.reason === 'disabled');
    if (disabledOnly.length === 0) return nothing;

    return html`
      <div class="hint-box">
        This card would show more with these entities enabled:
        <ul>
          ${disabledOnly.map((u) => html`<li>${CONTAINER_FRIENDLY_LABEL[u.key] ?? u.key}</li>`)}
        </ul>
      </div>
    `;
  }

  private _envChanged(ev: CustomEvent<{ value: string }>): void {
    this._envDeviceId = ev.detail.value;
    this.requestUpdate();
  }

  private _containerChanged(ev: CustomEvent<{ value: string }>): void {
    this._updateConfig({ device_id: ev.detail.value });
  }

  private _titleChanged(ev: Event): void {
    this._updateConfig({ title: (ev.target as HTMLInputElement).value });
  }

  private _settingsLinkChanged(ev: Event): void {
    this._updateConfig({ show_settings_link: (ev.target as HTMLInputElement).checked });
  }

  private _updateConfig(partial: Partial<DockhandContainerCardConfig>): void {
    if (!this._config) return;
    this._config = { ...this._config, ...partial };
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-container-card-editor', DockhandContainerCardEditor);
