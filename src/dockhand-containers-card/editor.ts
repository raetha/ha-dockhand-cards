import { LitElement, html, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { t } from '../common/i18n';
import { editorFormStyles } from '../common/editor-styles';
import type { DockhandContainersCardConfig } from './types';

export class DockhandContainersCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandContainersCardConfig;
  @state() private _hass?: HomeAssistant;

  static styles = editorFormStyles;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandContainersCardConfig): void {
    this._config = config;
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const devices = getEnvironmentDevices(this._hass);
    if (devices.length === 0) {
      return html`<div class="row">${t(this._hass, 'no_environments_found')}</div>`;
    }

    return html`
      <div class="row">
        <ha-select
          label=${t(this._hass, 'environment')}
          .options=${devices.map((d) => ({ value: d.deviceId, label: d.name }))}
          .value=${this._config.device_id}
          @selected=${this._deviceChanged}
        ></ha-select>
      </div>

      <div class="row">
        <ha-input label=${t(this._hass, 'title_override')} .value=${this._config.title ?? ''} @input=${this._titleChanged}></ha-input>
      </div>
    `;
  }

  private _deviceChanged(ev: CustomEvent<{ value: string }>): void {
    this._updateConfig({ device_id: ev.detail.value });
  }

  private _titleChanged(ev: Event): void {
    this._updateConfig({ title: (ev.target as HTMLInputElement).value });
  }

  private _updateConfig(partial: Partial<DockhandContainersCardConfig>): void {
    if (!this._config) return;
    this._config = { ...this._config, ...partial };
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-containers-card-editor', DockhandContainersCardEditor);
