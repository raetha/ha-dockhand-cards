import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getAllStackDevices } from '../common/device-utils';
import { resolveStackEntities, type ResolutionResult } from '../common/entity-resolver';
import type { StackTranslationKey } from '../common/const';
import type { DockhandStackCardConfig } from './types';
import { cardStyles } from './styles';

const STATUS_ICON: Record<string, string> = {
  running: 'mdi:play-circle',
  partial: 'mdi:alert-circle',
  stopped: 'mdi:stop-circle',
  created: 'mdi:circle-outline'
};

const SYNC_ICON: Record<string, string> = {
  synced: 'mdi:check-circle',
  syncing: 'mdi:sync',
  pending: 'mdi:clock-outline',
  error: 'mdi:alert-circle'
};

export class DockhandStackCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandStackCardConfig;
  @state() private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(hass: HomeAssistant): Partial<DockhandStackCardConfig> {
    const devices = getAllStackDevices(hass);
    return { type: 'custom:dockhand-stack-card', device_id: devices[0]?.id ?? '' };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor');
    return document.createElement('dockhand-stack-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandStackCardConfig): void {
    if (!config.device_id) {
      throw new Error('Please select a Dockhand stack.');
    }
    this._config = { show_settings_link: true, ...config };
  }

  set config(config: DockhandStackCardConfig) {
    this.setConfig(config);
  }

  getCardSize(): number {
    return 3;
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
          <span>Stack device not found. It may have been removed — edit this card to pick another.</span>
        </div>
      </ha-card>`;
    }

    const resolution = resolveStackEntities(this._hass, this._config.device_id, [
      'status',
      'containersInStack',
      'updatesAvailable',
      'gitSyncStatus',
      'gitLastSync',
      'gitSyncError'
    ]);
    const s = resolution.found;
    const name = this._config.title || device.name_by_user || device.name || 'Stack';
    const isGit = Boolean(s.gitSyncStatus);

    return html`
      <ha-card>
        <div class="header">
          <div class="header-left">
            <div class="icon-badge">
              <ha-icon icon="mdi:layers"></ha-icon>
            </div>
            <div class="name-block">
              <span class="name">${name}</span>
            </div>
          </div>
          <span class="type-pill">${device.model ?? 'Stack'}</span>
          ${this._config?.show_settings_link && device.configuration_url
            ? html`<span class="settings-link" title="Open in Dockhand" @click=${() => window.open(device.configuration_url!, '_blank', 'noopener,noreferrer')}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>
              </span>`
            : nothing}
        </div>
        <div class="body">${this._renderBody(s, isGit)}</div>
      </ha-card>
    `;
  }

  private _renderBody(s: ResolutionResult<StackTranslationKey>['found'], isGit: boolean): TemplateResult {
    if (!s.status) {
      return html`<div class="unavailable-hint core-message">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>This stack's status sensor isn't available yet.</span>
      </div>`;
    }

    const status = s.status.state.state;
    const containerCount = s.status.state.attributes.container_count ?? s.containersInStack?.state.state;
    const updatesOn = s.updatesAvailable?.state.state === 'on';
    const updateCount = s.updatesAvailable?.state.attributes.update_count;

    return html`
      <div
        class="status-row clickable"
        tabindex="0"
        role="button"
        @click=${() => this._moreInfo(s.status!.entityId)}
        @keydown=${this._onKeydown(s.status!.entityId)}
      >
        <span class="status-word ${status}"><ha-icon icon=${STATUS_ICON[status] ?? 'mdi:help-circle'}></ha-icon> ${status}</span>
        ${containerCount !== undefined ? html`<span class="container-count">${containerCount} containers</span>` : nothing}
      </div>

      ${updatesOn
        ? html`
            <div
              class="updates-badge clickable"
              tabindex="0"
              role="button"
              @click=${() => this._moreInfo(s.updatesAvailable?.entityId)}
              @keydown=${this._onKeydown(s.updatesAvailable?.entityId)}
            >
              <ha-icon icon="mdi:arrow-up-circle"></ha-icon>
              ${updateCount ?? 'Updates'} update${updateCount === 1 ? '' : 's'} available
            </div>
          `
        : nothing}
      ${isGit ? this._renderGitSection(s) : nothing}
    `;
  }

  private _renderGitSection(s: ResolutionResult<StackTranslationKey>['found']): TemplateResult {
    const syncStatus = s.gitSyncStatus!.state.state;
    const syncErrorOn = s.gitSyncError?.state.state === 'on';
    const errorMessage = s.gitSyncStatus?.state.attributes.sync_error;
    const lastCommit = s.gitSyncStatus?.state.attributes.last_commit;

    return html`
      <div class="section git-section">
        <div class="section-title"><ha-icon icon="mdi:source-branch"></ha-icon> Git sync</div>
        <div
          class="git-row clickable"
          tabindex="0"
          role="button"
          @click=${() => this._moreInfo(s.gitSyncStatus?.entityId)}
          @keydown=${this._onKeydown(s.gitSyncStatus?.entityId)}
        >
          <span class="label"><ha-icon icon=${SYNC_ICON[syncStatus] ?? 'mdi:source-branch'}></ha-icon> Status</span>
          <span class="sync-status ${syncStatus}">${syncStatus}</span>
        </div>
        ${s.gitLastSync
          ? html`
              <div
                class="git-row clickable"
                tabindex="0"
                role="button"
                @click=${() => this._moreInfo(s.gitLastSync?.entityId)}
                @keydown=${this._onKeydown(s.gitLastSync?.entityId)}
              >
                <span class="label"><ha-icon icon="mdi:clock-outline"></ha-icon> Last sync</span>
                <ha-relative-time .hass=${this._hass} .datetime=${new Date(s.gitLastSync.state.state)}></ha-relative-time>
              </div>
            `
          : nothing}
        ${lastCommit
          ? html`<div class="git-row"><span class="label"><ha-icon icon="mdi:source-commit"></ha-icon> Commit</span><span>${String(lastCommit).slice(0, 7)}</span></div>`
          : nothing}
        ${syncErrorOn
          ? html`
              <div
                class="sync-error-banner clickable"
                tabindex="0"
                role="button"
                @click=${() => this._moreInfo(s.gitSyncError?.entityId)}
                @keydown=${this._onKeydown(s.gitSyncError?.entityId)}
              >
                <ha-icon icon="mdi:alert"></ha-icon>
                <span>${errorMessage || 'The last sync/deploy attempt failed.'}</span>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
