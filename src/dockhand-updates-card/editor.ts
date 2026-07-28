import { LitElement, html, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';
import type { HaFormSchema } from '../common/ha-form-types';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { t } from '../common/i18n';
import { buildUpdatesVisibilityCondition } from '../common/updates-visibility';
import type { DockhandUpdatesCardConfig } from './types';

export class DockhandUpdatesCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandUpdatesCardConfig;
  @state() private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandUpdatesCardConfig): void {
    this._config = { ...config, scope: config.scope ?? 'all' };
  }

  private _schema(devices: ReturnType<typeof getEnvironmentDevices>, scope: 'all' | 'environment'): HaFormSchema[] {
    return [
      {
        name: 'scope',
        required: true,
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'all', label: t(this._hass, 'updates_scope_all') },
              { value: 'environment', label: t(this._hass, 'updates_scope_environment') }
            ]
          }
        }
      },
      // Conditionally included rather than expressed via the schema's own
      // `visible:` condition — that's real, but only landed in HA's dev
      // branch on 2026-07-17 and isn't in any released version yet
      // (verified directly against HA core's actual frontend pin — even
      // 2026.7.4, the latest release as of this writing, predates it).
      // Omitting the field entirely achieves the identical visible
      // behavior without depending on unreleased HA functionality —
      // revisit once `visible:` actually ships.
      ...(scope === 'environment'
        ? [{ name: 'device_id', selector: { select: { mode: 'dropdown' as const, options: devices.map((d) => ({ value: d.deviceId, label: d.name })) } } }]
        : []),
      { name: 'title', selector: { text: {} } },
      { name: 'hide_when_no_updates', default: false, selector: { boolean: {} } }
    ];
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const devices = getEnvironmentDevices(this._hass);

    return html`
      <ha-form
        .hass=${this._hass}
        .data=${this._config}
        .schema=${this._schema(devices, this._config.scope ?? 'all')}
        .computeLabel=${this._computeLabel}
        .computeHelper=${(schema: HaFormSchema) => this._computeHelper(schema, devices)}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: HaFormSchema): string => {
    switch (schema.name) {
      case 'scope':
        return t(this._hass, 'updates_scope_label');
      case 'device_id':
        return t(this._hass, 'environment');
      case 'title':
        return t(this._hass, 'title_override');
      case 'hide_when_no_updates':
        return t(this._hass, 'hide_when_no_updates_override');
      default:
        return schema.name;
    }
  };

  private _computeHelper(schema: HaFormSchema, devices: ReturnType<typeof getEnvironmentDevices>): string {
    if (schema.name === 'device_id' && devices.length === 0) return t(this._hass, 'no_environments_found');
    // The card is fully removed when hidden (Home Assistant's own card
    // visibility condition), not just emptied — worth saying since it's
    // not obvious from the toggle's own label.
    if (schema.name === 'hide_when_no_updates') return t(this._hass, 'hide_when_no_updates_helper');
    return '';
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
   * stale condition behind.
   *
   * This is genuinely not expressible as a plain ha-form schema field —
   * it's a derived side effect across several fields, not a value one
   * field holds — so it stays hand-written here rather than in the
   * schema, even though the rest of this editor now goes through
   * <ha-form>. */
  private _valueChanged(ev: CustomEvent<{ value: DockhandUpdatesCardConfig }>): void {
    const next = { ...ev.detail.value };

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
