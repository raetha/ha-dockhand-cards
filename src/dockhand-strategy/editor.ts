/**
 * The Dockhand dashboard's settings (§22): which Dockhand instance and
 * environments, the columns of the overview and of each environment's page
 * (cards dragged between columns, or to Hide), and each card's own
 * settings. A card's pencil opens that card's own editor, for every page of
 * its kind: the overview's cards, every environment page's, every Stacks
 * page's Stack card and every Containers page's Container card. A card
 * whose settings are all cleared drops out of `cards`.
 */
import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { ref } from 'lit/directives/ref.js';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { fireEvent } from 'custom-card-helpers';
import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { getInstanceLabel } from '../common/format';
import { t, type EditorTranslationKey } from '../common/i18n-editor';
import { editorFormStyles, sortableRowStyles } from '../common/editor-styles';
import { renderEnvironmentOrderSection } from '../common/environment-scope-editor';
import { resolveIncludedOrdered } from '../common/environment-scope';
import type { OverviewSection } from '../dockhand-overview-card/types';
import { SECTION_LABEL_KEY } from '../dockhand-overview-card/editor';
import {
  DEFAULT_ENVIRONMENT_LAYOUT,
  DEFAULT_OVERVIEW_LAYOUT,
  ENVIRONMENT_PAGE_CARDS,
  MAX_COLUMNS,
  OVERVIEW_PAGE_CARDS,
  cardSettings,
  cleanLayout,
  excludedEnvironments,
  type DashboardCards,
  type DockhandDashboardSettings,
  type DockhandDashboardStrategyConfig,
  type PageKind
} from './strategy';

type LayoutKey = 'overview_layout' | 'environment_layout';
type CardEditor = HTMLElement & { hass: HomeAssistant; cardIsEmbedded: boolean; scopeFixed?: boolean; hideTitle?: boolean; setConfig(config: Record<string, unknown>): void };

const LAYOUTS: Record<LayoutKey, { page: 'overview' | 'environment'; known: readonly OverviewSection[]; fallback: OverviewSection[][] }> = {
  overview_layout: { page: 'overview', known: OVERVIEW_PAGE_CARDS, fallback: DEFAULT_OVERVIEW_LAYOUT },
  environment_layout: { page: 'environment', known: ENVIRONMENT_PAGE_CARDS, fallback: DEFAULT_ENVIRONMENT_LAYOUT }
};

const CARD_TYPE: Record<OverviewSection, string> = {
  environments: 'environment',
  vulnerabilities: 'vulnerability',
  stacks: 'stacks',
  containers: 'containers',
  updates: 'updates',
  schedules: 'schedules'
};

const PAGE_LABEL: Record<PageKind, EditorTranslationKey> = {
  overview: 'dashboard_overview_page',
  environment: 'dashboard_environment_pages',
  stack: 'dashboard_stack_pages',
  container: 'dashboard_container_pages'
};

const APPLIES: Record<PageKind, EditorTranslationKey> = {
  overview: 'dashboard_applies_overview',
  environment: 'dashboard_applies_environment',
  stack: 'dashboard_applies_stack',
  container: 'dashboard_applies_container'
};

/** The card a page's settings view edits. */
interface Editing {
  page: PageKind;
  which?: OverviewSection;
}

/** Fields an embedded editor emits that the dashboard decides itself. */
const NOT_SAVED = new Set(['type', 'device_id', 'environment_device_id', 'environments_order', 'exclude_device_ids']);

