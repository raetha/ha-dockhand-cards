import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import type { LovelaceCard, LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { hasPendingUpdates } from '../common/updates-visibility';
import type { DockhandEnvironmentCardConfig } from '../dockhand-environment-card/types';
import type { DockhandVulnerabilityCardConfig } from '../dockhand-vulnerability-card/types';
import type { DockhandStacksCardConfig } from '../dockhand-stacks-card/types';
import type { DockhandContainersCardConfig } from '../dockhand-containers-card/types';
import type { DockhandUpdatesCardConfig } from '../dockhand-updates-card/types';
import { DEFAULT_SECTION_ORDER, type DockhandOverviewCardConfig, type OverviewSection } from './types';
import { cardStyles } from './styles';

export class DockhandOverviewCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandOverviewCardConfig;
  @state() private _hass?: HomeAssistant;

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
      environment_mode: 'standard'
    };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor');
    return document.createElement('dockhand-overview-card-editor') as unknown as LovelaceCardEditor;
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

  set config(config: DockhandOverviewCardConfig) {
    this.setConfig(config);
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

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    const devices = getEnvironmentDevices(this._hass)
      .filter((d) => !this._config?.exclude_device_ids?.includes(d.deviceId))
      .sort((a, b) => this._orderIndex(a.deviceId) - this._orderIndex(b.deviceId));

    if (devices.length === 0) {
      return html`<div class="empty-note">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>No Dockhand environments found.</span>
      </div>`;
    }

    if (
      !this._config.show_environments &&
      !this._config.show_vulnerabilities &&
      !this._config.show_stacks &&
      !this._config.show_containers &&
      !this._config.show_updates
    ) {
      return html`<div class="empty-note">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>Every section is turned off — edit this card to enable at least one.</span>
      </div>`;
    }

    return html`
      <div class="overview">
        ${devices.map((d) => this._renderColumn(d.deviceId, d.name))}
      </div>
    `;
  }

  /** Position in the user's manual order, or past the end (so it sorts
   * after every explicitly-ordered environment) if not listed — new
   * environments added after the order was set just appear at the end,
   * in their normal alphabetical position relative to each other since
   * Array.sort is stable and getEnvironmentDevices already sorts
   * alphabetically. */
  private _orderIndex(deviceId: string): number {
    const order = this._config?.environment_order;
    if (!order) return 0;
    const index = order.indexOf(deviceId);
    return index === -1 ? order.length : index;
  }

  /** Same ordering approach as _orderIndex, for sections within a column
   * instead of environments within the row — a section not present in
   * the user's saved order (e.g. "updates", added after they'd already
   * arranged the others) sorts after the ordered ones, in
   * DEFAULT_SECTION_ORDER's own relative order rather than arbitrarily. */
  private _orderedSections(): OverviewSection[] {
    const saved = this._config?.section_order;
    if (!saved) return DEFAULT_SECTION_ORDER;
    const known = new Set(saved);
    const rest = DEFAULT_SECTION_ORDER.filter((s) => !known.has(s));
    return [...saved, ...rest];
  }

  private _renderColumn(deviceId: string, name: string): TemplateResult {
    const envCfg: DockhandEnvironmentCardConfig = {
      type: 'custom:dockhand-environment-card',
      device_id: deviceId,
      mode: this._config?.environment_mode ?? 'standard',
      custom_sections: this._config?.environment_custom_sections
    };
    const vulnCfg: DockhandVulnerabilityCardConfig = { type: 'custom:dockhand-vulnerability-card', device_id: deviceId };
    const stacksCfg: DockhandStacksCardConfig = { type: 'custom:dockhand-stacks-card', device_id: deviceId };
    const containersCfg: DockhandContainersCardConfig = { type: 'custom:dockhand-containers-card', device_id: deviceId };
    const updatesCfg: DockhandUpdatesCardConfig = {
      type: 'custom:dockhand-updates-card',
      scope: 'environment',
      device_id: deviceId
    };

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
        // docs/ARCHITECTURE.md). Genuine zero-space collapse is achieved
        // here instead, simply by not including the element in this
        // template at all when there's nothing pending — this is a
        // plain flex column this card already controls, not HA's
        // sections grid, so there's no CSS span-validity issue to work
        // around the way there was for the standalone card.
        if (this._config?.updates_hide_when_no_updates && this._hass && !hasPendingUpdates(this._hass, deviceId)) {
          return nothing;
        }
        return html`<dockhand-updates-card .hass=${this._hass} .config=${updatesCfg}></dockhand-updates-card>`;
      }
    };

    return html`
      <div class="env-column">
        <div class="env-column-title">${name}</div>
        ${this._orderedSections().map((section) => sectionRenderers[section]())}
      </div>
    `;
  }
}
