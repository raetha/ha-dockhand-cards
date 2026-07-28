import { LitElement, html, type TemplateResult } from 'lit';
import { state, property } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';
import type { HaFormSchema } from '../common/ha-form-types';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { t } from '../common/i18n';
import { editorFormStyles } from '../common/editor-styles';
import { DEFAULT_CONTAINERS_BADGES, type DockhandContainersCardConfig } from './types';

export class DockhandContainersCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandContainersCardConfig;
  @state() private _hass?: HomeAssistant;
  /** See DockhandVulnerabilityCardEditor's identical property for the
   * full reasoning — set only by the Overview card's per-environment
   * override detail view, never by HA itself. */
  @property({ type: Boolean }) hideDevicePicker = false;
  /** See DockhandEnvironmentCardEditor's identical property for the full
   * reasoning. */
  @property({ type: Boolean }) hideTitle = false;

  static styles = editorFormStyles;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandContainersCardConfig): void {
    this._config = config;
  }

  private _schema(devices: ReturnType<typeof getEnvironmentDevices>): HaFormSchema[] {
    return [
      ...(this.hideDevicePicker
        ? []
        : [
            {
              name: 'device_id',
              required: true,
              selector: { select: { mode: 'dropdown' as const, options: devices.map((d) => ({ value: d.deviceId, label: d.name })) } }
            }
          ]),
      ...(this.hideTitle ? [] : [{ name: 'title', selector: { text: {} } }]),
      { name: 'show_settings_link', default: true, selector: { boolean: {} } },
      {
        name: 'visible_badges',
        type: 'multi_select',
        options: {
          health: t(this._hass, 'badge_health'),
          updates: t(this._hass, 'badge_updates'),
          cpu: t(this._hass, 'badge_cpu'),
          memory: t(this._hass, 'badge_memory')
        }
      }
    ];
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const devices = getEnvironmentDevices(this._hass);
    if (!this.hideDevicePicker && devices.length === 0) {
      return html`<div class="row">${t(this._hass, 'no_environments_found')}</div>`;
    }

    return html`
      <ha-form
        .hass=${this._hass}
        .data=${{ ...this._config, visible_badges: this._config.visible_badges ?? DEFAULT_CONTAINERS_BADGES }}
        .schema=${this._schema(devices)}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: HaFormSchema): string => {
    switch (schema.name) {
      case 'device_id':
        return t(this._hass, 'environment');
      case 'title':
        return t(this._hass, 'title_override');
      case 'show_settings_link':
        return t(this._hass, 'show_settings_link');
      case 'visible_badges':
        return t(this._hass, 'visible_badges_label');
      default:
        return schema.name;
    }
  };

  private _valueChanged(ev: CustomEvent<{ value: DockhandContainersCardConfig }>): void {
    fireEvent(this, 'config-changed', { config: ev.detail.value });
  }
}

customElements.define('dockhand-containers-card-editor', DockhandContainersCardEditor);
