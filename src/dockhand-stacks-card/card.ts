import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices, getStackDevicesForEnvironment, getEnvId } from '../common/device-utils';
import { resolveStackEntities, type ResolutionResult } from '../common/entity-resolver';
import { getDockhandBaseUrl, SETTINGS_LINK_UNAVAILABLE_ICON } from '../common/format';
import { t } from '../common/i18n';
import type { StackTranslationKey } from '../common/const';
import { DEFAULT_STACKS_BADGES, type DockhandStacksCardConfig } from './types';
import { cardStyles } from './styles';

// Matches Dockhand's own stackStatusTypes color list (src/routes/stacks/+page.svelte).
const STATUS_ICON: Record<string, { icon: string; cls: 'ok' | 'warn' | 'error' | 'neutral' }> = {
  running: { icon: 'mdi:play-circle', cls: 'ok' },
  partial: { icon: 'mdi:alert-circle', cls: 'warn' },
  stopped: { icon: 'mdi:stop-circle', cls: 'error' },
  created: { icon: 'mdi:circle-outline', cls: 'neutral' }
};

interface StackRow {
  name: string;
  type: string;
  found: ResolutionResult<StackTranslationKey>['found'];
}

export class DockhandStacksCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandStacksCardConfig;
  @state() private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(hass: HomeAssistant): Partial<DockhandStacksCardConfig> {
    const devices = getEnvironmentDevices(hass);
    return { type: 'custom:dockhand-stacks-card', device_id: devices[0]?.deviceId ?? '' };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor');
    return document.createElement('dockhand-stacks-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandStacksCardConfig): void {
    if (!config.device_id) {
      throw new Error('Please select a Dockhand environment.');
    }
    this._config = { show_settings_link: true, ...config };
  }

  set config(config: DockhandStacksCardConfig) {
    this.setConfig(config);
  }

  getCardSize(): number {
    if (!this._hass || !this._config) return 3;
    const envId = getEnvId(this._hass.devices[this._config.device_id]);
    const count = envId !== null ? getStackDevicesForEnvironment(this._hass, envId).length : 0;
    return Math.max(2, Math.ceil(count / 2) + 1);
  }

  getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 2 };
  }

  private _moreInfo(entityId: string | null | undefined): void {
    if (!entityId) return;
    fireEvent(this, 'hass-more-info', { entityId });
  }

  private _onKeydown(entityId: string | null | undefined) {
    return (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._moreInfo(entityId);
      }
    };
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    const device = this._hass.devices?.[this._config.device_id];
    if (!device) {
      return html`<ha-card>
        <div class="error-state core-message">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>Environment device not found. It may have been removed — edit this card to pick another.</span>
        </div>
      </ha-card>`;
    }

    const envId = getEnvId(device);
    const stackDevices = envId !== null ? getStackDevicesForEnvironment(this._hass, envId) : [];
    const name = this._config.title || device.name_by_user || device.name || 'Environment';
    const base = getDockhandBaseUrl(device.configuration_url);

    const rows: StackRow[] = stackDevices
      .map((d) => {
        const { found } = resolveStackEntities(this._hass!, d.id, ['status', 'containersInStack', 'updatesAvailable']);
        if (!found.status) return null;
        const attrs = found.status.state.attributes;
        return {
          name: attrs.name || d.name_by_user || d.name || d.id,
          type: attrs.type || d.model || 'Stack',
          found
        };
      })
      .filter((r): r is StackRow => r !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return html`
      <ha-card>
        <div class="header">
          <div class="header-left">
            <div class="icon-badge">
              <ha-icon icon="mdi:layers"></ha-icon>
            </div>
            <div class="name-block"><span class="name">${name} — Stacks</span></div>
          </div>
          ${this._config?.show_settings_link
            ? base
              ? html`<span class="settings-link" title=${t(this._hass, 'settings_link_view_stacks')} @click=${() => window.open(`${base}/stacks`, '_blank', 'noopener,noreferrer')}>
                  <ha-icon icon="mdi:open-in-new"></ha-icon>
                </span>`
              : html`<span class="settings-link unavailable" title=${t(this._hass, 'settings_link_unavailable')}>
                  <ha-icon icon=${SETTINGS_LINK_UNAVAILABLE_ICON}></ha-icon>
                </span>`
            : nothing}
        </div>
        <div class="body">
          ${rows.length === 0
            ? html`<div class="empty-note">No stacks found for this environment yet.</div>`
            : html`<div class="row-list">${rows.map((r) => this._renderRow(r))}</div>`}
        </div>
      </ha-card>
    `;
  }

  private _renderRow(row: StackRow): TemplateResult {
    const found = row.found;
    const status = found.status!.state.state;
    const statusIcon = STATUS_ICON[status] ?? { icon: 'mdi:help-circle', cls: 'neutral' as const };
    // Prefer the dedicated containers-in-stack entity's own state over
    // the status entity's container_count attribute — the attribute is
    // kept only as a fallback for environments where that entity doesn't
    // exist (e.g. an older ha-dockhand release).
    const containerCount = found.containersInStack?.state.state ?? found.status!.state.attributes.container_count;
    const containerCountId = found.containersInStack?.entityId;
    const updatesOn = found.updatesAvailable?.state.state === 'on';
    const updateCount = found.updatesAvailable?.state.attributes.update_count;
    const updatesId = found.updatesAvailable?.entityId;
    const id = found.status!.entityId;
    const visible = new Set(this._config?.visible_badges ?? DEFAULT_STACKS_BADGES);

    return html`
      <div class="item-row clickable" tabindex="0" role="button" @click=${() => this._moreInfo(id)} @keydown=${this._onKeydown(id)}>
        <ha-icon class="item-status-icon ${statusIcon.cls}" icon=${statusIcon.icon}></ha-icon>
        <span class="name-and-type">
          <span class="item-name">${row.name}</span>
          ${visible.has('type') ? html`<span class="item-type-pill">${row.type}</span>` : nothing}
        </span>
        ${containerCount !== undefined && visible.has('container_count')
          ? html`<span
              class="item-badge ${containerCountId ? 'clickable' : ''}"
              tabindex=${containerCountId ? 0 : -1}
              role=${containerCountId ? 'button' : nothing}
              @click=${(e: Event) => {
                if (!containerCountId) return;
                e.stopPropagation();
                this._moreInfo(containerCountId);
              }}
              @keydown=${this._onKeydown(containerCountId)}
              ><ha-icon icon="mdi:docker"></ha-icon>${containerCount}</span
            >`
          : nothing}
        ${updatesOn && visible.has('updates')
          ? html`<span
              class="item-badge updates clickable"
              tabindex="0"
              role="button"
              @click=${(e: Event) => {
                e.stopPropagation();
                this._moreInfo(updatesId);
              }}
              @keydown=${this._onKeydown(updatesId)}
              ><ha-icon icon="mdi:arrow-up-circle"></ha-icon>${updateCount ?? ''}</span
            >`
          : nothing}
      </div>
    `;
  }
}
