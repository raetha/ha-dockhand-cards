import { LitElement, html, css, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { editorFormStyles } from '../common/editor-styles';
import { CUSTOM_SECTION_ORDER, DEFAULT_CUSTOM_SECTIONS, type CardMode, type CustomSection } from '../dockhand-environment-card/types';
import { DEFAULT_SECTION_ORDER, type DockhandOverviewCardConfig, type OverviewSection } from './types';

const MODE_OPTIONS: { value: CardMode; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'full', label: 'Full' },
  { value: 'custom', label: 'Custom' }
];

const CUSTOM_SECTION_LABEL: Record<CustomSection, string> = {
  container_counts: 'Container counts (+ health banner)',
  metrics: 'CPU / memory bars',
  resources: 'Images / stacks / volumes / networks',
  events_summary: 'Events (today / total)',
  recent_events: 'Recent events list',
  top_containers: 'Top containers by CPU',
  disk_usage: 'Disk usage breakdown',
  history_chart: 'CPU / memory history chart'
};

const SECTION_LABEL: Record<OverviewSection, string> = {
  environments: 'Environments',
  vulnerabilities: 'Vulnerabilities',
  stacks: 'Stacks',
  containers: 'Containers',
  updates: 'Updates'
};

export class DockhandOverviewCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandOverviewCardConfig;
  @state() private _hass?: HomeAssistant;

  static styles = css`
    ${editorFormStyles}
    h3 {
      font-size: 0.9em;
      font-weight: 500;
      margin: 16px 0 8px;
      color: var(--secondary-text-color);
    }
    .env-order-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px;
      border-bottom: 1px solid var(--divider-color);
    }
    .env-order-handle {
      cursor: grab;
      color: var(--secondary-text-color);
      --mdc-icon-size: 20px;
    }
    .section-order-row.disabled {
      opacity: 0.5;
    }
  `;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandOverviewCardConfig): void {
    this._config = {
      show_environments: true,
      show_vulnerabilities: false,
      show_stacks: false,
      show_containers: false,
      show_updates: false,
      environment_mode: 'standard',
      ...config
    };
  }

  private _orderedDevices() {
    if (!this._hass) return [];
    const devices = getEnvironmentDevices(this._hass);
    const order = this._config?.environment_order;
    if (!order) return devices;
    return [...devices].sort((a, b) => {
      const ai = order.indexOf(a.deviceId);
      const bi = order.indexOf(b.deviceId);
      return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
    });
  }

  private _isSectionShown(section: OverviewSection): boolean {
    switch (section) {
      case 'environments':
        return this._config?.show_environments ?? true;
      case 'vulnerabilities':
        return this._config?.show_vulnerabilities ?? false;
      case 'stacks':
        return this._config?.show_stacks ?? false;
      case 'containers':
        return this._config?.show_containers ?? false;
      case 'updates':
        return this._config?.show_updates ?? false;
    }
  }

  private _orderedSections(): OverviewSection[] {
    const saved = this._config?.section_order;
    if (!saved) return DEFAULT_SECTION_ORDER;
    const known = new Set(saved);
    const rest = DEFAULT_SECTION_ORDER.filter((s) => !known.has(s));
    return [...saved, ...rest];
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const orderedDevices = this._orderedDevices();
    const orderedSections = this._orderedSections();

    return html`
      <div class="row">
        <ha-formfield label="Environments">
          <ha-switch .checked=${this._config.show_environments ?? true} @change=${this._toggle('show_environments')}></ha-switch>
        </ha-formfield>
      </div>
      <div class="row">
        <ha-select
          label="Environment card mode"
          .options=${MODE_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
          .value=${this._config.environment_mode ?? 'standard'}
          .disabled=${!this._config.show_environments}
          @selected=${this._modeChanged}
        ></ha-select>
      </div>
      ${this._config.show_environments && this._config.environment_mode === 'custom' ? this._renderSectionCheckboxes() : html``}
      <div class="row">
        <ha-formfield label="Vulnerabilities">
          <ha-switch .checked=${this._config.show_vulnerabilities ?? false} @change=${this._toggle('show_vulnerabilities')}></ha-switch>
        </ha-formfield>
        <div class="hint">Needs the "Vulnerabilities" sensor enabled per environment — off by default.</div>
      </div>
      <div class="row">
        <ha-formfield label="Updates">
          <ha-switch .checked=${this._config.show_updates ?? false} @change=${this._toggle('show_updates')}></ha-switch>
        </ha-formfield>
        <div class="hint">One Updates card per environment, scoped to that environment only.</div>
      </div>
      ${this._config.show_updates
        ? html`
            <div class="row sub-row">
              <ha-formfield label="Hide Updates card when no updates">
                <ha-switch .checked=${this._config.updates_hide_when_no_updates ?? false} @change=${this._hideUpdatesToggled}></ha-switch>
              </ha-formfield>
              <div class="hint">
                Hides only that specific environment's card — other environments with pending updates still show theirs. Genuinely
                takes up no space here (unlike the standalone Updates card's own version of this setting — see its editor).
              </div>
            </div>
          `
        : html``}
      <div class="row">
        <ha-formfield label="Stacks">
          <ha-switch .checked=${this._config.show_stacks ?? false} @change=${this._toggle('show_stacks')}></ha-switch>
        </ha-formfield>
      </div>
      <div class="row">
        <ha-formfield label="Containers">
          <ha-switch .checked=${this._config.show_containers ?? false} @change=${this._toggle('show_containers')}></ha-switch>
        </ha-formfield>
      </div>

      <h3>Section order</h3>
      <div class="hint">Drag to reorder — this is the order sections appear within each environment's column. Turned-off sections stay in the list (dimmed) so you can arrange them ahead of time.</div>
      <ha-sortable handle-selector=".env-order-handle" @item-moved=${this._sectionMoved}>
        <div>
          ${orderedSections.map(
            (s) => html`
              <div class="env-order-row section-order-row ${this._isSectionShown(s) ? '' : 'disabled'}">
                <ha-icon class="env-order-handle" icon="mdi:drag"></ha-icon>
                <span>${SECTION_LABEL[s]}</span>
              </div>
            `
          )}
        </div>
      </ha-sortable>

      ${orderedDevices.length > 1
        ? html`
            <h3>Environment order</h3>
            <div class="hint">Drag to reorder — this is the order columns appear in, left to right.</div>
            <ha-sortable handle-selector=".env-order-handle" @item-moved=${this._envMoved}>
              <div>
                ${orderedDevices.map(
                  (d) => html`
                    <div class="env-order-row">
                      <ha-icon class="env-order-handle" icon="mdi:drag"></ha-icon>
                      <span>${d.name}</span>
                    </div>
                  `
                )}
              </div>
            </ha-sortable>
          `
        : html``}
    `;
  }

  private _renderSectionCheckboxes(): TemplateResult {
    const selected = new Set(this._config?.environment_custom_sections ?? DEFAULT_CUSTOM_SECTIONS);
    return html`
      <div class="row sub-row">
        <div class="hint">Which sections to show in each environment's card — pick any combination.</div>
      </div>
      ${CUSTOM_SECTION_ORDER.map(
        (section) => html`
          <div class="row sub-row">
            <ha-formfield label=${CUSTOM_SECTION_LABEL[section]}>
              <ha-switch .checked=${selected.has(section)} @change=${this._sectionToggle(section)}></ha-switch>
            </ha-formfield>
          </div>
        `
      )}
    `;
  }

  private _sectionToggle(section: CustomSection) {
    return (ev: Event) => {
      const selected = new Set(this._config?.environment_custom_sections ?? DEFAULT_CUSTOM_SECTIONS);
      if ((ev.target as HTMLInputElement).checked) {
        selected.add(section);
      } else {
        selected.delete(section);
      }
      this._updateConfig({ environment_custom_sections: CUSTOM_SECTION_ORDER.filter((s) => selected.has(s)) });
    };
  }

  private _envMoved(ev: CustomEvent<{ oldIndex: number; newIndex: number }>): void {
    ev.stopPropagation();
    const devices = this._orderedDevices();
    const newOrder = devices.map((d) => d.deviceId);
    const [moved] = newOrder.splice(ev.detail.oldIndex, 1);
    newOrder.splice(ev.detail.newIndex, 0, moved);
    this._updateConfig({ environment_order: newOrder });
  }

  private _sectionMoved(ev: CustomEvent<{ oldIndex: number; newIndex: number }>): void {
    ev.stopPropagation();
    const newOrder = this._orderedSections();
    const [moved] = newOrder.splice(ev.detail.oldIndex, 1);
    newOrder.splice(ev.detail.newIndex, 0, moved);
    this._updateConfig({ section_order: newOrder });
  }

  private _toggle(key: 'show_environments' | 'show_vulnerabilities' | 'show_stacks' | 'show_containers' | 'show_updates') {
    return (ev: Event) => this._updateConfig({ [key]: (ev.target as HTMLInputElement).checked });
  }

  private _hideUpdatesToggled(ev: Event): void {
    this._updateConfig({ updates_hide_when_no_updates: (ev.target as HTMLInputElement).checked });
  }

  private _modeChanged(ev: CustomEvent<{ value: string }>): void {
    const environment_mode = ev.detail.value as CardMode;
    if (!this._config) return;
    const next = { ...this._config, environment_mode };
    if (environment_mode !== 'custom' && next.environment_custom_sections !== undefined) {
      // Same reasoning as the Environment card's own editor: drop the
      // selection entirely once it stops applying, rather than leaving
      // it behind to bloat the yaml and look contradictory later.
      delete next.environment_custom_sections;
    }
    this._config = next;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _updateConfig(partial: Partial<DockhandOverviewCardConfig>): void {
    if (!this._config) return;
    this._config = { ...this._config, ...partial };
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-overview-card-editor', DockhandOverviewCardEditor);
