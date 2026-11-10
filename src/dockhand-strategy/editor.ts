/**
 * The Dockhand dashboard's settings (§22): the Overview card's editor,
 * given the dashboard's defaults and its config without the strategy type.
 * Values equal to the defaults aren't written back, so the dashboard's
 * YAML holds only what was changed.
 */
import { LitElement, html, type PropertyValues, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent } from 'custom-card-helpers';
import type { HomeAssistant } from '../common/ha-types';
import type { DockhandOverviewCardConfig } from '../dockhand-overview-card/types';
import { DASHBOARD_DEFAULTS, type DockhandDashboardStrategyConfig } from './strategy';
import '../dockhand-overview-card/editor';

type OverviewEditor = HTMLElement & { hass: HomeAssistant; dashboardStrategy: boolean; setConfig(config: DockhandOverviewCardConfig): void };

export class DockhandDashboardStrategyEditor extends LitElement {
  @state() private _config?: DockhandDashboardStrategyConfig;
  private _hass?: HomeAssistant;

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
    inner.setConfig({ ...DASHBOARD_DEFAULTS, ...this._config, type: 'custom:dockhand-overview-card' } as DockhandOverviewCardConfig);
  }

  private _changed(ev: CustomEvent<{ config: Record<string, unknown> }>): void {
    ev.stopPropagation();
    const defaults: Record<string, unknown> = DASHBOARD_DEFAULTS;
    const config: Record<string, unknown> = { type: this._config?.type ?? 'custom:dockhand' };
    for (const [key, value] of Object.entries(ev.detail.config)) {
      if (key === 'type' || key === 'align_columns') continue;
      if (value !== undefined && value !== defaults[key]) config[key] = value;
    }
    fireEvent(this, 'config-changed', { config: config as DockhandDashboardStrategyConfig });
  }

  protected render(): TemplateResult {
    return html`<dockhand-overview-card-editor @config-changed=${this._changed}></dockhand-overview-card-editor>`;
  }
}

customElements.define('dockhand-dashboard-strategy-editor', DockhandDashboardStrategyEditor);
