import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices, getEnvId, getStackDevicesForEnvironment, getEnvIdForStackDevice } from '../common/device-utils';
import { resolveStackEntities } from '../common/entity-resolver';
import { t } from '../common/i18n';
import { editorFormStyles } from '../common/editor-styles';
import { STACK_FRIENDLY_LABEL, type StackTranslationKey } from '../common/const';
import type { DockhandStackCardConfig } from './types';

export class DockhandStackCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandStackCardConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _envDeviceId?: string;

  static styles = editorFormStyles;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandStackCardConfig): void {
    this._config = config;
    // Pre-select the environment dropdown from the currently configured
    // stack device, so re-opening the editor doesn't reset the cascade.
    if (config.device_id && this._hass && !this._envDeviceId) {
      const stackDevice = this._hass.devices?.[config.device_id];
      if (stackDevice) {
        const envId = getEnvIdForStackDevice(stackDevice);
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
    const stackDevices = envId !== null ? getStackDevicesForEnvironment(this._hass, envId) : [];

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
          label=${t(this._hass, 'stack')}
          .options=${stackDevices.map((d) => ({ value: d.id, label: d.name_by_user || d.name || d.id }))}
          .value=${this._config.device_id}
          .disabled=${stackDevices.length === 0}
          .helper=${envId !== null && stackDevices.length === 0 ? t(this._hass, 'no_stacks_found') : undefined}
          @selected=${this._stackChanged}
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

  /** Only surfaces disabled entities, or missing ones from the
   * always-applicable set (status/containersInStack/updatesAvailable) — a
   * "not_found" git_* entity on a non-git stack isn't something enabling
   * anything would fix, so it's not a useful hint. */
  private _renderAvailabilityHint(): TemplateResult | typeof nothing {
    if (!this._hass || !this._config?.device_id) return nothing;
    const alwaysApplicable: StackTranslationKey[] = ['status', 'containersInStack', 'updatesAvailable'];
    const { unavailable } = resolveStackEntities(this._hass, this._config.device_id, [
      'status',
      'containersInStack',
      'updatesAvailable',
      'gitSyncStatus',
      'gitLastSync',
      'gitSyncError'
    ]);
    const relevant = unavailable.filter((u) => alwaysApplicable.includes(u.key) || u.reason === 'disabled');
    if (relevant.length === 0) return nothing;

    return html`
      <div class="hint-box">
        This card would show more with these entities enabled:
        <ul>
          ${relevant.map(
            (u) => html`<li>${STACK_FRIENDLY_LABEL[u.key] ?? u.key}${u.reason === 'not_found' ? ' (requires a newer ha-dockhand release)' : ''}</li>`
          )}
        </ul>
      </div>
    `;
  }

  private _envChanged(ev: CustomEvent<{ value: string }>): void {
    this._envDeviceId = ev.detail.value;
    this.requestUpdate();
  }

  private _stackChanged(ev: CustomEvent<{ value: string }>): void {
    this._updateConfig({ device_id: ev.detail.value });
  }

  private _titleChanged(ev: Event): void {
    this._updateConfig({ title: (ev.target as HTMLInputElement).value });
  }

  private _settingsLinkChanged(ev: Event): void {
    this._updateConfig({ show_settings_link: (ev.target as HTMLInputElement).checked });
  }

  private _updateConfig(partial: Partial<DockhandStackCardConfig>): void {
    if (!this._config) return;
    this._config = { ...this._config, ...partial };
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-stack-card-editor', DockhandStackCardEditor);