export class DockhandDashboardStrategyEditor extends LitElement {
  @state() private _config?: DockhandDashboardStrategyConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _editing?: Editing;
  /** The page panels someone opened: all closed at first, so every section
   * fits on screen, and still open on the way back from a card's
   * settings. */
  @state() private _open = new Set<string>();

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
      /* Hide (or Hidden): its label beside its cards, so it's one row
       * high, and only as tall as a card while empty. */
      .column.hidden-cards {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: var(--ha-space-2, 8px);
      }
      .column.hidden-cards .column-title {
        margin-bottom: 0;
        flex-shrink: 0;
      }
      .column.hidden-cards ha-sortable {
        flex: 1;
        min-width: 0;
      }
      .column-title {
        font-size: var(--ha-font-size-s, 12px);
        color: var(--secondary-text-color);
        margin-bottom: var(--ha-space-2, 8px);
      }
      /* Cards as small as their names, side by side, wrapping only when
       * a column is full, so an empty column is one card high. */
      .column .order-list {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ha-space-1, 4px);
        min-height: 24px;
      }
      .card-chip {
        cursor: grab;
        display: inline-flex;
        align-items: center;
        gap: var(--ha-space-1, 4px);
        border-radius: 6px;
        background: var(--secondary-background-color);
        padding: 0 0 0 var(--ha-space-2, 8px);
        font-size: var(--ha-font-size-s, 12px);
        line-height: 24px;
        max-width: 100%;
      }
      .card-chip .chip-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .card-chip ha-icon-button {
        --ha-icon-button-size: 24px;
        --mdc-icon-size: 14px;
        flex-shrink: 0;
      }
      .hint {
        color: var(--secondary-text-color);
        font-size: var(--ha-font-size-s, 12px);
        margin-bottom: var(--ha-space-3, 12px);
      }
      .card-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .detail-header {
        display: flex;
        align-items: center;
        gap: var(--ha-space-2, 8px);
        margin-bottom: var(--ha-space-2, 8px);
      }
      .detail-name {
        font-size: var(--ha-font-size-l, 16px);
        font-weight: var(--ha-font-weight-medium, 500);
      }
    `
  ];

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    const inner = this.shadowRoot?.querySelector<CardEditor>('.card-editor');
    if (inner) inner.hass = hass;
  }

  setConfig(config: DockhandDashboardStrategyConfig): void {
    this._config = config;
  }

  private _write(config: Record<string, unknown>): void {
    const out: Record<string, unknown> = { type: this._config?.type ?? 'custom:dockhand' };
    for (const [key, value] of Object.entries(config)) {
      if (key === 'type' || value === undefined || value === '') continue;
      if (Array.isArray(value) && value.length === 0 && key === 'exclude_device_ids') continue;
      out[key] = value;
    }
    fireEvent(this, 'config-changed', { config: out as unknown as DockhandDashboardStrategyConfig });
  }

  private _layout(key: LayoutKey): OverviewSection[][] {
    return cleanLayout(this._config?.[key], LAYOUTS[key].known, LAYOUTS[key].fallback);
  }

  private _setLayout(key: LayoutKey, layout: OverviewSection[][]): void {
    this._write({ ...this._config, [key]: layout });
  }

  /** `card` dropped into `column` (-1: Hide) at `index`. */
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

  private _editButton(editing: Editing): TemplateResult {
    return html`<ha-icon-button class="edit-card" label=${t(this._hass, 'dashboard_edit_card')} @click=${() => (this._editing = editing)}>
      <ha-icon icon="mdi:pencil"></ha-icon>
    </ha-icon-button>`;
  }

  private _renderCards(key: LayoutKey, column: number, cards: OverviewSection[]): TemplateResult {
    return html`<ha-sortable
      group=${`dockhand-${key}`}
      @item-moved=${(ev: CustomEvent<{ oldIndex: number; newIndex: number }>) => (column >= 0 ? this._moved(key, column, ev) : ev.stopPropagation())}
      @item-added=${(ev: CustomEvent<{ index: number; data: OverviewSection }>) => this._placed(key, column, ev)}
    >
      <div class="order-list">
        ${cards.map(
          (card) =>
            html`<div class="order-row card-chip" .sortableData=${card} data-card=${card}>
              <span class="chip-name">${t(this._hass, SECTION_LABEL_KEY[card])}</span>
              ${this._editButton({ page: LAYOUTS[key].page, which: card })}
            </div>`
        )}
      </div>
    </ha-sortable>`;
  }

  private _renderLayout(key: LayoutKey): TemplateResult {
    const layout = this._layout(key);
    const placed = new Set(layout.flat());
    const hidden = LAYOUTS[key].known.filter((card) => !placed.has(card));
    const overview = key === 'overview_layout';
    return html`<ha-expansion-panel outlined .expanded=${this._open.has(key)} @expanded-changed=${this._panelToggled(key)} data-layout=${key}>
      <ha-icon slot="leading-icon" icon=${overview ? 'mdi:view-dashboard' : 'mdi:server'}></ha-icon>
      <h3 slot="header">${t(this._hass, PAGE_LABEL[LAYOUTS[key].page])}</h3>
      <div class="content">
        <div class="hint">${t(this._hass, overview ? 'dashboard_overview_layout_hint' : 'dashboard_layout_hint')}</div>
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
            <div class="column-title">${t(this._hass, hidden.length ? 'dashboard_hidden' : 'dashboard_hide')}</div>
            ${this._renderCards(key, -1, hidden)}
          </div>
        </div>
      </div>
    </ha-expansion-panel>`;
  }

  private _panelToggled(key: string) {
    return (ev: CustomEvent<{ expanded: boolean }>): void => {
      const open = new Set(this._open);
      if (ev.detail.expanded) open.add(key);
      else open.delete(key);
      this._open = open;
    };
  }

  /** One environment shows its own page, not the overview. */
  private _overviewShown(): boolean {
    const hass = this._hass!;
    const settings: DockhandDashboardSettings = this._config ?? {};
    return resolveIncludedOrdered(getEnvironmentDevices(hass), settings.environments_order, excludedEnvironments(hass, settings)).length > 1;
  }

  private _renderDevicePages(): TemplateResult {
    return html`<ha-expansion-panel outlined .expanded=${this._open.has('device_pages')} @expanded-changed=${this._panelToggled('device_pages')} data-layout="device_pages">
      <ha-icon slot="leading-icon" icon="mdi:layers-outline"></ha-icon>
      <h3 slot="header">${t(this._hass, 'dashboard_device_pages')}</h3>
      <div class="content">
        <div class="hint">${t(this._hass, 'dashboard_device_pages_hint')}</div>
        ${(['stack', 'container'] as const).map(
          (page) => html`<div class="card-row" data-page=${page}>
            <span>${t(this._hass, page === 'stack' ? 'dashboard_stack_card' : 'dashboard_container_card')}</span>
            ${this._editButton({ page })}
          </div>`
        )}
      </div>
    </ha-expansion-panel>`;
  }

  private _renderEnvironments(): TemplateResult {
    const hass = this._hass!;
    const devices = getEnvironmentDevices(hass);
    const update = (patch: Record<string, unknown>) => this._write({ ...this._config, ...patch });
    return renderEnvironmentOrderSection({
      hass,
      headingKey: 'label_environments',
      hintKey: 'dashboard_environments_hint',
      collapsible: true,
      icon: 'mdi:web',
      order: this._config?.environments_order,
      excluded: this._config?.exclude_device_ids,
      showExcludeToggle: true,
      allowReorder: true,
      onMoved: (order) => update({ environments_order: order }),
      onToggleExcluded: (deviceId, nowExcluded) => {
        const current = this._config?.exclude_device_ids ?? [];
        update({ exclude_device_ids: nowExcluded ? [...current, deviceId] : current.filter((id) => id !== deviceId) });
      },
      onSolo: (deviceId) => update({ exclude_device_ids: devices.filter((d) => d.deviceId !== deviceId).map((d) => d.deviceId) }),
      onSelectAll: () => update({ exclude_device_ids: undefined }),
      onClearAll: () => update({ exclude_device_ids: devices.map((d) => d.deviceId) })
    });
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

  /** The card's own editor, given its settings for this kind of page. On
   * the overview, the list cards span every environment the dashboard
   * shows (scopeFixed); everywhere else the card is about one environment,
   * stack or container (cardIsEmbedded). Per-card names only make sense
   * for the overview's list cards. */
  private _mountCardEditor(editing: Editing) {
    return (el?: Element) => {
      if (!el || !this._hass) return;
      const editor = el as CardEditor;
      const settings = this._config ?? {};
      const spansEnvironments = editing.page === 'overview' && editing.which !== 'environments';
      editor.hass = this._hass;
      editor.cardIsEmbedded = !spansEnvironments;
      editor.scopeFixed = spansEnvironments;
      editor.hideTitle = !spansEnvironments;
      editor.setConfig({ type: `custom:${this._cardTag(editing)}`, ...cardSettings(settings, editing.page, editing.which) });
    };
  }

  private _cardTag(editing: Editing): string {
    if (editing.page === 'stack' || editing.page === 'container') return `dockhand-${editing.page}-card`;
    return `dockhand-${CARD_TYPE[editing.which!]}-card`;
  }

  /** The embedded editor's config, minus what the dashboard decides,
   * saved for every page of its kind. Stops it reaching Home Assistant's
   * dialog, which would preview that card instead of the dashboard. */
  private _cardChanged(editing: Editing) {
    return (ev: CustomEvent<{ config: Record<string, unknown> }>): void => {
      ev.stopPropagation();
      const own = Object.fromEntries(Object.entries(ev.detail.config).filter(([key, value]) => !NOT_SAVED.has(key) && value !== undefined));
      const cards: DashboardCards = structuredClone(this._config?.cards ?? {});
      if (editing.page === 'stack' || editing.page === 'container') {
        if (Object.keys(own).length) cards[editing.page] = own;
        else delete cards[editing.page];
      } else {
        const page: Record<string, Record<string, unknown>> = { ...(cards[editing.page] ?? {}) };
        if (Object.keys(own).length) page[editing.which!] = own;
        else delete page[editing.which!];
        if (Object.keys(page).length) cards[editing.page] = page;
        else delete cards[editing.page];
      }
      this._write({ ...this._config, cards: Object.keys(cards).length ? cards : undefined });
    };
  }

  private _renderCardSettings(editing: Editing): TemplateResult {
    const hass = this._hass;
    const card =
      editing.page === 'stack' ? 'dashboard_stack_card' : editing.page === 'container' ? 'dashboard_container_card' : SECTION_LABEL_KEY[editing.which!];
    const tag = unsafeStatic(`${this._cardTag(editing)}-editor`);
    const editor = staticHtml`<${tag} class="card-editor" ${ref(this._mountCardEditor(editing))} @config-changed=${this._cardChanged(editing)}></${tag}>`;
    return html`${keyed(
      `${editing.page}:${editing.which ?? ''}`,
      html`<div class="detail-header">
          <ha-icon-button class="back" label=${t(hass, 'back')} @click=${() => (this._editing = undefined)}>
            <ha-icon icon="mdi:arrow-left"></ha-icon>
          </ha-icon-button>
          <span class="detail-name">${t(hass, PAGE_LABEL[editing.page])} · ${t(hass, card)}</span>
        </div>
        <div class="hint">${t(hass, APPLIES[editing.page])}</div>
        ${editor}`
    )}`;
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;
    if (this._editing) return this._renderCardSettings(this._editing);
    return html`
      ${this._renderInstance()} ${this._renderEnvironments()} ${this._overviewShown() ? this._renderLayout('overview_layout') : nothing}
      ${this._renderLayout('environment_layout')} ${this._renderDevicePages()}
    `;
  }
}

customElements.define('dockhand-dashboard-strategy-editor', DockhandDashboardStrategyEditor);
