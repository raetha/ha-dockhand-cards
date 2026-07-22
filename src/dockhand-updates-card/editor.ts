import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { t } from '../common/i18n';
import { editorFormStyles } from '../common/editor-styles';
import { buildUpdatesVisibilityCondition } from '../common/updates-visibility';
import type { DockhandUpdatesCardConfig } from './types';

export class DockhandUpdatesCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandUpdatesCardConfig;
  @state() private _hass?: HomeAssistant;

  static styles = editorFormStyles;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandUpdatesCardConfig): void {
    this._config = { ...config, scope: config.scope ?? 'all' };
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const devices = getEnvironmentDevices(this._hass);

    return html`
      <div class="row">
        <ha-select
          label="Scope"
          .options=${[
            { value: 'all', label: 'All environments' },
            { value: 'environment', label: 'One environment' }
          ]}
          .value=${this._config.scope}
          @selected=${this._scopeChanged}
        ></ha-select>
      </div>

      ${this._config.scope === 'environment'
        ? html`
            <div class="row">
              <ha-select
                label=${t(this._hass, 'environment')}
                .options=${devices.map((d) => ({ value: d.deviceId, label: d.name }))}
                .value=${this._config.device_id ?? ''}
                @selected=${this._deviceChanged}
              ></ha-select>
              ${devices.length === 0 ? html`<div class="hint">${t(this._hass, 'no_environments_found')}</div>` : nothing}
            </div>
          `
        : nothing}

      <div class="row">
        <ha-input label=${t(this._hass, 'title_override')} .value=${this._config.title ?? ''} @input=${this._titleChanged}></ha-input>
      </div>

      <div class="row">
        <ha-formfield label="Hide when no updates">
          <ha-switch .checked=${this._config.hide_when_no_updates ?? false} @change=${this._hideToggled}></ha-switch>
        </ha-formfield>
        <div class="hint">
          Uses Home Assistant's own card visibility condition — the same feature available in every card's own editor — rather
          than anything this card invents itself, so the card is genuinely gone (not just empty) when hidden.
        </div>
      </div>
    `;
  }

  private _scopeChanged(ev: CustomEvent<{ value: string }>): void {
    this._updateConfig({ scope: ev.detail.value as 'environment' | 'all' });
  }

  private _deviceChanged(ev: CustomEvent<{ value: string }>): void {
    this._updateConfig({ device_id: ev.detail.value });
  }

  private _titleChanged(ev: Event): void {
    this._updateConfig({ title: (ev.target as HTMLInputElement).value });
  }

  private _hideToggled(ev: Event): void {
    this._updateConfig({ hide_when_no_updates: (ev.target as HTMLInputElement).checked });
  }

  /** Reconciles the card's own `visibility:` condition against its
   * current hide_when_no_updates/scope/device_id, every time any of them
   * changes — not just when the toggle itself is flipped, since changing
   * scope or the selected environment while the toggle is already on
   * needs the condition rebuilt too. Uses HA's own native card
   * visibility feature (hui-card.ts) rather than anything hand-rolled:
   * a real display: none on the card's own wrapper, correctly freeing
   * its grid space for a sibling to flow into — see
   * docs/ARCHITECTURE.md for why an earlier getGridOptions()-based
   * approach couldn't achieve that. Removes `visibility` entirely from
   * the saved config when the toggle is off, rather than leaving a
   * stale condition behind. */
  private _updateConfig(partial: Partial<DockhandUpdatesCardConfig>): void {
    if (!this._config) return;
    const next: DockhandUpdatesCardConfig = { ...this._config, ...partial };

    if (next.hide_when_no_updates && this._hass) {
      const deviceIds = next.scope === 'environment' ? (next.device_id ? [next.device_id] : []) : getEnvironmentDevices(this._hass).map((d) => d.deviceId);
      const condition = buildUpdatesVisibilityCondition(this._hass, deviceIds);
      if (condition) {
        next.visibility = condition;
      } else {
        delete next.visibility;
      }
    } else {
      delete next.visibility;
    }

    this._config = next;
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-updates-card-editor', DockhandUpdatesCardEditor);
