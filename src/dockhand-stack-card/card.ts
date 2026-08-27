import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions, DeviceRegistryEntry } from '../common/ha-types';
import { getAllStackDevices, getEnvIdForStackDevice, getContainerDevicesForEnvironment, getRepresentativeEntityId } from '../common/device-utils';
import { resolveCardName, migrateTitleToName } from '../common/card-name';
import { resolveStackEntities, resolveContainerEntities, findPrimaryEntityByDomain, type ResolutionResult } from '../common/entity-resolver';
import { STACK_STATUS_CLASS, type StackTranslationKey } from '../common/const';
import { getDockhandBaseUrl, formatRelativeTime } from '../common/format';
import { renderSettingsLink, renderIcon, onKeydownActivate } from '../common/icon';
import { joinWithDividers } from '../common/section-join';
import { DEFAULT_STACK_SECTIONS, type DockhandStackCardConfig } from './types';
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
    this._config = { show_settings_link: true, ...(migrateTitleToName(config as Record<string, unknown>) as DockhandStackCardConfig) };
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

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    if (!this._config.device_id) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>Please select a Dockhand stack — edit this card to pick one.</span>
        </div>
      </ha-card>`;
    }

    const device = this._hass.devices?.[this._config.device_id];
    if (!device) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>Stack device not found. It may have been removed — edit this card to pick another.</span>
        </div>
      </ha-card>`;
    }

    // Only used to validate configuration_url parses (see the identical
    // comment in dockhand-environment-card/card.ts for the full
    // reasoning) — the click target stays the full
    // device.configuration_url, not this value.
    const base = getDockhandBaseUrl(device.configuration_url);
    const resolution = resolveStackEntities(this._hass, this._config.device_id, [
      'status',
      'containersInStack',
      'gitSyncStatus',
      'gitLastSync',
      'gitSyncError'
    ]);
    const s = resolution.found;
    const representativeEntityId = getRepresentativeEntityId(this._hass, this._config.device_id);
    const name = resolveCardName(this._hass, representativeEntityId, this._config.name, device.name_by_user || device.name || 'Stack');
    const isGit = Boolean(s.gitSyncStatus);

    return html`
      <ha-card>
        <div class="body">
          <div class="card-header">
            <div class="header-left">
              ${renderIcon({ baseClass: 'card-badge', icon: 'mdi:layers', static: true })}
              <span class="truncate">${name}</span>
            </div>
            <div class="header-right">
              <span class="label-pill">${s.status?.state.attributes.type || device.model || 'Stack'}</span>
              ${renderSettingsLink({
                hass: this._hass,
                show: this._config?.show_settings_link,
                href: base ? device.configuration_url : null,
                tooltipKey: 'settings_link_view_stack'
              })}
            </div>
          </div>
          <div class="divider"></div>
          ${this._renderBody(s, isGit, device)}
        </div>
      </ha-card>
    `;
  }

  private _renderBody(s: ResolutionResult<StackTranslationKey>['found'], isGit: boolean, stackDevice: DeviceRegistryEntry): TemplateResult {
    if (!s.status) {
      return html`<div class="card-message warn">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>This stack's status sensor isn't available yet.</span>
      </div>`;
    }

    const status = s.status.state.state;
    const containerCount = s.status.state.attributes.container_count ?? s.containersInStack?.state.state;
    const containerNames = s.status.state.attributes.container_names as string[] | undefined;
    const containerInfo = containerNames && containerNames.length > 0 ? this._containerInfo(stackDevice) : new Map<string, { entityId: string; updateEntityId?: string }>();
    const visible = new Set(this._config?.visible_sections ?? DEFAULT_STACK_SECTIONS);

    const statusContent = visible.has('status')
      ? html`
          <div
            class="hero-row clickable"
            tabindex="0"
            role="button"
            @click=${() => this._moreInfo(s.status!.entityId)}
            @keydown=${onKeydownActivate(() => this._moreInfo(s.status!.entityId))}
          >
            ${renderIcon({ baseClass: 'hero-word', colorClass: STACK_STATUS_CLASS[status] as 'ok' | 'warn' | 'error' | 'neutral' | undefined, icon: STATUS_ICON[status] ?? 'mdi:help-circle', text: status, static: true })}
          </div>
        `
      : nothing;
    const containersContent =
      visible.has('containers') && containerNames && containerNames.length > 0
        ? html`
            <div class="section">
              <div class="section-title">
                <ha-icon icon="mdi:docker"></ha-icon>
                <span>Containers</span>
                ${containerCount !== undefined ? html`<span class="section-title-value">${containerCount}</span>` : nothing}
              </div>
              <div class="label-row">
                ${containerNames.map((name) => {
                  const info = containerInfo.get(name);
                  const updateIcon = info?.updateEntityId
                    ? html`<ha-icon icon="mdi:arrow-up-circle" style="color:var(--dockhand-status-warn-color)" title="Update available"></ha-icon>`
                    : nothing;
                  return info
                    ? html`<span
                        class="label-pill clickable"
                        tabindex="0"
                        role="button"
                        @click=${() => this._moreInfo(info.entityId)}
                        @keydown=${onKeydownActivate(() => this._moreInfo(info.entityId))}
                        >${updateIcon}${name}</span
                      >`
                    : html`<span class="label-pill">${name}</span>`;
                })}
              </div>
            </div>
          `
        : nothing;
    const gitSyncContent = isGit && visible.has('git_sync') ? this._renderGitSection(s) : nothing;

    return joinWithDividers([statusContent, containersContent, gitSyncContent]);
  }

  /** Maps each container's raw Docker name (what `container_names` lists)
   * to its "state" entity id (so a pill can link straight to that
   * container's status/state entity, same raw-name resolution the
   * Container card's own editor already uses for its dropdown) and its
   * own update entity, if it has one pending — the same
   * findPrimaryEntityByDomain lookup Container card itself already uses
   * for its own header update-chip, reused here to give per-container
   * granularity instead of only the stack-level aggregate count.
   * Container devices without a resolvable environment, or whose own
   * state entity isn't available, are simply left as plain
   * (non-clickable) pills — same graceful-degradation approach used
   * throughout this card for missing/disabled entities elsewhere. */
  private _containerInfo(stackDevice: DeviceRegistryEntry): Map<string, { entityId: string; updateEntityId?: string }> {
    const map = new Map<string, { entityId: string; updateEntityId?: string }>();
    if (!this._hass) return map;
    const envId = getEnvIdForStackDevice(stackDevice);
    if (envId === null) return map;

    for (const containerDevice of getContainerDevicesForEnvironment(this._hass, envId)) {
      const { found } = resolveContainerEntities(this._hass, containerDevice.id, ['state']);
      const rawName = found.state?.state.attributes.name as string | undefined;
      if (rawName && found.state) {
        const update = findPrimaryEntityByDomain(this._hass, containerDevice.id, 'update');
        map.set(rawName, {
          entityId: found.state.entityId,
          updateEntityId: update?.state.state === 'on' ? update.entityId : undefined
        });
      }
    }
    return map;
  }

  private _renderGitSection(s: ResolutionResult<StackTranslationKey>['found']): TemplateResult {
    const syncStatus = s.gitSyncStatus!.state.state;
    const syncErrorOn = s.gitSyncError?.state.state === 'on';
    const errorMessage = s.gitSyncStatus?.state.attributes.sync_error;
    const lastCommit = s.gitSyncStatus?.state.attributes.last_commit;

    return html`
      <div class="section">
        <div class="section-title"><ha-icon icon="mdi:source-branch"></ha-icon> Git sync</div>
        <div class="list">
        <div
          class="row clickable"
          tabindex="0"
          role="button"
          @click=${() => this._moreInfo(s.gitSyncStatus?.entityId)}
          @keydown=${onKeydownActivate(() => this._moreInfo(s.gitSyncStatus?.entityId))}
        >
          ${renderIcon({ baseClass: 'row-icon', icon: SYNC_ICON[syncStatus] ?? 'mdi:source-branch', text: 'Status', static: true })}
          <span class="sync-status ${syncStatus}">${syncStatus}</span>
        </div>
        ${s.gitLastSync
          ? html`
              <div
                class="row clickable"
                tabindex="0"
                role="button"
                @click=${() => this._moreInfo(s.gitLastSync?.entityId)}
                @keydown=${onKeydownActivate(() => this._moreInfo(s.gitLastSync?.entityId))}
              >
                ${renderIcon({ baseClass: 'row-icon', icon: 'mdi:clock-outline', text: 'Last sync', static: true })}
                <span class="row-right">${formatRelativeTime(s.gitLastSync.state.state)}</span>
              </div>
            `
          : nothing}
        ${lastCommit
          ? html`<div class="row">${renderIcon({ baseClass: 'row-icon', icon: 'mdi:source-commit', text: 'Commit', static: true })}<span class="row-right">${String(lastCommit).slice(0, 7)}</span></div>`
          : nothing}
        </div>
        ${syncErrorOn
          ? html`
              <div
                class="status-banner error sync-error-banner clickable"
                tabindex="0"
                role="button"
                @click=${() => this._moreInfo(s.gitSyncError?.entityId)}
                @keydown=${onKeydownActivate(() => this._moreInfo(s.gitSyncError?.entityId))}
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
