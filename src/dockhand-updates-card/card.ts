import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices, getContainerDevicesForEnvironment, getEnvId, type EnvironmentDeviceOption } from '../common/device-utils';
import { resolveEnvironmentEntities, findPrimaryEntityByDomain } from '../common/entity-resolver';
import type { DockhandUpdatesCardConfig } from './types';
import { cardStyles } from './styles';

interface PendingUpdate {
  entityId: string;
  name: string;
  installedVersion?: string;
  latestVersion?: string;
}

interface EnvGroup {
  envDeviceId: string;
  envName: string;
  bulkButtonEntityId?: string;
  checkUpdatesEntityId?: string;
  updates: PendingUpdate[];
}

export class DockhandUpdatesCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandUpdatesCardConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _triggering = false;
  @state() private _checking = false;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(): Partial<DockhandUpdatesCardConfig> {
    return { type: 'custom:dockhand-updates-card', scope: 'all' };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor');
    return document.createElement('dockhand-updates-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandUpdatesCardConfig): void {
    if (config.scope === 'environment' && !config.device_id) {
      throw new Error('Please select a Dockhand environment, or switch scope to "All environments".');
    }
    this._config = { ...config, scope: config.scope ?? 'all' };
  }

  set config(config: DockhandUpdatesCardConfig) {
    this.setConfig(config);
  }

  getCardSize(): number {
    return 4;
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

  private _buildGroups(): { groups: EnvGroup[]; checkUpdatesEntityIds: string[] } {
    if (!this._hass || !this._config) return { groups: [], checkUpdatesEntityIds: [] };

    let envDevices: EnvironmentDeviceOption[];
    if (this._config.scope === 'environment' && this._config.device_id) {
      const device = this._hass.devices[this._config.device_id];
      if (!device) return { groups: [], checkUpdatesEntityIds: [] };
      envDevices = [{ deviceId: this._config.device_id, name: device.name_by_user || device.name || 'Environment' }];
    } else {
      envDevices = getEnvironmentDevices(this._hass);
    }

    const groups: EnvGroup[] = [];
    const checkUpdatesEntityIds: string[] = [];
    for (const env of envDevices) {
      const envId = getEnvId(this._hass.devices[env.deviceId]);
      if (envId === null) continue;

      const { found } = resolveEnvironmentEntities(this._hass, env.deviceId, ['envBulkUpdate', 'checkUpdates']);
      if (found.checkUpdates) checkUpdatesEntityIds.push(found.checkUpdates.entityId);

      const containerDevices = getContainerDevicesForEnvironment(this._hass, envId);
      const updates: PendingUpdate[] = [];

      for (const c of containerDevices) {
        const entry = findPrimaryEntityByDomain(this._hass, c.id, 'update');
        if (!entry || entry.state.state !== 'on') continue;
        updates.push({
          entityId: entry.entityId,
          name: entry.state.attributes.name || c.name_by_user || c.name || c.id,
          installedVersion: entry.state.attributes.installed_version,
          latestVersion: entry.state.attributes.latest_version
        });
      }
      updates.sort((a, b) => a.name.localeCompare(b.name));

      if (updates.length > 0 || found.envBulkUpdate) {
        groups.push({
          envDeviceId: env.deviceId,
          envName: env.name,
          bulkButtonEntityId: found.envBulkUpdate?.entityId,
          checkUpdatesEntityId: found.checkUpdates?.entityId,
          updates
        });
      }
    }
    return { groups, checkUpdatesEntityIds };
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    if (this._config.scope === 'environment' && !this._hass.devices[this._config.device_id ?? '']) {
      return html`<ha-card>
        <div class="error-state core-message">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>Environment device not found. It may have been removed — edit this card to pick another.</span>
        </div>
      </ha-card>`;
    }

    const { groups, checkUpdatesEntityIds } = this._buildGroups();
    const totalUpdates = groups.reduce((sum, g) => sum + g.updates.length, 0);

    const bulkButtonIds = groups.map((g) => g.bulkButtonEntityId).filter((id): id is string => Boolean(id));
    const title = this._config.title ?? 'Updates';
    const showGroupHeaders = this._config.scope === 'all' && groups.length > 1;

    return html`
      <ha-card>
        <div class="header">
          <div class="header-left">
            <div class="icon-badge">
              <ha-icon icon="mdi:arrow-up-circle"></ha-icon>
            </div>
            <div class="name-block"><span class="name">${title}${totalUpdates > 0 ? ` (${totalUpdates})` : ''}</span></div>
          </div>
          <div class="header-actions">
            ${checkUpdatesEntityIds.length > 0
              ? html`
                  <button
                    class="bulk-button secondary"
                    ?disabled=${this._checking}
                    @click=${() => this._triggerCheckUpdates(checkUpdatesEntityIds)}
                  >
                    <ha-icon icon="mdi:refresh" class=${this._checking ? 'spinning' : ''}></ha-icon>
                    ${this._checking ? 'Checking…' : 'Check for updates'}
                  </button>
                `
              : nothing}
            ${bulkButtonIds.length > 0
              ? html`
                  <button class="bulk-button" ?disabled=${this._triggering} @click=${() => this._triggerBulkUpdate(bulkButtonIds)}>
                    <ha-icon icon="mdi:arrow-up-circle"></ha-icon>
                    ${this._triggering ? 'Updating…' : 'Update all'}
                  </button>
                `
              : nothing}
          </div>
        </div>
        <div class="body">
          ${totalUpdates === 0
            ? html`<div class="empty-note">
                <ha-icon icon="mdi:check-circle-outline"></ha-icon>
                <span>Everything up to date.</span>
              </div>`
            : groups.map(
                (g) => html`
                  <div class="env-group">
                    ${showGroupHeaders ? html`<div class="env-group-title">${g.envName}</div>` : nothing}
                    ${g.updates.map((u) => this._renderUpdateRow(u))}
                  </div>
                `
              )}
        </div>
      </ha-card>
    `;
  }

  private _renderUpdateRow(u: PendingUpdate): TemplateResult {
    return html`
      <div class="update-row clickable" tabindex="0" role="button" @click=${() => this._moreInfo(u.entityId)} @keydown=${this._onKeydown(u.entityId)}>
        <ha-icon icon="mdi:arrow-up-circle"></ha-icon>
        <span class="update-name">${u.name}</span>
        ${u.installedVersion && u.latestVersion
          ? html`<span class="update-versions">${u.installedVersion} → ${u.latestVersion}</span>`
          : nothing}
      </div>
    `;
  }

  private async _triggerBulkUpdate(entityIds: string[]): Promise<void> {
    if (!this._hass || this._triggering) return;
    this._triggering = true;
    try {
      await this._hass.callService('button', 'press', {}, { entity_id: entityIds });
    } finally {
      this._triggering = false;
    }
  }

  private async _triggerCheckUpdates(entityIds: string[]): Promise<void> {
    if (!this._hass || this._checking || entityIds.length === 0) return;
    this._checking = true;
    try {
      // Press every environment's button — as of ha-dockhand's
      // DockhandUpdateCoordinator.async_check_environment(), each
      // environment's "Check for updates" button genuinely only checks
      // its own environment, so this is real, non-redundant work per
      // button, not duplicated effort. (An earlier version of this card
      // pressed only the first entity, since at the time every button
      // triggered a full all-environments refresh regardless of which
      // one was pressed — that's no longer how it works, ha-dockhand
      // fixed the underlying design rather than the card working around
      // it.)
      await this._hass.callService('button', 'press', {}, { entity_id: entityIds });
    } finally {
      this._checking = false;
    }
  }
}
