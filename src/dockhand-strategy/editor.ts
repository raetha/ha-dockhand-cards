/**
 * The Dockhand dashboard's settings (§22): which Dockhand instance, the
 * columns of the overview and of each environment's page (cards dragged
 * between columns, or to Not shown), and the cards' own settings, for now
 * through the Overview card's editor (dashboardStrategy hides what the
 * layout decides). Values equal to the defaults aren't written back, so
 * the dashboard's YAML holds only what was changed.
 */
import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent } from 'custom-card-helpers';
import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { getInstanceLabel } from '../common/format';
import { t } from '../common/i18n-editor';
import { editorFormStyles, sortableRowStyles } from '../common/editor-styles';
import type { DockhandOverviewCardConfig, OverviewSection } from '../dockhand-overview-card/types';
import { SECTION_LABEL_KEY } from '../dockhand-overview-card/editor';
import {
  DASHBOARD_DEFAULTS,
  DEFAULT_ENVIRONMENT_LAYOUT,
  DEFAULT_OVERVIEW_LAYOUT,
  ENVIRONMENT_PAGE_CARDS,
  MAX_COLUMNS,
  OVERVIEW_PAGE_CARDS,
  cleanLayout,
  type DockhandDashboardStrategyConfig
} from './strategy';

type OverviewEditor = HTMLElement & { hass: HomeAssistant; dashboardStrategy: boolean; setConfig(config: DockhandOverviewCardConfig): void };
type LayoutKey = 'overview_layout' | 'environment_layout';

const LAYOUTS: Record<LayoutKey, { known: readonly OverviewSection[]; fallback: OverviewSection[][] }> = {
  overview_layout: { known: OVERVIEW_PAGE_CARDS, fallback: DEFAULT_OVERVIEW_LAYOUT },
  environment_layout: { known: ENVIRONMENT_PAGE_CARDS, fallback: DEFAULT_ENVIRONMENT_LAYOUT }
};

/** Every section on in the Overview card's editor, so each card's settings
 * can be edited; the layout decides what shows. */
const ALL_SHOWN = {
  show_environments: true,
  show_vulnerabilities: true,
  show_stacks: true,
  show_containers: true,
  show_updates: true,
  show_schedules: true
};

/** Keys the Overview card's editor writes that mean nothing here. */
const NOT_SAVED = new Set(['type', 'align_columns', 'section_order', ...Object.keys(ALL_SHOWN)]);

export class DockhandDashboardStrategyEditor extends LitElement {
  @state() private _config?: DockhandDashboardStrategyConfig;
  @state() private _hass?: HomeAssistant;

