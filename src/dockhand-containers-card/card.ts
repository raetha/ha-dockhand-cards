import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices, getContainerDevicesForEnvironment, getEnvId, getRepresentativeEntityId, type EnvironmentDeviceOption } from '../common/device-utils';
import { resolveCardName, migrateTitleToName, multiEnvCardNameFallback } from '../common/card-name';
import { resolveIncludedOrderedWithLegacy, groupRowsByEnvironment, resolveEffectiveGroupBy } from '../common/environment-scope';
import { resolveContainerEntities, findPrimaryEntityByDomain, type ResolutionResult } from '../common/entity-resolver';
import { getDockhandBaseUrl } from '../common/format';
import { renderSettingsLink, renderIcon, onKeydownActivate } from '../common/icon';
import type { ContainerTranslationKey } from '../common/const';
import { HEALTH_ICON, HEALTH_STATUS_CLASS } from '../common/const';
import { DEFAULT_CONTAINERS_BADGES, type DockhandContainersCardConfig, type ContainersGroupBy, type ContainersSortBy } from './types';
import { cardStyles } from './styles';

// Matches Dockhand's own statusTypes color list (src/routes/containers/+page.svelte).
const STATE_ICON: Record<string, { icon: string; cls: 'ok' | 'warn' | 'error' | 'info' | 'neutral' }> = {
  running: { icon: 'mdi:play-circle', cls: 'ok' },
  paused: { icon: 'mdi:pause-circle', cls: 'warn' },
  restarting: { icon: 'mdi:refresh-circle', cls: 'error' },
  exited: { icon: 'mdi:stop-circle', cls: 'error' },
  created: { icon: 'mdi:plus-circle-outline', cls: 'info' },
  dead: { icon: 'mdi:close-circle', cls: 'neutral' }
};

// Attention-first ordering for sort_by/group_by: 'status' — matching
// every other card's own status-priority convention.
const STATUS_RANK: Record<string, number> = {
  dead: 0,
  restarting: 1,
  exited: 1,
  paused: 2,
  created: 3,
  running: 4
};

function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 5;
}

interface ContainerRow {
  name: string;
  status: string;
  environment: string;
  environmentDeviceId: string;
  found: ResolutionResult<ContainerTranslationKey>['found'];
  updateEntityId: string | null;
}

function byNameThenEnvironment(a: ContainerRow, b: ContainerRow): number {
  const byName = a.name.localeCompare(b.name);
  return byName !== 0 ? byName : a.environment.localeCompare(b.environment);
}

export function sortContainerRows(rows: ContainerRow[], sortBy: ContainersSortBy): ContainerRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortBy === 'status') {
      const rankA = statusRank(a.status);
      const rankB = statusRank(b.status);
      if (rankA !== rankB) return rankA - rankB;
    }
    return byNameThenEnvironment(a, b);
  });
  return sorted;
}

function statusKeyAndLabel(row: ContainerRow): { key: string; label: string } {
  return { key: row.status, label: row.status.charAt(0).toUpperCase() + row.status.slice(1) };
}

export function groupContainerRows(
  rows: ContainerRow[],
  groupBy: ContainersGroupBy | undefined,
  sortBy: ContainersSortBy,
  envDevices: EnvironmentDeviceOption[] = []
): { label: string | null; rows: ContainerRow[] }[] {
  if (!groupBy || groupBy === 'none') return [{ label: null, rows: sortContainerRows(rows, sortBy) }];

  // 'environment' groups by iterating envDevices directly — see Stacks'
  // identical fix (groupStackRows) for the full reasoning; same
  // structural bug, same fix, both cards.
  if (groupBy === 'environment') {
    return groupRowsByEnvironment(rows, envDevices, (bucketRows) => sortContainerRows(bucketRows, sortBy));
  }

  const buckets = new Map<string, { label: string; rows: ContainerRow[] }>();
  for (const row of rows) {
    const { key, label } = statusKeyAndLabel(row);
    if (!buckets.has(key)) buckets.set(key, { label, rows: [] });
    buckets.get(key)!.rows.push(row);
  }

  const entries = [...buckets.entries()];
  entries.sort(([keyA], [keyB]) => statusRank(keyA) - statusRank(keyB));

  return entries.map(([, bucket]) => ({ label: bucket.label, rows: sortContainerRows(bucket.rows, sortBy) }));
}

