import { loadEditor } from '../common/editor-loader';
import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import type { LovelaceCard, LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { resolveIncludedOrdered } from '../common/environment-scope';
import { hasPendingUpdates } from '../common/updates-visibility';
import type { DockhandEnvironmentCardConfig } from '../dockhand-environment-card/types';
import type { DockhandVulnerabilityCardConfig } from '../dockhand-vulnerability-card/types';
import type { DockhandStacksCardConfig } from '../dockhand-stacks-card/types';
import type { DockhandContainersCardConfig } from '../dockhand-containers-card/types';
import type { DockhandUpdatesCardConfig } from '../dockhand-updates-card/types';
import type { DockhandSchedulesCardConfig } from '../dockhand-schedules-card/types';
import { enabledSections, orderedSections, sectionSettings, type DockhandOverviewCardConfig, type OverviewSection } from './types';
import { cardStyles } from './styles';
import { t } from '../common/i18n-card';

export class DockhandOverviewCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandOverviewCardConfig;
  @state() private _hass?: HomeAssistant;

  /** Pending requestAnimationFrame ID for the next equalisation pass,
   * stored so it can be cancelled if updated() fires again before the
   * previous rAF has had a chance to run — prevents redundant back-to-
   * back layout measurements when _hass updates arrive in quick
   * succession (every HA entity state push triggers updated()). */
  private _rafId?: number;
  /** ResizeObserver watching the .overview grid element so that
   * _equalizeColumnHeights() is re-run whenever the card's width
   * changes (e.g. viewport resize or column-count change). */
  private _resizeObserver?: ResizeObserver;
  /** The .overview element currently observed, used to avoid
   * re-subscribing on every updated() call when the element hasn't
   * changed. */
  private _observedOverview?: Element;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(): Partial<DockhandOverviewCardConfig> {
    return {
      type: 'custom:dockhand-overview-card',
      show_environments: true,
      show_vulnerabilities: false,
      show_stacks: false,
      show_containers: false,
      show_updates: false,
      show_schedules: false,
      environment_mode: 'standard'
    };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await loadEditor();
    return document.createElement('dockhand-overview-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandOverviewCardConfig): void {
    this._config = {
      show_environments: true,
      show_vulnerabilities: false,
      show_stacks: false,
      show_containers: false,
      show_updates: false,
      show_schedules: false,
      environment_mode: 'standard',
      align_columns: true,
      ...config
    };
  }

  set config(config: DockhandOverviewCardConfig) {
    this.setConfig(config);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._rafId !== undefined) cancelAnimationFrame(this._rafId);
    this._rafId = undefined;
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    this._observedOverview = undefined;
  }

  getCardSize(): number {
    if (!this._hass || !this._config) return 10;
    const count = getEnvironmentDevices(this._hass).filter((d) => !this._config?.exclude_device_ids?.includes(d.deviceId)).length;
    let perColumn = 0;
    if (this._config.show_environments) perColumn += this._config.environment_mode === 'full' ? 10 : this._config.environment_mode === 'detailed' ? 7 : 4;
    if (this._config.show_vulnerabilities) perColumn += 3;
    if (this._config.show_stacks) perColumn += 3;
    if (this._config.show_containers) perColumn += 3;
    if (this._config.show_updates) perColumn += 3;
    if (this._config.show_schedules) perColumn += 3;
    // Columns render side by side, not stacked, so overall height is
    // governed by the tallest column, not the sum — but with an unknown
    // number of columns per row (width-dependent), a single column's
    // height is the best estimate available for masonry purposes.
    return count > 0 ? Math.max(4, perColumn) : 4;
  }

  /** Defaults to full width — this card is explicitly meant to fill an
   * entire dashboard view, unlike every other card in this repo which
   * defaults to half-width/tile-like. */
  getGridOptions(): LovelaceGridOptions {
    return { columns: 'full', rows: 'auto', min_columns: 6, min_rows: 4 };
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (this._config?.align_columns !== false) {
      // Cancel any queued rAF before scheduling a new one — rapid-fire
      // _hass updates (one per HA entity state push) would otherwise
      // accumulate back-to-back layout passes for no net gain.
      if (this._rafId !== undefined) cancelAnimationFrame(this._rafId);
      // Defer measurement until after the browser has painted so that
      // child card heights are finalised (cards render async). A single
      // rAF is enough for our direct children; child-card internal
      // rendering is synchronous at this point given Lit's micro-task
      // scheduling.
      this._rafId = requestAnimationFrame(() => {
        this._rafId = undefined;
        this._equalizeColumnHeights();
        this._attachResizeObserver();
      });
    } else {
      // align_columns turned off — cancel any pending rAF, tear down the
      // observer, and clear stale references. The section-wrapper divs
      // themselves are removed by Lit's re-render, so no min-height
      // cleanup is needed here.
      if (this._rafId !== undefined) cancelAnimationFrame(this._rafId);
      this._rafId = undefined;
      this._resizeObserver?.disconnect();
      this._resizeObserver = undefined;
      this._observedOverview = undefined;
    }
  }

  /** Attach (or re-attach) a ResizeObserver on the .overview grid so
   * _equalizeColumnHeights() is re-run whenever the card width changes
   * (viewport resize, sidebar collapse, etc.). Skips reattachment when
   * the same element is already observed to avoid churn on every update. */
  private _attachResizeObserver(): void {
    const overview = this.shadowRoot?.querySelector('.overview');
    if (!overview || overview === this._observedOverview) return;
    this._resizeObserver?.disconnect();
    this._resizeObserver = new ResizeObserver(() => {
      // Reset and re-measure on every resize event — the column count
      // may have changed, so previous min-heights could be stale.
      this._equalizeColumnHeights();
    });
    this._resizeObserver.observe(overview);
    this._observedOverview = overview;
  }

  /** Equalise matching section slots across columns by setting each
   * .section-wrapper's min-height to the tallest natural height in its
   * row group. Operates only within visual rows — env-columns that share
   * the same grid row track — so single-column layouts (mobile, or an
   * overflow column sitting alone in the last row) never receive
   * min-height values and never show dead whitespace.
   *
   * Algorithm:
   *  1. Reset all .section-wrapper min-heights so measurements reflect
   *     natural content heights.
   *  2. Group .env-column elements into visual rows by their top edge
   *     (getBoundingClientRect().top, tolerance ±4 px for subpixel).
   *  3. Skip any row with fewer than 2 columns — nothing to align.
   *  4. Within each multi-column row, group that row's .section-wrapper
   *     elements by data-section and apply the row-local maximum height
   *     as min-height to every member. */
  private _equalizeColumnHeights(): void {
    const root = this.shadowRoot;
    if (!root) return;

    const wrappers = Array.from(root.querySelectorAll<HTMLElement>('.section-wrapper'));
    if (wrappers.length === 0) return;

    // Step 1: reset so we measure natural heights, not last-pass values.
    for (const w of wrappers) w.style.minHeight = '';

    // Step 2: group env-columns by visual row. getBoundingClientRect() is
    // called after the reset so column tops reflect the natural layout.
    const columns = Array.from(root.querySelectorAll<HTMLElement>('.env-column'));
    if (columns.length === 0) return;

    const rows: HTMLElement[][] = [];
    for (const col of columns) {
      const top = col.getBoundingClientRect().top;
      const existing = rows.find((r) => Math.abs(r[0].getBoundingClientRect().top - top) < 4);
      if (existing) {
        existing.push(col);
      } else {
        rows.push([col]);
      }
    }

    // Steps 3 & 4: equalise within each multi-column row only.
    for (const row of rows) {
      if (row.length < 2) continue;

      const rowWrappers = row.flatMap((col) => Array.from(col.querySelectorAll<HTMLElement>('.section-wrapper')));

      const bySection = new Map<string, HTMLElement[]>();
      for (const w of rowWrappers) {
        const s = w.dataset['section'];
        if (!s) continue;
        let group = bySection.get(s);
        if (!group) { group = []; bySection.set(s, group); }
        group.push(w);
      }

      for (const group of bySection.values()) {
        const maxH = Math.max(...group.map((w) => w.getBoundingClientRect().height));
        if (maxH > 0) {
          for (const w of group) w.style.minHeight = `${maxH}px`;
        }
      }
    }
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    // Always "selected" in the shared resolver's terms (an opt-out subset
    // in a custom order); Overview never had a legacy scope field, so it
    // needs none of the other cards' legacy handling.
    const devices = resolveIncludedOrdered(getEnvironmentDevices(this._hass), this._config?.environments_order, this._config.exclude_device_ids);

    const alignColumns = this._config?.align_columns !== false;

    if (devices.length === 0) {
      return html`<div class="card-message">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>${t(this._hass, 'msg_no_environments_found')}</span>
      </div>`;
    }

    if (
      !this._config.show_environments &&
      !this._config.show_vulnerabilities &&
      !this._config.show_stacks &&
      !this._config.show_containers &&
      !this._config.show_updates &&
      !this._config.show_schedules
    ) {
      return html`<div class="card-message">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>${t(this._hass, 'msg_all_sections_off')}</span>
      </div>`;
    }

    return html`
      <div class=${alignColumns ? 'overview' : 'overview no-align'}>
        ${devices.map((d) => this._renderColumn(d.deviceId, d.name, alignColumns))}
      </div>
    `;
  }

  private _renderColumn(deviceId: string, name: string, alignColumns: boolean): TemplateResult {
    const override = this._config?.environments_overrides?.[deviceId];

    // Each generated card gets its section's defaults (prefixed keys, §4)
    // with this environment's override on top, whatever fields the card
    // has: nothing here changes when a card gains one. Keys only appear
    // when set, so a card's own `{ default, ...config }` defaults hold.
    const settings = (section: OverviewSection): Record<string, unknown> => sectionSettings(this._config ?? {}, section, override);
    const allEnvDeviceIds = getEnvironmentDevices(this._hass!).map((d) => d.deviceId);
    const others = allEnvDeviceIds.filter((id) => id !== deviceId);
    const envCfg = { mode: 'standard', ...settings('environments'), type: 'custom:dockhand-environment-card', device_id: deviceId } as DockhandEnvironmentCardConfig;
    
    // The list cards are solo'd to this column's environment the way their
    // own editors' "solo" action does it: every other environment excluded.
    const stacksCfg = { ...settings('stacks'), type: 'custom:dockhand-stacks-card', exclude_device_ids: others } as DockhandStacksCardConfig;
    const containersCfg = { ...settings('containers'), type: 'custom:dockhand-containers-card', exclude_device_ids: others } as DockhandContainersCardConfig;
    const vulnCfg = { ...settings('vulnerabilities'), type: 'custom:dockhand-vulnerability-card', exclude_device_ids: others } as DockhandVulnerabilityCardConfig;
    // The Overview hides the Updates card itself (HA's visibility rule can't
    // reach a nested card, §9), so the card gets neither key.
    const updatesSettings = settings('updates');
    const hideWhenNoUpdates = updatesSettings.hide_when_no_updates === true;
    delete updatesSettings.hide_when_no_updates;
    delete updatesSettings.visibility;
    const updatesCfg = { ...updatesSettings, type: 'custom:dockhand-updates-card', exclude_device_ids: others } as DockhandUpdatesCardConfig;
    // Global schedules belong to no environment, so a column leaves them
    // out (include_global: false). Rows show next run only by default: the
    // column already says which environment they're in.
    const scheduleCfg = {
      visible_badges: ['next_run'],
      ...settings('schedules'),
      type: 'custom:dockhand-schedules-card',
      exclude_device_ids: others,
      include_global: false
    } as DockhandSchedulesCardConfig;

    const sections = this._config ? enabledSections(orderedSections(this._config?.section_order), this._config) : [];
    const sectionRenderers: Record<OverviewSection, () => TemplateResult | typeof nothing> = {
      environments: () =>
        this._config?.show_environments
          ? html`<dockhand-environment-card .hass=${this._hass} .config=${envCfg}></dockhand-environment-card>`
          : nothing,
      vulnerabilities: () =>
        this._config?.show_vulnerabilities
          ? html`<dockhand-vulnerability-card .hass=${this._hass} .config=${vulnCfg}></dockhand-vulnerability-card>`
          : nothing,
      stacks: () => (this._config?.show_stacks ? html`<dockhand-stacks-card .hass=${this._hass} .config=${stacksCfg}></dockhand-stacks-card>` : nothing),
      containers: () =>
        this._config?.show_containers
          ? html`<dockhand-containers-card .hass=${this._hass} .config=${containersCfg}></dockhand-containers-card>`
          : nothing,
      updates: () => {
        if (!this._config?.show_updates) return nothing;
        // Not delegated to the Updates card's own hide_when_no_updates
        // (native HA visibility, meant for a card HA directly manages) —
        // this nested instance is created inside this card's own shadow
        // DOM, so HA's visibility mechanism never reaches it (see
        // docs/architecture.md). Genuine zero-space collapse is achieved
        // here instead, simply by not including the element in this
        // template at all when there's nothing pending — this is a
        // plain grid column this card already controls, not HA's
        // sections grid, so there's no CSS span-validity issue to work
        // around the way there was for the standalone card.
        // hideWhenNoUpdates is computed above; reused here.
        if (hideWhenNoUpdates && this._hass && !hasPendingUpdates(this._hass, deviceId)) {
          return nothing;
        }
        return html`<dockhand-updates-card .hass=${this._hass} .config=${updatesCfg}></dockhand-updates-card>`;
      },
      schedules: () =>
        this._config?.show_schedules
          ? html`<dockhand-schedules-card .hass=${this._hass} .config=${scheduleCfg}></dockhand-schedules-card>`
          : nothing
    };

    // When align_columns is on, wrap every enabled section slot in a
    // .section-wrapper div — even when the section's content is
    // `nothing` — so _equalizeColumnHeights() has a stable DOM node for
    // every slot in every column to measure and equalise. The wrapper
    // for a hidden section starts at zero height and is stretched to
    // match the tallest column's corresponding section, acting as a
    // transparent spacer that keeps section boundaries lined up across
    // columns without CSS subgrid (which triggers a Chrome bug inflating
    // the second column track's width).
    const renderSection = (section: OverviewSection): TemplateResult | typeof nothing => {
      const content = sectionRenderers[section]();
      if (!alignColumns) return content;
      return html`<div class="section-wrapper" data-section=${section}>${content}</div>`;
    };

    return html`
      <div class="env-column">
        <div class="column-title">${name}</div>
        ${sections.map(renderSection)}
      </div>
    `;
  }
}