  static styles = [
    editorFormStyles,
    sortableRowStyles,
    css`
      .columns-control {
        display: flex;
        align-items: center;
        gap: var(--ha-space-2, 8px);
        margin-bottom: var(--ha-space-3, 12px);
      }
      .columns {
        display: grid;
        /* One per column, as the page lays them out. */
        grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
        gap: var(--ha-space-3, 12px);
      }
      .column {
        border: 1px dashed var(--divider-color);
        border-radius: 8px;
        padding: var(--ha-space-2, 8px);
      }
      .column.hidden-cards {
        grid-column: 1 / -1;
      }
      /* Left-out cards side by side, so the area is one row high. */
      .column.hidden-cards .order-list {
        flex-direction: row;
        flex-wrap: wrap;
      }
      .column .order-row {
        font-size: var(--ha-font-size-s, 12px);
        overflow-wrap: break-word;
        hyphens: auto;
      }
      .column-title {
        font-size: var(--ha-font-size-s, 12px);
        color: var(--secondary-text-color);
        margin-bottom: var(--ha-space-2, 8px);
      }
      .column .order-list {
        min-height: 40px;
      }
      .card-chip {
        cursor: grab;
        border-radius: 6px;
        background: var(--secondary-background-color);
        padding: var(--ha-space-1, 4px) var(--ha-space-2, 8px);
      }
      .hint {
        color: var(--secondary-text-color);
        font-size: var(--ha-font-size-s, 12px);
        margin-bottom: var(--ha-space-3, 12px);
      }
    `
  ];

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    const inner = this._inner();
    if (inner) inner.hass = hass;
  }

  setConfig(config: DockhandDashboardStrategyConfig): void {
    this._config = config;
  }

  private _inner(): OverviewEditor | null | undefined {
    return this.shadowRoot?.querySelector<OverviewEditor>('dockhand-overview-card-editor');
  }

  protected updated(changed: PropertyValues): void {
    const inner = this._inner();
    if (!inner || !this._config || !changed.has('_config')) return;
    inner.dashboardStrategy = true;
    if (this._hass) inner.hass = this._hass;
    inner.setConfig({ ...DASHBOARD_DEFAULTS, ...this._config, ...ALL_SHOWN, type: 'custom:dockhand-overview-card' } as unknown as DockhandOverviewCardConfig);
  }

  private _write(config: Record<string, unknown>): void {
    const defaults: Record<string, unknown> = DASHBOARD_DEFAULTS;
    const out: Record<string, unknown> = { type: this._config?.type ?? 'custom:dockhand' };
    for (const [key, value] of Object.entries(config)) {
      if (NOT_SAVED.has(key) || value === undefined || value === '' || value === defaults[key]) continue;
      out[key] = value;
    }
    fireEvent(this, 'config-changed', { config: out as unknown as DockhandDashboardStrategyConfig });
  }

  private _cardSettingsChanged(ev: CustomEvent<{ config: Record<string, unknown> }>): void {
    ev.stopPropagation();
    this._write(ev.detail.config);
  }

  private _layout(key: LayoutKey): OverviewSection[][] {
    return cleanLayout(this._config?.[key], LAYOUTS[key].known, LAYOUTS[key].fallback);
  }

  private _setLayout(key: LayoutKey, layout: OverviewSection[][]): void {
    this._write({ ...this._config, [key]: layout });
  }

  /** `card` dropped into `column` (-1: Not shown) at `index`. */
  private _placed(key: LayoutKey, column: number, ev: CustomEvent<{ index: number; data: OverviewSection }>): void {
    ev.stopPropagation();
    const card = ev.detail.data;
    const layout = this._layout(key).map((c) => c.filter((k) => k !== card));
    if (column >= 0) layout[column].splice(ev.detail.index, 0, card);
    this._setLayout(key, layout);
  }

  private _moved(key: LayoutKey, column: number, ev: CustomEvent<{ oldIndex: number; newIndex: number }>): void {
    ev.stopPropagation();
    const layout = this._layout(key);
    const [card] = layout[column].splice(ev.detail.oldIndex, 1);
    layout[column].splice(ev.detail.newIndex, 0, card);
    this._setLayout(key, layout);
  }

  /** Fewer columns: the last one's cards join the one before it. */
  private _columns(key: LayoutKey, count: number): void {
    const layout = this._layout(key);
    while (layout.length < count) layout.push([]);
    while (layout.length > count) {
      const last = layout.pop()!;
      layout[layout.length - 1].push(...last);
    }
    this._setLayout(key, layout);
  }

  private _renderCards(key: LayoutKey, column: number, cards: OverviewSection[]): TemplateResult {
    return html`<ha-sortable
      group=${`dockhand-${key}`}
      @item-moved=${(ev: CustomEvent<{ oldIndex: number; newIndex: number }>) => (column >= 0 ? this._moved(key, column, ev) : ev.stopPropagation())}
      @item-added=${(ev: CustomEvent<{ index: number; data: OverviewSection }>) => this._placed(key, column, ev)}
    >
      <div class="order-list">
        ${cards.map((card) => html`<div class="order-row card-chip" .sortableData=${card} data-card=${card}>${t(this._hass, SECTION_LABEL_KEY[card])}</div>`)}
      </div>
    </ha-sortable>`;
  }

  private _renderLayout(key: LayoutKey, headingKey: Parameters<typeof t>[1], expanded: boolean): TemplateResult {
    const layout = this._layout(key);
    const placed = new Set(layout.flat());
    const hidden = LAYOUTS[key].known.filter((card) => !placed.has(card));
    return html`<ha-expansion-panel outlined ?expanded=${expanded}>
      <ha-icon slot="leading-icon" icon=${key === 'overview_layout' ? 'mdi:view-dashboard' : 'mdi:server'}></ha-icon>
      <h3 slot="header">${t(this._hass, headingKey)}</h3>
      <div class="content">
        <div class="hint">${t(this._hass, 'dashboard_layout_hint')}</div>
        ${key === 'overview_layout' ? html`<div class="hint">${t(this._hass, 'dashboard_overview_columns_hint')}</div>` : nothing}
        <div class="columns-control">
          <span>${t(this._hass, 'dashboard_columns')}</span>
          <ha-icon-button class="fewer" .disabled=${layout.length <= 1} label="−" @click=${() => this._columns(key, layout.length - 1)}>
            <ha-icon icon="mdi:minus"></ha-icon>
          </ha-icon-button>
          <span class="column-count">${layout.length}</span>
          <ha-icon-button class="more" .disabled=${layout.length >= MAX_COLUMNS} label="+" @click=${() => this._columns(key, layout.length + 1)}>
            <ha-icon icon="mdi:plus"></ha-icon>
          </ha-icon-button>
        </div>
        <div class="columns" style=${`--columns: ${layout.length}`}>
          ${layout.map(
            (cards, i) => html`<div class="column">
              <div class="column-title">${t(this._hass, 'dashboard_column', { n: i + 1 })}</div>
              ${this._renderCards(key, i, cards)}
            </div>`
          )}
          <div class="column hidden-cards">
            <div class="column-title">${t(this._hass, 'dashboard_not_shown')}</div>
            ${this._renderCards(key, -1, hidden)}
          </div>
        </div>
      </div>
    </ha-expansion-panel>`;
  }

  private _renderInstance(): TemplateResult | typeof nothing {
    const hass = this._hass!;
    const instances = new Map<string, string>();
    for (const env of getEnvironmentDevices(hass)) {
      const device = hass.devices?.[env.deviceId];
      if (device?.config_entry_id && !instances.has(device.config_entry_id)) {
        instances.set(device.config_entry_id, getInstanceLabel(device.configuration_url) ?? device.config_entry_id);
      }
    }
    if (instances.size < 2) return nothing;
    const options = [{ value: '', label: t(hass, 'dashboard_all_instances') }, ...[...instances].map(([value, label]) => ({ value, label }))];
    return html`<ha-form
      .hass=${hass}
      .data=${{ config_entry_id: this._config?.config_entry_id ?? '' }}
      .schema=${[{ name: 'config_entry_id', selector: { select: { mode: 'dropdown', options } } }]}
      .computeLabel=${() => t(hass, 'dashboard_instance')}
      @value-changed=${(ev: CustomEvent<{ value: { config_entry_id: string } }>) => this._write({ ...this._config, config_entry_id: ev.detail.value.config_entry_id })}
    ></ha-form>`;
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;
    return html`
      ${this._renderInstance()}
      ${this._renderLayout('overview_layout', 'dashboard_overview_page', true)}
      ${this._renderLayout('environment_layout', 'dashboard_environment_pages', true)}
      <ha-expansion-panel outlined>
        <ha-icon slot="leading-icon" icon="mdi:tune"></ha-icon>
        <h3 slot="header">${t(this._hass, 'dashboard_card_settings')}</h3>
        <div class="content">
          <div class="hint">${t(this._hass, 'dashboard_card_settings_hint')}</div>
          <dockhand-overview-card-editor @config-changed=${this._cardSettingsChanged}></dockhand-overview-card-editor>
        </div>
      </ha-expansion-panel>
    `;
  }
}

customElements.define('dockhand-dashboard-strategy-editor', DockhandDashboardStrategyEditor);
