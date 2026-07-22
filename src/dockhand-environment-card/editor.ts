import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { resolveEnvironmentEntities } from '../common/entity-resolver';
import { editorFormStyles } from '../common/editor-styles';
import { REQUIRED_KEYS_BY_MODE, ENV_FRIENDLY_LABEL, type EnvTranslationKey } from '../common/const';
import { t } from '../common/i18n';
import { CUSTOM_SECTION_ORDER, DEFAULT_CUSTOM_SECTIONS, type CardMode, type CustomSection, type DockhandEnvironmentCardConfig } from './types';

const MODE_KEYS = { compact: 'mode_compact', standard: 'mode_standard', detailed: 'mode_detailed', full: 'mode_full', custom: 'mode_custom' } as const;

const SECTION_LABEL: Record<CustomSection, string> = {
  container_counts: 'Container counts (+ health banner)',
  metrics: 'CPU / memory bars',
  resources: 'Images / stacks / volumes / networks',
  events_summary: 'Events (today / total)',
  recent_events: 'Recent events list',
  top_containers: 'Top containers by CPU',
  disk_usage: 'Disk usage breakdown',
  history_chart: 'CPU / memory history chart'
};

const MODES: { value: CardMode; label: string; hint: string }[] = [
  { value: 'compact', label: 'Compact', hint: 'Name, online status, and the container counts row with health banner — same as the top of Standard, without CPU/memory/resource counts/events below it.' },
  { value: 'standard', label: 'Standard', hint: 'Adds CPU/memory bars, health banner, image/stack/volume/network counts, and events.' },
  {
    value: 'detailed',
    label: 'Detailed',
    hint: 'Standard, plus top containers by CPU and recent events (both need a recent ha-dockhand release — no per-container entities required). Sections you haven\u2019t got the data for yet are simply left out, not shown broken.'
  },
  {
    value: 'full',
    label: 'Full',
    hint: 'Detailed, plus a disk usage breakdown (needs the Disk usage sensor enabled — off by default) and 15-minute CPU/memory history charts, matching Dockhand\u2019s own window (needs Home Assistant\u2019s recorder to have history for those sensors).'
  },
  {
    value: 'custom',
    label: 'Custom',
    hint: 'Pick exactly which sections to show, independent of the fixed combinations above — e.g. just the summary and CPU/memory/disk sections without either list.'
  }
];

export class DockhandEnvironmentCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandEnvironmentCardConfig;
  @state() private _hass?: HomeAssistant;

  static styles = editorFormStyles;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandEnvironmentCardConfig): void {
    this._config = config;
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const devices = getEnvironmentDevices(this._hass);
    const selectedMode = this._config.mode ?? 'standard';

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
        <ha-select
          label=${t(this._hass, 'display_mode')}
          .options=${MODES.map((m) => ({ value: m.value, label: t(this._hass, MODE_KEYS[m.value]) }))}
          .value=${selectedMode}
          .helper=${MODES.find((m) => m.value === selectedMode)?.hint}
          @selected=${this._modeChanged}
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

      ${selectedMode === 'custom' ? this._renderSectionCheckboxes() : nothing}

      ${this._renderAvailabilityHint(selectedMode)}
    `;
  }

  private _renderSectionCheckboxes(): TemplateResult {
    const selected = new Set(this._config?.custom_sections ?? DEFAULT_CUSTOM_SECTIONS);
    return html`
      <div class="row sub-row">
        <div class="hint">Which sections to show — pick any combination.</div>
      </div>
      ${CUSTOM_SECTION_ORDER.map(
        (section) => html`
          <div class="row sub-row">
            <ha-formfield label=${SECTION_LABEL[section]}>
              <ha-switch .checked=${selected.has(section)} @change=${this._sectionToggle(section)}></ha-switch>
            </ha-formfield>
          </div>
        `
      )}
    `;
  }

  private _renderAvailabilityHint(mode: CardMode): TemplateResult | typeof nothing {
    if (!this._hass || !this._config?.device_id) return nothing;
    const requiredKeys = REQUIRED_KEYS_BY_MODE[mode] ?? REQUIRED_KEYS_BY_MODE.standard;
    const { unavailable } = resolveEnvironmentEntities(this._hass, this._config.device_id, requiredKeys);
    if (unavailable.length === 0) return nothing;

    return html`
      <div class="hint-box">
        This card would show more with these entities enabled:
        <ul>
          ${unavailable.map(
            (u: { key: EnvTranslationKey; reason: string }) =>
              html`<li>${ENV_FRIENDLY_LABEL[u.key] ?? u.key}${u.reason === 'not_found' ? ' (requires a newer ha-dockhand release)' : ''}</li>`
          )}
        </ul>
      </div>
    `;
  }

  private _deviceChanged(ev: CustomEvent<{ value: string }>): void {
    this._updateConfig({ device_id: ev.detail.value });
  }

  private _modeChanged(ev: CustomEvent<{ value: string }>): void {
    const mode = ev.detail.value as CardMode;
    if (!this._config) return;
    const next = { ...this._config, mode };
    if (mode !== 'custom' && next.custom_sections !== undefined) {
      // Switching away from Custom — the custom_sections selection no
      // longer takes effect, so drop it from the saved config entirely
      // rather than leaving it behind. Otherwise it just bloats the yaml
      // with a setting that's doing nothing, and could read as confusing
      // or contradictory to someone looking at the config later (e.g.
      // "why does this say history_chart: false when mode is full,
      // which always shows it?").
      delete next.custom_sections;
    }
    this._config = next;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _sectionToggle(section: CustomSection) {
    return (ev: Event) => {
      const selected = new Set(this._config?.custom_sections ?? DEFAULT_CUSTOM_SECTIONS);
      if ((ev.target as HTMLInputElement).checked) {
        selected.add(section);
      } else {
        selected.delete(section);
      }
      this._updateConfig({ custom_sections: CUSTOM_SECTION_ORDER.filter((s) => selected.has(s)) });
    };
  }

  private _titleChanged(ev: Event): void {
    this._updateConfig({ title: (ev.target as HTMLInputElement).value });
  }

  private _settingsLinkChanged(ev: Event): void {
    this._updateConfig({ show_settings_link: (ev.target as HTMLInputElement).checked });
  }

  private _updateConfig(partial: Partial<DockhandEnvironmentCardConfig>): void {
    if (!this._config) return;
    this._config = { ...this._config, ...partial };
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-environment-card-editor', DockhandEnvironmentCardEditor);