export class DockhandContainersCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandContainersCardConfig;
  @state() private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(): Partial<DockhandContainersCardConfig> {
    return { type: 'custom:dockhand-containers-card' };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor');
    return document.createElement('dockhand-containers-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandContainersCardConfig): void {
    this._config = { show_settings_link: true, sort_by: 'name', ...(migrateTitleToName(config as Record<string, unknown>) as DockhandContainersCardConfig) };
  }

  set config(config: DockhandContainersCardConfig) {
    this.setConfig(config);
  }

  getCardSize(): number {
    if (!this._hass || !this._config) return 3;
    const { rows } = this._buildRows();
    return Math.max(2, Math.ceil(rows.length / 2) + 1);
  }

  getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 2 };
  }

  private _moreInfo(entityId: string | null | undefined): void {
    if (!entityId) return;
    fireEvent(this, 'hass-more-info', { entityId });
  }

  private _resolveBaseUrl(envDevices: EnvironmentDeviceOption[]): string | null {
    for (const env of envDevices) {
      const device = this._hass!.devices[env.deviceId];
      const base = device ? getDockhandBaseUrl(device.configuration_url) : null;
      if (base) return base;
    }
    return null;
  }

  private _buildRows(): { rows: ContainerRow[]; envDevices: EnvironmentDeviceOption[] } {
    if (!this._hass || !this._config) return { rows: [], envDevices: [] };

    const envDevices = resolveIncludedOrderedWithLegacy(getEnvironmentDevices(this._hass), this._config.environments_order, this._config.exclude_device_ids, this._config.device_id);

    const rows: ContainerRow[] = envDevices.flatMap((env) => {
      const envId = getEnvId(this._hass!.devices[env.deviceId]);
      const containerDevices = envId !== null ? getContainerDevicesForEnvironment(this._hass!, envId) : [];
      return containerDevices
        .map((d) => {
          const { found } = resolveContainerEntities(this._hass!, d.id, ['state', 'health', 'cpuPercent', 'memoryPercent']);
          if (!found.state) return null;
          const update = findPrimaryEntityByDomain(this._hass!, d.id, 'update');
          return {
            name: found.state.state.attributes.name || d.name_by_user || d.name || d.id,
            status: found.state.state.state,
            environment: env.name,
            environmentDeviceId: env.deviceId,
            found,
            updateEntityId: update?.state.state === 'on' ? update.entityId : null
          };
        })
        .filter((r): r is ContainerRow => r !== null);
    });

    return { rows, envDevices };
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    const { rows, envDevices } = this._buildRows();
    if (envDevices.length === 0) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>No environment selected. Edit this card to pick one or more.</span>
        </div>
      </ha-card>`;
    }

    const representativeEntityId = getRepresentativeEntityId(this._hass, envDevices[0].deviceId);
    const name = resolveCardName(this._hass, representativeEntityId, this._config.name, multiEnvCardNameFallback(envDevices, 'Containers'));
    const base = this._resolveBaseUrl(envDevices);
    const groups = groupContainerRows(rows, resolveEffectiveGroupBy(this._config.group_by, envDevices, 'environment'), this._config.sort_by ?? 'name', envDevices);

    return html`
      <ha-card>
        <div class="body">
          <div class="card-header">
            <div class="header-left">
              ${renderIcon({ baseClass: 'card-badge', icon: 'mdi:docker', static: true })}
              <span class="truncate">${name}</span>
            </div>
            <div class="header-right">
              ${renderSettingsLink({
                hass: this._hass,
                show: this._config?.show_settings_link,
                href: base ? `${base}/containers` : null,
                tooltipKey: 'settings_link_view_containers'
              })}
            </div>
          </div>
          <div class="divider"></div>
          ${rows.length === 0
            ? html`<div class="card-message">No containers found for the selected environment(s) yet.</div>`
            : groups.map(
                (group, i) => html`
                  ${i > 0 ? html`<div class="divider"></div>` : nothing}
                  ${group.label !== null ? html`<div class="group-header">${group.label}</div>` : nothing}
                  <div class="list">${group.rows.map((r) => this._renderRow(r))}</div>
                `
              )}
        </div>
      </ha-card>
    `;
  }

  private _renderRow(row: ContainerRow): TemplateResult {
    const found = row.found;
    const st = found.state!.state.state;
    const stateIcon = STATE_ICON[st] ?? { icon: 'mdi:help-circle', cls: 'neutral' as const };
    const health = found.health?.state.state;
    const healthId = found.health?.entityId;
    const cpu = found.cpuPercent ? Number(found.cpuPercent.state.state) : undefined;
    const cpuId = found.cpuPercent?.entityId;
    const mem = found.memoryPercent ? Number(found.memoryPercent.state.state) : undefined;
    const memId = found.memoryPercent?.entityId;
    const id = found.state!.entityId;
    const visible = new Set(this._config?.visible_badges ?? DEFAULT_CONTAINERS_BADGES);

    return html`
      <div class="row clickable" tabindex="0" role="button" @click=${() => this._moreInfo(id)} @keydown=${onKeydownActivate(() => this._moreInfo(id))}>
        <div class="row-left">
          <ha-icon class="row-icon ${stateIcon.cls}" icon=${stateIcon.icon}></ha-icon>
          <span class="item-name">${row.name}</span>
          ${visible.has('environment') ? html`<span class="label-pill">${row.environment}</span>` : nothing}
        </div>
        <div class="row-right">
          ${(health === 'healthy' || health === 'unhealthy' || health === 'starting') && visible.has('health')
            ? renderIcon({
                baseClass: 'row-icon',
                icon: HEALTH_ICON[health] ?? 'mdi:heart-outline',
                colorClass: HEALTH_STATUS_CLASS[health] as 'ok' | 'warn' | 'error' | undefined,
                title: health,
                onClick: () => this._moreInfo(healthId)
              })
            : nothing}
          ${row.updateEntityId && visible.has('updates')
            ? renderIcon({
                baseClass: 'row-icon',
                icon: 'mdi:arrow-up-circle',
                colorClass: 'warn',
                title: 'Update available',
                onClick: () => this._moreInfo(row.updateEntityId)
              })
            : nothing}
          ${cpu !== undefined && visible.has('cpu')
            ? renderIcon({
                baseClass: 'row-icon',
                icon: 'mdi:cpu-64-bit',
                text: `${cpu.toFixed(0)}%`,
                onClick: () => this._moreInfo(cpuId)
              })
            : nothing}
          ${mem !== undefined && visible.has('memory')
            ? renderIcon({
                baseClass: 'row-icon',
                icon: 'mdi:memory',
                text: `${mem.toFixed(0)}%`,
                onClick: () => this._moreInfo(memId)
              })
            : nothing}
        </div>
      </div>
    `;
  }
}
